package com.sp.selplat.common.service.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDaoImpl;
import com.sp.selplat.common.db.template.BaseTemplateDao;
import com.sp.selplat.common.db.template.BaseTemplateMapper;
import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.BaseCrudService;
import com.sp.selplat.common.service.BaseExtendsServiceImpl;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.service.sequence.SequenceGeneratorImpl;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.h2.jdbcx.JdbcDataSource;
import org.h2.tools.RunScript;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 基础 Service 验证器使用真实 Spring 泛型注入、生产 DAO、生产模板、生产发号器和真实 H2。
 */
public final class BaseServiceImplTestVerifier {

    /**
     * 验证器不保存容器或数据库状态，每个 Case 都使用独立上下文。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     */
    private BaseServiceImplTestVerifier() {
    }

    /**
     * 验证基础层职责结构并通过真实数据库执行全部默认 CRUD。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     *
     * @param fixturePath 当前生产方法对应的 UTF-8 SQL fixture 资源路径，例如
     *     {@code "fixtures/SequenceGeneratorBoundaryTest/localCache.sql"}
     */
    public static void verifyRealDefaultCrud(String fixturePath) {
        // 无业务数据的继承结构通过反射独立检查，不创建任何 DAO 或 Service 替身。
        verifyBaseLayerOwnership();
        // 使用 fixture 启动真实数据库和完整公共生产链路。
        withFixture(fixturePath, context -> {
            // 取得由 Spring 按泛型注入真实 DAO 的业务 Service。
            SharedServiceFixtureService service = context.service();
            // 真实分页参数请求全部初始记录。
            CommonPageParam pageIn = new CommonPageParam();
            // 当前 Case 固定第一页。
            pageIn.setPageNo(1);
            // 当前 Case 容纳 fixture 全部记录。
            pageIn.setPageSize(10);
            // 生产分页链路必须返回真实数据库记录。
            CommonPageResult pageResult = service.getStore(pageIn);
            // fixture 两条记录都必须进入分页。
            assertEquals(2L, pageResult.getTotalCount());
            // 默认 sortnum 倒序必须让第二条记录排在首位。
            assertEquals(2L, ((Number) pageResult.getRecords().get(0).get("id")).longValue());

            // 单条查询必须返回真实 id=1 记录。
            CommonResult detailResult = service.getById(param("id", 1L));
            // 详情数据来自真实表。
            assertEquals("fixture-one", data(detailResult).get("name"));
            // 不存在主键必须由真实 DAO 未命中触发可识别的业务异常。
            CommonBusinessException notFoundException = assertThrows(
                CommonBusinessException.class,
                () -> service.getById(param("id", 999L))
            );
            // 稳定错误码允许全局处理器和客户端区分未命中与系统故障。
            assertEquals("RECORD_NOT_FOUND", notFoundException.getErrorCode());

            // 批量查询使用两组真实主键。
            CommonResult detailsResult = service.getByIds(batch(param("id", 1L), param("id", 2L)));
            // 真实批量 SQL 必须返回两条记录。
            assertEquals(2, ((List<?>) detailsResult.getData()).size());

            // 单条新增只提供真实业务字段，主键由生产发号器生成。
            CommonParam insertIn = saveItem("insert-one", 15);
            // 执行真实新增。
            CommonResult insertResult = service.insert(insertIn);
            // fixture 号段起点必须成为新增主键。
            assertEquals(100L, ((Number) data(insertResult).get("id")).longValue());
            // 数据库必须真实保存新增记录。
            assertEquals(1L, context.jdbc().queryForObject(
                "SELECT COUNT(*) FROM SharedServiceFixture WHERE id = 100",
                Long.class
            ));

            // 批量新增两条记录并逐项使用生产发号。
            CommonBatchParam insertBatchIn = batch(saveItem("insert-batch-one", 16), saveItem("insert-batch-two", 17));
            // 执行真实 JDBC batch。
            CommonResult insertBatchResult = service.insertBatch(insertBatchIn);
            // 顶层影响行数必须来自真实数据库批处理。
            assertEquals(2, insertBatchResult.getAffectedRows());
            // 两条新增记录必须真实落库。
            assertEquals(2L, context.jdbc().queryForObject(
                "SELECT COUNT(*) FROM SharedServiceFixture WHERE name LIKE 'insert-batch-%'",
                Long.class
            ));

            // 单条更新直接透传前端主键与字段。
            CommonParam updateIn = param("id", 1L);
            // 当前真实更新修改名称。
            updateIn.putParam("name", "updated-one");
            // 执行生产更新链路。
            service.update(updateIn);
            // 独立查询确认真实更新结果。
            assertEquals("updated-one", context.jdbc().queryForObject(
                "SELECT name FROM SharedServiceFixture WHERE id = 1",
                String.class
            ));

            // 批量更新初始两条记录。
            CommonParam updateFirst = param("id", 1L);
            // 第一条写入独立结果。
            updateFirst.putParam("name", "batch-updated-one");
            // 第二条使用相同字段结构进入同一次真实 batch。
            CommonParam updateSecond = param("id", 2L);
            // 第二条写入另一独立结果。
            updateSecond.putParam("name", "batch-updated-two");
            // 执行生产批量更新。
            CommonResult updateBatchResult = service.updateBatch(batch(updateFirst, updateSecond));
            // 两条真实更新必须返回累计影响行数。
            assertEquals(2, updateBatchResult.getAffectedRows());

            // 单条假删除保留记录并更新状态。
            CommonParam deleteIn = param("id", 1L);
            // 当前审计人进入真实删除更新字段。
            deleteIn.putParam("lastOperateUserId", 31L);
            // 执行生产假删除。
            service.delete(deleteIn);
            // 真实记录必须保留且状态为零。
            assertEquals(0, context.jdbc().queryForObject(
                "SELECT status FROM SharedServiceFixture WHERE id = 1",
                Integer.class
            ));

            // 批量假删除另一初始记录和单条新增记录。
            CommonParam deleteSecond = param("id", 2L);
            // 第二条审计人随请求透传。
            deleteSecond.putParam("lastOperateUserId", 32L);
            // 新增记录使用真实生成主键。
            CommonParam deleteInserted = param("id", insertIn.getParam("id"));
            // 新增记录保存另一审计人。
            deleteInserted.putParam("lastOperateUserId", 33L);
            // 执行生产批量假删除。
            CommonResult deleteBatchResult = service.deleteBatch(batch(deleteSecond, deleteInserted));
            // 两条真实假删除必须返回累计影响行数。
            assertEquals(2, deleteBatchResult.getAffectedRows());
            // 数据库中三条目标记录都必须保留为假删除状态。
            assertEquals(3L, context.jdbc().queryForObject(
                "SELECT COUNT(*) FROM SharedServiceFixture WHERE status = 0",
                Long.class
            ));
        });
    }

