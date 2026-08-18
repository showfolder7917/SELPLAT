# 网页选择下拉控件设计规则

<!-- 问题：原生 select 的展开样式受浏览器和操作系统控制，无法稳定呈现产品视觉，也难以统一图标、描述、滚动阈值、选中状态和键盘反馈。 -->
<!-- 场景：网页工具栏、筛选区、表单和分页中的单选下拉控件；不适用于执行命令的 action menu 或存在 children 的层级菜单。 -->
<!-- 业务含义：选择下拉以原生 select 作为真实业务值，以独立组件呈现可控视觉和交互，并通过原生 change 事件继续兼容宿主业务。 -->

<!-- web_select_dropdown_scope 的当前独立事实为 toolbar_filter。 -->
web_select_dropdown_scope = toolbar_filter
<!-- web_select_dropdown_scope.2 的当前独立事实为 form_select。 -->
web_select_dropdown_scope.2 = form_select
<!-- web_select_dropdown_scope.3 的当前独立事实为 pagination_size。 -->
web_select_dropdown_scope.3 = pagination_size
<!-- web_select_dropdown_scope.4 的当前独立事实为 single_choice_combobox。 -->
web_select_dropdown_scope.4 = single_choice_combobox
<!-- web_select_dropdown_excludes 的当前独立事实为 action_menu。 -->
web_select_dropdown_excludes = action_menu
<!-- web_select_dropdown_excludes.2 的当前独立事实为 context_menu。 -->
web_select_dropdown_excludes.2 = context_menu
<!-- web_select_dropdown_excludes.3 的当前独立事实为 nested_command_menu。 -->
web_select_dropdown_excludes.3 = nested_command_menu
<!-- web_select_dropdown_must_follow_current_product_design_system 的当前独立事实为 true。 -->
web_select_dropdown_must_follow_current_product_design_system = true

## 组件分层与数据契约

<!-- 可复用选择下拉必须使用独立 JS/CSS；宿主只维护选项数据、当前值和 change 结果，禁止了解浮层内部 DOM。 -->
web_select_dropdown_logic_must_use_independent_module = true
<!-- web_select_dropdown_style_must_use_independent_stylesheet 的当前独立事实为 true。 -->
web_select_dropdown_style_must_use_independent_stylesheet = true
<!-- web_select_dropdown_host_responsibility 的当前独立事实为 provide_native_select。 -->
web_select_dropdown_host_responsibility = provide_native_select
<!-- web_select_dropdown_host_responsibility.2 的当前独立事实为 consume_change。 -->
web_select_dropdown_host_responsibility.2 = consume_change
<!-- web_select_dropdown_host_responsibility.3 的当前独立事实为 sync_external_value。 -->
web_select_dropdown_host_responsibility.3 = sync_external_value
<!-- web_select_dropdown_component_responsibility 的当前独立事实为 render_trigger。 -->
web_select_dropdown_component_responsibility = render_trigger
<!-- web_select_dropdown_component_responsibility.2 的当前独立事实为 render_listbox。 -->
web_select_dropdown_component_responsibility.2 = render_listbox
<!-- web_select_dropdown_component_responsibility.3 的当前独立事实为 manage_open_close。 -->
web_select_dropdown_component_responsibility.3 = manage_open_close
<!-- web_select_dropdown_component_responsibility.4 的当前独立事实为 manage_keyboard。 -->
web_select_dropdown_component_responsibility.4 = manage_keyboard
<!-- web_select_dropdown_component_responsibility.5 的当前独立事实为 manage_scroll。 -->
web_select_dropdown_component_responsibility.5 = manage_scroll
<!-- web_select_dropdown_component_responsibility.6 的当前独立事实为 sync_native_select。 -->
web_select_dropdown_component_responsibility.6 = sync_native_select
<!-- web_select_dropdown_host_must_not_mutate_internal_dom 的当前独立事实为 true。 -->
web_select_dropdown_host_must_not_mutate_internal_dom = true

