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

---

# SEL 统一令牌与左右对称 Design QA

**验证对象**

- 页面：`http://127.0.0.1:4173/uniauth/uniauth.html?multi=1`。
- 参考问题：面板右侧边框贴边或裁切、左右边框与内容安全区视觉不对称。
- 验证范围：主面板五区、个性化面板、Window、下拉、右键菜单、二级菜单和日期浮层。

**Findings**

- 无未解决的 P0、P1、P2 问题。
- 新增 `selThemeTokens.css`，统一基础皮肤色、语义色、组件映射、九宫格素材和边框几何令牌。
- 页面舞台使用 `minmax(0, 1fr)`，主面板宽度改为父容器 100%，不再用包含滚动条宽度的 `100vw` 计算。
- 1265 × 713 验证中，主面板相对 `documentElement.clientWidth` 的左右间距均为 16px，页面无横向溢出。
- 1180 × 780 紧凑桌面中左右间距仍均为 16px，页面无横向溢出。
- 主面板、Window、个性化面板左右边框均为 18px；下拉 16px、右键菜单 18px、二级菜单 15px、日期浮层 12px，所有组件左右值完全相等且均为 `border-box`。
- Window 标题栏左右安全区均为 10px；旧的左 8px / 右 10px 个性化覆盖已删除。
- 表格最小业务宽度由内部滚动视口承接，不再撑破中央内容区或页面。
- 翡翠绿验证中，统一颜色与内存九宫格通过 `--sel-theme-*` 同步，所有结构色块保持完整换肤。
- 页面运行日志为 0；脚本语法、资源响应和差异格式检查通过。

**Comparison History**

1. P1（已修复）：主面板宽度使用 `100vw - 32px`，垂直滚动条出现时可用内容宽度减少 15px，导致左侧 16px、右侧 1px。
   - 修复：舞台建立可收缩单列轨道，面板宽度改为父内容盒 100%，测量基准改为不包含滚动条的 clientWidth。
2. P1（已修复）：统一边框 URL 放入自定义属性后仍使用相对路径，变量在不同组件样式中展开时资源地址错配，边框短暂不可见。
   - 修复：统一素材令牌使用站点根路径 `/sel/assets/...`；所有组件实测加载同一正式素材或内存着色 WebP。
3. P2（已修复）：Window 基础 padding 已相等，但个性化映射仍覆盖为左 8px / 右 10px。
   - 修复：两侧均引用 `--sel-theme-window-safe-inline`。

**Implementation Checklist**

- [x] 建立统一颜色、语义、组件映射和几何令牌层。
- [x] 统一所有水晶组件的素材和分组件边框厚度。
- [x] 统一 `border-box`、左右安全区和页面视口间距。
- [x] 修复中央表格导致的页面级横向溢出。
- [x] 验证桌面、紧凑桌面、Window 与完整换肤。

**Open Questions**

- 无。

final result: passed

---

# SEL 完整全局皮肤换色 Design QA

**验证对象**

- 页面：`http://127.0.0.1:4173/uniauth/uniauth.html?multi=1`。
- 验证皮肤：翡翠绿、星云紫、琥珀金，以及刷新后的跟随皮肤默认状态。
- 覆盖范围：主面板、标题区、工具栏、导航树、表格、Window、表单控件、下拉、右键菜单、日期浮层和个性化面板。

**Findings**

- 无未解决的 P0、P1、P2 问题。
- 统一主题色会生成 deep、base、raised、accent 四级结构色，面板内部不再保留独立深蓝底板。
- 翡翠绿、星云紫和琥珀金均完成全页面视觉检查；结构层颜色连续，文字对比度和水晶层次清晰。
- 琥珀金状态下扫描全部可见 `sel*` 元素，剩余蓝色仅为常用色色板和进行中、评审中、已归档业务状态色。
- Window 标题、输入框、下拉触发器、日期触发器、普通按钮和底栏使用同一暖色色阶；关闭按钮错误语义色保持独立。
- 下拉浮层中心色为暖色混合结果，九宫格边框使用内存 WebP；日期浮层即使隐藏也继承同一中心色和边框来源。
- 760 × 713px 紧凑视口无横向溢出，个性化面板完整位于视口内并保留内部纵向滚动。
- 星云紫刷新后，主题色和边框行内覆盖均为空，输出恢复“跟随皮肤”，预设恢复“深空”。
- 页面运行日志为 0；脚本语法、页面资源和差异格式检查通过。

**Comparison History**

1. P1（已修复）：首版统一主题色只改变边框、发光和交互强调，组件内部独立深蓝底板仍覆盖共享玻璃层。
   - 修复：从主题色与染色强度生成四级皮肤色阶，并覆盖全部结构性背景、边线、内发光和滚动条。
2. P2（已修复）：暖色皮肤初次扫描仍发现负责人头像底板、负责人徽标、反馈浮层和表格滚动条保持蓝色。
   - 修复：将上述非语义结构同步到皮肤色阶；再次扫描仅保留明确排除的业务状态色和色板样本。

