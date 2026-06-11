package com.sp.selplat.common.db.support;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.sp.selplat.common.db.dao.BaseTemplateDaoTestMapper;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.TransactionFactory;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.h2.jdbcx.JdbcDataSource;

// 测试支撑类统一负责搭建 H2、灌入 JSON 种子数据并产出 Mapper 上下文，避免每个测试方法重复样板代码。
public final class BaseTemplateDaoTestSupport {

    // 测试示例统一复用 demo_user 这张最小演示表，覆盖公共 DAO 最常见的主键、名称和状态字段场景。
    private static final String DEMO_TABLE_NAME = "demo_user";

    // 工具类不承载状态，不允许被实例化。
    private BaseTemplateDaoTestSupport() {
    }

    // 基于指定 JSON 种子数据创建测试上下文，让每个测试都能拿到隔离的数据库和 Mapper 代理。
    public static BaseTemplateDaoTestContext createContext(String seedResourcePath) throws Exception {
        // 每个测试都使用独立内存库名称，避免并行或重复执行时互相污染数据。
        DataSource dataSource = createDataSource("base-template-test-" + UUID.randomUUID());
        // 先建表示例表结构，再把 JSON 里的种子数据灌入数据库，形成当前测试的初始状态。
        prepareDemoSchema(dataSource, BaseTemplateDaoTestJsonUtils.readJsonResource(seedResourcePath, DemoTableData.class));
        // 基于当前数据源创建 MyBatis 会话工厂，供测试拿到真实模板 Mapper。
        SqlSessionFactory sqlSessionFactory = createSqlSessionFactory(dataSource);
        // 打开自动提交会话，让新增、更新和删除结果能立即回查验证。
        SqlSession sqlSession = sqlSessionFactory.openSession(true);
        // 把会话和 Mapper 封装进上下文对象，方便测试按 try-with-resources 管理生命周期。
        return new BaseTemplateDaoTestContext(sqlSession, sqlSession.getMapper(BaseTemplateDaoTestMapper.class));
    }

    // 创建 H2 内存数据源，保证测试不依赖外部数据库环境即可独立运行。
    private static DataSource createDataSource(String databaseName) {
        // H2 自带数据源足以支撑当前公共 DAO 模板测试。
        JdbcDataSource dataSource = new JdbcDataSource();
        // URL 开启 MySQL 兼容模式，尽量贴近业务项目里常见的 SQL 方言。
        dataSource.setURL("jdbc:h2:mem:" + databaseName + ";MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false");
        // 测试统一沿用 H2 默认账号，减少环境参数干扰。
        dataSource.setUser("sa");
        // 测试统一不设置密码，保证任何本地环境都能直接运行。
        dataSource.setPassword("");
        return dataSource;
    }

