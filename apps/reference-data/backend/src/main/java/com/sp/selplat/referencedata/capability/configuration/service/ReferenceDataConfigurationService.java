package com.sp.selplat.referencedata.capability.configuration.service;

import com.sp.selplat.common.util.CommonResult;
import java.util.List;
import java.util.Map;

/** 声明通过唯一 code 解析配置以及按页面一次保存全部布局变更的能力。 */
public interface ReferenceDataConfigurationService {

    /**
     * 返回当前操作员是否可使用页面编辑能力。
     * 真实传参示例：当前方法无业务参数，身份由 BaseService 当前操作员上下文读取。
     * 真实返回示例：管理员返回 {@code {"canEditPage":true}}。
     * 异常或副作用示例：方法只读取权限，不修改数据库；身份能力异常时由统一异常链返回失败。
     *
     * @return 页面编辑权限结果
     */
    CommonResult getPageEditorCapability();

    /**
     * 通过表格唯一 code 解析 SEL Grid 的可见列配置。
     * 真实传参示例：表名 {@code ReferenceDataType}、表格 code {@code table101018}、语言 {@code zh-CN}。
     * 真实返回示例：返回 {@code [{"id":"nameZh","field":"nameZh","label":"中文名称"}]}。
     * 异常或副作用示例：code 与表名不匹配时返回空列表；方法不修改数据库。
     *
     * @param tableName 当前业务 Service 的真实表名
     * @param tableCode ReferenceDataTable 的唯一 code
     * @param locale 页面语言
     * @return SEL Grid 标准列配置
     */
    List<Map<String, Object>> resolveGridColumns(String tableName, String tableCode, String locale);

    CommonResult getByCode(String code);

    CommonResult getPageConfiguration(String pageCode);

    CommonResult savePageConfiguration(String pageCode, Map<String, Object> changeSet);
}
