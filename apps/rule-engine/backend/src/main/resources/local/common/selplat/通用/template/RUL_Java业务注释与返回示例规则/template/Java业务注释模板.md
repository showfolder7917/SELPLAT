# Java 业务注释模板

方法 Javadoc 固定按“方法作用与边界 → 参数来源、含义和真实示例 → 返回含义和真实示例 → 异常触发条件或 void 副作用示例”书写。

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

异常 CommonResult 使用固定错误字段，成功时这些字段为 null 并被忽略：

```java
/**
 * @return 系统异常固定 CommonResult，例如
 *     {"success":false,"errorType":"SYSTEM","errorCode":"INTERNAL_ERROR",
 *      "requestId":"gateway-20260729-001","msg":"系统异常，请稍后重试。"}
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

可预期、可安全展示的业务失败使用 `CommonBusinessException`：

```java
/**
 * 按主键查询一条业务记录。
 *
 * @param queryIn 来自前端的主键参数，例如 {"id":10001}
 * @return 详情结果，例如 {"success":true,"data":{"id":10001}}
 * @throws CommonBusinessException 未命中记录时抛出，例如
 *     CommonBusinessException("RECORD_NOT_FOUND", "未找到对应的数据。")
 */
```

数据库、文件、远程服务或运行环境故障使用 `CommonSystemException`，并保留原始 `cause`：

```java
try (Connection connection = dataSource.getConnection()) {
    // 读取连接元数据并形成公共数据库上下文。
} catch (SQLException exception) {
    // 技术故障只公开稳定编码和安全提示，原始 SQLException 保留在 cause 链。
    throw new CommonSystemException(
        "DATABASE_SOURCE_RESOLVE_FAILED",
        "数据库连接信息读取失败。",
        exception
    );
}
```

构造参数非法、内部状态断言等编程契约仍可使用 JDK 异常，但必须写清触发条件和示例：

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
