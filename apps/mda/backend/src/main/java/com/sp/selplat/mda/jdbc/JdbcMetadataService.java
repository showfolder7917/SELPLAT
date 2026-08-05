package com.sp.selplat.mda.jdbc;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/**
 * 读取目标数据库目录、模式、表和字段的中立元数据树。
 */
public interface JdbcMetadataService extends BaseService {
    CommonResult getTree(CommonParam queryIn);
}
