package com.sp.selplat.common.service.sequence.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDao;
import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDaoImpl;
import com.sp.selplat.common.db.sequence.model.CommonSequenceSegmentRange;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.h2.jdbcx.JdbcDataSource;
import org.h2.tools.RunScript;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

// 公共发号验证器把真实数据库正常流和可控算法边界分开维护，让测试方法只保留一次 Case 调用。
public final class SequenceGeneratorTestVerifier {

    // 验证器不保存跨 Case 状态，避免 SequenceGenerator 本地缓存互相污染。
    private SequenceGeneratorTestVerifier() {
    }

    // 验证复合主键通过真实 Spring、真实号段 DAO 和真实 H2 分别取号。
    public static void verifyRealCompositeSequence(String fixturePath) {
        // 创建当前 Case 独立 H2 数据源。
        JdbcDataSource dataSource = newDataSource();
        // 从方法目录加载真实号段表和复合主键数据。
        loadFixture(dataSource, fixturePath);
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            // 注册当前真实数据源供生产 DAO 自动注入。
            context.registerBean(DataSource.class, () -> dataSource);
            // 注册真实公共号段 DAO。
            context.registerBean(CommonSequenceSegmentDaoImpl.class);
            // 注册真实公共发号服务。
            context.registerBean(SequenceGeneratorImpl.class);
            // 启动最小 Spring 容器完成生产依赖装配。
            context.refresh();
            // 从 Spring 获取真实发号服务。
            SequenceGenerator sequenceGenerator = context.getBean(SequenceGeneratorImpl.class);
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
        }
    }

    // 验证同一号段连续取号复用本地缓存。
    public static void verifyLocalCache() {
        // 创建每次申请返回十个编号的固定 DAO。
        CountingRangeDao rangeDao = new CountingRangeDao(100L, 109L, 0);
        // 创建真实发号实现执行本地缓存算法。
        SequenceGenerator generator = new SequenceGeneratorImpl(rangeDao);
        // 第一次取号从 DAO 申请区间起点。
        assertEquals(100L, generator.nextId("CacheCode"));
        // 第二次取号直接使用同一区间下一个编号。
        assertEquals(101L, generator.nextId("CacheCode"));
        // 两次发号只允许访问 DAO 一次。
        assertEquals(1, rangeDao.allocateCount.get());
    }

    // 验证一次空返回后发号服务继续重试并成功缓存区间。
    public static void verifyRetryThenSuccess() {
        // DAO 第一次模拟乐观锁冲突，第二次返回有效区间。
        CountingRangeDao rangeDao = new CountingRangeDao(300L, 309L, 1);
        // 创建真实发号实现执行重试流程。
        SequenceGenerator generator = new SequenceGeneratorImpl(rangeDao);
        // 重试成功后必须返回有效区间起点。
        assertEquals(300L, generator.nextId("RetryCode"));
        // DAO 必须经历一次冲突和一次成功。
        assertEquals(2, rangeDao.allocateCount.get());
    }

    // 验证连续三次空返回触发重试耗尽异常。
    public static void verifyRetryExhausted() {
        // DAO 配置超过最大重试次数的连续冲突。
        CountingRangeDao rangeDao = new CountingRangeDao(400L, 409L, 3);
        // 创建真实发号实现执行重试耗尽流程。
        SequenceGenerator generator = new SequenceGeneratorImpl(rangeDao);
        // 连续三次失败必须抛出明确非法状态异常。
        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> generator.nextId("ExhaustedCode")
        );
        // 异常信息必须包含当前号段编码。
        assertTrue(exception.getMessage().contains("ExhaustedCode"));
        // DAO 调用次数必须严格等于最大重试次数。
        assertEquals(3, rangeDao.allocateCount.get());
    }

    // 验证并发等待线程进入锁后复用已经补好的缓存段。
    public static void verifyConcurrentRefill() {
        // 阻塞 DAO 让第一个线程持有续段锁时第二个线程能够进入等待状态。
        BlockingRangeDao rangeDao = new BlockingRangeDao();
        // 创建两个线程共享的真实发号实现。
        SequenceGenerator generator = new SequenceGeneratorImpl(rangeDao);
        // 保存第一个线程生成值。
        AtomicReference<Long> firstId = new AtomicReference<>();
        // 保存第二个线程生成值。
        AtomicReference<Long> secondId = new AtomicReference<>();
        // 第一个线程进入真实续段流程并在 DAO 内阻塞。
        Thread firstThread = new Thread(() -> firstId.set(generator.nextId("ConcurrentCode")));
        // 启动第一个发号线程。
        firstThread.start();
        // 等待第一个线程确认已经进入 DAO。
        await(rangeDao.allocateEntered);
        // 第二个线程此时观察到缓存为空并等待同一号段锁。
        Thread secondThread = new Thread(() -> secondId.set(generator.nextId("ConcurrentCode")));
        // 启动第二个发号线程。
        secondThread.start();
        // 允许第一个线程完成数据库区间申请并写入缓存。
        rangeDao.allowReturn.countDown();
        // 等待两个线程都完成真实发号。
        join(firstThread);
        // 等待第二个线程复用第一个线程写入的缓存。
        join(secondThread);
        // 两个线程必须分别得到同一号段的连续编号。
        assertEquals(List.of(500L, 501L), List.of(firstId.get(), secondId.get()).stream().sorted().toList());
        // 并发二次检查必须避免第二次 DAO 申请。
        assertEquals(1, rangeDao.allocateCount.get());
    }

    // 验证非法号段编码和空复合主键定义均被公开入口拒绝。
    public static void verifyInvalidInput() {
        // 当前 DAO 不应被非法输入实际调用。
        CountingRangeDao rangeDao = new CountingRangeDao(1L, 10L, 0);
        // 创建真实发号实现执行参数校验。
        SequenceGenerator generator = new SequenceGeneratorImpl(rangeDao);
        // null 编码必须被拒绝。
        assertThrows(IllegalArgumentException.class, () -> generator.nextId(null));
        // 空白编码必须被拒绝。
        assertThrows(IllegalArgumentException.class, () -> generator.nextId("   "));
        // null 主键定义必须被拒绝。
        assertThrows(IllegalArgumentException.class, () -> generator.getSequence(null));
        // 所有非法输入都不得访问 DAO。
        assertEquals(0, rangeDao.allocateCount.get());
    }

    // 创建大小写稳定且每个 Case 独立的 H2 数据源。
    private static JdbcDataSource newDataSource() {
        // 创建 H2 JDBC 数据源。
        JdbcDataSource dataSource = new JdbcDataSource();
        // 随机库名避免并发 Case 共享表状态。
        dataSource.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false");
        // H2 默认用户使用 sa。
        dataSource.setUser("sa");
        // H2 内存库不设置密码。
        dataSource.setPassword("");
        // 返回可供 Spring 和 JDBC 共用的真实数据源。
        return dataSource;
    }

    // 从 UTF-8 SQL 资源重建当前真实数据库 Case。
    private static void loadFixture(DataSource dataSource, String fixturePath) {
        // 按方法目录读取唯一 fixture。
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

    // 从真实数据库读取单个 long 期待值。
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

    // 等待并发测试信号并统一处理超时和中断。
    private static void await(CountDownLatch latch) {
        try {
            // 最多等待五秒，避免并发测试永久挂起。
            assertTrue(latch.await(5, TimeUnit.SECONDS));
        } catch (InterruptedException exception) {
            // 恢复线程中断状态。
            Thread.currentThread().interrupt();
            // 中断直接转换成测试失败。
            throw new AssertionError("concurrent sequence test interrupted", exception);
        }
    }

    // 等待发号线程完成并统一处理超时和中断。
    private static void join(Thread thread) {
        try {
            // 最多等待五秒完成当前发号线程。
            thread.join(TimeUnit.SECONDS.toMillis(5));
            // 线程必须已经正常结束。
            assertTrue(!thread.isAlive());
        } catch (InterruptedException exception) {
            // 恢复线程中断状态。
            Thread.currentThread().interrupt();
            // 中断直接转换成测试失败。
            throw new AssertionError("sequence thread join interrupted", exception);
        }
    }

    // CountingRangeDao 可配置前若干次返回空，稳定覆盖缓存和重试算法边界。
    private static final class CountingRangeDao implements CommonSequenceSegmentDao {

        // 固定区间起点。
        private final long startId;
        // 固定区间终点。
        private final long endId;
        // 成功前需要返回空的次数。
        private final int nullReturnCount;
        // 记录真实 DAO 接口调用次数。
        private final AtomicInteger allocateCount = new AtomicInteger();

        // 创建可配置固定区间 DAO。
        private CountingRangeDao(long startId, long endId, int nullReturnCount) {
            // 保存区间起点。
            this.startId = startId;
            // 保存区间终点。
            this.endId = endId;
            // 保存前置冲突次数。
            this.nullReturnCount = nullReturnCount;
        }

        // 按配置返回空或固定号段。
        @Override
        public CommonSequenceSegmentRange allocateNextRange(String seqCode) {
            // 当前调用次数原子递增。
            int currentCount = allocateCount.incrementAndGet();
            // 前置冲突阶段返回 null。
            if (currentCount <= nullReturnCount) {
                return null;
            }
            // 冲突结束后返回固定真实结构。
            return range(startId, endId);
        }
    }

    // BlockingRangeDao 稳定制造两个线程同时观察缓存为空的并发窗口。
    private static final class BlockingRangeDao implements CommonSequenceSegmentDao {

        // 第一个线程进入 DAO 后发出信号。
        private final CountDownLatch allocateEntered = new CountDownLatch(1);
        // 主测试允许 DAO 返回区间的信号。
        private final CountDownLatch allowReturn = new CountDownLatch(1);
        // 记录实际数据库申请次数。
        private final AtomicInteger allocateCount = new AtomicInteger();

        // 第一次申请阻塞到第二线程已经开始等待。
        @Override
        public CommonSequenceSegmentRange allocateNextRange(String seqCode) {
            // 记录实际申请次数。
            allocateCount.incrementAndGet();
            // 通知主测试第一个线程已进入 DAO。
            allocateEntered.countDown();
            // 等待主测试允许返回。
            await(allowReturn);
            // 返回两个线程可连续消费的固定区间。
            return range(500L, 509L);
        }
    }

    // 创建公共号段 DAO 返回模型。
    private static CommonSequenceSegmentRange range(long startId, long endId) {
        // 创建号段结果。
        CommonSequenceSegmentRange range = new CommonSequenceSegmentRange();
        // 写入区间起点。
        range.setStartId(startId);
        // 写入区间终点。
        range.setEndId(endId);
        // 步长与区间长度保持一致。
        range.setStepSize((int) (endId - startId + 1));
        // 返回可供真实发号算法缓存的区间。
        return range;
    }
}
