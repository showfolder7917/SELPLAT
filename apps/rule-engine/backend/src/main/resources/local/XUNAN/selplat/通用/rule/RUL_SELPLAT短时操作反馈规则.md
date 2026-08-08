# SELPLAT 短时操作反馈规则

<!-- 本规则不需要 Java 专用能力；公共前端运行时和应用装配层直接承担实现。 -->
java_ability_refs = none
<!-- 本规则不生成 Python 成品；标准页面视觉测试能力只用于交付验证。 -->
python_ability_refs = none
<!-- 本规则不新增独立 Node 程序；现有前端语法检查和浏览器回归覆盖行为。 -->
node_ability_refs = none
<!-- 首版固化用户确认的非阻断操作结果必须使用短时 Toast。 -->
rule_version = 1.0.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已登记到当前用户 SELPLAT 通用索引并完成页面回归。 -->
rule_status = active
<!-- 升级记录说明规则由 MDA SQL 执行完成提示的常驻状态栏纠正形成。 -->
upgrade_record = 2026-08-08:将非阻断操作完成提示统一为公共短时Toast并禁止长期占用工作区状态栏

<!-- 问题：操作完成文字写入编辑器状态栏、面板分区或业务内容后会长期滞留，形成过期状态并占用有效工作空间。 -->
<!-- 场景：当前稳定用户在 SELPLAT 任一应用中展示保存、查询、清空、刷新或可恢复错误等非阻断操作结果。 -->
<!-- 业务含义：短时反馈只确认刚刚发生的动作，工作区常驻区域继续展示位置、当前状态或业务内容。 -->

## 反馈载体

<!-- 保存、查询、清空、刷新等非阻断操作完成提示必须调用公共 Toast，不得写入业务面板形成常驻文字。 -->
selplat_non_blocking_operation_feedback = shared_transient_toast
<!-- 可立即重试且不要求用户先作业务选择的错误允许使用 error Toast，并通过 alert 语义及时播报。 -->
selplat_recoverable_operation_error_feedback = shared_transient_error_toast_with_alert_semantics
<!-- 删除确认、权限变更、不可逆动作和必须阅读后决策的重要反馈继续使用可确认对话框，不得降级成短时 Toast。 -->
selplat_acknowledgement_required_feedback = confirmable_dialog_not_transient_toast
<!-- 应用装配层只能调用公共 Toast 接口并传入业务文字和语义类型，禁止在单个应用中复制 Toast DOM、定时器或主题样式。 -->
selplat_toast_component_boundary = shared_runtime_api_with_application_message_and_tone_only

## 生命周期与布局

<!-- Toast 必须脱离页面业务布局并在短时间后自动删除，默认可见时长控制在二至四秒。 -->
selplat_transient_toast_lifecycle = fixed_overlay_auto_remove_after_2_to_4_seconds
<!-- 连续反馈必须在公共宿主中按发生顺序排列，禁止互相覆盖或撑大工作区。 -->
selplat_consecutive_toast_behavior = ordered_stack_without_business_layout_occupation
<!-- 编辑器状态栏只保留光标位置、持续状态或仍然有效的上下文，禁止保留已经完成的动作提示。 -->
selplat_editor_status_bar_boundary = current_position_or_live_context_not_completed_action_message
<!-- 异步执行过程优先由按钮禁用、忙碌状态或进度控件表达，禁止用不会更新的“正在执行”文字冒充实时状态。 -->
selplat_async_progress_feedback = live_loading_or_progress_state_not_stale_status_text

## 可访问性与视觉

<!-- 普通 Toast 使用 status 语义，可恢复错误使用 alert 语义，提示消失不得夺走当前键盘焦点。 -->
selplat_toast_accessibility = status_for_normal_alert_for_error_without_focus_steal
<!-- Toast 的颜色、边框、表面、阴影和字号必须消费公共主题语义令牌，禁止应用写死私有颜色。 -->
selplat_toast_visual_tokens = shared_theme_semantic_tokens_only
<!-- 减少动态效果偏好开启时必须停用位移动画，但仍保留可读反馈和自动清理。 -->
selplat_toast_reduced_motion_behavior = disable_transition_keep_readability_and_auto_removal

## 验证

<!-- 回归必须证明提示执行后可见、超时后节点删除、常驻状态栏无完成文字且浏览器控制台无错误。 -->
verification_required = toast_visible_after_action,toast_removed_after_timeout,no_persistent_completion_status,no_browser_console_error
<!-- 涉及编辑器和结果区时还必须验证公共分隔器比例可继续调整，避免反馈改造破坏上下工作区。 -->
workspace_regression_required = shared_split_pane_ratio_remains_adjustable
<!-- 公共运行时实现就是唯一复用成品，不再生成重复模板或应用私有示例。 -->
template_not_applicable_reason = shared_runtime_toast_is_the_single_reusable_implementation
<!-- MDA SQL 查询页签是真实核验案例，后续应用按同一公共接口回归即可。 -->
verified_example_refs = apps/mda/backend/src/main/resources/static/mda
<!-- 现有语法检查、公共前端检查、规则加载测试和真实浏览器验证已经提供可重复执行入口。 -->
program_not_applicable_reason = existing_frontend_checks_rule_loader_and_browser_tests_cover_the_behavior
