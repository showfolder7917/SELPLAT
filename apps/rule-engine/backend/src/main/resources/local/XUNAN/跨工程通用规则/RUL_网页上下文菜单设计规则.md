# 网页上下文菜单设计规则

<!-- 问题：网页表格、列表和卡片中的操作菜单若把数据、交互、样式和素材混在宿主组件中，项目增加后容易出现高度失控、边框拉伸、二级菜单错位、状态缺失和重复实现。 -->
<!-- 场景：网页中的上下文菜单、更多操作菜单、下拉动作菜单、表格行操作菜单及带二级项目的浮层菜单。 -->
<!-- 业务含义：菜单必须成为可独立维护、可人工配置、可扩展且经过真实交互与视觉验证的 UI 模块，同时继续服从当前产品的既有设计系统。 -->

<!-- web_context_menu_rule_scope 的当前独立事实为 context_menu。 -->
web_context_menu_rule_scope = context_menu
<!-- web_context_menu_rule_scope.2 的当前独立事实为 action_menu。 -->
web_context_menu_rule_scope.2 = action_menu
<!-- web_context_menu_rule_scope.3 的当前独立事实为 more_menu。 -->
web_context_menu_rule_scope.3 = more_menu
<!-- web_context_menu_rule_scope.4 的当前独立事实为 dropdown_action_menu。 -->
web_context_menu_rule_scope.4 = dropdown_action_menu
<!-- web_context_menu_rule_scope.5 的当前独立事实为 table_row_menu。 -->
web_context_menu_rule_scope.5 = table_row_menu
<!-- web_context_menu_rule_scope.6 的当前独立事实为 nested_menu。 -->
web_context_menu_rule_scope.6 = nested_menu
<!-- web_context_menu_must_follow_current_product_design_system 的当前独立事实为 true。 -->
web_context_menu_must_follow_current_product_design_system = true
<!-- web_context_menu_visual_style_must_not_be_forced_across_unrelated_products 的当前独立事实为 true。 -->
web_context_menu_visual_style_must_not_be_forced_across_unrelated_products = true

## 代码、样式与素材分层

<!-- 菜单业务逻辑必须从表格、列表或卡片宿主逻辑中拆出；适用于存在项目配置、滚动、二级菜单或多交互状态的菜单；业务含义是宿主只负责提供目标对象和接收动作结果。 -->
complex_web_menu_logic_must_use_independent_module = true
<!-- host_component_menu_responsibility 的当前独立事实为 provide_target。 -->
host_component_menu_responsibility = provide_target
<!-- host_component_menu_responsibility.2 的当前独立事实为 open_or_toggle_menu。 -->
host_component_menu_responsibility.2 = open_or_toggle_menu
<!-- host_component_menu_responsibility.3 的当前独立事实为 consume_action_event。 -->
host_component_menu_responsibility.3 = consume_action_event
<!-- host_component_menu_responsibility.4 的当前独立事实为 sync_expanded_state。 -->
host_component_menu_responsibility.4 = sync_expanded_state
<!-- menu_module_responsibility 的当前独立事实为 render_items。 -->
menu_module_responsibility = render_items
<!-- menu_module_responsibility.2 的当前独立事实为 manage_open_close。 -->
menu_module_responsibility.2 = manage_open_close
<!-- menu_module_responsibility.3 的当前独立事实为 manage_scroll。 -->
menu_module_responsibility.3 = manage_scroll
<!-- menu_module_responsibility.4 的当前独立事实为 manage_submenu。 -->
menu_module_responsibility.4 = manage_submenu
<!-- menu_module_responsibility.5 的当前独立事实为 emit_action。 -->
menu_module_responsibility.5 = emit_action

<!-- 菜单样式必须与宿主表格或列表样式分离；适用于可复用或多状态菜单；业务含义是修改菜单尺寸、状态和材质时不污染宿主布局。 -->
complex_web_menu_style_must_use_independent_stylesheet = true
<!-- host_stylesheet_must_not_own_menu_internal_selectors 的当前独立事实为 true。 -->
host_stylesheet_must_not_own_menu_internal_selectors = true
<!-- menu_css_selector_must_use_module_prefix 的当前独立事实为 true。 -->
menu_css_selector_must_use_module_prefix = true

