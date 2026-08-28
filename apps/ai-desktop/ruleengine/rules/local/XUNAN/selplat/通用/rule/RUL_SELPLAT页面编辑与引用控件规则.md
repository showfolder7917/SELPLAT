# SELPLAT 页面编辑与引用控件规则

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
