# AI Desktop 事件、记忆与统一界面规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 5.105.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 本职责没有独立 Java 能力入口。 -->
java_ability_refs = none
<!-- 本职责没有独立 Python 能力入口。 -->
python_ability_refs = none
<!-- 本职责没有独立 Node 能力入口。 -->
node_ability_refs = none

nangong_distribution_planning_contract = AI_read_only_investigation + impact_scope_not_task_count + minimal_independently_mergeable_units + expected_files_and_acceptance + linghu_distribution_audit_before_dispatch + overlap_blocks_dispatch
<!-- 提案分发的授权边界来自所属专题冻结的工作区；自动演化上下文只服务自动研讨，不能成为手动返还的隐式前置条件。 -->
nangong_dispatch_workspace_source_contract = proposal_topic_workspace_is_single_source_for_planning_audit_and_task_creation + manual_dispatch_independent_from_automation_context + validate_roots_before_Codex_send + missing_workspace_returns_business_error_not_null_property_TypeError
<!-- 令狐接收统一异常时生成的自身事件只能作为状态记录，不得再次进入异常消费队列。 -->
linghu_exception_intake_loop_prevention_contract = single_event_center_entry + intake_event_is_state_change + exclude_legacy_and_current_intake_types_from_unhandled_query + source_event_fingerprint_dedup
<!-- 重大业务工作台使用包含模块、流程分组和页面叶子的单棵树；人工动作与自动运行控制不得混排。 -->
evolution_workspace_information_architecture_contract = one_expandable_tree_people_evolution_audit_with_groups_and_leaves + left_tree_right_content_two_column_layout + manual_workspace_separate_from_automatic_console + hanli_approval_integrated + SELUI_tree_grid_form_action_controls
<!-- 单棵树的每个可点击节点都必须对应真实画布页面；人物入口复用窗口时同步默认节点，禁止出现高亮变化但内容不变。 -->
evolution_workspace_navigation_routing_contract = every_parent_group_and_leaf_drives_distinct_canvas_content + parent_node_has_explicit_overview + perspective_change_syncs_default_flow + selected_state_and_visible_page_remain_consistent + real_Electron_click_every_leaf_with_screenshot_and_result_json
<!-- 一键清空只处理应用内部测试业务态，必须由设置危险区二次确认并在主进程受控重启。 -->
ai_desktop_test_data_reset_contract = settings_danger_action_with_SELUI_confirm + explicit_irreversible_scope_and_preserved_scope + typed_renderer_preload_IPC_main_service + stop_all_runtime_writers_before_clear + clear_conversation_dispatch_collaboration_evolution_linghu_and_SQLite_business_tables + preserve_AiDesktopSchemaVersion_login_settings_workspaces_trusted_commands_rules_source_and_audit_files + official_thread_delete_must_succeed_before_irreversible_clear + controlled_restart_after_success + cancellation_and_confirmation_interaction_regression
<!-- 专题演化是独立业务窗口；两个角色入口只能聚焦和切换唯一实例，不得在主窗口继续保留旧右栏。 -->
evolution_workspace_window_contract = main_window_conversation_only + one_independent_BrowserWindow + nangong_and_hanli_share_instance_state_and_tree + entry_switches_perspective_and_focuses + close_then_reopen + main_window_recreated_on_app_activate_even_if_workspace_remains + no_embedded_or_parallel_legacy_workspace
<!-- 单个任务返回不能代表本轮完成；只有应收清单全部返回并携带结果版本，才能封存为唯一原子批次触发统一测试。 -->
evolution_round_batch_test_trigger_contract = expected_distributed_task_id_set_complete + every_task_returned_to_nangong_with_result_sha + partial_return_waits_without_seal_or_test + all_returned_seals_exactly_once + one_atomic_batch_to_linghu_unified_test_package_and_restart
<!-- 应用业务只能调用 EventCenterFacade；JSONL、SQLite 和令狐消费均为门面后的可替换实现。 -->
workflow_event_center_facade_contract = all_application_events_and_exceptions_via_EventCenterFacade + archive_and_SQLite_behind_facade + no_direct_business_sink_coupling
<!-- 主进程早期、IPC、渲染器、后台服务和退出边界必须统一登记，异常按状态受理直至有事实证明恢复。 -->
workflow_exception_lifecycle_contract = process_startup_plus_IPC_plus_renderer_plus_background_plus_shutdown_boundaries + open_to_processing_by_linghu + resolved_only_by_recovery_fact
<!-- 完整对话原文与读取预览分离；用户原话不可截断，AI 长回答在后续上下文中只取前八十个 Unicode 字符。 -->
nangong_conversation_memory_contract = full_user_and_nangong_source_text_in_SQLite + user_exact_context + nangong_80_unicode_preview_context + preview_never_replaces_source
<!-- 每轮由 AI 自由生成主题、类型和用户意图；问题中心改变时关闭旧主题并新建，禁止枚举限制。 -->
nangong_round_semantics_contract = free_form_topic_plus_type_plus_user_intent_each_round + AI_detected_topic_switch_closes_previous + no_fixed_enum
<!-- 南宫婉可见回答先以自然措辞复述理解，数据库只保存简洁意图本身，用户可据此判断并纠正偏差。 -->
nangong_visible_intent_contract = respectful_listening_and_correction_are_nangong_personality + answer_starts_我了解到您的想法是 + invite_direct_correction + reflect_current_concern_not_mechanical_template + never_expand_user_intent + database_intent_without_polite_wrapper + intent_visible_below_source_user_message
<!-- Codex 历史任务页与南宫婉会话分表保存，保证来源真实且控制 AI 内容长度。 -->
codex_conversation_backfill_contract = separate_archive_not_nangong_memory + exact_real_user_messages + visible_codex_commentary_and_final_answer_80_unicode_preview_only + free_topic_type_and_intent_per_user_message + exclude_system_developer_environment_tool_and_hidden_reasoning + stable_thread_message_idempotency
<!-- AI Desktop 页面不得维护可复用控件皮肤；缺失能力必须先进入 SELUI 中央登记、正式出口和统一 Token，再由页面消费。 -->
ai_desktop_selui_ownership_contract = page_uses_SELUI_for_all_reusable_visual_controls + missing_control_register_and_extend_SELUI_first + developer_css_business_layout_only + no_private_tooltip_confirm_prompt_dialog_switch_skin
<!-- 所有人物会话共享一个 SELUI 对话控件；人物差异只通过插槽注入，不得复制回车、附件、消息卡或输入区实现。 -->
ai_desktop_shared_conversation_component_contract = selConversation_registered_before_implementation + hanli_and_nangong_same_formal_exports + standard_Enter_submit + Shift_Enter_newline + compositionstart_to_compositionend_isComposing_or_keyCode229_never_submit + optional_person_actions_slot + nangong_no_hanli_managed_stage_choice + submit_moves_text_and_images_to_outgoing_message_immediately + composer_clears_before_response + failure_visible_on_outgoing_message + no_private_chat_visual_css
<!-- 演化课题、提案、审批与修订表单的字段、按钮和状态视觉统一由 selForm 承担。 -->
ai_desktop_evolution_form_component_contract = organize_topic_and_generate_draft_are_distinct_actions + topic_proposal_approval_revision_use_selForm + application_owns_values_validation_and_business_callbacks_only + no_private_form_field_or_button_skin

