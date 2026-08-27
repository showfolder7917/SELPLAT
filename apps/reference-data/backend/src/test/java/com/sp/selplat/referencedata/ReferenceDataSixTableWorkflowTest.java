package com.sp.selplat.referencedata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.sequence.SequenceGeneratorImpl;
import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.capability.configuration.service.ReferenceDataConfigurationService;
import com.sp.selplat.referencedata.capability.configuration.controller.ReferenceDataConfigurationController;
import com.sp.selplat.referencedata.capability.configuration.service.impl.ReferenceDataConfigurationServiceImpl;
import com.sp.selplat.referencedata.capability.resourcequery.controller.ReferenceDataResourceQueryController;
import com.sp.selplat.referencedata.capability.workbenchnavigation.service.ReferenceDataWorkbenchNavigationService;
import com.sp.selplat.referencedata.capability.workbenchnavigation.controller.ReferenceDataWorkbenchNavigationController;
import com.sp.selplat.referencedata.referencedatacontrollayout.service.ReferenceDataControlLayoutService;
import com.sp.selplat.referencedata.referencedatatable.service.ReferenceDataTableService;
import com.sp.selplat.referencedata.referencedatatableelement.service.ReferenceDataTableElementService;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import com.sp.selplat.referencedata.referencedatatreenode.controller.ReferenceDataTreeNodeController;
import com.sp.selplat.referencedata.referencedatatype.service.ReferenceDataTypeService;
import com.sp.selplat.referencedata.referencedatatype.controller.ReferenceDataTypeController;
import com.sp.selplat.referencedata.referencedatawindow.service.ReferenceDataWindowService;
import com.sp.selplat.referencedata.common.util.migration.ReferenceDataSixTableMigration;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

/** 使用隔离内存库验证六张表共用发号、code 生成、关联查询和公共 CRUD 链。 */
@SpringBootTest(
        classes = ReferenceDataSixTableWorkflowTest.TestApplication.class,
        properties = {
            "reference-data.datasource.jdbc-url=jdbc:h2:mem:reference_data_six_table_workflow;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
            "reference-data.datasource.pool-name=ReferenceDataSixTableWorkflowPool",
            "spring.datasource.url=jdbc:h2:mem:reference_data_six_table_support;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false"
        })
@Import(SequenceGeneratorImpl.class)
class ReferenceDataSixTableWorkflowTest {

    @Autowired private ApplicationContext applicationContext;
    @Autowired private ReferenceDataTypeService typeService;
    @Autowired private ReferenceDataTreeNodeService treeNodeService;
    @Autowired private ReferenceDataTableService tableService;
    @Autowired private ReferenceDataTableElementService tableElementService;
    @Autowired private ReferenceDataControlLayoutService controlLayoutService;
    @Autowired private ReferenceDataWindowService windowService;
    @Autowired private ReferenceDataConfigurationService configurationService;
    @Autowired private ReferenceDataWorkbenchNavigationService navigationService;
    @Autowired private ReferenceDataConfigurationController configurationController;
    @Autowired private ReferenceDataWorkbenchNavigationController navigationController;
    @Autowired private ReferenceDataTreeNodeController treeNodeController;
    @Autowired private ReferenceDataTypeController typeController;
    @Autowired private ReferenceDataResourceQueryController resourceQueryController;
    @Autowired private ReferenceDataSixTableMigration sixTableMigration;
    @Autowired @Qualifier("referenceDataJdbcTemplate") private JdbcTemplate jdbcTemplate;

