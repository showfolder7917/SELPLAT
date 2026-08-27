# SELPLAT 规则适配审查与阻断规则

<!-- 问题：用户指定的实现位置或调用方式可能与已生效规则冲突，若执行方擅自调整方案后继续实现，会绕过用户审核并破坏规则治理。 -->
<!-- 场景：SELPLAT 任意新增、删除、修改、重构或生成任务进入用户确认前的规则适配检查。 -->
<!-- 业务含义：规则不适配时先透明报告并等待用户决策，禁止先执行、静默换方案或事后补规则。 -->

<!-- 变更任务在给出 1/2 前必须比较用户原始方案与已加载规则；适用于实现位置、继承关系、公开接口、调用层级、数据目录和测试方式。 -->
selplat_change_task_must_check_rule_compatibility_before_confirmation = true

<!-- 用户原始方案违反任一已加载规则时必须立即阻断正式执行；业务含义是规则冲突不会被“先做再说”绕过。 -->
selplat_rule_incompatible_task_action = stop_before_execution

<!-- 阻断报告必须列出规则文件、具体约束、冲突方案和不能执行的原因；业务含义是用户可以基于完整事实重新决策。 -->
selplat_rule_block_report_fields = rule_file
<!-- selplat_rule_block_report_fields.2 的当前独立事实为 constraint。 -->
selplat_rule_block_report_fields.2 = constraint
<!-- selplat_rule_block_report_fields.3 的当前独立事实为 conflicting_request。 -->
selplat_rule_block_report_fields.3 = conflicting_request
<!-- selplat_rule_block_report_fields.4 的当前独立事实为 reason。 -->
selplat_rule_block_report_fields.4 = reason

<!-- 执行方可以提供合规方向，但不得擅自替用户选择、修改任务或把合规方向视为已授权方案。 -->
selplat_rule_block_compliant_alternative_requires_user_confirmation = true

<!-- 只有用户明确要求修改冲突规则并完成规则治理后，原任务才能重新进行规则适配检查和 1/2 确认。 -->
selplat_rule_change_before_blocked_task_retry = explicit_user_request
<!-- selplat_rule_change_before_blocked_task_retry.2 的当前独立事实为 rule_governance_complete。 -->
selplat_rule_change_before_blocked_task_retry.2 = rule_governance_complete
<!-- selplat_rule_change_before_blocked_task_retry.3 的当前独立事实为 recheck。 -->
selplat_rule_change_before_blocked_task_retry.3 = recheck
<!-- selplat_rule_change_before_blocked_task_retry.4 的当前独立事实为 reconfirm。 -->
selplat_rule_change_before_blocked_task_retry.4 = reconfirm

<!-- 禁止先执行后补规则、静默改成其他实现以及用代码事实反向覆盖已生效规则。 -->
selplat_rule_incompatible_forbidden_actions = execute_then_document
<!-- selplat_rule_incompatible_forbidden_actions.2 的当前独立事实为 silent_redesign。 -->
selplat_rule_incompatible_forbidden_actions.2 = silent_redesign
<!-- selplat_rule_incompatible_forbidden_actions.3 的当前独立事实为 code_overrides_rule。 -->
selplat_rule_incompatible_forbidden_actions.3 = code_overrides_rule
