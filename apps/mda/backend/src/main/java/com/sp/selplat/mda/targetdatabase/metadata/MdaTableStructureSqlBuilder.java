package com.sp.selplat.mda.targetdatabase.metadata;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 根据目标数据库产品和 JDBC 原始元数据生成未自动执行的表结构编辑 SQL。
 */
final class MdaTableStructureSqlBuilder {

    // 新字段名只作为未自动执行模板中的稳定替换标记，最终不会写入数据库。
    private static final String NEW_COLUMN_NAME = "NEW_COLUMN";

    /**
     * 阻止实例化纯 SQL 转换工具。
     * 真实传参示例：无参数。
     * 真实返回示例：无返回值。
     * 异常或副作用示例：仅由类加载器调用，不连接数据库且不生成文件。
     */
    private MdaTableStructureSqlBuilder() {
    }

    /**
     * 生成当前表的新增字段示例、原表注释和全部原字段注释。
     *
     * @param databaseProductName 当前 JDBC 数据库产品名，例如 {@code H2}
     * @param schema 当前表所属模式，例如 {@code PUBLIC}
     * @param tableName 当前表名，例如 {@code FTSTYPEKBN}
     * @param tableRemarks 当前数据库中的原表注释，例如 {@code 文件类型区分}
     * @param columns 当前数据库中的字段元数据，例如 {@code [{label=ID, remarks=主键}]}
     * @return 可在 SQL 编辑页继续修改的完整模板，例如
     *     {@code ALTER TABLE FTSTYPEKBN ADD NEW_COLUMN VARCHAR(255);}
     * @throws IllegalArgumentException 表名为空时抛出；本方法不连接数据库也不执行 SQL
     */
    static String build(
            String databaseProductName,
            String schema,
            String tableName,
            String tableRemarks,
            List<Map<String, Object>> columns) {
        if (tableName == null || tableName.isBlank()) {
            throw new IllegalArgumentException("生成表结构 SQL 时表名不能为空。");
        }
        String databaseType = normalizeDatabaseType(databaseProductName);
        StringBuilder sql = new StringBuilder();
        sql.append("-- 当前数据库：").append(displayDatabaseName(databaseProductName)).append('\n');
        sql.append("-- 请把 ").append(NEW_COLUMN_NAME).append(" 和字段类型替换为实际新增字段定义；SQL 不会自动执行。\n");
        appendAddColumn(sql, databaseType, tableName);
        sql.append("\n");
        appendTableComment(sql, databaseType, schema, tableName, text(tableRemarks));
        sql.append("\n");
        sql.append("-- 以下字段注释均从当前数据库读取；数据库没有原注释时保持空字符串。\n");
        // JDBC 字段列表 → 每个现有字段都保留数据库中的原注释或空字符串。
        for (Map<String, Object> column : columns == null ? List.<Map<String, Object>>of() : columns) {
            appendColumnComment(
                    sql,
                    databaseType,
                    schema,
                    tableName,
                    text(column.get("label")),
                    text(column.get("remarks")));
        }
        // 新增字段在当前数据库中没有原注释，固定生成空字符串供用户按需填写。
        appendColumnComment(sql, databaseType, schema, tableName, NEW_COLUMN_NAME, "");
        return sql.toString().stripTrailing();
    }

    /**
     * 按数据库方言写入新增字段示例。
     * 真实传参示例：{@code databaseType=H2, tableName=FTSTYPEKBN}。
     * 真实返回示例：向 SQL 缓冲区追加 {@code ALTER TABLE FTSTYPEKBN ADD NEW_COLUMN VARCHAR(255);}。
     * 异常或副作用示例：只修改传入缓冲区，不执行 SQL。
     */
    private static void appendAddColumn(StringBuilder sql, String databaseType, String tableName) {
        if ("ORACLE".equals(databaseType)) {
            sql.append("ALTER TABLE ").append(tableName).append(" ADD ")
                    .append(NEW_COLUMN_NAME).append(" VARCHAR2(255);\n");
            return;
        }
        if ("MYSQL".equals(databaseType)) {
            sql.append("ALTER TABLE ").append(tableName).append(" ADD COLUMN ")
                    .append(NEW_COLUMN_NAME).append(" VARCHAR(255) COMMENT '';\n");
            return;
        }
        String addKeyword = "POSTGRESQL".equals(databaseType) ? " ADD COLUMN " : " ADD ";
        sql.append("ALTER TABLE ").append(tableName).append(addKeyword)
                .append(NEW_COLUMN_NAME).append(" VARCHAR(255);\n");
    }

