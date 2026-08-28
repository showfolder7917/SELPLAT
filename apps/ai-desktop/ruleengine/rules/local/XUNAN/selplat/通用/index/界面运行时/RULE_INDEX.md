# 界面运行时规则索引

<!-- 本叶子索引由原索引按职责无损分片；逻辑 ID、路径和触发映射保持不变。 -->

<!-- SELPLAT 所有公共 selGrid 在真实横向溢出时默认启用可发现且主题一致的滚动反馈。 -->
SELPLAT_GRID_HORIZONTAL_SCROLL_DEFAULT_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT表格横向滚动默认规则.md

<!-- 创建、装配或调整任一应用的公共 selGrid 时加载，禁止把滚动条可见性降级为应用显式开关。 -->
load_rule_for_active_user_selplat_grid_creation_assembly_or_layout_change = SELPLAT_GRID_HORIZONTAL_SCROLL_DEFAULT_RULES

<!-- 修改 selGrid 列宽、数据刷新、面板缩放或滚动反馈时加载，保证真实溢出状态自动同步。 -->
load_rule_for_active_user_selplat_grid_columns_data_resize_or_scrollbar_change = SELPLAT_GRID_HORIZONTAL_SCROLL_DEFAULT_RULES

<!-- 对比多个应用的表格滚动条亮度、尺寸和轨道样式时加载，保证复用公共主题令牌。 -->
load_rule_for_active_user_selplat_grid_scrollbar_visual_consistency_review = SELPLAT_GRID_HORIZONTAL_SCROLL_DEFAULT_RULES

<!-- SELPLAT 非阻断操作结果统一使用公共短时 Toast，禁止完成提示长期占用工作区状态栏。 -->
SELPLAT_TRANSIENT_OPERATION_FEEDBACK_TOAST_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT短时操作反馈规则.md

<!-- 新增或修改保存、查询、清空、刷新和可恢复错误提示时加载，保证反馈自动消失且不挤占业务布局。 -->
load_rule_for_active_user_selplat_non_blocking_operation_feedback = SELPLAT_TRANSIENT_OPERATION_FEEDBACK_TOAST_RULES

<!-- 修改编辑器状态栏、公共 Toast 运行时或提示生命周期时加载，保证常驻信息与短时反馈职责分开。 -->
load_rule_for_active_user_selplat_editor_status_or_toast_lifecycle = SELPLAT_TRANSIENT_OPERATION_FEEDBACK_TOAST_RULES

<!-- 验证 Toast 显示、超时删除、错误语义和连续排列时加载，保证真实浏览器闭环。 -->
load_rule_for_active_user_selplat_transient_feedback_browser_regression = SELPLAT_TRANSIENT_OPERATION_FEEDBACK_TOAST_RULES

<!-- SELPLAT 动态页签工作区统一采用切换保留、关闭销毁和公共主题语义令牌。 -->
SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT动态页签工作区生命周期规则.md

<!-- 新增或修改动态业务页签、页签注册表和关闭行为时加载，防止隐藏实例持续积累。 -->
load_rule_for_active_user_selplat_dynamic_tabs_creation_registry_switch_or_close = SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES

<!-- 组合页签、分隔器、代码编辑器和表格形成工作区时加载，保证子组件由统一清理入口回收。 -->
load_rule_for_active_user_selplat_dynamic_workspace_component_assembly = SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES

<!-- 调整动态工作区颜色、边框、焦点或活动状态时加载，保证只消费统一主题语义令牌。 -->
load_rule_for_active_user_selplat_dynamic_workspace_visual_token_change = SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES

<!-- 新增或修改 Tab 右键菜单、关闭右侧、关闭其他或全部关闭时加载，保证复用 selContextMenu 并保留关闭检查。 -->
load_rule_for_active_user_selplat_tab_context_menu_or_batch_close_change = SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES

<!-- SELPLAT 水晶窗体、菜单、浮层和面板材质。 -->
SELPLAT_CRYSTAL_UI_MATERIAL_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT水晶界面材质规则.md

<!-- load_rule_for_selplat_crystal_window_menu_or_floating_panel 的当前独立事实为 SELPLAT_CRYSTAL_UI_MATERIAL_RULES。 -->
load_rule_for_selplat_crystal_window_menu_or_floating_panel = SELPLAT_CRYSTAL_UI_MATERIAL_RULES

<!-- load_rule_for_selplat_crystal_nine_slice_center_fill_or_non_hollow_surface 的当前独立事实为 SELPLAT_CRYSTAL_UI_MATERIAL_RULES。 -->
load_rule_for_selplat_crystal_nine_slice_center_fill_or_non_hollow_surface = SELPLAT_CRYSTAL_UI_MATERIAL_RULES

<!-- load_rule_for_selplat_crystal_content_safe_area_popup_boundary_or_alpha_shaped_effect 的当前独立事实为 SELPLAT_CRYSTAL_UI_MATERIAL_RULES。 -->
load_rule_for_selplat_crystal_content_safe_area_popup_boundary_or_alpha_shaped_effect = SELPLAT_CRYSTAL_UI_MATERIAL_RULES

<!-- load_rule_for_selplat_crystal_default_resize_maximize_restore_visual_qa 的当前独立事实为 SELPLAT_CRYSTAL_UI_MATERIAL_RULES。 -->
load_rule_for_selplat_crystal_default_resize_maximize_restore_visual_qa = SELPLAT_CRYSTAL_UI_MATERIAL_RULES
