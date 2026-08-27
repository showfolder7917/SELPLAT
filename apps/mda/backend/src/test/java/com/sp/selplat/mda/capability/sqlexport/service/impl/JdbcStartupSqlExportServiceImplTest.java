package com.sp.selplat.mda.capability.sqlexport.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.common.util.jdbc.JdbcConnectionFactory;
import com.sp.selplat.mda.common.util.jdbc.MdaConnectionDefinition;
import com.sp.selplat.mda.common.util.jdbc.MdaConnectionDefinitionResolver;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * 在临时 SELPLAT 根和隔离 H2 中验证启动 SQL 导出的目录归属、完整内容与失败前置门禁。
 */
class JdbcStartupSqlExportServiceImplTest {

    // 每个测试使用独立临时工程，禁止读写正式 apps/mda/db。
    @TempDir
    Path testRoot;

    private String jdbcUrl;
    private MdaConnectionDefinitionResolver definitionResolver;
    private JdbcConnectionFactory connectionFactory;

    /**
     * 建立中央登记、应用启动目录和共享内存 H2。
     * 真实传参示例：JUnit 为 {@code testRoot} 注入新的临时目录。
     * 真实返回示例：无返回值；后续服务把 {@code file:./apps/mda/db/mda} 映射到临时 {@code apps/mda/db/sql}。
     * 异常或副作用示例：只创建临时文件和内存数据库，测试结束由 JUnit 清理。
     *
     * @throws Exception 临时文件或内存 H2 初始化失败时直接终止当前测试
     */
    @BeforeEach
    void setUp() throws Exception {
        Files.writeString(testRoot.resolve("settings.gradle"), "rootProject.name='test'\n", StandardCharsets.UTF_8);
        Files.writeString(testRoot.resolve("AGENTS.md"), "- 当前稳定用户 ID：`TESTUSER`\n", StandardCharsets.UTF_8);
        Path registry = testRoot.resolve(
                "apps/ai-desktop/ruleengine/rules/local/TESTUSER/selplat/通用/registry/managed-database-applications.json");
        Files.createDirectories(registry.getParent());
        Files.writeString(registry, """
                {
                  "version": 1,
                  "applications": [{
                    "projectName": "mda",
                    "schemaRoot": "db/sql",
                    "databaseFile": "db/mda.mv.db"
                  }]
                }
                """, StandardCharsets.UTF_8);
        Files.createDirectories(testRoot.resolve("apps/mda/db/sql"));

        jdbcUrl = "jdbc:h2:mem:mda_export_" + System.nanoTime()
                + ";MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false";
        definitionResolver = mock(MdaConnectionDefinitionResolver.class);
        connectionFactory = mock(JdbcConnectionFactory.class);
        when(definitionResolver.resolve(any(CommonParam.class))).thenReturn(definition("file:./apps/mda/db/mda"));
        when(connectionFactory.open(any(MdaConnectionDefinition.class)))
                .thenAnswer(ignored -> DriverManager.getConnection(jdbcUrl, "sa", ""));
    }

    /**
     * 验证单表右键导出会生成一表一份结构和数据 SQL，并保留主键、索引、注释及完整值。
     * 真实传参示例：DemoItem 含两行，其中一行文本包含单引号。
     * 真实返回示例：结果为 {@code tableCount=1,rowCount=2}，两个文件均位于 {@code apps/mda/db/sql}。
     * 异常或副作用示例：测试只写临时启动目录，不执行生成的 SQL。
     *
     * @throws Exception 隔离 H2 建表或临时文件读取失败时终止测试
     */
    @Test
    void exportsOnePhysicalTableWithSchemaAndAllRows() throws Exception {
        createGoodTables();
        JdbcStartupSqlExportServiceImpl service = service();

        CommonParam request = tableRequest("DemoItem");
        CommonResult result = service.exportTable(request);

        assertThat(result.isSuccess()).isTrue();
        Map<?, ?> dataMap = (Map<?, ?>) result.getData();
        assertThat(dataMap.get("projectName")).isEqualTo("mda");
        assertThat(dataMap.get("tableCount")).isEqualTo(1);
        assertThat(dataMap.get("rowCount")).isEqualTo(2L);
        assertThat(dataMap.get("outputDirectory")).isEqualTo("apps/mda/db/sql");
        String schema = Files.readString(testRoot.resolve("apps/mda/db/sql/schema-DemoItem.sql"));
        String data = Files.readString(testRoot.resolve("apps/mda/db/sql/data-DemoItem.sql"));
        assertThat(schema)
                .contains("CREATE TABLE IF NOT EXISTS DemoItem")
                .contains("PRIMARY KEY (id)")
                .contains("CREATE UNIQUE INDEX IF NOT EXISTS UK_DemoItem_Code")
                .contains("COMMENT ON TABLE DemoItem IS '演示条目表'")
                .contains("COMMENT ON COLUMN DemoItem.labelZh IS '中文名称'");
        assertThat(data)
                .contains("INSERT INTO DemoItem")
                .contains("'学生''甲'")
                .contains("WHERE NOT EXISTS (SELECT 1 FROM DemoItem WHERE id = 1)")
                .contains("WHERE NOT EXISTS (SELECT 1 FROM DemoItem WHERE id = 2)");
    }

