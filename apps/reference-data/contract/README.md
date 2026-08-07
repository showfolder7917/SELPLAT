# reference-data contract

本模块定义引用数据跨项目调用的稳定契约，不包含 Spring Controller、数据库访问和业务实现。

当前契约：

- `ReferenceDataQuery`：使用 `projectCode + resourceCode` 表达逻辑资源查询。
- `TreeNode`：通用树节点返回结构。
- `TypeOption`：通用类型和下拉选项返回结构。
- `ReferenceDataQueryService`：同一 JVM 内供业务模块调用的查询接口。

查询成功直接返回不可变 `List<TreeNode>` 或 `List<TypeOption>`；HTTP 使用的
`CommonResult` 由 backend 的 API Service 构建，不进入跨项目查询契约。

约束：

- 调用方只依赖本模块，不依赖 `reference-data:backend`。
- `resourceCode` 是稳定逻辑编码，不是客户端可任意指定的数据库表名。
- 缺少逻辑编码或查询未登记资源时统一抛 `CommonBusinessException`。
- Provider 返回 null 或发生未包装技术故障时由 backend 转换为 `CommonSystemException`。
- 后续若拆成独立服务，HTTP Client 仍应实现同一业务契约。
