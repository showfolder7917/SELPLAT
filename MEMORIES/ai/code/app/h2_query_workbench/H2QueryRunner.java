import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class H2QueryRunner {
    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            printError("参数不足。需要 mode, url, user, password，query 模式还需要 sql。");
            return;
        }

        String mode = args[0];
        String url = args[1];
        String user = args[2];
        String password = args[3];

        Class.forName("org.h2.Driver");

        try (Connection connection = DriverManager.getConnection(url, user, password)) {
            if ("schema".equals(mode)) {
                printSchema(connection, url);
                return;
            }
            if ("query".equals(mode)) {
                if (args.length < 5) {
                    printError("query 模式缺少 sql 参数。");
                    return;
                }
                printQuery(connection, url, args[4]);
                return;
            }
            printError("不支持的 mode: " + mode);
        } catch (Exception error) {
            printError(error.getMessage() == null ? error.getClass().getName() : error.getMessage());
        }
    }

    private static void printSchema(Connection connection, String url) throws Exception {
        DatabaseMetaData metaData = connection.getMetaData();
        List<String> tablesJson = new ArrayList<>();

        try (ResultSet tables = metaData.getTables(null, null, "%", new String[]{"TABLE"})) {
            while (tables.next()) {
                String schema = tables.getString("TABLE_SCHEM");
                String table = tables.getString("TABLE_NAME");
                if (schema == null || schema.startsWith("INFORMATION_SCHEMA")) {
                    continue;
                }
                Set<String> primaryKeys = loadPrimaryKeys(metaData, schema, table);
                Set<String> uniqueColumns = loadUniqueColumns(metaData, schema, table);
                List<String> columnJson = new ArrayList<>();
                try (ResultSet columns = metaData.getColumns(null, schema, table, "%")) {
                    while (columns.next()) {
                        Map<String, String> column = new LinkedHashMap<>();
                        String columnName = safe(columns.getString("COLUMN_NAME"));
                        column.put("name", safe(columns.getString("COLUMN_NAME")));
                        column.put("type", safe(columns.getString("TYPE_NAME")));
                        column.put("nullable", "YES".equalsIgnoreCase(safe(columns.getString("IS_NULLABLE"))) ? "true" : "false");
                        column.put("size", String.valueOf(columns.getInt("COLUMN_SIZE")));
                        column.put("primaryKey", primaryKeys.contains(columnName) ? "true" : "false");
                        column.put("unique", uniqueColumns.contains(columnName) ? "true" : "false");
                        columnJson.add("{"
                            + "\"name\":" + quote(column.get("name")) + ","
                            + "\"type\":" + quote(column.get("type")) + ","
                            + "\"nullable\":" + column.get("nullable") + ","
                            + "\"size\":" + column.get("size") + ","
                            + "\"primaryKey\":" + column.get("primaryKey") + ","
                            + "\"unique\":" + column.get("unique")
                            + "}");
                    }
                }
                tablesJson.add("{"
                    + "\"schema\":" + quote(schema) + ","
                    + "\"name\":" + quote(table) + ","
                    + "\"columns\":[" + String.join(",", columnJson) + "]"
                    + "}");
            }
        }

        String output = "{"
            + "\"ok\":true,"
            + "\"kind\":\"schema\","
            + "\"url\":" + quote(url) + ","
            + "\"tables\":[" + String.join(",", tablesJson) + "]"
            + "}";
        System.out.println(output);
    }

    private static Set<String> loadPrimaryKeys(DatabaseMetaData metaData, String schema, String table) throws Exception {
        Set<String> primaryKeys = new HashSet<>();
        try (ResultSet primaryKeyResult = metaData.getPrimaryKeys(null, schema, table)) {
            while (primaryKeyResult.next()) {
                primaryKeys.add(safe(primaryKeyResult.getString("COLUMN_NAME")));
            }
        }
        return primaryKeys;
    }

    private static Set<String> loadUniqueColumns(DatabaseMetaData metaData, String schema, String table) throws Exception {
        Set<String> uniqueColumns = new HashSet<>();
        try (ResultSet indexResult = metaData.getIndexInfo(null, schema, table, true, false)) {
            while (indexResult.next()) {
                String columnName = safe(indexResult.getString("COLUMN_NAME"));
                if (!columnName.isEmpty()) {
                    uniqueColumns.add(columnName);
                }
            }
        }
        return uniqueColumns;
    }

    private static void printQuery(Connection connection, String url, String sql) throws Exception {
        String normalizedSql = sql == null ? "" : sql.trim();
        while (normalizedSql.endsWith(";")) {
            normalizedSql = normalizedSql.substring(0, normalizedSql.length() - 1).trim();
        }

        try (Statement statement = connection.createStatement()) {
            boolean hasResultSet = statement.execute(normalizedSql);
            if (!hasResultSet) {
                String output = "{"
                    + "\"ok\":true,"
                    + "\"kind\":\"update_count\","
                    + "\"url\":" + quote(url) + ","
                    + "\"sql\":" + quote(normalizedSql) + ","
                    + "\"updateCount\":" + statement.getUpdateCount()
                    + "}";
                System.out.println(output);
                return;
            }

            try (ResultSet resultSet = statement.getResultSet()) {
                ResultSetMetaData metaData = resultSet.getMetaData();
                int columnCount = metaData.getColumnCount();
                List<String> columnsJson = new ArrayList<>();
                for (int index = 1; index <= columnCount; index += 1) {
                    columnsJson.add("{"
                        + "\"name\":" + quote(metaData.getColumnLabel(index)) + ","
                        + "\"type\":" + quote(metaData.getColumnTypeName(index))
                        + "}");
                }

                List<String> rowsJson = new ArrayList<>();
                int rowCount = 0;
                while (resultSet.next()) {
                    List<String> valueJson = new ArrayList<>();
                    for (int index = 1; index <= columnCount; index += 1) {
                        Object value = resultSet.getObject(index);
                        if (value == null) {
                            valueJson.add("null");
                        } else {
                            valueJson.add(quote(String.valueOf(value)));
                        }
                    }
                    rowsJson.add("[" + String.join(",", valueJson) + "]");
                    rowCount += 1;
                }

                String output = "{"
                    + "\"ok\":true,"
                    + "\"kind\":\"result_set\","
                    + "\"url\":" + quote(url) + ","
                    + "\"sql\":" + quote(normalizedSql) + ","
                    + "\"rowCount\":" + rowCount + ","
                    + "\"columns\":[" + String.join(",", columnsJson) + "],"
                    + "\"rows\":[" + String.join(",", rowsJson) + "]"
                    + "}";
                System.out.println(output);
            }
        }
    }

    private static void printError(String message) {
        System.out.println("{\"ok\":false,\"error\":" + quote(safe(message)) + "}");
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static String quote(String value) {
        StringBuilder builder = new StringBuilder();
        builder.append('"');
        for (int index = 0; index < value.length(); index += 1) {
            char current = value.charAt(index);
            switch (current) {
                case '\\':
                    builder.append("\\\\");
                    break;
                case '"':
                    builder.append("\\\"");
                    break;
                case '\n':
                    builder.append("\\n");
                    break;
                case '\r':
                    builder.append("\\r");
                    break;
                case '\t':
                    builder.append("\\t");
                    break;
                default:
                    if (current < 32) {
                        builder.append(String.format("\\u%04x", (int) current));
                    } else {
                        builder.append(current);
                    }
            }
        }
        builder.append('"');
        return builder.toString();
    }
}
