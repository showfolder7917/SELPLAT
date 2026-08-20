# SELPLAT 公共控件治理门禁规则

<!-- 本规则约束 SELPLAT 现有和未来全部原生前端控件，不依赖控件名称逐项追加规则。 -->
rule_scope = active_user_selplat_shared_ui_component_governance
<!-- 5.19.0 增加 Grid 单选结果语义色，并固定行内动作禁止整表刷新。 -->
rule_version = 5.20.0
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
<!-- 规则所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示登记表、快速门禁、公共构建门禁和回归测试均已接通。 -->
rule_status = active
<!-- 本规则复用源码归属扫描能力，不再建立第二套近义门禁程序。 -->
python_ability_refs = apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/selplat_source_ownership_guard.py
<!-- 公共控件由原生 JavaScript 实现，当前不新增 Java 或 Node 能力入口。 -->
java_ability_refs = none
<!-- 当前门禁由 Python 快速扫描和 Gradle 公共构建执行，不建立重复 Node 能力。 -->
node_ability_refs = none
<!-- 控件治理属于源码归属门禁的专项扩展，加载时必须同时保留其语言、目录和快速门禁约束。 -->
requires_rule_ids = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

## 创建与登记

<!-- 可复用交互第一次出现时必须先登记公共控件，再由首个业务调用方接入；禁止先写业务私有版本以后再抽取。 -->
selplat_component_creation_sequence = classify_reusable_interaction
<!-- selplat_component_creation_sequence.2 的当前独立事实为 register_public_component。 -->
selplat_component_creation_sequence.2 = register_public_component
<!-- selplat_component_creation_sequence.3 的当前独立事实为 implement_public_component。 -->
selplat_component_creation_sequence.3 = implement_public_component
<!-- selplat_component_creation_sequence.4 的当前独立事实为 connect_first_consumer。 -->
selplat_component_creation_sequence.4 = connect_first_consumer
<!-- selplat_component_creation_sequence.5 的当前独立事实为 verify。 -->
selplat_component_creation_sequence.5 = verify
<!-- 门禁只负责阻断和报告缺少的控件，不得静默自动生成未经过登记的公共 API。 -->
selplat_component_gate_auto_creation_policy = block_and_report
<!-- selplat_component_gate_auto_creation_policy.2 的当前独立事实为 no_silent_component_generation。 -->
selplat_component_gate_auto_creation_policy.2 = no_silent_component_generation
<!-- 公共控件唯一登记位于 sel-ui 组件根，版本、策略和控件数组缺一不可。 -->
selplat_component_registry = shared/frontend/sel-ui/src/components/component-registry.json
<!-- selplat_component_registry.2 的当前独立事实为 version=2。 -->
selplat_component_registry.2 = version=2
<!-- selplat_component_registry.3 的当前独立事实为 one_authoritative_source。 -->
selplat_component_registry.3 = one_authoritative_source
<!-- selplat_component_registry.4 的当前独立事实为 kernel=core/selKernel.js。 -->
selplat_component_registry.4 = kernel=core/selKernel.js
<!-- 每个公开单元必须登记稳定 ID、目录、类型、JS、CSS、命名空间 API、硬依赖和主题属性。 -->
selplat_component_registration_required_fields = id
<!-- selplat_component_registration_required_fields.2 的当前独立事实为 directory。 -->
selplat_component_registration_required_fields.2 = directory
<!-- selplat_component_registration_required_fields.3 的当前独立事实为 type。 -->
selplat_component_registration_required_fields.3 = type
<!-- selplat_component_registration_required_fields.4 的当前独立事实为 scripts。 -->
selplat_component_registration_required_fields.4 = scripts
<!-- selplat_component_registration_required_fields.5 的当前独立事实为 styles。 -->
selplat_component_registration_required_fields.5 = styles
<!-- selplat_component_registration_required_fields.6 的当前独立事实为 publicApi。 -->
selplat_component_registration_required_fields.6 = publicApi
<!-- selplat_component_registration_required_fields.7 的当前独立事实为 dependencies。 -->
selplat_component_registration_required_fields.7 = dependencies
<!-- selplat_component_registration_required_fields.8 的当前独立事实为 themeAware。 -->
selplat_component_registration_required_fields.8 = themeAware
<!-- 新控件目录和顶层 JS/CSS 必须且只能属于一个登记单元，未登记与重复所有者均直接阻断。 -->
selplat_component_source_ownership_gate = every_directory_registered
<!-- selplat_component_source_ownership_gate.2 的当前独立事实为 every_top_level_js_css_exactly_one_owner。 -->
selplat_component_source_ownership_gate.2 = every_top_level_js_css_exactly_one_owner
<!-- selplat_component_source_ownership_gate.3 的当前独立事实为 no_duplicate_owner。 -->
selplat_component_source_ownership_gate.3 = no_duplicate_owner

## 通用分类与应用边界

<!-- 自有开关状态、body 门户、键盘焦点生命周期、跨页面复用或完整 DOM/CSS/事件生命周期任一成立时必须按公共控件治理。 -->
selplat_reusable_control_classification = own_state|body_portal|keyboard_focus_lifecycle|multi_page_reuse|complete_dom_css_event_lifecycle
<!-- 应用只能提供宿主、数据、动作和回调，不得发布 window.sel<Component> 或自行创建 body 交互门户。 -->
selplat_application_component_boundary = host_data_action_callback_only
<!-- selplat_application_component_boundary.2 的当前独立事实为 no_private_sel_global_api。 -->
selplat_application_component_boundary.2 = no_private_sel_global_api
<!-- selplat_application_component_boundary.3 的当前独立事实为 no_private_body_portal。 -->
selplat_application_component_boundary.3 = no_private_body_portal
<!-- 已由公共控件登记拥有的 ARIA 交互角色不得在应用页面或其他控件中重复实现。 -->
selplat_component_owned_interaction_gate = registered_owned_aria_role_single_owner
<!-- selplat_component_owned_interaction_gate.2 的当前独立事实为 no_application_reimplementation。 -->
selplat_component_owned_interaction_gate.2 = no_application_reimplementation
<!-- 本轮启用新公共控件后直接删除旧私有 DOM、样式、定位和事件链，不保留兼容选择或降级分支。 -->
selplat_component_legacy_replacement_policy = enable_registered_component
<!-- selplat_component_legacy_replacement_policy.2 的当前独立事实为 delete_private_legacy_implementation。 -->
selplat_component_legacy_replacement_policy.2 = delete_private_legacy_implementation
<!-- selplat_component_legacy_replacement_policy.3 的当前独立事实为 no_compatibility_branch。 -->
selplat_component_legacy_replacement_policy.3 = no_compatibility_branch

## 通用布局与可访问语义

<!-- 控件根声明原生 hidden 后必须完全退出布局；公共 display 规则不得覆盖浏览器隐藏语义，避免备用实例制造空白页和错误滚动。 -->
selplat_native_hidden_layout_contract = hidden_root_display_none
<!-- selplat_native_hidden_layout_contract.2 的当前独立事实为 public_display_rule_must_not_override_hidden。 -->
selplat_native_hidden_layout_contract.2 = public_display_rule_must_not_override_hidden
<!-- selplat_native_hidden_layout_contract.3 的当前独立事实为 no_inactive_instance_layout_space。 -->
selplat_native_hidden_layout_contract.3 = no_inactive_instance_layout_space
<!-- 树的父节点展开符号使用具名按钮，叶子只使用 aria-hidden 的非交互对齐占位，禁止无名称 button 污染键盘和辅助技术控件树。 -->
selplat_tree_toggle_semantics = parent_named_button
<!-- selplat_tree_toggle_semantics.2 的当前独立事实为 leaf_noninteractive_aria_hidden_placeholder。 -->
selplat_tree_toggle_semantics.2 = leaf_noninteractive_aria_hidden_placeholder
<!-- selplat_tree_toggle_semantics.3 的当前独立事实为 no_unnamed_leaf_button。 -->
selplat_tree_toggle_semantics.3 = no_unnamed_leaf_button
<!-- 常见窄屏下标题、状态和快捷动作不得重叠；动作文字空间不足时先收为保留可访问名称与提示的图标按钮。 -->
selplat_panel_compact_header_contract = no_title_status_action_overlap
<!-- selplat_panel_compact_header_contract.2 的当前独立事实为 compact_icon_actions_before_overlap。 -->
selplat_panel_compact_header_contract.2 = compact_icon_actions_before_overlap
<!-- selplat_panel_compact_header_contract.3 的当前独立事实为 preserve_accessible_name_and_tip。 -->
selplat_panel_compact_header_contract.3 = preserve_accessible_name_and_tip
<!-- 工具栏业务状态动作由 Panel 提供稳定宿主，与 Search、筛选和重置在视觉及语义上明确分组。 -->
selplat_panel_toolbar_business_action = toolbarAction_public_host
<!-- selplat_panel_toolbar_business_action.2 的当前独立事实为 after_query_and_reset。 -->
selplat_panel_toolbar_business_action.2 = after_query_and_reset
<!-- selplat_panel_toolbar_business_action.3 的当前独立事实为 context_badge。 -->
selplat_panel_toolbar_business_action.3 = context_badge
<!-- selplat_panel_toolbar_business_action.4 的当前独立事实为 semantic_accent_button。 -->
selplat_panel_toolbar_business_action.4 = semantic_accent_button
<!-- selplat_panel_toolbar_business_action.5 的当前独立事实为 accessible_label。 -->
selplat_panel_toolbar_business_action.5 = accessible_label
<!-- selplat_panel_toolbar_business_action.6 的当前独立事实为 application_owned_command。 -->
selplat_panel_toolbar_business_action.6 = application_owned_command
<!-- selplat_panel_toolbar_business_action.7 的当前独立事实为 no_header_action_dependency。 -->
selplat_panel_toolbar_business_action.7 = no_header_action_dependency
<!-- selplat_panel_toolbar_business_action.8 的当前独立事实为 composite_root_page_edit_registration。 -->
selplat_panel_toolbar_business_action.8 = composite_root_page_edit_registration

## API、主题与依赖

