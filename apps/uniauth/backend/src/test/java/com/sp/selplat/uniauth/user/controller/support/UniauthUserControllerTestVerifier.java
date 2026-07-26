package com.sp.selplat.uniauth.user.controller.support;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.uniauth.user.controller.UniauthUserController;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

// 用户控制器验证器集中处理路由契约和直接 JSON 序列化断言，让测试方法只保留 Case 名和单一验证入口。
public final class UniauthUserControllerTestVerifier {

    // 验证器没有运行期状态，只允许通过静态入口执行控制器契约检查。
    private UniauthUserControllerTestVerifier() {
    }

    // 验证全部公开生产方法的路径和 HTTP 方法，避免接口重命名破坏前端契约。
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
    }

    // 验证控制器只序列化服务结果，不再为空消息补默认值或增加控制层元数据。
    public static void verifyDirectServiceResultSerialization() {
        // 创建不带业务消息和控制层元数据的共通结果，验证序列化不会改变原始结构。
        CommonResult serviceResult = new CommonResult();
        // 服务层明确返回成功标记，作为最终 JSON 中应保留的结构字段。
        serviceResult.setSuccess(true);
        // 服务层提供唯一业务数据，便于确认 Controller 没有替换返回对象。
        serviceResult.setData(Map.of("id", 1L));
        // 创建服务替身只隔离当前纯控制层序列化逻辑，不作为数据库功能完成证据。
        UniauthUserService userService = mock(UniauthUserService.class);
        // getById 固定返回当前完整服务结构。
        when(userService.getById(any(CommonParam.class))).thenReturn(serviceResult);
        // 创建真实控制器实例执行公开 getById 入口。
        UniauthUserController controller = new UniauthUserController();
        // 把服务替身注入控制器公共服务字段，保持生产调用方式不变。
        ReflectionTestUtils.setField(controller, "service", userService);
        // 执行控制器直接序列化并读取最终 JSON。
        String responseJson = controller.getById(new CommonParam());
        // 服务层成功标记必须原样进入 JSON。
        assertTrue(responseJson.contains("\"success\":true"));
        // 空消息通过忽略空值的序列化入口保持缺省，证明控制器没有再次包装。
        assertFalse(responseJson.contains("\"msg\""));
        // 模块编码不得由控制器补入已完成的服务结果。
        assertFalse(responseJson.contains("\"moduleCode\""));
        // 请求路径不得由控制器补入已完成的服务结果。
        assertFalse(responseJson.contains("\"requestPath\""));
    }

    // 验证 getStore、insert、update 和 delete 公开入口都只调用服务并序列化其返回结构。
    public static void verifyPublicMethodResponses() {
        // 创建控制层单元替身，只验证公开方法委托和结构序列化，不代替真实数据库业务测试。
        UniauthUserService userService = mock(UniauthUserService.class);
        // 分页服务结果提供一条可识别记录和完整分页字段。
        CommonPageResult pageResult = new CommonPageResult();
        // 当前控制器 Case 使用固定业务记录验证 records 原结构序列化。
        pageResult.setRecords(List.of(Map.of("id", 1L, "loginName", "controller-store")));
        // 当前控制器 Case 的总数与唯一记录保持一致。
        pageResult.setTotalCount(1L);
        // 当前控制器 Case 固定第一页。
        pageResult.setPageNo(1);
        // 当前控制器 Case 固定每页十条。
        pageResult.setPageSize(10);
        // getStore 服务委托固定返回当前分页结果。
        when(userService.getStore(any(CommonPageParam.class))).thenReturn(pageResult);
        // insert 服务委托返回可识别新增结果。
        when(userService.insert(any(CommonParam.class))).thenReturn(successResult("insert"));
        // update 服务委托返回可识别更新结果。
        when(userService.update(any(CommonParam.class))).thenReturn(successResult("update"));
        // delete 服务委托返回可识别删除结果。
        when(userService.delete(any(CommonParam.class))).thenReturn(successResult("delete"));
        // 四个批量服务入口分别返回可识别动作结果。
        when(userService.getByIds(any(CommonBatchParam.class))).thenReturn(successResult("getByIds"));
        // 批量新增返回顶层影响行数和直接 items 数据，用于验证固定 CommonResult JSON 结构。
        when(userService.insertBatch(any(CommonBatchParam.class))).thenReturn(batchSuccessResult("insertBatch", 2));
        // 批量更新返回固定动作标记。
        when(userService.updateBatch(any(CommonBatchParam.class))).thenReturn(successResult("updateBatch"));
        // 批量删除返回固定动作标记。
        when(userService.deleteBatch(any(CommonBatchParam.class))).thenReturn(successResult("deleteBatch"));
        // 创建真实控制器并注入当前纯控制层替身。
        UniauthUserController controller = new UniauthUserController();
        // 服务字段注入后四个公开方法均可执行真实控制器序列化逻辑。
        ReflectionTestUtils.setField(controller, "service", userService);
        // getStore 最终 JSON 必须包含分页服务返回的账号。
        assertTrue(controller.getStore(new CommonPageParam()).contains("controller-store"));
        // 分页结果保持 Service 的 records 字段，不再转换成控制层 rows 包装。
        assertTrue(controller.getStore(new CommonPageParam()).contains("\"records\""));
        // insert 最终 JSON 必须包含新增服务返回标记。
        assertTrue(controller.insert(new CommonParam()).contains("insert"));
        // update 最终 JSON 必须包含更新服务返回标记。
        assertTrue(controller.update(new CommonParam()).contains("update"));
        // delete 最终 JSON 必须包含删除服务返回标记。
        assertTrue(controller.delete(new CommonParam()).contains("delete"));
        // 批量查询最终 JSON 必须直接保留服务动作标记。
        assertTrue(controller.getByIds(new CommonBatchParam()).contains("getByIds"));
        // 批量新增最终 JSON 必须直接保留服务动作标记。
        String insertBatchJson = controller.insertBatch(new CommonBatchParam());
        // data 中的批量项必须直接进入 JSON。
        assertTrue(insertBatchJson.contains("insertBatch"));
        // DAO 影响行数必须位于 CommonResult 顶层。
        assertTrue(insertBatchJson.contains("\"affectedRows\":2"));
        // data 不得重新嵌套 affectedRows，防止恢复历史专用 Map 包装。
        assertFalse(insertBatchJson.contains("\"data\":{\"affectedRows\""));
        // 批量更新最终 JSON 必须直接保留服务动作标记。
        assertTrue(controller.updateBatch(new CommonBatchParam()).contains("updateBatch"));
        // 批量删除最终 JSON 必须直接保留服务动作标记。
        assertTrue(controller.deleteBatch(new CommonBatchParam()).contains("deleteBatch"));
    }

    // 创建带可识别业务动作的成功结果，供控制器公开方法响应包装验证复用。
    private static CommonResult successResult(String action) {
        // 新建服务层共通结果。
        CommonResult result = new CommonResult();
        // 当前纯控制层 Case 明确标记服务执行成功。
        result.setSuccess(true);
        // 动作字段让每个控制器方法的最终 JSON 都可被独立识别。
        result.setData(Map.of("action", action));
        // 返回可直接供服务替身使用的稳定结果。
        return result;
    }

    // 创建固定 CommonResult 批量写入结构，验证 data 与 affectedRows 各自保持顶层职责。
    private static CommonResult batchSuccessResult(String action, int affectedRows) {
        // 新建服务层批量共通结果。
        CommonResult result = new CommonResult();
        // 批量调用成功时保持统一成功标记。
        result.setSuccess(true);
        // data 直接承接批量 items，不再构造包含统计字段的 Map。
        result.setData(List.of(Map.of("action", action)));
        // 数据库累计影响行数使用已确认的 CommonResult 顶层字段。
        result.setAffectedRows(affectedRows);
        // 返回可由 Controller 原样序列化的固定结构。
        return result;
    }

    // 按生产方法名读取并验证一个控制器路由契约。
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
}
