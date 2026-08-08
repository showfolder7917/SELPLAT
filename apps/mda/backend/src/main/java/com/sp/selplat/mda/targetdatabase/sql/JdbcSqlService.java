package com.sp.selplat.mda.targetdatabase.sql;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/**
 * 执行前端完整 SQL 载荷并返回 JDBC 多结果集。
 */
public interface JdbcSqlService {

    /**
     * 原样执行页面提交的 SQL；非自动提交模式成功后提交，失败时回滚。
     *
     * @param executeIn 连接、SQL 和执行限制，例如
     *     {@code {"connectionId":10001,"sql":"select id from sample","maxRows":1000,"autoCommit":true}}
     * @return JDBC 多结果结果，例如
     *     {@code {"success":true,"data":{"results":[{"kind":"resultSet","columns":[{"label":"ID"}],}
     *     {@code "rows":[[1]],"rowCount":1,"truncated":false}],"warnings":[],"elapsedMs":12,}
     *     {@code "autoCommit":true,"maxRows":1000},"msg":"SQL 执行完成。"}}
     */
    CommonResult execute(CommonParam executeIn);
}
