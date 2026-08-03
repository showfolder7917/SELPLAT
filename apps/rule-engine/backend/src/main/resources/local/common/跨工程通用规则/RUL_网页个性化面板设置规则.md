# 网页个性化面板设置规则

<!-- 问题：把背景、面板材质、边框间距和动效分别散落在页面中，会导致入口重复、颜色写死，并在换皮肤或浮层定位时产生回归。 -->
<!-- 场景：网页需要用一个个性化入口管理背景以及面板外观、边框间距、动效和预设，同时允许刷新恢复默认。 -->
<!-- 业务含义：个性化外壳只负责组合独立能力和实时参数；背景仍是独立模块，所有水晶表面共享可换肤 token。 -->

web_personalization_top_level_sections = background,panel,text
web_personalization_panel_groups = presets,appearance,border-spacing,motion
web_personalization_text_groups = mode,main-color,muted-color,contrast,font-scale
web_personalization_background_must_compose = independent-background-controller
web_personalization_must_not_merge_background_state_into_business-control = true

<!-- 面向用户的强度默认使用 0%–100%，仅允许经规则显式登记的几何比例项扩展上限；实现层仍映射到组件安全范围。 -->
web_personalization_default_user_range = 0..100
web_personalization_user_range_exceptions = inner-panel-fit:0..150
web_personalization_range_must_map_to = component-safe-css-token-range
web_personalization_frame_scale_neutral_value = 50
web_personalization_spacing_offset_neutral_value = 50
web_personalization_component_frame_baseline_must_be_preserved = panel,window,dropdown,context-menu,date-picker

