# 网页个性化面板设置规则

<!-- 问题：把背景、面板材质、边框间距和动效分别散落在页面中，会导致入口重复、颜色写死，并在换皮肤或浮层定位时产生回归。 -->
<!-- 场景：网页需要用一个个性化入口管理背景以及面板外观、边框间距、动效和预设，同时允许刷新恢复默认。 -->
<!-- 业务含义：个性化外壳只负责组合独立能力和实时参数；背景仍是独立模块，所有水晶表面共享可换肤 token。 -->

<!-- web_personalization_top_level_sections 的当前独立事实为 background。 -->
web_personalization_top_level_sections = background
<!-- web_personalization_top_level_sections.2 的当前独立事实为 panel。 -->
web_personalization_top_level_sections.2 = panel
<!-- web_personalization_top_level_sections.3 的当前独立事实为 text。 -->
web_personalization_top_level_sections.3 = text
<!-- web_personalization_panel_groups 的当前独立事实为 presets。 -->
web_personalization_panel_groups = presets
<!-- web_personalization_panel_groups.2 的当前独立事实为 appearance。 -->
web_personalization_panel_groups.2 = appearance
<!-- web_personalization_panel_groups.3 的当前独立事实为 border-spacing。 -->
web_personalization_panel_groups.3 = border-spacing
<!-- web_personalization_panel_groups.4 的当前独立事实为 motion。 -->
web_personalization_panel_groups.4 = motion
<!-- web_personalization_text_groups 的当前独立事实为 mode。 -->
web_personalization_text_groups = mode
<!-- web_personalization_text_groups.2 的当前独立事实为 main-color。 -->
web_personalization_text_groups.2 = main-color
<!-- web_personalization_text_groups.3 的当前独立事实为 muted-color。 -->
web_personalization_text_groups.3 = muted-color
<!-- web_personalization_text_groups.4 的当前独立事实为 contrast。 -->
web_personalization_text_groups.4 = contrast
<!-- web_personalization_text_groups.5 的当前独立事实为 font-scale。 -->
web_personalization_text_groups.5 = font-scale
<!-- web_personalization_background_must_compose 的当前独立事实为 independent-background-controller。 -->
web_personalization_background_must_compose = independent-background-controller
<!-- web_personalization_must_not_merge_background_state_into_business-control 的当前独立事实为 true。 -->
web_personalization_must_not_merge_background_state_into_business-control = true

<!-- 面向用户的强度默认使用 0%–100%，仅允许经规则显式登记的几何比例项扩展上限；实现层仍映射到组件安全范围。 -->
web_personalization_default_user_range = 0..100
<!-- web_personalization_user_range_exceptions 的当前独立事实为 inner-panel-fit:0..150。 -->
web_personalization_user_range_exceptions = inner-panel-fit:0..150
<!-- web_personalization_range_must_map_to 的当前独立事实为 component-safe-css-token-range。 -->
web_personalization_range_must_map_to = component-safe-css-token-range
<!-- web_personalization_frame_scale_neutral_value 的当前独立事实为 50。 -->
web_personalization_frame_scale_neutral_value = 50
<!-- web_personalization_spacing_offset_neutral_value 的当前独立事实为 50。 -->
web_personalization_spacing_offset_neutral_value = 50
<!-- web_personalization_component_frame_baseline_must_be_preserved 的当前独立事实为 panel。 -->
web_personalization_component_frame_baseline_must_be_preserved = panel
<!-- web_personalization_component_frame_baseline_must_be_preserved.2 的当前独立事实为 window。 -->
web_personalization_component_frame_baseline_must_be_preserved.2 = window
<!-- web_personalization_component_frame_baseline_must_be_preserved.3 的当前独立事实为 dropdown。 -->
web_personalization_component_frame_baseline_must_be_preserved.3 = dropdown
<!-- web_personalization_component_frame_baseline_must_be_preserved.4 的当前独立事实为 context-menu。 -->
web_personalization_component_frame_baseline_must_be_preserved.4 = context-menu
<!-- web_personalization_component_frame_baseline_must_be_preserved.5 的当前独立事实为 date-picker。 -->
web_personalization_component_frame_baseline_must_be_preserved.5 = date-picker

