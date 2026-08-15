package com.sp.selplat.referencedata.referencedatatype.service;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonResult;

/**
 * 声明 ReferenceDataType 固定表公共 CRUD，全部方法直接复用统一 BaseService 契约。
 */
public interface ReferenceDataTypeService extends BaseService {

    /**
     * 按唯一公开 code 查询启用类型。
     * 真实传参示例：{@code type101001}。
     * 真实返回示例：{@code {"success":true,"data":{"type":"DROPDOWN"}}}。
     * 异常或副作用示例：code 未命中时抛出 {@code REFERENCE_DATA_TYPE_CODE_NOT_FOUND}；不写数据库。
     *
     * @param typeCode 类型唯一 code
     * @return 类型详情公共结果
     */
    CommonResult getTypeByCode(String typeCode);
}
