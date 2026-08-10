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
     * 验证页面只按裸表名生成查询，并消费后端提供的数据库结构模板。
     * 真实传参示例：读取构建资源中的 {@code static/mda/mda.js}。
     * 真实返回示例：脚本包含 {@code SELECT * FROM ${mdaFilter.tableName}} 且不含旧占位语句。
     * 异常或副作用示例：资源缺失时抛出 I/O 异常，不修改脚本文件。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldQueryByPlainTableNameAndConsumeDatabaseTemplate() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("sql: `SELECT * FROM ${mdaFilter.tableName}`")
                .doesNotContain("sql: `SELECT * FROM ${mdaParts.join(\".\")}`")
                .contains("mdaFilter.structureEditSql")
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
                .contains("addEventListener(\"dblclick\", mdaHandleGridDoubleClick)")
                .contains("mdaTargetRow.classList.add(\"selgrid-row-selected\")")
                .contains("const mdaSelectedColumn = mdaCell && mdaRow.contains(mdaCell) ? mdaSession.columns[mdaCell.cellIndex] : null")
                .contains("mdaMarkSelectedEditField(mdaWindowId, mdaActiveFieldName)")
                .contains("label: mdaColumn.databaseName")
                .contains("type: mdaIsTextAreaColumn(mdaColumn) ? \"textarea\" : \"text\"")
                .doesNotContain("label: `${mdaColumn.databaseName}${mdaColumn.typeName")
                .contains("updateRow: \"/api/mda/data/update-row.htm\"")
                .contains("primaryKeyValues: JSON.stringify(mdaContext.primaryKeyValues)")
                .contains("values: JSON.stringify(mdaSubmittedValues)")
                .contains("mdaValue === \"\" && mdaContext.originalValues[mdaName] === null ? null : mdaValue")
                .contains("当前 SQL 已改变，查询结果只读")
                .contains("primaryKeys: Object.freeze([...(mdaNode.primaryKeys || [])])");
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
     * 真实返回示例：脚本仅在 catalog 或名称大小写归一后等于 {@code PUBLIC} 的 schema 上设置 expanded=true。
     * 异常或副作用示例：资源缺失或默认展开条件扩大到所有 schema 时断言失败，不修改用户树状态。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldExpandCatalogAndPublicSchemaOnlyByDefault() throws Exception {
        String script = new ClassPathResource("static/mda/mda.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("const mdaDefaultExpanded = mdaNode.type === \"catalog\"")
                .contains("mdaNode.type === \"schema\" && mdaSchemaName === \"PUBLIC\"")
                .contains("expanded: mdaDefaultExpanded")
                .contains("async function mdaRefreshSelectedMetadata(mdaResetTreeExpansion = false)")
                .contains("mdaState.treeController?.destroy()")
                .contains("mdaState.treeController = window.selTree.mount(mdaState.panelRoot, mdaPayload.tree)")
                .contains("await mdaRefreshSelectedMetadata(true)")
                .doesNotContain("const mdaDefaultExpanded = mdaNode.type === \"schema\"");
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
                .contains("...(!mdaIsView ? [Object.freeze({ id: \"table-export\", label: \"导出表\"")
                .contains("if (mdaAction === \"database-export\") await mdaExportStartupSql(\"database\", mdaFilter)")
                .contains("if (mdaAction === \"table-export\") await mdaExportStartupSql(\"table\", mdaFilter)")
                .contains("将以当前表结构和全量数据覆盖同名 schema/data 启动 SQL，是否继续？")
                .contains("confirmLabel: \"确认导出\"")
                .contains("if (!mdaConfirmed) return false")
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
                .contains("mdaSession.dirty = String(mdaEvent.detail.value || \"\") !== mdaSession.closeBaselineSql")
                .contains("mdaSession.closeBaselineSql = String(mdaEvent.detail.value || \"\")")
                .contains("addEventListener(\"selTabs:beforeClose\"")
                .contains("mdaEvent.preventDefault()")
                .contains("title: \"关闭未保存的 SQL\"")
                .contains("confirmLabel: \"放弃修改并关闭\"")
                .contains("cancelLabel: \"继续编辑\"")
                .contains("mdaState.tabsController.close(mdaSessionId, { force: true })")
                .contains("[\"close-right\", \"close-others\", \"close-all\"]")
                .contains("mdaEvent.stopImmediatePropagation()")
                .contains("void mdaCloseQuerySessions(mdaCloseIds)");
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
                .contains("工程：${mdaProjectValues.projectName || \"\"}；表：${mdaProjectValues.tableName || \"\"}")
                .contains("confirmLabel: \"确认创建\"")
                .contains("cancelLabel: \"返回检查\"")
                .contains("if (!mdaProjectConfirmed) return")
                .contains("data: mdaProjectValues");
    }
}