<!-- 浏览器只允许 window.sel 一个 SEL 公共根；selGrid 等名称继续作为稳定控件 ID、文件名、CSS 前缀和内部标识，禁止重新发布平铺全局变量。 -->
selplat_public_api_namespace = window.sel
<!-- selplat_public_api_namespace.2 的当前独立事实为 one_public_root。 -->
selplat_public_api_namespace.2 = one_public_root
<!-- selplat_public_api_namespace.3 的当前独立事实为 no_window_selComponent。 -->
selplat_public_api_namespace.3 = no_window_selComponent
<!-- selplat_public_api_namespace.4 的当前独立事实为 stable_component_id_preserved。 -->
selplat_public_api_namespace.4 = stable_component_id_preserved
<!-- 内核必须先于基础运行时、主题和组件加载；后续能力只能通过 register/registerAll 登记且重复路径直接阻断。 -->
selplat_kernel_registration_contract = selKernel_first
<!-- selplat_kernel_registration_contract.2 的当前独立事实为 register_or_registerAll。 -->
selplat_kernel_registration_contract.2 = register_or_registerAll
<!-- selplat_kernel_registration_contract.3 的当前独立事实为 duplicate_path_blocked。 -->
selplat_kernel_registration_contract.3 = duplicate_path_blocked
<!-- selplat_kernel_registration_contract.4 的当前独立事实为 no_compatibility_alias。 -->
selplat_kernel_registration_contract.4 = no_compatibility_alias
<!-- 控件 ID 去掉 sel 并把首字母转小写后形成唯一调用路径，例如 selGrid 对应 sel.components.grid。 -->
selplat_component_public_api_mapping = sel<ComponentId>->sel.components.<lowerCamelComponentId>
<!-- selplat_component_public_api_mapping.2 的当前独立事实为 registry_and_source_match。 -->
selplat_component_public_api_mapping.2 = registry_and_source_match
<!-- 应用必须在文件顶部使用 sel.require 校验依赖并只解构实际调用的能力；同一文件不得在各函数重复解构或重新包装同名组件。 -->
selplat_application_api_consumption = top_level_require
<!-- selplat_application_api_consumption.2 的当前独立事实为 destructure_once。 -->
selplat_application_api_consumption.2 = destructure_once
<!-- selplat_application_api_consumption.3 的当前独立事实为 used_dependencies_only。 -->
selplat_application_api_consumption.3 = used_dependencies_only
<!-- selplat_application_api_consumption.4 的当前独立事实为 no_component_redefinition。 -->
selplat_application_api_consumption.4 = no_component_redefinition
<!-- 应用装配脚本的最外层入口统一使用 app；从 window.sel 取得的公共基础能力使用 sel 前缀短名，例如 selBase、selAjax。 -->
selplat_application_javascript_entry_and_framework_alias_naming = entry:app
<!-- selplat_application_javascript_entry_and_framework_alias_naming.2 的当前独立事实为 window_sel_alias:sel<Capability>。 -->
selplat_application_javascript_entry_and_framework_alias_naming.2 = window_sel_alias:sel<Capability>
<!-- selplat_application_javascript_entry_and_framework_alias_naming.3 的当前独立事实为 examples:selBase|selAjax。 -->
selplat_application_javascript_entry_and_framework_alias_naming.3 = examples:selBase|selAjax
<!-- 模块级业务状态、配置、接口和函数使用所属项目的 lowerCamelCase 前缀；函数内短生命周变量只需表达当前业务含义，禁止为缩短而丢失归属。 -->
selplat_application_javascript_business_prefix_naming = module_scope:<projectNameLowerCamelCase>*
<!-- selplat_application_javascript_business_prefix_naming.2 的当前独立事实为 function_local:concise_business_meaning。 -->
selplat_application_javascript_business_prefix_naming.2 = function_local:concise_business_meaning
<!-- selplat_application_javascript_business_prefix_naming.3 的当前独立事实为 no_ambiguous_abbreviation。 -->
selplat_application_javascript_business_prefix_naming.3 = no_ambiguous_abbreviation
<!-- 业务应用创建动态节点必须复用公共 element 的安全文本和属性入口；原生 DOM 创建只属于 sel-ui 公共实现层。 -->
selplat_application_dom_creation_entry = sel.core.element
<!-- selplat_application_dom_creation_entry.2 的当前独立事实为 application_no_direct_native_create_element。 -->
selplat_application_dom_creation_entry.2 = application_no_direct_native_create_element
<!-- selplat_application_dom_creation_entry.3 的当前独立事实为 shared_component_implementation_keeps_native_boundary。 -->
selplat_application_dom_creation_entry.3 = shared_component_implementation_keeps_native_boundary
<!-- 原生 Object.freeze 只允许出现在 selKernel；其余 shared、应用和生成模板统一调用 sel.core.freeze。 -->
selplat_freeze_single_entry = sel.core.freeze
<!-- selplat_freeze_single_entry.2 的当前独立事实为 Object.freeze_kernel_only。 -->
selplat_freeze_single_entry.2 = Object.freeze_kernel_only
<!-- selplat_freeze_single_entry.3 的当前独立事实为 shared_apps_templates_use_public_entry。 -->
selplat_freeze_single_entry.3 = shared_apps_templates_use_public_entry
<!-- 深度冻结只递归普通对象与数组，并通过 WeakSet 处理循环引用；DOM、函数、Map、Set、Date 和类实例保持自身生命周期。 -->
selplat_deep_freeze_boundary = plain_object_and_array
<!-- selplat_deep_freeze_boundary.2 的当前独立事实为 cycle_safe。 -->
selplat_deep_freeze_boundary.2 = cycle_safe
<!-- selplat_deep_freeze_boundary.3 的当前独立事实为 skip_dom_function_map_set_date_class_instance。 -->
selplat_deep_freeze_boundary.3 = skip_dom_function_map_set_date_class_instance
<!-- 一个完整配置、聚合 payload 或对外状态快照只在最外层调用一次 selFreeze；内部对象、数组、map 结果和字段不得再次逐层或逐项冻结。 -->
selplat_freeze_one_call_per_immutable_boundary = complete_config_payload_or_snapshot_single_call
<!-- selplat_freeze_one_call_per_immutable_boundary.2 的当前独立事实为 no_nested_selFreeze。 -->
selplat_freeze_one_call_per_immutable_boundary.2 = no_nested_selFreeze
<!-- selplat_freeze_one_call_per_immutable_boundary.3 的当前独立事实为 no_item_by_item_freeze。 -->
selplat_freeze_one_call_per_immutable_boundary.3 = no_item_by_item_freeze
<!-- DOM、控制器、实例注册表和其他运行时生命周期对象保持可变；需要对外返回状态时创建独立副本并只冻结该返回快照。 -->
selplat_runtime_object_freeze_boundary = runtime_controller_dom_registry_mutable
<!-- selplat_runtime_object_freeze_boundary.2 的当前独立事实为 freeze_returned_copy_only。 -->
selplat_runtime_object_freeze_boundary.2 = freeze_returned_copy_only
<!-- MDA 等生成器输出的 JavaScript 必须与现有应用遵守同一冻结结构，禁止模板继续生成已清理的嵌套写法。 -->
selplat_generated_javascript_freeze_parity = generated_template_same_boundary_rule
<!-- selplat_generated_javascript_freeze_parity.2 的当前独立事实为 nested_freeze_gate。 -->
selplat_generated_javascript_freeze_parity.2 = nested_freeze_gate
<!-- selplat_generated_javascript_freeze_parity.3 的当前独立事实为 regression_test。 -->
selplat_generated_javascript_freeze_parity.3 = regression_test
<!-- 应用装配脚本文件头必须说明公共组件用途；非简单函数必须写中文契约，复杂函数内部每个连续关键语句组必须解释业务目的，禁止为括号、逗号和语法字面量堆积机械注释。 -->
selplat_component_usage_documentation = application_header_chinese_component_purpose
<!-- selplat_component_usage_documentation.2 的当前独立事实为 nontrivial_function_chinese_contract。 -->
selplat_component_usage_documentation.2 = nontrivial_function_chinese_contract
<!-- selplat_component_usage_documentation.3 的当前独立事实为 complex_statement_group_business_intent_comment。 -->
selplat_component_usage_documentation.3 = complex_statement_group_business_intent_comment
<!-- selplat_component_usage_documentation.4 的当前独立事实为 no_punctuation_or_syntax_literal_comment。 -->
selplat_component_usage_documentation.4 = no_punctuation_or_syntax_literal_comment
<!-- selplat_component_usage_documentation.5 的当前独立事实为 public_api_table。 -->
selplat_component_usage_documentation.5 = public_api_table
<!-- selplat_component_usage_documentation.6 的当前独立事实为 minimal_mount_example。 -->
selplat_component_usage_documentation.6 = minimal_mount_example
<!-- 全部应用入口脚本统一扫描 app、selBase、可选 selAjax 和具名业务函数前置中文契约，后续项目不得退回独立命名体系。 -->
selplat_application_javascript_uniform_structure_gate = all_application_javascript
<!-- selplat_application_javascript_uniform_structure_gate.2 的当前独立事实为 entry_app。 -->
selplat_application_javascript_uniform_structure_gate.2 = entry_app
<!-- selplat_application_javascript_uniform_structure_gate.3 的当前独立事实为 selBase_required。 -->
selplat_application_javascript_uniform_structure_gate.3 = selBase_required
<!-- selplat_application_javascript_uniform_structure_gate.4 的当前独立事实为 selAjax_when_used。 -->
selplat_application_javascript_uniform_structure_gate.4 = selAjax_when_used
<!-- selplat_application_javascript_uniform_structure_gate.5 的当前独立事实为 named_business_function_preceding_chinese_contract。 -->
selplat_application_javascript_uniform_structure_gate.5 = named_business_function_preceding_chinese_contract

<!-- 所有应用传给 SEL 公共控件的实例 ID 必须由 sel、控件类型、正确英文业务含义和 Id 组成，并使用 lowerCamelCase。 -->
selplat_component_instance_id_naming = sel<ControlType><BusinessMeaning>Id
<!-- selplat_component_instance_id_naming.2 的当前独立事实为 lowerCamelCase。 -->
selplat_component_instance_id_naming.2 = lowerCamelCase
<!-- selplat_component_instance_id_naming.3 的当前独立事实为 correct_english_business_spelling。 -->
selplat_component_instance_id_naming.3 = correct_english_business_spelling
<!-- 同一物理控件切换多个业务模块时使用一个物理实例 ID；模块自己的 gridId 只作为数据库表格头稳定坐标，禁止混用事件实例键。 -->
selplat_shared_physical_grid_and_business_grid_id_boundary = physical_grid_instance_id_for_event_routing
<!-- selplat_shared_physical_grid_and_business_grid_id_boundary.2 的当前独立事实为 business_gridId_for_database_header_coordinate。 -->
selplat_shared_physical_grid_and_business_grid_id_boundary.2 = business_gridId_for_database_header_coordinate

