# 系统实现评估源码证据规则

<!-- 当前规则所有者始终从工程 AGENTS.md 的稳定用户身份解析，禁止把物理用户目录写成运行分支。 -->
rule_owner_source = AGENTS.md.current_stable_user_id

<!-- 评估系统、平台、应用、自动化流程或 AI 能力是否已经实现时加载本规则。 -->
system_implementation_assessment_applicability = system_platform_application_automation_or_ai_capability_assessment

<!-- 系统现状必须以当前源码、真实入口、调用链、持久化、界面接口和运行接线为主要证据。 -->
system_implementation_assessment_primary_evidence = current_source_plus_real_entry_call_chain_persistence_interface_and_runtime_wiring

<!-- 需求、设计、规则和说明文档只证明预期行为，不能单独证明对应能力已经实现或可运行。 -->
system_implementation_assessment_document_evidence_boundary = intended_behavior_only_never_implementation_or_runtime_proof_alone

<!-- 评估前必须从公开入口追踪到关键实现与下游效果，禁止仅凭文件名、类名、注释、测试名称或页面文案下结论。 -->
system_implementation_assessment_trace_gate = public_entry_to_core_implementation_to_downstream_effect

<!-- 评估报告必须分别标识设计存在、源码实现、真实接线、构建状态、测试状态和运行证据。 -->
system_implementation_assessment_status_dimensions = design_source_wiring_build_test_and_runtime_evidence_separated

<!-- 测试源码、模拟对象和历史构建产物不能表述成当前版本已经测试通过。 -->
system_implementation_assessment_test_claim_gate = current_command_and_result_required_for_current_version_pass_claim

<!-- 自动化循环只有在真实反馈、候选改进、可执行评价、基线比较和安全晋升闭环成立时才能称为自动演化。 -->
automatic_evolution_assessment_minimum_loop = real_feedback_plus_candidate_improvement_plus_executable_evaluation_plus_baseline_comparison_plus_safe_promotion

<!-- 评估发现文档与源码不一致或证据缺失时必须以可定位源码事实报告差异，并把未验证项明确保留为未验证。 -->
system_implementation_assessment_conflict_policy = report_locatable_source_difference_and_keep_missing_evidence_unverified

<!-- 本规则只约束评估证据方法，没有稳定重复的执行程序，因此不创建虚假能力入口。 -->
java_ability_refs = none

<!-- 本规则没有 Python 自动执行能力。 -->
python_ability_refs = none

<!-- 本规则没有 Node 自动执行能力。 -->
node_ability_refs = none
