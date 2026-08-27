# 网页日期选择控件设计规则

<!-- 问题：原生 date 输入的月历由浏览器和操作系统控制，难以稳定复用产品材质、交互状态、键盘反馈与弹层定位。 -->
<!-- 场景：网页表单、业务窗口和筛选区域中的单日期选择；不覆盖日期范围、日期时间或周期规则编辑。 -->
<!-- 业务含义：原生 date 输入继续承载标准业务值和校验，自定义月历负责统一视觉、待选确认、键盘导航与宿主生命周期。 -->

<!-- web_date_picker_scope 的当前独立事实为 form_single_date。 -->
web_date_picker_scope = form_single_date
<!-- web_date_picker_scope.2 的当前独立事实为 window_single_date。 -->
web_date_picker_scope.2 = window_single_date
<!-- web_date_picker_scope.3 的当前独立事实为 filter_single_date。 -->
web_date_picker_scope.3 = filter_single_date
<!-- web_date_picker_excludes 的当前独立事实为 date_range。 -->
web_date_picker_excludes = date_range
<!-- web_date_picker_excludes.2 的当前独立事实为 date_time。 -->
web_date_picker_excludes.2 = date_time
<!-- web_date_picker_excludes.3 的当前独立事实为 recurrence_editor。 -->
web_date_picker_excludes.3 = recurrence_editor
<!-- web_date_picker_must_follow_current_product_design_system 的当前独立事实为 true。 -->
web_date_picker_must_follow_current_product_design_system = true

## 组件分层与日期契约

<!-- 可复用日期控件必须使用独立 JS/CSS；宿主仅提供原生 date 输入、标签和约束，不得操作月历内部 DOM。 -->
web_date_picker_logic_must_use_independent_module = true
<!-- web_date_picker_style_must_use_independent_stylesheet 的当前独立事实为 true。 -->
web_date_picker_style_must_use_independent_stylesheet = true
<!-- web_date_picker_host_responsibility 的当前独立事实为 provide_native_date_input。 -->
web_date_picker_host_responsibility = provide_native_date_input
<!-- web_date_picker_host_responsibility.2 的当前独立事实为 consume_input_and_change。 -->
web_date_picker_host_responsibility.2 = consume_input_and_change
<!-- web_date_picker_host_responsibility.3 的当前独立事实为 manage_host_lifecycle。 -->
web_date_picker_host_responsibility.3 = manage_host_lifecycle
<!-- web_date_picker_component_responsibility 的当前独立事实为 render_trigger。 -->
web_date_picker_component_responsibility = render_trigger
<!-- web_date_picker_component_responsibility.2 的当前独立事实为 render_calendar。 -->
web_date_picker_component_responsibility.2 = render_calendar
<!-- web_date_picker_component_responsibility.3 的当前独立事实为 manage_pending_selection。 -->
web_date_picker_component_responsibility.3 = manage_pending_selection
<!-- web_date_picker_component_responsibility.4 的当前独立事实为 manage_keyboard。 -->
web_date_picker_component_responsibility.4 = manage_keyboard
<!-- web_date_picker_component_responsibility.5 的当前独立事实为 manage_placement。 -->
web_date_picker_component_responsibility.5 = manage_placement
<!-- web_date_picker_component_responsibility.6 的当前独立事实为 sync_native_input。 -->
web_date_picker_component_responsibility.6 = sync_native_input
<!-- web_date_picker_host_must_not_mutate_internal_dom 的当前独立事实为 true。 -->
web_date_picker_host_must_not_mutate_internal_dom = true

