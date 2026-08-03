package com.sp.selplat.local.code.core.app.h2_query_workbench;

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

/**
 * 执行 H2 表结构读取或 SQL 查询，并向 Python 工作台返回稳定 JSON。
 */
public class H2QueryRunner {

    /**
     * 根据 Python 工作台传入的模式、JDBC URL 和凭据执行数据库动作。
     *
     * @param args Python 应用传入的参数；例如
     *     `schema jdbc:h2:file:C:/data/demo sa password`，或
     *     `query jdbc:h2:file:C:/data/demo sa password "select 1 as ID"`
     * @throws Exception H2 驱动缺失或 JDBC 元数据访问失败，例如 `ClassNotFoundException: org.h2.Driver`
     */
    public static void main(String[] args) throws Exception {
        // 参数不足时返回机器可读错误 → Python 前端显示实际调用契约而不启动数据库连接。
        if (args.length < 4) {
            // 输出固定错误结构并结束本次无效调用。
            printError("参数不足。需要 mode, url, user, password，query 模式还需要 sql。");
            return;
        }

        // 前四个参数分别来自工作台动作、数据库配置和登录表单。
        String mode = args[0];
        String url = args[1];
        String user = args[2];
        String password = args[3];

        // 在建立连接前显式加载 H2 驱动 → 缓存缺少驱动时返回真实类加载异常。
        Class.forName("org.h2.Driver");

        // 单次请求只建立一个连接，并在 schema/query 任一路径结束后自动释放。
        try (Connection connection = DriverManager.getConnection(url, user, password)) {
            // schema 模式读取业务表、列、主键和唯一列元数据。
            if ("schema".equals(mode)) {
                printSchema(connection, url);
                return;
            }
            // query 模式执行用户输入 SQL，并区分结果集与更新计数。
            if ("query".equals(mode)) {
                // 查询模式缺失 SQL 时返回明确提示，禁止执行空字符串。
                if (args.length < 5) {
                    printError("query 模式缺少 sql 参数。");
                    return;
                }
                // 第五个参数保持完整 SQL 原文供查询执行与结果回显。
                printQuery(connection, url, args[4]);
                return;
            }
            // 未登记模式返回可识别错误，避免静默回退到任一数据库动作。
            printError("不支持的 mode: " + mode);
        } catch (Exception error) {
            // JDBC 或 SQL 异常统一转换成 JSON 错误，Python 调用方无需解析 Java 堆栈。
            printError(error.getMessage() == null ? error.getClass().getName() : error.getMessage());
        }
    }

