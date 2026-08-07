package com.sp.selplat.mda.persistence;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 保存 MDA 控制库的隔离 JDBC 入口。
 * 控制库只保存连接配置；目标数据库均由连接配置在运行时动态连接。
 */
public record MdaDatabase(JdbcTemplate controlJdbc, String controlUrl) {
}
