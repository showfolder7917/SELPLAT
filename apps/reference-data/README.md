# reference-data

`reference-data` 是 SELPLAT 长期运行的平台引用数据服务，统一承载可被多个业务项目复用的树和类型列表能力。

## 模块职责

- 使用 `projectCode + resourceCode` 定位已登记的树或类型资源。
- 对外提供稳定的树节点、类型选项和查询 Service 契约。
- 通过 Provider 扩展点把具体资源查询交给数据所属项目。
- 后续承载资源登记、权限校验、租户隔离、缓存和 HTTP API。

## 不负责的内容

- 不根据前端提交的任意表名直接拼接 SQL。
- 不直接读取其他项目的 DAO 或未登记数据表。
- 不承载用户认证、数据库开发工具或具体项目的私有业务规则。
- 不把批处理业务从数据所属项目搬到本模块；这里只保留引用数据自身的导入、刷新任务。

## 子模块

- `contract`：跨项目可依赖的稳定 Java 类型和查询接口。
- `backend`：Provider 注册、查询路由以及未来的 API、缓存和持久化实现。
- `frontend`：未来的资源登记与维护页面。
- `doc`：架构、接口、资源登记和运维文档。
- `manifest`：平台模块身份与路由元数据。

## 依赖方向

```text
业务项目 → reference-data:contract
host     → reference-data:backend
backend  → contract + shared
```

业务项目只能调用 contract 中的 Service，不得跨模块访问 reference-data 的 DAO。
