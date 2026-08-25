package com.sp.selplat.uniauth.web;

import com.sp.selplat.testsupport.UniauthTestApplication;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Uniauth 公共 Web 生产异常集成测试验证默认配置不会向页面泄露 Java 异常细节。
 * 测试通过随机端口访问真实应用，确保下沉后的异常处理和请求追踪实际协作。
 */
@SpringBootTest(
    classes = UniauthTestApplication.class,
    properties = "selplat.error.include-stacktrace=false",
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT
)
class UniauthCommonWebProductionExceptionResponseTest {

    // 注入真实 HTTP 客户端，禁止用 MockMvc 或业务替身替代生产 Web 链路。
    @Autowired
    private TestRestTemplate restTemplate;
    // Spring 为本 Case 分配隔离端口，防止测试占用开发服务端口。
    @LocalServerPort
    private int serverPort;

    /**
     * 非法 pageNo 在默认配置下只返回基础错误事实，不返回 Java 堆栈。
     *
     */
    @Test
    void hidesStackTraceWhenProductionDetailIsDisabled() {
        // 使用同一真实 HTTP 异常路径，确保仅环境开关改变页面详情字段。
        ResponseEntity<Map> response = restTemplate.getForEntity(
            "http://localhost:" + serverPort + "/api/uniauth/users/getStore.htm?pageNo=not-a-number",
            Map.class
        );
        // 系统异常继续使用 HTTP 500，隐藏详情不能改变失败语义。
        assertEquals(500, response.getStatusCode().value());
        // 响应体仍返回稳定错误码和 requestId，供页面展示与运维关联。
        Map<String, Object> responseBody = response.getBody();
        assertNotNull(responseBody);
        assertEquals(false, responseBody.get("success"));
        assertEquals("SYSTEM", responseBody.get("errorType"));
        assertEquals("INTERNAL_ERROR", responseBody.get("errorCode"));
        assertNotNull(responseBody.get("requestId"));
        // 默认生产配置绝不向页面返回 Java 异常类型、消息或完整堆栈。
        assertFalse(responseBody.containsKey("stackTrace"));
    }
}
