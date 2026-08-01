# 网页个性化面板设置规则

<!-- 问题：把背景、面板材质、边框间距和动效分别散落在页面中，会导致入口重复、颜色写死，并在换皮肤或浮层定位时产生回归。 -->
<!-- 场景：网页需要用一个个性化入口管理背景以及面板外观、边框间距、动效和预设，同时允许刷新恢复默认。 -->
<!-- 业务含义：个性化外壳只负责组合独立能力和实时参数；背景仍是独立模块，所有水晶表面共享可换肤 token。 -->

web_personalization_top_level_sections = background,panel
web_personalization_panel_groups = presets,appearance,border-spacing,motion
web_personalization_background_must_compose = independent-background-controller
web_personalization_must_not_merge_background_state_into_business-control = true

<!-- 面向用户的强度统一为 0%–100%，实现层映射到每类组件安全范围；50% 必须保持既有边框和间距基准。 -->
web_personalization_user_range = 0..100
web_personalization_range_must_map_to = component-safe-css-token-range
web_personalization_frame_scale_neutral_value = 50
web_personalization_spacing_offset_neutral_value = 50
web_personalization_component_frame_baseline_must_be_preserved = panel,window,dropdown,context-menu,date-picker

<!-- 面板透明只改变中心玻璃承托层，禁止连带降低文字、图标、控件或九宫格边框的透明度。 -->
web_personalization_panel_opacity_target = center-glass-backplate-only
web_personalization_panel_opacity_must_not_fade = text,icons,controls,nine-slice-frame
web_personalization_panel_material_controls = opacity,glass-blur,current-skin-tint-strength
web_personalization_skin_tint_must_use = overridable-theme-rgb-tokens
web_personalization_skin_tint_must_not_hardcode = deep-blue,purple,background-derived-color

<!-- 同一组材质变量必须覆盖主要水晶承载面，但不得改变需要 fixed/absolute 定位的浮层定位上下文。 -->
web_personalization_shared_surface_scope = panel,window,dropdown,context-menu,date-picker
web_personalization_shared_surface_must_not_override_popup_positioning = true
web_personalization_border_spacing_controls = frame-width,content-inset,panel-gap,glow-spread,control-gap

<!-- 动效既能调强度，也必须提供减少动态效果的总开关，并尊重系统减少动态偏好。 -->
web_personalization_motion_controls = window-animation,glow-motion,reduced-motion
web_personalization_reduced_motion_must_disable = window-entrance,glow-flow,decorative-transitions
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
web_personalization_qa = two-top-level-sections,all-ranges,all-presets,theme-token-override,compact-viewport,popup-positioning,reload-defaults,keyboard,console,visual-comparison

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
