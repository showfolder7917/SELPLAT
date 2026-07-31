# 网页稳定面板布局规则

<!-- 问题：通用表格或业务控件直接铺在页面上时，标题、筛选、导航、内容和分页容易互相挤压；后续增加左树、右侧附加选项或窗口缩放时会破坏控件尺寸。 -->
<!-- 场景：桌面网页中的数据表格、列表、图表、配置器等需要放入可复用面板，并包含标题、工具栏、左中右主体或底栏。 -->
<!-- 业务含义：面板只维护稳定区域和伸缩关系，内部业务控件只负责自身内容；侧栏可折叠，中央内容始终获得剩余空间并在必要时独立滚动。 -->

web_panel_regions = header,toolbar,body,footer
web_panel_body_columns = optional-left,primary-center,optional-right
web_panel_region_responsibility_must_be_stable = true
web_panel_internal_component_must_not_own_outer_layout = true

<!-- 应用装配层必须用可读的五区声明表达页面位置；基础面板只按白名单组件建立结构，禁止把应用配置当作任意 HTML 注入。 -->
web_panel_application_layout_regions = top,left,center,right,bottom
web_panel_application_layout_definition_fields = component,payload,slot,children
web_panel_application_layout_region_order_must_match_visual_order = true
web_panel_application_layout_must_be_declared_in_application_assembler = true
web_panel_application_layout_must_reference_base_component_name = true
web_panel_application_layout_payload_must_reference_standard_payload_path = true
web_panel_structure_factory_must_use_component_whitelist = true
web_panel_application_html_in_layout_config_is_forbidden = true
web_panel_unknown_layout_component_behavior = omit-and-diagnose
web_panel_public_lookup_api = get(instance-key),getLayout(instance-key),getRegion(instance-key,region-name),getComponent(instance-key,component-name,optional-slot)

<!-- 每个区域必须拥有清晰的 HTML 开始和结束注释；区域节点允许按页面用途删除，其他区域不得错位、消失或触发空节点脚本异常。 -->
web_panel_region_html_comment_must_describe = region-name,responsibility,deletion-impact
web_panel_region_comment_boundary = begin,end
web_panel_region_dom_presence_is_optional = true
web_panel_missing_region_must_not_break = sibling-layout,sibling-display,javascript-initialization
web_panel_optional_node_event_binding_pattern = query-node -> existence-check -> bind

<!-- 面板根使用纵向网格或弹性布局；主体使用独立列布局，所有可伸缩轨道必须允许内容收缩，避免 min-content 撑破浏览器。 -->
web_panel_root_layout = grid-or-flex-column
web_panel_body_layout = grid-or-flex-row
web_panel_flexible_track_must_use_minmax_zero = true
web_panel_region_must_allow_min_width_zero = true
web_panel_region_must_allow_min_height_zero = true

<!-- 左右辅助区域必须可选；桌面空间不足时优先折叠辅助区域，不得压缩中央表格到业务列不可读。 -->
web_panel_side_region_is_optional = true
web_panel_side_region_should_be_collapsible = true
web_panel_compact_viewport_priority = center-content-first
web_panel_expanded_sidebar_may_use_internal_scroll = true

<!-- 表格、图表和列表填满中央内容区，但只在自身内容视口内滚动；标题、工具栏和底栏不得随中央内容一起滚走。 -->
web_panel_center_component_fill = width-and-height
web_panel_center_overflow_owner = center-content-viewport
web_panel_header_toolbar_footer_must_remain_stable = true

<!-- 同一视觉主题下各区域复用同一表面、边框和光效令牌；需要图片边框时使用可伸缩九宫格或 border-image，不得拉伸单个角点素材。 -->
web_panel_region_skin_must_share_theme_tokens = true
web_panel_image_border_implementation = nine-slice-or-border-image
web_panel_region_decoration_must_not_block_interaction = true

<!-- 左树通过人工配置描述节点、层级、图标、数量、默认展开和业务筛选；展开与选择是独立状态，禁止点击父节点时隐式丢失当前筛选。 -->
web_tree_navigation_source = explicit-config
web_tree_node_config_fields = id,label,icon,count,expanded,children,filter
web_tree_expand_and_select_state_must_be_independent = true
web_tree_selection_must_emit_scoped_business_event = true

<!-- 面板交互必须使用原生语义控件，并同步展开状态、标签、焦点和减少动态效果偏好。 -->
web_panel_interactive_control_must_use_native_semantics = true
web_panel_collapsible_control_must_sync_aria_expanded = true
web_panel_icon_only_control_must_have_accessible_name = true
web_panel_motion_must_respect_prefers_reduced_motion = true

<!-- 交付前必须在常规桌面和紧凑桌面验证不重叠、不裁切；桌面专用复杂控件在手机宽度允许明确采用水平滚动降级，但不得伪装成已完成的移动适配。 -->
web_panel_visual_qa_viewports = desktop,compact-desktop,narrow-fallback
web_panel_region_deletion_qa = remove-one-region-at-a-time -> verify-remaining-regions
web_panel_desktop_overlap_or_clipping_is_forbidden = true
web_panel_narrow_fallback_must_be_explicit = true

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
