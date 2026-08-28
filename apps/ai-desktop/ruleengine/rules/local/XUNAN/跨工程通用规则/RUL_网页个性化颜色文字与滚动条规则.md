# 网页个性化颜色、文字与滚动条规则

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
