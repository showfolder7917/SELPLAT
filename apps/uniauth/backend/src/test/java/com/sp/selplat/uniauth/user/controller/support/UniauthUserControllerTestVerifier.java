package com.sp.selplat.uniauth.user.controller.support;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.uniauth.user.controller.UniauthUserController;
import java.lang.reflect.Method;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * 用户控制器验证器分别承接无业务数据的路由结构检查和真实 Controller 到数据库链路检查。
 */
public final class UniauthUserControllerTestVerifier {

    /**
     * 验证器没有运行期状态，只允许通过静态 Case 入口执行验证。
     */
    private UniauthUserControllerTestVerifier() {
    }

    /**
     * 验证全部公开生产方法的路径和 HTTP 方法，避免接口重命名破坏前端契约。
     */
    public static void verifyRoutes() {
        // getStore 同时支持 GET 和 POST，并直接使用生产方法名作为路径。
        assertRoute("getStore", CommonPageParam.class, "getStore.htm", RequestMethod.GET, RequestMethod.POST);
        // getById 同时支持 GET 和 POST，并直接使用生产方法名作为路径。
        assertRoute("getById", CommonParam.class, "getById.htm", RequestMethod.GET, RequestMethod.POST);
        // getByIds 使用 POST 接收批量 JSON items。
        assertRoute("getByIds", CommonBatchParam.class, "getByIds.htm", RequestMethod.POST);
        // insert 的 Java 名称保持统一，HTTP 路径继续兼容既有 create.htm。
        assertRoute("insert", CommonParam.class, "create.htm", RequestMethod.POST);
        // update 只允许 POST 调用。
        assertRoute("update", CommonParam.class, "update.htm", RequestMethod.POST);
        // delete 只允许 POST 调用。
        assertRoute("delete", CommonParam.class, "delete.htm", RequestMethod.POST);
        // 三个批量写入入口只允许 POST。
        assertRoute("insertBatch", CommonBatchParam.class, "insertBatch.htm", RequestMethod.POST);
        // 批量更新路由与生产方法名保持一致。
        assertRoute("updateBatch", CommonBatchParam.class, "updateBatch.htm", RequestMethod.POST);
        // 批量删除只暴露假删除业务入口。
        assertRoute("deleteBatch", CommonBatchParam.class, "deleteBatch.htm", RequestMethod.POST);
        // Grid 字段列使用两个字符串参数区分视图实例和当前语言，只允许 GET 查询。
        assertRoute(
            "getGridColumn",
            String.class,
            String.class,
            "getGridColumn.htm",
            RequestMethod.GET
        );
    }

