package com.sp.selplat.common.service.sequence.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDaoImpl;
import com.sp.selplat.common.db.sequence.model.IdSequenceDefinition;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
import com.sp.selplat.common.service.sequence.SequenceGeneratorImpl;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.h2.jdbcx.JdbcDataSource;
import org.h2.tools.RunScript;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

/**
 * 公共发号验证器只使用真实 H2、生产号段 DAO 和生产发号器验证正常与输入边界。
 */
public final class SequenceGeneratorTestVerifier {

    /**
     * 验证器不保存跨 Case 状态，避免生产发号器的本地缓存互相污染。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     */
    private SequenceGeneratorTestVerifier() {
    }

    /**
     * 验证复合主键通过真实 Spring、真实号段 DAO 和真实 H2 分别取号。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     *
     * @param fixturePath 当前生产方法对应的 UTF-8 SQL fixture 资源路径，例如
     *     {@code "fixtures/SequenceGeneratorBoundaryTest/localCache.sql"}
     */
    public static void verifyRealCompositeSequence(String fixturePath) {
        // 使用当前方法唯一 fixture 启动真实生产发号链路。
        withGenerator(fixturePath, (sequenceGenerator, dataSource) -> {
            // 构造字段顺序稳定的复合主键定义。
            Map<String, String> sequenceCodes = new LinkedHashMap<>();
            // tenantId 指向自己的数据库号段。
            sequenceCodes.put("tenantId", "UniauthUserTenantId");
            // orderId 指向另一条独立数据库号段。
            sequenceCodes.put("orderId", "UniauthUserOrderId");
            // 通过生产 getSequence 一次生成两个字段编号。
            Map<String, Long> generatedIds = sequenceGenerator.getSequence(new IdSequenceDefinition(sequenceCodes));
            // 返回字段顺序必须与 DAO 元数据定义一致。
            assertEquals(List.of("tenantId", "orderId"), List.copyOf(generatedIds.keySet()));
            // tenantId 必须获得自己真实号段的第一个编号。
            assertEquals(100001L, generatedIds.get("tenantId"));
            // orderId 必须获得另一条真实号段的第一个编号。
            assertEquals(200001L, generatedIds.get("orderId"));
            // tenantId 数据库游标必须推进完整步长。
            assertEquals(100011L, queryLong(dataSource, "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'UniauthUserTenantId'"));
            // orderId 数据库游标也必须独立推进完整步长。
            assertEquals(200011L, queryLong(dataSource, "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'UniauthUserOrderId'"));
        });
    }

