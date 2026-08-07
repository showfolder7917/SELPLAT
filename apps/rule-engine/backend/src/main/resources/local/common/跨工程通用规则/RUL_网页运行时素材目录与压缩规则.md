# 网页运行时素材目录与压缩规则

<!-- 问题：网页直接使用生成原图、大尺寸 PNG 或散落在组件源码目录中的素材，会造成页面下载体积过大、目录归属不清、重复资源难以发现，并让基础控件与业务应用互相污染。 -->
<!-- 场景：网页运行时加载的背景、透明边框、纹理、光标、图标、照片及其他图片素材进入 static 资源目录之前。 -->
<!-- 业务含义：运行时只保留经过压缩且具有明确归属的成品素材；基础控件素材可以统一治理，业务素材保持应用边界，页面视觉质量与加载效率同时可验证。 -->

## 目录归属

web_base_runtime_asset_root = static/sel/assets/
web_base_runtime_asset_layers = components/,themes/,shared/,backgrounds/,cursors/,icons/
web_base_component_asset_directory_pattern = static/sel/assets/components/<component>/
web_base_theme_asset_directory_pattern = static/sel/assets/themes/<theme-id>/
web_base_theme_mode_base_asset_directory_pattern = static/sel/assets/themes/<theme-id>/<mode>/base/
web_base_theme_mode_accent_asset_directory_pattern = static/sel/assets/themes/<theme-id>/<mode>/accents/<accent-id>/
web_application_runtime_asset_directory_pattern = static/<application>/assets/<category>/
web_runtime_asset_root_must_not_be_flat = true

<!-- 控件专用素材必须保留组件归属；只有两个及以上基础控件真实复用的素材才进入 shared，应用专用素材禁止进入基础素材根。 -->
web_component_specific_asset_must_live_in_component_layer = true
web_theme_specific_asset_must_live_in_theme_layer = true
web_theme_asset_reference_owner = static/sel/theme/packs/<theme-id>/manifest.js
web_theme_asset_directory_id_must_equal_theme_pack_id = true
web_image_theme_skin_bundle_files = frame.webp,background.webp
web_image_theme_base_skin_bundle_must_live_in = <theme-id>/<mode>/base/
web_image_theme_accent_skin_bundle_must_live_in = <theme-id>/<mode>/accents/<accent-id>/
web_image_theme_skin_bundle_assets_must_not_be_flattened_by_type_or_filename_prefix = true
web_shared_asset_minimum_independent_consumers = 2
web_application_specific_asset_in_base_root_is_forbidden = true
web_base_asset_in_application_directory_is_forbidden = true

<!-- 主题自动绑定的边框、纹理和背景必须进入自己的 themes/<theme-id>；禁止一个主题把其他主题或公共背景当作自动配套素材。公共背景只由背景模块供用户独立选择。 -->
web_theme_exclusive_asset_examples = frame,texture,theme-only-background
web_theme_automatic_background_must_live_in = static/sel/assets/themes/<same-theme-id>/
web_theme_automatic_cross_theme_or_public_background_reference_is_forbidden = true
web_public_selectable_background_must_live_in = static/sel/assets/backgrounds/
web_public_selectable_background_must_not_be_theme_automatic_material = true
web_theme_without_image_background_may_use = registered-solid-background-id
web_theme_asset_duplicate_in_shared_or_backgrounds_is_forbidden = true

## 压缩与格式

<!-- 所有位图进入网页运行目录前必须执行格式、像素尺寸和编码质量优化；禁止把图片生成器导出的原始大图直接作为运行时资源。 -->
web_runtime_raster_must_be_optimized_before_use = true
web_generated_original_image_in_runtime_assets_is_forbidden = true
web_runtime_raster_pixel_dimensions_must_match = maximum-render-size-and-supported-device-pixel-ratio
web_runtime_raster_metadata_must_be_removed_when_not_required = true

<!-- 照片和背景优先使用 WebP 或 AVIF；带透明光效、九宫格边框和像素级 UI 材质优先使用无损 WebP，无法保证兼容或视觉质量时才保留优化后的 PNG。 -->
web_photo_or_background_preferred_format = webp,avif
web_transparent_ui_asset_preferred_format = lossless-webp,optimized-png
web_vector_icon_preferred_format = svg
web_cursor_compatible_format = optimized-png
web_runtime_format_choice_must_preserve = alpha-channel,color,edge-glow,nine-slice-corners

<!-- 已经采用高效格式且体积较小的素材不得为了统一扩展名而重复有损转码；压缩必须以实际体积下降和视觉验收为依据。 -->
web_small_optimized_asset_reencode_is_forbidden_without_measurable_benefit = true
web_lossy_recompression_chain_is_forbidden = true
web_asset_optimization_must_record = original-bytes,output-bytes,format,pixel-size

## 引用与验收

<!-- 素材移动或改名必须同步全部 HTML、CSS、JavaScript 和配置引用，不得保留无调用入口的重复副本。 -->
web_asset_move_must_sync = html,css,javascript,json,theme-registry
web_asset_duplicate_without_distinct_runtime_purpose_is_forbidden = true
web_runtime_asset_reference_must_use_local_relative_path = true

<!-- 图片 URL 经 JavaScript 写入 CSS 自定义变量后，浏览器可能按最终使用 var() 的样式表位置解析相对路径；必须检查伪元素或目标节点的计算后地址，禁止只检查配置字符串。 -->
web_css_custom_property_asset_url_resolution_base = stylesheet-where-var-is-consumed
web_css_custom_property_asset_url_qa_must_check = computed-background-image-or-cursor

<!-- 交付前必须验证资源可以访问、透明通道和关键边角未损坏、页面无控制台错误，并对比压缩前后视觉与体积。 -->
web_runtime_asset_qa_must_cover = http-status,reference-search,computed-resolved-url,dimensions,alpha-channel,visual-comparison,file-size,browser-console
web_runtime_asset_visual_regression_is_forbidden = clipped-glow,halo,banding,blurred-icon,deformed-corner,color-shift

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
