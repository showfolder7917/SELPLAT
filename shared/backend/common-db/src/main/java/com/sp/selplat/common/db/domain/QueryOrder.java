package com.sp.selplat.common.db.domain;

/**
 * 通用排序对象统一承接单个字段的排序表达。
 * 这里把字段名和方向拆开，是为了让上层 DAO 传入结构化排序规则，
 * 便于底层统一校验字段是否合法并安全生成 order by 子句。
 */
public class QueryOrder {

    // fieldName 记录本次排序要命中的业务字段，供底层校验和拼接排序片段。
    private String fieldName;
    // direction 记录当前字段的排序方向，供底层生成 asc 或 desc 语句。
    private QueryOrderDirection direction;

    /**
     * 获取排序字段名。
     *
     * @return 排序字段名
     */
    public String getFieldName() {
        return fieldName;
    }

    /**
     * 设置排序字段名。
     *
     * @param fieldName 排序字段名
     */
    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    /**
     * 获取排序方向。
     *
     * @return 排序方向
     */
    public QueryOrderDirection getDirection() {
        return direction;
    }

    /**
     * 设置排序方向。
     *
     * @param direction 排序方向
     */
    public void setDirection(QueryOrderDirection direction) {
        this.direction = direction;
    }
}
