# 可拖动缩放 Window Design QA

**对比对象**

- source visual truth：`OPTION/temp/window-redesign-home-reference.png`（当前首页水晶设计系统）
- redesign before：`OPTION/temp/window-redesign-before.png`
- implementation screenshot：`OPTION/temp/window-redesign-default-final.png`
- implementation URL：`http://127.0.0.1:4173/uniauth/uniauth.html?multi=1`
- full-view comparison evidence：`OPTION/temp/window-redesign-full-comparison.png`
- focused region comparison evidence：`OPTION/temp/window-redesign-focused-comparison.png`
- before/after evidence：`OPTION/temp/window-redesign-before-after.png`
- resized evidence：`OPTION/temp/window-redesign-minimum.png`
- maximized evidence：`OPTION/temp/window-redesign-maximized.png`
- compact viewport evidence：`OPTION/temp/window-redesign-1024x780-final.png`

**归一化信息**

- 首页设计系统截图和最终默认 Window 截图均为 1642 × 1110 px；CSS 视口为 1642 × 1110，设备像素比为 1。
- full-view 对比保持原始像素尺寸并排，没有密度补偿或单侧缩放。
- focused 对比从首页截取标题与工具栏水晶表面，从最终实现截取完整 Window；两者按相同展示宽度归一化，用于比较框体、标题、控件、色彩与信息密度，而不是宣称两种不同业务区域应逐像素同构。
- 1024 × 780 证据来自同一路由、同一主题和同一浏览器的临时视口覆盖，交付前已恢复默认视口。

**Findings**

- 无未解决的 P0、P1、P2 问题。
- 字体与排版：Window 标题缩减为 22px，说明为 13px，字段标签为 16px，输入为 15px；字重、行高和光学密度与首页标题、工具栏和表格正文形成同一层级体系。默认、紧凑和最大化状态无异常换行或截断。
- 间距与布局节奏：默认 Window 为 1040 × 740px，表单采用紧凑 54px 字段轨道；标题栏、字段滚动区、固定操作区分区清楚。缩小到 720 × 560px 后双字段行改为两行并保留 12px 间距，底部主要操作持续可见。
- 颜色与视觉 token：深蓝连续底板、蓝紫边缘、弱化遮罩、输入描边、选中主按钮和焦点光效均沿用首页蓝紫水晶方向；未引入另一套高饱和或厚重 Window 皮肤。
- 图片质量与素材忠实度：窗口现与主页面统一复用带中心填充的 `selPanelCyberFrame.webp` 九宫格素材；默认、放大、最大化和还原均没有黑色直角底、空心框、拉伸角灯或拼接缝。
- 文案与内容：标题、说明、字段名、占位文案、计数器、复选项和主要操作完整；最大化/还原按钮的可访问名称随状态同步。
- 图标：标题徽标使用真实 WebP；字段、最大化、还原和关闭使用项目既有 Remix Icon 图标体系，描边重量与首页一致。
- 状态与交互：标题栏可拖动；北、东、南、西与四角共八方向可缩放；最小尺寸为 720 × 560px；最大化覆盖视口安全区，点击还原准确回到最大化前的 720 × 560px、位置 (151,110)；多实例只保留一个活动遮罩。
- 下拉交互：缩小状态下菜单宽 502px，完整位于视口内且字段区横向溢出为 0；ArrowDown + Enter 可选择“平台架构”并关闭菜单；Window 未创建专属下拉皮肤。
- 响应式：1024 × 780 默认 Window 完整位于视口内；紧凑布局没有字段重叠，正文不足空间时仅字段区纵向滚动，标题和底部操作固定可见。
- 无障碍：dialog、combobox、option、按钮和原生表单语义保留；最大化使用 `aria-pressed`；全部窗口动作拥有明确可访问名称和可见焦点态。
- 浏览器控制台：error 日志为 0。

**Comparison History**

1. 首轮问题（P1，已修复）：旧 Window 使用 1140 × 947px 大框、30px 标题、厚重遮罩与大面积稀疏排版，明显偏离首页紧凑水晶面板。
   - 修复：默认尺寸改为 1040 × 740px；标题、徽标、字段、文本域和按钮全面收紧；遮罩从接近纯黑改为保留首页空间关系的半透明深色。
   - 修复后证据：`OPTION/temp/window-redesign-before-after.png`、`OPTION/temp/window-redesign-focused-comparison.png`。
2. 首轮问题（P1，已修复）：旧 Window 没有拖动、任意方向缩放、最大化或精确还原能力。
   - 修复：标题栏拖动、八方向透明手柄、统一视口夹取状态机、最大化/还原按钮与双击标题栏路径已实现。
   - 修复后证据：浏览器实测默认矩形 1040 × 740px；放大矩形 1275 × 956px；最小矩形 720 × 560px；最大化矩形 1618 × 1086px；还原回到原始最小矩形。
3. 次轮问题（P2，已修复）：最小宽度下成对字段折为两行后缺少显式行间距，优先级与项目描述区域过近。
   - 修复：紧凑容器为成对字段设置 108px 最小轨道和 12px row-gap。
   - 修复后证据：`OPTION/temp/window-redesign-1024x780-final.png`；实测描述控件顶部与成对字段底部间距为 12px。

**Open Questions**

- 无。

**Implementation Checklist**

- [x] 以首页而不是旧 Window 作为视觉系统基准。
- [x] 重做默认尺寸、标题栏、表单密度、遮罩和底部操作区。
- [x] 实现标题栏拖动和八方向缩放。
- [x] 实现最大化、双击最大化和精确还原。
- [x] 实现最小尺寸、视口安全区和字段区内部滚动。
- [x] 保持 Window 与首页共用唯一通用下拉控件。
- [x] 验证默认、放大、最小、最大化、还原、多实例与 1024 × 780。
- [x] 检查浏览器控制台、JavaScript 语法、差异格式和 Gradle 离线测试。

**Follow-up Polish**

- 最大化状态仍保持单列表单和底部居中操作，较大视口会出现更多呼吸空间；这是为了保持字段阅读顺序和与默认态的几何稳定，不属于阻塞项。

final result: passed
