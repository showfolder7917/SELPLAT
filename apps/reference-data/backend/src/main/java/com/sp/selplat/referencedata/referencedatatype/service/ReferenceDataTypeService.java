package com.sp.selplat.referencedata.referencedatatype.service;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonResult;
import java.util.Map;

/**
 * 声明 ReferenceDataType 固定表公共 CRUD，全部方法直接复用统一 BaseService 契约。
 */
public interface ReferenceDataTypeService extends BaseService {

    /**
     * 按唯一公开 code 查询启用类型。
     * 真实传参示例：{@code type101001}。
     * 真实返回示例：{@code {"success":true,"data":{"optionSetCode":"optionSet107000","valueCode":"DROPDOWN"}}}。
     * 异常或副作用示例：code 未命中时抛出 {@code REFERENCE_DATA_TYPE_CODE_NOT_FOUND}；不写数据库。
     *
     * @param typeCode 类型唯一 code
     * @return 类型详情公共结果
     */
    CommonResult getTypeByCode(String typeCode);

    /**
     * 按稳定选项组 code 查询全部启用选项，并根据页面语言返回显示名称。
     * 真实传参示例：{@code optionSet103006} 与 {@code {"locale":"zh-CN"}}。
     * 真实返回示例：{@code {"success":true,"data":[{"value":"ENGINEER","label":"工程师"},{"value":"REVIEWER","label":"审核员"}]}}。
     * 异常或副作用示例：非法 code 抛出 {@code REFERENCE_DATA_OPTION_SET_CODE_INVALID}；查询不写数据库。
     *
     * @param optionSetCode ReferenceDataType 共享选项组稳定 code
     * @param parameters 页面语言等查询参数
     * @return 已按业务顺序排列的启用选项公共结果
     */
    CommonResult getOptionsByOptionSetCode(String optionSetCode, Map<String, String> parameters);
}
