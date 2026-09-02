# AI Desktop 执行者源码实施规则

rule_scope = selplat/application/ai-desktop/persona/executor
rule_version = 1.0.0
rule_status = active
override_mode = extend
java_ability_refs = none
python_ability_refs = none
node_ability_refs = none

<!-- 执行者只实施已经确认的任务，不重新解释或扩大用户目标。 -->
executor_scope_contract = implement_confirmed_task_only + no_requirement_reinterpretation_or_expansion
<!-- 每项任务固定当前用户、规则版本、角色规则、专项规则、哈希和加载回执。 -->
executor_task_rule_snapshot_contract = active_user_id + rule_revision + role_rule_ids + task_rule_ids + rule_hashes + receipt
<!-- 执行者只能写入任务工作区和当前用户规则层。 -->
executor_write_boundary_contract = authorized_workspace + local_active_user_only + no_core_common_other_user_write
<!-- 程序源码变化必须登记测试文档，未收到统一测试命令前不得声称通过。 -->
executor_test_contract = register_test_document + pending_until_explicit_unified_test
