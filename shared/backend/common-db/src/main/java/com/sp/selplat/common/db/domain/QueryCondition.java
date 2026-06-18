package com.sp.selplat.common.db.domain;

/**
 * 通用查询条件对象统一承接单个字段上的筛选表达。
 * 这里把字段名、操作符和值结构化，是为了让底层统一校验和翻译 SQL，
 * 避免业务层继续直接手写 where 条件字符串。
 */
public class QueryCondition {

    // fieldName 记录当前条件命中的业务字段名，供底层校验字段合法性并拼接 SQL。
    private String fieldName;
    // operator 记录当前条件要采用的比较方式，供底层决定生成哪类 where 语句。
    private QueryOperator operator;
    // value 承接单值比较或区间起始值，供 EQ、LIKE、GTE、LTE 等条件使用。
    private Object value;
    // secondValue 承接区间结束值，供 BETWEEN 场景使用。
    private Object secondValue;

    /**
     * 获取字段名。
     *
     * @return 字段名
     */
    public String getFieldName() {
        return fieldName;
    }

    /**
     * 设置字段名。
     *
     * @param fieldName 字段名
     */
    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    /**
     * 获取操作符。
     *
     * @return 操作符
     */
    public QueryOperator getOperator() {
        return operator;
    }

    /**
     * 设置操作符。
     *
     * @param operator 操作符
     */
    public void setOperator(QueryOperator operator) {
        this.operator = operator;
    }

    /**
     * 获取首值。
     *
     * @return 首值
     */
    public Object getValue() {
        return value;
    }

    /**
     * 设置首值。
     *
     * @param value 首值
     */
    public void setValue(Object value) {
        this.value = value;
    }

    /**
     * 获取次值。
     *
     * @return 次值
     */
    public Object getSecondValue() {
        return secondValue;
    }

    /**
     * 设置次值。
     *
     * @param secondValue 次值
     */
    public void setSecondValue(Object secondValue) {
        this.secondValue = secondValue;
    }
}
