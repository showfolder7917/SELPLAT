# AI Desktop 自动产品交付平台终局定位规则

<!-- 问题：若把 AI Desktop 理解为覆盖全部研发工具的通用平台，或只理解为桌面聊天、代码生成和多 Agent 管理工具，后续产品和架构都会偏离用户确认的终局。 -->
<!-- 场景：规划、评估、设计或修改 AI Desktop 的产品范围、架构边界、商业模式和交付流程。 -->
<!-- 业务含义：AI Desktop 以韩立代理用户持续发问、南宫婉依据证据分析并组织执行为核心，直到真实验收通过并完成任务。 -->

<!-- 1.1.0 依据用户纠正，把终局从宽泛阶段覆盖收敛为韩立与南宫婉驱动的自主任务完成闭环。 -->
rule_version = 1.1.0

<!-- 规则所有者始终由工程根 AGENTS.md 的当前稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id

<!-- active 表示后续产品、架构与商业决策必须按本定位评估。 -->
rule_status = active

<!-- AI Desktop 的终局产品定位是自动产品交付平台。 -->
ai_desktop_terminal_product_positioning = automatic_product_delivery_platform

<!-- 自动产品交付平台的核心不是重造全部研发工具，而是以角色化自主研讨替代日常人工推动并闭环完成任务。 -->
ai_desktop_terminal_product_core = persona_driven_autonomous_deliberation_and_task_completion_loop

<!-- 用户只需提供初始目标、现有资料或任务种子，系统不得要求用户预先完成完整需求分析。 -->
automatic_product_delivery_chain = user_goal_context_or_task_seed

<!-- 韩立代表用户维护关注点和需求结构，每轮提出影响下一步的唯一关键问题。 -->
automatic_product_delivery_chain.2 = hanli_user_proxy_asks_next_critical_question

<!-- 南宫婉依据用户历史、当前规则、项目事实和调查证据分析并回答韩立。 -->
automatic_product_delivery_chain.3 = nangong_analyzes_and_answers_from_governed_evidence

<!-- 韩立审查回答并继续提问，直到需求、方案、风险和验收条件足以执行。 -->
automatic_product_delivery_chain.4 = hanli_reviews_and_repeats_until_actionable

<!-- 南宫婉把已收敛结论形成可验收方案、拆解任务并分发给受控执行者。 -->
automatic_product_delivery_chain.5 = nangong_forms_plan_decomposes_and_dispatches

<!-- 执行者实施并自检，令狐根据真实失败证据完成统一测试、诊断、修复与复测保障。 -->
automatic_product_delivery_chain.6 = executors_implement_plus_linghu_tests_diagnoses_repairs_and_retests

<!-- 韩立依据用户关注点和真实应用证据最终验收；失败返回分析执行链，通过才完成任务。 -->
automatic_product_delivery_chain.7 = hanli_real_acceptance_plus_failure_feedback_loop_until_task_complete

<!-- 平台正式交付物必须满足已收敛目标、通过真实验收且保留问题、分析、执行、测试和版本证据。 -->
automatic_product_delivery_definition_of_done = converged_goal_met_plus_real_acceptance_passed_plus_traceable_deliberation_execution_test_and_version_evidence

<!-- 系统可代替人的日常追问、分析和任务推动，但不得虚构用户偏好、预算、法律授权或不可逆决策。 -->
automatic_product_delivery_user_proxy_boundary = automate_routine_questioning_analysis_and_coordination_plus_no_invented_preference_budget_legal_authority_or_irreversible_decision

<!-- 当证据无法决定真实业务取舍或需要高风险授权时，必须升级询问用户。 -->
automatic_product_delivery_human_governance_boundary = ask_user_for_unresolved_business_tradeoff_or_high_risk_authority

<!-- 近期商业切口应验证一类任务能够减少用户追问和推动次数并提高一次验收通过率。 -->
automatic_product_delivery_near_term_scope_strategy = one_repeatable_task_class_plus_fewer_user_interventions_plus_higher_first_acceptance_rate

<!-- 平台优先编排现有模型和工程工具，差异化资产是自主提问、证据分析、任务推进、失败纠偏和验收记忆闭环。 -->
automatic_product_delivery_build_or_integrate_policy = orchestrate_existing_tools_and_own_question_analysis_execution_correction_acceptance_memory_loop

<!-- 本定位没有独立 Java 执行职责。 -->
java_ability_refs = none

<!-- 本定位没有可重复 Python 执行职责。 -->
python_ability_refs = none

<!-- 本定位没有独立 Node 执行职责。 -->
node_ability_refs = none
