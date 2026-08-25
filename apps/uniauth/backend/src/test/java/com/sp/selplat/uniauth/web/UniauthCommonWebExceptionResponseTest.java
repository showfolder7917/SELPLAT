package com.sp.selplat.uniauth.web;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.exception.CommonGlobalExceptionHandler;
import com.sp.selplat.common.web.trace.CommonRequestTraceInterceptor;
import com.sp.selplat.testsupport.UniauthTestApplication;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Uniauth 公共 Web 异常集成测试验证下沉后的异常处理和请求追踪在真实应用中自动生效。
 * 测试启动随机端口服务器，通过真实 HTTP 调用生产 MVC 链路，不创建业务替身。
 */
@SpringBootTest(
    classes = UniauthTestApplication.class,
    properties = "selplat.error.include-stacktrace=true",
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT
)
class UniauthCommonWebExceptionResponseTest {

    // 注入真实 HTTP 客户端，请求会经过嵌入式 Web 服务器而非 MockMvc 模拟链路。
    @Autowired
    private TestRestTemplate restTemplate;
    // 注入真实全局异常处理器，业务异常格式测试直接验证生产处理逻辑而不创建替身。
    @Autowired
    private CommonGlobalExceptionHandler exceptionHandler;
    // Spring 为本 Case 分配的随机端口，避免测试依赖本机固定端口或其他应用进程。
    @LocalServerPort
    private int serverPort;

    /**
     * 非法 pageNo 触发真实参数解析异常时，开发配置向页面返回完整堆栈。
     *
     */
    @Test
    void returnsStackTraceAndRequestIdWhenDevelopmentDetailIsEnabled() {
        // 通过真实 HTTP 请求传入非法分页值，使生产参数解析器抛出 NumberFormatException。
        ResponseEntity<Map> response = restTemplate.getForEntity(
            "http://localhost:" + serverPort + "/api/uniauth/users/getStore.htm?pageNo=not-a-number",
            Map.class
        );
        // 未处理系统异常必须以真实 HTTP 500 返回，不能被误写成正常响应。
        assertEquals(500, response.getStatusCode().value());
        // 请求拦截器必须回传关联 ID，前端可将它提供给运维查询本地日志。
        assertTrue(response.getHeaders().containsKey(CommonRequestTraceInterceptor.REQUEST_ID_HEADER));
        // 响应体来自全局异常处理器，开发环境包含固定错误码与 requestId。
        Map<String, Object> responseBody = response.getBody();
        assertNotNull(responseBody);
        assertEquals(false, responseBody.get("success"));
        assertEquals("SYSTEM", responseBody.get("errorType"));
        assertEquals("INTERNAL_ERROR", responseBody.get("errorCode"));
        assertNotNull(responseBody.get("requestId"));
        // 已明确开启开发详情时，页面控制台获得完整文本堆栈。
        assertNotNull(responseBody.get("stackTrace"));
    }

    /**
     * 业务异常使用与系统异常相同的 CommonResult 顶层结构，前端可统一按 success=false 弹框。
     */
    @Test
    void returnsCommonResultForBusinessException() {
        // 真实业务异常携带稳定编码和可展示提示，异常处理器负责转为统一 JSON。
        String responseJson = exceptionHandler.handleBusinessException(
            new CommonBusinessException("USER_NOT_FOUND", "用户不存在。")
        ).getBody();
        // 使用项目同一个 JsonUtils 解析实际响应，验证前端将收到的固定字段。
        Map<String, Object> responseBody = JsonUtils.fromJson(responseJson, Map.class);
        assertNotNull(responseBody);
        // 业务失败与系统失败都使用 success=false，前端无需分两套错误弹框入口。
        assertEquals(false, responseBody.get("success"));
        assertEquals("BUSINESS", responseBody.get("errorType"));
        assertEquals("USER_NOT_FOUND", responseBody.get("errorCode"));
        assertEquals("用户不存在。", responseBody.get("msg"));
        // 当前测试开启 dev 诊断详情，因此业务异常也返回真实 Java 堆栈。
        assertNotNull(responseBody.get("stackTrace"));
    }

    /**
     * 已包装系统异常使用稳定错误编码和安全提示，同时保留开发环境诊断堆栈。
     */
    @Test
    void returnsSafeCommonResultForSystemException() {
        // 原始数据库消息只作为 cause 保存，安全提示才允许进入响应。
        CommonSystemException exception = new CommonSystemException(
            "DATABASE_QUERY_FAILED",
            "数据读取失败，请稍后重试。",
            new IllegalStateException("connection password leaked")
        );
        // 调用真实公共处理器 → HTTP 500 SYSTEM CommonResult。
        ResponseEntity<String> response = exceptionHandler.handleSystemException(exception);
        // 已包装系统异常仍使用 HTTP 500，稳定编码不改变系统故障语义。
        assertEquals(500, response.getStatusCode().value());
        // 使用生产 JsonUtils 解析真实响应结构。
        Map<String, Object> responseBody = JsonUtils.fromJson(response.getBody(), Map.class);
        assertNotNull(responseBody);
        assertEquals(false, responseBody.get("success"));
        assertEquals("SYSTEM", responseBody.get("errorType"));
        assertEquals("DATABASE_QUERY_FAILED", responseBody.get("errorCode"));
        assertEquals("数据读取失败，请稍后重试。", responseBody.get("msg"));
        // 开发配置允许返回包装异常堆栈，但公开安全文案不得被底层消息替换。
        assertNotNull(responseBody.get("stackTrace"));
    }

    /**
     * 成功 CommonResult 的错误字段保持 null，并被 JsonUtils 自动省略。
     */
    @Test
    void omitsEmptyErrorFieldsForSuccessfulCommonResult() {
        // 构造最小成功结果，不写入任何错误字段，模拟正常 Service 返回。
        CommonResult successResult = new CommonResult();
        successResult.setSuccess(true);
        successResult.setMsg("查询完成。");
        // 控制器实际使用的忽略空值序列化必须不输出四个异常字段。
        Map<String, Object> responseBody = JsonUtils.fromJson(JsonUtils.toJsonIgnoreNull(successResult), Map.class);
        assertNotNull(responseBody);
        assertEquals(true, responseBody.get("success"));
        assertFalse(responseBody.containsKey("errorType"));
        assertFalse(responseBody.containsKey("errorCode"));
        assertFalse(responseBody.containsKey("requestId"));
        assertFalse(responseBody.containsKey("stackTrace"));
    }
}