    /**
     * 验证十个控制器入口都通过真实 Service、DAO 和数据库完成业务，并仅序列化固定结果结构。
     *
     * @param controller Spring 装配的真实用户控制器，例如连接测试数据源的 {@code UniauthUserController} 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifyRealPublicMethodResponses(
        UniauthUserController controller,
        JdbcTemplate jdbcTemplate
    ) {
        // 管理列表使用第一个 viewCode 请求默认数据库元数据定义。
        String managementDefinitionJson = controller.getGridColumn("user-management", "zh-CN");
        // 当前 Grid 未登记 reference-data 配置，因此来源必须明确标记为字段名静默降级。
        assertTrue(managementDefinitionJson.contains("\"source\":\"DEFAULT_FIELD_NAME\""));
        // 登录账号字段使用与数据库字段相同的 id、field 和 label，不建立 Uniauth 私有表头 DTO。
        assertTrue(managementDefinitionJson.contains("\"field\":\"loginName\""));
        assertTrue(managementDefinitionJson.contains("\"label\":\"loginName\""));
        // 口令摘要字段只返回公共 Grid 字段结构，是否展示由后续 reference-data 配置决定。
        assertTrue(managementDefinitionJson.contains("\"field\":\"passwordHash\""));

        // 用户选择器使用第二个 viewCode 请求同一资源的另一张前端表格定义。
        String selectorDefinitionJson = controller.getGridColumn("user-selector", "ja-JP");
        // 默认阶段两套视图共享数据库列，但必须原样保留各自 viewCode 供未来配置覆盖。
        assertTrue(selectorDefinitionJson.contains("\"viewCode\":\"user-selector\""));
        // locale 同样原样返回，后续 reference-data 可据此选择日文标题。
        assertTrue(selectorDefinitionJson.contains("\"locale\":\"ja-JP\""));

        // 空表格实例编码必须进入统一业务异常体系，禁止退化为 Spring IllegalArgumentException。
        CommonBusinessException viewCodeException = assertThrows(
            CommonBusinessException.class,
            () -> controller.getGridColumn(" ", "zh-CN")
        );
        // 稳定错误编码供前端精确标记 viewCode 参数。
        assertEquals("INVALID_VIEW_CODE", viewCodeException.getErrorCode());
        // 空语言编码必须使用独立业务编码，避免调用方只能解析异常文本。
        CommonBusinessException localeException = assertThrows(
            CommonBusinessException.class,
            () -> controller.getGridColumn("user-management", " ")
        );
        // 稳定错误编码供前端回退到默认语言或提示用户。
        assertEquals("INVALID_LOCALE", localeException.getErrorCode());

        // 分页请求读取 fixture 中两条真实用户并验证固定 records 结构。
        CommonPageParam pageIn = new CommonPageParam();
        // 当前 Case 请求第一页。
        pageIn.setPageNo(1);
        // 当前 Case 容纳全部 fixture 用户。
        pageIn.setPageSize(10);
        // 真实分页 JSON 必须包含数据库账号和固定分页字段。
        String storeJson = controller.getStore(pageIn);
        // records 来自真实分页结果，不允许控制器重新包装。
        assertTrue(storeJson.contains("\"records\""));
        // fixture 中账号证明响应确实来自数据库。
        assertTrue(storeJson.contains("controller-real-high"));

        // 单条查询使用 fixture 中真实主键。
        String detailJson = controller.getById(param("id", 8101L));
        // 详情 JSON 必须包含真实数据库账号。
        assertTrue(detailJson.contains("controller-real-low"));

        // 批量查询使用两组真实主键。
        CommonBatchParam idsIn = batch(param("id", 8101L), param("id", 8102L));
        // 批量响应必须同时包含两条数据库记录。
        String detailsJson = controller.getByIds(idsIn);
        // 第一条真实记录必须进入响应。
        assertTrue(detailsJson.contains("controller-real-low"));
        // 第二条真实记录必须进入响应。
        assertTrue(detailsJson.contains("controller-real-high"));

        // 新增参数只提供前端业务字段，主键和密码摘要由生产链路生成。
        CommonParam insertIn = user("controller-insert", "控制器真实新增");
        // 调用真实新增入口并取得数据库发号结果。
        String insertJson = controller.insert(insertIn);
        // 新增响应必须保持 CommonResult 成功结构。
        assertTrue(insertJson.contains("\"success\":true"));
        // 数据库必须真实保存新增账号。
        assertEquals(1L, count(jdbcTemplate, "controller-insert"));

        // 更新 fixture 中用户的展示名。
        CommonParam updateIn = param("id", 8101L);
        // 前端更新字段直接进入生产 Service 和 DAO。
        updateIn.putParam("displayName", "控制器真实更新");
        // 执行真实更新入口。
        String updateJson = controller.update(updateIn);
        // 更新响应必须保留实际提交字段。
        assertTrue(updateJson.contains("控制器真实更新"));
        // 独立数据库查询确认更新已经落库。
        assertEquals(
            "控制器真实更新",
            jdbcTemplate.queryForObject("SELECT displayName FROM UniauthUser WHERE id = 8101", String.class)
        );

        // 假删除第二条 fixture 用户并保存审计人。
        CommonParam deleteIn = param("id", 8102L);
        // 当前操作人由前端通用参数一路透传。
        deleteIn.putParam("lastOperateUserId", 88L);
        // 执行真实假删除入口。
        String deleteJson = controller.delete(deleteIn);
        // 返回结构必须明确包含假删除状态。
        assertTrue(deleteJson.contains("\"status\":0"));
        // 数据库记录必须保留且状态已经变为零。
        assertEquals(0, jdbcTemplate.queryForObject("SELECT status FROM UniauthUser WHERE id = 8102", Integer.class));

        // 批量新增两名真实用户，验证 Controller 到 JDBC batch 的完整链路。
        CommonBatchParam insertBatchIn = batch(
            user("controller-batch-insert-1", "控制器批量新增一"),
            user("controller-batch-insert-2", "控制器批量新增二")
        );
        // 执行真实批量新增并读取固定顶层影响行数。
        String insertBatchJson = controller.insertBatch(insertBatchIn);
        // 两条真实写入必须产生顶层 affectedRows。
        assertTrue(insertBatchJson.contains("\"affectedRows\":2"));
        // 独立数据库查询确认两个批量账号都已经落库。
        assertEquals(2L, jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM UniauthUser WHERE loginName LIKE 'controller-batch-insert-%'",
            Long.class
        ));

        // 使用批量新增后由生产发号器写回的主键构造真实批量更新。
        CommonBatchParam updateBatchIn = new CommonBatchParam();
        // 第一项沿用真实新增参数并只保留主键和新展示名。
        updateBatchIn.getItems().add(updateItem(insertBatchIn.getItems().get(0), "控制器批量更新一"));
        // 第二项沿用另一真实新增主键。
        updateBatchIn.getItems().add(updateItem(insertBatchIn.getItems().get(1), "控制器批量更新二"));
        // 执行真实批量更新。
        String updateBatchJson = controller.updateBatch(updateBatchIn);
        // 两条更新必须返回真实影响行数。
        assertTrue(updateBatchJson.contains("\"affectedRows\":2"));

        // 把刚才真实更新的两条记录作为批量假删除目标。
        CommonBatchParam deleteBatchIn = new CommonBatchParam();
        // 第一项从生产发号结果取得真实主键。
        deleteBatchIn.getItems().add(deleteItem(insertBatchIn.getItems().get(0), 91L));
        // 第二项从另一生产发号结果取得真实主键。
        deleteBatchIn.getItems().add(deleteItem(insertBatchIn.getItems().get(1), 92L));
        // 执行真实批量假删除。
        String deleteBatchJson = controller.deleteBatch(deleteBatchIn);
        // 两条假删除必须返回真实影响行数。
        assertTrue(deleteBatchJson.contains("\"affectedRows\":2"));
        // 数据库必须保留记录并把两条状态都更新为零。
        assertEquals(2L, jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM UniauthUser WHERE loginName LIKE 'controller-batch-insert-%' AND status = 0",
            Long.class
        ));
    }

    /**
     * 创建包含一个动态字段的真实请求参数。
     *
     * @param key 前端动态字段名，例如 {@code id}
     * @param value 字段值，例如 {@code 8101L}
     * @return 可直接进入控制器的参数，例如 {@code {"paramMap":{"id":8101}}}
     */
    private static CommonParam param(String key, Object value) {
        // 创建前端通用参数对象。
        CommonParam input = new CommonParam();
        // 写入当前业务字段。
        input.putParam(key, value);
        // 返回可直接进入控制器的参数。
        return input;
    }

