package com.sp.selplat.uniauth.table.model;

import java.util.List;

/**
 * 保存一个 Uniauth 前端表格的默认定义。
 * 当前来源固定为数据库元数据；后续可以保持相同返回结构并由 reference-data 配置替换列清单。
 *
 * @param source 定义来源，当前返回 {@code DEFAULT_METADATA}
 * @param resourceCode 业务资源编码，默认等于物理表名，例如 {@code UniauthUser}
 * @param viewCode 前端表格实例编码，例如 {@code user-management} 或 {@code user-selector}
 * @param locale 当前标题语言，例如 {@code zh-CN}
 * @param columns 按数据库字段顺序生成的列定义
 */
public record UniauthTableDefinition(
    String source,
    String resourceCode,
    String viewCode,
    String locale,
    List<UniauthTableColumnDefinition> columns
) {
}
