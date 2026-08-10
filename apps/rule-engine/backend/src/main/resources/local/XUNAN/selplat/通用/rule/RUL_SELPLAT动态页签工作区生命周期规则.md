# SELPLAT 动态页签工作区生命周期规则

<!-- 本规则约束前端公共组件，不依赖 Java 自动化入口。 -->
java_ability_refs = none
<!-- 本规则没有需要生成的 Python 成品，因此不虚构 Python 能力。 -->
python_ability_refs = none
<!-- 动态页签由公共前端脚本实现，当前没有独立 Node 程序入口。 -->
node_ability_refs = none
<!-- 1.2.0 固定 Tab 默认挂载右键菜单，并提供创建期和运行期显式关闭 API。 -->
rule_version = 1.2.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已登记到当前用户索引并完成页面回归。 -->
rule_status = active
<!-- 升级记录说明规则来自用户对页签隐藏、销毁和统一令牌的确认。 -->
upgrade_record = 2026-08-08:固定动态页签切换保留关闭销毁和公共工作区统一令牌约束;2026-08-10:抽取selContextMenu公共右键菜单_Tab统一提供关闭右侧_关闭其他_全部关闭并保留固定页签与beforeClose检查;2026-08-10:selTabs默认挂载selContextMenu_创建期contextMenu_false与运行期setContextMenuEnabled作为唯一显式关闭入口_页面资源配对进入构建门禁

## 公共组件边界

<!-- 多应用复用的页签、分隔器、代码编辑区和结果表格必须由公共组件提供，应用只负责业务装配。 -->
dynamic_workspace_component_boundary = shared_tabs_split_pane_code_editor_and_grid_with_application_assembly_only
<!-- 公共组件必须按完整实例键注册，禁止依赖单例全局节点或扫描页面猜测宿主。 -->
dynamic_workspace_instance_registry = complete_business_instance_key_per_component
<!-- 右键菜单门户、视口定位、禁用状态和键盘导航必须由 selContextMenu 提供，Tab 只组合动作语义。 -->
dynamic_workspace_context_menu_boundary = shared_selContextMenu_for_portal_position_disabled_state_and_keyboard_tabs_assembly_only
<!-- selTabs 创建时默认挂载 selContextMenu；调用方只能用 contextMenu:false 或 setContextMenuEnabled(false) 明确关闭，运行期传 true 必须可恢复。 -->
dynamic_tab_context_menu_default_and_opt_out = enabled_by_default,creation_contextMenu_false,runtime_setContextMenuEnabled_false_or_true
<!-- 任何应用 HTML 加载 selTabs 时必须同时加载 selContextMenu CSS 和先行 JS，缺失或顺序错误由公共前端构建门禁阻断。 -->
dynamic_tab_context_menu_resource_gate = context_css_required,context_js_before_tabs_js,scan_all_application_static_html
<!-- 应用颜色、边框、焦点、编辑区和页签状态必须消费统一主题语义令牌，禁止应用内另写一套颜色值。 -->
dynamic_workspace_visual_token_policy = unified_theme_semantic_tokens_without_application_color_override

## 页签生命周期

<!-- 切换页签只隐藏非活动面板，必须保留编辑值、查询结果、滚动位置和当前业务状态。 -->
dynamic_tab_switch_lifecycle = hide_inactive_panel_and_preserve_session_state
<!-- 关闭页签必须删除页签和面板 DOM，并销毁其事件、控制器、观察器、定时器和实例注册。 -->
dynamic_tab_close_lifecycle = destroy_dom_events_controllers_observers_timers_and_registry
<!-- 页签公共组件必须为每个动态面板接收唯一清理回调，应用组合的全部子组件都由该入口回收。 -->
dynamic_tab_child_cleanup_contract = one_cleanup_callback_per_dynamic_panel
<!-- 子组件清理异常时仍必须完成页签 DOM 和注册回收，并明确记录错误，禁止留下半关闭实例。 -->
dynamic_tab_cleanup_failure_policy = finish_dom_and_registry_disposal_then_report_error
<!-- 重复打开相同业务键时必须激活既有页签，禁止生成同一业务对象的重复隐藏实例。 -->
dynamic_tab_duplicate_open_policy = activate_existing_business_key
<!-- 工作区整体销毁或数据源切换时必须强制逐页执行同一清理链路。 -->
dynamic_workspace_destroy_policy = force_close_all_tabs_through_shared_cleanup_chain
<!-- Tab 右键菜单固定提供关闭右侧、关闭其他和全部关闭，当前 Tab 由已有关闭按钮处理；无可关闭目标时动作必须禁用。 -->
dynamic_tab_context_actions = close_right,close_others,close_all,current_uses_existing_close_button,disable_without_closable_target
<!-- 用户发起的批量关闭只处理 closable 页签，逐项执行 beforeClose；任意项取消时停止，禁止借用 force 跳过未保存检查。 -->
dynamic_tab_user_batch_close_policy = closable_only,run_beforeClose_per_tab,stop_on_cancel,no_force
<!-- 鼠标右键、ContextMenu 键与 Shift+F10 必须打开同一菜单，Escape 关闭并恢复原 Tab 焦点。 -->
dynamic_tab_context_menu_accessibility = mouse_contextmenu,ContextMenu_key,Shift_F10,arrow_navigation,Escape_restore_focus

## 验证

<!-- 页面回归必须证明切换前后的状态相等，并证明关闭后页签、面板和所有子组件实例数量同步减少。 -->
dynamic_tab_lifecycle_verification = browser_switch_state_retention_and_close_instance_count_reduction
<!-- 公共组件改动必须通过脚本语法、公共前端检查、应用测试和真实浏览器控制台检查。 -->
verification_required = javascript_syntax_check,shared_frontend_check,application_tests,browser_interaction_and_console_regression
<!-- 本规则固定生命周期判断，不生成重复结构文件，因此模板不适用。 -->
template_not_applicable_reason = lifecycle_constraints_have_no_repeatable_output_template
<!-- 真实浏览器交互和公共组件测试是权威案例，不复制容易过期的静态示例。 -->
example_not_applicable_reason = browser_and_component_regression_are_authoritative_examples
<!-- 当前验证横跨多个公共控件与应用装配，暂不抽成单一独立程序。 -->
program_not_applicable_reason = verification_spans_shared_components_application_assembly_and_browser_runtime
