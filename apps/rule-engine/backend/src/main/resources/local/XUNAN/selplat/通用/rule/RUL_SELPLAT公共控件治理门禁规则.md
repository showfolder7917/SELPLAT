# SELPLAT 公共控件治理门禁规则

<!-- 本规则约束 SELPLAT 现有和未来全部原生前端控件，不依赖控件名称逐项追加规则。 -->
rule_scope = active_user_selplat_shared_ui_component_governance
<!-- 2.1.0 增加 hidden 布局优先级、树叶子占位语义、窄屏动作收起和页面编辑显式保存兜底。 -->
rule_version = 2.1.0
<!-- 2026-08-12 依次固定纯图标可发现性、确认控件边界、真实风险文案、页面编辑契约及客户交付审计发现的通用布局与可访问性要求。 -->
upgrade_record = 2026-08-12:纯图标表格操作统一使用selTooltip并按记录状态表达下一步动作;2026-08-12:删除等破坏性单步动作统一使用selConfirmDialog禁止selWindow;2026-08-12:删除确认文案必须展示真实关联数量并禁止虚构数据库阻断;2026-08-12:页面编辑统一由selPersonalization管理管理员权限_控件坐标_实时草稿_取消恢复_显式保存;2026-08-12:hidden控件必须退出布局_树叶子占位禁止空按钮_窄屏动作先收起文字_显式保存无脏标记也保存当前控件
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
selplat_component_creation_sequence = classify_reusable_interaction,register_public_component,implement_public_component,connect_first_consumer,verify
<!-- 门禁只负责阻断和报告缺少的控件，不得静默自动生成未经过登记的公共 API。 -->
selplat_component_gate_auto_creation_policy = block_and_report,no_silent_component_generation
<!-- 公共控件唯一登记位于 sel-ui 组件根，版本、策略和控件数组缺一不可。 -->
selplat_component_registry = shared/frontend/sel-ui/src/components/component-registry.json,version=1,one_authoritative_source
<!-- 每个公开单元必须登记稳定 ID、目录、类型、JS、CSS、公开 API、硬依赖和主题属性。 -->
selplat_component_registration_required_fields = id,directory,type,scripts,styles,globalApi,dependencies,themeAware
<!-- 新控件目录和顶层 JS/CSS 必须且只能属于一个登记单元，未登记与重复所有者均直接阻断。 -->
selplat_component_source_ownership_gate = every_directory_registered,every_top_level_js_css_exactly_one_owner,no_duplicate_owner

## 通用分类与应用边界

<!-- 自有开关状态、body 门户、键盘焦点生命周期、跨页面复用或完整 DOM/CSS/事件生命周期任一成立时必须按公共控件治理。 -->
selplat_reusable_control_classification = own_state|body_portal|keyboard_focus_lifecycle|multi_page_reuse|complete_dom_css_event_lifecycle
<!-- 应用只能提供宿主、数据、动作和回调，不得发布 window.sel<Component> 或自行创建 body 交互门户。 -->
selplat_application_component_boundary = host_data_action_callback_only,no_private_sel_global_api,no_private_body_portal
<!-- 已由公共控件登记拥有的 ARIA 交互角色不得在应用页面或其他控件中重复实现。 -->
selplat_component_owned_interaction_gate = registered_owned_aria_role_single_owner,no_application_reimplementation
<!-- 本轮启用新公共控件后直接删除旧私有 DOM、样式、定位和事件链，不保留兼容选择或降级分支。 -->
selplat_component_legacy_replacement_policy = enable_registered_component,delete_private_legacy_implementation,no_compatibility_branch

## 通用布局与可访问语义

<!-- 控件根声明原生 hidden 后必须完全退出布局；公共 display 规则不得覆盖浏览器隐藏语义，避免备用实例制造空白页和错误滚动。 -->
selplat_native_hidden_layout_contract = hidden_root_display_none,public_display_rule_must_not_override_hidden,no_inactive_instance_layout_space
<!-- 树的父节点展开符号使用具名按钮，叶子只使用 aria-hidden 的非交互对齐占位，禁止无名称 button 污染键盘和辅助技术控件树。 -->
selplat_tree_toggle_semantics = parent_named_button,leaf_noninteractive_aria_hidden_placeholder,no_unnamed_leaf_button
<!-- 常见窄屏下标题、状态和快捷动作不得重叠；动作文字空间不足时先收为保留可访问名称与提示的图标按钮。 -->
selplat_panel_compact_header_contract = no_title_status_action_overlap,compact_icon_actions_before_overlap,preserve_accessible_name_and_tip

