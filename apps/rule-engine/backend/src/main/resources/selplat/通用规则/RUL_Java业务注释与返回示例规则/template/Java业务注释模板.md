# Java 业务注释模板

## 类级 Javadoc

```java
/**
 * <说明当前类在业务调用链中的职责>。
 * <说明该类负责和不负责的边界>。
 */
```

## 字段注释

```java
// <依赖或状态>负责<业务动作>，最终用于<真实结果或下游入口>。
private final SomeDependency dependency;
```

## 返回 Map 或实体的方法

```java
/**
 * <说明方法完成的业务动作>。
 *
 * @param queryIn 来自前端的查询参数，例如 {"id":1}
 * @return <真实类型和业务含义>，例如 {"id":1,"loginName":"admin","status":1}
 */
```

## 返回 List 的方法

```java
/**
 * <说明列表筛选、排序或归属>。
 *
 * @param queryIn 来自前端的批量参数，例如 [{"id":1},{"id":2}]
 * @return <列表含义>，例如 [{"id":1,"loginName":"admin"},{"id":2,"loginName":"auditor"}]
 */
```

## 返回 CommonResult 的方法

```java
/**
 * <说明非分页业务动作>。
 *
 * @param saveIn 来自前端的业务字段，例如 {"loginName":"admin","displayName":"管理员"}
 * @return 固定 CommonResult，例如
 *     {"success":true,"data":{"id":1001,"loginName":"admin","displayName":"管理员"},"msg":"新增完成。"}
 */
```

批量写入需要展示顶层 `affectedRows`：

```java
/**
 * @return 固定 CommonResult，例如
 *     {"success":true,"data":[{"id":1001},{"id":1002}],"affectedRows":2,"msg":"批量新增完成。"}
 */
```

## 返回 CommonPageResult 的方法

```java
/**
 * <说明筛选条件和默认排序>。
 *
 * @param queryIn 前端分页参数，例如 {"pageNo":1,"pageSize":10,"loginNameLike":"admin"}
 * @return 固定 CommonPageResult，例如
 *     {"records":[{"id":2,"loginName":"admin-b"},{"id":1,"loginName":"admin-a"}],
 *      "totalCount":2,"pageNo":1,"pageSize":10}
 */
```

## 单主键与复合主键定义

```java
/**
 * @return 单主键号段定义，例如 {"id":"UniauthUserId"}；
 *         复合主键号段定义，例如
 *         {"tenantId":"UniauthUserTenantId","orderId":"UniauthUserOrderId"}
 */
```

## void 与副作用

```java
/**
 * <说明写入动作>。
 *
 * @param saveIn <参数来源和实际示例>
 * 执行结果示例：数据库记录由 {"id":1,"status":1} 更新为 {"id":1,"status":0}，记录不物理删除。
 */
```

## 异常

```java
// 主键列表为空时停止 → 抛出 IllegalStateException("no primary keys found for table: UniauthUser")。
if (idColumns.isEmpty()) {
    throw new IllegalStateException("no primary keys found for table: " + tableName);
}
```

## 逐行业务结果

```java
// 读取当前 DAO 表名 → "UniauthUser"。
String tableName = getTableName();
// 读取真实主键列 → ["id", "tenantId"]。
List<String> idColumns = metadataReader.listPrimaryKeys(dbSource, tableName);
// 输出字段到号段编码的定义 → {"id":"UniauthUserId","tenantId":"UniauthUserTenantId"}。
return new IdSequenceDefinition(sequenceCodeMap);
```
