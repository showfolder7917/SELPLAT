package com.sp.selplat.referencedata.capability.configuration.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.capability.configuration.service.ReferenceDataConfigurationService;
import com.sp.selplat.referencedata.referencedatacontrollayout.dao.ReferenceDataControlLayoutDao;
import com.sp.selplat.referencedata.referencedatatable.service.ReferenceDataTableService;
import com.sp.selplat.referencedata.referencedatatableelement.service.ReferenceDataTableElementService;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import com.sp.selplat.referencedata.referencedatatype.service.ReferenceDataTypeService;
import com.sp.selplat.referencedata.referencedatawindow.service.ReferenceDataWindowService;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 以固定六表白名单解析全局 code，并在一个事务中保存同一页面的控件、表格元素和 Window 草稿。
 * 前端永远不能传入表名；sourceTable 只由服务端查询结果返回，供管理员诊断数据库位置。
 */
@Service
public class ReferenceDataConfigurationServiceImpl
        extends BaseServiceImpl<ReferenceDataControlLayoutDao>
        implements ReferenceDataConfigurationService {

    // CODE_PATTERN 只接受后端生成的对象类型前缀加数字主键，阻止路径和 SQL 标识符注入。
    private static final Pattern CODE_PATTERN = Pattern.compile("^[a-z][A-Za-z0-9]*[0-9]+$");
    // 应用稳定坐标只允许 URL 安全的小写编码，禁止用动态值拼接数据库字段或路径。
    private static final Pattern STABLE_KEY_PATTERN = Pattern.compile("^[a-z][a-z0-9-]{0,63}$");
    // CSS_LENGTH_PATTERN 只允许页面布局协议支持的安全长度，不允许任意 CSS 表达式。
    private static final Pattern CSS_LENGTH_PATTERN = Pattern.compile("^(?:auto|[0-9]{1,4}(?:px|%|rem))$");
    // 六张表和实体类型是服务端固定注册表，不接受请求覆盖。
    private static final Map<String, String> CONFIG_TABLES = Map.of(
            "ReferenceDataType", "TYPE",
            "ReferenceDataTreeNode", "TREE_NODE",
            "ReferenceDataTable", "TABLE",
            "ReferenceDataTableElement", "TABLE_ELEMENT",
            "ReferenceDataControlLayout", "CONTROL_LAYOUT",
            "ReferenceDataWindow", "WINDOW");
    // 业务表名只负责选择同一真实 Grid 的视图，数据库父子关系仍只使用 tableId。
    private static final Map<String, String> VIEW_CODES = Map.of(
            "ReferenceDataType", "TYPE",
            "ReferenceDataTreeNode", "TREE",
            "ReferenceDataControlLayout", "CONTROL",
            "ReferenceDataWindow", "WINDOW",
            "ReferenceDataTable", "TABLE",
            "ReferenceDataTableElement", "TABLE_ELEMENT");
    // 单次公共分页最多读取一千条；超过时按 totalCount 继续逐页读取，不截断业务配置。
    private static final int SERVICE_PAGE_SIZE = 1000;
    // 控件布局只允许页面编辑协议中明确登记的字段。
    private static final Set<String> CONTROL_FIELDS = Set.of(
            "orderNo", "width", "height", "wrap", "x", "y", "breakpoint");
    // 表格元素页面编辑只维护显示布局，不修改字段绑定和渲染业务。
    private static final Set<String> ELEMENT_FIELDS = Set.of("width", "visible", "sortnum");
    // Window 页面编辑只维护几何状态和受控定位模式。
    private static final Set<String> WINDOW_FIELDS = Set.of(
            "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
            "x", "y", "positionMode", "breakpoint");

    private final ReferenceDataTypeService typeService;
    private final ReferenceDataTreeNodeService treeNodeService;
    private final ReferenceDataTableService tableService;
    private final ReferenceDataTableElementService tableElementService;
    private final ReferenceDataWindowService windowService;

    /**
     * 创建只通过六张表业务 Service 编排页面配置的能力。
     * 真实传参示例：Spring 注入 Type、TreeNode、Table、TableElement 和 Window 五个业务 Service。
     * 真实返回示例：配置能力可调用自身 ControlLayout BaseService 与另外五表 Service 完成跨表编排。
     * 异常或副作用示例：任一业务 Service 缺失时应用启动失败，不允许回退到直接 JdbcTemplate SQL。
     *
     * @param typeService 类型目录业务 Service
     * @param treeNodeService 树节点业务 Service
     * @param tableService 真实 Grid 业务 Service
     * @param tableElementService Grid 元素业务 Service
     * @param windowService Window 业务 Service
     */
    public ReferenceDataConfigurationServiceImpl(
            ReferenceDataTypeService typeService,
            ReferenceDataTreeNodeService treeNodeService,
            ReferenceDataTableService tableService,
            ReferenceDataTableElementService tableElementService,
            ReferenceDataWindowService windowService) {
        this.typeService = typeService;
        this.treeNodeService = treeNodeService;
        this.tableService = tableService;
        this.tableElementService = tableElementService;
        this.windowService = windowService;
    }

    /**
     * 返回 BaseService 判定的当前操作员页面编辑权限。
     * 真实传参示例：浏览器调用能力接口，无需提交用户 ID 或租户 ID。
     * 真实返回示例：当前固定管理员上下文返回 {@code {"canEditPage":true}}。
     * 异常或副作用示例：方法不访问或修改数据库，未来权限提供器异常时由统一异常处理返回失败。
     *
     * @return 包含 canEditPage 布尔值的标准成功结果
     */
    @Override
    public CommonResult getPageEditorCapability() {
        return buildSuccessResult(Map.of("canEditPage", isAdmin()), "页面编辑权限读取完成。");
    }

    /**
     * 通过表格唯一 code 把数据库元素转换为公共 SEL Grid 列契约。
     * 真实传参示例：{@code ReferenceDataType/table101018/zh-CN}。
     * 真实返回示例：中文列返回 {@code {id:nameZh,field:nameZh,label:中文名称,width:180px}}。
     * 异常或副作用示例：表名与 code 不匹配或没有启用列时返回空列表；方法不修改数据库。
     *
     * @param tableName 当前业务 Service 的真实表名
     * @param tableCode ReferenceDataTable 唯一 code
     * @param locale 页面语言
     * @return 只包含启用可见 COLUMN 元素的标准列数组
     */
    @Override
    public List<Map<String, Object>> resolveGridColumns(String tableName, String tableCode, String locale) {
        if (tableName == null || tableCode == null) {
            return List.of();
        }
        Map<String, Object> table = singleRecord(tableService, Map.of(
                "code", tableCode.trim(), "statusIn", List.of(1, 2)));
        if (table.isEmpty()) {
            return List.of();
        }
        String normalizedTableName = tableName.trim();
        String configuredSourceTable = String.valueOf(table.getOrDefault("sourceTableName", ""));
        String viewCode = VIEW_CODES.get(normalizedTableName);
        if (viewCode == null) {
            // 普通业务 Grid 必须与登记的真实表名完全一致，并统一使用 DEFAULT 视图。
            if (!normalizedTableName.equals(configuredSourceTable)) {
                return List.of();
            }
            viewCode = "DEFAULT";
        }
        List<Map<String, Object>> rows = records(tableElementService, Map.of(
                "tableId", table.get("id"),
                "viewCode", viewCode,
                "elementType", "COLUMN",
                "statusIn", List.of(1, 2),
                "visible", true));
        rows.sort(recordOrder("sortnum"));
        String labelField = locale != null && locale.toLowerCase().startsWith("ja")
                ? "labelJa" : locale != null && locale.toLowerCase().startsWith("en") ? "labelEn" : "labelZh";
        List<Map<String, Object>> columns = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String fieldName = String.valueOf(row.get("fieldName"));
            Object localizedLabel = row.get(labelField);
            Map<String, Object> column = new LinkedHashMap<>();
            column.put("id", fieldName);
            column.put("field", fieldName);
            column.put("secondaryField", row.get("secondaryFieldName"));
            column.put("label", localizedLabel == null ? row.get("labelZh") : localizedLabel);
            column.put("width", row.get("width"));
            column.put("renderer", row.get("cellRenderer"));
            column.put("cellIcon", row.get("icon"));
            column.put("cellIconVisible", row.get("icon") != null);
            columns.add(Collections.unmodifiableMap(column));
        }
        return List.copyOf(columns);
    }

    /**
     * 通过不可变全局 code 在固定六表中解析唯一配置对象。
     * 真实传参示例：{@code tableElement101020}。
     * 真实返回示例：返回记录字段以及 {@code entityType=TABLE,sourceTable=ReferenceDataTable}。
     * 异常或副作用示例：格式错误、未命中或跨表重复时抛出明确业务异常；方法不修改数据库。
     *
     * @param code 后端按对象前缀与本表 id 生成的公开 code
     * @return 包含配置记录、实体类型和来源表的统一结果
     */
    @Override
    public CommonResult getByCode(String code) {
        String requiredCode = requiredCode(code);
        List<Map<String, Object>> matches = new ArrayList<>();
        CONFIG_TABLES.forEach((tableName, entityType) -> {
            List<Map<String, Object>> rows = records(serviceFor(tableName), Map.of(
                    "code", requiredCode, "statusIn", List.of(1, 2)));
            for (Map<String, Object> row : rows) {
                Map<String, Object> result = new LinkedHashMap<>(row);
                result.put("entityType", entityType);
                result.put("sourceTable", tableName);
                matches.add(result);
            }
        });
        if (matches.isEmpty()) {
            throw new CommonBusinessException("REFERENCE_DATA_CODE_NOT_FOUND", "未找到对应的引用数据配置。");
        }
        if (matches.size() != 1) {
            throw new CommonBusinessException("REFERENCE_DATA_CODE_DUPLICATE", "配置 code 在多个表中重复，已阻止继续使用。");
        }
        return buildSuccessResult(matches.get(0), "配置查询完成。");
    }

    /**
     * 读取一个页面的控件布局、表格元素和 Window 配置。
     * 真实传参示例：{@code page101090}。
     * 真实返回示例：返回 {@code controls/tableElements/windows/version} 四部分页面基线。
     * 异常或副作用示例：pageCode 非法时抛出业务异常；页面尚未登记时返回空集合和版本 0。
     *
     * @param pageCode 页面稳定 code
     * @return 页面编辑器可直接注册的数据库基线
     */
    @Override
    public CommonResult getPageConfiguration(String pageCode) {
        String requiredPageCode = requiredCode(pageCode);
        List<Map<String, Object>> controls = records(this, Map.of(
                "pageCode", requiredPageCode, "statusIn", List.of(1, 2)));
        controls.sort(recordOrder("orderNo"));
        Map<String, Object> table = singleRecord(tableService, Map.of(
                "pageCode", requiredPageCode, "statusIn", List.of(1, 2)));
        List<Map<String, Object>> elements = table.isEmpty() ? new ArrayList<>()
                : records(tableElementService, Map.of(
                        "tableId", table.get("id"), "statusIn", List.of(1, 2)));
        elements.sort(Comparator
                .comparing((Map<String, Object> row) -> String.valueOf(row.get("viewCode")))
                .thenComparing(recordOrder("sortnum")));
        List<Map<String, Object>> windows = records(windowService, Map.of(
                "pageCode", requiredPageCode, "statusIn", List.of(1, 2)));
        windows.sort(recordOrder("sortnum"));
        long version = controls.stream()
                .mapToLong(row -> longValue(row.get("versionNo"), 0L))
                .max()
                .orElse(0L);
        Map<String, Object> page = new LinkedHashMap<>();
        page.put("pageCode", requiredPageCode);
        page.put("version", version);
        page.put("table", table);
        page.put("controls", controls);
        page.put("tableElements", elements);
        page.put("windows", windows);
        page.put("treeNodes", treeNodes(requiredPageCode));
        return buildSuccessResult(page, "页面配置查询完成。");
    }

    /**
     * 通过工程和页面键解析数据库生成的 PAGE code，再复用页面配置主流程。
     * 真实传参示例：{@code japanese/n2-blue-book-question}。
     * 真实返回示例：命中 PAGE 后返回 {@code {pageCode:"page101100",table:{...},treeNodes:[...]}}。
     * 异常或副作用示例：未登记时返回 pageCode 为空的标准空配置；重复 PAGE 时抛出业务异常。
     *
     * @param projectCode 应用工程编码
     * @param pageKey 应用稳定页面键
     * @return 页面配置标准结果
     */
    @Override
    public CommonResult getPageConfiguration(String projectCode, String pageKey) {
        String requiredProjectCode = requiredStableKey(projectCode, "工程编码");
        String requiredPageKey = requiredStableKey(pageKey, "页面键");
        List<Map<String, Object>> pages = records(this, Map.of(
                "projectCode", requiredProjectCode,
                "controlKind", "PAGE",
                "fieldName", requiredPageKey,
                "statusIn", List.of(1, 2)));
        if (pages.isEmpty()) {
            Map<String, Object> emptyPage = new LinkedHashMap<>();
            emptyPage.put("projectCode", requiredProjectCode);
            emptyPage.put("pageKey", requiredPageKey);
            emptyPage.put("pageCode", "");
            emptyPage.put("version", 0L);
            emptyPage.put("table", Map.of());
            emptyPage.put("controls", List.of());
            emptyPage.put("tableElements", List.of());
            emptyPage.put("windows", List.of());
            emptyPage.put("treeNodes", List.of());
            return buildSuccessResult(emptyPage, "页面尚未登记，已返回组件默认配置。");
        }
        if (pages.size() != 1) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_PAGE_COORDINATE_DUPLICATE",
                    "同一工程和页面键存在重复 PAGE 登记，已阻止读取。");
        }
        return getPageConfiguration(String.valueOf(pages.get(0).get("pageCode")));
    }

    /**
     * 在一个事务中保存页面编辑器提交的全部受控变更。
     * 真实传参示例：页面 code 为 {@code page101090}，变更集包含
     *     {@code {"baseVersion":7,"controls":[{"code":"control101100","width":"320px"}]}}。
     * 真实返回示例：返回 {@code {"pageCode":"page101090","version":8,"updatedCount":1}}。
     * 异常或副作用示例：非管理员、版本冲突、code 不属于页面或尺寸非法时事务整体回滚并保留前端草稿。
     *
     * @param pageCode 页面稳定 code
     * @param changeSet 页面级草稿变更集
     * @return 新页面版本和实际更新数量
     */
    @Override
    @Transactional(transactionManager = "referenceDataTransactionManager")
    public CommonResult savePageConfiguration(String pageCode, Map<String, Object> changeSet) {
        if (!isAdmin()) {
            throw new CommonBusinessException("REFERENCE_DATA_ADMIN_REQUIRED", "只有管理员可以保存页面配置。");
        }
        String requiredPageCode = requiredCode(pageCode);
        Map<String, Object> requiredChangeSet = changeSet == null ? Map.of() : changeSet;
        long baseVersion = longValue(requiredChangeSet.get("baseVersion"), 0L);
        List<Map<String, Object>> pageControls = records(this, Map.of(
                "pageCode", requiredPageCode, "statusIn", List.of(1, 2)));
        long currentVersion = pageControls.stream()
                .mapToLong(row -> longValue(row.get("versionNo"), 0L))
                .max()
                .orElse(0L);
        if (baseVersion != currentVersion) {
            throw new CommonBusinessException("REFERENCE_DATA_PAGE_VERSION_CONFLICT", "页面配置已被其他管理员更新，请刷新后重试。");
        }
        int updatedCount = 0;
        updatedCount += updateRows(this, requiredPageCode,
                listValue(requiredChangeSet.get("controls")), CONTROL_FIELDS);
        Map<String, Object> pageTable = singleRecord(tableService, Map.of(
                "pageCode", requiredPageCode, "statusIn", List.of(1, 2)));
        long pageTableId = longValue(pageTable.get("id"), -1L);
        updatedCount += updateElements(pageTableId, listValue(requiredChangeSet.get("tableElements")));
        updatedCount += updateRows(windowService, requiredPageCode,
                listValue(requiredChangeSet.get("windows")), WINDOW_FIELDS);
        long newVersion = currentVersion + 1L;
        if (!pageControls.isEmpty()) {
            CommonBatchParam versionUpdate = new CommonBatchParam();
            versionUpdate.setItems(pageControls.stream().map(control -> {
                CommonParam item = new CommonParam();
                item.putParam("id", control.get("id"));
                item.putParam("versionNo", newVersion);
                return item;
            }).toList());
            updateBatch(versionUpdate);
        }
        Map<String, Object> saved = new LinkedHashMap<>();
        saved.put("pageCode", requiredPageCode);
        saved.put("version", newVersion);
        saved.put("updatedCount", updatedCount);
        return buildSuccessResult(saved, updatedCount, "页面配置已保存。");
    }

    private int updateRows(
            BaseService targetService,
            String pageCode,
            List<Map<String, Object>> changes,
            Set<String> allowedFields) {
        int count = 0;
        for (Map<String, Object> change : changes) {
            String code = requiredCode(String.valueOf(change.get("code")));
            Map<String, Object> values = validatedValues(change, allowedFields);
            if (values.isEmpty()) {
                continue;
            }
            Map<String, Object> record = singleRecord(targetService, Map.of(
                    "code", code, "statusIn", List.of(1, 2)));
            if (record.isEmpty() || !pageCode.equals(String.valueOf(record.get("pageCode")))) {
                throw new CommonBusinessException("REFERENCE_DATA_PAGE_CODE_MISMATCH", "配置 code 不属于当前页面。");
            }
            CommonParam update = new CommonParam();
            update.putParam("id", record.get("id"));
            values.forEach(update::putParam);
            targetService.update(update);
            count++;
        }
        return count;
    }

    private int updateElements(long pageTableId, List<Map<String, Object>> changes) {
        int count = 0;
        for (Map<String, Object> change : changes) {
            String code = requiredCode(String.valueOf(change.get("code")));
            Map<String, Object> values = validatedValues(change, ELEMENT_FIELDS);
            if (values.isEmpty()) {
                continue;
            }
            Map<String, Object> record = singleRecord(tableElementService, Map.of(
                    "code", code, "statusIn", List.of(1, 2)));
            long tableId = longValue(record.get("tableId"), -1L);
            if (record.isEmpty() || tableId != pageTableId) {
                throw new CommonBusinessException("REFERENCE_DATA_PAGE_CODE_MISMATCH", "表格元素 code 不属于当前页面。");
            }
            CommonParam update = new CommonParam();
            update.putParam("id", record.get("id"));
            values.forEach(update::putParam);
            tableElementService.update(update);
            count++;
        }
        return count;
    }

    /**
     * 通过固定表名选择对应业务 Service，禁止调用方提交或拼接数据库表名。
     * 真实传参示例：{@code ReferenceDataWindow} 返回 Window Service。
     * 真实返回示例：六个固定表名分别返回自身业务 Service；ControlLayout 返回当前配置 Service 的 BaseService 能力。
     * 异常或副作用示例：未知表名抛出 IllegalArgumentException；方法不访问数据库。
     *
     * @param tableName CONFIG_TABLES 中的固定表名
     * @return 只操作该固定表的业务 Service
     */
    private BaseService serviceFor(String tableName) {
        return switch (tableName) {
            case "ReferenceDataType" -> typeService;
            case "ReferenceDataTreeNode" -> treeNodeService;
            case "ReferenceDataTable" -> tableService;
            case "ReferenceDataTableElement" -> tableElementService;
            case "ReferenceDataControlLayout" -> this;
            case "ReferenceDataWindow" -> windowService;
            default -> throw new IllegalArgumentException("unsupported configuration table: " + tableName);
        };
    }

    /**
     * 通过业务 Service 分页读取全部匹配记录，避免 capability 直接接触 JdbcTemplate。
     * 真实传参示例：元素 Service 与 {@code {tableId:101020,viewCode:TYPE,statusIn:[1,2]}}。
     * 真实返回示例：总数 1201 时依次读取两页并返回完整 1201 条记录。
     * 异常或副作用示例：任一分页查询失败时直接传播业务异常，不返回残缺列表。
     *
     * @param targetService 当前固定表的业务 Service
     * @param filters 真实字段及受控后缀条件
     * @return 按数据库分页顺序合并的完整记录列表
     */
    private List<Map<String, Object>> records(BaseService targetService, Map<String, Object> filters) {
        List<Map<String, Object>> result = new ArrayList<>();
        int pageNo = 1;
        long totalCount;
        do {
            CommonPageParam query = new CommonPageParam();
            query.setPageNo(pageNo);
            query.setPageSize(SERVICE_PAGE_SIZE);
            filters.forEach(query::putParam);
            CommonPageResult page = targetService.getStore(query);
            result.addAll(page.getRecords());
            totalCount = page.getTotalCount();
            pageNo++;
        } while (result.size() < totalCount);
        return result;
    }

    /**
     * 查询应唯一命中的业务记录，并在重复时明确阻断配置歧义。
     * 真实传参示例：表格 Service 与 {@code {code:table101020,statusIn:[1,2]}}。
     * 真实返回示例：命中时返回表格记录，未命中时返回空 Map。
     * 异常或副作用示例：命中两条时抛出 REFERENCE_DATA_RECORD_DUPLICATE；方法不修改数据库。
     *
     * @param targetService 当前固定表的业务 Service
     * @param filters 唯一记录查询条件
     * @return 唯一记录或空 Map
     */
    private Map<String, Object> singleRecord(BaseService targetService, Map<String, Object> filters) {
        List<Map<String, Object>> matches = records(targetService, filters);
        if (matches.size() > 1) {
            throw new CommonBusinessException("REFERENCE_DATA_RECORD_DUPLICATE", "配置条件命中多条记录。");
        }
        return matches.isEmpty() ? Map.of() : matches.get(0);
    }

    /**
     * 读取当前页面独立树节点，并保持父节点优先、同级按 sortnum 和 id 的稳定顺序。
     * 真实传参示例：页面 {@code page101100} 返回 N2 根节点和三种题型节点。
     * 真实返回示例：返回 {@code [{code:"treeNode101110",parentId:null,nodeValue:"ALL"}] }。
     * 异常或副作用示例：页面没有树时返回空列表；方法只通过树节点 Service 查询且不修改数据。
     *
     * @param pageCode 数据库生成的页面 code
     * @return 当前页面的全部启用或停用树节点
     */
    private List<Map<String, Object>> treeNodes(String pageCode) {
        List<Map<String, Object>> nodes = records(treeNodeService, Map.of(
                "pageCode", pageCode,
                "statusIn", List.of(1, 2)));
        nodes.sort(Comparator
                .comparing((Map<String, Object> row) -> row.get("parentId") == null ? 0 : 1)
                .thenComparing(recordOrder("sortnum")));
        return nodes;
    }

    /**
     * 返回按业务排序字段和 id 的稳定比较器。
     * 真实传参示例：{@code sortnum} 把 10、20、20/id=3 排为 10、20/id较小、20/id较大。
     * 真实返回示例：可直接传给 List.sort 的比较器。
     * 异常或副作用示例：字段为空或不是数字时按 0 排序；方法不修改记录。
     *
     * @param fieldName 当前记录的数字排序字段
     * @return 先比较目标字段再比较 id 的稳定比较器
     */
    private Comparator<Map<String, Object>> recordOrder(String fieldName) {
        return Comparator
                .comparing((Map<String, Object> row) -> decimalValue(row.get(fieldName)))
                .thenComparingLong(row -> longValue(row.get("id"), 0L));
    }

    /**
     * 把数据库数字或数字文本转换为可稳定比较的小数值。
     * 真实传参示例：{@code new BigDecimal("10.00")} 或 {@code "20"} 分别返回 10.00 和 20。
     * 真实返回示例：空值或非法文本返回 {@link BigDecimal#ZERO}。
     * 异常或副作用示例：不向调用方传播数字格式异常，也不修改输入记录。
     *
     * @param value 数据库读取的排序字段值
     * @return 用于排序的十进制数值
     */
    private BigDecimal decimalValue(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return BigDecimal.ZERO;
        }
    }

    private Map<String, Object> validatedValues(Map<String, Object> change, Set<String> allowedFields) {
        Map<String, Object> values = new LinkedHashMap<>();
        change.forEach((field, value) -> {
            if ("code".equals(field)) {
                return;
            }
            if (!allowedFields.contains(field)) {
                throw new CommonBusinessException("REFERENCE_DATA_LAYOUT_FIELD_INVALID", "页面配置包含不允许修改的字段：" + field);
            }
            // 页面配置只剩宽高类 CSS 长度；间距字段删除后不再保留无法命中的校验分支。
            if ((field.toLowerCase().contains("width") || field.toLowerCase().contains("height")) && value != null
                    && !CSS_LENGTH_PATTERN.matcher(String.valueOf(value)).matches()) {
                throw new CommonBusinessException("REFERENCE_DATA_LAYOUT_VALUE_INVALID", "页面尺寸格式不正确。");
            }
            values.put(field, value);
        });
        return values;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> listValue(Object value) {
        if (value == null) {
            return List.of();
        }
        if (!(value instanceof List<?> list)) {
            throw new CommonBusinessException("REFERENCE_DATA_CHANGE_SET_INVALID", "页面变更集必须使用数组。");
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> map)) {
                throw new CommonBusinessException("REFERENCE_DATA_CHANGE_SET_INVALID", "页面变更项必须是对象。");
            }
            result.add((Map<String, Object>) map);
        }
        return result;
    }

    private String requiredCode(String code) {
        String normalized = code == null ? "" : code.trim();
        if (!CODE_PATTERN.matcher(normalized).matches()) {
            throw new CommonBusinessException("REFERENCE_DATA_CODE_INVALID", "配置 code 格式不正确。");
        }
        return normalized;
    }

    /**
     * 校验应用公开使用的工程编码或页面键，确保它只能作为 BaseDao 等值查询值。
     * 真实传参示例：{@code n2-blue-book-question} 原样返回。
     * 真实返回示例：合法小写短横线编码返回规范文本。
     * 异常或副作用示例：空值、空格或大写字符触发 REFERENCE_DATA_STABLE_KEY_INVALID；不访问数据库。
     *
     * @param value URL 路径中的工程编码或页面键
     * @param label 错误信息中的业务字段名
     * @return 已去除首尾空格的稳定编码
     */
    private String requiredStableKey(String value, String label) {
        String normalized = value == null ? "" : value.trim();
        if (!STABLE_KEY_PATTERN.matcher(normalized).matches()) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_STABLE_KEY_INVALID",
                    label + "格式不正确。");
        }
        return normalized;
    }

    private long longValue(Object value, long defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new CommonBusinessException("REFERENCE_DATA_VERSION_INVALID", "页面版本必须是整数。", exception);
        }
    }
}
