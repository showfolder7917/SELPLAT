package com.sp.selplat.mda.connection.service;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.jdbc.MdaConnectionDefinition;

/**
 * 连接配置服务统一提供保存、脱敏读取、连接测试和 JDBC 运行配置加载。
 */
public interface MdaConnectionProfileService extends BaseService {
    CommonPageResult getStore(CommonPageParam queryIn);
    CommonResult getById(CommonParam queryIn);
    CommonResult insert(CommonParam saveIn);
    CommonResult update(CommonParam saveIn);
    CommonResult delete(CommonParam deleteIn);
    CommonResult testConnection(CommonParam testIn);
    MdaConnectionDefinition loadDefinition(CommonParam queryIn);
}
