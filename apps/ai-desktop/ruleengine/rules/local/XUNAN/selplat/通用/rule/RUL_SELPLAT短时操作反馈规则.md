# SELPLAT 短时操作反馈规则

<!-- 本规则不需要 Java 专用能力；公共前端运行时和应用装配层直接承担实现。 -->
java_ability_refs = none
<!-- 本规则不生成 Python 成品；标准页面视觉测试能力只用于交付验证。 -->
python_ability_refs = none
<!-- 本规则不新增独立 Node 程序；现有前端语法检查和浏览器回归覆盖行为。 -->
node_ability_refs = none
<!-- 2.0.0 增加删除、覆盖、未保存丢弃和跨文件写入的统一确认门禁。 -->
rule_version = 2.0.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已登记到当前用户 SELPLAT 通用索引并完成页面回归。 -->
rule_status = active

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

## 危险动作确认

<!-- 永久删除、覆盖现有文件、丢弃未保存内容和一次写入多个正式文件都必须在首个副作用前等待用户明确确认。 -->
selplat_dangerous_action_confirmation_scope = permanent_delete
<!-- selplat_dangerous_action_confirmation_scope.2 的当前独立事实为 overwrite_existing_files。 -->
selplat_dangerous_action_confirmation_scope.2 = overwrite_existing_files
<!-- selplat_dangerous_action_confirmation_scope.3 的当前独立事实为 discard_unsaved_content。 -->
selplat_dangerous_action_confirmation_scope.3 = discard_unsaved_content
<!-- selplat_dangerous_action_confirmation_scope.4 的当前独立事实为 cross_file_write。 -->
selplat_dangerous_action_confirmation_scope.4 = cross_file_write
<!-- 确认框必须展示真实业务目标和将发生的副作用，确认按钮使用动作名称，禁止只写含义不明的“确定”。 -->
selplat_dangerous_confirmation_content = real_target
<!-- selplat_dangerous_confirmation_content.2 的当前独立事实为 side_effect_summary。 -->
selplat_dangerous_confirmation_content.2 = side_effect_summary
<!-- selplat_dangerous_confirmation_content.3 的当前独立事实为 explicit_action_confirm_label。 -->
selplat_dangerous_confirmation_content.3 = explicit_action_confirm_label
<!-- 同一次操作同时命中覆盖和跨文件写入等多个风险时合并为一个确认框，禁止连续弹出重复确认。 -->
selplat_multiple_risk_confirmation_policy = one_combined_dialog_per_user_action_no_stacked_confirmations
<!-- 用户取消或关闭确认框后不得发送写请求、执行删除、替换文件或销毁未保存状态。 -->
selplat_confirmation_cancel_boundary = no_mutation_request_no_delete_no_file_replace_no_unsaved_state_disposal
<!-- 所有危险确认复用公共紧凑确认控件并默认聚焦取消，应用不得回退到浏览器原生 confirm。 -->
selplat_dangerous_confirmation_component = shared_compact_confirm_dialog_default_focus_cancel_no_native_confirm
<!-- 跨文件写入确认应给出工程、表、目录或文件数量等稳定范围；后端原子事务和回滚仍然必须保留。 -->
selplat_cross_file_write_confirmation = show_stable_batch_scope_before_first_write_keep_atomic_rollback

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
verification_required = toast_visible_after_action
<!-- verification_required.2 的当前独立事实为 toast_removed_after_timeout。 -->
verification_required.2 = toast_removed_after_timeout
<!-- verification_required.3 的当前独立事实为 no_persistent_completion_status。 -->
verification_required.3 = no_persistent_completion_status
<!-- verification_required.4 的当前独立事实为 no_browser_console_error。 -->
verification_required.4 = no_browser_console_error
<!-- 涉及编辑器和结果区时还必须验证公共分隔器比例可继续调整，避免反馈改造破坏上下工作区。 -->
workspace_regression_required = shared_split_pane_ratio_remains_adjustable
<!-- 公共运行时实现就是唯一复用成品，不再生成重复模板或应用私有示例。 -->
template_not_applicable_reason = shared_runtime_toast_is_the_single_reusable_implementation
<!-- MDA SQL 查询页签是真实核验案例，后续应用按同一公共接口回归即可。 -->
verified_example_refs = apps/mda/backend/src/main/resources/static/mda
<!-- 现有语法检查、公共前端检查、规则加载测试和真实浏览器验证已经提供可重复执行入口。 -->
program_not_applicable_reason = existing_frontend_checks_rule_loader_and_browser_tests_cover_the_behavior
