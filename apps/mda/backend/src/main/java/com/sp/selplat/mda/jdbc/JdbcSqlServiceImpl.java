package com.sp.selplat.mda.jdbc;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.connection.service.MdaConnectionProfileService;
import java.io.InputStream;
import java.io.Reader;
import java.sql.Blob;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.SQLWarning;
import java.sql.Statement;
import java.time.temporal.TemporalAccessor;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * 原样执行页面 SQL，不解析关键字、不改写语句、不限制读写类型。
 */
@Service
public class JdbcSqlServiceImpl implements JdbcSqlService {

    private static final int DEFAULT_MAX_ROWS = 1000;
    private static final int MAX_ALLOWED_ROWS = 10000;
    private static final int DEFAULT_TIMEOUT_SECONDS = 30;
    private static final int MAX_LOB_CHARS = 1_000_000;
    private final MdaConnectionProfileService profileService;
    private final JdbcConnectionFactory connectionFactory;

    public JdbcSqlServiceImpl(MdaConnectionProfileService profileService, JdbcConnectionFactory connectionFactory) {
        this.profileService = profileService;
        this.connectionFactory = connectionFactory;
    }

    @Override
    public CommonResult execute(CommonParam executeIn) {
        String sql = requiredSql(executeIn.getParam("sql"));
        MdaConnectionDefinition definition = profileService.loadDefinition(executeIn);
        boolean autoCommit = bool(executeIn.getParam("autoCommit"), definition.defaultAutoCommit());
        int maxRows = bounded(executeIn.getParam("maxRows"), DEFAULT_MAX_ROWS, 1, MAX_ALLOWED_ROWS);
        int timeout = bounded(executeIn.getParam("queryTimeoutSeconds"), DEFAULT_TIMEOUT_SECONDS, 0, 3600);
        long startedAt = System.nanoTime();
        try (Connection connection = connectionFactory.open(definition)) {
            connection.setAutoCommit(autoCommit);
            try {
                Map<String, Object> data = executeStatement(connection, sql, maxRows, timeout);
                if (!autoCommit) {
                    // 非自动提交模式在完整 JDBC 结果链成功读取后统一提交页面本次 SQL。
                    connection.commit();
                    data.put("committed", true);
                }
                data.put("elapsedMs", elapsedMillis(startedAt));
                data.put("autoCommit", autoCommit);
                data.put("maxRows", maxRows);
                return success(data, "SQL 执行完成。");
            } catch (SQLException exception) {
                if (!autoCommit) {
                    connection.rollback();
                }
                throw exception;
            }
        } catch (SQLException exception) {
            throw new IllegalArgumentException("SQL 执行失败：" + exception.getMessage(), exception);
        }
    }

    private Map<String, Object> executeStatement(Connection connection, String sql, int maxRows, int timeout)
            throws SQLException {
        List<Map<String, Object>> results = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        try (Statement statement = connection.createStatement()) {
            statement.setMaxRows(maxRows);
            statement.setQueryTimeout(timeout);
            // SQL 字符串原样进入 Statement.execute，分号、DDL、DML 和过程调用均不做服务端筛选。
            boolean hasResultSet = statement.execute(sql);
            while (true) {
                if (hasResultSet) {
                    try (ResultSet resultSet = statement.getResultSet()) {
                        results.add(readResultSet(resultSet, maxRows));
                    }
                } else {
                    int updateCount = statement.getUpdateCount();
                    if (updateCount == -1) {
                        break;
                    }
                    Map<String, Object> update = new LinkedHashMap<>();
                    update.put("kind", "updateCount");
                    update.put("updateCount", updateCount);
                    results.add(update);
                }
                hasResultSet = statement.getMoreResults(Statement.CLOSE_CURRENT_RESULT);
            }
            for (SQLWarning warning = statement.getWarnings(); warning != null; warning = warning.getNextWarning()) {
                warnings.add(warning.getMessage());
            }
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("results", results);
        data.put("warnings", warnings);
        return data;
    }

    private Map<String, Object> readResultSet(ResultSet resultSet, int maxRows) throws SQLException {
        ResultSetMetaData metadata = resultSet.getMetaData();
        int columnCount = metadata.getColumnCount();
        List<Map<String, Object>> columns = new ArrayList<>();
        for (int index = 1; index <= columnCount; index++) {
            Map<String, Object> column = new LinkedHashMap<>();
            column.put("label", metadata.getColumnLabel(index));
            column.put("name", metadata.getColumnName(index));
            column.put("typeName", metadata.getColumnTypeName(index));
            column.put("jdbcType", metadata.getColumnType(index));
            columns.add(column);
        }
        List<List<Object>> rows = new ArrayList<>();
        while (resultSet.next() && rows.size() < maxRows) {
            List<Object> row = new ArrayList<>(columnCount);
            for (int index = 1; index <= columnCount; index++) {
                row.add(serializableValue(resultSet.getObject(index)));
            }
            rows.add(row);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("kind", "resultSet");
        result.put("columns", columns);
        result.put("rows", rows);
        result.put("rowCount", rows.size());
        // JDBC maxRows 无法区分刚好等于上限和被截断；等于上限时保守标记，提醒用户缩小结果集。
        result.put("truncated", rows.size() >= maxRows);
        return result;
    }

    private Object serializableValue(Object value) throws SQLException {
        if (value == null || value instanceof Number || value instanceof Boolean || value instanceof String) {
            return value;
        }
        if (value instanceof byte[] bytes) {
            return Base64.getEncoder().encodeToString(bytes);
        }
        if (value instanceof Blob blob) {
            try (InputStream input = blob.getBinaryStream()) {
                byte[] bytes = input.readNBytes(MAX_LOB_CHARS);
                return Base64.getEncoder().encodeToString(bytes);
            } catch (Exception exception) {
                throw new SQLException("读取 BLOB 失败。", exception);
            }
        }
        if (value instanceof Clob clob) {
            try (Reader reader = clob.getCharacterStream()) {
                char[] chars = new char[MAX_LOB_CHARS];
                int length = reader.read(chars);
                return length < 0 ? "" : new String(chars, 0, length);
            } catch (Exception exception) {
                throw new SQLException("读取 CLOB 失败。", exception);
            }
        }
        if (value instanceof TemporalAccessor) {
            return value.toString();
        }
        // 日期、UUID 和厂商专用对象以 JDBC 驱动提供的稳定文本表达返回。
        return String.valueOf(value);
    }

    private String requiredSql(Object value) {
        String sql = value == null ? "" : String.valueOf(value);
        if (sql.isBlank()) {
            throw new IllegalArgumentException("sql 不能为空。");
        }
        return sql;
    }

    private int bounded(Object value, int defaultValue, int minimum, int maximum) {
        int number = value == null || String.valueOf(value).isBlank()
                ? defaultValue
                : Integer.parseInt(String.valueOf(value));
        return Math.max(minimum, Math.min(maximum, number));
    }

    private boolean bool(Object value, boolean defaultValue) {
        return value == null ? defaultValue : Boolean.parseBoolean(String.valueOf(value));
    }

    private long elapsedMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000L;
    }

    private CommonResult success(Object data, String message) {
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setData(data);
        result.setMsg(message);
        return result;
    }
}
