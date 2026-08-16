package com.sp.selplat.referencedata.common.util.migration;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.referencedatacontrollayout.service.ReferenceDataControlLayoutService;
import com.sp.selplat.referencedata.referencedatatable.service.ReferenceDataTableService;
import com.sp.selplat.referencedata.referencedatatableelement.service.ReferenceDataTableElementService;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import com.sp.selplat.referencedata.referencedatatype.service.ReferenceDataTypeService;
import com.sp.selplat.referencedata.referencedatawindow.service.ReferenceDataWindowService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 把一次性保留的 Legacy 七表数据通过现有 Service 新增链迁入六表模型。
 * 迁移本身不自行发号或拼 code；每一条新记录都复用 BaseService、BaseDao 和 SequenceGenerator。
 */
@Component
public class ReferenceDataSixTableMigration implements ApplicationRunner {

    private static final String[][] MANAGEMENT_WINDOWS = {
        {"selWindowTypeManagementId", "数据类型编辑窗口"},
        {"selWindowTreeNodeManagementId", "树节点编辑窗口"},
        {"selWindowTableManagementId", "表格定义编辑窗口"},
        {"selWindowTableElementManagementId", "表格列编辑窗口"},
        {"selWindowControlLayoutManagementId", "页面控件编辑窗口"},
        {"selWindowWindowManagementId", "Window 管理窗口"}
    };
    // 查询工具栏按真实结构字段登记；同一个物理查询按钮只保留一条共享布局记录。
    private static final Object[][] QUERY_TOOLBAR_CONTROLS = {
        {"SEARCH", 10, 8, 23, "190px", "42px", "code"},
        {"SEARCH", 15, 206, 23, "190px", "42px", "parentCode"},
        {"SEARCH", 15, 206, 23, "190px", "42px", "parentTypeCode"},
        {"SEARCH", 15, 206, 23, "190px", "42px", "parentId"},
        {"SEARCH", 15, 206, 23, "190px", "42px", "tableId"},
        {"SEARCH", 17, 404, 23, "190px", "42px", "optionSetCode"},
        {"BUTTON", 20, 602, 23, "86px", "42px", "submit"},
        {"FILTER", 30, 394, 23, "200px", "42px", "controlKind"},
        {"FILTER", 40, 606, 23, "180px", "42px", "status"},
        {"BUTTON", 50, 798, 23, "90px", "42px", "reset"}
    };
    private static final String[] DEPRECATED_EMPTY_TABLES = {
        "ReferenceDataContextMenuItem",
        "ReferenceDataControlBinding",
        "ReferenceDataOption",
        "ReferenceDataTableColumn"
    };

    private final JdbcTemplate jdbc;
    private final ReferenceDataTypeService typeService;
    private final ReferenceDataTreeNodeService nodeService;
    private final ReferenceDataTableService tableService;
    private final ReferenceDataTableElementService elementService;
    private final ReferenceDataControlLayoutService controlService;
    private final ReferenceDataWindowService windowService;

    /**
     * 装配正式六表迁移所需的私有数据库与现有新增服务。
     * 真实传参示例：Spring 注入 referenceDataJdbcTemplate 和六个业务 Service。
     * 真实返回示例：应用启动时可以识别 Legacy 表并执行一次迁移。
     * 异常或副作用示例：任一依赖缺失时应用启动失败，不会用其他数据源替代。
     */
    public ReferenceDataSixTableMigration(
            @Qualifier("referenceDataJdbcTemplate") JdbcTemplate jdbc,
            ReferenceDataTypeService typeService,
            ReferenceDataTreeNodeService nodeService,
            ReferenceDataTableService tableService,
            ReferenceDataTableElementService elementService,
            ReferenceDataControlLayoutService controlService,
            ReferenceDataWindowService windowService) {
        this.jdbc = jdbc;
        this.typeService = typeService;
        this.nodeService = nodeService;
        this.tableService = tableService;
        this.elementService = elementService;
        this.controlService = controlService;
        this.windowService = windowService;
    }

