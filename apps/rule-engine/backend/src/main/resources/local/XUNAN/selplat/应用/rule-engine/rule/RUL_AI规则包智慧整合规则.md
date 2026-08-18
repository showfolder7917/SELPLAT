# AI 规则包智慧整合规则

<!-- Java 当前没有承载本规则的自动化程序，显式写 none 防止调用方猜测 Java 入口。 -->
java_ability_refs = none
<!-- Python 统一通过已登记的智慧整合能力生成可复核事实。 -->
python_ability_refs = ai_rule_package_integrator
<!-- Node 当前没有承载本规则的自动化程序，显式写 none 防止误调用生成器。 -->
node_ability_refs = none
<!-- 规则版本从 1.0.0 起步，后续语义变化必须递增并记录升级原因。 -->
rule_version = 1.2.0
<!-- 规则所有者始终来自工程根 AGENTS.md 的当前稳定用户声明，公共合并前不得扩大作用域。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已由根索引登记并通过当前回归验证。 -->
rule_status = active
<!-- 升级记录同时保存首次整合和用户发现的逐行注释缺口，防止修正规范被口头带过。 -->
upgrade_record = 2026-08-03:清理废弃传统链并建立AI规则包持续整合入口;2026-08-03:补齐新增规则逐行中文业务注释并增加自动检查;2026-08-03:增加用户明确委托后的AI托管修正边界;2026-08-07:程序_规则路径和所有者统一改为AGENTS动态当前用户

<!-- 问题：历史规则、模板、案例和程序分别增长，迁移后仍存在旧路径、缺失关联和只修成品不升级规则包的问题。 -->
<!-- 场景：当前稳定用户在 SELPLAT 中新增、审查、执行、修正、合并或退役规则。 -->
<!-- 业务含义：AI 以规则包为唯一成长单元，在不污染 core/common 的前提下持续减少执行偏差。 -->

<!-- 当前唯一模型是 AI 按规则执行并持续补全规则包，不再建设传统规则服务流水线。 -->
rule_engine_current_model = ai_rule_driven_execution_and_continuous_rule_package_growth
<!-- 该标识只用于识别和清理历史方向，禁止将其重新作为目标架构。 -->
deprecated_rule_engine_model = parser_validator_adjudicator_executor_explainer_auditor_pipeline
<!-- 任何文档、规则或程序都不得重新引入已经废弃的传统模型。 -->
deprecated_model_must_not_be_reintroduced = true

## 规则包组成

<!-- 每条规则必须说明六类组成；不适用项也必须给出原因，不能以缺文件代替判断。 -->
rule_package_required_components = rule
<!-- rule_package_required_components.2 的当前独立事实为 template_or_not_applicable。 -->
rule_package_required_components.2 = template_or_not_applicable
<!-- rule_package_required_components.3 的当前独立事实为 example_or_not_applicable。 -->
rule_package_required_components.3 = example_or_not_applicable
<!-- rule_package_required_components.4 的当前独立事实为 program_or_not_applicable。 -->
rule_package_required_components.4 = program_or_not_applicable
<!-- rule_package_required_components.5 的当前独立事实为 verification。 -->
rule_package_required_components.5 = verification
<!-- rule_package_required_components.6 的当前独立事实为 upgrade_record。 -->
rule_package_required_components.6 = upgrade_record
<!-- 规则正文是唯一权威指令入口，README、案例和模板不得复制或改写约束。 -->
rule_is_the_only_authoritative_instruction_entry = true
<!-- 输出结构会重复出现时必须由模板固定，避免每次任务临时设计。 -->
template_must_fix_repeatable_output_structure_when_applicable = true
<!-- 案例必须展示经过验证的正确结果，使 AI 能比较语义和质量而不是只看格式。 -->
example_must_show_a_verified_correct_result_when_applicable = true
<!-- 稳定、重复且可验证的动作必须由程序承载，避免长期依赖任务内临时代码。 -->
program_must_implement_stable_repeatable_verifiable_actions_when_applicable = true
<!-- 验证必须同时检查规则、模板、案例和程序契约，不能只检查文件存在。 -->
verification_must_detect_deviation_from_rule_template_example_and_program_contract = true
<!-- 每次升级必须记录原问题、具体变化和回归结果，形成持续成长证据。 -->
upgrade_record_must_explain_problem_change_and_regression_result = true
<!-- 任一组成被判定不适用时必须解释业务原因，禁止用 none 掩盖能力缺口。 -->
not_applicable_must_include_reason = true

## AI 智慧职责

