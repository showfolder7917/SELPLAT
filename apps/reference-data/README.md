# reference-data

`reference-data` 是 SELPLAT 长期运行的平台引用数据服务，统一承载可被多个业务项目复用的树和类型列表能力。

## 模块职责

- 使用 `projectCode + resourceCode` 定位已登记的树或类型资源。
- 对外提供稳定的树节点、类型选项和查询 Service 契约。
- 通过 Provider 扩展点把具体资源查询交给数据所属项目。
- 已通过 `/api/reference-data/**` 提供树和类型选项 HTTP API。
- 已提供独立的类型目录管理后台，并把正式数据永久保存在本模块 `db/data`。
- 后续承载数据项维护、权限校验、租户隔离和缓存。

## 不负责的内容

- 不根据前端提交的任意表名直接拼接 SQL。
- 不直接读取其他项目的 DAO 或未登记数据表。
- 不承载用户认证、数据库开发工具或具体项目的私有业务规则。
- 不把批处理业务从数据所属项目搬到本模块；这里只保留引用数据自身的导入、刷新任务。

## 子模块

- `contract`：跨项目可依赖的稳定 Java 类型和查询接口。
- `backend`：Provider 注册、查询路由、类型管理 API 和管理页面。
- `db`：正式迁移脚本与本模块独占的 H2 文件数据库。
- `frontend`：后续拆分 Vue 管理端时的源码入口；当前页面随 backend 静态资源发布。
- `doc`：架构、接口、资源登记和运维文档。
- `manifest`：平台模块身份与路由元数据。

## 依赖方向

```text
业务项目 → reference-data:contract
host     → reference-data:backend
backend  → contract + shared
```

业务项目只能调用 contract 中的 Service，不得跨模块访问 reference-data 的 DAO。

## 第一版可用接口

```text
GET /api/reference-data/{projectCode}/{resourceCode}/tree
GET /api/reference-data/{projectCode}/{resourceCode}/options
```

公共参数：

- `tenantId`：当前租户标识；平台级资源可以不传。
- `locale`：Provider 可消费的语言参数，当前内置资源支持 `zh-CN`、`ja-JP`、`en-US`。
- 其他查询参数：作为不可变参数快照传给已登记 Provider，由资源所有者解释。

当前真实内置资源：

```text
projectCode  = reference-data
resourceCode = resource-kind
```

调用示例：

```text
GET /api/reference-data/reference-data/resource-kind/tree?locale=zh-CN
GET /api/reference-data/reference-data/resource-kind/options?locale=en-US
```

## 类型管理后台

Host 启动后访问：

```text
http://127.0.0.1:8080/reference-data/reference-data.html
```

当前页面支持类型分页查询、筛选、新增、编辑和逻辑删除。正式数据库文件位于：

```text
apps/reference-data/db/data/reference-data.mv.db
```

迁移脚本纳入版本管理，运行数据文件不提交 Git。自动化测试使用独立的内存库或临时文件库，禁止读写正式数据库。

第一阶段只管理“类型目录”。数据项维护、发布管理以及 Uniauth 权限接入已预留边界，尚未开放。
