package com.sp.selplat.mda.connectionprofile.dao;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.mda.common.persistence.MdaBaseDao;
import com.sp.selplat.mda.common.persistence.MdaDatabase;
import java.sql.PreparedStatement;
import java.sql.Statement;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

/**
 * 使用 MDA 专用 JDBC 上下文访问连接配置表。
 * SQL 标识符固定在代码中，页面动态值只通过预编译参数传入。
 */
@Repository
public class MdaConnectionProfileDaoImpl extends MdaBaseDao implements MdaConnectionProfileDao {

    private final JdbcTemplate jdbc;

    public MdaConnectionProfileDaoImpl(MdaDatabase database) {
        this.jdbc = database.controlJdbc();
    }

    @Override
    public long insertReturningId(CommonParam saveIn) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("""
                    INSERT INTO MdaConnectionProfile (
                        tenantId, lastOperateUserId, connectionName, databaseType, host, port, databaseName,
                        schemaName, username, password, customJdbcUrl, jdbcParameters,
                        defaultAutoCommit, sortnum, status, createdAt, updatedAt)
                    VALUES (1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """, Statement.RETURN_GENERATED_KEYS);
            bind(statement, saveIn);
            return statement;
        }, keyHolder);
        Number key = keyHolder.getKeys() == null ? null : (Number) keyHolder.getKeys().get("id");
        if (key == null) throw new IllegalStateException("MDA 连接配置未返回生成主键。");
        return key.longValue();
    }

    private void bind(PreparedStatement statement, CommonParam values) throws java.sql.SQLException {
        statement.setObject(1, values.getParam("connectionName"));
        statement.setObject(2, values.getParam("databaseType"));
        statement.setObject(3, values.getParam("host"));
        statement.setObject(4, values.getParam("port"));
        statement.setObject(5, values.getParam("databaseName"));
        statement.setObject(6, values.getParam("schemaName"));
        statement.setObject(7, values.getParam("username"));
        statement.setObject(8, values.getParam("password"));
        statement.setObject(9, values.getParam("customJdbcUrl"));
        statement.setObject(10, values.getParam("jdbcParameters"));
        statement.setObject(11, values.getParam("defaultAutoCommit"));
        statement.setObject(12, values.getParam("sortnum"));
    }
}
