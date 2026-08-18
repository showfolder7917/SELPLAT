# SELPLAT 水晶界面材质规则

<!-- 问题：只生成发光边框并把中心抠除，会让窗体或菜单看起来像线框套在普通深色容器外，边缘、标题栏、内容区和底栏无法形成统一的水晶层次。 -->
<!-- 场景：SELPLAT 各应用中的水晶窗体、菜单、浮层、面板及使用九宫格图片材质的可缩放容器。 -->
<!-- 业务含义：水晶界面默认是一块包含边缘折射和内部玻璃底板的完整材质；除非设计参考明确要求空心框，否则中心禁止镂空。 -->

<!-- selplat_crystal_surface_scope 的当前独立事实为 window。 -->
selplat_crystal_surface_scope = window
<!-- selplat_crystal_surface_scope.2 的当前独立事实为 dialog。 -->
selplat_crystal_surface_scope.2 = dialog
<!-- selplat_crystal_surface_scope.3 的当前独立事实为 context_menu。 -->
selplat_crystal_surface_scope.3 = context_menu
<!-- selplat_crystal_surface_scope.4 的当前独立事实为 dropdown_menu。 -->
selplat_crystal_surface_scope.4 = dropdown_menu
<!-- selplat_crystal_surface_scope.5 的当前独立事实为 floating_panel。 -->
selplat_crystal_surface_scope.5 = floating_panel
<!-- selplat_crystal_surface_scope.6 的当前独立事实为 resizable_panel。 -->
selplat_crystal_surface_scope.6 = resizable_panel
<!-- selplat_crystal_surface_must_be_continuous 的当前独立事实为 outer_glow。 -->
selplat_crystal_surface_must_be_continuous = outer_glow
<!-- selplat_crystal_surface_must_be_continuous.2 的当前独立事实为 rounded_edge。 -->
selplat_crystal_surface_must_be_continuous.2 = rounded_edge
<!-- selplat_crystal_surface_must_be_continuous.3 的当前独立事实为 inner_highlight。 -->
selplat_crystal_surface_must_be_continuous.3 = inner_highlight
<!-- selplat_crystal_surface_must_be_continuous.4 的当前独立事实为 content_backplate。 -->
selplat_crystal_surface_must_be_continuous.4 = content_backplate
<!-- selplat_crystal_surface_center_must_not_be_hollow 的当前独立事实为 true。 -->
selplat_crystal_surface_center_must_not_be_hollow = true
<!-- selplat_crystal_hollow_frame_allowed_only_when 的当前独立事实为 explicit_design_reference_requires_hollow_center。 -->
selplat_crystal_hollow_frame_allowed_only_when = explicit_design_reference_requires_hollow_center

<!-- 九宫格图片承担完整水晶材质时必须保留中心填充；适用于边缘与中心来自同一生成素材；业务含义是缩放后仍表现为一块连续玻璃，而不是只保留四周图片。 -->
selplat_crystal_nine_slice_must_preserve = all_corners
<!-- selplat_crystal_nine_slice_must_preserve.2 的当前独立事实为 all_edges。 -->
selplat_crystal_nine_slice_must_preserve.2 = all_edges
<!-- selplat_crystal_nine_slice_must_preserve.3 的当前独立事实为 center_fill。 -->
selplat_crystal_nine_slice_must_preserve.3 = center_fill
<!-- selplat_crystal_border_image_slice_requires_fill 的当前独立事实为 true。 -->
selplat_crystal_border_image_slice_requires_fill = true
<!-- selplat_crystal_center_fill_must_be 的当前独立事实为 readable。 -->
selplat_crystal_center_fill_must_be = readable
<!-- selplat_crystal_center_fill_must_be.2 的当前独立事实为 low_detail。 -->
selplat_crystal_center_fill_must_be.2 = low_detail
<!-- selplat_crystal_center_fill_must_be.3 的当前独立事实为 stretch_safe。 -->
selplat_crystal_center_fill_must_be.3 = stretch_safe
<!-- selplat_crystal_center_fill_must_be.4 的当前独立事实为 deep_glass_surface。 -->
selplat_crystal_center_fill_must_be.4 = deep_glass_surface
<!-- selplat_crystal_runtime_asset_must_not_contain 的当前独立事实为 green_center。 -->
selplat_crystal_runtime_asset_must_not_contain = green_center
<!-- selplat_crystal_runtime_asset_must_not_contain.2 的当前独立事实为 detached_frame_only。 -->
selplat_crystal_runtime_asset_must_not_contain.2 = detached_frame_only
<!-- selplat_crystal_runtime_asset_hollow_opening_requires 的当前独立事实为 explicit_design_reference。 -->
selplat_crystal_runtime_asset_hollow_opening_requires = explicit_design_reference

