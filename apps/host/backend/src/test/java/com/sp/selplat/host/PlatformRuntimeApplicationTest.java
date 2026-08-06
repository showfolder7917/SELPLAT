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
@SpringBootTest
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
                .andExpect(jsonPath("$.data.referenceDataServiceReady").value(true));
    }
}
