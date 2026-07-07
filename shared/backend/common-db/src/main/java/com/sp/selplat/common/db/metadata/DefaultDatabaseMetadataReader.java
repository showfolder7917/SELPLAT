package com.sp.selplat.common.db.metadata;

import com.sp.selplat.common.db.datasource.CommonDbSource;
import com.sp.selplat.common.db.metadata.model.ColumnMetadata;
import com.sp.selplat.common.db.metadata.model.TableMetadata;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;

/**
 * 默认数据库元数据读取器直接基于 JDBC 元数据接口读取表和字段信息。
 * 这里优先复用标准 JDBC 能力，是为了先覆盖多数据库通用元数据场景，而不是为每种数据库单独手写系统表查询。
 */
public class DefaultDatabaseMetadataReader implements DatabaseMetadataReader {

    /**
     * 列出当前数据源下的表集合。
     *
     * @param dataSource 数据源实体
     * @return 表集合
     */
    @Override
    public List<TableMetadata> listTables(CommonDbSource dataSource) {
        // 先校验数据源实体，避免后续获取连接时出现空对象错误。
        validateDataSource(dataSource);
        // 创建结果集合承接本次扫描到的表元数据，供上层继续做查询定义生成或白名单构建。
        List<TableMetadata> tableMetadataList = new ArrayList<>();
        // 通过数据源获取连接并读取 JDBC 元数据，保证读取动作与当前上层选择的数据源保持一致。
        try (Connection connection = dataSource.getDataSource().getConnection()) {
            // 获取 JDBC 元数据对象，供后续统一读取表和字段结构。
            DatabaseMetaData metaData = connection.getMetaData();
            // 基于 catalog、schema 和 TABLE 类型筛选业务表，避免把视图和系统对象一起带上来。
            try (ResultSet resultSet = metaData.getTables(
                resolveCatalog(dataSource, connection),
                resolveSchema(dataSource, connection),
                null,
                new String[]{"TABLE"}
            )) {
                // 逐行读取 JDBC 返回的表信息，并转换成项目内统一的表元数据对象。
                while (resultSet.next()) {
                    // 为当前结果行创建表元数据对象，避免把 JDBC 结果集直接暴露给上层。
                    TableMetadata tableMetadata = new TableMetadata();
                    // 记录物理表名，供上层后续按表选择查询定义或生成配置。
                    tableMetadata.setTableName(resultSet.getString("TABLE_NAME"));
                    // 记录表备注，供开发期生成文档或界面提示时复用。
                    tableMetadata.setRemarks(resultSet.getString("REMARKS"));
                    // 把当前表对象加入结果集合，形成完整的表列表输出。
                    tableMetadataList.add(tableMetadata);
                }
            }
        } catch (SQLException exception) {
            // 统一把底层 JDBC 异常收口成非法状态异常，避免接口层被迫显式传播受检异常。
            throw new IllegalStateException("failed to list tables", exception);
        }
        // 返回当前数据源下扫描到的表集合，供调用方继续做表选择或元数据生成。
        return tableMetadataList;
    }

    /**
     * 获取指定表信息。
     *
     * @param dataSource 数据源实体
     * @param tableName 表名
     * @return 表信息
     */
    @Override
    public TableMetadata getTable(CommonDbSource dataSource, String tableName) {
        // 先校验数据源和表名，避免把非法对象直接带入 JDBC 元数据查询。
        validateDataSource(dataSource);
        validateTableName(tableName);
        // 通过数据源获取连接并读取目标表元数据，保证查询上下文和上层传入的数据源一致。
        try (Connection connection = dataSource.getDataSource().getConnection()) {
            // 获取 JDBC 元数据对象，供当前表查询复用标准元数据接口。
            DatabaseMetaData metaData = connection.getMetaData();
            // 按指定表名读取表信息，保证只命中当前业务 DAO 指定的目标表。
            try (ResultSet resultSet = metaData.getTables(
                resolveCatalog(dataSource, connection),
                resolveSchema(dataSource, connection),
                tableName,
                new String[]{"TABLE"}
            )) {
                // 找到目标表时立即构建统一的表元数据对象并返回。
                if (resultSet.next()) {
                    // 创建表元数据对象承接当前 JDBC 结果行，避免调用方依赖底层结果集结构。
                    TableMetadata tableMetadata = new TableMetadata();
                    // 写入目标表名，供调用方继续作为查询定义或白名单的根对象。
                    tableMetadata.setTableName(resultSet.getString("TABLE_NAME"));
                    // 写入目标表备注，供文档、生成器或界面提示复用。
                    tableMetadata.setRemarks(resultSet.getString("REMARKS"));
                    // 返回命中的表元数据结果，表示当前表确实存在于目标数据源中。
                    return tableMetadata;
                }
            }
        } catch (SQLException exception) {
            // 统一转换异常，避免上层被 JDBC 受检异常污染调用签名。
            throw new IllegalStateException("failed to get table metadata: " + tableName, exception);
        }
        // 当前表不存在时返回空，供上层校验器或生成器自行决定后续处理策略。
        return null;
    }

