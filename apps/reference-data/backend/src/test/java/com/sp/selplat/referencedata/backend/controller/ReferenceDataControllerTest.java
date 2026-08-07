package com.sp.selplat.referencedata.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sp.selplat.common.web.exception.CommonGlobalExceptionHandler;
import com.sp.selplat.referencedata.backend.provider.ReferenceDataProviderRegistry;
import com.sp.selplat.referencedata.backend.provider.builtin.BuiltInResourceKindProvider;
import com.sp.selplat.referencedata.backend.service.DefaultReferenceDataApiService;
import com.sp.selplat.referencedata.backend.service.DefaultReferenceDataQueryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * 验证 reference-data HTTP 接口的三语成功响应和统一业务错误响应。
 * 测试直接装配真实注册表、内置 Provider、两层 Service 与 Controller，不使用业务 Mock。
 */
class ReferenceDataControllerTest {

    // MockMvc 运行真实 Controller 参数绑定、JSON 序列化和公共异常处理器。
    private MockMvc mockMvc;

    /**
     * 为每个用例建立独立且完整的 reference-data API 调用链。
     *
     * 执行结果示例：注册表包含 {@code reference-data/resource-kind}，Controller 可查询树和选项。
     */
    @BeforeEach
    void setUp() {
        // 真实内置 Provider → 注册表 → 内部查询 Service → API 结果 Service。
        ReferenceDataProviderRegistry registry = new ReferenceDataProviderRegistry(
                java.util.List.of(new BuiltInResourceKindProvider()));
        DefaultReferenceDataQueryService queryService = new DefaultReferenceDataQueryService(registry);
        DefaultReferenceDataApiService apiService = new DefaultReferenceDataApiService(queryService);
        // 真实 Controller 与公共异常处理器 → 不启动外部端口的 MVC 测试环境。
        mockMvc = MockMvcBuilders
                .standaloneSetup(new ReferenceDataController(apiService))
                .setControllerAdvice(new CommonGlobalExceptionHandler())
                .build();
    }

    /**
     * 验证英文树接口保留固定 CommonResult 层级和树节点结构。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出；成功示例为 HTTP 200 且
     *     {@code data[0].label=Reference data resource types}。
     */
    @Test
    void shouldReturnLocalizedTree() throws Exception {
        // 英文 locale 查询 → 内置 Provider 的英文树结果。
        mockMvc.perform(get("/api/reference-data/reference-data/resource-kind/tree")
                        .queryParam("tenantId", " platform ")
                        .queryParam("locale", "en-US"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.moduleCode").value("reference-data"))
                .andExpect(jsonPath("$.requestPath")
                        .value("/api/reference-data/reference-data/resource-kind/tree"))
                .andExpect(jsonPath("$.data[0].label").value("Reference data resource types"))
                .andExpect(jsonPath("$.data[0].children[0].value").value("TREE"))
                .andExpect(jsonPath("$.msg").value("引用数据树查询完成。"));
    }

    /**
     * 验证日文类型选项接口返回稳定值和本地化显示文本。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出；成功示例为 HTTP 200 且
     *     {@code data[0]={value:"TREE",label:"ツリーリソース"}}。
     */
    @Test
    void shouldReturnLocalizedOptions() throws Exception {
        // 日文 locale 查询 → 内置 Provider 的日文选项结果。
        mockMvc.perform(get("/api/reference-data/reference-data/resource-kind/options")
                        .queryParam("locale", "ja-JP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].value").value("TREE"))
                .andExpect(jsonPath("$.data[0].label").value("ツリーリソース"))
                .andExpect(jsonPath("$.data[1].value").value("OPTIONS"))
                .andExpect(jsonPath("$.msg").value("引用数据选项查询完成。"));
    }

    /**
     * 验证未知逻辑资源由公共异常处理器转换为 HTTP 400 BUSINESS 响应。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出；错误示例包含
     *     {@code errorCode=REFERENCE_DATA_RESOURCE_NOT_FOUND}。
     */
    @Test
    void shouldReturnBusinessErrorForMissingResource() throws Exception {
        // 未登记坐标 → 注册表业务异常 → 公共 Web 层固定错误 JSON。
        mockMvc.perform(get("/api/reference-data/cms/missing/tree"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorType").value("BUSINESS"))
                .andExpect(jsonPath("$.errorCode").value("REFERENCE_DATA_RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.msg").value("未登记引用数据资源：cms/missing"));
    }
}