<!-- 切角外侧属于页面背景而不是水晶材质；适用于 PNG/WebP 九宫格素材；业务含义是浅色或图片背景下不得暴露素材画布的黑色矩形边界。 -->
selplat_crystal_runtime_asset_outer_canvas_must_be = transparent_outside_outermost_visible_frame
<!-- selplat_crystal_runtime_asset_outer_canvas_must_not_contain 的当前独立事实为 opaque_black_rectangle。 -->
selplat_crystal_runtime_asset_outer_canvas_must_not_contain = opaque_black_rectangle
<!-- selplat_crystal_runtime_asset_outer_canvas_must_not_contain.2 的当前独立事实为 chroma_key_residue。 -->
selplat_crystal_runtime_asset_outer_canvas_must_not_contain.2 = chroma_key_residue
<!-- selplat_crystal_runtime_asset_outer_canvas_must_not_contain.3 的当前独立事实为 solid_corner_patch。 -->
selplat_crystal_runtime_asset_outer_canvas_must_not_contain.3 = solid_corner_patch
<!-- selplat_crystal_runtime_asset_alpha_qa_backgrounds 的当前独立事实为 black。 -->
selplat_crystal_runtime_asset_alpha_qa_backgrounds = black
<!-- selplat_crystal_runtime_asset_alpha_qa_backgrounds.2 的当前独立事实为 light_high_contrast。 -->
selplat_crystal_runtime_asset_alpha_qa_backgrounds.2 = light_high_contrast
<!-- selplat_crystal_runtime_asset_alpha_qa_backgrounds.3 的当前独立事实为 image_background。 -->
selplat_crystal_runtime_asset_alpha_qa_backgrounds.3 = image_background

<!-- 外层阴影和模糊必须遵循九宫格素材的真实 Alpha 轮廓；适用于切角菜单、浮层和窗口；业务含义是素材已透明的四角不得被普通矩形盒阴影、描边或 backdrop-filter 再次填出直角。 -->
selplat_crystal_outer_effect_must_follow = runtime_asset_alpha_shape
<!-- selplat_crystal_outer_effect_preferred_implementation 的当前独立事实为 filter_drop_shadow。 -->
selplat_crystal_outer_effect_preferred_implementation = filter_drop_shadow
<!-- selplat_crystal_outer_box_effect_must_not_use 的当前独立事实为 zero_spread_outline_shadow。 -->
selplat_crystal_outer_box_effect_must_not_use = zero_spread_outline_shadow
<!-- selplat_crystal_outer_box_effect_must_not_use.2 的当前独立事实为 rectangular_backdrop_filter。 -->
selplat_crystal_outer_box_effect_must_not_use.2 = rectangular_backdrop_filter
<!-- selplat_crystal_outer_box_effect_must_not_use.3 的当前独立事实为 opaque_background_fill。 -->
selplat_crystal_outer_box_effect_must_not_use.3 = opaque_background_fill
<!-- selplat_crystal_outer_content_clipping_owner 的当前独立事实为 inner_content_viewport。 -->
selplat_crystal_outer_content_clipping_owner = inner_content_viewport

