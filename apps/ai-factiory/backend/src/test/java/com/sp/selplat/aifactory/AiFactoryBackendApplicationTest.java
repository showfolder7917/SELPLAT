package com.sp.selplat.aifactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** 验证 Java 控制面主链路和无横线静态页面。 */
@SpringBootTest
@AutoConfigureMockMvc
class AiFactoryBackendApplicationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void createsTaskAndExposesItToLocalPythonListener() throws Exception {
        String response = mockMvc.perform(post("/api/v1/ai-factory/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Client-Id", "CLIENT-TEST")
                        .content("{\"title\":\"生成代码\",\"project\":\"SELPLAT\",\"owner\":\"TEST\"}"))
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andReturn().getResponse().getContentAsString();
        JsonNode task = objectMapper.readTree(response).path("data");
        assertThat(task.path("taskId").asText()).startsWith("TASK-");

        mockMvc.perform(get("/api/v1/ai-factory/progress/ready").param("cursor", "0"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("stage.ready")));
    }

    @Test
    void servesReadOnlyVisualizationFromDirectoryWithoutHyphen() throws Exception {
        mockMvc.perform(get("/aifactory/aifactory.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("AI 工厂进度")));
    }
}
