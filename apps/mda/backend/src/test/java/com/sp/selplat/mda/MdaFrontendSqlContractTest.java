package com.sp.selplat.mda;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/**
 * 验证 MDA 页面生成的默认查询和表结构编辑 SQL 契约不会退回旧占位形式。
 */
class MdaFrontendSqlContractTest {

    /**
     * 验证单击数据库树中的表会执行一次默认全表查询，重复单击已有页签也会重新查询。
     * 真实传参示例：单击 {@code ReferenceDataTableColumn} 表节点。
     * 真实返回示例：编辑器写入 {@code SELECT * FROM ReferenceDataTableColumn}，立即请求并刷新结果表格。
     * 异常或副作用示例：查询进行中重复单击不会并发提交；按钮执行仍要求用户先选中 SQL。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldExecuteTableQueryOnceWheneverTableNodeIsSelected() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("async function mdaExecuteTableSelectionOnce(session, sql)")
                .contains("session.editorController.setValue(tableSql)")
                .contains("await mdaExecuteSql(session, tableSql)")
                .contains("if (executeImmediately) void mdaExecuteTableSelectionOnce(existingSession, definition.sql)")
                .contains("if (executeImmediately) void mdaExecuteTableSelectionOnce(session, definition.sql)")
                .contains("mdaOpenTableQuery(event.detail.filter)")
                .doesNotContain("if (mdaExecuteImmediately) session.editorController.action(\"execute\")");
    }

    /**
     * 验证 MDA 查询动作优先执行公共编辑器返回的选中 SQL。
     * 真实传参示例：编辑器包含两条查询，用户选中 {@code SELECT * FROM ReferenceDataTreeNode\nWHERE typeId = 1}
     *     后点击执行按钮或按 {@code Ctrl/Command + Enter}。
     * 真实返回示例：请求只提交动作快照中的两行 SQL；执行完成后恢复同一选区。
     * 异常或副作用示例：没有有效选区时提示用户先选中 SQL 且不发送请求；只执行选区不会把未执行内容标记为已保存，失败后也保留选区。
     *
     * @throws Exception 页面脚本或公共编辑器资源无法读取时抛出
     */
    @Test
    void shouldExecuteSelectedSqlBeforeWholeEditorValue() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(script)
                .contains("const selectedSql = String(event.detail.selectedValue || editorController.getSelectedValue() || \"\").trim()")
                .contains("label: \"执行选中 SQL\"")
                .contains("shortcutLabel: \"选中 SQL 后按 Ctrl/⌘ + Enter 执行\"")
                .contains("selBase.toast(\"请先选中需要执行的 SQL。\", \"warning\")")
                .contains("const sqlToExecute = selectedSql")
                .contains("await mdaExecuteSql(session, sqlToExecute)")
                .contains("if (selectedSql) editorController.restoreSelection()")
                .contains("session.dirty = editorSql.trim() !== session.closeBaselineSql")
                .doesNotContain("selectedSql || String(event.detail.value")
                .doesNotContain("editorController.input");
    }

    /**
     * 验证结果字段复选框与单元格右键操作通过公共组件 API 追加筛选 SQL。
     * 真实传参示例：勾选 {@code databaseType}、{@code connectionName} 两个表头字段，
     *     在值为 {@code H2}、{@code MDA 控制库} 的当前行选择 {@code Select From Where}。
     * 真实返回示例：编辑框追加两行以上 SQL，WHERE 后使用 {@code AND} 连接当前行两个字段值；
     *     未勾选字段时仍只使用右键单元格字段，并把已有语句用分号分隔。
     * 异常或副作用示例：值为 {@code null} 时生成 {@code IS NULL}；数字和布尔值不加单引号；
     *     无真实表或真实字段元数据时保留浏览器原生菜单且不修改编辑框。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldAppendSelectFromWhereForRightClickedDatabaseValue() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("id: \"select-from-where\", label: \"Select From Where\"")
                .contains("contextMenu.mount(gridController.root")
                .contains("editorController.appendValue(`${separator}${sql}`)")
                .contains("headerSelectable: Boolean")
                .contains("gridController.getSelectedColumnKeys()")
                .contains("const predicateColumns = selectedColumns.length > 0 ? selectedColumns : [column]")
                .contains("return `SELECT * FROM ${tableName}\\nWHERE ${predicates.join(\"\\n  AND \")}`")
                .contains("String(value).replaceAll(\"'\", \"''\")")
                .contains("columnName} IS NULL")
                .contains("const unquotedJdbcTypes = new Set([-7, -6, -5, 2, 3, 4, 5, 6, 7, 8, 16])")
                .doesNotContain("gridController.root.querySelector(\"th")
                .doesNotContain("querySelector(\".selcode-input\")");
    }

    /**
     * 验证所有默认表查询字段把 JDBC COMMENT 作为公共表格头提示传递。
     * 真实传参示例：元数据列 {@code id} 的 {@code remarks=主键标识}，查询结果列名同为 {@code id}。
     * 真实返回示例：MDA 动态列保存 {@code remarks}，并以 {@code tooltip} 传给 selGrid 的列定义。
     * 异常或副作用示例：字段无 COMMENT 或查询表达式无法匹配真实列时传递空字符串，不产生空提示。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldPassEveryDatabaseColumnCommentToGridHeaderTooltip() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("columns: (filter.columns || []).map((column) => ({ ...column }))")
                .contains("remarks: String((session.editableTable?.columns || []).find")
                .contains("String(metadataColumn.label || \"\").toLowerCase()")
                .contains("tooltip: column.remarks");
    }

    /**
     * 验证页面只按裸表名生成查询，并消费后端提供的数据库结构模板。
     * 真实传参示例：读取构建资源中的 {@code static/mda/mda.js}。
     * 真实返回示例：脚本包含 {@code SELECT * FROM ${filter.tableName}} 且不含旧占位语句。
     * 异常或副作用示例：资源缺失时抛出 I/O 异常，不修改脚本文件。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldQueryByPlainTableNameAndConsumeDatabaseTemplate() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("sql: `SELECT * FROM ${filter.tableName}`")
                .doesNotContain("sql: `SELECT * FROM ${parts.join(\".\")}`")
                .contains("filter.structureEditSql")
                .doesNotContain("/* 表结构变更语句 */");
    }

    /**
     * 验证双击结果行只在 MDA 应用层标色，并按真实主键提交单行更新。
     * 真实传参示例：读取构建资源中的 {@code static/mda/mda.js}。
     * 真实返回示例：脚本监听 {@code dblclick}，使用 {@code primaryKeyValues} 并调用更新接口。
     * 异常或副作用示例：资源缺失或契约退化时断言失败，不修改页面脚本。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldHighlightDoubleClickedRowAndUpdateByPrimaryKey() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("addEventListener(\"dblclick\", handleGridDoubleClick)")
                .contains("targetRow.classList.add(\"selgrid-row-selected\")")
                .contains("const selectedColumn = cell && row.contains(cell) ? session.columns[cell.cellIndex] : null")
                .contains("mdaMarkSelectedEditField(windowId, activeFieldName)")
                .contains("label: column.databaseName")
                .contains("type: mdaIsTextAreaColumn(column) ? \"textarea\" : \"text\"")
                .doesNotContain("label: `${column.databaseName}${column.typeName")
                .contains("updateRow: \"/api/mda/data/update-row.htm\"")
                .contains("primaryKeyValues: JSON.stringify(context.primaryKeyValues)")
                .contains("values: JSON.stringify(submittedValues)")
                .contains("value === \"\" && context.originalValues[name] === null ? null : value")
                .contains("当前 SQL 已改变，查询结果只读")
                .contains("primaryKeys: [...(node.primaryKeys || [])]");
    }

    /**
     * 验证标题动作提供创建工程窗口，并把工程名和表名提交到唯一生成接口。
     * 真实传参示例：读取构建资源中的 {@code static/mda/mda.js}。
     * 真实返回示例：脚本包含 {@code project-create}、两个字段和
     * {@code /api/mda/projects/create.htm}。
     * 异常或副作用示例：资源缺失或窗口契约退化时断言失败，不创建真实工程。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldExposeProjectCreationWindowWithTwoRequiredFields() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("projects: \"/api/mda/projects/create.htm\"")
                .contains("id: \"project-create\", label: \"创建工程\"")
                .contains("id: \"MdaProjectWindow\"")
                .contains("name: \"projectName\"")
                .contains("name: \"tableName\"")
                .contains("重启平台后访问");
    }

    /**
     * 验证数据库结构树默认展开数据库目录与 PUBLIC Schema，同时保持系统 Schema 和表节点折叠。
     * 真实传参示例：读取构建资源中的 {@code static/mda/mda.js}，节点类型依次为 catalog、schema、table。
     * 真实返回示例：脚本仅在 catalog 或名称大小写归一后等于 {@code PUBLIC} 的 schema 上设置 expanded=true，
     *     并把 {@code type=catalog|schema|table|column} 原样交给 selTree 的统一文字层级映射。
     * 异常或副作用示例：资源缺失或默认展开条件扩大到所有 schema 时断言失败，不修改用户树状态。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldExpandCatalogAndPublicSchemaOnlyByDefault() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("const defaultExpanded = node.type === \"catalog\"")
                .contains("node.type === \"schema\" && schemaName === \"PUBLIC\"")
                .contains("type: node.type")
                .contains("expanded: defaultExpanded")
                .contains("async function mdaRefreshSelectedMetadata(resetTreeExpansion = false, connection = mdaState.selectedConnection)")
                .contains("mdaState.treeController?.destroy()")
                .contains("mdaState.treeController = tree.mount(mdaState.panelRoot, payload.tree)")
                .contains("await mdaRefreshSelectedMetadata(true, connection)")
                .doesNotContain("const defaultExpanded = mdaNode.type === \"schema\"");
    }

    /**
     * 验证目标库切换只有在元数据成功返回后才整体提交，并在失败时恢复原选择与显示错误提示。
     * 真实传参示例：当前连接为 japanese，用户选择口令错误的 AI 工厂连接。
     * 真实返回示例：下拉框和左树继续显示 japanese，并通过公共 Toast 告知连接失败。
     * 异常或副作用示例：失败请求不得留下 AI 工厂下拉标签与 japanese 元数据树并存的混合状态。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldCommitConnectionSwitchAtomicallyAndRollbackOnFailure() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("async function mdaRefreshSelectedMetadata(resetTreeExpansion = false, connection = mdaState.selectedConnection)")
                .contains("const metadata = response.data?.nodes || []")
                .contains("mdaState.selectedConnection = connection")
                .contains("await mdaRefreshSelectedMetadata(true, connection)")
                .contains("const previousConnection = mdaState.selectedConnection")
                .contains("dropdown.setValue(connectionSelect, String(previousConnection?.id || \"\"))")
                .contains("selBase.toast(error.message || \"数据库连接切换失败。\", \"error\")")
                .doesNotContain("mdaState.selectedConnection = connection;\n        await mdaRefreshSelectedMetadata(true);");
    }

    /**
     * 验证查看表结构位于表菜单首项，并在可复用、可关闭的只读独立页签中使用公共表格展示元数据。
     * 真实传参示例：右键 {@code MdaConnectionProfile} 后点击“查看表结构”，再对同一表重复点击。
     * 真实返回示例：首次创建 {@code MdaTableStructureViewer...} 页签，重复点击只激活原页签并只展示字段表格。
     * 异常或副作用示例：元数据为空时显示空态；关闭页签销毁唯一 selGrid 且不执行 SQL。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldOpenReusableReadOnlyTableStructureTabWithSharedGrids() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        int inspectAction = script.indexOf("id: \"table-inspect\"");
        int editAction = script.indexOf("id: \"table-edit\"", inspectAction);
        int fieldNameColumn = script.indexOf("label: \"字段名\"", inspectAction);
        int fieldCommentColumn = script.indexOf("label: \"字段注释\"", fieldNameColumn);
        int fieldTypeColumn = script.indexOf("label: \"数据类型\"", fieldCommentColumn);
        assertThat(inspectAction).isGreaterThanOrEqualTo(0);
        assertThat(editAction).isGreaterThan(inspectAction);
        assertThat(fieldCommentColumn).isGreaterThan(fieldNameColumn);
        assertThat(fieldTypeColumn).isGreaterThan(fieldCommentColumn);
        assertThat(script)
                .contains("if (action === \"table-inspect\") mdaOpenTableStructureViewer(filter)")
                .contains("const sessionId = `MdaTableStructureViewer")
                .contains("if (mdaState.tabsController.has(sessionId))")
                .contains("mdaState.tabsController.activate(sessionId)")
                .contains("label: `结构 · ${filter.tableName}`")
                .contains("closable: true")
                .contains("grid.mount")
                .contains("label: \"字段名\", width: 150")
                .contains("label: \"字段注释\", width: 405")
                .contains("label: \"数据类型\", width: 267")
                .contains("label: \"主键\", width: 150")
                .contains("label: \"允许空\", width: 150")
                .contains("label: \"默认值\", width: 215")
                .contains("label: \"自增\", width: 150")
                .contains("label: \"生成列\", width: 150")
                .contains("const mdaGridMessages = selFreeze({")
                .contains("title: { messages: mdaGridMessages }")
                .contains("gridController.destroy()")
                .contains("structureSessions.delete(session.id)")
                .contains("mdaState.tabsController.close(`MdaTableStructureViewer${connectionId}_")
                .doesNotContain("appendStructureSummary")
                .doesNotContain("indexItems")
                .doesNotContain("foreignKeyItems")
                .doesNotContain("只读展示 JDBC 元数据")
                .doesNotContain("字段属性与含义");
    }

    /**
     * 验证数据库和物理表节点提供启动 SQL 导出动作，并调用各自的后端接口。
     * 真实传参示例：读取构建资源中的 {@code static/mda/mda.js}。
     * 真实返回示例：数据库菜单包含 {@code database-export}，物理表菜单包含 {@code table-export}，
     *     视图分支不追加表导出动作。
     * 异常或副作用示例：资源缺失或菜单只显示但没有接口调用时断言失败，不生成 SQL 文件。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldExportDatabaseAndPhysicalTableFromTreeContextMenu() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        int catalogBlock = script.indexOf("mdaNode.type === \"catalog\"");
        int connectionEditAction = script.indexOf("id: \"connection-edit\"", catalogBlock);
        int connectionDeleteAction = script.indexOf("id: \"connection-delete\"", connectionEditAction);
        int catalogCopyAction = script.indexOf("id: \"copy-label\"", connectionDeleteAction);
        int databaseExportAction = script.indexOf("id: \"database-export\"", catalogCopyAction);
        int tableEditAction = script.indexOf("id: \"table-edit\"");
        int tableDeleteAction = script.indexOf("id: \"table-delete\"");
        int tableCopyAction = script.indexOf("id: \"copy-label\"", tableDeleteAction);
        int tableExportAction = script.indexOf("id: \"table-export\"");

        assertThat(script)
                .contains("exportTable: \"/api/mda/export/table.htm\"")
                .contains("exportDatabase: \"/api/mda/export/database.htm\"")
                .contains("id: \"database-export\", label: \"导出整个数据库\"")
                .contains("...(!isView ? [{ id: \"table-export\", label: \"导出表\"")
                .contains("if (action === \"database-export\") await mdaExportStartupSql(\"database\", filter)")
                .contains("if (action === \"table-export\") await mdaExportStartupSql(\"table\", filter)")
                .contains("将以当前表结构和全量数据覆盖同名 schema/data 启动 SQL，是否继续？")
                .contains("confirmLabel: \"确认导出\"")
                .contains("if (!confirmed) return false")
                .contains("connectionId: mdaState.selectedConnection.id")
                .contains("outputDirectory || \"db/sql\"");
        assertThat(connectionEditAction).isGreaterThan(catalogBlock);
        assertThat(connectionDeleteAction).isGreaterThan(connectionEditAction);
        assertThat(catalogCopyAction).isGreaterThan(connectionDeleteAction);
        assertThat(databaseExportAction).isGreaterThan(catalogCopyAction);
        assertThat(tableEditAction).isGreaterThanOrEqualTo(0);
        assertThat(tableDeleteAction).isGreaterThan(tableEditAction);
        assertThat(tableCopyAction).isGreaterThan(tableDeleteAction);
        assertThat(tableExportAction).isGreaterThan(tableCopyAction);
    }

    /**
     * 验证未保存 SQL 的单个或批量关闭会合并使用公共确认框，取消时保持原页签。
     * 真实传参示例：编辑一个查询页签后点击关闭按钮，或从右键菜单选择关闭右侧、其他、全部。
     * 真实返回示例：脚本阻止 {@code selTabs:beforeClose}，显示“放弃修改并关闭”，确认后才强制关闭目标集合。
     * 异常或副作用示例：SQL 未变化时直接关闭；用户选择继续编辑时不销毁编辑器和查询结果。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldConfirmBeforeDiscardingUnsavedSqlForSingleAndBatchTabClose() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("session.dirty = String(event.detail.value || \"\") !== session.closeBaselineSql")
                .contains("session.closeBaselineSql = sqlToExecute.trim()")
                .contains("session.dirty = editorSql.trim() !== session.closeBaselineSql")
                .contains("addEventListener(\"selTabs:beforeClose\"")
                .contains("event.preventDefault()")
                .contains("title: \"关闭未保存的 SQL\"")
                .contains("confirmLabel: \"放弃修改并关闭\"")
                .contains("cancelLabel: \"继续编辑\"")
                .contains("mdaState.tabsController.close(sessionId, { force: true })")
                .contains("[\"close-right\", \"close-others\", \"close-all\"]")
                .contains("event.stopImmediatePropagation()")
                .contains("void mdaCloseQuerySessions(closeIds)");
    }

    /**
     * 验证创建工程这种跨文件写入在发送请求前展示一次合并确认。
     * 真实传参示例：创建工程窗口提交 {@code projectName=japan, tableName=N2Question}。
     * 真实返回示例：确认框展示工程和表坐标，确认按钮为“确认创建”，取消时不进入请求分支。
     * 异常或副作用示例：用户取消后不创建 Controller、Service、DAO、页面、SQL 或中央登记。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldConfirmOnceBeforeCrossFileProjectGeneration() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("title: \"创建工程并生成业务文件\"")
                .contains("工程：${projectValues.projectName || \"\"}；表：${projectValues.tableName || \"\"}")
                .contains("confirmLabel: \"确认创建\"")
                .contains("cancelLabel: \"返回检查\"")
                .contains("if (!projectConfirmed) return")
                .contains("data: projectValues");
    }
}
