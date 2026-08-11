package com.sp.selplat.mda;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sp.selplat.mda.common.util.jdbc.JdbcConnectionFactory;
import com.zaxxer.hikari.HikariDataSource;
import java.util.Map;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.jdbc.core.JdbcTemplate;

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
    @Autowired @Qualifier("mdaControlJdbcTemplate") private JdbcTemplate controlJdbc;
    @Autowired @Qualifier("mdaControlDataSource") private HikariDataSource controlDataSource;
    @Autowired private JdbcConnectionFactory connectionFactory;
    private static long targetConnectionId;

    @Test
    @Order(1)
    void shouldStartWithReferenceDataAndCreateDynamicConnection() throws Exception {
        assertThat(controlDataSource.getPoolName()).isEqualTo("MdaControlPool");
        mockMvc.perform(get("/api/mda/connections/getStore.htm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.records[0].connectionName").value("Reference Data 数据库"))
                .andExpect(jsonPath("$.records[0].databaseName")
                        .value("file:./apps/reference-data/db/reference-data"));

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
        String password = controlJdbc.queryForObject(
                "SELECT password FROM MdaConnectionProfile WHERE id = ?", String.class, id);
        assertThat(password).isEqualTo("plain-secret");

        mockMvc.perform(get("/api/mda/connections/getById.htm").param("id", String.valueOf(id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.password").value("plain-secret"));
    }

    /**
     * 验证目标库允许执行 DDL、注释、DML，并为后续元数据模板准备真实原注释。
     * 真实传参示例：创建 {@code MdaRawSqlCase(id,name)} 并写入表注释与 id 字段注释。
     * 真实返回示例：每条 SQL 返回成功，插入结果 {@code updateCount=1}。
     * 异常或副作用示例：测试仅修改隔离 H2 内存库，SQL 接口失败时测试断言终止。
     *
     * @throws Exception MockMvc 请求或结果解析失败时抛出
     */
    @Test
    @Order(3)
    void shouldExecuteDdlAndDmlWithoutSafeQueryRestriction() throws Exception {
        execute("DROP TABLE IF EXISTS MdaRawSqlCase")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        execute("CREATE TABLE MdaRawSqlCase(id INT PRIMARY KEY, name VARCHAR(50) DEFAULT 'unknown')")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].kind").value("updateCount"));
        // 隔离目标表写入原注释 → 元数据模板必须原样带回而不是生成占位描述。
        execute("COMMENT ON TABLE MdaRawSqlCase IS '原表注释'")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        execute("COMMENT ON COLUMN MdaRawSqlCase.id IS '原字段注释'")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        execute("INSERT INTO MdaRawSqlCase(id, name) VALUES (1, 'alpha')")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].updateCount").value(1));
    }

    /**
     * 验证查询结果、主键元数据、结构编辑模板、单行更新和元数据缓存失效的完整 API 契约。
     * 真实传参示例：查询 {@code MdaRawSqlCase} 并读取 connectionId 对应的 H2 元数据。
     * 真实返回示例：模板包含裸表名 ALTER、原表注释、原字段注释和空字段注释。
     * 异常或副作用示例：测试只创建隔离内存表，接口失败或模板缺项时断言终止。
     *
     * @throws Exception MockMvc 请求或 JSON 响应读取失败时抛出
     */
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
        assertThat(metadata.getResponse().getContentAsString())
                .contains("\"primaryKeys\":[\"id\"]")
                .contains("\"ordinalPosition\":1")
                .contains("\"defaultValue\":\"'unknown'\"")
                .contains("ALTER TABLE MdaRawSqlCase ADD NEW_COLUMN VARCHAR(255);")
                .contains("COMMENT ON TABLE MdaRawSqlCase IS '原表注释';")
                .contains("COMMENT ON COLUMN MdaRawSqlCase.id IS '原字段注释';")
                .contains("COMMENT ON COLUMN MdaRawSqlCase.name IS '';");

        mockMvc.perform(post("/api/mda/metadata/tree.htm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"connectionId\":" + targetConnectionId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.msg").value("数据库结构读取完成（缓存）。"));

        execute("CREATE TABLE MdaCacheInvalidationCase(id INT PRIMARY KEY)")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        MvcResult refreshedMetadata = mockMvc.perform(post("/api/mda/metadata/tree.htm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"connectionId\":" + targetConnectionId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.msg").value("数据库结构读取完成。"))
                .andReturn();
        assertThat(refreshedMetadata.getResponse().getContentAsString())
                .containsIgnoringCase("MdaCacheInvalidationCase");

        updateRow("MdaRawSqlCase", Map.of("id", 1), Map.of("name", "edited"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.affectedRows").value(1));
        execute("SELECT name FROM MdaRawSqlCase WHERE id = 1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].rows[0][0]").value("edited"));

        updateRow("MdaRawSqlCase", Map.of("id", 99), Map.of("name", "must-rollback"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("MDA_ROW_TARGET_CHANGED"));
        execute("CREATE TABLE MdaNoPrimaryKeyCase(name VARCHAR(50))")
                .andExpect(status().isOk());
        execute("INSERT INTO MdaNoPrimaryKeyCase(name) VALUES ('read-only')")
                .andExpect(status().isOk());
        updateRow("MdaNoPrimaryKeyCase", Map.of("name", "read-only"), Map.of("name", "blocked"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("MDA_ROW_PRIMARY_KEY_REQUIRED"));
        assertThat(connectionFactory.activePoolCount()).isEqualTo(1);
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

    @Test
    @Order(7)
    void shouldCloseOldTargetPoolAfterConnectionUpdate() throws Exception {
        assertThat(connectionFactory.activePoolCount()).isEqualTo(1);
        String body = objectMapper.writeValueAsString(Map.of(
                "id", targetConnectionId,
                "connectionName", "动态目标库",
                "databaseType", "H2",
                "databaseName", "mem:mda_dynamic_target;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
                "schemaName", "PUBLIC",
                "username", "sa",
                "password", "",
                "sortnum", 10));
        mockMvc.perform(post("/api/mda/connections/update.htm")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        assertThat(connectionFactory.activePoolCount()).isZero();
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

    /**
     * 按页面真实表单格式提交一条隔离目标库记录更新。
     * 真实传参示例：{@code tableName=MdaRawSqlCase,primaryKeyValues={id=1},values={name=edited}}。
     * 真实返回示例：返回可继续断言 HTTP 状态、错误码和影响行数的 MockMvc ResultActions。
     * 异常或副作用示例：请求会修改隔离 H2 内存表；序列化或请求失败时抛出异常。
     *
     * @param tableName 目标表真实名称，例如 {@code MdaRawSqlCase}
     * @param primaryKeyValues 原主键值，例如 {@code {id=1}}
     * @param values 新的非主键字段值，例如 {@code {name=edited}}
     * @return 尚未执行终态断言的 MockMvc 请求结果
     * @throws Exception JSON 序列化或 MockMvc 请求失败时抛出
     */
    private org.springframework.test.web.servlet.ResultActions updateRow(
            String tableName, Map<String, Object> primaryKeyValues, Map<String, Object> values) throws Exception {
        return mockMvc.perform(post("/api/mda/data/update-row.htm")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .param("connectionId", String.valueOf(targetConnectionId))
                .param("schema", "PUBLIC")
                .param("tableName", tableName)
                .param("primaryKeyValues", objectMapper.writeValueAsString(primaryKeyValues))
                .param("values", objectMapper.writeValueAsString(values)));
    }
}