    /**
     * 创建满足正式表约束的真实新增用户参数。
     *
     * @param loginName 唯一登录名，例如 {@code controller-insert}
     * @param displayName 展示姓名，例如 {@code 控制器真实新增}
     * @return 完整新增参数，例如
     *     {@code {"paramMap":{"tenantId":8,"loginName":"controller-insert","displayName":"控制器真实新增"}}
     */
    private static CommonParam user(String loginName, String displayName) {
        // 创建前端新增参数。
        CommonParam input = new CommonParam();
        // 租户字段满足正式用户归属约束。
        input.putParam("tenantId", 8L);
        // 审计字段记录当前真实测试操作人。
        input.putParam("lastOperateUserId", 8L);
        // 登录名用于独立数据库回查。
        input.putParam("loginName", loginName);
        // 明文密码只交给生产 Service 转换。
        input.putParam("password", "controller-real-password");
        // 展示名满足正式表必填约束。
        input.putParam("displayName", displayName);
        // 排序值参与真实分页。
        input.putParam("sortnum", 18);
        // 新用户初始状态为有效。
        input.putParam("status", 1);
        // 返回完整前端参数。
        return input;
    }

    /**
     * 根据真实新增结果创建只包含主键和展示名的批量更新项。
     *
     * @param insertedItem 已由发号器写回主键的新增项，例如 {@code {"paramMap":{"id":10001}}}
     * @param displayName 待更新展示姓名，例如 {@code 控制器批量更新一}
     * @return 批量更新项，例如 {@code {"paramMap":{"id":10001,"displayName":"控制器批量更新一"}}
     */
    private static CommonParam updateItem(CommonParam insertedItem, String displayName) {
        // 从生产发号器已经写回的参数中读取真实主键。
        CommonParam updateItem = param("id", insertedItem.getParam("id"));
        // 写入当前批量更新展示名。
        updateItem.putParam("displayName", displayName);
        // 返回可直接进入批量更新的参数。
        return updateItem;
    }

    /**
     * 根据真实新增结果创建带审计人的批量假删除项。
     *
     * @param insertedItem 已由发号器写回主键的新增项，例如 {@code {"paramMap":{"id":10001}}}
     * @param operatorId 当前假删除责任人，例如 {@code 91L}
     * @return 假删除项，例如 {@code {"paramMap":{"id":10001,"lastOperateUserId":91}}}
     */
    private static CommonParam deleteItem(CommonParam insertedItem, long operatorId) {
        // 从生产新增结果读取真实主键。
        CommonParam deleteItem = param("id", insertedItem.getParam("id"));
        // 写入当前假删除责任人。
        deleteItem.putParam("lastOperateUserId", operatorId);
        // 返回可直接进入批量假删除的参数。
        return deleteItem;
    }

