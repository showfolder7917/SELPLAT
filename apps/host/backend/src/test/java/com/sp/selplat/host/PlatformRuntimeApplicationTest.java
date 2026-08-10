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
    "mda.control.datasource.password=",
    "japanese.datasource.jdbc-url=jdbc:h2:mem:selplat_japanese_host_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
    "japanese.datasource.password="
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
                .andExpect(jsonPath("$.data.modules[1]").value("mda"))
                .andExpect(jsonPath("$.data.modules[2]").value("reference-data"))
                .andExpect(jsonPath("$.data.modules[3]").value("uniauth"))
                .andExpect(jsonPath("$.data.modules[4]").value("japanese"))
                .andExpect(jsonPath("$.data.referenceDataModuleReady").value(true));
    }

    /**
     * 验证统一端口同时发布公共组件、业务页面和完整桌面清单。
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
                .andExpect(content().string(org.hamcrest.Matchers.containsString("horizontalScroll === true")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("columnResize !== false")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("selGridHandleColumnResizeMove")));
        // Tab 右键操作必须由 sel-ui 通用菜单发布，禁止 MDA 复制第二套浮层。
        mockMvc.perform(get("/sel/components/context-menu/selContextMenu.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("selContextMenu:action")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("ArrowDown")));
        // Uniauth 页面由同一个 Host Web 容器发布，浏览器无需跨端口访问。
        mockMvc.perform(get("/uniauth/uniauth.html"))
                .andExpect(status().isOk());
        // reference-data 管理后台同样由统一 Host 发布，不增加第二个前端端口。
        mockMvc.perform(get("/reference-data/reference-data.html"))
                .andExpect(status().isOk());
        // Japanese 必须由统一 Host 发布，禁止只在业务模块独立启动时可访问。
        mockMvc.perform(get("/japanese/japanese.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("data-japanese-app")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("/sel/components/grid/selGrid.js")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("/sel/components/window/selWindow.js")));
        // MDA 由应用 payload 主动启用宽表和默认列宽，字段较多时允许在结果区内水平滚动。
        mockMvc.perform(get("/mda/mda.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("horizontalScroll: true")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("defaultColumnWidth: 150")));
        // MDA 入口显式先加载公共右键菜单再加载 Tab，保证页签批量关闭可用。
        mockMvc.perform(get("/mda/mda.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("/sel/components/context-menu/selContextMenu.css")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("/sel/components/context-menu/selContextMenu.js")));
        // Host 桌面只提供工程入口，不复制任何业务页面。
        mockMvc.perform(get("/desktop/desktop.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("data-hostdesktop-app")));
        // 静态入口清单预留 permissionCode，后续后端权限接口可保持相同 JSON 结构。
        mockMvc.perform(get("/desktop/applications.json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applications.length()").value(4))
                .andExpect(jsonPath("$.applications[0].url").value("/mda/mda.html"))
                .andExpect(jsonPath("$.applications[1].url").value("/reference-data/reference-data.html"))
                .andExpect(jsonPath("$.applications[2].url").value("/uniauth/uniauth.html"))
                .andExpect(jsonPath("$.applications[3].name").value("N2 红蓝宝书1000题"))
                .andExpect(jsonPath("$.applications[3].url").value("/japanese/japanese.html"));
        // 桌面同源白名单必须包含 Japanese，否则图标虽显示但会被渲染成禁用入口。
        mockMvc.perform(get("/desktop/desktop.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"/japanese/\"")));
    }

    /**
     * 验证统一 Host 同时装配 Japanese 题型树和题目列表接口。
     * 真实传参示例：访问 japanese/n2-blue-book-question 的 tree 与 getStore。
     * 真实返回示例：树根为 N2 红蓝宝书题库语义，空题库列表返回 records 数组。
     * 异常或副作用示例：模块未装配或路由缺失时 HTTP 断言失败，不写真实文件数据库。
     *
     * @throws Exception MockMvc 请求失败时终止测试
     */
    @Test
    void shouldExposeJapaneseQuestionBankFromUnifiedHost() throws Exception {
        mockMvc.perform(get("/api/reference-data/japanese/n2-blue-book-question/tree")
                        .queryParam("tenantId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].label").value("N2 蓝宝书1000题"))
                .andExpect(jsonPath("$.data[0].children.length()").value(3));
        mockMvc.perform(get("/api/japanese/n2-blue-book-question/getStore.htm")
                        .queryParam("pageNo", "1")
                        .queryParam("pageSize", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records").isArray());
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
        // Host 显式装配的 ReferenceDataTreeNode 表业务 → 英文树 API 固定结构。
        mockMvc.perform(get("/api/reference-data/reference-data/resource-kind/tree")
                        .queryParam("locale", "en-US"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].label").value("Reference data resource types"));
        // ReferenceDataOption 表业务 → 日文选项 API 保持稳定值和本地化标签。
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