<!-- 标题栏、内容区和底栏可以用轻微明暗或分隔线表达功能边界，但不得覆盖成互不相干的厚重色块；业务含义是用户首先感知到完整窗体，其次才看到内部区域。 -->
selplat_crystal_internal_region_hierarchy = continuous_surface_first
<!-- selplat_crystal_internal_region_hierarchy.2 的当前独立事实为 functional_divider_second。 -->
selplat_crystal_internal_region_hierarchy.2 = functional_divider_second
<!-- selplat_crystal_header_body_footer_must_share_same_base_surface 的当前独立事实为 true。 -->
selplat_crystal_header_body_footer_must_share_same_base_surface = true
<!-- selplat_crystal_internal_region_independent_opaque_plate_is_forbidden 的当前独立事实为 true。 -->
selplat_crystal_internal_region_independent_opaque_plate_is_forbidden = true
<!-- selplat_crystal_internal_divider_must_be 的当前独立事实为 subtle。 -->
selplat_crystal_internal_divider_must_be = subtle
<!-- selplat_crystal_internal_divider_must_be.2 的当前独立事实为 low_contrast。 -->
selplat_crystal_internal_divider_must_be.2 = low_contrast
<!-- selplat_crystal_internal_divider_must_be.3 的当前独立事实为 geometry_stable。 -->
selplat_crystal_internal_divider_must_be.3 = geometry_stable

<!-- 可交互内容必须落在 border-image 的内侧安全区；适用于选中高亮、菜单项、滚动条、缩略图和滑杆；业务含义是内容盒在数学边界内仍不得压住发光边框或被边框遮挡。 -->
selplat_crystal_content_safe_area_must_cover = selected_highlight
<!-- selplat_crystal_content_safe_area_must_cover.2 的当前独立事实为 menu_item。 -->
selplat_crystal_content_safe_area_must_cover.2 = menu_item
<!-- selplat_crystal_content_safe_area_must_cover.3 的当前独立事实为 scrollbar。 -->
selplat_crystal_content_safe_area_must_cover.3 = scrollbar
<!-- selplat_crystal_content_safe_area_must_cover.4 的当前独立事实为 thumbnail。 -->
selplat_crystal_content_safe_area_must_cover.4 = thumbnail
<!-- selplat_crystal_content_safe_area_must_cover.5 的当前独立事实为 range_control。 -->
selplat_crystal_content_safe_area_must_cover.5 = range_control
<!-- selplat_crystal_content_must_not_paint_into 的当前独立事实为 border_image_band。 -->
selplat_crystal_content_must_not_paint_into = border_image_band
<!-- selplat_crystal_content_must_not_paint_into.2 的当前独立事实为 outer_glow_band。 -->
selplat_crystal_content_must_not_paint_into.2 = outer_glow_band
<!-- selplat_crystal_content_must_not_paint_into.3 的当前独立事实为 cut_corner_band。 -->
selplat_crystal_content_must_not_paint_into.3 = cut_corner_band
<!-- selplat_crystal_content_negative_margin_into_frame_is_forbidden 的当前独立事实为 true。 -->
selplat_crystal_content_negative_margin_into_frame_is_forbidden = true
<!-- selplat_crystal_horizontal_overflow_qa 的当前独立事实为 content_scroll_width <= content_client_width。 -->
selplat_crystal_horizontal_overflow_qa = content_scroll_width <= content_client_width

<!-- 菜单和浮层靠近宿主或视口边缘时必须按实测矩形回收，并将超长内容交给内部滚动；业务含义是主菜单、二级菜单和背景选择器在任意桌面可见高度都保留完整边框。 -->
selplat_crystal_floating_surface_boundary_source = nearest_visible_host_then_viewport
<!-- selplat_crystal_floating_surface_safe_gap_px_min 的当前独立事实为 8。 -->
selplat_crystal_floating_surface_safe_gap_px_min = 8
<!-- selplat_crystal_floating_surface_vertical_overflow_strategy 的当前独立事实为 clamp_outer_frame_and_scroll_inner_viewport。 -->
selplat_crystal_floating_surface_vertical_overflow_strategy = clamp_outer_frame_and_scroll_inner_viewport
<!-- selplat_crystal_nested_menu_must_clamp 的当前独立事实为 horizontal_direction。 -->
selplat_crystal_nested_menu_must_clamp = horizontal_direction
<!-- selplat_crystal_nested_menu_must_clamp.2 的当前独立事实为 vertical_position。 -->
selplat_crystal_nested_menu_must_clamp.2 = vertical_position
<!-- selplat_crystal_nested_menu_must_clamp.3 的当前独立事实为 available_height。 -->
selplat_crystal_nested_menu_must_clamp.3 = available_height

