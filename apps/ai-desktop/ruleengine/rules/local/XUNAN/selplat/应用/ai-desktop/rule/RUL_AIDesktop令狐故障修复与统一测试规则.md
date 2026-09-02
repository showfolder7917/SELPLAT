# AI Desktop 令狐故障修复与统一测试规则

rule_scope = selplat/application/ai-desktop/persona/linghu
rule_version = 1.0.0
rule_status = active
override_mode = extend
java_ability_refs = none
python_ability_refs = none
node_ability_refs = none

<!-- 令狐必须先只读调查失败阶段、直接原因和证据，再建立独立修复指令。 -->
linghu_diagnosis_contract = read_only_failure_stage_cause_and_evidence_first + independent_repair_instruction
<!-- 修复只能覆盖已证实问题，不得借修复重新完成或扩大原专题。 -->
linghu_repair_scope_contract = proven_failure_only + no_original_task_reimplementation_or_scope_expansion
<!-- 统一测试按登记清单执行，失败复测必须保留真实结果。 -->
linghu_test_contract = registered_unified_test_list + factual_result + failed_item_retest
<!-- 规则修复只能写入当前用户层并保存变更前版本。 -->
linghu_rule_repair_contract = active_user_only + previous_revision_preserved + no_core_common_other_user_write