<!-- 新增或编辑任何规则前必须重新命中规则文件编辑和生命周期治理规则，禁止沿用任务早期的不完整规则集合。 -->
rule_edit_preflight_required_rules = MEMORY_FILE_EDIT_RULES
<!-- rule_edit_preflight_required_rules.2 的当前独立事实为 RULE_LIFECYCLE_GOVERNANCE_RULES。 -->
rule_edit_preflight_required_rules.2 = RULE_LIFECYCLE_GOVERNANCE_RULES
<!-- AI 必须区分主题相似、约束复用和真正重复，避免把共同写法误判为废弃规则。 -->
ai_must_distinguish_similarity_from_true_duplication = true
<!-- 文件名、关键词和相似度只能产生候选，不能直接触发删除。 -->
ai_must_not_delete_by_filename_keyword_or_similarity_score_only = true
<!-- 合并判断必须同时比较语义、作用域、调用方、资产、程序、测试和替代关系。 -->
ai_merge_decision_evidence = semantics
<!-- ai_merge_decision_evidence.2 的当前独立事实为 scope。 -->
ai_merge_decision_evidence.2 = scope
<!-- ai_merge_decision_evidence.3 的当前独立事实为 callers。 -->
ai_merge_decision_evidence.3 = callers
<!-- ai_merge_decision_evidence.4 的当前独立事实为 templates。 -->
ai_merge_decision_evidence.4 = templates
<!-- ai_merge_decision_evidence.5 的当前独立事实为 examples。 -->
ai_merge_decision_evidence.5 = examples
<!-- ai_merge_decision_evidence.6 的当前独立事实为 programs。 -->
ai_merge_decision_evidence.6 = programs
<!-- ai_merge_decision_evidence.7 的当前独立事实为 tests。 -->
ai_merge_decision_evidence.7 = tests
<!-- ai_merge_decision_evidence.8 的当前独立事实为 replacement。 -->
ai_merge_decision_evidence.8 = replacement
<!-- 删除只有在规则已废弃或被完整替代且引用和回归闭环后才允许执行。 -->
ai_deletion_requires = obsolete_or_fully_superseded
<!-- ai_deletion_requires.2 的当前独立事实为 retained_authority。 -->
ai_deletion_requires.2 = retained_authority
<!-- ai_deletion_requires.3 的当前独立事实为 reference_cleanup。 -->
ai_deletion_requires.3 = reference_cleanup
<!-- ai_deletion_requires.4 的当前独立事实为 regression_evidence。 -->
ai_deletion_requires.4 = regression_evidence
<!-- 每个问题必须进入明确缺口类别，使修正落到正确规则包组成。 -->
ai_must_classify_each_gap = rule_gap
<!-- ai_must_classify_each_gap.2 的当前独立事实为 template_gap。 -->
ai_must_classify_each_gap.2 = template_gap
<!-- ai_must_classify_each_gap.3 的当前独立事实为 example_gap。 -->
ai_must_classify_each_gap.3 = example_gap
<!-- ai_must_classify_each_gap.4 的当前独立事实为 program_gap。 -->
ai_must_classify_each_gap.4 = program_gap
<!-- ai_must_classify_each_gap.5 的当前独立事实为 verification_gap。 -->
ai_must_classify_each_gap.5 = verification_gap
<!-- ai_must_classify_each_gap.6 的当前独立事实为 upgrade_record_gap。 -->
ai_must_classify_each_gap.6 = upgrade_record_gap
<!-- ai_must_classify_each_gap.7 的当前独立事实为 stale_reference。 -->
ai_must_classify_each_gap.7 = stale_reference
<!-- ai_must_classify_each_gap.8 的当前独立事实为 duplicate_or_conflict。 -->
ai_must_classify_each_gap.8 = duplicate_or_conflict
<!-- 可复发问题必须优先修正规则包，禁止只修改当前成品后结束。 -->
ai_must_prefer_repairing_the_rule_package_over_repairing_one_output = true

## 按规则运行

<!-- 正式执行按最小规则、资产加载、任务执行、偏差验证、结果记录和升级判断顺序进行。 -->
execution_sequence = load_minimum_rules
<!-- execution_sequence.2 的当前独立事实为 load_rule_package_assets。 -->
execution_sequence.2 = load_rule_package_assets
<!-- execution_sequence.3 的当前独立事实为 execute_by_rule。 -->
execution_sequence.3 = execute_by_rule
<!-- execution_sequence.4 的当前独立事实为 verify_deviation。 -->
execution_sequence.4 = verify_deviation
<!-- execution_sequence.5 的当前独立事实为 record_result。 -->
execution_sequence.5 = record_result
<!-- execution_sequence.6 的当前独立事实为 evaluate_upgrade。 -->
execution_sequence.6 = evaluate_upgrade
<!-- 规则选择只能使用索引登记的 SELPLAT 作用域和 AGENTS.md 当前稳定用户，不得扫描其他作用域。 -->
rule_selection_must_follow_registered_scope_and_user = true
<!-- 程序、模板和案例必须通过登记入口或已验证路径定位，禁止按名称猜测。 -->
physical_path_guessing_is_forbidden = true
<!-- 迁移后的旧路径必须改为稳定 ability ID 或已经验证存在的当前路径。 -->
stale_reference_must_be_replaced_by_registered_ability_or_verified_current_path = true
<!-- 规则缺少本应存在的资产时必须先报告缺口，不得声称可以稳定复现。 -->
rule_without_required_asset_must_report_gap_before_claiming_repeatable_execution = true

