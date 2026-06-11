package com.sp.selplat.common.db.demo;

import com.sp.selplat.common.db.dao.BaseTemplateDaoDemoMapper;
import com.sp.selplat.common.db.domain.CommonTemplateLikeQuery;
import com.sp.selplat.common.db.domain.CommonTemplateQuery;
import com.sp.selplat.common.db.domain.CommonTemplateSaveIn;
import com.sp.selplat.common.db.domain.CommonTemplateUpdateIn;
import java.sql.Connection;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.TransactionFactory;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.h2.jdbcx.JdbcDataSource;

// BaseTemplateDaoMain 演示如何在不依赖 Spring Boot 的情况下直接运行注解式公共 DAO 模板。
public class BaseTemplateDaoMain {

    // main 方法负责搭建内存数据库、注册 Mapper 并顺序执行模板查询、新增、更新和删除操作。
    public static void main(String[] args) throws Exception {
        // 先构建 H2 内存数据源，让示例不依赖外部数据库即可独立运行。
        DataSource dataSource = createDataSource();
        // 初始化演示表和初始数据，保证模板方法一启动就有可查询数据。
        prepareDemoSchema(dataSource);
        // 用原生 MyBatis 配置把演示 Mapper 注册进会话工厂，复刻业务项目拿 Mapper 代理的方式。
        SqlSessionFactory sqlSessionFactory = createSqlSessionFactory(dataSource);
        // 打开自动提交会话，方便示例里的新增、更新和删除立即落到内存库。
        try (SqlSession sqlSession = sqlSessionFactory.openSession(true)) {
            // 从 MyBatis 会话中取出继承 BaseTemplateDao 的真实 Mapper 代理对象。
            BaseTemplateDaoDemoMapper mapper = sqlSession.getMapper(BaseTemplateDaoDemoMapper.class);
            // 先按主键查询一条初始数据，演示最基础的动态表名模板查询。
            Map<String, Object> userById = mapper.selectById("demo_user", "id, login_name, display_name", "id", 1L);
            System.out.println("selectById => " + userById);

            // 构造等值查询入参，演示 selectListByQuery 和 selectCountByQuery 的通用查询方式。
            CommonTemplateQuery activeUserQuery = buildActiveUserQuery();
            System.out.println("selectListByQuery => " + mapper.selectListByQuery(activeUserQuery));
            System.out.println("selectCountByQuery => " + mapper.selectCountByQuery(activeUserQuery));

            // 构造模糊查询入参，演示对 display_name 做 like 检索的模板写法。
            CommonTemplateLikeQuery likeQuery = buildDisplayNameLikeQuery();
            System.out.println("selectListByLike => " + mapper.selectListByLike(likeQuery));

            // 构造新增入参，把一条新用户通过模板 insert 直接写入演示表。
            CommonTemplateSaveIn saveIn = buildInsertIn();
            mapper.insert(saveIn);
            System.out.println("after insert => " + mapper.selectById("demo_user", "id, login_name, display_name, user_status", "id", 3L));

            // 构造更新入参，把刚新增用户的显示名称和状态改掉，演示模板 updateById 的使用方式。
            CommonTemplateUpdateIn updateIn = buildUpdateIn();
            mapper.updateById(updateIn);
            System.out.println("after update => " + mapper.selectById("demo_user", "id, login_name, display_name, user_status", "id", 3L));

            // 最后按主键删除新增用户，演示模板 deleteById 的调用方式并回查总数变化。
            mapper.deleteById("demo_user", "id", 3L);
            System.out.println("after delete count => " + mapper.selectCountByQuery(activeUserQuery));
        }
    }

    // 创建数据源时固定使用 H2 内存库，方便在任何本地环境快速验证模板行为。
    private static DataSource createDataSource() {
        // H2 自带 JDBC 数据源实现，足够支撑这次单机演示。
        JdbcDataSource dataSource = new JdbcDataSource();
        // URL 使用 MySQL 模式，尽量贴近业务库的 SQL 习惯。
        dataSource.setURL("jdbc:h2:mem:base_template_demo;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false");
        // 演示库直接使用 H2 默认账号。
        dataSource.setUser("sa");
        // 演示库不设置密码，减少本地试用门槛。
        dataSource.setPassword("");
        return dataSource;
    }

