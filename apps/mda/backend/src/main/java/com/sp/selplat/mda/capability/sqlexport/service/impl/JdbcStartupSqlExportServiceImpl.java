package com.sp.selplat.mda.capability.sqlexport.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.capability.sqlexport.service.JdbcStartupSqlExportService;
import com.sp.selplat.mda.common.util.jdbc.JdbcConnectionFactory;
import com.sp.selplat.mda.common.util.jdbc.MdaConnectionDefinition;
import com.sp.selplat.mda.common.util.jdbc.MdaConnectionDefinitionResolver;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Blob;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * 读取 H2 真实元数据和全表数据，并原子更新中央登记应用的单表启动 SQL 文件。
 * 本服务不执行生成的 SQL，也不允许把远程数据库内容写入无法确认归属的工程目录。
 */
@Service
public class JdbcStartupSqlExportServiceImpl implements JdbcStartupSqlExportService {

    // 当前稳定用户只能来自根 AGENTS.md，导出路径不得写死具体用户目录。
    private static final Pattern STABLE_USER_PATTERN = Pattern.compile(
            "(?m)^- 当前稳定用户 ID：`([^`]+)`\\s*$");
    // 启动 SQL 使用裸标识符，非标准名称必须先由人工设计映射，禁止导出器猜测引用规则。
    private static final Pattern SAFE_IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_$]*");
    // 数据库业务注释必须包含中文，防止无含义的字段名翻译通过门禁。
    private static final Pattern CHINESE_TEXT = Pattern.compile(".*[\\p{IsHan}].*");
    // 中央登记是导出目录归属的唯一事实来源。
    private static final ObjectMapper JSON = new ObjectMapper();

    // 已保存连接的解析器保证导出与页面浏览使用完全相同的目标库定义。
    private final MdaConnectionDefinitionResolver definitionResolver;
    // 目标连接工厂从当前连接的独立池借出只读导出连接。
    private final JdbcConnectionFactory connectionFactory;
    // 工程根限定所有 SQL 文件写入范围。
    private final Path projectRoot;

    /**
     * 从当前 Host 进程目录识别 SELPLAT 根并创建启动 SQL 导出服务。
     *
     * @param definitionResolver 已保存目标连接的运行期定义解析器，例如 {@code MdaConnectionDefinitionResolver}
     * @param connectionFactory 目标数据库连接池工厂，例如 {@code JdbcConnectionFactory}
     *     <p>真实返回示例：构造出仅能写入当前 SELPLAT 中央登记应用的导出服务。
     *     <p>异常或副作用示例：进程目录不属于 SELPLAT 时抛出 {@code MDA_EXPORT_PROJECT_ROOT_NOT_FOUND}，
     *     不创建任何目录或文件。
     */
    @Autowired
    public JdbcStartupSqlExportServiceImpl(
            MdaConnectionDefinitionResolver definitionResolver,
            JdbcConnectionFactory connectionFactory) {
        this(definitionResolver, connectionFactory, locateProjectRoot(Path.of(System.getProperty("user.dir"))));
    }

    /**
     * 为隔离文件系统测试绑定临时 SELPLAT 根。
     *
     * @param definitionResolver 测试提供的连接定义解析器，例如返回内存 H2 定义的 mock
     * @param connectionFactory 测试提供的目标连接工厂，例如每次打开同一内存 H2 的 mock
     * @param projectRoot 包含 AGENTS.md、apps 和 settings.gradle 的临时工程根
     *     <p>真实返回示例：服务后续只允许写入 {@code projectRoot/apps/<project>/db/sql}。
     *     <p>异常或副作用示例：构造只规范化路径，不提前创建目录或打开数据库连接。
     */
    JdbcStartupSqlExportServiceImpl(
            MdaConnectionDefinitionResolver definitionResolver,
            JdbcConnectionFactory connectionFactory,
            Path projectRoot) {
        this.definitionResolver = definitionResolver;
        this.connectionFactory = connectionFactory;
        this.projectRoot = projectRoot.toAbsolutePath().normalize();
    }

    /**
     * 导出右键选中的一张物理表，全部门禁通过后一次性替换结构和数据文件。
     *
     * @param exportIn 页面提交的连接与表坐标，例如
     *     {@code {"connectionId":1,"catalog":"mda","schema":"PUBLIC","tableName":"MdaConnectionProfile"}}
     * @return 导出统计，例如
     *     {@code {"success":true,"data":{"projectName":"mda","tableCount":1,"rowCount":2,}}
     *     {@code "msg":"表启动 SQL 导出完成。"}}
     * @throws CommonBusinessException 连接、表类型、主键或业务注释不符合门禁时抛出；不替换目标文件
     * @throws CommonSystemException JDBC 或文件系统失败时抛出；已经替换的文件会恢复
     */
    @Override
    public synchronized CommonResult exportTable(CommonParam exportIn) {
        MdaConnectionDefinition definition = definitionResolver.resolve(exportIn);
        ManagedApplication application = resolveManagedApplication(definition);
        String schema = requiredSchema(exportIn.getParam("schema"), definition.schemaName());
        String tableName = requiredIdentifier(exportIn.getParam("tableName"), "tableName");
        String catalog = text(exportIn.getParam("catalog"));
        try (Connection connection = connectionFactory.open(definition)) {
            connection.setReadOnly(true);
            TableExport table = readTable(connection, catalog, schema, tableName);
            ExportPlan plan = buildPlan(application, List.of(table));
            applyPlan(plan);
            return success(application, plan, "表启动 SQL 导出完成。");
        } catch (CommonBusinessException exception) {
            throw exception;
        } catch (SQLException exception) {
            throw new CommonSystemException(
                    "MDA_TABLE_EXPORT_DATABASE_FAILED", "表启动 SQL 导出失败，请检查数据库连接。", exception);
        }
    }

    /**
     * 导出当前应用业务 Schema 中全部物理表，任一表失败时整批文件保持原状。
     *
     * @param exportIn 页面提交的连接坐标，例如 {@code {"connectionId":1,"catalog":"mda"}}
     * @return 导出统计，例如
     *     {@code {"success":true,"data":{"projectName":"mda","tableCount":2,"rowCount":13,}}
     *     {@code "msg":"数据库启动 SQL 导出完成。"}}
     * @throws CommonBusinessException 应用未登记、业务 Schema 没有物理表或任一表不符合门禁时抛出
     * @throws CommonSystemException JDBC 或文件系统失败时抛出；不会留下半套导出结果
     */
    @Override
    public synchronized CommonResult exportDatabase(CommonParam exportIn) {
        MdaConnectionDefinition definition = definitionResolver.resolve(exportIn);
        ManagedApplication application = resolveManagedApplication(definition);
        String schema = requiredSchema(null, definition.schemaName());
        String catalog = text(exportIn.getParam("catalog"));
        try (Connection connection = connectionFactory.open(definition)) {
            connection.setReadOnly(true);
            List<String> tableNames = readPhysicalTableNames(connection.getMetaData(), catalog, schema);
            if (tableNames.isEmpty()) {
                throw business("MDA_EXPORT_NO_TABLES", "当前应用的 " + schema + " Schema 中没有可导出的物理表。");
            }
            List<TableExport> tables = new ArrayList<>();
            for (String tableName : tableNames) {
                // 全库导出逐表完成元数据和数据校验；写文件动作必须等全部表通过后才开始。
                tables.add(readTable(connection, catalog, schema, tableName));
            }
            ExportPlan plan = buildPlan(application, tables);
            applyPlan(plan);
            return success(application, plan, "数据库启动 SQL 导出完成。");
        } catch (CommonBusinessException exception) {
            throw exception;
        } catch (SQLException exception) {
            throw new CommonSystemException(
                    "MDA_DATABASE_EXPORT_DATABASE_FAILED", "数据库启动 SQL 导出失败，请检查数据库连接。", exception);
        }
    }

    /**
     * 使用中央登记把当前 H2 文件唯一映射到一个 SELPLAT 应用。
     *
     * @param definition 当前页面连接解析得到的定义，例如数据库名 {@code file:./apps/mda/db/mda}
     * @return 中央登记应用，例如 {@code {projectName=mda,schemaRoot=db/sql,databaseFile=db/mda.mv.db}}
     * @throws CommonBusinessException 非 H2、文件库未登记或登记重复时抛出；不创建导出目录
     */
    private ManagedApplication resolveManagedApplication(MdaConnectionDefinition definition) {
        if (!"H2".equalsIgnoreCase(text(definition.databaseType()))) {
            throw business("MDA_EXPORT_H2_REQUIRED", "启动 SQL 只能导出中央登记的 SELPLAT H2 应用数据库。");
        }
        Path connectedFile = resolveConnectedDatabaseFile(definition);
        try {
            JsonNode applications = JSON.readTree(Files.readString(managedRegistryPath(), StandardCharsets.UTF_8))
                    .path("applications");
            if (!applications.isArray()) {
                throw business("MDA_EXPORT_REGISTRY_INVALID", "数据库应用中央登记缺少 applications 数组。");
            }
            List<ManagedApplication> matches = new ArrayList<>();
            for (JsonNode item : applications) {
                String projectName = requiredRegistryText(item, "projectName");
                String schemaRoot = requiredRegistryText(item, "schemaRoot");
                String databaseFile = requiredRegistryText(item, "databaseFile");
                Path registeredFile = insideProjectRoot(projectRoot.resolve("apps")
                        .resolve(projectName).resolve(databaseFile));
                if (registeredFile.equals(connectedFile)) {
                    matches.add(new ManagedApplication(projectName, schemaRoot, databaseFile));
                }
            }
            if (matches.size() != 1) {
                throw business(
                        "MDA_EXPORT_APPLICATION_NOT_REGISTERED",
                        "当前数据库没有唯一匹配中央登记，禁止猜测启动 SQL 目录：" + connectedFile);
            }
            return matches.get(0);
        } catch (CommonBusinessException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new CommonSystemException(
                    "MDA_EXPORT_REGISTRY_READ_FAILED", "数据库应用中央登记读取失败。", exception);
        }
    }

    /**
     * 把 H2 连接坐标转换为真实 {@code .mv.db} 文件，供中央登记精确比较。
     *
     * @param definition H2 连接定义，例如 {@code databaseName=file:./apps/mda/db/mda}
     * @return 规范化数据库文件，例如 {@code <SELPLAT>/apps/mda/db/mda.mv.db}
     * @throws CommonBusinessException 内存库、网络库或工程外相对路径无法对应启动目录时抛出
     */
    private Path resolveConnectedDatabaseFile(MdaConnectionDefinition definition) {
        String source = text(definition.customJdbcUrl()).isBlank()
                ? text(definition.databaseName()) : text(definition.customJdbcUrl());
        source = source.replaceFirst("(?i)^jdbc:h2:", "");
        source = source.split(";", 2)[0];
        if (!source.startsWith("file:")) {
            throw business("MDA_EXPORT_FILE_DATABASE_REQUIRED", "当前 H2 连接不是可归属到 SELPLAT 应用的文件数据库。");
        }
        String fileName = source.substring("file:".length());
        Path path = Path.of(fileName);
        Path resolved = path.isAbsolute()
                ? path.toAbsolutePath().normalize()
                : projectRoot.resolve(fileName.replaceFirst("^\\./", "")).normalize();
        if (!resolved.toString().endsWith(".mv.db")) {
            resolved = Path.of(resolved + ".mv.db");
        }
        return insideProjectRoot(resolved);
    }

    /**
     * 读取一张物理表的结构、约束、注释和全部数据并形成两个文件正文。
     *
     * @param connection 已设为只读的目标 H2 连接
     * @param catalog 当前目录，例如 {@code mda}
     * @param schema 业务 Schema，例如 {@code PUBLIC}
     * @param tableName 物理表名，例如 {@code MdaConnectionProfile}
     * @return 表导出内容，例如结构文件名 {@code schema-MdaConnectionProfile.sql}、数据行数 {@code 2}
     * @throws SQLException JDBC 元数据或数据读取失败时抛出；不写文件
     * @throws CommonBusinessException 表不存在、不是物理表、缺主键或缺中文业务注释时抛出
     */
    private TableExport readTable(Connection connection, String catalog, String schema, String tableName)
            throws SQLException {
        DatabaseMetaData metadata = connection.getMetaData();
        TableIdentity identity = readTableIdentity(metadata, catalog, schema, tableName);
        List<ColumnDefinition> columns = readColumns(metadata, identity);
        List<String> primaryKeys = readPrimaryKeys(metadata, identity);
        if (primaryKeys.isEmpty()) {
            throw business("MDA_EXPORT_PRIMARY_KEY_REQUIRED", "表 " + tableName + " 没有主键，无法生成幂等数据 SQL。");
        }
        List<IndexDefinition> indexes = readIndexes(metadata, identity, primaryKeys);
        List<ForeignKeyDefinition> foreignKeys = readForeignKeys(metadata, identity);
        String schemaSql = buildSchemaSql(identity, columns, primaryKeys, indexes, foreignKeys);
        DataExport data = readData(connection, identity, columns, primaryKeys);
        return new TableExport(tableName, schemaSql, data.sql(), data.rowCount());
    }

    /**
     * 核对目标对象确实是指定 Schema 中的一张物理表。
     *
     * @param metadata 当前 H2 JDBC 元数据
     * @param catalog 当前目录，例如 {@code mda}
     * @param schema 当前业务 Schema，例如 {@code PUBLIC}
     * @param tableName 页面右键选中的表，例如 {@code MdaConnectionProfile}
     * @return 表身份和数据库原注释，例如 {@code {schema=PUBLIC,tableName=MdaConnectionProfile,remarks=MDA连接配置表}}
     * @throws SQLException 元数据读取失败时抛出
     * @throws CommonBusinessException 目标不存在、是视图或缺少中文表注释时抛出
     */
    private TableIdentity readTableIdentity(
            DatabaseMetaData metadata, String catalog, String schema, String tableName) throws SQLException {
        try (ResultSet resultSet = metadata.getTables(blankToNull(catalog), schema, tableName, null)) {
            while (resultSet.next()) {
                if (!tableName.equals(resultSet.getString("TABLE_NAME"))) continue;
                String tableType = text(resultSet.getString("TABLE_TYPE")).toUpperCase(Locale.ROOT);
                if (!tableType.contains("TABLE") || tableType.contains("SYSTEM")) {
                    throw business("MDA_EXPORT_PHYSICAL_TABLE_REQUIRED", "只允许导出物理表，当前对象类型为：" + tableType);
                }
                String remarks = requiredChineseComment(resultSet.getString("REMARKS"), "表 " + tableName);
                return new TableIdentity(
                        resultSet.getString("TABLE_CAT"), resultSet.getString("TABLE_SCHEM"), tableName, remarks);
            }
        }
        throw business("MDA_EXPORT_TABLE_NOT_FOUND", "目标表不存在或当前账号不可读取：" + schema + "." + tableName);
    }

    /**
     * 读取业务 Schema 中全部物理表名并稳定排序。
     *
     * @param metadata 当前 H2 JDBC 元数据
     * @param catalog 当前目录，例如 {@code mda}
     * @param schema 业务 Schema，例如 {@code PUBLIC}
     * @return 物理表名列表，例如 {@code [CommonSequenceSegment,MdaConnectionProfile]}
     * @throws SQLException 表元数据读取失败时抛出；系统表和视图不会进入结果
     */
    private List<String> readPhysicalTableNames(DatabaseMetaData metadata, String catalog, String schema)
            throws SQLException {
        List<String> names = new ArrayList<>();
        try (ResultSet resultSet = metadata.getTables(
                blankToNull(catalog), schema, "%", new String[] {"TABLE", "BASE TABLE"})) {
            while (resultSet.next()) {
                String type = text(resultSet.getString("TABLE_TYPE")).toUpperCase(Locale.ROOT);
                if (type.contains("TABLE") && !type.contains("SYSTEM")) {
                    names.add(requiredIdentifier(resultSet.getString("TABLE_NAME"), "tableName"));
                }
            }
        }
        names.sort(String.CASE_INSENSITIVE_ORDER);
        return names;
    }

    /**
     * 读取字段类型、默认值、可空性、自增标识和中文业务注释。
     *
     * @param metadata 当前 H2 JDBC 元数据
     * @param table 已核验的物理表身份
     * @return 按 ORDINAL_POSITION 排序的字段，例如 {@code [{name=id,typeName=BIGINT,nullable=false}]}
     * @throws SQLException 字段元数据读取失败时抛出
     * @throws CommonBusinessException 字段名不安全或缺少中文业务注释时抛出
     */
    private List<ColumnDefinition> readColumns(DatabaseMetaData metadata, TableIdentity table) throws SQLException {
        List<ColumnDefinition> columns = new ArrayList<>();
        try (ResultSet resultSet = metadata.getColumns(table.catalog(), table.schema(), table.tableName(), "%")) {
            while (resultSet.next()) {
                String name = requiredIdentifier(resultSet.getString("COLUMN_NAME"), "columnName");
                columns.add(new ColumnDefinition(
                        name,
                        resultSet.getInt("DATA_TYPE"),
                        resultSet.getString("TYPE_NAME"),
                        resultSet.getInt("COLUMN_SIZE"),
                        resultSet.getInt("DECIMAL_DIGITS"),
                        resultSet.getInt("NULLABLE") != DatabaseMetaData.columnNoNulls,
                        requiredChineseComment(resultSet.getString("REMARKS"), "字段 " + table.tableName() + "." + name),
                        resultSet.getString("COLUMN_DEF"),
                        "YES".equalsIgnoreCase(resultSet.getString("IS_AUTOINCREMENT")),
                        resultSet.getInt("ORDINAL_POSITION")));
            }
        }
        columns.sort(Comparator.comparingInt(ColumnDefinition::ordinal));
        if (columns.isEmpty()) {
            throw business("MDA_EXPORT_COLUMNS_REQUIRED", "表 " + table.tableName() + " 没有可导出的字段。");
        }
        return columns;
    }

    /**
     * 按 KEY_SEQ 读取真实主键字段。
     *
     * @param metadata 当前 H2 JDBC 元数据
     * @param table 已核验的物理表身份
     * @return 主键字段，例如 {@code [tenantId,id]}
     * @throws SQLException 主键元数据读取失败时抛出；无主键返回空列表
     */
    private List<String> readPrimaryKeys(DatabaseMetaData metadata, TableIdentity table) throws SQLException {
        List<Map.Entry<Short, String>> keys = new ArrayList<>();
        try (ResultSet resultSet = metadata.getPrimaryKeys(table.catalog(), table.schema(), table.tableName())) {
            while (resultSet.next()) {
                keys.add(Map.entry(
                        resultSet.getShort("KEY_SEQ"),
                        requiredIdentifier(resultSet.getString("COLUMN_NAME"), "primaryKey")));
            }
        }
        keys.sort(Comparator.comparingInt(Map.Entry::getKey));
        return keys.stream().map(Map.Entry::getValue).toList();
    }

    /**
     * 读取非主键索引并保留字段顺序和唯一性。
     *
     * @param metadata 当前 H2 JDBC 元数据
     * @param table 已核验的物理表身份
     * @param primaryKeys 当前表主键字段，例如 {@code [id]}
     * @return 索引定义，例如 {@code [{name=UK_ProfileName,unique=true,columns=[connectionName]}]}
     * @throws SQLException 索引元数据读取失败时抛出；统计行和主键索引会被排除
     */
    private List<IndexDefinition> readIndexes(
            DatabaseMetaData metadata, TableIdentity table, List<String> primaryKeys) throws SQLException {
        Map<String, MutableIndex> indexes = new LinkedHashMap<>();
        try (ResultSet resultSet = metadata.getIndexInfo(
                table.catalog(), table.schema(), table.tableName(), false, false)) {
            while (resultSet.next()) {
                String name = text(resultSet.getString("INDEX_NAME"));
                String column = text(resultSet.getString("COLUMN_NAME"));
                if (name.isBlank() || column.isBlank()
                        || resultSet.getShort("TYPE") == DatabaseMetaData.tableIndexStatistic) continue;
                requiredIdentifier(name, "indexName");
                requiredIdentifier(column, "indexColumn");
                boolean unique = !resultSet.getBoolean("NON_UNIQUE");
                MutableIndex index = indexes.computeIfAbsent(
                        name, ignored -> new MutableIndex(name, unique));
                index.columns().put(resultSet.getShort("ORDINAL_POSITION"), column);
            }
        }
        List<IndexDefinition> result = new ArrayList<>();
        for (MutableIndex index : indexes.values()) {
            List<String> columns = new ArrayList<>(index.columns().values());
            if (columns.equals(primaryKeys) || index.name().toUpperCase(Locale.ROOT).startsWith("PRIMARY_KEY")) continue;
            result.add(new IndexDefinition(index.name(), index.unique(), columns));
        }
        result.sort(Comparator.comparing(IndexDefinition::name));
        return result;
    }

    /**
     * 读取外键约束及字段顺序。
     *
     * @param metadata 当前 H2 JDBC 元数据
     * @param table 已核验的物理表身份
     * @return 外键定义，例如 {@code [{name=FK_ChildParent,columns=[parentId],targetTable=Parent,targetColumns=[id]}]}
     * @throws SQLException 外键元数据读取失败时抛出；没有外键返回空列表
     */
    private List<ForeignKeyDefinition> readForeignKeys(DatabaseMetaData metadata, TableIdentity table)
            throws SQLException {
        Map<String, MutableForeignKey> keys = new LinkedHashMap<>();
        try (ResultSet resultSet = metadata.getImportedKeys(table.catalog(), table.schema(), table.tableName())) {
            while (resultSet.next()) {
                String name = requiredIdentifier(resultSet.getString("FK_NAME"), "foreignKeyName");
                String targetTable = requiredIdentifier(resultSet.getString("PKTABLE_NAME"), "referencedTable");
                MutableForeignKey key = keys.computeIfAbsent(name, ignored -> new MutableForeignKey(
                        name,
                        targetTable,
                        new LinkedHashMap<>(),
                        new LinkedHashMap<>()));
                short sequence = resultSet.getShort("KEY_SEQ");
                key.columns().put(sequence, requiredIdentifier(resultSet.getString("FKCOLUMN_NAME"), "foreignKeyColumn"));
                key.targetColumns().put(
                        sequence, requiredIdentifier(resultSet.getString("PKCOLUMN_NAME"), "referencedColumn"));
            }
        }
        List<ForeignKeyDefinition> result = new ArrayList<>();
        for (MutableForeignKey key : keys.values()) {
            result.add(new ForeignKeyDefinition(
                    key.name(),
                    new ArrayList<>(key.columns().values()),
                    key.targetTable(),
                    new ArrayList<>(key.targetColumns().values())));
        }
        result.sort(Comparator.comparing(ForeignKeyDefinition::name));
        return result;
    }

    /**
     * 根据已校验元数据生成幂等 H2 建表、索引、外键和注释 SQL。
     *
     * @param table 表身份和中文表注释
     * @param columns 字段定义和中文字段注释
     * @param primaryKeys 主键字段，例如 {@code [id]}
     * @param indexes 非主键索引
     * @param foreignKeys 外键约束
     * @return 单表结构 SQL，例如以 {@code CREATE TABLE IF NOT EXISTS MdaConnectionProfile} 开头
     * @throws CommonBusinessException 元数据类型无法安全转换为 H2 启动 SQL 时抛出；不写文件
     */
    private String buildSchemaSql(
            TableIdentity table,
            List<ColumnDefinition> columns,
            List<String> primaryKeys,
            List<IndexDefinition> indexes,
            List<ForeignKeyDefinition> foreignKeys) {
        StringBuilder sql = new StringBuilder();
        sql.append("-- ").append(table.tableName()).append(" 保存").append(table.remarks()).append("。\n");
        sql.append("CREATE TABLE IF NOT EXISTS ").append(table.tableName()).append(" (\n");
        List<String> definitions = new ArrayList<>();
        for (ColumnDefinition column : columns) {
            StringBuilder definition = new StringBuilder();
            definition.append("    -- ").append(column.remarks()).append("。\n    ")
                    .append(column.name()).append(' ').append(renderType(column));
            if (column.autoIncrement()) {
                definition.append(" GENERATED BY DEFAULT AS IDENTITY");
            } else if (!text(column.defaultValue()).isBlank()) {
                definition.append(" DEFAULT ").append(column.defaultValue());
            }
            if (!column.nullable()) definition.append(" NOT NULL");
            definitions.add(definition.toString());
        }
        definitions.add("    -- 主键保证每条业务记录具有稳定身份。\n    PRIMARY KEY ("
                + String.join(", ", primaryKeys) + ")");
        sql.append(String.join(",\n", definitions)).append("\n);\n\n");
        for (IndexDefinition index : indexes) {
            sql.append("-- 索引 ").append(index.name()).append(index.unique()
                            ? " 保证业务坐标唯一。\n" : " 支撑业务查询排序。\n")
                    .append("CREATE ").append(index.unique() ? "UNIQUE " : "")
                    .append("INDEX IF NOT EXISTS ").append(index.name()).append(" ON ")
                    .append(table.tableName()).append(" (").append(String.join(", ", index.columns())).append(");\n\n");
        }
        for (ForeignKeyDefinition foreignKey : foreignKeys) {
            sql.append("-- 外键 ").append(foreignKey.name()).append(" 保证关联记录必须存在。\n")
                    .append("ALTER TABLE ").append(table.tableName()).append(" ADD CONSTRAINT IF NOT EXISTS ")
                    .append(foreignKey.name()).append(" FOREIGN KEY (")
                    .append(String.join(", ", foreignKey.columns())).append(") REFERENCES ")
                    .append(foreignKey.targetTable()).append(" (")
                    .append(String.join(", ", foreignKey.targetColumns())).append(");\n\n");
        }
        sql.append("COMMENT ON TABLE ").append(table.tableName()).append(" IS '")
                .append(escapeLiteral(table.remarks())).append("';\n");
        for (ColumnDefinition column : columns) {
            sql.append("COMMENT ON COLUMN ").append(table.tableName()).append('.').append(column.name())
                    .append(" IS '").append(escapeLiteral(column.remarks())).append("';\n");
        }
        return sql.toString();
    }

    /**
     * 读取全表数据并按主键稳定排序，生成逐行幂等 INSERT。
     *
     * @param connection 已设为只读的目标 H2 连接
     * @param table 已核验物理表
     * @param columns 按表顺序排列的全部字段
     * @param primaryKeys 主键字段，例如 {@code [id]}
     * @return 数据 SQL 与真实行数，例如 {@code {rowCount=2,sql=INSERT INTO ... WHERE NOT EXISTS ...}}
     * @throws SQLException 全表读取或大字段转换失败时抛出；不写文件
     */
    private DataExport readData(
            Connection connection,
            TableIdentity table,
            List<ColumnDefinition> columns,
            List<String> primaryKeys) throws SQLException {
        String select = "SELECT " + columns.stream().map(ColumnDefinition::name).reduce((a, b) -> a + ", " + b).orElseThrow()
                + " FROM " + table.tableName() + " ORDER BY " + String.join(", ", primaryKeys);
        StringBuilder sql = new StringBuilder();
        sql.append("-- ").append(table.tableName()).append(" 全量启动数据；按主键存在性重复执行保持幂等。\n");
        long rowCount = 0;
        try (Statement statement = connection.createStatement(); ResultSet resultSet = statement.executeQuery(select)) {
            ResultSetMetaData resultMetadata = resultSet.getMetaData();
            Map<String, Integer> positions = new LinkedHashMap<>();
            for (int index = 1; index <= resultMetadata.getColumnCount(); index++) {
                positions.put(resultMetadata.getColumnName(index), index);
            }
            while (resultSet.next()) {
                List<String> values = new ArrayList<>();
                Map<String, String> literals = new LinkedHashMap<>();
                for (ColumnDefinition column : columns) {
                    String literal = sqlLiteral(resultSet, positions.get(column.name()), column.jdbcType());
                    values.add(literal);
                    literals.put(column.name(), literal);
                }
                List<String> identity = primaryKeys.stream()
                        .map(key -> key + " = " + literals.get(key)).toList();
                sql.append("INSERT INTO ").append(table.tableName()).append(" (")
                        .append(String.join(", ", columns.stream().map(ColumnDefinition::name).toList()))
                        .append(") SELECT ").append(String.join(", ", values))
                        .append(" WHERE NOT EXISTS (SELECT 1 FROM ").append(table.tableName())
                        .append(" WHERE ").append(String.join(" AND ", identity)).append(");\n");
                rowCount++;
            }
        }
        return new DataExport(sql.toString(), rowCount);
    }

    /**
     * 把 JDBC 值转换为可重复执行的 H2 SQL 字面量。
     *
     * @param resultSet 当前全表查询结果
     * @param columnIndex 字段位置，例如 {@code 3}
     * @param jdbcType JDBC 类型码，例如 {@link Types#VARCHAR}
     * @return SQL 字面量，例如 {@code '田中'}、{@code 12.50}、{@code TRUE} 或 {@code NULL}
     * @throws SQLException 数据读取失败或不支持的大字段转换失败时抛出；不修改 ResultSet
     */
    private String sqlLiteral(ResultSet resultSet, int columnIndex, int jdbcType) throws SQLException {
        Object value = resultSet.getObject(columnIndex);
        if (value == null) return "NULL";
        return switch (jdbcType) {
            case Types.BIT, Types.BOOLEAN -> Boolean.parseBoolean(String.valueOf(value)) ? "TRUE" : "FALSE";
            case Types.TINYINT, Types.SMALLINT, Types.INTEGER, Types.BIGINT,
                    Types.FLOAT, Types.REAL, Types.DOUBLE, Types.NUMERIC, Types.DECIMAL -> numberLiteral(value);
            case Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY -> "X'" + HexFormat.of().formatHex(resultSet.getBytes(columnIndex)) + "'";
            case Types.BLOB -> blobLiteral((Blob) value);
            case Types.CLOB, Types.NCLOB -> "'" + escapeLiteral(clobText((Clob) value)) + "'";
            default -> "'" + escapeLiteral(String.valueOf(value)) + "'";
        };
    }

    /**
     * 生成全部目标文件正文，文件名固定为一表一份 schema 和 data。
     *
     * @param application 中央登记应用，例如 {@code mda/db/sql}
     * @param tables 已通过全部门禁的表内容
     * @return 文件计划和汇总行数，例如 {@code {tableCount=2,rowCount=13,files=[schema-...,data-...]}}
     * @throws CommonBusinessException schemaRoot 逃出应用目录或两张表映射到同名文件时抛出
     */
    private ExportPlan buildPlan(ManagedApplication application, List<TableExport> tables) {
        Path applicationRoot = insideProjectRoot(projectRoot.resolve("apps").resolve(application.projectName()));
        Path sqlRoot = applicationRoot.resolve(application.schemaRoot()).normalize();
        if (!sqlRoot.startsWith(applicationRoot)) {
            throw business("MDA_EXPORT_SCHEMA_ROOT_ESCAPE", "中央登记的 schemaRoot 不能逃出应用目录。");
        }
        Map<Path, String> files = new LinkedHashMap<>();
        long rowCount = 0;
        for (TableExport table : tables) {
            Path schemaFile = sqlRoot.resolve("schema-" + table.tableName() + ".sql");
            Path dataFile = sqlRoot.resolve("data-" + table.tableName() + ".sql");
            if (files.put(schemaFile, table.schemaSql()) != null || files.put(dataFile, table.dataSql()) != null) {
                throw business("MDA_EXPORT_DUPLICATE_FILE", "多张表映射到了同一个启动 SQL 文件。");
            }
            rowCount += table.rowCount();
        }
        return new ExportPlan(sqlRoot, files, tables.size(), rowCount);
    }

    /**
     * 先写完全部临时文件，再替换正式文件；失败时恢复替换前正文。
     *
     * @param plan 已通过数据库和门禁校验的完整文件计划
     *     <p>真实返回示例：无返回值；成功后 {@code db/sql} 中每张目标表有 schema/data 两个 UTF-8 文件。
     *     <p>异常或副作用示例：任一移动失败时删除新文件并恢复原内容，然后抛出
     *     {@code CommonSystemException("MDA_EXPORT_WRITE_FAILED",...)}。
     */
    private void applyPlan(ExportPlan plan) {
        Map<Path, byte[]> originals = new LinkedHashMap<>();
        Set<Path> previouslyMissing = new LinkedHashSet<>();
        Map<Path, Path> temporaryFiles = new LinkedHashMap<>();
        try {
            Files.createDirectories(plan.sqlRoot());
            for (Map.Entry<Path, String> entry : plan.files().entrySet()) {
                Path target = entry.getKey().normalize();
                if (!target.startsWith(plan.sqlRoot())) {
                    throw new IOException("导出目标逃出启动 SQL 目录：" + target);
                }
                if (Files.exists(target)) originals.put(target, Files.readAllBytes(target));
                else previouslyMissing.add(target);
                Path temporary = target.resolveSibling(target.getFileName() + ".export-" + UUID.randomUUID() + ".tmp");
                Files.writeString(temporary, entry.getValue(), StandardCharsets.UTF_8);
                temporaryFiles.put(target, temporary);
            }
            for (Map.Entry<Path, Path> entry : temporaryFiles.entrySet()) {
                atomicReplace(entry.getValue(), entry.getKey());
            }
        } catch (IOException exception) {
            restoreFiles(originals, previouslyMissing, temporaryFiles.values());
            throw new CommonSystemException(
                    "MDA_EXPORT_WRITE_FAILED", "启动 SQL 写入失败，原文件已经恢复。", exception);
        }
    }

    /**
     * 把导出统计包装为公共成功结果。
     *
     * @param application 当前中央登记应用
     * @param plan 已完成写入的文件计划
     * @param message 页面提示，例如 {@code 数据库启动 SQL 导出完成。}
     * @return 公共结果，例如 {@code {success=true,data={projectName=mda,tableCount=2,rowCount=13},msg=...}}
     *     <p>异常或副作用示例：只组装内存结果，不再次访问数据库或写文件。
     */
    private CommonResult success(ManagedApplication application, ExportPlan plan, String message) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("projectName", application.projectName());
        data.put("outputDirectory", projectRoot.relativize(plan.sqlRoot()).toString().replace('\\', '/'));
        data.put("tableCount", plan.tableCount());
        data.put("rowCount", plan.rowCount());
        data.put("files", plan.files().keySet().stream()
                .map(path -> projectRoot.relativize(path).toString().replace('\\', '/')).toList());
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setData(data);
        result.setMsg(message);
        return result;
    }

    /** 使用原子移动替换单个启动 SQL；文件系统不支持时退回普通覆盖移动。 */
    private void atomicReplace(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    /** 写入失败后恢复原文件，原先不存在的目标和残留临时文件会被清理。 */
    private void restoreFiles(Map<Path, byte[]> originals, Set<Path> missing, Iterable<Path> temporaryFiles) {
        try {
            for (Map.Entry<Path, byte[]> entry : originals.entrySet()) Files.write(entry.getKey(), entry.getValue());
            for (Path path : missing) Files.deleteIfExists(path);
            for (Path path : temporaryFiles) Files.deleteIfExists(path);
        } catch (IOException restoreException) {
            throw new CommonSystemException(
                    "MDA_EXPORT_ROLLBACK_FAILED", "启动 SQL 导出失败且原文件恢复失败，请立即检查 db/sql。", restoreException);
        }
    }

    /**
     * 根据根 AGENTS.md 的当前稳定用户定位 AI Desktop 内 ruleengine 的中央数据库应用登记。
     * 真实传参示例：无显式参数，AGENTS.md 声明 {@code 当前稳定用户 ID：XUNAN}。
     * 真实返回示例：返回 apps/ai-desktop/ruleengine 下 XUNAN 用户层的 managed-database-applications.json。
     * 异常或副作用示例：用户声明缺失、重复或不安全时抛出 IOException，不创建登记文件。
     *
     * @return 位于当前 SELPLAT 根内的中央登记绝对路径
     * @throws IOException AGENTS.md 用户声明不唯一或不安全时抛出
     */
    private Path managedRegistryPath() throws IOException {
        String agents = Files.readString(projectRoot.resolve("AGENTS.md"), StandardCharsets.UTF_8);
        Matcher matcher = STABLE_USER_PATTERN.matcher(agents);
        if (!matcher.find()) throw new IOException("AGENTS.md 缺少当前稳定用户 ID");
        String stableUserId = matcher.group(1).trim();
        if (!stableUserId.matches("[A-Za-z][A-Za-z0-9_-]{0,63}") || matcher.find()) {
            throw new IOException("AGENTS.md 当前稳定用户 ID 不唯一或不安全");
        }
        return insideProjectRoot(projectRoot.resolve(
                "apps/ai-desktop/ruleengine/backend/src/main/resources/local/" + stableUserId
                        + "/selplat/通用/registry/managed-database-applications.json"));
    }

    /** 从当前路径向上查找唯一 SELPLAT 根。 */
    private static Path locateProjectRoot(Path start) {
        Path current = start.toAbsolutePath().normalize();
        while (current != null) {
            if (Files.isRegularFile(current.resolve("settings.gradle"))
                    && Files.isDirectory(current.resolve("apps/mda"))) return current;
            current = current.getParent();
        }
        throw new CommonSystemException(
                "MDA_EXPORT_PROJECT_ROOT_NOT_FOUND", "无法定位 SELPLAT 工程根。", new IOException(String.valueOf(start)));
    }

    /** 校验路径始终位于当前 SELPLAT 根内。 */
    private Path insideProjectRoot(Path path) {
        Path normalized = path.toAbsolutePath().normalize();
        if (!normalized.startsWith(projectRoot)) {
            throw business("MDA_EXPORT_PATH_ESCAPE", "导出路径不能逃出当前 SELPLAT 工程根。");
        }
        return normalized;
    }

    /** 读取中央登记中的必填文本。 */
    private String requiredRegistryText(JsonNode item, String field) {
        String value = item.path(field).asText("").trim();
        if (value.isEmpty()) throw business("MDA_EXPORT_REGISTRY_INVALID", "中央登记缺少字段：" + field);
        return value;
    }

    /** Schema 优先使用页面明确值，否则使用连接配置，最后固定为 PUBLIC。 */
    private String requiredSchema(Object submitted, String configured) {
        String value = text(submitted);
        if (value.isBlank()) value = text(configured);
        if (value.isBlank()) value = "PUBLIC";
        return requiredIdentifier(value, "schema");
    }

    /** 裸 SQL 标识符必须符合稳定命名范围。 */
    private String requiredIdentifier(Object value, String field) {
        String identifier = text(value).trim();
        if (!SAFE_IDENTIFIER.matcher(identifier).matches()) {
            throw business("MDA_EXPORT_IDENTIFIER_UNSAFE", "导出字段 " + field + " 不是安全的启动 SQL 标识符：" + identifier);
        }
        return identifier;
    }

    /** 表和字段业务注释必须真实存在且包含中文。 */
    private String requiredChineseComment(String value, String target) {
        String comment = text(value).trim();
        if (!CHINESE_TEXT.matcher(comment).matches()) {
            throw business("MDA_EXPORT_CHINESE_COMMENT_REQUIRED", target + " 缺少中文业务注释，未执行导出。");
        }
        return comment;
    }

    /** 根据 JDBC 元数据形成 H2 字段类型。 */
    private String renderType(ColumnDefinition column) {
        String type = text(column.typeName()).trim().toUpperCase(Locale.ROOT);
        if (!SAFE_IDENTIFIER.matcher(type.replace(" ", "_")).matches()) {
            throw business("MDA_EXPORT_COLUMN_TYPE_UNSAFE", "字段 " + column.name() + " 的类型无法安全导出：" + type);
        }
        if ((type.contains("CHAR") || type.contains("BINARY")) && column.size() > 0 && column.size() < Integer.MAX_VALUE) {
            return type + "(" + column.size() + ")";
        }
        if (("NUMERIC".equals(type) || "DECIMAL".equals(type)) && column.size() > 0) {
            return type + "(" + column.size() + ", " + Math.max(column.scale(), 0) + ")";
        }
        return type;
    }

    /** 数字通过 BigDecimal 规范化，避免科学计数格式随驱动变化。 */
    private String numberLiteral(Object value) {
        return value instanceof BigDecimal decimal
                ? decimal.toPlainString() : new BigDecimal(String.valueOf(value)).toPlainString();
    }

    /** Blob 转为 H2 十六进制字面量。 */
    private String blobLiteral(Blob blob) throws SQLException {
        return "X'" + HexFormat.of().formatHex(blob.getBytes(1, Math.toIntExact(blob.length()))) + "'";
    }

    /** Clob 转为完整字符串。 */
    private String clobText(Clob clob) throws SQLException {
        return clob.getSubString(1, Math.toIntExact(clob.length()));
    }

    /** SQL 字符串单引号使用两个单引号转义。 */
    private String escapeLiteral(String value) {
        return text(value).replace("'", "''");
    }

    /** 空字符串转换为 JDBC 元数据需要的 null。 */
    private String blankToNull(String value) {
        return text(value).isBlank() ? null : value;
    }

    /** 任意可空值转换为稳定文本。 */
    private String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    /** 创建可安全展示的业务失败。 */
    private CommonBusinessException business(String code, String message) {
        return new CommonBusinessException(code, message);
    }

    /** 中央登记中的应用路径坐标。 */
    private record ManagedApplication(String projectName, String schemaRoot, String databaseFile) {
    }

    /** 已验证物理表的 JDBC 身份和业务注释。 */
    private record TableIdentity(String catalog, String schema, String tableName, String remarks) {
    }

    /** 启动结构与数据文件生成所需的字段元数据。 */
    private record ColumnDefinition(
            String name,
            int jdbcType,
            String typeName,
            int size,
            int scale,
            boolean nullable,
            String remarks,
            String defaultValue,
            boolean autoIncrement,
            int ordinal) {
    }

    /** 可直接生成 H2 CREATE INDEX 的索引定义。 */
    private record IndexDefinition(String name, boolean unique, List<String> columns) {
    }

    /** JDBC 索引逐行元数据的顺序收集器。 */
    private record MutableIndex(String name, boolean unique, Map<Short, String> columns) {
        private MutableIndex(String name, boolean unique) {
            this(name, unique, new LinkedHashMap<>());
        }
    }

    /** 可直接生成 H2 外键约束的定义。 */
    private record ForeignKeyDefinition(
            String name, List<String> columns, String targetTable, List<String> targetColumns) {
    }

    /** JDBC 外键逐行元数据的顺序收集器。 */
    private record MutableForeignKey(
            String name,
            String targetTable,
            Map<Short, String> columns,
            Map<Short, String> targetColumns) {
    }

    /** 单张表两个启动 SQL 文件的完整正文。 */
    private record TableExport(String tableName, String schemaSql, String dataSql, long rowCount) {
    }

    /** 数据 SQL 和真实导出行数。 */
    private record DataExport(String sql, long rowCount) {
    }

    /** 全批次目标文件及汇总统计。 */
    private record ExportPlan(Path sqlRoot, Map<Path, String> files, int tableCount, long rowCount) {
    }
}
