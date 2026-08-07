# reference-data 接入说明

## Provider 登记

业务项目实现 `ReferenceDataProvider` 并交给 Spring 管理。每个 Provider 必须声明唯一的：

```text
projectCode + resourceCode
```

Provider 负责自己的 DAO、事务、排序、本地化与过滤白名单；reference-data 只完成逻辑路由、
不可变结果保护和统一异常转换。禁止把表名或 SQL 当成 `resourceCode` 直接执行。

## 查询入口

同一 JVM 内调用 `ReferenceDataQueryService`：

```java
ReferenceDataQuery query = new ReferenceDataQuery(
        "cms",
        "channel",
        "10001",
        Map.of("locale", "zh-CN", "status", "ACTIVE"));
List<TreeNode> nodes = referenceDataQueryService.getTree(query);
```

浏览器或外部调用使用：

```text
GET /api/reference-data/cms/channel/tree?tenantId=10001&locale=zh-CN&status=ACTIVE
GET /api/reference-data/cms/content-type/options?tenantId=10001&locale=zh-CN
```

## 第一版错误编码

| 错误编码 | 类型 | 含义 |
|---|---|---|
| `REFERENCE_DATA_PROJECT_CODE_REQUIRED` | BUSINESS | 缺少项目编码 |
| `REFERENCE_DATA_RESOURCE_CODE_REQUIRED` | BUSINESS | 缺少资源编码 |
| `REFERENCE_DATA_QUERY_REQUIRED` | BUSINESS | 内部调用未提供查询对象 |
| `REFERENCE_DATA_RESOURCE_NOT_FOUND` | BUSINESS | 资源没有登记 |
| `REFERENCE_DATA_DUPLICATE_RESOURCE` | SYSTEM | 两个 Provider 登记同一坐标，阻断启动 |
| `REFERENCE_DATA_PROVIDER_CONFIGURATION_INVALID` | SYSTEM | Provider 坐标配置无效，阻断启动 |
| `REFERENCE_DATA_PROVIDER_FAILED` | SYSTEM | Provider 返回 null 或发生未包装技术故障 |

## 后续阶段

- 类型目录和启停状态已持久化；下一阶段实现类型下的数据项管理。
- 按租户、资源、语言和版本隔离缓存。
- 接入 Uniauth 权限决策和数据范围。
- 为 CMS 栏目树等业务资源增加所属项目 Provider。

## 管理端边界

类型管理后台通过 `/reference-data/reference-data.html` 访问，数据写入
`apps/reference-data/db/data/reference-data.mv.db`。类型目录保存逻辑坐标和展示元数据，不保存用户提交的 SQL、表名或任意物理连接信息。

当前管理 API 未接入权限拦截。接入 Uniauth 后，前端负责按授权结果隐藏按钮，后端仍必须对每个管理 API 做最终权限判定；前端隐藏不能替代后端鉴权。