<!-- 圆角、光点和折射集中在不可拉伸角区，直边中段与中心保持低纹理；适用于拖拽缩放和最大化；业务含义是任何尺寸下都不拉扁角部灯光或暴露拼接缝。 -->
selplat_crystal_stretchable_asset_detail_distribution = rich_corners
<!-- selplat_crystal_stretchable_asset_detail_distribution.2 的当前独立事实为 simple_edge_middles。 -->
selplat_crystal_stretchable_asset_detail_distribution.2 = simple_edge_middles
<!-- selplat_crystal_stretchable_asset_detail_distribution.3 的当前独立事实为 calm_center。 -->
selplat_crystal_stretchable_asset_detail_distribution.3 = calm_center
<!-- selplat_crystal_resize_must_preserve 的当前独立事实为 corner_radius。 -->
selplat_crystal_resize_must_preserve = corner_radius
<!-- selplat_crystal_resize_must_preserve.2 的当前独立事实为 corner_glints。 -->
selplat_crystal_resize_must_preserve.2 = corner_glints
<!-- selplat_crystal_resize_must_preserve.3 的当前独立事实为 edge_continuity。 -->
selplat_crystal_resize_must_preserve.3 = edge_continuity
<!-- selplat_crystal_resize_must_preserve.4 的当前独立事实为 center_readability。 -->
selplat_crystal_resize_must_preserve.4 = center_readability
<!-- selplat_crystal_full_raster_uniform_stretch_is_forbidden 的当前独立事实为 true。 -->
selplat_crystal_full_raster_uniform_stretch_is_forbidden = true

<!-- CSS 几何相等不能替代源素材轮廓验收；适用于要求视觉对称的面板与窗口；业务含义是九宫格源图左右与上下两组透明内缩、切角、边框厚度、发光占用和中部凹槽必须分别以垂直、水平中轴互为镜像，避免窄侧栏出现单侧鼓出或上下厚度不同。 -->
selplat_crystal_symmetric_frame_source_axes = horizontal
<!-- selplat_crystal_symmetric_frame_source_axes.2 的当前独立事实为 vertical。 -->
selplat_crystal_symmetric_frame_source_axes.2 = vertical
<!-- selplat_crystal_symmetric_frame_source_must_mirror 的当前独立事实为 inner_contour。 -->
selplat_crystal_symmetric_frame_source_must_mirror = inner_contour
<!-- selplat_crystal_symmetric_frame_source_must_mirror.2 的当前独立事实为 transparent_inset。 -->
selplat_crystal_symmetric_frame_source_must_mirror.2 = transparent_inset
<!-- selplat_crystal_symmetric_frame_source_must_mirror.3 的当前独立事实为 bevel_thickness。 -->
selplat_crystal_symmetric_frame_source_must_mirror.3 = bevel_thickness
<!-- selplat_crystal_symmetric_frame_source_must_mirror.4 的当前独立事实为 cut_corner_profile。 -->
selplat_crystal_symmetric_frame_source_must_mirror.4 = cut_corner_profile
<!-- selplat_crystal_symmetric_frame_source_must_mirror.5 的当前独立事实为 glow_footprint。 -->
selplat_crystal_symmetric_frame_source_must_mirror.5 = glow_footprint
<!-- selplat_crystal_symmetric_frame_source_must_mirror.6 的当前独立事实为 center_notch。 -->
selplat_crystal_symmetric_frame_source_must_mirror.6 = center_notch
<!-- selplat_crystal_symmetric_frame_qa_must_cover 的当前独立事实为 source_horizontal_pixel_mirror_difference。 -->
selplat_crystal_symmetric_frame_qa_must_cover = source_horizontal_pixel_mirror_difference
<!-- selplat_crystal_symmetric_frame_qa_must_cover.2 的当前独立事实为 source_vertical_pixel_mirror_difference。 -->
selplat_crystal_symmetric_frame_qa_must_cover.2 = source_vertical_pixel_mirror_difference
<!-- selplat_crystal_symmetric_frame_qa_must_cover.3 的当前独立事实为 browser_narrow_panel。 -->
selplat_crystal_symmetric_frame_qa_must_cover.3 = browser_narrow_panel
<!-- selplat_crystal_symmetric_frame_qa_must_cover.4 的当前独立事实为 browser_wide_panel。 -->
selplat_crystal_symmetric_frame_qa_must_cover.4 = browser_wide_panel
<!-- selplat_crystal_symmetric_frame_qa_must_cover.5 的当前独立事实为 browser_window。 -->
selplat_crystal_symmetric_frame_qa_must_cover.5 = browser_window
<!-- selplat_crystal_symmetric_frame_qa_must_cover.6 的当前独立事实为 browser_floating_panel。 -->
selplat_crystal_symmetric_frame_qa_must_cover.6 = browser_floating_panel
<!-- selplat_crystal_equal_css_border_width_or_height_without_source_asset_symmetry_is_insufficient 的当前独立事实为 true。 -->
selplat_crystal_equal_css_border_width_or_height_without_source_asset_symmetry_is_insufficient = true

