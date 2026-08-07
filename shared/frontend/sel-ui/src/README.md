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

`selAjax` 不保存业务地址。模拟数据目录或业务接口路径必须由应用装配层明确传入。

统一视觉契约位于 `theme/contract/`，主题注册表与切换管理器位于 `theme/runtime/`，完整主题放在 `theme/packs/<theme-id>/`。一个主题包同时提供深色、浅色两种模式，每种模式拥有独立基础材质、Accent 配色、边框和背景。组件样式与个性化逻辑统一读取 `--sel-theme-*`，不得复制组件或重新写死主题颜色；新增主题按 `theme/packs/README.md` 接入。

主题与素材使用同一稳定 ID 归档：主题定义位于 `theme/packs/<theme-id>/`，主题独占边框、纹理和背景位于 `assets/themes/<theme-id>/`。`assets/components/<component>/` 只保存组件专属且不随主题切换的素材；`assets/shared/` 只保存被两个及以上基础控件复用的素材；`assets/backgrounds/` 只保存由用户在背景面板独立选择的公共背景。主题 manifest 不得把其他主题或公共背景作为自动配套素材。页面根节点通过 `data-sel-theme`、`data-sel-mode`、`data-sel-accent` 和 `data-sel-density` 表达统一主题状态，不建立两套组件目录。

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

`selPageBackground` 只维护背景图层和当前页面参数；`selPersonalization` 组合“主题 / 背景 / 面板 / 文字”四个独立 Tab。主题 Tab 先选择视觉风格，再选择深浅模式及该模式的独立 Accent；面板设置继续支持跟随主题、任意统一主题色和染色强度，并从主题色生成柔和、基础、抬升和强调四级色阶。切换主题或模式不会重建业务组件，也不会清除用户明确选择的文字覆盖。所有状态均不使用浏览器持久化，刷新页面恢复代码默认值。

## 新增基础控件

1. 建立 `components/<component>/sel<Component>.js` 和同名 CSS。
2. 文件头使用中文说明用途、责任边界和公开前缀。
3. JavaScript 公开 `mount`；禁止加载后自动扫描整个文档。
4. CSS 只使用所属组件前缀；每个结构组和状态组添加中文注释。
5. 缺少宿主结构或标准数据时返回 `null` 或 `false` 并给出明确提示。
6. 输入型控件必须提供明确提交动作；搜索控件默认通过查询按钮或 Enter 提交，不能只依赖每次输入即时触发。
7. 完成鼠标、键盘、无障碍、多实例和浏览器控制台验收。
