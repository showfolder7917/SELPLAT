# Web主题素材规则索引

<!-- 本叶子索引由原索引按职责无损分片；逻辑 ID、路径和触发映射保持不变。 -->

<!-- 网页背景图片、主题注册与业务控件解耦。 -->
WEB_PAGE_BACKGROUND_THEME_MODULE_RULES = local/XUNAN/跨工程通用规则/RUL_网页背景主题模块设计规则.md

<!-- load_rule_for_web_page_background_theme_or_selector 的当前独立事实为 WEB_PAGE_BACKGROUND_THEME_MODULE_RULES。 -->
load_rule_for_web_page_background_theme_or_selector = WEB_PAGE_BACKGROUND_THEME_MODULE_RULES

<!-- load_rule_for_web_background_assets_folder_or_theme_registry 的当前独立事实为 WEB_PAGE_BACKGROUND_THEME_MODULE_RULES。 -->
load_rule_for_web_background_assets_folder_or_theme_registry = WEB_PAGE_BACKGROUND_THEME_MODULE_RULES

<!-- load_rule_for_web_background_overlay_brightness_blur_or_persistence 的当前独立事实为 WEB_PAGE_BACKGROUND_THEME_MODULE_RULES。 -->
load_rule_for_web_background_overlay_brightness_blur_or_persistence = WEB_PAGE_BACKGROUND_THEME_MODULE_RULES

<!-- load_rule_for_web_background_and_business_control_separation 的当前独立事实为 WEB_PAGE_BACKGROUND_THEME_MODULE_RULES。 -->
load_rule_for_web_background_and_business_control_separation = WEB_PAGE_BACKGROUND_THEME_MODULE_RULES

<!-- 网页个性化入口、背景、面板和文字设置。 -->
WEB_PERSONALIZATION_PANEL_SETTINGS_RULES = local/XUNAN/跨工程通用规则/RUL_网页个性化面板设置规则.md

<!-- load_rule_for_web_background_and_panel_personalization_settings 的当前独立事实为 WEB_PERSONALIZATION_PANEL_SETTINGS_RULES。 -->
load_rule_for_web_background_and_panel_personalization_settings = WEB_PERSONALIZATION_PANEL_SETTINGS_RULES

<!-- load_rule_for_web_text_personalization_mode_color_contrast_or_scale 的当前独立事实为 WEB_PERSONALIZATION_PANEL_SETTINGS_RULES。 -->
load_rule_for_web_text_personalization_mode_color_contrast_or_scale = WEB_PERSONALIZATION_PANEL_SETTINGS_RULES

<!-- load_rule_for_panel_opacity_blur_tint_spacing_or_motion 的当前独立事实为 WEB_PERSONALIZATION_PANEL_SETTINGS_RULES。 -->
load_rule_for_panel_opacity_blur_tint_spacing_or_motion = WEB_PERSONALIZATION_PANEL_SETTINGS_RULES

<!-- load_rule_for_skin_agnostic_personalization_tokens_or_presets 的当前独立事实为 WEB_PERSONALIZATION_PANEL_SETTINGS_RULES。 -->
load_rule_for_skin_agnostic_personalization_tokens_or_presets = WEB_PERSONALIZATION_PANEL_SETTINGS_RULES

<!-- load_rule_for_web_page_panel_or_popup_scrollbar_theme_tokens 的当前独立事实为 WEB_PERSONALIZATION_PANEL_SETTINGS_RULES。 -->
load_rule_for_web_page_panel_or_popup_scrollbar_theme_tokens = WEB_PERSONALIZATION_PANEL_SETTINGS_RULES

<!-- load_rule_for_non_persistent_personalization_reset_on_reload 的当前独立事实为 WEB_PERSONALIZATION_PANEL_SETTINGS_RULES。 -->
load_rule_for_non_persistent_personalization_reset_on_reload = WEB_PERSONALIZATION_PANEL_SETTINGS_RULES

<!-- 网页运行时素材目录、分层和压缩。 -->
WEB_RUNTIME_ASSET_DIRECTORY_AND_COMPRESSION_RULES = local/XUNAN/跨工程通用规则/RUL_网页运行时素材目录与压缩规则.md