    /**
     * 验证六表新增分别走本表号段，且每条公开 code 的数字后缀等于本表 id。
     * 真实传参示例：依次新增 qa 类型、树节点、表格、表格列、页面控件和 Window。
     * 真实返回示例：六条 code 均以 {@code qa} 开头且页面配置能返回三类布局记录。
     * 异常或副作用示例：只写测试内存库；前端伪造的租户和操作员统一被服务端覆盖为 1。
     */
    @Test
    @SuppressWarnings("unchecked")
    void shouldCreateAndResolveAllSixBusinessTablesThroughExistingChain() {
        // Spring 必须真实创建六个表控制器，避免只测试 Service 却漏掉 HTTP 装配错误。
        for (String beanName : List.of(
                "referenceDataTypeController", "referenceDataTreeNodeController", "referenceDataTableController",
                "referenceDataTableElementController", "referenceDataControlLayoutController", "referenceDataWindowController")) {
            assertNotNull(applicationContext.getBean(beanName));
        }

        // PAGE 与真实下拉控件先建立；类型值创建共享选项组后由控件保存 optionSetCode。
        CommonParam control = params(Map.of(
                "projectCode", "qa", "pageCode", "bootstrap", "controlKind", "PAGE",
                "fieldName", "workflow",
                "sourceTableName", "ReferenceDataControlLayout", "layoutMode", "FLOW", "breakpoint", "DESKTOP"));
        Map<String, Object> savedControl = data(controlLayoutService.insert(control));
        assertAuditAndCode(savedControl, "page");
        String pageCode = String.valueOf(savedControl.get("code"));
        assertEquals(pageCode, savedControl.get("pageCode"));
        Map<String, Object> savedSearchControl = data(controlLayoutService.insert(params(Map.of(
                "projectCode", "qa", "pageCode", pageCode, "controlKind", "DROPDOWN",
                "sourceTableName", "ReferenceDataControlLayout", "layoutMode", "FLOW", "breakpoint", "DESKTOP"))));
        assertAuditAndCode(savedSearchControl, "control");
        assertEquals("PAGE", savedSearchControl.get("parentKind"));
        assertEquals(pageCode, savedSearchControl.get("parentCode"));

        // 类型记录和树节点分别使用自己表的主键号段；空 optionSetCode 由通用逻辑号段发放。
        CommonParam type = params(Map.of(
                "valueCode", "DROPDOWN",
                "nameZh", "工作流下拉框", "tenantId", 99, "lastOperateUserId", 88));
        Map<String, Object> savedType = data(typeService.insert(type));
        String typeCode = String.valueOf(savedType.get("code"));
        String optionSetCode = String.valueOf(savedType.get("optionSetCode"));
        assertTrue(optionSetCode.startsWith("optionSet"));
        jdbcTemplate.update("UPDATE ReferenceDataControlLayout SET optionSetCode=? WHERE id=?",
                optionSetCode, savedSearchControl.get("id"));
        assertAuditAndCode(savedType, "type");

        // 三个独立 Like 条件由 BaseDao 使用 AND 组合，任一父坐标不匹配都不能返回当前控件。
        CommonPageParam controlAndFilter = new CommonPageParam();
        controlAndFilter.putParam("codeLike", savedSearchControl.get("code"));
        controlAndFilter.putParam("parentCodeLike", pageCode);
        controlAndFilter.putParam("optionSetCodeLike", optionSetCode);
        assertEquals(1, controlLayoutService.getStore(controlAndFilter).getTotalCount());
        controlAndFilter.putParam("parentCodeLike", "page999999");
        assertEquals(0, controlLayoutService.getStore(controlAndFilter).getTotalCount());

        CommonParam node = params(Map.of(
                "projectCode", "qa", "pageCode", pageCode,
                "nodeValue", "ENABLED", "labelZh", "启用"));
        Map<String, Object> savedNode = data(treeNodeService.insert(node));
        assertAuditAndCode(savedNode, "treeNode");
        assertEquals("qa", savedNode.get("projectCode"));
        assertEquals(pageCode, savedNode.get("pageCode"));
        CommonParam childNode = params(Map.of(
                "projectCode", "qa", "pageCode", pageCode,
                "parentId", savedNode.get("id"), "nodeValue", "ENABLED_CHILD", "labelZh", "启用子项",
                "sortnum", 20));
        assertAuditAndCode(data(treeNodeService.insert(childNode)), "treeNode");
        Map<String, Object> root = (Map<String, Object>) treeNodeService
                .getNodes(String.valueOf(savedNode.get("code")), Map.of("locale", "zh-CN")).getData();
        assertEquals("ENABLED", root.get("value"));
        assertEquals(1, ((List<?>) root.get("children")).size());
        // 管理分页把 code 与 parentId 作为两个独立条件交给 BaseDao，条件并存时只允许 AND。
        CommonPageParam treeFilter = new CommonPageParam();
        treeFilter.putParam("parentId", savedNode.get("id"));
        treeFilter.putParam("status", "1");
        assertEquals(1, treeNodeService.getStore(treeFilter).getTotalCount());
        treeFilter.putParam("codeLike", savedNode.get("code"));
        assertEquals(0, treeNodeService.getStore(treeFilter).getTotalCount());
        CommonPageParam disabledTreeFilter = new CommonPageParam();
        disabledTreeFilter.putParam("status", "2");
        assertEquals(0, treeNodeService.getStore(disabledTreeFilter).getTotalCount());

        // 二级菜单通过 parentTypeCode 关联同一选项组中的父类型，与纯树节点表没有读写关系。
        Map<String, Object> menuType = data(typeService.insert(params(Map.of(
                "optionSetCode", optionSetCode, "valueCode", "CONTEXT_MENU",
                "parentTypeCode", typeCode,
                "nameZh", "工作流菜单"))));
        assertEquals("CONTEXT_MENU", menuType.get("valueCode"));
        assertEquals(typeCode, menuType.get("parentTypeCode"));
        CommonBusinessException windowChildError = assertThrows(CommonBusinessException.class,
                () -> controlLayoutService.insert(params(Map.of(
                        "projectCode", "qa", "pageCode", pageCode, "parentKind", "WINDOW",
                        "parentCode", "window999999", "controlKind", "FILTER",
                        "sourceTableName", "ReferenceDataControlLayout", "layoutMode", "FLOW",
                        "breakpoint", "DESKTOP"))));
        assertEquals("REFERENCE_DATA_WINDOW_CHILD_FORBIDDEN", windowChildError.getErrorCode());
        Map<String, Object> savedBlankParent = data(controlLayoutService.insert(params(Map.of(
                "projectCode", "qa", "pageCode", pageCode, "parentKind", "", "parentCode", "",
                "controlKind", "BUTTON", "sourceTableName", "ReferenceDataControlLayout",
                "layoutMode", "FLOW", "breakpoint", "DESKTOP"))));
        assertEquals("PAGE", savedBlankParent.get("parentKind"));
        assertEquals(pageCode, savedBlankParent.get("parentCode"));

        // 表格定义是表格元素的唯一父级，页面公开坐标只保存自动生成的 code。
        CommonParam table = params(Map.of(
                "projectCode", "qa", "pageCode", pageCode, "gridId", "selGridReferenceDataManagementId",
                "sourceTableName", "ReferenceDataType", "nameZh", "测试表格"));
        Map<String, Object> savedTable = data(tableService.insert(table));
        long tableId = number(savedTable.get("id"));
        assertAuditAndCode(savedTable, "table");

        CommonParam element = params(Map.ofEntries(
                Map.entry("projectCode", "qa"), Map.entry("tableId", tableId), Map.entry("viewCode", "TYPE"),
                Map.entry("elementType", "COLUMN"), Map.entry("fieldName", "nameZh"),
                Map.entry("secondaryFieldName", "nameEn"), Map.entry("labelZh", "中文名称"),
                Map.entry("labelJa", "中国語名"), Map.entry("labelEn", "Chinese name"),
                Map.entry("width", "180px"), Map.entry("icon", "ri-translate")));
        Map<String, Object> savedElement = data(tableElementService.insert(element));
        assertAuditAndCode(savedElement, "tableElement");
        Map<String, Object> secondElement = data(tableElementService.insert(params(Map.of(
                "projectCode", "qa", "tableId", tableId, "viewCode", "TYPE", "elementType", "COLUMN",
                "fieldName", "status", "labelZh", "状态", "width", "120px"))));
        assertAuditAndCode(secondElement, "tableElement");
        assertEquals("中国語名", configurationService.resolveGridColumns(
                "ReferenceDataType", String.valueOf(savedTable.get("code")), "ja-JP").get(0).get("label"));
        assertEquals("Chinese name", configurationService.resolveGridColumns(
                "ReferenceDataType", String.valueOf(savedTable.get("code")), "en-US").get(0).get("label"));
        assertEquals("中文名称", configurationService.resolveGridColumns(
                "ReferenceDataType", String.valueOf(savedTable.get("code")), null).get(0).get("label"));
        assertEquals("中文名称", configurationService.resolveGridColumns(
                "ReferenceDataType", String.valueOf(savedTable.get("code")), "zh-CN").get(0).get("label"));

        // 普通业务表不进入六表视图映射，通过 sourceTableName 校验后统一读取 DEFAULT 表头。
        Map<String, Object> businessPage = data(controlLayoutService.insert(params(Map.of(
                "projectCode", "japanese", "pageCode", "bootstrap", "controlKind", "PAGE",
                "fieldName", "n2-blue-book-question", "sourceTableName", "ReferenceDataControlLayout",
                "layoutMode", "FLOW", "breakpoint", "DESKTOP"))));
        Map<String, Object> businessTable = data(tableService.insert(params(Map.of(
                "projectCode", "japanese", "pageCode", businessPage.get("pageCode"),
                "sourceTableName", "JapaneseN2BlueBookQuestion", "gridId", "selGridJapaneseN2BlueBookQuestionId",
                "nameZh", "N2 题目表格"))));
        data(tableElementService.insert(params(Map.of(
                "projectCode", "japanese", "tableId", businessTable.get("id"), "viewCode", "DEFAULT",
                "elementType", "COLUMN", "fieldName", "questionText", "labelZh", "题干",
                "labelJa", "問題文", "labelEn", "Question", "width", "360px"))));
        assertEquals("問題文", configurationService.resolveGridColumns(
                "JapaneseN2BlueBookQuestion", String.valueOf(businessTable.get("code")), "ja-JP").get(0).get("label"));
        assertTrue(configurationService.resolveGridColumns(
                "AnotherBusinessTable", String.valueOf(businessTable.get("code")), "ja-JP").isEmpty());

        CommonParam window = params(Map.of(
                "projectCode", "qa", "pageCode", pageCode, "nameZh", "测试窗口",
                "width", "720px", "height", "480px", "positionMode", "CENTER", "breakpoint", "DESKTOP"));
        Map<String, Object> savedWindow = data(windowService.insert(window));
        assertAuditAndCode(savedWindow, "window");

        // 六表 code 均可由统一查询定位来源表，页面读取同时返回控件、表格元素和 Window。
        CommonPageParam codeFilter = new CommonPageParam();
        codeFilter.putParam("code", savedElement.get("code"));
        assertEquals(0, typeService.getStore(codeFilter).getTotalCount());
        assertEquals(0, treeNodeService.getStore(codeFilter).getTotalCount());
        assertEquals(0, tableService.getStore(codeFilter).getTotalCount());
        assertEquals(1, tableElementService.getStore(codeFilter).getTotalCount());
        assertEquals(0, controlLayoutService.getStore(codeFilter).getTotalCount());
        assertEquals(0, windowService.getStore(codeFilter).getTotalCount());
        assertEquals("ReferenceDataTableElement",
                data(configurationService.getByCode(String.valueOf(savedElement.get("code")))).get("sourceTable"));
        jdbcTemplate.update("INSERT INTO ReferenceDataWindow "
                + "(id,code,projectCode,pageCode,nameZh,width,height) VALUES (?,?,?,?,?,?,?)",
                999990L, savedElement.get("code"), "qa", pageCode, "重复 code", "400px", "300px");
        assertBusiness("REFERENCE_DATA_CODE_DUPLICATE",
                () -> configurationService.getByCode(String.valueOf(savedElement.get("code"))));
        jdbcTemplate.update("DELETE FROM ReferenceDataWindow WHERE id=999990");
        Map<String, Object> page = data(configurationService.getPageConfiguration(pageCode));
        List<?> pageControls = (List<?>) page.get("controls");
        assertEquals(3, pageControls.size());
        assertTrue(pageControls.stream().map(Map.class::cast)
                .noneMatch(layoutRecord -> "WINDOW".equals(String.valueOf(layoutRecord.get("parentKind")))));
        assertEquals(2, ((List<?>) page.get("tableElements")).size());
        assertEquals(1, ((List<?>) page.get("windows")).size());
        assertEquals(2, ((List<?>) page.get("treeNodes")).size());
        assertEquals(savedTable.get("code"), ((Map<?, ?>) page.get("table")).get("code"));
        assertEquals(pageCode,
                data(configurationService.getPageConfiguration("qa", "workflow")).get("pageCode"));
        assertEquals("", data(configurationService.getPageConfiguration("qa", "not-registered")).get("pageCode"));
        assertEquals(5, ((List<?>) data(navigationService.navigation()).get("modules")).size());

        // 直接经过三个专用 Controller 覆盖实际序列化入口，确认六表能力没有只停留在 Service 层。
        assertTrue(navigationController.navigation().contains("tables-to-elements"));
        assertTrue(configurationController.getPageEditorCapability().isSuccess());
        assertEquals("ReferenceDataTableElement",
                data(configurationController.getByCode(String.valueOf(savedElement.get("code")))).get("sourceTable"));
        assertEquals(pageCode, data(configurationController.getPageConfiguration(pageCode)).get("pageCode"));
        assertEquals(pageCode,
                data(configurationController.getPageConfiguration("qa", "workflow")).get("pageCode"));
        assertTrue(configurationController.savePageConfiguration(pageCode, Map.of(
                "baseVersion", 0,
                "controls", List.of(Map.of(
                        "code", savedControl.get("code"), "width", "100%", "height", "auto",
                        "orderNo", 2, "wrap", false)),
                "tableElements", List.of(Map.of(
                        "code", savedElement.get("code"), "width", "220px", "visible", true, "sortnum", 3)),
                "windows", List.of(Map.of(
                        "code", savedWindow.get("code"), "width", "760px", "height", "520px",
                        "positionMode", "CUSTOM", "x", 10, "y", 20)))).isSuccess());
        assertBusiness("REFERENCE_DATA_PAGE_CODE_MISMATCH", () -> configurationService.savePageConfiguration(
                "missing999999", Map.of("controls", List.of(Map.of(
                        "code", savedControl.get("code"), "width", "200px")))));
        assertBusiness("REFERENCE_DATA_PAGE_CODE_MISMATCH", () -> configurationService.savePageConfiguration(
                "missing999999", Map.of("tableElements", List.of(Map.of(
                        "code", savedElement.get("code"), "width", "200px")))));
        assertTrue(resourceQueryController.getType(typeCode).contains("DROPDOWN"));
        String roleTypesZh = resourceQueryController.getOptions(
                "optionSet103006", Map.of("locale", "zh-CN"));
        assertTrue(roleTypesZh.contains("ENGINEER"));
        assertTrue(roleTypesZh.contains("工程师"));
        assertTrue(roleTypesZh.contains("REVIEWER"));
        assertTrue(roleTypesZh.contains("审核员"));
        assertTrue(resourceQueryController.getOptions(
                "optionSet103006", Map.of("locale", "ja-JP")).contains("エンジニア"));
        assertTrue(resourceQueryController.getOptions(
                "optionSet103006", Map.of("locale", "en-US")).contains("Reviewer"));
        assertTrue(resourceQueryController.getNodes(String.valueOf(savedNode.get("code")), Map.of("locale", "zh-CN"))
                .contains("ENABLED_CHILD"));
        assertTrue(treeNodeController.getStore(new CommonPageParam()).contains("ENABLED"));
        String treeColumns = treeNodeController.getGridColumn(
                String.valueOf(savedTable.get("code")), "zh-CN");
        assertTrue(treeColumns.contains("\"tableCode\":\"" + savedTable.get("code") + "\""));
        assertTrue(treeColumns.contains("\"field\":\"projectCode\""));
        assertFalse(treeColumns.contains("\"viewCode\""));
        String typeColumns = typeController.getGridColumnByTableCode(
                String.valueOf(savedTable.get("code")), "zh-CN");
        assertTrue(typeColumns.contains("中文名称"));
        assertTrue(typeColumns.contains("\"tableCode\":\"" + savedTable.get("code") + "\""));
        assertFalse(typeColumns.contains("\"viewCode\""));
        CommonParam controllerNode = params(Map.of(
                "projectCode", "qa", "pageCode", pageCode,
                "nodeValue", "DISABLED", "labelZh", "停用"));
        assertTrue(treeNodeController.create(controllerNode).contains("treeNode"));
        Long controllerNodeId = jdbcTemplate.queryForObject(
                "SELECT id FROM ReferenceDataTreeNode WHERE nodeValue='DISABLED'", Long.class);
        assertTrue(treeNodeController.update(params(Map.of(
                        "id", controllerNodeId, "labelZh", "已停用")))
                .contains("已停用"));
        assertTrue(treeNodeController.delete(params(Map.of("id", controllerNodeId))).contains("\"status\":0"));

        // 公共 CRUD 的列表、详情、更新和假删除继续由现有 BaseService 链完成。
        assertTrue(tableService.getStore(new CommonPageParam()).getTotalCount() >= 1);
        assertEquals(tableId, number(data(tableService.getById(params(Map.of("id", tableId)))).get("id")));
        CommonParam update = params(Map.of("id", tableId, "nameZh", "已更新表格"));
        assertEquals("已更新表格", data(tableService.update(update)).get("nameZh"));
        assertEquals(0, data(windowService.delete(params(Map.of("id", savedWindow.get("id"))))).get("status"));
    }

