# SEL 基础控件

## 基本原则

- 基础控件不包含应用名称、业务实体、接口地址和演示数据。
- 基础控件加载时只注册公开能力，不主动扫描并控制业务页面。
- 应用必须通过 `mount(...)` 传入宿主与标准数据。
- 控件实例使用完整业务实例名登记，但不能根据实例名推测后端实体。
- 控件内部允许并且应当使用原生 `button`、`select`、`table` 等语义元素。

## 当前核心入口

```text
sel.core.freeze(value)                    深度冻结普通对象或数组快照
sel.core.query(selector)                  查询应用必需挂载点
sel.core.param(name)                      读取页面查询参数
sel.net.ajax.json({ url })                加载调用方明确指定的原始 JSON
sel.net.ajax.request({ url, method })     调用带业务结果包装的 JSON 接口
```

页面必须先加载 `/sel/core/selKernel.js`。浏览器中唯一 SEL 公共根是 `window.sel`；
`selGrid`、`selPanel` 等名称继续作为稳定控件 ID、文件名、CSS 前缀和组件内部标识，
不再发布 `window.selGrid`、`window.selPanel` 等平铺全局变量。

`sel.net.ajax` 不保存业务地址。模拟数据目录或业务接口路径必须由应用装配层明确传入。

## 应用文件如何使用组件

每个应用 JavaScript 在文件顶部校验并解构一次实际依赖，函数内部直接使用局部变量：

```javascript
window.sel.require([
    "core.query",
    "components.panel",
    "components.grid",
    "components.tree"
]);

const { freeze, query } = window.sel.core;
const { panel, grid, tree } = window.sel.components;

const host = query("[data-example-app]");
const panelRoot = panel.create(host, { gridId: "selGridExampleId" });
panel.mount(panelRoot, { view: freeze({ /* 标准聚合 payload */ }) });
grid.mount(panelRoot, freeze({ /* 标准聚合 payload */ }));
tree.mount(panelRoot, freeze({ gridId: "selGridExampleId", items: [] }));
```

组件用途与调用路径：

| 稳定控件 ID | 公共调用路径 | 主要用途 |
|---|---|---|
| `selPanel` | `sel.components.panel` | 创建标题、工具栏、左右区域、内容区和底栏 |
| `selSearch` | `sel.components.search` | 关键词输入、查询提交和清空 |
| `selTree` | `sel.components.tree` | 层级导航、节点选择和右键动作 |
| `selGrid` | `sel.components.grid` | 数据展示、筛选、分页、操作和列宽调整 |
| `selGridMenu` | `sel.components.gridMenu` | 表格记录的扩展动作菜单 |
| `selDropdownMenu` | `sel.components.dropdownMenu` | 把原生 select 装配为统一下拉控件 |
| `selTabs` | `sel.components.tabs` | 动态页签创建、切换和关闭回收 |
| `selSplitPane` | `sel.components.splitPane` | 两区拖拽分隔布局 |
| `selCodeEditor` | `sel.components.codeEditor` | 代码输入、选区读取和执行事件 |
| `selWindow` | `sel.components.window` | 承载完整业务表单流程 |
| `selConfirmDialog` | `sel.components.confirmDialog` | 承载删除等布尔确认 |
| `selTooltip` | `sel.components.tooltip` | 截断文字和纯图标动作提示 |
| `selContextMenu` | `sel.components.contextMenu` | 通用右键菜单门户与键盘导航 |
| `selDatePicker` | `sel.components.datePicker` | 日期选择和月历键盘操作 |
| `selFloatingPanel` | `sel.components.floatingPanel` | 锚定式浮动面板 |
| `selPageBackground` | `sel.components.pageBackground` | 页面背景图层与显示参数 |
| `selPersonalization` | `sel.components.personalization` | 主题、背景、文字和页面编辑设置 |

应用文件头必须用中文说明所用组件各自承担的业务职责。没有使用的组件不要解构；
应用不得重新包装或定义同名组件。

统一视觉契约位于 `theme/contract/`，主题注册表与切换管理器位于 `theme/runtime/`，完整主题放在 `theme/packs/<theme-id>/`。一个主题包同时提供深色、浅色两种模式，每种模式拥有独立基础材质、Accent 配色、边框和背景。组件样式与个性化逻辑统一读取 `--sel-theme-*`，不得复制组件或重新写死主题颜色；新增主题按 `theme/packs/README.md` 接入。

主题与素材使用同一稳定 ID 归档：主题定义位于 `theme/packs/<theme-id>/`，主题独占边框、纹理和背景位于 `assets/themes/<theme-id>/`。`assets/components/<component>/` 只保存组件专属且不随主题切换的素材；`assets/shared/` 只保存被两个及以上基础控件复用的素材；`assets/backgrounds/` 只保存由用户在背景面板独立选择的公共背景。主题 manifest 不得把其他主题或公共背景作为自动配套素材。页面根节点通过 `data-sel-theme`、`data-sel-mode`、`data-sel-accent` 和 `data-sel-density` 表达统一主题状态，不建立两套组件目录。

## 当前挂载入口

