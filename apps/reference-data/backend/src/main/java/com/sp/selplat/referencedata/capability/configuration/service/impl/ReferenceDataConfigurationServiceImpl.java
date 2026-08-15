package com.sp.selplat.referencedata.capability.configuration.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.capability.configuration.service.ReferenceDataConfigurationService;
import com.sp.selplat.referencedata.referencedatacontrollayout.dao.ReferenceDataControlLayoutDao;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
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
    // 控件布局只允许页面编辑协议中明确登记的字段。
    private static final Set<String> CONTROL_FIELDS = Set.of(
            "orderNo", "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
            "gapBefore", "gapAfter", "gridColumnSpan", "wrap", "x", "y", "breakpoint");
    // 表格元素页面编辑只维护显示布局，不修改字段绑定和渲染业务。
    private static final Set<String> ELEMENT_FIELDS = Set.of("width", "visible", "sortnum");
    // Window 页面编辑只维护几何状态和受控定位模式。
    private static final Set<String> WINDOW_FIELDS = Set.of(
            "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
            "x", "y", "positionMode", "breakpoint");

    private final JdbcTemplate jdbcTemplate;

    /**
     * 创建只访问 reference-data 私有数据库的配置服务。
     * 真实传参示例：Spring 注入名为 {@code referenceDataJdbcTemplate} 的模板。
     * 真实返回示例：服务可查询六张固定配置表并参与同一事务管理器。
     * 异常或副作用示例：具名模板缺失时应用启动失败，不会回退其他项目数据源。
     *
     * @param jdbcTemplate reference-data 模块私有 JDBC 模板
     */
    public ReferenceDataConfigurationServiceImpl(
            @Qualifier("referenceDataJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
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
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT e.* FROM ReferenceDataTableElement e JOIN ReferenceDataTable t ON t.id=e.tableId "
                        + "WHERE t.dataTableName=? AND t.code=? AND t.status<>0 "
                        + "AND e.elementType='COLUMN' AND e.status<>0 AND e.visible=TRUE ORDER BY e.sortnum,e.id",
                tableName.trim(), tableCode.trim());
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
     * @param code 后端生成的全局对象 code
     * @return 包含配置记录、实体类型和来源表的统一结果
     */
    @Override
    public CommonResult getByCode(String code) {
        String requiredCode = requiredCode(code);
        List<Map<String, Object>> matches = new ArrayList<>();
        CONFIG_TABLES.forEach((tableName, entityType) -> {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT * FROM " + tableName + " WHERE code = ? AND status <> 0",
                    requiredCode);
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
        List<Map<String, Object>> controls = jdbcTemplate.queryForList(
                "SELECT * FROM ReferenceDataControlLayout WHERE pageCode = ? AND status <> 0 ORDER BY orderNo,id",
                requiredPageCode);
        List<Map<String, Object>> elements = jdbcTemplate.queryForList(
                "SELECT e.* FROM ReferenceDataTableElement e JOIN ReferenceDataTable t ON t.id=e.tableId "
                        + "WHERE t.pageCode=? AND e.status<>0 ORDER BY e.tableId,e.sortnum,e.id",
                requiredPageCode);
        List<Map<String, Object>> windows = jdbcTemplate.queryForList(
                "SELECT * FROM ReferenceDataWindow WHERE pageCode = ? AND status <> 0 ORDER BY sortnum,id",
                requiredPageCode);
        long version = controls.stream()
                .mapToLong(row -> longValue(row.get("versionNo"), 0L))
                .max()
                .orElse(0L);
        Map<String, Object> page = new LinkedHashMap<>();
        page.put("pageCode", requiredPageCode);
        page.put("version", version);
        page.put("controls", controls);
        page.put("tableElements", elements);
        page.put("windows", windows);
        return buildSuccessResult(page, "页面配置查询完成。");
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
        long currentVersion = jdbcTemplate.queryForObject(
                "SELECT COALESCE(MAX(versionNo),0) FROM ReferenceDataControlLayout WHERE pageCode=? AND status<>0",
                Long.class,
                requiredPageCode);
        if (baseVersion != currentVersion) {
            throw new CommonBusinessException("REFERENCE_DATA_PAGE_VERSION_CONFLICT", "页面配置已被其他管理员更新，请刷新后重试。");
        }
        int updatedCount = 0;
        updatedCount += updateRows("ReferenceDataControlLayout", requiredPageCode,
                listValue(requiredChangeSet.get("controls")), CONTROL_FIELDS);
        updatedCount += updateElements(requiredPageCode, listValue(requiredChangeSet.get("tableElements")));
        updatedCount += updateRows("ReferenceDataWindow", requiredPageCode,
                listValue(requiredChangeSet.get("windows")), WINDOW_FIELDS);
        long newVersion = currentVersion + 1L;
        jdbcTemplate.update(
                "UPDATE ReferenceDataControlLayout SET versionNo=?,lastOperateUserId=?,updatedAt=CURRENT_TIMESTAMP "
                        + "WHERE pageCode=? AND status<>0",
                newVersion,
                getCurrentOperatorId(),
                requiredPageCode);
        Map<String, Object> saved = new LinkedHashMap<>();
        saved.put("pageCode", requiredPageCode);
        saved.put("version", newVersion);
        saved.put("updatedCount", updatedCount);
        return buildSuccessResult(saved, updatedCount, "页面配置已保存。");
    }

    private int updateRows(
            String tableName,
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
            List<Object> arguments = new ArrayList<>(values.values());
            arguments.add(getCurrentOperatorId());
            arguments.add(code);
            arguments.add(pageCode);
            String assignments = String.join(",", values.keySet().stream().map(field -> field + "=?").toList());
            int affected = jdbcTemplate.update(
                    "UPDATE " + tableName + " SET " + assignments
                            + ",lastOperateUserId=?,updatedAt=CURRENT_TIMESTAMP WHERE code=? AND pageCode=? AND status<>0",
                    arguments.toArray());
            if (affected != 1) {
                throw new CommonBusinessException("REFERENCE_DATA_PAGE_CODE_MISMATCH", "配置 code 不属于当前页面。");
            }
            count += affected;
        }
        return count;
    }

    private int updateElements(String pageCode, List<Map<String, Object>> changes) {
        int count = 0;
        for (Map<String, Object> change : changes) {
            String code = requiredCode(String.valueOf(change.get("code")));
            Map<String, Object> values = validatedValues(change, ELEMENT_FIELDS);
            if (values.isEmpty()) {
                continue;
            }
            List<Object> arguments = new ArrayList<>(values.values());
            arguments.add(getCurrentOperatorId());
            arguments.add(code);
            arguments.add(pageCode);
            String assignments = String.join(",", values.keySet().stream().map(field -> "e." + field + "=?").toList());
            int affected = jdbcTemplate.update(
                    "UPDATE ReferenceDataTableElement e SET " + assignments
                            + ",e.lastOperateUserId=?,e.updatedAt=CURRENT_TIMESTAMP WHERE e.code=? AND e.status<>0 "
                            + "AND EXISTS(SELECT 1 FROM ReferenceDataTable t WHERE t.id=e.tableId AND t.pageCode=?)",
                    arguments.toArray());
            if (affected != 1) {
                throw new CommonBusinessException("REFERENCE_DATA_PAGE_CODE_MISMATCH", "表格元素 code 不属于当前页面。");
            }
            count += affected;
        }
        return count;
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
            if ((field.toLowerCase().contains("width") || field.toLowerCase().contains("height")
                    || field.toLowerCase().contains("gap")) && value != null
                    && !CSS_LENGTH_PATTERN.matcher(String.valueOf(value)).matches()) {
                throw new CommonBusinessException("REFERENCE_DATA_LAYOUT_VALUE_INVALID", "页面尺寸或间距格式不正确。");
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
