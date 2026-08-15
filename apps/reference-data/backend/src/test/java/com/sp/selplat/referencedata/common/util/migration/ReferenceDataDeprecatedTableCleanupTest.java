package com.sp.selplat.referencedata.common.util.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.sp.selplat.referencedata.referencedatacontrollayout.service.ReferenceDataControlLayoutService;
import com.sp.selplat.referencedata.referencedatatable.service.ReferenceDataTableService;
import com.sp.selplat.referencedata.referencedatatableelement.service.ReferenceDataTableElementService;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import com.sp.selplat.referencedata.referencedatatype.service.ReferenceDataTypeService;
import com.sp.selplat.referencedata.referencedatawindow.service.ReferenceDataWindowService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** 验证最终六表迁移会安全清理空旧表，并阻断任何非空旧表删除。 */
class ReferenceDataDeprecatedTableCleanupTest {

    private static final List<String> DEPRECATED_TABLES = List.of(
            "ReferenceDataContextMenuItem",
            "ReferenceDataControlBinding",
            "ReferenceDataOption",
            "ReferenceDataTableColumn");

    /**
     * 验证没有记录的四张旧表会在没有 Legacy 前缀入口时照常删除。
     * 真实传参示例：旧正式库只残留四张空表，且不存在 LegacyReferenceDataType。
     * 真实返回示例：迁移完成后 INFORMATION_SCHEMA 不再返回任何废弃表。
     * 异常或副作用示例：只操作随机内存数据库，不修改正式 Reference Data 文件库。
     */
    @Test
    void shouldDropEmptyDeprecatedTablesWithoutLegacyEntryTable() {
        JdbcTemplate jdbc = createDatabase();
        createDeprecatedTables(jdbc);

        migration(jdbc).run(null);

        assertThat(existingDeprecatedTables(jdbc)).isEmpty();
    }

    /**
     * 验证任一旧表仍有数据时先整体阻断，禁止先删除排在前面的其他空表。
     * 真实传参示例：ReferenceDataOption 保留一条尚未核验的历史记录。
     * 真实返回示例：抛出包含表名和记录数的异常，四张旧表全部仍然存在。
     * 异常或副作用示例：异常是保护性结果；测试只写随机内存数据库。
     */
    @Test
    void shouldKeepAllDeprecatedTablesWhenAnyTableContainsData() {
        JdbcTemplate jdbc = createDatabase();
        createDeprecatedTables(jdbc);
        jdbc.update("INSERT INTO ReferenceDataOption(id) VALUES (1)");

        assertThatThrownBy(() -> migration(jdbc).run(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ReferenceDataOption")
                .hasMessageContaining("记录数=1");
        assertThat(existingDeprecatedTables(jdbc)).containsExactlyElementsOf(DEPRECATED_TABLES);
    }

    /**
     * 创建使用真实大小写策略的隔离 H2 数据库。
     * 真实传参示例：每个测试生成 UUID 数据库名。
     * 真实返回示例：JdbcTemplate 可按 ReferenceDataOption 原名查询元数据。
     * 异常或副作用示例：连接失败时测试直接失败，不回退正式数据库。
     */
    private JdbcTemplate createDatabase() {
        String databaseName = "deprecated_cleanup_" + UUID.randomUUID().toString().replace("-", "");
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:" + databaseName + ";MODE=LEGACY;DATABASE_TO_UPPER=FALSE;DB_CLOSE_DELAY=-1",
                "sa", "");
        return new JdbcTemplate(dataSource);
    }

    /**
     * 建立与历史正式库同名的四张最小旧表。
     * 真实传参示例：新建的隔离 JdbcTemplate。
     * 真实返回示例：四张表均存在且记录数为零。
     * 异常或副作用示例：重复调用会因表已存在而失败，防止测试夹具含义不清。
     */
    private void createDeprecatedTables(JdbcTemplate jdbc) {
        for (String tableName : DEPRECATED_TABLES) {
            jdbc.execute("CREATE TABLE " + tableName + " (id BIGINT PRIMARY KEY)");
        }
    }

    /**
     * 创建只使用 JdbcTemplate 的迁移实例，当前测试路径不会调用六个新增 Service。
     * 真实传参示例：包含四张旧表且没有最终六表的隔离数据库。
     * 真实返回示例：返回可直接执行 run 的迁移对象。
     * 异常或副作用示例：若迁移错误调用 Service，Mockito 默认空结果会使测试失败并暴露边界变化。
     */
    private ReferenceDataSixTableMigration migration(JdbcTemplate jdbc) {
        return new ReferenceDataSixTableMigration(
                jdbc,
                mock(ReferenceDataTypeService.class),
                mock(ReferenceDataTreeNodeService.class),
                mock(ReferenceDataTableService.class),
                mock(ReferenceDataTableElementService.class),
                mock(ReferenceDataControlLayoutService.class),
                mock(ReferenceDataWindowService.class));
    }

    /**
     * 按固定白名单读取当前仍存在的旧表。
     * 真实传参示例：迁移前返回四个表名，成功迁移后返回空列表。
     * 真实返回示例：顺序与 DEPRECATED_TABLES 一致，便于判断是否发生部分删除。
     * 异常或副作用示例：只读 INFORMATION_SCHEMA，不修改数据库。
     */
    private List<String> existingDeprecatedTables(JdbcTemplate jdbc) {
        return DEPRECATED_TABLES.stream()
                .filter(tableName -> Boolean.TRUE.equals(jdbc.queryForObject(
                        "SELECT COUNT(*) > 0 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME=?",
                        Boolean.class, tableName)))
                .toList();
    }
}
