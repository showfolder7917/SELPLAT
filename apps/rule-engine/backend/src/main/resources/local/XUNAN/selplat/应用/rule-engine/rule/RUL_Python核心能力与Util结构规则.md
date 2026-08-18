# Python 核心能力与 Util 结构规则

<!-- 本规则从第一版 Python core 结构收敛开始生效。 -->
rule_version = 1.0.0

<!-- 规则所有者从工程根当前稳定用户声明动态解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id

<!-- 本规则参与当前用户的 rule-engine 应用覆盖层。 -->
rule_status = active

<!-- 本规则复用 core Python 编码要求。 -->
requires_rule_ids = CODE_PYTHON_RULES

<!-- 本规则扩展低层 Python 约束，不替换未冲突事实。 -->
override_mode = extend

<!-- 本规则同时约束 rule-engine Python core 与当前用户能力层。 -->
python_structure.scope = core_and_active_user

<!-- 当前用户正式能力源码只允许使用 Python。 -->
active_user_ability_language = python_only

<!-- 当前用户 Java 能力目录必须为空。 -->
active_user_java_ability_status = retired_empty

<!-- 当前用户 Node 能力目录必须为空。 -->
active_user_node_ability_status = retired_empty

<!-- 当前用户旧能力封存区不再保留可执行代码。 -->
active_user_executable_archive_status = empty

<!-- Python core 的活跃代码只允许执行器、能力目录和 util 目录。 -->
python_core.active_structure = executor_abilities_and_util_only

<!-- 执行器只读取唯一 ability 注册表。 -->
python_core.executor.registry = abilities_only

<!-- 执行器不得解析 skill 注册表。 -->
python_core.executor.skill_registry = forbidden

<!-- 执行器不得解析 app 注册表。 -->
python_core.executor.app_registry = forbidden

<!-- 能够独立接收任务并返回业务结果的模块必须放入 abilities。 -->
python_core.module.independent_business_entry = abilities

<!-- 只为能力提供公共实现且没有独立业务入口的模块必须放入 util。 -->
python_core.module.shared_non_entry_implementation = util

<!-- abilities 可以依赖 util。 -->
python_core.dependency.abilities_to_util = allowed

<!-- util 禁止反向依赖 abilities。 -->
python_core.dependency.util_to_abilities = forbidden

<!-- util 禁止登记为独立 ability。 -->
python_core.util.ability_registration = forbidden

<!-- util 禁止使用含义不明确的公共杂物名称。 -->
python_core.util.ambiguous_module_names = forbidden

<!-- 已迁出内容必须退出 active 注册、索引和代码导入链。 -->
python_core.archive.active_reference = forbidden

<!-- 封存内容恢复前必须重新核对调用方、依赖、规则归属和测试。 -->
python_core.archive.restore_gate = callers_dependencies_rules_and_tests_review
