package com.sp.selplat.mda.common.util.metadata;

import com.sp.selplat.mda.common.util.metadata.MdaTableStructureSqlBuilder;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * 验证表结构编辑模板按真实数据库方言保留表注释和字段注释。
 */
class MdaTableStructureSqlBuilderTest {

    /**
     * 验证 H2 模板带出真实原注释，并把缺失注释保持为空字符串。
     * 真实传参示例：表 {@code FTSTYPEKBN} 含 ID 注释和无注释字段。
     * 真实返回示例：生成 ALTER、表注释、字段注释及空的新字段注释。
     * 异常或副作用示例：只构造内存字符串，不连接测试数据库。
     */
    @Test
    void shouldBuildCompleteH2TemplateWithOriginalAndEmptyComments() {
        String sql = MdaTableStructureSqlBuilder.build(
                "H2",
                "PUBLIC",
                "FTSTYPEKBN",
                "文件类型'区分",
                List.of(
                        Map.of("label", "ID", "remarks", "主键"),
                        Map.of("label", "FTSTYPESELCODE", "remarks", "")));

        assertThat(sql)
                .contains("ALTER TABLE FTSTYPEKBN ADD NEW_COLUMN VARCHAR(255);")
                .contains("COMMENT ON TABLE FTSTYPEKBN IS '文件类型''区分';")
                .contains("COMMENT ON COLUMN FTSTYPEKBN.ID IS '主键';")
                .contains("COMMENT ON COLUMN FTSTYPEKBN.FTSTYPESELCODE IS '';")
                .endsWith("COMMENT ON COLUMN FTSTYPEKBN.NEW_COLUMN IS '';");
    }

    /**
     * 验证 PostgreSQL、Oracle 和 MySQL 使用各自的新增字段语法。
     * 真实传参示例：数据库产品名分别为 {@code PostgreSQL}、{@code Oracle}、{@code MySQL}。
     * 真实返回示例：分别生成 {@code ADD COLUMN}、{@code VARCHAR2} 和 MySQL 行内 COMMENT。
     * 异常或副作用示例：只构造内存字符串，不执行模板 SQL。
     */
    @Test
    void shouldUseCurrentDatabaseAddColumnSyntax() {
        String postgresql = MdaTableStructureSqlBuilder.build(
                "PostgreSQL", "public", "sample_table", "", List.of());
        String oracle = MdaTableStructureSqlBuilder.build(
                "Oracle", "APP", "SAMPLE_TABLE", "", List.of());
        String mysql = MdaTableStructureSqlBuilder.build(
                "MySQL", "sample", "sample_table", "原表", List.of());

        assertThat(postgresql).contains("ALTER TABLE sample_table ADD COLUMN NEW_COLUMN VARCHAR(255);");
        assertThat(oracle).contains("ALTER TABLE SAMPLE_TABLE ADD NEW_COLUMN VARCHAR2(255);");
        assertThat(mysql)
                .contains("ALTER TABLE sample_table ADD COLUMN NEW_COLUMN VARCHAR(255) COMMENT '';")
                .contains("ALTER TABLE sample_table COMMENT = '原表';")
                .doesNotContain("COMMENT ON TABLE");
    }

    /**
     * 验证缺少真实表名时阻止生成不可执行模板。
     * 真实传参示例：{@code tableName=""}。
     * 真实返回示例：无返回值。
     * 异常或副作用示例：抛出消息为“生成表结构 SQL 时表名不能为空。”的 {@link IllegalArgumentException}。
     */
    @Test
    void shouldRejectMissingTableName() {
        assertThatThrownBy(() -> MdaTableStructureSqlBuilder.build("H2", "PUBLIC", "", "", List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("生成表结构 SQL 时表名不能为空。");
    }
}
