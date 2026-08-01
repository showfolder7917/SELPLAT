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

<!-- 用户输入 2 表示将当前事项写入执行池而不立即执行 -->
standalone_reply_2_means_append_current_item_to_execution_pool = true

<!-- 用户单独回复 2 只把最近一次明确陈述的任务加入执行池 -->
standalone_reply_2_only_appends_latest_stated_task_to_execution_pool = true

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