<!-- 菜单专属图片、纹理和边框必须进入独立素材目录；适用于菜单存在非标准视觉资产；业务含义是菜单资产可整体迁移、替换和清理。 -->
web_menu_asset_directory_pattern = <web-static-root>/sel/assets/components/<menu-module>/
<!-- web_menu_specific_asset_must_not_live_in 的当前独立事实为 <web-static-root>/sel/assets/shared/。 -->
web_menu_specific_asset_must_not_live_in = <web-static-root>/sel/assets/shared/
<!-- web_menu_specific_asset_must_not_live_in.2 的当前独立事实为 <web-static-root>/<application>/assets/。 -->
web_menu_specific_asset_must_not_live_in.2 = <web-static-root>/<application>/assets/
<!-- web_menu_asset_root_must_preserve_component_layer 的当前独立事实为 true。 -->
web_menu_asset_root_must_preserve_component_layer = true
<!-- menu_runtime_asset_must_use_local_relative_path 的当前独立事实为 true。 -->
menu_runtime_asset_must_use_local_relative_path = true

## 人工配置与项目扩展

<!-- 一级菜单项目必须由可读配置数组驱动；适用于需要人工增加、删除、排序或调整状态的菜单；业务含义是修改项目数量不需要复制 HTML 或改写事件分支。 -->
web_menu_primary_items_must_be_configuration_driven = true
<!-- web_menu_minimum_item_fields 的当前独立事实为 id。 -->
web_menu_minimum_item_fields = id
<!-- web_menu_minimum_item_fields.2 的当前独立事实为 label。 -->
web_menu_minimum_item_fields.2 = label
<!-- web_menu_minimum_item_fields.3 的当前独立事实为 icon。 -->
web_menu_minimum_item_fields.3 = icon
<!-- web_menu_optional_item_fields 的当前独立事实为 disabled。 -->
web_menu_optional_item_fields = disabled
<!-- web_menu_optional_item_fields.2 的当前独立事实为 danger。 -->
web_menu_optional_item_fields.2 = danger
<!-- web_menu_optional_item_fields.3 的当前独立事实为 badge。 -->
web_menu_optional_item_fields.3 = badge
<!-- web_menu_optional_item_fields.4 的当前独立事实为 children。 -->
web_menu_optional_item_fields.4 = children
<!-- web_menu_optional_item_fields.5 的当前独立事实为 section_start。 -->
web_menu_optional_item_fields.5 = section_start
<!-- manual_item_add_remove_reorder_must_only_require_configuration_change 的当前独立事实为 true。 -->
manual_item_add_remove_reorder_must_only_require_configuration_change = true

<!-- 图标必须来自当前产品已经选定的真实图标库或设计资产；适用于所有可见菜单动作；业务含义是禁止使用 emoji、文字符号、临时占位图标或重复手绘图形破坏一致性。 -->
web_menu_icon_source = existing_product_icon_library_or_real_design_asset
<!-- web_menu_icon_placeholder_forbidden 的当前独立事实为 emoji。 -->
web_menu_icon_placeholder_forbidden = emoji
<!-- web_menu_icon_placeholder_forbidden.2 的当前独立事实为 text_symbol。 -->
web_menu_icon_placeholder_forbidden.2 = text_symbol
<!-- web_menu_icon_placeholder_forbidden.3 的当前独立事实为 ascii_shape。 -->
web_menu_icon_placeholder_forbidden.3 = ascii_shape
<!-- web_menu_icon_placeholder_forbidden.4 的当前独立事实为 temporary_box。 -->
web_menu_icon_placeholder_forbidden.4 = temporary_box

<!-- 菜单运行时可以提供配置更新入口，但不得要求宿主了解菜单内部 DOM；适用于需要演示或动态调整项目的页面。 -->
web_menu_optional_runtime_configuration_api = set_items
<!-- web_menu_optional_runtime_configuration_api.2 的当前独立事实为 set_scroll_threshold。 -->
web_menu_optional_runtime_configuration_api.2 = set_scroll_threshold
<!-- host_must_not_mutate_menu_internal_dom 的当前独立事实为 true。 -->
host_must_not_mutate_menu_internal_dom = true

## 固定行高、滚动阈值与容器稳定

<!-- 菜单项目必须使用统一行高和稳定的图标、文字、徽标、箭头轨道；适用于项目数量变化和长文案；业务含义是新增项目后扫描节奏、对齐和点击面积保持一致。 -->
web_menu_item_height_must_be_consistent = true
<!-- web_menu_item_grid_tracks 的当前独立事实为 icon。 -->
web_menu_item_grid_tracks = icon
<!-- web_menu_item_grid_tracks.2 的当前独立事实为 label。 -->
web_menu_item_grid_tracks.2 = label
<!-- web_menu_item_grid_tracks.3 的当前独立事实为 optional_badge。 -->
web_menu_item_grid_tracks.3 = optional_badge
<!-- web_menu_item_grid_tracks.4 的当前独立事实为 optional_chevron。 -->
web_menu_item_grid_tracks.4 = optional_chevron
<!-- web_menu_label_must_preserve_single_line_readability 的当前独立事实为 true。 -->
web_menu_label_must_preserve_single_line_readability = true
<!-- web_menu_badge_must_not_force_primary_label_truncation 的当前独立事实为 true。 -->
web_menu_badge_must_not_force_primary_label_truncation = true

