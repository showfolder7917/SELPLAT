package com.sp.selplat.common.db.query;

import com.sp.selplat.common.db.query.model.CommonDynamicQuery;

/**
 * 通用查询 SQL 构建器接口统一抽象结构化查询对象到可执行 SQL 的翻译过程。
 * 这里把列表查询和总数查询都收口成构建结果对象，是为了让执行器拿到 SQL 和参数后直接执行。
 */
public interface CommonQuerySqlBuilder {

    /**
     * 构建列表查询 SQL。
     *
     * @param query 通用查询对象
     * @return 查询 SQL 与参数，例如
     *     {@code {"sql":"SELECT id FROM uniauth_user WHERE status = ?","parameters":[1]}}
     */
    BuiltQuerySql buildSelect(CommonDynamicQuery query);

    /**
     * 构建总数查询 SQL。
     *
     * @param query 通用查询对象
     * @return 计数 SQL 与参数，例如
     *     {@code {"sql":"SELECT COUNT(*) FROM uniauth_user WHERE status = ?","parameters":[1]}}
     */
    BuiltQuerySql buildCount(CommonDynamicQuery query);
}
