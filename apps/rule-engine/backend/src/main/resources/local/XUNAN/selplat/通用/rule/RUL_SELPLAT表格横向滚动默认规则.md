# SELPLAT 表格横向滚动默认规则

<!-- 本规则不需要 Java 专用能力；公共前端组件和应用回归直接承担实现验证。 -->
java_ability_refs = none
<!-- 本规则不需要 Python 成品；标准页面视觉测试程序只作为交付验证入口复用。 -->
python_ability_refs = none
<!-- 本规则不新增独立 Node 程序；selGrid 脚本由现有语法检查和浏览器回归验证。 -->
node_ability_refs = none
<!-- 首版固化用户确认的所有 selGrid 默认自动提供可发现横向滚动反馈。 -->
rule_version = 1.1.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已登记到当前用户 SELPLAT 通用索引并完成组件回归。 -->
rule_status = active
<!-- 升级记录说明规则由 MDA 单页修正提升为所有 selGrid 的公共默认行为。 -->
upgrade_record = 2026-08-08:将可发现横向滚动反馈从MDA显式状态提升为所有selGrid真实溢出时的默认行为;2026-08-11:所有selGrid表头字段边界默认支持列宽调整_允许columnResize显式关闭

<!-- 问题：横向滚动条只由单个应用开关控制时，其他 selGrid 即使内容超宽也缺少明显反馈，用户无法判断页面是否可以横向浏览。 -->
<!-- 场景：当前稳定用户在 SELPLAT 任一应用中创建、装配、调整或复用公共 selGrid。 -->
<!-- 业务含义：所有表格使用同一套自动溢出判断和主题反馈，应用只声明业务列布局，不再重复配置滚动条可见性。 -->

## 默认行为

<!-- 每个 selGrid 必须根据自身滚动视口的 scrollWidth 与 clientWidth 自动判断真实横向溢出，禁止要求应用显式开启滚动条样式。 -->
selgrid_horizontal_scrollbar_activation = automatic_when_scroll_width_exceeds_client_width
<!-- 不存在真实横向溢出时必须移除增强状态和完整轨道，避免静态装饰误导用户。 -->
selgrid_horizontal_scrollbar_inactive_behavior = remove_enhanced_state_and_full_track_when_content_fits
<!-- grid.horizontalScroll 只允许声明动态宽表的固定列宽、最小宽度和截断布局，不再控制公共滚动条反馈是否生效。 -->
selgrid_explicit_horizontal_scroll_option_boundary = wide_column_layout_only_not_scrollbar_visibility
<!-- 横向滚动必须限制在 selGrid 中央视口内，禁止撑宽外层面板、应用壳或浏览器文档。 -->
selgrid_horizontal_overflow_boundary = internal_table_scroller_only_no_panel_or_document_expansion

## 列宽调整

<!-- 每个 selGrid 默认在表头字段右边界提供列宽调整，调用方不得为单页复制私有拖拽实现。 -->
selgrid_column_resize_default = enabled_on_every_header_boundary
<!-- 只有显式传入 grid.columnResize=false 才关闭列宽调整；缺省和 true 均启用。 -->
selgrid_column_resize_opt_out = grid_columnResize_false_only
<!-- 开始调整时必须冻结全部当前计算列宽，移动过程只改变目标列并同步表格内部总宽度。 -->
selgrid_column_resize_width_contract = freeze_computed_widths_then_change_target_column_and_internal_table_width
<!-- 分隔线必须同时支持鼠标指针与左右方向键，并公开 separator 无障碍语义。 -->
selgrid_column_resize_interaction = pointer_drag_and_arrow_keys_with_separator_semantics
<!-- 调整后的列宽必须在当前实例数据刷新和语言切换后保留，但不得跨页面持久化或污染其他实例。 -->
selgrid_column_resize_lifecycle = preserve_within_instance_only_reset_after_destroy_or_reload

## 状态同步

<!-- 表头、列定义和运行时语言更新后必须在浏览器完成布局后重新测量真实溢出。 -->
selgrid_horizontal_overflow_resync_after_column_change = required_after_layout_frame
<!-- 数据刷新和分页重绘后必须重新测量，禁止沿用可能已经过期的滚动状态。 -->
selgrid_horizontal_overflow_resync_after_data_render = required_after_layout_frame
<!-- 面板缩放、侧栏折叠和浏览器尺寸变化必须由公共组件尺寸观察自动覆盖，调用方不得逐页重复绑定。 -->
selgrid_horizontal_overflow_resync_after_container_resize = shared_component_resize_observer
<!-- 多次连续 DOM 与尺寸变化必须合并到动画帧内测量，避免同步读写布局造成抖动。 -->
selgrid_horizontal_overflow_measurement_schedule = coalesced_request_animation_frame

## 视觉一致性

<!-- 横向轨道、滑块、悬停、按下和光晕必须复用同页纵向滚动条的主题令牌。 -->
selgrid_horizontal_scrollbar_visual_tokens = same_track_thumb_hover_active_and_glow_tokens_as_panel_vertical_scrollbars
<!-- 横向滚动可以使用更大的公共操作尺寸和完整轨道增强可发现性，但禁止单独提高静止亮度。 -->
selgrid_horizontal_scrollbar_allowed_difference = larger_shared_operable_size_and_complete_track_only
<!-- 静止状态必须能识别轨道与滑块，且不能依赖悬停后才显现。 -->
selgrid_horizontal_scrollbar_discoverability = visible_track_and_thumb_at_rest_when_overflowing

## 规则包组成与验证

<!-- 公共 selGrid 实现就是唯一可复用成品，不再生成重复 CSS 或页面模板。 -->
template_not_applicable_reason = shared_selgrid_component_is_the_single_reusable_implementation
<!-- MDA 动态宽表与 reference-data 普通表格共同构成显式宽表和默认表格的已核验案例。 -->
verified_example_refs = apps/mda/backend/src/main/resources/static/mda
<!-- verified_example_refs.2 的当前独立事实为 apps/reference-data/backend/src/main/resources/static/reference-data。 -->
verified_example_refs.2 = apps/reference-data/backend/src/main/resources/static/reference-data
<!-- 现有语法检查、组件检查、规则加载测试和真实浏览器测量已经提供可重复验证。 -->
program_not_applicable_reason = existing_javascript_component_rule_loader_and_browser_visual_tests_cover_the_behavior
<!-- 交付必须同时验证显式宽表与普通 selGrid，并确认真实溢出、状态类、内部滚动和文档宽度边界一致。 -->
verification_scope = javascript_syntax
<!-- verification_scope.2 的当前独立事实为 shared_frontend_checks。 -->
verification_scope.2 = shared_frontend_checks
<!-- verification_scope.3 的当前独立事实为 rule_index_loading。 -->
verification_scope.3 = rule_index_loading
<!-- verification_scope.4 的当前独立事实为 mda_wide_grid_browser。 -->
verification_scope.4 = mda_wide_grid_browser
<!-- verification_scope.5 的当前独立事实为 reference_data_default_grid_browser。 -->
verification_scope.5 = reference_data_default_grid_browser
<!-- verification_scope.6 的当前独立事实为 column_resize_pointer_and_keyboard。 -->
verification_scope.6 = column_resize_pointer_and_keyboard
<!-- verification_scope.7 的当前独立事实为 document_overflow_boundary。 -->
verification_scope.7 = document_overflow_boundary
<!-- verification_scope.8 的当前独立事实为 visual_review。 -->
verification_scope.8 = visual_review
