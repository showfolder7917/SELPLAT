# 网页背景主题模块设计规则

<!-- 问题：网页背景直接写入业务控件 CSS 后，背景图片、遮罩和表格布局耦合，换主题会污染控件样式并阻碍跨页面复用。 -->
<!-- 场景：网页需要在风景、卡通、可爱、科技、国风、宇宙等不同色调背景之间切换，同时保持表格、面板、菜单和树控件稳定。 -->
<!-- 业务含义：背景是页面级独立模块；主题图片和显示参数只改变背景层，不改变业务控件结构、实例状态或组件主题。 -->

<!-- web_page_background_module_name 的当前独立事实为 selPageBackground。 -->
web_page_background_module_name = selPageBackground
<!-- web_page_background_shared_asset_folder 的当前独立事实为 static/sel/assets/backgrounds/。 -->
web_page_background_shared_asset_folder = static/sel/assets/backgrounds/
<!-- web_page_background_application_asset_folder_pattern 的当前独立事实为 static/<application>/assets/backgrounds/。 -->
web_page_background_application_asset_folder_pattern = static/<application>/assets/backgrounds/
<!-- web_page_background_asset_scope_choice 的当前独立事实为 cross-application-theme-use-shared-folder。 -->
web_page_background_asset_scope_choice = cross-application-theme-use-shared-folder
<!-- web_page_background_asset_scope_choice.2 的当前独立事实为 application-only-theme-use-application-folder。 -->
web_page_background_asset_scope_choice.2 = application-only-theme-use-application-folder
<!-- web_page_background_css_responsibility 的当前独立事实为 image-layer。 -->
web_page_background_css_responsibility = image-layer
<!-- web_page_background_css_responsibility.2 的当前独立事实为 overlay。 -->
web_page_background_css_responsibility.2 = overlay
<!-- web_page_background_css_responsibility.3 的当前独立事实为 optional-standalone-background-selector。 -->
web_page_background_css_responsibility.3 = optional-standalone-background-selector
<!-- web_page_background_js_responsibility 的当前独立事实为 theme-registry。 -->
web_page_background_js_responsibility = theme-registry
<!-- web_page_background_js_responsibility.2 的当前独立事实为 state。 -->
web_page_background_js_responsibility.2 = state
<!-- web_page_background_js_responsibility.3 的当前独立事实为 public-api。 -->
web_page_background_js_responsibility.3 = public-api
<!-- web_page_layout_css_must_not_embed_business_background_image 的当前独立事实为 true。 -->
web_page_layout_css_must_not_embed_business_background_image = true

<!-- 背景层、遮罩层和选择器必须与业务控件 DOM 分离；任一背景区域删除后，面板和业务控件仍可独立显示与操作。 -->
web_page_background_layer_must_be_independent = true
<!-- web_page_background_must_not_live_inside_grid_or_business-control 的当前独立事实为 true。 -->
web_page_background_must_not_live_inside_grid_or_business-control = true
<!-- web_page_background_control_is_optional 的当前独立事实为 true。 -->
web_page_background_control_is_optional = true
<!-- web_page_background_selector_may_be_composed_by 的当前独立事实为 independent-personalization-shell。 -->
web_page_background_selector_may_be_composed_by = independent-personalization-shell
<!-- web_page_background_missing_control_fallback 的当前独立事实为 default-or-saved-theme。 -->
web_page_background_missing_control_fallback = default-or-saved-theme
<!-- web_page_background_must_not_change 的当前独立事实为 grid-state。 -->
web_page_background_must_not_change = grid-state
<!-- web_page_background_must_not_change.2 的当前独立事实为 panel-layout。 -->
web_page_background_must_not_change.2 = panel-layout
<!-- web_page_background_must_not_change.3 的当前独立事实为 tree-state。 -->
web_page_background_must_not_change.3 = tree-state
<!-- web_page_background_must_not_change.4 的当前独立事实为 menu-state。 -->
web_page_background_must_not_change.4 = menu-state
<!-- web_page_background_must_not_change.5 的当前独立事实为 pagination-state。 -->
web_page_background_must_not_change.5 = pagination-state

