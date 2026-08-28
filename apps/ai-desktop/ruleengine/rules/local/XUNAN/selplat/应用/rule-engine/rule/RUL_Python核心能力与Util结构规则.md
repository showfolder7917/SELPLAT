# Python 核心能力与 Util 结构规则

<!-- 当前用户规则物理层始终从 AGENTS.md 当前稳定用户解析并进入 local/<stable-user-id>。 -->
rule_resource_layer_source = AGENTS.md.current_stable_user_id

<!-- 本规则从第一版 Python core 结构收敛开始生效。 -->
rule_version = 2.0.0

<!-- 同线程重复加载同一规则集合时必须复用精简快照，减少完整正文重复进入 AI 上下文。 -->
python_core.rule_loading_same_thread_policy = compact_snapshot_reuse

<!-- 规则、索引或身份资源变化后旧快照必须自动失效。 -->
python_core.rule_snapshot_invalidation = resource_revision_change

<!-- 多个能力动作应优先通过执行器批量模式在同一 Python 进程内完成。 -->
python_core.executor_multi_action_policy = single_process_batch

<!-- 测试成功只返回数量摘要，失败时才返回完整用例详情。 -->
python_core.test_output_policy = success_summary_failure_details

<!-- 验证顺序先运行受影响专项，再运行完整交付门禁。 -->
python_core.verification_order = affected_scope_then_full_delivery_gate

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

<!-- rule-engine 新运行包只允许中文执行器、能力目录和 util 目录。 -->
python_core.active_structure = chinese_executor_abilities_and_util_only

<!-- rule-engine 运行包固定进入扁平 Python 命名空间。 -->
python_core.runtime_package = apps/ai-desktop/ruleengine/python/ruleengine

<!-- core 与当前用户能力位于同一 Python local 分层根，用户目录由 AGENTS.md 动态代入。 -->
python_core.layered_package_root = apps/ai-desktop/ruleengine/python/local/<layer>

<!-- 规则、协议、注册表和配置统一位于独立 rules 根。 -->
python_core.rule_resource_root = apps/ai-desktop/ruleengine/rules

<!-- 测试与生产源码平级，并按 core 和当前稳定用户分层。 -->
python_core.test_root = apps/ai-desktop/ruleengine/tests/local/<layer>

<!-- 该 Python 与规则工程禁止恢复后端框架和 Java 包式目录。 -->
python_core.forbidden_layout = backend,src/main,src/test,com/sp/selplat

<!-- ruleengine 内不保存退役需求和设计副本，现行架构文档统一由工程根 OPTION 管理。 -->
python_core.forbidden_top_level_directory = docs

<!-- ruleengine 现行架构文档的唯一归属根是工程 OPTION。 -->
python_core.architecture_document_root = OPTION

<!-- 尚未迁移的其他 core 能力在本阶段继续保留旧能力根，不复制第二个执行器。 -->
python_core.legacy_ability_root_policy = retain_unmigrated_abilities_without_executor

<!-- Python 源码文件使用中文职责名，标准 __init__.py 除外。 -->
python_core.source_filename_language = chinese_except_python_standard_files

<!-- 每个能力模块只通过 execute 对外开放调用。 -->
python_core.public_ability_entry = execute

<!-- 能力内部方法统一使用下划线前缀。 -->
python_core.internal_method_prefix = _

<!-- 工程路径只从公共 TOML 配置解析。 -->
python_core.path_config = apps/ai-desktop/ruleengine/rules/config/路径配置.toml

<!-- 中文执行器只读取唯一 ability 注册表。 -->
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
