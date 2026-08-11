# reference-data 接入说明

reference-data 使用数据库稳定坐标 `projectCode + resourceCode` 管理树、下拉选项和右键菜单。

## 数据归属

- `ReferenceDataType` 登记资源坐标和多语言说明。
- `ReferenceDataTreeNode` 保存树节点。
- `ReferenceDataOption` 保存下拉选项。
- `ReferenceDataContextMenuItem` 保存右键菜单和子菜单。
- `ReferenceDataTable` 登记表格所在项目、真实表、表格配置 ID、描述和页面位置。
- `ReferenceDataTableColumn` 保存每个已登记表格的字段列配置。

业务项目通过 reference-data 的管理能力登记数据；运行时查询只按稳定坐标访问，不接受客户端
提交表名或 SQL。

## HTTP 查询

```text
GET /api/reference-data/cms/channel/tree?locale=zh-CN
GET /api/reference-data/cms/content-type/options?locale=zh-CN
GET /api/reference-data/cms/content-type/context-menu?locale=zh-CN
```

管理页面通过 `/reference-data/reference-data.html` 访问，正式数据写入
`apps/reference-data/db/reference-data.mv.db`。

## 结构门禁

受管数据库应用的 common 外一级目录必须与真实 `schema-<Table>.sql` 双向对应，每个表业务
只允许 `controller`、`service/impl`、`dao`。公共无状态方法进入 `common/util`，跨表业务通过
其他表 Service 协作，禁止直接访问其他表 DAO。
