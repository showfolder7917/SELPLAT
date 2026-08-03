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

统一视觉契约位于 `theme/selThemeTokens.css`，深浅皮肤分别位于 `theme/skins/selSkinDark.css` 和 `theme/skins/selSkinLight.css`。共享文件只维护派生表面、组件映射、边框几何、安全区和视口间距；每套皮肤独立提供基础明暗、文字、语义色和九宫格素材。组件样式与个性化逻辑统一读取 `--sel-theme-*`，不得复制组件或重新写死皮肤颜色。

皮肤素材与共享素材分离：`assets/skins/<skin>/components/` 只保存当前皮肤需要的真实运行材质，`assets/components/` 继续保存不随深浅变化的共用素材。页面通过根节点 `data-sel-skin="dark|light"` 切换皮肤，不建立 `sel-dark`、`sel-light` 两套组件目录。

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

`selPageBackground` 只维护背景图层和当前页面参数；`selPersonalization` 组合“皮肤 / 背景 / 面板 / 文字”四个独立 Tab。皮肤 Tab 切换深色与浅色基础令牌和配套材质；面板设置继续支持跟随皮肤、任意统一主题色、常用色和染色强度，并从主题色生成柔和、基础、抬升和强调四级色阶。切换皮肤不会重置背景、面板参数或用户明确选择的文字覆盖。所有状态均不使用浏览器持久化，刷新页面恢复代码默认值。

## 新增基础控件

1. 建立 `components/<component>/sel<Component>.js` 和同名 CSS。
2. 文件头使用中文说明用途、责任边界和公开前缀。
3. JavaScript 公开 `mount`；禁止加载后自动扫描整个文档。
4. CSS 只使用所属组件前缀；每个结构组和状态组添加中文注释。
5. 缺少宿主结构或标准数据时返回 `null` 或 `false` 并给出明确提示。
6. 输入型控件必须提供明确提交动作；搜索控件默认通过查询按钮或 Enter 提交，不能只依赖每次输入即时触发。
7. 完成鼠标、键盘、无障碍、多实例和浏览器控制台验收。