<!-- 面板透明度只驱动普通结构层；悬停、选中和主操作保持固定强度，仅跟随统一主题色。 -->
web_personalization_panel_opacity_target = center-glass-backplate,table-board,table-header,table-normal-row,table-zebra-row,control-base-surface
web_personalization_panel_opacity_must_not_fade = text,icons,semantic-content,nine-slice-frame,hover-surface,selected-surface,primary-surface
web_personalization_structure_opacity_must_use = unified-structure-opacity-token,table-surface-mapping-tokens,control-base-surface-mapping-token
web_personalization_interaction_surface_must_use = unified-theme-color,fixed-hover-strength,fixed-selected-strength,fixed-primary-strength
web_personalization_table_normal_layers_must_not_compound_to_opaque = true
web_personalization_data_interaction_fixed_strength = tree-hover:0.68,table-hover:0.68,tree-selected:0.78,table-selected:0.78
web_personalization_control_interaction_strength = base-opacity-mapped:0.25..0.84,hover-fixed:0.72,primary-fixed:0.82
web_personalization_selection_feedback_must_be_immediate = row-selected,selection-checkbox,aria-selected,aria-checked
web_personalization_table_semantic_content_must_not_fade = avatar,status-badge,progress-bar,row-actions,selection-control
web_personalization_panel_material_controls = opacity,background-frost,unified-theme-color,current-skin-tint-strength,surface-radius
web_personalization_background_frost_must_combine = backdrop-blur,brightness-reduction,saturation-reduction,independent-neutral-veil
web_personalization_background_frost_must_not_depend_on = panel-opacity
web_personalization_background_frost_must_not_affect = panel-content,text,icons,controls,nine-slice-frame
web_personalization_background_frost_target = panel,window,personalization-panel,dropdown,context-menu,date-picker
web_personalization_background_frost_geometry_must_equal = inner-glass-backplate-size,inner-glass-backplate-inset,inner-glass-backplate-radius
web_personalization_background_frost_geometry_must_follow = unified-large-surface-inset-token,unified-popup-inset-token,shared-inner-backplate-token
web_personalization_background_frost_must_not_attach_to = outer-crystal-frame-border-box
web_personalization_window_material_layer_order = background-frost:0,interactive-content:1,crystal-frame:2,resize-handles:above-frame
web_personalization_window_material_must_create = positioned-z-index-stacking-context-without-backdrop-root
web_personalization_window_background_frost_must_sample = content-behind-window-outside-window-stacking-context
web_personalization_window_background_frost_must_not_use = isolation-isolate,ancestor-filter,ancestor-backdrop-filter
web_personalization_window_entrance_animation_must_release_after_finish = transform,translate,scale,opacity-compositing-layer
web_personalization_window_entrance_animation_fill_mode_must_not_be = forwards,both
web_personalization_window_material_must_not_rely_on = negative-z-index-for-frost,negative-z-index-for-frame
web_personalization_skin_tint_must_use = overridable-theme-rgb-tokens
web_personalization_skin_tint_must_not_hardcode = deep-blue,purple,background-derived-color
web_personalization_unified_theme_color_modes = follow-current-skin,arbitrary-color,quick-swatches
web_personalization_unified_theme_color_must_affect = crystal-frame-glow,glass-backplate,header,toolbar,navigation,form-control,table-structure,floating-surface,glow,selected-state,primary-action,range-accent,scrollbar
web_personalization_unified_theme_color_must_not_override = original-nine-slice-frame-image,background-image,body-text,success-color,warning-color,error-color
web_personalization_unified_theme_color_scale = deep,base,raised,accent
web_personalization_unified_theme_color_scale_source = selected-color,current-skin-tint-strength,neutral-surface-token
web_personalization_structural_surface_must_not_keep_previous_skin_color = true
web_personalization_unified_token_layers = foundation-color,semantic-color,component-mapping,frame-geometry
web_personalization_unified_token_prefix = --sel-theme-
web_personalization_component_must_consume_unified_tokens = true
web_personalization_component_must_not_define_independent_skin_color = true
<!-- 文字设置与背景、面板保持同级；适用于白色玻璃、深色玻璃与任意皮肤；业务含义是文字颜色、层级和字号不能继续作为面板外观的隐含副作用。 -->
web_personalization_text_settings_level = same-as-background-and-panel
web_personalization_text_modes = follow-skin,light,dark,custom
web_personalization_text_base_tokens = main,muted
web_personalization_text_derived_tokens = title,body,secondary,soft,disabled,placeholder,on-accent,link,icon,contrast-shadow,font-scale
web_personalization_text_derived_source = main,muted,current-theme-color
web_personalization_component_neutral_text_must_consume = unified-text-role-token
web_personalization_component_neutral_text_must_not_define = fixed-color,compatibility-override-only
web_personalization_text_dark_mode_default_colors = main:#0B1633,muted:#52617A
web_personalization_text_light_mode_default_colors = main:#F7FAFF,muted:#B8C5E2
web_personalization_text_custom_color_controls = main-color,muted-color
web_personalization_text_contrast_user_range = 0..100
web_personalization_text_scale_user_range = 0..100
web_personalization_text_scale_css_mapping = 0:0.80,50:1.00,100:1.20
web_personalization_text_semantic_colors_must_not_change = success,warning,error,progress,review,archived
web_personalization_text_control_plane_must_remain_readable = personalization-panel
web_personalization_text_state_persistence = ephemeral-page-state
<!-- 滚动条属于统一皮肤的一部分；页面、普通内容面板与紧凑浮层只允许使用语义尺寸档，轨道、滑块、悬停、按下、圆角和光效必须来自同一主题令牌，禁止浏览器原生白色样式与组件硬编码并存。 -->
web_personalization_scrollbar_token_parts = track,thumb,thumb-hover,thumb-active,radius,glow,size-page,size-panel,size-compact
web_personalization_scrollbar_size_tiers = page,panel,compact
web_personalization_scrollbar_page_scope = html,body
web_personalization_scrollbar_panel_scope = table-scroller,tree-scroller,window-body,personalization-scroll-region
web_personalization_scrollbar_compact_scope = dropdown-viewport,context-menu-viewport,submenu-viewport
web_personalization_scrollbar_component_style_must_consume = unified-scrollbar-tokens
web_personalization_scrollbar_component_must_not_define = fixed-skin-color,fixed-pixel-size,out-of-theme-glow
web_personalization_scrollbar_theme_change_must_update = page,panel,compact
web_personalization_scrollbar_must_not_cause = outer-frame-resize,horizontal-page-overflow,content-safe-area-overlap
web_personalization_crystal_frame_image_must_use = original-skin-nine-slice-asset,independent-frame-layer
web_personalization_crystal_frame_image_must_not_use = runtime-canvas-tint,runtime-image-reencode,flat-color-overlay
web_personalization_crystal_frame_opacity_range = 0..100
web_personalization_crystal_frame_opacity_default = 100
web_personalization_crystal_frame_opacity_must_affect = original-frame-image,frame-static-glow,frame-motion-glow,active-window-frame-glow
web_personalization_crystal_frame_opacity_zero_state = no-frame-image,no-frame-static-glow,no-frame-motion-glow
web_personalization_crystal_frame_opacity_must_not_affect = glass-backplate,background-frost,content,text,controls,interaction-glow

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
web_personalization_continuous_glow_animation_owner = independent-frame-decoration-layer
web_personalization_continuous_glow_animation_must_not_target = backdrop-frost-owner,table-container,tree-container,interactive-content-surface
web_personalization_low_performance_mode_must_reduce = backdrop-blur-sampling-radius,decorative-glow-update-frequency
web_personalization_low_performance_mode_must_preserve = crystal-frame-image,content-readability,hover-feedback,selected-feedback
web_personalization_hover_and_selection_must_not_be_disabled_by = reduced-motion,low-performance-mode

<!-- 预设表达参数组合而非固定皮肤颜色；默认预设复刻产品确认值，手工改动只进入不可见的页面临时状态。 -->
web_personalization_presets = deep-space,transparent,eye-care,high-contrast,default
web_personalization_default_preset_values = frame-opacity:100,panel-opacity:48,background-frost:39,theme-tint:68,panel-radius:50,frame-width:50,panel-scale:50,inner-panel-fit:100,content-inset:50,panel-gap:50,glow-spread:55,control-gap:50,window-motion:60,glow-motion:46,reduced-motion:false
web_personalization_manual_change_state = custom-runtime-only
web_personalization_manual_change_must_not_create_visible_preset = true
web_personalization_preset_must_be_skin_independent = true
web_personalization_manual_change_clears_visible_preset_selection = true

<!-- 临时个性化模式禁止写入浏览器持久化存储，刷新页面必须恢复代码默认值。 -->
web_personalization_persistence_mode = ephemeral-page-state
web_personalization_must_not_write = local-storage,session-storage,indexed-db,cookie
web_personalization_reload_result = code-defaults

<!-- 交付前验证两级信息架构、全部参数、预设、换肤 token、紧凑视口、浮层定位、刷新复位、键盘路径和控制台。 -->
web_personalization_qa = two-top-level-sections,all-ranges,all-presets,theme-token-override,arbitrary-color,quick-swatches,follow-skin,shared-frame-tint,structural-surface-color-scan,semantic-color-isolation,compact-viewport,popup-positioning,reload-defaults,keyboard,console,visual-comparison

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
