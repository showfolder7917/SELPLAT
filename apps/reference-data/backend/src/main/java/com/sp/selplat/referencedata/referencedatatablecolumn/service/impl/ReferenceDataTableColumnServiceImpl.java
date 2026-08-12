package com.sp.selplat.referencedata.referencedatatablecolumn.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.referencedata.common.util.ReferenceDataQueryUtil;
import com.sp.selplat.referencedata.referencedatatablecolumn.dao.ReferenceDataTableColumnDao;
import com.sp.selplat.referencedata.referencedatatablecolumn.service.ReferenceDataTableColumnService;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 维护表格头记录并把数据库配置转换为 selGrid 标准列定义。 */
@Service
public class ReferenceDataTableColumnServiceImpl
        extends BaseServiceImpl<ReferenceDataTableColumnDao>
        implements ReferenceDataTableColumnService {

    // 页面编辑坐标只接受稳定英文标识，防止空值、路径或 SQL 片段进入数据库定位条件。
    private static final Pattern PAGE_EDITOR_COORDINATE_PATTERN =
            Pattern.compile("^[A-Za-z][A-Za-z0-9_-]{0,99}$");
    // 拖拽持久化只接受明确像素宽度，避免保存无法复现的浏览器计算值。
    private static final Pattern PAGE_EDITOR_PIXEL_WIDTH_PATTERN =
            Pattern.compile("^([0-9]{2,3})px$");
    // 公共 Grid 当前允许的持久化列宽边界与交互边界保持一致。
    private static final int PAGE_EDITOR_MINIMUM_WIDTH = 72;
    private static final int PAGE_EDITOR_MAXIMUM_WIDTH = 960;

    /**
     * {@inheritDoc}
     *
     * 异常或副作用示例：没有启用显示列时返回空数组，由页面使用只读安全默认列，不修改数据库。
     */
    @Override
    public CommonResult resolveColumns(String tableName, String gridId, String locale) {
        List<Map<String, Object>> columns = resolveColumnDefinitions(tableName, gridId, locale);
        String normalizedLocale = ReferenceDataQueryUtil.locale(Map.of("locale", locale == null ? "zh-CN" : locale));
        // 兼容远程客户端的旧接口；未配置只返回空列，不制造需要展示的错误消息。
        Map<String, Object> resolved = new LinkedHashMap<>();
        resolved.put("source", columns.isEmpty() ? "NOT_CONFIGURED" : "REFERENCE_DATA_TABLE_COLUMN");
        resolved.put("tableName", tableName);
        resolved.put("gridId", gridId);
        resolved.put("locale", normalizedLocale);
        resolved.put("columns", columns);
        return buildSuccessResult(Collections.unmodifiableMap(resolved), "页面表格头解析完成。");
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> resolveColumnDefinitions(String tableName, String gridId, String locale) {
        List<Map<String, Object>> rows = getDao().findVisibleColumns(
                tableName == null ? "" : tableName.trim(),
                gridId == null ? "" : gridId.trim());
        String normalizedLocale = ReferenceDataQueryUtil.locale(Map.of("locale", locale == null ? "zh-CN" : locale));
        List<Map<String, Object>> columns = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            // 数据库字段 → selGrid 公共列契约；业务页面无需维护第二份表头名称和宽度。
            Map<String, Object> column = new LinkedHashMap<>();
            column.put("id", String.valueOf(row.get("gridColumnId")));
            column.put("field", String.valueOf(row.get("tableFieldName")));
            column.put("secondaryField", row.get("tableSecondaryFieldName") == null
                    ? null : String.valueOf(row.get("tableSecondaryFieldName")));
            column.put("label", ReferenceDataQueryUtil.label(row, normalizedLocale));
            column.put("width", String.valueOf(row.get("width")));
            column.put("renderer", String.valueOf(row.get("cellRenderer")));
            column.put("cellIcon", row.get("cellIcon"));
            column.put("cellIconVisible", Boolean.TRUE.equals(row.get("cellIconVisible")));
            columns.add(Collections.unmodifiableMap(column));
        }
        return List.copyOf(columns);
    }

    /**
     * 返回当前操作员能否使用管理员页面编辑能力。
     * 真实传参示例：当前方法无参数，Reference Data 页面初始化时调用。
     * 真实返回示例：当前管理员返回
     *     {@code {"success":true,"data":{"admin":true,"canEditPage":true},"msg":"页面编辑权限查询完成。"}}。
     * 异常或副作用示例：当前方法只读取基础 Service 权限结论，不访问或修改数据库。
     *
     * @return 固定页面编辑能力结果
     */
    @Override
    public CommonResult getPageEditorCapability() {
        // 管理员事实来自唯一基础入口；将来接入登录时页面接口不需要改变返回契约。
        boolean admin = isAdmin();
        Map<String, Object> capability = new LinkedHashMap<>();
        capability.put("admin", admin);
        capability.put("canEditPage", admin);
        return buildSuccessResult(Collections.unmodifiableMap(capability), "页面编辑权限查询完成。");
    }

    /**
     * 校验管理员身份和稳定数据库坐标后，原子保存一个表格的多列像素宽度。
     * 真实传参示例：传入
     *     {@code {"tableName":"ReferenceDataTable","gridId":"selGridTableManagementId",}
     *     {@code "widths":"[{\"gridColumnId\":\"projectName\",\"width\":\"180px\"}]"}}。
     * 真实返回示例：命中一列时返回
     *     {@code {"success":true,"data":{"tableName":"ReferenceDataTable","gridId":"selGridTableManagementId",}
     *     {@code "columns":[{"gridColumnId":"projectName","width":"180px"}]},"affectedRows":1,}
     *     {@code "msg":"页面表格列宽保存完成。"}}。
     * 异常或副作用示例：非管理员抛出 {@code PAGE_EDITOR_ADMIN_REQUIRED}；任一坐标未命中时抛出
     *     {@code PAGE_EDITOR_COLUMN_NOT_FOUND} 并由事务回滚本次全部列宽更新。
     *
     * @param saveIn Controller 表单解析出的表格坐标和列宽 JSON
     * @return 包含真实保存坐标、规范化列宽和影响行数的固定结果
     */
    @Override
    @Transactional("referenceDataTransactionManager")
    public CommonResult saveColumnWidths(CommonParam saveIn) {
        // 页面隐藏不是安全边界；每次正式保存都必须由后台重新确认管理员身份。
        if (!isAdmin()) {
            throw new CommonBusinessException(
                    "PAGE_EDITOR_ADMIN_REQUIRED",
                    "只有管理员可以保存页面配置。");
        }
        String tableName = normalizeCoordinate(saveIn.getParam("tableName"), "业务数据表");
        String gridId = normalizeCoordinate(saveIn.getParam("gridId"), "表格控件 ID");
        List<Map<String, Object>> requestedWidths = parseRequestedWidths(saveIn.getParam("widths"));
        Map<String, String> columnWidths = normalizeColumnWidths(requestedWidths);
        // 当前租户和操作员完全由服务端身份入口提供，页面不提交也不能覆盖两个值。
        int affectedRows = getDao().updateColumnWidths(
                tableName,
                gridId,
                columnWidths,
                getCurrentTenantId(),
                getCurrentOperatorId());
        if (affectedRows != columnWidths.size()) {
            // 部分坐标不存在时阻断整次保存，避免用户看到只有部分表头被悄悄持久化。
            throw new CommonBusinessException(
                    "PAGE_EDITOR_COLUMN_NOT_FOUND",
                    "部分表格列配置不存在或不可编辑，请刷新页面后重试。");
        }
        List<Map<String, Object>> savedColumns = columnWidths.entrySet().stream()
                .map(columnWidth -> Map.<String, Object>of(
                        "gridColumnId", columnWidth.getKey(),
                        "width", columnWidth.getValue()))
                .toList();
        Map<String, Object> saved = new LinkedHashMap<>();
        saved.put("tableName", tableName);
        saved.put("gridId", gridId);
        saved.put("columns", savedColumns);
        return buildSuccessResult(
                Collections.unmodifiableMap(saved),
                affectedRows,
                "页面表格列宽保存完成。");
    }

    /** 把页面坐标规范化为可安全绑定查询的稳定英文标识。 */
    private String normalizeCoordinate(Object value, String label) {
        String coordinate = value == null ? "" : String.valueOf(value).trim();
        if (!PAGE_EDITOR_COORDINATE_PATTERN.matcher(coordinate).matches()) {
            throw new CommonBusinessException(
                    "INVALID_PAGE_EDITOR_COORDINATE",
                    label + "格式不正确。");
        }
        return coordinate;
    }

    /** 把表单中的列宽 JSON 解析为有序请求，非法 JSON 使用稳定业务错误返回。 */
    private List<Map<String, Object>> parseRequestedWidths(Object value) {
        String widthsJson = value == null ? "" : String.valueOf(value).trim();
        if (widthsJson.isEmpty()) {
            throw new CommonBusinessException("EMPTY_PAGE_EDITOR_WIDTHS", "没有需要保存的表格列宽。");
        }
        try {
            List<Map<String, Object>> widths = JsonUtils.fromJson(
                    widthsJson,
                    new TypeReference<List<Map<String, Object>>>() { });
            if (widths == null || widths.isEmpty()) {
                throw new CommonBusinessException("EMPTY_PAGE_EDITOR_WIDTHS", "没有需要保存的表格列宽。");
            }
            return widths;
        } catch (CommonBusinessException exception) {
            throw exception;
        } catch (IllegalStateException exception) {
            throw new CommonBusinessException(
                    "INVALID_PAGE_EDITOR_WIDTHS_JSON",
                    "表格列宽数据格式不正确。",
                    exception);
        }
    }

    /** 校验列标识、重复项和像素范围，并生成 DAO 可直接使用的稳定映射。 */
    private Map<String, String> normalizeColumnWidths(List<Map<String, Object>> requestedWidths) {
        Map<String, String> columnWidths = new LinkedHashMap<>();
        Set<String> seenColumnIds = new HashSet<>();
        for (Map<String, Object> requestedWidth : requestedWidths) {
            String gridColumnId = normalizeCoordinate(requestedWidth.get("gridColumnId"), "表格列 ID");
            if (!seenColumnIds.add(gridColumnId)) {
                throw new CommonBusinessException(
                        "DUPLICATE_PAGE_EDITOR_COLUMN",
                        "同一个表格列不能重复保存。");
            }
            String width = requestedWidth.get("width") == null
                    ? "" : String.valueOf(requestedWidth.get("width")).trim();
            Matcher widthMatcher = PAGE_EDITOR_PIXEL_WIDTH_PATTERN.matcher(width);
            if (!widthMatcher.matches()) {
                throw new CommonBusinessException(
                        "INVALID_PAGE_EDITOR_COLUMN_WIDTH",
                        "表格列宽必须使用像素值。");
            }
            int widthPixels = Integer.parseInt(widthMatcher.group(1));
            if (widthPixels < PAGE_EDITOR_MINIMUM_WIDTH || widthPixels > PAGE_EDITOR_MAXIMUM_WIDTH) {
                throw new CommonBusinessException(
                        "PAGE_EDITOR_COLUMN_WIDTH_OUT_OF_RANGE",
                        "表格列宽必须在 72px 到 960px 之间。");
            }
            columnWidths.put(gridColumnId, widthPixels + "px");
        }
        return Collections.unmodifiableMap(columnWidths);
    }
}
