package com.sp.selplat.referencedata.referencedatatype.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sp.selplat.common.service.sequence.SequenceGeneratorImpl;
import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.referencedata.referencedatatablecolumn.service.impl.ReferenceDataTableColumnServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 使用隔离 H2、真实 Controller、Service、Repository 和 SQL 验证类型管理完整 CRUD 契约。
 * 测试库由正式 SQL 初始化，不读写 {@code apps/reference-data/db/reference-data.mv.db} 永久库。
 */
@SpringBootTest(
        classes = ReferenceDataTypeControllerRealDatabaseTest.TestApplication.class,
        properties = {
            "reference-data.datasource.jdbc-url=jdbc:h2:mem:reference_data_type_admin_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
            "reference-data.datasource.pool-name=ReferenceDataControllerTestPool",
            "spring.datasource.url=jdbc:h2:mem:reference_data_support_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false"
        })
@AutoConfigureMockMvc
@Import(SequenceGeneratorImpl.class)
class ReferenceDataTypeControllerRealDatabaseTest {

    // MockMvc 只承载 HTTP 传输，业务结果来自真实数据库调用链。
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    @Qualifier("referenceDataJdbcTemplate")
    private JdbcTemplate jdbcTemplate;

    /** 每个接口测试先清理初始化演示数据，再显式建立当前 Case 所需的隔离数据。 */
    @BeforeEach
    void prepareExplicitFixture() {
        jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY FALSE");
        for (String tableName : new String[] {
            "ReferenceDataControlBinding", "ReferenceDataContextMenuItem", "ReferenceDataOption", "ReferenceDataTreeNode",
            "ReferenceDataTableColumn", "ReferenceDataTable", "ReferenceDataType", "CommonSequenceSegment"
        }) {
            jdbcTemplate.execute("DELETE FROM " + tableName);
        }
        jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");
        String sequenceSql = "INSERT INTO CommonSequenceSegment "
                + "(tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, status) "
                + "VALUES (1, 1, ?, ?, 101000, 100, 0, 1)";
        jdbcTemplate.update(sequenceSql, "ReferenceDataTypeId", "类型主键");
        jdbcTemplate.update(sequenceSql, "ReferenceDataTreeNodeId", "树节点主键");
        jdbcTemplate.update(sequenceSql, "ReferenceDataOptionId", "选项主键");
        jdbcTemplate.update(sequenceSql, "ReferenceDataContextMenuItemId", "菜单主键");
        jdbcTemplate.update(sequenceSql, "ReferenceDataTableId", "表格登记主键");
        jdbcTemplate.update(sequenceSql, "ReferenceDataTableColumnId", "表格头主键");
        jdbcTemplate.update(sequenceSql, "ReferenceDataControlBindingId", "控件绑定主键");
        jdbcTemplate.update("INSERT INTO ReferenceDataType "
                + "(id, tenantId, lastOperateUserId, projectCode, resourceCode, nameZh, status, sortnum) "
                + "VALUES (100001, 1, 1, 'reference-data', 'resource-kind', '引用数据资源类型', 1, 100), "
                + "(100002, 1, 1, 'japanese', 'n2-blue-book-question', 'N2 蓝宝书1000题', 1, 90)");
        jdbcTemplate.update("INSERT INTO ReferenceDataTreeNode "
                + "(id, tenantId, lastOperateUserId, typeId, parentId, nodeCode, nodeValue, labelZh, labelJa, labelEn, status, sortnum) VALUES "
                + "(100001,1,1,100001,NULL,'resource-kind-root','ROOT','资源类型','リソース種別','Resource types',1,1),"
                + "(100002,1,1,100001,100001,'resource-kind-tree','TREE','树形资源','ツリーリソース','Tree resources',1,2),"
                + "(100003,1,1,100001,100001,'resource-kind-options','OPTIONS','选项资源','選択肢リソース','Option resources',1,3),"
                + "(100004,1,1,100002,NULL,'n2-root','N2','N2题库','N2問題集','N2 questions',1,1)");
        jdbcTemplate.update("INSERT INTO ReferenceDataOption "
                + "(id, tenantId, lastOperateUserId, typeId, optionValue, labelZh, labelJa, labelEn, status, sortnum) VALUES "
                + "(100001,1,1,100001,'TREE','树形资源','ツリーリソース','Tree resources',1,1),"
                + "(100002,1,1,100001,'OPTIONS','选项资源','選択肢リソース','Option resources',1,2)");
        jdbcTemplate.update("INSERT INTO ReferenceDataContextMenuItem "
                + "(id, tenantId, lastOperateUserId, typeId, parentId, itemCode, labelZh, command, status, sortnum) VALUES "
                + "(100001,1,1,100001,NULL,'create','新建',NULL,1,1),"
                + "(100002,1,1,100001,100001,'create-tree-resource','新建树资源','CREATE_TREE_RESOURCE',1,1),"
                + "(100003,1,1,100001,100001,'create-option-resource','新建选项资源','CREATE_OPTION_RESOURCE',1,2),"
                + "(100004,1,1,100001,NULL,'refresh','刷新','REFRESH_RESOURCE_KIND',1,2)");
        jdbcTemplate.update("INSERT INTO ReferenceDataControlBinding "
                + "(id, tenantId, lastOperateUserId, pageProjectCode, pagePath, controlId, controlType, typeId, status, sortnum) "
                + "VALUES (100001,1,1,'reference-data','/reference-data/reference-data.html',"
                + "'selDropdownResourceKindId','DROPDOWN',100001,1,1)");
    }