<!-- 原生 select 保留为唯一真实值和 change 契约；自定义触发器不得复制出第二套不可同步状态。 -->
web_select_dropdown_value_source = native_select
<!-- web_select_dropdown_selection_event 的当前独立事实为 native_change。 -->
web_select_dropdown_selection_event = native_change
<!-- web_select_dropdown_external_sync_api 的当前独立事实为 set_value。 -->
web_select_dropdown_external_sync_api = set_value
<!-- web_select_dropdown_external_sync_api.2 的当前独立事实为 refresh。 -->
web_select_dropdown_external_sync_api.2 = refresh
<!-- web_select_dropdown_duplicate_business_state_is_forbidden 的当前独立事实为 true。 -->
web_select_dropdown_duplicate_business_state_is_forbidden = true

<!-- 选项可通过 option 的 data 字段人工增加图标、菜单名称、说明和主题色，增删排序不得修改组件事件分支。 -->
web_select_dropdown_required_option_fields = value
<!-- web_select_dropdown_required_option_fields.2 的当前独立事实为 label。 -->
web_select_dropdown_required_option_fields.2 = label
<!-- web_select_dropdown_optional_option_fields 的当前独立事实为 icon。 -->
web_select_dropdown_optional_option_fields = icon
<!-- web_select_dropdown_optional_option_fields.2 的当前独立事实为 menu_label。 -->
web_select_dropdown_optional_option_fields.2 = menu_label
<!-- web_select_dropdown_optional_option_fields.3 的当前独立事实为 description。 -->
web_select_dropdown_optional_option_fields.3 = description
<!-- web_select_dropdown_optional_option_fields.4 的当前独立事实为 tone。 -->
web_select_dropdown_optional_option_fields.4 = tone
<!-- web_select_dropdown_optional_option_fields.5 的当前独立事实为 disabled。 -->
web_select_dropdown_optional_option_fields.5 = disabled
<!-- web_select_dropdown_manual_item_add_remove_reorder_must_only_change 的当前独立事实为 native_option_configuration。 -->
web_select_dropdown_manual_item_add_remove_reorder_must_only_change = native_option_configuration

## 视觉与容器稳定

<!-- 关闭触发器必须保持宿主原有高度、宽度和文字节奏；展开状态只能改变边框、光效和箭头，不得推动周围布局。 -->
web_select_dropdown_trigger_must_preserve_host_geometry = true
<!-- web_select_dropdown_open_state_must_not_reflow_host_layout 的当前独立事实为 true。 -->
web_select_dropdown_open_state_must_not_reflow_host_layout = true
<!-- web_select_dropdown_trigger_tracks 的当前独立事实为 optional_icon。 -->
web_select_dropdown_trigger_tracks = optional_icon
<!-- web_select_dropdown_trigger_tracks.2 的当前独立事实为 prefix。 -->
web_select_dropdown_trigger_tracks.2 = prefix
<!-- web_select_dropdown_trigger_tracks.3 的当前独立事实为 current_value。 -->
web_select_dropdown_trigger_tracks.3 = current_value
<!-- web_select_dropdown_trigger_tracks.4 的当前独立事实为 chevron。 -->
web_select_dropdown_trigger_tracks.4 = chevron

