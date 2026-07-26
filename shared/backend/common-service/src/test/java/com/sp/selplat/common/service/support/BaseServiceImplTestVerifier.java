package com.sp.selplat.common.service.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.db.sequence.model.IdSequenceDefinition;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.lang.reflect.Proxy;
import java.util.List;
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
            // 使用第一类 Service 执行公共 CRUD 默认流程，验证下沉能力仍通过同一个强类型 DAO 门面。
            verifyCommonCrudDefaults(context.getBean(FirstService.class));
        }
    }

    // 验证公共 Service 默认实现完整覆盖分页、查询、新增、更新和假删除链路。
    private static void verifyCommonCrudDefaults(FirstService service) {
        // 构造带动态条件和分页信息的前端查询对象。
        CommonPageParam pageIn = new CommonPageParam();
        // 动态条件直接写入同一个分页参数，验证父类不会重组查询字段。
        pageIn.putParam("status", 1);
        // 当前页使用第二页，验证父类独立透传页码。
        pageIn.setPageNo(2);
        // 每页条数使用十条，验证父类独立透传页面容量。
        pageIn.setPageSize(10);
        // 公共分页入口必须直接返回 DAO 构建的固定分页结构。
        CommonPageResult pageResult = service.getStore(pageIn);
        // 测试 DAO 回传的真实页码必须保持不变。
        assertEquals(2, pageResult.getPageNo());
        // 测试 DAO 回传的记录必须进入固定 records 字段。
        assertEquals(1L, pageResult.getRecords().get(0).get("id"));

        // 构造可以命中测试 DAO 的单条主键参数。
        CommonParam idIn = param("id", 1L);
        // 公共单条查询入口必须把 DAO 记录放入固定 CommonResult。
        CommonResult detailResult = service.getById(idIn);
        // 详情结果必须保留 DAO 返回的主键值。
        assertEquals(1L, resultMap(detailResult).get("id"));
        // 缺少主键时测试 DAO 返回 null，父类必须统一抛出未找到异常。
        assertThrows(IllegalArgumentException.class, () -> service.getById(new CommonParam()));

        // 构造两项批量主键参数验证公共批量查询入口。
        CommonBatchParam idsIn = batch(param("id", 1L), param("id", 2L));
        // 公共批量查询结果必须直接使用 DAO 返回记录列表。
        CommonResult detailsResult = service.getByIds(idsIn);
        // 批量详情结果必须保留测试 DAO 返回的两条记录。
        assertEquals(2, resultList(detailsResult).size());

        // 构造普通新增参数验证父类统一生成主键并落库。
        CommonParam insertIn = param("name", "insert");
        // 公共新增入口必须返回包含生成主键的同一参数映射。
        CommonResult insertResult = service.insert(insertIn);
        // 第一类测试号段生成的主键必须写入新增结果。
        assertEquals(101L, resultMap(insertResult).get("id"));

        // 构造两项批量新增参数验证逐项发号和累计影响行数。
        CommonBatchParam insertBatchIn = batch(param("name", "first"), param("name", "second"));
        // 公共批量新增入口必须返回固定批量结果。
        CommonResult insertBatchResult = service.insertBatch(insertBatchIn);
        // 测试 DAO 返回的累计影响行数必须位于 CommonResult 顶层。
        assertEquals(2, insertBatchResult.getAffectedRows());
        // 两个新增项都必须取得当前 DAO 对应的生成主键。
        assertTrue(insertBatchIn.getItems().stream().allMatch(item -> item.getParam("id") != null));

        // 构造普通更新参数验证父类直接透传到 DAO。
        CommonParam updateIn = param("id", 1L);
        // 更新字段继续写入同一个参数对象。
        updateIn.putParam("name", "updated");
        // 公共更新入口必须返回原始更新字段映射。
        CommonResult updateResult = service.update(updateIn);
        // 更新结果必须保留前端提交的字段值。
        assertEquals("updated", resultMap(updateResult).get("name"));

        // 构造两项批量更新参数验证累计影响行数。
        CommonBatchParam updateBatchIn = batch(param("id", 1L), param("id", 2L));
        // 公共批量更新入口必须返回固定批量结果。
        CommonResult updateBatchResult = service.updateBatch(updateBatchIn);
        // 测试 DAO 返回的累计影响行数必须位于 CommonResult 顶层。
        assertEquals(2, updateBatchResult.getAffectedRows());

        // 构造普通假删除参数验证 DAO 补充字段可以直接回传。
        CommonParam deleteIn = param("id", 1L);
        // 公共假删除入口必须调用 BaseDao.softDelete。
        CommonResult deleteResult = service.delete(deleteIn);
        // 测试 DAO 补充的删除状态必须进入固定结果数据。
        assertEquals(0, resultMap(deleteResult).get("status"));

        // 构造两项批量假删除参数验证事务默认入口和累计影响行数。
        CommonBatchParam deleteBatchIn = batch(param("id", 1L), param("id", 2L));
        // 公共批量假删除入口必须返回固定批量结果。
        CommonResult deleteBatchResult = service.deleteBatch(deleteBatchIn);
        // 测试 DAO 返回的累计影响行数必须位于 CommonResult 顶层。
        assertEquals(2, deleteBatchResult.getAffectedRows());
        // 每个批量项都必须保留 DAO 补充的假删除状态。
        assertTrue(deleteBatchIn.getItems().stream().allMatch(item -> Integer.valueOf(0).equals(item.getParam("status"))));
    }

    // 创建带一个动态字段的通用参数，供公共 CRUD Case 复用同一前端参数形状。
    private static CommonParam param(String fieldName, Object fieldValue) {
        // 新建独立参数对象，避免不同 CRUD 动作之间共享可变字段。
        CommonParam param = new CommonParam();
        // 写入当前 Case 需要的唯一动态字段。
        param.putParam(fieldName, fieldValue);
        // 返回已经完成字段填充的通用参数。
        return param;
    }

    // 创建保持输入顺序的批量参数，验证父类不会复制或重排前端 items。
    private static CommonBatchParam batch(CommonParam... items) {
        // 新建公共批量参数承接当前 Case 的全部业务项。
        CommonBatchParam batchParam = new CommonBatchParam();
        // 按调用顺序写入批量项，模拟前端 JSON items 的稳定顺序。
        batchParam.setItems(List.of(items));
        // 返回已经完成 items 填充的批量参数。
        return batchParam;
    }

    // 读取固定 CommonResult 中的单条字段映射。
    @SuppressWarnings("unchecked")
    private static Map<String, Object> resultMap(CommonResult result) {
        // 公共默认实现约定单条写入和详情 data 直接保存字段映射。
        return (Map<String, Object>) result.getData();
    }

    // 读取固定 CommonResult 中的批量记录列表。
    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> resultList(CommonResult result) {
        // 公共批量查询约定 data 直接保存 DAO 返回的记录列表。
        return (List<Map<String, Object>>) result.getData();
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
                // 分页入口返回由调用参数形成的固定结果，验证父类原样透传查询和分页信息。
                if ("getPageList".equals(method.getName())) {
                    CommonPageResult pageResult = new CommonPageResult();
                    pageResult.setRecords(List.of(Map.of("id", 1L, "status", ((Map<?, ?>) arguments[0]).get("status"))));
                    pageResult.setTotalCount(1L);
                    pageResult.setPageNo((Integer) arguments[1]);
                    pageResult.setPageSize((Integer) arguments[2]);
                    return pageResult;
                }
                // 单条查询只在参数含 id 时返回记录，让测试覆盖父类命中和未命中分支。
                if ("getById".equals(method.getName())) {
                    CommonParam queryIn = (CommonParam) arguments[0];
                    return queryIn.getParam("id") == null ? null : Map.of("id", queryIn.getParam("id"));
                }
                // 批量查询按输入项返回对应主键记录，验证父类不循环调用单条接口。
                if ("getByIds".equals(method.getName())) {
                    CommonBatchParam queryIn = (CommonBatchParam) arguments[0];
                    return queryIn.getItems().stream().map(item -> Map.of("id", item.getParam("id"))).toList();
                }
                // 单条新增和更新只返回一行影响数，数据库字段处理由 common-db 真实测试负责。
                if ("insert".equals(method.getName()) || "update".equals(method.getName())) {
                    return 1;
                }
                // 批量新增和更新按输入项数返回累计影响行数。
                if ("insertBatch".equals(method.getName()) || "updateBatch".equals(method.getName())) {
                    return ((CommonBatchParam) arguments[0]).getItems().size();
                }
                // 单条假删除模拟 DAO 补充公共删除状态后返回一行影响数。
                if ("softDelete".equals(method.getName())) {
                    ((CommonParam) arguments[0]).putParam("status", 0);
                    return 1;
                }
                // 批量假删除逐项补充公共删除状态并返回累计影响行数。
                if ("softDeleteBatch".equals(method.getName())) {
                    CommonBatchParam deleteIn = (CommonBatchParam) arguments[0];
                    deleteIn.getItems().forEach(item -> item.putParam("status", 0));
                    return deleteIn.getItems().size();
                }
                // 未纳入当前基础 Service 默认流程的方法必须明确拒绝，避免代理静默吞掉错误调用。
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