    /**
     * 验证 BaseServiceImpl 与 BaseExtendsServiceImpl 的继承顺序、字段和方法职责边界。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     *
     * @throws AssertionError 当 DAO、CRUD、发号或结果构建职责所属层级不符合约定时抛出
     */
    private static void verifyBaseLayerOwnership() {
        // BaseServiceImpl 必须直接继承扩展基础层。
        assertSame(BaseExtendsServiceImpl.class, BaseServiceImpl.class.getSuperclass());
        // 公共 CRUD 实现必须显式受 BaseCrudService 契约约束，非 CRUD 服务不得因 BaseService 自动获得维护方法。
        assertTrue(BaseCrudService.class.isAssignableFrom(BaseServiceImpl.class));
        // BaseServiceImpl 自身统一声明 DAO 入口和九个默认 CRUD，业务子类可直接继承或按需覆盖。
        assertEquals(
            Set.of(
                "getDao",
                "getStore",
                "getById",
                "getByIds",
                "insert",
                "insertBatch",
                "update",
                "updateBatch",
                "delete",
                "deleteBatch"
            ),
            declaredMethodNames(BaseServiceImpl.class)
        );
        // BaseExtendsServiceImpl 只保留抽象 DAO 回调、发号和固定结果构建能力。
        assertEquals(
            Set.of("getDao", "getSequence", "buildSuccessResult"),
            declaredMethodNames(BaseExtendsServiceImpl.class)
        );
        // BaseServiceImpl 只保存当前业务 DAO。
        assertEquals(1, BaseServiceImpl.class.getDeclaredFields().length);
        // 扩展基础层只保存公共发号器。
        assertEquals(1, BaseExtendsServiceImpl.class.getDeclaredFields().length);
        try {
            // 扩展层 getDao 保持抽象回调。
            Method extendsGetDao = BaseExtendsServiceImpl.class.getDeclaredMethod("getDao");
            // 抽象声明避免扩展层保存第二份 DAO。
            assertTrue(Modifier.isAbstract(extendsGetDao.getModifiers()));
            // 稳定入口提供唯一具体实现。
            Method serviceGetDao = BaseServiceImpl.class.getDeclaredMethod("getDao");
            // 业务 Service 无需重复实现 DAO 访问。
            assertFalse(Modifier.isAbstract(serviceGetDao.getModifiers()));
            // 发号入口必须继续由扩展基础层声明，避免迁移 CRUD 时把公共发号依赖上移。
            Method extendsGetSequence = BaseExtendsServiceImpl.class.getDeclaredMethod("getSequence");
            // 发号入口保持可供 BaseServiceImpl 复用的受保护具体实现。
            assertFalse(Modifier.isAbstract(extendsGetSequence.getModifiers()));
        } catch (NoSuchMethodException exception) {
            // 任一契约缺失都表示基础层职责迁移不完整。
            throw new AssertionError("基础 Service 层缺少 DAO 或发号契约", exception);
        }
    }