    /**
     * 验证公共发号器按真实启用编码把 MDA 与 Uniauth 请求路由到各自项目数据库。
     *
     * @param fixturePath 当前生产方法对应的 UTF-8 SQL fixture 资源路径，例如
     *     {@code "fixtures/SequenceGeneratorRealDatabaseTest/routeProjectDataSources.sql"}
     * 执行结果示例：MDA 数据库游标由 {@code 100000} 推进到 {@code 101000}，
     * Uniauth 数据库游标由 {@code 200000} 推进到 {@code 201000}。
     */
    public static void verifyProjectDataSourceRouting(String fixturePath) {
        // 一个隔离 H2 实例中的两个 schema 分别模拟 MDA 与 Uniauth 私有项目数据库。
        String databaseName = UUID.randomUUID().toString();
        String baseUrl = "jdbc:h2:mem:" + databaseName + ";DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false";
        JdbcDataSource adminDataSource = dataSource(baseUrl);
        // 唯一 fixture 同时创建两个项目数据库边界及各自号段记录。
        loadFixture(adminDataSource, fixturePath);
        JdbcDataSource mdaDataSource = dataSource(baseUrl + ";SCHEMA=MDA_DB");
        JdbcDataSource uniauthDataSource = dataSource(baseUrl + ";SCHEMA=UNIAUTH_DB");
        // 两个生产 DAO 分别固定绑定自己的项目数据源，不共享 @Primary 候选。
        CommonSequenceSegmentDaoImpl mdaDao = new CommonSequenceSegmentDaoImpl(mdaDataSource);
        CommonSequenceSegmentDaoImpl uniauthDao = new CommonSequenceSegmentDaoImpl(uniauthDataSource);
        SequenceGenerator generator = new SequenceGeneratorImpl(List.of(mdaDao, uniauthDao));
        // MDA 编码只命中 MDA_DB，并返回该项目号段起点。
        assertEquals(100000L, generator.nextId("MdaConnectionProfileId"));
        // Uniauth 编码只命中 UNIAUTH_DB，并返回另一项目号段起点。
        assertEquals(200000L, generator.nextId("UniauthUserId"));
        // 两个真实数据库游标分别推进，证明没有借首选数据源交叉发号。
        assertEquals(101000L, queryLong(mdaDataSource,
            "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'MdaConnectionProfileId'"));
        assertEquals(201000L, queryLong(uniauthDataSource,
            "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'UniauthUserId'"));
        // 任一项目都没有的编码必须在分配前明确失败。
        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> generator.nextId("MissingProjectId")
        );
        assertTrue(exception.getMessage().contains("no active sequence segment found"));
        // 两个项目 DAO 同时声明同一编码时必须在领取号段前阻断，避免形成双库重复主键。
        SequenceGenerator duplicateGenerator = new SequenceGeneratorImpl(List.of(
            mdaDao,
            new CommonSequenceSegmentDaoImpl(mdaDataSource)
        ));
        IllegalStateException duplicateException = assertThrows(
            IllegalStateException.class,
            () -> duplicateGenerator.nextId("MdaConnectionProfileId")
        );
        assertTrue(duplicateException.getMessage().contains("multiple active sequence segments found"));
    }

    /**
     * 验证同一真实数据库号段连续取号时只推进一次数据库游标并复用生产本地缓存。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     *
     * @param fixturePath 当前生产方法对应的 UTF-8 SQL fixture 资源路径，例如
     *     {@code "fixtures/SequenceGeneratorBoundaryTest/localCache.sql"}
     */
    public static void verifyRealLocalCache(String fixturePath) {
        // 使用独立数据库重建当前缓存 Case。
        withGenerator(fixturePath, (sequenceGenerator, dataSource) -> {
            // 第一次取号从真实数据库申请区间起点。
            assertEquals(100L, sequenceGenerator.nextId("CacheCode"));
            // 第二次取号从生产本地缓存取得连续编号。
            assertEquals(101L, sequenceGenerator.nextId("CacheCode"));
            // 数据库游标只推进一个十条号段，证明第二次没有再次访问抢号更新。
            assertEquals(110L, queryLong(dataSource, "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'CacheCode'"));
            // 乐观锁版本只增加一次，进一步证明缓存真实生效。
            assertEquals(1L, queryLong(dataSource, "SELECT versionNo FROM CommonSequenceSegment WHERE seqCode = 'CacheCode'"));
        });
    }

    /**
     * 验证非法输入在真实生产发号器中被拒绝且不会推进数据库号段。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     *
     * @param fixturePath 当前生产方法对应的 UTF-8 SQL fixture 资源路径，例如
     *     {@code "fixtures/SequenceGeneratorBoundaryTest/localCache.sql"}
     */
    public static void verifyRealInvalidInput(String fixturePath) {
        // 使用真实数据库和生产 DAO，避免用调用计数替身证明未访问数据库。
        withGenerator(fixturePath, (sequenceGenerator, dataSource) -> {
            // null 编码必须被拒绝。
            assertThrows(IllegalArgumentException.class, () -> sequenceGenerator.nextId(null));
            // 空白编码必须被拒绝。
            assertThrows(IllegalArgumentException.class, () -> sequenceGenerator.nextId("   "));
            // null 主键定义必须被拒绝。
            assertThrows(IllegalArgumentException.class, () -> sequenceGenerator.getSequence(null));
            // 非法输入执行后真实数据库游标必须保持 fixture 初始值。
            assertEquals(900L, queryLong(dataSource, "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'InvalidInputCode'"));
            // 数据库版本保持零，证明没有发生抢号更新。
            assertEquals(0L, queryLong(dataSource, "SELECT versionNo FROM CommonSequenceSegment WHERE seqCode = 'InvalidInputCode'"));
        });
    }

    /**
     * 使用共享生产发号器和多实例生产发号器验证真实续段锁、乐观锁冲突重试与重试耗尽。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     *
     * @param fixturePath 当前生产方法对应的 UTF-8 SQL fixture 资源路径，例如
     *     {@code "fixtures/SequenceGeneratorBoundaryTest/localCache.sql"}
     */
    public static void verifyRealConcurrentContention(String fixturePath) {
        // 创建当前并发 Case 独立真实数据库。
        JdbcDataSource dataSource = newDataSource();
        // 加载共享缓存号段与多实例竞争号段。
        loadFixture(dataSource, fixturePath);
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            // 注册真实数据源。
            context.registerBean(DataSource.class, () -> dataSource);
            // 注册生产号段 DAO。
            context.registerBean(CommonSequenceSegmentDaoImpl.class);
            // 注册生产共享发号器。
            context.registerBean(SequenceGeneratorImpl.class);
            // 启动最小生产容器。
            context.refresh();
            // 取得所有并发线程共享的生产号段 DAO。
            CommonSequenceSegmentDaoImpl sequenceDao = context.getBean(CommonSequenceSegmentDaoImpl.class);
            // 取得共享生产发号器验证同一 JVM 续段锁。
            SequenceGenerator sharedGenerator = context.getBean(SequenceGeneratorImpl.class);
            // 同时启动六十四个线程，确保多个线程在缓存尚未补齐时进入同一真实续段竞争窗口。
            List<Long> sharedIds = runConcurrent(64, () -> sharedGenerator.nextId("SharedConcurrentCode"));
            // 所有线程必须取得不同编号。
            assertEquals(64, new HashSet<>(sharedIds).size());
            // 步长一百的共享号段只允许被真实数据库推进一次。
            assertEquals(1100L, queryLong(dataSource, "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'SharedConcurrentCode'"));

            // 保存真实乐观锁重试耗尽次数。
            AtomicInteger exhaustedCount = new AtomicInteger();
            // 保存所有成功生成的真实编号。
            List<Long> contendedIds = Collections.synchronizedList(new ArrayList<>());
            // 多轮高并发让独立 JVM 缓存实例真实争抢同一单步长数据库号段。
            for (int waveIndex = 0; waveIndex < 8 && exhaustedCount.get() == 0; waveIndex++) {
                // 每个并发任务使用独立生产发号器，模拟多个应用实例共享同一数据库号段。
                runConcurrentAllowingExhaustion(96, sequenceDao, contendedIds, exhaustedCount);
            }
            // 至少一个真实请求必须经历三次数据库乐观锁冲突并触发生产重试耗尽保护。
            assertTrue(exhaustedCount.get() > 0);
            // 所有成功请求取得的数据库编号必须保持唯一。
            assertEquals(contendedIds.size(), new HashSet<>(contendedIds).size());
            // 数据库游标推进数量必须与真实成功发号数量一致。
            assertEquals(
                2000L + contendedIds.size(),
                queryLong(dataSource, "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'ContendedCode'")
            );
        }
    }

    /**
     * 使用独立 H2 和最小 Spring 容器执行一个真实发号 Case。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     *
     * @param fixturePath 当前发号 Case 对应的 SQL fixture，例如
     *     {@code "fixtures/SequenceGeneratorBoundaryTest/localCache.sql"}
     * @param generatorCase 使用生产发号器和独立数据库执行验证的 Case 动作
     */
    private static void withGenerator(String fixturePath, GeneratorCase generatorCase) {
        // 创建当前 Case 独立 H2 数据源。
        JdbcDataSource dataSource = newDataSource();
        // 从测试类与方法对应目录加载真实号段数据。
        loadFixture(dataSource, fixturePath);
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            // 注册真实数据源供生产 DAO 自动注入。
            context.registerBean(DataSource.class, () -> dataSource);
            // 注册生产公共号段 DAO。
            context.registerBean(CommonSequenceSegmentDaoImpl.class);
            // 注册生产公共发号服务。
            context.registerBean(SequenceGeneratorImpl.class);
            // 启动最小 Spring 容器完成真实依赖装配。
            context.refresh();
            // 把生产发号器和真实数据库交给当前 Case 验证动作。
            generatorCase.verify(context.getBean(SequenceGeneratorImpl.class), dataSource);
        }
    }

    /**
     * 创建大小写稳定且每个 Case 独立的 H2 数据源。
     *
     * @return 可同时供 Spring 和 JDBC 使用的独立 H2 数据源，例如
     *     {@code jdbc:h2:mem:<运行时随机UUID>;DATABASE_TO_UPPER=false}
     */
    private static JdbcDataSource newDataSource() {
        // 随机库名避免并发 Case 共享表状态。
        return dataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false");
    }

    /**
     * 按明确 URL 创建可供项目 DAO 使用的隔离 H2 数据源。
     *
     * @param url 测试数据库或项目 schema URL，例如 {@code jdbc:h2:mem:case;SCHEMA=MDA_DB}
     * @return 已配置 sa 用户且无密码的真实 H2 数据源
     */
    private static JdbcDataSource dataSource(String url) {
        // 创建 H2 JDBC 数据源并绑定当前 Case 的数据库边界。
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL(url);
        // H2 默认用户使用 sa。
        dataSource.setUser("sa");
        // H2 内存库不设置密码。
        dataSource.setPassword("");
        // 返回可供 Spring 和 JDBC 共用的真实数据源。
        return dataSource;
    }

    /**
     * 从 UTF-8 SQL 资源重建当前真实数据库 Case。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     *
     * @param dataSource 当前 Case 独立 H2 数据源
     * @param fixturePath 当前发号方法对应的 SQL fixture，例如
     *     {@code "fixtures/SequenceGeneratorBoundaryTest/localCache.sql"}
     * @throws AssertionError 当 fixture 缺失或初始化 SQL 执行失败时抛出
     */
    private static void loadFixture(DataSource dataSource, String fixturePath) {
        // 按测试类和方法目录读取唯一 fixture。
        InputStream fixtureStream = SequenceGeneratorTestVerifier.class.getClassLoader().getResourceAsStream(fixturePath);
        // fixture 缺失时立即失败。
        if (fixtureStream == null) {
            throw new AssertionError("fixture not found: " + fixturePath);
        }
        try (
            // 使用 UTF-8 读取完整 SQL。
            InputStreamReader fixtureReader = new InputStreamReader(fixtureStream, StandardCharsets.UTF_8);
            // 获取真实连接执行建表和数据准备。
            Connection connection = dataSource.getConnection()
        ) {
            // H2 按资源 SQL 重建当前 Case。
            RunScript.execute(connection, fixtureReader);
        } catch (Exception exception) {
            // fixture 执行失败直接结束测试。
            throw new AssertionError("failed to load fixture: " + fixturePath, exception);
        }
    }

    /**
     * 从真实数据库读取单个 long 期待值。
     *
     * @param dataSource 当前 Case 独立 H2 数据源
     * @param sql 验证器内部固定的期待查询，例如
     *     {@code "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'LocalCacheCode'"}
     * @return 第一行第一列长整数，例如 {@code 1003L}
     * @throws AssertionError 当期待查询失败或没有结果时抛出
     */
    private static long queryLong(DataSource dataSource, String sql) {
        try (
            // 获取独立期待查询连接。
            Connection connection = dataSource.getConnection();
            // 创建固定测试查询语句。
            Statement statement = connection.createStatement();
            // 执行单值期待 SQL。
            ResultSet resultSet = statement.executeQuery(sql)
        ) {
            // 期待查询必须返回一行。
            assertTrue(resultSet.next());
            // 第一列统一按 long 返回。
            return resultSet.getLong(1);
        } catch (Exception exception) {
            // 数据库期待查询失败直接转换成测试失败。
            throw new AssertionError("failed expected query: " + sql, exception);
        }
    }

    /**
     * 同时执行固定数量的真实发号调用并返回全部成功编号。
     *
     * @param taskCount 同时启动的真实发号线程数，例如 {@code 64}
     * @param idSupplier 每个线程调用的生产发号动作，例如 {@code () -> sequenceGenerator.nextId("LocalCacheCode")}
     * @return 全部成功生成且保持唯一的编号，例如 {@code [1000,1001,1002]}
     */
    private static List<Long> runConcurrent(int taskCount, java.util.function.Supplier<Long> idSupplier) {
        // 起跑信号保证多个线程同时观察初始数据库和缓存状态。
        CountDownLatch startLatch = new CountDownLatch(1);
        // 完成信号用于等待全部真实发号调用结束。
        CountDownLatch finishLatch = new CountDownLatch(taskCount);
        // 并发写入列表保存全部成功编号。
        List<Long> ids = Collections.synchronizedList(new ArrayList<>());
        // 保存线程中的第一个意外异常。
        List<Throwable> failures = Collections.synchronizedList(new ArrayList<>());
        // 创建固定数量的真实发号线程。
        for (int taskIndex = 0; taskIndex < taskCount; taskIndex++) {
            // 每个线程只执行一次生产发号调用。
            Thread worker = new Thread(() -> {
                try {
                    // 等待统一起跑信号。
                    await(startLatch);
                    // 保存生产发号器返回的真实编号。
                    ids.add(idSupplier.get());
                } catch (Throwable failure) {
                    // 记录任何意外异常供主测试线程明确失败。
                    failures.add(failure);
                } finally {
                    // 当前真实调用结束后递减完成计数。
                    finishLatch.countDown();
                }
            });
            // 启动当前真实发号线程。
            worker.start();
        }
        // 同时释放全部线程。
        startLatch.countDown();
        // 等待全部真实调用完成。
        await(finishLatch);
        // 共享缓存场景不允许出现业务异常。
        assertTrue(failures.isEmpty(), failures.toString());
        // 返回全部真实编号。
        return ids;
    }

    /**
     * 使用独立生产发号器并发争抢单步长号段，只统计生产重试耗尽异常。
     *
     * @param taskCount 当前竞争波次的应用实例数，例如 {@code 96}
     * @param sequenceDao 全部实例共享的真实数据库号段 DAO
     * @param generatedIds 用于保存成功生成编号的线程安全列表
     * @param exhaustedCount 用于累计生产重试耗尽次数的原子计数器
     * 执行结果示例：成功编号全部唯一，至少一个竞争请求按生产规则发生重试耗尽。
     */
    private static void runConcurrentAllowingExhaustion(
        int taskCount,
        CommonSequenceSegmentDaoImpl sequenceDao,
        List<Long> generatedIds,
        AtomicInteger exhaustedCount
    ) {
        // 起跑信号扩大真实查询与乐观锁更新的竞争窗口。
        CountDownLatch startLatch = new CountDownLatch(1);
        // 完成信号等待当前竞争波次全部结束。
        CountDownLatch finishLatch = new CountDownLatch(taskCount);
        // 保存非预期异常。
        List<Throwable> unexpectedFailures = Collections.synchronizedList(new ArrayList<>());
        // 创建当前波次全部独立应用实例。
        for (int taskIndex = 0; taskIndex < taskCount; taskIndex++) {
            // 每个线程创建自己的生产发号器与本地缓存。
            Thread worker = new Thread(() -> {
                try {
                    // 等待当前波次统一起跑。
                    await(startLatch);
                    // 独立生产实例通过共享真实 DAO 争抢同一数据库号段。
                    generatedIds.add(new SequenceGeneratorImpl(sequenceDao).nextId("ContendedCode"));
                } catch (IllegalStateException exception) {
                    // 只有生产定义的重试耗尽异常属于当前真实竞争 Case 的期待边界。
                    if (exception.getMessage() != null && exception.getMessage().contains("retry exhausted")) {
                        // 记录当前真实重试耗尽结果。
                        exhaustedCount.incrementAndGet();
                    } else {
                        // 其他数据库或配置异常仍属于测试失败。
                        unexpectedFailures.add(exception);
                    }
                } catch (Throwable failure) {
                    // 非生产重试耗尽异常全部保留为测试失败。
                    unexpectedFailures.add(failure);
                } finally {
                    // 当前实例调用结束后递减完成计数。
                    finishLatch.countDown();
                }
            });
            // 启动当前独立应用实例线程。
            worker.start();
        }
        // 同时释放当前波次全部实例。
        startLatch.countDown();
        // 等待当前波次结束。
        await(finishLatch);
        // 当前竞争只允许出现成功或明确重试耗尽。
        assertTrue(unexpectedFailures.isEmpty(), unexpectedFailures.toString());
    }

    /**
     * 等待并发 Case 信号并统一处理超时和中断。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     *
     * @param latch 当前并发 Case 的起跑或完成信号，例如计数为 {@code 64} 的完成锁
     * @throws AssertionError 当三十秒内未完成或当前线程被中断时抛出
     */
    private static void await(CountDownLatch latch) {
        try {
            // 最多等待三十秒，避免数据库竞争测试永久挂起。
            assertTrue(latch.await(30, TimeUnit.SECONDS));
        } catch (InterruptedException exception) {
            // 恢复测试线程中断状态。
            Thread.currentThread().interrupt();
            // 中断直接转换成明确测试失败。
            throw new AssertionError("real sequence contention test interrupted", exception);
        }
    }

    // 当前函数式接口只承接生产发号器和真实数据库，不允许替换任何业务依赖。
    @FunctionalInterface
    private interface GeneratorCase {

        /**
         * 执行当前真实数据库 Case 的生产发号调用和独立数据库验证。
         *
         * @param sequenceGenerator 最小 Spring 容器装配的生产发号器
         * @param dataSource 当前 Case 独立 H2 数据源
         * 执行结果示例：业务调用与数据库游标期待全部通过。
         */
        void verify(SequenceGenerator sequenceGenerator, DataSource dataSource);
    }
}