<!-- 出现滚动条的项目数量阈值必须可以人工设置；适用于长列表菜单；业务含义是设计方可以按容器空间控制可见项目数，不把固定数字散落在样式和脚本多处。 -->
web_menu_scroll_threshold_must_be_configurable = true
<!-- web_menu_scroll_condition 的当前独立事实为 item_count > configured_scroll_threshold。 -->
web_menu_scroll_condition = item_count > configured_scroll_threshold
<!-- web_menu_scroll_height 的当前独立事实为 configured_scroll_threshold * consistent_item_height。 -->
web_menu_scroll_height = configured_scroll_threshold * consistent_item_height
<!-- web_menu_scrollbar_must_match_design_system 的当前独立事实为 true。 -->
web_menu_scrollbar_must_match_design_system = true
<!-- web_menu_scroll_must_not_resize_outer_container 的当前独立事实为 true。 -->
web_menu_scroll_must_not_resize_outer_container = true

<!-- 装饰性边框需要随菜单高度变化时必须保护顶部、底部和四角；适用于水晶、金属、皮革或其他非标准图片边框；业务含义是只能延展中段，禁止整体拉伸导致边角变形。 -->
stretchable_decorative_menu_frame_must_use = nine_slice
<!-- stretchable_decorative_menu_frame_must_use.2 的当前独立事实为 border_image_or_equivalent_sliced_asset。 -->
stretchable_decorative_menu_frame_must_use.2 = border_image_or_equivalent_sliced_asset
<!-- stretchable_menu_frame_must_preserve 的当前独立事实为 top_edge。 -->
stretchable_menu_frame_must_preserve = top_edge
<!-- stretchable_menu_frame_must_preserve.2 的当前独立事实为 bottom_edge。 -->
stretchable_menu_frame_must_preserve.2 = bottom_edge
<!-- stretchable_menu_frame_must_preserve.3 的当前独立事实为 all_corners。 -->
stretchable_menu_frame_must_preserve.3 = all_corners
<!-- stretching_full_raster_menu_frame_is_forbidden 的当前独立事实为 true。 -->
stretching_full_raster_menu_frame_is_forbidden = true
<!-- rasterizing_live_menu_text_and_icons_into_background_is_forbidden 的当前独立事实为 true。 -->
rasterizing_live_menu_text_and_icons_into_background_is_forbidden = true

## 二级菜单

<!-- 一级项目通过 children 配置二级菜单；适用于移动到、分类、空间选择等层级动作；业务含义是二级项目与一级项目共用配置模型和事件输出，不新增硬编码分支。 -->
web_submenu_must_be_configured_by_parent_children = true
<!-- web_submenu_item_model_must_reuse_primary_item_model 的当前独立事实为 true。 -->
web_submenu_item_model_must_reuse_primary_item_model = true
<!-- web_submenu_action_event_must_include 的当前独立事实为 parent_action。 -->
web_submenu_action_event_must_include = parent_action
<!-- web_submenu_action_event_must_include.2 的当前独立事实为 child_action。 -->
web_submenu_action_event_must_include.2 = child_action
<!-- web_submenu_action_event_must_include.3 的当前独立事实为 target。 -->
web_submenu_action_event_must_include.3 = target

<!-- 二级菜单必须保持同一视觉系统和清晰层级，并根据可用空间选择展开方向；适用于靠近视口边缘的菜单；业务含义是优先按设计方向展开，空间不足时自动翻转，禁止被视口裁切。 -->
web_submenu_must_inherit = material
<!-- web_submenu_must_inherit.2 的当前独立事实为 row_height。 -->
web_submenu_must_inherit.2 = row_height
<!-- web_submenu_must_inherit.3 的当前独立事实为 typography。 -->
web_submenu_must_inherit.3 = typography
<!-- web_submenu_must_inherit.4 的当前独立事实为 icon_system。 -->
web_submenu_must_inherit.4 = icon_system
<!-- web_submenu_must_inherit.5 的当前独立事实为 state_tokens。 -->
web_submenu_must_inherit.5 = state_tokens
<!-- web_submenu_preferred_direction 的当前独立事实为 design_specified_direction。 -->
web_submenu_preferred_direction = design_specified_direction
<!-- web_submenu_insufficient_space_behavior 的当前独立事实为 flip_to_available_side。 -->
web_submenu_insufficient_space_behavior = flip_to_available_side
<!-- web_submenu_viewport_clipping_is_forbidden 的当前独立事实为 true。 -->
web_submenu_viewport_clipping_is_forbidden = true