    /**
     * 创建按原顺序保存的批量参数。
     *
     * @param items 真实请求项，例如两个主键分别为 {@code 8101L}、{@code 8102L} 的参数
     * @return 批量参数，例如 {@code {"items":[{"paramMap":{"id":8101}},{"paramMap":{"id":8102}}]}
     */
    private static CommonBatchParam batch(CommonParam... items) {
        // 创建前端批量参数容器。
        CommonBatchParam batchIn = new CommonBatchParam();
        // 所有真实业务项按调用顺序加入容器。
        batchIn.getItems().addAll(java.util.List.of(items));
        // 返回可直接进入控制器的批量参数。
        return batchIn;
    }

    /**
     * 从真实数据库统计指定账号数量。
     *
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板
     * @param loginName 待统计登录名，例如 {@code controller-insert}
     * @return 匹配记录数，例如新增成功后返回 {@code 1L}
     */
    private static long count(JdbcTemplate jdbcTemplate, String loginName) {
        // 独立期待查询不复用生产 DAO。
        return jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM UniauthUser WHERE loginName = ?",
            Long.class,
            loginName
        );
    }

    /**
     * 按生产方法名读取并验证一个控制器路由契约。
     *
     * @param methodName 控制器生产方法名，例如 {@code getById}
     * @param parameterType 前端参数类型，例如 {@code CommonParam.class}
     * @param expectedPath 预期路由，例如 {@code getById.htm}
     * @param expectedMethods 允许的 HTTP 方法，例如 {@code [GET, POST]}
     * @throws AssertionError 生产方法不存在时抛出，例如误删 {@code getById} 后携带方法名失败
     */
    private static void assertRoute(
        String methodName,
        Class<?> parameterType,
        String expectedPath,
        RequestMethod... expectedMethods
    ) {
        try {
            // 按方法名和前端入参类型定位真实公开入口。
            Method controllerMethod = UniauthUserController.class.getMethod(methodName, parameterType);
            // 读取真实入口的 Spring 请求映射。
            RequestMapping requestMapping = controllerMethod.getAnnotation(RequestMapping.class);
            // 每个公开接口都必须显式声明请求映射。
            assertNotNull(requestMapping);
            // 当前接口主路径必须与生产方法约定一致。
            assertEquals(expectedPath, requestMapping.value()[0]);
            // 当前接口允许的 HTTP 方法必须与既有客户端契约一致。
            assertArrayEquals(expectedMethods, requestMapping.method());
        } catch (NoSuchMethodException exception) {
            // 生产方法缺失时把反射异常转换成明确的路由契约失败。
            throw new AssertionError("未找到用户控制器方法: " + methodName, exception);
        }
    }

    /**
     * 按生产方法名读取并验证两个字符串参数的控制器路由契约。
     *
     * @param methodName 控制器生产方法名，例如 {@code getGridColumn}
     * @param firstParameterType 第一个参数类型，例如 {@code String.class}
     * @param secondParameterType 第二个参数类型，例如 {@code String.class}
     * @param expectedPath 预期路由，例如 {@code getGridColumn.htm}
     * @param expectedMethods 允许的 HTTP 方法，例如 {@code [GET]}
     * @throws AssertionError 生产方法不存在时抛出，例如误删 {@code getGridColumn} 后携带方法名失败
     */
    private static void assertRoute(
        String methodName,
        Class<?> firstParameterType,
        Class<?> secondParameterType,
        String expectedPath,
        RequestMethod... expectedMethods
    ) {
        try {
            // 按方法名和两个字符串参数定位真实 Grid 字段列入口。
            Method controllerMethod = UniauthUserController.class.getMethod(
                methodName,
                firstParameterType,
                secondParameterType
            );
            // 读取真实入口的 Spring 请求映射。
            RequestMapping requestMapping = controllerMethod.getAnnotation(RequestMapping.class);
            // Grid 字段列接口必须显式声明请求映射。
            assertNotNull(requestMapping);
            // 当前接口主路径必须与生产约定一致。
            assertEquals(expectedPath, requestMapping.value()[0]);
            // 当前接口只允许声明的 HTTP 方法。
            assertArrayEquals(expectedMethods, requestMapping.method());
            // 生产编译不依赖 -parameters，所以两个查询参数名必须在注解中明确声明。
            assertEquals("viewCode", controllerMethod.getParameters()[0]
                .getAnnotation(RequestParam.class).name());
            // locale 同样使用稳定 HTTP 参数名，禁止依赖 Java 反射参数名。
            assertEquals("locale", controllerMethod.getParameters()[1]
                .getAnnotation(RequestParam.class).name());
        } catch (NoSuchMethodException exception) {
            // 生产方法缺失时把反射异常转换成明确的路由契约失败。
            throw new AssertionError("未找到用户控制器方法: " + methodName, exception);
        }
    }
}