<!-- 所有人物和模块必须经既有审计入口进入统一事件中心，禁止再增加旁路日志入口。 -->
workflow_event_center_single_entry_contract = EventCenterFacade_to_archive_and_main_process_SQLite
<!-- 技术异常、业务异常和卡住必须分类保存，令狐只监听统一入口和既有协同状态。 -->
workflow_event_center_exception_contract = technical_error_business_exception_stalled_separate_and_queryable
<!-- 卡住检测独立于执行人物，并以任务心跳事实去重后交给令狐现有恢复 Facade。 -->
workflow_event_center_stall_contract = independent_30_second_supervisor_plus_120_second_timeout_plus_fault_fact_dedup_plus_linghu_handoff
<!-- 应用运行会话正常关闭前必须落停止状态；残留 running 会话在下一次启动登记 interrupted 恢复事件。 -->
workflow_runtime_session_recovery_contract = startup_marks_previous_running_interrupted_and_shutdown_stops_before_sqlite_checkpoint
<!-- 南宫婉完成验收后仅在自动演化开启时建立唯一下一轮，重启和重复检测不得重复创建。 -->
nangong_next_evolution_launcher_contract = completed_and_accepted_plus_automatic_evolution_enabled_plus_reciprocal_topic_ids_plus_idempotent_restart
