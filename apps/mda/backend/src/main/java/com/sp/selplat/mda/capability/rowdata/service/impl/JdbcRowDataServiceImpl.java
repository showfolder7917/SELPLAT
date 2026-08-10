package com.sp.selplat.mda.capability.rowdata.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.mda.capability.rowdata.service.JdbcRowDataService;
import com.sp.selplat.mda.common.util.jdbc.JdbcConnectionFactory;
import com.sp.selplat.mda.common.util.jdbc.MdaConnectionDefinition;
import com.sp.selplat.mda.common.util.jdbc.MdaConnectionDefinitionResolver;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * 使用 JDBC 元数据校验表、字段和主键，并通过 PreparedStatement 更新唯一目标记录。
 */
@Service
public class JdbcRowDataServiceImpl implements JdbcRowDataService {

    // 连接定义解析器保证行编辑与查询页签使用同一份已保存目标连接。
    private final MdaConnectionDefinitionResolver definitionResolver;
    // 连接工厂从目标库专属连接池借出连接，禁止误写 MDA 控制库。
    private final JdbcConnectionFactory connectionFactory;

    /**
     * 创建目标库单行更新服务。
     * 真实传参示例：注入当前 MDA 的连接定义解析器和目标连接工厂。
     * 真实返回示例：构造出可校验真实主键并执行单行更新的服务。
     * 异常或副作用示例：依赖缺失时由 Spring 阻止启动，不打开数据库连接。
     *
     * @param definitionResolver 已保存目标连接的运行期定义解析器
     * @param connectionFactory 按连接定义借用隔离连接池的工厂
     */
    public JdbcRowDataServiceImpl(
            MdaConnectionDefinitionResolver definitionResolver,
            JdbcConnectionFactory connectionFactory) {
        this.definitionResolver = definitionResolver;
        this.connectionFactory = connectionFactory;
    }