## API、主题与依赖

<!-- 所有应用传给 SEL 公共控件的实例 ID 必须由 sel、控件类型、正确英文业务含义和 Id 组成，并使用 lowerCamelCase。 -->
selplat_component_instance_id_naming = sel<ControlType><BusinessMeaning>Id,lowerCamelCase,correct_english_business_spelling
<!-- 同一物理控件切换多个业务模块时使用一个物理实例 ID；模块自己的 gridId 只作为数据库表格头稳定坐标，禁止混用事件实例键。 -->
selplat_shared_physical_grid_and_business_grid_id_boundary = physical_grid_instance_id_for_event_routing,business_gridId_for_database_header_coordinate

<!-- 带脚本的控件必须发布与登记 ID 相同的全局 API；纯样式单元不得虚构空 API。 -->
selplat_component_public_api_gate = script_global_api_equals_registered_id,style_only_global_api_null
<!-- 主题感知样式必须消费 --sel-theme-* 令牌，应用不得复制控件边框、颜色和交互状态。 -->
selplat_component_theme_gate = themeAware_css_consumes_sel_theme_tokens,no_application_visual_reimplementation
<!-- 控件硬依赖必须指向已登记单元，源码必须真实调用依赖 API，应用与生成模板必须在当前控件前加载依赖 CSS/JS。 -->
selplat_component_dependency_gate = registered_target,no_self_dependency,real_public_api_call,dependency_resource_exists_and_precedes_consumer
<!-- 控件资源依赖检查从中央登记动态生成，新增控件不得再靠人工补一个名称专项扫描。 -->
selplat_component_future_extension_gate = registry_driven_directory_source_api_theme_dependency_and_application_scan

## Grid 多值分类筛选

<!-- Grid 的 typeField 同时接受单个分类和分类数组，公共层统一转成非空字符串集合，调用方不得复制筛选算法。 -->
selplat_grid_record_type_value_contract = scalar_or_array,normalize_to_non_empty_string_values,public_grid_owner
<!-- 工具栏 type、树节点 type 和 typeGroup 均按集合成员匹配；同一记录可同时出现在多个数据库分类中。 -->
selplat_grid_record_type_filter_semantics = toolbar_type_membership,tree_type_membership,tree_type_group_any_membership,multiple_categories_allowed
<!-- 原有标量调用方必须继续可用；无分类记录由应用通过明确占位分类表达，公共 Grid 不猜测业务上的未分类文案。 -->
selplat_grid_record_type_compatibility = preserve_scalar_consumers,application_explicit_unclassified_value,no_business_label_inference

## Grid 动态业务契约与 Window 默认项

<!-- 同一 selGrid 通过 setLocale 切换 records 业务模块时必须同步 grid.searchFields、typeField、statusField 等记录契约，禁止沿用旧模块字段。 -->
selplat_grid_runtime_record_contract_refresh = setLocale_updates_grid_record_options,no_stale_search_type_or_status_field
<!-- 应用切换独立业务模块时必须清理不再适用的搜索、分类、状态和树筛选；语言切换仍按控件原有契约保留状态。 -->
selplat_grid_business_module_filter_reset = application_module_switch_resets_incompatible_filters,locale_switch_preserves_state
<!-- selWindow 选择项的 selected 声明必须同时成为 form.reset 的 defaultSelected，新增窗口不得在 reset 后回到错误的第一项。 -->
selplat_window_select_default_reset_contract = selected_option_sets_defaultSelected,form_reset_restores_business_default

## 横向工具栏栏目缩放