<!-- load_rule_for_web_runtime_asset_directory_or_layering 的当前独立事实为 WEB_RUNTIME_ASSET_DIRECTORY_AND_COMPRESSION_RULES。 -->
load_rule_for_web_runtime_asset_directory_or_layering = WEB_RUNTIME_ASSET_DIRECTORY_AND_COMPRESSION_RULES

<!-- load_rule_for_web_image_compression_webp_avif_or_png_optimization 的当前独立事实为 WEB_RUNTIME_ASSET_DIRECTORY_AND_COMPRESSION_RULES。 -->
load_rule_for_web_image_compression_webp_avif_or_png_optimization = WEB_RUNTIME_ASSET_DIRECTORY_AND_COMPRESSION_RULES

<!-- load_rule_for_web_asset_move_reference_or_visual_qa 的当前独立事实为 WEB_RUNTIME_ASSET_DIRECTORY_AND_COMPRESSION_RULES。 -->
load_rule_for_web_asset_move_reference_or_visual_qa = WEB_RUNTIME_ASSET_DIRECTORY_AND_COMPRESSION_RULES

<!-- 静态旧站镜像迁移为本地相对路径。 -->
STATIC_SITE_LOCAL_RELATIVE_PATH_MIGRATION_RULES = local/XUNAN/跨工程通用规则/RUL_静态网站本地相对路径迁移规则.md

<!-- load_rule_for_static_site_original_domain_or_root_path_migration 的当前独立事实为 STATIC_SITE_LOCAL_RELATIVE_PATH_MIGRATION_RULES。 -->
load_rule_for_static_site_original_domain_or_root_path_migration = STATIC_SITE_LOCAL_RELATIVE_PATH_MIGRATION_RULES

<!-- load_rule_for_legacy_encoded_html_local_opening 的当前独立事实为 STATIC_SITE_LOCAL_RELATIVE_PATH_MIGRATION_RULES。 -->
load_rule_for_legacy_encoded_html_local_opening = STATIC_SITE_LOCAL_RELATIVE_PATH_MIGRATION_RULES

<!-- 面板透明度、背景模糊、窗口材质和统一色调的独立职责规则。 -->
WEB_PERSONALIZATION_SURFACE_MATERIAL_RULES = local/XUNAN/跨工程通用规则/RUL_网页个性化表面材质规则.md
<!-- 修改个性化面板透明度、背景模糊、窗口材质或统一色调时直接加载。 -->
load_rule_for_web_personalization_opacity_frost_window_material_or_tint_change = WEB_PERSONALIZATION_SURFACE_MATERIAL_RULES

<!-- 统一颜色、文字模式、对比度、缩放和滚动条 Token 的独立职责规则。 -->
WEB_PERSONALIZATION_COLOR_TEXT_SCROLLBAR_RULES = local/XUNAN/跨工程通用规则/RUL_网页个性化颜色文字与滚动条规则.md
<!-- 修改个性化颜色、文字、对比度、缩放或滚动条时直接加载。 -->
load_rule_for_web_personalization_color_text_contrast_scale_or_scrollbar_change = WEB_PERSONALIZATION_COLOR_TEXT_SCROLLBAR_RULES

<!-- 面板边框间距、几何缩放、内容裁剪与动效降级的独立职责规则。 -->
WEB_PERSONALIZATION_GEOMETRY_MOTION_RULES = local/XUNAN/跨工程通用规则/RUL_网页个性化几何与动效规则.md
<!-- 修改个性化边框、间距、缩放、裁剪、动效或低性能模式时直接加载。 -->
load_rule_for_web_personalization_border_spacing_geometry_motion_or_performance_change = WEB_PERSONALIZATION_GEOMETRY_MOTION_RULES

<!-- 预设、手动状态、非持久生命周期与视觉验收的独立职责规则。 -->
WEB_PERSONALIZATION_PRESET_LIFECYCLE_QA_RULES = local/XUNAN/跨工程通用规则/RUL_网页个性化预设生命周期与验收规则.md
<!-- 修改个性化预设、刷新复位或验收矩阵时直接加载。 -->
load_rule_for_web_personalization_preset_reload_lifecycle_or_qa_change = WEB_PERSONALIZATION_PRESET_LIFECYCLE_QA_RULES
