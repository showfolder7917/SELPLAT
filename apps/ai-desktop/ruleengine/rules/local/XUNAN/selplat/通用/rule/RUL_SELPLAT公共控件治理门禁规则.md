# SELPLAT 公共控件治理门禁规则

<!-- 本规则约束 SELPLAT 现有和未来全部原生前端控件，不依赖控件名称逐项追加规则。 -->
rule_scope = active_user_selplat_shared_ui_component_governance
<!-- 5.21.0 固定 SEL UI 唯一源码、新主题判断、Java 与 Node 分语言接入及 React 生命周期边界。 -->
rule_version = 5.22.0
<!-- 规则所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示登记表、快速门禁、公共构建门禁和回归测试均已接通。 -->
rule_status = active
<!-- 本规则复用源码归属扫描能力，不再建立第二套近义门禁程序。 -->
python_ability_refs = apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/selplat_source_ownership_guard.py
<!-- 公共控件由原生 JavaScript 实现，当前不新增 Java 或 Node 能力入口。 -->
java_ability_refs = none
<!-- 当前门禁由 Python 快速扫描和 Gradle 公共构建执行，不建立重复 Node 能力。 -->
node_ability_refs = none
<!-- 原逻辑 ID 保留为兼容聚合入口，并显式加载已拆分的职责规则。 -->
requires_rule_ids = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES,SELPLAT_COMPONENT_REGISTRY_AND_HOST_ADOPTION_RULES,SELPLAT_COMPONENT_GRID_SEARCH_INTERACTION_RULES,SELPLAT_PAGE_EDITOR_AND_REFERENCE_CONTROL_RULES,SELPLAT_COMPONENT_DELIVERY_GATE_RULES
