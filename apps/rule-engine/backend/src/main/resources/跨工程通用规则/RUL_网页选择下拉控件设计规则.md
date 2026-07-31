# 网页选择下拉控件设计规则

<!-- 问题：原生 select 的展开样式受浏览器和操作系统控制，无法稳定呈现产品视觉，也难以统一图标、描述、滚动阈值、选中状态和键盘反馈。 -->
<!-- 场景：网页工具栏、筛选区、表单和分页中的单选下拉控件；不适用于执行命令的 action menu 或存在 children 的层级菜单。 -->
<!-- 业务含义：选择下拉以原生 select 作为真实业务值，以独立组件呈现可控视觉和交互，并通过原生 change 事件继续兼容宿主业务。 -->

web_select_dropdown_scope = toolbar_filter,form_select,pagination_size,single_choice_combobox
web_select_dropdown_excludes = action_menu,context_menu,nested_command_menu
web_select_dropdown_must_follow_current_product_design_system = true

## 组件分层与数据契约

<!-- 可复用选择下拉必须使用独立 JS/CSS；宿主只维护选项数据、当前值和 change 结果，禁止了解浮层内部 DOM。 -->
web_select_dropdown_logic_must_use_independent_module = true
web_select_dropdown_style_must_use_independent_stylesheet = true
web_select_dropdown_host_responsibility = provide_native_select,consume_change,sync_external_value
web_select_dropdown_component_responsibility = render_trigger,render_listbox,manage_open_close,manage_keyboard,manage_scroll,sync_native_select
web_select_dropdown_host_must_not_mutate_internal_dom = true

<!-- 原生 select 保留为唯一真实值和 change 契约；自定义触发器不得复制出第二套不可同步状态。 -->
web_select_dropdown_value_source = native_select
web_select_dropdown_selection_event = native_change
web_select_dropdown_external_sync_api = set_value,refresh
web_select_dropdown_duplicate_business_state_is_forbidden = true

<!-- 选项可通过 option 的 data 字段人工增加图标、菜单名称、说明和主题色，增删排序不得修改组件事件分支。 -->
web_select_dropdown_required_option_fields = value,label
web_select_dropdown_optional_option_fields = icon,menu_label,description,tone,disabled
web_select_dropdown_manual_item_add_remove_reorder_must_only_change = native_option_configuration

## 视觉与容器稳定

<!-- 关闭触发器必须保持宿主原有高度、宽度和文字节奏；展开状态只能改变边框、光效和箭头，不得推动周围布局。 -->
web_select_dropdown_trigger_must_preserve_host_geometry = true
web_select_dropdown_open_state_must_not_reflow_host_layout = true
web_select_dropdown_trigger_tracks = optional_icon,prefix,current_value,chevron

<!-- 展开菜单使用绝对浮层并根据宿主位置选择向下或向上展开；浮层不得被后续面板区域或视口边缘裁切。 -->
web_select_dropdown_popup_position = absolute_overlay
web_select_dropdown_supported_placement = bottom,top
web_select_dropdown_popup_must_have_explicit_layer = true
web_select_dropdown_viewport_clipping_is_forbidden = true

<!-- 项目行统一图标、主文字、可选说明和勾选轨道；当前选择、键盘活动和禁用状态不得改变行高。 -->
web_select_dropdown_option_tracks = icon,label_and_optional_description,selected_check
web_select_dropdown_option_height_must_be_consistent = true
web_select_dropdown_required_visual_states = default,hover,focus_visible,active,selected,disabled
web_select_dropdown_state_change_must_not_change_geometry = true

<!-- 超过人工阈值后只滚动选项视口；滚动不得关闭当前下拉或改变外框尺寸。 -->
web_select_dropdown_scroll_threshold_must_be_configurable = true
web_select_dropdown_scroll_condition = option_count > configured_scroll_threshold
web_select_dropdown_scroll_height = configured_scroll_threshold * consistent_option_height
web_select_dropdown_internal_scroll_must_not_close_popup = true
web_select_dropdown_scroll_must_not_resize_outer_frame = true

<!-- 非标准图片边框必须使用九宫格或 border-image，文字和图标保持实时 DOM，禁止栅格化进背景。 -->
web_select_dropdown_decorative_frame = nine_slice_or_border_image
web_select_dropdown_live_text_and_icons_must_remain_dom = true

## 交互与可访问性

<!-- 触发器使用 combobox 语义并控制 listbox；选项使用 option 语义，同步 aria-expanded 和 aria-selected。 -->
web_select_dropdown_trigger_semantics = native_button_with_combobox_role
web_select_dropdown_popup_semantics = listbox
web_select_dropdown_item_semantics = option
web_select_dropdown_required_aria = accessible_name,aria_controls,aria_haspopup,aria_expanded,aria_selected

<!-- 键盘必须覆盖展开、方向移动、首尾、确认、退出和 Tab 离开；禁用项目必须跳过。 -->
web_select_dropdown_keyboard_open = Enter,Space,ArrowDown,ArrowUp
web_select_dropdown_keyboard_navigation = ArrowDown,ArrowUp,Home,End
web_select_dropdown_keyboard_select = Enter,Space
web_select_dropdown_keyboard_close = Escape,Tab
web_select_dropdown_keyboard_must_skip_disabled = true

<!-- 同一页面只允许一个选择下拉打开；选择完成、Escape、点击外部或外部滚动关闭，菜单内部滚动保持打开。 -->
web_select_dropdown_open_policy = single_open_instance
web_select_dropdown_close_behavior = selection,escape,outside_click,external_scroll
web_select_dropdown_internal_scroll_behavior = keep_open

## 验证与交付

<!-- 真实浏览器验证覆盖鼠标、键盘、状态同步、滚动、方向和外部关闭；控制台不得存在错误。 -->
web_select_dropdown_required_browser_tests = open,reclick_close,mutual_exclusion,select,external_value_sync,keyboard_navigation,escape,outside_click,scroll_threshold,top_placement,compact_viewport
web_select_dropdown_browser_console_must_have_no_error = true

<!-- 视觉验收必须使用相同尺寸和相同业务状态比较关闭控件，并额外检查设计稿未提供的展开状态。 -->
web_select_dropdown_visual_qa_must_compare = same_viewport,same_filter_state,closed_state,open_state
web_select_dropdown_visual_qa_surfaces = trigger_geometry,popup_alignment,typography,icon_alignment,description_rhythm,selected_state,frame_asset,scrollbar,layering
web_select_dropdown_visual_qa_must_fix_before_delivery = p0,p1,p2

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
