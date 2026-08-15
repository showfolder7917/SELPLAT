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
    "reference-data.datasource.jdbc-url=jdbc:h2:mem:reference_data_host_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
    "reference-data.datasource.pool-name=ReferenceDataHostTestPool",
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
     * 执行结果示例：{@code /sel/core/selKernel.js}、{@code /sel/core/selBaseRuntime.js} 与
     * {@code /uniauth/uniauth.html} 均返回 HTTP 200。
     */
    @Test
    void shouldExposeSharedUiAndUniauthPageFromOneRuntime() throws Exception {
        // 公共运行时必须来自 sel-ui 依赖 JAR，而不是 Host 或 Uniauth 的复制目录。
        mockMvc.perform(get("/sel/core/selKernel.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "Object.defineProperty(global, \"sel\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "selRegister(\"core.freeze\"")));
        mockMvc.perform(get("/sel/core/selBaseRuntime.js"))
                .andExpect(status().isOk());
        // 公共表格按显式配置提供宽表能力，默认实例不会被强制切换布局。
        mockMvc.perform(get("/sel/components/grid/selGrid.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("selgrid-table-horizontal-scroll")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("horizontalScroll === true")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("columnResize !== false")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("selGridHandleColumnResizeMove")))
                // 纯图标记录操作必须使用统一 selTooltip，并允许标签与图标根据当前记录动态解析。
                .andExpect(content().string(org.hamcrest.Matchers.containsString("selGridResolveRecordActionValue")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("selGridButton.dataset.selTooltip = selGridActionLabel")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("selGridButton.dataset.selTooltipMode = \"always\"")));
        // Tab 右键操作必须由 sel-ui 通用菜单发布，禁止 MDA 复制第二套浮层。
        mockMvc.perform(get("/sel/components/context-menu/selContextMenu.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("selContextMenu:action")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("ArrowDown")));
        // Grid 与 Tree 的截断文字提示必须由统一 selTooltip 提供，不再依赖浏览器原生 title。
        mockMvc.perform(get("/sel/components/tooltip/selTooltip.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("data-sel-tooltip")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("selTooltipIsTruncated")));
        // Uniauth 页面由同一个 Host Web 容器发布，浏览器无需跨端口访问。
        mockMvc.perform(get("/uniauth/uniauth.html"))
                .andExpect(status().isOk());
        // reference-data 管理后台同样由统一 Host 发布，不增加第二个前端端口。
        mockMvc.perform(get("/reference-data/reference-data.html"))
                .andExpect(status().isOk())
                // 删除动作必须加载紧凑确认控件，不得用完整业务窗口承载二次确认。
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "/sel/components/confirm-dialog/selConfirmDialog.js")));
        // Japanese 必须由统一 Host 发布，禁止只在业务模块独立启动时可访问。
        mockMvc.perform(get("/japanese/japanese.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("data-japanese-app")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("/sel/components/tooltip/selTooltip.js")))
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
                .andExpect(jsonPath("$.applications[2].visible").value(false))
                .andExpect(jsonPath("$.applications[2].enabled").value(false))
                .andExpect(jsonPath("$.applications[2].releaseStatus").value("internal-remediation"))
                .andExpect(jsonPath("$.applications[3].name").value("N2 红蓝宝书1000题"))
                .andExpect(jsonPath("$.applications[3].url").value("/japanese/japanese.html"));
        // 桌面同源白名单必须包含 Japanese，否则图标虽显示但会被渲染成禁用入口。
        mockMvc.perform(get("/desktop/desktop.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"/japanese/\"")));
    }

    /**
     * 验证统一 Host 在引用数据空库时明确返回未配置题型树，题目列表接口仍可访问。
     * 真实传参示例：访问类型 code {@code japanese100001} 的 nodes 与题库 getStore。
     * 真实返回示例：节点接口返回 REFERENCE_DATA_NODES_NOT_FOUND，空题库列表返回 records 数组。
     * 异常或副作用示例：模块未装配或路由缺失时 HTTP 断言失败，不写真实文件数据库。
     *
     * @throws Exception MockMvc 请求失败时终止测试
     */
    @Test
    void shouldExposeJapaneseQuestionBankFromUnifiedHost() throws Exception {
        mockMvc.perform(get("/api/reference-data/types/japanese100001/nodes"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("REFERENCE_DATA_NODES_NOT_FOUND"));
        mockMvc.perform(get("/api/japanese/n2-blue-book-question/getStore.htm")
                        .queryParam("pageNo", "1")
                        .queryParam("pageSize", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records").isArray());
    }

    /**
     * 验证 Host 在同一端口发布 reference-data 接口，空库时返回明确未配置错误。
     *
     * 执行结果示例：类型与节点分别返回稳定的 code 未找到业务错误码。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出；成功路径均返回 HTTP 200
     */
    @Test
    void shouldExposeReferenceDataTypeAndNodesByCodeOnly() throws Exception {
        // ReferenceDataType 为空 → 只按 code 查询并返回稳定未配置错误。
        mockMvc.perform(get("/api/reference-data/types/referenceData100001"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("REFERENCE_DATA_TYPE_CODE_NOT_FOUND"));
        // TreeNode 为空 → 不伪造默认节点，公开入口仍只接收类型 code。
        mockMvc.perform(get("/api/reference-data/types/referenceData100001/nodes")
                        .queryParam("locale", "ja-JP"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("REFERENCE_DATA_NODES_NOT_FOUND"));
        // 旧 projectCode + resourceCode 路由已经删除，不能继续作为第二公开定位方式。
        mockMvc.perform(get("/api/reference-data/reference-data/resource-kind/tree"))
                .andExpect(status().isNotFound());
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
