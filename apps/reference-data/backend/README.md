# reference-data backend

本模块由 Host 装配，按照“一张业务表对应一个业务目录”组织，不单独启动 HTTP 端口。

## 表与业务目录

| 数据库表 | Java 业务目录 | 职责 |
|---|---|---|
| `ReferenceDataType` | `referencedatatype` | 管理项目与资源稳定坐标 |
| `ReferenceDataTreeNode` | `referencedatatreenode` | 查询和组织树节点 |
| `ReferenceDataOption` | `referencedataoption` | 查询下拉选项 |
| `ReferenceDataContextMenuItem` | `referencedatacontextmenuitem` | 查询多级右键菜单 |

每个表业务只包含 `controller`、`service/impl` 和 `dao`。跨表无状态转换进入
`common/util`，只能由 Service 调用。common 外禁止建立无表对应的 query、provider、manager
或 support 目录。

## 查询接口

```text
GET /api/reference-data/{projectCode}/{resourceCode}/tree
GET /api/reference-data/{projectCode}/{resourceCode}/options
GET /api/reference-data/{projectCode}/{resourceCode}/context-menu
```

三个接口分别读取自己的数据库表，并使用 `ReferenceDataType` 的项目与资源坐标定位数据。
树和菜单通过同表 `parentId` 组装多级结构；下拉选项按数据库 `sortnum` 返回。

## 数据库

`db/sql` 是唯一权威脚本根，每张表拥有独立 `schema-<Table>.sql`，每组内置数据拥有独立
`data-<Table>.sql`。正式文件库位于 `apps/reference-data/db/reference-data.mv.db`；测试必须
显式使用隔离 H2 URL。
