/* AI 工厂 SEL UI 页面：复用公共 Panel、Tree、Grid 骨架，并保留项目流程画布。 */
(function app() {
    "use strict";

    window.sel.require([
        "core.element", "core.query", "core.freeze", "components.panel", "components.tree",
        "components.grid", "components.dropdownMenu", "components.window", "components.confirmDialog",
        "components.pageBackground", "components.personalization", "components.workflowCanvas"
    ]);
    const selBase = window.sel.core;
    const { element, query, freeze: selFreeze } = selBase;
    const {
        panel, tree, grid, dropdownMenu, window: windowComponent, confirmDialog,
        pageBackground, personalization, workflowCanvas
    } = window.sel.components;
    const host = query("[data-aifactory-app]");
    const personalizationHost = query("[data-sel-personalization-host]");
    const gridId = "selGridAiFactoryManagementId";
    const projectEditorId = "selWindowAiFactoryProjectEditorId";
    const roleEditorId = "selWindowAiFactoryRoleEditorId";
    const deleteId = "selConfirmAiFactoryProjectDeleteId";
    const roleTypeOptionSetCode = "optionSet103006";
    const managedRoleCodes = new Set(["REQUIREMENT_ANALYST", "SOFTWARE_ENGINEER", "TEST_ENGINEER",
        "REQUIREMENT_REVIEWER", "SOFTWARE_REVIEWER", "TEST_QUALITY_REVIEWER", "PROJECT_MANAGER"]);
    const state = {
        dashboard: { projects: [], roles: [], rules: [], gates: [] }, workflow: {},
        roleTypeLabels: new Map(),
        section: "projects", projectId: "", treeSelectionId: "projects", headerVisible: true,
        panelRoot: null, treeController: null, gridController: null, canvasHost: null,
        canvasController: null, projectEditorController: null, roleEditorController: null,
        deleteController: null, editingProject: null, editingRole: null
    };
    const definitions = selFreeze({
        projects: { label: "项目管理", rowLabel: "项目", columns: [
            ["projectCode", "项目编码", "150px"], ["projectName", "项目名称", "180px"],
            ["description", "说明", "360px"], ["statusLabel", "状态", "90px"]] },
        rules: { label: "规则管理", rowLabel: "规则", columns: [
            ["ruleName", "规则名称", "200px"], ["ruleType", "规则类型", "110px"],
            ["logicalPath", "本地规则路径", "520px"], ["statusLabel", "状态", "90px"]] },
        gates: { label: "AI 门禁", rowLabel: "门禁", columns: [
            ["gateName", "门禁名称", "200px"], ["gateType", "门禁类型", "120px"],
            ["description", "说明", "420px"], ["statusLabel", "状态", "90px"]] },
        workflow: { label: "流程设计", rowLabel: "流程", columns: [["name", "流程", "240px"]] },
        progress: { label: "执行进度", rowLabel: "进度", columns: [
            ["nodeName", "角色节点", "180px"], ["roleName", "角色", "150px"],
            ["statusLabel", "状态", "100px"], ["currentWork", "当前工作", "280px"],
            ["elapsedMillis", "耗时(ms)", "120px"], ["localLogPath", "本地审计日志", "420px"]] },
        roles: { label: "角色管理", rowLabel: "角色", columns: [
            ["roleName", "角色名称", "180px"], ["roleTypeLabel", "角色类型", "110px"],
            ["experienceLabel", "经验", "100px"], ["specialty", "专业范围", "260px"]] }
    });
    const layout = selFreeze({
        top: [{ component: "title", payload: "title" }],
        left: [{ component: "selTree", payload: "tree" }],
        center: [{ component: "selGrid", payload: "$aggregate" }], right: [],
        bottom: [{ component: "footer", children: [
            { component: "gridSummary", payload: "pagination", children: [
                { component: "selDropdownMenu", slot: "pageSize", payload: "select.pageSize" }
            ] },
            { component: "pagination", payload: "pagination" },
            { component: "feedback", payload: "title.messages" }
        ] }]
    });

    /** 请求同源 AI 工厂接口并统一处理业务错误。 */
    async function api(url, options) {
        const response = await fetch(url, options);
        const json = await response.json();
        if (!response.ok || json.success === false) throw new Error(json.msg || "请求失败");
        return json.data ?? json;
    }

    /** 把业务字段转换成标准表单请求。 */
    function post(values) {
        const body = new URLSearchParams();
        Object.entries(values).forEach(([key, value]) => body.set(key, value == null ? "" : String(value)));
        return { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body };
    }

    /** 返回未删除的项目、当前项目与流程可用角色。 */
    function projects() {
        return (state.dashboard.projects || []).filter((row) =>
            row.projectCode !== "PROJECT_ROOT" && String(row.status) !== "0");
    }
    /** 返回当前选中的项目；未选中时回退到第一个可用项目。 */
    function currentProject() {
        return projects().find((row) => String(row.id) === String(state.projectId)) || projects()[0];
    }
    /** 返回允许加入开发流程画布的三类工程角色。 */
    function workflowRoles() {
        const visible = new Set(["REQUIREMENT_ANALYST", "SOFTWARE_ENGINEER", "TEST_ENGINEER"]);
        return (state.dashboard.roles || []).filter((row) => visible.has(String(row.roleCode)));
    }

    /** 返回角色管理中的全部普通启用角色，固定根和分类节点不进入编辑区。 */
    function managedRoles() {
        return (state.dashboard.roles || []).filter((row) => managedRoleCodes.has(String(row.roleCode))
            && String(row.status) !== "0");
    }

    /** 角色类型名称只读取引用数据工作台维护的共享选项组。 */
    function roleTypeLabel(value) {
        const code = String(value || "");
        return state.roleTypeLabels.get(code) || code || "—";
    }

    /** 把服务端稳定值转换为页面显示文本。 */
    function label(value) {
        const labels = {
            "1": "启用", "0": "停用", ENGINEER: "工程师", REVIEWER: "审核员",
            EXPERIENCED: "有经验", INEXPERIENCED: "无经验", WAITING: "等待",
            RUNNING: "执行中", COMPLETED: "已完成", FAILED: "失败"
        };
        return labels[String(value ?? "")] || String(value ?? "—");
    }

    /** 加载管理快照和当前项目流程。 */
    async function loadData() {
        const dashboard = await api("/api/v1/ai-factory/management/dashboard");
        state.dashboard = {
            projects: Array.isArray(dashboard.projects) ? dashboard.projects : [],
            roles: Array.isArray(dashboard.roles) ? dashboard.roles : [],
            rules: Array.isArray(dashboard.rules) ? dashboard.rules : [],
            gates: Array.isArray(dashboard.gates) ? dashboard.gates : []
        };
        if (!projects().some((row) => String(row.id) === String(state.projectId))) {
            state.projectId = String(projects()[0]?.id || "");
        }
        state.workflow = state.projectId
            ? await api(`/api/v1/ai-factory/workflows/snapshot?projectId=${encodeURIComponent(state.projectId)}`)
            : {};
    }

    /** 加载角色类型引用数据，避免角色管理复制工程师和审核员名称。 */
    async function loadRoleTypes() {
        const options = await api(`/api/reference-data/options/${roleTypeOptionSetCode}?locale=zh-CN`);
        state.roleTypeLabels = new Map((Array.isArray(options) ? options : []).map((option) => [
            String(option.value || ""), String(option.label || option.value || "")
        ]).filter(([value]) => value));
    }

    /** 根据当前项目和分类返回记录。 */
    function rowsFor(section = state.section, projectId = state.projectId) {
        const scoped = (records) => (records || []).filter((row) => String(row.projectId) === String(projectId));
        if (section === "projects") return projects();
        if (section === "rules") return scoped(state.dashboard.rules);
        if (section === "gates") return scoped(state.dashboard.gates).filter((row) =>
            ["REQUIREMENT_CHECKER", "CODE_CHECKER", "PROJECT_MANAGER_CONTROL"].includes(String(row.gateCode)));
        if (section === "progress") return state.workflow.progress || [];
        if (section === "roles") return managedRoles();
        return [];
    }

    /** 为公共 Grid 补充只用于显示的字段。 */
    function displayRows() {
        return rowsFor().map((record, index) => ({
            ...record, id: String(record.id ?? `row-${index}`), statusLabel: label(record.status),
            roleTypeLabel: roleTypeLabel(record.roleType), experienceLabel: label(record.experienceLevel)
        }));
    }

    /** 返回分类数量；流程与进度直接读取当前项目快照。 */
    function sectionCount(section, projectId = state.projectId) {
        if (section === "workflow") return (state.workflow.nodes || []).length;
        return rowsFor(section, projectId).length;
    }

    /** 按“项目管理 → 项目 → 业务页”构造公共 Tree 数据。 */
    function treeItems() {
        const projectItems = projects().map((project) => ({
            id: `project-${project.id}`, label: String(project.projectName || project.projectCode), count: 4,
            filter: { section: "projects", projectId: String(project.id), treeSelectionId: `project-${project.id}` },
            children: [["rules", "规则管理", "ri-file-list-3-line"],
                ["gates", "AI 门禁", "ri-shield-check-line"],
                ["workflow", "流程设计", "ri-flow-chart"],
                ["progress", "执行进度", "ri-timer-line"]].map(([section, itemLabel, icon]) => ({
                    id: `${section}-${project.id}`, label: itemLabel, icon,
                    count: sectionCount(section, project.id),
                    filter: { section, projectId: String(project.id), treeSelectionId: `${section}-${project.id}` },
                    children: []
                }))
        }));
        return [{
            id: "projects", label: "项目管理", count: projects().length,
            filter: { section: "projects", projectId: state.projectId, treeSelectionId: "projects" },
            children: projectItems
        }, {
            id: "roles", label: "角色管理", count: managedRoles().length,
            filter: { section: "roles", projectId: state.projectId, treeSelectionId: "roles" }, children: []
        }];
    }

    /** 组装公共 Panel、Tree、Grid 的完整聚合视图。 */
    function payload() {
        const definition = definitions[state.section];
        const rows = displayRows();
        const project = currentProject();
        const columns = definition.columns.map(([field, columnLabel, width]) => ({
            id: field, field, label: columnLabel, width, renderer: "text"
        }));
        if (state.section === "projects") columns.push({
            id: "actions", field: "id", label: "操作", width: "112px", renderer: "actions",
            actions: [
                { id: "edit", label: (record) => `编辑项目“${record.projectName}”`, icon: "ri-edit-line" },
                { id: "delete", label: (record) => `删除项目“${record.projectName}”`, icon: "ri-delete-bin-line", tone: "danger" }
            ]
        });
        if (state.section === "roles") columns.push({
            id: "actions", field: "id", label: "操作", width: "112px", renderer: "actions",
            actions: [
                { id: "edit", label: (record) => `编辑角色“${record.roleName}”`, icon: "ri-edit-line" },
                { id: "delete", label: (record) => `删除角色“${record.roleName}”`, icon: "ri-delete-bin-line", tone: "danger" }
            ]
        });
        return selFreeze({
            grid: { mode: "records", selectionMode: "NONE", idField: "id", searchFields: [], horizontalScroll: true },
            data: { items: rows, selectedIds: [] }, select: { projectType: null, status: null,
                pageSize: { gridId, role: "page-size", label: "每页条数", ariaLabel: "每页显示条数",
                    currentTemplate: "{label}，当前：{value}", menuTitle: "选择每页显示条数", scrollAfter: 4,
                    options: [{ value: "10", label: "10 条/页", icon: "ri-list-check-3", selected: true },
                        { value: "20", label: "20 条/页", icon: "ri-list-check-3" },
                        { value: "50", label: "50 条/页", icon: "ri-list-check-3" }] } },
            column: { gridId, tableTitle: `${definition.label}表格`, ariaLabel: `${definition.label}表格`,
                emptyText: state.section === "workflow" ? "流程画布正在显示" : `当前没有${definition.rowLabel}数据`, items: columns },
            title: {
                title: "AI 工厂管理", subtitle: project ? `当前项目：${project.projectName}` : "尚未登记项目",
                description: `${definition.label} · 项目作用域、AI 门禁、流程与执行审计`,
                ariaLabel: "AI 工厂项目、规则、门禁、流程、进度和角色管理",
                ariaLabels: { statusTabs: "管理分类统计", headerActions: "页面操作", sidebar: "管理树",
                    content: "管理内容", board: "管理表格", pagination: "记录统计" },
                statusTabs: Object.entries(definitions).map(([key, item]) => ({
                    value: key, label: item.label, count: sectionCount(key)
                })),
                actions: state.section === "projects"
                    ? [{ id: "new", label: "新增项目", icon: "ri-add-line", primary: true }] : [],
                messages: { expandLeftRegion: "展开管理树", collapseLeftRegion: "收起管理树",
                    newOpened: "已打开新增项目窗口" }
            },
            tree: { gridId, ariaLabel: "AI 工厂管理树", heading: "管理树",
                summary: "项目、规则、AI 门禁、流程、进度和角色", selectedId: state.treeSelectionId,
                expandLabelTemplate: "展开{label}", collapseLabelTemplate: "收起{label}", items: treeItems() },
            menu: { gridId, ariaLabel: "AI 工厂表格操作" },
            pagination: { gridId, mode: "LOCAL", currentPage: 1, pageSize: 10, totalCount: rows.length,
                summaryAll: state.section === "workflow" ? "流程画布" : "共 {total} 条",
                summaryFiltered: "当前 {visible} 条 · 共 {total} 条", previousLabel: "上一页", nextLabel: "下一页",
                pageChangedMessage: "已切换到第 {page} 页", pageSizeChangedMessage: "每页显示 {size} 条" }
        });
    }

    /** 标记当前业务分类，并避免公共 Grid 把分类标签当作状态筛选。 */
    function markActiveSection() {
        state.panelRoot.querySelectorAll("[data-status-filter]").forEach((button) => {
            const active = button.dataset.statusFilter === state.section;
            button.classList.toggle("selpanel-status-tab-active", active);
            if (active) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });
    }

    /** 刷新公共组件，并在流程页切换表格与流程画布。 */
    function refreshView() {
        const view = payload();
        panel.setLocale(state.panelRoot, { view, expandLeftLabel: "展开管理树", collapseLeftLabel: "收起管理树" });
        state.treeController.setLocale(view.tree);
        state.gridController.setLocale(view);
        const board = state.panelRoot.querySelector('[data-sel-panel-component="selGrid"]');
        const workflowVisible = state.section === "workflow";
        if (board) board.hidden = workflowVisible;
        state.canvasHost.hidden = !workflowVisible;
        if (workflowVisible) state.canvasController.update({
            roles: workflowRoles(), nodes: state.workflow.nodes || [], edges: state.workflow.edges || []
        });
        markActiveSection();
    }

    /** 切换分类；跨项目时先取得对应流程快照。 */
    async function selectSection(section, projectId = state.projectId, treeSelectionId = section) {
        if (!definitions[section]) return;
        const changed = String(projectId) !== String(state.projectId);
        state.section = section;
        state.projectId = String(projectId || state.projectId || "");
        state.treeSelectionId = String(treeSelectionId || section);
        if (changed && state.projectId) {
            state.workflow = await api(`/api/v1/ai-factory/workflows/snapshot?projectId=${encodeURIComponent(state.projectId)}`);
        }
        refreshView();
    }

    /** 构建公共 Window 使用的项目编辑配置。 */
    function editorOptions(title) {
        return { id: projectEditorId, title, subtitle: "AI Factory Project", closeLabel: "关闭项目编辑窗口",
            cancelLabel: "取消", submitLabel: "保存", validationMessage: "请填写项目编码和项目名称。", autoSuccess: false,
            rows: [
                [{ name: "projectCode", label: "项目编码", type: "text", icon: "ri-code-line", required: true, maxLength: 80 }],
                [{ name: "projectName", label: "项目名称", type: "text", icon: "ri-folder-3-line", required: true, maxLength: 120 }],
                [{ name: "description", label: "项目说明", type: "textarea", icon: "ri-file-text-line", maxLength: 500 }]
            ] };
    }

    /** 构建角色编辑公共 Window，角色类型名称继续来自引用数据工作台。 */
    function roleEditorOptions() {
        return { id: roleEditorId, title: "编辑角色", subtitle: "AI Factory Role", closeLabel: "关闭角色编辑窗口",
            cancelLabel: "取消", submitLabel: "保存", validationMessage: "请填写角色名称、类型和经验级别。", autoSuccess: false,
            rows: [
                [{ name: "roleCode", label: "角色编码", type: "text", icon: "ri-code-line", readOnly: true }],
                [{ name: "roleName", label: "角色名称", type: "text", icon: "ri-user-line", required: true, maxLength: 120 }],
                [{ name: "roleType", label: "角色类型", type: "select", required: true,
                    options: Array.from(state.roleTypeLabels, ([value, optionLabel]) => ({
                        value, label: optionLabel, icon: value === "REVIEWER" ? "ri-shield-check-line" : "ri-tools-line"
                    })) }],
                [{ name: "experienceLevel", label: "经验级别", type: "select", required: true,
                    options: [{ value: "EXPERIENCED", label: "有经验", icon: "ri-history-line" },
                        { value: "INEXPERIENCED", label: "无经验", icon: "ri-sparkling-line" }] }],
                [{ name: "specialty", label: "专业范围", type: "text", icon: "ri-focus-3-line", maxLength: 200 }]
            ] };
    }

    /** 打开并保存项目公共编辑窗口。 */
    function openEditor(record = null) {
        state.editingProject = record ? { ...record } : null;
        state.projectEditorController.setLocale(editorOptions(record ? "编辑项目" : "新增项目"));
        state.projectEditorController.reset();
        state.projectEditorController.setValues(record || {});
        state.projectEditorController.setFeedback("");
        state.projectEditorController.open();
    }

    /** 打开指定普通角色的公共编辑窗口。 */
    function openRoleEditor(record) {
        state.editingRole = { ...record };
        state.roleEditorController.setLocale(roleEditorOptions());
        state.roleEditorController.reset();
        state.roleEditorController.setValues(record);
        state.roleEditorController.setFeedback("");
        state.roleEditorController.open();
    }
    /** 保存项目表单并刷新当前管理视图。 */
    async function saveProject(values) {
        state.projectEditorController.setLoading(true);
        state.projectEditorController.setFeedback("正在保存项目…");
        try {
            const record = state.editingProject;
            await api(`/api/v1/ai-factory/projects/${record ? "update" : "create"}.htm`, post({
                ...values, id: record?.id, status: record?.status ?? 1, sortnum: record?.sortnum || 10
            }));
            state.projectEditorController.close();
            await loadData();
            refreshView();
            selBase.toast("项目已保存。", "success");
        } catch (error) {
            state.projectEditorController.setFeedback(error.message || "项目保存失败。", true);
        } finally {
            state.projectEditorController.setLoading(false);
        }
    }

    /** 保存角色可维护字段，固定结构、连接池策略和排序由服务端继续负责。 */
    async function saveRole(values) {
        if (!state.editingRole?.id) return;
        state.roleEditorController.setLoading(true);
        state.roleEditorController.setFeedback("正在保存角色…");
        try {
            await api("/api/v1/ai-factory/roles/update.htm", post({ id: state.editingRole.id,
                roleName: values.roleName, roleType: values.roleType,
                experienceLevel: values.experienceLevel, specialty: values.specialty }));
            state.roleEditorController.close();
            state.editingRole = null;
            await loadData();
            refreshView();
            selBase.toast("角色已保存。", "success");
        } catch (error) {
            state.roleEditorController.setFeedback(error.message || "角色保存失败。", true);
        } finally {
            state.roleEditorController.setLoading(false);
        }
    }

    /** 二次确认后逻辑删除项目。 */
    async function deleteProject(record) {
        const confirmed = await state.deleteController.open({ title: "删除项目",
            message: "删除后该项目不再出现在项目管理中。", target: String(record.projectName || record.projectCode),
            icon: "ri-delete-bin-line", tone: "danger", cancelLabel: "取消", confirmLabel: "确认删除" });
        if (!confirmed) return;
        await api("/api/v1/ai-factory/projects/delete.htm", post({ id: record.id }));
        await loadData();
        state.treeSelectionId = "projects";
        refreshView();
        selBase.toast("项目已删除。", "success");
    }

    /** 二次确认后逻辑删除普通角色，引用关系和结构节点由服务端门禁拦截。 */
    async function deleteRole(record) {
        const confirmed = await state.deleteController.open({ title: "删除角色",
            message: "删除后该角色不再出现在角色管理和流程角色选择中。", target: String(record.roleName || record.roleCode),
            icon: "ri-delete-bin-line", tone: "danger", cancelLabel: "取消", confirmLabel: "确认删除" });
        if (!confirmed) return;
        await api("/api/v1/ai-factory/roles/delete.htm", post({ id: record.id }));
        await loadData();
        refreshView();
        selBase.toast("角色已删除。", "success");
    }

    /** 在公共主题入口旁挂载始终可见的标题栏显隐按钮。 */
    function mountHeaderToggle() {
        const control = personalizationHost.querySelector(".selpersonal-control");
        const themeTrigger = control?.querySelector(".selpersonal-trigger");
        if (!control || !themeTrigger) throw new Error("AI 工厂顶部控制区挂载失败。");
        const button = element("button", { className: "aifactory-header-toggle" });
        button.type = "button";
        const render = () => {
            state.panelRoot.classList.toggle("aifactory-header-hidden", !state.headerVisible);
            button.setAttribute("aria-expanded", String(state.headerVisible));
            button.setAttribute("aria-label", state.headerVisible ? "隐藏顶部区域" : "显示顶部区域");
            button.replaceChildren(
                element("i", { className: state.headerVisible ? "ri-eye-off-line" : "ri-eye-line" }),
                element("span", { text: state.headerVisible ? "隐藏" : "显示" })
            );
        };
        button.addEventListener("click", () => { state.headerVisible = !state.headerVisible; render(); });
        control.insertBefore(button, themeTrigger);
        render();
    }

    /** 按 Japanese 工作台顺序挂载公共 Panel、Tree、Grid 和流程画布。 */
    async function mount() {
        await Promise.all([loadData(), loadRoleTypes()]);
        const view = payload();
        state.panelRoot = panel.create(host, { gridId, sourceId: gridId, entity: "AiFactoryManagement",
            view: "management", layout: "single", structure: layout, ariaLabel: view.title.ariaLabel });
        if (!state.panelRoot || !panel.mount(state.panelRoot,
            { view, expandLeftLabel: "展开管理树", collapseLeftLabel: "收起管理树" })) {
            throw new Error("AI 工厂公共面板挂载失败。");
        }
        state.treeController = tree.mount(state.panelRoot, view.tree);
        dropdownMenu.mountAll(state.panelRoot);
        state.gridController = grid.mount(state.panelRoot, view);
        if (!state.treeController || !state.gridController) throw new Error("AI 工厂公共树或表格挂载失败。");
        const center = state.panelRoot.querySelector('[data-sel-panel-region="center"]');
        state.canvasHost = element("section", { className: "aifactory-workflow-host" });
        state.canvasHost.hidden = true;
        center.append(state.canvasHost);
        state.canvasController = workflowCanvas.mount(state.canvasHost,
            { roles: workflowRoles(), nodes: state.workflow.nodes || [], edges: state.workflow.edges || [], paletteLabel: "拖拽角色到画布" });
        state.projectEditorController = windowComponent.mount(host, editorOptions("新增项目"));
        state.roleEditorController = windowComponent.mount(host, roleEditorOptions());
        state.deleteController = confirmDialog.mount(host, { id: deleteId, title: "删除项目", tone: "danger" });
        if (!state.canvasController || !state.projectEditorController || !state.roleEditorController
                || !state.deleteController) {
            throw new Error("AI 工厂业务公共组件挂载失败。");
        }
        mountHeaderToggle();
        state.panelRoot.addEventListener("click", (event) => {
            const button = event.target.closest("[data-status-filter]");
            if (!button) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            selectSection(button.dataset.statusFilter);
        }, true);
        state.panelRoot.addEventListener("selTree:select", (event) => {
            const filter = event.detail?.filter || {};
            selectSection(filter.section, filter.projectId, filter.treeSelectionId)
                .catch((error) => selBase.toast(error.message, "error"));
        });
        state.panelRoot.addEventListener("selGrid:new", () => openEditor());
        state.panelRoot.addEventListener("selGrid:action", (event) => {
            if (event.detail?.instanceKey !== gridId) return;
            if (state.section === "projects" && event.detail.action === "edit") openEditor(event.detail.record);
            if (state.section === "projects" && event.detail.action === "delete") {
                deleteProject(event.detail.record).catch((error) => selBase.toast(error.message, "error"));
            }
            if (state.section === "roles" && event.detail.action === "edit") openRoleEditor(event.detail.record);
            if (state.section === "roles" && event.detail.action === "delete") {
                deleteRole(event.detail.record).catch((error) => selBase.toast(error.message, "error"));
            }
        });
        host.addEventListener("selWindow:submit", (event) => {
            if (event.detail?.id === roleEditorId) saveRole(event.detail.values);
            if (event.detail?.id === projectEditorId) saveProject(event.detail.values);
        });
        state.canvasHost.addEventListener("selWorkflowCanvas:nodeAdd", async (event) => {
            await api("/api/v1/ai-factory/workflows/nodes/create.htm",
                post({ workflowVersionId: state.workflow.version.id, ...event.detail }));
            await loadData(); refreshView();
        });
        state.canvasHost.addEventListener("selWorkflowCanvas:nodeMove", async (event) => {
            await api("/api/v1/ai-factory/workflows/nodes/move.htm", post(event.detail));
            await loadData(); refreshView();
        });
        state.canvasHost.addEventListener("selWorkflowCanvas:edgeAdd", async (event) => {
            await api("/api/v1/ai-factory/workflows/edges/create.htm", post(event.detail));
            await loadData(); refreshView();
        });
        markActiveSection();
    }

    // 背景与主题统一使用 SEL 公共组件，刷新后仍从普通极简浅色主题启动。
    const backgroundController = pageBackground.mount(query("[data-sel-page-background-host]"),
        { defaults: { theme: "solid-light", overlay: 0, brightness: 100, blur: 0 } });
    if (!backgroundController) throw new Error("AI 工厂页面背景挂载失败。");
    if (!personalization.mount(personalizationHost, { backgroundController })) {
        throw new Error("AI 工厂主题管理挂载失败。");
    }
    mount().catch((error) => {
        console.error("AI 工厂管理页启动失败。", error);
        selBase.toast(error.message || "AI 工厂管理页启动失败。", "error");
    });
}());
