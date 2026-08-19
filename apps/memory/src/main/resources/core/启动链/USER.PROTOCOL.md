# User Protocol

## 说明

- 本协议来源于 `apps/rule-engine/backend/src/main/resources/local/core/protocol/USER.PROTOCOL.md` 的用户协作约束。
- 本文件只服务于 memory 需求分析师启动链；后续入口改为本地核心规则索引，不进入代码生成协议。

## 强制协议（Mandatory）

<!-- USER 协议完成后必须通过统一文件读取器加载本地核心规则索引。 -->
after_user_must_load_next_via = com.sp.selplat.core.文件读取器.FileReader
<!-- 需求分析启动链的下一入口固定为本地核心规则总索引。 -->
after_user_next_resource = ../规则/IDX_核心规则总索引.md
<!-- 启动链和规则索引读取不属于具体任务执行。 -->
startup_chain_and_rule_index_loading_are_not_task_execution = true
<!-- 修正协议或规则时必须同步所属索引。 -->
protocol_or_rule_correction_must_sync_owning_index = true
<!-- 每次执行前必须先向用户说明当前对任务的理解。 -->
before_execution_must_state_task_understanding_to_user = true
<!-- 用户输入独立 1 表示按已经说明的理解立即执行。 -->
standalone_reply_1_means_execute_based_on_stated_understanding = true
<!-- 独立 1 打开的执行窗口持续到当前任务完成验证与交付。 -->
standalone_1_execution_window_remains_open_until = verification_and_delivery
<!-- 同一目标下补充的文件、材料、参数和要求直接纳入已授权任务。 -->
followup_after_standalone_1_within_same_task_is_authorized_supplement = true
<!-- 目标变化、新工程、新 core/common 范围、扩大删除或独立新任务必须重新确认。 -->
followup_requires_new_confirmation_when = overall_goal_changes,new_project_or_system,new_core_or_common_layer,destructive_scope_expands,independent_new_task
<!-- 用户输入独立 2 表示只加入会话执行池，不立即执行。 -->
standalone_reply_2_means_append_current_item_to_execution_pool = true
<!-- 会话执行池不构成执行或长期记忆。 -->
execution_pool_session_state_only = true
<!-- 默认禁止读取 human 记忆。 -->
memory_root.human = deny
<!-- 回答优先提供结论、可执行结果和必要的完整路径或配置。 -->
prefer_direct_conclusion_actionable_result_and_complete_operational_details = true
<!-- 回答同时提供可操作的修正建议和优化方向。 -->
ai_response_must_include_actionable_corrections_and_optimizations = true

## 禁止事项（Forbidden）

<!-- 禁止在规则层重复声明本协议的通用协作约束。 -->
forbid_redeclare_user_protocol_level_constraints = true