    /**
     * 列出指定表字段集合。
     *
     * @param dataSource 数据源实体
     * @param tableName 表名
     * @return 字段集合
     */
    @Override
    public List<ColumnMetadata> listColumns(CommonDbSource dataSource, String tableName) {
        // 先校验数据源和表名，保证字段查询一定建立在明确且受控的目标表上。
        validateDataSource(dataSource);
        validateTableName(tableName);
        // 创建字段结果集合承接当前表的完整字段结构，供校验器和生成器复用。
        List<ColumnMetadata> columnMetadataList = new ArrayList<>();
        // 通过数据源获取连接并读取目标表字段元数据，保证字段列表来自上层选定的数据库。
        try (Connection connection = dataSource.getDataSource().getConnection()) {
            // 先读取主键字段名集合，后续在字段扫描阶段统一打上主键标记。
            List<String> primaryKeyColumns = listPrimaryKeyColumns(dataSource, connection, tableName);
            // 获取 JDBC 元数据对象，供当前字段扫描复用标准元数据接口。
            DatabaseMetaData metaData = connection.getMetaData();
            // 按指定表名读取所有字段元数据，供后续统一转换成项目内字段模型。
            try (ResultSet resultSet = metaData.getColumns(
                resolveCatalog(dataSource, connection),
                resolveSchema(dataSource, connection),
                tableName,
                null
            )) {
                // 逐行读取字段信息，并转换成统一的字段元数据对象。
                while (resultSet.next()) {
                    // 构建当前字段的统一模型，避免上层直接处理数据库厂商返回的列结构细节。
                    ColumnMetadata columnMetadata = new ColumnMetadata();
                    // 记录字段所属表名，便于后续按表组织字段元数据。
                    columnMetadata.setTableName(resultSet.getString("TABLE_NAME"));
                    // 记录字段名，供字段白名单校验和查询定义生成使用。
                    columnMetadata.setColumnName(resultSet.getString("COLUMN_NAME"));
                    // 记录数据库原始字段类型名称，供开发期生成器辅助判断。
                    columnMetadata.setDataType(resultSet.getString("TYPE_NAME"));
                    // 根据 JDBC 类型码转换推荐 Java 类型，供后续开发期生成或提示使用。
                    columnMetadata.setJavaType(resolveJavaType(resultSet.getInt("DATA_TYPE")));
                    // 记录字段长度，供生成器、校验或界面提示使用。
                    columnMetadata.setLength(resultSet.getInt("COLUMN_SIZE"));
                    // 记录数字字段精度，供数值类字段生成参考。
                    columnMetadata.setScale(resultSet.getInt("DECIMAL_DIGITS"));
                    // 根据主键字段集合判断当前字段是否为主键，供更新和默认排序规则参考。
                    columnMetadata.setPrimaryKey(
                        primaryKeyColumns.contains(resultSet.getString("COLUMN_NAME"))
                    );
                    // 记录字段备注，供开发期生成说明文档或界面提示。
                    columnMetadata.setRemarks(resultSet.getString("REMARKS"));
                    // 把当前字段对象加入结果集合，形成目标表的完整字段元数据清单。
                    columnMetadataList.add(columnMetadata);
                }
            }
        } catch (SQLException exception) {
            // 统一转换字段读取异常，避免受检异常继续向外扩散。
            throw new IllegalStateException("failed to list columns: " + tableName, exception);
        }
        // 返回目标表的字段集合，供上层校验字段合法性或开发期生成固定定义。
        return columnMetadataList;
    }

