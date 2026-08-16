# reference-data backend

本模块由 Host 装配，按照“一张业务表对应一个业务目录”组织，不单独启动 HTTP 端口。

## 表与业务目录

| 数据库表 | Java 业务目录 | 职责 |
|---|---|---|
| `ReferenceDataType` | `referencedatatype` | 按 `optionSetCode` 管理可复用类型值、`parentTypeCode` 菜单层级及多语言名称 |
| `ReferenceDataTreeNode` | `referencedatatreenode` | 以 code + parentId 独立组织父子树节点 |
| `ReferenceDataTable` | `referencedatatable` | 以唯一 code 登记页面 SEL Grid |
| `ReferenceDataTableElement` | `referencedatatableelement` | 维护列、工具栏动作和行操作 |
| `ReferenceDataControlLayout` | `referencedatacontrollayout` | 维护页面与 Window 子控件、响应式布局及可选 `optionSetCode` 绑定 |
| `ReferenceDataWindow` | `referencedatawindow` | 维护 SEL Window 几何和行为配置 |

每个表业务只包含 `controller`、`service/impl` 和 `dao`。跨表无状态转换进入
`common`；跨表 code 查询和页面原子保存进入 `capability/configuration`，不伪装成单表目录。
类型与节点的公开只读编排进入 `capability/resourcequery`，只调用两个表业务 Service。

## 不落库能力

`capability/workbenchnavigation` 只返回工作台五个一级模块和下钻方式，不建立 DAO，也不查询
数据库。原页面 `/reference-data/reference-data.html` 首次只加载导航和当前模块，其他模块在点击时
按需读取；`ReferenceDataTableElement` 只在点击具体表格定义后作为元素明细加载。

## 查询接口

```text
GET /api/reference-data/types/{typeCode}
GET /api/reference-data/trees/{rootNodeCode}
```

类型接口只接受 `ReferenceDataType.code`；树接口只接受根节点的 `ReferenceDataTreeNode.code`。
树只通过本表 `parentId` 组织父子层级，不查询或依赖类型目录。

页面配置接口：

```text
GET  /api/reference-data/config/{code}
GET  /api/reference-data/pages/{pageCode}/configuration
POST /api/reference-data/pages/{pageCode}/configuration
```

## 数据库

`db/sql` 是唯一权威脚本根，每张表拥有独立 `schema-<Table>.sql`，每组内置数据拥有独立
`data-<Table>.sql`。正式文件库位于 `apps/reference-data/db/reference-data.mv.db`；测试必须
显式使用隔离 H2 URL。
