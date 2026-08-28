# RUL_SELPLAT公共控件治理门禁规则 升级历史

> 可丢失历史记录：本文件不是规则、索引、程序、测试或构建输入；当前有效约束只以正式规则正文为准。

<!-- 2026-08-24 固定中央登记到 Node 正式出口的自动同步；适用于 SELUI 新增或调整控件；业务含义是应用无需访问内部文件，也不会因人工漏改 package.json 而私造替代控件。 -->
upgrade_record_20260824_component_exports = component_registry_single_source + generated_node_script_and_style_exports + package_prepare_sync + shared_build_consistency_gate

<!-- 2026-08-23 将新工程稳定 UI 先匹配现有主题，确需沉淀时进入 SEL UI 新主题，并保持令牌迁移前后视觉一致。 -->
upgrade_record_20260823_sel_ui_cross_language_adoption = one_sel_ui_source,existing_theme_first,new_reusable_ui_as_theme_pack,java_resource_jar,node_module_export,react_mount_destroy_adapter,visual_baseline_preserved

<!-- 2026-08-20 固定浏览器关键资源同源交付，并要求SEL内核与能力脚本同步提升缓存版本。 -->
upgrade_record_20260820_browser_bootstrap = same_origin_critical_assets,sel_kernel_and_capability_cache_version_sync,no_external_icon_cdn

<!-- 页面直接编辑统一使用独立边框、真实右侧调宽手柄、统一圆角线条且业务控件不得覆盖。 -->
upgrade_record_20260815_unified_edit_affordance = independent_editor_frame,real_right_edge_resize_handle,uniform_radius_and_line,no_business_control_override

<!-- 2026-08-12 依次固定纯图标可发现性、确认控件边界、真实风险文案、页面编辑契约及客户交付审计发现的通用布局与可访问性要求。 -->
upgrade_record = 2026-08-12:纯图标表格操作统一使用selTooltip并按记录状态表达下一步动作;2026-08-12:删除等破坏性单步动作统一使用selConfirmDialog禁止selWindow;2026-08-12:删除确认文案必须展示真实关联数量并禁止虚构数据库阻断;2026-08-12:页面编辑统一由selPersonalization管理管理员权限_控件坐标_实时草稿_取消恢复_显式保存;2026-08-12:hidden控件必须退出布局_树叶子占位禁止空按钮_窄屏动作先收起文字_显式保存无脏标记也保存当前控件;2026-08-13:公共API统一window.sel命名空间_selKernel最先加载_应用顶部集中解构_sel.core.freeze深度冻结_中文组件用途说明;2026-08-14:完整只读边界只调用一次selFreeze_禁止嵌套逐项冻结_运行时控制器保持生命周期_生成模板同步门禁;2026-08-14:应用入口统一app_SEL公共别名使用sel前缀_业务模块使用项目lowerCamelCase前缀;2026-08-14:业务应用动态节点统一由sel.core.element创建_原生节点创建只留在公共实现层;2026-08-14:大型应用装配脚本增加函数契约和关键语句组中文教学式业务注释_禁止机械注释括号标点;2026-08-14:统一入口_SEL公共别名_具名业务函数中文契约扩展到全部应用JavaScript并接入快速门禁;2026-08-14:Grid表头竖向分隔线覆盖第一列并只排除最后一列;2026-08-14:动作型页面编辑入口统一使用onEdit_复合管理内容统一进入selWindow自定义内容_引用型下拉按typeId管理并保持树叶子;2026-08-14:引用型下拉拆分页面控件绑定_类型目录_选项数据并禁止管理筛选器注册为业务页面控件;2026-08-15:页面编辑只保留整页手动编辑总开关_编辑态表格配置头展示名称_code_编辑入口;2026-08-15:Window接入同一总开关_一个逻辑控件支持多个实例标题宿主_显示数据库code与统一编辑动作;2026-08-15:表格编辑按钮紧邻code_Window与表格编辑按钮统一使用琥珀金强调色;2026-08-15:页面面板只负责总开关_控件按钮直接保存_导航不被未保存状态拦截_每个Window独立保存几何;2026-08-15:查询工具栏保留父容器并把搜索框_查询按钮_类型_状态_重置登记为五个独立子控件_selPersonalization统一拖动调宽和逐项保存;2026-08-15:组合工具栏移除逐项编辑卡_末尾标准控件后只显示一个当前控件保存按钮_实际提交仍为所选子控件单记录;2026-08-15:组合工具栏改为流式联动_当前项调宽后后续同级控件等量跟随_保存按钮持续跟随末项

<!-- 本次升级以六表最终模型替换已删除 Option/Binding 表描述，并增加 parentKind + parentCode 明确父容器。 -->
upgrade_record_20260815_reference_model = ControlLayout绑定页面与父容器_Type维护工程和类型_TreeNode仅通过typeId归属_禁止节点复制页面坐标