**Implementation Checklist**

- [x] 全局皮肤色阶由统一主题色与染色强度生成。
- [x] 主面板、导航、表格、Window 和浮层结构全面换色。
- [x] 保留背景图片、正文、成功、警告和错误语义色。
- [x] 验证冷色、暖色、紧凑视口、结构颜色扫描和刷新复位。

**Open Questions**

- 无。

final result: passed

---

# SEL 统一主题色 Design QA

**验证对象**

- 页面：`http://127.0.0.1:4173/uniauth/uniauth.html?multi=1`。
- 状态：个性化设置 → 面板设置 → 外观 → 统一主题色。
- 验证颜色：星际蓝、水晶青、星云紫、翡翠绿、琥珀金、脉冲粉、原生颜色输入和跟随皮肤。

**Findings**

- 无未解决的 P0、P1、P2 问题。
- 任意颜色输入与 6 个常用色会同步更新页面共享 RGB 变量、中心玻璃染色、发光、交互强调色和九宫格边框。
- 九宫格边框以真实 `selPanelCyberFrame.webp` 在当前页面内存中着色；透明切角、中心透明、边角高光和组件各自边框厚度均保留。
- 面板、Window、下拉、右键菜单和日期浮层实测 `border-image-source` 均切换为同一内存 WebP；主操作按钮同步使用所选颜色。
- 跟随皮肤会清除颜色与边框行内覆盖，重新读取皮肤默认令牌和原始九宫格素材。
- 刷新前脉冲粉的 RGB 为 `236 93 154`；刷新后颜色覆盖和边框覆盖均为空，输出恢复“跟随皮肤”，预设恢复“深空”。
- 760 × 713px 紧凑视口中面板矩形为 x=337、y=68、width=390、height=635，完整位于视口内且无横向溢出。
- 页面运行日志为 0；脚本语法、页面资源和差异格式检查通过。

**Implementation Checklist**

- [x] 增加任意统一主题色输入。
- [x] 增加 6 个常用色和跟随皮肤入口。
- [x] 同步水晶边框、发光、选中态、主按钮和滑杆强调色。
- [x] 排除背景图片、正文和业务语义状态色。
- [x] 验证跨组件响应、快速切换、跟随皮肤、刷新复位和紧凑视口。

**Open Questions**

- 无。

final result: passed

---

# SEL 个性化设置 Design QA

**对比对象**

- source visual truth：`/var/folders/mm/bdkr2fj53rl88019r0hfw_y40000gn/T/codex-clipboard-a992c4e5-019c-4e58-ac8a-78c9ba20db93.png`。
- implementation background screenshot：`OPTION/temp/personalization-background-final.png`。
- implementation panel screenshot：`OPTION/temp/personalization-panel-final.png`。
- implementation URL：`http://127.0.0.1:4173/uniauth/uniauth.html?multi=1`。
- normalized full comparison：`OPTION/temp/personalization-background-comparison.png`。

**归一化信息**

- source 为 388 × 633px；实现面板为 390 × 642px，完整对照将实现裁图归一化为 388 × 633px，设备像素比为 1。
- 浏览器验证视口为 1265 × 713px；同时在 760 × 713px 紧凑视口验证内部滚动和横向安全区。
- 对照状态为纯黑深空背景、遮罩 0%、亮度 120%、模糊 0px；面板设置以默认“深空”预设验证。

**Findings**

- 无未解决的 P0、P1、P2 问题。
- 信息架构有意升级为“背景设置 / 面板设置”两个一级入口；面板内部统一承载预设、外观、边框与间距、动效。
- 新面板保持原参考 390px 量级、双列背景卡片、水晶九宫格边框和紧凑 range 样式；新增页头、页签与恢复默认属于本轮需求带来的必要差异。
- 中心玻璃透明度与文字、图标、控件和九宫格边框解耦；当前皮肤染色使用可覆盖 RGB token，不依赖深蓝或紫色常量语义。
- 面板、Window、下拉、右键菜单和日期浮层共享材质参数，并保留各自原始边框厚度基准。
- 10 个面板强度控件均为 0%–100%；5 个预设、减少动态效果、键盘页签、Escape、外部关闭均已验证。
- 个性化状态未写入 localStorage 或 sessionStorage；修改背景与面板参数后刷新，背景、面板预设、透明度与动效均恢复代码默认值。

**Comparison History**

1. P1（已修复）：共享中心材质选择器曾设置 `position: relative`，覆盖日期浮层的 `position: fixed`，导致浮层离开视口。
   - 修复：共享规则只提供中心玻璃伪元素，不再改写组件定位上下文。
   - 修复后：日期浮层保持 fixed，实测 322 × 310px 且完整位于视口内。
