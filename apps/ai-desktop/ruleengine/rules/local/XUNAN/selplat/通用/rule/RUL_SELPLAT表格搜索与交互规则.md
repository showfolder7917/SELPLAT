# SELPLAT 表格、搜索与交互规则

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

<!-- 公共表格记录类型字段只接受标量或数组，并统一规范为非空字符串集合。 -->
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
