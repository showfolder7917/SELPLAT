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
    "japanese.datasource.password=",
    "ai-factory.datasource.jdbc-url=jdbc:h2:mem:selplat_ai_factory_host_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
    "ai-factory.datasource.password="
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

    /**
     * 方法作用：验证统一宿主健康接口包含桌面清单中的全部已装配业务模块。
     * 真实传参示例：{@code GET /api/platform/runtime/health}。
     * 真实返回示例：模块顺序为 host、mda、reference-data、uniauth、japanese、ai-factory。
     * 异常或副作用示例：清单或模块装配缺失时断言失败，不访问文件数据库。
     */
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
                .andExpect(jsonPath("$.data.modules[5]").value("ai-factory"))
                .andExpect(jsonPath("$.data.referenceDataModuleReady").value(true));
    }

    /**
     * 方法作用：验证统一端口同时发布公共组件、业务页面和完整桌面清单。
     * 真实传参示例：访问公共 SEL UI、desktop 清单以及五个业务应用页面。
     * 真实返回示例：{@code /aifactory/aifactory.html} 与管理接口均返回 HTTP 200。
     * 异常或副作用示例：资源、清单或模块装配缺失时断言失败，只使用隔离内存数据库。
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
        // AI 工厂由统一 Host 发布同源页面和管理接口，不要求桌面再访问独立8091端口。
        mockMvc.perform(get("/aifactory/aifactory.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("plain-minimal")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("data-aifactory-app")));
        mockMvc.perform(get("/api/v1/ai-factory/management/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roles.length()").value(20));
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
                .andExpect(jsonPath("$.applications.length()").value(5))
                .andExpect(jsonPath("$.applications[0].url").value("/mda/mda.html"))
                .andExpect(jsonPath("$.applications[1].url").value("/reference-data/reference-data.html"))
                .andExpect(jsonPath("$.applications[2].url").value("/uniauth/uniauth.html"))
                .andExpect(jsonPath("$.applications[2].visible").value(false))
                .andExpect(jsonPath("$.applications[2].enabled").value(false))
                .andExpect(jsonPath("$.applications[2].releaseStatus").value("internal-remediation"))
                .andExpect(jsonPath("$.applications[3].name").value("N2 红蓝宝书1000题"))
                .andExpect(jsonPath("$.applications[3].url").value("/japanese/japanese.html"))
                .andExpect(jsonPath("$.applications[4].name").value("AI 工厂"))
                .andExpect(jsonPath("$.applications[4].url").value("/aifactory/aifactory.html"));
        // 桌面同源白名单必须包含 Japanese 与 AI 工厂，否则图标虽显示但会被渲染成禁用入口。
        mockMvc.perform(get("/desktop/desktop.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"/japanese/\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"/aifactory/\"")));
    }

    /**
     * 方法作用：定向验证 desktop 清单、同源白名单、AI 工厂页面和管理接口在统一 Host 内完整闭环。
     * 真实传参示例：依次访问 applications.json、desktop.js、aifactory.html 和 management/dashboard。
     * 真实返回示例：第五个应用为 AI 工厂，页面与接口 HTTP 200，角色记录为20条。
     * 异常或副作用示例：模块未导入、静态资源缺失或清单未登记时断言失败，只使用隔离内存数据库。
     */
    @Test
    void shouldExposeAiFactoryFromUnifiedDesktop() throws Exception {
        mockMvc.perform(get("/desktop/desktop.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "20260820-desktop-registry-2")))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("cdn.jsdelivr.net"))));
        mockMvc.perform(get("/desktop/applications.json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applications.length()").value(5))
                .andExpect(jsonPath("$.applications[4].code").value("ai-factory"))
                .andExpect(jsonPath("$.applications[4].url").value("/aifactory/aifactory.html"))
                .andExpect(jsonPath("$.applications[4].visible").value(true))
                .andExpect(jsonPath("$.applications[4].enabled").value(true));
        mockMvc.perform(get("/desktop/desktop.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"/aifactory/\"")));
        mockMvc.perform(get("/aifactory/aifactory.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("plain-minimal")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("data-aifactory-app")));
        mockMvc.perform(get("/api/v1/ai-factory/management/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roles.length()").value(20));
        mockMvc.perform(get("/api/platform/runtime/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.modules[5]").value("ai-factory"));
    }

    /**
     * 验证统一 Host 在引用数据空库时明确返回未配置题型树，题目列表接口仍可访问。
     * 真实传参示例：访问根节点 code {@code japanese100001} 的独立树接口与题库 getStore。
     * 真实返回示例：树接口返回 REFERENCE_DATA_TREE_ROOT_NOT_FOUND，空题库列表返回 records 数组。
     * 异常或副作用示例：模块未装配或路由缺失时 HTTP 断言失败，不写真实文件数据库。
     *
     * @throws Exception MockMvc 请求失败时终止测试
     */
    @Test
    void shouldExposeJapaneseQuestionBankFromUnifiedHost() throws Exception {
        mockMvc.perform(get("/api/reference-data/trees/japanese100001"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("REFERENCE_DATA_TREE_ROOT_NOT_FOUND"));
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
        // TreeNode 为空 → 不伪造默认节点，公开入口只接收独立根节点 code。
        mockMvc.perform(get("/api/reference-data/trees/referenceData100001")
                        .queryParam("locale", "ja-JP"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("REFERENCE_DATA_TREE_ROOT_NOT_FOUND"));
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
