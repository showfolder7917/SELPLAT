package com.sp.selplat.common.db.dao.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.common.db.sequence.model.IdSequenceDefinition;
import com.sp.selplat.common.db.template.BaseTemplateDao;
import com.sp.selplat.common.db.template.BaseTemplateMapper;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import javax.sql.DataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.h2.jdbcx.JdbcDataSource;
import org.h2.tools.RunScript;

// BaseDaoImpl 真实数据库验证器用独立 H2、真实 JDBC 元数据、内部 Mapper 和模板 DAO 执行每个公共 DAO Case。
public final class BaseDaoImplRealDatabaseTestVerifier {

    // 验证器没有跨 Case 状态，每次调用都创建全新的内存数据库。
    private BaseDaoImplRealDatabaseTestVerifier() {
    }

    // 验证真实单主键元数据生成表名前缀号段编码。
    public static void verifyGetIdSequenceDefinition(String fixturePath) {
        withFixture(fixturePath, context -> {
            // 号段定义必须通过真实 JDBC 主键元数据读取 id 字段。
            IdSequenceDefinition definition = context.dao.getIdSequenceDefinition();
            // SharedFixture 表的 id 字段必须生成 SharedFixtureId。
            assertEquals(Map.of("id", "SharedFixtureId"), definition.getIdSequenceCodeMap());
        });
    }

    // 验证默认分页入口执行真实 sortnum 倒序和 count SQL。
    public static void verifyGetPageList(String fixturePath) {
        withFixture(fixturePath, context -> {
            // 默认分页读取当前 fixture 的三条记录。
            CommonPageResult pageResult = context.dao.getPageList(Map.of(), 1, 3);
            // 登录名顺序必须来自真实数据库 sortnum 倒序。
            assertEquals(
                List.of("shared-high", "shared-middle", "shared-low"),
                pageResult.getRecords().stream().map(row -> String.valueOf(row.get("loginName"))).toList()
            );
            // 真实 count SQL 必须返回三条。
            assertEquals(3L, pageResult.getTotalCount());
            // 分页回参必须保留调用页码。
            assertEquals(1, pageResult.getPageNo());
            // 分页回参必须保留页大小。
            assertEquals(3, pageResult.getPageSize());
        });
    }

    // 验证真实主键查询返回 status 为零的记录，不注入业务有效状态。
    public static void verifyGetById(String fixturePath) {
        withFixture(fixturePath, context -> {
            // 创建前端通用参数并直接写入当前表单主键。
            CommonParam queryIn = new CommonParam();
            // id 由基础 DAO 按真实主键元数据读取，Service 无需重新组装列表。
            queryIn.putParam("id", 201L);
            // 通过 BaseDao 公开 CommonParam 能力查询真实记录。
            Map<String, Object> record = context.dao.getById(queryIn);
            // 主键必须命中当前 fixture 记录。
            assertEquals(201L, ((Number) record.get("id")).longValue());
            // status 零仍应原样返回，证明公共 DAO 不附加模块条件。
            assertEquals(0, ((Number) record.get("status")).intValue());
        });
    }

