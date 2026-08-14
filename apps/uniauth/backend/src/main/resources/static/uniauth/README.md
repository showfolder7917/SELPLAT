# Uniauth 前端演示应用

## 页面装配顺序

`uniauth.html` 只声明页面区域和基础控件宿主。`uniauth.js` 执行以下流程：

1. 根据 `multi=1` 声明需要装配的业务实例及其 `layoutId`。
2. 从 `uniauthLayouts` 一眼确认上、左、中、右、下的位置、基础控件名称和 JSON 来源。
3. 从 `uniauthDataSources` 取得明确登记的模拟 JSON 或后端接口地址。
4. 根据 `lang` 使用 `sel.net.ajax.json({ url })` 读取当前语言 JSON。
5. 聚合 `data、column、tree、title、search、menu、pagination、select`。
6. 把五区声明交给 `selPanel.create`，由基础层白名单创建真实区域和控件宿主。
7. 只挂载当前布局声明的 `selSearch、selTree、selGridMenu、selDropdownMenu、selGrid`。
8. 公开 `window.uniauth` 供演示和调试读取。

## 五区布局

`uniauth.js` 中的 `UniauthGridFiveRegion` 是当前页面模板：

- `top`：标题、搜索框、项目类型、状态、日期和重置。
- `left`：树形导航。
- `center`：主表格。
- `right`：表格行操作菜单。
- `bottom`：总数、每页条数、分页和反馈。

每个项目使用 `{ component, payload, slot, children }` 描述。调整位置时移动这条声明；删除可选区域时删除对应数组内容，其他区域仍由 `selPanel` 自适应。若需要新的通用元素，先新增或扩展 `sel` 基础控件白名单，再由应用布局引用，不能在 `uniauth.js` 直接创建原生控件。

调试时可使用：

- `uniauth.getLayout("UniauthGridFiveRegion")`：查看模板声明。
- `uniauth.getInstanceLayout("UniauthUserGrid")`：查看实例采用的模板。
- `selPanel.getRegion("UniauthUserGrid", "center")`：取得实例中央区域。
- `selPanel.getComponent("UniauthUserGrid", "selDropdownMenu", "status")`：取得实例状态下拉宿主。

## 演示入口

- `uniauth.html?lang=zh-CN`
- `uniauth.html?lang=ja-JP`
- `uniauth.html?lang=en-US`
- `uniauth.html?multi=1&lang=zh-CN`

## 接入后端

后端未接入前，`mock/` 负责模拟聚合数据，全部路径在 `uniauth.js` 的 `uniauthDataSources` 中显式登记。接入后端时把数据源切换为登记好的 `backendUrl`，再通过 `sel.net.ajax.request({ url })` 获取聚合响应；基础控件及其挂载顺序保持不变。
