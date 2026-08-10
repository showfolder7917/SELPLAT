# reference-data

`reference-data` 是 SELPLAT 长期运行的平台引用数据服务，统一承载可被多个业务项目复用的树和类型列表能力。

## 模块职责

- 使用 `projectCode + resourceCode` 定位已登记的树或类型资源。
- 对外提供稳定的树、下拉选项和右键菜单 HTTP 结构。
- 四种数据分别由自己的表业务 Controller、Service 和 DAO 维护。
- 已通过 `/api/reference-data/**` 提供树和类型选项 HTTP API。
- 已提供独立的类型目录管理后台，并把正式数据永久保存在本模块 `db/reference-data.mv.db`。

## 不负责的内容

- 不根据前端提交的任意表名直接拼接 SQL。
- 不直接读取其他项目的 DAO 或未登记数据表。
- 不承载用户认证、数据库开发工具或具体项目的私有业务规则。
- 不把批处理业务从数据所属项目搬到本模块；这里只保留引用数据自身的导入、刷新任务。

## 子模块

- `backend`：四张表业务、查询路由、类型管理 API 和管理页面。
- `db`：正式迁移脚本与本模块独占的 H2 文件数据库。
- `frontend`：后续拆分 Vue 管理端时的源码入口；当前页面随 backend 静态资源发布。
- `doc`：架构、接口、资源登记和运维文档。

## 依赖方向

```text
业务项目 → reference-data HTTP API
host     → reference-data:backend
backend  → shared
```

业务项目只能调用公开 HTTP API，不得跨模块访问 reference-data 的 Service 或 DAO。

## 第一版可用接口

```text
GET /api/reference-data/{projectCode}/{resourceCode}/tree
GET /api/reference-data/{projectCode}/{resourceCode}/options
```

公共参数：

- `tenantId`：当前租户标识；平台级资源可以不传。
- `locale`：本地化语言参数，当前支持 `zh-CN`、`ja-JP`、`en-US`。

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
apps/reference-data/db/reference-data.mv.db
```

迁移脚本纳入版本管理，运行数据文件不提交 Git。自动化测试使用独立的内存库或临时文件库，禁止读写正式数据库。

当前管理页面维护类型目录；树、下拉选项和右键菜单通过各自表业务接口读取。