<!-- 带脚本的控件必须通过内核发布登记的命名空间 API；纯样式单元不得虚构空 API。 -->
selplat_component_public_api_gate = script_registers_namespaced_publicApi
<!-- selplat_component_public_api_gate.2 的当前独立事实为 style_only_publicApi_null。 -->
selplat_component_public_api_gate.2 = style_only_publicApi_null
<!-- 主题感知样式必须消费 --sel-theme-* 令牌，应用不得复制控件边框、颜色和交互状态。 -->
selplat_component_theme_gate = themeAware_css_consumes_sel_theme_tokens
<!-- selplat_component_theme_gate.2 的当前独立事实为 no_application_visual_reimplementation。 -->
selplat_component_theme_gate.2 = no_application_visual_reimplementation
<!-- 玻璃主题工具栏外壳不得用贯穿容器的上下边线制造空白区域痕迹；边界视觉只属于内部真实控件。 -->
selplat_glass_admin_toolbar_surface_boundary = full_width_toolbar_has_no_top_or_bottom_border
<!-- selplat_glass_admin_toolbar_surface_boundary.2 的当前独立事实为 controls_keep_own_borders。 -->
selplat_glass_admin_toolbar_surface_boundary.2 = controls_keep_own_borders
<!-- selplat_glass_admin_toolbar_surface_boundary.3 的当前独立事实为 no_drag_or_layout_change。 -->
selplat_glass_admin_toolbar_surface_boundary.3 = no_drag_or_layout_change
<!-- 公共主题内容发生变化时，全部消费页面必须同步更新对应资源 URL 版本标识，确保普通刷新加载新样式。 -->
selplat_shared_theme_cache_delivery = shared_theme_content_change_requires_all_consumer_url_version_bumps
<!-- selplat_shared_theme_cache_delivery.2 的当前独立事实为 normal_reload_fetches_current_style。 -->
selplat_shared_theme_cache_delivery.2 = normal_reload_fetches_current_style
<!-- selplat_shared_theme_cache_delivery.3 的当前独立事实为 no_stale_open_page_cache。 -->
selplat_shared_theme_cache_delivery.3 = no_stale_open_page_cache
<!-- SEL内核或公共JavaScript能力变化时，消费页面必须同步提升内核、依赖能力和应用装配脚本的URL版本。 -->
selplat_shared_script_cache_delivery = kernel_dependency_and_application_url_versions_bump_together
<!-- 新内核不得与旧缓存能力脚本混载，普通刷新后所有require能力必须来自同一发布批次。 -->
selplat_shared_script_cache_delivery.2 = no_new_kernel_with_stale_capability_scripts
<!-- 页面启动关键CSS、字体和图标必须由SELPLAT同源资源交付，禁止依赖可能被浏览器隐私策略阻断的外部CDN。 -->
selplat_browser_critical_asset_origin = repository_managed_same_origin_only
<!-- 外部图标字体不可用时不得导致入口空白；桌面图标必须拥有同源文本或本地素材。 -->
selplat_browser_critical_asset_origin.2 = no_external_icon_cdn_and_local_fallback_required
<!-- 独立拖拽查询的父级只负责布局，不得绘制组合背景或内阴影；子控件位置变化后也只能看到真实控件。 -->
selplat_independent_search_parent_surface = transparent_parent
<!-- selplat_independent_search_parent_surface.2 的当前独立事实为 no_parent_inset_shadow。 -->
selplat_independent_search_parent_surface.2 = no_parent_inset_shadow
<!-- selplat_independent_search_parent_surface.3 的当前独立事实为 real_children_keep_own_surfaces。 -->
selplat_independent_search_parent_surface.3 = real_children_keep_own_surfaces
<!-- selplat_independent_search_parent_surface.4 的当前独立事实为 persisted_child_geometry_unchanged。 -->
selplat_independent_search_parent_surface.4 = persisted_child_geometry_unchanged
<!-- 控件硬依赖必须指向已登记单元，源码必须真实调用依赖 API，应用与生成模板必须在当前控件前加载依赖 CSS/JS。 -->
selplat_component_dependency_gate = registered_target
<!-- selplat_component_dependency_gate.2 的当前独立事实为 no_self_dependency。 -->
selplat_component_dependency_gate.2 = no_self_dependency
<!-- selplat_component_dependency_gate.3 的当前独立事实为 real_public_api_call。 -->
selplat_component_dependency_gate.3 = real_public_api_call
<!-- selplat_component_dependency_gate.4 的当前独立事实为 dependency_resource_exists_and_precedes_consumer。 -->
selplat_component_dependency_gate.4 = dependency_resource_exists_and_precedes_consumer
<!-- 公共表格编辑器只编排 Window、Grid 和调用方确认回调，列表交互不得复制公共基础控件。 -->
selplat_table_editor_public_composition = selWindow_outer
<!-- selplat_table_editor_public_composition.2 的当前独立事实为 selGrid_records_and_switch。 -->
selplat_table_editor_public_composition.2 = selGrid_records_and_switch
<!-- selplat_table_editor_public_composition.3 的当前独立事实为 selConfirmDialog_from_consumer。 -->
selplat_table_editor_public_composition.3 = selConfirmDialog_from_consumer
<!-- selplat_table_editor_public_composition.4 的当前独立事实为 grid_action_event。 -->
selplat_table_editor_public_composition.4 = grid_action_event
<!-- selplat_table_editor_public_composition.5 的当前独立事实为 forbid_private_table_button_switch_reimplementation。 -->
selplat_table_editor_public_composition.5 = forbid_private_table_button_switch_reimplementation
<!-- 表格编辑器拖拽必须只通过手柄触发，完整顺序先形成草稿并经公共确认后原子保存，取消或失败才回滚。 -->
selplat_table_editor_drag_reorder = selGrid_public_drag_handle_and_keyboard_arrows
<!-- selplat_table_editor_drag_reorder.2 的当前独立事实为 complete_visible_order_event。 -->
selplat_table_editor_drag_reorder.2 = complete_visible_order_event
<!-- selplat_table_editor_drag_reorder.3 的当前独立事实为 dragend_outside_tbody_keeps_valid_draft。 -->
selplat_table_editor_drag_reorder.3 = dragend_outside_tbody_keeps_valid_draft
<!-- selplat_table_editor_drag_reorder.4 的当前独立事实为 preview_draft_before_public_confirmation。 -->
selplat_table_editor_drag_reorder.4 = preview_draft_before_public_confirmation
<!-- selplat_table_editor_drag_reorder.5 的当前独立事实为 confirm_before_atomic_sortnum_batch_save。 -->
selplat_table_editor_drag_reorder.5 = confirm_before_atomic_sortnum_batch_save
<!-- selplat_table_editor_drag_reorder.6 的当前独立事实为 cancel_or_failure_restore_previous_order。 -->
selplat_table_editor_drag_reorder.6 = cancel_or_failure_restore_previous_order
<!-- selplat_table_editor_drag_reorder.7 的当前独立事实为 success_refresh_business_header。 -->
selplat_table_editor_drag_reorder.7 = success_refresh_business_header
<!-- 表头显示开关是呈现配置，不得改变管理列表记录的业务字段完整性。 -->
selplat_management_grid_hidden_column_contract = table_element_registered
<!-- selplat_management_grid_hidden_column_contract.2 的当前独立事实为 visible_false_rendering_only。 -->
selplat_management_grid_hidden_column_contract.2 = visible_false_rendering_only
<!-- selplat_management_grid_hidden_column_contract.3 的当前独立事实为 record_keeps_editor_fields。 -->
selplat_management_grid_hidden_column_contract.3 = record_keeps_editor_fields
<!-- selplat_management_grid_hidden_column_contract.4 的当前独立事实为 double_click_record_no_data_loss。 -->
selplat_management_grid_hidden_column_contract.4 = double_click_record_no_data_loss
<!-- selplat_management_grid_hidden_column_contract.5 的当前独立事实为 no_second_detail_request_for_hidden_field。 -->
selplat_management_grid_hidden_column_contract.5 = no_second_detail_request_for_hidden_field
<!-- 单条记录动作返回后只更新对应行；整表刷新只用于分页、查询、语言或列结构变化。 -->
selplat_grid_record_in_place_update_contract = public_updateRecord_by_id
<!-- selplat_grid_record_in_place_update_contract.2 的当前独立事实为 immutable_record_snapshot。 -->
selplat_grid_record_in_place_update_contract.2 = immutable_record_snapshot
<!-- selplat_grid_record_in_place_update_contract.3 的当前独立事实为 target_row_only。 -->
selplat_grid_record_in_place_update_contract.3 = target_row_only
<!-- selplat_grid_record_in_place_update_contract.4 的当前独立事实为 preserve_scroll_left_and_top。 -->
selplat_grid_record_in_place_update_contract.4 = preserve_scroll_left_and_top
<!-- selplat_grid_record_in_place_update_contract.5 的当前独立事实为 preserve_action_focus。 -->
selplat_grid_record_in_place_update_contract.5 = preserve_action_focus
<!-- selplat_grid_record_in_place_update_contract.6 的当前独立事实为 no_header_or_pagination_rebuild。 -->
selplat_grid_record_in_place_update_contract.6 = no_header_or_pagination_rebuild
<!-- selplat_grid_record_in_place_update_contract.7 的当前独立事实为 action_event_does_not_refresh。 -->
selplat_grid_record_in_place_update_contract.7 = action_event_does_not_refresh
<!-- selplat_grid_record_in_place_update_contract.8 的当前独立事实为 no_view_change_means_zero_render。 -->
selplat_grid_record_in_place_update_contract.8 = no_view_change_means_zero_render
<!-- selplat_grid_record_in_place_update_contract.9 的当前独立事实为 setLocale_for_dataset_or_structure_change_only。 -->
selplat_grid_record_in_place_update_contract.9 = setLocale_for_dataset_or_structure_change_only
<!-- Grid 图标颜色必须使用主题语义令牌，不允许业务模块写死色值。 -->
selplat_grid_cell_icon_tone_contract = public_cellIconTone
<!-- selplat_grid_cell_icon_tone_contract.2 的当前独立事实为 static_or_record_function。 -->
selplat_grid_cell_icon_tone_contract.2 = static_or_record_function
<!-- selplat_grid_cell_icon_tone_contract.3 的当前独立事实为 safe_class_token。 -->
selplat_grid_cell_icon_tone_contract.3 = safe_class_token
<!-- selplat_grid_cell_icon_tone_contract.4 的当前独立事实为 semantic_success_and_danger。 -->
selplat_grid_cell_icon_tone_contract.4 = semantic_success_and_danger
<!-- selplat_grid_cell_icon_tone_contract.5 的当前独立事实为 theme_token_color。 -->
selplat_grid_cell_icon_tone_contract.5 = theme_token_color
<!-- selplat_grid_cell_icon_tone_contract.6 的当前独立事实为 no_business_hardcoded_color。 -->
selplat_grid_cell_icon_tone_contract.6 = no_business_hardcoded_color
<!-- 控件资源依赖检查从中央登记动态生成，新增控件不得再靠人工补一个名称专项扫描。 -->
selplat_component_future_extension_gate = registry_driven_directory_source_api_theme_dependency_and_application_scan

## Grid 多值分类筛选

<!-- Grid 的 typeField 同时接受单个分类和分类数组，公共层统一转成非空字符串集合，调用方不得复制筛选算法。 -->
selplat_grid_record_type_value_contract = scalar_or_array
<!-- selplat_grid_record_type_value_contract.2 的当前独立事实为 normalize_to_non_empty_string_values。 -->
selplat_grid_record_type_value_contract.2 = normalize_to_non_empty_string_values
<!-- selplat_grid_record_type_value_contract.3 的当前独立事实为 public_grid_owner。 -->
selplat_grid_record_type_value_contract.3 = public_grid_owner
<!-- 工具栏 type、树节点 type 和 typeGroup 均按集合成员匹配；同一记录可同时出现在多个数据库分类中。 -->
selplat_grid_record_type_filter_semantics = toolbar_type_membership
<!-- selplat_grid_record_type_filter_semantics.2 的当前独立事实为 tree_type_membership。 -->
selplat_grid_record_type_filter_semantics.2 = tree_type_membership
<!-- selplat_grid_record_type_filter_semantics.3 的当前独立事实为 tree_type_group_any_membership。 -->
selplat_grid_record_type_filter_semantics.3 = tree_type_group_any_membership
<!-- selplat_grid_record_type_filter_semantics.4 的当前独立事实为 multiple_categories_allowed。 -->
selplat_grid_record_type_filter_semantics.4 = multiple_categories_allowed
<!-- 原有标量调用方必须继续可用；无分类记录由应用通过明确占位分类表达，公共 Grid 不猜测业务上的未分类文案。 -->
selplat_grid_record_type_compatibility = preserve_scalar_consumers
<!-- selplat_grid_record_type_compatibility.2 的当前独立事实为 application_explicit_unclassified_value。 -->
selplat_grid_record_type_compatibility.2 = application_explicit_unclassified_value
<!-- selplat_grid_record_type_compatibility.3 的当前独立事实为 no_business_label_inference。 -->
selplat_grid_record_type_compatibility.3 = no_business_label_inference

## 多字段查询与后台分页

