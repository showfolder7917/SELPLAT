# common-db 类名清单与方法签名清单

## 目标目录

- `C:\opt\workspace\SELPLAT\shared\backend\common-db\src\main\java\com\sp\selplat\common\db`

## 设计边界

- `common-db` 只提供通用查询能力。
- 上层 DAO 负责传入：
  - `sourceKey`
  - `databaseType`
  - `tableName`
  - `selectFields`
  - `conditions`
  - `orders`
- `common-db` 负责：
  - 校验
  - SQL 生成
  - 执行查询
  - 多数据库差异适配

## 包结构建议

```text
com.sp.selplat.common.db
├─ config
├─ domain
├─ dialect
├─ metadata
└─ query
```

## 类名清单

### config

- `DatabaseType`
- `DataSourceSelector`

### domain

- `CommonDynamicQuery`
- `QueryCondition`
- `QueryOperator`
- `QueryOrder`
- `QueryOrderDirection`
- `ColumnMetadata`
- `TableMetadata`

### dialect

- `DatabaseDialect`
- `H2Dialect`
- `MySqlDialect`
- `SqlServerDialect`
- `OracleDialect`
- `PostgreSqlDialect`

### metadata

- `DatabaseMetadataReader`

### query

- `CommonQueryExecutor`
- `CommonQuerySqlBuilder`
- `CommonQueryValidator`

## 枚举定义建议

### `DatabaseType`

```java
public enum DatabaseType {
    H2,
    MYSQL,
    SQLSERVER,
    ORACLE,
    POSTGRESQL
}
```

### `QueryOperator`

第一版最少支持：

```java
public enum QueryOperator {
    EQ,
    LIKE,
    GTE,
    LTE,
    BETWEEN
}
```

### `QueryOrderDirection`

```java
public enum QueryOrderDirection {
    ASC,
    DESC
}
```

## 领域对象字段建议

### `CommonDynamicQuery`

```java
private String sourceKey;
private DatabaseType databaseType;
private String tableName;
private List<String> selectFields;
private List<QueryCondition> conditions;
private List<QueryOrder> orders;
private Integer offset;
private Integer limit;
```

### `QueryCondition`

```java
private String fieldName;
private QueryOperator operator;
private Object value;
private Object secondValue;
```

说明：

- `EQ` / `LIKE` / `GTE` / `LTE` 使用 `value`
- `BETWEEN` 使用 `value + secondValue`

### `QueryOrder`

```java
private String fieldName;
private QueryOrderDirection direction;
```

### `ColumnMetadata`

```java
private String tableName;
private String columnName;
private String dataType;
private String javaType;
private Integer length;
private Integer scale;
private Boolean primaryKey;
private String remarks;
```

### `TableMetadata`

```java
private String tableName;
private String remarks;
```

## 接口与方法签名清单

### `DataSourceSelector`

作用：

- 根据 `sourceKey` 返回工程配置中的数据源

推荐签名：

```java
public interface DataSourceSelector {
    javax.sql.DataSource select(String sourceKey);
}
```

### `DatabaseDialect`

作用：

- 处理数据库差异

推荐签名：

```java
public interface DatabaseDialect {
    DatabaseType getType();
    String buildCountSql(String baseSql);
    String buildPagedSql(String baseSql, Integer offset, Integer limit);
    String buildLikeValue(Object value);
}
```

说明：

- `buildLikeValue` 用于统一 `%value%`
- 第一版不建议让方言接口承担过多职责

### `DatabaseMetadataReader`

作用：

- 读取表和字段元数据
- 校验字段是否合法

推荐签名：

```java
public interface DatabaseMetadataReader {
    List<TableMetadata> listTables(String sourceKey, DatabaseType databaseType);
    TableMetadata getTable(String sourceKey, DatabaseType databaseType, String tableName);
    List<ColumnMetadata> listColumns(String sourceKey, DatabaseType databaseType, String tableName);
    boolean existsTable(String sourceKey, DatabaseType databaseType, String tableName);
    boolean existsColumn(String sourceKey, DatabaseType databaseType, String tableName, String columnName);
}
```

### `CommonQueryValidator`

作用：

- 校验表名
- 校验字段名
- 校验排序字段
- 校验条件字段

推荐签名：

