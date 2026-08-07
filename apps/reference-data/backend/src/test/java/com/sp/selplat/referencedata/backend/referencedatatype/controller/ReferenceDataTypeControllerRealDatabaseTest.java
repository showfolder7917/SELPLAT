package com.sp.selplat.referencedata.backend.referencedatatype.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 使用隔离 H2、真实 Controller、Service、Repository 和 SQL 验证类型管理完整 CRUD 契约。
 * 测试库由正式 migration 初始化，不读写 {@code apps/reference-data/db/data} 永久库。
 */
@SpringBootTest(
        classes = ReferenceDataTypeControllerRealDatabaseTest.TestApplication.class,
        properties = {
            "reference-data.datasource.url=jdbc:h2:mem:reference_data_type_admin_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
            "spring.datasource.url=jdbc:h2:mem:reference_data_support_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false"
        })
@AutoConfigureMockMvc
class ReferenceDataTypeControllerRealDatabaseTest {

    // MockMvc 只承载 HTTP 传输，业务结果来自真实数据库调用链。
    @Autowired
    private MockMvc mockMvc;

    /**
     * 验证内置类型、创建、更新、筛选和逻辑删除的连续真实数据库流程。
     *
     * 执行结果示例：新增 {@code cms/article-category} 后可查询并更新为停用，删除后列表不再返回该记录。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出；所有预期请求均返回 HTTP 200
     */
    @Test
    void shouldManageReferenceDataTypesWithRealDatabase() throws Exception {
        // 正式种子脚本 → 首次列表包含平台内置类型。
        mockMvc.perform(get("/api/reference-data/admin/types/getStore.htm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.records[0].resourceCode").value("resource-kind"));

        // 管理表单 → 数据库 identity 生成 cms 类型主键并返回完整记录。
        mockMvc.perform(post("/api/reference-data/admin/types/create.htm")
                        .param("projectCode", "cms")
                        .param("resourceCode", "article-category")
                        .param("nameZh", "文章分类")
                        .param("nameJa", "記事カテゴリ")
                        .param("nameEn", "Article categories")
                        .param("status", "1")
                        .param("sortnum", "80"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.affectedRows").value(1))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.projectCode").value("cms"));

        // 稳定坐标筛选 → 只返回刚写入的真实记录。
        mockMvc.perform(get("/api/reference-data/admin/types/getStore.htm")
                        .param("keyword", "article-category"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records", hasSize(1)))
                .andExpect(jsonPath("$.records[0].id").value(2));

        // 相同坐标再次新增 → 唯一性业务错误，不依赖数据库异常文本。
        mockMvc.perform(post("/api/reference-data/admin/types/create.htm")
                        .param("projectCode", "cms")
                        .param("resourceCode", "article-category")
                        .param("nameZh", "重复分类"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorType").value("BUSINESS"))
                .andExpect(jsonPath("$.errorCode").value("REFERENCE_DATA_TYPE_DUPLICATE"));

        // 主键更新 → 三语名称与坐标保持，状态切换为停用。
        mockMvc.perform(post("/api/reference-data/admin/types/update.htm")
                        .param("id", "2")
                        .param("projectCode", "cms")
                        .param("resourceCode", "article-category")
                        .param("nameZh", "内容分类")
                        .param("nameJa", "記事カテゴリ")
                        .param("nameEn", "Article categories")
                        .param("status", "2")
                        .param("sortnum", "90"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nameZh").value("内容分类"))
                .andExpect(jsonPath("$.data.status").value(2));

        // 逻辑删除 → 记录状态归零且默认列表不再返回。
        mockMvc.perform(post("/api/reference-data/admin/types/delete.htm").param("id", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(0));
        mockMvc.perform(get("/api/reference-data/admin/types/getStore.htm").param("keyword", "article-category"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(0));
    }

    /**
     * 验证非法编码、不存在主键和内置类型保护的错误契约。
     *
     * 执行结果示例：三个请求均返回 HTTP 400 与对应 BUSINESS 错误编码。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出
     */
    @Test
    void shouldReturnBusinessErrorsForInvalidAdminActions() throws Exception {
        // 非法资源编码 → Service 在 SQL 前返回稳定字段错误。
        mockMvc.perform(post("/api/reference-data/admin/types/create.htm")
                        .param("projectCode", "cms")
                        .param("resourceCode", "Bad Code")
                        .param("nameZh", "非法分类"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("REFERENCE_DATA_TYPE_CODE_INVALID"));

        // 不存在主键 → 明确的类型不存在业务错误。
        mockMvc.perform(get("/api/reference-data/admin/types/getById.htm").param("id", "99999"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("REFERENCE_DATA_TYPE_NOT_FOUND"));

        // 平台内置类型 → 禁止管理端误删查询框架自身元数据。
        mockMvc.perform(post("/api/reference-data/admin/types/delete.htm").param("id", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("REFERENCE_DATA_BUILTIN_TYPE_PROTECTED"));
    }

    @Test
    void shouldExposeTypeGridColumnsFromReferenceDataDatabase() throws Exception {
        mockMvc.perform(get("/api/reference-data/admin/types/getGridColumn.htm")
                        .param("viewCode", "reference-data-types")
                        .param("locale", "zh-CN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.source").value("DEFAULT_METADATA"))
                .andExpect(jsonPath("$.data.columns.resourceCode.columnName").value("resourceCode"));
    }

    /**
     * 测试专用最小 Spring Boot 入口扫描 reference-data 与公共 Web 异常、参数解析组件。
     */
    @SpringBootApplication(scanBasePackages = {
        "com.sp.selplat.referencedata.backend",
        "com.sp.selplat.common.web"
    })
    static class TestApplication {
    }
}
