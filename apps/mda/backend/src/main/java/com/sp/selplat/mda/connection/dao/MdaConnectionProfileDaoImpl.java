package com.sp.selplat.mda.connection.dao;

import com.sp.selplat.mda.persistence.MdaDatabase;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

/**
 * 使用 MDA 专用 JDBC 上下文访问连接配置表。
 * SQL 标识符固定在代码中，页面动态值只通过预编译参数传入。
 */
@Repository
public class MdaConnectionProfileDaoImpl implements MdaConnectionProfileDao {

    private final JdbcTemplate jdbc;

    public MdaConnectionProfileDaoImpl(MdaDatabase database) {
        this.jdbc = database.controlJdbc();
    }

    @Override
    public List<Map<String, Object>> findAll() {
        return jdbc.queryForList("""
                SELECT id, connectionName, databaseType, host, port, databaseName, schemaName, username,
                       password, customJdbcUrl, jdbcParameters, defaultAutoCommit, sortnum, status,
                       createdAt, updatedAt
                  FROM MdaConnectionProfile
                 WHERE status = 1
                 ORDER BY sortnum ASC, id ASC
                """);
    }

    @Override
    public Map<String, Object> findById(long id) {
        List<Map<String, Object>> records = jdbc.queryForList("""
                SELECT id, connectionName, databaseType, host, port, databaseName, schemaName, username,
                       password, customJdbcUrl, jdbcParameters, defaultAutoCommit, sortnum, status,
                       createdAt, updatedAt
                  FROM MdaConnectionProfile
                 WHERE id = ? AND status = 1
                """, id);
        return records.isEmpty() ? null : records.get(0);
    }

    @Override
    public long insert(Map<String, Object> values) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("""
                    INSERT INTO MdaConnectionProfile (
                        tenantId, lastOperateUserId, connectionName, databaseType, host, port, databaseName,
                        schemaName, username, password, customJdbcUrl, jdbcParameters,
                        defaultAutoCommit, sortnum, status, createdAt, updatedAt)
                    VALUES (1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """, Statement.RETURN_GENERATED_KEYS);
            bind(statement, values);
            return statement;
        }, keyHolder);
        Number key = keyHolder.getKeys() == null ? null : (Number) keyHolder.getKeys().get("id");
        if (key == null) throw new IllegalStateException("MDA 连接配置未返回生成主键。");
        return key.longValue();
    }

    @Override
    public int update(long id, Map<String, Object> values) {
        return jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("""
                    UPDATE MdaConnectionProfile
                       SET connectionName=?, databaseType=?, host=?, port=?, databaseName=?, schemaName=?,
                           username=?, password=?, customJdbcUrl=?, jdbcParameters=?,
                           defaultAutoCommit=?, sortnum=?, updatedAt=CURRENT_TIMESTAMP
                     WHERE id=? AND status=1
                    """);
            bind(statement, values);
            statement.setLong(13, id);
            return statement;
        });
    }

    @Override
    public int softDelete(long id) {
        return jdbc.update("UPDATE MdaConnectionProfile SET status=0, updatedAt=CURRENT_TIMESTAMP WHERE id=? AND status=1", id);
    }

    private void bind(PreparedStatement statement, Map<String, Object> values) throws java.sql.SQLException {
        statement.setObject(1, values.get("connectionName"));
        statement.setObject(2, values.get("databaseType"));
        statement.setObject(3, values.get("host"));
        statement.setObject(4, values.get("port"));
        statement.setObject(5, values.get("databaseName"));
        statement.setObject(6, values.get("schemaName"));
        statement.setObject(7, values.get("username"));
        statement.setObject(8, values.get("password"));
        statement.setObject(9, values.get("customJdbcUrl"));
        statement.setObject(10, values.get("jdbcParameters"));
        statement.setObject(11, values.get("defaultAutoCommit"));
        statement.setObject(12, values.get("sortnum"));
    }
}
