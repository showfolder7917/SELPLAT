package com.sp.selplat.referencedata.referencedatatablecolumn.controller;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedatatablecolumn.service.ReferenceDataTableColumnService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 发布 ReferenceDataTableColumn 的维护接口和页面表头解析接口。 */
@RestController
@ModuleDescription(code = "reference-data-table-column", name = "页面表格头", description = "维护业务配置驱动的页面表格列")
@RequestMapping(value = "/api/reference-data/admin/table-columns/", produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferenceDataTableColumnController extends BaseController<ReferenceDataTableColumnService> {

    /**
     * 解析一个页面表格当前启用的真实列配置。
     *
     * @param tableName 数据库表名，例如 {@code "ReferenceDataOption"}
     * @param gridId SEL 表格实例标识，例如 {@code "selGridOptionManagementId"}
     * @param locale 当前语言，例如 {@code "zh-CN"}
     * @return 标准列 JSON，例如 {@code {"success":true,"data":{"columns":[{"field":"optionValue"}]}}}
     */
    @GetMapping("resolve.htm")
    public String resolve(
            @RequestParam("tableName") String tableName,
            @RequestParam("gridId") String gridId,
            @RequestParam(value = "locale", defaultValue = "zh-CN") String locale) {
        return JsonUtils.toJsonIgnoreNull(getService().resolveColumns(tableName, gridId, locale));
    }
}
