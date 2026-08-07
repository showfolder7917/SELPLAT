package com.sp.selplat.uniauth.persistence;

import com.sp.selplat.uniauth.table.model.UniauthTableDefinition;

/**
 * 定义 Uniauth 固定业务表生成默认前端表格结构的项目级持久化能力。
 * 具体 DAO 只继承本接口，不重复实现 JDBC 元数据读取。
 */
public interface UniauthTableMetadataDao {

    /**
     * 根据当前具体 DAO 对应的物理表生成默认表格定义。
     *
     * @param viewCode 前端表格实例编码，例如 {@code user-management}
     * @param locale 当前语言，例如 {@code zh-CN}
     * @return 默认定义，例如
     *     {@code {"source":"DEFAULT_METADATA","resourceCode":"UniauthUser",}
     *     {@code "viewCode":"user-management","columns":[{"field":"loginName","title":"登录账号"}]}}
     */
    UniauthTableDefinition getDefaultTableDefinition(String viewCode, String locale);
}