<!-- 工具栏栏目宽度属于面板外层布局职责；搜索、下拉、日期和动作控件不得分别复制分隔线与指针事件。 -->
selplat_toolbar_column_resize_owner = selPanel,outer_layout_only,no_child_component_reimplementation
<!-- selPanel 横向工具栏栏目默认具备拖拽能力；调用方明确不需要时才允许整体或单栏关闭。 -->
selplat_toolbar_column_resize_default = enabled,toolbar.columnResize=false,columns.<key>.columnResize=false
<!-- 应用只通过 mount 的 toolbar 标准选项声明默认、最小和最大宽度，禁止选择公共内部类修改几何或自行绑定 pointer 事件。 -->
selplat_toolbar_column_resize_public_options = toolbar.columns.<key>.width|minWidth|maxWidth|label
<!-- 鼠标、触摸和键盘共享同一真实宽度状态；左右键逐步调整、Home/End 到边界、双击恢复声明默认值。 -->
selplat_toolbar_column_resize_interaction = pointer_drag,arrow_keys,home_end,double_click_reset,aria_separator
<!-- 高频指针移动必须合并到绘制帧，结束、取消、失焦和捕获丢失都要清理全页光标与临时监听器。 -->
selplat_toolbar_column_resize_lifecycle = request_animation_frame,finish_cancel_blur_lost_capture_cleanup,no_persistent_window_drag_listener

## 统一语义文字

<!-- 全部公共控件和应用消费控件时只允许使用七级可读文字角色；业务含义是新增页面不再退回只有大中小三档、层级无法表达的字号体系。 -->
selplat_semantic_typography_roles = display,title,heading,body,label,caption,micro
<!-- 七级字号必须配套统一 regular、medium、semibold、bold 字重及角色行高；业务含义是相同角色跨控件保持可读密度和视觉重量。 -->
selplat_semantic_typography_metrics = font_size,font_weight,line_height
<!-- primary 与 secondary 旧字号令牌已删除且禁止兼容；业务含义是新旧名称不会并存造成不同控件继续走不同体系。 -->
selplat_legacy_typography_token_policy = forbid(--sel-theme-font-size-primary,--sel-theme-font-size-secondary),no_compatibility_alias
<!-- 可读文字禁止直接写像素字号，图标、头像、复选框及其他几何图形尺寸除外；业务含义是主题缩放只改变文字，不破坏控件图形比例。 -->
selplat_component_text_size_boundary = readable_text_uses_semantic_tokens,icon_avatar_checkbox_geometry_may_use_fixed_size
<!-- 公共树按通用节点类型表达层级，调用方也可显式覆盖；未知类型回落 label，禁止按应用名推测。 -->
selplat_tree_typography_mapping = database|catalog:heading,schema:body,table|view:label,field|column:caption,unknown:label,explicit:typographyRole

## 统一截断文字提示

<!-- 截断文字提示由登记的 selTooltip 独占门户、role=tooltip、定位、延时和可访问关联，Grid、Tree 或应用不得复制实现。 -->
selplat_truncated_text_tooltip_owner = selTooltip,one_body_portal,owned_role_tooltip,no_private_reimplementation
<!-- Grid 与 Tree 默认接入统一提示，只在真实 overflow 时展示完整文字；鼠标、键盘、滚动、缩放和 Escape 生命周期必须一致。 -->
selplat_truncated_text_tooltip_behavior = grid_and_tree_default_enabled,real_overflow_only,pointer_and_focus,hide_on_scroll_resize_escape
<!-- 调用方只有明确不需要提示时才可通过 grid.tooltip=false 或 tree.tooltip=false 关闭，禁止建立相反的默认关闭配置。 -->
selplat_truncated_text_tooltip_disable_api = grid.tooltip=false,tree.tooltip=false,default_enabled
<!-- Grid 与 Tree 的截断文字不得使用浏览器原生 title；启用 selTooltip 后必须删除旧 title 路径且不保留兼容分支。 -->
selplat_truncated_text_native_title_policy = forbidden_in_grid_and_tree,delete_legacy_title,no_compatibility_branch

## Grid 纯图标记录操作提示

