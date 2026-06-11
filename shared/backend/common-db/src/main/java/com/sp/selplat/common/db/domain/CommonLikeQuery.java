package com.sp.selplat.common.db.domain;

// 公共模糊查询入参统一承接跨模块的字段名和值，避免每个模块重复定义简单模糊筛选对象。
public class CommonLikeQuery {

    // fieldName 指明当前要做模糊匹配的业务字段，供各模块 XML 在白名单内映射真实列名。
    private String fieldName;
    // fieldValue 承接前端或服务层传入的模糊查询值。
    private String fieldValue;

    // 获取目标业务字段名，供 DAO 层拼装模糊查询条件时读取。
    public String getFieldName() {
        return fieldName;
    }

    // 设置目标业务字段名，供服务层在进入 DAO 前明确要查询的业务字段。
    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    // 获取模糊查询值，供 DAO 层构造 like 条件时使用。
    public String getFieldValue() {
        return fieldValue;
    }

    // 设置模糊查询值，供控制层和服务层向 DAO 传递筛选关键字。
    public void setFieldValue(String fieldValue) {
        this.fieldValue = fieldValue;
    }
}