<!-- 面板透明度只驱动普通结构层；悬停、选中和主操作保持固定强度，仅跟随统一主题色。 -->
web_personalization_panel_opacity_target = center-glass-backplate
<!-- web_personalization_panel_opacity_target.2 的当前独立事实为 table-board。 -->
web_personalization_panel_opacity_target.2 = table-board
<!-- web_personalization_panel_opacity_target.3 的当前独立事实为 table-header。 -->
web_personalization_panel_opacity_target.3 = table-header
<!-- web_personalization_panel_opacity_target.4 的当前独立事实为 table-normal-row。 -->
web_personalization_panel_opacity_target.4 = table-normal-row
<!-- web_personalization_panel_opacity_target.5 的当前独立事实为 table-zebra-row。 -->
web_personalization_panel_opacity_target.5 = table-zebra-row
<!-- web_personalization_panel_opacity_target.6 的当前独立事实为 control-base-surface。 -->
web_personalization_panel_opacity_target.6 = control-base-surface
<!-- web_personalization_panel_opacity_must_not_fade 的当前独立事实为 text。 -->
web_personalization_panel_opacity_must_not_fade = text
<!-- web_personalization_panel_opacity_must_not_fade.2 的当前独立事实为 icons。 -->
web_personalization_panel_opacity_must_not_fade.2 = icons
<!-- web_personalization_panel_opacity_must_not_fade.3 的当前独立事实为 semantic-content。 -->
web_personalization_panel_opacity_must_not_fade.3 = semantic-content
<!-- web_personalization_panel_opacity_must_not_fade.4 的当前独立事实为 nine-slice-frame。 -->
web_personalization_panel_opacity_must_not_fade.4 = nine-slice-frame
<!-- web_personalization_panel_opacity_must_not_fade.5 的当前独立事实为 hover-surface。 -->
web_personalization_panel_opacity_must_not_fade.5 = hover-surface
<!-- web_personalization_panel_opacity_must_not_fade.6 的当前独立事实为 selected-surface。 -->
web_personalization_panel_opacity_must_not_fade.6 = selected-surface
<!-- web_personalization_panel_opacity_must_not_fade.7 的当前独立事实为 primary-surface。 -->
web_personalization_panel_opacity_must_not_fade.7 = primary-surface
<!-- web_personalization_structure_opacity_must_use 的当前独立事实为 unified-structure-opacity-token。 -->
web_personalization_structure_opacity_must_use = unified-structure-opacity-token
<!-- web_personalization_structure_opacity_must_use.2 的当前独立事实为 table-surface-mapping-tokens。 -->
web_personalization_structure_opacity_must_use.2 = table-surface-mapping-tokens
<!-- web_personalization_structure_opacity_must_use.3 的当前独立事实为 control-base-surface-mapping-token。 -->
web_personalization_structure_opacity_must_use.3 = control-base-surface-mapping-token
<!-- web_personalization_interaction_surface_must_use 的当前独立事实为 unified-theme-color。 -->
web_personalization_interaction_surface_must_use = unified-theme-color
<!-- web_personalization_interaction_surface_must_use.2 的当前独立事实为 fixed-hover-strength。 -->
web_personalization_interaction_surface_must_use.2 = fixed-hover-strength
<!-- web_personalization_interaction_surface_must_use.3 的当前独立事实为 fixed-selected-strength。 -->
web_personalization_interaction_surface_must_use.3 = fixed-selected-strength
<!-- web_personalization_interaction_surface_must_use.4 的当前独立事实为 fixed-primary-strength。 -->
web_personalization_interaction_surface_must_use.4 = fixed-primary-strength
<!-- web_personalization_table_normal_layers_must_not_compound_to_opaque 的当前独立事实为 true。 -->
web_personalization_table_normal_layers_must_not_compound_to_opaque = true
<!-- web_personalization_data_interaction_fixed_strength 的当前独立事实为 tree-hover:0.68。 -->
web_personalization_data_interaction_fixed_strength = tree-hover:0.68
<!-- web_personalization_data_interaction_fixed_strength.2 的当前独立事实为 table-hover:0.68。 -->
web_personalization_data_interaction_fixed_strength.2 = table-hover:0.68
<!-- web_personalization_data_interaction_fixed_strength.3 的当前独立事实为 tree-selected:0.78。 -->
web_personalization_data_interaction_fixed_strength.3 = tree-selected:0.78
<!-- web_personalization_data_interaction_fixed_strength.4 的当前独立事实为 table-selected:0.78。 -->
web_personalization_data_interaction_fixed_strength.4 = table-selected:0.78
<!-- web_personalization_control_interaction_strength 的当前独立事实为 base-opacity-mapped:0.25..0.84。 -->
web_personalization_control_interaction_strength = base-opacity-mapped:0.25..0.84
<!-- web_personalization_control_interaction_strength.2 的当前独立事实为 hover-fixed:0.72。 -->
web_personalization_control_interaction_strength.2 = hover-fixed:0.72
<!-- web_personalization_control_interaction_strength.3 的当前独立事实为 primary-fixed:0.82。 -->
web_personalization_control_interaction_strength.3 = primary-fixed:0.82
<!-- web_personalization_selection_feedback_must_be_immediate 的当前独立事实为 row-selected。 -->
web_personalization_selection_feedback_must_be_immediate = row-selected
<!-- web_personalization_selection_feedback_must_be_immediate.2 的当前独立事实为 selection-checkbox。 -->
web_personalization_selection_feedback_must_be_immediate.2 = selection-checkbox
<!-- web_personalization_selection_feedback_must_be_immediate.3 的当前独立事实为 aria-selected。 -->
web_personalization_selection_feedback_must_be_immediate.3 = aria-selected
<!-- web_personalization_selection_feedback_must_be_immediate.4 的当前独立事实为 aria-checked。 -->
web_personalization_selection_feedback_must_be_immediate.4 = aria-checked
<!-- web_personalization_table_semantic_content_must_not_fade 的当前独立事实为 avatar。 -->
web_personalization_table_semantic_content_must_not_fade = avatar
<!-- web_personalization_table_semantic_content_must_not_fade.2 的当前独立事实为 status-badge。 -->
web_personalization_table_semantic_content_must_not_fade.2 = status-badge
<!-- web_personalization_table_semantic_content_must_not_fade.3 的当前独立事实为 progress-bar。 -->
web_personalization_table_semantic_content_must_not_fade.3 = progress-bar
<!-- web_personalization_table_semantic_content_must_not_fade.4 的当前独立事实为 row-actions。 -->
web_personalization_table_semantic_content_must_not_fade.4 = row-actions
<!-- web_personalization_table_semantic_content_must_not_fade.5 的当前独立事实为 selection-control。 -->
web_personalization_table_semantic_content_must_not_fade.5 = selection-control
<!-- web_personalization_panel_material_controls 的当前独立事实为 opacity。 -->
web_personalization_panel_material_controls = opacity
<!-- web_personalization_panel_material_controls.2 的当前独立事实为 background-frost。 -->
web_personalization_panel_material_controls.2 = background-frost
<!-- web_personalization_panel_material_controls.3 的当前独立事实为 unified-theme-color。 -->
web_personalization_panel_material_controls.3 = unified-theme-color
<!-- web_personalization_panel_material_controls.4 的当前独立事实为 current-skin-tint-strength。 -->
web_personalization_panel_material_controls.4 = current-skin-tint-strength
<!-- web_personalization_panel_material_controls.5 的当前独立事实为 surface-radius。 -->
web_personalization_panel_material_controls.5 = surface-radius
<!-- web_personalization_background_frost_must_combine 的当前独立事实为 backdrop-blur。 -->
web_personalization_background_frost_must_combine = backdrop-blur
<!-- web_personalization_background_frost_must_combine.2 的当前独立事实为 brightness-reduction。 -->
web_personalization_background_frost_must_combine.2 = brightness-reduction
<!-- web_personalization_background_frost_must_combine.3 的当前独立事实为 saturation-reduction。 -->
web_personalization_background_frost_must_combine.3 = saturation-reduction
<!-- web_personalization_background_frost_must_combine.4 的当前独立事实为 independent-neutral-veil。 -->
web_personalization_background_frost_must_combine.4 = independent-neutral-veil
<!-- web_personalization_background_frost_must_not_depend_on 的当前独立事实为 panel-opacity。 -->
web_personalization_background_frost_must_not_depend_on = panel-opacity
<!-- web_personalization_background_frost_must_not_affect 的当前独立事实为 panel-content。 -->
web_personalization_background_frost_must_not_affect = panel-content
<!-- web_personalization_background_frost_must_not_affect.2 的当前独立事实为 text。 -->
web_personalization_background_frost_must_not_affect.2 = text
<!-- web_personalization_background_frost_must_not_affect.3 的当前独立事实为 icons。 -->
web_personalization_background_frost_must_not_affect.3 = icons
<!-- web_personalization_background_frost_must_not_affect.4 的当前独立事实为 controls。 -->
web_personalization_background_frost_must_not_affect.4 = controls
<!-- web_personalization_background_frost_must_not_affect.5 的当前独立事实为 nine-slice-frame。 -->
web_personalization_background_frost_must_not_affect.5 = nine-slice-frame
<!-- web_personalization_background_frost_target 的当前独立事实为 panel。 -->
web_personalization_background_frost_target = panel
<!-- web_personalization_background_frost_target.2 的当前独立事实为 window。 -->
web_personalization_background_frost_target.2 = window
<!-- web_personalization_background_frost_target.3 的当前独立事实为 personalization-panel。 -->
web_personalization_background_frost_target.3 = personalization-panel
<!-- web_personalization_background_frost_target.4 的当前独立事实为 dropdown。 -->
web_personalization_background_frost_target.4 = dropdown
<!-- web_personalization_background_frost_target.5 的当前独立事实为 context-menu。 -->
web_personalization_background_frost_target.5 = context-menu
<!-- web_personalization_background_frost_target.6 的当前独立事实为 date-picker。 -->
web_personalization_background_frost_target.6 = date-picker
<!-- web_personalization_background_frost_geometry_must_equal 的当前独立事实为 inner-glass-backplate-size。 -->
web_personalization_background_frost_geometry_must_equal = inner-glass-backplate-size
<!-- web_personalization_background_frost_geometry_must_equal.2 的当前独立事实为 inner-glass-backplate-inset。 -->
web_personalization_background_frost_geometry_must_equal.2 = inner-glass-backplate-inset
<!-- web_personalization_background_frost_geometry_must_equal.3 的当前独立事实为 inner-glass-backplate-radius。 -->
web_personalization_background_frost_geometry_must_equal.3 = inner-glass-backplate-radius
<!-- web_personalization_background_frost_geometry_must_follow 的当前独立事实为 unified-large-surface-inset-token。 -->
web_personalization_background_frost_geometry_must_follow = unified-large-surface-inset-token
<!-- web_personalization_background_frost_geometry_must_follow.2 的当前独立事实为 unified-popup-inset-token。 -->
web_personalization_background_frost_geometry_must_follow.2 = unified-popup-inset-token
<!-- web_personalization_background_frost_geometry_must_follow.3 的当前独立事实为 shared-inner-backplate-token。 -->
web_personalization_background_frost_geometry_must_follow.3 = shared-inner-backplate-token
<!-- web_personalization_background_frost_must_not_attach_to 的当前独立事实为 outer-crystal-frame-border-box。 -->
web_personalization_background_frost_must_not_attach_to = outer-crystal-frame-border-box
<!-- web_personalization_window_material_layer_order 的当前独立事实为 background-frost:0。 -->
web_personalization_window_material_layer_order = background-frost:0
<!-- web_personalization_window_material_layer_order.2 的当前独立事实为 interactive-content:1。 -->
web_personalization_window_material_layer_order.2 = interactive-content:1
<!-- web_personalization_window_material_layer_order.3 的当前独立事实为 crystal-frame:2。 -->
web_personalization_window_material_layer_order.3 = crystal-frame:2
<!-- web_personalization_window_material_layer_order.4 的当前独立事实为 resize-handles:above-frame。 -->
web_personalization_window_material_layer_order.4 = resize-handles:above-frame
<!-- web_personalization_window_material_must_create 的当前独立事实为 positioned-z-index-stacking-context-without-backdrop-root。 -->
web_personalization_window_material_must_create = positioned-z-index-stacking-context-without-backdrop-root
<!-- web_personalization_window_background_frost_must_sample 的当前独立事实为 content-behind-window-outside-window-stacking-context。 -->
web_personalization_window_background_frost_must_sample = content-behind-window-outside-window-stacking-context
<!-- web_personalization_window_background_frost_must_not_use 的当前独立事实为 isolation-isolate。 -->
web_personalization_window_background_frost_must_not_use = isolation-isolate
<!-- web_personalization_window_background_frost_must_not_use.2 的当前独立事实为 ancestor-filter。 -->
web_personalization_window_background_frost_must_not_use.2 = ancestor-filter
<!-- web_personalization_window_background_frost_must_not_use.3 的当前独立事实为 ancestor-backdrop-filter。 -->
web_personalization_window_background_frost_must_not_use.3 = ancestor-backdrop-filter
<!-- web_personalization_window_entrance_animation_must_release_after_finish 的当前独立事实为 transform。 -->
web_personalization_window_entrance_animation_must_release_after_finish = transform
<!-- web_personalization_window_entrance_animation_must_release_after_finish.2 的当前独立事实为 translate。 -->
web_personalization_window_entrance_animation_must_release_after_finish.2 = translate
<!-- web_personalization_window_entrance_animation_must_release_after_finish.3 的当前独立事实为 scale。 -->
web_personalization_window_entrance_animation_must_release_after_finish.3 = scale
<!-- web_personalization_window_entrance_animation_must_release_after_finish.4 的当前独立事实为 opacity-compositing-layer。 -->
web_personalization_window_entrance_animation_must_release_after_finish.4 = opacity-compositing-layer
<!-- web_personalization_window_entrance_animation_fill_mode_must_not_be 的当前独立事实为 forwards。 -->
web_personalization_window_entrance_animation_fill_mode_must_not_be = forwards
<!-- web_personalization_window_entrance_animation_fill_mode_must_not_be.2 的当前独立事实为 both。 -->
web_personalization_window_entrance_animation_fill_mode_must_not_be.2 = both
<!-- web_personalization_window_material_must_not_rely_on 的当前独立事实为 negative-z-index-for-frost。 -->
web_personalization_window_material_must_not_rely_on = negative-z-index-for-frost
<!-- web_personalization_window_material_must_not_rely_on.2 的当前独立事实为 negative-z-index-for-frame。 -->
web_personalization_window_material_must_not_rely_on.2 = negative-z-index-for-frame
<!-- web_personalization_skin_tint_must_use 的当前独立事实为 overridable-theme-rgb-tokens。 -->
web_personalization_skin_tint_must_use = overridable-theme-rgb-tokens
<!-- web_personalization_skin_tint_must_not_hardcode 的当前独立事实为 deep-blue。 -->
web_personalization_skin_tint_must_not_hardcode = deep-blue
<!-- web_personalization_skin_tint_must_not_hardcode.2 的当前独立事实为 purple。 -->
web_personalization_skin_tint_must_not_hardcode.2 = purple
<!-- web_personalization_skin_tint_must_not_hardcode.3 的当前独立事实为 background-derived-color。 -->
web_personalization_skin_tint_must_not_hardcode.3 = background-derived-color
<!-- web_personalization_unified_theme_color_modes 的当前独立事实为 follow-current-skin。 -->
web_personalization_unified_theme_color_modes = follow-current-skin
<!-- web_personalization_unified_theme_color_modes.2 的当前独立事实为 arbitrary-color。 -->
web_personalization_unified_theme_color_modes.2 = arbitrary-color
<!-- web_personalization_unified_theme_color_modes.3 的当前独立事实为 quick-swatches。 -->
web_personalization_unified_theme_color_modes.3 = quick-swatches
<!-- web_personalization_unified_theme_color_must_affect 的当前独立事实为 crystal-frame-glow。 -->
web_personalization_unified_theme_color_must_affect = crystal-frame-glow
<!-- web_personalization_unified_theme_color_must_affect.2 的当前独立事实为 glass-backplate。 -->
web_personalization_unified_theme_color_must_affect.2 = glass-backplate
<!-- web_personalization_unified_theme_color_must_affect.3 的当前独立事实为 header。 -->
web_personalization_unified_theme_color_must_affect.3 = header
<!-- web_personalization_unified_theme_color_must_affect.4 的当前独立事实为 toolbar。 -->
web_personalization_unified_theme_color_must_affect.4 = toolbar
<!-- web_personalization_unified_theme_color_must_affect.5 的当前独立事实为 navigation。 -->
web_personalization_unified_theme_color_must_affect.5 = navigation
<!-- web_personalization_unified_theme_color_must_affect.6 的当前独立事实为 form-control。 -->
web_personalization_unified_theme_color_must_affect.6 = form-control
<!-- web_personalization_unified_theme_color_must_affect.7 的当前独立事实为 table-structure。 -->
web_personalization_unified_theme_color_must_affect.7 = table-structure
<!-- web_personalization_unified_theme_color_must_affect.8 的当前独立事实为 floating-surface。 -->
web_personalization_unified_theme_color_must_affect.8 = floating-surface
<!-- web_personalization_unified_theme_color_must_affect.9 的当前独立事实为 glow。 -->
web_personalization_unified_theme_color_must_affect.9 = glow
<!-- web_personalization_unified_theme_color_must_affect.10 的当前独立事实为 selected-state。 -->
web_personalization_unified_theme_color_must_affect.10 = selected-state
<!-- web_personalization_unified_theme_color_must_affect.11 的当前独立事实为 primary-action。 -->
web_personalization_unified_theme_color_must_affect.11 = primary-action
<!-- web_personalization_unified_theme_color_must_affect.12 的当前独立事实为 range-accent。 -->
web_personalization_unified_theme_color_must_affect.12 = range-accent
<!-- web_personalization_unified_theme_color_must_affect.13 的当前独立事实为 scrollbar。 -->
web_personalization_unified_theme_color_must_affect.13 = scrollbar
<!-- web_personalization_unified_theme_color_must_not_override 的当前独立事实为 original-nine-slice-frame-image。 -->
web_personalization_unified_theme_color_must_not_override = original-nine-slice-frame-image
<!-- web_personalization_unified_theme_color_must_not_override.2 的当前独立事实为 background-image。 -->
web_personalization_unified_theme_color_must_not_override.2 = background-image
<!-- web_personalization_unified_theme_color_must_not_override.3 的当前独立事实为 body-text。 -->
web_personalization_unified_theme_color_must_not_override.3 = body-text
<!-- web_personalization_unified_theme_color_must_not_override.4 的当前独立事实为 success-color。 -->
web_personalization_unified_theme_color_must_not_override.4 = success-color
<!-- web_personalization_unified_theme_color_must_not_override.5 的当前独立事实为 warning-color。 -->
web_personalization_unified_theme_color_must_not_override.5 = warning-color
<!-- web_personalization_unified_theme_color_must_not_override.6 的当前独立事实为 error-color。 -->
web_personalization_unified_theme_color_must_not_override.6 = error-color
<!-- web_personalization_unified_theme_color_scale 的当前独立事实为 deep。 -->
web_personalization_unified_theme_color_scale = deep
<!-- web_personalization_unified_theme_color_scale.2 的当前独立事实为 base。 -->
web_personalization_unified_theme_color_scale.2 = base
<!-- web_personalization_unified_theme_color_scale.3 的当前独立事实为 raised。 -->
web_personalization_unified_theme_color_scale.3 = raised
<!-- web_personalization_unified_theme_color_scale.4 的当前独立事实为 accent。 -->
web_personalization_unified_theme_color_scale.4 = accent
<!-- web_personalization_unified_theme_color_scale_source 的当前独立事实为 selected-color。 -->
web_personalization_unified_theme_color_scale_source = selected-color
<!-- web_personalization_unified_theme_color_scale_source.2 的当前独立事实为 current-skin-tint-strength。 -->
web_personalization_unified_theme_color_scale_source.2 = current-skin-tint-strength
<!-- web_personalization_unified_theme_color_scale_source.3 的当前独立事实为 neutral-surface-token。 -->
web_personalization_unified_theme_color_scale_source.3 = neutral-surface-token
<!-- web_personalization_structural_surface_must_not_keep_previous_skin_color 的当前独立事实为 true。 -->
web_personalization_structural_surface_must_not_keep_previous_skin_color = true
<!-- web_personalization_unified_token_layers 的当前独立事实为 foundation-color。 -->
web_personalization_unified_token_layers = foundation-color
<!-- web_personalization_unified_token_layers.2 的当前独立事实为 semantic-color。 -->
web_personalization_unified_token_layers.2 = semantic-color
<!-- web_personalization_unified_token_layers.3 的当前独立事实为 component-mapping。 -->
web_personalization_unified_token_layers.3 = component-mapping
<!-- web_personalization_unified_token_layers.4 的当前独立事实为 frame-geometry。 -->
web_personalization_unified_token_layers.4 = frame-geometry
<!-- web_personalization_unified_token_prefix 的当前独立事实为 --sel-theme-。 -->
web_personalization_unified_token_prefix = --sel-theme-
<!-- web_personalization_component_must_consume_unified_tokens 的当前独立事实为 true。 -->
web_personalization_component_must_consume_unified_tokens = true
<!-- web_personalization_component_must_not_define_independent_skin_color 的当前独立事实为 true。 -->
web_personalization_component_must_not_define_independent_skin_color = true
<!-- 文字设置与背景、面板保持同级；适用于白色玻璃、深色玻璃与任意皮肤；业务含义是文字颜色、层级和字号不能继续作为面板外观的隐含副作用。 -->
web_personalization_text_settings_level = same-as-background-and-panel
<!-- web_personalization_text_modes 的当前独立事实为 follow-skin。 -->
web_personalization_text_modes = follow-skin
<!-- web_personalization_text_modes.2 的当前独立事实为 light。 -->
web_personalization_text_modes.2 = light
<!-- web_personalization_text_modes.3 的当前独立事实为 dark。 -->
web_personalization_text_modes.3 = dark
<!-- web_personalization_text_modes.4 的当前独立事实为 custom。 -->
web_personalization_text_modes.4 = custom
<!-- web_personalization_text_base_tokens 的当前独立事实为 main。 -->
web_personalization_text_base_tokens = main
<!-- web_personalization_text_base_tokens.2 的当前独立事实为 muted。 -->
web_personalization_text_base_tokens.2 = muted
<!-- web_personalization_text_derived_tokens 的当前独立事实为 title。 -->
web_personalization_text_derived_tokens = title
<!-- web_personalization_text_derived_tokens.2 的当前独立事实为 body。 -->
web_personalization_text_derived_tokens.2 = body
<!-- web_personalization_text_derived_tokens.3 的当前独立事实为 secondary。 -->
web_personalization_text_derived_tokens.3 = secondary
<!-- web_personalization_text_derived_tokens.4 的当前独立事实为 soft。 -->
web_personalization_text_derived_tokens.4 = soft
<!-- web_personalization_text_derived_tokens.5 的当前独立事实为 disabled。 -->
web_personalization_text_derived_tokens.5 = disabled
<!-- web_personalization_text_derived_tokens.6 的当前独立事实为 placeholder。 -->
web_personalization_text_derived_tokens.6 = placeholder
<!-- web_personalization_text_derived_tokens.7 的当前独立事实为 on-accent。 -->
web_personalization_text_derived_tokens.7 = on-accent
<!-- web_personalization_text_derived_tokens.8 的当前独立事实为 link。 -->
web_personalization_text_derived_tokens.8 = link
<!-- web_personalization_text_derived_tokens.9 的当前独立事实为 icon。 -->
web_personalization_text_derived_tokens.9 = icon
<!-- web_personalization_text_derived_tokens.10 的当前独立事实为 contrast-shadow。 -->
web_personalization_text_derived_tokens.10 = contrast-shadow
<!-- web_personalization_text_derived_tokens.11 的当前独立事实为 font-scale。 -->
web_personalization_text_derived_tokens.11 = font-scale
<!-- web_personalization_text_derived_source 的当前独立事实为 main。 -->
web_personalization_text_derived_source = main
<!-- web_personalization_text_derived_source.2 的当前独立事实为 muted。 -->
web_personalization_text_derived_source.2 = muted
<!-- web_personalization_text_derived_source.3 的当前独立事实为 current-theme-color。 -->
web_personalization_text_derived_source.3 = current-theme-color
<!-- web_personalization_component_neutral_text_must_consume 的当前独立事实为 unified-text-role-token。 -->
web_personalization_component_neutral_text_must_consume = unified-text-role-token
<!-- web_personalization_component_neutral_text_must_not_define 的当前独立事实为 fixed-color。 -->
web_personalization_component_neutral_text_must_not_define = fixed-color
<!-- web_personalization_component_neutral_text_must_not_define.2 的当前独立事实为 compatibility-override-only。 -->
web_personalization_component_neutral_text_must_not_define.2 = compatibility-override-only
<!-- web_personalization_text_dark_mode_default_colors 的当前独立事实为 main:#0B1633。 -->
web_personalization_text_dark_mode_default_colors = main:#0B1633
<!-- web_personalization_text_dark_mode_default_colors.2 的当前独立事实为 muted:#52617A。 -->
web_personalization_text_dark_mode_default_colors.2 = muted:#52617A
<!-- web_personalization_text_light_mode_default_colors 的当前独立事实为 main:#F7FAFF。 -->
web_personalization_text_light_mode_default_colors = main:#F7FAFF
<!-- web_personalization_text_light_mode_default_colors.2 的当前独立事实为 muted:#B8C5E2。 -->
web_personalization_text_light_mode_default_colors.2 = muted:#B8C5E2
<!-- web_personalization_text_custom_color_controls 的当前独立事实为 main-color。 -->
web_personalization_text_custom_color_controls = main-color
<!-- web_personalization_text_custom_color_controls.2 的当前独立事实为 muted-color。 -->
web_personalization_text_custom_color_controls.2 = muted-color
<!-- web_personalization_text_contrast_user_range 的当前独立事实为 0..100。 -->
web_personalization_text_contrast_user_range = 0..100
<!-- web_personalization_text_scale_user_range 的当前独立事实为 0..100。 -->
web_personalization_text_scale_user_range = 0..100
<!-- web_personalization_text_scale_css_mapping 的当前独立事实为 0:0.80。 -->
web_personalization_text_scale_css_mapping = 0:0.80
<!-- web_personalization_text_scale_css_mapping.2 的当前独立事实为 50:1.00。 -->
web_personalization_text_scale_css_mapping.2 = 50:1.00
<!-- web_personalization_text_scale_css_mapping.3 的当前独立事实为 100:1.20。 -->
web_personalization_text_scale_css_mapping.3 = 100:1.20
<!-- web_personalization_text_semantic_colors_must_not_change 的当前独立事实为 success。 -->
web_personalization_text_semantic_colors_must_not_change = success
<!-- web_personalization_text_semantic_colors_must_not_change.2 的当前独立事实为 warning。 -->
web_personalization_text_semantic_colors_must_not_change.2 = warning
<!-- web_personalization_text_semantic_colors_must_not_change.3 的当前独立事实为 error。 -->
web_personalization_text_semantic_colors_must_not_change.3 = error
<!-- web_personalization_text_semantic_colors_must_not_change.4 的当前独立事实为 progress。 -->
web_personalization_text_semantic_colors_must_not_change.4 = progress
<!-- web_personalization_text_semantic_colors_must_not_change.5 的当前独立事实为 review。 -->
web_personalization_text_semantic_colors_must_not_change.5 = review
<!-- web_personalization_text_semantic_colors_must_not_change.6 的当前独立事实为 archived。 -->
web_personalization_text_semantic_colors_must_not_change.6 = archived
<!-- web_personalization_text_control_plane_must_remain_readable 的当前独立事实为 personalization-panel。 -->
web_personalization_text_control_plane_must_remain_readable = personalization-panel
<!-- web_personalization_text_state_persistence 的当前独立事实为 ephemeral-page-state。 -->
web_personalization_text_state_persistence = ephemeral-page-state
<!-- 滚动条属于统一皮肤的一部分；页面、普通内容面板与紧凑浮层只允许使用语义尺寸档，轨道、滑块、悬停、按下、圆角和光效必须来自同一主题令牌，禁止浏览器原生白色样式与组件硬编码并存。 -->
web_personalization_scrollbar_token_parts = track
<!-- web_personalization_scrollbar_token_parts.2 的当前独立事实为 thumb。 -->
web_personalization_scrollbar_token_parts.2 = thumb
<!-- web_personalization_scrollbar_token_parts.3 的当前独立事实为 thumb-hover。 -->
web_personalization_scrollbar_token_parts.3 = thumb-hover
<!-- web_personalization_scrollbar_token_parts.4 的当前独立事实为 thumb-active。 -->
web_personalization_scrollbar_token_parts.4 = thumb-active
<!-- web_personalization_scrollbar_token_parts.5 的当前独立事实为 radius。 -->
web_personalization_scrollbar_token_parts.5 = radius
<!-- web_personalization_scrollbar_token_parts.6 的当前独立事实为 glow。 -->
web_personalization_scrollbar_token_parts.6 = glow
<!-- web_personalization_scrollbar_token_parts.7 的当前独立事实为 size-page。 -->
web_personalization_scrollbar_token_parts.7 = size-page
<!-- web_personalization_scrollbar_token_parts.8 的当前独立事实为 size-panel。 -->
web_personalization_scrollbar_token_parts.8 = size-panel
<!-- web_personalization_scrollbar_token_parts.9 的当前独立事实为 size-compact。 -->
web_personalization_scrollbar_token_parts.9 = size-compact
<!-- web_personalization_scrollbar_size_tiers 的当前独立事实为 page。 -->
web_personalization_scrollbar_size_tiers = page
<!-- web_personalization_scrollbar_size_tiers.2 的当前独立事实为 panel。 -->
web_personalization_scrollbar_size_tiers.2 = panel
<!-- web_personalization_scrollbar_size_tiers.3 的当前独立事实为 compact。 -->
web_personalization_scrollbar_size_tiers.3 = compact
<!-- web_personalization_scrollbar_page_scope 的当前独立事实为 html。 -->
web_personalization_scrollbar_page_scope = html
<!-- web_personalization_scrollbar_page_scope.2 的当前独立事实为 body。 -->
web_personalization_scrollbar_page_scope.2 = body
<!-- web_personalization_scrollbar_panel_scope 的当前独立事实为 table-scroller。 -->
web_personalization_scrollbar_panel_scope = table-scroller
<!-- web_personalization_scrollbar_panel_scope.2 的当前独立事实为 tree-scroller。 -->
web_personalization_scrollbar_panel_scope.2 = tree-scroller
<!-- web_personalization_scrollbar_panel_scope.3 的当前独立事实为 window-body。 -->
web_personalization_scrollbar_panel_scope.3 = window-body
<!-- web_personalization_scrollbar_panel_scope.4 的当前独立事实为 personalization-scroll-region。 -->
web_personalization_scrollbar_panel_scope.4 = personalization-scroll-region
<!-- web_personalization_scrollbar_compact_scope 的当前独立事实为 dropdown-viewport。 -->
web_personalization_scrollbar_compact_scope = dropdown-viewport
<!-- web_personalization_scrollbar_compact_scope.2 的当前独立事实为 context-menu-viewport。 -->
web_personalization_scrollbar_compact_scope.2 = context-menu-viewport
<!-- web_personalization_scrollbar_compact_scope.3 的当前独立事实为 submenu-viewport。 -->
web_personalization_scrollbar_compact_scope.3 = submenu-viewport
<!-- web_personalization_scrollbar_component_style_must_consume 的当前独立事实为 unified-scrollbar-tokens。 -->
web_personalization_scrollbar_component_style_must_consume = unified-scrollbar-tokens
<!-- web_personalization_scrollbar_component_must_not_define 的当前独立事实为 fixed-skin-color。 -->
web_personalization_scrollbar_component_must_not_define = fixed-skin-color
<!-- web_personalization_scrollbar_component_must_not_define.2 的当前独立事实为 fixed-pixel-size。 -->
web_personalization_scrollbar_component_must_not_define.2 = fixed-pixel-size
<!-- web_personalization_scrollbar_component_must_not_define.3 的当前独立事实为 out-of-theme-glow。 -->
web_personalization_scrollbar_component_must_not_define.3 = out-of-theme-glow
<!-- web_personalization_scrollbar_theme_change_must_update 的当前独立事实为 page。 -->
web_personalization_scrollbar_theme_change_must_update = page
<!-- web_personalization_scrollbar_theme_change_must_update.2 的当前独立事实为 panel。 -->
web_personalization_scrollbar_theme_change_must_update.2 = panel
<!-- web_personalization_scrollbar_theme_change_must_update.3 的当前独立事实为 compact。 -->
web_personalization_scrollbar_theme_change_must_update.3 = compact
<!-- web_personalization_scrollbar_must_not_cause 的当前独立事实为 outer-frame-resize。 -->
web_personalization_scrollbar_must_not_cause = outer-frame-resize
<!-- web_personalization_scrollbar_must_not_cause.2 的当前独立事实为 horizontal-page-overflow。 -->
web_personalization_scrollbar_must_not_cause.2 = horizontal-page-overflow
<!-- web_personalization_scrollbar_must_not_cause.3 的当前独立事实为 content-safe-area-overlap。 -->
web_personalization_scrollbar_must_not_cause.3 = content-safe-area-overlap
<!-- web_personalization_crystal_frame_image_must_use 的当前独立事实为 original-skin-nine-slice-asset。 -->
web_personalization_crystal_frame_image_must_use = original-skin-nine-slice-asset
<!-- web_personalization_crystal_frame_image_must_use.2 的当前独立事实为 independent-frame-layer。 -->
web_personalization_crystal_frame_image_must_use.2 = independent-frame-layer
<!-- web_personalization_crystal_frame_image_must_not_use 的当前独立事实为 runtime-canvas-tint。 -->
web_personalization_crystal_frame_image_must_not_use = runtime-canvas-tint
<!-- web_personalization_crystal_frame_image_must_not_use.2 的当前独立事实为 runtime-image-reencode。 -->
web_personalization_crystal_frame_image_must_not_use.2 = runtime-image-reencode
<!-- web_personalization_crystal_frame_image_must_not_use.3 的当前独立事实为 flat-color-overlay。 -->
web_personalization_crystal_frame_image_must_not_use.3 = flat-color-overlay
<!-- web_personalization_crystal_frame_opacity_range 的当前独立事实为 0..100。 -->
web_personalization_crystal_frame_opacity_range = 0..100
<!-- web_personalization_crystal_frame_opacity_default 的当前独立事实为 100。 -->
web_personalization_crystal_frame_opacity_default = 100
<!-- web_personalization_crystal_frame_opacity_must_affect 的当前独立事实为 original-frame-image。 -->
web_personalization_crystal_frame_opacity_must_affect = original-frame-image
<!-- web_personalization_crystal_frame_opacity_must_affect.2 的当前独立事实为 frame-static-glow。 -->
web_personalization_crystal_frame_opacity_must_affect.2 = frame-static-glow
<!-- web_personalization_crystal_frame_opacity_must_affect.3 的当前独立事实为 frame-motion-glow。 -->
web_personalization_crystal_frame_opacity_must_affect.3 = frame-motion-glow
<!-- web_personalization_crystal_frame_opacity_must_affect.4 的当前独立事实为 active-window-frame-glow。 -->
web_personalization_crystal_frame_opacity_must_affect.4 = active-window-frame-glow
<!-- web_personalization_crystal_frame_opacity_zero_state 的当前独立事实为 no-frame-image。 -->
web_personalization_crystal_frame_opacity_zero_state = no-frame-image
<!-- web_personalization_crystal_frame_opacity_zero_state.2 的当前独立事实为 no-frame-static-glow。 -->
web_personalization_crystal_frame_opacity_zero_state.2 = no-frame-static-glow
<!-- web_personalization_crystal_frame_opacity_zero_state.3 的当前独立事实为 no-frame-motion-glow。 -->
web_personalization_crystal_frame_opacity_zero_state.3 = no-frame-motion-glow
<!-- web_personalization_crystal_frame_opacity_must_not_affect 的当前独立事实为 glass-backplate。 -->
web_personalization_crystal_frame_opacity_must_not_affect = glass-backplate
<!-- web_personalization_crystal_frame_opacity_must_not_affect.2 的当前独立事实为 background-frost。 -->
web_personalization_crystal_frame_opacity_must_not_affect.2 = background-frost
<!-- web_personalization_crystal_frame_opacity_must_not_affect.3 的当前独立事实为 content。 -->
web_personalization_crystal_frame_opacity_must_not_affect.3 = content
<!-- web_personalization_crystal_frame_opacity_must_not_affect.4 的当前独立事实为 text。 -->
web_personalization_crystal_frame_opacity_must_not_affect.4 = text
<!-- web_personalization_crystal_frame_opacity_must_not_affect.5 的当前独立事实为 controls。 -->
web_personalization_crystal_frame_opacity_must_not_affect.5 = controls
<!-- web_personalization_crystal_frame_opacity_must_not_affect.6 的当前独立事实为 interaction-glow。 -->
web_personalization_crystal_frame_opacity_must_not_affect.6 = interaction-glow

