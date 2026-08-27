# 当前用户 SELPLAT rule-engine 应用规则索引

<!-- AI 规则包智慧整合由当前用户层优先加载。 -->
AI_RULE_PACKAGE_INTELLIGENCE_RULES = local/XUNAN/selplat/应用/rule-engine/rule/RUL_AI规则包智慧整合规则.md

<!-- AI 工厂的服务端登记、七角色体系、任务生成根、审计事实和 Java 展示边界由当前用户层固定。 -->
AI_FACTORY_SERVER_MANAGEMENT_AND_TASK_RUNTIME_RULES = local/XUNAN/selplat/应用/rule-engine/rule/RUL_AI工厂服务端管理与任务目录规则.md

<!-- 修改 AI 工厂服务端职责、Agent/Gate登记、审计边界、任务目录或 Java 页面结构时加载该规则。 -->
load_rule_for_ai_factory_architecture_runtime_or_naming_change = AI_FACTORY_SERVER_MANAGEMENT_AND_TASK_RUNTIME_RULES

<!-- Python core 采用 executor、abilities、util 三段活跃结构，并隔离封存非核心实现。 -->
RULE_ENGINE_PYTHON_CORE_ABILITY_UTIL_STRUCTURE_RULES = active-user/rules/应用/RUL_Python核心能力与Util结构规则.md

<!-- 修改 Python core 目录结构、执行器注册或 util 边界时加载该规则。 -->
load_rule_for_python_core_ability_util_structure_change = RULE_ENGINE_PYTHON_CORE_ABILITY_UTIL_STRUCTURE_RULES

<!-- 本索引只维护 rule-engine 应用专项规则。 -->
selplat_application_scope = rule-engine