<!-- 工具栏筛选和表单选择必须使用同一默认视觉宿主；外层页面只分配宽度和对齐，不得为 Window、Dialog 或页面区域复制第二套字体、行高、边框素材、选项几何与状态色。 -->
web_select_dropdown_default_visual_hosts = toolbar_filter
<!-- web_select_dropdown_default_visual_hosts.2 的当前独立事实为 form_select。 -->
web_select_dropdown_default_visual_hosts.2 = form_select
<!-- web_select_dropdown_default_visual_hosts_must_share 的当前独立事实为 dom_structure。 -->
web_select_dropdown_default_visual_hosts_must_share = dom_structure
<!-- web_select_dropdown_default_visual_hosts_must_share.2 的当前独立事实为 trigger_typography。 -->
web_select_dropdown_default_visual_hosts_must_share.2 = trigger_typography
<!-- web_select_dropdown_default_visual_hosts_must_share.3 的当前独立事实为 trigger_height。 -->
web_select_dropdown_default_visual_hosts_must_share.3 = trigger_height
<!-- web_select_dropdown_default_visual_hosts_must_share.4 的当前独立事实为 trigger_padding。 -->
web_select_dropdown_default_visual_hosts_must_share.4 = trigger_padding
<!-- web_select_dropdown_default_visual_hosts_must_share.5 的当前独立事实为 trigger_radius。 -->
web_select_dropdown_default_visual_hosts_must_share.5 = trigger_radius
<!-- web_select_dropdown_default_visual_hosts_must_share.6 的当前独立事实为 popup_frame_asset。 -->
web_select_dropdown_default_visual_hosts_must_share.6 = popup_frame_asset
<!-- web_select_dropdown_default_visual_hosts_must_share.7 的当前独立事实为 option_height。 -->
web_select_dropdown_default_visual_hosts_must_share.7 = option_height
<!-- web_select_dropdown_default_visual_hosts_must_share.8 的当前独立事实为 state_tokens。 -->
web_select_dropdown_default_visual_hosts_must_share.8 = state_tokens
<!-- web_select_dropdown_default_visual_hosts_must_share.9 的当前独立事实为 interaction_logic。 -->
web_select_dropdown_default_visual_hosts_must_share.9 = interaction_logic
<!-- web_select_dropdown_default_host_specific_skin_is_forbidden 的当前独立事实为 true。 -->
web_select_dropdown_default_host_specific_skin_is_forbidden = true
<!-- web_select_dropdown_host_layout_may_control 的当前独立事实为 allocated_width。 -->
web_select_dropdown_host_layout_may_control = allocated_width
<!-- web_select_dropdown_host_layout_may_control.2 的当前独立事实为 alignment。 -->
web_select_dropdown_host_layout_may_control.2 = alignment
<!-- web_select_dropdown_host_layout_may_control.3 的当前独立事实为 placement_boundary。 -->
web_select_dropdown_host_layout_may_control.3 = placement_boundary

<!-- 分页条数允许使用紧凑触发器，但展开菜单和交互继续复用通用控件，禁止由紧凑宿主复制浮层。 -->
web_select_dropdown_compact_trigger_allowed_for = pagination_size
<!-- web_select_dropdown_compact_variant_must_preserve 的当前独立事实为 popup_frame_asset。 -->
web_select_dropdown_compact_variant_must_preserve = popup_frame_asset
<!-- web_select_dropdown_compact_variant_must_preserve.2 的当前独立事实为 option_typography。 -->
web_select_dropdown_compact_variant_must_preserve.2 = option_typography
<!-- web_select_dropdown_compact_variant_must_preserve.3 的当前独立事实为 option_height。 -->
web_select_dropdown_compact_variant_must_preserve.3 = option_height
<!-- web_select_dropdown_compact_variant_must_preserve.4 的当前独立事实为 state_tokens。 -->
web_select_dropdown_compact_variant_must_preserve.4 = state_tokens
<!-- web_select_dropdown_compact_variant_must_preserve.5 的当前独立事实为 interaction_logic。 -->
web_select_dropdown_compact_variant_must_preserve.5 = interaction_logic

<!-- 展开菜单使用绝对浮层并根据宿主位置选择向下或向上展开；浮层不得被后续面板区域或视口边缘裁切。 -->
web_select_dropdown_popup_position = absolute_overlay
<!-- web_select_dropdown_supported_placement 的当前独立事实为 bottom。 -->
web_select_dropdown_supported_placement = bottom
<!-- web_select_dropdown_supported_placement.2 的当前独立事实为 top。 -->
web_select_dropdown_supported_placement.2 = top
<!-- web_select_dropdown_popup_must_have_explicit_layer 的当前独立事实为 true。 -->
web_select_dropdown_popup_must_have_explicit_layer = true
<!-- web_select_dropdown_viewport_clipping_is_forbidden 的当前独立事实为 true。 -->
web_select_dropdown_viewport_clipping_is_forbidden = true