<!-- 同一组材质变量必须覆盖主要水晶承载面，但不得改变需要 fixed/absolute 定位的浮层定位上下文。 -->
web_personalization_shared_surface_scope = panel
<!-- web_personalization_shared_surface_scope.2 的当前独立事实为 window。 -->
web_personalization_shared_surface_scope.2 = window
<!-- web_personalization_shared_surface_scope.3 的当前独立事实为 dropdown。 -->
web_personalization_shared_surface_scope.3 = dropdown
<!-- web_personalization_shared_surface_scope.4 的当前独立事实为 context-menu。 -->
web_personalization_shared_surface_scope.4 = context-menu
<!-- web_personalization_shared_surface_scope.5 的当前独立事实为 date-picker。 -->
web_personalization_shared_surface_scope.5 = date-picker
<!-- web_personalization_shared_surface_must_not_override_popup_positioning 的当前独立事实为 true。 -->
web_personalization_shared_surface_must_not_override_popup_positioning = true
<!-- web_personalization_surface_radius_must_use 的当前独立事实为 shared-large-surface-token。 -->
web_personalization_surface_radius_must_use = shared-large-surface-token
<!-- web_personalization_surface_radius_must_use.2 的当前独立事实为 shared-popup-token。 -->
web_personalization_surface_radius_must_use.2 = shared-popup-token
<!-- web_personalization_surface_radius_must_use.3 的当前独立事实为 shared-inner-backplate-token。 -->
web_personalization_surface_radius_must_use.3 = shared-inner-backplate-token
<!-- web_personalization_surface_radius_must_fit 的当前独立事实为 outer-frame。 -->
web_personalization_surface_radius_must_fit = outer-frame
<!-- web_personalization_surface_radius_must_fit.2 的当前独立事实为 inner-glass-backplate。 -->
web_personalization_surface_radius_must_fit.2 = inner-glass-backplate
<!-- web_personalization_surface_radius_must_fit.3 的当前独立事实为 section-edge-clipping。 -->
web_personalization_surface_radius_must_fit.3 = section-edge-clipping
<!-- web_personalization_surface_radius_must_not_force 的当前独立事实为 outer-frame-overflow-hidden。 -->
web_personalization_surface_radius_must_not_force = outer-frame-overflow-hidden
<!-- web_personalization_border_spacing_controls 的当前独立事实为 frame-width。 -->
web_personalization_border_spacing_controls = frame-width
<!-- web_personalization_border_spacing_controls.2 的当前独立事实为 panel-scale。 -->
web_personalization_border_spacing_controls.2 = panel-scale
<!-- web_personalization_border_spacing_controls.3 的当前独立事实为 inner-panel-fit。 -->
web_personalization_border_spacing_controls.3 = inner-panel-fit
<!-- web_personalization_border_spacing_controls.4 的当前独立事实为 content-inset。 -->
web_personalization_border_spacing_controls.4 = content-inset
<!-- web_personalization_border_spacing_controls.5 的当前独立事实为 panel-gap。 -->
web_personalization_border_spacing_controls.5 = panel-gap
<!-- web_personalization_border_spacing_controls.6 的当前独立事实为 glow-spread。 -->
web_personalization_border_spacing_controls.6 = glow-spread
<!-- web_personalization_border_spacing_controls.7 的当前独立事实为 control-gap。 -->
web_personalization_border_spacing_controls.7 = control-gap
<!-- web_personalization_frame_geometry_tokens_must_define 的当前独立事实为 shared-image。 -->
web_personalization_frame_geometry_tokens_must_define = shared-image
<!-- web_personalization_frame_geometry_tokens_must_define.2 的当前独立事实为 per-component-thickness。 -->
web_personalization_frame_geometry_tokens_must_define.2 = per-component-thickness
<!-- web_personalization_frame_geometry_tokens_must_define.3 的当前独立事实为 equal-inline-borders。 -->
web_personalization_frame_geometry_tokens_must_define.3 = equal-inline-borders
<!-- web_personalization_frame_geometry_tokens_must_define.4 的当前独立事实为 equal-inline-safe-area。 -->
web_personalization_frame_geometry_tokens_must_define.4 = equal-inline-safe-area
<!-- web_personalization_frame_geometry_tokens_must_define.5 的当前独立事实为 viewport-gap。 -->
web_personalization_frame_geometry_tokens_must_define.5 = viewport-gap
<!-- web_personalization_panel_scale_control 的当前独立事实为 proportional-width-height-content-frame。 -->
web_personalization_panel_scale_control = proportional-width-height-content-frame
<!-- web_personalization_panel_scale_neutral_value 的当前独立事实为 50。 -->
web_personalization_panel_scale_neutral_value = 50
<!-- web_personalization_panel_scale_must_use 的当前独立事实为 independent-scale-property。 -->
web_personalization_panel_scale_must_use = independent-scale-property
<!-- web_personalization_panel_scale_must_use.2 的当前独立事实为 center-origin。 -->
web_personalization_panel_scale_must_use.2 = center-origin
<!-- web_personalization_panel_scale_must_use.3 的当前独立事实为 viewport-safe-range。 -->
web_personalization_panel_scale_must_use.3 = viewport-safe-range
<!-- web_personalization_panel_scale_must_not_override 的当前独立事实为 window-animation-transform。 -->
web_personalization_panel_scale_must_not_override = window-animation-transform
<!-- web_personalization_panel_scale_must_not_override.2 的当前独立事实为 window-geometry。 -->
web_personalization_panel_scale_must_not_override.2 = window-geometry
<!-- web_personalization_panel_scale_must_not_override.3 的当前独立事实为 popup-anchor。 -->
web_personalization_panel_scale_must_not_override.3 = popup-anchor
<!-- web_personalization_portal_popup_scale_must_follow 的当前独立事实为 owning-panel-scale。 -->
web_personalization_portal_popup_scale_must_follow = owning-panel-scale
<!-- web_personalization_inner_panel_fit_baseline_value 的当前独立事实为 50。 -->
web_personalization_inner_panel_fit_baseline_value = 50
<!-- web_personalization_inner_panel_fit_default_value 的当前独立事实为 100。 -->
web_personalization_inner_panel_fit_default_value = 100
<!-- web_personalization_inner_panel_fit_large_mapping 的当前独立事实为 50:0px。 -->
web_personalization_inner_panel_fit_large_mapping = 50:0px
<!-- web_personalization_inner_panel_fit_large_mapping.2 的当前独立事实为 100:-8px。 -->
web_personalization_inner_panel_fit_large_mapping.2 = 100:-8px
<!-- web_personalization_inner_panel_fit_large_mapping.3 的当前独立事实为 150:-16px。 -->
web_personalization_inner_panel_fit_large_mapping.3 = 150:-16px
<!-- web_personalization_inner_panel_fit_popup_mapping 的当前独立事实为 50:0px。 -->
web_personalization_inner_panel_fit_popup_mapping = 50:0px
<!-- web_personalization_inner_panel_fit_popup_mapping.2 的当前独立事实为 100:-6px。 -->
web_personalization_inner_panel_fit_popup_mapping.2 = 100:-6px
<!-- web_personalization_inner_panel_fit_popup_mapping.3 的当前独立事实为 150:-12px。 -->
web_personalization_inner_panel_fit_popup_mapping.3 = 150:-12px
<!-- web_personalization_inner_panel_fit_must_use 的当前独立事实为 unified-large-surface-inset-token。 -->
web_personalization_inner_panel_fit_must_use = unified-large-surface-inset-token
<!-- web_personalization_inner_panel_fit_must_use.2 的当前独立事实为 unified-popup-inset-token。 -->
web_personalization_inner_panel_fit_must_use.2 = unified-popup-inset-token
<!-- web_personalization_inner_panel_fit_must_use.3 的当前独立事实为 equal-four-edge-inset。 -->
web_personalization_inner_panel_fit_must_use.3 = equal-four-edge-inset
<!-- web_personalization_inner_panel_fit_must_adjust 的当前独立事实为 glass-backplate-size。 -->
web_personalization_inner_panel_fit_must_adjust = glass-backplate-size
<!-- web_personalization_inner_panel_fit_must_adjust.2 的当前独立事实为 glass-backplate-radius。 -->
web_personalization_inner_panel_fit_must_adjust.2 = glass-backplate-radius
<!-- web_personalization_inner_panel_fit_must_not_adjust 的当前独立事实为 outer-frame-size。 -->
web_personalization_inner_panel_fit_must_not_adjust = outer-frame-size
<!-- web_personalization_inner_panel_fit_must_not_adjust.2 的当前独立事实为 content-layout。 -->
web_personalization_inner_panel_fit_must_not_adjust.2 = content-layout
<!-- web_personalization_inner_panel_fit_must_not_adjust.3 的当前独立事实为 component-position。 -->
web_personalization_inner_panel_fit_must_not_adjust.3 = component-position
<!-- web_personalization_crystal_surface_overflow_must_use 的当前独立事实为 unified-material-overflow-token。 -->
web_personalization_crystal_surface_overflow_must_use = unified-material-overflow-token
<!-- web_personalization_crystal_surface_overflow_value 的当前独立事实为 visible。 -->
web_personalization_crystal_surface_overflow_value = visible
<!-- web_personalization_content_clip_owner 的当前独立事实为 inner-scroll-layer。 -->
web_personalization_content_clip_owner = inner-scroll-layer
<!-- web_personalization_content_clip_must_not_be_owned_by 的当前独立事实为 crystal-material-surface。 -->
web_personalization_content_clip_must_not_be_owned_by = crystal-material-surface

