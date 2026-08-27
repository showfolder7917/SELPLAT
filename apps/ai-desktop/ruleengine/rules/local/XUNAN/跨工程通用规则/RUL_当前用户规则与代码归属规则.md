# 当前用户规则与代码归属规则

<!-- 本规则所有者始终从 AGENTS.md 当前稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id

<!-- active 表示所有规则维护和关联能力迁移任务必须加载本规则。 -->
rule_status = active

<!-- 当前实际业务规则只允许进入当前稳定用户层。 -->
active_rule_owner_layer = local/<stable-user-id>

<!-- common 资源层当前只保留空索引。 -->
common_resource_status = reserved_empty

<!-- common Java 代码层当前不保存生产实体。 -->
common_java_code_status = reserved_empty

<!-- common Python 代码层当前不保存生产实体。 -->
common_python_code_status = reserved_empty

<!-- common Node 代码层当前不保存生产实体。 -->
common_node_code_status = reserved_empty

<!-- common 与当前用户出现相同逻辑 ID 时保留当前用户版本。 -->
rule_conflict_winner = active_user

<!-- common 与当前用户出现相同物理路径时保留当前用户文件。 -->
file_conflict_winner = active_user

<!-- 迁入规则必须使用一条中文注释紧邻一条 DSL。 -->
rule_dsl_comment_cardinality = one_chinese_comment_for_one_declaration

<!-- 每条 DSL 只允许表达一个独立事实。 -->
rule_dsl_fact_cardinality = one_declaration_one_fact

<!-- 并列事实必须使用点号数字后缀拆成稳定独立键。 -->
rule_dsl_parallel_fact_key_pattern = <base-key>,<base-key>.2,<base-key>.3

<!-- JSON、函数签名和括号结构内部的逗号属于同一结构事实，不得机械拆分。 -->
rule_dsl_structured_value_boundary = preserve_commas_inside_json_quotes_or_brackets

<!-- 当前稳定用户的正式能力只允许进入 Python 源码根。 -->
active_user_python_code_root = apps/ai-desktop/ruleengine/python/local/<stable-user-id>/

<!-- 当前稳定用户的 Java 能力目录保持退役空状态。 -->
active_user_java_code_status = retired_empty

<!-- 当前稳定用户的 Node 能力目录保持退役空状态。 -->
active_user_node_code_status = retired_empty

<!-- 当前稳定用户的旧能力封存区不得保留可执行源码。 -->
active_user_executable_archive_status = empty

<!-- 代码迁移必须同步包名、调用方、构建入口、规则引用和专项测试。 -->
code_layer_migration_atomic_sync = package_name

<!-- 构建入口是代码迁移必须同步的第二项事实。 -->
code_layer_migration_atomic_sync.2 = build_entry

<!-- 生产调用方是代码迁移必须同步的第三项事实。 -->
code_layer_migration_atomic_sync.3 = production_callers

<!-- 规则能力引用是代码迁移必须同步的第四项事实。 -->
code_layer_migration_atomic_sync.4 = rule_references

<!-- 专项测试是代码迁移必须同步的第五项事实。 -->
code_layer_migration_atomic_sync.5 = tests

<!-- 规则提升回 common 前必须完成独立人工审查。 -->
common_restore_gate = manual_review

<!-- 规则提升回 common 还必须取得用户明确授权。 -->
common_restore_gate.2 = explicit_user_authorization

<!-- 规则提升回 common 还必须证明存在多个真实用户复用。 -->
common_restore_gate.3 = verified_multi_user_reuse

<!-- 本规则不依赖 Java 执行能力。 -->
java_ability_refs = none

<!-- 本规则不依赖 Python 执行能力。 -->
python_ability_refs = none

<!-- 本规则不依赖 Node 执行能力。 -->
node_ability_refs = none