    // 初始化示例表并写入 JSON 种子数据，形成每个测试方法的独立初始状态。
    private static void prepareDemoSchema(DataSource dataSource, DemoTableData demoTableData) throws Exception {
        // 先校验 JSON 里声明的表名，防止误把测试数据灌入错误的示例表。
        if (!DEMO_TABLE_NAME.equals(demoTableData.physicalTableName())) {
            throw new IllegalArgumentException("当前测试仅支持 demo_user，收到表名: " + demoTableData.physicalTableName());
        }
        // 直接通过 JDBC 建表并写入种子数据，避免引入额外迁移工具增加测试噪声。
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            // 建立一个覆盖主键、登录名、显示名和状态字段的最小表示例表。
            statement.execute("""
                CREATE TABLE demo_user (
                    id BIGINT PRIMARY KEY,
                    login_name VARCHAR(100) NOT NULL,
                    display_name VARCHAR(100) NOT NULL,
                    user_status VARCHAR(30) NOT NULL
                )
                """);
            // 使用预编译语句逐行写入 JSON 种子数据，让测试初始数据完全由资源文件驱动。
            try (PreparedStatement preparedStatement = connection.prepareStatement(
                "INSERT INTO demo_user (id, login_name, display_name, user_status) VALUES (?, ?, ?, ?)"
            )) {
                // 逐条遍历 JSON 里的表数据，把每行业务数据稳定写入 H2。
                for (Map<String, Object> row : demoTableData.tableData()) {
                    // 第一列写入主键，保证后续主键查询和更新删除都能命中目标行。
                    preparedStatement.setLong(1, ((Number) row.get("id")).longValue());
                    // 第二列写入登录名，支撑等值查询和结果断言。
                    preparedStatement.setString(2, String.valueOf(row.get("login_name")));
                    // 第三列写入显示名称，支撑模糊查询和更新断言。
                    preparedStatement.setString(3, String.valueOf(row.get("display_name")));
                    // 第四列写入业务状态，支撑等值查询和更新后的状态校验。
                    preparedStatement.setString(4, String.valueOf(row.get("user_status")));
                    // 当前行参数就绪后立即加入批次，保持种子数据与 JSON 顺序一致。
                    preparedStatement.addBatch();
                }
                // 一次性提交所有种子数据，减少 JDBC 往返并确保初始化原子性。
                preparedStatement.executeBatch();
            }
        }
    }

    // 创建会话工厂时只注册测试 Mapper，让测试聚焦在公共模板本身而不是业务层扫描。
    private static SqlSessionFactory createSqlSessionFactory(DataSource dataSource) {
        // JDBC 事务工厂足以覆盖当前内存数据库下的模板 CRUD 测试。
        TransactionFactory transactionFactory = new JdbcTransactionFactory();
        // MyBatis 运行环境把数据源和事务工厂绑定起来，形成测试最小运行单元。
        Environment environment = new Environment("base-template-dao-test", transactionFactory, dataSource);
        // 创建配置对象，准备注册公共 DAO 的测试 Mapper。
        Configuration configuration = new Configuration(environment);
        // 注册继承 BaseTemplateDao 的测试 Mapper，让注解式模板在测试环境中被解析成代理。
        configuration.addMapper(BaseTemplateDaoTestMapper.class);
        return new SqlSessionFactoryBuilder().build(configuration);
    }

    // 测试上下文统一封装 MyBatis 会话和 Mapper，方便测试方法按资源块控制生命周期。
    public static final class BaseTemplateDaoTestContext implements AutoCloseable {

        // 会话对象承接当前测试和 H2 的真实数据库交互。
        private final SqlSession sqlSession;
        // Mapper 代理对象承接当前测试对公共 DAO 模板的实际调用。
        private final BaseTemplateDaoTestMapper mapper;

        // 创建上下文时直接收口会话和 Mapper，避免外部再次做组装。
        public BaseTemplateDaoTestContext(SqlSession sqlSession, BaseTemplateDaoTestMapper mapper) {
            // 保存当前测试会话，供 close 时统一释放数据库资源。
            this.sqlSession = sqlSession;
            // 保存当前测试 Mapper，供测试方法直接调用公共模板。
            this.mapper = mapper;
        }

        // 对外暴露 Mapper 代理，让测试方法聚焦在模板行为验证。
        public BaseTemplateDaoTestMapper mapper() {
            return mapper;
        }

        // 关闭上下文时统一释放 MyBatis 会话，避免测试资源泄露。
        @Override
        public void close() {
            // 关闭会话即可同时释放当前测试持有的数据库连接。
            sqlSession.close();
        }
    }

    // JSON 种子文件映射对象沿用 SBMAB203 的物理表名加 tableData 风格，方便后续继续扩展更多表测试。
    public record DemoTableData(
        // physicalTableName 记录当前 JSON 资源对应的物理表，用来校验数据文件是否投喂到正确测试表。
        @JsonProperty("physicalTableName") String physicalTableName,
        // tableData 承接 JSON 资源中的多行种子数据，供测试初始化数据库。
        @JsonProperty("tableData") List<Map<String, Object>> tableData
    ) {
    }
}
