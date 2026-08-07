package com.sp.selplat.mda.persistence;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 保存 MDA 控制库与默认工作库的隔离 JDBC 入口。
 * 控制库保存连接配置；工作库保存可在页面浏览和查询的表数据。
 */
public record MdaDatabase(
        JdbcTemplate controlJdbc,
        JdbcTemplate workspaceJdbc,
        String controlUrl,
        String workspaceUrl) {
}
