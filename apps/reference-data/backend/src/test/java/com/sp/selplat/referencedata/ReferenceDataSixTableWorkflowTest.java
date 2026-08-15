package com.sp.selplat.referencedata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.sequence.SequenceGeneratorImpl;
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
import com.sp.selplat.referencedata.referencedatawindow.service.ReferenceDataWindowService;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;

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
    @Autowired private ReferenceDataResourceQueryController resourceQueryController;
    @Autowired @Qualifier("referenceDataJdbcTemplate") private JdbcTemplate jdbcTemplate;

    /**
     * 验证六表新增全部走共享号段并生成互不重复的公开 code。
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

        // 类型先取得全局对象主键，后续树节点通过 typeId 解析所属项目并自动生成 code。
        CommonParam type = params(Map.of(
                "projectCode", "qa", "resourceCode", "workflow-options", "type", "DROPDOWN",
                "nameZh", "工作流选项", "tenantId", 99, "lastOperateUserId", 88));
        Map<String, Object> savedType = data(typeService.insert(type));
        long typeId = number(savedType.get("id"));
        String typeCode = String.valueOf(savedType.get("code"));
        assertAuditAndCode(savedType, "type");

        CommonParam node = params(Map.of(
                "typeId", typeId, "nodeCode", "enabled", "nodeValue", "ENABLED", "labelZh", "启用",
                "projectCode", "forged"));
        Map<String, Object> savedNode = data(treeNodeService.insert(node));
        assertAuditAndCode(savedNode, "dropdownOption");
        CommonParam childNode = params(Map.of(
                "typeId", typeId, "parentId", savedNode.get("id"), "nodeCode", "enabled-child",
                "nodeValue", "ENABLED_CHILD", "labelZh", "启用子项", "disabled", true,
                "sortnum", 20, "attributesJson", "{\"level\":2,\"groupCode\":\"state\"}"));
        assertAuditAndCode(data(treeNodeService.insert(childNode)), "dropdownOption");
        List<Map<String, Object>> options = (List<Map<String, Object>>) treeNodeService
                .getNodes(typeCode, Map.of("locale", "zh-CN")).getData();
        assertEquals("ENABLED", options.get(0).get("value"));
        assertEquals("state", options.get(1).get("groupCode"));
        assertEquals(true, options.get(1).get("disabled"));

        Map<String, Object> treeType = data(typeService.insert(params(Map.of(
                "projectCode", "qa", "resourceCode", "workflow-tree", "type", "TREE",
                "nameZh", "工作流树"))));
        Map<String, Object> treeRoot = data(treeNodeService.insert(params(Map.of(
                "typeId", treeType.get("id"), "nodeCode", "root", "nodeValue", "ROOT", "labelZh", "根"))));
        data(treeNodeService.insert(params(Map.of(
                "typeId", treeType.get("id"), "parentId", treeRoot.get("id"), "nodeCode", "child",
                "nodeValue", "CHILD", "labelZh", "子节点"))));
        List<Map<String, Object>> treeNodes = (List<Map<String, Object>>) treeNodeService
                .getNodes(String.valueOf(treeType.get("code")), Map.of("locale", "zh-CN")).getData();
        assertEquals("root", treeNodes.get(0).get("id"));

        // 右键菜单与下拉选项共用 Type + TreeNode 模型，专用字段直接来自树节点固定列。
        Map<String, Object> menuType = data(typeService.insert(params(Map.of(
                "projectCode", "qa", "resourceCode", "workflow-menu", "type", "CONTEXT_MENU",
                "nameZh", "工作流菜单"))));
        Map<String, Object> menuRoot = data(treeNodeService.insert(params(Map.of(
                "typeId", menuType.get("id"), "nodeCode", "refresh", "nodeValue", "REFRESH",
                "labelZh", "刷新", "icon", "ri-refresh-line", "commandCode", "reload"))));
        data(treeNodeService.insert(params(Map.of(
                "typeId", menuType.get("id"), "parentId", menuRoot.get("id"), "nodeCode", "force-refresh",
                "nodeValue", "FORCE_REFRESH", "labelZh", "强制刷新", "disabled", true))));
        List<Map<String, Object>> menuItems = (List<Map<String, Object>>) treeNodeService
                .getNodes(String.valueOf(menuType.get("code")), Map.of("locale", "zh-CN")).getData();
        assertEquals("reload", menuItems.get(0).get("command"));
        assertEquals(1, ((List<?>) menuItems.get(0).get("children")).size());

        // PAGE 根通过现有新增链生成 code，并由服务端强制让 pageCode 等于自身 code。
        CommonParam control = params(Map.of(
                "projectCode", "qa", "pageCode", "bootstrap", "controlKind", "PAGE",
                "sourceTableName", "ReferenceDataControlLayout", "layoutMode", "FLOW", "breakpoint", "DESKTOP"));
        Map<String, Object> savedControl = data(controlLayoutService.insert(control));
        assertAuditAndCode(savedControl, "page");
        String pageCode = String.valueOf(savedControl.get("code"));
        assertEquals(pageCode, savedControl.get("pageCode"));
        Map<String, Object> savedSearchControl = data(controlLayoutService.insert(params(Map.of(
                "projectCode", "qa", "pageCode", pageCode, "controlKind", "SEARCH",
                "sourceTableName", "ReferenceDataControlLayout", "layoutMode", "FLOW", "breakpoint", "DESKTOP"))));
        assertAuditAndCode(savedSearchControl, "control");
        assertEquals("PAGE", savedSearchControl.get("parentKind"));
        assertEquals(pageCode, savedSearchControl.get("parentCode"));
        Map<String, Object> savedWindowChild = data(controlLayoutService.insert(params(Map.of(
                "projectCode", "qa", "pageCode", pageCode, "parentKind", "WINDOW",
                "parentCode", "window999999", "controlKind", "FILTER",
                "sourceTableName", "ReferenceDataControlLayout", "layoutMode", "FLOW", "breakpoint", "DESKTOP"))));
        assertEquals("WINDOW", savedWindowChild.get("parentKind"));
        assertEquals("window999999", savedWindowChild.get("parentCode"));
        Map<String, Object> savedBlankParent = data(controlLayoutService.insert(params(Map.of(
                "projectCode", "qa", "pageCode", pageCode, "parentKind", "", "parentCode", "",
                "controlKind", "BUTTON", "sourceTableName", "ReferenceDataControlLayout",
                "layoutMode", "FLOW", "breakpoint", "DESKTOP"))));
        assertEquals("PAGE", savedBlankParent.get("parentKind"));
        assertEquals(pageCode, savedBlankParent.get("parentCode"));

        // 表格定义是表格元素的唯一父级，页面公开坐标只保存自动生成的 code。
        CommonParam table = params(Map.of(
                "projectCode", "qa", "pageCode", pageCode, "dataTableName", "ReferenceDataType",
                "nameZh", "测试表格"));
        Map<String, Object> savedTable = data(tableService.insert(table));
        long tableId = number(savedTable.get("id"));
        assertAuditAndCode(savedTable, "table");

        CommonParam element = params(Map.of(
                "projectCode", "qa", "tableId", tableId, "elementType", "COLUMN",
                "fieldName", "nameZh", "secondaryFieldName", "nameEn", "labelZh", "中文名称",
                "labelJa", "中国語名", "labelEn", "Chinese name", "width", "180px", "icon", "ri-translate"));
        Map<String, Object> savedElement = data(tableElementService.insert(element));
        assertAuditAndCode(savedElement, "tableElement");
        Map<String, Object> secondElement = data(tableElementService.insert(params(Map.of(
                "projectCode", "qa", "tableId", tableId, "elementType", "COLUMN",
                "fieldName", "status", "labelZh", "状态", "width", "120px"))));
        assertAuditAndCode(secondElement, "tableElement");
        assertEquals("中国語名", configurationService.resolveGridColumns(
                "ReferenceDataType", String.valueOf(savedTable.get("code")), "ja-JP").get(0).get("label"));
        assertEquals("Chinese name", configurationService.resolveGridColumns(
                "ReferenceDataType", String.valueOf(savedTable.get("code")), "en-US").get(0).get("label"));
        assertEquals("中文名称", configurationService.resolveGridColumns(
                "ReferenceDataType", String.valueOf(savedTable.get("code")), null).get(0).get("label"));

        CommonParam window = params(Map.of(
                "projectCode", "qa", "pageCode", pageCode, "nameZh", "测试窗口",
                "width", "720px", "height", "480px", "positionMode", "CENTER", "breakpoint", "DESKTOP"));
        Map<String, Object> savedWindow = data(windowService.insert(window));
        assertAuditAndCode(savedWindow, "window");

        // 六表 code 均可由统一查询定位来源表，页面读取同时返回控件、表格元素和 Window。
        assertEquals("ReferenceDataTableElement",
                data(configurationService.getByCode(String.valueOf(savedElement.get("code")))).get("sourceTable"));
        jdbcTemplate.update("INSERT INTO ReferenceDataWindow "
                + "(id,code,projectCode,pageCode,nameZh,width,height) VALUES (?,?,?,?,?,?,?)",
                999990L, savedElement.get("code"), "qa", pageCode, "重复 code", "400px", "300px");
        assertBusiness("REFERENCE_DATA_CODE_DUPLICATE",
                () -> configurationService.getByCode(String.valueOf(savedElement.get("code"))));
        jdbcTemplate.update("DELETE FROM ReferenceDataWindow WHERE id=999990");
        Map<String, Object> page = data(configurationService.getPageConfiguration(pageCode));
        assertEquals(4, ((List<?>) page.get("controls")).size());
        assertEquals(2, ((List<?>) page.get("tableElements")).size());
        assertEquals(1, ((List<?>) page.get("windows")).size());
        assertEquals(5, ((List<?>) data(navigationService.navigation()).get("modules")).size());

        // 直接经过三个专用 Controller 覆盖实际序列化入口，确认六表能力没有只停留在 Service 层。
        assertTrue(navigationController.navigation().contains("tables-to-elements"));
        assertTrue(configurationController.getPageEditorCapability().isSuccess());
        assertEquals("ReferenceDataTableElement",
                data(configurationController.getByCode(String.valueOf(savedElement.get("code")))).get("sourceTable"));
        assertEquals(pageCode, data(configurationController.getPageConfiguration(pageCode)).get("pageCode"));
        assertTrue(configurationController.savePageConfiguration(pageCode, Map.of(
                "baseVersion", 0,
                "controls", List.of(Map.of(
                        "code", savedControl.get("code"), "width", "100%", "height", "auto",
                        "gapBefore", "1rem", "orderNo", 2, "wrap", false)),
                "tableElements", List.of(Map.of(
                        "code", savedElement.get("code"), "width", "220px", "visible", true, "sortnum", 3)),
                "windows", List.of(Map.of(
                        "code", savedWindow.get("code"), "width", "760px", "height", "520px",
                        "positionMode", "CUSTOM", "x", 10, "y", 20)))).isSuccess());
        assertTrue(resourceQueryController.getType(typeCode).contains("DROPDOWN"));
        assertTrue(resourceQueryController.getNodes(typeCode, Map.of("locale", "zh-CN"))
                .contains("ENABLED_CHILD"));
        assertTrue(resourceQueryController.getNodes(
                String.valueOf(menuType.get("code")), Map.of("locale", "zh-CN"))
                .contains("force-refresh"));
        assertTrue(treeNodeController.getStore(new CommonPageParam()).contains("enabled"));
        assertTrue(treeNodeController.getGridColumn("default", "zh-CN").contains("columns"));
        CommonParam controllerNode = params(Map.of(
                "typeId", typeId, "nodeCode", "disabled", "nodeValue", "DISABLED", "labelZh", "停用"));
        assertTrue(treeNodeController.create(controllerNode).contains("dropdownOption"));
        Long controllerNodeId = jdbcTemplate.queryForObject(
                "SELECT id FROM ReferenceDataTreeNode WHERE nodeCode='disabled'", Long.class);
        assertTrue(treeNodeController.update(params(Map.of("id", controllerNodeId, "labelZh", "已停用")))
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
     * 验证树节点与页面配置的非法坐标、空结果和版本保护分支。
     * 真实传参示例：非法 typeId、缺失类型、错误 code、错误版本和越权布局字段。
     * 真实返回示例：每个请求都抛出对应 CommonBusinessException，不产生部分更新。
     * 异常或副作用示例：全部使用测试内存库；断言失败才终止测试。
     */
    @Test
    void shouldRejectInvalidTreeAndPageConfigurationInputs() {
        assertBusiness("REFERENCE_DATA_ADMIN_REQUIRED",
                () -> new NonAdminConfigurationService(jdbcTemplate)
                        .savePageConfiguration("missing999999", Map.of()));
        CommonParam invalidType = params(Map.of("typeId", "bad", "nodeCode", "bad", "nodeValue", "bad", "labelZh", "坏"));
        assertBusiness("REFERENCE_DATA_NODE_TYPE_INVALID", () -> treeNodeService.insert(invalidType));
        CommonParam missingType = params(Map.of("typeId", 999999, "nodeCode", "missing", "nodeValue", "missing", "labelZh", "缺失"));
        assertBusiness("REFERENCE_DATA_NODE_TYPE_NOT_FOUND", () -> treeNodeService.insert(missingType));
        assertBusiness("REFERENCE_DATA_NODES_NOT_FOUND",
                () -> treeNodeService.getNodes("missing999999", Map.of()));
        assertBusiness("REFERENCE_DATA_TYPE_CODE_NOT_FOUND",
                () -> typeService.getTypeByCode("missing999999"));
        assertBusiness("REFERENCE_DATA_TYPE_CODE_NOT_FOUND",
                () -> typeService.getTypeByCode(null));
        Map<String, Object> dropdownType = data(typeService.insert(params(Map.of(
                "projectCode", "qa-negative", "resourceCode", "dropdown", "type", "DROPDOWN",
                "nameZh", "负向下拉"))));
        data(treeNodeService.insert(params(Map.of(
                "typeId", dropdownType.get("id"), "nodeCode", "one", "nodeValue", "ONE", "labelZh", "一"))));
        List<?> negativeOptions = (List<?>) treeNodeService
                .getNodes(String.valueOf(dropdownType.get("code")), Map.of()).getData();
        assertEquals(1, negativeOptions.size());
        Map<String, Object> contextType = data(typeService.insert(params(Map.of(
                "projectCode", "qa-negative", "resourceCode", "context", "type", "CONTEXT_MENU",
                "nameZh", "负向菜单"))));
        data(treeNodeService.insert(params(Map.of(
                "typeId", contextType.get("id"), "nodeCode", "open", "nodeValue", "OPEN", "labelZh", "打开"))));
        List<?> negativeMenu = (List<?>) treeNodeService
                .getNodes(String.valueOf(contextType.get("code")), Map.of()).getData();
        assertEquals(1, negativeMenu.size());
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
        assertTrue(String.valueOf(record.get("code")).startsWith(codePrefix));
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
         * 真实传参示例：测试上下文中的 referenceDataJdbcTemplate。
         * 真实返回示例：返回一个仅权限结论不同的生产配置服务实例。
         * 异常或副作用示例：模板为空时后续数据库访问失败；构造过程不写数据库。
         *
         * @param jdbcTemplate 测试内存库模板
         */
        private NonAdminConfigurationService(JdbcTemplate jdbcTemplate) {
            super(jdbcTemplate);
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