<!-- selSearch 的 fields 数组表示多个独立查询字段，所有字段共享一个提交按钮；旧单字段调用保持 keyword 契约。 -->
selplat_search_multi_field_contract = optional_fields
<!-- selplat_search_multi_field_contract.2 的当前独立事实为 one_input_one_name。 -->
selplat_search_multi_field_contract.2 = one_input_one_name
<!-- selplat_search_multi_field_contract.3 的当前独立事实为 one_shared_submit。 -->
selplat_search_multi_field_contract.3 = one_shared_submit
<!-- selplat_search_multi_field_contract.4 的当前独立事实为 detail_values_map。 -->
selplat_search_multi_field_contract.4 = detail_values_map
<!-- selplat_search_multi_field_contract.5 的当前独立事实为 legacy_keyword_default。 -->
selplat_search_multi_field_contract.5 = legacy_keyword_default
<!-- 多字段清空、回车、加载态和语言刷新必须作用于同一实例，禁止应用读取组件内部选择器拼装查询值。 -->
selplat_search_multi_field_lifecycle = independent_clear
<!-- selplat_search_multi_field_lifecycle.2 的当前独立事实为 shared_enter_submit。 -->
selplat_search_multi_field_lifecycle.2 = shared_enter_submit
<!-- selplat_search_multi_field_lifecycle.3 的当前独立事实为 shared_loading。 -->
selplat_search_multi_field_lifecycle.3 = shared_loading
<!-- selplat_search_multi_field_lifecycle.4 的当前独立事实为 locale_by_field_name。 -->
selplat_search_multi_field_lifecycle.4 = locale_by_field_name
<!-- selplat_search_multi_field_lifecycle.5 的当前独立事实为 public_getValues_setValues。 -->
selplat_search_multi_field_lifecycle.5 = public_getValues_setValues
<!-- 同一业务实例在模块切换时改变字段集合，必须通过公共 remount 替换实例；Grid 不得缓存旧 Search 控制器。 -->
selplat_search_runtime_structure_change = public_remount_same_instance_id
<!-- selplat_search_runtime_structure_change.2 的当前独立事实为 grid_resolves_current_search_controller。 -->
selplat_search_runtime_structure_change.2 = grid_resolves_current_search_controller
<!-- selplat_search_runtime_structure_change.3 的当前独立事实为 no_stale_dom_controller。 -->
selplat_search_runtime_structure_change.3 = no_stale_dom_controller
<!-- 数据库和线上 JSON 只覆盖几何配置；缺少记录时由 selSearch 公共默认值保证紧凑显示，不得依赖业务数据才能正常布局。 -->
selplat_search_default_width_contract = default:280px
<!-- selplat_search_default_width_contract.2 的当前独立事实为 min:180px。 -->
selplat_search_default_width_contract.2 = min:180px
<!-- selplat_search_default_width_contract.3 的当前独立事实为 no_flex_fill。 -->
selplat_search_default_width_contract.3 = no_flex_fill
<!-- selplat_search_default_width_contract.4 的当前独立事实为 public_css_variable_override。 -->
selplat_search_default_width_contract.4 = public_css_variable_override
<!-- selplat_search_default_width_contract.5 的当前独立事实为 database_or_json_optional。 -->
selplat_search_default_width_contract.5 = database_or_json_optional
<!-- selplat_search_default_width_contract.6 的当前独立事实为 missing_configuration_safe_fallback。 -->
selplat_search_default_width_contract.6 = missing_configuration_safe_fallback
<!-- selplat_search_default_width_contract.7 的当前独立事实为 narrow_host_may_shrink。 -->
selplat_search_default_width_contract.7 = narrow_host_may_shrink
<!-- 搜索字段与外层 Panel 栏目必须同步收紧；字段数量变化时外层宽度跟随当前装配配置，禁止只缩内部控件留下空轨道。 -->
selplat_search_outer_column_compaction = single_field_width_equals_input_plus_gap_plus_submit
<!-- selplat_search_outer_column_compaction.2 的当前独立事实为 multi_field_preserves_configured_geometry。 -->
selplat_search_outer_column_compaction.2 = multi_field_preserves_configured_geometry
<!-- selplat_search_outer_column_compaction.3 的当前独立事实为 column_resize_disabled_reapplies_active_module_width。 -->
selplat_search_outer_column_compaction.3 = column_resize_disabled_reapplies_active_module_width
<!-- selplat_search_outer_column_compaction.4 的当前独立事实为 no_empty_outer_track。 -->
selplat_search_outer_column_compaction.4 = no_empty_outer_track
<!-- 公共组件运行时切换语言时，正文节点与 aria-label、title、placeholder 等可翻译属性必须共享同一映射和源码回退规则。 -->
selplat_component_locale_source_fallback = text_nodes_and_translatable_attributes
<!-- selplat_component_locale_source_fallback.2 的当前独立事实为 target_mapping_or_original_source。 -->
selplat_component_locale_source_fallback.2 = target_mapping_or_original_source
<!-- selplat_component_locale_source_fallback.3 的当前独立事实为 empty_source_locale_map_restores_original。 -->
selplat_component_locale_source_fallback.3 = empty_source_locale_map_restores_original
<!-- selplat_component_locale_source_fallback.4 的当前独立事实为 no_stale_previous_locale_attribute。 -->
selplat_component_locale_source_fallback.4 = no_stale_previous_locale_attribute
<!-- selGrid pagination.mode=REMOTE 时 data.items 已是后台当前页，组件不得再次 slice 或本地过滤。 -->
selplat_grid_remote_pagination_contract = data_items_current_page
<!-- selplat_grid_remote_pagination_contract.2 的当前独立事实为 pagination_totalCount。 -->
selplat_grid_remote_pagination_contract.2 = pagination_totalCount
<!-- selplat_grid_remote_pagination_contract.3 的当前独立事实为 no_second_slice。 -->
selplat_grid_remote_pagination_contract.3 = no_second_slice
<!-- selplat_grid_remote_pagination_contract.4 的当前独立事实为 no_local_filter。 -->
selplat_grid_remote_pagination_contract.4 = no_local_filter
<!-- 远程模式的搜索、分类、状态、页码、容量与重置统一发布 selGrid:queryChange，公共控件不识别业务接口和字段。 -->
selplat_grid_remote_query_event = selGrid:queryChange
<!-- selplat_grid_remote_query_event.2 的当前独立事实为 gridId_reason_pageNo_pageSize_values_type_status。 -->
selplat_grid_remote_query_event.2 = gridId_reason_pageNo_pageSize_values_type_status
<!-- selplat_grid_remote_query_event.3 的当前独立事实为 application_fetches_business_page。 -->
selplat_grid_remote_query_event.3 = application_fetches_business_page
<!-- 未声明 REMOTE 的调用方保持本地筛选分页，新增能力不得改变现有 Grid 页面行为。 -->
selplat_grid_remote_compatibility_boundary = LOCAL_default
<!-- selplat_grid_remote_compatibility_boundary.2 的当前独立事实为 preserve_existing_consumers。 -->
selplat_grid_remote_compatibility_boundary.2 = preserve_existing_consumers

## Grid 动态业务契约与 Window 默认项

<!-- 同一 selGrid 通过 setLocale 切换 records 业务模块时必须同步 grid.searchFields、typeField、statusField 等记录契约，禁止沿用旧模块字段。 -->
selplat_grid_runtime_record_contract_refresh = setLocale_updates_grid_record_options
<!-- selplat_grid_runtime_record_contract_refresh.2 的当前独立事实为 no_stale_search_type_or_status_field。 -->
selplat_grid_runtime_record_contract_refresh.2 = no_stale_search_type_or_status_field
<!-- 应用切换独立业务模块时必须清理不再适用的搜索、分类、状态和树筛选；语言切换仍按控件原有契约保留状态。 -->
selplat_grid_business_module_filter_reset = application_module_switch_resets_incompatible_filters
<!-- selplat_grid_business_module_filter_reset.2 的当前独立事实为 locale_switch_preserves_state。 -->
selplat_grid_business_module_filter_reset.2 = locale_switch_preserves_state
<!-- Grid 表头竖线表达当前列的右边界，因此第一列必须显示，只有没有后续列的最后一列不显示。 -->
selplat_grid_header_separator_boundary = every_column_except_last
<!-- selplat_grid_header_separator_boundary.2 的当前独立事实为 first_column_visible。 -->
selplat_grid_header_separator_boundary.2 = first_column_visible
<!-- selplat_grid_header_separator_boundary.3 的当前独立事实为 no_first_column_exclusion。 -->
selplat_grid_header_separator_boundary.3 = no_first_column_exclusion

## Grid 行选择

<!-- 所有 selGrid 只能通过标准模式声明行选择；默认值保留既有调用方行为。 -->
selplat_grid_row_selection_mode_contract = NONE|SINGLE|MULTIPLE
<!-- selplat_grid_row_selection_mode_contract.2 的当前独立事实为 records_default_NONE。 -->
selplat_grid_row_selection_mode_contract.2 = records_default_NONE
<!-- selplat_grid_row_selection_mode_contract.3 的当前独立事实为 legacy_project_default_MULTIPLE。 -->
selplat_grid_row_selection_mode_contract.3 = legacy_project_default_MULTIPLE
<!-- selplat_grid_row_selection_mode_contract.4 的当前独立事实为 application_explicit_mode。 -->
selplat_grid_row_selection_mode_contract.4 = application_explicit_mode
<!-- 普通行点击选择单个目标，多选模式的复选按钮才执行追加切换，全选只属于多选模式。 -->
selplat_grid_row_selection_interaction = row_click_single_target
<!-- selplat_grid_row_selection_interaction.2 的当前独立事实为 multiple_checkbox_additive_toggle。 -->
selplat_grid_row_selection_interaction.2 = multiple_checkbox_additive_toggle
<!-- selplat_grid_row_selection_interaction.3 的当前独立事实为 select_all_multiple_only。 -->
selplat_grid_row_selection_interaction.3 = select_all_multiple_only
<!-- 公共控件统一维护选中集合、行可访问状态和变化事件，业务应用不得读取内部 DOM 推断选中行。 -->
selplat_grid_row_selection_public_state = selectedIds
<!-- selplat_grid_row_selection_public_state.2 的当前独立事实为 aria_selected。 -->
selplat_grid_row_selection_public_state.2 = aria_selected
<!-- selplat_grid_row_selection_public_state.3 的当前独立事实为 selGrid_selectionChange。 -->
selplat_grid_row_selection_public_state.3 = selGrid_selectionChange
<!-- selplat_grid_row_selection_public_state.4 的当前独立事实为 getSelectedIds。 -->
selplat_grid_row_selection_public_state.4 = getSelectedIds
<!-- selplat_grid_row_selection_public_state.5 的当前独立事实为 getSelectionMode。 -->
selplat_grid_row_selection_public_state.5 = getSelectionMode
<!-- selplat_grid_row_selection_public_state.6 的当前独立事实为 no_application_dom_inference。 -->
selplat_grid_row_selection_public_state.6 = no_application_dom_inference
<!-- selWindow 选择项的 selected 声明必须同时成为 form.reset 的 defaultSelected，新增窗口不得在 reset 后回到错误的第一项。 -->
selplat_window_select_default_reset_contract = selected_option_sets_defaultSelected
<!-- selplat_window_select_default_reset_contract.2 的当前独立事实为 form_reset_restores_business_default。 -->
selplat_window_select_default_reset_contract.2 = form_reset_restores_business_default
<!-- 表单之外的完整管理流程仍使用 selWindow 的标题栏、拖动、缩放和层级；应用只能通过 content 元素注入公共组件组合，并显式隐藏无意义的标准提交栏。 -->
selplat_window_custom_content_contract = content_element_only
<!-- selplat_window_custom_content_contract.2 的当前独立事实为 public_window_frame_lifecycle。 -->
selplat_window_custom_content_contract.2 = public_window_frame_lifecycle
<!-- selplat_window_custom_content_contract.3 的当前独立事实为 showActions_false_for_external_actions。 -->
selplat_window_custom_content_contract.3 = showActions_false_for_external_actions
<!-- selplat_window_custom_content_contract.4 的当前独立事实为 no_html_string_injection。 -->
selplat_window_custom_content_contract.4 = no_html_string_injection

## 横向工具栏栏目缩放

<!-- 工具栏栏目宽度属于面板外层布局职责；搜索、下拉、日期和动作控件不得分别复制分隔线与指针事件。 -->
selplat_toolbar_column_resize_owner = selPanel
<!-- selplat_toolbar_column_resize_owner.2 的当前独立事实为 outer_layout_only。 -->
selplat_toolbar_column_resize_owner.2 = outer_layout_only
<!-- selplat_toolbar_column_resize_owner.3 的当前独立事实为 no_child_component_reimplementation。 -->
selplat_toolbar_column_resize_owner.3 = no_child_component_reimplementation
<!-- selPanel 横向工具栏栏目默认具备拖拽能力；调用方明确不需要时才允许整体或单栏关闭。 -->
selplat_toolbar_column_resize_default = enabled
<!-- selplat_toolbar_column_resize_default.2 的当前独立事实为 toolbar.columnResize=false。 -->
selplat_toolbar_column_resize_default.2 = toolbar.columnResize=false
<!-- selplat_toolbar_column_resize_default.3 的当前独立事实为 columns.<key>.columnResize=false。 -->
selplat_toolbar_column_resize_default.3 = columns.<key>.columnResize=false
<!-- 应用只通过 mount 的 toolbar 标准选项声明默认、最小和最大宽度，禁止选择公共内部类修改几何或自行绑定 pointer 事件。 -->
selplat_toolbar_column_resize_public_options = toolbar.columns.<key>.width|minWidth|maxWidth|label
<!-- 鼠标、触摸和键盘共享同一真实宽度状态；左右键逐步调整、Home/End 到边界、双击恢复声明默认值。 -->
selplat_toolbar_column_resize_interaction = pointer_drag
<!-- selplat_toolbar_column_resize_interaction.2 的当前独立事实为 arrow_keys。 -->
selplat_toolbar_column_resize_interaction.2 = arrow_keys
<!-- selplat_toolbar_column_resize_interaction.3 的当前独立事实为 home_end。 -->
selplat_toolbar_column_resize_interaction.3 = home_end
<!-- selplat_toolbar_column_resize_interaction.4 的当前独立事实为 double_click_reset。 -->
selplat_toolbar_column_resize_interaction.4 = double_click_reset
<!-- selplat_toolbar_column_resize_interaction.5 的当前独立事实为 aria_separator。 -->
selplat_toolbar_column_resize_interaction.5 = aria_separator
<!-- 高频指针移动必须合并到绘制帧，结束、取消、失焦和捕获丢失都要清理全页光标与临时监听器。 -->
selplat_toolbar_column_resize_lifecycle = request_animation_frame
<!-- selplat_toolbar_column_resize_lifecycle.2 的当前独立事实为 finish_cancel_blur_lost_capture_cleanup。 -->
selplat_toolbar_column_resize_lifecycle.2 = finish_cancel_blur_lost_capture_cleanup
<!-- selplat_toolbar_column_resize_lifecycle.3 的当前独立事实为 no_persistent_window_drag_listener。 -->
selplat_toolbar_column_resize_lifecycle.3 = no_persistent_window_drag_listener

