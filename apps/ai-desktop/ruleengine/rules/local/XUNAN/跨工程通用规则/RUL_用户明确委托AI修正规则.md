# 用户明确委托 AI 修正规则

<!-- Java 当前不承担委托授权判定，显式写 none 防止猜测程序入口。 -->
java_ability_refs = none
<!-- Python 当前不承担委托授权判定，执行确认由 USER 协议和任务上下文共同提供。 -->
python_ability_refs = none
<!-- Node 当前不承担委托授权判定，显式写 none 防止猜测程序入口。 -->
node_ability_refs = none
<!-- 规则从 1.0.0 起步，委托范围或确认条件变化时必须升级版本。 -->
rule_version = 1.2.0
<!-- 规则所有者始终来自工程根 AGENTS.md 的当前稳定用户声明。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示该覆盖已由根索引登记并用于当前 SELPLAT 工程。 -->
rule_status = active

<!-- 问题：默认冻结规则会阻止用户已经明确提出并希望交由 AI 完成的 core 或 common 修改。 -->
<!-- 场景：当前稳定用户明确点名修改 local/core 或 local/common 的具体目标，并随后以独立 1 启动执行。 -->
<!-- 业务含义：冻结仍是默认状态，但项目所有者可以为一次边界清晰的任务打开受控 AI 托管窗口。 -->

<!-- 用户明确点名修改目标并以独立 1 启动后，本次指定范围允许由 AI 直接修改。 -->
rule_engine_core_after_freeze_write_policy = explicit_user_delegation_with_standalone_1_only
<!-- common 在同样取得明确点名和独立 1 后允许由 AI 托管，未授权时继续保持人工合并边界。 -->
rule_engine_common_write_policy = explicit_user_delegation_with_standalone_1_otherwise_manual_reviewed_merge_only
<!-- 用户明确委托时，修正目标以用户点名路径为准；没有委托时仍只允许写当前用户层。 -->
rule_engine_automatic_correction_target = explicitly_delegated_scope_otherwise_active_user_only
<!-- 明确委托的 core 修改不再被视为越权，但不得推定其他目录也已获授权。 -->
rule_engine_user_merge_to_core_is_forbidden = false_only_within_explicitly_delegated_scope