    /**
     * 输出当前连接可见的业务表结构。
     *
     * @param connection Python 工作台参数建立的 H2 JDBC 连接，例如 `jdbc:h2:file:C:/data/demo`
     * @param url 当前连接 URL，用于结果回显，例如 `jdbc:h2:file:C:/data/demo`
     * @throws Exception 元数据读取失败，例如数据库文件损坏导致的 SQLException
     */
    private static void printSchema(Connection connection, String url) throws Exception {
        // 获取当前连接元数据 → 后续表、列、主键和索引均来自同一数据库快照。
        DatabaseMetaData metaData = connection.getMetaData();
        // 每张业务表先独立编码为 JSON，最后组装为 tables 数组。
        List<String> tablesJson = new ArrayList<>();

        // 只枚举 TABLE，排除视图等不属于当前工作台结构浏览目标的对象。
        try (ResultSet tables = metaData.getTables(null, null, "%", new String[]{"TABLE"})) {
            // 逐张表读取真实 schema、列约束和类型信息。
            while (tables.next()) {
                // schema 和表名来自 JDBC 元数据，不根据命名规则猜测。
                String schema = tables.getString("TABLE_SCHEM");
                String table = tables.getString("TABLE_NAME");
                // H2 系统表不属于业务结构，必须从工作台结果中排除。
                if (schema == null || schema.startsWith("INFORMATION_SCHEMA")) {
                    continue;
                }
                // 主键与唯一索引分开读取，供每个字段生成稳定布尔标记。
                Set<String> primaryKeys = loadPrimaryKeys(metaData, schema, table);
                Set<String> uniqueColumns = loadUniqueColumns(metaData, schema, table);
                // 当前表的字段按 JDBC 返回顺序形成 columns 数组。
                List<String> columnJson = new ArrayList<>();
                // 读取当前 schema/table 的全部列，不跨表拼接字段。
                try (ResultSet columns = metaData.getColumns(null, schema, table, "%")) {
                    // 逐字段映射名称、类型、可空、长度、主键和唯一性。
                    while (columns.next()) {
                        // LinkedHashMap 保持字段属性输出顺序，便于前端与测试稳定消费。
                        Map<String, String> column = new LinkedHashMap<>();
                        // 列名作为主键/唯一集合匹配键，空值统一由 safe 转为空串。
                        String columnName = safe(columns.getString("COLUMN_NAME"));
                        column.put("name", safe(columns.getString("COLUMN_NAME")));
                        column.put("type", safe(columns.getString("TYPE_NAME")));
                        column.put("nullable", "YES".equalsIgnoreCase(safe(columns.getString("IS_NULLABLE"))) ? "true" : "false");
                        column.put("size", String.valueOf(columns.getInt("COLUMN_SIZE")));
                        column.put("primaryKey", primaryKeys.contains(columnName) ? "true" : "false");
                        column.put("unique", uniqueColumns.contains(columnName) ? "true" : "false");
                        // 把字段真实元数据编码为一个完整 JSON 对象。
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
                // 当前表对象包含 schema、表名和完整字段数组。
                tablesJson.add("{"
                    + "\"schema\":" + quote(schema) + ","
                    + "\"name\":" + quote(table) + ","
                    + "\"columns\":[" + String.join(",", columnJson) + "]"
                    + "}");
            }
        }

        // schema 响应固定返回 ok、kind、url 和 tables 四层结构。
        String output = "{"
            + "\"ok\":true,"
            + "\"kind\":\"schema\","
            + "\"url\":" + quote(url) + ","
            + "\"tables\":[" + String.join(",", tablesJson) + "]"
            + "}";
        // 标准输出是 Python 工作台与 Java runner 之间的唯一数据通道。
        System.out.println(output);
    }

    /**
     * 读取指定表的主键字段。
     *
     * @param metaData 当前 H2 连接的 JDBC 元数据
     * @param schema 真实 schema，例如 `PUBLIC`
     * @param table 真实表名，例如 `USERS`
     * @return 主键列集合，例如 `[ID, TENANT_ID]`
     * @throws Exception JDBC 主键元数据读取失败，例如连接已关闭
     */
    private static Set<String> loadPrimaryKeys(DatabaseMetaData metaData, String schema, String table) throws Exception {
        // Set 去重同一复合主键元数据中可能重复返回的列名。
        Set<String> primaryKeys = new HashSet<>();
        // 只读取当前 schema/table 的主键结果并在方法内释放游标。
        try (ResultSet primaryKeyResult = metaData.getPrimaryKeys(null, schema, table)) {
            // 每条主键记录只保留字段名，序号不影响字段布尔标记。
            while (primaryKeyResult.next()) {
                primaryKeys.add(safe(primaryKeyResult.getString("COLUMN_NAME")));
            }
        }
        // 返回实际主键字段集合供 schema 字段映射使用。
        return primaryKeys;
    }

    /**
     * 读取指定表参与唯一索引的字段。
     *
     * @param metaData 当前 H2 连接的 JDBC 元数据
     * @param schema 真实 schema，例如 `PUBLIC`
     * @param table 真实表名，例如 `USERS`
     * @return 唯一索引字段集合，例如 `[LOGIN_NAME]`
     * @throws Exception JDBC 索引元数据读取失败，例如连接已关闭
     */
    private static Set<String> loadUniqueColumns(DatabaseMetaData metaData, String schema, String table) throws Exception {
        // Set 去重同一唯一索引中的重复字段记录。
        Set<String> uniqueColumns = new HashSet<>();
        // unique=true 只读取唯一索引，避免把普通索引误标成字段唯一约束。
        try (ResultSet indexResult = metaData.getIndexInfo(null, schema, table, true, false)) {
            // 逐条索引记录抽取真实字段名。
            while (indexResult.next()) {
                String columnName = safe(indexResult.getString("COLUMN_NAME"));
                // 统计行等无列名记录不进入业务字段集合。
                if (!columnName.isEmpty()) {
                    uniqueColumns.add(columnName);
                }
            }
        }
        // 返回唯一字段集合供 schema 字段映射使用。
        return uniqueColumns;
    }

    /**
     * 执行一条 SQL 并输出结果集或更新计数。
     *
     * @param connection Python 工作台建立的 H2 JDBC 连接
     * @param url 当前连接 URL，例如 `jdbc:h2:file:C:/data/demo`
     * @param sql 用户输入 SQL，例如 `select ID, NAME from USERS order by ID`
     * @throws Exception SQL 语法或执行失败，例如 `Table USERS not found`
     */
    private static void printQuery(Connection connection, String url, String sql) throws Exception {
        // 去除外围空白，并把 null 统一为空字符串交给 JDBC 返回真实语法错误。
        String normalizedSql = sql == null ? "" : sql.trim();
        // 连续移除末尾分号，避免 source launcher 参数中的分号影响 H2 执行。
        while (normalizedSql.endsWith(";")) {
            normalizedSql = normalizedSql.substring(0, normalizedSql.length() - 1).trim();
        }

        // Statement 生命周期限定在本次请求，执行完成后立即释放数据库资源。
        try (Statement statement = connection.createStatement()) {
            // execute 同时支持查询和更新，返回值决定后续响应结构。
            boolean hasResultSet = statement.execute(normalizedSql);
            // 非结果集 SQL 返回 updateCount，不伪造 rows 数组。
            if (!hasResultSet) {
                String output = "{"
                    + "\"ok\":true,"
                    + "\"kind\":\"update_count\","
                    + "\"url\":" + quote(url) + ","
                    + "\"sql\":" + quote(normalizedSql) + ","
                    + "\"updateCount\":" + statement.getUpdateCount()
                    + "}";
                // 输出固定更新结果后结束，禁止继续访问不存在的 ResultSet。
                System.out.println(output);
                return;
            }

            // 查询 SQL 从真实 ResultSet 读取列元数据和全部行。
            try (ResultSet resultSet = statement.getResultSet()) {
                // 列元数据决定前端表头和每行值数组的稳定顺序。
                ResultSetMetaData metaData = resultSet.getMetaData();
                int columnCount = metaData.getColumnCount();
                List<String> columnsJson = new ArrayList<>();
                // JDBC 列序号从 1 开始，逐列返回 label 和数据库类型。
                for (int index = 1; index <= columnCount; index += 1) {
                    columnsJson.add("{"
                        + "\"name\":" + quote(metaData.getColumnLabel(index)) + ","
                        + "\"type\":" + quote(metaData.getColumnTypeName(index))
                        + "}");
                }

                // 全部查询行保持数据库返回顺序，rowCount 与 rows 长度一致。
                List<String> rowsJson = new ArrayList<>();
                int rowCount = 0;
                // 逐行读取各列真实值并区分 SQL NULL 与字符串。
                while (resultSet.next()) {
                    List<String> valueJson = new ArrayList<>();
                    // 每行按表头顺序生成等长值数组。
                    for (int index = 1; index <= columnCount; index += 1) {
                        Object value = resultSet.getObject(index);
                        // SQL NULL 输出 JSON null，其他类型以可显示字符串返回。
                        if (value == null) {
                            valueJson.add("null");
                        } else {
                            valueJson.add(quote(String.valueOf(value)));
                        }
                    }
                    // 保存完整行并同步实际行数。
                    rowsJson.add("[" + String.join(",", valueJson) + "]");
                    rowCount += 1;
                }

                // 查询响应包含 SQL、列定义、行数和实际二维 rows。
                String output = "{"
                    + "\"ok\":true,"
                    + "\"kind\":\"result_set\","
                    + "\"url\":" + quote(url) + ","
                    + "\"sql\":" + quote(normalizedSql) + ","
                    + "\"rowCount\":" + rowCount + ","
                    + "\"columns\":[" + String.join(",", columnsJson) + "],"
                    + "\"rows\":[" + String.join(",", rowsJson) + "]"
                    + "}";
                // 标准输出把完整查询结果交还 Python 工作台。
                System.out.println(output);
            }
        }
    }

    /**
     * 输出统一失败 JSON。
     *
     * @param message 实际错误，例如 `参数不足。需要 mode, url, user, password`
     */
    private static void printError(String message) {
        // 错误文本经过 JSON 转义，保证换行、引号或反斜杠不会破坏响应。
        System.out.println("{\"ok\":false,\"error\":" + quote(safe(message)) + "}");
    }

    /**
     * 把可空 JDBC 文本转换为稳定字符串。
     *
     * @param value JDBC 或异常返回文本，例如 null 或 `PUBLIC`
     * @return 非空文本，例如 null 转为 `""`，`PUBLIC` 保持不变
     */
    private static String safe(String value) {
        // null 统一为空串，避免 JSON 拼装触发空指针异常。
        return value == null ? "" : value;
    }

    /**
     * 把字符串编码成完整 JSON 字符串字面量。
     *
     * @param value 待编码文本，例如 `a"b\nc`
     * @return JSON 字面量，例如 `"a\"b\\nc"`
     */
    private static String quote(String value) {
        // StringBuilder 逐字符生成 JSON，避免引入额外序列化依赖。
        StringBuilder builder = new StringBuilder();
        // JSON 字符串以双引号开始。
        builder.append('"');
        // 逐字符处理反斜杠、引号、控制字符和普通 Unicode 文本。
        for (int index = 0; index < value.length(); index += 1) {
            char current = value.charAt(index);
            // 常见 JSON 特殊字符使用标准转义，其他控制字符使用 Unicode 转义。
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
        // JSON 字符串以双引号结束。
        builder.append('"');
        // 返回完整 JSON 字符串供所有响应字段复用。
        return builder.toString();
    }
}
