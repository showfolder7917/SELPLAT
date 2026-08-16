# reference-data

`reference-data` 是 SELPLAT 的引用数据与页面配置服务，分别承载类型目录、独立树、表格元素和页面布局能力。

## 模块职责

- 六张实体表各用自己的主键号段，记录 `code` 固定为“对象类型前缀 + 本表 id”；`ReferenceDataObjectId` 仅发放 `optionSetCode` 等没有实体表的通用逻辑编码。
- `ReferenceDataType.optionSetCode` 维护可复用选项组；页面和 Window 内多个真实控件可通过 `ReferenceDataControlLayout.optionSetCode` 共享同组选项。
- 对外分别提供稳定的类型目录和独立树 HTTP 结构。
- 六张业务表分别由自己的 Controller、Service 和 DAO 维护。
- 已通过 `/api/reference-data/**` 提供树和类型选项 HTTP API。
- 已提供独立的类型目录管理后台，并把正式数据永久保存在本模块 `db/reference-data.mv.db`。

## 不负责的内容

- 不根据前端提交的任意表名直接拼接 SQL。
- 不直接读取其他项目的 DAO 或未登记数据表。
- 不承载用户认证、数据库开发工具或具体项目的私有业务规则。
- 不把批处理业务从数据所属项目搬到本模块；这里只保留引用数据自身的导入、刷新任务。

## 子模块

- `backend`：六张表业务、code 查询、页面原子保存 API 和管理页面。
- `db`：正式迁移脚本与本模块独占的 H2 文件数据库。
- `frontend`：后续拆分 Vue 管理端时的源码入口；当前页面随 backend 静态资源发布。
- `doc`：架构、接口、资源登记和运维文档。

## 依赖方向

```text
业务项目 → reference-data HTTP API
host     → reference-data:backend
backend  → shared
```

同一 Host 进程中的公共 `getGridColumn` 通过受控 Provider 调用 Reference Data Service；应用拆分后配置
`selplat.grid-column.service-url`，相同入口自动改走公开 HTTP API。业务模块不得直接访问 Reference Data DAO。

## 第一版可用接口

```text
GET /api/reference-data/types/{typeCode}
GET /api/reference-data/trees/{rootNodeCode}
```

公共参数：

- `locale`：本地化语言参数，当前支持 `zh-CN`、`ja-JP`、`en-US`。

当前真实树根：

```text
rootNodeCode = treeNode101007
```

调用示例：

```text
GET /api/reference-data/trees/treeNode101007?locale=en-US
```

## 类型管理后台

Host 启动后访问：

```text
http://127.0.0.1:8080/reference-data/reference-data.html
```

当前页面支持五个一级模块按需加载；“表格定义”下钻到 `ReferenceDataTableElement`，提供基本信息、元素配置和效果预览。
页面编辑通过 `page+本表ID` 格式的 pageCode 一次保存控件、表格元素和 Window 布局；
控件以 `parentKind + parentCode` 明确表示直属页面、Window 或其他容器，Window 子控件另以 `fieldName` 标识真实字段或动作。正式数据库文件位于：

```text
apps/reference-data/db/reference-data.mv.db
```

迁移脚本纳入版本管理，运行数据文件不提交 Git。自动化测试使用独立的内存库或临时文件库，禁止读写正式数据库。

所有页面表格头统一调用各业务 Controller 继承的 `getGridColumn.htm`：配置命中时使用多语言名称，
配置缺失或接口不可用时静默显示真实字段名，不向用户显示错误提示。