<!-- 主题必须使用显式配置清单；新增图片只追加主题配置，不得根据文件名、色调或页面业务名称推断主题行为。 -->
web_page_background_theme_source = explicit-config
<!-- web_page_background_theme_fields 的当前独立事实为 id。 -->
web_page_background_theme_fields = id
<!-- web_page_background_theme_fields.2 的当前独立事实为 name。 -->
web_page_background_theme_fields.2 = name
<!-- web_page_background_theme_fields.3 的当前独立事实为 category。 -->
web_page_background_theme_fields.3 = category
<!-- web_page_background_theme_fields.4 的当前独立事实为 image。 -->
web_page_background_theme_fields.4 = image
<!-- web_page_background_theme_id_must_be_stable 的当前独立事实为 true。 -->
web_page_background_theme_id_must_be_stable = true
<!-- web_page_background_theme_must_not_infer_from_filename 的当前独立事实为 true。 -->
web_page_background_theme_must_not_infer_from_filename = true
<!-- web_page_background_color_palette_is_unrestricted 的当前独立事实为 true。 -->
web_page_background_color_palette_is_unrestricted = true
<!-- web_page_background_theme_may_include 的当前独立事实为 landscape。 -->
web_page_background_theme_may_include = landscape
<!-- web_page_background_theme_may_include.2 的当前独立事实为 cartoon。 -->
web_page_background_theme_may_include.2 = cartoon
<!-- web_page_background_theme_may_include.3 的当前独立事实为 cute。 -->
web_page_background_theme_may_include.3 = cute
<!-- web_page_background_theme_may_include.4 的当前独立事实为 technology。 -->
web_page_background_theme_may_include.4 = technology
<!-- web_page_background_theme_may_include.5 的当前独立事实为 space。 -->
web_page_background_theme_may_include.5 = space
<!-- web_page_background_theme_may_include.6 的当前独立事实为 fantasy。 -->
web_page_background_theme_may_include.6 = fantasy
<!-- web_page_background_theme_may_include.7 的当前独立事实为 oriental。 -->
web_page_background_theme_may_include.7 = oriental
<!-- web_page_background_theme_may_include.8 的当前独立事实为 minimal。 -->
web_page_background_theme_may_include.8 = minimal
<!-- web_page_background_theme_may_include.9 的当前独立事实为 ocean。 -->
web_page_background_theme_may_include.9 = ocean

<!-- 完整主题自动配套的图片背景属于主题包，不属于公共背景库；每个主题只能引用自己目录的配套背景。无图纯色模式可使用背景模块登记的通用纯色 ID。 -->
web_complete_theme_automatic_image_background_directory_pattern = static/sel/assets/themes/<same-theme-id>/
<!-- web_complete_theme_base_background_pattern 的当前独立事实为 static/sel/assets/themes/<same-theme-id>/<mode>/base/background.webp。 -->
web_complete_theme_base_background_pattern = static/sel/assets/themes/<same-theme-id>/<mode>/base/background.webp
<!-- web_complete_theme_accent_background_pattern 的当前独立事实为 static/sel/assets/themes/<same-theme-id>/<mode>/accents/<accent-id>/background.webp。 -->
web_complete_theme_accent_background_pattern = static/sel/assets/themes/<same-theme-id>/<mode>/accents/<accent-id>/background.webp
<!-- web_complete_theme_manifest_must_own_automatic_background_registry 的当前独立事实为 true。 -->
web_complete_theme_manifest_must_own_automatic_background_registry = true
<!-- web_complete_theme_cross_theme_background_reference_is_forbidden 的当前独立事实为 true。 -->
web_complete_theme_cross_theme_background_reference_is_forbidden = true
<!-- web_complete_theme_public_background_as_automatic_material_is_forbidden 的当前独立事实为 true。 -->
web_complete_theme_public_background_as_automatic_material_is_forbidden = true
<!-- web_complete_theme_solid_background_exception 的当前独立事实为 registered-solid-background-with-empty-image。 -->
web_complete_theme_solid_background_exception = registered-solid-background-with-empty-image
<!-- web_public_background_library_usage 的当前独立事实为 explicit-user-selection-only。 -->
web_public_background_library_usage = explicit-user-selection-only

<!-- 图片素材使用清晰、稳定、语义化的英文文件名；网页背景优先使用压缩后的 WebP，避免把生成源文件或临时文件留在运行资源目录。 -->
web_page_background_asset_filename_pattern = category-subject-or-palette.webp
<!-- web_page_background_runtime_image_format_preferred 的当前独立事实为 webp。 -->
web_page_background_runtime_image_format_preferred = webp
<!-- web_page_background_runtime_image_must_follow 的当前独立事实为 WEB_RUNTIME_ASSET_DIRECTORY_AND_COMPRESSION_RULES。 -->
web_page_background_runtime_image_must_follow = WEB_RUNTIME_ASSET_DIRECTORY_AND_COMPRESSION_RULES
<!-- web_page_background_generated_source_must_not_live_in_runtime_assets 的当前独立事实为 true。 -->
web_page_background_generated_source_must_not_live_in_runtime_assets = true
<!-- web_page_background_asset_must_have_no 的当前独立事实为 text。 -->
web_page_background_asset_must_have_no = text
<!-- web_page_background_asset_must_have_no.2 的当前独立事实为 logo。 -->
web_page_background_asset_must_have_no.2 = logo
<!-- web_page_background_asset_must_have_no.3 的当前独立事实为 watermark。 -->
web_page_background_asset_must_have_no.3 = watermark
<!-- web_page_background_asset_must_have_no.4 的当前独立事实为 embedded-ui。 -->
web_page_background_asset_must_have_no.4 = embedded-ui