<!-- 独立树升级记录说明类型目录和树节点表之间不再保留字段耦合。 -->
upgrade_record_20260815_independent_tree = ReferenceDataType只维护分类目录_ReferenceDataTreeNode只通过code和parentId建树_删除typeId_nodeCode_attributesJson耦合字段

<!-- 本次升级固定类型目录的全局分类职责，阻止旧项目资源坐标和说明字段回流。 -->
upgrade_record_20260816_type_catalog = ReferenceDataType以全局唯一categoryCode登记分类_只保留多语言名称和管理审计字段_禁止项目资源坐标与说明字段

<!-- 本次升级确认页面控件是归属主体，类型值和多级菜单从 Type 侧通过 code 单向绑定。 -->
upgrade_record_20260816_type_control_binding = ReferenceDataType_controlCode绑定ControlLayout_code_valueCode表达选项_parentTypeCode同控件建层级_ControlLayout删除typeId_废弃categoryCode

<!-- 本次升级把控件直属类型改为可复用选项组，并逐个登记 Window 内真实字段与动作。 -->
upgrade_record_20260816_option_set_binding = ReferenceDataType使用optionSetCode共享分级选项_ControlLayout可选绑定同一optionSetCode_Window子控件以WINDOW父坐标_fieldName和唯一code逐个登记

<!-- 本次升级废弃上一版 Window 子控件登记：内部表单没有拖拽需求，历史记录物理删除且服务与数据库拒绝复发。 -->
upgrade_record_20260816_window_child_cleanup = ReferenceDataWindow只保存外框位置大小_ControlLayout禁止parentKind_WINDOW_历史Window子记录物理删除_启动生成器删除

<!-- 查询条件组件允许由配置组合输入、下拉、单选和多选；页面编辑只绑定稳定组件根。 -->
upgrade_record_20260816_query_condition_group = 查询工具栏语义统一但真实元素逐条ControlLayout登记_输入下拉单选多选和查询按钮分别保存_字段结构重建不得丢失页面编辑绑定_无记录使用组件默认布局

<!-- 本次升级把多个结构白名单字段落实为多个真实输入，并统一横向流式组合的纵向基线。 -->
upgrade_record_20260816_structural_query_fields = 多个结构字段逐字段输入_AND匹配_禁止合并keyword_OR_横向组合共享首项纵向基线

<!-- 本次升级把独立树边界落实到保存值，TREE 不再允许进入类型目录。 -->
upgrade_record_20260816_tree_type_cleanup = TREE只属于ReferenceDataTreeNode和表格视图_ReferenceDataType保存入口禁止TREE_历史记录物理删除

<!-- 本次升级统一所有 selGrid 的行选择模式、可访问状态和公开变化事件，业务页面只声明所需模式。 -->
upgrade_record_20260816_grid_row_selection = NONE_SINGLE_MULTIPLE三态_records默认NONE_旧项目默认MULTIPLE_日语题库显式SINGLE

<!-- 本次升级固定同一 Search 实例的运行时字段结构替换边界，防止 Grid 继续操作已脱离 DOM 的旧控制器。 -->
upgrade_record_20260816_search_runtime_remount = 字段集合变化使用公共remount_Grid实时取当前Search控制器_禁止旧DOM实例回流

<!-- 本次升级让查询控件支持多字段单按钮，并让 Grid 通过 REMOTE 模式发布后台分页条件。 -->
upgrade_record_20260816_remote_grid_query = selSearch多字段独立值单查询按钮_selGrid_REMOTE不二次分页并发布queryChange_应用调用业务分页接口

<!-- 本次升级保证配置尚未登记或线上 JSON 尚未生成时，普通搜索字段仍使用紧凑安全默认值。 -->
upgrade_record_20260816_search_default_width = selSearch字段默认280px_最小180px_禁止单字段自动占满整行_公开CSS变量允许数据库或JSON覆盖_极窄宿主安全收缩

<!-- 本次补充修正搜索字段缩短但 Panel 外层栏目仍保留旧宽度造成的中段空洞。 -->
upgrade_record_20260816_search_column_compaction = 单字段搜索外层栏目按输入加按钮真实宽度收紧_多字段模块保留独立配置宽度_禁用人工调宽时模块切换必须应用新栏目宽度

<!-- 本次升级修复源语言使用空映射时只恢复正文、不恢复 aria-label 等属性的问题。 -->
upgrade_record_20260816_locale_source_fallback = 公共组件语言切换时正文和可翻译属性统一使用目标映射或源码回退_空映射表示恢复源码_禁止遗留上一语言属性

<!-- 本次升级移除玻璃主题工具栏外壳的整行上下边线，只保留真实控件自身边框。 -->
upgrade_record_20260817_toolbar_surface_boundary = 工具栏外壳不绘制贯穿整行的上下边线_真实输入按钮和下拉保留自身边框_不改变布局与拖拽行为

<!-- 本次补充修正公共主题源码已更新但已打开页面继续命中旧缓存的问题。 -->
upgrade_record_20260817_shared_style_cache_bust = 公共主题内容变化时所有消费页面同步更新资源版本标识_禁止仅验证新标签页后遗漏已打开页面缓存