    /**
     * 验证查询工具栏把每个可见查询元素登记为可独立保存的真实控件。
     * 真实传参示例：新建 reference-data 页面后运行查询工具栏幂等补齐两次。
     * 真实返回示例：六种结构字段、共享查询按钮、范围、状态与重置共十条记录且没有旧关键词。
     * 异常或副作用示例：迁移缺少元素、产生重复记录或残留中间 search 组时断言失败；方法只写测试内存库。
     */
    @Test
    void shouldRegisterEveryQueryToolbarElement() {
        Map<String, Object> page = data(controlLayoutService.insert(params(Map.of(
                "projectCode", "reference-data", "pageCode", "bootstrap", "controlKind", "PAGE",
                "sourceTableName", "ReferenceDataControlLayout", "layoutMode", "FLOW",
                "breakpoint", "DESKTOP"))));
        String pageCode = String.valueOf(page.get("pageCode"));
        ReflectionTestUtils.invokeMethod(sixTableMigration, "normalizeQueryToolbarControls");
        List<String> fieldNames = jdbcTemplate.queryForList(
                "SELECT fieldName FROM ReferenceDataControlLayout WHERE projectCode='reference-data' "
                        + "AND pageCode=? AND parentKind='TOOLBAR' AND status<>0 ORDER BY orderNo",
                String.class, pageCode);
        ReflectionTestUtils.invokeMethod(sixTableMigration, "normalizeQueryToolbarControls");
        assertEquals(List.of("code", "parentCode", "parentTypeCode", "parentId", "tableId", "optionSetCode",
                "submit", "controlKind", "status", "reset"), fieldNames);
        assertEquals(0, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataControlLayout WHERE pageCode=? AND fieldName='search'",
                Integer.class, pageCode));
        assertEquals(0, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataControlLayout WHERE parentKind='WINDOW'",
                Integer.class));
    }

    /**
     * 验证树节点与页面配置的非法坐标、空结果和版本保护分支。
     * 真实传参示例：缺失树根、错误 code、错误版本和越权布局字段。
     * 真实返回示例：每个请求都抛出对应 CommonBusinessException，不产生部分更新。
     * 异常或副作用示例：全部使用测试内存库；断言失败才终止测试。
     */
    @Test
    void shouldRejectInvalidTreeAndPageConfigurationInputs() {
        assertBusiness("REFERENCE_DATA_TREE_PAGE_CODE_REQUIRED", () -> treeNodeService.insert(params(Map.of(
                "projectCode", "qa", "nodeValue", "MISSING_PAGE", "labelZh", "缺少页面"))));
        assertBusiness("REFERENCE_DATA_PROJECT_CODE_INVALID", () -> treeNodeService.insert(params(Map.of(
                "pageCode", "page101000", "nodeValue", "MISSING_PROJECT", "labelZh", "缺少项目"))));
        assertBusiness("REFERENCE_DATA_ADMIN_REQUIRED",
                () -> new NonAdminConfigurationService(
                        typeService, treeNodeService, tableService, tableElementService, windowService)
                        .savePageConfiguration("missing999999", Map.of()));
        assertBusiness("REFERENCE_DATA_TREE_ROOT_NOT_FOUND",
                () -> treeNodeService.getNodes("missing999999", Map.of()));
        assertBusiness("REFERENCE_DATA_TREE_ROOT_NOT_FOUND",
                () -> treeNodeService.getNodes(null, Map.of()));
        assertBusiness("REFERENCE_DATA_TYPE_CODE_NOT_FOUND",
                () -> typeService.getTypeByCode("missing999999"));
        assertBusiness("REFERENCE_DATA_TYPE_CODE_NOT_FOUND",
                () -> typeService.getTypeByCode(null));
        assertBusiness("REFERENCE_DATA_OPTION_SET_CODE_INVALID",
                () -> typeService.getOptionsByOptionSetCode("ROLE_TYPE", Map.of()));
        // 缺失选项组 Code 与格式错误使用同一稳定业务错误，且不得进入数据库查询。
        assertBusiness("REFERENCE_DATA_OPTION_SET_CODE_INVALID",
                () -> typeService.getOptionsByOptionSetCode(null, Map.of()));
        assertTrue(resourceQueryController.getOptions(
                "optionSet999999", Map.of("locale", "zh-CN")).contains("\"data\":[]"));
        Map<String, Object> negativePage = data(controlLayoutService.insert(params(Map.of(
                "projectCode", "qa", "pageCode", "bootstrap", "controlKind", "PAGE",
                "sourceTableName", "ReferenceDataControlLayout", "layoutMode", "FLOW", "breakpoint", "DESKTOP"))));
        Map<String, Object> negativeTypeControl = data(controlLayoutService.insert(params(Map.of(
                "projectCode", "qa", "pageCode", negativePage.get("code"), "controlKind", "DROPDOWN",
                "sourceTableName", "ReferenceDataControlLayout", "layoutMode", "FLOW", "breakpoint", "DESKTOP"))));
        Map<String, Object> negativeRootType = data(typeService.insert(params(Map.of(
                "valueCode", "DROPDOWN",
                "nameZh", "负向下拉"))));
        String negativeOptionSetCode = String.valueOf(negativeRootType.get("optionSetCode"));
        assertBusiness("REFERENCE_DATA_TYPE_PARENT_NOT_FOUND", () -> typeService.insert(params(Map.of(
                "optionSetCode", negativeOptionSetCode, "valueCode", "MISSING_PARENT",
                "parentTypeCode", "type999999", "nameZh", "不存在的父级"))));
        assertNotNull(treeNodeService.getStore(null));
        CommonPageParam emptyTreeFilter = new CommonPageParam();
        assertNotNull(treeNodeService.getStore(emptyTreeFilter));
        Map<String, Object> cycleRoot = data(treeNodeService.insert(params(Map.of(
                "projectCode", "qa", "pageCode", negativePage.get("code"),
                "nodeValue", "CYCLE_ROOT", "labelZh", "循环根"))));
        Map<String, Object> cycleChild = data(treeNodeService.insert(params(Map.of(
                "projectCode", "qa", "pageCode", negativePage.get("code"),
                "parentId", cycleRoot.get("id"), "nodeValue", "CYCLE_CHILD", "labelZh", "循环子项"))));
        jdbcTemplate.update("UPDATE ReferenceDataTreeNode SET parentId=? WHERE id=?",
                cycleChild.get("id"), cycleRoot.get("id"));
        assertBusiness("REFERENCE_DATA_TREE_CYCLE", () -> treeNodeService.getNodes(
                String.valueOf(cycleRoot.get("code")), Map.of()));
        jdbcTemplate.update("UPDATE ReferenceDataTreeNode SET parentId=NULL WHERE id=?", cycleRoot.get("id"));
        Map<String, Object> negativeChildType = data(typeService.insert(params(Map.of(
                "optionSetCode", negativeOptionSetCode, "valueCode", "PANEL_MENU",
                "parentTypeCode", negativeRootType.get("code"),
                "nameZh", "负向菜单"))));
        assertBusiness("REFERENCE_DATA_TYPE_PARENT_CYCLE", () -> typeService.update(params(Map.of(
                "id", negativeRootType.get("id"), "optionSetCode", negativeOptionSetCode,
                "valueCode", "DROPDOWN", "parentTypeCode", negativeChildType.get("code"),
                "nameZh", "循环父级"))));
        assertBusiness("REFERENCE_DATA_TYPE_PARENT_OPTION_SET_MISMATCH", () -> typeService.insert(params(Map.of(
                "optionSetCode", "optionSet999999", "valueCode", "CROSS_OPTION_SET",
                "parentTypeCode", negativeRootType.get("code"), "nameZh", "跨选项组父级"))));
        assertBusiness("REFERENCE_DATA_CODE_INVALID", () -> configurationService.getByCode("bad-code"));
        assertBusiness("REFERENCE_DATA_CODE_NOT_FOUND", () -> configurationService.getByCode("missing999999"));
        assertBusiness("REFERENCE_DATA_CODE_INVALID", () -> configurationService.getPageConfiguration(null));
        assertTrue(configurationService.savePageConfiguration("missing999999", null).isSuccess());
        assertTrue(configurationService.savePageConfiguration("missing999999", Map.of(
                "controls", List.of(Map.of("code", "missing999999")),
                "tableElements", List.of(Map.of("code", "missing999999")),
                "windows", List.of(Map.of("code", "missing999999")))).isSuccess());
        assertBusiness("REFERENCE_DATA_VERSION_INVALID", () -> configurationService.savePageConfiguration(
                "missing999999", Map.of("baseVersion", "bad")));
        assertBusiness("REFERENCE_DATA_PAGE_VERSION_CONFLICT", () -> configurationService.savePageConfiguration(
                "missing999999", Map.of("baseVersion", 1)));
        assertBusiness("REFERENCE_DATA_CHANGE_SET_INVALID", () -> configurationService.savePageConfiguration(
                "missing999999", Map.of("controls", "bad")));
        assertBusiness("REFERENCE_DATA_CHANGE_SET_INVALID", () -> configurationService.savePageConfiguration(
                "missing999999", Map.of("controls", List.of("bad"))));
        assertBusiness("REFERENCE_DATA_LAYOUT_FIELD_INVALID", () -> configurationService.savePageConfiguration(
                "missing999999", Map.of("controls", List.of(Map.of("code", "missing999999", "badField", 1)))));
        assertBusiness("REFERENCE_DATA_LAYOUT_VALUE_INVALID", () -> configurationService.savePageConfiguration(
                "missing999999", Map.of("controls", List.of(Map.of("code", "missing999999", "width", "calc(1px)")))));
        Map<String, Object> nullWidth = new LinkedHashMap<>();
        nullWidth.put("code", "missing999999");
        nullWidth.put("width", null);
        assertBusiness("REFERENCE_DATA_PAGE_CODE_MISMATCH", () -> configurationService.savePageConfiguration(
                "missing999999", Map.of("controls", List.of(nullWidth))));
        assertBusiness("REFERENCE_DATA_PAGE_CODE_MISMATCH", () -> configurationService.savePageConfiguration(
                "missing999999", Map.of("controls", List.of(Map.of("code", "missing999999", "width", "100px")))));
        assertBusiness("REFERENCE_DATA_PAGE_CODE_MISMATCH", () -> configurationService.savePageConfiguration(
                "missing999999", Map.of("tableElements", List.of(Map.of("code", "missing999999", "width", "100px")))));
        assertBusiness("REFERENCE_DATA_PAGE_CODE_MISMATCH", () -> configurationService.savePageConfiguration(
                "missing999999", Map.of("windows", List.of(Map.of("code", "missing999999", "height", "100px")))));
        assertTrue(configurationService.resolveGridColumns(null, null, null).isEmpty());
        assertTrue(configurationService.resolveGridColumns("ReferenceDataType", null, "zh-CN").isEmpty());
        assertTrue(configurationService.resolveGridColumns("UnknownTable", "table999999", "zh-CN").isEmpty());
        assertTrue(configurationService.resolveGridColumns(
                "ReferenceDataType", "table999999", "zh-CN").isEmpty());
        assertTrue(data(configurationService.getPageConfiguration("missing999999"))
                .get("tableElements") instanceof List<?>);
    }

    /**
     * 验证配置编排的分页、重复记录和不可达注册表保护边界。
     * 真实传参示例：模拟 1001 条分页结果、两条唯一查询结果以及未知配置表名。
     * 真实返回示例：分页合并 1001 条；重复与未知表名分别抛出稳定异常。
     * 异常或副作用示例：只调用独立 mock Service 和私有纯编排方法，不访问或修改数据库。
     */
    @Test
    @SuppressWarnings("unchecked")
    void shouldCoverConfigurationPaginationAndDefensiveBoundaries() {
        BaseService pagedService = mock(BaseService.class);
        when(pagedService.getStore(any(CommonPageParam.class))).thenAnswer(invocation -> {
            CommonPageParam query = invocation.getArgument(0);
            CommonPageResult page = new CommonPageResult();
            page.setRecords(query.getPageNo() == 1
                    ? java.util.stream.IntStream.range(0, 1000)
                            .mapToObj(index -> Map.<String, Object>of("id", index + 1L)).toList()
                    : List.of(Map.of("id", 1001L)));
            page.setTotalCount(1001);
            page.setPageNo(query.getPageNo());
            page.setPageSize(query.getPageSize());
            return page;
        });
        List<Map<String, Object>> records = ReflectionTestUtils.invokeMethod(
                configurationService, "records", pagedService, Map.of("statusIn", List.of(1, 2)));
        assertNotNull(records);
        assertEquals(1001, records.size());

        BaseService duplicateService = mock(BaseService.class);
        CommonPageResult duplicatePage = new CommonPageResult();
        duplicatePage.setRecords(List.of(Map.of("id", 1L), Map.of("id", 2L)));
        duplicatePage.setTotalCount(2);
        duplicatePage.setPageNo(1);
        duplicatePage.setPageSize(1000);
        when(duplicateService.getStore(any(CommonPageParam.class))).thenReturn(duplicatePage);
        assertBusiness("REFERENCE_DATA_RECORD_DUPLICATE", () -> ReflectionTestUtils.invokeMethod(
                configurationService, "singleRecord", duplicateService, Map.of("code", "table999999")));

        assertThrows(IllegalArgumentException.class, () -> ReflectionTestUtils.invokeMethod(
                configurationService, "serviceFor", "UnknownTable"));
        assertEquals(BigDecimal.ZERO,
                ReflectionTestUtils.invokeMethod(configurationService, "decimalValue", new Object[] {null}));
        assertEquals(BigDecimal.ZERO,
                ReflectionTestUtils.invokeMethod(configurationService, "decimalValue", "not-a-number"));
    }

    /**
     * 把测试字段映射转换为生产 Service 接收的公共动态参数。
     * 真实传参示例：{@code {"id":101000,"nameZh":"测试表格"}}。
     * 真实返回示例：返回可由 BaseService 读取相同字段的 CommonParam。
     * 异常或副作用示例：输入 Map 为空时返回空参数；方法不修改原 Map。
     *
     * @param values 测试业务字段
     * @return 包含相同字段的公共参数
     */
    private CommonParam params(Map<String, ?> values) {
        CommonParam result = new CommonParam();
        values.forEach(result::putParam);
        return result;
    }

    /**
     * 断言公共结果成功并取得其中的业务字段映射。
     * 真实传参示例：新增表格返回的成功 CommonResult。
     * 真实返回示例：{@code {"id":101000,"code":"qa101000"}}。
     * 异常或副作用示例：结果失败或 data 不是 Map 时测试立即失败；方法不修改结果。
     *
     * @param result 生产 Service 返回的公共结果
     * @return 业务字段映射
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> data(CommonResult result) {
        assertTrue(result.isSuccess());
        return (Map<String, Object>) result.getData();
    }

    /**
     * 把 H2 返回的任意 Number 主键统一转换为 long。
     * 真实传参示例：Integer 或 Long 类型的 {@code 101000}。
     * 真实返回示例：返回 {@code 101000L}。
     * 异常或副作用示例：非数字值抛出 ClassCastException；方法没有写入副作用。
     *
     * @param value 数据库数字值
     * @return long 数字
     */
    private long number(Object value) {
        return ((Number) value).longValue();
    }

    /**
     * 验证 code 使用对象类型前缀，且客户端身份字段已被后台覆盖。
     * 真实传参示例：新增结果 {@code {"code":"type101000","tenantId":1}} 与前缀 {@code type}。
     * 真实返回示例：全部断言通过后正常返回。
     * 异常或副作用示例：code 或审计字段错误时测试失败；方法不修改记录。
     *
     * @param record 新增后的数据库事实
     * @param codePrefix 预期对象类型前缀
     */
    private void assertAuditAndCode(Map<String, Object> record, String codePrefix) {
        assertEquals(codePrefix + number(record.get("id")), String.valueOf(record.get("code")));
        assertEquals(1L, number(record.get("tenantId")));
        assertEquals(1L, number(record.get("lastOperateUserId")));
    }

    /**
     * 断言业务动作抛出指定稳定错误编码。
     * 真实传参示例：期望 {@code REFERENCE_DATA_CODE_INVALID} 和查询非法 code 的动作。
     * 真实返回示例：异常编码相同后断言通过。
     * 异常或副作用示例：动作不抛异常或编码不同时测试失败；本方法不修改数据库。
     *
     * @param expectedCode 预期错误编码
     * @param action 触发真实校验的动作
     */
    private void assertBusiness(String expectedCode, Runnable action) {
        CommonBusinessException exception = assertThrows(CommonBusinessException.class, action::run);
        assertEquals(expectedCode, exception.getErrorCode());
    }

    /** 仅用于覆盖权限拒绝分支，真实数据库访问仍委托生产配置服务。 */
    private static final class NonAdminConfigurationService extends ReferenceDataConfigurationServiceImpl {

        /**
         * 创建使用测试内存库的非管理员配置服务。
         * 真实传参示例：测试上下文中的五个引用数据业务 Service。
         * 真实返回示例：返回一个仅权限结论不同的生产配置服务实例。
         * 异常或副作用示例：模板为空时后续数据库访问失败；构造过程不写数据库。
         *
         * @param typeService 类型业务 Service
         * @param treeNodeService 树节点业务 Service
         * @param tableService Grid 业务 Service
         * @param tableElementService Grid 元素业务 Service
         * @param windowService Window 业务 Service
         */
        private NonAdminConfigurationService(
                ReferenceDataTypeService typeService,
                ReferenceDataTreeNodeService treeNodeService,
                ReferenceDataTableService tableService,
                ReferenceDataTableElementService tableElementService,
                ReferenceDataWindowService windowService) {
            super(typeService, treeNodeService, tableService, tableElementService, windowService);
        }

        /**
         * 固定模拟普通操作员，验证页面保存拒绝分支。
         * 真实传参示例：无参数调用。
         * 真实返回示例：固定返回 false。
         * 异常或副作用示例：不读取身份 Cookie 且不修改数据库。
         *
         * @return false，表示当前测试身份不是管理员
         */
        @Override
        protected boolean isAdmin() {
            return false;
        }
    }

    /** 测试专用最小 Spring Boot 入口扫描引用数据和公共 Web 组件。 */
    @SpringBootApplication(scanBasePackages = {"com.sp.selplat.referencedata", "com.sp.selplat.common.web"})
    static class TestApplication {
    }
}
