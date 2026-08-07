package com.sp.selplat.uniauth.table.model;

/**
 * 保存 Uniauth 默认表格的一列定义。
 * 字段结构直接来自当前业务表的 JDBC 元数据，后续 reference-data 配置可以按 field 覆盖显示属性。
 *
 * @param field 数据库真实字段名，例如 {@code loginName}
 * @param title 默认显示标题，例如数据库备注 {@code 登录账号}
 * @param comment 数据库字段原始备注，例如 {@code 登录账号}
 * @param dataType 数据库原始类型，例如 {@code CHARACTER VARYING}
 * @param javaType 推荐 Java 类型，例如 {@code java.lang.String}
 * @param length 数据库字段长度，例如 {@code 100}
 * @param scale 数值字段精度，例如 {@code 2}
 * @param primaryKey 是否属于主键，例如 {@code true}
 * @param visible 默认是否显示，例如口令摘要字段返回 {@code false}
 * @param orderIndex 默认列顺序，从 {@code 1} 开始
 */
public record UniauthTableColumnDefinition(
    String field,
    String title,
    String comment,
    String dataType,
    String javaType,
    Integer length,
    Integer scale,
    boolean primaryKey,
    boolean visible,
    int orderIndex
) {
}
