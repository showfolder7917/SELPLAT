/*
 * mda.js：MDA 数据库工作台应用装配层。
 * 负责调用真实连接、元数据和 SQL 接口，并组合公共树、页签、分隔面板、代码编辑器、表格与窗口。
 */
(function mdaInitializeApplication() {
    "use strict";

    const mdaRequiredComponents = Object.freeze([
        "selBaseRuntime", "selAjax", "selPanel", "selTooltip", "selTree", "selDropdownMenu", "selGrid", "selContextMenu", "selTabs",
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
        projects: "/api/mda/projects/create.htm",
        metadata: "/api/mda/metadata/tree.htm",
        execute: "/api/mda/sql/execute.htm",
        updateRow: "/api/mda/data/update-row.htm",
        exportTable: "/api/mda/export/table.htm",
        exportDatabase: "/api/mda/export/database.htm"
    });
    const mdaState = {
        connections: [], selectedConnection: null, metadata: [], panelRoot: null,
        treeController: null, tabsController: null, querySessions: new Map(), structureSessions: new Map(), querySequence: 1,
        connectionWindowController: null, projectWindowController: null,
        confirmDialogController: null, editingConnectionId: null,
        rowEditWindows: new Map(), editingRowContext: null, windowMessages: null,
        closeConfirmationPending: false
    };
    // 所有 MDA selGrid 实例消费同一份公共消息契约，避免动态页签只传数据列而遗漏 title.messages。
    const mdaGridMessages = Object.freeze({
        selectProject: "选择记录", viewProject: "查看记录", editProject: "编辑记录", moreActions: "更多操作",
        filtersReset: "查询筛选已重置", treePrefix: "数据库对象", expandLeftRegion: "展开数据库结构",
        collapseLeftRegion: "收起数据库结构", filterActivated: "查询搜索已激活", newOpened: "已打开 SQL 查询页签",
        exportPreparing: "操作已触发", dateRange: "日期范围：{start} 至 {end}", movePrefix: "移动到"
    });

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
    // 数据库连接栏使用公共面板栏目缩放契约；MDA 只声明安全宽度，不接触分隔线 DOM 或指针事件。
    const mdaToolbarOptions = Object.freeze({
        columnResize: true,
        columns: Object.freeze({
            projectType: Object.freeze({
                width: 360,
                minWidth: 240,
                maxWidth: 720,
                label: "调整数据库连接栏目宽度"
            })
        })
    });

    /** 把 JDBC 元数据节点转换为 selTree 标准节点，并保留打开表查询页签所需的稳定字段。 */
    function mdaMapMetadataNodes(mdaNodes, mdaPath) {
        return (mdaNodes || []).map((mdaNode, mdaIndex) => {
            const mdaNodePath = `${mdaPath}-${mdaIndex}-${mdaNode.type}-${mdaNode.label}`;
            const mdaChildren = mdaMapMetadataNodes(mdaNode.children, mdaNodePath);
            const mdaIcons = { catalog: "ri-database-2-line", schema: "ri-folder-3-line", table: "ri-table-2", column: "ri-key-2-line" };
            const mdaIsView = String(mdaNode.tableType || "").toUpperCase().includes("VIEW");
            // 数据库目录与业务 PUBLIC Schema 默认展开；系统 Schema、表和字段保持折叠。
            const mdaSchemaName = String(mdaNode.schema || mdaNode.label || "").trim().toUpperCase();
            const mdaDefaultExpanded = mdaNode.type === "catalog"
                || (mdaNode.type === "schema" && mdaSchemaName === "PUBLIC");
            // 目录节点代表当前连接中的数据库，表或视图节点承接真实目标库结构动作。
            const mdaContextActions = mdaNode.type === "catalog"
                ? Object.freeze([
                    Object.freeze({ id: "connection-edit", label: "编辑连接", icon: "ri-edit-line" }),
                    Object.freeze({ id: "connection-delete", label: "删除连接", icon: "ri-delete-bin-6-line", danger: true }),
                    Object.freeze({ id: "copy-label", label: "复制名称", icon: "ri-file-copy-line" }),
                    Object.freeze({ id: "database-export", label: "导出整个数据库", icon: "ri-download-cloud-2-line" })
                ])
                : mdaNode.type === "table"
                    ? Object.freeze([
                        Object.freeze({ id: "table-inspect", label: mdaIsView ? "查看视图结构" : "查看表结构", icon: "ri-layout-column-line" }),
                        Object.freeze({ id: "table-edit", label: mdaIsView ? "编辑视图定义" : "编辑表结构", icon: "ri-edit-line" }),
                        Object.freeze({ id: "table-delete", label: mdaIsView ? "删除视图" : "删除表", icon: "ri-delete-bin-6-line", danger: true }),
                        Object.freeze({ id: "copy-label", label: mdaIsView ? "复制视图名" : "复制表名", icon: "ri-file-copy-line" }),
                        ...(!mdaIsView ? [Object.freeze({ id: "table-export", label: "导出表", icon: "ri-download-2-line" })] : [])
                    ])
                    : Object.freeze([]);
            return Object.freeze({
                id: mdaNodePath,
                type: mdaNode.type,
                label: mdaNode.type === "column" && mdaNode.typeName ? `${mdaNode.label} · ${mdaNode.typeName}` : mdaNode.label,
                icon: mdaIcons[mdaNode.type] || "ri-circle-line",
                count: mdaChildren.length,
                expanded: mdaDefaultExpanded,
                filter: Object.freeze({
                    nodeType: mdaNode.type,
                    catalog: mdaNode.catalog || "",
                    schema: mdaNode.schema || "",
                    tableName: mdaNode.tableName || "",
                    tableType: mdaNode.tableType || "",
                    structureEditSql: mdaNode.structureEditSql || "",
                    primaryKeys: Object.freeze([...(mdaNode.primaryKeys || [])]),
                    columns: Object.freeze((mdaNode.children || []).map((mdaColumn) => Object.freeze({ ...mdaColumn })))
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
            ? mdaColumns.map((mdaColumn) => Object.freeze({
                id: mdaColumn.name,
                field: mdaColumn.name,
                label: mdaColumn.label,
                renderer: "text",
                tooltip: mdaColumn.remarks,
                // 只有能映射回当前真实表字段的结果列才允许进入多字段 WHERE 条件。
                headerSelectable: Boolean((mdaSession?.editableTable?.columns || []).find((mdaMetadataColumn) =>
                    String(mdaMetadataColumn.label || "").toLowerCase() === String(mdaColumn.databaseName || "").toLowerCase()
                ))
            }))
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
                    Object.freeze({ id: "project-create", label: "创建工程", icon: "ri-folder-add-line" }),
                    ...(mdaState.selectedConnection ? [
                        Object.freeze({ id: "connection-edit", label: "编辑连接", icon: "ri-edit-line" }),
                        Object.freeze({ id: "connection-delete", label: "删除连接", icon: "ri-delete-bin-6-line" }),
                        Object.freeze({ id: "query-new", label: "新建查询", icon: "ri-terminal-box-line" })
                    ] : [])
                ]),
                resetLabel: "重置",
                messages: mdaGridMessages
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

    // 不同数据库按各自标识符规则生成默认 SELECT，实际可执行范围由目标数据库账号决定。
    function mdaQuoteIdentifier(mdaIdentifier, mdaType) {
        if (mdaType === "MYSQL") return `\`${String(mdaIdentifier).replaceAll("`", "``")}\``;
        if (mdaType === "SQLSERVER") return "[" + String(mdaIdentifier).replaceAll("]", "]]" ) + "]";
        return `"${String(mdaIdentifier).replaceAll('"', '""')}"`;
    }

    // JDBC 数值和布尔类型保持原生字面量，其余值使用单引号并转义内部单引号。
    function mdaFormatWhereValue(mdaColumn, mdaValue) {
        if (mdaValue === null || mdaValue === undefined) return null;
        const mdaUnquotedJdbcTypes = new Set([-7, -6, -5, 2, 3, 4, 5, 6, 7, 8, 16]);
        if (mdaUnquotedJdbcTypes.has(Number(mdaColumn.jdbcType))) {
            if (Number(mdaColumn.jdbcType) === 16 || Number(mdaColumn.jdbcType) === -7) {
                return String(mdaValue).toLowerCase() === "true" || mdaValue === 1 ? "TRUE" : "FALSE";
            }
            return String(mdaValue);
        }
        return `'${String(mdaValue).replaceAll("'", "''")}'`;
    }

    // 单个真实字段和值生成独立谓词；NULL 必须使用 IS NULL，不能错误拼成 = NULL。
    function mdaBuildWherePredicate(mdaColumn, mdaValue) {
        const mdaColumnName = String(mdaColumn?.databaseName || "").trim();
        if (!mdaColumnName) return "";
        const mdaFormattedValue = mdaFormatWhereValue(mdaColumn, mdaValue);
        return mdaFormattedValue === null
            ? `${mdaColumnName} IS NULL`
            : `${mdaColumnName} = ${mdaFormattedValue}`;
    }

    // 右键筛选 SQL 使用当前右键行；多个已勾选字段逐行用 AND 连接，未勾选时由调用方传入当前单字段。
    function mdaBuildSelectFromWhereSql(mdaSession, mdaColumns, mdaRow) {
        const mdaTableName = String(mdaSession.editableTable?.tableName || "").trim();
        const mdaPredicates = (Array.isArray(mdaColumns) ? mdaColumns : [])
            .map((mdaColumn) => mdaBuildWherePredicate(mdaColumn, mdaRow?.[mdaColumn.name]))
            .filter(Boolean);
        if (!mdaTableName || mdaPredicates.length === 0) return "";
        return `SELECT * FROM ${mdaTableName}\nWHERE ${mdaPredicates.join("\n  AND ")}`;
    }

    // 每条右键查询作为独立语句追加；已有 SQL 未带分号时先补分号，再保留一个空行分隔。
    function mdaAppendSqlQuery(mdaEditorController, mdaSql) {
        const mdaCurrentSql = String(mdaEditorController.getValue() || "");
        const mdaCurrentSqlTrimmed = mdaCurrentSql.trimEnd();
        const mdaSeparator = mdaCurrentSqlTrimmed
            ? `${mdaCurrentSqlTrimmed.endsWith(";") ? "" : ";"}\n\n`
            : "";
        return mdaEditorController.appendValue(`${mdaSeparator}${mdaSql}`);
    }

    function mdaBuildTableQuery(mdaFilter) {
        const mdaType = String(mdaState.selectedConnection?.databaseType || "").toUpperCase();
        const mdaParts = [mdaFilter.schema, mdaFilter.tableName].filter(Boolean).map((mdaPart) => mdaQuoteIdentifier(mdaPart, mdaType));
        // 默认查询只使用树节点中的真实表名，不再附加 schema 或数据库标识符引号。
        return Object.freeze({
            label: mdaFilter.tableName,
            qualifiedName: mdaParts.join("."),
            sql: `SELECT * FROM ${mdaFilter.tableName}`,
            editableTable: Object.freeze({
                catalog: mdaFilter.catalog || "",
                schema: mdaFilter.schema || "",
                tableName: mdaFilter.tableName || "",
                primaryKeys: Object.freeze([...(mdaFilter.primaryKeys || [])]),
                // 表查询会话保留当前表全部 JDBC 字段元数据，执行结果按字段名取得 COMMENT。
                columns: Object.freeze((mdaFilter.columns || []).map((mdaColumn) => Object.freeze({ ...mdaColumn })))
            })
        });
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

    // 行标色完全限定在当前 MDA 查询表格，取消或关闭编辑窗口时移除目标提示。
    function mdaClearRowHighlight(mdaSession) {
        mdaSession?.gridController?.root?.querySelectorAll("tr.selgrid-row-selected").forEach((mdaRow) => {
            mdaRow.classList.remove("selgrid-row-selected");
            mdaRow.setAttribute("aria-selected", "false");
        });
        if (mdaSession) {
            mdaSession.selectedRowId = null;
            mdaSession.selectedPrimaryKeyValues = null;
        }
    }

    function mdaHighlightRow(mdaSession, mdaRowId) {
        mdaSession?.gridController?.root?.querySelectorAll("tr.selgrid-row-selected").forEach((mdaRow) => {
            mdaRow.classList.remove("selgrid-row-selected");
            mdaRow.setAttribute("aria-selected", "false");
        });
        const mdaTargetRow = mdaSession?.gridController?.root?.querySelector(`tr[data-sel-grid-record-id="${CSS.escape(String(mdaRowId))}"]`);
        if (!mdaTargetRow) return false;
        mdaTargetRow.classList.add("selgrid-row-selected");
        mdaTargetRow.setAttribute("aria-selected", "true");
        mdaSession.selectedRowId = String(mdaRowId);
        return true;
    }

    function mdaColumnByDatabaseName(mdaSession, mdaDatabaseName) {
        return mdaSession.columns.find((mdaColumn) => mdaColumn.databaseName.toLowerCase() === String(mdaDatabaseName).toLowerCase()) || null;
    }

    function mdaReadPrimaryKeyValues(mdaSession, mdaRecord) {
        const mdaPrimaryKeyValues = {};
        for (const mdaPrimaryKey of mdaSession.editableTable?.primaryKeys || []) {
            const mdaColumn = mdaColumnByDatabaseName(mdaSession, mdaPrimaryKey);
            if (!mdaColumn) return null;
            mdaPrimaryKeyValues[mdaPrimaryKey] = mdaRecord[mdaColumn.name];
        }
        return Object.freeze(mdaPrimaryKeyValues);
    }

    function mdaFindRowIdByPrimaryKeys(mdaSession, mdaPrimaryKeyValues) {
        const mdaRowIndex = mdaSession.rows.findIndex((mdaRow) => Object.entries(mdaPrimaryKeyValues || {}).every(([mdaPrimaryKey, mdaValue]) => {
            const mdaColumn = mdaColumnByDatabaseName(mdaSession, mdaPrimaryKey);
            return mdaColumn && String(mdaRow[mdaColumn.name] ?? "") === String(mdaValue ?? "");
        }));
        return mdaRowIndex < 0 ? null : String(mdaRowIndex + 1);
    }

    function mdaIsTextAreaColumn(mdaColumn) {
        return /(CHAR|TEXT|CLOB|JSON|XML)/i.test(mdaColumn.typeName);
    }

    function mdaBuildRowEditWindow(mdaSession, mdaEditableColumns, mdaPrimaryKeyValues) {
        const mdaTarget = Object.entries(mdaPrimaryKeyValues).map(([mdaName, mdaValue]) => `${mdaName}=${mdaValue ?? "NULL"}`).join("，");
        return Object.freeze({
            messages: mdaState.windowMessages,
            title: `编辑 ${mdaSession.editableTable.tableName} 数据`,
            subtitle: `目标记录：${mdaTarget}`,
            closeLabel: "关闭数据编辑窗口", cancelLabel: "取消", submitLabel: "保存修改",
            validationMessage: "请检查字段值", autoSuccess: false,
            rows: Object.freeze(mdaEditableColumns.map((mdaColumn) => Object.freeze([Object.freeze({
                name: mdaColumn.databaseName,
                label: mdaColumn.databaseName,
                type: mdaIsTextAreaColumn(mdaColumn) ? "textarea" : "text",
                icon: "ri-edit-box-line",
                placeholder: "请输入字段值"
            })])))
        });
    }

    // 只有树上真实表查询且结果包含完整主键时才允许编辑；人工 SQL 始终保持只读。
    function mdaMarkSelectedEditField(mdaWindowId, mdaSelectedDatabaseName = "") {
        const mdaWindowShell = document.querySelector(`.selwindow-window-shell[data-sel-window-id="${CSS.escape(mdaWindowId)}"]`);
        if (!mdaWindowShell) return false;
        mdaWindowShell.querySelectorAll(".mda-row-edit-control-active").forEach((mdaControlShell) => mdaControlShell.classList.remove("mda-row-edit-control-active"));
        if (!mdaSelectedDatabaseName) return false;
        const mdaSelectedControl = mdaWindowShell.querySelector(`[name="${CSS.escape(mdaSelectedDatabaseName)}"]`);
        const mdaSelectedControlShell = mdaSelectedControl?.closest(".selwindow-control-shell");
        if (!mdaSelectedControl || !mdaSelectedControlShell) return false;
        mdaSelectedControlShell.classList.add("mda-row-edit-control-active");
        requestAnimationFrame(() => {
            if (!mdaSelectedControlShell.classList.contains("mda-row-edit-control-active")) return;
            mdaSelectedControl.focus({ preventScroll: true });
            mdaSelectedControl.closest(".selwindow-field-row")?.scrollIntoView({ block: "nearest" });
        });
        return true;
    }

    function mdaOpenRowEditor(mdaSession, mdaRecord, mdaSelectedDatabaseName = "") {
        if (mdaState.editingRowContext) {
            mdaState.editingRowContext.controller.close();
            mdaClearRowHighlight(mdaState.editingRowContext.session);
            mdaState.editingRowContext = null;
        }
        mdaHighlightRow(mdaSession, mdaRecord._row);
        if (mdaSession.editableTable && mdaSession.sql.trim() !== mdaSession.editableQuerySql.trim()) {
            mdaBase.toast("当前 SQL 已改变，查询结果只读；重新从左侧数据表打开默认查询后可编辑。", "error");
            return false;
        }
        const mdaPrimaryKeys = mdaSession.editableTable?.primaryKeys || [];
        if (mdaPrimaryKeys.length === 0) {
            mdaBase.toast(mdaSession.editableTable ? "目标表没有主键，当前数据只读。" : "自定义 SQL 结果只读，请从左侧数据表打开查询后编辑。", "error");
            return false;
        }
        const mdaPrimaryKeyValues = mdaReadPrimaryKeyValues(mdaSession, mdaRecord);
        if (!mdaPrimaryKeyValues) {
            mdaBase.toast("查询结果未包含完整主键，当前数据只读。", "error");
            return false;
        }
        const mdaEditableColumns = mdaSession.columns.filter((mdaColumn) => !mdaPrimaryKeys.some((mdaPrimaryKey) => mdaPrimaryKey.toLowerCase() === mdaColumn.databaseName.toLowerCase()));
        if (mdaEditableColumns.length === 0) {
            mdaBase.toast("当前表除主键外没有可编辑字段。", "error");
            return false;
        }
        const mdaWindowKey = `${mdaSession.connectionId}|${mdaSession.editableTable.catalog}|${mdaSession.editableTable.schema}|${mdaSession.editableTable.tableName}|${mdaEditableColumns.map((mdaColumn) => mdaColumn.databaseName).join("|")}`;
        const mdaWindowId = `MdaRowEditWindow_${mdaStableKey(mdaWindowKey)}`;
        const mdaWindowOptions = mdaBuildRowEditWindow(mdaSession, mdaEditableColumns, mdaPrimaryKeyValues);
        let mdaWindowController = mdaState.rowEditWindows.get(mdaWindowId);
        if (!mdaWindowController) {
            mdaWindowController = window.selWindow.mount(mdaApplicationHost, { id: mdaWindowId, ...mdaWindowOptions });
            if (!mdaWindowController) throw new Error("MDA 数据编辑窗口挂载失败。");
            mdaState.rowEditWindows.set(mdaWindowId, mdaWindowController);
        }
        const mdaOriginalValues = Object.freeze(Object.fromEntries(mdaEditableColumns.map((mdaColumn) => [mdaColumn.databaseName, mdaRecord[mdaColumn.name]])));
        mdaWindowController.setLocale(mdaWindowOptions);
        mdaWindowController.reset();
        mdaWindowController.setValues(mdaOriginalValues);
        const mdaActiveFieldName = mdaEditableColumns.some((mdaColumn) => mdaColumn.databaseName.toLowerCase() === String(mdaSelectedDatabaseName).toLowerCase())
            ? mdaSelectedDatabaseName
            : "";
        mdaSession.selectedPrimaryKeyValues = mdaPrimaryKeyValues;
        mdaState.editingRowContext = Object.freeze({
            session: mdaSession, windowId: mdaWindowId, controller: mdaWindowController,
            primaryKeyValues: mdaPrimaryKeyValues, originalValues: mdaOriginalValues,
            editableColumns: Object.freeze([...mdaEditableColumns])
        });
        mdaWindowController.open();
        mdaMarkSelectedEditField(mdaWindowId, mdaActiveFieldName);
        return true;
    }

    async function mdaSaveEditedRow(mdaValues) {
        const mdaContext = mdaState.editingRowContext;
        if (!mdaContext) return false;
        mdaContext.controller.setLoading(true);
        try {
            const mdaTable = mdaContext.session.editableTable;
            // 原值为数据库 NULL 且用户没有输入内容时继续提交 null，避免仅打开保存就变成空字符串。
            const mdaSubmittedValues = Object.fromEntries(Object.entries(mdaValues).map(([mdaName, mdaValue]) => [
                mdaName,
                mdaValue === "" && mdaContext.originalValues[mdaName] === null ? null : mdaValue
            ]));
            const mdaResponse = await mdaAjax.request({
                url: mdaApi.updateRow,
                method: "POST",
                data: {
                    connectionId: mdaContext.session.connectionId,
                    catalog: mdaTable.catalog,
                    schema: mdaTable.schema,
                    tableName: mdaTable.tableName,
                    primaryKeyValues: JSON.stringify(mdaContext.primaryKeyValues),
                    values: JSON.stringify(mdaSubmittedValues)
                }
            });
            mdaContext.controller.close();
            mdaState.editingRowContext = null;
            mdaContext.session.selectedPrimaryKeyValues = mdaContext.primaryKeyValues;
            await mdaExecuteSql(mdaContext.session, mdaContext.session.sql);
            mdaBase.toast(mdaResponse.msg || "数据更新完成。", "success");
            return true;
        } catch (mdaError) {
            mdaContext.controller.setFeedback(mdaError.message || "数据更新失败。", true);
            return false;
        } finally {
            mdaContext.controller.setLoading(false);
        }
    }

    /** 在指定页签会话上执行真实 SQL，并只刷新该页签自己的结果表格。 */
    async function mdaExecuteSql(mdaSession, mdaSql) {
        const mdaNormalizedSql = String(mdaSql || "").trim();
        if (!mdaNormalizedSql) throw new Error("请输入需要执行的 SQL。");
        const mdaResponse = await mdaAjax.request({ url: mdaApi.execute, method: "POST", data: { connectionId: mdaSession.connectionId, sql: mdaNormalizedSql, autoCommit: true, maxRows: 1000, queryTimeoutSeconds: 30 } });
        const mdaResult = (mdaResponse.data?.results || []).find((mdaItem) => mdaItem.kind === "resultSet") || mdaResponse.data?.results?.[0];
        mdaSession.sql = mdaNormalizedSql;
        if (mdaResult?.kind === "resultSet") {
            mdaSession.columns = (mdaResult.columns || []).map((mdaColumn, mdaIndex) => ({
                name: `column${mdaIndex}`,
                databaseName: String(mdaColumn.name || mdaColumn.label || ""),
                label: String(mdaColumn.label || mdaColumn.name || ""),
                typeName: String(mdaColumn.typeName || ""),
                jdbcType: mdaColumn.jdbcType,
                // 默认表查询把树中 JDBC 字段 COMMENT 传给全部动态表头；别名或表达式无匹配时保持空提示。
                remarks: String((mdaSession.editableTable?.columns || []).find((mdaMetadataColumn) =>
                    String(mdaMetadataColumn.label || "").toLowerCase() === String(mdaColumn.name || mdaColumn.label || "").toLowerCase()
                )?.remarks || "")
            }));
            mdaSession.rows = (mdaResult.rows || []).map((mdaRow) => Object.fromEntries(mdaRow.map((mdaValue, mdaIndex) => [`column${mdaIndex}`, mdaValue])));
        } else {
            mdaSession.columns = [{ name: "column0", label: "更新行数" }];
            mdaSession.rows = [{ column0: mdaResult?.updateCount ?? 0 }];
        }
        mdaSession.gridController.setLocale(mdaBuildPayload(mdaSession));
        if (mdaSession.selectedPrimaryKeyValues) {
            const mdaSelectedRowId = mdaFindRowIdByPrimaryKeys(mdaSession, mdaSession.selectedPrimaryKeyValues);
            if (mdaSelectedRowId) mdaHighlightRow(mdaSession, mdaSelectedRowId);
        }
        if (mdaState.tabsController.getState().activeId === mdaSession.id) mdaSyncPanel(mdaBuildPayload(mdaSession));
        return mdaResponse;
    }

    /** 表节点单击时重置为该表默认查询并执行一次，不借用“执行选中 SQL”入口。 */
    async function mdaExecuteTableSelectionOnce(mdaSession, mdaSql) {
        const mdaTableSql = String(mdaSql || "").trim();
        if (!mdaTableSql || !mdaSession?.editorController || mdaSession.editorController.isLoading()) return false;
        mdaSession.editorController.setValue(mdaTableSql);
        mdaSession.sql = mdaTableSql;
        mdaSession.closeBaselineSql = mdaTableSql;
        mdaSession.dirty = false;
        mdaSession.editorController.setLoading(true);
        try {
            const mdaResponse = await mdaExecuteSql(mdaSession, mdaTableSql);
            mdaBase.toast(mdaResponse.msg || "表数据查询完成。", "success");
            return true;
        } catch (mdaError) {
            mdaBase.toast(mdaError.message || "表数据查询失败。", "error");
            return false;
        } finally {
            mdaSession.editorController.setLoading(false);
        }
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
            value: mdaSession.sql, placeholder: "选中需要执行的 SQL，再点击执行或按 Ctrl/⌘ + Enter", statusText: "",
            shortcutLabel: "选中 SQL 后按 Ctrl/⌘ + Enter 执行",
            actions: Object.freeze([
                Object.freeze({ id: "execute", label: "执行选中 SQL", icon: "ri-play-fill", primary: true })
            ])
        });
        const mdaGridRoot = window.selGrid.create(mdaSplitController.end, { gridId: mdaSession.gridId, entity: "MdaQueryResult", ariaLabel: `${mdaSession.label} 查询结果` });
        const mdaGridController = mdaGridRoot ? window.selGrid.mount(mdaGridRoot, mdaBuildPayload(mdaSession)) : null;
        const mdaCellMenuController = mdaGridController ? window.selContextMenu.mount(mdaGridController.root, {
            id: `${mdaSession.id}CellContextMenu`, ariaLabel: "查询结果单元格操作"
        }) : null;
        if (!mdaEditorController || !mdaGridController || !mdaCellMenuController) {
            mdaCellMenuController?.destroy();
            mdaGridController?.destroy();
            mdaEditorController?.destroy();
            mdaSplitController.destroy();
            throw new Error("MDA SQL 编辑器、结果表格或单元格菜单挂载失败。");
        }
        mdaSession.splitController = mdaSplitController;
        mdaSession.editorController = mdaEditorController;
        mdaSession.gridController = mdaGridController;
        const mdaHandleEditorChange = (mdaEvent) => {
            if (mdaEvent.detail?.editorId !== mdaSession.editorId) return;
            mdaSession.dirty = String(mdaEvent.detail.value || "") !== mdaSession.closeBaselineSql;
        };
        const mdaHandleEditorAction = async (mdaEvent) => {
            if (mdaEvent.detail?.editorId !== mdaSession.editorId) return;
            if (mdaEvent.detail.action !== "execute") return;
            // 按钮和快捷键共享同一动作入口；没有有效选区时只提示，不允许把编辑器内多条 SQL 整体提交。
            const mdaSelectedSql = String(mdaEvent.detail.selectedValue || mdaEditorController.getSelectedValue() || "").trim();
            if (!mdaSelectedSql) {
                mdaBase.toast("请先选中需要执行的 SQL。", "warning");
                return;
            }
            const mdaSqlToExecute = mdaSelectedSql;
            mdaEditorController.setLoading(true);
            try {
                const mdaResponse = await mdaExecuteSql(mdaSession, mdaSqlToExecute);
                const mdaEditorSql = String(mdaEvent.detail.value || "");
                // 只执行选区时其余编辑内容仍未执行，关闭提醒必须继续把两者识别为不同状态。
                mdaSession.closeBaselineSql = mdaSqlToExecute.trim();
                mdaSession.dirty = mdaEditorSql.trim() !== mdaSession.closeBaselineSql;
                // SQL 结果已经进入下方表格，成功消息仅短时提示而不占用上下分区高度。
                mdaBase.toast(mdaResponse.msg || "SQL 执行完成。", "success");
            } catch (mdaError) {
                // 异常仍以警示 Toast 告知用户，加载状态由 finally 统一解除。
                mdaBase.toast(mdaError.message || "SQL 执行失败。", "error");
            } finally {
                mdaEditorController.setLoading(false);
                // 选中 SQL 执行结束后恢复原选区，表格刷新不会抹掉用户正在处理的语句范围。
                if (mdaSelectedSql) mdaEditorController.restoreSelection();
            }
        };
        const mdaHandleGridDoubleClick = (mdaEvent) => {
            const mdaRow = mdaEvent.target.closest("tr[data-sel-grid-record-id]");
            if (!mdaRow || !mdaGridController.root.contains(mdaRow)) return;
            const mdaCell = mdaEvent.target.closest("td");
            const mdaSelectedColumn = mdaCell && mdaRow.contains(mdaCell) ? mdaSession.columns[mdaCell.cellIndex] : null;
            const mdaRowIndex = Number(mdaRow.dataset.selGridRecordId) - 1;
            if (!Number.isInteger(mdaRowIndex) || !mdaSession.rows[mdaRowIndex]) return;
            try {
                mdaOpenRowEditor(mdaSession, Object.freeze({ _row: mdaRowIndex + 1, ...mdaSession.rows[mdaRowIndex] }), mdaSelectedColumn?.databaseName || "");
            } catch (mdaError) {
                mdaBase.toast(mdaError.message || "数据编辑窗口打开失败。", "error");
            }
        };
        const mdaHandleGridContextMenu = (mdaEvent) => {
            const mdaRow = mdaEvent.target.closest("tr[data-sel-grid-record-id]");
            const mdaCell = mdaEvent.target.closest("td");
            if (!mdaRow || !mdaCell || !mdaRow.contains(mdaCell) || !mdaGridController.root.contains(mdaRow)) return;
            const mdaColumn = mdaSession.columns[mdaCell.cellIndex];
            const mdaRowIndex = Number(mdaRow.dataset.selGridRecordId) - 1;
            const mdaMetadataColumn = (mdaSession.editableTable?.columns || []).find((mdaItem) =>
                String(mdaItem.label || "").toLowerCase() === String(mdaColumn?.databaseName || "").toLowerCase()
            );
            if (!mdaColumn || !mdaMetadataColumn || !Number.isInteger(mdaRowIndex) || !mdaSession.rows[mdaRowIndex]) return;
            mdaEvent.preventDefault();
            mdaCellMenuController.open({
                clientX: mdaEvent.clientX,
                clientY: mdaEvent.clientY,
                restoreFocusTarget: mdaCell,
                items: Object.freeze([
                    Object.freeze({ id: "select-from-where", label: "Select From Where", icon: "ri-filter-3-line" })
                ]),
                context: Object.freeze({
                    columnIndex: mdaCell.cellIndex,
                    rowIndex: mdaRowIndex,
                    value: mdaSession.rows[mdaRowIndex][mdaColumn.name]
                })
            });
        };
        const mdaHandleCellMenuAction = (mdaEvent) => {
            if (mdaEvent.detail?.menuId !== mdaCellMenuController.id || mdaEvent.detail.actionId !== "select-from-where") return;
            const mdaContext = mdaEvent.detail.context || {};
            const mdaColumn = mdaSession.columns[Number(mdaContext.columnIndex)];
            const mdaRow = mdaSession.rows[Number(mdaContext.rowIndex)];
            const mdaSelectedColumnKeys = mdaGridController.getSelectedColumnKeys();
            const mdaSelectedColumns = mdaSelectedColumnKeys
                .map((mdaColumnKey) => mdaSession.columns.find((mdaCandidate) => mdaCandidate.name === mdaColumnKey))
                .filter(Boolean);
            // 没有勾选表头字段时保持现有单元格逻辑；有勾选时统一读取右键所在行的多字段值。
            const mdaPredicateColumns = mdaSelectedColumns.length > 0 ? mdaSelectedColumns : [mdaColumn];
            const mdaSql = mdaBuildSelectFromWhereSql(mdaSession, mdaPredicateColumns, mdaRow);
            if (!mdaSql || !mdaAppendSqlQuery(mdaEditorController, mdaSql)) {
                mdaBase.toast("无法为当前单元格生成查询。", "error");
                return;
            }
            const mdaSelectionDescription = mdaSelectedColumns.length > 0
                ? `${mdaSelectedColumns.length} 个勾选字段`
                : mdaColumn.databaseName;
            mdaBase.toast(`已按 ${mdaSelectionDescription} 追加筛选查询。`, "success");
        };
        mdaEditorController.root.addEventListener("selCodeEditor:change", mdaHandleEditorChange);
        mdaEditorController.root.addEventListener("selCodeEditor:action", mdaHandleEditorAction);
        mdaGridController.root.addEventListener("dblclick", mdaHandleGridDoubleClick);
        mdaGridController.root.addEventListener("contextmenu", mdaHandleGridContextMenu);
        mdaGridController.root.addEventListener("selContextMenu:action", mdaHandleCellMenuAction);
        return () => {
            mdaEditorController.root.removeEventListener("selCodeEditor:change", mdaHandleEditorChange);
            mdaEditorController.root.removeEventListener("selCodeEditor:action", mdaHandleEditorAction);
            mdaGridController.root.removeEventListener("dblclick", mdaHandleGridDoubleClick);
            mdaGridController.root.removeEventListener("contextmenu", mdaHandleGridContextMenu);
            mdaGridController.root.removeEventListener("selContextMenu:action", mdaHandleCellMenuAction);
            if (mdaState.editingRowContext?.session === mdaSession) {
                mdaState.editingRowContext.controller.close();
                mdaState.editingRowContext = null;
            }
            mdaCellMenuController.destroy();
            mdaGridController.destroy();
            mdaEditorController.destroy();
            mdaSplitController.destroy();
            mdaState.querySessions.delete(mdaSession.id);
        };
    }

    // 同一表重复选择会激活既有页签并重新执行一次默认全表查询；新表或人工查询才创建动态实例。
    function mdaOpenQuerySession(mdaDefinition, mdaExecuteImmediately = false) {
        if (!mdaState.selectedConnection) return null;
        const mdaSessionId = String(mdaDefinition.id);
        const mdaExistingSession = mdaState.querySessions.get(mdaSessionId);
        if (mdaExistingSession) {
            mdaState.tabsController.activate(mdaSessionId);
            if (mdaExecuteImmediately) void mdaExecuteTableSelectionOnce(mdaExistingSession, mdaDefinition.sql);
            return mdaExistingSession;
        }
        const mdaSession = {
            id: mdaSessionId,
            label: String(mdaDefinition.label),
            qualifiedName: String(mdaDefinition.qualifiedName || ""),
            connectionId: mdaState.selectedConnection.id,
            sql: String(mdaDefinition.sql || ""),
            closeBaselineSql: String(mdaDefinition.sql || ""), dirty: false,
            editableTable: mdaDefinition.editableTable || null,
            editableQuerySql: mdaDefinition.editableTable ? String(mdaDefinition.sql || "") : "",
            selectedRowId: null, selectedPrimaryKeyValues: null,
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
        if (mdaExecuteImmediately) void mdaExecuteTableSelectionOnce(mdaSession, mdaDefinition.sql);
        return mdaSession;
    }

    function mdaOpenTableQuery(mdaFilter) {
        const mdaTableQuery = mdaBuildTableQuery(mdaFilter);
        const mdaSessionId = `MdaTableQuery${mdaState.selectedConnection.id}_${mdaStableKey(`${mdaFilter.catalog}.${mdaFilter.schema}.${mdaFilter.tableName}`)}`;
        return mdaOpenQuerySession({ id: mdaSessionId, label: mdaTableQuery.label, qualifiedName: mdaTableQuery.qualifiedName, sql: mdaTableQuery.sql, editableTable: mdaTableQuery.editableTable, icon: "ri-table-2" }, true);
    }

    // 只读字段表沿用 selGrid 标准 payload，不创建应用私有表格控件。
    function mdaBuildStructureGridPayload(mdaGridId, mdaColumns, mdaItems, mdaEmptyText) {
        return Object.freeze({
            grid: Object.freeze({ mode: "records", horizontalScroll: true, columnResize: true, defaultColumnWidth: 150, idField: "_row", searchFields: Object.freeze([]) }),
            data: Object.freeze({ items: Object.freeze(mdaItems.map((mdaItem, mdaIndex) => Object.freeze({ _row: mdaIndex + 1, ...mdaItem }))), selectedIds: Object.freeze([]) }),
            column: Object.freeze({ gridId: mdaGridId, ariaLabel: mdaEmptyText, emptyText: mdaEmptyText, items: Object.freeze(mdaColumns.map((mdaColumn) => Object.freeze({ ...mdaColumn, renderer: "text" }))) }),
            title: Object.freeze({ messages: mdaGridMessages }),
            pagination: Object.freeze({ gridId: mdaGridId, currentPage: 1, pageSize: Math.max(mdaItems.length, 20), totalCount: mdaItems.length, summaryAll: "共 {total} 条", summaryFiltered: "当前 {visible} 条 · 共 {total} 条", previousLabel: "上一页", nextLabel: "下一页", pageChangedMessage: "已切换到第 {page} 页", pageSizeChangedMessage: "每页显示 {size} 条" })
        });
    }

    function mdaColumnTypeLabel(mdaColumn) {
        const mdaSize = Number(mdaColumn.size || 0);
        const mdaDigits = Number(mdaColumn.decimalDigits || 0);
        if (!mdaSize) return String(mdaColumn.typeName || "");
        return `${mdaColumn.typeName || ""}(${mdaSize}${mdaDigits > 0 ? `,${mdaDigits}` : ""})`;
    }

    function mdaMountStructureGrid(mdaContainer, mdaGridId, mdaTitle, mdaColumns, mdaItems, mdaEmptyText) {
        const mdaGridRoot = window.selGrid.create(mdaContainer, { gridId: mdaGridId, entity: "MdaTableStructure", ariaLabel: mdaTitle });
        const mdaGridController = mdaGridRoot
            ? window.selGrid.mount(mdaGridRoot, mdaBuildStructureGridPayload(mdaGridId, mdaColumns, mdaItems, mdaEmptyText))
            : null;
        if (!mdaGridController) throw new Error(`${mdaTitle}表格挂载失败。`);
        return mdaGridController;
    }

    // 表结构页签只挂载字段 selGrid；关闭页签时销毁控制器，避免组件注册和监听器残留。
    function mdaMountTableStructureViewer(mdaPanel, mdaSession) {
        const mdaFilter = mdaSession.filter;
        const mdaColumnItems = mdaFilter.columns.map((mdaColumn) => ({
            name: mdaColumn.label, remarks: mdaColumn.remarks || "", dataType: mdaColumnTypeLabel(mdaColumn),
            primaryKey: mdaColumn.primaryKey ? "是" : "否", nullable: mdaColumn.nullable ? "是" : "否",
            defaultValue: mdaColumn.defaultValue ?? "", autoIncrement: mdaColumn.autoIncrement ? "是" : "否",
            generated: mdaColumn.generated ? "是" : "否"
        }));
        const mdaGridController = mdaMountStructureGrid(mdaPanel, `${mdaSession.id}Columns`, "字段属性", [
                { id: "name", field: "name", label: "字段名", width: 150 },
                { id: "remarks", field: "remarks", label: "字段注释", width: 405 },
                { id: "dataType", field: "dataType", label: "数据类型", width: 267 },
                { id: "primaryKey", field: "primaryKey", label: "主键", width: 150 },
                { id: "nullable", field: "nullable", label: "允许空", width: 150 },
                { id: "defaultValue", field: "defaultValue", label: "默认值", width: 215 },
                { id: "autoIncrement", field: "autoIncrement", label: "自增", width: 150 },
                { id: "generated", field: "generated", label: "生成列", width: 150 }
            ], mdaColumnItems, "当前对象没有字段元数据");
        return () => {
            mdaGridController.destroy();
            mdaState.structureSessions.delete(mdaSession.id);
        };
    }

    // 同一连接、Schema 和表名形成稳定 ID；重复查看只激活已有只读页签。
    function mdaOpenTableStructureViewer(mdaFilter) {
        if (!mdaState.selectedConnection) return null;
        const mdaSessionId = `MdaTableStructureViewer${mdaState.selectedConnection.id}_${mdaStableKey(`${mdaFilter.catalog}.${mdaFilter.schema}.${mdaFilter.tableName}`)}`;
        if (mdaState.tabsController.has(mdaSessionId)) {
            mdaState.tabsController.activate(mdaSessionId);
            return mdaState.structureSessions.get(mdaSessionId) || null;
        }
        const mdaSession = Object.freeze({ id: mdaSessionId, connectionId: mdaState.selectedConnection.id, filter: mdaFilter });
        mdaState.structureSessions.set(mdaSessionId, mdaSession);
        try {
            mdaState.tabsController.open({
                id: mdaSessionId, label: `结构 · ${mdaFilter.tableName}`, icon: "ri-layout-column-line", closable: true,
                closeLabel: `关闭${mdaFilter.tableName}结构页签`, mount: (mdaPanel) => mdaMountTableStructureViewer(mdaPanel, mdaSession)
            });
        } catch (mdaError) {
            mdaState.structureSessions.delete(mdaSessionId);
            throw mdaError;
        }
        return mdaSession;
    }

    // 编辑动作只打开带安全占位符的 SQL 页签，用户明确补全语句并点击执行后才会修改目标库。
    function mdaOpenTableStructureEditor(mdaFilter) {
        const mdaAction = mdaBuildTableStructureAction(mdaFilter);
        const mdaSessionId = `MdaTableStructure${mdaState.selectedConnection.id}_${mdaStableKey(`${mdaFilter.catalog}.${mdaFilter.schema}.${mdaFilter.tableName}`)}`;
        const mdaSql = mdaAction.isView
            ? `-- 请按目标数据库语法填写 ${mdaAction.qualifiedName} 的 CREATE OR REPLACE VIEW 语句`
            : String(mdaFilter.structureEditSql || `ALTER TABLE ${mdaAction.tableName} ADD NEW_COLUMN VARCHAR(255);\n\nCOMMENT ON TABLE ${mdaAction.tableName} IS '';\nCOMMENT ON COLUMN ${mdaAction.tableName}.NEW_COLUMN IS '';`);
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

    // 创建工程窗口固定收集工程名和表名；同一工程再次提交时解释为新增业务表。
    function mdaBuildProjectWindow() {
        return Object.freeze({
            title: "创建工程",
            subtitle: "首次创建完整工程；已有生成工程则追加一张业务表",
            closeLabel: "关闭创建工程窗口",
            cancelLabel: "取消",
            submitLabel: "创建",
            validationMessage: "请填写工程名和表名",
            autoSuccess: false,
            rows: Object.freeze([
                Object.freeze([
                    Object.freeze({
                        name: "projectName",
                        label: "工程名",
                        type: "text",
                        icon: "ri-folder-3-line",
                        required: true,
                        placeholder: "例如：japan"
                    }),
                    Object.freeze({
                        name: "tableName",
                        label: "表名",
                        type: "text",
                        icon: "ri-table-2",
                        required: true,
                        placeholder: "例如：region"
                    })
                ])
            ])
        });
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
            await mdaReloadConnections(undefined, true);
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
            mdaState.tabsController.close(`MdaTableStructureViewer${mdaConnectionId}_${mdaStableKey(mdaStableTablePath)}`, { force: true });
            await mdaRefreshSelectedMetadata();
            mdaBase.toast(`${mdaObjectLabel}“${mdaDeleteTarget.qualifiedName}”已删除。`, "success");
            return true;
        } catch (mdaError) {
            mdaBase.toast(mdaError.message || `${mdaObjectLabel}删除失败。`, "error");
            return false;
        }
    }

    // 导出接口只接收当前连接和树节点坐标；输出目录、文件命名、SQL 幂等性及原子回滚全部由后端门禁决定。
    async function mdaExportStartupSql(mdaScope, mdaFilter = {}) {
        if (!mdaState.selectedConnection) throw new Error("请先选择数据库连接。");
        const mdaIsTableExport = mdaScope === "table";
        const mdaExportTarget = mdaIsTableExport
            ? `${mdaFilter.schema || "PUBLIC"}.${mdaFilter.tableName || ""}`
            : mdaState.selectedConnection.connectionName;
        const mdaConfirmed = await mdaState.confirmDialogController.open({
            title: mdaIsTableExport ? "导出表启动 SQL" : "导出数据库启动 SQL",
            message: mdaIsTableExport
                ? "将以当前表结构和全量数据覆盖同名 schema/data 启动 SQL，是否继续？"
                : "将以当前数据库全部物理表结构和全量数据覆盖对应启动 SQL，是否继续？",
            target: mdaExportTarget,
            icon: "ri-download-cloud-2-line",
            tone: "warning",
            confirmLabel: "确认导出",
            cancelLabel: "取消",
            closeLabel: "关闭启动 SQL 导出确认框"
        });
        if (!mdaConfirmed) return false;
        const mdaResponse = await mdaAjax.request({
            url: mdaIsTableExport ? mdaApi.exportTable : mdaApi.exportDatabase,
            method: "POST",
            data: {
                connectionId: mdaState.selectedConnection.id,
                catalog: mdaFilter.catalog || "",
                schema: mdaFilter.schema || "",
                ...(mdaIsTableExport ? { tableName: mdaFilter.tableName || "" } : {})
            }
        });
        const mdaExportData = mdaResponse.data || {};
        mdaBase.toast(
            `${mdaResponse.msg || "启动 SQL 导出完成。"} ${mdaExportData.tableCount || 0} 张表、${mdaExportData.rowCount || 0} 行，目录：${mdaExportData.outputDirectory || "db/sql"}`,
            "success"
        );
        return true;
    }

    // 页签关闭只在 SQL 相对最近一次初始值或成功执行值发生变化时确认；同一批关闭合并成一次提示。
    async function mdaCloseQuerySessions(mdaSessionIds, mdaOptions = {}) {
        const mdaClosableIds = Array.from(new Set(mdaSessionIds || []))
            .map(String)
            .filter((mdaSessionId) => mdaState.tabsController?.has(mdaSessionId));
        if (!mdaClosableIds.length) return true;
        const mdaDirtySessions = mdaClosableIds
            .map((mdaSessionId) => mdaState.querySessions.get(mdaSessionId))
            .filter((mdaSession) => mdaSession?.dirty);
        if (mdaDirtySessions.length && !mdaOptions.force) {
            if (mdaState.closeConfirmationPending) return false;
            mdaState.closeConfirmationPending = true;
            try {
                const mdaConfirmed = await mdaState.confirmDialogController.open({
                    title: "关闭未保存的 SQL",
                    message: mdaDirtySessions.length === 1
                        ? "当前 SQL 已修改但尚未成功执行，关闭后修改内容将丢失。"
                        : `有 ${mdaDirtySessions.length} 个页签包含未保存 SQL，关闭后修改内容将丢失。`,
                    target: mdaDirtySessions.map((mdaSession) => mdaSession.label).join("、"),
                    icon: "ri-file-warning-line",
                    tone: "warning",
                    confirmLabel: "放弃修改并关闭",
                    cancelLabel: "继续编辑",
                    closeLabel: "关闭未保存 SQL 确认框"
                });
                if (!mdaConfirmed) return false;
            } finally {
                mdaState.closeConfirmationPending = false;
            }
        }
        mdaClosableIds.forEach((mdaSessionId) => mdaState.tabsController.close(mdaSessionId, { force: true }));
        return true;
    }

    // 页签右键批量关闭由应用一次性确认全部脏页签，避免公共控件逐个弹窗或只关闭首个页签。
    function mdaResolveContextCloseIds(mdaActionId, mdaTargetId) {
        const mdaTabIds = mdaState.tabsController?.list() || [];
        const mdaTargetIndex = mdaTabIds.indexOf(String(mdaTargetId));
        if (mdaActionId === "close-right") return mdaTargetIndex < 0 ? [] : mdaTabIds.slice(mdaTargetIndex + 1);
        if (mdaActionId === "close-others") return mdaTabIds.filter((mdaTabId) => mdaTabId !== String(mdaTargetId));
        if (mdaActionId === "close-all") return mdaTabIds;
        return [];
    }

    // 同一连接结构刷新默认保留用户展开状态；首次加载或切换连接时重新挂载树以应用新连接的默认展开节点。
    async function mdaRefreshSelectedMetadata(mdaResetTreeExpansion = false) {
        if (!mdaState.selectedConnection) return false;
        const mdaResponse = await mdaAjax.request({ url: mdaApi.metadata, method: "POST", data: { connectionId: mdaState.selectedConnection.id } });
        mdaState.metadata = mdaResponse.data?.nodes || [];
        const mdaPayload = mdaBuildPayload();
        if (mdaResetTreeExpansion) {
            mdaState.treeController?.destroy();
            mdaState.treeController = window.selTree.mount(mdaState.panelRoot, mdaPayload.tree);
            if (!mdaState.treeController) throw new Error("MDA 数据库结构树重新挂载失败。");
        } else {
            mdaState.treeController.setLocale(mdaPayload.tree);
        }
        mdaSyncPanel(mdaPayload);
        return true;
    }

    // 切换连接时关闭并销毁旧连接的全部动态查询页签，再加载新连接元数据。
    async function mdaLoadMetadata(mdaConnection, mdaForceCloseTabs = false) {
        const mdaClosed = await mdaCloseQuerySessions(mdaState.tabsController?.list() || [], { force: mdaForceCloseTabs });
        if (!mdaClosed) return false;
        mdaState.selectedConnection = mdaConnection;
        await mdaRefreshSelectedMetadata(true);
        return true;
    }

    async function mdaReloadConnections(mdaPreferredId, mdaForceCloseTabs = false) {
        const mdaConnectionPage = await mdaAjax.json({ url: `${mdaApi.connections}getStore.htm` });
        mdaState.connections = mdaConnectionPage.records || [];
        const mdaNextConnection = mdaState.connections.find((mdaItem) => String(mdaItem.id) === String(mdaPreferredId || "")) || mdaState.connections[0] || null;
        if (mdaNextConnection) {
            return mdaLoadMetadata(mdaNextConnection, mdaForceCloseTabs);
        }
        const mdaClosed = await mdaCloseQuerySessions(mdaState.tabsController?.list() || [], { force: mdaForceCloseTabs });
        if (!mdaClosed) return false;
        mdaState.selectedConnection = null;
        mdaState.metadata = [];
        const mdaPayload = mdaBuildPayload();
        mdaState.treeController.setLocale(mdaPayload.tree);
        mdaSyncPanel(mdaPayload);
        return true;
    }

    async function mdaMountApplication() {
        // 窗口文案先加载；页面骨架仍在控制库请求前完成挂载，空连接时可立即新增。
        const mdaWindowMessages = await mdaAjax.json({ url: "/sel/components/window/i18n/zh-CN.json?v=20260807-mda-1" });
        mdaState.windowMessages = mdaWindowMessages;
        const mdaPayload = mdaBuildPayload();
        mdaState.panelRoot = window.selPanel.create(mdaApplicationHost, { gridId: mdaWorkspaceId, sourceId: mdaWorkspaceId, entity: "MdaQueryWorkspace", view: "database", layout: "single", structure: mdaLayout, ariaLabel: mdaPayload.title.ariaLabel });
        if (!mdaState.panelRoot || !window.selPanel.mount(mdaState.panelRoot, {
            view: mdaPayload,
            expandLeftLabel: mdaPayload.title.messages.expandLeftRegion,
            collapseLeftLabel: mdaPayload.title.messages.collapseLeftRegion,
            toolbar: mdaToolbarOptions
        })) throw new Error("MDA 公共面板挂载失败。");
        mdaState.treeController = window.selTree.mount(mdaState.panelRoot, mdaPayload.tree);
        window.selDropdownMenu.mountAll(mdaState.panelRoot);
        const mdaTabsHost = window.selPanel.getComponent(mdaWorkspaceId, "selTabs");
        mdaState.tabsController = window.selTabs.mount(mdaTabsHost, { id: mdaTabsId, ariaLabel: "数据库查询页签", tabListLabel: "已打开的数据库查询", emptyIcon: "ri-terminal-window-line", emptyTitle: "选择数据表开始查询", emptyDescription: "左侧选择表后，将在这里打开 SQL 编辑区和查询结果" });
        mdaState.connectionWindowController = window.selWindow.mount(mdaApplicationHost, { id: "MdaConnectionWindow", messages: mdaWindowMessages, ...mdaBuildConnectionWindow() });
        mdaState.projectWindowController = window.selWindow.mount(mdaApplicationHost, { id: "MdaProjectWindow", messages: mdaWindowMessages, ...mdaBuildProjectWindow() });
        mdaState.confirmDialogController = window.selConfirmDialog.mount(mdaApplicationHost, { id: "MdaDeleteConfirmDialog", title: "删除确认", tone: "danger" });
        if (!mdaState.treeController || !mdaState.tabsController || !mdaState.connectionWindowController || !mdaState.projectWindowController || !mdaState.confirmDialogController) throw new Error("MDA 公共业务组件挂载失败。");

        // 单个关闭按钮和 Delete 键通过 beforeClose 暂停；确认后使用 force 只重放当前关闭动作。
        mdaState.tabsController.root.addEventListener("selTabs:beforeClose", (mdaEvent) => {
            const mdaSession = mdaState.querySessions.get(String(mdaEvent.detail?.tabId || ""));
            if (!mdaSession?.dirty) return;
            mdaEvent.preventDefault();
            void mdaCloseQuerySessions([mdaSession.id]);
        });
        // 截获公共 Tab 的批量右键关闭动作，由 MDA 合并检查全部未保存 SQL 后再统一关闭。
        mdaState.tabsController.root.addEventListener("selContextMenu:action", (mdaEvent) => {
            if (mdaEvent.detail?.menuId !== `${mdaTabsId}:tab-actions`) return;
            const mdaActionId = String(mdaEvent.detail.actionId || "");
            if (!["close-right", "close-others", "close-all"].includes(mdaActionId)) return;
            mdaEvent.preventDefault();
            mdaEvent.stopImmediatePropagation();
            const mdaCloseIds = mdaResolveContextCloseIds(mdaActionId, mdaEvent.detail.context?.tabId);
            void mdaCloseQuerySessions(mdaCloseIds);
        }, true);

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
            if (mdaCommand === "project-create") {
                mdaState.projectWindowController.reset();
                mdaState.projectWindowController.setValues({ projectName: "", tableName: "" });
                mdaState.projectWindowController.open();
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
                if (mdaAction === "database-export") await mdaExportStartupSql("database", mdaFilter);
                if (mdaAction === "table-inspect") mdaOpenTableStructureViewer(mdaFilter);
                if (mdaAction === "table-export") await mdaExportStartupSql("table", mdaFilter);
                if (mdaAction === "table-edit") mdaOpenTableStructureEditor(mdaFilter);
                if (mdaAction === "table-delete") await mdaConfirmAndDeleteTable(mdaFilter);
                if (mdaAction === "copy-label") {
                    const mdaCopied = await mdaBase.copyText(mdaEvent.detail?.label || "");
                    mdaBase.toast(mdaCopied ? `已复制“${mdaEvent.detail.label}”。` : "复制失败，请检查浏览器是否允许访问剪贴板。", mdaCopied ? "success" : "error");
                }
            } catch (mdaError) {
                mdaBase.toast(mdaError.message || "右键菜单操作失败。", "error");
            }
        });
        // 切换仅隐藏非活动页签，关闭事件则在子清理完成后刷新计数。
        mdaState.tabsController.root.addEventListener("selTabs:change", () => mdaSyncPanel(mdaBuildPayload()));
        mdaState.tabsController.root.addEventListener("selTabs:close", () => mdaSyncPanel(mdaBuildPayload()));

        mdaApplicationHost.addEventListener("selWindow:submit", async (mdaEvent) => {
            if (mdaEvent.detail?.id === mdaState.editingRowContext?.windowId) {
                await mdaSaveEditedRow(mdaEvent.detail.values);
                return;
            }
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
            if (mdaEvent.detail?.id === "MdaProjectWindow") {
                const mdaProjectValues = mdaEvent.detail.values || {};
                const mdaProjectConfirmed = await mdaState.confirmDialogController.open({
                    title: "创建工程并生成业务文件",
                    message: "该操作会一次性创建工程、后端分层、页面、启动 SQL 和中央登记，是否继续？",
                    target: `工程：${mdaProjectValues.projectName || ""}；表：${mdaProjectValues.tableName || ""}`,
                    icon: "ri-folder-add-line",
                    tone: "warning",
                    confirmLabel: "确认创建",
                    cancelLabel: "返回检查",
                    closeLabel: "关闭跨文件创建确认框"
                });
                if (!mdaProjectConfirmed) return;
                mdaState.projectWindowController.setLoading(true);
                try {
                    const mdaResponse = await mdaAjax.request({
                        url: mdaApi.projects,
                        method: "POST",
                        data: mdaProjectValues
                    });
                    const mdaPageUrl = mdaResponse.data?.pageUrl || "";
                    const mdaMessage = (mdaResponse.msg || "工程创建完成。")
                        + (mdaPageUrl ? " 重启平台后访问 " + mdaPageUrl : "");
                    mdaState.projectWindowController.setFeedback(mdaMessage);
                    mdaBase.toast(mdaMessage, "success");
                } catch (mdaError) {
                    mdaState.projectWindowController.setFeedback(mdaError.message || "工程创建失败。", true);
                } finally {
                    mdaState.projectWindowController.setLoading(false);
                }
                return;
            }
        });
        // 公共窗口会先执行关闭，再把 click 或 Escape 冒泡到应用；此处同步清除被取消编辑的行标色。
        const mdaClearClosedRowEditor = () => queueMicrotask(() => {
            const mdaContext = mdaState.editingRowContext;
            if (!mdaContext || mdaContext.controller.getState().open) return;
            mdaClearRowHighlight(mdaContext.session);
            mdaState.editingRowContext = null;
        });
        mdaApplicationHost.addEventListener("click", mdaClearClosedRowEditor);
        mdaApplicationHost.addEventListener("keydown", (mdaEvent) => {
            if (mdaEvent.key === "Escape") mdaClearClosedRowEditor();
        });
        const mdaConnectionSelect = mdaState.panelRoot.querySelector('[data-sel-grid-role="type-filter"]');
        mdaConnectionSelect?.addEventListener("change", async () => {
            const mdaConnection = mdaState.connections.find((mdaItem) => String(mdaItem.id) === mdaConnectionSelect.value);
            if (!mdaConnection) return;
            const mdaLoaded = await mdaLoadMetadata(mdaConnection);
            if (!mdaLoaded && mdaState.selectedConnection) {
                window.selDropdownMenu.setValue(mdaConnectionSelect, String(mdaState.selectedConnection.id));
            }
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
