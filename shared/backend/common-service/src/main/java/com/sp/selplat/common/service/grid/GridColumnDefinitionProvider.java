package com.sp.selplat.common.service.grid;

import java.util.List;
import java.util.Map;

/**
 * 为公共 getGridColumn 链路提供可选的业务表格头配置，不限定配置来自同一进程还是独立服务。
 * 实现只返回已经转换成 SEL Grid 契约的列；未命中、不可用或不负责当前表格时返回空列表。
 */
public interface GridColumnDefinitionProvider {

    /**
     * 查询一个业务表格实例的已启用列配置。
     *
     * @param tableName 当前业务 Service 的真实表名，例如 {@code "ReferenceDataType"}
     * @param gridId 页面传入的稳定表格实例标识，例如 {@code "selGridTypeManagementId"}
     * @param locale 页面当前语言，例如 {@code "zh-CN"}
     * @return 已转换列，例如 {@code [{"id":"nameZh","field":"nameZh","label":"中文名称"}]}；
     *     未配置或当前提供者不可用时返回空列表
     */
    List<Map<String, Object>> resolve(String tableName, String gridId, String locale);
}
