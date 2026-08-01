# Uniauth Sel 用户管理台设计验收

## 对照证据

- 目标参考：`ChatGPT Image 2026年7月28日 21_04_37.png`
- 最终实现：`OPTION/temp/uniauth-sel-user-admin-final.jpg`
- 同屏对照：`OPTION/temp/uniauth-design-comparison.jpg`

## 验收结论

通过。实现保留了参考图的深海军蓝底色、蓝紫晶体高光、半透明玻璃面板、细描边、发光主按钮和高密度数据表格语言，同时按 uniauth 的真实用户管理场景精简了项目进度、日期范围和浮动菜单等无关控件。

## 核心检查

- 字体与层级：中文标题、英文眉题、统计数字和表格正文层级清楚，没有拥挤、截断或异常换行。
- 布局与间距：侧栏、标题区、统计卡片、筛选栏、表格和分页建立稳定栅格；两条真实数据造成的留白属于数据量差异，不是布局缺失。
- 色彩与表面：主色、状态色、玻璃透明度、边框和阴影与参考方向一致；文字与控件保持可读对比。
- 图像质量：本地晶体背景按 16:9 生成并作为环境层使用，没有文字、伪界面或压缩光晕。
- 状态与交互：已验证加载、成功、错误、空结果、禁用分页、原生表单校验、详情弹窗、新增、编辑、筛选和假删除链路。
- 可访问性：使用语义化按钮、表格、表单标签和原生对话框；键盘焦点有清晰描边；补充 `prefers-reduced-motion` 降低动画。
- 响应式：桌面使用侧栏与主工作区；1050px 以下压缩工具栏；760px 以下改为单列工作区和可换行筛选/分页控件。

## 已接受差异

- 参考图展示六条虚构项目数据；实现只展示 uniauth 当前 H2 中的真实有效用户。
- 参考图包含导出、进度和项目上下文菜单；这些不属于本次用户 CRUD 展示与动作范围，未复制。
- 实现使用自有 `selBaseRuntime` 运行时和本地资源，不依赖 Ext、Vue 或远程 CDN。

## 未解决问题

无阻断或高优先级视觉问题。

---

# 2026-08-01 水晶窗口与浮层材质统一验收

## Source truth

- 主页面视觉基准：`OPTION/temp/uniauth-window-source-main-page.png`，1280 × 720，主项目表默认状态。
- 用户补充参考：`/var/folders/mm/bdkr2fj53rl88019r0hfw_y40000gn/T/codex-clipboard-d06ac3d3-d946-4842-b5e1-1551315dbc91.png`，483 × 794，背景选择器旧边框状态。
- 实现截图：`OPTION/temp/uniauth-window-redesign-final-current.png`、`OPTION/temp/uniauth-background-panel-final.png`，均为 1280 × 720。

## Comparison evidence

- 全画面对照：`OPTION/temp/uniauth-window-design-comparison.png`。
- 窗口标题与表单重点对照：`OPTION/temp/uniauth-window-header-comparison.png`。
- 背景选择器新旧边框对照：`OPTION/temp/uniauth-background-panel-comparison.png`。
- 浮层状态证据：`OPTION/temp/uniauth-dropdown-panel-material.png`、`OPTION/temp/uniauth-context-menu-panel-material.png`、`OPTION/temp/uniauth-submenu-panel-material.png`。

## Findings

- 窗口、下拉框、右键菜单、二级菜单和背景选择器均引用主页面 `selPanelCyberFrame.webp`，不再引用旧菜单边框素材。
- 窗口支持拖动、八方向缩放、最小化与恢复、最大化与精确还原，以及多窗口独立层级；实际浏览器交互均已通过。
- 背景选择器在 1280 × 720 与 760 × 720 下均完整位于视口内，无横向内容溢出；主题卡片、滚动区和三个参数滑杆保持原结构。
- 下拉选择能同步原生 `select` 值；右键菜单保留长列表滚动、禁用项、危险项、二级菜单和 Escape 逐层关闭。
- 浏览器控制台未发现错误或警告，静态语法检查及差异格式检查通过。

## Comparison history

1. 初版窗口对照发现旧窗口素材与主面板边框语言不一致，改为主面板九宫格并补齐窗口状态控件。
2. 浮层对照发现下拉框与右键菜单仍使用旧菜单九宫格，统一替换为主面板九宫格。
3. 用户截图复核发现背景选择器仍保留旧边框，完成同源替换并在桌面与紧凑宽度复测。

## Final result

passed