## 统一语义文字

<!-- 全部公共控件和应用消费控件时只允许使用七级可读文字角色；业务含义是新增页面不再退回只有大中小三档、层级无法表达的字号体系。 -->
selplat_semantic_typography_roles = display
<!-- selplat_semantic_typography_roles.2 的当前独立事实为 title。 -->
selplat_semantic_typography_roles.2 = title
<!-- selplat_semantic_typography_roles.3 的当前独立事实为 heading。 -->
selplat_semantic_typography_roles.3 = heading
<!-- selplat_semantic_typography_roles.4 的当前独立事实为 body。 -->
selplat_semantic_typography_roles.4 = body
<!-- selplat_semantic_typography_roles.5 的当前独立事实为 label。 -->
selplat_semantic_typography_roles.5 = label
<!-- selplat_semantic_typography_roles.6 的当前独立事实为 caption。 -->
selplat_semantic_typography_roles.6 = caption
<!-- selplat_semantic_typography_roles.7 的当前独立事实为 micro。 -->
selplat_semantic_typography_roles.7 = micro
<!-- 七级字号必须配套统一 regular、medium、semibold、bold 字重及角色行高；业务含义是相同角色跨控件保持可读密度和视觉重量。 -->
selplat_semantic_typography_metrics = font_size
<!-- selplat_semantic_typography_metrics.2 的当前独立事实为 font_weight。 -->
selplat_semantic_typography_metrics.2 = font_weight
<!-- selplat_semantic_typography_metrics.3 的当前独立事实为 line_height。 -->
selplat_semantic_typography_metrics.3 = line_height
<!-- primary 与 secondary 旧字号令牌已删除且禁止兼容；业务含义是新旧名称不会并存造成不同控件继续走不同体系。 -->
selplat_legacy_typography_token_policy = forbid(--sel-theme-font-size-primary,--sel-theme-font-size-secondary)
<!-- selplat_legacy_typography_token_policy.2 的当前独立事实为 no_compatibility_alias。 -->
selplat_legacy_typography_token_policy.2 = no_compatibility_alias
<!-- 可读文字禁止直接写像素字号，图标、头像、复选框及其他几何图形尺寸除外；业务含义是主题缩放只改变文字，不破坏控件图形比例。 -->
selplat_component_text_size_boundary = readable_text_uses_semantic_tokens
<!-- selplat_component_text_size_boundary.2 的当前独立事实为 icon_avatar_checkbox_geometry_may_use_fixed_size。 -->
selplat_component_text_size_boundary.2 = icon_avatar_checkbox_geometry_may_use_fixed_size
<!-- 公共树按通用节点类型表达层级，调用方也可显式覆盖；未知类型回落 label，禁止按应用名推测。 -->
selplat_tree_typography_mapping = database|catalog:heading
<!-- selplat_tree_typography_mapping.2 的当前独立事实为 schema:body。 -->
selplat_tree_typography_mapping.2 = schema:body
<!-- selplat_tree_typography_mapping.3 的当前独立事实为 table|view:label。 -->
selplat_tree_typography_mapping.3 = table|view:label
<!-- selplat_tree_typography_mapping.4 的当前独立事实为 field|column:caption。 -->
selplat_tree_typography_mapping.4 = field|column:caption
<!-- selplat_tree_typography_mapping.5 的当前独立事实为 unknown:label。 -->
selplat_tree_typography_mapping.5 = unknown:label
<!-- selplat_tree_typography_mapping.6 的当前独立事实为 explicit:typographyRole。 -->
selplat_tree_typography_mapping.6 = explicit:typographyRole

## 统一截断文字提示

<!-- 截断文字提示由登记的 selTooltip 独占门户、role=tooltip、定位、延时和可访问关联，Grid、Tree 或应用不得复制实现。 -->
selplat_truncated_text_tooltip_owner = selTooltip
<!-- selplat_truncated_text_tooltip_owner.2 的当前独立事实为 one_body_portal。 -->
selplat_truncated_text_tooltip_owner.2 = one_body_portal
<!-- selplat_truncated_text_tooltip_owner.3 的当前独立事实为 owned_role_tooltip。 -->
selplat_truncated_text_tooltip_owner.3 = owned_role_tooltip
<!-- selplat_truncated_text_tooltip_owner.4 的当前独立事实为 no_private_reimplementation。 -->
selplat_truncated_text_tooltip_owner.4 = no_private_reimplementation
<!-- Grid 与 Tree 默认接入统一提示，只在真实 overflow 时展示完整文字；鼠标、键盘、滚动、缩放和 Escape 生命周期必须一致。 -->
selplat_truncated_text_tooltip_behavior = grid_and_tree_default_enabled
<!-- selplat_truncated_text_tooltip_behavior.2 的当前独立事实为 real_overflow_only。 -->
selplat_truncated_text_tooltip_behavior.2 = real_overflow_only
<!-- selplat_truncated_text_tooltip_behavior.3 的当前独立事实为 pointer_and_focus。 -->
selplat_truncated_text_tooltip_behavior.3 = pointer_and_focus
<!-- selplat_truncated_text_tooltip_behavior.4 的当前独立事实为 hide_on_scroll_resize_escape。 -->
selplat_truncated_text_tooltip_behavior.4 = hide_on_scroll_resize_escape
<!-- 调用方只有明确不需要提示时才可通过 grid.tooltip=false 或 tree.tooltip=false 关闭，禁止建立相反的默认关闭配置。 -->
selplat_truncated_text_tooltip_disable_api = grid.tooltip=false
<!-- selplat_truncated_text_tooltip_disable_api.2 的当前独立事实为 tree.tooltip=false。 -->
selplat_truncated_text_tooltip_disable_api.2 = tree.tooltip=false
<!-- selplat_truncated_text_tooltip_disable_api.3 的当前独立事实为 default_enabled。 -->
selplat_truncated_text_tooltip_disable_api.3 = default_enabled
<!-- Grid 与 Tree 的截断文字不得使用浏览器原生 title；启用 selTooltip 后必须删除旧 title 路径且不保留兼容分支。 -->
selplat_truncated_text_native_title_policy = forbidden_in_grid_and_tree
<!-- selplat_truncated_text_native_title_policy.2 的当前独立事实为 delete_legacy_title。 -->
selplat_truncated_text_native_title_policy.2 = delete_legacy_title
<!-- selplat_truncated_text_native_title_policy.3 的当前独立事实为 no_compatibility_branch。 -->
selplat_truncated_text_native_title_policy.3 = no_compatibility_branch

## Grid 纯图标记录操作提示

<!-- 表格记录操作只显示图标时，鼠标与键盘用户都必须获得同一动作说明；统一复用 selTooltip 的 always 模式并同步 aria-label，禁止退回原生 title。 -->
selplat_grid_icon_action_tooltip_contract = icon_only_record_action_requires_selTooltip_always
<!-- selplat_grid_icon_action_tooltip_contract.2 的当前独立事实为 aria_label_matches_tooltip。 -->
selplat_grid_icon_action_tooltip_contract.2 = aria_label_matches_tooltip
<!-- selplat_grid_icon_action_tooltip_contract.3 的当前独立事实为 no_native_title。 -->
selplat_grid_icon_action_tooltip_contract.3 = no_native_title
<!-- 启停类记录操作的图标和 Tip 必须描述点击后将执行的动作；已启用记录显示停用，已停用记录显示启用，禁止用当前状态冒充动作。 -->
selplat_grid_state_action_semantics = label_and_icon_describe_next_action
<!-- selplat_grid_state_action_semantics.2 的当前独立事实为 enabled_record_shows_disable。 -->
selplat_grid_state_action_semantics.2 = enabled_record_shows_disable
<!-- selplat_grid_state_action_semantics.3 的当前独立事实为 disabled_record_shows_enable。 -->
selplat_grid_state_action_semantics.3 = disabled_record_shows_enable

## 破坏性动作确认

<!-- 删除等只需要一次布尔选择的破坏性动作必须使用紧凑 selConfirmDialog；selWindow 只承载表单或完整业务流程，禁止用空白大窗口模拟确认框。 -->
selplat_destructive_action_confirmation_component = selConfirmDialog
<!-- selplat_destructive_action_confirmation_component.2 的当前独立事实为 compact_boolean_confirmation。 -->
selplat_destructive_action_confirmation_component.2 = compact_boolean_confirmation
<!-- selplat_destructive_action_confirmation_component.3 的当前独立事实为 no_selWindow。 -->
selplat_destructive_action_confirmation_component.3 = no_selWindow
<!-- 危险确认必须在用户明确确认后才调用业务删除；取消、关闭和 Escape 均返回 false，初始焦点停在取消按钮以避免回车误删。 -->
selplat_destructive_confirmation_safety = execute_after_true_only
<!-- selplat_destructive_confirmation_safety.2 的当前独立事实为 cancel_close_escape_return_false。 -->
selplat_destructive_confirmation_safety.2 = cancel_close_escape_return_false
<!-- selplat_destructive_confirmation_safety.3 的当前独立事实为 default_focus_cancel。 -->
selplat_destructive_confirmation_safety.3 = default_focus_cancel
<!-- 确认文案必须依据当前数据动态展示真实关联数量，并准确区分逻辑停用、物理删除与级联影响；没有后端检查时禁止声称数据库会自动阻止。 -->
selplat_destructive_confirmation_truthful_copy = current_relation_count
<!-- selplat_destructive_confirmation_truthful_copy.2 的当前独立事实为 actual_soft_or_physical_delete_semantics。 -->
selplat_destructive_confirmation_truthful_copy.2 = actual_soft_or_physical_delete_semantics
<!-- selplat_destructive_confirmation_truthful_copy.3 的当前独立事实为 no_unimplemented_database_block_claim。 -->
selplat_destructive_confirmation_truthful_copy.3 = no_unimplemented_database_block_claim

## 管理员页面编辑