```java
public interface CommonQueryValidator {
    void validate(CommonDynamicQuery query);
    void validateTable(String sourceKey, DatabaseType databaseType, String tableName);
    void validateSelectFields(String sourceKey, DatabaseType databaseType, String tableName, List<String> selectFields);
    void validateConditions(String sourceKey, DatabaseType databaseType, String tableName, List<QueryCondition> conditions);
    void validateOrders(String sourceKey, DatabaseType databaseType, String tableName, List<QueryOrder> orders);
}
```

### `CommonQuerySqlBuilder`

作用：

- 把结构化查询对象翻译成 SQL
- 同时生成参数列表

推荐签名：

```java
public interface CommonQuerySqlBuilder {
    String buildSelectSql(CommonDynamicQuery query);
    String buildCountSql(CommonDynamicQuery query);
    List<Object> buildParameters(CommonDynamicQuery query);
}
```

建议补一个结果对象，避免 SQL 和参数分开管理：

```java
public class BuiltQuerySql {
    private String sql;
    private List<Object> parameters;
}
```

如果采用这个对象，则推荐签名改成：

```java
public interface CommonQuerySqlBuilder {
    BuiltQuerySql buildSelect(CommonDynamicQuery query);
    BuiltQuerySql buildCount(CommonDynamicQuery query);
}
```

### `CommonQueryExecutor`

作用：

- 调用校验器
- 调用 SQL 构建器
- 选择数据源
- 执行查询

推荐签名：

```java
public interface CommonQueryExecutor {
    List<Map<String, Object>> query(CommonDynamicQuery query);
    Map<String, Object> queryOne(CommonDynamicQuery query);
    long count(CommonDynamicQuery query);
}
```

## 推荐实现类签名

### `DefaultCommonQueryValidator`

```java
public class DefaultCommonQueryValidator implements CommonQueryValidator
```

### `DefaultCommonQuerySqlBuilder`

```java
public class DefaultCommonQuerySqlBuilder implements CommonQuerySqlBuilder
```

### `DefaultCommonQueryExecutor`

```java
public class DefaultCommonQueryExecutor implements CommonQueryExecutor
```

### `DefaultDatabaseMetadataReader`

如果第一版想先简化，不分数据库实现类，也可以先做一个统一实现，再内部按 `databaseType` 分支：

```java
public class DefaultDatabaseMetadataReader implements DatabaseMetadataReader
```

如果要保持后续扩展清晰，则直接分实现类：

```java
public class H2MetadataReader implements DatabaseMetadataReader
public class MySqlMetadataReader implements DatabaseMetadataReader
public class SqlServerMetadataReader implements DatabaseMetadataReader
public class OracleMetadataReader implements DatabaseMetadataReader
public class PostgreSqlMetadataReader implements DatabaseMetadataReader
```

## 上层 DAO 推荐调用方式

例如 `UniauthUserDaoImpl` 上层准备：

```java
CommonDynamicQuery query = new CommonDynamicQuery();
query.setSourceKey("main");
query.setDatabaseType(DatabaseType.H2);
query.setTableName("ua_user");
query.setSelectFields(Arrays.asList("id", "loginName", "userStatus", "createdAt"));
query.setConditions(Arrays.asList(
    new QueryCondition("loginName", QueryOperator.LIKE, "admin", null),
    new QueryCondition("createdAt", QueryOperator.GTE, startDate, null),
    new QueryCondition("createdAt", QueryOperator.LTE, endDate, null)
));
query.setOrders(Arrays.asList(
    new QueryOrder("createdAt", QueryOrderDirection.DESC)
));
query.setOffset(0);
query.setLimit(20);
```

再调用：

```java
List<Map<String, Object>> rows = commonQueryExecutor.query(query);
long total = commonQueryExecutor.count(query);
```

## 第一版强制支持能力清单

- 表名传入
- fields 传入
- `EQ`
- `LIKE`
- `GTE`
- `LTE`
- `BETWEEN`
- `ORDER BY`
- 分页
- 多数据源选择
- 多数据库类型分发

## 第一版不建议直接做的内容

- 自动猜表名
- 自动猜数据库类型
- 自动生成默认排序
- 自动放开所有字段查询
- 让前端直接传原始 SQL 片段

## 最终推荐最小集合

如果只保留最核心的类，第一版至少需要：

- `DatabaseType`
- `CommonDynamicQuery`
- `QueryCondition`
- `QueryOperator`
- `QueryOrder`
- `QueryOrderDirection`
- `DatabaseDialect`
- `DatabaseMetadataReader`
- `CommonQueryValidator`
- `CommonQuerySqlBuilder`
- `CommonQueryExecutor`

这套类名和方法签名已经足够开始落代码。
