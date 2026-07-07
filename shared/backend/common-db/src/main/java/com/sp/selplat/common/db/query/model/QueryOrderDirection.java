package com.sp.selplat.common.db.query.model;

/**
 * 排序方向枚举统一约束结构化排序定义允许出现的方向值。
 * 这里收口 ASC 与 DESC，是为了让上层 DAO 传入排序规则时只表达业务意图，
 * 底层不再解析随意拼接的排序字符串。
 */
public enum QueryOrderDirection {

    // ASC 表示按字段升序输出结果，适合编号、名称等正向排序场景。
    ASC,
    // DESC 表示按字段降序输出结果，适合时间倒序、最新优先等场景。
    DESC
}