<!-- 原生输入是唯一业务值，必须保留 YYYY-MM-DD、required、min、max、表单提交和校验语义。 -->
web_date_picker_value_source = native_date_input
<!-- web_date_picker_value_format 的当前独立事实为 YYYY-MM-DD。 -->
web_date_picker_value_format = YYYY-MM-DD
<!-- web_date_picker_must_preserve_native_contract 的当前独立事实为 name。 -->
web_date_picker_must_preserve_native_contract = name
<!-- web_date_picker_must_preserve_native_contract.2 的当前独立事实为 required。 -->
web_date_picker_must_preserve_native_contract.2 = required
<!-- web_date_picker_must_preserve_native_contract.3 的当前独立事实为 min。 -->
web_date_picker_must_preserve_native_contract.3 = min
<!-- web_date_picker_must_preserve_native_contract.4 的当前独立事实为 max。 -->
web_date_picker_must_preserve_native_contract.4 = max
<!-- web_date_picker_must_preserve_native_contract.5 的当前独立事实为 form_data。 -->
web_date_picker_must_preserve_native_contract.5 = form_data
<!-- web_date_picker_must_preserve_native_contract.6 的当前独立事实为 constraint_validation。 -->
web_date_picker_must_preserve_native_contract.6 = constraint_validation
<!-- web_date_picker_must_preserve_native_contract.7 的当前独立事实为 input_event。 -->
web_date_picker_must_preserve_native_contract.7 = input_event
<!-- web_date_picker_must_preserve_native_contract.8 的当前独立事实为 change_event。 -->
web_date_picker_must_preserve_native_contract.8 = change_event
<!-- web_date_picker_duplicate_business_state_is_forbidden 的当前独立事实为 true。 -->
web_date_picker_duplicate_business_state_is_forbidden = true

<!-- 日期计算使用本地年月日，禁止以 UTC 字符串往返造成时区前移或后移。 -->
web_date_picker_calendar_arithmetic = local_year_month_day
<!-- web_date_picker_utc_roundtrip_for_calendar_cells_is_forbidden 的当前独立事实为 true。 -->
web_date_picker_utc_roundtrip_for_calendar_cells_is_forbidden = true

## 月历结构与视觉

<!-- 月历固定七列六行并显示相邻月份日期；周起始日必须由产品配置，本规则默认周一。 -->
web_date_picker_week_columns = 7
<!-- web_date_picker_visible_week_rows 的当前独立事实为 6。 -->
web_date_picker_visible_week_rows = 6
<!-- web_date_picker_show_adjacent_month_days 的当前独立事实为 true。 -->
web_date_picker_show_adjacent_month_days = true
<!-- web_date_picker_default_week_start 的当前独立事实为 monday。 -->
web_date_picker_default_week_start = monday

<!-- 触发器保持宿主输入几何；浮层使用产品主面板材质，并通过 body 门户避免被 Window 或表单裁切。 -->
web_date_picker_trigger_must_preserve_host_geometry = true
<!-- web_date_picker_popup_frame_must_reuse_primary_panel_material 的当前独立事实为 true。 -->
web_date_picker_popup_frame_must_reuse_primary_panel_material = true
<!-- web_date_picker_popup_mount 的当前独立事实为 body_portal。 -->
web_date_picker_popup_mount = body_portal
<!-- web_date_picker_supported_placement 的当前独立事实为 bottom。 -->
web_date_picker_supported_placement = bottom
<!-- web_date_picker_supported_placement.2 的当前独立事实为 top。 -->
web_date_picker_supported_placement.2 = top
<!-- web_date_picker_popup_must_stay_inside_viewport 的当前独立事实为 true。 -->
web_date_picker_popup_must_stay_inside_viewport = true
<!-- web_date_picker_popup_must_not_overlap_trigger 的当前独立事实为 true。 -->
web_date_picker_popup_must_not_overlap_trigger = true