    /**
     * 收集目标类自身非合成方法名称。
     *
     * @param targetType 要检查自身声明方法的基础 Service 类型，例如 {@code BaseServiceImpl.class}
     * @return 非合成方法名集合，例如
     *     {@code ["getDao","getStore","getById","getByIds","insert","insertBatch","update","updateBatch","delete","deleteBatch"]}
     */
    private static Set<String> declaredMethodNames(Class<?> targetType) {
        // 只读取当前类自身声明，避免继承方法掩盖职责归属。
        return Arrays.stream(targetType.getDeclaredMethods())
            // 排除编译器和覆盖工具生成方法。
            .filter(method -> !method.isSynthetic())
            // 当前结构只比较职责名称。
            .map(Method::getName)
            // 使用集合忽略反射顺序。
            .collect(Collectors.toSet());
    }

    /**
     * 使用独立 H2、真实 MyBatis 和真实 Spring 容器运行一个基础 Service Case。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     *
     * @param fixturePath 当前生产方法对应的 SQL fixture，例如
     *     {@code "fixtures/BaseServiceImplRealDatabaseTest/defaultCrud.sql"}
     * @param caseAction 使用真实 Service 和独立 JDBC 期待查询执行验证的 Case 动作
     * @throws AssertionError 当 fixture 缺失或初始化 SQL 执行失败时抛出
     */
    private static void withFixture(String fixturePath, java.util.function.Consumer<RealContext> caseAction) {
        // 创建当前 Case 独立 H2。
        JdbcDataSource dataSource = new JdbcDataSource();
        // 保持数据库字段原始大小写。
        dataSource.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false");
        // H2 默认用户固定为 sa。
        dataSource.setUser("sa");
        // H2 内存库不设置密码。
        dataSource.setPassword("");
        // 加载当前测试类与方法唯一 fixture。
        InputStream fixtureStream = BaseServiceImplTestVerifier.class.getClassLoader().getResourceAsStream(fixturePath);
        // fixture 必须存在。
        assertNotNull(fixtureStream, "fixture not found: " + fixturePath);
        try (
            // 使用 UTF-8 读取完整 fixture。
            InputStreamReader fixtureReader = new InputStreamReader(fixtureStream, StandardCharsets.UTF_8);
            // 使用真实数据库连接执行 SQL。
            Connection connection = dataSource.getConnection()
        ) {
            // 重建当前 Case 的表与数据。
            RunScript.execute(connection, fixtureReader);
        } catch (Exception exception) {
            // fixture 失败直接结束测试。
            throw new AssertionError("failed to load fixture: " + fixturePath, exception);
        }
        // 创建绑定当前数据源的真实 MyBatis 环境。
        Environment environment = new Environment("common-service-real-test", new JdbcTransactionFactory(), dataSource);
        // 创建生产模板 Mapper 所需配置。
        Configuration configuration = new Configuration(environment);
        // 注册真实注解式模板 Mapper。
        configuration.addMapper(BaseTemplateMapper.class);
        // 创建真实 MyBatis 会话工厂。
        SqlSessionFactory sessionFactory = new SqlSessionFactoryBuilder().build(configuration);
        try (
            // 自动提交会话保证独立期待查询可读取生产写入。
            SqlSession sqlSession = sessionFactory.openSession(true);
            // 最小 Spring 容器执行生产自动注入。
            AnnotationConfigApplicationContext springContext = new AnnotationConfigApplicationContext()
        ) {
            // 使用真实 Mapper 和数据源创建生产模板 DAO。
            BaseTemplateDao templateDao = new BaseTemplateDao(sqlSession.getMapper(BaseTemplateMapper.class), dataSource);
            // 创建当前真实业务 DAO。
            SharedServiceFixtureDaoImpl dao = new SharedServiceFixtureDaoImpl();
            // 注入生产继承层实际使用的模板与数据源。
            dao.initialize(templateDao, dataSource);
            // 注册真实数据源。
            springContext.registerBean(DataSource.class, () -> dataSource);
            // 注册生产模板 DAO，满足真实业务 DAO 继承字段的 Spring 自动注入。
            springContext.registerBean(BaseTemplateDao.class, () -> templateDao);
            // 按业务接口类型注册真实 DAO，供泛型注入解析。
            springContext.registerBean(SharedServiceFixtureDao.class, () -> dao);
            // 注册生产号段 DAO。
            springContext.registerBean(CommonSequenceSegmentDaoImpl.class);
            // 注册生产发号器。
            springContext.registerBean(SequenceGeneratorImpl.class);
            // 注册仅绑定真实 DAO 的业务 Service 子类。
            springContext.registerBean(SharedServiceFixtureService.class);
            // 刷新容器完成真实依赖装配。
            springContext.refresh();
            // 把真实 Service 与独立 JDBC 期待查询交给当前 Case。
            caseAction.accept(new RealContext(
                springContext.getBean(SharedServiceFixtureService.class),
                new JdbcTemplate(dataSource)
            ));
        }
    }

