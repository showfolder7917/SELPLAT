package com.sp.selplat.referencedata.backend.referencedatatype.service;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/**
 * 声明 ReferenceDataType 固定表公共 CRUD 及现有路径主键兼容入口。
 */
public interface ReferenceDataTypeService extends BaseService {

    CommonResult getById(long id);

    CommonResult update(long id, CommonParam saveIn);

    CommonResult delete(long id);
}