<!-- 非标准图片边框使用九宫格或 border-image；日期、标题和操作按钮保持实时 DOM。 -->
web_date_picker_decorative_frame = nine_slice_or_border_image
<!-- web_date_picker_live_text_and_controls_must_remain_dom 的当前独立事实为 true。 -->
web_date_picker_live_text_and_controls_must_remain_dom = true
<!-- web_date_picker_required_visual_states 的当前独立事实为 default。 -->
web_date_picker_required_visual_states = default
<!-- web_date_picker_required_visual_states.2 的当前独立事实为 hover。 -->
web_date_picker_required_visual_states.2 = hover
<!-- web_date_picker_required_visual_states.3 的当前独立事实为 focus_visible。 -->
web_date_picker_required_visual_states.3 = focus_visible
<!-- web_date_picker_required_visual_states.4 的当前独立事实为 today。 -->
web_date_picker_required_visual_states.4 = today
<!-- web_date_picker_required_visual_states.5 的当前独立事实为 pending_selected。 -->
web_date_picker_required_visual_states.5 = pending_selected
<!-- web_date_picker_required_visual_states.6 的当前独立事实为 committed_selected。 -->
web_date_picker_required_visual_states.6 = committed_selected
<!-- web_date_picker_required_visual_states.7 的当前独立事实为 adjacent_month。 -->
web_date_picker_required_visual_states.7 = adjacent_month
<!-- web_date_picker_required_visual_states.8 的当前独立事实为 disabled。 -->
web_date_picker_required_visual_states.8 = disabled
<!-- web_date_picker_state_change_must_not_change_cell_geometry 的当前独立事实为 true。 -->
web_date_picker_state_change_must_not_change_cell_geometry = true

## 交互、可访问性与宿主生命周期

<!-- 触发器和月历必须暴露完整对话框、网格和选中语义，并以 roving tabindex 管理日期焦点。 -->
web_date_picker_trigger_semantics = native_button_with_dialog_popup
<!-- web_date_picker_popup_semantics 的当前独立事实为 dialog。 -->
web_date_picker_popup_semantics = dialog
<!-- web_date_picker_calendar_semantics 的当前独立事实为 grid。 -->
web_date_picker_calendar_semantics = grid
<!-- web_date_picker_day_semantics 的当前独立事实为 gridcell。 -->
web_date_picker_day_semantics = gridcell
<!-- web_date_picker_required_aria 的当前独立事实为 accessible_name。 -->
web_date_picker_required_aria = accessible_name
<!-- web_date_picker_required_aria.2 的当前独立事实为 aria_controls。 -->
web_date_picker_required_aria.2 = aria_controls
<!-- web_date_picker_required_aria.3 的当前独立事实为 aria_haspopup。 -->
web_date_picker_required_aria.3 = aria_haspopup
<!-- web_date_picker_required_aria.4 的当前独立事实为 aria_expanded。 -->
web_date_picker_required_aria.4 = aria_expanded
<!-- web_date_picker_required_aria.5 的当前独立事实为 aria_selected。 -->
web_date_picker_required_aria.5 = aria_selected
<!-- web_date_picker_required_aria.6 的当前独立事实为 aria_current。 -->
web_date_picker_required_aria.6 = aria_current
<!-- web_date_picker_focus_model 的当前独立事实为 roving_tabindex。 -->
web_date_picker_focus_model = roving_tabindex

<!-- 键盘覆盖逐日、逐周、月切换、周首尾、确认和退出；min/max 外日期不可提交。 -->
web_date_picker_keyboard_day_navigation = ArrowLeft
<!-- web_date_picker_keyboard_day_navigation.2 的当前独立事实为 ArrowRight。 -->
web_date_picker_keyboard_day_navigation.2 = ArrowRight
<!-- web_date_picker_keyboard_day_navigation.3 的当前独立事实为 ArrowUp。 -->
web_date_picker_keyboard_day_navigation.3 = ArrowUp
<!-- web_date_picker_keyboard_day_navigation.4 的当前独立事实为 ArrowDown。 -->
web_date_picker_keyboard_day_navigation.4 = ArrowDown
<!-- web_date_picker_keyboard_month_navigation 的当前独立事实为 PageUp。 -->
web_date_picker_keyboard_month_navigation = PageUp
<!-- web_date_picker_keyboard_month_navigation.2 的当前独立事实为 PageDown。 -->
web_date_picker_keyboard_month_navigation.2 = PageDown
<!-- web_date_picker_keyboard_week_navigation 的当前独立事实为 Home。 -->
web_date_picker_keyboard_week_navigation = Home
<!-- web_date_picker_keyboard_week_navigation.2 的当前独立事实为 End。 -->
web_date_picker_keyboard_week_navigation.2 = End
<!-- web_date_picker_keyboard_select 的当前独立事实为 Enter。 -->
web_date_picker_keyboard_select = Enter
<!-- web_date_picker_keyboard_select.2 的当前独立事实为 Space。 -->
web_date_picker_keyboard_select.2 = Space
<!-- web_date_picker_keyboard_close 的当前独立事实为 Escape。 -->
web_date_picker_keyboard_close = Escape
<!-- web_date_picker_must_enforce_native_min_max 的当前独立事实为 true。 -->
web_date_picker_must_enforce_native_min_max = true

