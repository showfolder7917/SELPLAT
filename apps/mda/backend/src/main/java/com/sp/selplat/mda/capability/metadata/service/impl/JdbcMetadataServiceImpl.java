package com.sp.selplat.mda.capability.metadata.service.impl;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.capability.metadata.service.JdbcMetadataService;
import com.sp.selplat.mda.common.util.jdbc.JdbcConnectionFactory;
import com.sp.selplat.mda.common.util.jdbc.MdaConnectionDefinition;
import com.sp.selplat.mda.common.util.jdbc.MdaConnectionDefinitionResolver;
import com.sp.selplat.mda.common.util.metadata.MdaMetadataCache;
import com.sp.selplat.mda.common.util.metadata.MdaTableStructureSqlBuilder;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * 基于 JDBC 标准元数据构建数据库树，替代旧实现中各厂商系统表 SQL 和 ExtJS 节点拼装。
 */
@Service
public class JdbcMetadataServiceImpl implements JdbcMetadataService {

    private static final int MAX_TABLES = 1000;
    private final MdaConnectionDefinitionResolver definitionResolver;
    private final JdbcConnectionFactory connectionFactory;
    private final MdaMetadataCache metadataCache;

    /**
     * 创建使用连接配置服务和动态连接工厂的元数据服务。
     *
     * @param definitionResolver 已保存或临时连接字段解析器，例如 {@code MdaConnectionDefinitionResolver}
     * @param connectionFactory Spring 注入的目标库连接工厂，例如 {@code JdbcConnectionFactory}
     * @param metadataCache 相同目标连接的短时结构缓存，例如默认有效 60 秒
     */
    public JdbcMetadataServiceImpl(
            MdaConnectionDefinitionResolver definitionResolver,
            JdbcConnectionFactory connectionFactory,
            MdaMetadataCache metadataCache) {
        // 公共解析器负责从已保存或临时参数形成运行期连接定义。
        this.definitionResolver = definitionResolver;
        // 连接工厂负责按定义打开目标数据库连接。
        this.connectionFactory = connectionFactory;
        // 缓存只复用元数据结果，真实连接仍由连接池按请求借出和归还。
        this.metadataCache = metadataCache;
    }

    /**
     * 读取当前连接的目录、模式、表、字段和结构编辑 SQL，缓存后返回页面结构树。
     * 真实传参示例：{@code {"connectionId":1}} 指向已保存的 H2 目标连接。
     * 真实返回示例：返回包含 {@code databaseProductName=H2,nodes=[...],tableCount=2} 的成功结果。
     * 异常或副作用示例：JDBC 读取失败时抛出 {@link IllegalArgumentException}；成功结果进入短时元数据缓存。
     *
     * @param queryIn 页面提交的目标连接参数，例如 {@code {"connectionId":1}}
     * @return 当前目标库结构结果，例如 {@code {"success":true,"data":{"tableCount":2},"msg":"数据库结构读取完成。"}}
     */
    @Override
    public CommonResult getTree(CommonParam queryIn) {
        MdaConnectionDefinition definition = definitionResolver.resolve(queryIn);
        Object cached = metadataCache.get(definition).orElse(null);
        if (cached != null) {
            return success(cached, "数据库结构读取完成（缓存）。");
        }
        try (Connection connection = connectionFactory.open(definition)) {
            DatabaseMetaData metadata = connection.getMetaData();
            // JDBC 产品名 → 同一份真实方言同时提供给响应概要和每张表的结构编辑模板。
            String databaseProductName = metadata.getDatabaseProductName();
            List<String> catalogs = readCatalogs(metadata, connection.getCatalog());
            List<Map<String, Object>> catalogNodes = new ArrayList<>();
            int[] tableCounter = {0};
            for (String catalog : catalogs) {
                Map<String, Object> catalogNode = node("catalog", display(catalog, "默认数据库"));
                catalogNode.put("value", catalog);
                catalogNode.put("children", readSchemas(
                        metadata, databaseProductName, catalog, definition.schemaName(), tableCounter));
                catalogNodes.add(catalogNode);
            }
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("databaseProductName", databaseProductName);
            data.put("databaseProductVersion", metadata.getDatabaseProductVersion());
            data.put("catalogTerm", metadata.getCatalogTerm());
            data.put("schemaTerm", metadata.getSchemaTerm());
            data.put("nodes", catalogNodes);
            data.put("tableCount", tableCounter[0]);
            data.put("truncated", tableCounter[0] >= MAX_TABLES);
            metadataCache.put(definition, data);
            return success(data, "数据库结构读取完成。");
        } catch (SQLException exception) {
            throw new IllegalArgumentException("数据库结构读取失败：" + exception.getMessage(), exception);
        }
    }

