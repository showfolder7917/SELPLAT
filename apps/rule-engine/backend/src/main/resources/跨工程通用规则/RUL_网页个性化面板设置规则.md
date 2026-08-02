# 网页个性化面板设置规则

<!-- 问题：把背景、面板材质、边框间距和动效分别散落在页面中，会导致入口重复、颜色写死，并在换皮肤或浮层定位时产生回归。 -->
<!-- 场景：网页需要用一个个性化入口管理背景以及面板外观、边框间距、动效和预设，同时允许刷新恢复默认。 -->
<!-- 业务含义：个性化外壳只负责组合独立能力和实时参数；背景仍是独立模块，所有水晶表面共享可换肤 token。 -->

web_personalization_top_level_sections = background,panel
web_personalization_panel_groups = presets,appearance,border-spacing,motion
web_personalization_background_must_compose = independent-background-controller
web_personalization_must_not_merge_background_state_into_business-control = true

<!-- 面向用户的强度默认使用 0%–100%，仅允许经规则显式登记的几何比例项扩展上限；实现层仍映射到组件安全范围。 -->
web_personalization_default_user_range = 0..100
web_personalization_user_range_exceptions = inner-panel-fit:0..150
web_personalization_range_must_map_to = component-safe-css-token-range
web_personalization_frame_scale_neutral_value = 50
web_personalization_spacing_offset_neutral_value = 50
web_personalization_component_frame_baseline_must_be_preserved = panel,window,dropdown,context-menu,date-picker

<!-- 面板透明同时控制中心玻璃与表格结构层，但禁止连带降低文字、图标、控件或九宫格边框的透明度。 -->
web_personalization_panel_opacity_target = center-glass-backplate,table-board,table-header,table-normal-row,table-zebra-row
web_personalization_panel_opacity_must_not_fade = text,icons,controls,nine-slice-frame
web_personalization_table_opacity_must_use = unified-structure-opacity-token,table-surface-mapping-tokens
web_personalization_table_normal_layers_must_not_compound_to_opaque = true
web_personalization_table_interaction_minimum_contrast = hover:0.28,selected:0.46
web_personalization_table_semantic_content_must_not_fade = avatar,status-badge,progress-bar,row-actions,selection-control
web_personalization_panel_material_controls = opacity,glass-blur,unified-theme-color,current-skin-tint-strength,surface-radius
web_personalization_skin_tint_must_use = overridable-theme-rgb-tokens
web_personalization_skin_tint_must_not_hardcode = deep-blue,purple,background-derived-color
web_personalization_unified_theme_color_modes = follow-current-skin,arbitrary-color,quick-swatches
web_personalization_unified_theme_color_must_affect = crystal-frame,glass-backplate,header,toolbar,navigation,form-control,table-structure,floating-surface,glow,selected-state,primary-action,range-accent,scrollbar
web_personalization_unified_theme_color_must_not_override = background-image,body-text,success-color,warning-color,error-color
web_personalization_unified_theme_color_scale = deep,base,raised,accent
web_personalization_unified_theme_color_scale_source = selected-color,current-skin-tint-strength,neutral-surface-token
web_personalization_structural_surface_must_not_keep_previous_skin_color = true
web_personalization_unified_token_layers = foundation-color,semantic-color,component-mapping,frame-geometry
web_personalization_unified_token_prefix = --sel-theme-
web_personalization_component_must_consume_unified_tokens = true
web_personalization_component_must_not_define_independent_skin_color = true
web_personalization_runtime_frame_tint_must_preserve = source-alpha,cut-corners,nine-slice-geometry,highlight-detail
web_personalization_runtime_frame_tint_persistence = memory-only

<!-- 同一组材质变量必须覆盖主要水晶承载面，但不得改变需要 fixed/absolute 定位的浮层定位上下文。 -->
web_personalization_shared_surface_scope = panel,window,dropdown,context-menu,date-picker
web_personalization_shared_surface_must_not_override_popup_positioning = true
web_personalization_surface_radius_must_use = shared-large-surface-token,shared-popup-token,shared-inner-backplate-token
web_personalization_surface_radius_must_fit = outer-frame,inner-glass-backplate,section-edge-clipping
web_personalization_surface_radius_must_not_force = outer-frame-overflow-hidden
web_personalization_border_spacing_controls = frame-width,panel-scale,inner-panel-fit,content-inset,panel-gap,glow-spread,control-gap
web_personalization_frame_geometry_tokens_must_define = shared-image,per-component-thickness,equal-inline-borders,equal-inline-safe-area,viewport-gap
web_personalization_panel_scale_control = proportional-width-height-content-frame
web_personalization_panel_scale_neutral_value = 50
web_personalization_panel_scale_must_use = independent-scale-property,center-origin,viewport-safe-range
web_personalization_panel_scale_must_not_override = window-animation-transform,window-geometry,popup-anchor
web_personalization_portal_popup_scale_must_follow = owning-panel-scale
web_personalization_inner_panel_fit_baseline_value = 50
web_personalization_inner_panel_fit_default_value = 100
web_personalization_inner_panel_fit_large_mapping = 50:0px,100:-8px,150:-16px
web_personalization_inner_panel_fit_popup_mapping = 50:0px,100:-6px,150:-12px
web_personalization_inner_panel_fit_must_use = unified-large-surface-inset-token,unified-popup-inset-token,equal-four-edge-inset
web_personalization_inner_panel_fit_must_adjust = glass-backplate-size,glass-backplate-radius
web_personalization_inner_panel_fit_must_not_adjust = outer-frame-size,content-layout,component-position
web_personalization_crystal_surface_overflow_must_use = unified-material-overflow-token
web_personalization_crystal_surface_overflow_value = visible
web_personalization_content_clip_owner = inner-scroll-layer
web_personalization_content_clip_must_not_be_owned_by = crystal-material-surface

<!-- 动效既能调强度，也必须提供减少动态效果的总开关，并尊重系统减少动态偏好。 -->
web_personalization_motion_controls = window-animation,glow-motion,reduced-motion
web_personalization_motion_zero_state_must_use = exact-data-state-or-numeric-state
web_personalization_motion_zero_state_must_not_use = inline-style-prefix-substring-match
web_personalization_window_motion_change_must_preview_existing_window = true
web_personalization_window_open_must_replay_current_motion = true
web_personalization_reduced_motion_must_disable = window-entrance,glow-flow,decorative-transitions
web_personalization_reduced_motion_must_disable_motion_inputs = true
web_personalization_motion_must_respect_prefers_reduced_motion = true

<!-- 预设表达参数组合而非固定皮肤颜色；自定义由任意手工改动自动进入。 -->
web_personalization_presets = deep-space,transparent,eye-care,high-contrast,custom
web_personalization_preset_must_be_skin_independent = true
web_personalization_manual_change_selects_custom = true

<!-- 临时个性化模式禁止写入浏览器持久化存储，刷新页面必须恢复代码默认值。 -->
web_personalization_persistence_mode = ephemeral-page-state
web_personalization_must_not_write = local-storage,session-storage,indexed-db,cookie
web_personalization_reload_result = code-defaults

<!-- 交付前验证两级信息架构、全部参数、预设、换肤 token、紧凑视口、浮层定位、刷新复位、键盘路径和控制台。 -->
web_personalization_qa = two-top-level-sections,all-ranges,all-presets,theme-token-override,arbitrary-color,quick-swatches,follow-skin,shared-frame-tint,structural-surface-color-scan,semantic-color-isolation,compact-viewport,popup-positioning,reload-defaults,keyboard,console,visual-comparison

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
