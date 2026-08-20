/*
 * AI 工厂管理页：使用 SEL UI 公共 Panel、Tree、Grid，并默认以普通极简主题展示管理数据。
 * 页面只消费 Java 聚合接口，不自行维护数据库结构或复制公共控件。
 */
(function app() {
    "use strict";

    window.sel.require([
        "core.query", "core.freeze", "net.ajax", "components.panel", "components.tree", "components.grid",
        "components.window", "components.confirmDialog", "components.pageBackground", "components.personalization"
    ]);
    const selBase = window.sel.core;
    const { freeze: selFreeze, query } = selBase;
    const { ajax: selAjax } = window.sel.net;
    const {
        panel, tree, grid, window: windowComponent, confirmDialog, pageBackground, personalization
    } = window.sel.components;
    const aiFactoryHost = query("[data-aifactory-app]");
    const aiFactoryBackgroundHost = query("[data-sel-page-background-host]");
    const aiFactoryPersonalizationHost = query("[data-sel-personalization-host]");
    const aiFactoryGridId = "selGridAiFactoryManagementId";
    const aiFactoryRoleEditorId = "selWindowAiFactoryRoleEditorId";
    const aiFactoryRoleDeleteConfirmId = "selConfirmAiFactoryRoleDeleteId";
    const aiFactoryRoleApi = "/api/v1/ai-factory/roles/";
    // AiRole.roleType 只保存稳定值，中文显示统一来自引用数据工作台的共享选项组。
    const aiFactoryRoleTypeOptionSetCode = "optionSet103006";
    const aiFactoryState = {
        dashboard: { roles: [], gates: [], rules: [], projects: [], stages: [] },
        roleTypeLabels: new Map(),
        section: "roles",
        recordId: "",
        roleTypeFilter: "",
        treeSelectionId: "roles",
        headerVisible: true,
        panelRoot: null,
        treeController: null,
        gridController: null,
        roleEditorController: null,
        roleDeleteConfirmController: null,
        editingRole: null,
        reorderSaving: false
    };

    const aiFactorySectionDefinitions = selFreeze({
        roles: {
            label: "角色管理",
            rowLabel: "角色",
            columns: [
                ["roleName", "角色名称", "180px"], ["roleTypeLabel", "类型", "100px"],
                ["experienceLabel", "经验", "100px"], ["poolLabel", "Codex连接池", "130px"],
                ["specialty", "专业范围", "220px"]
            ]
        },
        gates: {
            label: "门禁管理",
            rowLabel: "门禁",
            columns: [
                ["gateName", "门禁名称", "200px"], ["gateTypeLabel", "门禁类型", "120px"],
                ["projectCode", "项目", "120px"], ["description", "说明", "360px"]
            ]
        },
        rules: {
            label: "规则管理",
            rowLabel: "规则",
            columns: [
                ["ruleName", "规则名称", "200px"], ["ruleScopeLabel", "范围", "100px"],
                ["projectCode", "项目", "120px"], ["logicalPath", "逻辑路径", "420px"]
            ]
        },
        projects: {
            label: "项目管理",
            rowLabel: "项目",
            columns: [
                ["projectName", "项目名称", "180px"], ["statusLabel", "状态", "100px"],
                ["currentStage", "当前阶段", "130px"], ["currentWork", "当前工作", "280px"],
                ["progressText", "进度", "90px"]
            ]
        },
        stages: {
            label: "执行进度",
            rowLabel: "阶段",
            columns: [
                ["stageName", "阶段", "150px"], ["statusLabel", "状态", "100px"],
                ["startedAt", "启动时间", "180px"], ["endedAt", "结束时间", "180px"],
                ["elapsedText", "使用时间", "120px"], ["currentWork", "当前工作", "260px"],
                ["localLogPath", "本地日志审计", "420px"], ["slowReason", "耗时说明", "260px"]
            ]
        }
    });

    const aiFactoryLayout = selFreeze({
        top: [{ component: "title", payload: "title" }],
        left: [{ component: "selTree", payload: "tree" }],
        center: [{ component: "selGrid", payload: "$aggregate" }],
        right: [],
        bottom: [{ component: "footer", children: [{ component: "gridSummary", payload: "pagination" }] }]
    });

    /** 把服务端枚举转换为普通中文显示文本。 */
    function aiFactoryLabel(value) {
        const labels = {
            EXPERIENCED: "有经验", INEXPERIENCED: "无经验",
            PERSISTENT: "常驻", DISPOSABLE: "用完即放弃", ROOT: "根节点", PROJECT: "项目",
            AI: "AI门禁", CODE: "代码门禁", COMMON: "通用规则", WAITING: "等待",
            RUNNING: "执行中", COMPLETED: "执行完成"
        };
        return labels[String(value || "")] || String(value || "—");
    }

    /** 使用引用数据选项组把角色类型稳定值转换为工作台维护的中文名称。 */
    function aiFactoryRoleTypeLabel(value) {
        const code = String(value || "");
        return aiFactoryState.roleTypeLabels.get(code) || code || "—";
    }

    /** 识别只用于构造角色树的固定根和分类节点，它们不进入普通角色编辑、删除和排序。 */
    function aiFactoryIsRoleStructure(record) {
        const roleCode = String(record?.roleCode || "");
        return record?.parentId == null || roleCode.endsWith("_ROOT");
    }

    /** 把毫秒耗时转换为可直接审计的时分秒文本。 */
    function aiFactoryDuration(value) {
        const totalSeconds = Math.max(0, Math.floor(Number(value || 0) / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours}时 ${minutes}分 ${seconds}秒`;
    }

    /** 为不同管理表补充页面显示字段，数据库稳定值保持不变。 */
    function aiFactoryDisplayRows(section, records) {
        return (records || []).map((record) => ({
            ...record,
            id: String(record.id),
            roleTypeLabel: aiFactoryRoleTypeLabel(record.roleType),
            experienceLabel: aiFactoryLabel(record.experienceLevel),
            poolLabel: aiFactoryLabel(record.codexPoolType),
            gateTypeLabel: aiFactoryLabel(record.gateType),
            ruleScopeLabel: aiFactoryLabel(record.ruleScope),
            statusLabel: aiFactoryLabel(record.status),
            progressText: `${Number(record.progressPercent || 0)}%`,
            elapsedText: aiFactoryDuration(record.elapsedMillis)
        })).filter((record) => !aiFactoryState.recordId || String(record.id) === aiFactoryState.recordId);
    }

    /** 把一张父子表转换为公共 Tree 的标准节点。 */
    function aiFactoryBuildTableTree(section, records, labelField) {
        const childrenByParent = new Map();
        (records || []).forEach((record) => {
            const key = record.parentId == null ? "ROOT" : String(record.parentId);
            if (!childrenByParent.has(key)) childrenByParent.set(key, []);
            childrenByParent.get(key).push(record);
        });
        const build = (record) => ({
            id: `${section}-${record.id}`,
            label: String(record[labelField] || record.id),
            count: (childrenByParent.get(String(record.id)) || []).length,
            filter: {
                section, recordId: String(record.id), roleTypeFilter: "",
                treeSelectionId: `${section}-${record.id}`
            },
            children: (childrenByParent.get(String(record.id)) || []).map(build)
        });
        return (childrenByParent.get("ROOT") || []).map(build);
    }

    /** 角色树只显示固定类型和两类角色，具体角色全部交给右侧表格维护。 */
    function aiFactoryBuildRoleTypeTree(records) {
        const root = records.find((record) => String(record.roleCode) === "ROLE_ROOT");
        if (!root) return [];
        const categories = records.filter((record) => ["ENGINEER_ROOT", "REVIEWER_ROOT"]
            .includes(String(record.roleCode)));
        return [{
            id: `roles-${root.id}`,
            label: String(root.roleName || "角色类型"),
            count: categories.length,
            filter: {
                section: "roles", recordId: "", roleTypeFilter: "",
                treeSelectionId: `roles-${root.id}`
            },
            children: categories.map((category) => ({
                id: `roles-${category.id}`,
                label: String(category.roleName || aiFactoryRoleTypeLabel(category.roleType)),
                count: records.filter((record) => !aiFactoryIsRoleStructure(record)
                    && String(record.roleType) === String(category.roleType)).length,
                filter: {
                    section: "roles", recordId: "", roleTypeFilter: String(category.roleType),
                    treeSelectionId: `roles-${category.id}`
                },
                children: []
            }))
        }];
    }

    /** 组装五类管理树，点击任意类别或节点都会刷新右侧公共 Grid。 */
    function aiFactoryBuildTreeItems() {
        const source = aiFactoryState.dashboard;
        const definitions = [
            ["roles", "roleName"], ["gates", "gateName"], ["rules", "ruleName"],
            ["projects", "projectName"], ["stages", "stageName"]
        ];
        return definitions.map(([section, labelField]) => ({
            id: section,
            label: aiFactorySectionDefinitions[section].label,
            count: section === "roles"
                ? source.roles.filter((record) => !aiFactoryIsRoleStructure(record)).length
                : source[section].length,
            filter: {
                section, recordId: "", roleTypeFilter: "", treeSelectionId: section
            },
            children: section === "roles"
                ? aiFactoryBuildRoleTypeTree(source.roles)
                : aiFactoryBuildTableTree(section, source[section], labelField)
        }));
    }

    /** 根据当前树节点返回公共 Panel 与 Grid 使用的完整视图。 */
    function aiFactoryBuildPayload() {
        const definition = aiFactorySectionDefinitions[aiFactoryState.section];
        const displayRecords = aiFactoryState.section === "roles"
            ? aiFactoryState.dashboard.roles.filter((record) => !aiFactoryIsRoleStructure(record)
                && (!aiFactoryState.roleTypeFilter
                    || String(record.roleType) === aiFactoryState.roleTypeFilter))
            : aiFactoryState.dashboard[aiFactoryState.section];
        const rows = aiFactoryDisplayRows(aiFactoryState.section, displayRecords);
        const roleManagement = aiFactoryState.section === "roles" && !aiFactoryState.recordId;
        const columns = definition.columns.map(([field, label, width]) => ({
            id: field, field, label, width, renderer: "text"
        }));
        if (aiFactoryState.section === "roles") {
            // 排序列紧邻操作列；固定树结构节点不会进入当前普通角色列表。
            if (roleManagement) columns.push({
                id: "rowOrder", field: "id", label: "排序", width: "68px", renderer: "dragHandle",
                icon: "ri-draggable", dragLabel: (record) => `上下拖拽调整“${record.roleName}”顺序`
            });
            columns.push({
                id: "actions", field: "id", label: "操作", width: "112px", renderer: "actions",
                actions: [
                    { id: "edit", label: (record) => `编辑角色“${record.roleName}”`, icon: "ri-edit-line" },
                    { id: "delete", label: (record) => `删除角色“${record.roleName}”`, icon: "ri-delete-bin-line", tone: "danger" }
                ]
            });
        }
        return selFreeze({
            grid: {
                mode: "records", selectionMode: "NONE", idField: "id", searchFields: [],
                horizontalScroll: true, rowReorder: roleManagement
            },
            data: { items: rows, selectedIds: [] },
            // 当前管理页不显示筛选下拉，但公共 Panel 仍要求标准 select 容器存在后才能挂载视图。
            select: { projectType: null, status: null, pageSize: null },
            column: {
                gridId: aiFactoryGridId,
                tableTitle: `${definition.label}表格`,
                ariaLabel: `${definition.label}表格`,
                emptyText: `当前没有${definition.rowLabel}数据`,
                items: columns
            },
            title: {
                title: "AI 工厂管理",
                subtitle: "AI Factory",
                description: `${definition.label} · 树表管理与执行审计`,
                ariaLabel: "AI 工厂角色、门禁、规则、项目和执行进度管理",
                ariaLabels: { statusTabs: "管理统计", headerActions: "页面操作", toolbar: "管理工具", sidebar: "管理树", content: "管理表格", board: "数据表格", pagination: "记录统计" },
                statusTabs: Object.entries(aiFactorySectionDefinitions).map(([key, item]) => ({
                    value: key,
                    label: item.label,
                    count: aiFactoryState.dashboard[key].length
                })),
                actions: [],
                resetLabel: "重置", messages: { expandLeftRegion: "展开管理树", collapseLeftRegion: "收起管理树" }
            },
            tree: {
                gridId: aiFactoryGridId, ariaLabel: "AI 工厂管理树", heading: "管理树",
                summary: "角色、门禁、规则、项目、执行进度",
                selectedId: aiFactoryState.treeSelectionId || (aiFactoryState.recordId
                    ? `${aiFactoryState.section}-${aiFactoryState.recordId}` : aiFactoryState.section),
                expandLabelTemplate: "展开{label}", collapseLabelTemplate: "收起{label}",
                items: aiFactoryBuildTreeItems()
            },
            menu: { gridId: aiFactoryGridId, ariaLabel: "AI 工厂表格操作" },
            pagination: { gridId: aiFactoryGridId, currentPage: 1, pageSize: Math.max(rows.length, 1), totalCount: rows.length, summaryAll: "共 {total} 条", summaryFiltered: "当前 {visible} 条 · 共 {total} 条" }
        });
    }

    /** 从 Java 控制面读取五类管理数据。 */
    async function aiFactoryLoadDashboard() {
        const result = await selAjax.request({ url: "/api/v1/ai-factory/management/dashboard" });
        aiFactoryState.dashboard = {
            roles: Array.isArray(result.data?.roles) ? result.data.roles : [],
            gates: Array.isArray(result.data?.gates) ? result.data.gates : [],
            rules: Array.isArray(result.data?.rules) ? result.data.rules : [],
            projects: Array.isArray(result.data?.projects) ? result.data.projects : [],
            stages: Array.isArray(result.data?.stages) ? result.data.stages : []
        };
    }

    /** 从引用数据工作台读取角色类型，页面不再复制工程师和审核员名称。 */
    async function aiFactoryLoadRoleTypeOptions() {
        const result = await selAjax.request({
            url: `/api/reference-data/options/${aiFactoryRoleTypeOptionSetCode}?locale=zh-CN`
        });
        const options = Array.isArray(result.data) ? result.data : [];
        aiFactoryState.roleTypeLabels = new Map(options.map((option) => [
            String(option.value || ""), String(option.label || option.value || "")
        ]).filter(([value]) => value));
    }

    /** 构建角色编辑公共 Window 配置，角色类型名称继续取自引用数据工作台。 */
    function aiFactoryBuildRoleEditorOptions() {
        return {
            id: aiFactoryRoleEditorId,
            title: "编辑角色",
            subtitle: "AI Factory Role",
            closeLabel: "关闭角色编辑窗口",
            cancelLabel: "取消",
            submitLabel: "保存",
            validationMessage: "请完整填写角色名称、类型和经验级别。",
            autoSuccess: false,
            rows: [
                [{ name: "roleCode", label: "角色编码", type: "text", icon: "ri-code-line", readOnly: true }],
                [{ name: "roleName", label: "角色名称", type: "text", icon: "ri-user-line", required: true, maxLength: 120 }],
                [{
                    name: "roleType", label: "角色类型", type: "select", required: true,
                    options: Array.from(aiFactoryState.roleTypeLabels, ([value, label]) => ({
                        value, label, icon: value === "REVIEWER" ? "ri-shield-check-line" : "ri-tools-line"
                    }))
                }],
                [{
                    name: "experienceLevel", label: "经验级别", type: "select", required: true,
                    options: [
                        { value: "EXPERIENCED", label: "有经验", icon: "ri-history-line" },
                        { value: "INEXPERIENCED", label: "无经验", icon: "ri-sparkling-line" }
                    ]
                }],
                [{ name: "specialty", label: "专业范围", type: "text", icon: "ri-focus-3-line", maxLength: 200 }]
            ]
        };
    }

    /** 打开指定角色的标准编辑窗口。 */
    function aiFactoryOpenRoleEditor(record) {
        aiFactoryState.editingRole = { ...record };
        aiFactoryState.roleEditorController.setLocale(aiFactoryBuildRoleEditorOptions());
        aiFactoryState.roleEditorController.reset();
        aiFactoryState.roleEditorController.setValues(record);
        aiFactoryState.roleEditorController.setFeedback("");
        aiFactoryState.roleEditorController.open();
    }

    /** 保存角色可维护字段，并由服务端根据经验级别自动确定连接池策略。 */
    async function aiFactorySaveRole(values) {
        if (!aiFactoryState.editingRole?.id) return;
        aiFactoryState.roleEditorController.setLoading(true);
        aiFactoryState.roleEditorController.setFeedback("正在保存角色…");
        try {
            const result = await selAjax.request({
                url: `${aiFactoryRoleApi}update.htm`,
                method: "POST",
                data: {
                    id: aiFactoryState.editingRole.id,
                    roleName: values.roleName,
                    roleType: values.roleType,
                    experienceLevel: values.experienceLevel,
                    specialty: values.specialty
                }
            });
            await aiFactoryLoadDashboard();
            aiFactoryState.roleEditorController.close();
            aiFactoryState.editingRole = null;
            aiFactorySelectSection(
                "roles", "", aiFactoryState.roleTypeFilter, aiFactoryState.treeSelectionId
            );
            selBase.toast(result.msg || "角色已保存。", "success");
        } catch (error) {
            aiFactoryState.roleEditorController.setFeedback(error.message || "角色保存失败。", true);
        } finally {
            aiFactoryState.roleEditorController.setLoading(false);
        }
    }

    /** 二次确认后请求服务端逻辑删除角色，服务端负责根节点、子节点和使用关系门禁。 */
    async function aiFactoryDeleteRole(record) {
        const confirmed = await aiFactoryState.roleDeleteConfirmController.open({
            title: "删除角色",
            message: "删除后该角色将不再出现在角色管理和启动选择中。",
            target: String(record.roleName || record.roleCode || record.id),
            icon: "ri-delete-bin-line",
            tone: "danger",
            cancelLabel: "取消",
            confirmLabel: "确认删除"
        });
        if (!confirmed) return;
        try {
            const result = await selAjax.request({
                url: `${aiFactoryRoleApi}delete.htm`,
                method: "POST",
                data: { id: record.id }
            });
            await aiFactoryLoadDashboard();
            aiFactorySelectSection(
                "roles", "", aiFactoryState.roleTypeFilter, aiFactoryState.treeSelectionId
            );
            selBase.toast(result.msg || "角色已删除。", "success");
        } catch (error) {
            selBase.toast(error.message || "角色删除失败。", "error");
        }
    }

    /** 保存公共 Grid 给出的完整角色顺序，失败时重新读取数据库恢复画面。 */
    async function aiFactorySaveRoleOrder(records) {
        if (aiFactoryState.reorderSaving) return;
        aiFactoryState.reorderSaving = true;
        try {
            const result = await selAjax.request({
                url: `${aiFactoryRoleApi}reorder.htm`,
                method: "POST",
                jsonData: { items: records.map((record) => ({ id: record.id })) }
            });
            const order = new Map(records.map((record, index) => [String(record.id), (index + 1) * 10]));
            aiFactoryState.dashboard.roles.forEach((record) => {
                if (order.has(String(record.id))) record.sortnum = order.get(String(record.id));
            });
            aiFactoryState.dashboard.roles.sort((left, right) => Number(left.sortnum) - Number(right.sortnum));
            aiFactorySelectSection(
                "roles", "", aiFactoryState.roleTypeFilter, aiFactoryState.treeSelectionId
            );
            selBase.toast(result.msg || "角色顺序已保存。", "success");
        } catch (error) {
            await aiFactoryLoadDashboard();
            aiFactorySelectSection("roles");
            selBase.toast(error.message || "角色顺序保存失败。", "error");
        } finally {
            aiFactoryState.reorderSaving = false;
        }
    }

    /** 切换管理分类或树记录，并同步刷新公共 Panel 与 Grid 的业务契约。 */
    function aiFactorySelectSection(
        section, recordId = "", roleTypeFilter = "", treeSelectionId = ""
    ) {
        if (!aiFactorySectionDefinitions[section]) return false;
        aiFactoryState.section = section;
        aiFactoryState.recordId = String(recordId || "");
        aiFactoryState.roleTypeFilter = String(roleTypeFilter || "");
        aiFactoryState.treeSelectionId = String(treeSelectionId || section);
        const nextPayload = aiFactoryBuildPayload();
        panel.setLocale(aiFactoryState.panelRoot, {
            view: nextPayload,
            expandLeftLabel: "展开管理树",
            collapseLeftLabel: "收起管理树"
        });
        const currentHeader = aiFactoryState.panelRoot.querySelector(".selpanel-header-shell");
        if (currentHeader) {
            currentHeader.id = "aifactory-management-header";
            currentHeader.setAttribute("aria-hidden", String(!aiFactoryState.headerVisible));
        }
        aiFactoryState.treeController?.setLocale(nextPayload.tree);
        aiFactoryState.gridController.setLocale(nextPayload);
        aiFactoryState.panelRoot.querySelectorAll("[data-status-filter]").forEach((button) => {
            const active = button.dataset.statusFilter === aiFactoryState.section;
            button.classList.toggle("selpanel-status-tab-active", active);
            if (active) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });
        return true;
    }

    /** 在主题入口旁创建始终可见的顶部区域显示/隐藏按钮。 */
    function aiFactoryMountHeaderVisibilityToggle() {
        const control = aiFactoryPersonalizationHost.querySelector(".selpersonal-control");
        const themeTrigger = control?.querySelector(".selpersonal-trigger");
        const header = aiFactoryState.panelRoot?.querySelector(".selpanel-header-shell");
        if (!control || !themeTrigger || !header) return false;
        header.id = "aifactory-management-header";
        const button = document.createElement("button");
        button.className = "aifactory-header-toggle";
        button.type = "button";
        button.setAttribute("aria-controls", header.id);
        button.innerHTML = '<i class="ri-eye-off-line" aria-hidden="true"></i><span>隐藏</span>';
        const render = () => {
            const visible = aiFactoryState.headerVisible;
            const currentHeader = aiFactoryState.panelRoot.querySelector(".selpanel-header-shell");
            if (currentHeader) {
                currentHeader.id = "aifactory-management-header";
                currentHeader.setAttribute("aria-hidden", String(!visible));
            }
            aiFactoryState.panelRoot.classList.toggle("aifactory-header-hidden", !visible);
            button.setAttribute("aria-expanded", String(visible));
            button.setAttribute("aria-label", visible ? "隐藏顶部区域" : "显示顶部区域");
            button.dataset.selTooltip = visible ? "隐藏顶部区域" : "显示顶部区域";
            button.querySelector("i").className = visible ? "ri-eye-off-line" : "ri-eye-line";
            button.querySelector("span").textContent = visible ? "隐藏" : "显示";
        };
        button.addEventListener("click", () => {
            aiFactoryState.headerVisible = !aiFactoryState.headerVisible;
            render();
        });
        control.insertBefore(button, themeTrigger);
        render();
        return true;
    }

    /** 按 Japanese 工作台方式依次创建 Panel、Tree 和 Grid。 */
    async function aiFactoryMount() {
        // 管理数据与角色类型引用数据都成功取得后再构造首屏，避免显示硬编码或半映射内容。
        await Promise.all([aiFactoryLoadDashboard(), aiFactoryLoadRoleTypeOptions()]);
        const payload = aiFactoryBuildPayload();
        const panelRoot = panel.create(aiFactoryHost, {
            gridId: aiFactoryGridId,
            sourceId: aiFactoryGridId,
            entity: "AiFactoryManagement",
            view: "management",
            layout: "single",
            structure: aiFactoryLayout,
            ariaLabel: payload.title.ariaLabel
        });
        if (!panelRoot) throw new Error("AI 工厂公共面板创建失败。");
        aiFactoryState.panelRoot = panelRoot;
        if (!panel.mount(panelRoot, { view: payload, expandLeftLabel: "展开管理树", collapseLeftLabel: "收起管理树" })) {
            throw new Error("AI 工厂公共面板挂载失败。");
        }
        if (!aiFactoryMountHeaderVisibilityToggle()) throw new Error("AI 工厂顶部显示隐藏按钮挂载失败。");
        // 五个顶部标签表示不同业务表，不允许公共 Grid 把它们当作同一数据集的状态值筛选。
        panelRoot.addEventListener("click", (event) => {
            const button = event.target.closest("[data-status-filter]");
            if (!button) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            aiFactorySelectSection(button.dataset.statusFilter);
        }, true);
        aiFactoryState.treeController = tree.mount(panelRoot, payload.tree);
        aiFactoryState.gridController = grid.mount(panelRoot, payload);
        if (!aiFactoryState.treeController || !aiFactoryState.gridController) {
            throw new Error("AI 工厂公共树或表格挂载失败。");
        }
        aiFactoryState.roleEditorController = windowComponent.mount(
            aiFactoryHost, aiFactoryBuildRoleEditorOptions());
        if (!aiFactoryState.roleEditorController) throw new Error("AI 工厂角色编辑窗口挂载失败。");
        aiFactoryState.roleDeleteConfirmController = confirmDialog.mount(aiFactoryHost, {
            id: aiFactoryRoleDeleteConfirmId,
            title: "删除角色",
            tone: "danger"
        });
        if (!aiFactoryState.roleDeleteConfirmController) throw new Error("AI 工厂角色删除确认框挂载失败。");
        panelRoot.addEventListener("selTree:select", (event) => {
            const filter = event.detail?.filter || {};
            aiFactorySelectSection(
                filter.section, filter.recordId, filter.roleTypeFilter, filter.treeSelectionId
            );
        });
        panelRoot.addEventListener("selGrid:action", (event) => {
            const detail = event.detail;
            if (detail?.instanceKey === aiFactoryGridId && detail.action === "edit"
                    && aiFactoryState.section === "roles") {
                aiFactoryOpenRoleEditor(detail.record);
            }
            if (detail?.instanceKey === aiFactoryGridId && detail.action === "delete"
                    && aiFactoryState.section === "roles") {
                aiFactoryDeleteRole(detail.record);
            }
        });
        panelRoot.addEventListener("selGrid:rowReorder", (event) => {
            const detail = event.detail;
            if (detail?.instanceKey === aiFactoryGridId && aiFactoryState.section === "roles") {
                aiFactorySaveRoleOrder(detail.records);
            }
        });
        aiFactoryHost.addEventListener("selWindow:submit", (event) => {
            if (event.detail?.id === aiFactoryRoleEditorId) aiFactorySaveRole(event.detail.values);
        });
    }

    // 背景与主题管理统一使用 SEL 公共组件；刷新页面时仍从普通极简浅色默认值启动。
    const aiFactoryBackgroundController = pageBackground.mount(aiFactoryBackgroundHost, {
        defaults: { theme: "solid-light", overlay: 0, brightness: 100, blur: 0 }
    });
    if (!aiFactoryBackgroundController) throw new Error("AI 工厂页面背景挂载失败。");
    if (!personalization.mount(aiFactoryPersonalizationHost, {
        backgroundController: aiFactoryBackgroundController
    })) throw new Error("AI 工厂主题管理挂载失败。");

    aiFactoryMount().catch((error) => {
        console.error("AI 工厂管理页启动失败。", error);
        selBase.toast(error.message || "AI 工厂管理页启动失败。", "error");
    });
}());