2. P2（已修复）：统一绝对边框厚度曾把日期控件 12px 基准抬高到 18px。
   - 修复：边框控件改为组件各自基准上的比例缩放，50% 保持 panel/window 18px、dropdown 16px、date-picker 12px。
3. P2（已修复）：内容内距和控件间距初版在默认 50% 时改变原布局。
   - 修复：两项改为以 50% 为零偏移的双向映射；默认值保持既有排版。

**Implementation Checklist**

- [x] 保留一个背景设置一级入口。
- [x] 新增一个面板设置一级入口并收纳其余设置。
- [x] 实现面板外观、边框与间距、动效和 5 个预设。
- [x] 使用可换肤材质 token，避免写死深蓝/紫色皮肤语义。
- [x] 接入主要水晶面板、Window、下拉、右键菜单和日期浮层。
- [x] 验证刷新复位、紧凑视口、键盘路径、浮层定位和控制台。

**Open Questions**

- 无。

final result: passed

---

# SEL 水晶日期控件 Design QA

**对比对象**

- source visual truth：`/var/folders/mm/bdkr2fj53rl88019r0hfw_y40000gn/T/codex-clipboard-89a96f3a-71d8-443c-ad9a-b136dd5fb303.png`。
- implementation screenshot：`OPTION/temp/uniauth-date-picker-final-996x713.png`。
- normalized implementation：`OPTION/temp/uniauth-date-picker-final-normalized-997x713.png`。
- implementation URL：`http://127.0.0.1:4173/uniauth/uniauth.html?multi=1`。
- full-view comparison evidence：`OPTION/temp/uniauth-date-picker-comparison.png`。
- focused region comparison evidence：`OPTION/temp/uniauth-date-picker-focused-comparison.png`。

**归一化信息**

- source 图片为 997 × 713 px；实现以 996 × 713 CSS 视口、设备像素比 1 验证，浏览器原始截图为 975 × 698 px。
- 完整对照将实现截图按同一宽高比缩放至 997 × 713 px，只补偿浏览器画布输出差异，不改变日期控件相对布局。
- 对照状态均为“新建项目 Window 打开、开始日期为 2026-08-19、2026 年 8 月月历展开”。
- focused 对照分别裁取系统日历与 SEL 水晶月历区域，用于检查标题、星期、日期网格、选中态和底部动作。

**Findings**

- 无未解决的 P0、P1、P2 问题。
- 字体与排版：月份标题 15px、星期 11px、日期与动作 12px，与 Window 字段和主页面高密度信息层级一致；没有截断或异常换行。
- 间距与布局节奏：月历为 322 × 310px，42 个日期保持固定六周高度；在 996 × 713 与 760 × 713 视口中均位于安全区内，且不覆盖日期触发器。
- 颜色与视觉 token：浮层复用 `selPanelCyberFrame.webp`，深蓝中心填充、蓝紫选中态、青色今天标识和边缘发光与主页面一致。
- 图片质量与素材忠实度：只复用项目真实九宫格素材和 Remix Icon，没有 CSS 图形、内联 SVG、占位素材或新增位图。
- 文案与内容：保留月份、周一至周日、相邻月份日期、清除、今天、确定；触发器以 `YYYY / MM / DD` 显示，真实字段持续提交 `YYYY-MM-DD`。
- 可访问性与交互：dialog、grid、aria-selected、aria-expanded、完整日期名称和唯一 roving tabindex 均已验证；支持方向键、Home/End、PageUp/PageDown、Enter/Space、Escape 和外部点击关闭。
- 生命周期：Window 最小化或关闭时 body 门户同步回收；选日后日期进入 FormData，清除恢复必填空值，未确认日期可通过 Escape 放弃。
- 浏览器运行：已验证上月、下月、2026-08-19 选择、今天、清除、确定、键盘选择、外部关闭、最小化与恢复；控制台 error/warning 为 0。

**Comparison History**

1. 首轮问题（P2，已修复）：初版月历为 354 × 424px，在参考尺寸视口中因剩余垂直空间不足而与日期触发器重叠。
   - 修复：收紧九宫格边框、月份头、星期行、六周日期网格和底部动作，将成品压缩到 322 × 310px。
   - 修复后证据：`OPTION/temp/uniauth-date-picker-final-996x713.png`；实测浮层矩形 x=227、y=381、width=322、height=310，触发器矩形 y=331、height=42，两者不重叠。

**Open Questions**

- 无。

**Implementation Checklist**

- [x] 用 SEL 水晶月历替换系统原生日历。
- [x] 保留标准日期值、required、min/max 和 FormData 契约。
- [x] 实现翻月、选日、今天、清除、确定和完整键盘导航。
- [x] 实现视口上下定位、外部关闭和 Window 生命周期回收。
- [x] 完成同状态全画面及重点区域视觉对照。
- [x] 验证桌面、紧凑视口、控制台和静态语法。

**Follow-up Polish**

- 无。

final result: passed