<!-- 本次升级修复查询子控件纵向偏移后，父级 Search 半透明底色和内阴影露出为横向痕迹。 -->
upgrade_record_20260817_independent_search_surface = 独立拖拽查询父级透明无阴影_真实输入和动作保留自身表面_数据库几何不被强制复位

<!-- 本次升级删除表格编辑器内部的第二套原生表格、动作按钮和开关实现。 -->
upgrade_record_20260817_table_editor_grid_composition = selTableEditor保留表头CRUD业务组合职责_内部列表使用selGrid_switch渲染与统一action事件_禁止第二套原生table按钮开关

<!-- 本次升级把表头排序做成公共 Grid 能力，并由页面配置事务一次保存全部 sortnum。 -->
upgrade_record_20260817_table_editor_drag_reorder = selGrid_dragHandle与rowReorder事件_有效移动后松在tbody边界外仍承接草稿_selTableEditor先预览并弹公共确认_确认后页面配置事务批量保存sortnum_取消或失败恢复原顺序_业务Grid只在成功后刷新

<!-- 轮次、批次等业务状态动作必须进入工具栏独立分组，禁止混入查询按钮或依赖可能隐藏的标题快捷区。 -->
upgrade_record_20260817_toolbar_business_action = selPanel提供toolbarAction稳定宿主_查询重置后独立分隔_展示当前业务上下文_强调色动作_应用绑定业务事件

<!-- 本次升级补齐工具条业务动作的页面编辑登记，禁止只接入外观和点击而遗漏拖动、调宽及持久化。 -->
upgrade_record_20260817_all_toolbar_controls_editable = 工具条全部真实控件逐项登记_复合业务动作按稳定根整体登记_统一拖动调宽保存_无记录使用默认布局

<!-- 调宽手柄必须是可聚焦具名按钮，Alt+方向键与鼠标共享同一几何更新链。 -->
upgrade_record_20260817_toolbar_resize_keyboard = 调宽手柄使用可聚焦具名按钮_鼠标与Alt方向键同源更新_焦点态可见

<!-- 本次升级让编辑态查询组在保持子控件独立调宽的同时，通过首项公共锚点整体横向移动并单独保存。 -->
upgrade_record_20260817_query_group_horizontal_move = 流式查询组首项显示公共横向移动手柄_拖动同步平移全部同级控件_只保存锚点x_旧默认坐标精确匹配后升级_管理员自定义值不覆盖

<!-- 本次升级让业务可选择是否锁定已选单选项，并让徽标图标按记录值动态显示。 -->
upgrade_record_20260817_choice_repeat_and_dynamic_badge = choice未选圆圈保持清晰可见_lockAfterSelection默认锁定且可显式关闭_徽标cellIcon支持按记录返回_空图标不占位

<!-- 管理表格的 visible=false 只控制 Grid 渲染，禁止据此删除编辑窗口仍需使用的记录字段。 -->
upgrade_record_20260817_hidden_column_data_boundary = 表头完整登记_visible_false只隐藏渲染_管理记录保留编辑字段_双击编辑不得被默认值覆盖_禁止为补字段追加二次详情请求

<!-- 轻量业务动作不得借 setLocale 重建整表，公共 Grid 统一提供单记录增量更新。 -->
upgrade_record_20260817_record_in_place_update = selGrid_updateRecord按id合并记录_只替换目标tr_保留横纵滚动位置_恢复当前动作焦点_禁止轻量动作整表刷新

<!-- 单元格图标语义颜色由公共 Grid 统一解析和清洗，应用只声明 tone。 -->
upgrade_record_20260817_cell_icon_tone = selGrid_cellIconTone支持静态或按记录动态值_只允许安全类名_success与danger使用主题令牌_禁止业务页面私有着色

<!-- 本次升级根治表格动作导致滚动条跳动：动作本身不刷新，无变化时零渲染，有变化时只更新目标行。 -->
upgrade_record_20260817_grid_action_no_full_refresh = selGrid_action只派发事件_播放弹窗等零视图变化动作禁止刷新_行状态变化只调用updateRecord_选中结果通过selectedTone使用主题语义色

<!-- 页面编辑的视觉和拖拽命中统一归 selPersonalization；公共边框层必须与业务控件解耦，黄线本身就是可命中的调宽手柄。 -->
upgrade_record_20260815_unified_edit_affordance = independent_editor_frame

<!-- upgrade_record_20260815_unified_edit_affordance.2 的当前独立事实为 real_right_edge_resize_handle。 -->
upgrade_record_20260815_unified_edit_affordance.2 = real_right_edge_resize_handle

<!-- upgrade_record_20260815_unified_edit_affordance.3 的当前独立事实为 uniform_radius_and_line。 -->
upgrade_record_20260815_unified_edit_affordance.3 = uniform_radius_and_line

<!-- upgrade_record_20260815_unified_edit_affordance.4 的当前独立事实为 no_business_control_override。 -->
upgrade_record_20260815_unified_edit_affordance.4 = no_business_control_override