    /**
     * 校验页面提交的表、字段、真实主键和值后更新唯一一行。
     * 真实传参示例：{@code tableName=Demo,primaryKeyValues={id=1},values={name=修改后}}。
     * 真实返回示例：返回 {@code {success=true,data={affectedRows=1},msg=数据更新完成。}}。
     * 异常或副作用示例：不存在主键、未知字段或影响行数不是 1 时回滚并抛出异常。
     *
     * @param updateIn 编辑窗口提交的连接、目录、模式、表名、原主键和值
     * @return 单行更新结果，affectedRows 固定为 1
     */
    @Override
    public CommonResult updateRow(CommonParam updateIn) {
        MdaConnectionDefinition definition = definitionResolver.resolve(updateIn);
        String catalog = text(updateIn.getParam("catalog"));
        String schema = text(updateIn.getParam("schema"));
        String tableName = requiredText(updateIn.getParam("tableName"), "tableName");
        Map<String, Object> submittedPrimaryKeys = requiredMap(updateIn.getParam("primaryKeyValues"), "primaryKeyValues");
        Map<String, Object> submittedValues = requiredMap(updateIn.getParam("values"), "values");
        try (Connection connection = connectionFactory.open(definition)) {
            boolean originalAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                DatabaseMetaData metadata = connection.getMetaData();
                Map<String, Integer> columns = readColumns(metadata, catalog, schema, tableName);
                List<String> primaryKeys = readPrimaryKeys(metadata, catalog, schema, tableName);
                Map<String, Object> primaryKeyValues = resolveValues(submittedPrimaryKeys, primaryKeys, columns, true);
                Map<String, Object> updateValues = resolveValues(submittedValues, List.of(), columns, false);
                primaryKeys.forEach(updateValues::remove);
                if (updateValues.isEmpty()) {
                    throw businessFailure("MDA_ROW_NO_EDITABLE_VALUES", "没有可更新的非主键字段。");
                }
                String sql = buildUpdateSql(metadata, catalog, schema, tableName, updateValues, primaryKeys);
                int affectedRows = executeUpdate(connection, sql, columns, updateValues, primaryKeyValues, primaryKeys);
                if (affectedRows != 1) {
                    throw businessFailure("MDA_ROW_TARGET_CHANGED", "数据已变化或主键定位异常，本次更新影响 " + affectedRows + " 行，已回滚。");
                }
                connection.commit();
                connection.setAutoCommit(originalAutoCommit);
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("affectedRows", affectedRows);
                data.put("primaryKeyValues", primaryKeyValues);
                return success(data, "数据更新完成。");
            } catch (SQLException | RuntimeException exception) {
                connection.rollback();
                throw exception;
            } finally {
                connection.setAutoCommit(originalAutoCommit);
            }
        } catch (SQLException exception) {
            throw new CommonBusinessException("MDA_ROW_UPDATE_FAILED", "数据更新失败，请检查字段类型或数据库约束。", exception);
        }
    }

    /**
     * 从 JDBC 元数据读取真实字段名和类型。
     * 真实传参示例：{@code catalog=mda,schema=PUBLIC,tableName=Demo}。
     * 真实返回示例：返回 {@code {id=4,name=12}}，值为 JDBC 类型码。
     * 异常或副作用示例：表不存在时抛出 {@link IllegalArgumentException}，不执行 SQL。
     */
    private Map<String, Integer> readColumns(
            DatabaseMetaData metadata, String catalog, String schema, String tableName) throws SQLException {
        Map<String, Integer> columns = new LinkedHashMap<>();
        try (ResultSet resultSet = metadata.getColumns(blankToNull(catalog), blankToNull(schema), tableName, "%")) {
            while (resultSet.next()) {
                columns.put(resultSet.getString("COLUMN_NAME"), resultSet.getInt("DATA_TYPE"));
            }
        }
        if (columns.isEmpty()) {
            throw businessFailure("MDA_ROW_TABLE_NOT_FOUND", "目标表不存在或当前账号不可读取表结构：" + tableName);
        }
        return columns;
    }

    /**
     * 按 KEY_SEQ 读取目标表全部主键字段。
     * 真实传参示例：表 {@code Demo} 的复合主键为 tenantId、id。
     * 真实返回示例：返回 {@code [tenantId,id]}。
     * 异常或副作用示例：表没有主键时抛出 {@link IllegalArgumentException}，禁止无条件更新。
     */
    private List<String> readPrimaryKeys(
            DatabaseMetaData metadata, String catalog, String schema, String tableName) throws SQLException {
        List<Map.Entry<Short, String>> orderedKeys = new ArrayList<>();
        try (ResultSet resultSet = metadata.getPrimaryKeys(blankToNull(catalog), blankToNull(schema), tableName)) {
            while (resultSet.next()) {
                orderedKeys.add(Map.entry(resultSet.getShort("KEY_SEQ"), resultSet.getString("COLUMN_NAME")));
            }
        }
        orderedKeys.sort(Comparator.comparingInt(Map.Entry::getKey));
        List<String> primaryKeys = orderedKeys.stream().map(Map.Entry::getValue).toList();
        if (primaryKeys.isEmpty()) {
            throw businessFailure("MDA_ROW_PRIMARY_KEY_REQUIRED", "目标表没有主键，禁止直接编辑数据。");
        }
        return primaryKeys;
    }

    /**
     * 把页面字段名解析成数据库真实大小写，并校验主键集合完整性。
     * 真实传参示例：{@code submitted={ID=1},requiredNames=[id],columns={id=4,name=12}}。
     * 真实返回示例：返回 {@code {id=1}}。
     * 异常或副作用示例：未知字段或主键缺失时抛出异常，不修改输入映射。
     */
    private Map<String, Object> resolveValues(
            Map<String, Object> submitted,
            List<String> requiredNames,
            Map<String, Integer> columns,
            boolean exactRequiredSet) {
        Map<String, Object> resolved = new LinkedHashMap<>();
        submitted.forEach((submittedName, value) -> {
            String actualName = columns.keySet().stream()
                    .filter(columnName -> columnName.equalsIgnoreCase(submittedName))
                    .findFirst()
                    .orElseThrow(() -> businessFailure("MDA_ROW_COLUMN_NOT_FOUND", "字段不存在：" + submittedName));
            resolved.put(actualName, value);
        });
        if (exactRequiredSet && (resolved.size() != requiredNames.size() || !resolved.keySet().containsAll(requiredNames))) {
            throw businessFailure("MDA_ROW_PRIMARY_KEY_INCOMPLETE", "主键字段不完整，无法唯一定位目标记录。");
        }
        return resolved;
    }

    /**
     * 使用数据库标识符引号生成参数化 UPDATE。
     * 真实传参示例：{@code tableName=Demo,values={name=修改后},primaryKeys=[id]}。
     * 真实返回示例：返回 {@code UPDATE "PUBLIC"."Demo" SET "name" = ? WHERE "id" = ?}。
     * 异常或副作用示例：只生成 SQL 字符串，不拼接任何页面字段值也不执行更新。
     */
    private String buildUpdateSql(
            DatabaseMetaData metadata,
            String catalog,
            String schema,
            String tableName,
            Map<String, Object> values,
            List<String> primaryKeys) throws SQLException {
        String quote = text(metadata.getIdentifierQuoteString()).trim();
        String databaseProduct = text(metadata.getDatabaseProductName()).toUpperCase(Locale.ROOT);
        List<String> qualifiers = new ArrayList<>();
        if (!schema.isBlank()) {
            qualifiers.add(schema);
        } else if (databaseProduct.contains("MYSQL") && !catalog.isBlank()) {
            qualifiers.add(catalog);
        }
        qualifiers.add(tableName);
        String qualifiedTable = qualifiers.stream().map(identifier -> quoteIdentifier(identifier, quote))
                .reduce((left, right) -> left + "." + right).orElseThrow();
        String assignments = values.keySet().stream()
                .map(column -> quoteIdentifier(column, quote) + " = ?")
                .reduce((left, right) -> left + ", " + right).orElseThrow();
        String predicates = primaryKeys.stream()
                .map(column -> quoteIdentifier(column, quote) + " = ?")
                .reduce((left, right) -> left + " AND " + right).orElseThrow();
        return "UPDATE " + qualifiedTable + " SET " + assignments + " WHERE " + predicates;
    }

    /**
     * 按 JDBC 类型绑定新值和原主键并执行唯一 UPDATE。
     * 真实传参示例：{@code values={name=修改后},primaryKeyValues={id=1}}。
     * 真实返回示例：目标记录存在时返回 {@code 1}。
     * 异常或副作用示例：类型转换或约束失败时抛出 {@link SQLException}，上层事务回滚。
     */
    private int executeUpdate(
            Connection connection,
            String sql,
            Map<String, Integer> columns,
            Map<String, Object> values,
            Map<String, Object> primaryKeyValues,
            List<String> primaryKeys) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int parameterIndex = 1;
            for (Map.Entry<String, Object> value : values.entrySet()) {
                bind(statement, parameterIndex++, value.getValue(), columns.get(value.getKey()));
            }
            for (String primaryKey : primaryKeys) {
                bind(statement, parameterIndex++, primaryKeyValues.get(primaryKey), columns.get(primaryKey));
            }
            return statement.executeUpdate();
        }
    }

    /**
     * 使用真实 JDBC 类型绑定一个字段值。
     * 真实传参示例：{@code index=1,value=修改后,jdbcType=VARCHAR}。
     * 真实返回示例：PreparedStatement 第一个参数成为字符串“修改后”。
     * 异常或副作用示例：null 使用 setNull；驱动拒绝类型转换时抛出 {@link SQLException}。
     */
    private void bind(PreparedStatement statement, int index, Object value, int jdbcType) throws SQLException {
        if (value == null) {
            statement.setNull(index, jdbcType == Types.NULL ? Types.VARCHAR : jdbcType);
            return;
        }
        statement.setObject(index, value, jdbcType);
    }

    /**
     * 使用数据库声明的引号安全包装真实标识符。
     * 真实传参示例：{@code identifier=Demo,quote="}。
     * 真实返回示例：返回 {@code "Demo"}。
     * 异常或副作用示例：数据库不使用引号时返回原标识符，不接收页面自由 SQL。
     */
    private String quoteIdentifier(String identifier, String quote) {
        return quote.isBlank() ? identifier : quote + identifier.replace(quote, quote + quote) + quote;
    }

    /**
     * 读取必填文本参数。
     * 真实传参示例：{@code value=Demo,name=tableName}。
     * 真实返回示例：返回 {@code Demo}。
     * 异常或副作用示例：空值抛出 {@link CommonBusinessException}，不连接数据库。
     */
    private String requiredText(Object value, String name) {
        String result = text(value);
        if (result.isBlank()) {
            throw businessFailure("MDA_ROW_REQUIRED_PARAMETER", name + " 不能为空。");
        }
        return result;
    }

    /**
     * 读取页面提交的动态字段映射。
     * 真实传参示例：{@code value={id=1}} 或 JSON 文本 {@code {"id":1}}，名称为 {@code primaryKeyValues}。
     * 真实返回示例：返回保序副本 {@code {id=1}}。
     * 异常或副作用示例：空值、非 Map 或非法 JSON 抛出业务异常，不修改原对象。
     */
    private Map<String, Object> requiredMap(Object value, String name) {
        Object sourceValue = value;
        if (value instanceof String jsonValue && !jsonValue.isBlank()) {
            try {
                sourceValue = JsonUtils.fromJson(jsonValue, Map.class);
            } catch (IllegalStateException exception) {
                throw new CommonBusinessException("MDA_ROW_INVALID_MAP", name + " 格式不正确。", exception);
            }
        }
        if (!(sourceValue instanceof Map<?, ?> source) || source.isEmpty()) {
            throw businessFailure("MDA_ROW_REQUIRED_PARAMETER", name + " 不能为空。");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, mapValue) -> result.put(String.valueOf(key), mapValue));
        return result;
    }

    /**
     * 把可空 JDBC 过滤条件转换为 null。
     * 真实传参示例：空字符串或 {@code PUBLIC}。
     * 真实返回示例：分别返回 null 或 {@code PUBLIC}。
     * 异常或副作用示例：不修改输入，也不访问数据库。
     */
    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    /**
     * 把可空参数转换为稳定文本。
     * 真实传参示例：null 或 {@code Demo}。
     * 真实返回示例：分别返回空字符串或 {@code Demo}。
     * 异常或副作用示例：不抛出空指针异常，也不修改输入。
     */
    private String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    /**
     * 创建可安全返回页面的行编辑业务异常。
     * 真实传参示例：{@code errorCode=MDA_ROW_PRIMARY_KEY_REQUIRED,message=目标表没有主键。}。
     * 真实返回示例：返回带稳定错误码和中文提示的 {@link CommonBusinessException}。
     * 异常或副作用示例：只创建异常对象，不记录日志、不访问数据库也不修改事务。
     *
     * @param errorCode 页面可稳定识别的错误码，例如 {@code MDA_ROW_PRIMARY_KEY_REQUIRED}
     * @param message 可安全展示的中文提示，例如 {@code 目标表没有主键。}
     * @return 尚未抛出的行编辑业务异常
     */
    private CommonBusinessException businessFailure(String errorCode, String message) {
        return new CommonBusinessException(errorCode, message);
    }

    /**
     * 构建统一单行更新成功响应。
     * 真实传参示例：{@code data={affectedRows=1},message=数据更新完成。}。
     * 真实返回示例：返回 {@code {success=true,data={affectedRows=1},msg=数据更新完成。}}。
     * 异常或副作用示例：只创建响应对象，不再次访问目标数据库。
     */
    private CommonResult success(Object data, String message) {
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setData(data);
        result.setMsg(message);
        return result;
    }
}
