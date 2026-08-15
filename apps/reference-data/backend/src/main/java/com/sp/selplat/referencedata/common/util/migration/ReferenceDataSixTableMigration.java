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
        {"selWindowTreeNodeManagementId", "树与选项编辑窗口"},
        {"selWindowTableManagementId", "表格定义编辑窗口"},
        {"selWindowTableElementManagementId", "表格列编辑窗口"},
        {"selWindowControlLayoutManagementId", "页面控件编辑窗口"},
        {"selWindowWindowManagementId", "Window 管理窗口"}
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
        normalizeManagementWindows();
        dropDeprecatedEmptyTables();
        if (!tableExists("LegacyReferenceDataType")) {
            return;
        }
        if (count("ReferenceDataType") != 0L) {
            throw new IllegalStateException("六表迁移目标不为空，已阻止重复迁移。");
        }

        Map<Long, Map<String, Object>> treeTypeMap = new LinkedHashMap<>();
        Map<Long, Map<String, Object>> dropdownTypeMap = new LinkedHashMap<>();
        Map<Long, Map<String, Object>> menuTypeMap = new LinkedHashMap<>();
        for (Map<String, Object> legacyType : rows("LegacyReferenceDataType")) {
            long oldId = number(legacyType.get("id"));
            Map<String, Object> treeType = createType(legacyType, "TREE", String.valueOf(legacyType.get("resourceCode")));
            treeTypeMap.put(oldId, treeType);
            if (existsByType("LegacyReferenceDataOption", oldId)) {
                dropdownTypeMap.put(oldId, createType(
                        legacyType, "DROPDOWN", legacyType.get("resourceCode") + "-dropdown"));
            }
            if (existsByType("LegacyReferenceDataContextMenuItem", oldId)) {
                menuTypeMap.put(oldId, createType(
                        legacyType, "CONTEXT_MENU", legacyType.get("resourceCode") + "-context-menu"));
            }
        }

        Map<Long, Long> nodeIds = new LinkedHashMap<>();
        List<Map<String, Object>> legacyNodes = rows("LegacyReferenceDataTreeNode");
        for (Map<String, Object> legacyNode : legacyNodes) {
            Long parentId = nullableNumber(legacyNode.get("parentId"));
            if (parentId != null && !nodeIds.containsKey(parentId)) {
                throw new IllegalStateException("旧树节点顺序不是父节点优先，已阻止迁移。");
            }
            long oldTypeId = number(legacyNode.get("typeId"));
            Map<String, Object> created = createNode(legacyNode, treeTypeMap.get(oldTypeId),
                    parentId == null ? null : nodeIds.get(parentId),
                    legacyNode.get("nodeCode"), legacyNode.get("nodeValue"), null, null,
                    Boolean.FALSE, Boolean.TRUE);
            nodeIds.put(number(legacyNode.get("id")), number(created.get("id")));
        }
        for (Map<String, Object> option : rows("LegacyReferenceDataOption")) {
            createNode(option, dropdownTypeMap.get(number(option.get("typeId"))), null,
                    option.get("optionValue"), option.get("optionValue"), null, null,
                    option.get("disabled"), Boolean.TRUE);
        }
        Map<Long, Long> menuIds = new LinkedHashMap<>();
        for (Map<String, Object> menu : rows("LegacyReferenceDataContextMenuItem")) {
            Long oldParentId = nullableNumber(menu.get("parentId"));
            Map<String, Object> created = createNode(menu, menuTypeMap.get(number(menu.get("typeId"))),
                    oldParentId == null ? null : menuIds.get(oldParentId),
                    menu.get("itemCode"), menu.get("command") == null ? menu.get("itemCode") : menu.get("command"),
                    menu.get("icon"), menu.get("command"), menu.get("disabled"), Boolean.TRUE);
            menuIds.put(number(menu.get("id")), number(created.get("id")));
        }

        Map<String, Object> page = insert(controlService, params(
                "projectCode", "reference-data", "pageCode", "bootstrap", "controlKind", "PAGE",
                "sourceTableName", "ReferenceDataControlLayout", "layoutMode", "FLOW", "orderNo", 0,
                "breakpoint", "DESKTOP", "editable", true, "status", 1, "sortnum", 0));
        String pageCode = String.valueOf(page.get("code"));
        jdbc.update("UPDATE ReferenceDataControlLayout SET pageCode=? WHERE code=?", pageCode, pageCode);

        Map<String, Long> tableIds = new LinkedHashMap<>();
        Map<String, String> tableNameMap = Map.of(
                "ReferenceDataType", "ReferenceDataType",
                "ReferenceDataTreeNode", "ReferenceDataTreeNode",
                "ReferenceDataTable", "ReferenceDataTable",
                "ReferenceDataTableColumn", "ReferenceDataTableElement",
                "ReferenceDataControlBinding", "ReferenceDataControlLayout");
        for (Map<String, Object> legacyTable : rows("LegacyReferenceDataTable")) {
            String oldName = String.valueOf(legacyTable.get("tableName"));
            String newName = tableNameMap.get(oldName);
            if (newName == null) {
                continue;
            }
            Map<String, Object> created = insert(tableService, params(
                    "projectCode", "reference-data", "pageCode", pageCode, "dataTableName", newName,
                    "nameZh", legacyTable.get("description"), "description", legacyTable.get("description"),
                    "selectionMode", "NONE", "pageSize", 20, "rowHeight", 48,
                    "status", legacyTable.get("status"), "sortnum", legacyTable.get("sortnum")));
            tableIds.put(oldName, number(created.get("id")));
        }
        Map<String, Object> windowTable = insert(tableService, params(
                "projectCode", "reference-data", "pageCode", pageCode, "dataTableName", "ReferenceDataWindow",
                "nameZh", "Window 配置", "description", "维护 SEL Window 尺寸和位置",
                "selectionMode", "NONE", "pageSize", 20, "rowHeight", 48, "status", 1, "sortnum", 60));
        tableIds.put("ReferenceDataWindow", number(windowTable.get("id")));

        for (Map<String, Object> column : rows("LegacyReferenceDataTableColumn")) {
            Long tableId = tableIds.get(String.valueOf(column.get("tableName")));
            if (tableId == null) {
                continue;
            }
            insert(elementService, params(
                    "projectCode", "reference-data", "tableId", tableId, "elementType", "COLUMN",
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
        normalizeManagementWindows();
        dropDeprecatedEmptyTables();
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
        normalizeTypedNodeCodes();
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
     * 根据所属类型把统一节点表编码迁移为树、下拉选项或菜单项前缀。
     * 真实传参示例：type 为 {@code DROPDOWN}、节点主键为 101012。
     * 真实返回示例：节点 code 更新为 {@code dropdownOption101012}。
     * 异常或副作用示例：数据库出现未登记 type 时抛出异常，防止生成含义不明的节点编码。
     */
    private void normalizeTypedNodeCodes() {
        if (!tableExists("ReferenceDataTreeNode") || !tableExists("ReferenceDataType")) {
            return;
        }
        List<Map<String, Object>> nodes = jdbc.queryForList(
                "SELECT n.id,t.type FROM ReferenceDataTreeNode n JOIN ReferenceDataType t ON t.id=n.typeId ORDER BY n.id");
        for (Map<String, Object> node : nodes) {
            long id = number(node.get("id"));
            updateCode("ReferenceDataTreeNode", id, nodePrefix(String.valueOf(node.get("type"))) + id);
        }
    }

    /**
     * 把数据类型枚举转换为管理员可直接识别的节点 code 前缀。
     * 真实传参示例：{@code CONTEXT_MENU}。
     * 真实返回示例：返回 {@code contextMenuItem}。
     * 异常或副作用示例：未知枚举抛出 IllegalStateException，使不完整迁移无法提交。
     *
     * @param type ReferenceDataType.type 数据库值
     * @return 对应节点对象前缀
     */
    private String nodePrefix(String type) {
        return switch (type) {
            case "DROPDOWN" -> "dropdownOption";
            case "TREE" -> "treeNode";
            case "GRID_MENU" -> "gridMenuItem";
            case "PANEL_MENU" -> "panelMenuItem";
            case "CONTEXT_MENU" -> "contextMenuItem";
            default -> throw new IllegalStateException("未登记的引用数据节点类型：" + type);
        };
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
     * @param id 不变的全局对象主键
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
        renameElementField("ReferenceDataTable", "projectName", "projectCode");
        renameElementField("ReferenceDataTable", "tableName", "dataTableName");
        renameElementField("ReferenceDataTable", "gridColumnId", "code");
        renameElementField("ReferenceDataTable", "pagePath", "pageCode");
        renameElementLabel("ReferenceDataTable", "code", "唯一 Code");
        renameElementLabel("ReferenceDataTable", "pageCode", "页面 Code");
        renameElementField("ReferenceDataTableElement", "tableName", "tableId");
        renameElementField("ReferenceDataTableElement", "gridColumnId", "code");
        renameElementField("ReferenceDataTableElement", "tableFieldName", "fieldName");
        renameElementSecondaryField("ReferenceDataTableElement", "gridId", "elementType");
        renameElementLabel("ReferenceDataTableElement", "tableId", "所属表格 / 元素类型");
        renameElementLabel("ReferenceDataTableElement", "code", "唯一 Code");
        renameElementField("ReferenceDataControlLayout", "pageProjectCode", "projectCode");
        renameElementField("ReferenceDataControlLayout", "pagePath", "pageCode");
        renameElementField("ReferenceDataControlLayout", "controlId", "code");
        renameElementField("ReferenceDataControlLayout", "controlType", "controlKind");
        renameElementField("ReferenceDataControlLayout", "description", "sourceTableName");
        renameElementSecondaryField("ReferenceDataControlLayout", "pagePath", "pageCode");
        renameElementLabel("ReferenceDataControlLayout", "projectCode", "所属项目 / 页面 Code");
        renameElementLabel("ReferenceDataControlLayout", "code", "唯一 Code");
        renameElementLabel("ReferenceDataControlLayout", "controlKind", "控件类型");
        renameElementLabel("ReferenceDataControlLayout", "sourceTableName", "来源表");

        List<Map<String, Object>> controlTables = jdbc.queryForList(
                "SELECT id,projectCode FROM ReferenceDataTable "
                        + "WHERE dataTableName='ReferenceDataControlLayout' AND status<>0");
        for (Map<String, Object> controlTable : controlTables) {
            long tableId = number(controlTable.get("id"));
            String projectCode = String.valueOf(controlTable.get("projectCode"));
            ensureElement(projectCode, tableId, "parentKind", "父容器类型", "120px", "text", 35);
            ensureElement(projectCode, tableId, "parentCode", "父容器 Code", "180px", "text", 36);
        }

        List<Map<String, Object>> windowTables = jdbc.queryForList(
                "SELECT id,projectCode FROM ReferenceDataTable WHERE dataTableName='ReferenceDataWindow' AND status<>0");
        for (Map<String, Object> windowTable : windowTables) {
            long tableId = number(windowTable.get("id"));
            String projectCode = String.valueOf(windowTable.get("projectCode"));
            ensureElement(projectCode, tableId, "code", "唯一 Code", "160px", "text", 10);
            ensureElement(projectCode, tableId, "nameZh", "中文名称", "180px", "text", 20);
            ensureElement(projectCode, tableId, "pageCode", "页面 Code", "180px", "text", 30);
            ensureElement(projectCode, tableId, "width", "宽度", "90px", "text", 40);
            ensureElement(projectCode, tableId, "height", "高度", "90px", "text", 50);
            ensureElement(projectCode, tableId, "positionMode", "定位模式", "110px", "text", 60);
            ensureElement(projectCode, tableId, "status", "状态", "90px", "badge", 70);
            ensureElement(projectCode, tableId, "sortnum", "排序", "90px", "text", 80);
            ensureElement(projectCode, tableId, "id", "操作", "132px", "actions", 90);
        }
    }

    /**
     * 按目标业务表把一个旧元素字段名幂等替换为最终字段名。
     * 真实传参示例：{@code ReferenceDataTable/projectName/projectCode}。
     * 真实返回示例：所属表格为 ReferenceDataTable 的 projectName 元素更新为 projectCode。
     * 异常或副作用示例：没有命中时影响 0 行；数据库失败时由外层启动事务整体回滚。
     *
     * @param dataTableName 元素所属表格定义的真实业务表名
     * @param oldFieldName 历史字段名
     * @param newFieldName 最终六表字段名
     */
    private void renameElementField(String dataTableName, String oldFieldName, String newFieldName) {
        jdbc.update("UPDATE ReferenceDataTableElement e SET fieldName=? WHERE fieldName=? AND EXISTS "
                        + "(SELECT 1 FROM ReferenceDataTable t WHERE t.id=e.tableId AND t.dataTableName=?)",
                newFieldName, oldFieldName, dataTableName);
    }

    /**
     * 按目标业务表把组合渲染使用的历史第二字段名幂等替换为最终字段名。
     * 真实传参示例：{@code ReferenceDataControlLayout/pagePath/pageCode}。
     * 真实返回示例：页面控件第一列的第二行改为显示 pageCode。
     * 异常或副作用示例：没有命中时影响 0 行；数据库失败时由外层启动事务整体回滚。
     *
     * @param dataTableName 元素所属表格定义的真实业务表名
     * @param oldFieldName 历史第二字段名
     * @param newFieldName 最终六表第二字段名
     */
    private void renameElementSecondaryField(String dataTableName, String oldFieldName, String newFieldName) {
        jdbc.update("UPDATE ReferenceDataTableElement e SET secondaryFieldName=? WHERE secondaryFieldName=? AND EXISTS "
                        + "(SELECT 1 FROM ReferenceDataTable t WHERE t.id=e.tableId AND t.dataTableName=?)",
                newFieldName, oldFieldName, dataTableName);
    }

    /**
     * 按最终字段名刷新历史表头中文名称，使管理员看到的语义与六表结构一致。
     * 真实传参示例：{@code ReferenceDataTable/code/唯一 Code}。
     * 真实返回示例：原“表格控件 ID”表头显示为“唯一 Code”。
     * 异常或副作用示例：没有命中时影响 0 行；只修改 labelZh，不覆盖宽度、显隐或排序。
     *
     * @param dataTableName 元素所属表格定义的真实业务表名
     * @param fieldName 最终实体字段名
     * @param labelZh 最终中文表头
     */
    private void renameElementLabel(String dataTableName, String fieldName, String labelZh) {
        jdbc.update("UPDATE ReferenceDataTableElement e SET labelZh=? WHERE fieldName=? AND EXISTS "
                        + "(SELECT 1 FROM ReferenceDataTable t WHERE t.id=e.tableId AND t.dataTableName=?)",
                labelZh, fieldName, dataTableName);
    }

    /**
     * 缺失时通过现有 BaseService 新增链创建一个 Window 管理列。
     * 真实传参示例：表格 101023、字段 code、标签“唯一 Code”、宽度 160px。
     * 真实返回示例：生成全局主键和 tableElement 前缀 code 的 COLUMN 元素。
     * 异常或副作用示例：同表同字段已存在时空操作；新增失败时外层启动事务整体回滚。
     *
     * @param projectCode 元素 code 的项目来源
     * @param tableId Window 表格定义主键
     * @param fieldName Window 实体字段名
     * @param labelZh 中文表头
     * @param width 默认列宽
     * @param renderer 公共 Grid renderer
     * @param sortnum 从左到右排序值
     */
    private void ensureElement(
            String projectCode, long tableId, String fieldName, String labelZh,
            String width, String renderer, int sortnum) {
        Long existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataTableElement WHERE tableId=? AND fieldName=? AND status<>0",
                Long.class, tableId, fieldName);
        if (existing != null && existing > 0L) {
            return;
        }
        insert(elementService, params(
                "projectCode", projectCode, "tableId", tableId, "elementType", "COLUMN",
                "fieldName", fieldName, "labelZh", labelZh, "width", width,
                "cellRenderer", renderer, "visible", true, "resizable", true,
                "status", 1, "sortnum", sortnum));
    }

    private Map<String, Object> createType(Map<String, Object> source, String type, String resourceCode) {
        return insert(typeService, params(
                "projectCode", source.get("projectCode"), "resourceCode", resourceCode, "type", type,
                "nameZh", source.get("nameZh"), "nameJa", source.get("nameJa"), "nameEn", source.get("nameEn"),
                "descriptionZh", source.get("descriptionZh"), "descriptionJa", source.get("descriptionJa"),
                "descriptionEn", source.get("descriptionEn"), "status", source.get("status"),
                "sortnum", source.get("sortnum")));
    }

    private Map<String, Object> createNode(
            Map<String, Object> source, Map<String, Object> type, Long parentId,
            Object nodeCode, Object nodeValue, Object icon, Object command,
            Object disabled, Object selectable) {
        return insert(nodeService, params(
                "typeId", type.get("id"), "parentId", parentId, "nodeCode", nodeCode, "nodeValue", nodeValue,
                "labelZh", source.get("labelZh"), "labelJa", source.get("labelJa"), "labelEn", source.get("labelEn"),
                "icon", icon, "commandCode", command, "disabled", disabled, "selectable", selectable,
                "attributesJson", source.get("attributesJson"), "status", source.get("status"), "sortnum", source.get("sortnum")));
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