    private List<String> readCatalogs(DatabaseMetaData metadata, String currentCatalog) throws SQLException {
        List<String> catalogs = new ArrayList<>();
        try (ResultSet resultSet = metadata.getCatalogs()) {
            while (resultSet.next()) {
                catalogs.add(resultSet.getString("TABLE_CAT"));
            }
        }
        // Oracle 等数据库可能没有 catalog；保留一个 null 节点后继续按 schema 读取。
        if (catalogs.isEmpty()) {
            catalogs.add(currentCatalog);
        }
        return catalogs;
    }

    /**
     * 读取一个目录下的全部 schema，并继续构建表节点。
     * 真实传参示例：{@code databaseProductName=H2,catalog=mda,preferredSchema=PUBLIC}。
     * 真实返回示例：返回 {@code [{type=schema,label=PUBLIC,children=[...]}]}。
     * 异常或副作用示例：JDBC 元数据失败时抛出 {@link SQLException}；表计数器随已读取表数量递增。
     *
     * @param metadata 当前目标连接的 JDBC 元数据，例如 H2 {@link DatabaseMetaData}
     * @param databaseProductName 当前数据库产品名，例如 {@code H2}
     * @param catalog 当前数据库目录，例如 {@code mda}
     * @param preferredSchema 连接配置中的默认 schema，例如 {@code PUBLIC}
     * @param tableCounter 当前请求已读取的表数量，例如 {@code [0]}
     * @return schema 节点列表，例如 {@code [{type=schema,label=PUBLIC,children=[...]}]}
     * @throws SQLException schema 或表元数据读取失败时抛出，不写目标数据库
     */
    private List<Map<String, Object>> readSchemas(
            DatabaseMetaData metadata,
            String databaseProductName,
            String catalog,
            String preferredSchema,
            int[] tableCounter) throws SQLException {
        List<String> schemas = new ArrayList<>();
        try (ResultSet resultSet = metadata.getSchemas(catalog, null)) {
            while (resultSet.next()) {
                schemas.add(resultSet.getString("TABLE_SCHEM"));
            }
        }
        if (schemas.isEmpty()) {
            schemas.add(preferredSchema);
        }
        List<Map<String, Object>> nodes = new ArrayList<>();
        for (String schema : schemas) {
            if (tableCounter[0] >= MAX_TABLES) {
                break;
            }
            Map<String, Object> schemaNode = node("schema", display(schema, "默认模式"));
            schemaNode.put("value", schema);
            schemaNode.put("children", readTables(
                    metadata, databaseProductName, catalog, schema, tableCounter));
            nodes.add(schemaNode);
        }
        return nodes;
    }

    /**
     * 读取一个 schema 的表和视图，并为每张表生成当前数据库方言的结构编辑模板。
     * 真实传参示例：{@code databaseProductName=H2,catalog=mda,schema=PUBLIC}。
     * 真实返回示例：返回包含 {@code tableName=FTSTYPEKBN,structureEditSql=ALTER TABLE...} 的表节点。
     * 异常或副作用示例：JDBC 元数据失败时抛出 {@link SQLException}；最多读取 1000 张表且不执行 DDL。
     *
     * @param metadata 当前目标连接的 JDBC 元数据，例如 H2 {@link DatabaseMetaData}
     * @param databaseProductName 当前数据库产品名，例如 {@code H2}
     * @param catalog 当前数据库目录，例如 {@code mda}
     * @param schema 当前表所属 schema，例如 {@code PUBLIC}
     * @param tableCounter 当前请求已读取的表数量，例如 {@code [0]}
     * @return 表节点列表，例如 {@code [{type=table,tableName=FTSTYPEKBN,structureEditSql=ALTER TABLE...}]}
     * @throws SQLException 表或字段元数据读取失败时抛出，不修改目标数据库
     */
    private List<Map<String, Object>> readTables(
            DatabaseMetaData metadata,
            String databaseProductName,
            String catalog,
            String schema,
            int[] tableCounter) throws SQLException {
        List<Map<String, Object>> nodes = new ArrayList<>();
        try (ResultSet resultSet = metadata.getTables(catalog, schema, "%", new String[] {"TABLE", "VIEW"})) {
            while (resultSet.next() && tableCounter[0] < MAX_TABLES) {
                String tableName = resultSet.getString("TABLE_NAME");
                Map<String, Object> tableNode = node("table", tableName);
                tableNode.put("catalog", catalog);
                tableNode.put("schema", schema);
                tableNode.put("tableName", tableName);
                tableNode.put("tableType", resultSet.getString("TABLE_TYPE"));
                String tableRemarks = resultSet.getString("REMARKS");
                List<String> primaryKeys = readPrimaryKeys(metadata, catalog, schema, tableName);
                List<Map<String, Object>> columns = readColumns(
                        metadata, catalog, schema, tableName, new LinkedHashSet<>(primaryKeys));
                tableNode.put("remarks", tableRemarks);
                tableNode.put("primaryKeys", primaryKeys);
                tableNode.put("children", columns);
                // 编辑页直接消费后端按真实数据库产品生成的模板，避免前端猜测数据库方言。
                tableNode.put("structureEditSql", MdaTableStructureSqlBuilder.build(
                        databaseProductName, schema, tableName, tableRemarks, columns));
                nodes.add(tableNode);
                tableCounter[0]++;
            }
        }
        return nodes;
    }