<!-- 展开后的选择先进入待选状态，仅“确定”提交业务值；清除和今天必须具备明确动作。 -->
web_date_picker_selection_model = pending_then_confirm
<!-- web_date_picker_confirm_must_dispatch 的当前独立事实为 input。 -->
web_date_picker_confirm_must_dispatch = input
<!-- web_date_picker_confirm_must_dispatch.2 的当前独立事实为 change。 -->
web_date_picker_confirm_must_dispatch.2 = change
<!-- web_date_picker_required_actions 的当前独立事实为 previous_month。 -->
web_date_picker_required_actions = previous_month
<!-- web_date_picker_required_actions.2 的当前独立事实为 next_month。 -->
web_date_picker_required_actions.2 = next_month
<!-- web_date_picker_required_actions.3 的当前独立事实为 today。 -->
web_date_picker_required_actions.3 = today
<!-- web_date_picker_required_actions.4 的当前独立事实为 clear。 -->
web_date_picker_required_actions.4 = clear
<!-- web_date_picker_required_actions.5 的当前独立事实为 confirm。 -->
web_date_picker_required_actions.5 = confirm
<!-- web_date_picker_escape_must_preserve_committed_value 的当前独立事实为 true。 -->
web_date_picker_escape_must_preserve_committed_value = true
<!-- web_date_picker_outside_click_must_preserve_committed_value 的当前独立事实为 true。 -->
web_date_picker_outside_click_must_preserve_committed_value = true

<!-- 宿主窗口关闭、最小化或移除时必须同步关闭月历，恢复后保持已提交值。 -->
web_date_picker_host_close_behavior = close_popup
<!-- web_date_picker_host_minimize_behavior 的当前独立事实为 close_popup。 -->
web_date_picker_host_minimize_behavior = close_popup
<!-- web_date_picker_host_restore_behavior 的当前独立事实为 preserve_committed_value。 -->
web_date_picker_host_restore_behavior = preserve_committed_value

## 验证与交付

<!-- 真实浏览器必须覆盖鼠标、键盘、校验、方向、窄视口和宿主生命周期；控制台不得存在错误。 -->
web_date_picker_required_browser_tests = open
<!-- web_date_picker_required_browser_tests.2 的当前独立事实为 month_navigation。 -->
web_date_picker_required_browser_tests.2 = month_navigation
<!-- web_date_picker_required_browser_tests.3 的当前独立事实为 mouse_pending_and_confirm。 -->
web_date_picker_required_browser_tests.3 = mouse_pending_and_confirm
<!-- web_date_picker_required_browser_tests.4 的当前独立事实为 keyboard_navigation。 -->
web_date_picker_required_browser_tests.4 = keyboard_navigation
<!-- web_date_picker_required_browser_tests.5 的当前独立事实为 escape。 -->
web_date_picker_required_browser_tests.5 = escape
<!-- web_date_picker_required_browser_tests.6 的当前独立事实为 outside_click。 -->
web_date_picker_required_browser_tests.6 = outside_click
<!-- web_date_picker_required_browser_tests.7 的当前独立事实为 clear。 -->
web_date_picker_required_browser_tests.7 = clear
<!-- web_date_picker_required_browser_tests.8 的当前独立事实为 today。 -->
web_date_picker_required_browser_tests.8 = today
<!-- web_date_picker_required_browser_tests.9 的当前独立事实为 min_max。 -->
web_date_picker_required_browser_tests.9 = min_max
<!-- web_date_picker_required_browser_tests.10 的当前独立事实为 form_submit。 -->
web_date_picker_required_browser_tests.10 = form_submit
<!-- web_date_picker_required_browser_tests.11 的当前独立事实为 top_placement。 -->
web_date_picker_required_browser_tests.11 = top_placement
<!-- web_date_picker_required_browser_tests.12 的当前独立事实为 bottom_placement。 -->
web_date_picker_required_browser_tests.12 = bottom_placement
<!-- web_date_picker_required_browser_tests.13 的当前独立事实为 compact_viewport。 -->
web_date_picker_required_browser_tests.13 = compact_viewport
<!-- web_date_picker_required_browser_tests.14 的当前独立事实为 host_minimize_restore。 -->
web_date_picker_required_browser_tests.14 = host_minimize_restore
<!-- web_date_picker_browser_console_must_have_no_error 的当前独立事实为 true。 -->
web_date_picker_browser_console_must_have_no_error = true

