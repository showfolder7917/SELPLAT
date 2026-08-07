package com.sp.selplat.mda.metadata;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.common.jdbc.JdbcConnectionFactory;
import com.sp.selplat.mda.common.jdbc.MdaConnectionDefinition;
import com.sp.selplat.mda.connectionprofile.service.MdaConnectionProfileService;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * 基于 JDBC 标准元数据构建数据库树，替代旧实现中各厂商系统表 SQL 和 ExtJS 节点拼装。
 */
@Service
public class JdbcMetadataServiceImpl implements JdbcMetadataService {

    private static final int MAX_TABLES = 1000;
    private final MdaConnectionProfileService profileService;
    private final JdbcConnectionFactory connectionFactory;

    /**
     * 创建使用连接配置服务和动态连接工厂的元数据服务。
     *
     * @param profileService Spring 注入的连接配置服务，例如 {@code MdaConnectionProfileServiceImpl}
     * @param connectionFactory Spring 注入的目标库连接工厂，例如 {@code JdbcConnectionFactory}
     */
    public JdbcMetadataServiceImpl(
            MdaConnectionProfileService profileService,
            JdbcConnectionFactory connectionFactory) {
        // 配置服务负责从已保存或临时参数形成运行期连接定义。
        this.profileService = profileService;
        // 连接工厂负责按定义打开目标数据库连接。
        this.connectionFactory = connectionFactory;
    }

    @Override
    public CommonResult getTree(CommonParam queryIn) {
        MdaConnectionDefinition definition = profileService.loadDefinition(queryIn);
        try (Connection connection = connectionFactory.open(definition)) {
            DatabaseMetaData metadata = connection.getMetaData();
            List<String> catalogs = readCatalogs(metadata, connection.getCatalog());
            List<Map<String, Object>> catalogNodes = new ArrayList<>();
            int[] tableCounter = {0};
            for (String catalog : catalogs) {
                Map<String, Object> catalogNode = node("catalog", display(catalog, "默认数据库"));
                catalogNode.put("value", catalog);
                catalogNode.put("children", readSchemas(metadata, catalog, definition.schemaName(), tableCounter));
                catalogNodes.add(catalogNode);
            }
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("databaseProductName", metadata.getDatabaseProductName());
            data.put("databaseProductVersion", metadata.getDatabaseProductVersion());
            data.put("catalogTerm", metadata.getCatalogTerm());
            data.put("schemaTerm", metadata.getSchemaTerm());
            data.put("nodes", catalogNodes);
            data.put("tableCount", tableCounter[0]);
            data.put("truncated", tableCounter[0] >= MAX_TABLES);
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

    private List<Map<String, Object>> readSchemas(
            DatabaseMetaData metadata,
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
            schemaNode.put("children", readTables(metadata, catalog, schema, tableCounter));
            nodes.add(schemaNode);
        }
        return nodes;
    }

    private List<Map<String, Object>> readTables(
            DatabaseMetaData metadata,
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
                tableNode.put("remarks", resultSet.getString("REMARKS"));
                tableNode.put("children", readColumns(metadata, catalog, schema, tableName));
                nodes.add(tableNode);
                tableCounter[0]++;
            }
        }
        return nodes;
    }

    private List<Map<String, Object>> readColumns(
            DatabaseMetaData metadata,
            String catalog,
            String schema,
            String tableName) throws SQLException {
        List<Map<String, Object>> nodes = new ArrayList<>();
        try (ResultSet resultSet = metadata.getColumns(catalog, schema, tableName, "%")) {
            while (resultSet.next()) {
                Map<String, Object> columnNode = node("column", resultSet.getString("COLUMN_NAME"));
                columnNode.put("jdbcType", resultSet.getInt("DATA_TYPE"));
                columnNode.put("typeName", resultSet.getString("TYPE_NAME"));
                columnNode.put("size", resultSet.getInt("COLUMN_SIZE"));
                columnNode.put("nullable", resultSet.getInt("NULLABLE") != DatabaseMetaData.columnNoNulls);
                columnNode.put("remarks", resultSet.getString("REMARKS"));
                nodes.add(columnNode);
            }
        }
        return nodes;
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
