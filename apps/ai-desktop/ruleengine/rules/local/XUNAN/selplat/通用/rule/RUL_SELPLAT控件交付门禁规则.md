# SELPLAT 控件交付门禁规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 5.22.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 公共控件职责不建立 Java 能力入口。 -->
java_ability_refs = none
<!-- 公共控件职责由源码归属门禁提供可重复验证。 -->
python_ability_refs = apps/ai-desktop/ruleengine/python/local/<active-stable-user-id>/abilities/selplat_source_ownership_guard.py
<!-- 公共控件实现属于 shared 前端源码，不建立 rule-engine Node 能力。 -->
node_ability_refs = none

<!-- 公共控件快速门禁统一复用源码归属扫描器，并要求控件治理违规为零。 -->
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