<!-- 视觉验收使用相同视口、月份和选中日期比较参考与实现，P0/P1/P2 问题交付前必须修复。 -->
web_date_picker_visual_qa_must_compare = same_viewport
<!-- web_date_picker_visual_qa_must_compare.2 的当前独立事实为 same_month。 -->
web_date_picker_visual_qa_must_compare.2 = same_month
<!-- web_date_picker_visual_qa_must_compare.3 的当前独立事实为 same_selected_date。 -->
web_date_picker_visual_qa_must_compare.3 = same_selected_date
<!-- web_date_picker_visual_qa_must_compare.4 的当前独立事实为 open_state。 -->
web_date_picker_visual_qa_must_compare.4 = open_state
<!-- web_date_picker_visual_qa_surfaces 的当前独立事实为 trigger_geometry。 -->
web_date_picker_visual_qa_surfaces = trigger_geometry
<!-- web_date_picker_visual_qa_surfaces.2 的当前独立事实为 popup_size。 -->
web_date_picker_visual_qa_surfaces.2 = popup_size
<!-- web_date_picker_visual_qa_surfaces.3 的当前独立事实为 popup_alignment。 -->
web_date_picker_visual_qa_surfaces.3 = popup_alignment
<!-- web_date_picker_visual_qa_surfaces.4 的当前独立事实为 frame_material。 -->
web_date_picker_visual_qa_surfaces.4 = frame_material
<!-- web_date_picker_visual_qa_surfaces.5 的当前独立事实为 typography。 -->
web_date_picker_visual_qa_surfaces.5 = typography
<!-- web_date_picker_visual_qa_surfaces.6 的当前独立事实为 calendar_density。 -->
web_date_picker_visual_qa_surfaces.6 = calendar_density
<!-- web_date_picker_visual_qa_surfaces.7 的当前独立事实为 selected_state。 -->
web_date_picker_visual_qa_surfaces.7 = selected_state
<!-- web_date_picker_visual_qa_surfaces.8 的当前独立事实为 today_state。 -->
web_date_picker_visual_qa_surfaces.8 = today_state
<!-- web_date_picker_visual_qa_surfaces.9 的当前独立事实为 action_row。 -->
web_date_picker_visual_qa_surfaces.9 = action_row
<!-- web_date_picker_visual_qa_surfaces.10 的当前独立事实为 layering。 -->
web_date_picker_visual_qa_surfaces.10 = layering
<!-- web_date_picker_visual_qa_must_fix_before_delivery 的当前独立事实为 p0。 -->
web_date_picker_visual_qa_must_fix_before_delivery = p0
<!-- web_date_picker_visual_qa_must_fix_before_delivery.2 的当前独立事实为 p1。 -->
web_date_picker_visual_qa_must_fix_before_delivery.2 = p1
<!-- web_date_picker_visual_qa_must_fix_before_delivery.3 的当前独立事实为 p2。 -->
web_date_picker_visual_qa_must_fix_before_delivery.3 = p2

<!-- java_ability_refs 的当前独立事实为 none。 -->
java_ability_refs = none
<!-- python_ability_refs 的当前独立事实为 none。 -->
python_ability_refs = none
<!-- node_ability_refs 的当前独立事实为 none。 -->
node_ability_refs = none
