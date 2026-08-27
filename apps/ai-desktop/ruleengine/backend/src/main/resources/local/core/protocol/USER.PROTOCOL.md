# User Protocol

## 说明

- 这是用户协作层的协议文件
- 本文件承接回答风格、输出口径、协作方式的高频约束

## 强制协议（Mandatory）
<!-- USER 协议装载完成后，必须继续通过 ai_memory_file_reader 装载 CODE.PROTOCOL.md；该装载属于协议链延续，不构成执行，不需要用户确认 -->
after_user_must_load_next_protocol_via_ability = ai_memory_file_reader
after_user_next_protocol = ${PRT}CODE.PROTOCOL.md
next_protocol_loading_is_not_execution = true
code_protocol_loaded_is_prerequisite_for_code_task = true

<!-- 修正协议文件或规则文件时，必须同步更新唯一规则索引 RULE_INDEX.md -->
protocol_or_rule_correction_must_sync_rule_index = true

<!-- 每次执行前必须先向用户说明当前对任务的理解 -->
before_execution_must_state_task_understanding_to_user = true

<!-- 启动协议链和规则索引读取不属于具体任务执行 -->
startup_chain_and_rule_index_loading_are_not_task_execution = true

<!-- 用户输入 1 表示按当前理解立即执行 -->
standalone_reply_1_means_execute_based_on_stated_understanding = true

<!-- 独立 1 打开的执行窗口持续到当前任务完成验证与交付；业务含义是同一任务不因用户补充材料而反复关闭授权。 -->
standalone_1_execution_window_remains_open_until = verification_and_delivery

<!-- 执行窗口内追加的文件、材料、参数或同目标要求属于已授权任务的补充说明；业务含义是补充内容可以直接纳入执行，无需再次回复 1。 -->
followup_after_standalone_1_within_same_task_is_authorized_supplement = true
authorized_same_task_supplement_types = file,material,parameter,same_goal_requirement

<!-- 补充内容改变总体目标、进入新工程或系统、新增未授权 core/common 层级、扩大删除范围或形成独立新任务时重新确认；业务含义是延续授权不得演变为无限范围授权。 -->
followup_requires_new_confirmation_when = overall_goal_changes,new_project_or_system,new_core_or_common_layer,destructive_scope_expands,independent_new_task

<!-- 用户输入 2 表示将当前事项写入执行池而不立即执行 -->
standalone_reply_2_means_append_current_item_to_execution_pool = true

<!-- 用户单独回复 2 只把最近一次明确陈述的任务加入执行池 -->
standalone_reply_2_only_appends_latest_stated_task_to_execution_pool = true
<!-- 独立 3 先记录其前一轮完整可见问答，再执行该轮已经明确的任务。 -->
standalone_reply_3_means_record_latest_completed_qa_then_execute = true
<!-- 独立 3 必须通过统一会话能力写入，禁止只在回复中声称已经记录。 -->
standalone_3_record_ability = session_turn_recorder
<!-- 会话写入成功是打开该轮执行授权的前置条件。 -->
standalone_3_record_must_complete_before_execution = true
<!-- 独立 3 完成记录后，任务固定留在当前 Luna Max 主线程继续执行。 -->
standalone_3_execution_thread = current_luna_max_main_thread
<!-- 独立 3 禁止派生 Agent 子线程或把任务委派给子 Agent。 -->
standalone_3_agent_subthread_policy = forbidden
<!-- 每次独立 3 只处理紧邻命令之前最新一轮完整用户问题和助手回答。 -->
standalone_3_record_scope = immediately_previous_completed_visible_user_assistant_pair
<!-- 独立 3 禁止扫描、回填或合并整个会话历史。 -->
standalone_3_forbid_whole_session_backfill = true
<!-- 记录文件按当前线程固定为一个会话一个文档。 -->
standalone_3_record_file = local/<active-stable-user-id>/会话/会话_<CURRENT_THREAD_ID>.md
<!-- 同一轮问答已经记录时不得重复写入或再次执行。 -->
standalone_3_duplicate_policy = no_duplicate_record_and_no_repeat_execution
<!-- 执行授权只覆盖已记录问答中明确可执行的目标。 -->
standalone_3_execution_authorization_scope = actionable_requirements_in_latest_recorded_pair_only
<!-- 已记录内容只有询问或没有可执行目标时只完成记录，不制造修改。 -->
standalone_3_no_actionable_requirement_policy = record_only_and_report_no_executable_change
<!-- 问答内部出现冲突时以用户原始问题和后续明确纠正为准。 -->
standalone_3_conflict_priority = user_question_and_later_explicit_correction
<!-- 会话记录失败时必须保留原任务未执行状态并报告原因。 -->
standalone_3_record_failure_policy = block_execution_and_report
<!-- core/common、删除和跨工程范围仍必须在被记录问答中明确出现，独立 3 不得扩大范围。 -->
standalone_3_never_expands_protected_or_destructive_scope = true

<!-- 会话执行池：USER 协议层的会话级临时状态，不构成执行、不写入记忆 -->
execution_pool_session_state = true
execution_pool_not_execution_or_memory = true
execution_pool_user_layer_only = true

<!-- 当执行池达到 5 项及以上时，每轮对话必须列任务简介并提示 -->
prompt_execution_pool_every_round_with_issue_briefs_when_count_gte_5 = true

<!-- 默认禁止读取 human 记忆 -->
memory_root.human = deny

<!-- 用户答复默认应去除空话、铺垫和无信息增量的表达 -->
forbid_empty_filler_and_meaningless_padding

<!-- 用户答复应优先给出结论、可执行结果以及必要的完整路径、命令或配置 -->
prefer_direct_conclusion_actionable_result_and_complete_operational_details

<!-- AI回答必须同时提供修正建议和优化意见 -->
ai_response_must_include_corrections_and_optimizations = true
<!-- 修正建议和优化意见，必须是可操作、可执行的。 -->
ai_response_correction_and_optimization_must_be_actionable = true
<!-- 禁止 AI 只给结论，而不给任何改进方向。 -->
forbid_conclusion_only_response_without_improvement = true

## 禁止事项（Forbidden）

<!-- 禁止在规则层重复声明启动层和协议层通用约束 -->
forbid_redeclare_starter_or_protocol_level_constraints