<!-- 不同明暗和复杂度的背景统一通过可调遮罩、亮度和模糊度适配；控件自身不得为某张背景硬编码文字颜色。 -->
web_page_background_readability_controls = overlay
<!-- web_page_background_readability_controls.2 的当前独立事实为 brightness。 -->
web_page_background_readability_controls.2 = brightness
<!-- web_page_background_readability_controls.3 的当前独立事实为 blur。 -->
web_page_background_readability_controls.3 = blur
<!-- web_page_background_readability_control_must_use_css_variables 的当前独立事实为 true。 -->
web_page_background_readability_control_must_use_css_variables = true
<!-- web_page_background_busy_image_is_allowed_with_readability_layer 的当前独立事实为 true。 -->
web_page_background_busy_image_is_allowed_with_readability_layer = true
<!-- web_page_background_business_control_must_not_derive_skin_from_background 的当前独立事实为 true。 -->
web_page_background_business_control_must_not_derive_skin_from_background = true

<!-- 持久化是显式可选能力；临时模式刷新后恢复代码默认值，持久化模式必须校验状态且存储失败不得阻断页面初始化。 -->
web_page_background_persistence_modes = ephemeral-page-state
<!-- web_page_background_persistence_modes.2 的当前独立事实为 optional-local-storage。 -->
web_page_background_persistence_modes.2 = optional-local-storage
<!-- web_page_background_refresh_behavior_must_match_configured_persistence_mode 的当前独立事实为 true。 -->
web_page_background_refresh_behavior_must_match_configured_persistence_mode = true
<!-- web_page_background_persisted_value_must_be_validated 的当前独立事实为 theme-id。 -->
web_page_background_persisted_value_must_be_validated = theme-id
<!-- web_page_background_persisted_value_must_be_validated.2 的当前独立事实为 numeric-range。 -->
web_page_background_persisted_value_must_be_validated.2 = numeric-range
<!-- web_page_background_storage_failure_must_not_block_render 的当前独立事实为 true。 -->
web_page_background_storage_failure_must_not_block_render = true
<!-- web_page_background_public_api 的当前独立事实为 getState。 -->
web_page_background_public_api = getState
<!-- web_page_background_public_api.2 的当前独立事实为 setTheme。 -->
web_page_background_public_api.2 = setTheme
<!-- web_page_background_public_api.3 的当前独立事实为 reset。 -->
web_page_background_public_api.3 = reset
<!-- web_page_background_public_api.4 的当前独立事实为 themes。 -->
web_page_background_public_api.4 = themes

<!-- 选择器使用原生按钮和 range，维护 aria-expanded、aria-pressed、可访问名称、Escape 与外部点击关闭路径。 -->
web_page_background_selector_must_use_native_controls = true
<!-- web_page_background_selector_accessibility 的当前独立事实为 aria-expanded。 -->
web_page_background_selector_accessibility = aria-expanded
<!-- web_page_background_selector_accessibility.2 的当前独立事实为 aria-pressed。 -->
web_page_background_selector_accessibility.2 = aria-pressed
<!-- web_page_background_selector_accessibility.3 的当前独立事实为 accessible-name。 -->
web_page_background_selector_accessibility.3 = accessible-name
<!-- web_page_background_selector_accessibility.4 的当前独立事实为 escape-close。 -->
web_page_background_selector_accessibility.4 = escape-close
<!-- web_page_background_selector_accessibility.5 的当前独立事实为 outside-close。 -->
web_page_background_selector_accessibility.5 = outside-close
<!-- web_page_background_motion_must_respect_prefers-reduced-motion 的当前独立事实为 true。 -->
web_page_background_motion_must_respect_prefers-reduced-motion = true

<!-- 交付前逐项切换全部主题，验证资源、参数、刷新记忆、单/多业务控件页面和不同亮度背景下的可读性。 -->
web_page_background_qa = all-themes
<!-- web_page_background_qa.2 的当前独立事实为 all-assets。 -->
web_page_background_qa.2 = all-assets
<!-- web_page_background_qa.3 的当前独立事实为 parameter-controls。 -->
web_page_background_qa.3 = parameter-controls
<!-- web_page_background_qa.4 的当前独立事实为 configured-refresh-behavior。 -->
web_page_background_qa.4 = configured-refresh-behavior
<!-- web_page_background_qa.5 的当前独立事实为 single-instance。 -->
web_page_background_qa.5 = single-instance
<!-- web_page_background_qa.6 的当前独立事实为 multi-instance。 -->
web_page_background_qa.6 = multi-instance
<!-- web_page_background_qa.7 的当前独立事实为 console。 -->
web_page_background_qa.7 = console
<!-- web_page_background_qa.8 的当前独立事实为 visual-readability。 -->
web_page_background_qa.8 = visual-readability
<!-- web_page_background_missing_asset_is_forbidden 的当前独立事实为 true-except-registered-solid-background。 -->
web_page_background_missing_asset_is_forbidden = true-except-registered-solid-background
<!-- web_page_background_theme_switch_must_not_reinitialize_business-controls 的当前独立事实为 true。 -->
web_page_background_theme_switch_must_not_reinitialize_business-controls = true

<!-- java_ability_refs 的当前独立事实为 none。 -->
java_ability_refs = none
<!-- python_ability_refs 的当前独立事实为 none。 -->
python_ability_refs = none
<!-- node_ability_refs 的当前独立事实为 none。 -->
node_ability_refs = none
