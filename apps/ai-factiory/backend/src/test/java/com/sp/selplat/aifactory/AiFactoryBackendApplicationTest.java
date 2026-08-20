package com.sp.selplat.aifactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** 验证 Java 控制面主链路和无横线静态页面。 */
@SpringBootTest(properties = {
        "ai-factory.datasource.jdbc-url=jdbc:h2:mem:aifactory-test;DB_CLOSE_DELAY=-1",
        "ai-factory.datasource.username=sa",
        "ai-factory.datasource.password="
})
@AutoConfigureMockMvc
class AiFactoryBackendApplicationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    @Qualifier("aiFactoryDataSource")
    private DataSource dataSource;

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

    /**
     * 方法作用：验证 AI 工厂管理页和 Remix Icon 字体全部通过统一 Host 同源交付。
     * 真实传参示例：访问 {@code /aifactory/aifactory.html}、公共图标 CSS 和 woff2 字体。
     * 真实返回示例：三个资源均为 200，页面只引用 {@code /sel/vendor/remixicon/remixicon.css}。
     * 异常或副作用示例：资源未进入 SEL JAR 时断言失败；测试只读静态资源。
     */
    @Test
    void servesManagementVisualizationAndSameOriginIcons() throws Exception {
        mockMvc.perform(get("/aifactory/aifactory.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("AI 工厂进度")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "/sel/vendor/remixicon/remixicon.css")))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("cdn.jsdelivr.net"))));
        mockMvc.perform(get("/sel/vendor/remixicon/remixicon.css"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("font-family: \"remixicon\"")));
        mockMvc.perform(get("/sel/vendor/remixicon/remixicon.woff2"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/sel/components/window/selWindow.css"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        ".selwindow-action-button:disabled")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "color: var(--sel-theme-text-disabled)")));
        mockMvc.perform(get("/sel/theme/packs/plain-minimal/theme.css"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        ".selwindow-action-primary:not(:disabled)")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "color: var(--sel-theme-text-body)")));
    }

    /**
     * 方法作用：验证 AI 前缀管理表能以树和表格需要的字段对外提供角色、门禁及执行审计数据。
     * 真实传参示例：{@code GET /api/v1/ai-factory/management/dashboard}。
     * 真实返回示例：{@code {success:true,data:{roles:[{codexPoolType:"PERSISTENT"}],stages:[{localLogPath:"..."}]}}}。
     * 异常或副作用示例：管理表未初始化时请求失败，测试不会写入生产数据库。
     */
    @Test
    void exposesAiPrefixedManagementTreesAndExecutionAuditFields() throws Exception {
        mockMvc.perform(get("/api/v1/ai-factory/management/dashboard"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("需求分析师")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("PERSISTENT")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("localLogPath")));
    }

    /**
     * 方法作用：验证角色编辑、完整上下拖拽排序接口和前端公共控件接线。
     * 真实传参示例：编辑角色 100010，并把管理快照中的十七个普通角色 ID 反向提交后再恢复。
     * 真实返回示例：编辑接口成功且自动使用 DISPOSABLE；排序接口 affectedRows=17，脚本监听 rowReorder。
     * 异常或副作用示例：测试结束前恢复角色名称和原排序；只写隔离内存数据库。
     */
    @Test
    void editsAndReordersRolesThroughPublicGridContract() throws Exception {
        JsonNode originalDashboard = dashboard();
        List<Long> originalIds = new ArrayList<>();
        originalDashboard.path("data").path("roles").forEach(role -> {
            if (!role.path("roleCode").asText().endsWith("_ROOT")) {
                originalIds.add(role.path("id").asLong());
            }
        });

        mockMvc.perform(post("/api/v1/ai-factory/roles/update.htm")
                        .param("id", "100010")
                        .param("roleName", "需求分析师编辑测试")
                        .param("roleType", "ENGINEER")
                        .param("experienceLevel", "INEXPERIENCED")
                        .param("specialty", "需求"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("DISPOSABLE")));
        assertThat(dashboard().toString()).contains("需求分析师编辑测试");

        List<Long> reversedIds = new ArrayList<>(originalIds);
        Collections.reverse(reversedIds);
        mockMvc.perform(post("/api/v1/ai-factory/roles/reorder.htm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reorderJson(reversedIds)))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"affectedRows\":17")));

        // 恢复固定测试数据，避免本方法影响同一 Spring 上下文中的其他断言。
        mockMvc.perform(post("/api/v1/ai-factory/roles/reorder.htm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reorderJson(originalIds)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/ai-factory/roles/update.htm")
                        .param("id", "100010")
                        .param("roleName", "需求分析师")
                        .param("roleType", "ENGINEER")
                        .param("experienceLevel", "INEXPERIENCED")
                        .param("specialty", "需求"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/aifactory/aifactory.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("selGrid:rowReorder")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("renderer: \"dragHandle\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("renderer: \"actions\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("columns.push")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("aiFactoryIsRoleStructure")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("aiFactoryBuildRoleTypeTree")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("roleTypeFilter")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "aiFactoryMountHeaderVisibilityToggle")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "aifactory-header-hidden")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("ri-delete-bin-line")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("confirmDialog.mount")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("windowComponent.mount")));
    }

    /**
     * 方法作用：验证固定角色树始终为“角色类型 → 工程师 / 审核员”，且结构节点不能被普通编辑接口改写。
     * 真实传参示例：读取 dashboard 后尝试把 {@code ENGINEER_ROOT} 改名为“测试审核员”。
     * 真实返回示例：树节点名称保持角色类型、工程师、审核员，编辑请求返回结构节点禁止错误。
     * 异常或副作用示例：校验失败不写数据库；测试使用隔离内存库。
     */
    @Test
    void keepsRoleTypeEngineerReviewerTreeStructureImmutable() throws Exception {
        JsonNode roles = dashboard().path("data").path("roles");
        assertThat(findRoleName(roles, "ROLE_ROOT")).isEqualTo("角色类型");
        assertThat(findRoleName(roles, "ENGINEER_ROOT")).isEqualTo("工程师");
        assertThat(findRoleName(roles, "REVIEWER_ROOT")).isEqualTo("审核员");

        mockMvc.perform(post("/api/v1/ai-factory/roles/update.htm")
                        .param("id", "100001")
                        .param("roleName", "测试审核员")
                        .param("roleType", "REVIEWER")
                        .param("experienceLevel", "INEXPERIENCED")
                        .param("specialty", ""))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "AI_ROLE_EDIT_STRUCTURE_FORBIDDEN")));
        assertThat(findRoleName(dashboard().path("data").path("roles"), "ENGINEER_ROOT"))
                .isEqualTo("工程师");
    }

    /**
     * 方法作用：验证角色删除按钮对应的逻辑删除、根节点保护和管理列表过滤。
     * 真实传参示例：删除隔离角色 {@code 199999}，再尝试删除角色根 {@code 100000}。
     * 真实返回示例：普通叶子角色 status 变为 0 且不再出现在 dashboard；根节点返回禁止删除错误。
     * 异常或副作用示例：测试只写内存数据库并在 finally 物理清理测试行，不访问正式 H2 文件。
     */
    @Test
    void deletesUnusedLeafRoleAndProtectsRoleRoots() throws Exception {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.update("INSERT INTO AiRole(id,parentId,roleCode,roleName,roleType,experienceLevel,"
                + "codexPoolType,specialty,status,sortnum) VALUES(199999,100001,'DELETE_TEST_ROLE',"
                + "'待删除测试角色','ENGINEER','INEXPERIENCED','DISPOSABLE','测试',1,999)");
        try {
            mockMvc.perform(post("/api/v1/ai-factory/roles/delete.htm").param("id", "199999"))
                    .andExpect(status().isOk())
                    .andExpect(content().string(org.hamcrest.Matchers.containsString("\"status\":0")));
            assertThat(jdbc.queryForObject(
                    "SELECT status FROM AiRole WHERE id=199999", Integer.class)).isZero();
            assertThat(dashboard().toString()).doesNotContain("DELETE_TEST_ROLE");

            mockMvc.perform(post("/api/v1/ai-factory/roles/delete.htm").param("id", "100000"))
                    .andExpect(content().string(org.hamcrest.Matchers.containsString(
                            "AI_ROLE_DELETE_ROOT_FORBIDDEN")));
            assertThat(jdbc.queryForObject(
                    "SELECT status FROM AiRole WHERE id=100000", Integer.class)).isEqualTo(1);
        } finally {
            jdbc.update("DELETE FROM AiRole WHERE id=199999");
        }
    }

    /**
     * 方法作用：读取 AI 工厂管理聚合 JSON 供角色写操作测试复用。
     * 真实传参示例：无参数，调用 {@code GET /api/v1/ai-factory/management/dashboard}。
     * 真实返回示例：返回包含 {@code data.roles} 的 JsonNode。
     * 异常或副作用示例：HTTP 或 JSON 解析失败时测试立即失败；本方法只读数据库。
     *
     * @return 管理聚合 JSON
     */
    private JsonNode dashboard() throws Exception {
        String response = mockMvc.perform(get("/api/v1/ai-factory/management/dashboard"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response);
    }

    /**
     * 方法作用：把有序角色主键转换为排序接口要求的 items JSON。
     * 真实传参示例：{@code [100010,100011]}。
     * 真实返回示例：返回 {@code {"items":[{"id":100010},{"id":100011}]}}。
     * 异常或副作用示例：空列表返回空 items 并由业务接口拒绝；不修改输入列表。
     *
     * @param ids 目标角色顺序
     * @return 排序请求 JSON
     */
    private String reorderJson(List<Long> ids) {
        ObjectNode root = objectMapper.createObjectNode();
        ArrayNode items = root.putArray("items");
        ids.forEach(id -> items.addObject().put("id", id));
        return root.toString();
    }

    /**
     * 方法作用：从角色数组按稳定编码读取显示名称。
     * 真实传参示例：传入 dashboard roles 与 {@code ENGINEER_ROOT}。
     * 真实返回示例：返回 {@code 工程师}。
     * 异常或副作用示例：未命中时返回空字符串；不修改 JSON。
     *
     * @param roles dashboard 角色数组
     * @param roleCode 角色稳定编码
     * @return 对应角色名称或空字符串
     */
    private String findRoleName(JsonNode roles, String roleCode) {
        for (JsonNode role : roles) {
            if (roleCode.equals(role.path("roleCode").asText())) {
                return role.path("roleName").asText();
            }
        }
        return "";
    }
}