    /**
     * 在应用开放 HTTP 前完成 Legacy 数据迁移；没有 Legacy 表时保持空操作。
     * 真实传参示例：正式库已把旧 ReferenceDataType 重命名为 LegacyReferenceDataType。
     * 真实返回示例：生成六表新记录并删除全部 Legacy 表。
     * 异常或副作用示例：任一新增失败时事务回滚且应用启动失败，保留 Legacy 表供备份恢复和排查。
     *
     * @param arguments Spring Boot 启动参数，本迁移不读取其中业务值
     */
    @Override
    @Transactional(transactionManager = "referenceDataTransactionManager")
    public void run(ApplicationArguments arguments) {
        // 已完成旧表迁移的正式库仍需把历史列字段名校正为最终六表字段，并补齐 Window 表头。
        normalizeFinalTableElements();
        normalizeObjectCodesAndParents();
        normalizeQueryToolbarControls();
        normalizeManagementWindows();
        removeDeprecatedWindowChildControls();
        dropDeprecatedEmptyTables();
        if (!tableExists("LegacyReferenceDataType")) {
            return;
        }
        if (count("ReferenceDataType") != 0L) {
            throw new IllegalStateException("六表迁移目标不为空，已阻止重复迁移。");
        }

        Map<String, Object> page = insert(controlService, params(
                "projectCode", "reference-data", "pageCode", "bootstrap", "controlKind", "PAGE",
                "sourceTableName", "ReferenceDataControlLayout", "layoutMode", "FLOW", "orderNo", 0,
                "breakpoint", "DESKTOP", "editable", true, "status", 1, "sortnum", 0));
        String pageCode = String.valueOf(page.get("code"));
        jdbc.update("UPDATE ReferenceDataControlLayout SET pageCode=? WHERE code=?", pageCode, pageCode);
        normalizeQueryToolbarControls();
        String typeFilterControlCode = jdbc.queryForObject(
                "SELECT code FROM ReferenceDataControlLayout WHERE pageCode=? AND controlKind='FILTER' "
                        + "AND orderNo=30 AND status<>0",
                String.class, pageCode);

        String typeOptionSetCode = null;
        for (Map<String, Object> legacyType : rows("LegacyReferenceDataType")) {
            long oldId = number(legacyType.get("id"));
            if (existsByType("LegacyReferenceDataOption", oldId)) {
                Map<String, Object> created = createType(legacyType, typeOptionSetCode, "DROPDOWN");
                typeOptionSetCode = String.valueOf(created.get("optionSetCode"));
            }
            if (existsByType("LegacyReferenceDataContextMenuItem", oldId)) {
                Map<String, Object> created = createType(legacyType, typeOptionSetCode, "CONTEXT_MENU");
                typeOptionSetCode = String.valueOf(created.get("optionSetCode"));
            }
        }
        if (typeOptionSetCode != null) {
            jdbc.update("UPDATE ReferenceDataControlLayout SET optionSetCode=? WHERE code=?",
                    typeOptionSetCode, typeFilterControlCode);
        }

        Map<Long, Long> nodeIds = new LinkedHashMap<>();
        List<Map<String, Object>> legacyNodes = rows("LegacyReferenceDataTreeNode");
        for (Map<String, Object> legacyNode : legacyNodes) {
            Long parentId = nullableNumber(legacyNode.get("parentId"));
            if (parentId != null && !nodeIds.containsKey(parentId)) {
                throw new IllegalStateException("旧树节点顺序不是父节点优先，已阻止迁移。");
            }
            Map<String, Object> created = createNode(
                    legacyNode,
                    "reference-data",
                    pageCode,
                    parentId == null ? null : nodeIds.get(parentId),
                    legacyNode.get("nodeValue"));
            nodeIds.put(number(legacyNode.get("id")), number(created.get("id")));
        }
        // 旧下拉与菜单数据只用于补建类型目录，不再写入只属于 TREE 的树节点表。

        // 页面只有一个真实 Grid；六种业务数据状态通过元素 viewCode 区分，不再创建六条父记录。
        Map<String, Object> gridTable = insert(tableService, params(
                "projectCode", "reference-data", "pageCode", pageCode,
                "gridId", "selGridReferenceDataManagementId",
                "nameZh", "引用数据工作台表格", "description", "引用数据工作台唯一公共 Grid",
                "selectionMode", "NONE", "pageSize", 20, "rowHeight", 48, "status", 1, "sortnum", 10));
        long tableId = number(gridTable.get("id"));
        Map<String, String> viewCodes = Map.of(
                "ReferenceDataType", "TYPE",
                "ReferenceDataTreeNode", "TREE",
                "ReferenceDataTable", "TABLE",
                "ReferenceDataTableColumn", "TABLE_ELEMENT",
                "ReferenceDataControlBinding", "CONTROL");

        for (Map<String, Object> column : rows("LegacyReferenceDataTableColumn")) {
            String viewCode = viewCodes.get(String.valueOf(column.get("tableName")));
            if (viewCode == null) {
                continue;
            }
            insert(elementService, params(
                    "projectCode", "reference-data", "tableId", tableId, "viewCode", viewCode,
                    "elementType", "COLUMN",
                    "fieldName", column.get("tableFieldName"), "secondaryFieldName", column.get("tableSecondaryFieldName"),
                    "labelZh", column.get("labelZh"), "labelJa", column.get("labelJa"), "labelEn", column.get("labelEn"),
                    "width", column.get("width"), "cellRenderer", column.get("cellRenderer"),
                    "icon", column.get("cellIcon"), "visible", column.get("visible"), "resizable", true,
                    "status", column.get("status"), "sortnum", column.get("sortnum")));
        }
        insert(windowService, params(
                "projectCode", "reference-data", "pageCode", pageCode, "nameZh", "引用数据编辑窗口",
                "width", "960px", "height", "680px", "minWidth", "480px", "minHeight", "320px",
                "positionMode", "CENTER", "resizable", true, "draggable", true,
                "maximizable", true, "minimizable", true,
                "breakpoint", "DESKTOP", "status", 1, "sortnum", 10));

        String[] legacyTables = {
            "LegacyReferenceDataControlBinding", "LegacyReferenceDataTableColumn", "LegacyReferenceDataTable",
            "LegacyReferenceDataContextMenuItem", "LegacyReferenceDataOption",
            "LegacyReferenceDataTreeNode", "LegacyReferenceDataType"
        };
        for (String legacyTable : legacyTables) {
            if (tableExists(legacyTable)) {
                jdbc.execute("DROP TABLE " + legacyTable);
            }
        }
        // 新迁移产生的表格元素同样经过最终字段规范化，保证首次启动就使用六表字段名。
        normalizeFinalTableElements();
        normalizeObjectCodesAndParents();
        normalizeQueryToolbarControls();
        normalizeManagementWindows();
        removeDeprecatedWindowChildControls();
        dropDeprecatedEmptyTables();
    }

