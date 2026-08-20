# 会话最新问答记录与执行规则

<!-- 会话记录与授权回执由 rule-engine 新 Python 能力统一执行。 -->
python_ability_refs = apps/rule-engine/backend/src/main/python/com/sp/selplat/ruleengine/abilities/会话记录执行器.py
<!-- 本规则不需要 Java 能力。 -->
java_ability_refs = none
<!-- 本规则不需要 Node 能力。 -->
node_ability_refs = none
<!-- 当前版本首次固化独立 3 的先记录后执行语义。 -->
rule_version = 1.0.0
<!-- 规则所有者由 AGENTS.md 当前稳定用户动态解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示协议、能力、注册入口和测试已经形成实现闭环。 -->
rule_status = active
<!-- 本次升级来源于用户确认：一个会话一个文档，每次只记录最新问答并随后执行。 -->
upgrade_record = 2026-08-20:独立3记录最新完整问答_一会话一文档_成功记录后执行该轮明确任务
<!-- 本规则依赖通用 Python 和测试约束。 -->
requires_rule_ids = CODE_PYTHON_RULES
<!-- 测试规则作为第二项显式依赖参与闭包。 -->
requires_rule_ids.2 = CODE_TEST_RULES

<!-- 问题：只总结会话或回填整个历史会丢失最新纠正关系，也无法证明执行前记录已经落盘。 -->
<!-- 场景：用户在一轮完整可见问答后独立发送 3。 -->
<!-- 业务含义：AI 先留下最新原始问答，再只执行该轮已经明确的目标。 -->

<!-- 只有内容严格等于 3 的独立用户消息可以触发本规则。 -->
session_record_trigger = standalone_3
<!-- 独立 3 自身不是被记录的问题。 -->
session_record_trigger_excludes_command_message = true
<!-- 每次只选择独立 3 之前紧邻的一轮完整可见用户问题和助手回答。 -->
session_record_scope = immediately_previous_completed_visible_qa_pair
<!-- 禁止扫描、补录或合并更早的会话内容。 -->
session_record_forbid_whole_conversation_backfill = true

<!-- 会话文档动态进入 AGENTS.md 当前稳定用户层。 -->
session_record_root = local/<active-stable-user-id>/会话
<!-- 一个线程只使用一个固定文件。 -->
session_record_file = 会话_<CURRENT_THREAD_ID>.md
<!-- 禁止扫描其他用户目录或其他线程选择记录文件。 -->
session_record_thread_isolation = current_stable_user_and_current_thread_only

<!-- 每轮第一行由四位顺序号、Q、角色和压平后的问题原文组成。 -->
session_record_question_line = <NNNN>Q｜<角色>｜<问题原文>
<!-- 每轮第二行使用同一顺序号、A、同一角色和压平后的回答原文。 -->
session_record_answer_line = <NNNN>A｜<角色>｜<回答原文>
<!-- 每轮必须严格只有一条问题行和一条回答行。 -->
session_record_pair_line_count = 2
<!-- 问题与回答必须使用同一个工程角色。 -->
session_record_pair_role_policy = answer_inherits_question_role
<!-- 只把换行、制表和其他控制换行压成空格。 -->
session_record_original_text_normalization = flatten_control_line_breaks_to_space_only
<!-- 原始可见正文禁止按三百字或其他长度截断。 -->
session_record_original_text_truncation = forbidden
<!-- 隐藏系统、开发者消息、内部推理和工具原始输入输出不属于可见问答。 -->
session_record_hidden_content_policy = exclude_non_visible_system_reasoning_and_raw_tool_io

<!-- 工程角色第一类为需求。 -->
session_record_role = 需求
<!-- 工程角色第二类为架构。 -->
session_record_role.2 = 架构
<!-- 工程角色第三类为详细设计。 -->
session_record_role.3 = 详细设计
<!-- 工程角色第四类为代码。 -->
session_record_role.4 = 代码
<!-- 工程角色第五类为测试。 -->
session_record_role.5 = 测试
<!-- 工程角色第六类为验收交付。 -->
session_record_role.6 = 验收交付
<!-- 工程角色第七类为运行运维。 -->
session_record_role.7 = 运行运维
<!-- 工程角色第八类为规则治理。 -->
session_record_role.8 = 规则治理
<!-- 不允许额外记录状态字段。 -->
session_record_status_field = forbidden
<!-- 不允许额外记录行为类型字段。 -->
session_record_action_type_field = forbidden

<!-- 会话写入必须使用线程锁和同目录临时文件原子替换。 -->
session_record_write_policy = thread_lock_and_atomic_replace
<!-- 已经位于文档末尾的同一轮问答禁止再次追加。 -->
session_record_duplicate_policy = no_duplicate_append
<!-- 重复问答也不得再次打开执行窗口。 -->
session_record_duplicate_execution_policy = no_repeat_execution
<!-- 文档出现单行残缺、顺序错误或未知角色时必须阻断追加。 -->
session_record_malformed_document_policy = block_without_repair_guess

<!-- 成功写入最新问答后才生成该轮执行授权回执。 -->
session_record_execution_order = persist_pair_then_issue_receipt_then_execute
<!-- 记录成功后的明确任务固定在当前 Luna Max 主线程中执行，保持当前会话上下文连续。 -->
session_record_execution_thread = current_luna_max_main_thread
<!-- 禁止为独立 3 的后续执行派生 Agent 子线程或委派给子 Agent。 -->
session_record_agent_subthread_policy = forbidden
<!-- 执行授权只覆盖已记录问答中明确的可执行目标。 -->
session_record_execution_scope = latest_recorded_pair_explicit_action_only
<!-- 需要修改程序时必须在记录完成后进入正常源码修改和测试门禁。 -->
session_record_program_change_policy = modify_after_record_then_follow_code_and_test_gates
<!-- 没有可执行目标时只记录并返回无可执行变更。 -->
session_record_no_action_policy = record_only_and_report_no_executable_change
<!-- 记录失败时禁止执行任何后续修改。 -->
session_record_failure_policy = block_execution_and_report
<!-- 用户问题和后续明确纠正高于助手旧回答中的冲突方案。 -->
session_record_conflict_priority = user_question_and_later_explicit_correction
<!-- 独立 3 不得扩大未在问答中明确出现的 core、common、删除或跨工程范围。 -->
session_record_protected_scope_policy = explicit_recorded_target_only