<!-- 项目行统一图标、主文字、可选说明和勾选轨道；当前选择、键盘活动和禁用状态不得改变行高。 -->
web_select_dropdown_option_tracks = icon
<!-- web_select_dropdown_option_tracks.2 的当前独立事实为 label_and_optional_description。 -->
web_select_dropdown_option_tracks.2 = label_and_optional_description
<!-- web_select_dropdown_option_tracks.3 的当前独立事实为 selected_check。 -->
web_select_dropdown_option_tracks.3 = selected_check
<!-- web_select_dropdown_option_height_must_be_consistent 的当前独立事实为 true。 -->
web_select_dropdown_option_height_must_be_consistent = true
<!-- web_select_dropdown_required_visual_states 的当前独立事实为 default。 -->
web_select_dropdown_required_visual_states = default
<!-- web_select_dropdown_required_visual_states.2 的当前独立事实为 hover。 -->
web_select_dropdown_required_visual_states.2 = hover
<!-- web_select_dropdown_required_visual_states.3 的当前独立事实为 focus_visible。 -->
web_select_dropdown_required_visual_states.3 = focus_visible
<!-- web_select_dropdown_required_visual_states.4 的当前独立事实为 active。 -->
web_select_dropdown_required_visual_states.4 = active
<!-- web_select_dropdown_required_visual_states.5 的当前独立事实为 selected。 -->
web_select_dropdown_required_visual_states.5 = selected
<!-- web_select_dropdown_required_visual_states.6 的当前独立事实为 disabled。 -->
web_select_dropdown_required_visual_states.6 = disabled
<!-- web_select_dropdown_state_change_must_not_change_geometry 的当前独立事实为 true。 -->
web_select_dropdown_state_change_must_not_change_geometry = true

<!-- 超过人工阈值后只滚动选项视口；滚动不得关闭当前下拉或改变外框尺寸。 -->
web_select_dropdown_scroll_threshold_must_be_configurable = true
<!-- web_select_dropdown_scroll_condition 的当前独立事实为 option_count > configured_scroll_threshold。 -->
web_select_dropdown_scroll_condition = option_count > configured_scroll_threshold
<!-- web_select_dropdown_scroll_height 的当前独立事实为 configured_scroll_threshold * consistent_option_height。 -->
web_select_dropdown_scroll_height = configured_scroll_threshold * consistent_option_height
<!-- web_select_dropdown_internal_scroll_must_not_close_popup 的当前独立事实为 true。 -->
web_select_dropdown_internal_scroll_must_not_close_popup = true
<!-- web_select_dropdown_scroll_must_not_resize_outer_frame 的当前独立事实为 true。 -->
web_select_dropdown_scroll_must_not_resize_outer_frame = true

<!-- 非标准图片边框必须使用九宫格或 border-image，文字和图标保持实时 DOM，禁止栅格化进背景。 -->
web_select_dropdown_decorative_frame = nine_slice_or_border_image
<!-- web_select_dropdown_live_text_and_icons_must_remain_dom 的当前独立事实为 true。 -->
web_select_dropdown_live_text_and_icons_must_remain_dom = true

## 交互与可访问性

<!-- 触发器使用 combobox 语义并控制 listbox；选项使用 option 语义，同步 aria-expanded 和 aria-selected。 -->
web_select_dropdown_trigger_semantics = native_button_with_combobox_role
<!-- web_select_dropdown_popup_semantics 的当前独立事实为 listbox。 -->
web_select_dropdown_popup_semantics = listbox
<!-- web_select_dropdown_item_semantics 的当前独立事实为 option。 -->
web_select_dropdown_item_semantics = option
<!-- web_select_dropdown_required_aria 的当前独立事实为 accessible_name。 -->
web_select_dropdown_required_aria = accessible_name
<!-- web_select_dropdown_required_aria.2 的当前独立事实为 aria_controls。 -->
web_select_dropdown_required_aria.2 = aria_controls
<!-- web_select_dropdown_required_aria.3 的当前独立事实为 aria_haspopup。 -->
web_select_dropdown_required_aria.3 = aria_haspopup
<!-- web_select_dropdown_required_aria.4 的当前独立事实为 aria_expanded。 -->
web_select_dropdown_required_aria.4 = aria_expanded
<!-- web_select_dropdown_required_aria.5 的当前独立事实为 aria_selected。 -->
web_select_dropdown_required_aria.5 = aria_selected

