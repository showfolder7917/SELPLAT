package com.sp.selplat.common.db.datasource.dialect;

import com.sp.selplat.common.db.datasource.DatabaseType;

/**
 * 数据库方言接口统一抽象不同数据库在分页、计数和 like 参数上的差异。
 * 这里先收口最基础的方言能力，是为了让上层通用查询先形成闭环，
 * 后续再按具体数据库逐步补充分页细节和其他 SQL 差异。
 */
public interface DatabaseDialect {

    /**
     * 获取当前方言对应的数据库类型。
     *
     * @return 当前实现对应的数据库类型，例如 MySQL 实现返回 {@code MYSQL}
     */
    DatabaseType getType();

    /**
     * 基于基础 SQL 构建总数查询 SQL。
     *
     * @param baseSql 基础 SQL
     * @return 总数查询 SQL，例如 {@code SELECT COUNT(1) FROM (SELECT id FROM uniauth_user) count_view}
     */
    String buildCountSql(String baseSql);

    /**
     * 基于基础 SQL 构建分页查询 SQL。
     *
     * @param baseSql 基础 SQL
     * @param offset 偏移量
     * @param limit 条数
     * @return 分页查询 SQL，例如 MySQL 输入偏移量 {@code 20}、条数 {@code 10} 时返回
     *     {@code SELECT id FROM uniauth_user LIMIT 20, 10}
     */
    String buildPagedSql(String baseSql, Integer offset, Integer limit);

    /**
     * 构建 like 查询参数值。
     *
     * @param value 原始值
     * @return 可绑定到 LIKE 条件的参数值，例如输入 {@code admin} 返回 {@code %admin%}
     */
    String buildLikeValue(Object value);
}

