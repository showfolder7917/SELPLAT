package com.sp.selplat.host;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 验证 platform-runtime 可以启动并真实装配 reference-data 查询 Service。
 */
@SpringBootTest(properties = {
    "reference-data.datasource.url=jdbc:h2:mem:reference_data_host_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
    "uniauth.datasource.jdbc-url=jdbc:h2:mem:selplat_uniauth_host_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
    "uniauth.datasource.password=",
    "mda.control.datasource.jdbc-url=jdbc:h2:mem:selplat_mda_host_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
    "mda.control.datasource.password="
})
@AutoConfigureMockMvc
class PlatformRuntimeApplicationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    @Qualifier("mdaControlJdbcTemplate")
    private JdbcTemplate mdaJdbcTemplate;
    @Autowired
    @Qualifier("uniauthDataSource")
    private DataSource uniauthDataSource;

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
        // 公共表格按显式配置提供宽表能力，默认实例不会被强制切换布局。
        mockMvc.perform(get("/sel/components/grid/selGrid.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("selgrid-table-horizontal-scroll")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("horizontalScroll === true")));
        // Uniauth 页面由同一个 Host Web 容器发布，浏览器无需跨端口访问。
        mockMvc.perform(get("/uniauth/uniauth.html"))
                .andExpect(status().isOk());
        // reference-data 管理后台同样由统一 Host 发布，不增加第二个前端端口。
        mockMvc.perform(get("/reference-data/reference-data.html"))
                .andExpect(status().isOk());
        // MDA 由应用 payload 主动启用宽表和默认列宽，字段较多时允许在结果区内水平滚动。
        mockMvc.perform(get("/mda/mda.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("horizontalScroll: true")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("defaultColumnWidth: 150")));
        // Host 桌面只提供工程入口，不复制任何业务页面。
        mockMvc.perform(get("/desktop/desktop.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("data-hostdesktop-app")));
        // 静态入口清单预留 permissionCode，后续后端权限接口可保持相同 JSON 结构。
        mockMvc.perform(get("/desktop/applications.json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applications.length()").value(3))
                .andExpect(jsonPath("$.applications[0].url").value("/mda/mda.html"))
                .andExpect(jsonPath("$.applications[1].url").value("/reference-data/reference-data.html"))
                .andExpect(jsonPath("$.applications[2].url").value("/uniauth/uniauth.html"));
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

    /**
     * 验证 Host 同时装配 MDA 与 Uniauth 时，MDA 新增只推进 MDA 控制库号段。
     *
     * 执行结果示例：MDA 返回 {@code id=100000} 且自己的游标推进到 {@code 101000}，
     * Uniauth 的 {@code UniauthUserId} 游标仍保持 {@code 100000}。
     *
     * @throws Exception 当真实 HTTP 请求或响应读取失败时抛出；成功路径返回 HTTP 200
     */
    @Test
    void shouldRouteMdaSequenceToMdaControlDatabase() throws Exception {
        JdbcTemplate uniauthJdbcTemplate = new JdbcTemplate(uniauthDataSource);
        // Host 初始状态下两个项目号段各自在自己的数据库中保持未领取游标。
        long uniauthBefore = uniauthJdbcTemplate.queryForObject(
            "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'UniauthUserId'",
            Long.class
        );
        long mdaBefore = mdaJdbcTemplate.queryForObject(
            "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'MdaConnectionProfileId'",
            Long.class
        );
        Map<String, Object> connection = Map.of(
            "connectionName", "Host号段路由连接",
            "databaseType", "H2",
            "databaseName", "mem:mda_host_sequence",
            "username", "sa",
            "password", ""
        );
        // 真实 MDA HTTP 新增 → 公共 Service 发号、MDA Base DAO 写入和固定 JSON 返回。
        mockMvc.perform(post("/api/mda/connections/create.htm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(connection)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.id").value(mdaBefore));
        // MDA 游标领取完整一千号段，证明请求真实命中 MDA 控制库。
        long mdaAfter = mdaJdbcTemplate.queryForObject(
            "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'MdaConnectionProfileId'",
            Long.class
        );
        // Uniauth 游标保持不变，证明公共发号器没有依赖 @Primary 跨项目误写。
        long uniauthAfter = uniauthJdbcTemplate.queryForObject(
            "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'UniauthUserId'",
            Long.class
        );
        org.junit.jupiter.api.Assertions.assertEquals(mdaBefore + 1000, mdaAfter);
        org.junit.jupiter.api.Assertions.assertEquals(uniauthBefore, uniauthAfter);
    }
}