<!-- 键盘必须覆盖展开、方向移动、首尾、确认、退出和 Tab 离开；禁用项目必须跳过。 -->
web_select_dropdown_keyboard_open = Enter
<!-- web_select_dropdown_keyboard_open.2 的当前独立事实为 Space。 -->
web_select_dropdown_keyboard_open.2 = Space
<!-- web_select_dropdown_keyboard_open.3 的当前独立事实为 ArrowDown。 -->
web_select_dropdown_keyboard_open.3 = ArrowDown
<!-- web_select_dropdown_keyboard_open.4 的当前独立事实为 ArrowUp。 -->
web_select_dropdown_keyboard_open.4 = ArrowUp
<!-- web_select_dropdown_keyboard_navigation 的当前独立事实为 ArrowDown。 -->
web_select_dropdown_keyboard_navigation = ArrowDown
<!-- web_select_dropdown_keyboard_navigation.2 的当前独立事实为 ArrowUp。 -->
web_select_dropdown_keyboard_navigation.2 = ArrowUp
<!-- web_select_dropdown_keyboard_navigation.3 的当前独立事实为 Home。 -->
web_select_dropdown_keyboard_navigation.3 = Home
<!-- web_select_dropdown_keyboard_navigation.4 的当前独立事实为 End。 -->
web_select_dropdown_keyboard_navigation.4 = End
<!-- web_select_dropdown_keyboard_select 的当前独立事实为 Enter。 -->
web_select_dropdown_keyboard_select = Enter
<!-- web_select_dropdown_keyboard_select.2 的当前独立事实为 Space。 -->
web_select_dropdown_keyboard_select.2 = Space
<!-- web_select_dropdown_keyboard_close 的当前独立事实为 Escape。 -->
web_select_dropdown_keyboard_close = Escape
<!-- web_select_dropdown_keyboard_close.2 的当前独立事实为 Tab。 -->
web_select_dropdown_keyboard_close.2 = Tab
<!-- web_select_dropdown_keyboard_must_skip_disabled 的当前独立事实为 true。 -->
web_select_dropdown_keyboard_must_skip_disabled = true

<!-- 同一页面只允许一个选择下拉打开；选择完成、Escape、点击外部或外部滚动关闭，菜单内部滚动保持打开。 -->
web_select_dropdown_open_policy = single_open_instance
<!-- web_select_dropdown_close_behavior 的当前独立事实为 selection。 -->
web_select_dropdown_close_behavior = selection
<!-- web_select_dropdown_close_behavior.2 的当前独立事实为 escape。 -->
web_select_dropdown_close_behavior.2 = escape
<!-- web_select_dropdown_close_behavior.3 的当前独立事实为 outside_click。 -->
web_select_dropdown_close_behavior.3 = outside_click
<!-- web_select_dropdown_close_behavior.4 的当前独立事实为 external_scroll。 -->
web_select_dropdown_close_behavior.4 = external_scroll
<!-- web_select_dropdown_internal_scroll_behavior 的当前独立事实为 keep_open。 -->
web_select_dropdown_internal_scroll_behavior = keep_open

## 验证与交付

<!-- 真实浏览器验证覆盖鼠标、键盘、状态同步、滚动、方向和外部关闭；控制台不得存在错误。 -->
web_select_dropdown_required_browser_tests = open
<!-- web_select_dropdown_required_browser_tests.2 的当前独立事实为 reclick_close。 -->
web_select_dropdown_required_browser_tests.2 = reclick_close
<!-- web_select_dropdown_required_browser_tests.3 的当前独立事实为 mutual_exclusion。 -->
web_select_dropdown_required_browser_tests.3 = mutual_exclusion
<!-- web_select_dropdown_required_browser_tests.4 的当前独立事实为 select。 -->
web_select_dropdown_required_browser_tests.4 = select
<!-- web_select_dropdown_required_browser_tests.5 的当前独立事实为 external_value_sync。 -->
web_select_dropdown_required_browser_tests.5 = external_value_sync
<!-- web_select_dropdown_required_browser_tests.6 的当前独立事实为 keyboard_navigation。 -->
web_select_dropdown_required_browser_tests.6 = keyboard_navigation
<!-- web_select_dropdown_required_browser_tests.7 的当前独立事实为 escape。 -->
web_select_dropdown_required_browser_tests.7 = escape
<!-- web_select_dropdown_required_browser_tests.8 的当前独立事实为 outside_click。 -->
web_select_dropdown_required_browser_tests.8 = outside_click
<!-- web_select_dropdown_required_browser_tests.9 的当前独立事实为 scroll_threshold。 -->
web_select_dropdown_required_browser_tests.9 = scroll_threshold
<!-- web_select_dropdown_required_browser_tests.10 的当前独立事实为 top_placement。 -->
web_select_dropdown_required_browser_tests.10 = top_placement
<!-- web_select_dropdown_required_browser_tests.11 的当前独立事实为 compact_viewport。 -->
web_select_dropdown_required_browser_tests.11 = compact_viewport
<!-- web_select_dropdown_browser_console_must_have_no_error 的当前独立事实为 true。 -->
web_select_dropdown_browser_console_must_have_no_error = true