```text
sel.components.panel.mount(panelRoot, options)
sel.components.search.mount(gridRoot, searchData)
sel.components.tree.mount(gridRoot, treeData)
sel.components.gridMenu.mount(gridRoot, menuData)
sel.components.dropdownMenu.mountAll(gridRoot)
sel.components.contextMenu.mount(host, { id, ariaLabel })
sel.components.grid.mount(gridRoot, aggregatePayload)
sel.components.tabs.mount(host, { id, ariaLabel })
tabsController.setContextMenuEnabled(false)
sel.components.pageBackground.mount(backgroundHost, options)
sel.components.personalization.mount(personalizationHost, { backgroundController })
```

`selTree` 节点文字使用统一语义层级：`type=database|catalog` 映射 `heading`，`schema` 映射 `body`，`table|view` 映射 `label`，`field|column` 映射 `caption`。调用方也可在单个节点传入 `typographyRole: "heading" | "body" | "label" | "caption"` 显式覆盖；未知类型固定回落到 `label`，控件不根据应用名猜测。

全部 SEL UI 可读文字只使用 `display/title/heading/body/label/caption/micro` 七级字号，以及统一的 `regular/medium/semibold/bold` 字重与对应行高。旧 `primary/secondary` 字号令牌已删除且会被构建门禁阻断；图标、头像、复选框等几何尺寸不属于文字令牌。

`selPageBackground` 只维护背景图层和当前页面参数；`selPersonalization` 组合“主题 / 背景 / 面板 / 文字”四个独立 Tab。主题 Tab 先选择视觉风格，再选择深浅模式及该模式的独立 Accent；面板设置继续支持跟随主题、任意统一主题色和染色强度，并从主题色生成柔和、基础、抬升和强调四级色阶。切换主题或模式不会重建业务组件，也不会清除用户明确选择的文字覆盖。所有状态均不使用浏览器持久化，刷新页面恢复代码默认值。

`selContextMenu` 只负责通用右键菜单门户、视口定位、禁用状态和键盘导航，动作通过 `selContextMenu:action` 事件交回挂载宿主。`selTabs` 默认挂载该控件并提供关闭右侧、关闭其他和全部关闭；当前 Tab 继续由自身的关闭按钮处理。仅在创建时显式传入 `{ contextMenu: false }` 或运行时调用 `setContextMenuEnabled(false)` 才关闭右键菜单，传入 `true` 可重新启用。批量关闭跳过固定页签并保留 `selTabs:beforeClose` 检查。

`selGrid` 默认在每个表头字段的右边界提供列宽调整手柄。鼠标拖动分隔线只改变左侧对应列，并同步扩大表格内部宽度；键盘聚焦手柄后可使用左右方向键调整。只有聚合 payload 显式声明 `grid.columnResize: false` 时才关闭，未声明或传入 `true` 均启用。

后台动作只改变一条记录时，调用实例控制器的 `updateRecord(recordId, changes)`。该 API 只合并内存记录并替换目标业务行，保留表头、分页、滚动位置和当前动作焦点；整页数据、语言或列结构变化才使用 `setLocale(payload)`。

Grid 动作按钮默认只派发 `selGrid:action`，不会自动刷新。播放、弹窗、判题等行内动作必须保持当前 Grid 实例：无视图变化时不调用刷新，有当前行状态变化时只调用 `updateRecord`。`choice` 可用 `selectedTone(record)` 返回 `success` 或 `danger`，统一区分答对和答错的选中状态。

单元格图标可通过 `cellIconTone` 声明静态值或按记录计算的语义色。优先使用 `success`、`danger` 等主题令牌，业务页面不得写死颜色。

## 新增基础控件

1. 先在 `components/component-registry.json` 登记唯一 ID、目录、源码、公开 API、主题属性和硬依赖，禁止先在业务页面临时实现。
2. 建立 `components/<component>/sel<Component>.js` 和同名 CSS；未登记目录和源码会被快速门禁直接阻断。
3. 文件头使用中文说明用途、责任边界和公开前缀。
4. JavaScript 通过 `window.sel.register("components.<name>", api)` 发布登记路径；禁止加载后自动扫描整个文档。
5. CSS 只使用所属组件前缀并消费统一主题令牌；每个结构组和状态组添加中文注释。
6. 可读文字必须按语义消费统一字号、字重和行高令牌；不得新写 `primary/secondary` 旧令牌或用像素值代替文字角色，图标几何尺寸除外。
7. 缺少宿主结构、标准数据或登记的硬依赖时返回 `null` 或 `false` 并给出明确提示，不保留旧私有实现兼容分支。
8. 输入型控件必须提供明确提交动作；搜索控件默认通过查询按钮或 Enter 提交，不能只依赖每次输入即时触发。
9. 完成鼠标、键盘、无障碍、多实例和浏览器控制台验收；应用页面和生成模板必须按登记顺序加载硬依赖。

业务应用不得发布 `window.sel<Component>`、自行创建 `body` 交互门户或重新实现已经由公共控件登记拥有的 ARIA 交互。确需新增通用交互时，先完成中央登记和公共实现，再由首个业务调用方接入。
