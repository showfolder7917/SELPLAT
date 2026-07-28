package com.sp.selplat.common.db.domain;

/**
 * 承接旧式单字段模糊查询的字段和值。
 * 字段必须由后端白名单映射到真实数据库列，本对象不负责直接拼接 SQL。
 */
public class CommonLikeQuery {

    // fieldName 指明当前要做模糊匹配的业务字段，供各模块 XML 在白名单内映射真实列名。
    private String fieldName;
    // fieldValue 承接前端或服务层传入的模糊查询值。
    private String fieldValue;

    /**
     * 返回后端允许模糊检索的业务字段名。
     *
     * @return 业务字段名，例如 {@code "loginName"}
     */
    public String getFieldName() {
        return fieldName;
    }

    /**
     * 设置服务层选择的模糊查询字段。
     *
     * @param fieldName 来自后端白名单的业务字段，例如 {@code "loginName"}
     * 执行结果示例：DAO 后续对 loginName 对应的真实列执行 LIKE 查询。
     */
    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    /**
     * 返回用户输入的模糊查询关键字。
     *
     * @return 查询关键字，例如 {@code "admin"}
     */
    public String getFieldValue() {
        return fieldValue;
    }

    /**
     * 设置用户输入的模糊查询关键字。
     *
     * @param fieldValue 来自前端检索框的关键字，例如 {@code "admin"}
     * 执行结果示例：模板参数绑定为包含 admin 的 LIKE 条件，不直接拼接原文本。
     */
    public void setFieldValue(String fieldValue) {
        this.fieldValue = fieldValue;
    }
}
