# 网页背景主题模块设计规则

<!-- 问题：网页背景直接写入业务控件 CSS 后，背景图片、遮罩和表格布局耦合，换主题会污染控件样式并阻碍跨页面复用。 -->
<!-- 场景：网页需要在风景、卡通、可爱、科技、国风、宇宙等不同色调背景之间切换，同时保持表格、面板、菜单和树控件稳定。 -->
<!-- 业务含义：背景是页面级独立模块；主题图片和显示参数只改变背景层，不改变业务控件结构、实例状态或组件主题。 -->

web_page_background_module_name = selPageBackground
web_page_background_shared_asset_folder = static/sel/assets/backgrounds/
web_page_background_application_asset_folder_pattern = static/<application>/assets/backgrounds/
web_page_background_asset_scope_choice = cross-application-theme-use-shared-folder,application-only-theme-use-application-folder
web_page_background_css_responsibility = image-layer,overlay,optional-standalone-background-selector
web_page_background_js_responsibility = theme-registry,state,public-api
web_page_layout_css_must_not_embed_business_background_image = true

<!-- 背景层、遮罩层和选择器必须与业务控件 DOM 分离；任一背景区域删除后，面板和业务控件仍可独立显示与操作。 -->
web_page_background_layer_must_be_independent = true
web_page_background_must_not_live_inside_grid_or_business-control = true
web_page_background_control_is_optional = true
web_page_background_selector_may_be_composed_by = independent-personalization-shell
web_page_background_missing_control_fallback = default-or-saved-theme
web_page_background_must_not_change = grid-state,panel-layout,tree-state,menu-state,pagination-state

<!-- 主题必须使用显式配置清单；新增图片只追加主题配置，不得根据文件名、色调或页面业务名称推断主题行为。 -->
web_page_background_theme_source = explicit-config
web_page_background_theme_fields = id,name,category,image
web_page_background_theme_id_must_be_stable = true
web_page_background_theme_must_not_infer_from_filename = true
web_page_background_color_palette_is_unrestricted = true
web_page_background_theme_may_include = landscape,cartoon,cute,technology,space,fantasy,oriental,minimal,ocean

<!-- 图片素材使用清晰、稳定、语义化的英文文件名；网页背景优先使用压缩后的 WebP，避免把生成源文件或临时文件留在运行资源目录。 -->
web_page_background_asset_filename_pattern = category-subject-or-palette.webp
web_page_background_runtime_image_format_preferred = webp
web_page_background_runtime_image_must_follow = WEB_RUNTIME_ASSET_DIRECTORY_AND_COMPRESSION_RULES
web_page_background_generated_source_must_not_live_in_runtime_assets = true
web_page_background_asset_must_have_no = text,logo,watermark,embedded-ui

<!-- 不同明暗和复杂度的背景统一通过可调遮罩、亮度和模糊度适配；控件自身不得为某张背景硬编码文字颜色。 -->
web_page_background_readability_controls = overlay,brightness,blur
web_page_background_readability_control_must_use_css_variables = true
web_page_background_busy_image_is_allowed_with_readability_layer = true
web_page_background_business_control_must_not_derive_skin_from_background = true

<!-- 持久化是显式可选能力；临时模式刷新后恢复代码默认值，持久化模式必须校验状态且存储失败不得阻断页面初始化。 -->
web_page_background_persistence_modes = ephemeral-page-state,optional-local-storage
web_page_background_refresh_behavior_must_match_configured_persistence_mode = true
web_page_background_persisted_value_must_be_validated = theme-id,numeric-range
web_page_background_storage_failure_must_not_block_render = true
web_page_background_public_api = getState,setTheme,reset,themes

<!-- 选择器使用原生按钮和 range，维护 aria-expanded、aria-pressed、可访问名称、Escape 与外部点击关闭路径。 -->
web_page_background_selector_must_use_native_controls = true
web_page_background_selector_accessibility = aria-expanded,aria-pressed,accessible-name,escape-close,outside-close
web_page_background_motion_must_respect_prefers-reduced-motion = true

<!-- 交付前逐项切换全部主题，验证资源、参数、刷新记忆、单/多业务控件页面和不同亮度背景下的可读性。 -->
web_page_background_qa = all-themes,all-assets,parameter-controls,configured-refresh-behavior,single-instance,multi-instance,console,visual-readability
web_page_background_missing_asset_is_forbidden = true
web_page_background_theme_switch_must_not_reinitialize_business-controls = true

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
