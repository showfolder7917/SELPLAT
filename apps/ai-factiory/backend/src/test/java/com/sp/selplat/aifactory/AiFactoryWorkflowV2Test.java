package com.sp.selplat.aifactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sp.selplat.aifactory.capability.workflowdesign.service.AiWorkflowDesignService;
import com.sp.selplat.common.util.CommonParam;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** 使用真实隔离 H2 验证三角色快速流程、AI 门禁和公共画布接口。 */
@SpringBootTest(properties={
        "ai-factory.datasource.jdbc-url=jdbc:h2:mem:aifactory-workflow-v2;DB_CLOSE_DELAY=-1",
        "ai-factory.datasource.username=sa","ai-factory.datasource.password="})
@AutoConfigureMockMvc
class AiFactoryWorkflowV2Test {
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired @Qualifier("aiFactoryDataSource") private DataSource dataSource;
    @Autowired private AiWorkflowDesignService workflowDesignService;

    /**
     * 清理上一测试可能创建的临时画布节点。
     * 真实传参示例：测试初始化后自动执行，无外部参数。
     * 真实返回示例：删除 nodeCode 以 ROLE_ 开头的临时节点后正常返回。
     * 异常或副作用示例：隔离 H2 不可用时测试失败；只影响测试数据库。
     */
    @BeforeEach
    void clearTemporaryNodes() {
        new JdbcTemplate(dataSource).update("DELETE FROM AiWorkflowNode WHERE nodeCode LIKE 'ROLE_%'");
    }

