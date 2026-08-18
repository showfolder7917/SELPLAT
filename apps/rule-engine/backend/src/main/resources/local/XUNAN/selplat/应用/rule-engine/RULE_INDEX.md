# 当前用户 SELPLAT rule-engine 应用规则索引

<!-- AI 规则包智慧整合由当前用户层优先加载。 -->
AI_RULE_PACKAGE_INTELLIGENCE_RULES = local/XUNAN/selplat/应用/rule-engine/rule/RUL_AI规则包智慧整合规则.md

<!-- Python core 采用 executor、abilities、util 三段活跃结构，并隔离封存非核心实现。 -->
RULE_ENGINE_PYTHON_CORE_ABILITY_UTIL_STRUCTURE_RULES = local/XUNAN/selplat/应用/rule-engine/rule/RUL_Python核心能力与Util结构规则.md

<!-- 修改 Python core 目录结构、执行器注册或 util 边界时加载该规则。 -->
load_rule_for_python_core_ability_util_structure_change = RULE_ENGINE_PYTHON_CORE_ABILITY_UTIL_STRUCTURE_RULES

<!-- 本索引只维护 rule-engine 应用专项规则。 -->
selplat_application_scope = rule-engine
