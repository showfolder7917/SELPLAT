package com.sp.selplat.referencedata.referencedatatablecolumn.service.impl;

import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.common.util.ReferenceDataQueryUtil;
import com.sp.selplat.referencedata.referencedatatablecolumn.dao.ReferenceDataTableColumnDao;
import com.sp.selplat.referencedata.referencedatatablecolumn.service.ReferenceDataTableColumnService;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 维护表格头记录并把数据库配置转换为 selGrid 标准列定义。 */
@Service
public class ReferenceDataTableColumnServiceImpl
        extends BaseServiceImpl<ReferenceDataTableColumnDao>
        implements ReferenceDataTableColumnService {

    /**
     * {@inheritDoc}
     *
     * 异常或副作用示例：没有启用显示列时返回空数组，由页面使用只读安全默认列，不修改数据库。
     */
    @Override
    public CommonResult resolveColumns(String tableName, String gridId, String locale) {
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
        Map<String, Object> resolved = new LinkedHashMap<>();
        resolved.put("source", rows.isEmpty() ? "SAFE_DEFAULT" : "REFERENCE_DATA_TABLE_COLUMN");
        resolved.put("tableName", tableName);
        resolved.put("gridId", gridId);
        resolved.put("locale", normalizedLocale);
        resolved.put("columns", List.copyOf(columns));
        return buildSuccessResult(Collections.unmodifiableMap(resolved), "页面表格头解析完成。");
    }
}
