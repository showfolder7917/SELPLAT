# reference-data 接入说明

reference-data 使用“对象类型前缀 + 全局 ID”的唯一 `code` 管理六类配置对象；
`projectCode + resourceCode` 只作为类型业务坐标，不能用于公开定位。

## 数据归属

- `ReferenceDataType` 登记资源坐标和多语言说明。
- `ReferenceDataTreeNode` 统一保存树、下拉选项、表格菜单、面板菜单和右键菜单节点。
- `ReferenceDataTable` 以 code 登记页面表格。
- `ReferenceDataTableElement` 保存列、工具栏动作和行操作。
- `ReferenceDataControlLayout` 保存页面控件与间距、尺寸、顺序，并通过 `parentKind + parentCode` 明确父容器。
- `ReferenceDataWindow` 保存 Window 宽高、位置和缩放行为。

业务项目通过 reference-data 的管理能力登记数据；运行时查询只按唯一 code 访问，不接受客户端
提交表名或 SQL。

## HTTP 查询

```text
GET /api/reference-data/types/{typeCode}
GET /api/reference-data/types/{typeCode}/nodes?locale=zh-CN
```

管理页面通过 `/reference-data/reference-data.html` 访问，正式数据写入
`apps/reference-data/db/reference-data.mv.db`。

页面一级导航由 `/api/reference-data/workbench/navigation.htm` 提供固定五模块定义。导航能力不查库；
模块记录按点击加载，表格元素通过“表格定义 → 具体表格 → ReferenceDataTableElement”下钻查看。

## 结构门禁

受管数据库应用的 common 外一级目录必须与真实 `schema-<Table>.sql` 双向对应，每个表业务
只允许 `controller`、`service/impl`、`dao`。公共无状态方法进入 `common/util`，跨表业务通过
其他表 Service 协作，禁止直接访问其他表 DAO。