<!-- 页面编辑模式由 selPersonalization 统一拥有，应用只登记控件根、可见名称、数据库坐标和捕获保存适配器，禁止每页复制编辑开关与全局保存栏。 -->
selplat_page_editor_owner = selPersonalization
<!-- selplat_page_editor_owner.2 的当前独立事实为 application_registers_root_title_coordinates_capture_save_only。 -->
selplat_page_editor_owner.2 = application_registers_root_title_coordinates_capture_save_only
<!-- selplat_page_editor_owner.3 的当前独立事实为 no_private_editor_shell。 -->
selplat_page_editor_owner.3 = no_private_editor_shell
<!-- selplat_page_editor_owner.4 的当前独立事实为 no_global_save_cancel。 -->
selplat_page_editor_owner.4 = no_global_save_cancel
<!-- 页面编辑入口只在后台明确返回 canEditPage=true 时显示；保存接口必须再次调用 BaseServiceImpl.isAdmin，禁止以前端隐藏作为权限边界。 -->
selplat_page_editor_authorization = backend_capability_controls_visibility
<!-- selplat_page_editor_authorization.2 的当前独立事实为 service_isAdmin_rechecks_every_save。 -->
selplat_page_editor_authorization.2 = service_isAdmin_rechecks_every_save
<!-- selplat_page_editor_authorization.3 的当前独立事实为 no_frontend_only_authorization。 -->
selplat_page_editor_authorization.3 = no_frontend_only_authorization
<!-- 页面编辑区只允许一个整页手动编辑滑动开关；它只控制编辑能力显隐，不展示控件卡、检查器、保存或取消，也不得阻断页面导航。 -->
selplat_page_editor_session_lifecycle = single_whole_page_manual_edit_switch
<!-- selplat_page_editor_session_lifecycle.2 的当前独立事实为 no_preview_edit_tabs。 -->
selplat_page_editor_session_lifecycle.2 = no_preview_edit_tabs
<!-- selplat_page_editor_session_lifecycle.3 的当前独立事实为 off_normal_page。 -->
selplat_page_editor_session_lifecycle.3 = off_normal_page
<!-- selplat_page_editor_session_lifecycle.4 的当前独立事实为 on_show_edit_affordances。 -->
selplat_page_editor_session_lifecycle.4 = on_show_edit_affordances
<!-- selplat_page_editor_session_lifecycle.5 的当前独立事实为 no_control_cards。 -->
selplat_page_editor_session_lifecycle.5 = no_control_cards
<!-- selplat_page_editor_session_lifecycle.6 的当前独立事实为 no_inspector。 -->
selplat_page_editor_session_lifecycle.6 = no_inspector
<!-- selplat_page_editor_session_lifecycle.7 的当前独立事实为 no_global_save_cancel。 -->
selplat_page_editor_session_lifecycle.7 = no_global_save_cancel
<!-- selplat_page_editor_session_lifecycle.8 的当前独立事实为 no_navigation_block。 -->
selplat_page_editor_session_lifecycle.8 = no_navigation_block
<!-- 每个独立控件或组合工具栏当前选中子控件必须显式保存自身状态；没有修改时无需提醒，未点击保存不得自动持久化。 -->
selplat_page_editor_explicit_save = per_control_or_shared_current_child_save
<!-- selplat_page_editor_explicit_save.2 的当前独立事实为 capture_current_state_on_click。 -->
selplat_page_editor_explicit_save.2 = capture_current_state_on_click
<!-- selplat_page_editor_explicit_save.3 的当前独立事实为 no_global_dirty_prompt。 -->
selplat_page_editor_explicit_save.3 = no_global_dirty_prompt
<!-- selplat_page_editor_explicit_save.4 的当前独立事实为 no_implicit_persistence。 -->
selplat_page_editor_explicit_save.4 = no_implicit_persistence
<!-- 组合工具栏只用 TOOLBAR 父记录表达共同查询边界；每个真实条件元素与提交动作逐条登记并独立保存，缺失记录使用公共默认布局。 -->
selplat_composite_toolbar_control_editing = toolbar_parent_boundary
<!-- selplat_composite_toolbar_control_editing.2 的当前独立事实为 unified_query_draft_committed_only_by_submit。 -->
selplat_composite_toolbar_control_editing.2 = unified_query_draft_committed_only_by_submit
<!-- selplat_composite_toolbar_control_editing.3 的当前独立事实为 one_record_per_real_input_select_radio_checkbox_button_filter_or_business_action_composite。 -->
selplat_composite_toolbar_control_editing.3 = one_record_per_real_input_select_radio_checkbox_button_filter_or_business_action_composite
<!-- selplat_composite_toolbar_control_editing.4 的当前独立事实为 multiple_structural_fields_render_as_independent_inputs_AND_only_no_keyword_OR。 -->
selplat_composite_toolbar_control_editing.4 = multiple_structural_fields_render_as_independent_inputs_AND_only_no_keyword_OR
<!-- selplat_composite_toolbar_control_editing.5 的当前独立事实为 missing_record_uses_component_default。 -->
selplat_composite_toolbar_control_editing.5 = missing_record_uses_component_default
<!-- selplat_composite_toolbar_control_editing.6 的当前独立事实为 independent_width_with_ordered_reflow。 -->
selplat_composite_toolbar_control_editing.6 = independent_width_with_ordered_reflow
<!-- selplat_composite_toolbar_control_editing.7 的当前独立事实为 shared_first_item_vertical_baseline。 -->
selplat_composite_toolbar_control_editing.7 = shared_first_item_vertical_baseline
<!-- selplat_composite_toolbar_control_editing.8 的当前独立事实为 first_item_public_horizontal_group_move_handle。 -->
selplat_composite_toolbar_control_editing.8 = first_item_public_horizontal_group_move_handle
<!-- selplat_composite_toolbar_control_editing.9 的当前独立事实为 group_move_preserves_gap_and_child_widths。 -->
selplat_composite_toolbar_control_editing.9 = group_move_preserves_gap_and_child_widths
<!-- selplat_composite_toolbar_control_editing.10 的当前独立事实为 anchor_x_single_record_save。 -->
selplat_composite_toolbar_control_editing.10 = anchor_x_single_record_save
<!-- selplat_composite_toolbar_control_editing.11 的当前独立事实为 one_shared_current_control_save_following_last_editable_toolbar_control。 -->
selplat_composite_toolbar_control_editing.11 = one_shared_current_control_save_following_last_editable_toolbar_control
<!-- selplat_composite_toolbar_control_editing.12 的当前独立事实为 single_control_payload。 -->
selplat_composite_toolbar_control_editing.12 = single_control_payload
<!-- selplat_composite_toolbar_control_editing.13 的当前独立事实为 no_editor_cards。 -->
selplat_composite_toolbar_control_editing.13 = no_editor_cards
<!-- 业务应用只能通过公共 API 取得允许编辑的真实布局根并提交状态；指针生命周期、绘制帧合并和边界夹取统一归 selPersonalization。 -->
selplat_page_control_geometry_owner = selPersonalization
<!-- selplat_page_control_geometry_owner.2 的当前独立事实为 component_public_layout_targets。 -->
selplat_page_control_geometry_owner.2 = component_public_layout_targets
<!-- selplat_page_control_geometry_owner.3 的当前独立事实为 application_host_bounds_state_save_only。 -->
selplat_page_control_geometry_owner.3 = application_host_bounds_state_save_only
<!-- selplat_page_control_geometry_owner.4 的当前独立事实为 request_animation_frame。 -->
selplat_page_control_geometry_owner.4 = request_animation_frame
<!-- selplat_page_control_geometry_owner.5 的当前独立事实为 finish_cancel_blur_lost_capture_cleanup。 -->
selplat_page_control_geometry_owner.5 = finish_cancel_blur_lost_capture_cleanup
<!-- 直接几何调宽手柄不得使用不可聚焦 span；按钮必须提供当前控件名称，并保留可见焦点。 -->
selplat_page_control_resize_accessibility = focusable_named_button
<!-- selplat_page_control_resize_accessibility.2 的当前独立事实为 control_title_in_accessible_name。 -->
selplat_page_control_resize_accessibility.2 = control_title_in_accessible_name
<!-- selplat_page_control_resize_accessibility.3 的当前独立事实为 mouse_and_alt_arrow_same_geometry_path。 -->
selplat_page_control_resize_accessibility.3 = mouse_and_alt_arrow_same_geometry_path
<!-- selplat_page_control_resize_accessibility.4 的当前独立事实为 visible_focus。 -->
selplat_page_control_resize_accessibility.4 = visible_focus
<!-- 编辑模式打开后才在已登记控件旁显示统一编辑入口；预览模式必须移除角标和编辑轮廓，保持业务页面干净。 -->
selplat_page_editor_affordance_visibility = registered_control_badge_in_edit_mode_only
<!-- selplat_page_editor_affordance_visibility.2 的当前独立事实为 preview_mode_clean。 -->
selplat_page_editor_affordance_visibility.2 = preview_mode_clean
<!-- 表格配置头默认退出布局；仅整页编辑开启后展示表格名称、数据库 table code 和编辑入口，禁止按钮覆盖业务列头。 -->
selplat_grid_page_editor_heading = hidden_when_switch_off
<!-- selplat_grid_page_editor_heading.2 的当前独立事实为 visible_when_switch_on。 -->
selplat_grid_page_editor_heading.2 = visible_when_switch_on
<!-- selplat_grid_page_editor_heading.3 的当前独立事实为 table_title_and_database_table_code。 -->
selplat_grid_page_editor_heading.3 = table_title_and_database_table_code
<!-- selplat_grid_page_editor_heading.4 的当前独立事实为 save_action_inside_heading。 -->
selplat_grid_page_editor_heading.4 = save_action_inside_heading
<!-- selplat_grid_page_editor_heading.5 的当前独立事实为 no_business_column_overlap。 -->
selplat_grid_page_editor_heading.5 = no_business_column_overlap
<!-- 表格和 Window 编辑按钮紧跟数据库 code；组合工具栏共享保存按钮紧跟末尾标准控件，统一使用琥珀金强调色。 -->
selplat_page_editor_button_presentation = grid_window_immediately_after_database_code
<!-- selplat_page_editor_button_presentation.2 的当前独立事实为 composite_shared_save_after_last_editable_toolbar_control。 -->
selplat_page_editor_button_presentation.2 = composite_shared_save_after_last_editable_toolbar_control
<!-- selplat_page_editor_button_presentation.3 的当前独立事实为 no_auto_margin_push。 -->
selplat_page_editor_button_presentation.3 = no_auto_margin_push
<!-- selplat_page_editor_button_presentation.4 的当前独立事实为 shared_semantic_warning_accent。 -->
selplat_page_editor_button_presentation.4 = shared_semantic_warning_accent
<!-- 每个 Window 实例必须绑定独立配置记录；开启总开关后标题栏显示自身 code 和保存按钮，保存实际宽高与位置作为下次打开默认矩形。 -->
selplat_window_page_editor_heading = one_window_instance_one_configuration_record
<!-- selplat_window_page_editor_heading.2 的当前独立事实为 same_whole_page_switch。 -->
selplat_window_page_editor_heading.2 = same_whole_page_switch
<!-- selplat_window_page_editor_heading.3 的当前独立事实为 hidden_when_switch_off。 -->
selplat_window_page_editor_heading.3 = hidden_when_switch_off
<!-- selplat_window_page_editor_heading.4 的当前独立事实为 visible_in_open_window_header_when_switch_on。 -->
selplat_window_page_editor_heading.4 = visible_in_open_window_header_when_switch_on
<!-- selplat_window_page_editor_heading.5 的当前独立事实为 window_title_and_database_code。 -->
selplat_window_page_editor_heading.5 = window_title_and_database_code
<!-- selplat_window_page_editor_heading.6 的当前独立事实为 save_actual_geometry_as_next_default。 -->
selplat_window_page_editor_heading.6 = save_actual_geometry_as_next_default
<!-- 每个控件必须直观显示足以定位其真实配置记录的稳定坐标；表格使用 tableName+gridId，具体列持久化再增加 gridColumnId。 -->
selplat_page_editor_coordinate_contract = control_specific_stable_database_coordinate
<!-- selplat_page_editor_coordinate_contract.2 的当前独立事实为 grid_tableName_plus_gridId。 -->
selplat_page_editor_coordinate_contract.2 = grid_tableName_plus_gridId
<!-- selplat_page_editor_coordinate_contract.3 的当前独立事实为 column_adds_gridColumnId。 -->
selplat_page_editor_coordinate_contract.3 = column_adds_gridColumnId
<!-- Grid 拖动过程只更新内存预览，结束时发布一次终值；显式保存批量更新宽度并重新调用业务 getGridColumn，禁止移动期间逐次写库。 -->
selplat_grid_page_editor_persistence = live_memory_resize
<!-- selplat_grid_page_editor_persistence.2 的当前独立事实为 one_terminal_change_event。 -->
selplat_grid_page_editor_persistence.2 = one_terminal_change_event
<!-- selplat_grid_page_editor_persistence.3 的当前独立事实为 batch_save_widths。 -->
selplat_grid_page_editor_persistence.3 = batch_save_widths
<!-- selplat_grid_page_editor_persistence.4 的当前独立事实为 write_then_business_getGridColumn_refresh。 -->
selplat_grid_page_editor_persistence.4 = write_then_business_getGridColumn_refresh
<!-- selplat_grid_page_editor_persistence.5 的当前独立事实为 no_request_per_pointermove。 -->
selplat_grid_page_editor_persistence.5 = no_request_per_pointermove
<!-- 菜单、树、下拉和数据类型以后通过同一页面编辑注册 API 增加适配器，但仍使用各自业务表和 Service，禁止合并为不可治理的通用 JSON 表。 -->
selplat_page_editor_extension_boundary = shared_editor_session_per_control_adapter
<!-- selplat_page_editor_extension_boundary.2 的当前独立事实为 menu_tree_dropdown_data_type_keep_business_table_and_service。 -->
selplat_page_editor_extension_boundary.2 = menu_tree_dropdown_data_type_keep_business_table_and_service
<!-- selplat_page_editor_extension_boundary.3 的当前独立事实为 no_monolithic_json_table。 -->
selplat_page_editor_extension_boundary.3 = no_monolithic_json_table
<!-- 只触发业务管理流程、不产生页面草稿的控件使用 action-only onEdit 登记；它不参与脏状态、保存或取消恢复，但仍受管理员权限和编辑模式控制。 -->
selplat_page_editor_action_control_contract = register_onEdit_action_only
<!-- selplat_page_editor_action_control_contract.2 的当前独立事实为 enabled_dynamic_visibility。 -->
selplat_page_editor_action_control_contract.2 = enabled_dynamic_visibility
<!-- selplat_page_editor_action_control_contract.3 的当前独立事实为 no_capture_restore_save_requirement。 -->
selplat_page_editor_action_control_contract.3 = no_capture_restore_save_requirement
<!-- selplat_page_editor_action_control_contract.4 的当前独立事实为 excluded_from_dirty_save_cancel。 -->
selplat_page_editor_action_control_contract.4 = excluded_from_dirty_save_cancel
<!-- 引用类型目录与树节点彻底分开保存；TreeNode 只使用自身 code 与 parentId 建树，禁止类型目录、下拉或菜单分类借用树表存储明细。 -->
selplat_reference_dropdown_data_model = ReferenceDataControlLayout_code_is_real_page_control_no_typeId_and_optional_optionSetCode_and_forbids_WINDOW_parent
<!-- selplat_reference_dropdown_data_model.2 的当前独立事实为 ReferenceDataType_optionSetCode_plus_valueCode_plus_parentTypeCode_same_option_set_plus_localized_names_and_forbids_TREE。 -->
selplat_reference_dropdown_data_model.2 = ReferenceDataType_optionSetCode_plus_valueCode_plus_parentTypeCode_same_option_set_plus_localized_names_and_forbids_TREE
<!-- selplat_reference_dropdown_data_model.3 的当前独立事实为 ReferenceDataTreeNode_code_plus_parentId_independent_tree。 -->
selplat_reference_dropdown_data_model.3 = ReferenceDataTreeNode_code_plus_parentId_independent_tree
<!-- selplat_reference_dropdown_data_model.4 的当前独立事实为 no_type_project_or_page_duplication。 -->
selplat_reference_dropdown_data_model.4 = no_type_project_or_page_duplication
<!-- selplat_reference_dropdown_data_model.5 的当前独立事实为 no_controlCode。 -->
selplat_reference_dropdown_data_model.5 = no_controlCode
<!-- selplat_reference_dropdown_data_model.6 的当前独立事实为 no_categoryCode。 -->
selplat_reference_dropdown_data_model.6 = no_categoryCode
<!-- selplat_reference_dropdown_data_model.7 的当前独立事实为 no_tree_typeId_no_nodeCode_no_attributesJson。 -->
selplat_reference_dropdown_data_model.7 = no_tree_typeId_no_nodeCode_no_attributesJson
<!-- 管理工作台中的类型筛选器只负责过滤数据，禁止把筛选槽注册为业务页面下拉框或以其当前值冒充控件绑定。 -->
selplat_reference_dropdown_filter_boundary = only_explicit_ReferenceDataControlLayout_code_can_bind_optionSetCode
<!-- selplat_reference_dropdown_filter_boundary.2 的当前独立事实为 registered_page_control_may_share_real_option_set。 -->
selplat_reference_dropdown_filter_boundary.2 = registered_page_control_may_share_real_option_set
<!-- selplat_reference_dropdown_filter_boundary.3 的当前独立事实为 no_window_inner_form_registration。 -->
selplat_reference_dropdown_filter_boundary.3 = no_window_inner_form_registration
<!-- selplat_reference_dropdown_filter_boundary.4 的当前独立事实为 no_dom_id_or_current_filter_value_as_binding。 -->
selplat_reference_dropdown_filter_boundary.4 = no_dom_id_or_current_filter_value_as_binding
<!-- 下拉和菜单当前只登记类型分类及多语言名称；在建立独立且有真实调用链的数据模型前，不得向 TreeNode 写入选项或菜单项。 -->
selplat_reference_dropdown_option_management = ReferenceDataType_is_shared_option_set_value_and_menu_hierarchy
<!-- selplat_reference_dropdown_option_management.2 的当前独立事实为 optionSetCode_direct_query。 -->
selplat_reference_dropdown_option_management.2 = optionSetCode_direct_query
<!-- selplat_reference_dropdown_option_management.3 的当前独立事实为 parentTypeCode_same_option_set。 -->
selplat_reference_dropdown_option_management.3 = parentTypeCode_same_option_set
<!-- selplat_reference_dropdown_option_management.4 的当前独立事实为 forbid_dropdown_or_menu_records_in_tree_node。 -->
selplat_reference_dropdown_option_management.4 = forbid_dropdown_or_menu_records_in_tree_node

