/*
 * mda.js：MDA 数据库工作台应用装配层。
 * 负责调用真实连接、元数据和 SQL 接口，并组合公共树、页签、分隔面板、代码编辑器、表格与窗口。
 */
(function mdaInitializeApplication() {
    "use strict";

    const mdaRequiredComponents = Object.freeze([
        "selBaseRuntime", "selAjax", "selPanel", "selTree", "selDropdownMenu", "selGrid", "selTabs",
        "selSplitPane", "selCodeEditor", "selWindow", "selConfirmDialog", "selPageBackground", "selPersonalization", "selThemeManager"
    ]);
    const mdaMissingComponents = mdaRequiredComponents.filter((mdaName) => !window[mdaName]);
    if (mdaMissingComponents.length > 0) throw new Error(`MDA 缺少公共组件：${mdaMissingComponents.join("、")}。`);

    const mdaBase = window.selBaseRuntime;
    const mdaAjax = window.selAjax;
    const mdaApplicationHost = mdaBase.query("[data-mda-app]");
    const mdaBackgroundHost = mdaBase.query("[data-sel-page-background-host]");
    const mdaPersonalizationHost = mdaBase.query("[data-sel-personalization-host]");
    const mdaWorkspaceId = "MdaDatabaseWorkspace";
    const mdaTabsId = "MdaDatabaseQueryTabs";
    const mdaApi = Object.freeze({
        connections: "/api/mda/connections/",
        metadata: "/api/mda/metadata/tree.htm",
        execute: "/api/mda/sql/execute.htm"
    });
    const mdaState = {
        connections: [], selectedConnection: null, metadata: [], panelRoot: null,
        treeController: null, tabsController: null, querySessions: new Map(), querySequence: 1,
        connectionWindowController: null, confirmDialogController: null, editingConnectionId: null
    };

    // MDA 只声明公共组件所在区域；页签内部结构继续由各公共控件自身创建。
    const mdaLayout = Object.freeze({
        top: Object.freeze([
            Object.freeze({ component: "title", payload: "title" }),
            Object.freeze({
                component: "toolbar",
                children: Object.freeze([
                    Object.freeze({ component: "selDropdownMenu", slot: "projectType", payload: "select.projectType" })
                ])
            })
        ]),
        left: Object.freeze([Object.freeze({ component: "selTree", payload: "tree" })]),
        center: Object.freeze([Object.freeze({ component: "selTabs", payload: "workspace.tabs" })]),
        right: Object.freeze([]),
        bottom: Object.freeze([])
    });

    /** 把 JDBC 元数据节点转换为 selTree 标准节点，并保留打开表查询页签所需的稳定字段。 */
    function mdaMapMetadataNodes(mdaNodes, mdaPath) {
        return (mdaNodes || []).map((mdaNode, mdaIndex) => {
            const mdaNodePath = `${mdaPath}-${mdaIndex}-${mdaNode.type}-${mdaNode.label}`;
            const mdaChildren = mdaMapMetadataNodes(mdaNode.children, mdaNodePath);
            const mdaIcons = { catalog: "ri-database-2-line", schema: "ri-folder-3-line", table: "ri-table-2", column: "ri-key-2-line" };
            const mdaIsView = String(mdaNode.tableType || "").toUpperCase().includes("VIEW");
            // 目录节点代表当前连接中的数据库，表或视图节点承接真实目标库结构动作。
            const mdaContextActions = mdaNode.type === "catalog"
                ? Object.freeze([
                    Object.freeze({ id: "connection-edit", label: "编辑连接", icon: "ri-edit-line" }),
                    Object.freeze({ id: "connection-delete", label: "删除连接", icon: "ri-delete-bin-6-line", danger: true }),
                    Object.freeze({ id: "copy-label", label: "复制名称", icon: "ri-file-copy-line" })
                ])
                : mdaNode.type === "table"
                    ? Object.freeze([
                        Object.freeze({ id: "table-edit", label: mdaIsView ? "编辑视图定义" : "编辑表结构", icon: "ri-edit-line" }),
                        Object.freeze({ id: "table-delete", label: mdaIsView ? "删除视图" : "删除表", icon: "ri-delete-bin-6-line", danger: true }),
                        Object.freeze({ id: "copy-label", label: mdaIsView ? "复制视图名" : "复制表名", icon: "ri-file-copy-line" })
                    ])
                    : Object.freeze([]);
            return Object.freeze({
                id: mdaNodePath,
                label: mdaNode.type === "column" && mdaNode.typeName ? `${mdaNode.label} · ${mdaNode.typeName}` : mdaNode.label,
                icon: mdaIcons[mdaNode.type] || "ri-circle-line",
                count: mdaChildren.length,
                filter: Object.freeze({
                    nodeType: mdaNode.type,
                    catalog: mdaNode.catalog || "",
                    schema: mdaNode.schema || "",
                    tableName: mdaNode.tableName || "",
                    tableType: mdaNode.tableType || ""
                }),
                contextActions: mdaContextActions,
                children: Object.freeze(mdaChildren)
            });
        });
    }

    // 统计真实表节点数量供标题和左树摘要同步显示。
    function mdaCountTables(mdaNodes) {
        return (mdaNodes || []).reduce((mdaCount, mdaNode) => mdaCount + (mdaNode.type === "table" ? 1 : 0) + mdaCountTables(mdaNode.children), 0);
    }

    // 活动页签决定标题说明和结果行统计；没有页签时返回空结果状态。
    function mdaGetActiveSession() {
        const mdaActiveId = mdaState.tabsController?.getState().activeId;
        return mdaActiveId ? mdaState.querySessions.get(mdaActiveId) || null : null;
    }

    /** 构建外层工作台和页签表格共同消费的标准聚合 payload。 */
    function mdaBuildPayload(mdaSession = mdaGetActiveSession()) {
        const mdaConnectionId = String(mdaSession?.connectionId || mdaState.selectedConnection?.id || "");
        const mdaColumns = mdaSession?.columns || [];
        const mdaRows = mdaSession?.rows || [];
        const mdaDataItems = mdaRows.map((mdaRow, mdaIndex) => Object.freeze({ _row: mdaIndex + 1, _connectionId: mdaConnectionId, ...mdaRow }));
        const mdaColumnItems = mdaColumns.length > 0
            ? mdaColumns.map((mdaColumn) => Object.freeze({ id: mdaColumn.name, field: mdaColumn.name, label: mdaColumn.label, renderer: "text" }))
            : [Object.freeze({ id: "empty", field: "message", label: "查询提示", renderer: "text" })];
        return Object.freeze({
            // 目标库字段动态变化，公共宽表模式按列数在结果区内部提供水平滚动。
            grid: Object.freeze({ mode: "records", horizontalScroll: true, defaultColumnWidth: 150, idField: "_row", typeField: "_connectionId", statusField: "_status", searchFields: Object.freeze(mdaColumns.map((mdaColumn) => mdaColumn.name)) }),
            data: Object.freeze({ items: Object.freeze(mdaDataItems), selectedIds: Object.freeze([]) }),
            column: Object.freeze({ gridId: mdaSession?.gridId || "MdaEmptyQueryGrid", ariaLabel: "数据库查询结果", emptyText: "在上方输入 SQL 后执行查询", items: Object.freeze(mdaColumnItems) }),
            title: Object.freeze({
                title: "MDA 数据库工作台", subtitle: "Multi-Database Access",
                description: mdaSession ? `正在使用 ${mdaSession.label} 查询页签` : "从左侧选择数据表，在右侧上方编写 SQL 并查看下方结果",
                ariaLabel: "MDA 数据库工作台",
                ariaLabels: Object.freeze({ statusTabs: "工作台状态", headerActions: "数据库操作", toolbar: "数据库连接工具栏", sidebar: "数据库结构", content: "SQL 查询工作区", board: "查询结果表格", pagination: "结果分页" }),
                statusTabs: Object.freeze([
                    Object.freeze({ value: "", label: "连接", count: mdaState.connections.length }),
                    Object.freeze({ value: "tables", label: "数据表", count: mdaCountTables(mdaState.metadata) }),
                    Object.freeze({ value: "tabs", label: "查询页签", count: mdaState.querySessions.size }),
                    Object.freeze({ value: "rows", label: "结果行", count: mdaDataItems.length })
                ]),
                actions: Object.freeze([
                    Object.freeze({ id: "connection-add", label: "新增连接", icon: "ri-database-2-line", primary: true }),
                    ...(mdaState.selectedConnection ? [
                        Object.freeze({ id: "connection-edit", label: "编辑连接", icon: "ri-edit-line" }),
                        Object.freeze({ id: "connection-delete", label: "删除连接", icon: "ri-delete-bin-6-line" }),
                        Object.freeze({ id: "query-new", label: "新建查询", icon: "ri-terminal-box-line" })
                    ] : [])
                ]),
                resetLabel: "重置",
                messages: Object.freeze({
                    selectProject: "选择记录", viewProject: "查看记录", editProject: "编辑记录", moreActions: "更多操作",
                    filtersReset: "查询筛选已重置", treePrefix: "数据库对象", expandLeftRegion: "展开数据库结构",
                    collapseLeftRegion: "收起数据库结构", filterActivated: "查询搜索已激活", newOpened: "已打开 SQL 查询页签",
                    exportPreparing: "操作已触发", dateRange: "日期范围：{start} 至 {end}", movePrefix: "移动到"
                })
            }),
            search: Object.freeze({ gridId: mdaSession?.gridId || "MdaEmptyQueryGrid", label: "结果搜索", placeholder: "搜索当前结果…", buttonLabel: "查询", clearLabel: "清空搜索", icon: "ri-search-line", buttonIcon: "ri-search-line", clearIcon: "ri-close-line", defaultValue: "", clearable: true, submitOnEnter: true, submitOnClear: true, allowEmpty: true, trim: true }),
            tree: Object.freeze({ gridId: mdaWorkspaceId, ariaLabel: "数据库结构", heading: "数据库结构", summary: `${mdaCountTables(mdaState.metadata)} 个表／视图`, expandLabelTemplate: "展开{label}", collapseLabelTemplate: "收起{label}", contextMenuLabelTemplate: "{label}操作", selectedId: "", items: Object.freeze(mdaMapMetadataNodes(mdaState.metadata, "mda")) }),
            menu: Object.freeze({ gridId: mdaSession?.gridId || "MdaEmptyQueryGrid", ariaLabel: "查询结果操作" }),
            pagination: Object.freeze({ gridId: mdaSession?.gridId || "MdaEmptyQueryGrid", currentPage: 1, pageSize: 20, totalCount: mdaDataItems.length, summaryAll: "共 {total} 行", summaryFiltered: "当前 {visible} 行 · 共 {total} 行", previousLabel: "上一页", nextLabel: "下一页", pageChangedMessage: "已切换到第 {page} 页", pageSizeChangedMessage: "每页显示 {size} 行" }),
            select: Object.freeze({
                projectType: Object.freeze({ gridId: mdaWorkspaceId, role: "type-filter", label: "数据库连接", ariaLabel: "选择数据库连接", currentTemplate: "{label}，当前：{value}", menuTitle: "选择数据库连接", prefix: "连接：", scrollAfter: 6, options: Object.freeze(mdaState.connections.length > 0
                    ? mdaState.connections.map((mdaConnection) => Object.freeze({ value: String(mdaConnection.id), label: mdaConnection.connectionName, icon: "ri-database-2-line", description: mdaConnection.databaseType, selected: String(mdaConnection.id) === String(mdaState.selectedConnection?.id || "") }))
                    : [Object.freeze({ value: "", label: "请先新增连接", icon: "ri-database-2-line", selected: true, disabled: true })]) }),
                status: Object.freeze({ gridId: mdaSession?.gridId || "MdaEmptyQueryGrid", role: "status-filter", label: "状态", options: Object.freeze([Object.freeze({ value: "", label: "全部" })]) }),
                pageSize: Object.freeze({ gridId: mdaSession?.gridId || "MdaEmptyQueryGrid", role: "page-size", label: "每页显示行数", ariaLabel: "每页显示行数", currentTemplate: "{label}，当前：{value}", menuTitle: "选择每页显示行数", scrollAfter: 4, options: Object.freeze([10, 20, 50, 100].map((mdaSize) => Object.freeze({ value: String(mdaSize), label: `${mdaSize} 行/页`, icon: "ri-list-check-3", selected: mdaSize === 20 }))) })
            })
        });
    }

    // 面板刷新只更新标准数据和已有连接下拉，不重建活动页签及其内部控制器。
    function mdaSyncPanel(mdaPayload = mdaBuildPayload()) {
        if (!mdaState.panelRoot) return;
        window.selPanel.setLocale(mdaState.panelRoot, { view: mdaPayload });
        mdaState.panelRoot.querySelectorAll("[data-sel-dropdown-menu]").forEach((mdaDropdownRoot) => window.selDropdownMenu.setLocale(mdaDropdownRoot));
        window.selDropdownMenu.setValue(mdaState.panelRoot.querySelector('[data-sel-grid-role="type-filter"]'), String(mdaState.selectedConnection?.id || ""));
    }

    // 不同数据库按各自标识符规则生成默认 SELECT，实际执行权限仍由目标数据库账号决定。
    function mdaQuoteIdentifier(mdaIdentifier, mdaType) {
        if (mdaType === "MYSQL") return `\`${String(mdaIdentifier).replaceAll("`", "``")}\``;
        if (mdaType === "SQLSERVER") return "[" + String(mdaIdentifier).replaceAll("]", "]]" ) + "]";
        return `"${String(mdaIdentifier).replaceAll('"', '""')}"`;
    }

    function mdaBuildTableQuery(mdaFilter) {
        const mdaType = String(mdaState.selectedConnection?.databaseType || "").toUpperCase();
        const mdaParts = [mdaFilter.schema, mdaFilter.tableName].filter(Boolean).map((mdaPart) => mdaQuoteIdentifier(mdaPart, mdaType));
        return Object.freeze({ label: mdaFilter.tableName, qualifiedName: mdaParts.join("."), sql: `SELECT * FROM ${mdaParts.join(".")}` });
    }

    // JDBC 表类型决定删除关键字，视图不能误用 DROP TABLE。
    function mdaBuildTableStructureAction(mdaFilter) {
        const mdaTableQuery = mdaBuildTableQuery(mdaFilter);
        const mdaIsView = String(mdaFilter.tableType || "").toUpperCase().includes("VIEW");
        return Object.freeze({
            ...mdaTableQuery,
            catalog: mdaFilter.catalog || "",
            schema: mdaFilter.schema || "",
            tableName: mdaFilter.tableName || "",
            isView: mdaIsView,
            dropSql: `DROP ${mdaIsView ? "VIEW" : "TABLE"} ${mdaTableQuery.qualifiedName}`
        });
    }

    // 业务键附加稳定短哈希，避免相同表名位于不同 schema 时页签实例冲突。
    function mdaStableKey(mdaValue) {
        let mdaHash = 0;
        Array.from(String(mdaValue)).forEach((mdaCharacter) => { mdaHash = ((mdaHash << 5) - mdaHash + mdaCharacter.codePointAt(0)) | 0; });
        return Math.abs(mdaHash).toString(36);
    }

    /** 在指定页签会话上执行真实 SQL，并只刷新该页签自己的结果表格。 */
    async function mdaExecuteSql(mdaSession, mdaSql) {
        const mdaNormalizedSql = String(mdaSql || "").trim();
        if (!mdaNormalizedSql) throw new Error("请输入需要执行的 SQL。");
        const mdaResponse = await mdaAjax.request({ url: mdaApi.execute, method: "POST", data: { connectionId: mdaSession.connectionId, sql: mdaNormalizedSql, autoCommit: true, maxRows: 1000, queryTimeoutSeconds: 30 } });
        const mdaResult = (mdaResponse.data?.results || []).find((mdaItem) => mdaItem.kind === "resultSet") || mdaResponse.data?.results?.[0];
        mdaSession.sql = mdaNormalizedSql;
        if (mdaResult?.kind === "resultSet") {
            mdaSession.columns = (mdaResult.columns || []).map((mdaColumn, mdaIndex) => ({ name: `column${mdaIndex}`, label: mdaColumn.label }));
            mdaSession.rows = (mdaResult.rows || []).map((mdaRow) => Object.fromEntries(mdaRow.map((mdaValue, mdaIndex) => [`column${mdaIndex}`, mdaValue])));
        } else {
            mdaSession.columns = [{ name: "column0", label: "更新行数" }];
            mdaSession.rows = [{ column0: mdaResult?.updateCount ?? 0 }];
        }
        mdaSession.gridController.setLocale(mdaBuildPayload(mdaSession));
        if (mdaState.tabsController.getState().activeId === mdaSession.id) mdaSyncPanel(mdaBuildPayload(mdaSession));
        return mdaResponse;
    }

    // 页签内容完全由三个公共控件和独立 selGrid 组成；清理函数是关闭时的统一销毁入口。
    function mdaMountQuerySession(mdaPanel, mdaSession) {
        const mdaSplitController = window.selSplitPane.mount(mdaPanel, {
            id: mdaSession.splitId, direction: "vertical", ratio: 36, minRatio: 20, maxRatio: 70,
            startLabel: "SQL 编辑区", endLabel: "查询结果区", separatorLabel: "调整 SQL 编辑区和查询结果区高度"
        });
        if (!mdaSplitController) throw new Error("MDA SQL 分隔面板挂载失败。");
        const mdaEditorController = window.selCodeEditor.mount(mdaSplitController.start, {
            id: mdaSession.editorId, language: "sql", label: "SQL 查询", icon: "ri-terminal-box-line",
            value: mdaSession.sql, placeholder: "SELECT * FROM table_name", statusText: "",
            actions: Object.freeze([
                Object.freeze({ id: "execute", label: "执行", icon: "ri-play-fill", primary: true }),
                Object.freeze({ id: "clear", label: "清空", icon: "ri-delete-bin-line" })
            ])
        });
        const mdaGridRoot = window.selGrid.create(mdaSplitController.end, { gridId: mdaSession.gridId, entity: "MdaQueryResult", ariaLabel: `${mdaSession.label} 查询结果` });
        const mdaGridController = mdaGridRoot ? window.selGrid.mount(mdaGridRoot, mdaBuildPayload(mdaSession)) : null;
        if (!mdaEditorController || !mdaGridController) {
            mdaGridController?.destroy();
            mdaEditorController?.destroy();
            mdaSplitController.destroy();
            throw new Error("MDA SQL 编辑器或结果表格挂载失败。");
        }
        mdaSession.splitController = mdaSplitController;
        mdaSession.editorController = mdaEditorController;
        mdaSession.gridController = mdaGridController;
        const mdaHandleEditorAction = async (mdaEvent) => {
            if (mdaEvent.detail?.editorId !== mdaSession.editorId) return;
            if (mdaEvent.detail.action === "clear") {
                // 清空结果使用短时页面反馈，编辑器底栏只保留光标位置。
                mdaBase.toast("SQL 已清空。", "info");
                return;
            }
            if (mdaEvent.detail.action !== "execute") return;
            mdaEditorController.setLoading(true);
            try {
                const mdaResponse = await mdaExecuteSql(mdaSession, mdaEvent.detail.value);
                // SQL 结果已经进入下方表格，成功消息仅短时提示而不占用上下分区高度。
                mdaBase.toast(mdaResponse.msg || "SQL 执行完成。", "success");
            } catch (mdaError) {
                // 异常仍以警示 Toast 告知用户，加载状态由 finally 统一解除。
                mdaBase.toast(mdaError.message || "SQL 执行失败。", "error");
            } finally {
                mdaEditorController.setLoading(false);
            }
        };
        mdaEditorController.root.addEventListener("selCodeEditor:action", mdaHandleEditorAction);
        return () => {
            mdaEditorController.root.removeEventListener("selCodeEditor:action", mdaHandleEditorAction);
            mdaGridController.destroy();
            mdaEditorController.destroy();
            mdaSplitController.destroy();
            mdaState.querySessions.delete(mdaSession.id);
        };
    }

    // 同一表重复选择只激活既有页签；新表或人工查询才创建新的动态实例。
    function mdaOpenQuerySession(mdaDefinition, mdaExecuteImmediately = false) {
        if (!mdaState.selectedConnection) return null;
        const mdaSessionId = String(mdaDefinition.id);
        const mdaExistingSession = mdaState.querySessions.get(mdaSessionId);
        if (mdaExistingSession) {
            mdaState.tabsController.activate(mdaSessionId);
            return mdaExistingSession;
        }
        const mdaSession = {
            id: mdaSessionId,
            label: String(mdaDefinition.label),
            qualifiedName: String(mdaDefinition.qualifiedName || ""),
            connectionId: mdaState.selectedConnection.id,
            sql: String(mdaDefinition.sql || ""),
            columns: [], rows: [],
            splitId: `${mdaSessionId}SplitPane`, editorId: `${mdaSessionId}CodeEditor`, gridId: `${mdaSessionId}ResultGrid`,
            splitController: null, editorController: null, gridController: null
        };
        mdaState.querySessions.set(mdaSessionId, mdaSession);
        try {
            mdaState.tabsController.open({
                id: mdaSessionId, label: mdaSession.label, icon: mdaDefinition.icon || "ri-table-2", closable: true,
                closeLabel: `关闭${mdaSession.label}查询页签`,
                mount: (mdaPanel) => mdaMountQuerySession(mdaPanel, mdaSession)
            });
        } catch (mdaError) {
            mdaState.querySessions.delete(mdaSessionId);
            throw mdaError;
        }
        mdaSyncPanel(mdaBuildPayload(mdaSession));
        if (mdaExecuteImmediately) mdaSession.editorController.action("execute");
        return mdaSession;
    }

    function mdaOpenTableQuery(mdaFilter) {
        const mdaTableQuery = mdaBuildTableQuery(mdaFilter);
        const mdaSessionId = `MdaTableQuery${mdaState.selectedConnection.id}_${mdaStableKey(`${mdaFilter.catalog}.${mdaFilter.schema}.${mdaFilter.tableName}`)}`;
        return mdaOpenQuerySession({ id: mdaSessionId, label: mdaTableQuery.label, qualifiedName: mdaTableQuery.qualifiedName, sql: mdaTableQuery.sql, icon: "ri-table-2" }, true);
    }

    // 编辑动作只打开带安全占位符的 SQL 页签，用户明确补全语句并点击执行后才会修改目标库。
    function mdaOpenTableStructureEditor(mdaFilter) {
        const mdaAction = mdaBuildTableStructureAction(mdaFilter);
        const mdaSessionId = `MdaTableStructure${mdaState.selectedConnection.id}_${mdaStableKey(`${mdaFilter.catalog}.${mdaFilter.schema}.${mdaFilter.tableName}`)}`;
        const mdaSql = mdaAction.isView
            ? `-- 请按目标数据库语法填写 ${mdaAction.qualifiedName} 的 CREATE OR REPLACE VIEW 语句`
            : `-- 请把占位注释替换为 ADD / ALTER / DROP COLUMN 等目标数据库语句\nALTER TABLE ${mdaAction.qualifiedName}\n    /* 表结构变更语句 */;`;
        return mdaOpenQuerySession({ id: mdaSessionId, label: `编辑 ${mdaAction.label}`, qualifiedName: mdaAction.qualifiedName, sql: mdaSql, icon: "ri-edit-line" });
    }

    function mdaOpenAdHocQuery() {
        const mdaSequence = mdaState.querySequence++;
        return mdaOpenQuerySession({ id: `MdaAdHocQuery${mdaSequence}`, label: `SQL ${mdaSequence}`, sql: "SELECT 1 AS ready", icon: "ri-terminal-box-line" });
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

    function mdaEmptyConnectionValues() {
        return { connectionName: "", databaseType: "H2", host: "", port: "", databaseName: "", schemaName: "PUBLIC", username: "sa", password: "", customJdbcUrl: "", jdbcParameters: "", defaultAutoCommit: "true", sortnum: "0" };
    }

    async function mdaOpenSelectedConnectionEditor() {
        if (!mdaState.selectedConnection) return false;
        const mdaDetail = await mdaAjax.json({ url: `${mdaApi.connections}getById.htm?id=${mdaState.selectedConnection.id}` });
        mdaState.editingConnectionId = mdaState.selectedConnection.id;
        mdaState.connectionWindowController.setLocale(mdaBuildConnectionWindow());
        mdaState.connectionWindowController.reset();
        mdaState.connectionWindowController.setValues({ ...mdaDetail.data, defaultAutoCommit: String(mdaDetail.data.defaultAutoCommit), port: mdaDetail.data.port ?? "", sortnum: mdaDetail.data.sortnum ?? 0 });
        mdaState.connectionWindowController.open();
        return true;
    }

    async function mdaConfirmAndDeleteSelectedConnection() {
        const mdaConnection = mdaState.selectedConnection;
        if (!mdaConnection) return false;
        const mdaConfirmed = await mdaState.confirmDialogController.open({
            title: "删除数据库连接",
            message: "是否删除此连接配置？不会删除目标数据库。",
            target: mdaConnection.connectionName,
            icon: "ri-delete-bin-6-line",
            tone: "danger",
            confirmLabel: "确认删除",
            cancelLabel: "取消",
            closeLabel: "关闭删除连接确认框"
        });
        if (!mdaConfirmed) return false;
        try {
            const mdaResponse = await mdaAjax.request({ url: `${mdaApi.connections}delete.htm`, method: "POST", data: { id: mdaConnection.id } });
            await mdaReloadConnections();
            mdaBase.toast(mdaResponse.msg || `连接“${mdaConnection.connectionName}”已删除。`, "success");
            return true;
        } catch (mdaError) {
            mdaBase.toast(mdaError.message || "连接配置删除失败。", "error");
            return false;
        }
    }

    async function mdaConfirmAndDeleteTable(mdaFilter) {
        if (!mdaState.selectedConnection) return false;
        const mdaConnectionId = mdaState.selectedConnection.id;
        const mdaDeleteTarget = mdaBuildTableStructureAction(mdaFilter);
        const mdaObjectLabel = mdaDeleteTarget.isView ? "视图" : "数据表";
        const mdaConfirmed = await mdaState.confirmDialogController.open({
            title: `删除${mdaObjectLabel}`,
            message: `是否永久删除此${mdaObjectLabel}？此操作无法撤销。`,
            target: mdaDeleteTarget.qualifiedName,
            icon: "ri-delete-bin-6-line",
            tone: "danger",
            confirmLabel: "确认删除",
            cancelLabel: "取消",
            closeLabel: `关闭删除${mdaObjectLabel}确认框`
        });
        if (!mdaConfirmed) return false;
        try {
            await mdaAjax.request({
                url: mdaApi.execute,
                method: "POST",
                data: { connectionId: mdaConnectionId, sql: mdaDeleteTarget.dropSql, autoCommit: true, maxRows: 1, queryTimeoutSeconds: 30 }
            });
            const mdaStableTablePath = `${mdaDeleteTarget.catalog || ""}.${mdaDeleteTarget.schema || ""}.${mdaDeleteTarget.label}`;
            mdaState.tabsController.close(`MdaTableQuery${mdaConnectionId}_${mdaStableKey(mdaStableTablePath)}`, { force: true });
            mdaState.tabsController.close(`MdaTableStructure${mdaConnectionId}_${mdaStableKey(mdaStableTablePath)}`, { force: true });
            await mdaRefreshSelectedMetadata();
            mdaBase.toast(`${mdaObjectLabel}“${mdaDeleteTarget.qualifiedName}”已删除。`, "success");
            return true;
        } catch (mdaError) {
            mdaBase.toast(mdaError.message || `${mdaObjectLabel}删除失败。`, "error");
            return false;
        }
    }

    // 同一连接结构刷新不关闭其他查询页签，删除目标表后只移除该表自己的页签。
    async function mdaRefreshSelectedMetadata() {
        if (!mdaState.selectedConnection) return false;
        const mdaResponse = await mdaAjax.request({ url: mdaApi.metadata, method: "POST", data: { connectionId: mdaState.selectedConnection.id } });
        mdaState.metadata = mdaResponse.data?.nodes || [];
        const mdaPayload = mdaBuildPayload();
        mdaState.treeController.setLocale(mdaPayload.tree);
        mdaSyncPanel(mdaPayload);
        return true;
    }

    // 切换连接时关闭并销毁旧连接的全部动态查询页签，再加载新连接元数据。
    async function mdaLoadMetadata(mdaConnection) {
        mdaState.tabsController?.closeAll();
        mdaState.selectedConnection = mdaConnection;
        await mdaRefreshSelectedMetadata();
    }

    async function mdaReloadConnections(mdaPreferredId) {
        const mdaConnectionPage = await mdaAjax.json({ url: `${mdaApi.connections}getStore.htm` });
        mdaState.connections = mdaConnectionPage.records || [];
        mdaState.selectedConnection = mdaState.connections.find((mdaItem) => String(mdaItem.id) === String(mdaPreferredId || "")) || mdaState.connections[0] || null;
        if (mdaState.selectedConnection) {
            await mdaLoadMetadata(mdaState.selectedConnection);
            return;
        }
        mdaState.tabsController?.closeAll();
        mdaState.metadata = [];
        const mdaPayload = mdaBuildPayload();
        mdaState.treeController.setLocale(mdaPayload.tree);
        mdaSyncPanel(mdaPayload);
    }

    async function mdaMountApplication() {
        // 窗口文案先加载；页面骨架仍在控制库请求前完成挂载，空连接时可立即新增。
        const mdaWindowMessages = await mdaAjax.json({ url: "/sel/components/window/i18n/zh-CN.json?v=20260807-mda-1" });
        const mdaPayload = mdaBuildPayload();
        mdaState.panelRoot = window.selPanel.create(mdaApplicationHost, { gridId: mdaWorkspaceId, sourceId: mdaWorkspaceId, entity: "MdaQueryWorkspace", view: "database", layout: "single", structure: mdaLayout, ariaLabel: mdaPayload.title.ariaLabel });
        if (!mdaState.panelRoot || !window.selPanel.mount(mdaState.panelRoot, { view: mdaPayload, expandLeftLabel: mdaPayload.title.messages.expandLeftRegion, collapseLeftLabel: mdaPayload.title.messages.collapseLeftRegion })) throw new Error("MDA 公共面板挂载失败。");
        mdaState.treeController = window.selTree.mount(mdaState.panelRoot, mdaPayload.tree);
        window.selDropdownMenu.mountAll(mdaState.panelRoot);
        const mdaTabsHost = window.selPanel.getComponent(mdaWorkspaceId, "selTabs");
        mdaState.tabsController = window.selTabs.mount(mdaTabsHost, { id: mdaTabsId, ariaLabel: "数据库查询页签", tabListLabel: "已打开的数据库查询", emptyIcon: "ri-terminal-window-line", emptyTitle: "选择数据表开始查询", emptyDescription: "左侧选择表后，将在这里打开 SQL 编辑区和查询结果" });
        mdaState.connectionWindowController = window.selWindow.mount(mdaApplicationHost, { id: "MdaConnectionWindow", messages: mdaWindowMessages, ...mdaBuildConnectionWindow() });
        mdaState.confirmDialogController = window.selConfirmDialog.mount(mdaApplicationHost, { id: "MdaDeleteConfirmDialog", title: "删除确认", tone: "danger" });
        if (!mdaState.treeController || !mdaState.tabsController || !mdaState.connectionWindowController || !mdaState.confirmDialogController) throw new Error("MDA 公共业务组件挂载失败。");

        // 面板命令只负责连接窗口和新建查询，SQL 执行由当前页签编辑器自己的动作事件承接。
        mdaState.panelRoot.addEventListener("click", async (mdaEvent) => {
            const mdaCommand = mdaEvent.target.closest("[data-panel-command]")?.dataset.panelCommand;
            if (mdaCommand === "connection-add") {
                mdaState.editingConnectionId = null;
                mdaState.connectionWindowController.setLocale(mdaBuildConnectionWindow());
                mdaState.connectionWindowController.reset();
                mdaState.connectionWindowController.setValues(mdaEmptyConnectionValues());
                mdaState.connectionWindowController.open();
            }
            if (mdaCommand === "connection-edit" && mdaState.selectedConnection) {
                await mdaOpenSelectedConnectionEditor();
            }
            if (mdaCommand === "connection-delete" && mdaState.selectedConnection) {
                await mdaConfirmAndDeleteSelectedConnection();
            }
            if (mdaCommand === "query-new" && mdaState.selectedConnection) mdaOpenAdHocQuery();
        });
        mdaState.panelRoot.addEventListener("selTree:select", (mdaEvent) => {
            if (mdaEvent.detail?.filter?.nodeType !== "table") return;
            try {
                mdaOpenTableQuery(mdaEvent.detail.filter);
            } catch (mdaError) {
                console.error("MDA 数据表查询页签打开失败。", mdaError);
            }
        });
        // 公共树只上报动作；连接配置、目标库 DDL 和剪贴板副作用全部留在 MDA 装配层。
        mdaState.panelRoot.addEventListener("selTree:contextAction", async (mdaEvent) => {
            const mdaAction = mdaEvent.detail?.action;
            const mdaFilter = mdaEvent.detail?.filter || {};
            try {
                if (mdaAction === "connection-edit") await mdaOpenSelectedConnectionEditor();
                if (mdaAction === "connection-delete") await mdaConfirmAndDeleteSelectedConnection();
                if (mdaAction === "table-edit") mdaOpenTableStructureEditor(mdaFilter);
                if (mdaAction === "table-delete") await mdaConfirmAndDeleteTable(mdaFilter);
                if (mdaAction === "copy-label") {
                    const mdaCopied = await mdaBase.copyText(mdaEvent.detail?.label || "");
                    mdaBase.toast(mdaCopied ? `已复制“${mdaEvent.detail.label}”。` : "复制失败，请检查浏览器剪贴板权限。", mdaCopied ? "success" : "error");
                }
            } catch (mdaError) {
                mdaBase.toast(mdaError.message || "右键菜单操作失败。", "error");
            }
        });
        // 切换仅隐藏非活动页签，关闭事件则在子清理完成后刷新计数。
        mdaState.tabsController.root.addEventListener("selTabs:change", () => mdaSyncPanel(mdaBuildPayload()));
        mdaState.tabsController.root.addEventListener("selTabs:close", () => mdaSyncPanel(mdaBuildPayload()));

        mdaApplicationHost.addEventListener("selWindow:submit", async (mdaEvent) => {
            if (mdaEvent.detail?.id === "MdaConnectionWindow") {
                mdaState.connectionWindowController.setLoading(true);
                try {
                    const mdaUrl = mdaState.editingConnectionId ? `${mdaApi.connections}update.htm` : `${mdaApi.connections}create.htm`;
                    const mdaValues = mdaState.editingConnectionId ? { ...mdaEvent.detail.values, id: mdaState.editingConnectionId } : mdaEvent.detail.values;
                    const mdaResponse = await mdaAjax.request({ url: mdaUrl, method: "POST", data: mdaValues });
                    const mdaSavedId = mdaResponse.data?.id || mdaState.editingConnectionId;
                    mdaState.connectionWindowController.setFeedback(mdaResponse.msg || "连接配置保存完成。");
                    mdaState.connectionWindowController.close();
                    await mdaReloadConnections(mdaSavedId);
                } catch (mdaError) {
                    mdaState.connectionWindowController.setFeedback(mdaError.message || "连接配置保存失败。", true);
                } finally {
                    mdaState.connectionWindowController.setLoading(false);
                }
                return;
            }
        });
        const mdaConnectionSelect = mdaState.panelRoot.querySelector('[data-sel-grid-role="type-filter"]');
        mdaConnectionSelect?.addEventListener("change", async () => {
            const mdaConnection = mdaState.connections.find((mdaItem) => String(mdaItem.id) === mdaConnectionSelect.value);
            if (mdaConnection) await mdaLoadMetadata(mdaConnection);
        });
        // 公共工作区已经可操作后再异步读取控制库配置与目标库元数据。
        try {
            await mdaReloadConnections();
        } catch (mdaError) {
            console.error("MDA 连接配置加载失败。", mdaError);
        }
    }

    const mdaBackgroundController = window.selPageBackground.mount(mdaBackgroundHost, { defaults: Object.freeze({ theme: "solid-dark", overlay: 0, brightness: 100, blur: 0 }) });
    if (!mdaBackgroundController) throw new Error("MDA 页面背景挂载失败。");
    if (!window.selPersonalization.mount(mdaPersonalizationHost, { backgroundController: mdaBackgroundController })) throw new Error("MDA 个性化设置挂载失败。");
    mdaMountApplication().catch((mdaError) => { console.error("MDA 初始化失败。", mdaError); throw mdaError; });
})();