<!-- 可调整窗口必须把移动、八方向缩放、最小尺寸、视口夹取、最大化和精确还原作为同一几何状态机；业务含义是任一入口都不能产生不可触达窗口、丢失用户尺寸或挤掉主要操作。 -->
selplat_resizable_window_drag_surface = header_excluding_window_controls
<!-- selplat_resizable_window_resize_directions 的当前独立事实为 north。 -->
selplat_resizable_window_resize_directions = north
<!-- selplat_resizable_window_resize_directions.2 的当前独立事实为 east。 -->
selplat_resizable_window_resize_directions.2 = east
<!-- selplat_resizable_window_resize_directions.3 的当前独立事实为 south。 -->
selplat_resizable_window_resize_directions.3 = south
<!-- selplat_resizable_window_resize_directions.4 的当前独立事实为 west。 -->
selplat_resizable_window_resize_directions.4 = west
<!-- selplat_resizable_window_resize_directions.5 的当前独立事实为 north_east。 -->
selplat_resizable_window_resize_directions.5 = north_east
<!-- selplat_resizable_window_resize_directions.6 的当前独立事实为 south_east。 -->
selplat_resizable_window_resize_directions.6 = south_east
<!-- selplat_resizable_window_resize_directions.7 的当前独立事实为 south_west。 -->
selplat_resizable_window_resize_directions.7 = south_west
<!-- selplat_resizable_window_resize_directions.8 的当前独立事实为 north_west。 -->
selplat_resizable_window_resize_directions.8 = north_west
<!-- selplat_resizable_window_must_define 的当前独立事实为 minimum_width。 -->
selplat_resizable_window_must_define = minimum_width
<!-- selplat_resizable_window_must_define.2 的当前独立事实为 minimum_height。 -->
selplat_resizable_window_must_define.2 = minimum_height
<!-- selplat_resizable_window_must_define.3 的当前独立事实为 viewport_safe_gap。 -->
selplat_resizable_window_must_define.3 = viewport_safe_gap
<!-- selplat_resizable_window_geometry_must_clamp_to 的当前独立事实为 current_viewport_safe_area。 -->
selplat_resizable_window_geometry_must_clamp_to = current_viewport_safe_area
<!-- selplat_resizable_window_reduced_height_strategy 的当前独立事实为 scroll_body_keep_header_and_primary_actions_visible。 -->
selplat_resizable_window_reduced_height_strategy = scroll_body_keep_header_and_primary_actions_visible
<!-- selplat_resizable_window_maximize_must_preserve 的当前独立事实为 pre_maximize_left。 -->
selplat_resizable_window_maximize_must_preserve = pre_maximize_left
<!-- selplat_resizable_window_maximize_must_preserve.2 的当前独立事实为 pre_maximize_top。 -->
selplat_resizable_window_maximize_must_preserve.2 = pre_maximize_top
<!-- selplat_resizable_window_maximize_must_preserve.3 的当前独立事实为 pre_maximize_width。 -->
selplat_resizable_window_maximize_must_preserve.3 = pre_maximize_width
<!-- selplat_resizable_window_maximize_must_preserve.4 的当前独立事实为 pre_maximize_height。 -->
selplat_resizable_window_maximize_must_preserve.4 = pre_maximize_height
<!-- selplat_resizable_window_restore_must_return_to 的当前独立事实为 exact_pre_maximize_geometry_clamped_to_current_viewport。 -->
selplat_resizable_window_restore_must_return_to = exact_pre_maximize_geometry_clamped_to_current_viewport
<!-- selplat_resizable_window_maximized_resize_handles 的当前独立事实为 disabled。 -->
selplat_resizable_window_maximized_resize_handles = disabled

