package com.sp.selplat.common.service.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.db.sequence.model.IdSequenceDefinition;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
import com.sp.selplat.common.util.CommonResult;
import java.lang.reflect.Proxy;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

// 基础 Service 验证器使用真实 Spring 容器确认泛型 DAO 注入，避免只靠反射证明字段存在。
public final class BaseServiceImplTestVerifier {

    // 验证器不保存容器或 DAO 状态，每次 Case 都创建独立 Spring 上下文。
    private BaseServiceImplTestVerifier() {
    }

    // 验证两个不同业务 Service 能通过继承的 getDao() 分别取得自己的强类型 DAO。
    public static void verifyGenericDaoInjection() {
        // 创建轻量 Spring 容器执行与业务应用相同的依赖注入过程。
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            // 创建第一类 DAO 接口代理，当前 Case 只验证装配身份而不执行数据库方法。
            FirstDao firstDao = createDaoProxy(FirstDao.class, "FirstEntityId");
            // 创建第二类 DAO 接口代理，用于证明基础类不会在多个 BaseDao Bean 中错误注入。
            SecondDao secondDao = createDaoProxy(SecondDao.class, "SecondEntityId");
            // 注册可识别不同 DAO 号段定义的公共发号器，验证基础 Service 的统一发号入口。
            SequenceGenerator sequenceGenerator = new TestSequenceGenerator();
            // 第一类 DAO 以真实接口类型注册，供 Spring 根据 Service 泛型解析。
            context.registerBean(FirstDao.class, () -> firstDao);
            // 第二类 DAO 同时注册，确保测试覆盖多 DAO 候选场景。
            context.registerBean(SecondDao.class, () -> secondDao);
            // 公共发号器以生产接口类型注册，供两个基础 Service 子类共享同一个装配入口。
            context.registerBean(SequenceGenerator.class, () -> sequenceGenerator);
            // 第一类业务 Service 只通过 BaseServiceImpl 泛型声明自己的 DAO 类型。
            context.registerBean(FirstService.class);
            // 第二类业务 Service 使用另一 DAO 泛型，验证每个子类独立解析。
            context.registerBean(SecondService.class);
            // 刷新容器后触发基础类私有 DAO 字段的真实自动注入。
            context.refresh();
            // 第一类 Service 的 getDao() 必须返回第一类 DAO Bean。
            assertSame(firstDao, context.getBean(FirstService.class).currentDao());
            // 第二类 Service 的 getDao() 必须返回第二类 DAO Bean。
            assertSame(secondDao, context.getBean(SecondService.class).currentDao());
            // 第一类 Service 必须根据自身 DAO 号段定义获得对应主键值。
            assertEquals(Map.of("id", 101L), context.getBean(FirstService.class).currentSequence());
            // 第二类 Service 必须使用另一 DAO 定义，证明公共发号入口不会串用模块。
            assertEquals(Map.of("id", 202L), context.getBean(SecondService.class).currentSequence());
            // 基础成功结果入口必须统一构建固定 CommonResult。
            CommonResult commonResult = context.getBean(FirstService.class).successResult("result-data", "完成");
            // 公共入口统一设置成功标记。
            assertTrue(commonResult.isSuccess());
            // data 必须保持调用方提供的业务数据。
            assertEquals("result-data", commonResult.getData());
            // msg 必须保持调用方提供的业务说明。
            assertEquals("完成", commonResult.getMsg());
            // 写入重载必须在固定 CommonResult 顶层保存影响行数。
            CommonResult writeResult = context.getBean(FirstService.class).writeResult("items", 2, "批量完成");
            // 写入结果仍直接保存原始业务数据。
            assertEquals("items", writeResult.getData());
            // 影响行数必须位于公共字段而不是嵌套 data。
            assertEquals(2, writeResult.getAffectedRows());
        }
    }

    // 创建只用于容器类型装配的 DAO 接口代理，避免测试重新实现全部 BaseDao 业务方法。
    private static <D extends BaseDao> D createDaoProxy(Class<D> daoType, String sequenceCode) {
        // JDK 代理保持真实 DAO 接口类型，调用数据库方法时明确拒绝，防止结构测试伪装成功业务结果。
        Object proxy = Proxy.newProxyInstance(
            daoType.getClassLoader(),
            new Class<?>[]{daoType},
            (proxyInstance, method, arguments) -> {
                // Object.toString 可能被容器诊断调用，返回稳定接口名称避免无关异常。
                if ("toString".equals(method.getName())) {
                    return daoType.getSimpleName();
                }
                // Object.hashCode 使用实例身份值，保证代理可以安全参与容器内部集合。
                if ("hashCode".equals(method.getName())) {
                    return System.identityHashCode(proxyInstance);
                }
                // Object.equals 只按实例身份判断，避免两个 DAO 代理被错误视为同一个 Bean。
                if ("equals".equals(method.getName())) {
                    return proxyInstance == arguments[0];
                }
                // 公共 getSequence() 只允许通过当前 DAO 公开入口取得主键号段定义。
                if ("getIdSequenceDefinition".equals(method.getName())) {
                    return new IdSequenceDefinition(Map.of("id", sequenceCode));
                }
                // 当前结构测试不允许执行任何真实 DAO 方法，数据库行为继续由 common-db 真实数据测试覆盖。
                throw new UnsupportedOperationException("DAO method is outside BaseServiceImpl injection test: " + method.getName());
            }
        );
        // 代理已由目标接口创建，使用接口 cast 返回强类型 DAO 供容器注册。
        return daoType.cast(proxy);
    }

    // 第一类测试 DAO 只作为 BaseDao 泛型标记，模拟一个业务模块的公开 DAO 门面。
    private interface FirstDao extends BaseDao {
    }

    // 第二类测试 DAO 作为另一个业务模块标记，用于制造多个 BaseDao Bean 候选。
    private interface SecondDao extends BaseDao {
    }

    // 测试发号器按 DAO 提供的号段编码返回稳定值，验证基础 Service 的字段归属与模块隔离。
    private static final class TestSequenceGenerator implements SequenceGenerator {

        // 单编码入口按当前两个测试模块返回可识别编号。
        @Override
        public Long nextId(String seqCode) {
            // 第一模块号段固定返回 101，第二模块固定返回 202。
            return "FirstEntityId".equals(seqCode) ? 101L : 202L;
        }

        // 复合定义入口保持字段顺序逐项生成编号，与生产发号器返回结构一致。
        @Override
        public Map<String, Long> getSequence(IdSequenceDefinition definition) {
            // 使用有序映射保存当前 DAO 每个主键字段的生成结果。
            Map<String, Long> generatedIds = new LinkedHashMap<>();
            // 按号段定义逐项调用测试单编码入口，验证字段和值一一对应。
            definition.getIdSequenceCodeMap().forEach(
                (idColumn, sequenceCode) -> generatedIds.put(idColumn, nextId(sequenceCode))
            );
            // 返回可供基础 Service 直接回填业务参数的字段映射。
            return generatedIds;
        }
    }

    // 第一类测试 Service 只声明 DAO 泛型并通过公开测试桥接读取受保护 getDao()。
    private static final class FirstService extends BaseServiceImpl<FirstDao> {

        // 返回基础类已注入的第一类 DAO，供当前结构验证器核对 Bean 身份。
        private FirstDao currentDao() {
            // 真实读取路径必须经过生产 getDao()，不得反射访问基础类字段。
            return getDao();
        }

        // 暴露基础发号入口供验证器确认当前 DAO 定义被正确使用。
        private Map<String, Long> currentSequence() {
            // 直接调用生产 getSequence()，禁止测试绕过基础 Service 访问发号器。
            return getSequence();
        }

        // 暴露标准成功结果入口，验证基础类一次构建固定 CommonResult。
        private CommonResult successResult(Object data, String message) {
            // 直接调用生产公共入口，测试子类不自行设置任何返回字段。
            return buildSuccessResult(data, message);
        }

        // 暴露带影响行数的成功结果重载，验证批量写入返回结构。
        private CommonResult writeResult(Object data, int affectedRows, String message) {
            // 直接调用生产公共重载，测试子类不创建嵌套结果 Map。
            return buildSuccessResult(data, affectedRows, message);
        }
    }

    // 第二类测试 Service 证明同一基础类能为不同业务模块解析另一 DAO 泛型。
    private static final class SecondService extends BaseServiceImpl<SecondDao> {

        // 返回基础类已注入的第二类 DAO，供当前结构验证器核对 Bean 身份。
        private SecondDao currentDao() {
            // 真实读取路径必须经过生产 getDao()，确保两个 Service 使用相同公共入口。
            return getDao();
        }

        // 暴露第二类 DAO 的基础发号结果，验证多个模块不会串用号段定义。
        private Map<String, Long> currentSequence() {
            // 通过生产 getSequence() 读取当前 SecondDao 的号段定义。
            return getSequence();
        }
    }
}
