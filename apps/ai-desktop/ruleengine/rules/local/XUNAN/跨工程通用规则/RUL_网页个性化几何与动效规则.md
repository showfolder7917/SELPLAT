# 网页个性化几何与动效规则

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
