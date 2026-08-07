/*
 * mda.js：MDA 数据库工作台应用装配层。
 * 负责调用真实接口、转换元数据树和查询结果，并把标准 payload 交给 SEL 公共组件。
 */
(function mdaInitializeApplication() {
    "use strict";

    const mdaRequiredComponents = Object.freeze([
        "selBaseRuntime", "selAjax", "selPanel", "selSearch", "selTree", "selDropdownMenu",
        "selGrid", "selWindow", "selPageBackground", "selPersonalization", "selThemeManager"
    ]);
    const mdaMissingComponents = mdaRequiredComponents.filter((mdaName) => !window[mdaName]);
    if (mdaMissingComponents.length > 0) throw new Error(`MDA 缺少公共组件：${mdaMissingComponents.join("、")}。`);

    const mdaBase = window.selBaseRuntime;
    const mdaAjax = window.selAjax;
    const mdaApplicationHost = mdaBase.query("[data-mda-app]");
    const mdaBackgroundHost = mdaBase.query("[data-sel-page-background-host]");
    const mdaPersonalizationHost = mdaBase.query("[data-sel-personalization-host]");
    const mdaGridId = "MdaDatabaseGrid";
    const mdaApi = Object.freeze({
        connections: "/api/mda/connections/",
        metadata: "/api/mda/metadata/tree.htm",
        execute: "/api/mda/sql/execute.htm"
    });
    const mdaState = {
        connections: [], selectedConnection: null, metadata: [], currentTable: null,
        columns: [], rows: [], gridController: null, treeController: null, sqlWindowController: null,
        connectionWindowController: null, deleteWindowController: null, editingConnectionId: null
    };

    const mdaLayout = Object.freeze({
        top: Object.freeze([
            Object.freeze({ component: "title", payload: "title" }),
            Object.freeze({
                component: "toolbar",
                children: Object.freeze([
                    Object.freeze({ component: "selSearch", payload: "search" }),
                    Object.freeze({ component: "selDropdownMenu", slot: "projectType", payload: "select.projectType" }),
                    Object.freeze({ component: "filterReset", payload: "title" })
                ])
            })
        ]),
        left: Object.freeze([Object.freeze({ component: "selTree", payload: "tree" })]),
        center: Object.freeze([Object.freeze({ component: "selGrid", payload: "$aggregate" })]),
        right: Object.freeze([]),
        bottom: Object.freeze([
            Object.freeze({
                component: "footer",
                children: Object.freeze([
                    Object.freeze({
                        component: "gridSummary", payload: "pagination",
                        children: Object.freeze([Object.freeze({ component: "selDropdownMenu", slot: "pageSize", payload: "select.pageSize" })])
                    }),
                    Object.freeze({ component: "pagination", payload: "pagination" }),
                    Object.freeze({ component: "feedback", payload: "title.messages" })
                ])
            })
        ])
    });

    /** 把 JDBC 元数据节点转换为 selTree 标准节点，并保留表查询所需的稳定值。 */
    function mdaMapMetadataNodes(nodes, path) {
        return (nodes || []).map((node, index) => {
            const nodePath = `${path}-${index}-${node.type}-${node.label}`;
            const children = mdaMapMetadataNodes(node.children, nodePath);
            const icons = { catalog: "ri-database-2-line", schema: "ri-folder-3-line", table: "ri-table-2", column: "ri-key-2-line" };
            return Object.freeze({
                id: nodePath,
                label: node.type === "column" && node.typeName ? `${node.label} · ${node.typeName}` : node.label,
                icon: icons[node.type] || "ri-circle-line",
                count: children.length,
                filter: Object.freeze({
                    nodeType: node.type,
                    catalog: node.catalog || "",
                    schema: node.schema || "",
                    tableName: node.tableName || ""
                }),
                children: Object.freeze(children)
            });
        });
    }

    /** 构建当前连接、元数据树和查询结果共用的聚合 payload。 */
    function mdaBuildPayload() {
        const connectionId = String(mdaState.selectedConnection?.id || "");
        const dataItems = mdaState.rows.map((row, index) => Object.freeze({ _row: index + 1, _connectionId: connectionId, ...row }));
        const columnItems = mdaState.columns.length > 0
            ? mdaState.columns.map((column) => Object.freeze({ id: column.name, field: column.name, label: column.label, renderer: "text" }))
            : [Object.freeze({ id: "empty", field: "message", label: "查询提示", renderer: "text" })];
        return Object.freeze({
            grid: Object.freeze({ mode: "records", idField: "_row", typeField: "_connectionId", statusField: "_status", searchFields: Object.freeze(mdaState.columns.map((column) => column.name)) }),
            data: Object.freeze({ items: Object.freeze(dataItems), selectedIds: Object.freeze([]) }),
            column: Object.freeze({ gridId: mdaGridId, ariaLabel: "数据库查询结果", emptyText: "选择左侧数据表即可查询前 1000 行", items: Object.freeze(columnItems) }),
            title: Object.freeze({
                title: "MDA 数据库工作台", subtitle: "Multi-Database Access",
                description: mdaState.currentTable ? `正在浏览 ${mdaState.currentTable}` : "浏览数据库表结构并在前台执行真实查询",
                ariaLabel: "MDA 数据库工作台", ariaLabels: Object.freeze({ statusTabs: "查询状态", headerActions: "查询操作", toolbar: "数据库工具栏", sidebar: "数据库结构", content: "查询结果", board: "查询结果表格", pagination: "结果分页" }),
                statusTabs: Object.freeze([
                    Object.freeze({ value: "", label: "连接", count: mdaState.connections.length }),
                    Object.freeze({ value: "ready", label: "数据表", count: mdaCountTables(mdaState.metadata) }),
                    Object.freeze({ value: "rows", label: "结果行", count: dataItems.length })
                ]),
                actions: Object.freeze([
                    Object.freeze({ id: "connection-add", label: "新增连接", icon: "ri-database-2-line", primary: true }),
                    ...(mdaState.selectedConnection ? [
                        Object.freeze({ id: "connection-edit", label: "编辑连接", icon: "ri-edit-line" }),
                        Object.freeze({ id: "connection-delete", label: "删除连接", icon: "ri-delete-bin-6-line" }),
                        Object.freeze({ id: "new", label: "SQL 查询", icon: "ri-terminal-box-line" })
                    ] : [])
                ]),
                resetLabel: "重置", messages: Object.freeze({
                    selectProject: "选择记录", viewProject: "查看记录", editProject: "编辑记录", moreActions: "更多操作",
                    filtersReset: "查询筛选已重置", treePrefix: "数据库对象", expandLeftRegion: "展开数据库结构",
                    collapseLeftRegion: "收起数据库结构", filterActivated: "查询搜索已激活", newOpened: "已打开 SQL 查询窗口",
                    exportPreparing: "操作已触发", dateRange: "日期范围：{start} 至 {end}", movePrefix: "移动到"
                })
            }),
            search: Object.freeze({ gridId: mdaGridId, label: "结果搜索", placeholder: "搜索当前查询结果…", buttonLabel: "查询", clearLabel: "清空搜索", icon: "ri-search-line", buttonIcon: "ri-search-line", clearIcon: "ri-close-line", defaultValue: "", clearable: true, submitOnEnter: true, submitOnClear: true, allowEmpty: true, trim: true }),
            tree: Object.freeze({ gridId: mdaGridId, ariaLabel: "数据库结构", heading: "数据库结构", summary: `${mdaCountTables(mdaState.metadata)} 个表／视图`, expandLabelTemplate: "展开{label}", collapseLabelTemplate: "收起{label}", selectedId: "", items: Object.freeze(mdaMapMetadataNodes(mdaState.metadata, "mda")) }),
            menu: Object.freeze({ gridId: mdaGridId, ariaLabel: "查询结果操作" }),
            pagination: Object.freeze({ gridId: mdaGridId, currentPage: 1, pageSize: 20, totalCount: dataItems.length, summaryAll: "共 {total} 行", summaryFiltered: "当前 {visible} 行 · 共 {total} 行", previousLabel: "上一页", nextLabel: "下一页", pageChangedMessage: "已切换到第 {page} 页", pageSizeChangedMessage: "每页显示 {size} 行" }),
            select: Object.freeze({
                projectType: Object.freeze({ gridId: mdaGridId, role: "type-filter", label: "数据库连接", ariaLabel: "选择数据库连接", currentTemplate: "{label}，当前：{value}", menuTitle: "选择数据库连接", prefix: "连接：", scrollAfter: 6, options: Object.freeze(mdaState.connections.length > 0
                    ? mdaState.connections.map((connection) => Object.freeze({ value: String(connection.id), label: connection.connectionName, icon: "ri-database-2-line", description: connection.databaseType, selected: String(connection.id) === connectionId }))
                    : [Object.freeze({ value: "", label: "请先新增连接", icon: "ri-database-2-line", selected: true, disabled: true })]) }),
                status: Object.freeze({ gridId: mdaGridId, role: "status-filter", label: "状态", options: Object.freeze([Object.freeze({ value: "", label: "全部" })]) }),
                pageSize: Object.freeze({ gridId: mdaGridId, role: "page-size", label: "每页显示行数", ariaLabel: "每页显示行数", currentTemplate: "{label}，当前：{value}", menuTitle: "选择每页显示行数", scrollAfter: 4, options: Object.freeze([10, 20, 50, 100].map((size) => Object.freeze({ value: String(size), label: `${size} 行/页`, icon: "ri-list-check-3", selected: size === 20 }))) })
            })
        });
    }

    function mdaCountTables(nodes) {
        return (nodes || []).reduce((count, node) => count + (node.type === "table" ? 1 : 0) + mdaCountTables(node.children), 0);
    }

    function mdaSyncPanel(payload) {
        const panelRoot = window.selPanel.get(mdaGridId);
        window.selPanel.setLocale(panelRoot, { view: payload });
        panelRoot.querySelectorAll("[data-sel-dropdown-menu]").forEach((dropdownRoot) => window.selDropdownMenu.setLocale(dropdownRoot));
        window.selDropdownMenu.setValue(panelRoot.querySelector('[data-sel-grid-role="type-filter"]'), String(mdaState.selectedConnection?.id || ""));
    }

    function mdaQuoteIdentifier(identifier, type) {
        if (type === "MYSQL") return `\`${String(identifier).replaceAll("`", "``")}\``;
        if (type === "SQLSERVER") return "[" + String(identifier).replaceAll("]", "]]") + "]";
        return `"${String(identifier).replaceAll('"', '""')}"`;
    }

    function mdaTableSql(filter) {
        const type = String(mdaState.selectedConnection?.databaseType || "").toUpperCase();
        const parts = [filter.schema, filter.tableName].filter(Boolean).map((part) => mdaQuoteIdentifier(part, type));
        return `SELECT * FROM ${parts.join(".")}`;
    }

    async function mdaExecuteSql(sql) {
        const response = await mdaAjax.request({ url: mdaApi.execute, method: "POST", data: { connectionId: mdaState.selectedConnection.id, sql, autoCommit: true, maxRows: 1000, queryTimeoutSeconds: 30 } });
        const resultSet = (response.data?.results || []).find((result) => result.kind === "resultSet");
        mdaState.columns = (resultSet?.columns || []).map((column, index) => ({ name: `column${index}`, label: column.label }));
        mdaState.rows = (resultSet?.rows || []).map((row) => Object.fromEntries(row.map((value, index) => [`column${index}`, value])));
        const payload = mdaBuildPayload();
        mdaState.gridController.setLocale(payload);
        mdaSyncPanel(payload);
        return response;
    }

    async function mdaLoadMetadata(connection) {
        mdaState.selectedConnection = connection;
        const response = await mdaAjax.request({ url: mdaApi.metadata, method: "POST", data: { connectionId: connection.id } });
        mdaState.metadata = response.data?.nodes || [];
        mdaState.currentTable = null;
        mdaState.columns = [];
        mdaState.rows = [];
        const payload = mdaBuildPayload();
        mdaState.treeController.setLocale(payload.tree);
        mdaState.gridController.setLocale(payload);
        mdaSyncPanel(payload);
    }

    function mdaBuildSqlWindow() {
        return Object.freeze({
            title: "SQL 查询", subtitle: "SQL 将在当前选中的数据库连接中执行", closeLabel: "关闭 SQL 查询窗口",
            cancelLabel: "取消", submitLabel: "执行 SQL", validationMessage: "请输入 SQL", autoSuccess: false,
            rows: Object.freeze([Object.freeze([Object.freeze({ name: "sql", label: "SQL", type: "textarea", icon: "ri-terminal-box-line", required: true, placeholder: "SELECT * FROM table_name", value: "SELECT 1 AS ready" })])])
        });
    }

    function mdaBuildConnectionWindow() {
        return Object.freeze({
            title: mdaState.editingConnectionId ? "编辑数据库连接" : "新增数据库连接",
            subtitle: "连接配置将明文保存到 MDA 本地控制库",
            closeLabel: "关闭数据库连接窗口", cancelLabel: "取消",
            submitLabel: mdaState.editingConnectionId ? "保存连接" : "新增连接",
            validationMessage: "请填写连接名称、数据库类型和数据库名", autoSuccess: false,
            rows: Object.freeze([
                Object.freeze([
                    Object.freeze({ name: "connectionName", label: "连接名称", type: "text", icon: "ri-database-2-line", required: true, placeholder: "例如：本地开发库" }),
                    Object.freeze({ name: "databaseType", label: "数据库类型", type: "select", required: true, options: Object.freeze([
                        Object.freeze({ value: "H2", label: "H2", icon: "ri-database-line", selected: true }),
                        Object.freeze({ value: "MYSQL", label: "MySQL", icon: "ri-database-line" }),
                        Object.freeze({ value: "POSTGRESQL", label: "PostgreSQL", icon: "ri-database-line" }),
                        Object.freeze({ value: "SQLSERVER", label: "SQL Server", icon: "ri-database-line" }),
                        Object.freeze({ value: "ORACLE", label: "Oracle", icon: "ri-database-line" })
                    ]) })
                ]),
                Object.freeze([
                    Object.freeze({ name: "host", label: "主机", type: "text", icon: "ri-server-line", placeholder: "127.0.0.1" }),
                    Object.freeze({ name: "port", label: "端口", type: "number", icon: "ri-router-line", placeholder: "留空使用默认端口" })
                ]),
                Object.freeze([Object.freeze({ name: "databaseName", label: "数据库名或 H2 路径", type: "text", icon: "ri-folder-3-line", required: true, placeholder: "例如：demo 或 file:/path/to/database" })]),
                Object.freeze([
                    Object.freeze({ name: "schemaName", label: "默认 Schema", type: "text", icon: "ri-folder-tree-line", placeholder: "例如：PUBLIC" }),
                    Object.freeze({ name: "username", label: "用户名", type: "text", icon: "ri-user-line", placeholder: "数据库账号" })
                ]),
                Object.freeze([Object.freeze({ name: "password", label: "密码（明文保存）", type: "password", icon: "ri-lock-password-line", placeholder: "数据库密码" })]),
                Object.freeze([Object.freeze({ name: "customJdbcUrl", label: "完整 JDBC URL", type: "text", icon: "ri-link", placeholder: "填写后优先使用，例如 jdbc:h2:file:/path/to/db" })]),
                Object.freeze([Object.freeze({ name: "jdbcParameters", label: "JDBC 附加参数", type: "text", icon: "ri-settings-3-line", placeholder: "例如 useSSL=false" })]),
                Object.freeze([
                    Object.freeze({ name: "defaultAutoCommit", label: "自动提交", type: "select", required: true, options: Object.freeze([
                        Object.freeze({ value: "true", label: "开启", icon: "ri-checkbox-circle-line", selected: true }),
                        Object.freeze({ value: "false", label: "关闭", icon: "ri-checkbox-blank-circle-line" })
                    ]) }),
                    Object.freeze({ name: "sortnum", label: "排序", type: "number", icon: "ri-sort-asc", placeholder: "0" })
                ])
            ])
        });
    }

    function mdaBuildDeleteWindow() {
        return Object.freeze({
            title: "删除数据库连接", subtitle: "只删除控制库中的连接配置，不删除目标数据库",
            closeLabel: "关闭删除确认窗口", cancelLabel: "取消", submitLabel: "确认删除",
            validationMessage: "请选择确认删除", autoSuccess: false,
            rows: Object.freeze([Object.freeze([Object.freeze({
                name: "confirmation", label: "删除确认", type: "select", required: true,
                options: Object.freeze([
                    Object.freeze({ value: "", label: "请选择", icon: "ri-question-line", selected: true }),
                    Object.freeze({ value: "DELETE", label: "确认删除当前连接", icon: "ri-delete-bin-6-line", tone: "danger" })
                ])
            })])])
        });
    }

    function mdaEmptyConnectionValues() {
        return { connectionName: "", databaseType: "H2", host: "", port: "", databaseName: "", schemaName: "PUBLIC", username: "sa", password: "", customJdbcUrl: "", jdbcParameters: "", defaultAutoCommit: "true", sortnum: "0" };
    }

    async function mdaReloadConnections(preferredId) {
        const connectionPage = await mdaAjax.json({ url: `${mdaApi.connections}getStore.htm` });
        mdaState.connections = connectionPage.records || [];
        mdaState.selectedConnection = mdaState.connections.find((item) => String(item.id) === String(preferredId || "")) || mdaState.connections[0] || null;
        if (mdaState.selectedConnection) {
            await mdaLoadMetadata(mdaState.selectedConnection);
            return;
        }
        mdaState.metadata = [];
        mdaState.currentTable = null;
        mdaState.columns = [];
        mdaState.rows = [];
        const payload = mdaBuildPayload();
        mdaState.treeController.setLocale(payload.tree);
        mdaState.gridController.setLocale(payload);
        mdaSyncPanel(payload);
    }

    async function mdaMountApplication() {
        const [connectionPage, windowMessages] = await Promise.all([
            mdaAjax.json({ url: `${mdaApi.connections}getStore.htm` }),
            mdaAjax.json({ url: "/sel/components/window/i18n/zh-CN.json?v=20260807-mda-1" })
        ]);
        mdaState.connections = connectionPage.records || [];
        mdaState.selectedConnection = mdaState.connections[0] || null;
        const payload = mdaBuildPayload();
        const panelRoot = window.selPanel.create(mdaApplicationHost, { gridId: mdaGridId, sourceId: mdaGridId, entity: "MdaQueryResult", view: "database", layout: "single", structure: mdaLayout, ariaLabel: payload.title.ariaLabel });
        if (!panelRoot || !window.selPanel.mount(panelRoot, { view: payload, expandLeftLabel: payload.title.messages.expandLeftRegion, collapseLeftLabel: payload.title.messages.collapseLeftRegion })) throw new Error("MDA 公共面板挂载失败。");
        if (!window.selSearch.mount(panelRoot, payload.search)) throw new Error("MDA 搜索控件挂载失败。");
        mdaState.treeController = window.selTree.mount(panelRoot, payload.tree);
        window.selDropdownMenu.mountAll(panelRoot);
        mdaState.gridController = window.selGrid.mount(panelRoot, payload);
        mdaState.sqlWindowController = window.selWindow.mount(mdaApplicationHost, { id: "MdaSqlWindow", messages: windowMessages, ...mdaBuildSqlWindow() });
        mdaState.connectionWindowController = window.selWindow.mount(mdaApplicationHost, { id: "MdaConnectionWindow", messages: windowMessages, ...mdaBuildConnectionWindow() });
        mdaState.deleteWindowController = window.selWindow.mount(mdaApplicationHost, { id: "MdaConnectionDeleteWindow", messages: windowMessages, ...mdaBuildDeleteWindow() });
        if (!mdaState.treeController || !mdaState.gridController || !mdaState.sqlWindowController || !mdaState.connectionWindowController || !mdaState.deleteWindowController) throw new Error("MDA 公共业务组件挂载失败。");

        panelRoot.addEventListener("selGrid:new", () => {
            mdaState.sqlWindowController.setLocale(mdaBuildSqlWindow());
            mdaState.sqlWindowController.reset();
            if (mdaState.currentTable) mdaState.sqlWindowController.setValues({ sql: `SELECT * FROM ${mdaState.currentTable}` });
            mdaState.sqlWindowController.open();
        });
        panelRoot.addEventListener("click", async (event) => {
            const command = event.target.closest("[data-panel-command]")?.dataset.panelCommand;
            if (command === "connection-add") {
                mdaState.editingConnectionId = null;
                mdaState.connectionWindowController.setLocale(mdaBuildConnectionWindow());
                mdaState.connectionWindowController.reset();
                mdaState.connectionWindowController.setValues(mdaEmptyConnectionValues());
                mdaState.connectionWindowController.open();
            }
            if (command === "connection-edit" && mdaState.selectedConnection) {
                const detail = await mdaAjax.json({ url: `${mdaApi.connections}getById.htm?id=${mdaState.selectedConnection.id}` });
                mdaState.editingConnectionId = mdaState.selectedConnection.id;
                mdaState.connectionWindowController.setLocale(mdaBuildConnectionWindow());
                mdaState.connectionWindowController.reset();
                mdaState.connectionWindowController.setValues({ ...detail.data, defaultAutoCommit: String(detail.data.defaultAutoCommit), port: detail.data.port ?? "", sortnum: detail.data.sortnum ?? 0 });
                mdaState.connectionWindowController.open();
            }
            if (command === "connection-delete" && mdaState.selectedConnection) {
                mdaState.deleteWindowController.reset();
                mdaState.deleteWindowController.open();
            }
        });
        panelRoot.addEventListener("selTree:select", async (event) => {
            if (event.detail?.filter?.nodeType !== "table") return;
            const sql = mdaTableSql(event.detail.filter);
            mdaState.currentTable = sql.substring("SELECT * FROM ".length);
            try { await mdaExecuteSql(sql); } catch (error) { console.error("MDA 数据表查询失败。", error); }
        });
        mdaApplicationHost.addEventListener("selWindow:submit", async (event) => {
            if (event.detail?.id === "MdaSqlWindow") {
                mdaState.sqlWindowController.setLoading(true);
                try {
                    const response = await mdaExecuteSql(event.detail.values.sql);
                    mdaState.sqlWindowController.setFeedback(response.msg || "SQL 执行完成。");
                    mdaState.sqlWindowController.close();
                } catch (error) {
                    mdaState.sqlWindowController.setFeedback(error.message || "SQL 执行失败。", true);
                } finally { mdaState.sqlWindowController.setLoading(false); }
                return;
            }
            if (event.detail?.id === "MdaConnectionWindow") {
                mdaState.connectionWindowController.setLoading(true);
                try {
                    const url = mdaState.editingConnectionId ? `${mdaApi.connections}update.htm` : `${mdaApi.connections}create.htm`;
                    const values = mdaState.editingConnectionId
                        ? { ...event.detail.values, id: mdaState.editingConnectionId }
                        : event.detail.values;
                    const response = await mdaAjax.request({ url, method: "POST", data: values });
                    const savedId = response.data?.id || mdaState.editingConnectionId;
                    mdaState.connectionWindowController.setFeedback(response.msg || "连接配置保存完成。");
                    mdaState.connectionWindowController.close();
                    await mdaReloadConnections(savedId);
                } catch (error) {
                    mdaState.connectionWindowController.setFeedback(error.message || "连接配置保存失败。", true);
                } finally { mdaState.connectionWindowController.setLoading(false); }
                return;
            }
            if (event.detail?.id === "MdaConnectionDeleteWindow" && event.detail.values.confirmation === "DELETE" && mdaState.selectedConnection) {
                mdaState.deleteWindowController.setLoading(true);
                try {
                    const response = await mdaAjax.request({ url: `${mdaApi.connections}delete.htm`, method: "POST", data: { id: mdaState.selectedConnection.id } });
                    mdaState.deleteWindowController.setFeedback(response.msg || "连接配置删除完成。");
                    mdaState.deleteWindowController.close();
                    await mdaReloadConnections();
                } catch (error) {
                    mdaState.deleteWindowController.setFeedback(error.message || "连接配置删除失败。", true);
                } finally { mdaState.deleteWindowController.setLoading(false); }
            }
        });
        const connectionSelect = panelRoot.querySelector('[data-sel-grid-role="type-filter"]');
        connectionSelect?.addEventListener("change", async () => {
            const connection = mdaState.connections.find((item) => String(item.id) === connectionSelect.value);
            if (connection) await mdaLoadMetadata(connection);
        });
        if (mdaState.selectedConnection) await mdaLoadMetadata(mdaState.selectedConnection);
    }

    const backgroundController = window.selPageBackground.mount(mdaBackgroundHost, { defaults: Object.freeze({ theme: "solid-dark", overlay: 0, brightness: 100, blur: 0 }) });
    if (!backgroundController) throw new Error("MDA 页面背景挂载失败。");
    if (!window.selPersonalization.mount(mdaPersonalizationHost, { backgroundController })) throw new Error("MDA 个性化设置挂载失败。");
    mdaMountApplication().catch((error) => { console.error("MDA 初始化失败。", error); throw error; });
}());