    /**
     * 把包含完整平台默认字段的表按“主键、租户、操作员、业务字段”顺序展示，同时保留真实物理序号。
     * 真实传参示例：{@code [id(1),name(2),tenantId(3),lastOperateUserId(4)]}。
     * 真实返回示例：返回 {@code [id(1),tenantId(3),lastOperateUserId(4),name(2)]}。
     * 异常或副作用示例：缺少任一默认字段时保持 JDBC 原顺序；命中时只重排当前内存列表，不修改数据库。
     *
     * @param columns JDBC 已按物理序号返回的字段节点，例如 {@code [{label=id,ordinalPosition=1}]}
     * @return 用于 MDA 树和结构页签展示的字段列表，ordinalPosition 仍表示真实物理位置
     */
    private List<Map<String, Object>> orderStandardAuditColumns(List<Map<String, Object>> columns) {
        boolean hasId = columns.stream().anyMatch(column -> "id".equalsIgnoreCase(String.valueOf(column.get("label"))));
        boolean hasTenantId = columns.stream().anyMatch(
                column -> "tenantId".equalsIgnoreCase(String.valueOf(column.get("label"))));
        boolean hasOperatorId = columns.stream().anyMatch(
                column -> "lastOperateUserId".equalsIgnoreCase(String.valueOf(column.get("label"))));
        if (!hasId || !hasTenantId || !hasOperatorId) {
            return columns;
        }
        columns.sort(Comparator
                .comparingInt((Map<String, Object> column) -> {
                    String label = String.valueOf(column.get("label"));
                    if ("id".equalsIgnoreCase(label)) {
                        return 0;
                    }
                    if ("tenantId".equalsIgnoreCase(label)) {
                        return 1;
                    }
                    if ("lastOperateUserId".equalsIgnoreCase(label)) {
                        return 2;
                    }
                    return 3;
                })
                .thenComparingInt(column -> ((Number) column.get("ordinalPosition")).intValue()));
        return columns;
    }