    /**
     * 为 Reference Data 页面建立查询工具栏父坐标，并让每种可见查询元素各自拥有布局记录。
     * 真实传参示例：页面 {@code page101017} 当前只有 PAGE 根记录。
     * 真实返回示例：补齐六种独立结构字段、一个共享提交按钮、范围、状态和重置十条记录。
     * 异常或副作用示例：组合 keyword、重复提交布局和 search 空组会被物理删除，不再兼容旧结构。
     */
    private void normalizeQueryToolbarControls() {
        if (!tableExists("ReferenceDataControlLayout")) {
            return;
        }
        // 每个 reference-data 页面独立补齐工具栏，避免把某一机器生成的 code 写死到应用源码。
        List<Map<String, Object>> pages = jdbc.queryForList(
                "SELECT code,projectCode,pageCode FROM ReferenceDataControlLayout "
                        + "WHERE projectCode='reference-data' AND controlKind='PAGE' AND status<>0 ORDER BY id");
        for (Map<String, Object> page : pages) {
            String pageCode = String.valueOf(page.get("pageCode"));
            String projectCode = String.valueOf(page.get("projectCode"));
            // 页面只登记一个查询工具栏；所有可编辑查询元素都以真实 code 直属该父坐标。
            List<Map<String, Object>> toolbars = jdbc.queryForList(
                    "SELECT * FROM ReferenceDataControlLayout WHERE pageCode=? AND parentKind='PAGE' "
                            + "AND parentCode=? AND controlKind='TOOLBAR' AND status<>0 ORDER BY id",
                    pageCode, pageCode);
            Map<String, Object> toolbar = toolbars.isEmpty()
                    ? insert(controlService, params(
                            "projectCode", projectCode, "pageCode", pageCode,
                            "parentKind", "PAGE", "parentCode", pageCode, "controlKind", "TOOLBAR",
                            "sourceTableName", "ReferenceDataControlLayout", "layoutMode", "ABSOLUTE",
                            "orderNo", 100, "width", "100%", "height", "88px", "x", 0, "y", 0,
                            "breakpoint", "DESKTOP", "editable", true, "status", 1, "sortnum", 100))
                    : toolbars.get(0);
            String toolbarCode = String.valueOf(toolbar.get("code"));
            // 中间版本若已建立 search 父组，先把其真实子元素迁回工具栏，避免丢失已发放 code。
            List<Map<String, Object>> searchGroups = jdbc.queryForList(
                    "SELECT id,code FROM ReferenceDataControlLayout WHERE pageCode=? AND parentKind='TOOLBAR' "
                            + "AND parentCode=? AND fieldName='search' ORDER BY id", pageCode, toolbarCode);
            for (Map<String, Object> searchGroup : searchGroups) {
                jdbc.update("UPDATE ReferenceDataControlLayout SET parentKind='TOOLBAR',parentCode=?,updatedAt=CURRENT_TIMESTAMP "
                                + "WHERE pageCode=? AND parentKind='CONTROL' AND parentCode=?",
                        toolbarCode, pageCode, String.valueOf(searchGroup.get("code")));
                jdbc.update("DELETE FROM ReferenceDataControlLayout WHERE id=?", searchGroup.get("id"));
            }
            // 组合关键词与多份提交按钮都属于废弃结构；先选一条提交记录保留 code，再物理清理其余记录。
            jdbc.update("DELETE FROM ReferenceDataControlLayout WHERE pageCode=? AND parentKind='TOOLBAR' "
                            + "AND parentCode=? AND fieldName='keyword'",
                    pageCode, toolbarCode);
            List<Map<String, Object>> submitRecords = jdbc.queryForList(
                    "SELECT id,fieldName FROM ReferenceDataControlLayout WHERE pageCode=? AND parentKind='TOOLBAR' "
                            + "AND parentCode=? AND fieldName IN ('submit','submit.default','submit.types','submit.controls') "
                            + "ORDER BY CASE WHEN fieldName='submit' THEN 0 ELSE 1 END,id",
                    pageCode, toolbarCode);
            if (!submitRecords.isEmpty()) {
                long survivorId = number(submitRecords.get(0).get("id"));
                jdbc.update("DELETE FROM ReferenceDataControlLayout WHERE pageCode=? AND parentKind='TOOLBAR' "
                                + "AND parentCode=? AND fieldName IN ('submit','submit.default','submit.types','submit.controls') "
                                + "AND id<>?",
                        pageCode, toolbarCode, survivorId);
                jdbc.update("UPDATE ReferenceDataControlLayout SET fieldName='submit',orderNo=20,sortnum=20,"
                                + "updatedAt=CURRENT_TIMESTAMP WHERE id=?",
                        survivorId);
            }
            // 每条记录只代表一个真实可见元素；缺少记录时补默认值，已有记录保留管理员几何。
            for (Object[] definition : QUERY_TOOLBAR_CONTROLS) {
                int orderNo = (Integer) definition[1];
                Long existing = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM ReferenceDataControlLayout WHERE pageCode=? AND parentKind='TOOLBAR' "
                                + "AND parentCode=? AND fieldName=? AND status<>0",
                        Long.class, pageCode, toolbarCode, definition[6]);
                if (existing != null && existing > 0L) {
                    continue;
                }
                // 新记录使用统一发号链生成 control<id>，前端随后从页面配置读取真实 code。
                insert(controlService, params(
                        "projectCode", projectCode, "pageCode", pageCode,
                        "parentKind", "TOOLBAR", "parentCode", toolbarCode,
                        "controlKind", definition[0], "sourceTableName", "ReferenceDataControlLayout",
                        "layoutMode", "ABSOLUTE", "orderNo", orderNo,
                        "x", definition[2], "y", definition[3], "width", definition[4], "height", definition[5],
                        "fieldName", definition[6],
                        "breakpoint", "DESKTOP", "editable", true, "status", 1, "sortnum", orderNo));
            }
        }
    }

    /**
     * 删除已经由最终六表模型替代的空旧表，且在发现任何残留记录时阻断启动。
     * 真实传参示例：正式库仍存在空的 {@code ReferenceDataOption} 和 {@code ReferenceDataTableColumn}。
     * 真实返回示例：四张固定白名单旧表被幂等删除，最终只保留六张业务表与公共号段表。
     * 异常或副作用示例：任一旧表仍有一条记录即抛出异常并回滚，禁止把未核验数据静默删除。
     */
    private void dropDeprecatedEmptyTables() {
        for (String deprecatedTable : DEPRECATED_EMPTY_TABLES) {
            if (!tableExists(deprecatedTable)) {
                continue;
            }
            long rowCount = count(deprecatedTable);
            if (rowCount > 0L) {
                throw new IllegalStateException(
                        "废弃表仍有未核验数据，已阻止删除：" + deprecatedTable + "，记录数=" + rowCount);
            }
        }
        // 全部旧表都通过空表预检后才进入删除阶段，避免后面的非空表导致前面的表已经被部分删除。
        for (String deprecatedTable : DEPRECATED_EMPTY_TABLES) {
            if (!tableExists(deprecatedTable)) {
                continue;
            }
            jdbc.execute("DROP TABLE " + deprecatedTable);
        }
    }

    /**
     * 为引用数据工作台的六个真实管理 Window 建立一对一配置，并保留历史记录的几何值。
     * 真实传参示例：页面 page101017 只有旧记录 window101064，且 triggerControlCode 为空。
     * 真实返回示例：旧记录绑定 selWindowTypeManagementId，再新增五条记录并复制其宽高、坐标和行为边界。
     * 异常或副作用示例：新增失败时启动事务整体回滚；已完整登记的页面再次启动不产生重复记录。
     */
    private void normalizeManagementWindows() {
        if (!tableExists("ReferenceDataWindow")) {
            return;
        }
        List<String> pageCodes = jdbc.queryForList(
                "SELECT DISTINCT pageCode FROM ReferenceDataWindow WHERE projectCode='reference-data' AND status<>0 ORDER BY pageCode",
                String.class);
        for (String pageCode : pageCodes) {
            List<Map<String, Object>> windows = jdbc.queryForList(
                    "SELECT * FROM ReferenceDataWindow WHERE pageCode=? AND status<>0 ORDER BY id", pageCode);
            if (windows.isEmpty()) {
                continue;
            }
            Map<String, Map<String, Object>> byTrigger = new LinkedHashMap<>();
            for (Map<String, Object> window : windows) {
                Object trigger = window.get("triggerControlCode");
                if (trigger != null && !String.valueOf(trigger).isBlank()) {
                    byTrigger.put(String.valueOf(trigger), window);
                }
            }
            Map<String, Object> template = windows.get(0);
            for (int index = 0; index < MANAGEMENT_WINDOWS.length; index++) {
                String triggerControlCode = MANAGEMENT_WINDOWS[index][0];
                String nameZh = MANAGEMENT_WINDOWS[index][1];
                if (byTrigger.containsKey(triggerControlCode)) {
                    // 只修正已经废弃的固定旧名称，保留管理员自行维护的其他名称。
                    if ("selWindowTreeNodeManagementId".equals(triggerControlCode)) {
                        jdbc.update("UPDATE ReferenceDataWindow SET nameZh=? "
                                        + "WHERE pageCode=? AND triggerControlCode=? AND nameZh=?",
                                nameZh, pageCode, triggerControlCode, "树与选项编辑窗口");
                    }
                    continue;
                }
                if (index == 0 && !byTrigger.containsValue(template)) {
                    jdbc.update("UPDATE ReferenceDataWindow SET triggerControlCode=?,nameZh=?,sortnum=? WHERE id=?",
                            triggerControlCode, nameZh, (index + 1) * 10, number(template.get("id")));
                    byTrigger.put(triggerControlCode, template);
                    continue;
                }
                Map<String, Object> created = insert(windowService, params(
                        "projectCode", template.get("projectCode"), "pageCode", pageCode,
                        "triggerControlCode", triggerControlCode, "nameZh", nameZh,
                        "width", template.get("width"), "height", template.get("height"),
                        "minWidth", template.get("minWidth"), "minHeight", template.get("minHeight"),
                        "maxWidth", template.get("maxWidth"), "maxHeight", template.get("maxHeight"),
                        "x", template.get("x"), "y", template.get("y"),
                        "positionMode", template.get("positionMode"),
                        "resizable", template.get("resizable"), "draggable", template.get("draggable"),
                        "maximizable", template.get("maximizable"), "minimizable", template.get("minimizable"),
                        "breakpoint", template.get("breakpoint"), "status", 1, "sortnum", (index + 1) * 10));
                byTrigger.put(triggerControlCode, created);
            }
        }
    }

    /**
     * 物理删除旧设计登记的 Window 内部字段，并把数据库约束收紧为只允许页面控件父级。
     * 真实传参示例：存在 {@code parentKind=WINDOW,parentCode=window101064} 的历史输入框记录。
     * 真实返回示例：删除全部 Window 子记录，保留 ReferenceDataWindow 中独立保存的外框几何。
     * 异常或副作用示例：约束重建失败时启动事务回滚，禁止带着可复发结构开放 HTTP。
     */
    private void removeDeprecatedWindowChildControls() {
        if (!tableExists("ReferenceDataControlLayout")) {
            return;
        }
        jdbc.update("DELETE FROM ReferenceDataControlLayout WHERE parentKind='WINDOW'");
        jdbc.execute("ALTER TABLE ReferenceDataControlLayout DROP CONSTRAINT IF EXISTS "
                + "ck_reference_data_control_layout_parent_kind");
        jdbc.execute("ALTER TABLE ReferenceDataControlLayout ADD CONSTRAINT "
                + "ck_reference_data_control_layout_parent_kind CHECK "
                + "(parentKind IS NULL OR parentKind IN ('PAGE','PANEL','TOOLBAR','CONTROL'))");
    }

    /**
     * 把历史“项目名前缀”编码迁移为对象类型前缀，并同步所有字符串坐标和父容器类别。
     * 真实传参示例：历史页面 {@code referenceData101017}、历史 Window {@code referenceData101064}。
     * 真实返回示例：迁移为 {@code page101017/window101064}，引用它们的 pageCode 与 parentCode 同步更新。
     * 异常或副作用示例：非页面控件仍无法解析父容器时抛出异常并回滚；主键和业务配置值保持不变。
     */
    private void normalizeObjectCodesAndParents() {
        if (!tableExists("ReferenceDataControlLayout")) {
            return;
        }
        // 先迁移所有 pageCode 字符串引用，再替换页面根本身的 code，避免引用链失联。
        for (Map<String, Object> page : jdbc.queryForList(
                "SELECT id,code FROM ReferenceDataControlLayout WHERE controlKind='PAGE' ORDER BY id")) {
            String oldCode = String.valueOf(page.get("code"));
            String newCode = "page" + number(page.get("id"));
            replaceCoordinate("ReferenceDataControlLayout", "pageCode", oldCode, newCode);
            replaceCoordinate("ReferenceDataTable", "pageCode", oldCode, newCode);
            replaceCoordinate("ReferenceDataWindow", "pageCode", oldCode, newCode);
        }

        // 父容器和 Window 触发控件都保存控件 code，必须在控件自身改名之前同步引用。
        for (Map<String, Object> control : jdbc.queryForList(
                "SELECT id,code,controlKind FROM ReferenceDataControlLayout ORDER BY id")) {
            String oldCode = String.valueOf(control.get("code"));
            String prefix = "PAGE".equals(String.valueOf(control.get("controlKind"))) ? "page" : "control";
            String newCode = prefix + number(control.get("id"));
            replaceCoordinate("ReferenceDataControlLayout", "parentCode", oldCode, newCode);
            replaceCoordinate("ReferenceDataWindow", "triggerControlCode", oldCode, newCode);
            updateCode("ReferenceDataControlLayout", number(control.get("id")), newCode);
        }

        // Window code 可能被页面控件作为父坐标引用，所以先更新引用再替换 Window 自身编码。
        for (Map<String, Object> window : jdbc.queryForList("SELECT id,code FROM ReferenceDataWindow ORDER BY id")) {
            String oldCode = String.valueOf(window.get("code"));
            String newCode = "window" + number(window.get("id"));
            replaceCoordinate("ReferenceDataControlLayout", "parentCode", oldCode, newCode);
            updateCode("ReferenceDataWindow", number(window.get("id")), newCode);
        }

        normalizeFixedPrefixCodes("ReferenceDataType", "type");
        normalizeFixedPrefixCodes("ReferenceDataTable", "table");
        normalizeFixedPrefixCodes("ReferenceDataTableElement", "tableElement");
        normalizeFixedPrefixCodes("ReferenceDataTreeNode", "treeNode");
        normalizeParentKinds();
    }

    /**
     * 按统一固定前缀更新一张六表业务表的公开 code。
     * 真实传参示例：{@code ReferenceDataTable/table}。
     * 真实返回示例：主键 101018 的记录 code 变为 {@code table101018}。
     * 异常或副作用示例：表不存在时空操作；唯一约束冲突时启动事务回滚。
     *
     * @param tableName 已登记的六表业务表名
     * @param prefix 对象类型 lowerCamelCase 前缀
     */
    private void normalizeFixedPrefixCodes(String tableName, String prefix) {
        if (!tableExists(tableName)) {
            return;
        }
        for (Map<String, Object> row : jdbc.queryForList("SELECT id FROM " + tableName + " ORDER BY id")) {
            long id = number(row.get("id"));
            updateCode(tableName, id, prefix + id);
        }
    }

    /**
     * 为页面内控件补齐父容器类别和坐标，使所属页面或 Window 无需通过字符串猜测。
     * 真实传参示例：普通控件 parentCode 为空且 pageCode 为 {@code page101017}。
     * 真实返回示例：补为 {@code parentKind=PAGE,parentCode=page101017}；页面根两字段保持为空。
     * 异常或副作用示例：父坐标无法命中页面、Window 或控件时抛出异常并回滚。
     */
    private void normalizeParentKinds() {
        jdbc.update("UPDATE ReferenceDataControlLayout SET parentKind=NULL,parentCode=NULL WHERE controlKind='PAGE'");
        jdbc.update("UPDATE ReferenceDataControlLayout SET parentKind='PAGE',parentCode=pageCode "
                + "WHERE controlKind<>'PAGE' AND (parentCode IS NULL OR TRIM(parentCode)='')");
        jdbc.update("UPDATE ReferenceDataControlLayout c SET parentKind='PAGE' "
                + "WHERE c.controlKind<>'PAGE' AND c.parentCode=c.pageCode");
        jdbc.update("UPDATE ReferenceDataControlLayout c SET parentKind='WINDOW' WHERE EXISTS "
                + "(SELECT 1 FROM ReferenceDataWindow w WHERE w.code=c.parentCode)");
        jdbc.update("UPDATE ReferenceDataControlLayout c SET parentKind=(SELECT CASE p.controlKind "
                + "WHEN 'PAGE' THEN 'PAGE' WHEN 'PANEL' THEN 'PANEL' WHEN 'TOOLBAR' THEN 'TOOLBAR' ELSE 'CONTROL' END "
                + "FROM ReferenceDataControlLayout p WHERE p.code=c.parentCode) WHERE EXISTS "
                + "(SELECT 1 FROM ReferenceDataControlLayout p WHERE p.code=c.parentCode)");
        Long unresolved = jdbc.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataControlLayout WHERE controlKind<>'PAGE' AND parentKind IS NULL",
                Long.class);
        if (unresolved != null && unresolved > 0L) {
            throw new IllegalStateException("存在无法识别父容器的页面控件：" + unresolved);
        }
    }

    /**
     * 在指定业务表中把一个旧字符串坐标替换为新坐标。
     * 真实传参示例：{@code ReferenceDataWindow/pageCode/referenceData101017/page101017}。
     * 真实返回示例：所有命中记录的 pageCode 同步更新，未命中时影响 0 行。
     * 异常或副作用示例：数据库失败时由外层事务回滚；方法不接受用户输入的表名或字段名。
     *
     * @param tableName 代码内部固定的六表表名
     * @param columnName 代码内部固定的坐标字段名
     * @param oldCode 迁移前坐标
     * @param newCode 迁移后坐标
     */
    private void replaceCoordinate(String tableName, String columnName, String oldCode, String newCode) {
        if (tableExists(tableName) && !oldCode.equals(newCode)) {
            jdbc.update("UPDATE " + tableName + " SET " + columnName + "=? WHERE " + columnName + "=?",
                    newCode, oldCode);
        }
    }

    /**
     * 按稳定主键更新业务对象公开 code，不改变任何业务属性或审计身份。
     * 真实传参示例：{@code ReferenceDataWindow/101064/window101064}。
     * 真实返回示例：主键 101064 的 code 更新为 {@code window101064}。
     * 异常或副作用示例：唯一约束冲突时数据库抛错并由启动事务整体回滚。
     *
     * @param tableName 代码内部固定的六表表名
     * @param id 不变的当前表主键
     * @param code 新对象类型编码
     */
    private void updateCode(String tableName, long id, String code) {
        jdbc.update("UPDATE " + tableName + " SET code=? WHERE id=? AND code<>?", code, id, code);
    }

    /**
     * 把已迁移表格元素中的旧字段名改成最终六表字段，并补齐 Window 默认列。
     * 真实传参示例：正式库存在 ReferenceDataTable 的旧元素字段 {@code projectName/gridColumnId}。
     * 真实返回示例：字段改为 {@code projectCode/code}，ReferenceDataWindow 至少拥有 code、nameZh 等管理列。
     * 异常或副作用示例：更新或新增失败时当前启动事务回滚；不会删除管理员已调整的宽度与显示状态。
     */
    private void normalizeFinalTableElements() {
        if (!tableExists("ReferenceDataTableElement") || !tableExists("ReferenceDataTable")) {
            return;
        }
        renameElementField("TABLE", "projectName", "projectCode");
        renameElementField("TABLE", "tableName", "gridId");
        renameElementField("TABLE", "dataTableName", "gridId");
        renameElementField("TABLE", "gridColumnId", "code");
        renameElementField("TABLE", "pagePath", "pageCode");
        renameElementLabel("TABLE", "code", "唯一 Code");
        renameElementLabel("TABLE", "gridId", "Grid 实例 ID");
        renameElementLabel("TABLE", "pageCode", "页面 Code");
        renameElementField("TABLE_ELEMENT", "tableName", "tableId");
        renameElementField("TABLE_ELEMENT", "gridColumnId", "code");
        renameElementField("TABLE_ELEMENT", "tableFieldName", "fieldName");
        renameElementSecondaryField("TABLE_ELEMENT", "gridId", "viewCode");
        renameElementSecondaryField("TABLE_ELEMENT", "elementType", "viewCode");
        renameElementLabel("TABLE_ELEMENT", "tableId", "所属表格 / 视图");
        renameElementLabel("TABLE_ELEMENT", "viewCode", "视图编码");
        renameElementLabel("TABLE_ELEMENT", "code", "唯一 Code");
        renameElementField("CONTROL", "pageProjectCode", "projectCode");
        renameElementField("CONTROL", "pagePath", "pageCode");
        renameElementField("CONTROL", "controlId", "code");
        renameElementField("CONTROL", "controlType", "controlKind");
        renameElementField("CONTROL", "description", "sourceTableName");
        renameElementSecondaryField("CONTROL", "pagePath", "pageCode");
        renameElementLabel("CONTROL", "projectCode", "所属项目 / 页面 Code");
        renameElementLabel("CONTROL", "code", "唯一 Code");
        renameElementLabel("CONTROL", "controlKind", "控件类型");
        renameElementLabel("CONTROL", "sourceTableName", "来源表");
        // 控件不再反向保存 typeId；需要选项的控件只保存可复用 optionSetCode。
        jdbc.update("DELETE FROM ReferenceDataTableElement WHERE viewCode='CONTROL' AND fieldName='typeId'");
        // 类型值列 → 先迁移旧 categoryCode/controlCode，再按选项组、父级和值的业务顺序展示。
        renameElementField("TYPE", "categoryCode", "valueCode");
        renameElementField("TYPE", "controlCode", "optionSetCode");
        List<Map<String, Object>> typeTables = jdbc.queryForList(
                "SELECT DISTINCT t.id,t.projectCode FROM ReferenceDataTable t "
                        + "JOIN ReferenceDataTableElement e ON e.tableId=t.id "
                        + "WHERE e.viewCode='TYPE' AND t.status<>0");
        for (Map<String, Object> typeTable : typeTables) {
            long tableId = number(typeTable.get("id"));
            String projectCode = String.valueOf(typeTable.get("projectCode"));
            ensureElement(projectCode, tableId, "TYPE", "optionSetCode", "选项组 Code", "180px", "text", 20);
            ensureElement(projectCode, tableId, "TYPE", "valueCode", "类型值 Code", "150px", "text", 30);
            ensureElement(projectCode, tableId, "TYPE", "parentTypeCode", "上级类型 Code", "170px", "text", 40);
        }
        normalizeTypeElement("code", null, "唯一 Code", "一意 Code", "Unique Code", "text", 10);
        normalizeTypeElement("optionSetCode", null, "选项组 Code", "選択肢グループ Code", "Option set code", "text", 20);
        normalizeTypeElement("valueCode", null, "类型值 Code", "型値 Code", "Value code", "text", 30);
        normalizeTypeElement("parentTypeCode", null, "上级类型 Code", "親型 Code", "Parent type code", "text", 40);
        normalizeTypeElement("nameZh", null, "中文名称", "中国語名", "Chinese name", "text", 50);
        normalizeTypeElement("nameEn", "nameJa", "英文 / 日文", "英語 / 日本語", "English / Japanese", "stack", 60);
        normalizeTypeElement("status", null, "状态", "状態", "Status", "badge", 70);
        normalizeTypeElement("sortnum", null, "排序", "並び順", "Order", "text", 80);
        normalizeTypeElement("id", null, "操作", "操作", "Actions", "actions", 90);

        // 树节点归属用一个双行列展示；projectCode/pageCode 不参与 code + parentId 建树。
        List<Map<String, Object>> treeTables = jdbc.queryForList(
                "SELECT DISTINCT t.id,t.projectCode FROM ReferenceDataTable t "
                        + "JOIN ReferenceDataTableElement e ON e.tableId=t.id "
                        + "WHERE e.viewCode='TREE' AND t.status<>0");
        for (Map<String, Object> treeTable : treeTables) {
            long tableId = number(treeTable.get("id"));
            String projectCode = String.valueOf(treeTable.get("projectCode"));
            ensureElement(projectCode, tableId, "TREE", "projectCode", "所属项目 / 页面 Code", "210px", "stack", 20);
        }
        normalizeTreeElement("code", null, "唯一 Code", "一意 Code", "Unique Code", "text", 10);
        normalizeTreeElement("projectCode", "pageCode", "所属项目 / 页面 Code",
                "所属プロジェクト / ページ Code", "Project / page code", "stack", 20);
        normalizeTreeElement("nodeValue", null, "节点值", "ノード値", "Node value", "text", 30);
        normalizeTreeElement("parentId", null, "父节点 ID", "親ノード ID", "Parent node ID", "text", 40);
        normalizeTreeElement("labelZh", null, "中文名称", "中国語名", "Chinese name", "text", 50);
        normalizeTreeElement("status", null, "状态", "状態", "Status", "badge", 60);
        normalizeTreeElement("sortnum", null, "排序", "並び順", "Order", "text", 70);
        normalizeTreeElement("id", null, "操作", "操作", "Actions", "actions", 80);

        List<Map<String, Object>> controlTables = jdbc.queryForList(
                "SELECT DISTINCT t.id,t.projectCode FROM ReferenceDataTable t "
                        + "JOIN ReferenceDataTableElement e ON e.tableId=t.id "
                        + "WHERE e.viewCode='CONTROL' AND t.status<>0");
        for (Map<String, Object> controlTable : controlTables) {
            long tableId = number(controlTable.get("id"));
            String projectCode = String.valueOf(controlTable.get("projectCode"));
            ensureElement(projectCode, tableId, "CONTROL", "parentKind", "父容器类型", "120px", "text", 35);
            ensureElement(projectCode, tableId, "CONTROL", "parentCode", "父容器 Code", "180px", "text", 36);
            ensureElement(projectCode, tableId, "CONTROL", "fieldName", "字段 / 动作名", "160px", "text", 37);
            ensureElement(projectCode, tableId, "CONTROL", "optionSetCode", "选项组 Code", "180px", "text", 38);
        }

        List<Map<String, Object>> windowTables = jdbc.queryForList(
                "SELECT id,projectCode FROM ReferenceDataTable WHERE gridId='selGridReferenceDataManagementId' AND status<>0");
        for (Map<String, Object> windowTable : windowTables) {
            long tableId = number(windowTable.get("id"));
            String projectCode = String.valueOf(windowTable.get("projectCode"));
            ensureElement(projectCode, tableId, "WINDOW", "code", "唯一 Code", "160px", "text", 10);
            ensureElement(projectCode, tableId, "WINDOW", "nameZh", "中文名称", "180px", "text", 20);
            ensureElement(projectCode, tableId, "WINDOW", "pageCode", "页面 Code", "180px", "text", 30);
            ensureElement(projectCode, tableId, "WINDOW", "width", "宽度", "90px", "text", 40);
            ensureElement(projectCode, tableId, "WINDOW", "height", "高度", "90px", "text", 50);
            ensureElement(projectCode, tableId, "WINDOW", "positionMode", "定位模式", "110px", "text", 60);
            ensureElement(projectCode, tableId, "WINDOW", "status", "状态", "90px", "badge", 70);
            ensureElement(projectCode, tableId, "WINDOW", "sortnum", "排序", "90px", "text", 80);
            ensureElement(projectCode, tableId, "WINDOW", "id", "操作", "132px", "actions", 90);
        }
    }

    /**
     * 按目标业务表把一个旧元素字段名幂等替换为最终字段名。
     * 真实传参示例：{@code ReferenceDataTable/projectName/projectCode}。
     * 真实返回示例：所属表格为 ReferenceDataTable 的 projectName 元素更新为 projectCode。
     * 异常或副作用示例：没有命中时影响 0 行；数据库失败时由外层启动事务整体回滚。
     *
     * @param viewCode 元素所属数据视图编码
     * @param oldFieldName 历史字段名
     * @param newFieldName 最终六表字段名
     */
    private void renameElementField(String viewCode, String oldFieldName, String newFieldName) {
        jdbc.update("UPDATE ReferenceDataTableElement SET fieldName=? WHERE fieldName=? AND viewCode=?",
                newFieldName, oldFieldName, viewCode);
    }

    /**
     * 按目标业务表把组合渲染使用的历史第二字段名幂等替换为最终字段名。
     * 真实传参示例：{@code ReferenceDataControlLayout/pagePath/pageCode}。
     * 真实返回示例：页面控件第一列的第二行改为显示 pageCode。
     * 异常或副作用示例：没有命中时影响 0 行；数据库失败时由外层启动事务整体回滚。
     *
     * @param viewCode 元素所属数据视图编码
     * @param oldFieldName 历史第二字段名
     * @param newFieldName 最终六表第二字段名
     */
    private void renameElementSecondaryField(String viewCode, String oldFieldName, String newFieldName) {
        jdbc.update("UPDATE ReferenceDataTableElement SET secondaryFieldName=? WHERE secondaryFieldName=? AND viewCode=?",
                newFieldName, oldFieldName, viewCode);
    }

    /**
     * 按最终字段名刷新历史表头中文名称，使管理员看到的语义与六表结构一致。
     * 真实传参示例：{@code ReferenceDataTable/code/唯一 Code}。
     * 真实返回示例：原“表格控件 ID”表头显示为“唯一 Code”。
     * 异常或副作用示例：没有命中时影响 0 行；只修改 labelZh，不覆盖宽度、显隐或排序。
     *
     * @param viewCode 元素所属数据视图编码
     * @param fieldName 最终实体字段名
     * @param labelZh 最终中文表头
     */
    private void renameElementLabel(String viewCode, String fieldName, String labelZh) {
        jdbc.update("UPDATE ReferenceDataTableElement SET labelZh=? WHERE fieldName=? AND viewCode=?",
                labelZh, fieldName, viewCode);
    }

    /**
     * 规范类型目录一个页面列的绑定、三语表头、渲染器和左右顺序。
     * 真实传参示例：{@code nameEn/nameJa/英文 / 日文/stack/40}。
     * 真实返回示例：英文作为第一行、日文作为第二行，列位于中文名称之后、状态之前。
     * 异常或副作用示例：目标列不存在时影响 0 行；管理员维护的列宽、显隐和图标保持不变。
     *
     * @param fieldName ReferenceDataType 真实字段名
     * @param secondaryFieldName 双行第二字段；单行列传入 null
     * @param labelZh 中文表头
     * @param labelJa 日文表头
     * @param labelEn 英文表头
     * @param renderer 公共 Grid 渲染器
     * @param sortnum 页面从左到右顺序
     */
    private void normalizeTypeElement(
            String fieldName, String secondaryFieldName,
            String labelZh, String labelJa, String labelEn,
            String renderer, int sortnum) {
        // 只命中 TYPE 视图 → 其他视图的同名字段配置保持不变。
        jdbc.update("UPDATE ReferenceDataTableElement e SET secondaryFieldName=?,labelZh=?,labelJa=?,labelEn=?,"
                        + "cellRenderer=?,sortnum=? WHERE e.fieldName=? AND e.viewCode='TYPE'",
                secondaryFieldName, labelZh, labelJa, labelEn, renderer, sortnum, fieldName);
    }

    /**
     * 规范树节点管理页一个列的字段绑定、多语言表头、渲染器和顺序。
     * 真实传参示例：{@code projectCode/pageCode/所属项目 / 页面 Code/stack/20}。
     * 真实返回示例：工程显示在第一行、页面 Code 显示在第二行，父子关系字段不变。
     * 异常或副作用示例：目标列不存在时影响 0 行；不会修改树节点业务数据。
     *
     * @param fieldName ReferenceDataTreeNode 真实字段名
     * @param secondaryFieldName 双行第二字段；单行列传入 null
     * @param labelZh 中文表头
     * @param labelJa 日文表头
     * @param labelEn 英文表头
     * @param renderer 公共 Grid 渲染器
     * @param sortnum 页面从左到右顺序
     */
    private void normalizeTreeElement(
            String fieldName, String secondaryFieldName,
            String labelZh, String labelJa, String labelEn,
            String renderer, int sortnum) {
        jdbc.update("UPDATE ReferenceDataTableElement e SET secondaryFieldName=?,labelZh=?,labelJa=?,labelEn=?,"
                        + "cellRenderer=?,sortnum=? WHERE e.fieldName=? AND e.viewCode='TREE'",
                secondaryFieldName, labelZh, labelJa, labelEn, renderer, sortnum, fieldName);
    }

    /**
     * 缺失时通过现有 BaseService 新增链创建一个 Window 管理列。
     * 真实传参示例：表格 101023、字段 code、标签“唯一 Code”、宽度 160px。
     * 真实返回示例：生成全局主键和 tableElement 前缀 code 的 COLUMN 元素。
     * 异常或副作用示例：同表同字段已存在时空操作；新增失败时外层启动事务整体回滚。
     *
     * @param projectCode 元素 code 的项目来源
     * @param tableId Window 表格定义主键
     * @param viewCode 元素所属数据视图编码
     * @param fieldName Window 实体字段名
     * @param labelZh 中文表头
     * @param width 默认列宽
     * @param renderer 公共 Grid renderer
     * @param sortnum 从左到右排序值
     */
    private void ensureElement(
            String projectCode, long tableId, String viewCode, String fieldName, String labelZh,
            String width, String renderer, int sortnum) {
        Long existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataTableElement "
                        + "WHERE tableId=? AND viewCode=? AND fieldName=? AND status<>0",
                Long.class, tableId, viewCode, fieldName);
        if (existing != null && existing > 0L) {
            return;
        }
        insert(elementService, params(
                "projectCode", projectCode, "tableId", tableId, "viewCode", viewCode,
                "elementType", "COLUMN",
                "fieldName", fieldName, "labelZh", labelZh, "width", width,
                "cellRenderer", renderer, "visible", true, "resizable", true,
                "status", 1, "sortnum", sortnum));
    }

    private Map<String, Object> createType(
            Map<String, Object> source, String optionSetCode, String valueCode) {
        List<Map<String, Object>> existing = optionSetCode == null ? List.of() : jdbc.queryForList(
                "SELECT * FROM ReferenceDataType WHERE optionSetCode=? AND valueCode=? AND status<>0",
                optionSetCode, valueCode);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        Map<String, String[]> names = Map.of(
                "DROPDOWN", new String[] {"下拉框", "ドロップダウン", "Dropdown"},
                "CONTEXT_MENU", new String[] {"右键菜单", "コンテキストメニュー", "Context menu"});
        String[] localizedNames = names.get(valueCode);
        return insert(typeService, params(
                "optionSetCode", optionSetCode, "valueCode", valueCode,
                "nameZh", localizedNames[0], "nameJa", localizedNames[1], "nameEn", localizedNames[2],
                "status", source.get("status"), "sortnum", source.get("sortnum")));
    }

    private Map<String, Object> createNode(
            Map<String, Object> source, String projectCode, String pageCode,
            Long parentId, Object nodeValue) {
        return insert(nodeService, params(
                "projectCode", projectCode, "pageCode", pageCode,
                "parentId", parentId, "nodeValue", nodeValue,
                "labelZh", source.get("labelZh"), "labelJa", source.get("labelJa"), "labelEn", source.get("labelEn"),
                "status", source.get("status"), "sortnum", source.get("sortnum")));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> insert(com.sp.selplat.common.service.BaseService service, CommonParam param) {
        CommonResult result = service.insert(param);
        return (Map<String, Object>) result.getData();
    }

    private CommonParam params(Object... values) {
        CommonParam param = new CommonParam();
        for (int index = 0; index < values.length; index += 2) {
            if (values[index + 1] != null) {
                param.putParam(String.valueOf(values[index]), values[index + 1]);
            }
        }
        return param;
    }

    private boolean existsByType(String tableName, long typeId) {
        return tableExists(tableName) && jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + tableName + " WHERE typeId=?", Long.class, typeId) > 0L;
    }

    private boolean tableExists(String tableName) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME=?",
                Long.class, tableName) > 0L;
    }

    private long count(String tableName) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + tableName, Long.class);
    }

    private List<Map<String, Object>> rows(String tableName) {
        return tableExists(tableName)
                ? jdbc.queryForList("SELECT * FROM " + tableName + " ORDER BY id")
                : List.of();
    }

    private long number(Object value) {
        return Long.parseLong(String.valueOf(value));
    }

    private Long nullableNumber(Object value) {
        return value == null ? null : number(value);
    }
}