<!-- 视觉验收必须使用相同尺寸和相同业务状态比较关闭控件，并额外检查设计稿未提供的展开状态。 -->
web_select_dropdown_visual_qa_must_compare = same_viewport
<!-- web_select_dropdown_visual_qa_must_compare.2 的当前独立事实为 same_filter_state。 -->
web_select_dropdown_visual_qa_must_compare.2 = same_filter_state
<!-- web_select_dropdown_visual_qa_must_compare.3 的当前独立事实为 closed_state。 -->
web_select_dropdown_visual_qa_must_compare.3 = closed_state
<!-- web_select_dropdown_visual_qa_must_compare.4 的当前独立事实为 open_state。 -->
web_select_dropdown_visual_qa_must_compare.4 = open_state
<!-- web_select_dropdown_visual_qa_surfaces 的当前独立事实为 trigger_geometry。 -->
web_select_dropdown_visual_qa_surfaces = trigger_geometry
<!-- web_select_dropdown_visual_qa_surfaces.2 的当前独立事实为 popup_alignment。 -->
web_select_dropdown_visual_qa_surfaces.2 = popup_alignment
<!-- web_select_dropdown_visual_qa_surfaces.3 的当前独立事实为 typography。 -->
web_select_dropdown_visual_qa_surfaces.3 = typography
<!-- web_select_dropdown_visual_qa_surfaces.4 的当前独立事实为 icon_alignment。 -->
web_select_dropdown_visual_qa_surfaces.4 = icon_alignment
<!-- web_select_dropdown_visual_qa_surfaces.5 的当前独立事实为 description_rhythm。 -->
web_select_dropdown_visual_qa_surfaces.5 = description_rhythm
<!-- web_select_dropdown_visual_qa_surfaces.6 的当前独立事实为 selected_state。 -->
web_select_dropdown_visual_qa_surfaces.6 = selected_state
<!-- web_select_dropdown_visual_qa_surfaces.7 的当前独立事实为 frame_asset。 -->
web_select_dropdown_visual_qa_surfaces.7 = frame_asset
<!-- web_select_dropdown_visual_qa_surfaces.8 的当前独立事实为 scrollbar。 -->
web_select_dropdown_visual_qa_surfaces.8 = scrollbar
<!-- web_select_dropdown_visual_qa_surfaces.9 的当前独立事实为 layering。 -->
web_select_dropdown_visual_qa_surfaces.9 = layering
<!-- web_select_dropdown_visual_qa_must_fix_before_delivery 的当前独立事实为 p0。 -->
web_select_dropdown_visual_qa_must_fix_before_delivery = p0
<!-- web_select_dropdown_visual_qa_must_fix_before_delivery.2 的当前独立事实为 p1。 -->
web_select_dropdown_visual_qa_must_fix_before_delivery.2 = p1
<!-- web_select_dropdown_visual_qa_must_fix_before_delivery.3 的当前独立事实为 p2。 -->
web_select_dropdown_visual_qa_must_fix_before_delivery.3 = p2

<!-- java_ability_refs 的当前独立事实为 none。 -->
java_ability_refs = none
<!-- python_ability_refs 的当前独立事实为 none。 -->
python_ability_refs = none
<!-- node_ability_refs 的当前独立事实为 none。 -->
node_ability_refs = none
