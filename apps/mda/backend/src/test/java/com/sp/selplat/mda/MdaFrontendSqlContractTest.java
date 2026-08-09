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
}
