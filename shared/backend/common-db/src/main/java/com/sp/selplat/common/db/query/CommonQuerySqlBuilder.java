package com.sp.selplat.common.db.query;

import com.sp.selplat.common.db.domain.CommonDynamicQuery;

/**
 * 通用查询 SQL 构建器接口统一抽象结构化查询对象到可执行 SQL 的翻译过程。
 * 这里把列表查询和总数查询都收口成构建结果对象，是为了让执行器拿到 SQL 和参数后直接执行。
 */
public interface CommonQuerySqlBuilder {

    /**
     * 构建列表查询 SQL。
     *
     * @param query 通用查询对象
     * @return 已构建 SQL 结果对象
     */
    BuiltQuerySql buildSelect(CommonDynamicQuery query);

    /**
     * 构建总数查询 SQL。
     *
     * @param query 通用查询对象
     * @return 已构建 SQL 结果对象
     */
    BuiltQuerySql buildCount(CommonDynamicQuery query);
}
