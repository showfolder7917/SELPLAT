/*
 * AI 工厂管理页：使用 SEL UI 公共 Panel、Tree、Grid，并默认以普通极简主题展示管理数据。
 * 页面只消费 Java 聚合接口，不自行维护数据库结构或复制公共控件。
 */
(function app() {
    "use strict";

    window.sel.require([
        "core.query", "core.freeze", "net.ajax", "components.panel", "components.tree", "components.grid",
        "components.pageBackground", "components.personalization"
    ]);
    const selBase = window.sel.core;
    const { freeze: selFreeze, query } = selBase;
    const { ajax: selAjax } = window.sel.net;
    const { panel, tree, grid, pageBackground, personalization } = window.sel.components;
    const aiFactoryHost = query("[data-aifactory-app]");
    const aiFactoryBackgroundHost = query("[data-sel-page-background-host]");
    const aiFactoryPersonalizationHost = query("[data-sel-personalization-host]");
    const aiFactoryGridId = "selGridAiFactoryManagementId";
    const aiFactoryState = {
        dashboard: { roles: [], gates: [], rules: [], projects: [], stages: [] },
        section: "roles",
        recordId: "",
        panelRoot: null,
        treeController: null,
        gridController: null
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
            ENGINEER: "工程师", REVIEWER: "审核员", EXPERIENCED: "有经验", INEXPERIENCED: "无经验",
            PERSISTENT: "常驻", DISPOSABLE: "用完即放弃", ROOT: "根节点", PROJECT: "项目",
            AI: "AI门禁", CODE: "代码门禁", COMMON: "通用规则", WAITING: "等待",
            RUNNING: "执行中", COMPLETED: "执行完成"
        };
        return labels[String(value || "")] || String(value || "—");
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
            roleTypeLabel: aiFactoryLabel(record.roleType),
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
            filter: { section, recordId: String(record.id) },
            children: (childrenByParent.get(String(record.id)) || []).map(build)
        });
        return (childrenByParent.get("ROOT") || []).map(build);
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
            count: source[section].length,
            filter: { section, recordId: "" },
            children: aiFactoryBuildTableTree(section, source[section], labelField)
        }));
    }

    /** 根据当前树节点返回公共 Panel 与 Grid 使用的完整视图。 */
    function aiFactoryBuildPayload() {
        const definition = aiFactorySectionDefinitions[aiFactoryState.section];
        const rows = aiFactoryDisplayRows(aiFactoryState.section, aiFactoryState.dashboard[aiFactoryState.section]);
        return selFreeze({
            grid: { mode: "records", selectionMode: "NONE", idField: "id", searchFields: [], horizontalScroll: true },
            data: { items: rows, selectedIds: [] },
            // 当前管理页不显示筛选下拉，但公共 Panel 仍要求标准 select 容器存在后才能挂载视图。
            select: { projectType: null, status: null, pageSize: null },
            column: {
                gridId: aiFactoryGridId,
                tableTitle: `${definition.label}表格`,
                ariaLabel: `${definition.label}表格`,
                emptyText: `当前没有${definition.rowLabel}数据`,
                items: definition.columns.map(([field, label, width]) => ({ id: field, field, label, width, renderer: "text" }))
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
                selectedId: aiFactoryState.recordId ? `${aiFactoryState.section}-${aiFactoryState.recordId}` : aiFactoryState.section,
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

    /** 切换管理分类或树记录，并同步刷新公共 Panel 与 Grid 的业务契约。 */
    function aiFactorySelectSection(section, recordId = "") {
        if (!aiFactorySectionDefinitions[section]) return false;
        aiFactoryState.section = section;
        aiFactoryState.recordId = String(recordId || "");
        const nextPayload = aiFactoryBuildPayload();
        panel.setLocale(aiFactoryState.panelRoot, {
            view: nextPayload,
            expandLeftLabel: "展开管理树",
            collapseLeftLabel: "收起管理树"
        });
        aiFactoryState.gridController.setLocale(nextPayload);
        aiFactoryState.panelRoot.querySelectorAll("[data-status-filter]").forEach((button) => {
            const active = button.dataset.statusFilter === aiFactoryState.section;
            button.classList.toggle("selpanel-status-tab-active", active);
            if (active) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });
        return true;
    }

    /** 按 Japanese 工作台方式依次创建 Panel、Tree 和 Grid。 */
    async function aiFactoryMount() {
        await aiFactoryLoadDashboard();
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
        panelRoot.addEventListener("selTree:select", (event) => {
            const filter = event.detail?.filter || {};
            aiFactorySelectSection(filter.section, filter.recordId);
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