    /**
     * 读取表字段的顺序、类型、长度、默认值、可空性、生成属性和业务注释。
     * 真实传参示例：{@code catalog=mda,schema=PUBLIC,tableName=MdaConnectionProfile,primaryKeys=[id]}。
     * 真实返回示例：返回 {@code [{label=id,typeName=BIGINT,ordinalPosition=1,primaryKey=true}]}。
     * 异常或副作用示例：字段元数据读取失败时抛出 {@link SQLException}，不执行任何 SQL。
     *
     * @param metadata 当前目标连接的 JDBC 元数据
     * @param catalog 当前数据库目录，例如 {@code mda}
     * @param schema 当前表所属模式，例如 {@code PUBLIC}
     * @param tableName 当前真实表名，例如 {@code MdaConnectionProfile}
     * @param primaryKeys 当前表主键字段集合，例如 {@code [id]}
     * @return 按数据库字段顺序排列的字段节点
     * @throws SQLException JDBC 字段元数据读取失败时抛出
     */
    private List<Map<String, Object>> readColumns(
            DatabaseMetaData metadata,
            String catalog,
            String schema,
            String tableName,
            Set<String> primaryKeys) throws SQLException {
        List<Map<String, Object>> nodes = new ArrayList<>();
        try (ResultSet resultSet = metadata.getColumns(catalog, schema, tableName, "%")) {
            while (resultSet.next()) {
                Map<String, Object> columnNode = node("column", resultSet.getString("COLUMN_NAME"));
                columnNode.put("jdbcType", resultSet.getInt("DATA_TYPE"));
                columnNode.put("typeName", resultSet.getString("TYPE_NAME"));
                columnNode.put("size", resultSet.getInt("COLUMN_SIZE"));
                columnNode.put("decimalDigits", resultSet.getInt("DECIMAL_DIGITS"));
                columnNode.put("radix", resultSet.getInt("NUM_PREC_RADIX"));
                columnNode.put("ordinalPosition", resultSet.getInt("ORDINAL_POSITION"));
                columnNode.put("defaultValue", resultSet.getString("COLUMN_DEF"));
                columnNode.put("nullable", resultSet.getInt("NULLABLE") != DatabaseMetaData.columnNoNulls);
                columnNode.put("remarks", resultSet.getString("REMARKS"));
                columnNode.put("autoIncrement", "YES".equalsIgnoreCase(safeString(resultSet, "IS_AUTOINCREMENT")));
                columnNode.put("generated", "YES".equalsIgnoreCase(safeString(resultSet, "IS_GENERATEDCOLUMN")));
                columnNode.put("primaryKey", primaryKeys.contains(resultSet.getString("COLUMN_NAME")));
                nodes.add(columnNode);
            }
        }
        return orderStandardAuditColumns(nodes);
    }

    /**
     * 兼容读取不同 JDBC 驱动可能未提供的可选字符串字段。
     * 真实传参示例：从 H2 字段元数据读取 {@code IS_AUTOINCREMENT}。
     * 真实返回示例：驱动支持时返回 {@code YES}，不支持时返回空字符串。
     * 异常或副作用示例：只吞掉可选列缺失产生的 {@link SQLException}，不改变结果集游标。
     *
     * @param resultSet 当前已定位到字段元数据行的结果集
     * @param columnLabel JDBC 可选元数据列名，例如 {@code IS_AUTOINCREMENT}
     * @return 可选列文本，不支持时返回空字符串
     */
    private String safeString(ResultSet resultSet, String columnLabel) {
        try {
            return display(resultSet.getString(columnLabel), "");
        } catch (SQLException ignored) {
            return "";
        }
    }

    /**
     * 按 JDBC KEY_SEQ 读取表的真实主键字段，供双击行编辑和页面可编辑性判断共用。
     * 真实传参示例：{@code catalog=mda,schema=PUBLIC,tableName=MdaConnectionProfile}。
     * 真实返回示例：返回 {@code [id]}；复合主键按数据库声明顺序返回。
     * 异常或副作用示例：元数据读取失败时抛出 {@link SQLException}，没有主键时返回空列表且不修改数据库。
     *
     * @param metadata 当前目标连接的 JDBC 元数据
     * @param catalog 当前数据库目录，例如 {@code mda}
     * @param schema 当前表所属模式，例如 {@code PUBLIC}
     * @param tableName 当前真实表名，例如 {@code MdaConnectionProfile}
     * @return 主键字段名列表，例如 {@code [id]}
     * @throws SQLException JDBC 主键元数据读取失败时抛出
     */
    private List<String> readPrimaryKeys(
            DatabaseMetaData metadata, String catalog, String schema, String tableName) throws SQLException {
        List<Map.Entry<Short, String>> orderedKeys = new ArrayList<>();
        try (ResultSet resultSet = metadata.getPrimaryKeys(catalog, schema, tableName)) {
            while (resultSet.next()) {
                orderedKeys.add(Map.entry(resultSet.getShort("KEY_SEQ"), resultSet.getString("COLUMN_NAME")));
            }
        }
        orderedKeys.sort(Comparator.comparingInt(Map.Entry::getKey));
        return orderedKeys.stream().map(Map.Entry::getValue).toList();
    }

    private Map<String, Object> node(String type, String label) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("type", type);
        node.put("label", label);
        return node;
    }

    private String display(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private CommonResult success(Object data, String message) {
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setData(data);
        result.setMsg(message);
        return result;
    }
}
