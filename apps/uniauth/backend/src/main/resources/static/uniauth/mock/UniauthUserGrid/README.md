# UniauthUserGrid JSON 业务片段说明

JSON 标准不支持注释，因此本文件集中说明每份 JSON 的业务用途。生产环境由后端接口一次聚合返回，静态文件只用于页面演示和接口契约验证。

当前目录属于 `uniauth` 应用的 mock 层，由 `uniauth.js` 读取并聚合。`static/sel` 下的基础控件不能直接读取本目录。

- `UniauthUserGrid.data.json`：与语言无关的真实表格行数据；类型和状态使用稳定代码。
- `<locale>/UniauthUserGrid.column.json`：表格列顺序、标题、渲染器和排序语义。
- `<locale>/UniauthUserGrid.tree.json`：左侧树节点、显示文字、数量和稳定代码筛选条件。
- `<locale>/UniauthUserGrid.title.json`：页面标题、副标题、状态标签、顶部动作和日期文字。
- `<locale>/UniauthUserGrid.search.json`：搜索名称、占位文字、查询按钮、清空按钮和提交行为。
- `<locale>/UniauthUserGrid.menu.json`：一级菜单、二级菜单、禁用、危险和滚动阈值。
- `<locale>/UniauthUserGrid.pagination.json`：总数、页数、可见页码和本地化反馈模板。
- `<locale>/UniauthUserGrid.select.projectType.json`：项目类型下拉框。
- `<locale>/UniauthUserGrid.select.status.json`：项目状态下拉框。
- `<locale>/UniauthUserGrid.select.pageSize.json`：每页条数下拉框。

字段约束：

- `gridId`：后端业务表格标识，例如 `UniauthUserGrid`。
- `entity`：后端实体名称，例如 `UniauthUser`。
- `value`：筛选、菜单或状态的稳定业务代码，不随语言变化。
- `label`：当前语言的显示文字，可以由后端按 `locale` 返回。
- `renderer`：基础表格公开支持的渲染器名称，不允许携带可执行代码。
- `filter`：树节点选择后传给表格的稳定代码筛选条件。
- `items`：保持后端返回顺序的业务项目数组。
