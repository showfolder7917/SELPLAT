package com.sp.selplat.common.db.dialect;

import com.sp.selplat.common.db.config.DatabaseType;

/**
 * H2 方言负责输出 H2 场景下的基础分页和计数 SQL 规则。
 * 这里先沿用 limit offset 风格，是为了兼容当前本地最小运行与联调数据库场景。
 */
public class H2Dialect implements DatabaseDialect {

    /**
     * 获取数据库类型。
     *
     * @return 数据库类型
     */
    @Override
    public DatabaseType getType() {
        return DatabaseType.H2;
    }

    /**
     * 构建总数查询 SQL。
     *
     * @param baseSql 基础 SQL
     * @return 总数查询 SQL
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
     * @return 分页查询 SQL
     */
    @Override
    public String buildPagedSql(String baseSql, Integer offset, Integer limit) {
        return baseSql + " LIMIT " + limit + " OFFSET " + offset;
    }

    /**
     * 构建 like 查询值。
     *
     * @param value 原始值
     * @return like 查询值
     */
    @Override
    public String buildLikeValue(Object value) {
        return "%" + String.valueOf(value) + "%";
    }
}