## 持续更新升级

<!-- 重复偏差、用户修正、失效引用和缺失组成都会触发一次正式升级评估。 -->
upgrade_trigger = repeated_deviation
<!-- upgrade_trigger.2 的当前独立事实为 user_correction。 -->
upgrade_trigger.2 = user_correction
<!-- upgrade_trigger.3 的当前独立事实为 stale_reference。 -->
upgrade_trigger.3 = stale_reference
<!-- upgrade_trigger.4 的当前独立事实为 missing_asset。 -->
upgrade_trigger.4 = missing_asset
<!-- upgrade_trigger.5 的当前独立事实为 missing_program。 -->
upgrade_trigger.5 = missing_program
<!-- upgrade_trigger.6 的当前独立事实为 missing_verification。 -->
upgrade_trigger.6 = missing_verification
<!-- upgrade_trigger.7 的当前独立事实为 near_duplicate_rule。 -->
upgrade_trigger.7 = near_duplicate_rule
<!-- 升级先建立验证证据，再依次修正规则包组成和最后的索引注册。 -->
upgrade_target_order = verification_evidence
<!-- upgrade_target_order.2 的当前独立事实为 rule。 -->
upgrade_target_order.2 = rule
<!-- upgrade_target_order.3 的当前独立事实为 template。 -->
upgrade_target_order.3 = template
<!-- upgrade_target_order.4 的当前独立事实为 example。 -->
upgrade_target_order.4 = example
<!-- upgrade_target_order.5 的当前独立事实为 program。 -->
upgrade_target_order.5 = program
<!-- upgrade_target_order.6 的当前独立事实为 index_and_registry。 -->
upgrade_target_order.6 = index_and_registry
<!-- 没有用户明确点名目标并以独立 1 启动时，AI 自动生成的修正只能进入动态解析的当前用户层。 -->
automatic_change_target_without_explicit_delegation = local/<active-stable-user-id>
<!-- 用户明确点名 core 或 common 修改并以独立 1 启动后，AI 可以托管该次指定范围内的修改与验证。 -->
explicit_user_delegation_policy = ai_may_modify_explicitly_named_core_or_common_scope_after_standalone_1
<!-- 托管授权只覆盖用户指定目标，不允许借清理或重构扩大到无关文件。 -->
explicit_user_delegation_scope_must_not_expand = true
<!-- core 和 common 没有取得本次明确托管授权时仍保持冻结。 -->
core_common_change_policy_without_explicit_delegation = forbidden
<!-- 每次升级必须验证索引、引用、注册表和受影响回归路径。 -->
upgrade_must_run_index_reference_registry_and_relevant_regression_checks = true
<!-- 成长结果必须比较升级前后缺口数量，禁止只用新增文件数证明完成。 -->
upgrade_must_record_before_after_gap_counts = true

## 程序入口

<!-- 稳定程序 ID 供规则正文、测试和直接命令共同引用。 -->
python_ability_id = ai_rule_package_integrator
<!-- 能力文件进入 AGENTS.md 当前稳定用户对应的 Python 原生分层目录。 -->
python_ability_path = apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/<active-stable-user-id>/abilities/ai_rule_package_integrator.py
<!-- 用户程序无需注册表或二次执行器，代入当前稳定用户后直接接收 JSON 上下文并复用同一 execute 实现。 -->
python_program_command = python3 apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/<active-stable-user-id>/abilities/ai_rule_package_integrator.py <context_json>
<!-- audit 只返回事实，write_report 只允许把同一事实写入 OPTION。 -->
ability_actions = audit
<!-- ability_actions.2 的当前独立事实为 write_report。 -->
ability_actions.2 = write_report

## 成长指标

<!-- 指标覆盖规则规模、规则包组成、程序关联、验证、失效引用和升级元数据。 -->
growth_metrics = indexed_rules
<!-- growth_metrics.2 的当前独立事实为 standard_asset_packages。 -->
growth_metrics.2 = standard_asset_packages
<!-- growth_metrics.3 的当前独立事实为 template_coverage。 -->
growth_metrics.3 = template_coverage
<!-- growth_metrics.4 的当前独立事实为 example_coverage。 -->
growth_metrics.4 = example_coverage
<!-- growth_metrics.5 的当前独立事实为 program_reference_coverage。 -->
growth_metrics.5 = program_reference_coverage
<!-- growth_metrics.6 的当前独立事实为 verification_coverage。 -->
growth_metrics.6 = verification_coverage
<!-- growth_metrics.7 的当前独立事实为 stale_reference_count。 -->
growth_metrics.7 = stale_reference_count
<!-- growth_metrics.8 的当前独立事实为 upgrade_metadata_coverage。 -->
growth_metrics.8 = upgrade_metadata_coverage
<!-- 成长必须表现为偏差和失效引用减少，禁止只追求规则数量增加。 -->
growth_must_reduce_deviation_and_stale_references_not_only_increase_rule_count = true