<!-- 动效既能调强度，也必须提供减少动态效果的总开关，并尊重系统减少动态偏好。 -->
web_personalization_motion_controls = window-animation
<!-- web_personalization_motion_controls.2 的当前独立事实为 glow-motion。 -->
web_personalization_motion_controls.2 = glow-motion
<!-- web_personalization_motion_controls.3 的当前独立事实为 reduced-motion。 -->
web_personalization_motion_controls.3 = reduced-motion
<!-- web_personalization_motion_zero_state_must_use 的当前独立事实为 exact-data-state-or-numeric-state。 -->
web_personalization_motion_zero_state_must_use = exact-data-state-or-numeric-state
<!-- web_personalization_motion_zero_state_must_not_use 的当前独立事实为 inline-style-prefix-substring-match。 -->
web_personalization_motion_zero_state_must_not_use = inline-style-prefix-substring-match
<!-- web_personalization_window_motion_change_must_preview_existing_window 的当前独立事实为 true。 -->
web_personalization_window_motion_change_must_preview_existing_window = true
<!-- web_personalization_window_open_must_replay_current_motion 的当前独立事实为 true。 -->
web_personalization_window_open_must_replay_current_motion = true
<!-- web_personalization_reduced_motion_must_disable 的当前独立事实为 window-entrance。 -->
web_personalization_reduced_motion_must_disable = window-entrance
<!-- web_personalization_reduced_motion_must_disable.2 的当前独立事实为 glow-flow。 -->
web_personalization_reduced_motion_must_disable.2 = glow-flow
<!-- web_personalization_reduced_motion_must_disable.3 的当前独立事实为 decorative-transitions。 -->
web_personalization_reduced_motion_must_disable.3 = decorative-transitions
<!-- web_personalization_reduced_motion_must_disable_motion_inputs 的当前独立事实为 true。 -->
web_personalization_reduced_motion_must_disable_motion_inputs = true
<!-- web_personalization_motion_must_respect_prefers_reduced_motion 的当前独立事实为 true。 -->
web_personalization_motion_must_respect_prefers_reduced_motion = true
<!-- web_personalization_continuous_glow_animation_owner 的当前独立事实为 independent-frame-decoration-layer。 -->
web_personalization_continuous_glow_animation_owner = independent-frame-decoration-layer
<!-- web_personalization_continuous_glow_animation_must_not_target 的当前独立事实为 backdrop-frost-owner。 -->
web_personalization_continuous_glow_animation_must_not_target = backdrop-frost-owner
<!-- web_personalization_continuous_glow_animation_must_not_target.2 的当前独立事实为 table-container。 -->
web_personalization_continuous_glow_animation_must_not_target.2 = table-container
<!-- web_personalization_continuous_glow_animation_must_not_target.3 的当前独立事实为 tree-container。 -->
web_personalization_continuous_glow_animation_must_not_target.3 = tree-container
<!-- web_personalization_continuous_glow_animation_must_not_target.4 的当前独立事实为 interactive-content-surface。 -->
web_personalization_continuous_glow_animation_must_not_target.4 = interactive-content-surface
<!-- web_personalization_low_performance_mode_must_reduce 的当前独立事实为 backdrop-blur-sampling-radius。 -->
web_personalization_low_performance_mode_must_reduce = backdrop-blur-sampling-radius
<!-- web_personalization_low_performance_mode_must_reduce.2 的当前独立事实为 decorative-glow-update-frequency。 -->
web_personalization_low_performance_mode_must_reduce.2 = decorative-glow-update-frequency
<!-- web_personalization_low_performance_mode_must_preserve 的当前独立事实为 crystal-frame-image。 -->
web_personalization_low_performance_mode_must_preserve = crystal-frame-image
<!-- web_personalization_low_performance_mode_must_preserve.2 的当前独立事实为 content-readability。 -->
web_personalization_low_performance_mode_must_preserve.2 = content-readability
<!-- web_personalization_low_performance_mode_must_preserve.3 的当前独立事实为 hover-feedback。 -->
web_personalization_low_performance_mode_must_preserve.3 = hover-feedback
<!-- web_personalization_low_performance_mode_must_preserve.4 的当前独立事实为 selected-feedback。 -->
web_personalization_low_performance_mode_must_preserve.4 = selected-feedback
<!-- web_personalization_hover_and_selection_must_not_be_disabled_by 的当前独立事实为 reduced-motion。 -->
web_personalization_hover_and_selection_must_not_be_disabled_by = reduced-motion
<!-- web_personalization_hover_and_selection_must_not_be_disabled_by.2 的当前独立事实为 low-performance-mode。 -->
web_personalization_hover_and_selection_must_not_be_disabled_by.2 = low-performance-mode

