# 网页自定义鼠标指针设计规则

<!-- 问题：直接把参考截图或大尺寸图片作为 cursor 会携带背景、热点漂移、显示过大，并可能让输入框失去文本插入光标。 -->
<!-- 场景：网页需要品牌化、主题化或发光鼠标指针，同时仍包含按钮、菜单、输入框和可编辑区域。 -->
<!-- 业务含义：自定义指针保持视觉统一、点击位置准确、资源可复用，并保留文本编辑等浏览器原生操作反馈。 -->

<!-- custom_web_cursor_asset_must_be 的当前独立事实为 transparent_raster_image。 -->
custom_web_cursor_asset_must_be = transparent_raster_image
<!-- custom_web_cursor_asset_preferred_format 的当前独立事实为 png。 -->
custom_web_cursor_asset_preferred_format = png
<!-- custom_web_cursor_asset_recommended_canvas 的当前独立事实为 32px_to_64px。 -->
custom_web_cursor_asset_recommended_canvas = 32px_to_64px
<!-- custom_web_cursor_source_screenshot_background_must_not_remain 的当前独立事实为 true。 -->
custom_web_cursor_source_screenshot_background_must_not_remain = true

<!-- 指针点击热点必须显式写在 CSS cursor 声明中，并对准箭头尖端或工具实际作用点，禁止依赖图片中心。 -->
custom_web_cursor_css_pattern = cursor:url(<asset-path>) <hotspot-x> <hotspot-y>
<!-- custom_web_cursor_css_pattern.2 的当前独立事实为 <fallback>。 -->
custom_web_cursor_css_pattern.2 = <fallback>
<!-- custom_web_cursor_hotspot_must_match 的当前独立事实为 visible_pointer_tip。 -->
custom_web_cursor_hotspot_must_match = visible_pointer_tip
<!-- custom_web_cursor_fallback_is_required 的当前独立事实为 true。 -->
custom_web_cursor_fallback_is_required = true

<!-- 公共鼠标样式和素材分别进入公共 CSS 与素材目录；页面通过明确主题类启用，禁止把主题光标硬编码进单一业务控件。 -->
custom_web_cursor_style_must_be_independent = true
<!-- custom_web_cursor_asset_must_be_independent 的当前独立事实为 true。 -->
custom_web_cursor_asset_must_be_independent = true
<!-- custom_web_cursor_shared_asset_directory 的当前独立事实为 static/sel/assets/cursors/。 -->
custom_web_cursor_shared_asset_directory = static/sel/assets/cursors/
<!-- custom_web_cursor_application_asset_directory_pattern 的当前独立事实为 static/<application>/assets/cursors/。 -->
custom_web_cursor_application_asset_directory_pattern = static/<application>/assets/cursors/
<!-- custom_web_cursor_page_opt_in_must_use 的当前独立事实为 explicit_theme_class。 -->
custom_web_cursor_page_opt_in_must_use = explicit_theme_class

<!-- 输入框、文本域和 contenteditable 必须恢复 text 光标，避免发光箭头遮挡文本插入位置。 -->
custom_web_cursor_text_editing_exception = input
<!-- custom_web_cursor_text_editing_exception.2 的当前独立事实为 textarea。 -->
custom_web_cursor_text_editing_exception.2 = textarea
<!-- custom_web_cursor_text_editing_exception.3 的当前独立事实为 contenteditable。 -->
custom_web_cursor_text_editing_exception.3 = contenteditable
<!-- custom_web_cursor_text_editing_cursor 的当前独立事实为 text。 -->
custom_web_cursor_text_editing_cursor = text

