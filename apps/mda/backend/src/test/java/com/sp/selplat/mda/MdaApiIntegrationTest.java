package com.sp.selplat.mda;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sp.selplat.mda.common.persistence.MdaDatabase;
import java.util.Map;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 使用真实 H2 控制库和动态目标库验证页面依赖的完整 API 主流程。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class MdaApiIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private MdaDatabase database;
    private static long targetConnectionId;

    @Test
    @Order(1)
    void shouldStartWithoutDefaultWorkspaceAndCreateDynamicConnection() throws Exception {
        mockMvc.perform(get("/api/mda/connections/getStore.htm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(0));

        String body = objectMapper.writeValueAsString(Map.of(
                "connectionName", "动态目标库",
                "databaseType", "H2",
                "databaseName", "mem:mda_dynamic_target;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
                "schemaName", "PUBLIC",
                "username", "sa",
                "password", ""));
        MvcResult result = mockMvc.perform(post("/api/mda/connections/create.htm")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.connectionName").value("动态目标库"))
                .andReturn();
        targetConnectionId = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("id").asLong();
        assertThat(targetConnectionId).isPositive();
    }

    @Test
    @Order(2)
    void shouldSaveAndReturnPlaintextPassword() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "connectionName", "明文连接测试",
                "databaseType", "H2",
                "databaseName", "mem:mda_cipher_test;DB_CLOSE_DELAY=-1",
                "username", "sa",
                "password", "plain-secret"));
        MvcResult result = mockMvc.perform(post("/api/mda/connections/create.htm")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.password").value("plain-secret"))
                .andExpect(jsonPath("$.data.passwordCiphertext").doesNotExist())
                .andReturn();
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        long id = response.path("data").path("id").asLong();
        String password = database.controlJdbc().queryForObject(
                "SELECT password FROM MdaConnectionProfile WHERE id = ?", String.class, id);
        assertThat(password).isEqualTo("plain-secret");

        mockMvc.perform(get("/api/mda/connections/getById.htm").param("id", String.valueOf(id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.password").value("plain-secret"));
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
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"connectionId\":" + targetConnectionId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn();
        assertThat(metadata.getResponse().getContentAsString()).containsIgnoringCase("MdaRawSqlCase");
    }

    @Test
    @Order(5)
    void shouldTestSavedConnection() throws Exception {
        mockMvc.perform(post("/api/mda/connections/test.htm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"connectionId\":" + targetConnectionId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.databaseProductName").value("H2"));
    }

    @Test
    @Order(6)
    void shouldExposeConnectionGridColumnsFromMdaControlDatabase() throws Exception {
        mockMvc.perform(get("/api/mda/connections/getGridColumn.htm")
                        .param("viewCode", "mda-connections")
                        .param("locale", "zh-CN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.source").value("DEFAULT_METADATA"))
                .andExpect(jsonPath("$.data.columns.connectionName.columnName").value("connectionName"));
    }

    private org.springframework.test.web.servlet.ResultActions execute(String sql) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "connectionId", targetConnectionId,
                "sql", sql,
                "autoCommit", true,
                "maxRows", 1000,
                "queryTimeoutSeconds", 30));
        return mockMvc.perform(post("/api/mda/sql/execute.htm")
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }
}
