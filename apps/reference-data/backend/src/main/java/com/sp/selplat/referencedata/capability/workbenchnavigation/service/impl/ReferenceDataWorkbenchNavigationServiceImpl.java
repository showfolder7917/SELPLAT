package com.sp.selplat.referencedata.capability.workbenchnavigation.service.impl;

import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.capability.workbenchnavigation.service.ReferenceDataWorkbenchNavigationService;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 使用固定能力定义返回工作台导航，不读取任何数据库表。 */
@Service
public class ReferenceDataWorkbenchNavigationServiceImpl
        implements ReferenceDataWorkbenchNavigationService {

    /**
     * {@inheritDoc}
     *
     * 真实传参示例：页面首次打开时无参数调用。
     * 真实返回示例：依次返回数据类型、树与选项、表格定义、页面控件和 Window 五个模块。
     * 异常或副作用示例：方法不访问数据库、不修改缓存，也不返回表格字段一级模块。
     */
    @Override
    public CommonResult navigation() {
        List<Map<String, Object>> modules = List.of(
                module("types", "数据类型", "ri-database-2-line", "module"),
                module("tree", "树与选项", "ri-node-tree", "module"),
                module("tables", "表格定义", "ri-table-line", "tables-to-elements"),
                module("controls", "页面控件", "ri-layout-grid-line", "module"),
                module("windows", "Window", "ri-window-line", "module"));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("initialKey", "types");
        data.put("modules", modules);

        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setModuleCode("reference-data-workbench-navigation");
        result.setRequestPath("/api/reference-data/workbench/navigation.htm");
        result.setData(Collections.unmodifiableMap(data));
        result.setMsg("引用数据工作台导航加载完成。");
        return result;
    }

    /**
     * 创建一条稳定导航定义。
     *
     * @param key 前端模块键，例如 {@code "types"}
     * @param label 中文模块名称，例如 {@code "数据类型"}
     * @param icon Remix 图标类名，例如 {@code "ri-database-2-line"}
     * @param drilldown 下钻方式，例如 {@code "tables-to-columns"}
     * @return 只读导航记录，例如 {@code {"key":"types","label":"数据类型"}}
     */
    private Map<String, Object> module(String key, String label, String icon, String drilldown) {
        Map<String, Object> module = new LinkedHashMap<>();
        module.put("key", key);
        module.put("label", label);
        module.put("icon", icon);
        module.put("drilldown", drilldown);
        return Collections.unmodifiableMap(module);
    }
}
