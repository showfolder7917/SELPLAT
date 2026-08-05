package com.sp.selplat.mda.jdbc;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/**
 * 执行前端完整 SQL 载荷并返回 JDBC 多结果集。
 */
public interface JdbcSqlService extends BaseService {
    CommonResult execute(CommonParam executeIn);
}
