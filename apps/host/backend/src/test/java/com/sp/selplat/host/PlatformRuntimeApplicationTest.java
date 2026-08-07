package com.sp.selplat.host;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 验证 platform-runtime 可以启动并真实装配 reference-data 查询 Service。
 */
@SpringBootTest(properties = {
    "reference-data.datasource.url=jdbc:h2:mem:reference_data_host_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false"
})
@AutoConfigureMockMvc
class PlatformRuntimeApplicationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldExposeHostAndReferenceDataModuleHealth() throws Exception {
        mockMvc.perform(get("/api/platform/runtime/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("READY"))
                .andExpect(jsonPath("$.data.modules[0]").value("host"))
                .andExpect(jsonPath("$.data.modules[1]").value("reference-data"))
                .andExpect(jsonPath("$.data.modules[2]").value("uniauth"))
                .andExpect(jsonPath("$.data.referenceDataServiceReady").value(true));
    }

    /**
     * 验证统一端口同时发布公共组件和 Uniauth 页面。
     *
     * 执行结果示例：{@code /sel/core/selBaseRuntime.js} 与
     * {@code /uniauth/uniauth.html} 均返回 HTTP 200。
     */
    @Test
    void shouldExposeSharedUiAndUniauthPageFromOneRuntime() throws Exception {
        // 公共运行时必须来自 sel-ui 依赖 JAR，而不是 Host 或 Uniauth 的复制目录。
        mockMvc.perform(get("/sel/core/selBaseRuntime.js"))
                .andExpect(status().isOk());
        // Uniauth 页面由同一个 Host Web 容器发布，浏览器无需跨端口访问。
        mockMvc.perform(get("/uniauth/uniauth.html"))
                .andExpect(status().isOk());
        // reference-data 管理后台同样由统一 Host 发布，不增加第二个前端端口。
        mockMvc.perform(get("/reference-data/reference-data.html"))
                .andExpect(status().isOk());
    }

    /**
     * 验证 Host 在同一端口发布 reference-data 的真实树和类型选项接口。
     *
     * 执行结果示例：英文树返回 {@code Reference data resource types}，
     * 日文选项返回 {@code ツリーリソース}。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出；成功路径均返回 HTTP 200
     */
    @Test
    void shouldExposeReferenceDataTreeAndOptions() throws Exception {
        // Host 显式装配的内置 Provider → 英文树 API 固定结构。
        mockMvc.perform(get("/api/reference-data/reference-data/resource-kind/tree")
                        .queryParam("locale", "en-US"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].label").value("Reference data resource types"));
        // 同一 Provider 的类型表达 → 日文选项 API 保持稳定值和本地化标签。
        mockMvc.perform(get("/api/reference-data/reference-data/resource-kind/options")
                        .queryParam("locale", "ja-JP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].value").value("TREE"))
                .andExpect(jsonPath("$.data[0].label").value("ツリーリソース"));
    }
}