    /**
     * 验证表格主记录保存所属项目、真实表、表格配置 ID、描述和页面位置。
     *
     * 真实传参示例：提交 {@code reference-data/ReferenceDataType/selGridTypeManagementId}。
     * 真实返回示例：分页接口返回新表格记录及 {@code /reference-data/reference-data.html} 页面位置。
     * 异常或副作用示例：相同项目和表格配置 ID 重复时数据库唯一键阻止第二条记录。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出；创建或查询异常会使断言失败
     */
    @Test
    void shouldManageReferenceDataTableRegistry() throws Exception {
        mockMvc.perform(post("/api/reference-data/admin/tables/create.htm")
                        .param("projectName", "reference-data")
                        .param("tableName", "ReferenceDataType")
                        .param("gridColumnId", "selGridTypeManagementId")
                        .param("description", "引用数据类型管理表格")
                        .param("pagePath", "/reference-data/reference-data.html")
                        .param("status", "1")
                        .param("sortnum", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(101000));

        mockMvc.perform(get("/api/reference-data/admin/tables/getStore.htm")
                        .param("gridColumnId", "selGridTypeManagementId"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.records[0].tableName").value("ReferenceDataType"))
                .andExpect(jsonPath("$.records[0].description").value("引用数据类型管理表格"))
                .andExpect(jsonPath("$.records[0].pagePath").value("/reference-data/reference-data.html"));

        // 单查、更新和逻辑删除继续复用公共 CRUD，证明表格定义不是只读登记清单。
        mockMvc.perform(get("/api/reference-data/admin/tables/getById.htm").param("id", "101000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gridColumnId").value("selGridTypeManagementId"));
        mockMvc.perform(post("/api/reference-data/admin/tables/update.htm")
                        .param("id", "101000")
                        .param("projectName", "reference-data")
                        .param("tableName", "ReferenceDataType")
                        .param("gridColumnId", "selGridTypeManagementId")
                        .param("description", "引用数据类型管理表格（已更新）")
                        .param("pagePath", "/reference-data/reference-data.html")
                        .param("status", "2")
                        .param("sortnum", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.description").value("引用数据类型管理表格（已更新）"));
        mockMvc.perform(post("/api/reference-data/admin/tables/delete.htm").param("id", "101000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(0));
        mockMvc.perform(get("/api/reference-data/admin/tables/getStore.htm")
                        .param("gridColumnId", "selGridTypeManagementId")
                        .param("status", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.records[0].status").value(0));
    }

    /**
     * 验证页面编辑保存对权限、坐标、JSON、重复列、宽度格式、边界和数据库命中执行完整阻断。
     * 真实传参示例：依次提交空坐标、空数组、非法 JSON、重复列、缺失宽度、{@code 12rem}、
     *     {@code 961px} 和数据库不存在的列坐标。
     * 真实返回示例：分别返回稳定业务错误码，非管理员直接得到
     *     {@code PAGE_EDITOR_ADMIN_REQUIRED}。
     * 异常或副作用示例：全部失败都发生在事务提交前，隔离数据库不会留下列宽变更。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出
     */
    @Test
    void shouldRejectEveryInvalidPageEditorWidthRequest() throws Exception {
        CommonBusinessException nonAdminError = assertThrows(
                CommonBusinessException.class,
                () -> new NonAdminTableColumnService().saveColumnWidths(new CommonParam()));
        assertEquals("PAGE_EDITOR_ADMIN_REQUIRED", nonAdminError.getErrorCode());

        expectPageEditorSaveError(null, "selGridTestOptionId", "[]", "INVALID_PAGE_EDITOR_COORDINATE");
        expectPageEditorSaveError("bad/table", "selGridTestOptionId", "[]", "INVALID_PAGE_EDITOR_COORDINATE");
        expectPageEditorSaveError("ReferenceDataOption", "selGridTestOptionId", null, "EMPTY_PAGE_EDITOR_WIDTHS");
        expectPageEditorSaveError("ReferenceDataOption", "selGridTestOptionId", "null", "EMPTY_PAGE_EDITOR_WIDTHS");
        expectPageEditorSaveError("ReferenceDataOption", "selGridTestOptionId", "[]", "EMPTY_PAGE_EDITOR_WIDTHS");
        expectPageEditorSaveError("ReferenceDataOption", "selGridTestOptionId", "{bad-json", "INVALID_PAGE_EDITOR_WIDTHS_JSON");
        expectPageEditorSaveError(
                "ReferenceDataOption",
                "selGridTestOptionId",
                "[{\"gridColumnId\":\"same\",\"width\":\"180px\"},{\"gridColumnId\":\"same\",\"width\":\"190px\"}]",
                "DUPLICATE_PAGE_EDITOR_COLUMN");
        expectPageEditorSaveError(
                "ReferenceDataOption",
                "selGridTestOptionId",
                "[{\"gridColumnId\":\"missing-width\"}]",
                "INVALID_PAGE_EDITOR_COLUMN_WIDTH");
        expectPageEditorSaveError(
                "ReferenceDataOption",
                "selGridTestOptionId",
                "[{\"gridColumnId\":\"bad-unit\",\"width\":\"12rem\"}]",
                "INVALID_PAGE_EDITOR_COLUMN_WIDTH");
        expectPageEditorSaveError(
                "ReferenceDataOption",
                "selGridTestOptionId",
                "[{\"gridColumnId\":\"too-wide\",\"width\":\"961px\"}]",
                "PAGE_EDITOR_COLUMN_WIDTH_OUT_OF_RANGE");
        expectPageEditorSaveError(
                "ReferenceDataOption",
                "selGridTestOptionId",
                "[{\"gridColumnId\":\"not-in-database\",\"width\":\"180px\"}]",
                "PAGE_EDITOR_COLUMN_NOT_FOUND");
    }

    /**
     * 提交一次页面列宽失败请求并断言公共 Web 层返回的稳定错误编码。
     * 真实传参示例：{@code tableName=ReferenceDataOption,widths=[]}。
     * 真实返回示例：期望 {@code EMPTY_PAGE_EDITOR_WIDTHS} 时响应 HTTP 400 且 errorCode 相同。
     * 异常或副作用示例：参数为 null 时不添加对应表单字段，用于覆盖服务端缺参分支。
     *
     * @param tableName 业务表坐标；null 表示省略字段
     * @param gridId Grid 控件坐标；null 表示省略字段
     * @param widths 列宽 JSON；null 表示省略字段
     * @param expectedCode 期望公共业务错误码
     * @throws Exception 当 MockMvc 请求执行失败时抛出
     */
    private void expectPageEditorSaveError(
            String tableName,
            String gridId,
            String widths,
            String expectedCode) throws Exception {
        org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request =
                post("/api/reference-data/admin/table-columns/save-widths.htm");
        if (tableName != null) request.param("tableName", tableName);
        if (gridId != null) request.param("gridId", gridId);
        if (widths != null) request.param("widths", widths);
        mockMvc.perform(request)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(expectedCode));
    }

    /** 测试专用非管理员 Service，只覆盖后台二次鉴权的拒绝分支，不访问数据库。 */
    private static final class NonAdminTableColumnService extends ReferenceDataTableColumnServiceImpl {

        /**
         * 返回测试身份的非管理员事实。
         * 真实传参示例：无参数调用。
         * 真实返回示例：固定返回 {@code false}。
         * 异常或副作用示例：不读取登录上下文且不修改数据库。
         *
         * @return 固定非管理员结果
         */
        @Override
        protected boolean isAdmin() {
            return false;
        }
    }

    /**
     * 验证工作台导航能力返回六个一级模块且不查询表格字段模块。
     *
     * 真实传参示例：无参数请求 {@code /api/reference-data/workbench/navigation.htm}。
     * 真实返回示例：第四项为控件绑定、第六项为表格定义，返回中不存在 {@code columns} 一级模块。
     * 异常或副作用示例：该接口不读取或写入任何业务表，空数据库也返回相同导航。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出
     */
    @Test
    void shouldExposeDatabaseFreeWorkbenchNavigation() throws Exception {
        mockMvc.perform(get("/api/reference-data/workbench/navigation.htm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.initialKey").value("types"))
                .andExpect(jsonPath("$.data.modules", hasSize(6)))
                .andExpect(jsonPath("$.data.modules[0].key").value("types"))
                .andExpect(jsonPath("$.data.modules[3].key").value("bindings"))
                .andExpect(jsonPath("$.data.modules[5].key").value("tables"))
                .andExpect(jsonPath("$.data.modules[5].drilldown").value("tables-to-columns"));
    }

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
                .andExpect(jsonPath("$.records[0].id").value(101000))
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
                        .param("id", "101000")
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
        mockMvc.perform(post("/api/reference-data/admin/types/delete.htm").param("id", "101000"))
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
        mockMvc.perform(post("/api/reference-data/admin/types/delete.htm").param("id", "100001"))
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
                .andExpect(jsonPath("$.data.source").value("DEFAULT_FIELD_NAME"))
                .andExpect(jsonPath("$.data.columns[?(@.field == 'resourceCode')].label").value(hasItem("resourceCode")));
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

        // 页面控件绑定 → 同一批 ReferenceDataOption 通过页面路径和控件 ID 精确解析。
        mockMvc.perform(get("/api/reference-data/pages/reference-data/controls/selDropdownResourceKindId/options")
                        .param("pagePath", "/reference-data/reference-data.html")
                        .param("locale", "ja-JP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].value").value("TREE"))
                .andExpect(jsonPath("$.data[1].label").value("選択肢リソース"));

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
     * 验证页面控件绑定公共 CRUD、唯一坐标解析和停用边界使用同一真实数据库链路。
     *
     * 真实传参示例：登记 {@code cms/article.html#selDropdownArticleStatusId} 并绑定类型 {@code 100001}。
     * 真实返回示例：新增主键为 {@code 101000}；固定绑定启用时返回两条真实 ReferenceDataOption。
     * 异常或副作用示例：固定绑定停用后页面坐标查询返回
     *     {@code REFERENCE_DATA_CONTROL_OPTIONS_NOT_FOUND}，逻辑删除不会物理移除新增绑定。
     *
     * @throws Exception 当 MockMvc 请求、真实 SQL 或统一异常响应不符合契约时抛出
     */
    @Test
    void shouldManageControlBindingAndRejectDisabledBinding() throws Exception {
        // 管理接口新增真实页面控件绑定，主键和审计身份全部由公共 Service 补齐。
        mockMvc.perform(post("/api/reference-data/admin/control-bindings/create.htm")
                        .param("pageProjectCode", "cms")
                        .param("pagePath", "/cms/article.html")
                        .param("controlId", "selDropdownArticleStatusId")
                        .param("controlType", "DROPDOWN")
                        .param("typeId", "100001")
                        .param("description", "文章状态下拉框")
                        .param("status", "1")
                        .param("sortnum", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(101000))
                .andExpect(jsonPath("$.data.tenantId").value(1))
                .andExpect(jsonPath("$.data.lastOperateUserId").value(1));

        // 详情接口证明新实体完整接入 BaseController 与真实表，而不是只存在建表脚本。
        mockMvc.perform(get("/api/reference-data/admin/control-bindings/getById.htm")
                        .param("id", "101000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pageProjectCode").value("cms"))
                .andExpect(jsonPath("$.data.controlId").value("selDropdownArticleStatusId"));

        // 停用固定绑定后，普通页面查询不能绕过绑定状态继续读取选项。
        mockMvc.perform(post("/api/reference-data/admin/control-bindings/update.htm")
                        .param("id", "100001")
                        .param("status", "2"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/reference-data/pages/reference-data/controls/selDropdownResourceKindId/options")
                        .param("pagePath", "/reference-data/reference-data.html"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("REFERENCE_DATA_CONTROL_OPTIONS_NOT_FOUND"));

        // 删除继续使用统一逻辑删除，数据库保留记录并把状态改为 0 供审计追踪。
        mockMvc.perform(post("/api/reference-data/admin/control-bindings/delete.htm")
                        .param("id", "101000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(0));
        mockMvc.perform(get("/api/reference-data/admin/control-bindings/getStore.htm")
                        .param("controlId", "selDropdownArticleStatusId"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.records[0].status").value(0));
    }

    /**
     * 验证树节点、下拉选项和菜单项目的管理接口均连接各自真实数据库表。
     *
     * 执行结果示例：三个模块分别创建主键 {@code 101000}，更新状态后逻辑删除且列表不再返回。
     *
     * @throws Exception 当 MockMvc 请求执行失败时抛出；数据库约束或 CRUD 链路异常会使断言失败
     */
    @Test
    void shouldManageTreeOptionAndMenuRecordsWithRealDatabase() throws Exception {
        // 树节点模块 → 独立号段创建、完整字段更新和逻辑删除。
        mockMvc.perform(post("/api/reference-data/admin/tree-nodes/create.htm")
                        .param("typeId", "100001")
                        .param("nodeCode", "test-tree-node")
                        .param("nodeValue", "TEST_TREE")
                        .param("labelZh", "测试树节点")
                        .param("status", "1")
                        .param("sortnum", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(101000));
        mockMvc.perform(post("/api/reference-data/admin/tree-nodes/update.htm")
                        .param("id", "101000")
                        .param("typeId", "100001")
                        .param("nodeCode", "test-tree-node")
                        .param("nodeValue", "TEST_TREE_UPDATED")
                        .param("labelZh", "测试树节点")
                        .param("status", "2")
                        .param("sortnum", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(2));
        mockMvc.perform(get("/api/reference-data/admin/tree-nodes/getStore.htm").param("id", "101000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records[0].attributesJson").doesNotExist());
        mockMvc.perform(post("/api/reference-data/admin/tree-nodes/delete.htm").param("id", "101000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(0));

        // 下拉选项模块 → 布尔禁用字段通过真实 BOOLEAN 列往返。
        mockMvc.perform(post("/api/reference-data/admin/options/create.htm")
                        .param("typeId", "100001")
                        .param("optionValue", "TEST_OPTION")
                        .param("labelZh", "测试选项")
                        .param("disabled", "false")
                        .param("status", "1")
                        .param("sortnum", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(101000));
        mockMvc.perform(post("/api/reference-data/admin/options/update.htm")
                        .param("id", "101000")
                        .param("typeId", "100001")
                        .param("optionValue", "TEST_OPTION")
                        .param("labelZh", "测试选项")
                        .param("disabled", "true")
                        .param("status", "1")
                        .param("sortnum", "2"))
                .andExpect(status().isOk())
                // 公共 BaseService 写接口原样回显表单字符串；随后列表查询会从 BOOLEAN 列返回真实布尔值。
                .andExpect(jsonPath("$.data.disabled").value("true"));
        mockMvc.perform(get("/api/reference-data/admin/options/getStore.htm").param("id", "101000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records[0].disabled").value(true));
        mockMvc.perform(post("/api/reference-data/admin/options/delete.htm").param("id", "101000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(0));

        // 菜单模块 → 图标、命令和禁用状态由独立菜单表维护。
        mockMvc.perform(post("/api/reference-data/admin/context-menu-items/create.htm")
                        .param("typeId", "100001")
                        .param("itemCode", "test-menu")
                        .param("labelZh", "测试菜单")
                        .param("icon", "ri-flask-line")
                        .param("command", "TEST_COMMAND")
                        .param("disabled", "false")
                        .param("status", "1")
                        .param("sortnum", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(101000));
        mockMvc.perform(post("/api/reference-data/admin/context-menu-items/update.htm")
                        .param("id", "101000")
                        .param("typeId", "100001")
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
        mockMvc.perform(get("/api/reference-data/admin/context-menu-items/getStore.htm").param("id", "101000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records[0].command").value("TEST_COMMAND_UPDATED"));
        mockMvc.perform(post("/api/reference-data/admin/context-menu-items/delete.htm").param("id", "101000"))
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
                        .param("tableName", "ReferenceDataOption")
                        .param("gridId", "selGridTestOptionId")
                        .param("gridColumnId", "test-column")
                        .param("tableFieldName", "optionValue")
                        .param("labelZh", "测试表头")
                        .param("labelJa", "テスト列")
                        .param("labelEn", "Test column")
                        .param("width", "180px")
                        .param("cellRenderer", "text")
                        .param("cellIcon", "ri-list-check-3")
                        .param("cellIconVisible", "true")
                        .param("visible", "true")
                        .param("status", "1")
                        .param("sortnum", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(101000));

        mockMvc.perform(get("/api/reference-data/admin/table-columns/getById.htm").param("id", "101000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gridColumnId").value("test-column"));
        mockMvc.perform(get("/api/reference-data/admin/table-columns/getStore.htm")
                        .param("gridId", "selGridTestOptionId"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1));

        mockMvc.perform(get("/api/reference-data/admin/table-columns/resolve.htm")
                        .param("tableName", "ReferenceDataOption")
                        .param("gridId", "selGridTestOptionId")
                        .param("locale", "ja-JP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.source").value("REFERENCE_DATA_TABLE_COLUMN"))
                .andExpect(jsonPath("$.data.columns", hasSize(1)))
                .andExpect(jsonPath("$.data.columns[0].label").value("テスト列"))
                .andExpect(jsonPath("$.data.columns[0].width").value("180px"))
                .andExpect(jsonPath("$.data.columns[0].cellIcon").value("ri-list-check-3"))
                .andExpect(jsonPath("$.data.columns[0].cellIconVisible").value(true));

        // 页面编辑入口先读取后台管理员事实，前端不根据固定用户 ID 自行推断权限。
        mockMvc.perform(get("/api/reference-data/admin/table-columns/page-editor-capability.htm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.admin").value(true))
                .andExpect(jsonPath("$.data.canEditPage").value(true));

        // 页面编辑保存只提交三段数据库坐标和宽度，租户、操作员由基础 Service 自动取得。
        mockMvc.perform(post("/api/reference-data/admin/table-columns/save-widths.htm")
                        .param("tableName", "ReferenceDataOption")
                        .param("gridId", "selGridTestOptionId")
                        .param("widths", "[{\"gridColumnId\":\"test-column\",\"width\":\"236px\"}]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.affectedRows").value(1))
                .andExpect(jsonPath("$.data.tableName").value("ReferenceDataOption"))
                .andExpect(jsonPath("$.data.gridId").value("selGridTestOptionId"))
                .andExpect(jsonPath("$.data.columns[0].width").value("236px"));
        mockMvc.perform(get("/api/reference-data/admin/table-columns/resolve.htm")
                        .param("tableName", "ReferenceDataOption")
                        .param("gridId", "selGridTestOptionId"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.columns[0].width").value("236px"));

        // 超出公共 Grid 边界的宽度必须在进入 DAO 前返回稳定业务错误。
        mockMvc.perform(post("/api/reference-data/admin/table-columns/save-widths.htm")
                        .param("tableName", "ReferenceDataOption")
                        .param("gridId", "selGridTestOptionId")
                        .param("widths", "[{\"gridColumnId\":\"test-column\",\"width\":\"40px\"}]"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("PAGE_EDITOR_COLUMN_WIDTH_OUT_OF_RANGE"));

        // 公共 getGridColumn 在同工程内直接复用配置 Service，不发送额外 HTTP。
        mockMvc.perform(get("/api/reference-data/admin/options/getGridColumn.htm")
                        .param("viewCode", "selGridTestOptionId")
                        .param("locale", "ja-JP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.source").value("REFERENCE_DATA_TABLE_COLUMN"))
                .andExpect(jsonPath("$.data.columns", hasSize(1)))
                .andExpect(jsonPath("$.data.columns[0].label").value("テスト列"));

        mockMvc.perform(post("/api/reference-data/admin/table-columns/update.htm")
                        .param("id", "101000")
                        .param("tableName", "ReferenceDataOption")
                        .param("gridId", "selGridTestOptionId")
                        .param("gridColumnId", "test-column")
                        .param("tableFieldName", "optionValue")
                        .param("labelZh", "测试表头")
                        .param("labelJa", "テスト列")
                        .param("labelEn", "Test column")
                        .param("width", "236px")
                        .param("cellRenderer", "text")
                        .param("cellIcon", "ri-list-check-3")
                        .param("cellIconVisible", "true")
                        .param("visible", "false")
                        .param("status", "1")
                        .param("sortnum", "1"))
                .andExpect(status().isOk())
                // 写响应原样回显请求值，紧接着的解析查询负责验证数据库布尔状态已真正生效。
                .andExpect(jsonPath("$.data.visible").value("false"));
        mockMvc.perform(get("/api/reference-data/admin/table-columns/resolve.htm")
                        .param("tableName", "ReferenceDataOption")
                        .param("gridId", "selGridTestOptionId"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.source").value("NOT_CONFIGURED"))
                .andExpect(jsonPath("$.data.columns", hasSize(0)));

        // 配置关闭后公共入口静默降级为真实字段名，不返回需要页面展示的错误提示。
        mockMvc.perform(get("/api/reference-data/admin/options/getGridColumn.htm")
                        .param("viewCode", "selGridTestOptionId")
                        .param("locale", "zh-CN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.source").value("DEFAULT_FIELD_NAME"))
                .andExpect(jsonPath("$.data.columns[?(@.field == 'optionValue')].label").value(hasItem("optionValue")));

        mockMvc.perform(post("/api/reference-data/admin/table-columns/delete.htm").param("id", "101000"))
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
