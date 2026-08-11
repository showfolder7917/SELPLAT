package com.sp.selplat.referencedata.referencedatacontextmenuitem.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.common.util.ReferenceDataQueryUtil;
import com.sp.selplat.referencedata.referencedatacontextmenuitem.dao.ReferenceDataContextMenuItemDao;
import com.sp.selplat.referencedata.referencedatacontextmenuitem.service.ReferenceDataContextMenuItemService;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 从 ReferenceDataContextMenuItem 表读取平铺记录并组装公共 Map 多级菜单。 */
@Service
public class ReferenceDataContextMenuItemServiceImpl
        extends BaseServiceImpl<ReferenceDataContextMenuItemDao>
        implements ReferenceDataContextMenuItemService {

    /** {@inheritDoc} */
    @Override
    public CommonResult getContextMenu(
            String projectCode,
            String resourceCode,
            Map<String, String> parameters) {
        List<Map<String, Object>> rows = getDao().findEnabledMenuItems(projectCode, resourceCode);
        if (rows.isEmpty()) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_CONTEXT_MENU_NOT_FOUND",
                    "未找到引用数据右键菜单：" + projectCode + "/" + resourceCode);
        }
        String locale = ReferenceDataQueryUtil.locale(parameters);
        Map<String, List<Map<String, Object>>> rowsByParent = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String parentCode = row.get("parentCode") == null ? "" : String.valueOf(row.get("parentCode"));
            rowsByParent.computeIfAbsent(parentCode, ignored -> new ArrayList<>()).add(row);
        }
        List<Map<String, Object>> menuItems = buildChildren("", rowsByParent, locale);
        String path = "/api/reference-data/" + projectCode.trim() + "/" + resourceCode.trim() + "/context-menu";
        return ReferenceDataQueryUtil.success(menuItems, path, "引用数据右键菜单查询完成。");
    }

    /**
     * 递归把同一父菜单下的数据库记录组装为公共 Map 菜单项。
     *
     * @param parentCode 当前父菜单编码，例如 {@code "create"}；根层为空字符串
     * @param rowsByParent 按父编码分组的真实数据库记录
     * @param locale 已规范化语言，例如 {@code "zh-CN"}
     * @return 菜单列表，例如 {@code [{"code":"create","children":[...]}]}
     * 异常或副作用示例：没有子菜单时返回空列表，不修改 DAO 原始记录。
     */
    private List<Map<String, Object>> buildChildren(
            String parentCode,
            Map<String, List<Map<String, Object>>> rowsByParent,
            String locale) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> row : rowsByParent.getOrDefault(parentCode, List.of())) {
            String itemCode = String.valueOf(row.get("itemCode"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("code", itemCode);
            item.put("label", ReferenceDataQueryUtil.label(row, locale));
            item.put("icon", row.get("icon") == null ? null : String.valueOf(row.get("icon")));
            item.put("command", row.get("command") == null ? null : String.valueOf(row.get("command")));
            item.put("disabled", Boolean.TRUE.equals(row.get("disabled")));
            item.put("children", buildChildren(itemCode, rowsByParent, locale));
            item.put("attributes", ReferenceDataQueryUtil.attributes(row.get("attributesJson")));
            items.add(Collections.unmodifiableMap(item));
        }
        return List.copyOf(items);
    }
}
