package com.sp.selplat.common.db.dao;

import com.fasterxml.jackson.annotation.JsonProperty;
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

// BaseDaoTestSupport 专门服务 BaseDaoTest，负责搭建最小 H2 环境并产出可直接调用的模板 Mapper。
public final class BaseDaoTestSupport {

    // 当前测试统一围绕 demo_user 这张最小演示表展开，覆盖列表、主键回查和简单写操作场景。
    private static final String DEMO_TABLE_NAME = "demo_user";

    // 工具类不承载状态，只提供静态搭建能力，因此不允许被实例化。
    private BaseDaoTestSupport() {
    }

    // 基于指定 JSON 种子数据创建测试上下文，让每个测试方法都拿到隔离数据库和 Mapper 代理。
    public static BaseDaoTestContext createContext(String seedResourcePath) throws Exception {
        // 每个测试都生成独立内存库名，避免多次运行时彼此污染数据库状态。
        DataSource dataSource = createDataSource("base-dao-test-" + UUID.randomUUID());
        // 先建立 demo_user 表，再把 JSON 资源里的种子数据写进去，形成当前测试的初始状态。
        prepareDemoSchema(dataSource, BaseDaoTestJsonUtils.readJsonResource(seedResourcePath, DemoTableData.class));
        // 基于当前数据源创建 MyBatis 会话工厂，让测试拿到真实的模板 Mapper 代理。
        SqlSessionFactory sqlSessionFactory = createSqlSessionFactory(dataSource);
        // 打开自动提交会话，保证增删改执行后可以立即被回查断言验证。
        SqlSession sqlSession = sqlSessionFactory.openSession(true);
        // 把会话和 Mapper 封装进上下文对象，方便测试按 try-with-resources 自动管理生命周期。
        return new BaseDaoTestContext(sqlSession, sqlSession.getMapper(BaseDaoTestMapper.class));
    }

    // 创建 H2 内存数据源，让当前测试完全脱离外部数据库即可独立运行。
    private static DataSource createDataSource(String databaseName) {
        // H2 自带数据源已经足够覆盖公共 DAO 的离线测试场景。
        JdbcDataSource dataSource = new JdbcDataSource();
        // URL 开启 MySQL 兼容模式，尽量贴近业务项目里 MyBatis 常见的 SQL 语法口径。
        dataSource.setURL("jdbc:h2:mem:" + databaseName + ";MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false");
        // 测试统一使用 H2 默认账号，避免引入额外环境参数。
        dataSource.setUser("sa");
        // 测试统一不设置密码，保证任何本地环境都能直接运行。
        dataSource.setPassword("");
        return dataSource;
    }

    // 初始化示例表并写入 JSON 种子数据，让每个测试都从确定的数据库状态开始。
    private static void prepareDemoSchema(DataSource dataSource, DemoTableData demoTableData) throws Exception {
        // JSON 资源声明的物理表必须是 demo_user，否则说明当前测试数据投喂错了表。
        if (!DEMO_TABLE_NAME.equals(demoTableData.physicalTableName())) {
            throw new IllegalArgumentException("当前测试仅支持 demo_user，收到表名: " + demoTableData.physicalTableName());
        }
        // 直接用 JDBC 建表和灌数，避免引入额外迁移工具干扰公共 DAO 测试。
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            // 建立覆盖主键、登录名、显示名和状态字段的最小表示例表。
            statement.execute("""
                CREATE TABLE demo_user (
                    id BIGINT PRIMARY KEY,
                    login_name VARCHAR(100) NOT NULL,
                    display_name VARCHAR(100) NOT NULL,
                    user_status VARCHAR(30) NOT NULL
                )
                """);
            // 使用预编译语句逐行写入 JSON 资源中的种子数据，保证初始状态完全由资源文件驱动。
            try (PreparedStatement preparedStatement = connection.prepareStatement(
                "INSERT INTO demo_user (id, login_name, display_name, user_status) VALUES (?, ?, ?, ?)"
            )) {
                // 遍历 JSON 里的每一行业务数据，把它们稳定写入 H2。
                for (Map<String, Object> row : demoTableData.tableData()) {
                    // 第一列写入主键，供后续主键回查、更新和删除场景唯一命中记录。
                    preparedStatement.setLong(1, ((Number) row.get("id")).longValue());
                    // 第二列写入登录名，供列表和新增后断言复用。
                    preparedStatement.setString(2, String.valueOf(row.get("login_name")));
                    // 第三列写入显示名，供列表、更新和回查断言复用。
                    preparedStatement.setString(3, String.valueOf(row.get("display_name")));
                    // 第四列写入业务状态，供等值查询和更新后断言复用。
                    preparedStatement.setString(4, String.valueOf(row.get("user_status")));
                    // 当前行参数就绪后加入批次，保证初始化效率和数据顺序稳定。
                    preparedStatement.addBatch();
                }
                // 一次性提交全部种子数据，形成当前测试的完整初始状态。
                preparedStatement.executeBatch();
            }
        }
    }

    // 创建会话工厂时只注册当前测试专用 Mapper，让验证焦点始终集中在公共 DAO 模板本身。
    private static SqlSessionFactory createSqlSessionFactory(DataSource dataSource) {
        // JDBC 事务工厂足以覆盖 H2 下的公共 DAO CRUD 测试。
        TransactionFactory transactionFactory = new JdbcTransactionFactory();
        // MyBatis 运行环境把数据源和事务工厂绑定起来，形成当前测试的最小运行单元。
        Environment environment = new Environment("base-dao-test", transactionFactory, dataSource);
        // 创建配置对象，准备注册当前测试专用的模板 Mapper。
        Configuration configuration = new Configuration(environment);
        // 注册当前测试 Mapper，让注解式模板在测试环境中被解析成可调用代理。
        configuration.addMapper(BaseDaoTestMapper.class);
        return new SqlSessionFactoryBuilder().build(configuration);
    }

    // BaseDaoTestContext 统一封装当前测试的会话和 Mapper，方便测试方法聚焦在业务断言。
    public static final class BaseDaoTestContext implements AutoCloseable {

        // 当前测试会话承接对 H2 数据库的真实访问。
        private final SqlSession sqlSession;
        // 当前测试 Mapper 代理承接对公共模板 SQL 的真实调用。
        private final BaseDaoTestMapper mapper;

        // 创建上下文时直接保存会话和 Mapper，避免测试方法重复做组装。
        public BaseDaoTestContext(SqlSession sqlSession, BaseDaoTestMapper mapper) {
            // 保存当前测试会话，供 close 时统一释放底层数据库连接。
            this.sqlSession = sqlSession;
            // 保存当前测试 Mapper，让测试方法可以直接执行模板 SQL。
            this.mapper = mapper;
        }

        // 对外暴露 Mapper 代理，让测试方法聚焦在 BaseDao 的行为验证。
        public BaseDaoTestMapper mapper() {
            return mapper;
        }

        // 关闭上下文时统一释放当前测试持有的 MyBatis 会话资源。
        @Override
        public void close() {
            // 关闭会话即可同时释放当前测试对应的数据库连接。
            sqlSession.close();
        }
    }

    // DemoTableData 映射 JSON 测试资源里的物理表名和种子数据，供初始化数据库时直接消费。
    public record DemoTableData(
        // physicalTableName 标记当前 JSON 资源属于哪张物理表，供初始化前先做表名校验。
        @JsonProperty("physicalTableName") String physicalTableName,
        // tableData 承接 JSON 资源里的多行种子数据，供 JDBC 初始化脚本逐行写入。
        @JsonProperty("tableData") List<Map<String, Object>> tableData
    ) {
    }
}
