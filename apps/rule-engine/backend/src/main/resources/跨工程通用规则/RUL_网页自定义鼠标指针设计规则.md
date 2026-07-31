# 网页自定义鼠标指针设计规则

<!-- 问题：直接把参考截图或大尺寸图片作为 cursor 会携带背景、热点漂移、显示过大，并可能让输入框失去文本插入光标。 -->
<!-- 场景：网页需要品牌化、主题化或发光鼠标指针，同时仍包含按钮、菜单、输入框和可编辑区域。 -->
<!-- 业务含义：自定义指针保持视觉统一、点击位置准确、资源可复用，并保留文本编辑等浏览器原生操作反馈。 -->

custom_web_cursor_asset_must_be = transparent_raster_image
custom_web_cursor_asset_preferred_format = png
custom_web_cursor_asset_recommended_canvas = 32px_to_64px
custom_web_cursor_source_screenshot_background_must_not_remain = true

<!-- 指针点击热点必须显式写在 CSS cursor 声明中，并对准箭头尖端或工具实际作用点，禁止依赖图片中心。 -->
custom_web_cursor_css_pattern = cursor:url(<asset-path>) <hotspot-x> <hotspot-y>,<fallback>
custom_web_cursor_hotspot_must_match = visible_pointer_tip
custom_web_cursor_fallback_is_required = true

<!-- 公共鼠标样式和素材分别进入公共 CSS 与素材目录；页面通过明确主题类启用，禁止把主题光标硬编码进单一业务控件。 -->
custom_web_cursor_style_must_be_independent = true
custom_web_cursor_asset_must_be_independent = true
custom_web_cursor_shared_asset_directory = static/sel/assets/cursors/
custom_web_cursor_application_asset_directory_pattern = static/<application>/assets/cursors/
custom_web_cursor_page_opt_in_must_use = explicit_theme_class

<!-- 输入框、文本域和 contenteditable 必须恢复 text 光标，避免发光箭头遮挡文本插入位置。 -->
custom_web_cursor_text_editing_exception = input,textarea,contenteditable
custom_web_cursor_text_editing_cursor = text

<!-- 验收必须覆盖默认区域、按钮和文本输入区的计算后 cursor，并检查素材可访问、透明通道与控制台。 -->
custom_web_cursor_browser_qa_must_cover = page_surface,interactive_control,text_input
custom_web_cursor_asset_qa_must_cover = http_200,alpha_channel,canvas_size,hotspot
custom_web_cursor_console_error_or_warning_is_forbidden = true

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
