package com.sp.selplat.mda;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 使用真实 H2 配置库和目标库验证页面依赖的完整 API 主流程。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class MdaApiIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @Order(1)
    void shouldListConnectionsWithoutCiphertext() throws Exception {
        mockMvc.perform(get("/api/mda/connections/getStore.htm")
                        .param("pageNo", "1").param("pageSize", "20").param("status", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records[0].connectionName").value("本地 H2 演示库"))
                .andExpect(jsonPath("$.records[0].passwordCiphertext").doesNotExist())
                .andExpect(jsonPath("$.records[0].passwordSaved").value(false));
    }

    @Test
    @Order(2)
    void shouldSaveEncryptedConnectionPassword() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "connectionName", "加密连接测试",
                "databaseType", "H2",
                "databaseName", "mem:mda_cipher_test;DB_CLOSE_DELAY=-1",
                "username", "sa",
                "password", "plain-secret"));
        MvcResult result = mockMvc.perform(post("/api/mda/connections/create.htm")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.password").doesNotExist())
                .andExpect(jsonPath("$.data.passwordCiphertext").doesNotExist())
                .andReturn();
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        long id = response.path("data").path("id").asLong();
        String ciphertext = jdbcTemplate.queryForObject(
                "SELECT passwordCiphertext FROM MdaConnectionProfile WHERE id = ?", String.class, id);
        assertThat(ciphertext).isNotBlank().doesNotContain("plain-secret");
    }

    @Test
    @Order(3)
    void shouldExecuteDdlAndDmlWithoutSafeQueryRestriction() throws Exception {
        execute("DROP TABLE IF EXISTS MdaRawSqlCase")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        execute("CREATE TABLE MdaRawSqlCase(id INT PRIMARY KEY, name VARCHAR(50))")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].kind").value("updateCount"));
        execute("INSERT INTO MdaRawSqlCase(id, name) VALUES (1, 'alpha')")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].updateCount").value(1));
    }

    @Test
    @Order(4)
    void shouldReturnQueryColumnsRowsAndMetadataTree() throws Exception {
        execute("SELECT id, name FROM MdaRawSqlCase ORDER BY id")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].kind").value("resultSet"))
                .andExpect(jsonPath("$.data.results[0].columns[0].label").value("id"))
                .andExpect(jsonPath("$.data.results[0].rows[0][0]").value(1))
                .andExpect(jsonPath("$.data.results[0].rows[0][1]").value("alpha"));

        MvcResult metadata = mockMvc.perform(post("/api/mda/metadata/tree.htm")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"connectionId\":10001}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn();
        assertThat(metadata.getResponse().getContentAsString()).containsIgnoringCase("MdaRawSqlCase");
    }

    @Test
    @Order(5)
    void shouldTestSavedConnection() throws Exception {
        mockMvc.perform(post("/api/mda/connections/test.htm")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"connectionId\":10001}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.databaseProductName").value("H2"));
    }

    private org.springframework.test.web.servlet.ResultActions execute(String sql) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "connectionId", 10001,
                "sql", sql,
                "autoCommit", true,
                "maxRows", 1000,
                "queryTimeoutSeconds", 30));
        return mockMvc.perform(post("/api/mda/sql/execute.htm")
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }
}
