package com.sp.selplat.referencedata.common.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.capability.configuration.service.impl.ReferenceDataConfigurationServiceImpl;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;

/** 使用隔离 H2 文件验证六表结构、全局号段、code 查询与页面原子保存。 */
class ReferenceDataSixTablePersistenceTest {

    /**
     * 验证全新数据库只创建六张业务表和一张全局号段表。
     * 真实传参示例：JUnit 临时目录中的空 H2 文件。
     * 真实返回示例：PUBLIC 下恰好七张表且唯一号段为 {@code ReferenceDataObjectId}。
     * 异常或副作用示例：只写临时目录，连接池关闭后不影响正式数据库。
     *
     * @param temporaryDirectory JUnit 隔离临时目录
     */
    @Test
    void shouldCreateOnlyFinalSixBusinessTables(@TempDir Path temporaryDirectory) {
        try (HikariDataSource dataSource = open(temporaryDirectory.resolve("six-table"), "SixTablePool")) {
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            List<String> tables = jdbc.queryForList(
                    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC' ORDER BY TABLE_NAME",
                    String.class);
            assertEquals(List.of("CommonSequenceSegment", "ReferenceDataControlLayout", "ReferenceDataTable",
                    "ReferenceDataTableElement", "ReferenceDataTreeNode", "ReferenceDataType", "ReferenceDataWindow"), tables);
            assertEquals(List.of("ReferenceDataObjectId"), jdbc.queryForList(
                    "SELECT seqCode FROM CommonSequenceSegment ORDER BY seqCode", String.class));
            assertFalse(tables.contains("ReferenceDataOption"));
            assertFalse(tables.contains("ReferenceDataContextMenuItem"));
            assertFalse(tables.contains("ReferenceDataTableColumn"));
            assertFalse(tables.contains("ReferenceDataControlBinding"));
        }
    }

    /**
     * 验证页面配置按 code 查询、按 tableId 关联并以版本号保存列宽。
     * 真实传参示例：页面 {@code page101000} 保存元素 {@code tableElement101002} 宽度为 240px。
     * 真实返回示例：查询来源为 ReferenceDataTableElement，保存后版本为 2 且数据库宽度为 240px。
     * 异常或副作用示例：只修改测试临时库；请求身份不由测试参数提供。
     *
     * @param temporaryDirectory JUnit 隔离临时目录
     */
    @Test
    @SuppressWarnings("unchecked")
    void shouldResolveCodeAndSavePageConfiguration(@TempDir Path temporaryDirectory) {
        try (HikariDataSource dataSource = open(temporaryDirectory.resolve("page-save"), "PageSavePool")) {
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            jdbc.update("INSERT INTO ReferenceDataControlLayout "
                    + "(id,code,projectCode,pageCode,controlKind,sourceTableName,layoutMode,breakpoint,editable,versionNo) "
                    + "VALUES (?,?,?,?,?,?,?,?,?,?)", 101000L, "page101000", "reference-data",
                    "page101000", "PAGE", "ReferenceDataControlLayout", "FLOW", "DESKTOP", true, 1L);
            jdbc.update("INSERT INTO ReferenceDataTable "
                    + "(id,code,projectCode,pageCode,dataTableName,nameZh) VALUES (?,?,?,?,?,?)",
                    101001L, "table101001", "reference-data", "page101000", "ReferenceDataType", "数据类型");
            jdbc.update("INSERT INTO ReferenceDataTableElement "
                    + "(id,code,projectCode,tableId,fieldName,labelZh,width) VALUES (?,?,?,?,?,?,?)",
                    101002L, "tableElement101002", "reference-data", 101001L, "nameZh", "中文名称", "160px");
            ReferenceDataConfigurationServiceImpl service = new ReferenceDataConfigurationServiceImpl(jdbc);

            CommonResult capability = service.getPageEditorCapability();
            assertEquals(true, ((Map<String, Object>) capability.getData()).get("canEditPage"));
            Map<String, Object> resolved = (Map<String, Object>) service.getByCode("tableElement101002").getData();
            assertEquals("ReferenceDataTableElement", resolved.get("sourceTable"));
            Map<String, Object> baseline = (Map<String, Object>) service
                    .getPageConfiguration("page101000").getData();
            assertEquals(1L, ((Number) baseline.get("version")).longValue());
            assertEquals(1, ((List<?>) baseline.get("tableElements")).size());

            CommonResult saved = service.savePageConfiguration("page101000", Map.of(
                    "baseVersion", 1,
                    "tableElements", List.of(Map.of("code", "tableElement101002", "width", "240px"))));
            assertTrue(saved.isSuccess());
            assertEquals("240px", jdbc.queryForObject(
                    "SELECT width FROM ReferenceDataTableElement WHERE code='tableElement101002'", String.class));
            assertEquals(2L, jdbc.queryForObject(
                    "SELECT versionNo FROM ReferenceDataControlLayout WHERE code='page101000'", Long.class));
        }
    }

    /**
     * 创建并初始化一个只属于当前测试的 reference-data H2 文件库。
     * 真实传参示例：数据库基础路径 {@code /tmp/six-table}，池名 {@code SixTablePool}。
     * 真实返回示例：返回已执行六个业务表结构、公共号段结构和号段数据脚本的 HikariDataSource。
     * 异常或副作用示例：初始化失败时抛出系统异常；成功时调用方必须关闭连接池。
     *
     * @param databaseBase 临时数据库基础路径
     * @param poolName 测试连接池名称
     * @return 已初始化的临时连接池
     */
    private HikariDataSource open(Path databaseBase, String poolName) {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:file:" + databaseBase.toAbsolutePath().normalize()
                + ";MODE=MySQL;DATABASE_TO_UPPER=false");
        config.setPoolName(poolName);
        config.setUsername("sa");
        config.setPassword("");
        config.setDriverClassName("org.h2.Driver");
        config.setMaximumPoolSize(2);
        return new ReferenceDataPersistenceConfiguration().referenceDataDataSource(config);
    }
}