    /**
     * 判断表是否存在。
     *
     * @param dataSource 数据源实体
     * @param tableName 表名
     * @return 是否存在
     */
    @Override
    public boolean existsTable(CommonDbSource dataSource, String tableName) {
        // 直接复用获取单表元数据的能力判断是否存在，保证存在性口径和详情读取保持一致。
        return getTable(dataSource, tableName) != null;
    }

    /**
     * 判断字段是否存在。
     *
     * @param dataSource 数据源实体
     * @param tableName 表名
     * @param columnName 字段名
     * @return 是否存在
     */
    @Override
    public boolean existsColumn(CommonDbSource dataSource, String tableName, String columnName) {
        // 先校验字段名，避免把空字段名直接带入字段存在性判断逻辑。
        validateColumnName(columnName);
        // 读取目标表字段集合，保证字段存在性判断建立在当前真实表结构上。
        List<ColumnMetadata> columnMetadataList = listColumns(dataSource, tableName);
        // 逐个字段比较名称，供上层校验器判断当前字段是否属于受控表结构。
        for (ColumnMetadata columnMetadata : columnMetadataList) {
            // 命中完全一致的字段名后立即返回存在结果，避免继续做无意义遍历。
            if (columnName.equals(columnMetadata.getColumnName())) {
                return true;
            }
        }
        // 遍历完成仍未命中时返回不存在，提示上层当前字段不应参与查询链路。
        return false;
    }

    /**
     * 读取目标表的主键字段集合。
     *
     * @param dataSource 数据源实体
     * @param connection 数据库连接
     * @param tableName 表名
     * @return 主键字段集合
     */
    private List<String> listPrimaryKeyColumns(CommonDbSource dataSource,Connection connection,String tableName) {
        // 创建主键字段集合承接当前表的主键列名，供字段扫描阶段统一打标。
        List<String> primaryKeyColumns = new ArrayList<>();
        try {
            // 获取 JDBC 元数据对象，供主键读取复用标准接口。
            DatabaseMetaData metaData = connection.getMetaData();
            // 按指定表名读取主键信息，保证主键判断和当前表结构保持一致。
            try (ResultSet resultSet = metaData.getPrimaryKeys(
                resolveCatalog(dataSource, connection),
                resolveSchema(dataSource, connection),
                tableName
            )) {
                // 逐行读取主键字段名，并按出现顺序加入结果集合。
                while (resultSet.next()) {
                    // 记录当前主键字段名，供后续字段模型统一标记 primaryKey。
                    primaryKeyColumns.add(resultSet.getString("COLUMN_NAME"));
                }
            }
        } catch (SQLException exception) {
            // 主键读取失败时统一抛出非法状态异常，避免上层拿到不完整字段元数据。
            throw new IllegalStateException("failed to read primary keys: " + tableName, exception);
        }
        // 返回目标表主键字段集合，供字段扫描阶段判断每个字段的主键属性。
        return primaryKeyColumns;
    }

    /**
     * 根据 JDBC 类型码解析推荐 Java 类型。
     *
     * @param jdbcType JDBC 类型码
     * @return 推荐 Java 类型
     */
    private String resolveJavaType(int jdbcType) {
        // 按 JDBC 类型码分发推荐 Java 类型，供开发期生成器或说明文档复用统一映射。
        switch (jdbcType) {
            // varchar、char 和长文本优先映射成字符串类型，适合名称、编码和说明字段。
            case Types.VARCHAR:
            case Types.CHAR:
            case Types.LONGVARCHAR:
            case Types.NVARCHAR:
            case Types.NCHAR:
            case Types.LONGNVARCHAR:
                return "String";
            // 整型主键和计数字段优先映射成 Integer，适合常规业务场景。
            case Types.INTEGER:
            case Types.SMALLINT:
            case Types.TINYINT:
                return "Integer";
            // 大整型字段优先映射成 Long，适合雪花主键或大计数值场景。
            case Types.BIGINT:
                return "Long";
            // decimal 和 numeric 统一映射成 BigDecimal，适合金额和精度字段。
            case Types.DECIMAL:
            case Types.NUMERIC:
                return "java.math.BigDecimal";
            // 日期时间字段统一映射成 LocalDateTime，方便后续按时间范围条件复用。
            case Types.TIMESTAMP:
            case Types.TIMESTAMP_WITH_TIMEZONE:
                return "java.time.LocalDateTime";
            // 纯日期字段统一映射成 LocalDate，适合自然日级别查询和展示。
            case Types.DATE:
                return "java.time.LocalDate";
            // 纯时间字段统一映射成 LocalTime，适合时间段型业务字段。
            case Types.TIME:
            case Types.TIME_WITH_TIMEZONE:
                return "java.time.LocalTime";
            // 布尔字段优先映射成 Boolean，适合开关和标记类业务字段。
            case Types.BOOLEAN:
            case Types.BIT:
                return "Boolean";
            // 其余无法明确归类的字段统一回退成 Object，保证元数据读取过程不被阻断。
            default:
                return "Object";
        }
    }