<!-- 可移动、可缩放窗口必须优先显示原生几何反馈；全局品牌指针不得覆盖标题栏移动和八方向手柄。 -->
custom_web_cursor_native_geometry_exception = window-move
<!-- custom_web_cursor_native_geometry_exception.2 的当前独立事实为 resize-north。 -->
custom_web_cursor_native_geometry_exception.2 = resize-north
<!-- custom_web_cursor_native_geometry_exception.3 的当前独立事实为 resize-east。 -->
custom_web_cursor_native_geometry_exception.3 = resize-east
<!-- custom_web_cursor_native_geometry_exception.4 的当前独立事实为 resize-south。 -->
custom_web_cursor_native_geometry_exception.4 = resize-south
<!-- custom_web_cursor_native_geometry_exception.5 的当前独立事实为 resize-west。 -->
custom_web_cursor_native_geometry_exception.5 = resize-west
<!-- custom_web_cursor_native_geometry_exception.6 的当前独立事实为 resize-north-east。 -->
custom_web_cursor_native_geometry_exception.6 = resize-north-east
<!-- custom_web_cursor_native_geometry_exception.7 的当前独立事实为 resize-south-east。 -->
custom_web_cursor_native_geometry_exception.7 = resize-south-east
<!-- custom_web_cursor_native_geometry_exception.8 的当前独立事实为 resize-south-west。 -->
custom_web_cursor_native_geometry_exception.8 = resize-south-west
<!-- custom_web_cursor_native_geometry_exception.9 的当前独立事实为 resize-north-west。 -->
custom_web_cursor_native_geometry_exception.9 = resize-north-west
<!-- custom_web_cursor_resize_mapping 的当前独立事实为 north|south:ns-resize。 -->
custom_web_cursor_resize_mapping = north|south:ns-resize
<!-- custom_web_cursor_resize_mapping.2 的当前独立事实为 east|west:ew-resize。 -->
custom_web_cursor_resize_mapping.2 = east|west:ew-resize
<!-- custom_web_cursor_resize_mapping.3 的当前独立事实为 north-west|south-east:nwse-resize。 -->
custom_web_cursor_resize_mapping.3 = north-west|south-east:nwse-resize
<!-- custom_web_cursor_resize_mapping.4 的当前独立事实为 north-east|south-west:nesw-resize。 -->
custom_web_cursor_resize_mapping.4 = north-east|south-west:nesw-resize
<!-- custom_web_cursor_active_drag_must_lock 的当前独立事实为 current-interaction-cursor-across-page。 -->
custom_web_cursor_active_drag_must_lock = current-interaction-cursor-across-page
<!-- custom_web_cursor_active_drag_must_release_on 的当前独立事实为 pointerup。 -->
custom_web_cursor_active_drag_must_release_on = pointerup
<!-- custom_web_cursor_active_drag_must_release_on.2 的当前独立事实为 pointercancel。 -->
custom_web_cursor_active_drag_must_release_on.2 = pointercancel
<!-- custom_web_cursor_active_drag_must_release_on.3 的当前独立事实为 window-blur。 -->
custom_web_cursor_active_drag_must_release_on.3 = window-blur

<!-- 验收必须覆盖默认区域、按钮和文本输入区的计算后 cursor，并检查素材可访问、透明通道与控制台。 -->
custom_web_cursor_browser_qa_must_cover = page_surface
<!-- custom_web_cursor_browser_qa_must_cover.2 的当前独立事实为 interactive_control。 -->
custom_web_cursor_browser_qa_must_cover.2 = interactive_control
<!-- custom_web_cursor_browser_qa_must_cover.3 的当前独立事实为 text_input。 -->
custom_web_cursor_browser_qa_must_cover.3 = text_input
<!-- custom_web_cursor_browser_qa_must_cover.4 的当前独立事实为 window-header。 -->
custom_web_cursor_browser_qa_must_cover.4 = window-header
<!-- custom_web_cursor_browser_qa_must_cover.5 的当前独立事实为 all-eight-resize-handles。 -->
custom_web_cursor_browser_qa_must_cover.5 = all-eight-resize-handles
<!-- custom_web_cursor_browser_qa_must_cover.6 的当前独立事实为 active-drag-lock。 -->
custom_web_cursor_browser_qa_must_cover.6 = active-drag-lock
<!-- custom_web_cursor_browser_qa_must_cover.7 的当前独立事实为 post-drag-restore。 -->
custom_web_cursor_browser_qa_must_cover.7 = post-drag-restore
<!-- custom_web_cursor_asset_qa_must_cover 的当前独立事实为 http_200。 -->
custom_web_cursor_asset_qa_must_cover = http_200
<!-- custom_web_cursor_asset_qa_must_cover.2 的当前独立事实为 alpha_channel。 -->
custom_web_cursor_asset_qa_must_cover.2 = alpha_channel
<!-- custom_web_cursor_asset_qa_must_cover.3 的当前独立事实为 canvas_size。 -->
custom_web_cursor_asset_qa_must_cover.3 = canvas_size
<!-- custom_web_cursor_asset_qa_must_cover.4 的当前独立事实为 hotspot。 -->
custom_web_cursor_asset_qa_must_cover.4 = hotspot
<!-- custom_web_cursor_console_error_or_warning_is_forbidden 的当前独立事实为 true。 -->
custom_web_cursor_console_error_or_warning_is_forbidden = true

<!-- java_ability_refs 的当前独立事实为 none。 -->
java_ability_refs = none
<!-- python_ability_refs 的当前独立事实为 none。 -->
python_ability_refs = none
<!-- node_ability_refs 的当前独立事实为 none。 -->
node_ability_refs = none