<!-- 一级列表滚动后必须关闭或重新定位已经打开的二级菜单；适用于可滚动父菜单；业务含义是父项目移动后禁止二级浮层悬空。 -->
parent_menu_scroll_with_open_submenu_must = close_or_reposition_submenu

## 状态、交互与可访问性

<!-- 菜单至少实现默认、悬停、按下、键盘聚焦、禁用和危险状态；适用于桌面网页操作菜单；业务含义是用户可以明确判断项目是否可用、正在交互以及是否具有破坏性。 -->
web_menu_required_visual_states = default
<!-- web_menu_required_visual_states.2 的当前独立事实为 hover。 -->
web_menu_required_visual_states.2 = hover
<!-- web_menu_required_visual_states.3 的当前独立事实为 pressed。 -->
web_menu_required_visual_states.3 = pressed
<!-- web_menu_required_visual_states.4 的当前独立事实为 focus_visible。 -->
web_menu_required_visual_states.4 = focus_visible
<!-- web_menu_required_visual_states.5 的当前独立事实为 disabled。 -->
web_menu_required_visual_states.5 = disabled
<!-- web_menu_required_visual_states.6 的当前独立事实为 danger。 -->
web_menu_required_visual_states.6 = danger
<!-- disabled_menu_item_must_use_native_disabled_semantics 的当前独立事实为 true。 -->
disabled_menu_item_must_use_native_disabled_semantics = true
<!-- danger_menu_item_must_use_distinct_semantic_color 的当前独立事实为 true。 -->
danger_menu_item_must_use_distinct_semantic_color = true
<!-- hover_pressed_and_focus_states_must_not_change_row_geometry 的当前独立事实为 true。 -->
hover_pressed_and_focus_states_must_not_change_row_geometry = true

<!-- 菜单必须使用原生按钮和菜单语义；适用于一级和二级动作；业务含义是鼠标、键盘和辅助技术获得一致功能。 -->
web_menu_action_control = native_button
<!-- web_menu_required_accessibility 的当前独立事实为 accessible_name。 -->
web_menu_required_accessibility = accessible_name
<!-- web_menu_required_accessibility.2 的当前独立事实为 menu_role。 -->
web_menu_required_accessibility.2 = menu_role
<!-- web_menu_required_accessibility.3 的当前独立事实为 aria_haspopup。 -->
web_menu_required_accessibility.3 = aria_haspopup
<!-- web_menu_required_accessibility.4 的当前独立事实为 aria_expanded。 -->
web_menu_required_accessibility.4 = aria_expanded
<!-- web_menu_required_accessibility.5 的当前独立事实为 visible_focus。 -->
web_menu_required_accessibility.5 = visible_focus

<!-- 关闭行为必须形成明确层级；适用于存在二级菜单的浮层；业务含义是 Escape 优先关闭最深层菜单，外部点击关闭整个菜单，同一触发器再次点击执行切换。 -->
web_menu_close_behavior = outside_click_closes_all
<!-- web_menu_close_behavior.2 的当前独立事实为 trigger_reclick_toggles。 -->
web_menu_close_behavior.2 = trigger_reclick_toggles
<!-- web_menu_escape_order 的当前独立事实为 close_deepest_submenu_then_primary_menu。 -->
web_menu_escape_order = close_deepest_submenu_then_primary_menu
<!-- web_menu_action_event_must_include 的当前独立事实为 action_id。 -->
web_menu_action_event_must_include = action_id
<!-- web_menu_action_event_must_include.2 的当前独立事实为 label。 -->
web_menu_action_event_must_include.2 = label
<!-- web_menu_action_event_must_include.3 的当前独立事实为 level。 -->
web_menu_action_event_must_include.3 = level
<!-- web_menu_action_event_must_include.4 的当前独立事实为 target。 -->
web_menu_action_event_must_include.4 = target
<!-- web_context_menu_pointer_anchor_source 的当前独立事实为 contextmenu.clientX。 -->
web_context_menu_pointer_anchor_source = contextmenu.clientX
<!-- web_context_menu_pointer_anchor_source.2 的当前独立事实为 contextmenu.clientY。 -->
web_context_menu_pointer_anchor_source.2 = contextmenu.clientY
<!-- web_context_menu_pointer_anchor_must_follow 的当前独立事实为 each_explicit_contextmenu_event。 -->
web_context_menu_pointer_anchor_must_follow = each_explicit_contextmenu_event
<!-- web_context_menu_pointer_anchor_must_clamp_to 的当前独立事实为 nearest_visible_host_then_viewport。 -->
web_context_menu_pointer_anchor_must_clamp_to = nearest_visible_host_then_viewport