    /**
     * 获取当前 catalog 名称。
     *
     * @param dataSource 数据源实体
     * @param connection 数据库连接
     * @return catalog 名称
     */
    private String resolveCatalog(CommonDbSource dataSource, Connection connection) {
        try {
            // 上层已显式传入 catalog 时优先使用传入值，保证元数据读取定位到业务指定的目标库。
            if (hasText(dataSource.getCatalogName())) {
                return dataSource.getCatalogName();
            }
            // 上层未指定 catalog 时回退读取当前连接默认 catalog，兼容常规单库场景。
            return connection.getCatalog();
        } catch (SQLException exception) {
            // 读取当前连接 catalog 失败时统一中止，避免后续元数据读取落到错误库上下文。
            throw new IllegalStateException("failed to resolve catalog", exception);
        }
    }

    /**
     * 获取当前 schema 名称。
     *
     * @param dataSource 数据源实体
     * @param connection 数据库连接
     * @return schema 名称
     */
    private String resolveSchema(CommonDbSource dataSource, Connection connection) {
        try {
            // 上层已显式传入 schema 时优先使用传入值，保证目标对象定位与业务配置一致。
            if (hasText(dataSource.getSchemaName())) {
                return dataSource.getSchemaName();
            }
            // 上层未指定 schema 时回退读取当前连接默认 schema，兼容常规单 schema 场景。
            return connection.getSchema();
        } catch (SQLException exception) {
            // 读取当前连接 schema 失败时统一中止，避免后续表结构读取落到错误 schema。
            throw new IllegalStateException("failed to resolve schema", exception);
        }
    }

    /**
     * 校验数据源实体是否合法。
     *
     * @param dataSource 数据源实体
     */
    private void validateDataSource(CommonDbSource dataSource) {
        // 数据源实体为空时直接拒绝处理，避免后续所有数据库动作失去明确上下文。
        if (dataSource == null) {
            throw new IllegalArgumentException("dataSource must not be null");
        }
        // 真实数据源对象为空时直接拒绝处理，避免底层执行到取连接阶段才暴露问题。
        if (dataSource.getDataSource() == null) {
            throw new IllegalArgumentException("dataSource.dataSource must not be null");
        }
    }

    /**
     * 校验表名是否合法。
     *
     * @param tableName 表名
     */
    private void validateTableName(String tableName) {
        // 表名为空或空白时直接拒绝处理，避免元数据查询落成不受控的全库模糊匹配。
        if (!hasText(tableName)) {
            throw new IllegalArgumentException("tableName must not be blank");
        }
    }

    /**
     * 校验字段名是否合法。
     *
     * @param columnName 字段名
     */
    private void validateColumnName(String columnName) {
        // 字段名为空或空白时直接拒绝处理，避免字段存在性判断失去明确目标。
        if (!hasText(columnName)) {
            throw new IllegalArgumentException("columnName must not be blank");
        }
    }

    /**
     * 判断文本是否有值。
     *
     * @param value 文本值
     * @return 是否有值
     */
    private boolean hasText(String value) {
        // 统一以非空且去空白后仍有长度作为有值标准，保持文本校验口径一致。
        return value != null && !value.trim().isEmpty();
    }
}