    // 初始化表结构和种子数据，确保 main 一启动就能看见模板方法的执行结果。
    private static void prepareDemoSchema(DataSource dataSource) throws Exception {
        // 直接打开 JDBC 连接执行 DDL 和种子数据写入，避免引入额外迁移工具。
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            // 建立一个最小用户表示例，字段覆盖主键、编码、名称和状态四类常见模板场景。
            statement.execute("""
                CREATE TABLE demo_user (
                    id BIGINT PRIMARY KEY,
                    login_name VARCHAR(100) NOT NULL,
                    display_name VARCHAR(100) NOT NULL,
                    user_status VARCHAR(30) NOT NULL
                )
                """);
            // 预置两条数据，方便后续主键查询、等值查询和模糊查询都能直接看到结果。
            statement.execute("""
                INSERT INTO demo_user (id, login_name, display_name, user_status) VALUES
                (1, 'admin', '平台管理员', 'ACTIVE'),
                (2, 'tenant-admin', '租户管理员', 'ACTIVE')
                """);
        }
    }

    // 创建会话工厂时只注册演示 Mapper，保持示例聚焦在 BaseTemplateDao 的使用方式上。
    private static SqlSessionFactory createSqlSessionFactory(DataSource dataSource) {
        // JDBC 事务工厂足以处理单机示例中的自动提交事务。
        TransactionFactory transactionFactory = new JdbcTransactionFactory();
        // MyBatis 运行环境绑定数据源和事务工厂，形成最小可运行配置。
        Environment environment = new Environment("base-template-demo", transactionFactory, dataSource);
        // 创建 MyBatis 配置对象，为演示 Mapper 生成代理。
        Configuration configuration = new Configuration(environment);
        // 注册继承 BaseTemplateDao 的演示 Mapper，让注解式模板方法参与 MyBatis 解析。
        configuration.addMapper(BaseTemplateDaoDemoMapper.class);
        return new SqlSessionFactoryBuilder().build(configuration);
    }

    // 构造等值查询入参，演示如何把动态表名、列清单和条件集合交给模板 DAO。
    private static CommonTemplateQuery buildActiveUserQuery() {
        // 创建通用查询对象，承接 demo_user 表的条件检索配置。
        CommonTemplateQuery query = new CommonTemplateQuery();
        // 指定目标表，告诉模板 SQL 本次要查 demo_user。
        query.setTableName("demo_user");
        // 指定返回列清单，避免把所有列都查出来。
        query.setSelectColumns("id, login_name, display_name, user_status");
        // 这里用 LinkedHashMap 保持条件顺序稳定，方便调试打印时阅读。
        Map<String, Object> queryMap = new LinkedHashMap<>();
        // 只查询激活状态账号，演示等值条件模板写法。
        queryMap.put("user_status", "ACTIVE");
        // 把条件集合放进查询对象，供模板 SQL 动态展开 where 子句。
        query.setQueryColumnValueMap(queryMap);
        // 追加主键升序，保证输出顺序稳定。
        query.setOrderBy("id ASC");
        return query;
    }

    // 构造模糊查询入参，演示如何在模板里指定 like 目标字段和关键字。
    private static CommonTemplateLikeQuery buildDisplayNameLikeQuery() {
        // 创建通用模糊查询对象，承接 demo_user 表上的名称检索条件。
        CommonTemplateLikeQuery likeQuery = new CommonTemplateLikeQuery();
        // 指定目标表，告诉模板 SQL 在 demo_user 上做 like 查询。
        likeQuery.setTableName("demo_user");
        // 只返回调试需要的四列，保持输出简洁。
        likeQuery.setSelectColumns("id, login_name, display_name, user_status");
        // 指定 display_name 为 like 字段，演示动态字段名模板。
        likeQuery.setFieldName("display_name");
        // 指定“管理员”为关键字，让初始两条数据都能匹配上。
        likeQuery.setFieldValue("管理员");
        // 继续沿用主键升序，方便和前面的查询结果对照。
        likeQuery.setOrderBy("id ASC");
        return likeQuery;
    }

    // 构造新增入参，演示模板 insert 如何接收列名和值映射。
    private static CommonTemplateSaveIn buildInsertIn() {
        // 创建通用新增对象，承接即将写入 demo_user 的列值集合。
        CommonTemplateSaveIn saveIn = new CommonTemplateSaveIn();
        // 指定目标表，让模板 SQL 生成 insert into demo_user。
        saveIn.setTableName("demo_user");
        // 使用有序 Map 保持列和值输出顺序稳定，便于调试观察。
        Map<String, Object> columnValueMap = new LinkedHashMap<>();
        // 写入主键 3，方便后续按主键回查新增结果。
        columnValueMap.put("id", 3L);
        // 写入登录名，演示文本列插入。
        columnValueMap.put("login_name", "auditor");
        // 写入显示名称，演示中文字段值插入。
        columnValueMap.put("display_name", "审计管理员");
        // 写入状态值，演示业务状态字段插入。
        columnValueMap.put("user_status", "ACTIVE");
        // 把列值集合交给模板新增对象，供注解 SQL 动态展开。
        saveIn.setColumnValueMap(columnValueMap);
        return saveIn;
    }

    // 构造更新入参，演示模板 updateById 如何按主键覆盖部分字段。
    private static CommonTemplateUpdateIn buildUpdateIn() {
        // 创建通用更新对象，承接 demo_user 上的一次按主键修改。
        CommonTemplateUpdateIn updateIn = new CommonTemplateUpdateIn();
        // 指定目标表，让模板 SQL 生成 update demo_user。
        updateIn.setTableName("demo_user");
        // 指定主键字段为 id，告诉模板 where 子句如何定位记录。
        updateIn.setIdColumn("id");
        // 指定本次更新命中的主键值为 3，对应刚插入的演示账号。
        updateIn.setIdValue(3L);
        // 使用有序 Map 收口要覆盖的列和值，方便输出顺序稳定。
        Map<String, Object> columnValueMap = new LinkedHashMap<>();
        // 把显示名称改成“审计专员”，演示文本字段更新。
        columnValueMap.put("display_name", "审计专员");
        // 把状态改成 DISABLED，演示状态字段更新。
        columnValueMap.put("user_status", "DISABLED");
        // 把要更新的列值集合交给模板更新对象，供注解 SQL 展开 set 子句。
        updateIn.setColumnValueMap(columnValueMap);
        return updateIn;
    }
}
