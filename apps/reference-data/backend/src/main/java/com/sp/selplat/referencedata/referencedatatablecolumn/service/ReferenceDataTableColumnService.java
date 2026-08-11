package com.sp.selplat.referencedata.referencedatatablecolumn.service;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonResult;

/** 声明表格头配置的公共 CRUD 与页面列解析能力。 */
public interface ReferenceDataTableColumnService extends BaseService {

    /**
     * 按数据库表、页面实例和语言解析真实表头。
     *
     * @param tableCode 数据库表名，例如 {@code "ReferenceDataOption"}
     * @param viewCode 页面实例编码，例如 {@code "option-management"}
     * @param locale 当前语言，例如 {@code "zh-CN"}
     * @return 列配置结果，例如 {@code {"success":true,"data":[{"id":"option","label":"选项值"}]}}
     */
    CommonResult resolveColumns(String tableCode, String viewCode, String locale);
}