<!-- 表格记录操作只显示图标时，鼠标与键盘用户都必须获得同一动作说明；统一复用 selTooltip 的 always 模式并同步 aria-label，禁止退回原生 title。 -->
selplat_grid_icon_action_tooltip_contract = icon_only_record_action_requires_selTooltip_always,aria_label_matches_tooltip,no_native_title
<!-- 启停类记录操作的图标和 Tip 必须描述点击后将执行的动作；已启用记录显示停用，已停用记录显示启用，禁止用当前状态冒充动作。 -->
selplat_grid_state_action_semantics = label_and_icon_describe_next_action,enabled_record_shows_disable,disabled_record_shows_enable

## 破坏性动作确认

<!-- 删除等只需要一次布尔选择的破坏性动作必须使用紧凑 selConfirmDialog；selWindow 只承载表单或完整业务流程，禁止用空白大窗口模拟确认框。 -->
selplat_destructive_action_confirmation_component = selConfirmDialog,compact_boolean_confirmation,no_selWindow
<!-- 危险确认必须在用户明确确认后才调用业务删除；取消、关闭和 Escape 均返回 false，初始焦点停在取消按钮以避免回车误删。 -->
selplat_destructive_confirmation_safety = execute_after_true_only,cancel_close_escape_return_false,default_focus_cancel
<!-- 确认文案必须依据当前数据动态展示真实关联数量，并准确区分逻辑停用、物理删除与级联影响；没有后端检查时禁止声称数据库会自动阻止。 -->
selplat_destructive_confirmation_truthful_copy = current_relation_count,actual_soft_or_physical_delete_semantics,no_unimplemented_database_block_claim

## 管理员页面编辑

<!-- 页面编辑模式由 selPersonalization 统一拥有，应用只登记控件根、可见名称、数据库坐标和状态适配器，禁止每页复制编辑开关与保存栏。 -->
selplat_page_editor_owner = selPersonalization,application_registers_root_title_coordinates_capture_restore_save_only,no_private_editor_shell
<!-- 页面编辑入口只在后台明确返回 canEditPage=true 时显示；保存接口必须再次调用 BaseServiceImpl.isAdmin，禁止以前端隐藏作为权限边界。 -->
selplat_page_editor_authorization = backend_capability_controls_visibility,service_isAdmin_rechecks_every_save,no_frontend_only_authorization
<!-- 页面编辑使用预览与编辑左右双态；进入编辑建立基线，变更实时预览并标记脏状态，取消恢复基线，保存成功才进入新基线。 -->
selplat_page_editor_session_lifecycle = preview_edit_segmented_mode,capture_baseline,live_draft,dirty_indicator,cancel_restore,explicit_save_then_new_baseline
<!-- 用户明确点击保存时必须至少更新当前选中控件；即使拖拽发生在进入编辑模式之前、当前没有脏标记，也不得以“无更改”跳过持久化。 -->
selplat_page_editor_explicit_save_fallback = save_dirty_controls_or_current_selected_control,capture_current_state_when_not_dirty,no_skip_after_pre_edit_drag
<!-- 编辑模式打开后才在已登记控件旁显示统一编辑入口；预览模式必须移除角标和编辑轮廓，保持业务页面干净。 -->
selplat_page_editor_affordance_visibility = registered_control_badge_in_edit_mode_only,preview_mode_clean
<!-- 每个控件必须直观显示足以定位其真实配置记录的稳定坐标；表格使用 tableName+gridId，具体列持久化再增加 gridColumnId。 -->
selplat_page_editor_coordinate_contract = control_specific_stable_database_coordinate,grid_tableName_plus_gridId,column_adds_gridColumnId
<!-- Grid 拖动过程只更新内存预览，结束时发布一次终值；显式保存批量更新宽度并重新调用业务 getGridColumn，禁止移动期间逐次写库。 -->
selplat_grid_page_editor_persistence = live_memory_resize,one_terminal_change_event,batch_save_widths,write_then_business_getGridColumn_refresh,no_request_per_pointermove
<!-- 菜单、树、下拉和数据类型以后通过同一页面编辑注册 API 增加适配器，但仍使用各自业务表和 Service，禁止合并为不可治理的通用 JSON 表。 -->
selplat_page_editor_extension_boundary = shared_editor_session_per_control_adapter,menu_tree_dropdown_data_type_keep_business_table_and_service,no_monolithic_json_table

