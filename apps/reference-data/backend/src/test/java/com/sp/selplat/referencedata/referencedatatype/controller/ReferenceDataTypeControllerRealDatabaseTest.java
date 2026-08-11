package com.sp.selplat.referencedata.referencedatatype.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sp.selplat.common.service.sequence.SequenceGeneratorImpl;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 使用隔离 H2、真实 Controller、Service、Repository 和 SQL 验证类型管理完整 CRUD 契约。
 * 测试库由正式 SQL 初始化，不读写 {@code apps/reference-data/db/reference-data.mv.db} 永久库。
 */
@SpringBootTest(
        classes = ReferenceDataTypeControllerRealDatabaseTest.TestApplication.class,
        properties = {
            "reference-data.datasource.url=jdbc:h2:mem:reference_data_type_admin_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
            "spring.datasource.url=jdbc:h2:mem:reference_data_support_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false"
        })
@AutoConfigureMockMvc
@Import(SequenceGeneratorImpl.class)
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
                .andExpect(jsonPath("$.totalCount").value(2))
                .andExpect(jsonPath("$.records[0].resourceCode").value("resource-kind"))
                // 资源类型目录在真实树表和选项表均有数据，因此同时归入两个数据库分类。
                .andExpect(jsonPath("$.records[0].resourceKinds", hasSize(2)))
                .andExpect(jsonPath("$.records[0].resourceKinds[0]").value("TREE"))
                .andExpect(jsonPath("$.records[0].resourceKinds[1]").value("OPTIONS"))
                // N2 题库只存在树节点，不能被误分到选项资源。
                .andExpect(jsonPath("$.records[1].resourceKinds", hasSize(1)))
                .andExpect(jsonPath("$.records[1].resourceKinds[0]").value("TREE"));

        // 管理表单 → ReferenceDataTypeId 独立号段生成 cms 类型主键并返回完整记录。
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
                .andExpect(jsonPath("$.records[0].id").value(100000))
                // 新建类型尚未写入树或选项数据，页面应将其稳定显示为未分类。
                .andExpect(jsonPath("$.records[0].resourceKinds", hasSize(0)));

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
                        .param("id", "100000")
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
        mockMvc.perform(post("/api/reference-data/admin/types/delete.htm").param("id", "100000"))
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
        mockMvc.perform(post("/api/reference-data/admin/types/delete.htm").param("id", "900000000001"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("REFERENCE_DATA_BUILTIN_TYPE_PROTECTED"));
    }

    @Test
    void shouldExposeTypeGridColumnsFromReferenceDataDataSource() throws Exception {
        mockMvc.perform(get("/api/reference-data/admin/types/getGridColumn.htm")
                        .param("viewCode", "reference-data-types")
                        .param("locale", "zh-CN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.source").value("DEFAULT_METADATA"))
                .andExpect(jsonPath("$.data.columns.resourceCode.columnName").value("resourceCode"));
    }

    /**
     * 验证树、下拉和右键菜单分别从对应数据库表返回真实多语言内容。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出；成功示例包含树节点 {@code TREE}、
     *     日文选项 {@code ツリーリソース} 和子菜单命令 {@code CREATE_TREE_RESOURCE}
     */
    @Test
    void shouldQueryTreeOptionsAndContextMenuFromOwnTables() throws Exception {
        // ReferenceDataTreeNode 表 → 完整父子树和稳定业务值。
        mockMvc.perform(get("/api/reference-data/reference-data/resource-kind/tree")
                        .param("locale", "en-US"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value("resource-kind-root"))
                .andExpect(jsonPath("$.data[0].children[0].value").value("TREE"));

        // ReferenceDataOption 表 → 日文下拉标签和数据库排序。
        mockMvc.perform(get("/api/reference-data/reference-data/resource-kind/options")
                        .param("locale", "ja-JP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].label").value("ツリーリソース"))
                .andExpect(jsonPath("$.data[1].value").value("OPTIONS"));

        // ReferenceDataContextMenuItem 表 → 顶级菜单、两个子菜单和稳定命令。
        mockMvc.perform(get("/api/reference-data/reference-data/resource-kind/context-menu")
                        .param("locale", "zh-CN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].code").value("create"))
                .andExpect(jsonPath("$.data[0].children", hasSize(2)))
                .andExpect(jsonPath("$.data[0].children[0].command").value("CREATE_TREE_RESOURCE"))
                .andExpect(jsonPath("$.data[1].command").value("REFRESH_RESOURCE_KIND"));
    }

    /**
     * 验证树节点、下拉选项和菜单项目的管理接口均连接各自真实数据库表。
     *
     * 执行结果示例：三个模块分别创建主键 {@code 100000}，更新状态后逻辑删除且列表不再返回。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出；数据库约束或 CRUD 链路异常会使断言失败
     */
    @Test
    void shouldManageTreeOptionAndMenuRecordsWithRealDatabase() throws Exception {
        // 树节点模块 → 独立号段创建、完整字段更新和逻辑删除。
        mockMvc.perform(post("/api/reference-data/admin/tree-nodes/create.htm")
                        .param("typeId", "900000000001")
                        .param("nodeCode", "test-tree-node")
                        .param("nodeValue", "TEST_TREE")
                        .param("labelZh", "测试树节点")
                        .param("status", "1")
                        .param("sortnum", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(100000));
        mockMvc.perform(post("/api/reference-data/admin/tree-nodes/update.htm")
                        .param("id", "100000")
                        .param("typeId", "900000000001")
                        .param("nodeCode", "test-tree-node")
                        .param("nodeValue", "TEST_TREE_UPDATED")
                        .param("labelZh", "测试树节点")
                        .param("status", "2")
                        .param("sortnum", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(2));
        mockMvc.perform(get("/api/reference-data/admin/tree-nodes/getStore.htm").param("id", "100000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records[0].attributesJson").doesNotExist());
        mockMvc.perform(post("/api/reference-data/admin/tree-nodes/delete.htm").param("id", "100000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(0));

        // 下拉选项模块 → 布尔禁用字段通过真实 BOOLEAN 列往返。
        mockMvc.perform(post("/api/reference-data/admin/options/create.htm")
                        .param("typeId", "900000000001")
                        .param("optionValue", "TEST_OPTION")
                        .param("labelZh", "测试选项")
                        .param("disabled", "false")
                        .param("status", "1")
                        .param("sortnum", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(100000));
        mockMvc.perform(post("/api/reference-data/admin/options/update.htm")
                        .param("id", "100000")
                        .param("typeId", "900000000001")
                        .param("optionValue", "TEST_OPTION")
                        .param("labelZh", "测试选项")
                        .param("disabled", "true")
                        .param("status", "1")
                        .param("sortnum", "2"))
                .andExpect(status().isOk())
                // 公共 BaseService 写接口原样回显表单字符串；随后列表查询会从 BOOLEAN 列返回真实布尔值。
                .andExpect(jsonPath("$.data.disabled").value("true"));
        mockMvc.perform(get("/api/reference-data/admin/options/getStore.htm").param("id", "100000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records[0].disabled").value(true));
        mockMvc.perform(post("/api/reference-data/admin/options/delete.htm").param("id", "100000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(0));

        // 菜单模块 → 图标、命令和禁用状态由独立菜单表维护。
        mockMvc.perform(post("/api/reference-data/admin/context-menu-items/create.htm")
                        .param("typeId", "900000000001")
                        .param("itemCode", "test-menu")
                        .param("labelZh", "测试菜单")
                        .param("icon", "ri-flask-line")
                        .param("command", "TEST_COMMAND")
                        .param("disabled", "false")
                        .param("status", "1")
                        .param("sortnum", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(100000));
        mockMvc.perform(post("/api/reference-data/admin/context-menu-items/update.htm")
                        .param("id", "100000")
                        .param("typeId", "900000000001")
                        .param("itemCode", "test-menu")
                        .param("labelZh", "测试菜单")
                        .param("icon", "ri-flask-line")
                        .param("command", "TEST_COMMAND_UPDATED")
                        .param("disabled", "true")
                        .param("status", "1")
                        .param("sortnum", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.command").value("TEST_COMMAND_UPDATED"))
                .andExpect(jsonPath("$.data.disabled").value("true"));
        mockMvc.perform(get("/api/reference-data/admin/context-menu-items/getStore.htm").param("id", "100000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records[0].command").value("TEST_COMMAND_UPDATED"));
        mockMvc.perform(post("/api/reference-data/admin/context-menu-items/delete.htm").param("id", "100000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(0));
    }

    /**
     * 验证表格头一行对应一个显示字段，修改可见状态后解析接口立即反映数据库配置。
     *
     * 执行结果示例：新增 {@code test-column} 后解析为一列，关闭显示后解析为空，删除后管理列表不再返回。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出；解析、更新或删除异常会使断言失败
     */
    @Test
    void shouldManageAndResolveDatabaseDrivenTableColumns() throws Exception {
        mockMvc.perform(post("/api/reference-data/admin/table-columns/create.htm")
                        .param("tableCode", "ReferenceDataOption")
                        .param("viewCode", "test-option-view")
                        .param("columnCode", "test-column")
                        .param("fieldCode", "optionValue")
                        .param("labelZh", "测试表头")
                        .param("labelJa", "テスト列")
                        .param("labelEn", "Test column")
                        .param("width", "180px")
                        .param("renderer", "text")
                        .param("visible", "true")
                        .param("status", "1")
                        .param("sortnum", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(100000));

        mockMvc.perform(get("/api/reference-data/admin/table-columns/resolve.htm")
                        .param("tableCode", "ReferenceDataOption")
                        .param("viewCode", "test-option-view")
                        .param("locale", "ja-JP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.source").value("REFERENCE_DATA_TABLE_COLUMN"))
                .andExpect(jsonPath("$.data.columns", hasSize(1)))
                .andExpect(jsonPath("$.data.columns[0].label").value("テスト列"))
                .andExpect(jsonPath("$.data.columns[0].width").value("180px"));

        mockMvc.perform(post("/api/reference-data/admin/table-columns/update.htm")
                        .param("id", "100000")
                        .param("tableCode", "ReferenceDataOption")
                        .param("viewCode", "test-option-view")
                        .param("columnCode", "test-column")
                        .param("fieldCode", "optionValue")
                        .param("labelZh", "测试表头")
                        .param("labelJa", "テスト列")
                        .param("labelEn", "Test column")
                        .param("width", "180px")
                        .param("renderer", "text")
                        .param("visible", "false")
                        .param("status", "1")
                        .param("sortnum", "1"))
                .andExpect(status().isOk())
                // 写响应原样回显请求值，紧接着的解析查询负责验证数据库布尔状态已真正生效。
                .andExpect(jsonPath("$.data.visible").value("false"));
        mockMvc.perform(get("/api/reference-data/admin/table-columns/resolve.htm")
                        .param("tableCode", "ReferenceDataOption")
                        .param("viewCode", "test-option-view"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.source").value("SAFE_DEFAULT"))
                .andExpect(jsonPath("$.data.columns", hasSize(0)));

        mockMvc.perform(post("/api/reference-data/admin/table-columns/delete.htm").param("id", "100000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(0));
    }

    /**
     * 测试专用最小 Spring Boot 入口扫描 reference-data 与公共 Web 异常、参数解析组件。
     */
    @SpringBootApplication(scanBasePackages = {
        "com.sp.selplat.referencedata",
        "com.sp.selplat.common.web"
    })
    static class TestApplication {
    }
}