    // 验证 CommonParam 中的全部复合主键字段共同进入真实查询 where。
    public static void verifyGetByIdComposite(String fixturePath) {
        withFixture(fixturePath, context -> {
            // 创建前端通用参数承接当前表的两个复合主键字段。
            CommonParam queryIn = new CommonParam();
            // tenantId 指定复合主键第一部分。
            queryIn.putParam("tenantId", 21L);
            // itemId 指定复合主键第二部分。
            queryIn.putParam("itemId", 8L);
            // 基础 DAO 必须从同一个 CommonParam 中提取两个主键并命中唯一真实记录。
            Map<String, Object> record = context.dao.getById(queryIn);
            // 两个主键共同命中的业务值必须来自当前 fixture。
            assertEquals("composite-target", record.get("loginName"));
            // 删除任一复合主键字段后必须在执行 SQL 前拒绝不完整目标。
            queryIn.getParamMap().remove("itemId");
            // 缺少 itemId 不得退化成只按 tenantId 查询。
            IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> context.dao.getById(queryIn)
            );
            // 异常必须指出实际缺失的复合主键字段。
            assertTrue(exception.getMessage().contains("itemId"));
        });
    }

    // 验证多个 CommonParam 字段共同进入真实动态查询 where。
    public static void verifyGetByQuery(String fixturePath) {
        withFixture(fixturePath, context -> {
            // 创建两个动态查询字段以区分同账号的不同租户记录。
            CommonParam queryIn = new CommonParam();
            // 登录名作为第一项真实等值条件。
            queryIn.putParam("loginName", "query-target");
            // 租户作为第二项真实等值条件。
            queryIn.putParam("tenantId", 3L);
            // 通过公共动态单条入口执行真实 SQL。
            Map<String, Object> record = context.dao.getByQuery(queryIn);
            // 两个条件共同命中的记录主键必须为 301。
            assertEquals(301L, ((Number) record.get("id")).longValue());
        });
    }

    // 验证 CommonParam 全字段通过真实 MyBatis 注解模板新增。
    public static void verifyInsert(String fixturePath) {
        withFixture(fixturePath, context -> {
            // 创建满足真实表约束的新增参数。
            CommonParam saveIn = completeParam(401L, "shared-insert", "公共新增");
            // BaseDaoImpl 必须真实新增一行。
            assertEquals(1, context.dao.insert(saveIn));
            // JDBC 独立查询验证实际数据库账号。
            assertEquals("shared-insert", context.queryString("SELECT loginName FROM SharedFixture WHERE id = 401"));
            // JDBC 独立查询验证实际数据库展示名。
            assertEquals("公共新增", context.queryString("SELECT displayName FROM SharedFixture WHERE id = 401"));
        });
    }

    // 验证真实更新只把主键用于 where，并保持原 CommonParam 不变。
    public static void verifyUpdate(String fixturePath) {
        withFixture(fixturePath, context -> {
            // 创建包含主键和两个更新字段的前端参数。
            CommonParam saveIn = new CommonParam();
            // id 只允许进入真实 where 条件。
            saveIn.putParam("id", 501L);
            // 最近操作用户进入 set。
            saveIn.putParam("lastOperateUserId", 15L);
            // 展示名进入 set。
            saveIn.putParam("displayName", "更新后名称");
            // BaseDaoImpl 必须真实更新一行。
            assertEquals(1, context.dao.update(saveIn));
            // JDBC 独立查询验证展示名已更新。
            assertEquals("更新后名称", context.queryString("SELECT displayName FROM SharedFixture WHERE id = 501"));
            // JDBC 独立查询验证主键仍为原值。
            assertEquals(501L, context.queryLong("SELECT id FROM SharedFixture WHERE id = 501"));
            // 原始 CommonParam 必须继续保留主键和更新字段。
            assertEquals(3, saveIn.getParamMap().size());
        });
    }

    // 验证公共逻辑删除真实更新而不物理删除。
    public static void verifySoftDelete(String fixturePath) {
        withFixture(fixturePath, context -> {
            // 创建包含主键和审计用户的删除参数。
            CommonParam deleteIn = new CommonParam();
            // id 指定真实逻辑删除目标。
            deleteIn.putParam("id", 601L);
            // 最近操作用户应与公共状态和更新时间共同落库。
            deleteIn.putParam("lastOperateUserId", 16L);
            // 公共逻辑删除必须真实影响一行。
            assertEquals(1, context.dao.softDelete(deleteIn));
            // 数据库状态必须更新为零。
            assertEquals(0L, context.queryLong("SELECT status FROM SharedFixture WHERE id = 601"));
            // 数据库记录必须仍然存在。
            assertEquals(1L, context.queryLong("SELECT COUNT(*) FROM SharedFixture WHERE id = 601"));
            // DAO 必须把服务端更新时间写回同一个参数对象。
            assertNotNull(deleteIn.getParam("updatedAt"));
        });
    }

    // 验证一千零一条记录在两个固定分组中完成真实批量新增、查询、异构更新和假删除。
    public static void verifyBatchCrudInThousandItemGroups(String fixturePath) {
        withFixture(fixturePath, context -> {
            // 批量新增参数保存一千零一条相同列结构记录，确保跨越一千条边界。
            CommonBatchParam insertIn = new CommonBatchParam();
            // 逐项构造真实写入参数，编号范围与其他 Case 隔离。
            for (long itemIndex = 1; itemIndex <= 1001; itemIndex++) {
                // 每条记录使用唯一主键和账号，便于独立数据库核对。
                insertIn.getItems().add(completeParam(10000L + itemIndex, "batch-user-" + itemIndex, "批量用户" + itemIndex));
            }
            // 两个 JDBC 分组必须累计新增一千零一行。
            assertEquals(1001, context.dao.insertBatch(insertIn));
            // 独立 JDBC 查询确认全部记录真实落库。
            assertEquals(1001L, context.queryLong("SELECT COUNT(*) FROM SharedFixture"));

            // 批量查询参数为每条记录只提交主键字段。
            CommonBatchParam queryIn = new CommonBatchParam();
            // 一千零一项会形成两个批量主键查询 SQL。
            for (long itemIndex = 1; itemIndex <= 1001; itemIndex++) {
                // 当前查询项直接使用前端 CommonParam 表达主键。
                CommonParam queryItem = new CommonParam();
                // id 指向刚新增的真实记录。
                queryItem.putParam("id", 10000L + itemIndex);
                // 当前主键项加入批量查询。
                queryIn.getItems().add(queryItem);
            }
            // 两个查询分组汇总后必须返回全部一千零一条记录。
            assertEquals(1001, context.dao.getByIds(queryIn).size());

            // 批量更新交替使用两种字段结构，验证组内继续按 SQL 结构归并。
            CommonBatchParam updateIn = new CommonBatchParam();
            // 每条记录都更新展示名，偶数记录额外更新最近操作用户。
            for (long itemIndex = 1; itemIndex <= 1001; itemIndex++) {
                // 当前更新项承接主键和动态更新字段。
                CommonParam updateItem = new CommonParam();
                // id 只进入批量 update 的 where。
                updateItem.putParam("id", 10000L + itemIndex);
                // displayName 进入所有记录的 set。
                updateItem.putParam("displayName", "批量更新" + itemIndex);
                // 偶数项增加第二种 SQL 字段结构。
                if (itemIndex % 2 == 0) {
                    // 最近操作用户只在偶数记录中更新。
                    updateItem.putParam("lastOperateUserId", 88L);
                }
                // 当前更新项加入批量请求。
                updateIn.getItems().add(updateItem);
            }
            // 两个千条分组内的两种 SQL 结构累计更新全部记录。
            assertEquals(1001, context.dao.updateBatch(updateIn));
            // 独立查询确认最后一条跨组记录已经真实更新。
            assertEquals("批量更新1001", context.queryString("SELECT displayName FROM SharedFixture WHERE id = 11001"));

            // 批量假删除参数只提交主键和每条审计用户。
            CommonBatchParam deleteIn = new CommonBatchParam();
            // 一千零一条删除项再次跨越固定分组边界。
            for (long itemIndex = 1; itemIndex <= 1001; itemIndex++) {
                // 当前删除项使用通用参数承接主键和审计字段。
                CommonParam deleteItem = new CommonParam();
                // id 指向当前真实记录。
                deleteItem.putParam("id", 10000L + itemIndex);
                // 最近操作用户由前端逐项传入。
                deleteItem.putParam("lastOperateUserId", 99L);
                // 当前删除项加入批量假删除请求。
                deleteIn.getItems().add(deleteItem);
            }
            // 批量假删除必须累计影响全部一千零一行。
            assertEquals(1001, context.dao.softDeleteBatch(deleteIn));
            // 独立查询确认全部记录仍存在但状态均已改为零。
            assertEquals(1001L, context.queryLong("SELECT COUNT(*) FROM SharedFixture WHERE status = 0"));
        });
    }

    // 验证空主键和空动态条件不会进入真实 SQL。
    public static void verifyEmptyInput(String fixturePath) {
        withFixture(fixturePath, context -> {
            // 空 CommonParam 按公共主键未命中语义返回 null。
            assertNull(context.dao.getById(new CommonParam()));
            // null CommonParam 同样不得进入真实主键 SQL。
            assertNull(context.dao.getById(null));
            // 空 CommonParam 按公共未命中语义返回 null。
            assertNull(context.dao.getByQuery(new CommonParam()));
            // null CommonParam 同样不得退化成无条件全表查询。
            assertNull(context.dao.getByQuery(null));
            // 空批量查询不得进入数据库。
            assertEquals(List.of(), context.dao.getByIds(new CommonBatchParam()));
            // null 批量查询同样返回空列表。
            assertEquals(List.of(), context.dao.getByIds((CommonBatchParam) null));
            // 三个空批量写入都必须返回零影响行。
            assertEquals(0, context.dao.insertBatch(new CommonBatchParam()));
            // null 批量新增同样不得进入数据库。
            assertEquals(0, context.dao.insertBatch(null));
            // 空批量更新不得进入数据库。
            assertEquals(0, context.dao.updateBatch(new CommonBatchParam()));
            // null 批量更新同样返回零。
            assertEquals(0, context.dao.updateBatch(null));
            // 空批量假删除不得进入数据库。
            assertEquals(0, context.dao.softDeleteBatch(new CommonBatchParam()));
            // null 批量假删除同样返回零。
            assertEquals(0, context.dao.softDeleteBatch(null));
        });
    }

    // 验证真实动态查询没有命中记录时返回 null。
    public static void verifyQueryNotFound(String fixturePath) {
        withFixture(fixturePath, context -> {
            // 创建数据库中不存在的登录名条件。
            CommonParam queryIn = new CommonParam();
            // 唯一条件确保真实查询返回空列表。
            queryIn.putParam("loginName", "missing-user");
            // 公共单条查询必须把空分页结果转换成 null。
            assertNull(context.dao.getByQuery(queryIn));
        });
    }

    // 创建满足 SharedFixture 非空约束的完整新增参数。
    private static CommonParam completeParam(long id, String loginName, String displayName) {
        // 创建通用前端参数容器。
        CommonParam saveIn = new CommonParam();
        // 写入真实主键。
        saveIn.putParam("id", id);
        // 写入租户归属。
        saveIn.putParam("tenantId", 4L);
        // 写入审计用户。
        saveIn.putParam("lastOperateUserId", 4L);
        // 写入登录名。
        saveIn.putParam("loginName", loginName);
        // 写入密码摘要。
        saveIn.putParam("passwordHash", "fixture-hash");
        // 写入展示名。
        saveIn.putParam("displayName", displayName);
        // 写入排序值。
        saveIn.putParam("sortnum", 10);
        // 写入有效状态。
        saveIn.putParam("status", 1);
        // 返回可直接进入真实 BaseDao 的完整参数。
        return saveIn;
    }

    // 在独立 H2 和真实 MyBatis 会话中运行一个 fixture Case。
    private static void withFixture(String fixturePath, Consumer<RealContext> caseAction) {
        // 每个 Case 使用随机数据库名，避免并行测试共享表状态。
        JdbcDataSource dataSource = new JdbcDataSource();
        // 保持字段名原始大小写，使真实 Map 字段与生产驼峰命名一致。
        dataSource.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false");
        // H2 默认测试用户固定为 sa。
        dataSource.setUser("sa");
        // H2 内存测试库不设置密码。
        dataSource.setPassword("");
        // 从测试资源读取当前生产方法唯一 fixture。
        InputStream fixtureStream = BaseDaoImplRealDatabaseTestVerifier.class.getClassLoader().getResourceAsStream(fixturePath);
        // fixture 缺失时立即失败，避免测试悄悄使用空数据库。
        assertNotNull(fixtureStream, "fixture not found: " + fixturePath);
        try (
            // 使用 UTF-8 完整读取 SQL fixture。
            InputStreamReader fixtureReader = new InputStreamReader(fixtureStream, StandardCharsets.UTF_8);
            // 获取真实连接执行当前 Case 建表和数据准备。
            Connection connection = dataSource.getConnection()
        ) {
            // H2 RunScript 按资源中的真实 SQL 重建当前 Case 数据。
            RunScript.execute(connection, fixtureReader);
        } catch (Exception exception) {
            // fixture 执行失败必须直接结束当前 Case。
            throw new AssertionError("failed to load fixture: " + fixturePath, exception);
        }
        // 创建真实 MyBatis 环境并绑定当前 H2 数据源。
        Environment environment = new Environment("common-db-real-test", new JdbcTransactionFactory(), dataSource);
        // 创建 MyBatis 配置承接模板层内部的注解式 BaseTemplateMapper。
        Configuration configuration = new Configuration(environment);
        // 注册当前生产模板 DAO 内部使用的真实注解 Mapper。
        configuration.addMapper(BaseTemplateMapper.class);
        // 创建可提交真实 SQL 的 MyBatis 会话工厂。
        SqlSessionFactory sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
        try (SqlSession sqlSession = sqlSessionFactory.openSession(true)) {
            // 创建真实公共 DAO 测试门面。
            SharedFixtureDaoImpl dao = new SharedFixtureDaoImpl();
            // 使用真实 Mapper 和同一数据源创建生产模板 DAO 门面。
            BaseTemplateDao templateDao = new BaseTemplateDao(sqlSession.getMapper(BaseTemplateMapper.class), dataSource);
            // 注入真实模板 DAO 和数据源，保持生产继承链不变。
            dao.initialize(templateDao, dataSource);
            // 把完整真实上下文交给当前 Case 验证动作。
            caseAction.accept(new RealContext(dao, dataSource));
        }
    }

    // SharedFixtureDaoImpl 按生产命名约定把类名自动解析成 SharedFixture 表。
    private static final class SharedFixtureDaoImpl extends BaseDaoImpl {

        // 测试只显式注入生产中由 Spring 提供的两个基础依赖。
        private void initialize(BaseTemplateDao templateDao, DataSource fixtureDataSource) {
            // 真实模板 DAO 进入 BaseDao 生产模板字段。
            this.baseTemplateDao = templateDao;
            // 真实 H2 数据源进入元数据和动态查询生产字段。
            this.dataSource = fixtureDataSource;
        }
    }

    // RealContext 保存当前 Case 的真实 DAO 和独立 JDBC 期待查询入口。
    private record RealContext(SharedFixtureDaoImpl dao, DataSource dataSource) {

        // 执行返回字符串的独立数据库期待查询。
        private String queryString(String sql) {
            // JDBC 查询结果只读取第一列字符串。
            return String.valueOf(queryObject(sql));
        }

        // 执行返回长整数的独立数据库期待查询。
        private long queryLong(String sql) {
            // Number 统一转换为 long，隔离具体驱动数值类型。
            return ((Number) queryObject(sql)).longValue();
        }

        // 执行独立单值查询并返回第一行第一列。
        private Object queryObject(String sql) {
            try (
                // 从当前 Case 真实数据源获取独立连接。
                Connection connection = dataSource.getConnection();
                // 创建只执行固定测试 SQL 的语句对象。
                Statement statement = connection.createStatement();
                // 执行期待查询。
                ResultSet resultSet = statement.executeQuery(sql)
            ) {
                // 每个期待 SQL 都必须至少返回一行。
                assertFalse(!resultSet.next());
                // 返回第一列真实数据库值。
                return resultSet.getObject(1);
            } catch (SQLException exception) {
                // 期待查询失败时直接转换成明确测试失败。
                throw new AssertionError("failed to execute expected query: " + sql, exception);
            }
        }
    }
}