<!-- 托管窗口必须同时具备明确任务、独立 1、当前用户可验证和范围可解析四项条件；业务含义是初始目标与后续同任务补充共同组成已授权范围。 -->
explicit_ai_managed_change_required_evidence = explicitly_stated_task
<!-- explicit_ai_managed_change_required_evidence.2 的当前独立事实为 standalone_1。 -->
explicit_ai_managed_change_required_evidence.2 = standalone_1
<!-- explicit_ai_managed_change_required_evidence.3 的当前独立事实为 verified_active_user。 -->
explicit_ai_managed_change_required_evidence.3 = verified_active_user
<!-- explicit_ai_managed_change_required_evidence.4 的当前独立事实为 resolved_scope。 -->
explicit_ai_managed_change_required_evidence.4 = resolved_scope
<!-- 独立 1 后追加的文件、材料、参数或同目标要求延续当前托管窗口；业务含义是用户补充制作依据时 AI 可以继续执行而不重复索要确认。 -->
explicit_ai_managed_same_task_followup_policy = authorized_supplement_without_reconfirmation
<!-- 已授权补充仅包含文件、材料、参数和同目标要求；业务含义是执行方可以识别正常补充而不把新任务误归入现有窗口。 -->
explicit_ai_managed_authorized_supplement_types = file
<!-- explicit_ai_managed_authorized_supplement_types.2 的当前独立事实为 material。 -->
explicit_ai_managed_authorized_supplement_types.2 = material
<!-- explicit_ai_managed_authorized_supplement_types.3 的当前独立事实为 parameter。 -->
explicit_ai_managed_authorized_supplement_types.3 = parameter
<!-- explicit_ai_managed_authorized_supplement_types.4 的当前独立事实为 same_goal_requirement。 -->
explicit_ai_managed_authorized_supplement_types.4 = same_goal_requirement
<!-- 新任务或实质扩张必须重新确认；业务含义是补充授权不能越过原任务的工程、系统、层级和破坏性边界。 -->
explicit_ai_managed_followup_requires_new_confirmation = overall_goal_changes
<!-- explicit_ai_managed_followup_requires_new_confirmation.2 的当前独立事实为 new_project_or_system。 -->
explicit_ai_managed_followup_requires_new_confirmation.2 = new_project_or_system
<!-- explicit_ai_managed_followup_requires_new_confirmation.3 的当前独立事实为 new_core_or_common_layer。 -->
explicit_ai_managed_followup_requires_new_confirmation.3 = new_core_or_common_layer
<!-- explicit_ai_managed_followup_requires_new_confirmation.4 的当前独立事实为 destructive_scope_expands。 -->
explicit_ai_managed_followup_requires_new_confirmation.4 = destructive_scope_expands
<!-- explicit_ai_managed_followup_requires_new_confirmation.5 的当前独立事实为 independent_new_task。 -->
explicit_ai_managed_followup_requires_new_confirmation.5 = independent_new_task
<!-- AI 修改前必须核对索引、调用方、注册表、测试和替代关系。 -->
explicit_ai_managed_change_preflight = indexes
<!-- explicit_ai_managed_change_preflight.2 的当前独立事实为 callers。 -->
explicit_ai_managed_change_preflight.2 = callers
<!-- explicit_ai_managed_change_preflight.3 的当前独立事实为 registries。 -->
explicit_ai_managed_change_preflight.3 = registries
<!-- explicit_ai_managed_change_preflight.4 的当前独立事实为 tests。 -->
explicit_ai_managed_change_preflight.4 = tests
<!-- explicit_ai_managed_change_preflight.5 的当前独立事实为 replacement_relationships。 -->
explicit_ai_managed_change_preflight.5 = replacement_relationships
<!-- 合并或删除必须记录保留方、清理引用并运行相关回归。 -->
explicit_ai_managed_merge_or_delete_requires = retained_winner
<!-- explicit_ai_managed_merge_or_delete_requires.2 的当前独立事实为 reference_cleanup。 -->
explicit_ai_managed_merge_or_delete_requires.2 = reference_cleanup
<!-- explicit_ai_managed_merge_or_delete_requires.3 的当前独立事实为 index_cleanup。 -->
explicit_ai_managed_merge_or_delete_requires.3 = index_cleanup
<!-- explicit_ai_managed_merge_or_delete_requires.4 的当前独立事实为 relevant_regression。 -->
explicit_ai_managed_merge_or_delete_requires.4 = relevant_regression
<!-- AI 不得把一次明确修改扩展为无关清理、新功能或其他目录重构。 -->
explicit_ai_managed_change_forbidden = scope_expansion
<!-- explicit_ai_managed_change_forbidden.2 的当前独立事实为 unrelated_cleanup。 -->
explicit_ai_managed_change_forbidden.2 = unrelated_cleanup
<!-- explicit_ai_managed_change_forbidden.3 的当前独立事实为 unrequested_feature。 -->
explicit_ai_managed_change_forbidden.3 = unrequested_feature
<!-- explicit_ai_managed_change_forbidden.4 的当前独立事实为 unrelated_refactor。 -->
explicit_ai_managed_change_forbidden.4 = unrelated_refactor
<!-- 完成验证和交付后，本次托管窗口自动关闭，后续修改必须重新取得独立 1。 -->
explicit_ai_managed_change_window_closes_after = verification_and_delivery

<!-- 本规则只判定一次任务的授权边界，不生成重复结构化成品，因此不需要输出模板。 -->
template_not_applicable_reason = authorization_boundary_has_no_repeatable_output_artifact
<!-- 授权条件已经由真实分层加载测试覆盖，另造示例会复制规则正文而形成第二权威来源。 -->
example_not_applicable_reason = verified_loading_test_is_authoritative_evidence
<!-- 独立 1 来自会话协议和用户输入，程序不得代替用户生成或推断授权。 -->
program_not_applicable_reason = explicit_user_confirmation_must_not_be_generated_by_program
<!-- 验证由当前用户覆盖加载测试、逐行注释测试和相关任务回归共同完成。 -->
verification_contract = active_user_layered_override_test
<!-- verification_contract.2 的当前独立事实为 line_comment_test。 -->
verification_contract.2 = line_comment_test
<!-- verification_contract.3 的当前独立事实为 relevant_task_regression。 -->
verification_contract.3 = relevant_task_regression
