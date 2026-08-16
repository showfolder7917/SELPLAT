# reference-data 接入说明

reference-data 使用“对象类型前缀 + 本表 ID”的唯一 `code` 管理六类配置对象；
`ReferenceDataType` 使用 `optionSetCode` 管理可复用选项组，以 `valueCode` 表达业务值，并通过 `parentTypeCode` 形成同一选项组内的分级菜单。

## 数据归属

- `ReferenceDataType` 登记可由多个页面或 Window 控件共享的类型值、父子菜单和多语言名称。
- `ReferenceDataTreeNode` 只保存以 `code + parentId` 组织的独立父子树节点。
- `ReferenceDataTable` 以 code 登记页面表格。
- `ReferenceDataTableElement` 保存列、工具栏动作和行操作。
- `ReferenceDataControlLayout` 保存页面和 Window 子控件、尺寸与顺序，通过 `parentKind + parentCode` 明确父容器，并以 `fieldName` 标识 Window 内真实字段或动作。
- `ReferenceDataWindow` 保存 Window 宽高、位置和缩放行为。

业务项目通过 reference-data 的管理能力登记数据；运行时查询只按唯一 code 访问，不接受客户端
提交表名或 SQL。

## HTTP 查询

```text
GET /api/reference-data/types/{typeCode}
GET /api/reference-data/trees/{rootNodeCode}?locale=zh-CN
```

管理页面通过 `/reference-data/reference-data.html` 访问，正式数据写入
`apps/reference-data/db/reference-data.mv.db`。

页面一级导航由 `/api/reference-data/workbench/navigation.htm` 提供固定五模块定义。导航能力不查库；
模块记录按点击加载，表格元素通过“表格定义 → 具体表格 → ReferenceDataTableElement”下钻查看。

## 结构门禁

受管数据库应用的 common 外一级目录必须与真实 `schema-<Table>.sql` 双向对应，每个表业务
只允许 `controller`、`service/impl`、`dao`。公共无状态方法进入 `common/util`，跨表业务通过
其他表 Service 协作，禁止直接访问其他表 DAO。