## 验证

<!-- 快速门禁执行登记、源码归属、应用私造和生成模板依赖检查，不启动浏览器或业务数据库。 -->
selplat_component_quick_gate = selplat_source_ownership_guard,zero_component_governance_violations
<!-- 快速门禁同步检查七级令牌完整性、树层级选择器和旧字号令牌清零。 -->
selplat_component_typography_quick_gate = seven_roles,weight_and_line_height_metrics,tree_role_mapping,zero_primary_secondary_legacy_token
<!-- 公共前端 check 必须独立解析同一登记，阻断未登记源码、错误 API、缺失主题令牌和错误资源顺序。 -->
selplat_component_build_gate = shared_frontend_sel_ui_verifySelUiSourceBoundary,one_registry_same_policy
<!-- 快速门禁和公共构建同时验证 selTooltip 关键生命周期、Grid/Tree 消费、纯图标记录操作、原生 title 清零和依赖资源顺序。 -->
selplat_tooltip_gate = tooltip_contract,grid_tree_consumers,grid_record_action_tooltip_and_dynamic_state_semantics,zero_native_title,registry_dependency_resource_order
<!-- 快速门禁扫描全部应用装配层，阻断以 selWindow 承载删除确认，并由 reference-data 回归验证首个修复调用方。 -->
selplat_destructive_confirmation_gate = application_scan_zero_delete_selWindow,reference_data_uses_selConfirmDialog,explicit_boolean_result_before_delete,zero_misleading_database_block_copy
<!-- 快速门禁和公共构建必须同时验证 selPanel 工具栏缩放配置、分隔语义、双击复位和 MDA 首个调用方。 -->
selplat_toolbar_column_resize_gate = panel_contract,default_enabled,explicit_disable,keyboard_and_pointer,double_click_reset,mda_consumer
<!-- 公共前端构建必须验证 Grid 分类值归一化以及 type、tree type、typeGroup 三条成员匹配路径。 -->
selplat_grid_multi_value_type_gate = normalize_scalar_and_array,toolbar_membership,tree_membership,type_group_any_membership
<!-- 动态模块调用方回归必须覆盖字段契约切换、旧筛选清理和窗口选择默认项复位。 -->
selplat_runtime_contract_and_form_default_verification = grid_module_contract_switch,filter_reset,window_select_default_after_reset
<!-- 页面编辑公共回归必须覆盖非管理员隐藏、管理员后台二次校验、坐标可见、拖拽终值事件、取消恢复、批量保存和重新读取宽度。 -->
selplat_page_editor_verification = non_admin_hidden,admin_service_recheck,visible_coordinates,terminal_resize_event,cancel_restore,batch_save,explicit_save_current_control_without_dirty_marker,reload_persisted_width
<!-- 公共控件交付回归同时检查 hidden 退出布局、树叶子非交互占位和 1380 宽度内标题动作不相撞。 -->
selplat_layout_and_accessibility_verification = hidden_panel_display_none,tree_leaf_no_unnamed_button,compact_header_action_labels_collapsed_before_overlap
<!-- 应用装配回归必须断言所有显式 SEL 实例 ID 符合统一命名，并阻断 Managent 等错误英文拼写。 -->
selplat_component_instance_id_verification = all_explicit_sel_instance_ids_match_naming,zero_known_business_spelling_errors
<!-- 控件迁移至少验证旧选择器清零、新公共 API 调用、应用装配测试和真实浏览器交互与控制台。 -->
selplat_component_migration_verification = no_legacy_selector,registered_api_call,application_tests,real_browser_interaction_and_console
<!-- 登记结构和首个调用方是权威样例，不复制会与真实控件漂移的静态模板。 -->
template_not_applicable_reason = component_registry_and_first_consumer_are_the_authoritative_structure
<!-- 同一生产门禁同时覆盖全部控件，无需建立控件治理专用第二程序。 -->
program_not_applicable_reason = existing_source_ownership_guard_is_extended_as_the_single_quick_gate