## 验证

<!-- 快速门禁执行登记、源码归属、应用私造和生成模板依赖检查，不启动浏览器或业务数据库。 -->
selplat_component_quick_gate = selplat_source_ownership_guard
<!-- selplat_component_quick_gate.2 的当前独立事实为 zero_component_governance_violations。 -->
selplat_component_quick_gate.2 = zero_component_governance_violations
<!-- 快速门禁同步检查七级令牌完整性、树层级选择器和旧字号令牌清零。 -->
selplat_component_typography_quick_gate = seven_roles
<!-- selplat_component_typography_quick_gate.2 的当前独立事实为 weight_and_line_height_metrics。 -->
selplat_component_typography_quick_gate.2 = weight_and_line_height_metrics
<!-- selplat_component_typography_quick_gate.3 的当前独立事实为 tree_role_mapping。 -->
selplat_component_typography_quick_gate.3 = tree_role_mapping
<!-- selplat_component_typography_quick_gate.4 的当前独立事实为 zero_primary_secondary_legacy_token。 -->
selplat_component_typography_quick_gate.4 = zero_primary_secondary_legacy_token
<!-- 公共前端 check 必须独立解析同一登记，阻断未登记源码、错误 API、缺失主题令牌和错误资源顺序。 -->
selplat_component_build_gate = shared_frontend_sel_ui_verifySelUiSourceBoundary
<!-- selplat_component_build_gate.2 的当前独立事实为 one_registry_same_policy。 -->
selplat_component_build_gate.2 = one_registry_same_policy
<!-- 快速门禁和公共构建同时验证 selTooltip 关键生命周期、Grid/Tree 消费、纯图标记录操作、原生 title 清零和依赖资源顺序。 -->
selplat_tooltip_gate = tooltip_contract
<!-- selplat_tooltip_gate.2 的当前独立事实为 grid_tree_consumers。 -->
selplat_tooltip_gate.2 = grid_tree_consumers
<!-- selplat_tooltip_gate.3 的当前独立事实为 grid_record_action_tooltip_and_dynamic_state_semantics。 -->
selplat_tooltip_gate.3 = grid_record_action_tooltip_and_dynamic_state_semantics
<!-- selplat_tooltip_gate.4 的当前独立事实为 zero_native_title。 -->
selplat_tooltip_gate.4 = zero_native_title
<!-- selplat_tooltip_gate.5 的当前独立事实为 registry_dependency_resource_order。 -->
selplat_tooltip_gate.5 = registry_dependency_resource_order
<!-- 快速门禁扫描全部应用装配层，阻断以 selWindow 承载删除确认，并由 reference-data 回归验证首个修复调用方。 -->
selplat_destructive_confirmation_gate = application_scan_zero_delete_selWindow
<!-- selplat_destructive_confirmation_gate.2 的当前独立事实为 reference_data_uses_selConfirmDialog。 -->
selplat_destructive_confirmation_gate.2 = reference_data_uses_selConfirmDialog
<!-- selplat_destructive_confirmation_gate.3 的当前独立事实为 explicit_boolean_result_before_delete。 -->
selplat_destructive_confirmation_gate.3 = explicit_boolean_result_before_delete
<!-- selplat_destructive_confirmation_gate.4 的当前独立事实为 zero_misleading_database_block_copy。 -->
selplat_destructive_confirmation_gate.4 = zero_misleading_database_block_copy
<!-- 快速门禁和公共构建必须同时验证 selPanel 工具栏缩放配置、分隔语义、双击复位和 MDA 首个调用方。 -->
selplat_toolbar_column_resize_gate = panel_contract
<!-- selplat_toolbar_column_resize_gate.2 的当前独立事实为 default_enabled。 -->
selplat_toolbar_column_resize_gate.2 = default_enabled
<!-- selplat_toolbar_column_resize_gate.3 的当前独立事实为 explicit_disable。 -->
selplat_toolbar_column_resize_gate.3 = explicit_disable
<!-- selplat_toolbar_column_resize_gate.4 的当前独立事实为 keyboard_and_pointer。 -->
selplat_toolbar_column_resize_gate.4 = keyboard_and_pointer
<!-- selplat_toolbar_column_resize_gate.5 的当前独立事实为 double_click_reset。 -->
selplat_toolbar_column_resize_gate.5 = double_click_reset
<!-- selplat_toolbar_column_resize_gate.6 的当前独立事实为 mda_consumer。 -->
selplat_toolbar_column_resize_gate.6 = mda_consumer
<!-- 公共前端构建必须验证 Grid 分类值归一化以及 type、tree type、typeGroup 三条成员匹配路径。 -->
selplat_grid_multi_value_type_gate = normalize_scalar_and_array
<!-- selplat_grid_multi_value_type_gate.2 的当前独立事实为 toolbar_membership。 -->
selplat_grid_multi_value_type_gate.2 = toolbar_membership
<!-- selplat_grid_multi_value_type_gate.3 的当前独立事实为 tree_membership。 -->
selplat_grid_multi_value_type_gate.3 = tree_membership
<!-- selplat_grid_multi_value_type_gate.4 的当前独立事实为 type_group_any_membership。 -->
selplat_grid_multi_value_type_gate.4 = type_group_any_membership
<!-- 快速门禁必须阻断第一列表头分隔线被排除或最后列表头残留无意义竖线。 -->
selplat_grid_header_separator_gate = required_not_last_child_selector
<!-- selplat_grid_header_separator_gate.2 的当前独立事实为 forbidden_not_first_child_selector。 -->
selplat_grid_header_separator_gate.2 = forbidden_not_first_child_selector
<!-- selplat_grid_header_separator_gate.3 的当前独立事实为 real_grid_regression。 -->
selplat_grid_header_separator_gate.3 = real_grid_regression
<!-- 公共构建必须同时验证三态选择、兼容默认值、records 选择渲染、公开事件与状态 API。 -->
selplat_grid_row_selection_gate = three_modes
<!-- selplat_grid_row_selection_gate.2 的当前独立事实为 compatibility_defaults。 -->
selplat_grid_row_selection_gate.2 = compatibility_defaults
<!-- selplat_grid_row_selection_gate.3 的当前独立事实为 records_selection_renderer。 -->
selplat_grid_row_selection_gate.3 = records_selection_renderer
<!-- selplat_grid_row_selection_gate.4 的当前独立事实为 aria_selected。 -->
selplat_grid_row_selection_gate.4 = aria_selected
<!-- selplat_grid_row_selection_gate.5 的当前独立事实为 public_event_and_state_api。 -->
selplat_grid_row_selection_gate.5 = public_event_and_state_api
<!-- 业务表格中的逐项答案或同类单选必须使用公共 choice renderer，由 optionValue、selectedField 和 action 配置驱动。 -->
selplat_grid_record_choice_renderer = role_radio
<!-- selplat_grid_record_choice_renderer.2 的当前独立事实为 optionValue。 -->
selplat_grid_record_choice_renderer.2 = optionValue
<!-- selplat_grid_record_choice_renderer.3 的当前独立事实为 selectedField。 -->
selplat_grid_record_choice_renderer.3 = selectedField
<!-- selplat_grid_record_choice_renderer.4 的当前独立事实为 selectedTone。 -->
selplat_grid_record_choice_renderer.4 = selectedTone
<!-- selplat_grid_record_choice_renderer.5 的当前独立事实为 aria_checked。 -->
selplat_grid_record_choice_renderer.5 = aria_checked
<!-- selplat_grid_record_choice_renderer.6 的当前独立事实为 visible_unselected_indicator。 -->
selplat_grid_record_choice_renderer.6 = visible_unselected_indicator
<!-- selplat_grid_record_choice_renderer.7 的当前独立事实为 lock_after_selection_default。 -->
selplat_grid_record_choice_renderer.7 = lock_after_selection_default
<!-- selplat_grid_record_choice_renderer.8 的当前独立事实为 optional_repeat_selection。 -->
selplat_grid_record_choice_renderer.8 = optional_repeat_selection
<!-- selplat_grid_record_choice_renderer.9 的当前独立事实为 public_action_event。 -->
selplat_grid_record_choice_renderer.9 = public_action_event
<!-- selplat_grid_record_choice_renderer.10 的当前独立事实为 semantic_success_or_danger。 -->
selplat_grid_record_choice_renderer.10 = semantic_success_or_danger
<!-- selplat_grid_record_choice_renderer.11 的当前独立事实为 theme_tokens_only。 -->
selplat_grid_record_choice_renderer.11 = theme_tokens_only
<!-- Badge 图标允许由记录动态计算；返回空值时必须保持纯文本，不生成空图标占位。 -->
selplat_grid_record_badge_dynamic_icon = static_or_record_function
<!-- selplat_grid_record_badge_dynamic_icon.2 的当前独立事实为 empty_icon_no_dom。 -->
selplat_grid_record_badge_dynamic_icon.2 = empty_icon_no_dom
<!-- selplat_grid_record_badge_dynamic_icon.3 的当前独立事实为 nonzero_semantic_icon_supported。 -->
selplat_grid_record_badge_dynamic_icon.3 = nonzero_semantic_icon_supported
<!-- selplat_grid_record_badge_dynamic_icon.4 的当前独立事实为 theme_tokens_only。 -->
selplat_grid_record_badge_dynamic_icon.4 = theme_tokens_only
<!-- 动态模块调用方回归必须覆盖字段契约切换、旧筛选清理和窗口选择默认项复位。 -->
selplat_runtime_contract_and_form_default_verification = grid_module_contract_switch
<!-- selplat_runtime_contract_and_form_default_verification.2 的当前独立事实为 filter_reset。 -->
selplat_runtime_contract_and_form_default_verification.2 = filter_reset
<!-- selplat_runtime_contract_and_form_default_verification.3 的当前独立事实为 window_select_default_after_reset。 -->
selplat_runtime_contract_and_form_default_verification.3 = window_select_default_after_reset
<!-- 页面编辑公共回归必须覆盖纯开关、控件级保存、导航无拦截、表格宽度回读和各 Window 独立几何持久化。 -->
selplat_page_editor_verification = non_admin_hidden
<!-- selplat_page_editor_verification.2 的当前独立事实为 admin_service_recheck。 -->
selplat_page_editor_verification.2 = admin_service_recheck
<!-- selplat_page_editor_verification.3 的当前独立事实为 single_switch_only。 -->
selplat_page_editor_verification.3 = single_switch_only
<!-- selplat_page_editor_verification.4 的当前独立事实为 no_panel_control_cards_or_global_actions。 -->
selplat_page_editor_verification.4 = no_panel_control_cards_or_global_actions
<!-- selplat_page_editor_verification.5 的当前独立事实为 grid_heading_hidden_off_visible_on。 -->
selplat_page_editor_verification.5 = grid_heading_hidden_off_visible_on
<!-- selplat_page_editor_verification.6 的当前独立事实为 window_heading_hidden_off_visible_on。 -->
selplat_page_editor_verification.6 = window_heading_hidden_off_visible_on
<!-- selplat_page_editor_verification.7 的当前独立事实为 one_window_one_record。 -->
selplat_page_editor_verification.7 = one_window_one_record
<!-- selplat_page_editor_verification.8 的当前独立事实为 heading_title_code_and_adjacent_accent_save_action。 -->
selplat_page_editor_verification.8 = heading_title_code_and_adjacent_accent_save_action
<!-- selplat_page_editor_verification.9 的当前独立事实为 independent_uniform_editor_frame。 -->
selplat_page_editor_verification.9 = independent_uniform_editor_frame
<!-- selplat_page_editor_verification.10 的当前独立事实为 real_right_edge_handle_hover_and_drag。 -->
selplat_page_editor_verification.10 = real_right_edge_handle_hover_and_drag
<!-- selplat_page_editor_verification.11 的当前独立事实为 all_visible_toolbar_controls_registered。 -->
selplat_page_editor_verification.11 = all_visible_toolbar_controls_registered
<!-- selplat_page_editor_verification.12 的当前独立事实为 query_reset_dropdown_and_business_action_same_contract。 -->
selplat_page_editor_verification.12 = query_reset_dropdown_and_business_action_same_contract
<!-- selplat_page_editor_verification.13 的当前独立事实为 composite_business_action_root_single_frame。 -->
selplat_page_editor_verification.13 = composite_business_action_root_single_frame
<!-- selplat_page_editor_verification.14 的当前独立事实为 composite_ordered_sibling_reflow_horizontal_group_move_and_one_following_shared_save。 -->
selplat_page_editor_verification.14 = composite_ordered_sibling_reflow_horizontal_group_move_and_one_following_shared_save
<!-- selplat_page_editor_verification.15 的当前独立事实为 terminal_resize_event。 -->
selplat_page_editor_verification.15 = terminal_resize_event
<!-- selplat_page_editor_verification.16 的当前独立事实为 per_control_single_record_save。 -->
selplat_page_editor_verification.16 = per_control_single_record_save
<!-- selplat_page_editor_verification.17 的当前独立事实为 navigation_unblocked。 -->
selplat_page_editor_verification.17 = navigation_unblocked
<!-- selplat_page_editor_verification.18 的当前独立事实为 reload_persisted_width_and_window_geometry。 -->
selplat_page_editor_verification.18 = reload_persisted_width_and_window_geometry
<!-- 引用型下拉回归必须覆盖筛选器不登记、绑定坐标唯一、绑定启停边界、按绑定查询真实选项和选项树保持叶子。 -->
selplat_reference_dropdown_binding_verification = controlCode_real_and_unique
<!-- selplat_reference_dropdown_binding_verification.2 的当前独立事实为 parentKind_WINDOW_rejected_and_absent。 -->
selplat_reference_dropdown_binding_verification.2 = parentKind_WINDOW_rejected_and_absent
<!-- selplat_reference_dropdown_binding_verification.3 的当前独立事实为 optionSetCode_reusable。 -->
selplat_reference_dropdown_binding_verification.3 = optionSetCode_reusable
<!-- selplat_reference_dropdown_binding_verification.4 的当前独立事实为 disabled_binding_rejected。 -->
selplat_reference_dropdown_binding_verification.4 = disabled_binding_rejected
<!-- selplat_reference_dropdown_binding_verification.5 的当前独立事实为 value_unique_per_tenant_option_set。 -->
selplat_reference_dropdown_binding_verification.5 = value_unique_per_tenant_option_set
<!-- selplat_reference_dropdown_binding_verification.6 的当前独立事实为 parent_same_option_set。 -->
selplat_reference_dropdown_binding_verification.6 = parent_same_option_set
<!-- selplat_reference_dropdown_binding_verification.7 的当前独立事实为 no_parent_cycle。 -->
selplat_reference_dropdown_binding_verification.7 = no_parent_cycle
<!-- selplat_reference_dropdown_binding_verification.8 的当前独立事实为 two_level_menu_query。 -->
selplat_reference_dropdown_binding_verification.8 = two_level_menu_query
<!-- selplat_reference_dropdown_binding_verification.9 的当前独立事实为 tree_node_independent。 -->
selplat_reference_dropdown_binding_verification.9 = tree_node_independent
<!-- 公共控件交付回归同时检查 hidden 退出布局、树叶子非交互占位和 1380 宽度内标题动作不相撞。 -->
selplat_layout_and_accessibility_verification = hidden_panel_display_none
<!-- selplat_layout_and_accessibility_verification.2 的当前独立事实为 tree_leaf_no_unnamed_button。 -->
selplat_layout_and_accessibility_verification.2 = tree_leaf_no_unnamed_button
<!-- selplat_layout_and_accessibility_verification.3 的当前独立事实为 compact_header_action_labels_collapsed_before_overlap。 -->
selplat_layout_and_accessibility_verification.3 = compact_header_action_labels_collapsed_before_overlap
<!-- 应用装配回归必须断言所有显式 SEL 实例 ID 符合统一命名，并阻断 Managent 等错误英文拼写。 -->
selplat_component_instance_id_verification = all_explicit_sel_instance_ids_match_naming
<!-- selplat_component_instance_id_verification.2 的当前独立事实为 zero_known_business_spelling_errors。 -->
selplat_component_instance_id_verification.2 = zero_known_business_spelling_errors
<!-- 快速门禁扫描全部应用 JavaScript，任何直接原生节点创建都必须在交付前迁移到 sel.core.element。 -->
selplat_application_dom_creation_gate = all_application_javascript_zero_direct_native_create_element
<!-- selplat_application_dom_creation_gate.2 的当前独立事实为 public_element_positive_and_negative_regression。 -->
selplat_application_dom_creation_gate.2 = public_element_positive_and_negative_regression
<!-- 控件迁移至少验证旧选择器和平铺 API 清零、内核加载顺序、新公共 API、应用装配测试及真实浏览器交互与控制台。 -->
selplat_component_migration_verification = no_legacy_selector
<!-- selplat_component_migration_verification.2 的当前独立事实为 no_flat_sel_api。 -->
selplat_component_migration_verification.2 = no_flat_sel_api
<!-- selplat_component_migration_verification.3 的当前独立事实为 kernel_first。 -->
selplat_component_migration_verification.3 = kernel_first
<!-- selplat_component_migration_verification.4 的当前独立事实为 registered_api_call。 -->
selplat_component_migration_verification.4 = registered_api_call
<!-- selplat_component_migration_verification.5 的当前独立事实为 application_tests。 -->
selplat_component_migration_verification.5 = application_tests
<!-- selplat_component_migration_verification.6 的当前独立事实为 real_browser_interaction_and_console。 -->
selplat_component_migration_verification.6 = real_browser_interaction_and_console
<!-- 登记结构和首个调用方是权威样例，不复制会与真实控件漂移的静态模板。 -->
template_not_applicable_reason = component_registry_and_first_consumer_are_the_authoritative_structure
<!-- 同一生产门禁同时覆盖全部控件，无需建立控件治理专用第二程序。 -->
program_not_applicable_reason = existing_source_ownership_guard_is_extended_as_the_single_quick_gate