    /**
     * 创建包含一个字段的前端通用参数。
     *
     * @param key 前端动态字段名，例如 {@code "id"}
     * @param value 对应业务值，例如 {@code 1001L}
     * @return 单字段参数，例如 {@code {"id":1001}}
     */
    private static CommonParam param(String key, Object value) {
        // 创建请求参数。
        CommonParam input = new CommonParam();
        // 写入当前业务字段。
        input.putParam(key, value);
        // 返回可直接进入生产 Service 的参数。
        return input;
    }

    /**
     * 创建满足真实表约束的新增项。
     *
     * @param name 当前 fixture 记录名称，例如 {@code "新增用户"}
     * @param sortnum 当前 fixture 排序号，例如 {@code 10}
     * @return 满足真实表约束的新增参数，例如
     *     {@code {"tenantId":1,"lastOperateUserId":1,"name":"新增用户","sortnum":10,"status":1}}
     */
    private static CommonParam saveItem(String name, int sortnum) {
        // 创建前端新增参数。
        CommonParam input = new CommonParam();
        // 租户字段满足公共表约束。
        input.putParam("tenantId", 1L);
        // 审计字段记录当前操作人。
        input.putParam("lastOperateUserId", 1L);
        // 名称标识当前真实数据。
        input.putParam("name", name);
        // 排序值参与真实分页。
        input.putParam("sortnum", sortnum);
        // 新增状态为有效。
        input.putParam("status", 1);
        // 返回完整新增参数。
        return input;
    }

    /**
     * 创建按原顺序保存的批量参数。
     *
     * @param items 调用方已构建的真实业务项，例如 {@code [{"id":1},{"id":2}]}
     * @return 保持原顺序的批量参数，例如 {@code {"items":[{"id":1},{"id":2}]}}
     */
    private static CommonBatchParam batch(CommonParam... items) {
        // 创建批量容器。
        CommonBatchParam input = new CommonBatchParam();
        // 全部真实项按调用顺序加入。
        input.getItems().addAll(List.of(items));
        // 返回可直接进入生产 Service 的参数。
        return input;
    }

    /**
     * 读取固定 CommonResult 中的单条字段映射。
     *
     * @param result 生产 Service 返回结果，例如
     *     {@code {"success":true,"data":{"id":1,"name":"用户"},"msg":"详情查询完成。"}}
     * @return data 中的字段映射，例如 {@code {"id":1,"name":"用户"}}
     */
    @SuppressWarnings("unchecked")
    private static java.util.Map<String, Object> data(CommonResult result) {
        // 真实业务必须返回成功。
        assertTrue(result.isSuccess());
        // 业务数据必须存在。
        assertNotNull(result.getData());
        // 当前单条 CRUD 固定返回字段映射。
        return (java.util.Map<String, Object>) result.getData();
    }

    /**
     * 当前真实业务 DAO 只扩展公共 BaseDao 契约。
     */
    private interface SharedServiceFixtureDao extends BaseDao {
    }

    /**
     * 当前真实业务 DAO 按生产命名约定自动解析 SharedServiceFixture 表。
     */
    private static final class SharedServiceFixtureDaoImpl extends BaseDaoImpl implements SharedServiceFixtureDao {

        /**
         * 注入生产中由 Spring 提供的模板 DAO 与数据源。
         *
         * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
         *
         * @param templateDao 绑定当前 H2 与真实 Mapper 的生产模板 DAO
         * @param fixtureDataSource 当前 Case 独立 H2 数据源
         */
        private void initialize(BaseTemplateDao templateDao, DataSource fixtureDataSource) {
            // 真实模板 DAO进入基础 DAO 生产字段。
            this.baseTemplateDao = templateDao;
            // 真实 H2 进入元数据和动态查询生产字段。
            this.dataSource = fixtureDataSource;
        }
    }

    /**
     * 当前真实业务 Service 不覆盖任何默认方法，只绑定自己的 DAO 泛型。
     */
    private static final class SharedServiceFixtureService extends BaseServiceImpl<SharedServiceFixtureDao> {
    }

    /**
     * RealContext 保存当前 Case 的真实 Service 和独立数据库期待查询入口。
     *
     * @param service 由最小 Spring 容器装配的生产基础 Service 子类
     * @param jdbc 绑定当前独立 H2 的期待查询模板
     */
    private record RealContext(SharedServiceFixtureService service, JdbcTemplate jdbc) {
    }
}