<!-- 预设表达参数组合而非固定皮肤颜色；默认预设复刻产品确认值，手工改动只进入不可见的页面临时状态。 -->
web_personalization_presets = deep-space
<!-- web_personalization_presets.2 的当前独立事实为 transparent。 -->
web_personalization_presets.2 = transparent
<!-- web_personalization_presets.3 的当前独立事实为 eye-care。 -->
web_personalization_presets.3 = eye-care
<!-- web_personalization_presets.4 的当前独立事实为 high-contrast。 -->
web_personalization_presets.4 = high-contrast
<!-- web_personalization_presets.5 的当前独立事实为 default。 -->
web_personalization_presets.5 = default
<!-- web_personalization_default_preset_values 的当前独立事实为 frame-opacity:100。 -->
web_personalization_default_preset_values = frame-opacity:100
<!-- web_personalization_default_preset_values.2 的当前独立事实为 panel-opacity:48。 -->
web_personalization_default_preset_values.2 = panel-opacity:48
<!-- web_personalization_default_preset_values.3 的当前独立事实为 background-frost:39。 -->
web_personalization_default_preset_values.3 = background-frost:39
<!-- web_personalization_default_preset_values.4 的当前独立事实为 theme-tint:68。 -->
web_personalization_default_preset_values.4 = theme-tint:68
<!-- web_personalization_default_preset_values.5 的当前独立事实为 panel-radius:50。 -->
web_personalization_default_preset_values.5 = panel-radius:50
<!-- web_personalization_default_preset_values.6 的当前独立事实为 frame-width:50。 -->
web_personalization_default_preset_values.6 = frame-width:50
<!-- web_personalization_default_preset_values.7 的当前独立事实为 panel-scale:50。 -->
web_personalization_default_preset_values.7 = panel-scale:50
<!-- web_personalization_default_preset_values.8 的当前独立事实为 inner-panel-fit:100。 -->
web_personalization_default_preset_values.8 = inner-panel-fit:100
<!-- web_personalization_default_preset_values.9 的当前独立事实为 content-inset:50。 -->
web_personalization_default_preset_values.9 = content-inset:50
<!-- web_personalization_default_preset_values.10 的当前独立事实为 panel-gap:50。 -->
web_personalization_default_preset_values.10 = panel-gap:50
<!-- web_personalization_default_preset_values.11 的当前独立事实为 glow-spread:55。 -->
web_personalization_default_preset_values.11 = glow-spread:55
<!-- web_personalization_default_preset_values.12 的当前独立事实为 control-gap:50。 -->
web_personalization_default_preset_values.12 = control-gap:50
<!-- web_personalization_default_preset_values.13 的当前独立事实为 window-motion:60。 -->
web_personalization_default_preset_values.13 = window-motion:60
<!-- web_personalization_default_preset_values.14 的当前独立事实为 glow-motion:46。 -->
web_personalization_default_preset_values.14 = glow-motion:46
<!-- web_personalization_default_preset_values.15 的当前独立事实为 reduced-motion:false。 -->
web_personalization_default_preset_values.15 = reduced-motion:false
<!-- web_personalization_manual_change_state 的当前独立事实为 custom-runtime-only。 -->
web_personalization_manual_change_state = custom-runtime-only
<!-- web_personalization_manual_change_must_not_create_visible_preset 的当前独立事实为 true。 -->
web_personalization_manual_change_must_not_create_visible_preset = true
<!-- web_personalization_preset_must_be_skin_independent 的当前独立事实为 true。 -->
web_personalization_preset_must_be_skin_independent = true
<!-- web_personalization_manual_change_clears_visible_preset_selection 的当前独立事实为 true。 -->
web_personalization_manual_change_clears_visible_preset_selection = true

