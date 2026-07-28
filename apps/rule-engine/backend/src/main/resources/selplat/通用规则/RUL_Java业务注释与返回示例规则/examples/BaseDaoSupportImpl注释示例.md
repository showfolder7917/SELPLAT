# BaseDaoSupportImpl 注释示例

来源：`shared/backend/common-db/src/main/java/com/sp/selplat/common/db/dao/BaseDaoSupportImpl.java`

以下示例保留生产类的真实方法、字段名和返回结构，用于判断新注释是否真正回答“输入什么、经过什么、返回什么”。

## 数据库上下文

```java
/**
 * 解析当前 DAO 使用的数据库上下文。
 *
 * @return {"sourceKey":"H2","databaseType":"H2",
 *     "dataSource":"org.h2.jdbcx.JdbcDataSource",
 *     "catalogName":"运行时随机UUID","schemaName":"PUBLIC"}
 */
protected CommonDbSource resolveCurrentDbSource() {
    // 解析注入的数据源 → 可供元数据、方言和查询链路复用的数据库上下文。
    return COMMON_DB_SOURCE_RESOLVER.resolve(dataSource);
}
```

## 真实主键列表

```java
/**
 * 读取当前 DAO 对应表的主键字段。
 *
 * @return ["id", "tenantId"]
 */
protected List<String> getPrimaryKeyColumnNameList() {
    // 解析当前表名 → "UniauthUser"。
    String tableName = getTableName();
    // 读取 "UniauthUser" 的主键列名 → ["id", "tenantId"]。
    List<String> idColumnList = METADATA_READER.listPrimaryKeys(commonDbSource, tableName);
    // 输出主键列名列表 → ["id", "tenantId"]，供查询、更新和删除构造条件。
    return idColumnList;
}
```

## 表名

```java
/**
 * 按 DAO 实现类命名约定解析当前表名。
 *
 * @return 表名，例如 "UniauthUser"
 */
protected String getTableName() {
    // 获取代理背后的 DAO 实现类 → "UniauthUserDaoImpl"。
    Class<?> userClass = ClassUtils.getUserClass(this);
    // 去除 "DaoImpl" 后缀 → "UniauthUser"。
    return simpleName.substring(0, simpleName.length() - "DaoImpl".length());
}
```

## 单主键和复合主键号段

```java
/**
 * 为当前表的每个主键列构建独立号段编码。
 *
 * @return {"id":"UniauthUserId","tenantId":"UniauthUserTenantId"}
 */
protected IdSequenceDefinition buildIdSequenceDefinition() {
    // 读取主键列名 → ["id", "tenantId"]。
    List<String> idColumns = getPrimaryKeyColumnNameList();
    // 输出主键列到号段编码的定义 → {"id":"UniauthUserId","tenantId":"UniauthUserTenantId"}。
    return new IdSequenceDefinition(idSequenceCodeMap);
}
```

单主键实际结果：

```text
{"id":"UniauthUserId"}
```

复合主键实际结果：

```text
{"tenantId":"UniauthUserTenantId","orderId":"UniauthUserOrderId"}
```

## 数据库字段元数据

```java
/**
 * 按数据库返回顺序读取当前表的真实字段元数据。
 *
 * @return {"id":{"columnName":"id","dataType":"BIGINT","primaryKey":true},
 *     "loginName":{"columnName":"loginName","dataType":"VARCHAR","primaryKey":false}}
 */
protected Map<String, ColumnMetadata> getDbColumnsMap() {
    // 读取表字段元数据 → ["id", "tenantId", "loginName", "status"]。
    List<ColumnMetadata> columnMetadataList = METADATA_READER.listColumns(commonDbSource, tableName);
    // 输出真实字段有序映射 → {"id":ColumnMetadata,"loginName":ColumnMetadata}。
    return dbColumnsMap;
}
```

## SELECT 列名

```java
/**
 * 生成当前表可用于 SELECT 的列名字符串。
 *
 * @return "id, tenantId, loginName, status"
 */
protected String getSelectColumns() {
    // 输出 SELECT 列名字符串 → "id, tenantId, loginName, status"。
    return String.join(", ", getDbColumnsMap().keySet());
}
```

## 前端字段匹配

```java
/**
 * 按数据库真实字段匹配前端写入参数，并保持数据库字段顺序。
 *
 * @param saveIn 前端通用参数，例如 {"id":1,"displayName":"新名称"}
 * @return 已匹配字段值，例如 {"id":1,"displayName":"新名称"}
 */
protected Map<String, Object> buildDbColumnValueMap(CommonParam saveIn) {
    // 未提供字段由数据库默认值或原值处理，不进入当前写入 SQL。
    if (!saveIn.getParamMap().containsKey(dbColumnName)) {
        continue;
    }
    // 值从原 CommonParam 按真实字段名读取 → {"id":1,"displayName":"新名称"}。
    columnValueMap.put(dbColumnName, saveIn.getParam(dbColumnName));
    return columnValueMap;
}
```