    /**
     * 按当前数据库注释语法写入原表注释。
     * 真实传参示例：{@code databaseType=H2, tableName=FTSTYPEKBN, remarks=文件类型区分}。
     * 真实返回示例：向缓冲区追加 {@code COMMENT ON TABLE FTSTYPEKBN IS '文件类型区分';}。
     * 异常或副作用示例：只修改传入缓冲区，空注释写成 {@code ''}。
     */
    private static void appendTableComment(
            StringBuilder sql,
            String databaseType,
            String schema,
            String tableName,
            String remarks) {
        if ("MYSQL".equals(databaseType)) {
            sql.append("ALTER TABLE ").append(tableName).append(" COMMENT = '")
                    .append(escapeLiteral(remarks)).append("';\n");
            return;
        }
        if ("SQLSERVER".equals(databaseType)) {
            appendSqlServerComment(sql, schema, tableName, null, remarks);
            return;
        }
        sql.append("COMMENT ON TABLE ").append(tableName).append(" IS '")
                .append(escapeLiteral(remarks)).append("';\n");
    }

    /**
     * 按当前数据库注释语法写入一个字段的原注释。
     * 真实传参示例：{@code tableName=FTSTYPEKBN, columnName=ID, remarks=主键}。
     * 真实返回示例：向缓冲区追加 {@code COMMENT ON COLUMN FTSTYPEKBN.ID IS '主键';}。
     * 异常或副作用示例：字段名为空时不追加内容，也不执行 SQL。
     */
    private static void appendColumnComment(
            StringBuilder sql,
            String databaseType,
            String schema,
            String tableName,
            String columnName,
            String remarks) {
        if (columnName.isBlank()) {
            return;
        }
        if ("MYSQL".equals(databaseType)) {
            // MySQL 修改已有字段注释必须同时重述完整字段定义，模板仅记录原注释以避免破坏类型和约束。
            sql.append("-- 原字段注释 ").append(tableName).append('.').append(columnName)
                    .append(" = '").append(escapeLiteral(remarks)).append("'\n");
            return;
        }
        if ("SQLSERVER".equals(databaseType)) {
            appendSqlServerComment(sql, schema, tableName, columnName, remarks);
            return;
        }
        sql.append("COMMENT ON COLUMN ").append(tableName).append('.').append(columnName).append(" IS '")
                .append(escapeLiteral(remarks)).append("';\n");
    }

    /**
     * 生成 SQL Server 表或字段的扩展属性语句。
     * 真实传参示例：{@code schema=dbo, tableName=FTSTYPEKBN, columnName=ID, remarks=主键}。
     * 真实返回示例：向缓冲区追加一条 {@code sys.sp_addextendedproperty} 调用。
     * 异常或副作用示例：schema 为空时使用 {@code dbo}，只修改缓冲区。
     */
    private static void appendSqlServerComment(
            StringBuilder sql,
            String schema,
            String tableName,
            String columnName,
            String remarks) {
        sql.append("EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'")
                .append(escapeLiteral(remarks)).append("', @level0type=N'SCHEMA', @level0name=N'")
                .append(escapeLiteral(text(schema).isBlank() ? "dbo" : schema))
                .append("', @level1type=N'TABLE', @level1name=N'")
                .append(escapeLiteral(tableName)).append("'");
        if (columnName != null) {
            sql.append(", @level2type=N'COLUMN', @level2name=N'")
                    .append(escapeLiteral(columnName)).append("'");
        }
        sql.append(";\n");
    }

    /**
     * 把 JDBC 数据库产品名归一为 MDA 方言键。
     * 真实传参示例：{@code PostgreSQL 17.0}。
     * 真实返回示例：返回 {@code POSTGRESQL}。
     * 异常或副作用示例：未知或空产品名返回 H2，不修改外部状态。
     */
    private static String normalizeDatabaseType(String databaseProductName) {
        String normalized = text(databaseProductName).toUpperCase(Locale.ROOT);
        if (normalized.contains("MYSQL") || normalized.contains("MARIADB")) {
            return "MYSQL";
        }
        if (normalized.contains("POSTGRES")) {
            return "POSTGRESQL";
        }
        if (normalized.contains("MICROSOFT") || normalized.contains("SQL SERVER")) {
            return "SQLSERVER";
        }
        if (normalized.contains("ORACLE")) {
            return "ORACLE";
        }
        return "H2";
    }

    /**
     * 生成模板首行展示的数据库名称。
     * 真实传参示例：{@code H2}。
     * 真实返回示例：返回 {@code H2}。
     * 异常或副作用示例：空产品名返回 H2，不修改外部状态。
     */
    private static String displayDatabaseName(String databaseProductName) {
        String value = text(databaseProductName);
        return value.isBlank() ? "H2" : value;
    }

    /**
     * 转义 SQL 字符串中的单引号。
     * 真实传参示例：{@code 文件'类型}。
     * 真实返回示例：返回 {@code 文件''类型}。
     * 异常或副作用示例：null 返回空字符串，不修改外部状态。
     */
    private static String escapeLiteral(String value) {
        return text(value).replace("'", "''");
    }

    /**
     * 把 JDBC 可空值转换为稳定文本。
     * 真实传参示例：{@code null} 或 {@code ID}。
     * 真实返回示例：分别返回空字符串或 {@code ID}。
     * 异常或副作用示例：不抛出空指针异常，也不修改输入对象。
     */
    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}