## 验证与交付

<!-- 菜单完成后必须使用真实浏览器验证核心路径；适用于新增、修改或重构菜单；业务含义是静态截图和语法检查不能代替滚动、层级和关闭行为验证。 -->
web_menu_required_browser_tests = open
<!-- web_menu_required_browser_tests.2 的当前独立事实为 reopen。 -->
web_menu_required_browser_tests.2 = reopen
<!-- web_menu_required_browser_tests.3 的当前独立事实为 outside_click_close。 -->
web_menu_required_browser_tests.3 = outside_click_close
<!-- web_menu_required_browser_tests.4 的当前独立事实为 escape_close。 -->
web_menu_required_browser_tests.4 = escape_close
<!-- web_menu_required_browser_tests.5 的当前独立事实为 scroll_to_last_item。 -->
web_menu_required_browser_tests.5 = scroll_to_last_item
<!-- web_menu_required_browser_tests.6 的当前独立事实为 submenu_open。 -->
web_menu_required_browser_tests.6 = submenu_open
<!-- web_menu_required_browser_tests.7 的当前独立事实为 submenu_action。 -->
web_menu_required_browser_tests.7 = submenu_action
<!-- web_menu_required_browser_tests.8 的当前独立事实为 disabled_item。 -->
web_menu_required_browser_tests.8 = disabled_item
<!-- web_menu_required_browser_tests.9 的当前独立事实为 danger_action。 -->
web_menu_required_browser_tests.9 = danger_action
<!-- web_menu_browser_console_must_have_no_error 的当前独立事实为 true。 -->
web_menu_browser_console_must_have_no_error = true

<!-- 必须把设计参考与相同尺寸、相同状态的浏览器实现放入同一对照输入；适用于按设计稿实现的菜单；业务含义是视觉验收必须覆盖字体、行高、间距、图标、状态、边框材质和长列表容器稳定性。 -->
web_menu_visual_qa_must_compare_same_size_and_state = true
<!-- web_menu_visual_qa_surfaces 的当前独立事实为 typography。 -->
web_menu_visual_qa_surfaces = typography
<!-- web_menu_visual_qa_surfaces.2 的当前独立事实为 item_rhythm。 -->
web_menu_visual_qa_surfaces.2 = item_rhythm
<!-- web_menu_visual_qa_surfaces.3 的当前独立事实为 icon_alignment。 -->
web_menu_visual_qa_surfaces.3 = icon_alignment
<!-- web_menu_visual_qa_surfaces.4 的当前独立事实为 state_color。 -->
web_menu_visual_qa_surfaces.4 = state_color
<!-- web_menu_visual_qa_surfaces.5 的当前独立事实为 frame_asset。 -->
web_menu_visual_qa_surfaces.5 = frame_asset
<!-- web_menu_visual_qa_surfaces.6 的当前独立事实为 scrollbar。 -->
web_menu_visual_qa_surfaces.6 = scrollbar
<!-- web_menu_visual_qa_surfaces.7 的当前独立事实为 submenu_layering。 -->
web_menu_visual_qa_surfaces.7 = submenu_layering
<!-- web_menu_visual_qa_must_fix_before_delivery 的当前独立事实为 p0。 -->
web_menu_visual_qa_must_fix_before_delivery = p0
<!-- web_menu_visual_qa_must_fix_before_delivery.2 的当前独立事实为 p1。 -->
web_menu_visual_qa_must_fix_before_delivery.2 = p1
<!-- web_menu_visual_qa_must_fix_before_delivery.3 的当前独立事实为 p2。 -->
web_menu_visual_qa_must_fix_before_delivery.3 = p2

<!-- 菜单规则没有独立的稳定自动生成职责；当前仅登记约束，不创建空能力入口。 -->
java_ability_refs = none
<!-- python_ability_refs 的当前独立事实为 none。 -->
python_ability_refs = none
<!-- node_ability_refs 的当前独立事实为 none。 -->
node_ability_refs = none
