# 网页日期选择控件设计规则

<!-- 问题：原生 date 输入的月历由浏览器和操作系统控制，难以稳定复用产品材质、交互状态、键盘反馈与弹层定位。 -->
<!-- 场景：网页表单、业务窗口和筛选区域中的单日期选择；不覆盖日期范围、日期时间或周期规则编辑。 -->
<!-- 业务含义：原生 date 输入继续承载标准业务值和校验，自定义月历负责统一视觉、待选确认、键盘导航与宿主生命周期。 -->

web_date_picker_scope = form_single_date,window_single_date,filter_single_date
web_date_picker_excludes = date_range,date_time,recurrence_editor
web_date_picker_must_follow_current_product_design_system = true

## 组件分层与日期契约

<!-- 可复用日期控件必须使用独立 JS/CSS；宿主仅提供原生 date 输入、标签和约束，不得操作月历内部 DOM。 -->
web_date_picker_logic_must_use_independent_module = true
web_date_picker_style_must_use_independent_stylesheet = true
web_date_picker_host_responsibility = provide_native_date_input,consume_input_and_change,manage_host_lifecycle
web_date_picker_component_responsibility = render_trigger,render_calendar,manage_pending_selection,manage_keyboard,manage_placement,sync_native_input
web_date_picker_host_must_not_mutate_internal_dom = true

<!-- 原生输入是唯一业务值，必须保留 YYYY-MM-DD、required、min、max、表单提交和校验语义。 -->
web_date_picker_value_source = native_date_input
web_date_picker_value_format = YYYY-MM-DD
web_date_picker_must_preserve_native_contract = name,required,min,max,form_data,constraint_validation,input_event,change_event
web_date_picker_duplicate_business_state_is_forbidden = true

<!-- 日期计算使用本地年月日，禁止以 UTC 字符串往返造成时区前移或后移。 -->
web_date_picker_calendar_arithmetic = local_year_month_day
web_date_picker_utc_roundtrip_for_calendar_cells_is_forbidden = true

## 月历结构与视觉

<!-- 月历固定七列六行并显示相邻月份日期；周起始日必须由产品配置，本规则默认周一。 -->
web_date_picker_week_columns = 7
web_date_picker_visible_week_rows = 6
web_date_picker_show_adjacent_month_days = true
web_date_picker_default_week_start = monday

<!-- 触发器保持宿主输入几何；浮层使用产品主面板材质，并通过 body 门户避免被 Window 或表单裁切。 -->
web_date_picker_trigger_must_preserve_host_geometry = true
web_date_picker_popup_frame_must_reuse_primary_panel_material = true
web_date_picker_popup_mount = body_portal
web_date_picker_supported_placement = bottom,top
web_date_picker_popup_must_stay_inside_viewport = true
web_date_picker_popup_must_not_overlap_trigger = true

<!-- 非标准图片边框使用九宫格或 border-image；日期、标题和操作按钮保持实时 DOM。 -->
web_date_picker_decorative_frame = nine_slice_or_border_image
web_date_picker_live_text_and_controls_must_remain_dom = true
web_date_picker_required_visual_states = default,hover,focus_visible,today,pending_selected,committed_selected,adjacent_month,disabled
web_date_picker_state_change_must_not_change_cell_geometry = true

## 交互、可访问性与宿主生命周期

<!-- 触发器和月历必须暴露完整对话框、网格和选中语义，并以 roving tabindex 管理日期焦点。 -->
web_date_picker_trigger_semantics = native_button_with_dialog_popup
web_date_picker_popup_semantics = dialog
web_date_picker_calendar_semantics = grid
web_date_picker_day_semantics = gridcell
web_date_picker_required_aria = accessible_name,aria_controls,aria_haspopup,aria_expanded,aria_selected,aria_current
web_date_picker_focus_model = roving_tabindex

<!-- 键盘覆盖逐日、逐周、月切换、周首尾、确认和退出；min/max 外日期不可提交。 -->
web_date_picker_keyboard_day_navigation = ArrowLeft,ArrowRight,ArrowUp,ArrowDown
web_date_picker_keyboard_month_navigation = PageUp,PageDown
web_date_picker_keyboard_week_navigation = Home,End
web_date_picker_keyboard_select = Enter,Space
web_date_picker_keyboard_close = Escape
web_date_picker_must_enforce_native_min_max = true

<!-- 展开后的选择先进入待选状态，仅“确定”提交业务值；清除和今天必须具备明确动作。 -->
web_date_picker_selection_model = pending_then_confirm
web_date_picker_confirm_must_dispatch = input,change
web_date_picker_required_actions = previous_month,next_month,today,clear,confirm
web_date_picker_escape_must_preserve_committed_value = true
web_date_picker_outside_click_must_preserve_committed_value = true

<!-- 宿主窗口关闭、最小化或移除时必须同步关闭月历，恢复后保持已提交值。 -->
web_date_picker_host_close_behavior = close_popup
web_date_picker_host_minimize_behavior = close_popup
web_date_picker_host_restore_behavior = preserve_committed_value

## 验证与交付

<!-- 真实浏览器必须覆盖鼠标、键盘、校验、方向、窄视口和宿主生命周期；控制台不得存在错误。 -->
web_date_picker_required_browser_tests = open,month_navigation,mouse_pending_and_confirm,keyboard_navigation,escape,outside_click,clear,today,min_max,form_submit,top_placement,bottom_placement,compact_viewport,host_minimize_restore
web_date_picker_browser_console_must_have_no_error = true

<!-- 视觉验收使用相同视口、月份和选中日期比较参考与实现，P0/P1/P2 问题交付前必须修复。 -->
web_date_picker_visual_qa_must_compare = same_viewport,same_month,same_selected_date,open_state
web_date_picker_visual_qa_surfaces = trigger_geometry,popup_size,popup_alignment,frame_material,typography,calendar_density,selected_state,today_state,action_row,layering
web_date_picker_visual_qa_must_fix_before_delivery = p0,p1,p2

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
