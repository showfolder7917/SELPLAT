/*
 * mda.js：MDA 数据库工作台应用装配层。
 * 负责调用真实连接、元数据和 SQL 接口，并组合公共树、页签、分隔面板、代码编辑器、表格与窗口。
 *
 * SEL UI 组件用法：panel 创建五区外壳；tree 展示数据库结构；tabs 管理查询页签；
 * splitPane 划分编辑器与结果区；codeEditor 编辑 SQL；grid 展示结果；windowComponent
 * 承载业务表单；confirmDialog 承载删除确认。所有依赖只在此处解构一次。
 *
 * 阅读顺序：mdaState 保存页面运行状态，mdaBuildPayload() 生成主工作区视图，
 * mdaMountQuerySession() 组装单个 SQL 页签，mountApp() 最后完成控件挂载和事件编排。
 * 模块级业务名称使用 mda 前缀，函数参数与局部变量使用简短业务名，避免整段代码重复前缀。
 */
(function app() {
    "use strict";

    window.sel.require([
        "core.query", "net.ajax", "components.panel",
        "components.tree", "components.dropdownMenu", "components.grid", "components.contextMenu",
        "components.tabs", "components.splitPane", "components.codeEditor", "components.window",
        "components.confirmDialog", "components.pageBackground", "components.personalization"
    ]);
    // SEL 公共能力使用 sel 前缀短名；MDA 业务状态、配置和函数继续使用 mda 前缀。
    const selBase = window.sel.core;
    // selFreeze 只用于完整配置、payload 和对外状态快照；运行时控制器及内部字段保持自身生命周期。
    const { freeze: selFreeze } = selBase;
    const { ajax: selAjax } = window.sel.net;
    const {
        panel, tree, dropdownMenu: dropdown, grid, contextMenu, tabs, splitPane, codeEditor,
        window: windowComponent, confirmDialog, pageBackground, personalization
    } = window.sel.components;
    // 三个宿主分别承载 MDA 工作区、背景和个性化设置。
    const mdaAppHost = selBase.query("[data-mda-app]");
    const mdaBackgroundHost = selBase.query("[data-sel-page-background-host]");
    const mdaPersonalizationHost = selBase.query("[data-sel-personalization-host]");
    const mdaWorkspaceId = "MdaDatabaseWorkspace";
    const mdaTabsId = "MdaDatabaseQueryTabs";
    // 接口表集中登记真实后端端点，后续业务函数只引用语义键。
    const mdaApi = selFreeze({
        connections: "/api/mda/connections/",
        projects: "/api/mda/projects/create.htm",
        metadata: "/api/mda/metadata/tree.htm",
        execute: "/api/mda/sql/execute.htm",
        updateRow: "/api/mda/data/update-row.htm",
        exportTable: "/api/mda/export/table.htm",
        exportDatabase: "/api/mda/export/database.htm"
    });
    // 可变状态保存公共组件控制器、动态查询会话和当前编辑上下文。
    const mdaState = {
        connections: [], selectedConnection: null, metadata: [], panelRoot: null,
        treeController: null, tabsController: null, querySessions: new Map(), structureSessions: new Map(), querySequence: 1,
        connectionWindowController: null, projectWindowController: null,
        confirmDialogController: null, editingConnectionId: null,
        rowEditWindows: new Map(), editingRowContext: null, windowMessages: null,
        closeConfirmationPending: false
    };
    // 所有 MDA selGrid 实例消费同一份公共消息契约，避免动态页签只传数据列而遗漏 title.messages。
    const mdaGridMessages = selFreeze({
        selectProject: "选择记录", viewProject: "查看记录", editProject: "编辑记录", moreActions: "更多操作",
        filtersReset: "查询筛选已重置", treePrefix: "数据库对象", expandLeftRegion: "展开数据库结构",
        collapseLeftRegion: "收起数据库结构", filterActivated: "查询搜索已激活", newOpened: "已打开 SQL 查询页签",
        exportPreparing: "操作已触发", dateRange: "日期范围：{start} 至 {end}", movePrefix: "移动到"
    });

    // MDA 只声明公共组件所在区域；页签内部结构继续由各公共控件自身创建。
    const mdaLayout = selFreeze({
        top: [
            { component: "title", payload: "title" },
            {
                component: "toolbar",
                children: [
                    { component: "selDropdownMenu", slot: "projectType", payload: "select.projectType" }
                ]
            }
        ],
        left: [{ component: "selTree", payload: "tree" }],
        center: [{ component: "selTabs", payload: "workspace.tabs" }],
        right: [],
        bottom: []
    });
    // 数据库连接栏使用公共面板栏目缩放契约；MDA 只声明安全宽度，不接触分隔线 DOM 或指针事件。
    const mdaToolbarOptions = selFreeze({
        columnResize: true,
        columns: {
            projectType: {
                width: 360,
                minWidth: 240,
                maxWidth: 720,
                label: "调整数据库连接栏目宽度"
            }
        }
    });

    /** 把 JDBC 元数据节点转换为 selTree 标准节点，并保留打开表查询页签所需的稳定字段。 */
    function mdaMapMetadataNodes(nodes, path) {
        return (nodes || []).map((node, index) => {
            const nodePath = `${path}-${index}-${node.type}-${node.label}`;
            const children = mdaMapMetadataNodes(node.children, nodePath);
            const icons = { catalog: "ri-database-2-line", schema: "ri-folder-3-line", table: "ri-table-2", column: "ri-key-2-line" };
            const isView = String(node.tableType || "").toUpperCase().includes("VIEW");
            // 数据库目录与业务 PUBLIC Schema 默认展开；系统 Schema、表和字段保持折叠。
            const schemaName = String(node.schema || node.label || "").trim().toUpperCase();
            const defaultExpanded = node.type === "catalog"
                || (node.type === "schema" && schemaName === "PUBLIC");
            // 目录节点代表当前连接中的数据库，表或视图节点承接真实目标库结构动作。
            const contextActions = node.type === "catalog"
                ? [
                    { id: "connection-edit", label: "编辑连接", icon: "ri-edit-line" },
                    { id: "connection-delete", label: "删除连接", icon: "ri-delete-bin-6-line", danger: true },
                    { id: "copy-label", label: "复制名称", icon: "ri-file-copy-line" },
                    { id: "database-export", label: "导出整个数据库", icon: "ri-download-cloud-2-line" }
                ]
                : node.type === "table"
                    ? [
                        { id: "table-inspect", label: isView ? "查看视图结构" : "查看表结构", icon: "ri-layout-column-line" },
                        { id: "table-edit", label: isView ? "编辑视图定义" : "编辑表结构", icon: "ri-edit-line" },
                        { id: "table-delete", label: isView ? "删除视图" : "删除表", icon: "ri-delete-bin-6-line", danger: true },
                        { id: "copy-label", label: isView ? "复制视图名" : "复制表名", icon: "ri-file-copy-line" },
                        ...(!isView ? [{ id: "table-export", label: "导出表", icon: "ri-download-2-line" }] : [])
                    ]
                    : [];
            return {
                id: nodePath,
                type: node.type,
                label: node.type === "column" && node.typeName ? `${node.label} · ${node.typeName}` : node.label,
                icon: icons[node.type] || "ri-circle-line",
                count: children.length,
                expanded: defaultExpanded,
                filter: {
                    nodeType: node.type,
                    catalog: node.catalog || "",
                    schema: node.schema || "",
                    tableName: node.tableName || "",
                    tableType: node.tableType || "",
                    structureEditSql: node.structureEditSql || "",
                    primaryKeys: [...(node.primaryKeys || [])],
                    columns: (node.children || []).map((column) => ({ ...column }))
                },
                contextActions: contextActions,
                children: children
            };
        });
    }

    // 统计真实表节点数量供标题和左树摘要同步显示。
    function mdaCountTables(nodes) {
        return (nodes || []).reduce((count, node) => count + (node.type === "table" ? 1 : 0) + mdaCountTables(node.children), 0);
    }

    // 活动页签决定标题说明和结果行统计；没有页签时返回空结果状态。
    function mdaGetActiveSession() {
        const activeId = mdaState.tabsController?.getState().activeId;
        return activeId ? mdaState.querySessions.get(activeId) || null : null;
    }

    /** 构建外层工作台和页签表格共同消费的标准聚合 payload。 */
    function mdaBuildPayload(session = mdaGetActiveSession()) {
        const connectionId = String(session?.connectionId || mdaState.selectedConnection?.id || "");
        const columns = session?.columns || [];
        const rows = session?.rows || [];
        const dataItems = rows.map((row, index) => ({ _row: index + 1, _connectionId: connectionId, ...row }));
        const columnItems = columns.length > 0
            ? columns.map((column) => ({
                id: column.name,
                field: column.name,
                label: column.label,
                renderer: "text",
                tooltip: column.remarks,
                // 只有能映射回当前真实表字段的结果列才允许进入多字段 WHERE 条件。
                headerSelectable: Boolean((session?.editableTable?.columns || []).find((metadataColumn) =>
                    String(metadataColumn.label || "").toLowerCase() === String(column.databaseName || "").toLowerCase()
                ))
            }))
            : [{ id: "empty", field: "message", label: "查询提示", renderer: "text" }];
        return selFreeze({
            // 目标库字段动态变化，公共宽表模式按列数在结果区内部提供水平滚动。
            grid: { mode: "records", horizontalScroll: true, defaultColumnWidth: 150, idField: "_row", typeField: "_connectionId", statusField: "_status", searchFields: columns.map((column) => column.name) },
            data: { items: dataItems, selectedIds: [] },
            column: { gridId: session?.gridId || "MdaEmptyQueryGrid", ariaLabel: "数据库查询结果", emptyText: "在上方输入 SQL 后执行查询", items: columnItems },
            title: {
                title: "MDA 数据库工作台", subtitle: "Multi-Database Access",
                description: session ? `正在使用 ${session.label} 查询页签` : "从左侧选择数据表，在右侧上方编写 SQL 并查看下方结果",
                ariaLabel: "MDA 数据库工作台",
                ariaLabels: { statusTabs: "工作台状态", headerActions: "数据库操作", toolbar: "数据库连接工具栏", sidebar: "数据库结构", content: "SQL 查询工作区", board: "查询结果表格", pagination: "结果分页" },
                statusTabs: [
                    { value: "", label: "连接", count: mdaState.connections.length },
                    { value: "tables", label: "数据表", count: mdaCountTables(mdaState.metadata) },
                    { value: "tabs", label: "查询页签", count: mdaState.querySessions.size },
                    { value: "rows", label: "结果行", count: dataItems.length }
                ],
                actions: [
                    { id: "connection-add", label: "新增连接", icon: "ri-database-2-line", primary: true },
                    { id: "project-create", label: "创建工程", icon: "ri-folder-add-line" },
                    ...(mdaState.selectedConnection ? [
                        { id: "connection-edit", label: "编辑连接", icon: "ri-edit-line" },
                        { id: "connection-delete", label: "删除连接", icon: "ri-delete-bin-6-line" },
                        { id: "query-new", label: "新建查询", icon: "ri-terminal-box-line" }
                    ] : [])
                ],
                resetLabel: "重置",
                messages: mdaGridMessages
            },
            search: { gridId: session?.gridId || "MdaEmptyQueryGrid", label: "结果搜索", placeholder: "搜索当前结果…", buttonLabel: "查询", clearLabel: "清空搜索", icon: "ri-search-line", buttonIcon: "ri-search-line", clearIcon: "ri-close-line", defaultValue: "", clearable: true, submitOnEnter: true, submitOnClear: true, allowEmpty: true, trim: true },
            tree: { gridId: mdaWorkspaceId, ariaLabel: "数据库结构", heading: "数据库结构", summary: `${mdaCountTables(mdaState.metadata)} 个表／视图`, expandLabelTemplate: "展开{label}", collapseLabelTemplate: "收起{label}", contextMenuLabelTemplate: "{label}操作", selectedId: "", items: mdaMapMetadataNodes(mdaState.metadata, "mda") },
            menu: { gridId: session?.gridId || "MdaEmptyQueryGrid", ariaLabel: "查询结果操作" },
            pagination: { gridId: session?.gridId || "MdaEmptyQueryGrid", currentPage: 1, pageSize: 20, totalCount: dataItems.length, summaryAll: "共 {total} 行", summaryFiltered: "当前 {visible} 行 · 共 {total} 行", previousLabel: "上一页", nextLabel: "下一页", pageChangedMessage: "已切换到第 {page} 页", pageSizeChangedMessage: "每页显示 {size} 行" },
            select: {
                projectType: { gridId: mdaWorkspaceId, role: "type-filter", label: "数据库连接", ariaLabel: "选择数据库连接", currentTemplate: "{label}，当前：{value}", menuTitle: "选择数据库连接", prefix: "连接：", scrollAfter: 6, options: mdaState.connections.length > 0
                    ? mdaState.connections.map((connection) => ({ value: String(connection.id), label: connection.connectionName, icon: "ri-database-2-line", description: connection.databaseType, selected: String(connection.id) === String(mdaState.selectedConnection?.id || "") }))
                    : [{ value: "", label: "请先新增连接", icon: "ri-database-2-line", selected: true, disabled: true }] },
                status: { gridId: session?.gridId || "MdaEmptyQueryGrid", role: "status-filter", label: "状态", options: [{ value: "", label: "全部" }] },
                pageSize: { gridId: session?.gridId || "MdaEmptyQueryGrid", role: "page-size", label: "每页显示行数", ariaLabel: "每页显示行数", currentTemplate: "{label}，当前：{value}", menuTitle: "选择每页显示行数", scrollAfter: 4, options: [10, 20, 50, 100].map((size) => ({ value: String(size), label: `${size} 行/页`, icon: "ri-list-check-3", selected: size === 20 })) }
            }
        });
    }

    // 面板刷新只更新标准数据和已有连接下拉，不重建活动页签及其内部控制器。
    function mdaSyncPanel(payload = mdaBuildPayload()) {
        if (!mdaState.panelRoot) return;
        panel.setLocale(mdaState.panelRoot, { view: payload });
        mdaState.panelRoot.querySelectorAll("[data-sel-dropdown-menu]").forEach((dropdownRoot) => dropdown.setLocale(dropdownRoot));
        dropdown.setValue(mdaState.panelRoot.querySelector('[data-sel-grid-role="type-filter"]'), String(mdaState.selectedConnection?.id || ""));
    }

    // 不同数据库按各自标识符规则生成默认 SELECT，实际可执行范围由目标数据库账号决定。
    function mdaQuoteIdentifier(identifier, type) {
        if (type === "MYSQL") return `\`${String(identifier).replaceAll("`", "``")}\``;
        if (type === "SQLSERVER") return "[" + String(identifier).replaceAll("]", "]]" ) + "]";
        return `"${String(identifier).replaceAll('"', '""')}"`;
    }

    // JDBC 数值和布尔类型保持原生字面量，其余值使用单引号并转义内部单引号。
    function mdaFormatWhereValue(column, value) {
        if (value === null || value === undefined) return null;
        const unquotedJdbcTypes = new Set([-7, -6, -5, 2, 3, 4, 5, 6, 7, 8, 16]);
        if (unquotedJdbcTypes.has(Number(column.jdbcType))) {
            if (Number(column.jdbcType) === 16 || Number(column.jdbcType) === -7) {
                return String(value).toLowerCase() === "true" || value === 1 ? "TRUE" : "FALSE";
            }
            return String(value);
        }
        return `'${String(value).replaceAll("'", "''")}'`;
    }

    // 单个真实字段和值生成独立谓词；NULL 必须使用 IS NULL，不能错误拼成 = NULL。
    function mdaBuildWherePredicate(column, value) {
        const columnName = String(column?.databaseName || "").trim();
        if (!columnName) return "";
        const formattedValue = mdaFormatWhereValue(column, value);
        return formattedValue === null
            ? `${columnName} IS NULL`
            : `${columnName} = ${formattedValue}`;
    }

    // 右键筛选 SQL 使用当前右键行；多个已勾选字段逐行用 AND 连接，未勾选时由调用方传入当前单字段。
    function mdaBuildSelectFromWhereSql(session, columns, row) {
        const tableName = String(session.editableTable?.tableName || "").trim();
        const predicates = (Array.isArray(columns) ? columns : [])
            .map((column) => mdaBuildWherePredicate(column, row?.[column.name]))
            .filter(Boolean);
        if (!tableName || predicates.length === 0) return "";
        return `SELECT * FROM ${tableName}\nWHERE ${predicates.join("\n  AND ")}`;
    }

    // 每条右键查询作为独立语句追加；已有 SQL 未带分号时先补分号，再保留一个空行分隔。
    function mdaAppendSqlQuery(editorController, sql) {
        const currentSql = String(editorController.getValue() || "");
        const currentSqlTrimmed = currentSql.trimEnd();
        const separator = currentSqlTrimmed
            ? `${currentSqlTrimmed.endsWith(";") ? "" : ";"}\n\n`
            : "";
        return editorController.appendValue(`${separator}${sql}`);
    }

    /** 根据树节点坐标生成一次安全的全表查询定义。 */
    function mdaBuildTableQuery(filter) {
        const type = String(mdaState.selectedConnection?.databaseType || "").toUpperCase();
        const parts = [filter.schema, filter.tableName].filter(Boolean).map((part) => mdaQuoteIdentifier(part, type));
        // 默认查询只使用树节点中的真实表名，不再附加 schema 或数据库标识符引号。
        return selFreeze({
            label: filter.tableName,
            qualifiedName: parts.join("."),
            sql: `SELECT * FROM ${filter.tableName}`,
            editableTable: {
                catalog: filter.catalog || "",
                schema: filter.schema || "",
                tableName: filter.tableName || "",
                primaryKeys: [...(filter.primaryKeys || [])],
                // 表查询会话保留当前表全部 JDBC 字段元数据，执行结果按字段名取得 COMMENT。
                columns: (filter.columns || []).map((column) => ({ ...column }))
            }
        });
    }

    // JDBC 表类型决定删除关键字，视图不能误用 DROP TABLE。
    function mdaBuildTableStructureAction(filter) {
        const tableQuery = mdaBuildTableQuery(filter);
        const isView = String(filter.tableType || "").toUpperCase().includes("VIEW");
        return selFreeze({
            ...tableQuery,
            catalog: filter.catalog || "",
            schema: filter.schema || "",
            tableName: filter.tableName || "",
            isView: isView,
            dropSql: `DROP ${isView ? "VIEW" : "TABLE"} ${tableQuery.qualifiedName}`
        });
    }

    // 业务键附加稳定短哈希，避免相同表名位于不同 schema 时页签实例冲突。
    function mdaStableKey(value) {
        let hash = 0;
        Array.from(String(value)).forEach((character) => { hash = ((hash << 5) - hash + character.codePointAt(0)) | 0; });
        return Math.abs(hash).toString(36);
    }

    // 行标色完全限定在当前 MDA 查询表格，取消或关闭编辑窗口时移除目标提示。
    function mdaClearRowHighlight(session) {
        session?.gridController?.root?.querySelectorAll("tr.selgrid-row-selected").forEach((row) => {
            row.classList.remove("selgrid-row-selected");
            row.setAttribute("aria-selected", "false");
        });
        if (session) {
            session.selectedRowId = null;
            session.selectedPrimaryKeyValues = null;
        }
    }

    /** 在当前结果表中高亮正在编辑的记录。 */
    function mdaHighlightRow(session, rowId) {
        session?.gridController?.root?.querySelectorAll("tr.selgrid-row-selected").forEach((row) => {
            row.classList.remove("selgrid-row-selected");
            row.setAttribute("aria-selected", "false");
        });
        const targetRow = session?.gridController?.root?.querySelector(`tr[data-sel-grid-record-id="${CSS.escape(String(rowId))}"]`);
        if (!targetRow) return false;
        targetRow.classList.add("selgrid-row-selected");
        targetRow.setAttribute("aria-selected", "true");
        session.selectedRowId = String(rowId);
        return true;
    }

    /** 按真实数据库字段名查找当前结果列。 */
    function mdaColumnByDatabaseName(session, databaseName) {
        return session.columns.find((column) => column.databaseName.toLowerCase() === String(databaseName).toLowerCase()) || null;
    }

    /** 从选中记录中提取更新接口需要的主键值。 */
    function mdaReadPrimaryKeyValues(session, record) {
        const primaryKeyValues = {};
        for (const primaryKey of session.editableTable?.primaryKeys || []) {
            const column = mdaColumnByDatabaseName(session, primaryKey);
            if (!column) return null;
            primaryKeyValues[primaryKey] = record[column.name];
        }
        return selFreeze(primaryKeyValues);
    }

    /** 根据主键快照在刷新后的结果中重新定位记录。 */
    function mdaFindRowIdByPrimaryKeys(session, primaryKeyValues) {
        const rowIndex = session.rows.findIndex((row) => Object.entries(primaryKeyValues || {}).every(([primaryKey, value]) => {
            const column = mdaColumnByDatabaseName(session, primaryKey);
            return column && String(row[column.name] ?? "") === String(value ?? "");
        }));
        return rowIndex < 0 ? null : String(rowIndex + 1);
    }

    /** 判断数据库字段是否适合使用多行编辑控件。 */
    function mdaIsTextAreaColumn(column) {
        return /(CHAR|TEXT|CLOB|JSON|XML)/i.test(column.typeName);
    }

    /** 根据可编辑列生成标准 Window 表单定义。 */
    function mdaBuildRowEditWindow(session, editableColumns, primaryKeyValues) {
        const target = Object.entries(primaryKeyValues).map(([name, value]) => `${name}=${value ?? "NULL"}`).join("，");
        return selFreeze({
            messages: mdaState.windowMessages,
            title: `编辑 ${session.editableTable.tableName} 数据`,
            subtitle: `目标记录：${target}`,
            closeLabel: "关闭数据编辑窗口", cancelLabel: "取消", submitLabel: "保存修改",
            validationMessage: "请检查字段值", autoSuccess: false,
            rows: editableColumns.map((column) => [{
                name: column.databaseName,
                label: column.databaseName,
                type: mdaIsTextAreaColumn(column) ? "textarea" : "text",
                icon: "ri-edit-box-line",
                placeholder: "请输入字段值"
            }])
        });
    }

    // 只有树上真实表查询且结果包含完整主键时才允许编辑；人工 SQL 始终保持只读。
    function mdaMarkSelectedEditField(windowId, selectedDatabaseName = "") {
        const windowShell = document.querySelector(`.selwindow-window-shell[data-sel-window-id="${CSS.escape(windowId)}"]`);
        if (!windowShell) return false;
        windowShell.querySelectorAll(".mda-row-edit-control-active").forEach((controlShell) => controlShell.classList.remove("mda-row-edit-control-active"));
        if (!selectedDatabaseName) return false;
        const selectedControl = windowShell.querySelector(`[name="${CSS.escape(selectedDatabaseName)}"]`);
        const selectedControlShell = selectedControl?.closest(".selwindow-control-shell");
        if (!selectedControl || !selectedControlShell) return false;
        selectedControlShell.classList.add("mda-row-edit-control-active");
        requestAnimationFrame(() => {
            if (!selectedControlShell.classList.contains("mda-row-edit-control-active")) return;
            selectedControl.focus({ preventScroll: true });
            selectedControl.closest(".selwindow-field-row")?.scrollIntoView({ block: "nearest" });
        });
        return true;
    }

    /** 打开记录编辑窗口，并优先聚焦用户双击的字段。 */
    function mdaOpenRowEditor(session, record, selectedDatabaseName = "") {
        if (mdaState.editingRowContext) {
            mdaState.editingRowContext.controller.close();
            mdaClearRowHighlight(mdaState.editingRowContext.session);
            mdaState.editingRowContext = null;
        }
        mdaHighlightRow(session, record._row);
        if (session.editableTable && session.sql.trim() !== session.editableQuerySql.trim()) {
            selBase.toast("当前 SQL 已改变，查询结果只读；重新从左侧数据表打开默认查询后可编辑。", "error");
            return false;
        }
        const primaryKeys = session.editableTable?.primaryKeys || [];
        if (primaryKeys.length === 0) {
            selBase.toast(session.editableTable ? "目标表没有主键，当前数据只读。" : "自定义 SQL 结果只读，请从左侧数据表打开查询后编辑。", "error");
            return false;
        }
        const primaryKeyValues = mdaReadPrimaryKeyValues(session, record);
        if (!primaryKeyValues) {
            selBase.toast("查询结果未包含完整主键，当前数据只读。", "error");
            return false;
        }
        const editableColumns = session.columns.filter((column) => !primaryKeys.some((primaryKey) => primaryKey.toLowerCase() === column.databaseName.toLowerCase()));
        if (editableColumns.length === 0) {
            selBase.toast("当前表除主键外没有可编辑字段。", "error");
            return false;
        }
        const windowKey = `${session.connectionId}|${session.editableTable.catalog}|${session.editableTable.schema}|${session.editableTable.tableName}|${editableColumns.map((column) => column.databaseName).join("|")}`;
        const windowId = `MdaRowEditWindow_${mdaStableKey(windowKey)}`;
        const windowOptions = mdaBuildRowEditWindow(session, editableColumns, primaryKeyValues);
        let windowController = mdaState.rowEditWindows.get(windowId);
        if (!windowController) {
            windowController = windowComponent.mount(mdaAppHost, { id: windowId, ...windowOptions });
            if (!windowController) throw new Error("MDA 数据编辑窗口挂载失败。");
            mdaState.rowEditWindows.set(windowId, windowController);
        }
        const originalValues = selFreeze(Object.fromEntries(editableColumns.map((column) => [column.databaseName, record[column.name]])));
        windowController.setLocale(windowOptions);
        windowController.reset();
        windowController.setValues(originalValues);
        const activeFieldName = editableColumns.some((column) => column.databaseName.toLowerCase() === String(selectedDatabaseName).toLowerCase())
            ? selectedDatabaseName
            : "";
        session.selectedPrimaryKeyValues = primaryKeyValues;
        mdaState.editingRowContext = selFreeze({
            session: session, windowId: windowId, controller: windowController,
            primaryKeyValues: primaryKeyValues, originalValues: originalValues,
            editableColumns: [...editableColumns]
        });
        windowController.open();
        mdaMarkSelectedEditField(windowId, activeFieldName);
        return true;
    }

    /** 保存记录修改，随后重新执行原查询并恢复行定位。 */
    async function mdaSaveEditedRow(values) {
        const context = mdaState.editingRowContext;
        if (!context) return false;
        context.controller.setLoading(true);
        try {
            const table = context.session.editableTable;
            // 原值为数据库 NULL 且用户没有输入内容时继续提交 null，避免仅打开保存就变成空字符串。
            const submittedValues = Object.fromEntries(Object.entries(values).map(([name, value]) => [
                name,
                value === "" && context.originalValues[name] === null ? null : value
            ]));
            const response = await selAjax.request({
                url: mdaApi.updateRow,
                method: "POST",
                data: {
                    connectionId: context.session.connectionId,
                    catalog: table.catalog,
                    schema: table.schema,
                    tableName: table.tableName,
                    primaryKeyValues: JSON.stringify(context.primaryKeyValues),
                    values: JSON.stringify(submittedValues)
                }
            });
            context.controller.close();
            mdaState.editingRowContext = null;
            context.session.selectedPrimaryKeyValues = context.primaryKeyValues;
            await mdaExecuteSql(context.session, context.session.sql);
            selBase.toast(response.msg || "数据更新完成。", "success");
            return true;
        } catch (error) {
            context.controller.setFeedback(error.message || "数据更新失败。", true);
            return false;
        } finally {
            context.controller.setLoading(false);
        }
    }

    /** 在指定页签会话上执行真实 SQL，并只刷新该页签自己的结果表格。 */
    async function mdaExecuteSql(session, sql) {
        const normalizedSql = String(sql || "").trim();
        if (!normalizedSql) throw new Error("请输入需要执行的 SQL。");
        const response = await selAjax.request({ url: mdaApi.execute, method: "POST", data: { connectionId: session.connectionId, sql: normalizedSql, autoCommit: true, maxRows: 1000, queryTimeoutSeconds: 30 } });
        const result = (response.data?.results || []).find((item) => item.kind === "resultSet") || response.data?.results?.[0];
        session.sql = normalizedSql;
        if (result?.kind === "resultSet") {
            session.columns = (result.columns || []).map((column, index) => ({
                name: `column${index}`,
                databaseName: String(column.name || column.label || ""),
                label: String(column.label || column.name || ""),
                typeName: String(column.typeName || ""),
                jdbcType: column.jdbcType,
                // 默认表查询把树中 JDBC 字段 COMMENT 传给全部动态表头；别名或表达式无匹配时保持空提示。
                remarks: String((session.editableTable?.columns || []).find((metadataColumn) =>
                    String(metadataColumn.label || "").toLowerCase() === String(column.name || column.label || "").toLowerCase()
                )?.remarks || "")
            }));
            session.rows = (result.rows || []).map((row) => Object.fromEntries(row.map((value, index) => [`column${index}`, value])));
        } else {
            session.columns = [{ name: "column0", label: "更新行数" }];
            session.rows = [{ column0: result?.updateCount ?? 0 }];
        }
        session.gridController.setLocale(mdaBuildPayload(session));
        if (session.selectedPrimaryKeyValues) {
            const selectedRowId = mdaFindRowIdByPrimaryKeys(session, session.selectedPrimaryKeyValues);
            if (selectedRowId) mdaHighlightRow(session, selectedRowId);
        }
        if (mdaState.tabsController.getState().activeId === session.id) mdaSyncPanel(mdaBuildPayload(session));
        return response;
    }

    /** 表节点单击时重置为该表默认查询并执行一次，不借用“执行选中 SQL”入口。 */
    async function mdaExecuteTableSelectionOnce(session, sql) {
        const tableSql = String(sql || "").trim();
        if (!tableSql || !session?.editorController || session.editorController.isLoading()) return false;
        session.editorController.setValue(tableSql);
        session.sql = tableSql;
        session.closeBaselineSql = tableSql;
        session.dirty = false;
        session.editorController.setLoading(true);
        try {
            const response = await mdaExecuteSql(session, tableSql);
            selBase.toast(response.msg || "表数据查询完成。", "success");
            return true;
        } catch (error) {
            selBase.toast(error.message || "表数据查询失败。", "error");
            return false;
        } finally {
            session.editorController.setLoading(false);
        }
    }

    // 页签内容完全由三个公共控件和独立 selGrid 组成；清理函数是关闭时的统一销毁入口。
    function mdaMountQuerySession(panel, session) {
        const splitController = splitPane.mount(panel, {
            id: session.splitId, direction: "vertical", ratio: 36, minRatio: 20, maxRatio: 70,
            startLabel: "SQL 编辑区", endLabel: "查询结果区", separatorLabel: "调整 SQL 编辑区和查询结果区高度"
        });
        if (!splitController) throw new Error("MDA SQL 分隔面板挂载失败。");
        const editorController = codeEditor.mount(splitController.start, {
            id: session.editorId, language: "sql", label: "SQL 查询", icon: "ri-terminal-box-line",
            value: session.sql, placeholder: "选中需要执行的 SQL，再点击执行或按 Ctrl/⌘ + Enter", statusText: "",
            shortcutLabel: "选中 SQL 后按 Ctrl/⌘ + Enter 执行",
            actions: [
                { id: "execute", label: "执行选中 SQL", icon: "ri-play-fill", primary: true }
            ]
        });
        const gridRoot = grid.create(splitController.end, { gridId: session.gridId, entity: "MdaQueryResult", ariaLabel: `${session.label} 查询结果` });
        const gridController = gridRoot ? grid.mount(gridRoot, mdaBuildPayload(session)) : null;
        const cellMenuController = gridController ? contextMenu.mount(gridController.root, {
            id: `${session.id}CellContextMenu`, ariaLabel: "查询结果单元格操作"
        }) : null;
        if (!editorController || !gridController || !cellMenuController) {
            cellMenuController?.destroy();
            gridController?.destroy();
            editorController?.destroy();
            splitController.destroy();
            throw new Error("MDA SQL 编辑器、结果表格或单元格菜单挂载失败。");
        }
        session.splitController = splitController;
        session.editorController = editorController;
        session.gridController = gridController;
        const handleEditorChange = (event) => {
            if (event.detail?.editorId !== session.editorId) return;
            session.dirty = String(event.detail.value || "") !== session.closeBaselineSql;
        };
        const handleEditorAction = async (event) => {
            if (event.detail?.editorId !== session.editorId) return;
            if (event.detail.action !== "execute") return;
            // 按钮和快捷键共享同一动作入口；没有有效选区时只提示，不允许把编辑器内多条 SQL 整体提交。
            const selectedSql = String(event.detail.selectedValue || editorController.getSelectedValue() || "").trim();
            if (!selectedSql) {
                selBase.toast("请先选中需要执行的 SQL。", "warning");
                return;
            }
            const sqlToExecute = selectedSql;
            editorController.setLoading(true);
            try {
                const response = await mdaExecuteSql(session, sqlToExecute);
                const editorSql = String(event.detail.value || "");
                // 只执行选区时其余编辑内容仍未执行，关闭提醒必须继续把两者识别为不同状态。
                session.closeBaselineSql = sqlToExecute.trim();
                session.dirty = editorSql.trim() !== session.closeBaselineSql;
                // SQL 结果已经进入下方表格，成功消息仅短时提示而不占用上下分区高度。
                selBase.toast(response.msg || "SQL 执行完成。", "success");
            } catch (error) {
                // 异常仍以警示 Toast 告知用户，加载状态由 finally 统一解除。
                selBase.toast(error.message || "SQL 执行失败。", "error");
            } finally {
                editorController.setLoading(false);
                // 选中 SQL 执行结束后恢复原选区，表格刷新不会抹掉用户正在处理的语句范围。
                if (selectedSql) editorController.restoreSelection();
            }
        };
        const handleGridDoubleClick = (event) => {
            const row = event.target.closest("tr[data-sel-grid-record-id]");
            if (!row || !gridController.root.contains(row)) return;
            const cell = event.target.closest("td");
            const selectedColumn = cell && row.contains(cell) ? session.columns[cell.cellIndex] : null;
            const rowIndex = Number(row.dataset.selGridRecordId) - 1;
            if (!Number.isInteger(rowIndex) || !session.rows[rowIndex]) return;
            try {
                mdaOpenRowEditor(session, { _row: rowIndex + 1, ...session.rows[rowIndex] }, selectedColumn?.databaseName || "");
            } catch (error) {
                selBase.toast(error.message || "数据编辑窗口打开失败。", "error");
            }
        };
        const handleGridContextMenu = (event) => {
            const row = event.target.closest("tr[data-sel-grid-record-id]");
            const cell = event.target.closest("td");
            if (!row || !cell || !row.contains(cell) || !gridController.root.contains(row)) return;
            const column = session.columns[cell.cellIndex];
            const rowIndex = Number(row.dataset.selGridRecordId) - 1;
            const metadataColumn = (session.editableTable?.columns || []).find((item) =>
                String(item.label || "").toLowerCase() === String(column?.databaseName || "").toLowerCase()
            );
            if (!column || !metadataColumn || !Number.isInteger(rowIndex) || !session.rows[rowIndex]) return;
            event.preventDefault();
            cellMenuController.open({
                clientX: event.clientX,
                clientY: event.clientY,
                restoreFocusTarget: cell,
                items: [
                    { id: "select-from-where", label: "Select From Where", icon: "ri-filter-3-line" }
                ],
                context: {
                    columnIndex: cell.cellIndex,
                    rowIndex: rowIndex,
                    value: session.rows[rowIndex][column.name]
                }
            });
        };
        const handleCellMenuAction = (event) => {
            if (event.detail?.menuId !== cellMenuController.id || event.detail.actionId !== "select-from-where") return;
            const context = event.detail.context || {};
            const column = session.columns[Number(context.columnIndex)];
            const row = session.rows[Number(context.rowIndex)];
            const selectedColumnKeys = gridController.getSelectedColumnKeys();
            const selectedColumns = selectedColumnKeys
                .map((columnKey) => session.columns.find((candidate) => candidate.name === columnKey))
                .filter(Boolean);
            // 没有勾选表头字段时保持现有单元格逻辑；有勾选时统一读取右键所在行的多字段值。
            const predicateColumns = selectedColumns.length > 0 ? selectedColumns : [column];
            const sql = mdaBuildSelectFromWhereSql(session, predicateColumns, row);
            if (!sql || !mdaAppendSqlQuery(editorController, sql)) {
                selBase.toast("无法为当前单元格生成查询。", "error");
                return;
            }
            const selectionDescription = selectedColumns.length > 0
                ? `${selectedColumns.length} 个勾选字段`
                : column.databaseName;
            selBase.toast(`已按 ${selectionDescription} 追加筛选查询。`, "success");
        };
        editorController.root.addEventListener("selCodeEditor:change", handleEditorChange);
        editorController.root.addEventListener("selCodeEditor:action", handleEditorAction);
        gridController.root.addEventListener("dblclick", handleGridDoubleClick);
        gridController.root.addEventListener("contextmenu", handleGridContextMenu);
        gridController.root.addEventListener("selContextMenu:action", handleCellMenuAction);
        return () => {
            editorController.root.removeEventListener("selCodeEditor:change", handleEditorChange);
            editorController.root.removeEventListener("selCodeEditor:action", handleEditorAction);
            gridController.root.removeEventListener("dblclick", handleGridDoubleClick);
            gridController.root.removeEventListener("contextmenu", handleGridContextMenu);
            gridController.root.removeEventListener("selContextMenu:action", handleCellMenuAction);
            if (mdaState.editingRowContext?.session === session) {
                mdaState.editingRowContext.controller.close();
                mdaState.editingRowContext = null;
            }
            cellMenuController.destroy();
            gridController.destroy();
            editorController.destroy();
            splitController.destroy();
            mdaState.querySessions.delete(session.id);
        };
    }

    // 同一表重复选择会激活既有页签并重新执行一次默认全表查询；新表或人工查询才创建动态实例。
    function mdaOpenQuerySession(definition, executeImmediately = false) {
        if (!mdaState.selectedConnection) return null;
        const sessionId = String(definition.id);
        const existingSession = mdaState.querySessions.get(sessionId);
        if (existingSession) {
            mdaState.tabsController.activate(sessionId);
            if (executeImmediately) void mdaExecuteTableSelectionOnce(existingSession, definition.sql);
            return existingSession;
        }
        const session = {
            id: sessionId,
            label: String(definition.label),
            qualifiedName: String(definition.qualifiedName || ""),
            connectionId: mdaState.selectedConnection.id,
            sql: String(definition.sql || ""),
            closeBaselineSql: String(definition.sql || ""), dirty: false,
            editableTable: definition.editableTable || null,
            editableQuerySql: definition.editableTable ? String(definition.sql || "") : "",
            selectedRowId: null, selectedPrimaryKeyValues: null,
            columns: [], rows: [],
            splitId: `${sessionId}SplitPane`, editorId: `${sessionId}CodeEditor`, gridId: `${sessionId}ResultGrid`,
            splitController: null, editorController: null, gridController: null
        };
        mdaState.querySessions.set(sessionId, session);
        try {
            mdaState.tabsController.open({
                id: sessionId, label: session.label, icon: definition.icon || "ri-table-2", closable: true,
                closeLabel: `关闭${session.label}查询页签`,
                mount: (panel) => mdaMountQuerySession(panel, session)
            });
        } catch (error) {
            mdaState.querySessions.delete(sessionId);
            throw error;
        }
        mdaSyncPanel(mdaBuildPayload(session));
        if (executeImmediately) void mdaExecuteTableSelectionOnce(session, definition.sql);
        return session;
    }

    /** 打开树节点对应的表查询页签。 */
    function mdaOpenTableQuery(filter) {
        const tableQuery = mdaBuildTableQuery(filter);
        const sessionId = `MdaTableQuery${mdaState.selectedConnection.id}_${mdaStableKey(`${filter.catalog}.${filter.schema}.${filter.tableName}`)}`;
        return mdaOpenQuerySession({ id: sessionId, label: tableQuery.label, qualifiedName: tableQuery.qualifiedName, sql: tableQuery.sql, editableTable: tableQuery.editableTable, icon: "ri-table-2" }, true);
    }

    // 只读字段表沿用 selGrid 标准 payload，不创建应用私有表格控件。
    function mdaBuildStructureGridPayload(gridId, columns, items, emptyText) {
        return selFreeze({
            grid: { mode: "records", horizontalScroll: true, columnResize: true, defaultColumnWidth: 150, idField: "_row", searchFields: [] },
            data: { items: items.map((item, index) => ({ _row: index + 1, ...item })), selectedIds: [] },
            column: { gridId, ariaLabel: emptyText, emptyText, items: columns.map((column) => ({ ...column, renderer: "text" })) },
            title: { messages: mdaGridMessages },
            pagination: { gridId, currentPage: 1, pageSize: Math.max(items.length, 20), totalCount: items.length, summaryAll: "共 {total} 条", summaryFiltered: "当前 {visible} 条 · 共 {total} 条", previousLabel: "上一页", nextLabel: "下一页", pageChangedMessage: "已切换到第 {page} 页", pageSizeChangedMessage: "每页显示 {size} 条" }
        });
    }

    /** 把 JDBC 类型、长度和小数位组合为可读类型名称。 */
    function mdaColumnTypeLabel(column) {
        const size = Number(column.size || 0);
        const digits = Number(column.decimalDigits || 0);
        if (!size) return String(column.typeName || "");
        return `${column.typeName || ""}(${size}${digits > 0 ? `,${digits}` : ""})`;
    }

    /** 在结构页签内挂载一个只读公共表格。 */
    function mdaMountStructureGrid(container, gridId, title, columns, items, emptyText) {
        const gridRoot = grid.create(container, { gridId, entity: "MdaTableStructure", ariaLabel: title });
        const gridController = gridRoot
            ? grid.mount(gridRoot, mdaBuildStructureGridPayload(gridId, columns, items, emptyText))
            : null;
        if (!gridController) throw new Error(`${title}表格挂载失败。`);
        return gridController;
    }

    // 表结构页签只挂载字段 selGrid；关闭页签时销毁控制器，避免组件注册和监听器残留。
    function mdaMountTableStructureViewer(panel, session) {
        const filter = session.filter;
        const columnItems = filter.columns.map((column) => ({
            name: column.label, remarks: column.remarks || "", dataType: mdaColumnTypeLabel(column),
            primaryKey: column.primaryKey ? "是" : "否", nullable: column.nullable ? "是" : "否",
            defaultValue: column.defaultValue ?? "", autoIncrement: column.autoIncrement ? "是" : "否",
            generated: column.generated ? "是" : "否"
        }));
        const gridController = mdaMountStructureGrid(panel, `${session.id}Columns`, "字段属性", [
                { id: "name", field: "name", label: "字段名", width: 150 },
                { id: "remarks", field: "remarks", label: "字段注释", width: 405 },
                { id: "dataType", field: "dataType", label: "数据类型", width: 267 },
                { id: "primaryKey", field: "primaryKey", label: "主键", width: 150 },
                { id: "nullable", field: "nullable", label: "允许空", width: 150 },
                { id: "defaultValue", field: "defaultValue", label: "默认值", width: 215 },
                { id: "autoIncrement", field: "autoIncrement", label: "自增", width: 150 },
                { id: "generated", field: "generated", label: "生成列", width: 150 }
            ], columnItems, "当前对象没有字段元数据");
        return () => {
            gridController.destroy();
            mdaState.structureSessions.delete(session.id);
        };
    }

    // 同一连接、Schema 和表名形成稳定 ID；重复查看只激活已有只读页签。
    function mdaOpenTableStructureViewer(filter) {
        if (!mdaState.selectedConnection) return null;
        const sessionId = `MdaTableStructureViewer${mdaState.selectedConnection.id}_${mdaStableKey(`${filter.catalog}.${filter.schema}.${filter.tableName}`)}`;
        if (mdaState.tabsController.has(sessionId)) {
            mdaState.tabsController.activate(sessionId);
            return mdaState.structureSessions.get(sessionId) || null;
        }
        const session = selFreeze({ id: sessionId, connectionId: mdaState.selectedConnection.id, filter: filter });
        mdaState.structureSessions.set(sessionId, session);
        try {
            mdaState.tabsController.open({
                id: sessionId, label: `结构 · ${filter.tableName}`, icon: "ri-layout-column-line", closable: true,
                closeLabel: `关闭${filter.tableName}结构页签`, mount: (panel) => mdaMountTableStructureViewer(panel, session)
            });
        } catch (error) {
            mdaState.structureSessions.delete(sessionId);
            throw error;
        }
        return session;
    }

    // 编辑动作只打开带安全占位符的 SQL 页签，用户明确补全语句并点击执行后才会修改目标库。
    function mdaOpenTableStructureEditor(filter) {
        const action = mdaBuildTableStructureAction(filter);
        const sessionId = `MdaTableStructure${mdaState.selectedConnection.id}_${mdaStableKey(`${filter.catalog}.${filter.schema}.${filter.tableName}`)}`;
        const sql = action.isView
            ? `-- 请按目标数据库语法填写 ${action.qualifiedName} 的 CREATE OR REPLACE VIEW 语句`
            : String(filter.structureEditSql || `ALTER TABLE ${action.tableName} ADD NEW_COLUMN VARCHAR(255);\n\nCOMMENT ON TABLE ${action.tableName} IS '';\nCOMMENT ON COLUMN ${action.tableName}.NEW_COLUMN IS '';`);
        return mdaOpenQuerySession({ id: sessionId, label: `编辑 ${action.label}`, qualifiedName: action.qualifiedName, sql: sql, icon: "ri-edit-line" });
    }

    /** 创建一个空白 SQL 查询页签。 */
    function mdaOpenAdHocQuery() {
        const sequence = mdaState.querySequence++;
        return mdaOpenQuerySession({ id: `MdaAdHocQuery${sequence}`, label: `SQL ${sequence}`, sql: "SELECT 1 AS ready", icon: "ri-terminal-box-line" });
    }

    /** 定义数据库连接新增与编辑窗口。 */
    function mdaBuildConnectionWindow() {
        return selFreeze({
            title: mdaState.editingConnectionId ? "编辑数据库连接" : "新增数据库连接",
            subtitle: "连接配置将明文保存到 MDA 本地控制库",
            closeLabel: "关闭数据库连接窗口", cancelLabel: "取消",
            submitLabel: mdaState.editingConnectionId ? "保存连接" : "新增连接",
            validationMessage: "请填写连接名称、数据库类型和数据库名", autoSuccess: false,
            rows: [
                [
                    { name: "connectionName", label: "连接名称", type: "text", icon: "ri-database-2-line", required: true, placeholder: "例如：本地开发库" },
                    { name: "databaseType", label: "数据库类型", type: "select", required: true, options: [
                        { value: "H2", label: "H2", icon: "ri-database-line", selected: true },
                        { value: "MYSQL", label: "MySQL", icon: "ri-database-line" },
                        { value: "POSTGRESQL", label: "PostgreSQL", icon: "ri-database-line" },
                        { value: "SQLSERVER", label: "SQL Server", icon: "ri-database-line" },
                        { value: "ORACLE", label: "Oracle", icon: "ri-database-line" }
                    ] }
                ],
                [
                    { name: "host", label: "主机", type: "text", icon: "ri-server-line", placeholder: "127.0.0.1" },
                    { name: "port", label: "端口", type: "number", icon: "ri-router-line", placeholder: "留空使用默认端口" }
                ],
                [{ name: "databaseName", label: "数据库名或 H2 路径", type: "text", icon: "ri-folder-3-line", required: true, placeholder: "例如：demo 或 file:/path/to/database" }],
                [
                    { name: "schemaName", label: "默认 Schema", type: "text", icon: "ri-folder-tree-line", placeholder: "例如：PUBLIC" },
                    { name: "username", label: "用户名", type: "text", icon: "ri-user-line", placeholder: "数据库账号" }
                ],
                [{ name: "password", label: "密码（明文保存）", type: "password", icon: "ri-lock-password-line", placeholder: "数据库密码" }],
                [{ name: "customJdbcUrl", label: "完整 JDBC URL", type: "text", icon: "ri-link", placeholder: "填写后优先使用，例如 jdbc:h2:file:/path/to/db" }],
                [{ name: "jdbcParameters", label: "JDBC 附加参数", type: "text", icon: "ri-settings-3-line", placeholder: "例如 useSSL=false" }],
                [
                    { name: "defaultAutoCommit", label: "自动提交", type: "select", required: true, options: [
                        { value: "true", label: "开启", icon: "ri-checkbox-circle-line", selected: true },
                        { value: "false", label: "关闭", icon: "ri-checkbox-blank-circle-line" }
                    ] },
                    { name: "sortnum", label: "排序", type: "number", icon: "ri-sort-asc", placeholder: "0" }
                ]
            ]
        });
    }

    /** 返回新建数据库连接的稳定默认值。 */
    function mdaEmptyConnectionValues() {
        return { connectionName: "", databaseType: "H2", host: "", port: "", databaseName: "", schemaName: "PUBLIC", username: "sa", password: "", customJdbcUrl: "", jdbcParameters: "", defaultAutoCommit: "true", sortnum: "0" };
    }

    // 创建工程窗口固定收集工程名和表名；同一工程再次提交时解释为新增业务表。
    function mdaBuildProjectWindow() {
        return selFreeze({
            title: "创建工程",
            subtitle: "首次创建完整工程；已有生成工程则追加一张业务表",
            closeLabel: "关闭创建工程窗口",
            cancelLabel: "取消",
            submitLabel: "创建",
            validationMessage: "请填写工程名和表名",
            autoSuccess: false,
            rows: [
                [
                    {
                        name: "projectName",
                        label: "工程名",
                        type: "text",
                        icon: "ri-folder-3-line",
                        required: true,
                        placeholder: "例如：japan"
                    },
                    {
                        name: "tableName",
                        label: "表名",
                        type: "text",
                        icon: "ri-table-2",
                        required: true,
                        placeholder: "例如：region"
                    }
                ]
            ]
        });
    }

    /** 读取并打开当前数据库连接的编辑窗口。 */
    async function mdaOpenSelectedConnectionEditor() {
        if (!mdaState.selectedConnection) return false;
        const detail = await selAjax.json({ url: `${mdaApi.connections}getById.htm?id=${mdaState.selectedConnection.id}` });
        mdaState.editingConnectionId = mdaState.selectedConnection.id;
        mdaState.connectionWindowController.setLocale(mdaBuildConnectionWindow());
        mdaState.connectionWindowController.reset();
        mdaState.connectionWindowController.setValues({ ...detail.data, defaultAutoCommit: String(detail.data.defaultAutoCommit), port: detail.data.port ?? "", sortnum: detail.data.sortnum ?? 0 });
        mdaState.connectionWindowController.open();
        return true;
    }

    /** 经公共确认框确认后删除当前数据库连接。 */
    async function mdaConfirmAndDeleteSelectedConnection() {
        const connection = mdaState.selectedConnection;
        if (!connection) return false;
        const confirmed = await mdaState.confirmDialogController.open({
            title: "删除数据库连接",
            message: "是否删除此连接配置？不会删除目标数据库。",
            target: connection.connectionName,
            icon: "ri-delete-bin-6-line",
            tone: "danger",
            confirmLabel: "确认删除",
            cancelLabel: "取消",
            closeLabel: "关闭删除连接确认框"
        });
        if (!confirmed) return false;
        try {
            const response = await selAjax.request({ url: `${mdaApi.connections}delete.htm`, method: "POST", data: { id: connection.id } });
            await mdaReloadConnections(undefined, true);
            selBase.toast(response.msg || `连接“${connection.connectionName}”已删除。`, "success");
            return true;
        } catch (error) {
            selBase.toast(error.message || "连接配置删除失败。", "error");
            return false;
        }
    }

    /** 经公共确认框确认后删除指定表或视图。 */
    async function mdaConfirmAndDeleteTable(filter) {
        if (!mdaState.selectedConnection) return false;
        const connectionId = mdaState.selectedConnection.id;
        const deleteTarget = mdaBuildTableStructureAction(filter);
        const objectLabel = deleteTarget.isView ? "视图" : "数据表";
        const confirmed = await mdaState.confirmDialogController.open({
            title: `删除${objectLabel}`,
            message: `是否永久删除此${objectLabel}？此操作无法撤销。`,
            target: deleteTarget.qualifiedName,
            icon: "ri-delete-bin-6-line",
            tone: "danger",
            confirmLabel: "确认删除",
            cancelLabel: "取消",
            closeLabel: `关闭删除${objectLabel}确认框`
        });
        if (!confirmed) return false;
        try {
            await selAjax.request({
                url: mdaApi.execute,
                method: "POST",
                data: { connectionId: connectionId, sql: deleteTarget.dropSql, autoCommit: true, maxRows: 1, queryTimeoutSeconds: 30 }
            });
            const stableTablePath = `${deleteTarget.catalog || ""}.${deleteTarget.schema || ""}.${deleteTarget.label}`;
            mdaState.tabsController.close(`MdaTableQuery${connectionId}_${mdaStableKey(stableTablePath)}`, { force: true });
            mdaState.tabsController.close(`MdaTableStructure${connectionId}_${mdaStableKey(stableTablePath)}`, { force: true });
            mdaState.tabsController.close(`MdaTableStructureViewer${connectionId}_${mdaStableKey(stableTablePath)}`, { force: true });
            await mdaRefreshSelectedMetadata();
            selBase.toast(`${objectLabel}“${deleteTarget.qualifiedName}”已删除。`, "success");
            return true;
        } catch (error) {
            selBase.toast(error.message || `${objectLabel}删除失败。`, "error");
            return false;
        }
    }

    // 导出接口只接收当前连接和树节点坐标；输出目录、文件命名、SQL 幂等性及原子回滚全部由后端门禁决定。
    async function mdaExportStartupSql(scope, filter = {}) {
        if (!mdaState.selectedConnection) throw new Error("请先选择数据库连接。");
        const isTableExport = scope === "table";
        const exportTarget = isTableExport
            ? `${filter.schema || "PUBLIC"}.${filter.tableName || ""}`
            : mdaState.selectedConnection.connectionName;
        const confirmed = await mdaState.confirmDialogController.open({
            title: isTableExport ? "导出表启动 SQL" : "导出数据库启动 SQL",
            message: isTableExport
                ? "将以当前表结构和全量数据覆盖同名 schema/data 启动 SQL，是否继续？"
                : "将以当前数据库全部物理表结构和全量数据覆盖对应启动 SQL，是否继续？",
            target: exportTarget,
            icon: "ri-download-cloud-2-line",
            tone: "warning",
            confirmLabel: "确认导出",
            cancelLabel: "取消",
            closeLabel: "关闭启动 SQL 导出确认框"
        });
        if (!confirmed) return false;
        const response = await selAjax.request({
            url: isTableExport ? mdaApi.exportTable : mdaApi.exportDatabase,
            method: "POST",
            data: {
                connectionId: mdaState.selectedConnection.id,
                catalog: filter.catalog || "",
                schema: filter.schema || "",
                ...(isTableExport ? { tableName: filter.tableName || "" } : {})
            }
        });
        const exportData = response.data || {};
        selBase.toast(
            `${response.msg || "启动 SQL 导出完成。"} ${exportData.tableCount || 0} 张表、${exportData.rowCount || 0} 行，目录：${exportData.outputDirectory || "db/sql"}`,
            "success"
        );
        return true;
    }

    // 页签关闭只在 SQL 相对最近一次初始值或成功执行值发生变化时确认；同一批关闭合并成一次提示。
    async function mdaCloseQuerySessions(sessionIds, options = {}) {
        const closableIds = Array.from(new Set(sessionIds || []))
            .map(String)
            .filter((sessionId) => mdaState.tabsController?.has(sessionId));
        if (!closableIds.length) return true;
        const dirtySessions = closableIds
            .map((sessionId) => mdaState.querySessions.get(sessionId))
            .filter((session) => session?.dirty);
        if (dirtySessions.length && !options.force) {
            if (mdaState.closeConfirmationPending) return false;
            mdaState.closeConfirmationPending = true;
            try {
                const confirmed = await mdaState.confirmDialogController.open({
                    title: "关闭未保存的 SQL",
                    message: dirtySessions.length === 1
                        ? "当前 SQL 已修改但尚未成功执行，关闭后修改内容将丢失。"
                        : `有 ${dirtySessions.length} 个页签包含未保存 SQL，关闭后修改内容将丢失。`,
                    target: dirtySessions.map((session) => session.label).join("、"),
                    icon: "ri-file-warning-line",
                    tone: "warning",
                    confirmLabel: "放弃修改并关闭",
                    cancelLabel: "继续编辑",
                    closeLabel: "关闭未保存 SQL 确认框"
                });
                if (!confirmed) return false;
            } finally {
                mdaState.closeConfirmationPending = false;
            }
        }
        closableIds.forEach((sessionId) => mdaState.tabsController.close(sessionId, { force: true }));
        return true;
    }

    // 页签右键批量关闭由应用一次性确认全部脏页签，避免公共控件逐个弹窗或只关闭首个页签。
    function mdaResolveContextCloseIds(actionId, targetId) {
        const tabIds = mdaState.tabsController?.list() || [];
        const targetIndex = tabIds.indexOf(String(targetId));
        if (actionId === "close-right") return targetIndex < 0 ? [] : tabIds.slice(targetIndex + 1);
        if (actionId === "close-others") return tabIds.filter((tabId) => tabId !== String(targetId));
        if (actionId === "close-all") return tabIds;
        return [];
    }

    // 同一连接结构刷新默认保留用户展开状态；首次加载或切换连接时重新挂载树以应用新连接的默认展开节点。
    async function mdaRefreshSelectedMetadata(resetTreeExpansion = false, connection = mdaState.selectedConnection) {
        if (!connection) return false;
        const response = await selAjax.request({ url: mdaApi.metadata, method: "POST", data: { connectionId: connection.id } });
        const metadata = response.data?.nodes || [];
        // 新连接元数据成功返回后再整体提交连接和树，避免失败时下拉框与旧树处于不同数据库。
        mdaState.selectedConnection = connection;
        mdaState.metadata = metadata;
        const payload = mdaBuildPayload();
        if (resetTreeExpansion) {
            mdaState.treeController?.destroy();
            mdaState.treeController = tree.mount(mdaState.panelRoot, payload.tree);
            if (!mdaState.treeController) throw new Error("MDA 数据库结构树重新挂载失败。");
        } else {
            mdaState.treeController.setLocale(payload.tree);
        }
        mdaSyncPanel(payload);
        return true;
    }

    // 切换连接时关闭并销毁旧连接的全部动态查询页签，再加载新连接元数据。
    async function mdaLoadMetadata(connection, forceCloseTabs = false) {
        const closed = await mdaCloseQuerySessions(mdaState.tabsController?.list() || [], { force: forceCloseTabs });
        if (!closed) return false;
        await mdaRefreshSelectedMetadata(true, connection);
        return true;
    }

    /** 重新加载连接清单，并选择指定连接或首个可用连接。 */
    async function mdaReloadConnections(preferredId, forceCloseTabs = false) {
        const connectionPage = await selAjax.json({ url: `${mdaApi.connections}getStore.htm` });
        mdaState.connections = connectionPage.records || [];
        const nextConnection = mdaState.connections.find((item) => String(item.id) === String(preferredId || "")) || mdaState.connections[0] || null;
        if (nextConnection) {
            return mdaLoadMetadata(nextConnection, forceCloseTabs);
        }
        const closed = await mdaCloseQuerySessions(mdaState.tabsController?.list() || [], { force: forceCloseTabs });
        if (!closed) return false;
        mdaState.selectedConnection = null;
        mdaState.metadata = [];
        const payload = mdaBuildPayload();
        mdaState.treeController.setLocale(payload.tree);
        mdaSyncPanel(payload);
        return true;
    }

    /** 按依赖顺序挂载 MDA 主面板、窗口、确认框和页面设置。 */
    async function mountApp() {
        // 窗口文案先加载；页面骨架仍在控制库请求前完成挂载，空连接时可立即新增。
        const windowMessages = await selAjax.json({ url: "/sel/components/window/i18n/zh-CN.json?v=20260807-mda-1" });
        mdaState.windowMessages = windowMessages;
        const payload = mdaBuildPayload();
        mdaState.panelRoot = panel.create(mdaAppHost, { gridId: mdaWorkspaceId, sourceId: mdaWorkspaceId, entity: "MdaQueryWorkspace", view: "database", layout: "single", structure: mdaLayout, ariaLabel: payload.title.ariaLabel });
        if (!mdaState.panelRoot || !panel.mount(mdaState.panelRoot, {
            view: payload,
            expandLeftLabel: payload.title.messages.expandLeftRegion,
            collapseLeftLabel: payload.title.messages.collapseLeftRegion,
            toolbar: mdaToolbarOptions
        })) throw new Error("MDA 公共面板挂载失败。");
        mdaState.treeController = tree.mount(mdaState.panelRoot, payload.tree);
        dropdown.mountAll(mdaState.panelRoot);
        const tabsHost = panel.getComponent(mdaWorkspaceId, "selTabs");
        mdaState.tabsController = tabs.mount(tabsHost, { id: mdaTabsId, ariaLabel: "数据库查询页签", tabListLabel: "已打开的数据库查询", emptyIcon: "ri-terminal-window-line", emptyTitle: "选择数据表开始查询", emptyDescription: "左侧选择表后，将在这里打开 SQL 编辑区和查询结果" });
        mdaState.connectionWindowController = windowComponent.mount(mdaAppHost, { id: "MdaConnectionWindow", messages: windowMessages, ...mdaBuildConnectionWindow() });
        mdaState.projectWindowController = windowComponent.mount(mdaAppHost, { id: "MdaProjectWindow", messages: windowMessages, ...mdaBuildProjectWindow() });
        mdaState.confirmDialogController = confirmDialog.mount(mdaAppHost, { id: "MdaDeleteConfirmDialog", title: "删除确认", tone: "danger" });
        if (!mdaState.treeController || !mdaState.tabsController || !mdaState.connectionWindowController || !mdaState.projectWindowController || !mdaState.confirmDialogController) throw new Error("MDA 公共业务组件挂载失败。");

        // 单个关闭按钮和 Delete 键通过 beforeClose 暂停；确认后使用 force 只重放当前关闭动作。
        mdaState.tabsController.root.addEventListener("selTabs:beforeClose", (event) => {
            const session = mdaState.querySessions.get(String(event.detail?.tabId || ""));
            if (!session?.dirty) return;
            event.preventDefault();
            void mdaCloseQuerySessions([session.id]);
        });
        // 截获公共 Tab 的批量右键关闭动作，由 MDA 合并检查全部未保存 SQL 后再统一关闭。
        mdaState.tabsController.root.addEventListener("selContextMenu:action", (event) => {
            if (event.detail?.menuId !== `${mdaTabsId}:tab-actions`) return;
            const actionId = String(event.detail.actionId || "");
            if (!["close-right", "close-others", "close-all"].includes(actionId)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const closeIds = mdaResolveContextCloseIds(actionId, event.detail.context?.tabId);
            void mdaCloseQuerySessions(closeIds);
        }, true);

        // 面板命令只负责连接窗口和新建查询，SQL 执行由当前页签编辑器自己的动作事件承接。
        mdaState.panelRoot.addEventListener("click", async (event) => {
            const command = event.target.closest("[data-panel-command]")?.dataset.panelCommand;
            if (command === "connection-add") {
                mdaState.editingConnectionId = null;
                mdaState.connectionWindowController.setLocale(mdaBuildConnectionWindow());
                mdaState.connectionWindowController.reset();
                mdaState.connectionWindowController.setValues(mdaEmptyConnectionValues());
                mdaState.connectionWindowController.open();
            }
            if (command === "project-create") {
                mdaState.projectWindowController.reset();
                mdaState.projectWindowController.setValues({ projectName: "", tableName: "" });
                mdaState.projectWindowController.open();
            }
            if (command === "connection-edit" && mdaState.selectedConnection) {
                await mdaOpenSelectedConnectionEditor();
            }
            if (command === "connection-delete" && mdaState.selectedConnection) {
                await mdaConfirmAndDeleteSelectedConnection();
            }
            if (command === "query-new" && mdaState.selectedConnection) mdaOpenAdHocQuery();
        });
        mdaState.panelRoot.addEventListener("selTree:select", (event) => {
            if (event.detail?.filter?.nodeType !== "table") return;
            try {
                mdaOpenTableQuery(event.detail.filter);
            } catch (error) {
                console.error("MDA 数据表查询页签打开失败。", error);
            }
        });
        // 公共树只上报动作；连接配置、目标库 DDL 和剪贴板副作用全部留在 MDA 装配层。
        mdaState.panelRoot.addEventListener("selTree:contextAction", async (event) => {
            const action = event.detail?.action;
            const filter = event.detail?.filter || {};
            try {
                if (action === "connection-edit") await mdaOpenSelectedConnectionEditor();
                if (action === "connection-delete") await mdaConfirmAndDeleteSelectedConnection();
                if (action === "database-export") await mdaExportStartupSql("database", filter);
                if (action === "table-inspect") mdaOpenTableStructureViewer(filter);
                if (action === "table-export") await mdaExportStartupSql("table", filter);
                if (action === "table-edit") mdaOpenTableStructureEditor(filter);
                if (action === "table-delete") await mdaConfirmAndDeleteTable(filter);
                if (action === "copy-label") {
                    const copied = await selBase.copyText(event.detail?.label || "");
                    selBase.toast(copied ? `已复制“${event.detail.label}”。` : "复制失败，请检查浏览器是否允许访问剪贴板。", copied ? "success" : "error");
                }
            } catch (error) {
                selBase.toast(error.message || "右键菜单操作失败。", "error");
            }
        });
        // 切换仅隐藏非活动页签，关闭事件则在子清理完成后刷新计数。
        mdaState.tabsController.root.addEventListener("selTabs:change", () => mdaSyncPanel(mdaBuildPayload()));
        mdaState.tabsController.root.addEventListener("selTabs:close", () => mdaSyncPanel(mdaBuildPayload()));

        mdaAppHost.addEventListener("selWindow:submit", async (event) => {
            if (event.detail?.id === mdaState.editingRowContext?.windowId) {
                await mdaSaveEditedRow(event.detail.values);
                return;
            }
            if (event.detail?.id === "MdaConnectionWindow") {
                mdaState.connectionWindowController.setLoading(true);
                try {
                    const url = mdaState.editingConnectionId ? `${mdaApi.connections}update.htm` : `${mdaApi.connections}create.htm`;
                    const values = mdaState.editingConnectionId ? { ...event.detail.values, id: mdaState.editingConnectionId } : event.detail.values;
                    const response = await selAjax.request({ url: url, method: "POST", data: values });
                    const savedId = response.data?.id || mdaState.editingConnectionId;
                    mdaState.connectionWindowController.setFeedback(response.msg || "连接配置保存完成。");
                    mdaState.connectionWindowController.close();
                    await mdaReloadConnections(savedId);
                } catch (error) {
                    mdaState.connectionWindowController.setFeedback(error.message || "连接配置保存失败。", true);
                } finally {
                    mdaState.connectionWindowController.setLoading(false);
                }
                return;
            }
            if (event.detail?.id === "MdaProjectWindow") {
                const projectValues = event.detail.values || {};
                const projectConfirmed = await mdaState.confirmDialogController.open({
                    title: "创建工程并生成业务文件",
                    message: "该操作会一次性创建工程、后端分层、页面、启动 SQL 和中央登记，是否继续？",
                    target: `工程：${projectValues.projectName || ""}；表：${projectValues.tableName || ""}`,
                    icon: "ri-folder-add-line",
                    tone: "warning",
                    confirmLabel: "确认创建",
                    cancelLabel: "返回检查",
                    closeLabel: "关闭跨文件创建确认框"
                });
                if (!projectConfirmed) return;
                mdaState.projectWindowController.setLoading(true);
                try {
                    const response = await selAjax.request({
                        url: mdaApi.projects,
                        method: "POST",
                        data: projectValues
                    });
                    const pageUrl = response.data?.pageUrl || "";
                    const message = (response.msg || "工程创建完成。")
                        + (pageUrl ? " 重启平台后访问 " + pageUrl : "");
                    mdaState.projectWindowController.setFeedback(message);
                    selBase.toast(message, "success");
                } catch (error) {
                    mdaState.projectWindowController.setFeedback(error.message || "工程创建失败。", true);
                } finally {
                    mdaState.projectWindowController.setLoading(false);
                }
                return;
            }
        });
        // 公共窗口会先执行关闭，再把 click 或 Escape 冒泡到应用；此处同步清除被取消编辑的行标色。
        const clearClosedRowEditor = () => queueMicrotask(() => {
            const context = mdaState.editingRowContext;
            if (!context || context.controller.getState().open) return;
            mdaClearRowHighlight(context.session);
            mdaState.editingRowContext = null;
        });
        mdaAppHost.addEventListener("click", clearClosedRowEditor);
        mdaAppHost.addEventListener("keydown", (event) => {
            if (event.key === "Escape") clearClosedRowEditor();
        });
        const connectionSelect = mdaState.panelRoot.querySelector('[data-sel-grid-role="type-filter"]');
        connectionSelect?.addEventListener("change", async () => {
            const connection = mdaState.connections.find((item) => String(item.id) === connectionSelect.value);
            if (!connection) return;
            const previousConnection = mdaState.selectedConnection;
            try {
                const loaded = await mdaLoadMetadata(connection);
                if (!loaded) dropdown.setValue(connectionSelect, String(previousConnection?.id || ""));
            } catch (error) {
                dropdown.setValue(connectionSelect, String(previousConnection?.id || ""));
                selBase.toast(error.message || "数据库连接切换失败。", "error");
            }
        });
        // 公共工作区已经可操作后再异步读取控制库配置与目标库元数据。
        try {
            await mdaReloadConnections();
        } catch (error) {
            console.error("MDA 连接配置加载失败。", error);
        }
    }

    const mdaBackgroundController = pageBackground.mount(mdaBackgroundHost, { defaults: { theme: "solid-dark", overlay: 0, brightness: 100, blur: 0 } });
    if (!mdaBackgroundController) throw new Error("MDA 页面背景挂载失败。");
    if (!personalization.mount(mdaPersonalizationHost, { backgroundController: mdaBackgroundController })) throw new Error("MDA 个性化设置挂载失败。");
    mountApp().catch((error) => { console.error("MDA 初始化失败。", error); throw error; });
})();