<!-- 临时个性化模式禁止写入浏览器持久化存储，刷新页面必须恢复代码默认值。 -->
web_personalization_persistence_mode = ephemeral-page-state
<!-- web_personalization_must_not_write 的当前独立事实为 local-storage。 -->
web_personalization_must_not_write = local-storage
<!-- web_personalization_must_not_write.2 的当前独立事实为 session-storage。 -->
web_personalization_must_not_write.2 = session-storage
<!-- web_personalization_must_not_write.3 的当前独立事实为 indexed-db。 -->
web_personalization_must_not_write.3 = indexed-db
<!-- web_personalization_must_not_write.4 的当前独立事实为 cookie。 -->
web_personalization_must_not_write.4 = cookie
<!-- web_personalization_reload_result 的当前独立事实为 code-defaults。 -->
web_personalization_reload_result = code-defaults

<!-- 交付前验证两级信息架构、全部参数、预设、换肤 token、紧凑视口、浮层定位、刷新复位、键盘路径和控制台。 -->
web_personalization_qa = two-top-level-sections
<!-- web_personalization_qa.2 的当前独立事实为 all-ranges。 -->
web_personalization_qa.2 = all-ranges
<!-- web_personalization_qa.3 的当前独立事实为 all-presets。 -->
web_personalization_qa.3 = all-presets
<!-- web_personalization_qa.4 的当前独立事实为 theme-token-override。 -->
web_personalization_qa.4 = theme-token-override
<!-- web_personalization_qa.5 的当前独立事实为 arbitrary-color。 -->
web_personalization_qa.5 = arbitrary-color
<!-- web_personalization_qa.6 的当前独立事实为 quick-swatches。 -->
web_personalization_qa.6 = quick-swatches
<!-- web_personalization_qa.7 的当前独立事实为 follow-skin。 -->
web_personalization_qa.7 = follow-skin
<!-- web_personalization_qa.8 的当前独立事实为 shared-frame-tint。 -->
web_personalization_qa.8 = shared-frame-tint
<!-- web_personalization_qa.9 的当前独立事实为 structural-surface-color-scan。 -->
web_personalization_qa.9 = structural-surface-color-scan
<!-- web_personalization_qa.10 的当前独立事实为 semantic-color-isolation。 -->
web_personalization_qa.10 = semantic-color-isolation
<!-- web_personalization_qa.11 的当前独立事实为 compact-viewport。 -->
web_personalization_qa.11 = compact-viewport
<!-- web_personalization_qa.12 的当前独立事实为 popup-positioning。 -->
web_personalization_qa.12 = popup-positioning
<!-- web_personalization_qa.13 的当前独立事实为 reload-defaults。 -->
web_personalization_qa.13 = reload-defaults
<!-- web_personalization_qa.14 的当前独立事实为 keyboard。 -->
web_personalization_qa.14 = keyboard
<!-- web_personalization_qa.15 的当前独立事实为 console。 -->
web_personalization_qa.15 = console
<!-- web_personalization_qa.16 的当前独立事实为 visual-comparison。 -->
web_personalization_qa.16 = visual-comparison

<!-- java_ability_refs 的当前独立事实为 none。 -->
java_ability_refs = none
<!-- python_ability_refs 的当前独立事实为 none。 -->
python_ability_refs = none
<!-- node_ability_refs 的当前独立事实为 none。 -->
node_ability_refs = none
