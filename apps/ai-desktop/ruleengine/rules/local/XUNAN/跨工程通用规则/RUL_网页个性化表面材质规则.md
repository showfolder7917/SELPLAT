# 网页个性化表面材质规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 1.0.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 本职责没有独立 Java 能力入口。 -->
java_ability_refs = none
<!-- 本职责没有独立 Python 能力入口。 -->
python_ability_refs = none
<!-- 本职责没有独立 Node 能力入口。 -->
node_ability_refs = none

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
