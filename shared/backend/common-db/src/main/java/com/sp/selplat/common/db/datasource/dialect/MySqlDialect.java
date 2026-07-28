package com.sp.selplat.common.db.datasource.dialect;

import com.sp.selplat.common.db.datasource.DatabaseType;

/**
 * MySQL 方言负责输出 MySQL 场景下的基础分页和计数 SQL 规则。
 * 这里先使用 limit offset 语法，是为了兼容 MySQL 常见查询分页模型。
 */
public class MySqlDialect implements DatabaseDialect {

    /**
     * 获取数据库类型。
     *
     * @return 固定返回 {@code MYSQL}
     */
    @Override
    public DatabaseType getType() {
        return DatabaseType.MYSQL;
    }

    /**
     * 构建总数查询 SQL。
     *
     * @param baseSql 基础 SQL
     * @return 总数查询 SQL，例如 {@code SELECT COUNT(1) FROM (SELECT id FROM uniauth_user) count_view}
     */
    @Override
    public String buildCountSql(String baseSql) {
        return "SELECT COUNT(1) FROM (" + baseSql + ") count_view";
    }

    /**
     * 构建分页查询 SQL。
     *
     * @param baseSql 基础 SQL
     * @param offset 偏移量
     * @param limit 条数
     * @return 分页 SQL，例如 {@code SELECT id FROM uniauth_user LIMIT 20, 10}
     */
    @Override
    public String buildPagedSql(String baseSql, Integer offset, Integer limit) {
        return baseSql + " LIMIT " + offset + ", " + limit;
    }

    /**
     * 构建 like 查询值。
     *
     * @param value 原始值
     * @return like 查询值，例如输入 {@code admin} 返回 {@code %admin%}
     */
    @Override
    public String buildLikeValue(Object value) {
        return "%" + String.valueOf(value) + "%";
    }
}

