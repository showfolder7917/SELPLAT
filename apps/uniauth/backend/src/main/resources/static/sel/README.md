# SEL 基础控件

## 基本原则

- 基础控件不包含应用名称、业务实体、接口地址和演示数据。
- 基础控件加载时只注册公开能力，不主动扫描并控制业务页面。
- 应用必须通过 `mount(...)` 传入宿主与标准数据。
- 控件实例使用完整业务实例名登记，但不能根据实例名推测后端实体。
- 控件内部允许并且应当使用原生 `button`、`select`、`table` 等语义元素。

## 当前核心入口

```text
selAjax.json({ url })               加载调用方明确指定的原始 JSON
selAjax.request({ url, method })    调用带业务结果包装的 JSON 接口
selBaseRuntime.query(selector)      查询应用必需挂载点
selBaseRuntime.param(name)          读取页面查询参数
```

`selAjax` 不保存业务地址。`./mock/UniauthUserGrid/...` 或 `/api/uniauth/...` 等路径必须由应用装配层明确传入。

统一视觉令牌位于 `theme/selThemeTokens.css`。基础皮肤色、业务语义色、组件表面映射、九宫格素材、组件边框厚度、左右安全区和视口间距只能在该层声明；组件样式与个性化逻辑统一读取 `--sel-theme-*`，不得重新写死皮肤颜色或独立的左右边框尺寸。

## 当前挂载入口

```text
selPanel.mount(panelRoot, options)
selSearch.mount(gridRoot, searchData)
selTree.mount(gridRoot, treeData)
selGridMenu.mount(gridRoot, menuData)
selDropdownMenu.mountAll(gridRoot)
selGrid.mount(gridRoot, aggregatePayload)
selPageBackground.mount(backgroundHost, options)
selPersonalization.mount(personalizationHost, { backgroundController })
```

`selPageBackground` 只维护背景图层和当前页面参数；`selPersonalization` 组合“背景设置 / 面板设置”界面并写入跨水晶组件视觉令牌。面板设置支持跟随皮肤、任意统一主题色、常用色和染色强度，并从主题色生成深色、基础、抬升和强调四级色阶，统一作用于水晶边框、玻璃底板、标题栏、导航、表单、浮层和交互强调色。背景图片、正文和业务语义状态色保持独立。两者均不使用浏览器持久化，刷新页面恢复代码默认值。

## 新增基础控件

1. 建立 `components/<component>/sel<Component>.js` 和同名 CSS。
2. 文件头使用中文说明用途、责任边界和公开前缀。
3. JavaScript 公开 `mount`；禁止加载后自动扫描整个文档。
4. CSS 只使用所属组件前缀；每个结构组和状态组添加中文注释。
5. 缺少宿主结构或标准数据时返回 `null` 或 `false` 并给出明确提示。
6. 输入型控件必须提供明确提交动作；搜索控件默认通过查询按钮或 Enter 提交，不能只依赖每次输入即时触发。
7. 完成鼠标、键盘、无障碍、多实例和浏览器控制台验收。