    /**
     * 验证数据库右键导出遍历业务 Schema 的全部物理表，但不把视图导出为表启动 SQL。
     * 真实传参示例：PUBLIC 中包含 DemoItem、DemoCategory 和 DemoView。
     * 真实返回示例：结果为 {@code tableCount=2,rowCount=3}，不存在 {@code schema-DemoView.sql}。
     * 异常或副作用示例：视图仍保留在内存数据库中，仅被导出范围排除。
     *
     * @throws Exception 隔离 H2 建表或临时文件检查失败时终止测试
     */
    @Test
    void exportsAllPhysicalTablesButSkipsViews() throws Exception {
        createGoodTables();
        JdbcStartupSqlExportServiceImpl service = service();

        CommonParam request = new CommonParam();
        request.putParam("connectionId", 1L);
        CommonResult result = service.exportDatabase(request);

        Map<?, ?> dataMap = (Map<?, ?>) result.getData();
        assertThat(dataMap.get("tableCount")).isEqualTo(2);
        assertThat(dataMap.get("rowCount")).isEqualTo(3L);
        assertThat(testRoot.resolve("apps/mda/db/sql/schema-DemoItem.sql")).exists();
        assertThat(testRoot.resolve("apps/mda/db/sql/schema-DemoCategory.sql")).exists();
        assertThat(testRoot.resolve("apps/mda/db/sql/schema-DemoView.sql")).doesNotExist();

        // 导出的结构和数据在全新 H2 中按结构后数据执行两次，证明可重建且不会重复插入。
        String rebuildUrl = "jdbc:h2:mem:mda_export_rebuild_" + System.nanoTime()
                + ";MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false";
        try (Connection rebuilt = DriverManager.getConnection(rebuildUrl, "sa", "")) {
            executeSqlFile(rebuilt, "schema-DemoCategory.sql");
            executeSqlFile(rebuilt, "schema-DemoItem.sql");
            executeSqlFile(rebuilt, "data-DemoCategory.sql");
            executeSqlFile(rebuilt, "data-DemoItem.sql");
            executeSqlFile(rebuilt, "data-DemoCategory.sql");
            executeSqlFile(rebuilt, "data-DemoItem.sql");
            try (var rows = rebuilt.createStatement().executeQuery("SELECT COUNT(*) FROM DemoItem")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getLong(1)).isEqualTo(2L);
            }
        }
    }

    /**
     * 验证整库导出在任一表缺少中文业务注释时于正式写入前阻断，并保留已有文件正文。
     * 真实传参示例：Good 表已经具有旧启动 SQL，BadTable 没有 COMMENT。
     * 真实返回示例：抛出 {@code MDA_EXPORT_CHINESE_COMMENT_REQUIRED}，旧文件仍为 {@code keep-original}。
     * 异常或副作用示例：不会生成 BadTable 文件，也不会留下 export 临时文件。
     *
     * @throws Exception 隔离 H2 或临时文件准备失败时终止测试
     */
    @Test
    void blocksWholeDatabaseBeforeWritingWhenAnyTableFailsGate() throws Exception {
        createGoodTables();
        try (Connection connection = DriverManager.getConnection(jdbcUrl, "sa", "");
                Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE BadTable (id BIGINT PRIMARY KEY, valueText VARCHAR(40))");
        }
        Path existing = testRoot.resolve("apps/mda/db/sql/schema-DemoItem.sql");
        Files.writeString(existing, "keep-original", StandardCharsets.UTF_8);

        assertThatThrownBy(() -> service().exportDatabase(new CommonParam()))
                .isInstanceOf(CommonBusinessException.class)
                .hasMessageContaining("缺少中文业务注释");
        assertThat(Files.readString(existing)).isEqualTo("keep-original");
        assertThat(testRoot.resolve("apps/mda/db/sql/schema-BadTable.sql")).doesNotExist();
        try (var files = Files.list(testRoot.resolve("apps/mda/db/sql"))) {
            assertThat(files.map(path -> path.getFileName().toString()))
                    .noneMatch(name -> name.contains(".export-") || name.endsWith(".tmp"));
        }
    }

    /**
     * 验证未匹配中央登记的数据库连接无法根据显示名或路径片段猜测输出目录。
     * 真实传参示例：连接坐标为 {@code file:./apps/unknown/db/unknown}。
     * 真实返回示例：抛出 {@code MDA_EXPORT_APPLICATION_NOT_REGISTERED} 对应业务提示。
     * 异常或副作用示例：不会创建 {@code apps/unknown} 或任何 SQL 文件。
     */
    @Test
    void rejectsDatabaseOutsideCentralRegistry() {
        when(definitionResolver.resolve(any(CommonParam.class)))
                .thenReturn(definition("file:./apps/unknown/db/unknown"));

        assertThatThrownBy(() -> service().exportDatabase(new CommonParam()))
                .isInstanceOf(CommonBusinessException.class)
                .hasMessageContaining("没有唯一匹配中央登记");
        assertThat(testRoot.resolve("apps/unknown")).doesNotExist();
    }

    /** 创建测试服务并绑定临时工程根。 */
    private JdbcStartupSqlExportServiceImpl service() {
        return new JdbcStartupSqlExportServiceImpl(definitionResolver, connectionFactory, testRoot);
    }

    /** 创建一份 H2 文件坐标连接定义，真实数据库连接由 mock 工厂指向内存库。 */
    private MdaConnectionDefinition definition(String databaseName) {
        return new MdaConnectionDefinition(
                "H2", "", null, databaseName, "PUBLIC", "sa", "", "", "", true);
    }

    /** 创建单表导出请求。 */
    private CommonParam tableRequest(String tableName) {
        CommonParam request = new CommonParam();
        request.putParam("connectionId", 1L);
        request.putParam("schema", "PUBLIC");
        request.putParam("tableName", tableName);
        return request;
    }

    /**
     * 创建两张含中文元数据注释的物理表、一张视图和三行测试数据。
     *
     * @throws Exception H2 DDL、COMMENT 或 INSERT 失败时终止测试
     */
    private void createGoodTables() throws Exception {
        try (Connection connection = DriverManager.getConnection(jdbcUrl, "sa", "");
                Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE DemoCategory (
                        id BIGINT PRIMARY KEY,
                        labelZh VARCHAR(80) NOT NULL
                    )
                    """);
            statement.execute("COMMENT ON TABLE DemoCategory IS '演示分类表'");
            statement.execute("COMMENT ON COLUMN DemoCategory.id IS '分类主键'");
            statement.execute("COMMENT ON COLUMN DemoCategory.labelZh IS '中文名称'");
            statement.execute("INSERT INTO DemoCategory (id,labelZh) VALUES (10,'学习')");

            statement.execute("""
                    CREATE TABLE DemoItem (
                        id BIGINT PRIMARY KEY,
                        categoryId BIGINT NOT NULL,
                        itemCode VARCHAR(40) NOT NULL,
                        labelZh VARCHAR(80) NOT NULL,
                        enabled BOOLEAN NOT NULL DEFAULT TRUE,
                        CONSTRAINT FK_DemoItem_Category FOREIGN KEY (categoryId) REFERENCES DemoCategory(id)
                    )
                    """);
            statement.execute("CREATE UNIQUE INDEX UK_DemoItem_Code ON DemoItem(itemCode)");
            statement.execute("COMMENT ON TABLE DemoItem IS '演示条目表'");
            statement.execute("COMMENT ON COLUMN DemoItem.id IS '条目主键'");
            statement.execute("COMMENT ON COLUMN DemoItem.categoryId IS '所属分类主键'");
            statement.execute("COMMENT ON COLUMN DemoItem.itemCode IS '稳定业务编码'");
            statement.execute("COMMENT ON COLUMN DemoItem.labelZh IS '中文名称'");
            statement.execute("COMMENT ON COLUMN DemoItem.enabled IS '启用状态'");
            statement.execute("INSERT INTO DemoItem (id,categoryId,itemCode,labelZh) VALUES (1,10,'student-a','学生''甲')");
            statement.execute("INSERT INTO DemoItem (id,categoryId,itemCode,labelZh,enabled) VALUES (2,10,'student-b','学生乙',FALSE)");
            statement.execute("CREATE VIEW DemoView AS SELECT id,labelZh FROM DemoItem");
        }
    }

    /**
     * 在重建库中执行一个导出的启动 SQL 文件。
     *
     * @param connection 全新或已完成一次启动的隔离 H2 连接
     * @param fileName 临时应用 db/sql 下的文件名，例如 {@code schema-DemoItem.sql}
     *     <p>真实返回示例：无返回值；文件中的全部语句按顺序执行。
     *     <p>异常或副作用示例：任一 SQL 不兼容或不幂等时抛出异常并使测试失败，只影响内存库。
     * @throws Exception 文件读取或 SQL 执行失败时抛出
     */
    private void executeSqlFile(Connection connection, String fileName) throws Exception {
        String sql = Files.readString(testRoot.resolve("apps/mda/db/sql").resolve(fileName));
        String withoutComments = sql.replaceAll("(?m)--[^\\r\\n]*$", "");
        try (Statement statement = connection.createStatement()) {
            for (String command : withoutComments.split(";")) {
                if (!command.isBlank()) statement.execute(command.trim());
            }
        }
    }
}