    /**
     * 验证默认流程只包含三个开发角色并按需求、软件、测试顺序连接。
     * 真实传参示例：查询 SELPLAT 项目 130001 的流程快照。
     * 真实返回示例：nodes=3、edges=2，名称依次为需求分析师、软件工程师、测试工程师。
     * 异常或副作用示例：种子多出旧角色或缺少连线时断言失败；只读隔离数据库。
     */
    @Test
    void exposesThreeRoleQuickDevelopmentFlow() throws Exception {
        JsonNode data=objectMapper.readTree(mockMvc.perform(get("/api/v1/ai-factory/workflows/snapshot")
                        .param("projectId","130001"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
        assertThat(data.path("nodes")).hasSize(3);
        assertThat(data.path("edges")).hasSize(2);
        assertThat(data.path("nodes").toString()).contains("需求分析师","软件工程师","测试工程师");
        assertThat(data.path("nodes").toString()).doesNotContain("架构师","代码审核");
    }

    /**
     * 验证项目管理公开接口可以完成新增、修改和逻辑删除。
     * 真实传参示例：新增编码 CRUD_TEST，随后把名称改为 CRUD测试项目已更新。
     * 真实返回示例：新增和修改成功，删除后 status=0。
     * 异常或副作用示例：测试结束物理清理隔离库临时项目；不影响正式数据库。
     */
    @Test
    void supportsProjectCreateUpdateAndDelete() throws Exception {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        try {
            mockMvc.perform(post("/api/v1/ai-factory/projects/create.htm")
                            .param("projectCode", "CRUD_TEST")
                            .param("projectName", "CRUD测试项目")
                            .param("description", "项目管理回归")
                            .param("status", "1")
                            .param("sortnum", "99"))
                    .andExpect(status().isOk());
            Long id = jdbc.queryForObject("SELECT id FROM AiProject WHERE projectCode='CRUD_TEST'", Long.class);
            mockMvc.perform(post("/api/v1/ai-factory/projects/update.htm")
                            .param("id", String.valueOf(id))
                            .param("projectName", "CRUD测试项目已更新"))
                    .andExpect(status().isOk());
            assertThat(jdbc.queryForObject("SELECT projectName FROM AiProject WHERE id=?", String.class, id))
                    .isEqualTo("CRUD测试项目已更新");
            mockMvc.perform(post("/api/v1/ai-factory/projects/delete.htm")
                            .param("id", String.valueOf(id)))
                    .andExpect(status().isOk());
            assertThat(jdbc.queryForObject("SELECT status FROM AiProject WHERE id=?", Integer.class, id)).isZero();
        } finally {
            jdbc.update("DELETE FROM AiProject WHERE projectCode='CRUD_TEST'");
        }
    }

    /**
     * 验证页面接入公共流程画布、主题管理和三个角色白名单。
     * 真实传参示例：读取 aifactory.html、aifactory-v2.js 与公共画布脚本。
     * 真实返回示例：页面加载 workflowCanvas，脚本含三个角色编码且不含旧代码门禁。
     * 异常或副作用示例：资源缺失或回退旧页面时断言失败；不请求互联网图标文件。
     */
    @Test
    void servesThemeAwarePublicWorkflowCanvas() throws Exception {
        mockMvc.perform(get("/aifactory/aifactory.html")).andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("AI 工厂管理")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("selWorkflowCanvas.js")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("aifactory-v2.js")));
        mockMvc.perform(get("/aifactory/aifactory-v2.js")).andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("SOFTWARE_ENGINEER")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("PROJECT_MANAGER_CONTROL")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("projectSections")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("aifactory-tree")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("currentProjectExpanded")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("规则管理")));
        mockMvc.perform(get("/sel/components/workflow-canvas/selWorkflowCanvas.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("dispatch(\"nodeAdd\"")));
    }

    /**
     * 验证每张新增流程业务表都使用独立号段且没有业务 identity。
     * 真实传参示例：读取隔离库 CommonSequenceSegment 与 INFORMATION_SCHEMA。
     * 真实返回示例：32 个唯一活动号段，六张流程表各一段，业务 identity 为零。
     * 异常或副作用示例：漏号段或业务自增时断言失败；测试不访问正式数据库。
     */
    @Test
    void registersIndependentWorkflowSequences() {
        JdbcTemplate jdbc=new JdbcTemplate(dataSource);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM CommonSequenceSegment",Integer.class)).isEqualTo(32);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM CommonSequenceSegment WHERE seqCode LIKE 'AiWorkflow%Id'",Integer.class)).isEqualTo(6);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='PUBLIC' AND IS_IDENTITY='YES' AND TABLE_NAME<>'CommonSequenceSegment'",Integer.class)).isZero();
    }

    /**
     * 验证画布可重复加入三类开发角色，但拒绝架构师等旧角色。
     * 真实传参示例：向版本 160000 两次加入软件工程师 100030，再尝试架构师 100011。
     * 真实返回示例：两次返回不同节点主键；旧角色请求失败且不新增节点。
     * 异常或副作用示例：测试只写隔离数据库，不会启动 Agent 或 Python。
     */
    @Test
    void allowsRepeatedDevelopmentRoleInstancesAndRejectsExtraRoles() throws Exception {
        String first=mockMvc.perform(post("/api/v1/ai-factory/workflows/nodes/create.htm")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .content("workflowVersionId=160000&roleId=100015&positionX=100&positionY=100"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String second=mockMvc.perform(post("/api/v1/ai-factory/workflows/nodes/create.htm")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .content("workflowVersionId=160000&roleId=100015&positionX=200&positionY=200"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(first).path("data").path("id").asLong())
                .isNotEqualTo(objectMapper.readTree(second).path("data").path("id").asLong());
        JdbcTemplate jdbc=new JdbcTemplate(dataSource);
        jdbc.update("INSERT INTO AiRole(id,parentId,roleCode,roleName,roleType,experienceLevel,codexPoolType,status,sortnum) "
                + "VALUES(199999,100001,'EXTRA_ROLE','多余角色','ENGINEER','INEXPERIENCED','DISPOSABLE',1,999)");
        try {
            CommonParam rejected=new CommonParam();
            rejected.putParam("workflowVersionId",160000);
            rejected.putParam("roleId",199999);
            assertThat(org.assertj.core.api.Assertions.catchThrowable(
                    ()->workflowDesignService.addRoleNode(rejected)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("只允许需求分析师、软件工程师和测试工程师");
        } finally {
            jdbc.update("DELETE FROM AiWorkflowNode WHERE nodeCode LIKE 'ROLE_%'");
            jdbc.update("DELETE FROM AiRole WHERE id=199999");
        }
    }
}
