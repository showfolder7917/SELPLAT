package com.sp.selplat.common.db.query;

import java.util.List;

/**
 * 已构建 SQL 结果对象统一承接最终 SQL 和参数列表。
 * 这里把 SQL 和参数绑定在同一个对象里，是为了避免调用链中分别传递两个结果而产生错位风险。
 */
public class BuiltQuerySql {

    // sql 承接最终生成的可执行 SQL 文本，供执行器直接提交给底层数据访问层。
    private String sql;
    // parameters 承接与 SQL 问号占位符顺序一致的参数列表，供执行器统一绑定。
    private List<Object> parameters;

    /**
     * 获取 SQL 文本。
     *
     * @return SQL 文本
     */
    public String getSql() {
        return sql;
    }

    /**
     * 设置 SQL 文本。
     *
     * @param sql SQL 文本
     */
    public void setSql(String sql) {
        this.sql = sql;
    }

    /**
     * 获取参数列表。
     *
     * @return 参数列表
     */
    public List<Object> getParameters() {
        return parameters;
    }

    /**
     * 设置参数列表。
     *
     * @param parameters 参数列表
     */
    public void setParameters(List<Object> parameters) {
        this.parameters = parameters;
    }
}