<!-- 交付必须同时检查默认尺寸、放大尺寸和最大化还原后的完整材质；适用于真实浏览器终审；业务含义是静态源图好看不能替代运行时整体性验证。 -->
selplat_crystal_visual_qa_states = default
<!-- selplat_crystal_visual_qa_states.2 的当前独立事实为 resized。 -->
selplat_crystal_visual_qa_states.2 = resized
<!-- selplat_crystal_visual_qa_states.3 的当前独立事实为 maximized。 -->
selplat_crystal_visual_qa_states.3 = maximized
<!-- selplat_crystal_visual_qa_states.4 的当前独立事实为 restored。 -->
selplat_crystal_visual_qa_states.4 = restored
<!-- selplat_crystal_visual_qa_must_compare 的当前独立事实为 source_reference。 -->
selplat_crystal_visual_qa_must_compare = source_reference
<!-- selplat_crystal_visual_qa_must_compare.2 的当前独立事实为 browser_rendered_result。 -->
selplat_crystal_visual_qa_must_compare.2 = browser_rendered_result
<!-- selplat_crystal_visual_qa_must_reject 的当前独立事实为 detached_border。 -->
selplat_crystal_visual_qa_must_reject = detached_border
<!-- selplat_crystal_visual_qa_must_reject.2 的当前独立事实为 unapproved_flat_hollow_center。 -->
selplat_crystal_visual_qa_must_reject.2 = unapproved_flat_hollow_center
<!-- selplat_crystal_visual_qa_must_reject.3 的当前独立事实为 square_corner_leak。 -->
selplat_crystal_visual_qa_must_reject.3 = square_corner_leak
<!-- selplat_crystal_visual_qa_must_reject.4 的当前独立事实为 rectangular_effect_behind_cut_corner。 -->
selplat_crystal_visual_qa_must_reject.4 = rectangular_effect_behind_cut_corner
<!-- selplat_crystal_visual_qa_must_reject.5 的当前独立事实为 stretched_glint。 -->
selplat_crystal_visual_qa_must_reject.5 = stretched_glint
<!-- selplat_crystal_visual_qa_must_reject.6 的当前独立事实为 internal_plate_fragmentation。 -->
selplat_crystal_visual_qa_must_reject.6 = internal_plate_fragmentation
<!-- selplat_crystal_visual_qa_must_reject.7 的当前独立事实为 asymmetric_inner_contour。 -->
selplat_crystal_visual_qa_must_reject.7 = asymmetric_inner_contour
<!-- selplat_crystal_visual_qa_must_reject.8 的当前独立事实为 asymmetric_top_bottom_profile。 -->
selplat_crystal_visual_qa_must_reject.8 = asymmetric_top_bottom_profile

<!-- java_ability_refs 的当前独立事实为 none。 -->
java_ability_refs = none
<!-- python_ability_refs 的当前独立事实为 none。 -->
python_ability_refs = none
<!-- node_ability_refs 的当前独立事实为 none。 -->
node_ability_refs = none
