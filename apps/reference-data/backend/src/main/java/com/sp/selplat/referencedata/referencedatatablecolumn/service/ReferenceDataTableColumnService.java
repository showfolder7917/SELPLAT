package com.sp.selplat.referencedata.referencedatatablecolumn.service;

import com.sp.selplat.common.service.BaseService;
import java.util.List;
import java.util.Map;
import com.sp.selplat.common.util.CommonResult;

/** 声明表格头配置的公共 CRUD 与页面列解析能力。 */
public interface ReferenceDataTableColumnService extends BaseService {

    /**
     * 按数据库表、页面实例和语言解析真实表头。
     *
     * @param tableName 数据库表名，例如 {@code "ReferenceDataOption"}
     * @param gridId SEL 表格实例标识，例如 {@code "selGridOptionManagementId"}
     * @param locale 当前语言，例如 {@code "zh-CN"}
     * @return 列配置结果，例如 {@code {"success":true,"data":[{"id":"option","label":"选项值"}]}}
     */
    CommonResult resolveColumns(String tableName, String gridId, String locale);

    /**
     * 为公共 getGridColumn 本地提供者返回已经转换完成的启用列。
     *
     * @param tableName 当前业务数据表，例如 {@code "ReferenceDataType"}
     * @param gridId SEL 表格实例标识，例如 {@code "selGridTypeManagementId"}
     * @param locale 当前语言，例如 {@code "zh-CN"}
     * @return 标准列，例如 {@code [{"id":"nameZh","field":"nameZh","label":"中文名称"}]}；未配置返回空列表
     */
    List<Map<String, Object>> resolveColumnDefinitions(String tableName, String gridId, String locale);
}
