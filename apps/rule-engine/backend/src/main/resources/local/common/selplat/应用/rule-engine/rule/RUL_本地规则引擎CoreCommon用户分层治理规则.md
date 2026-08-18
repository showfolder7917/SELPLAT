# 本地规则引擎 Core、Common 与用户分层治理规则

java_ability_refs = none
python_ability_refs = apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core/abilities/layered_rule_loader.py
node_ability_refs = none

## 适用范围

<!-- 问题：旧记忆库、既有 rule-engine 规则与不同用户修正分散后，加载来源、冲突优先级和写入权限无法稳定判断。 -->
<!-- 场景：AGENTS、旧记忆资料、规则、协议、注册表、能力代码和测试迁入 rule-engine，或用户提交后续修正。 -->
<!-- 业务含义：不可变基础、公共修正和用户个性化拥有明确物理边界，运行时可以按当前用户稳定组装唯一结果。 -->
rule_engine_layer_governance_scope = apps/rule-engine/backend
rule_engine_layer_migration_status = migration_complete_core_frozen

## 代码与规则物理分区

<!-- Java 执行代码继续位于标准 Java source set，并在既有 code 包下按层分目录；业务含义是迁移不建立自定义 sourceSet，也不把代码混入规则资源。 -->
rule_engine_java_layer_root = src/main/java/com/sp/selplat/local/code/<layer>/

<!-- Python 执行代码位于标准 Python 源目录，并复用与 Java 完全相同的包路径和层名；业务含义是语言保持原生实现且仍可按用户隔离。 -->
rule_engine_python_layer_root = src/main/python/com/sp/selplat/local/code/<layer>/

<!-- Node 执行代码位于标准 Node 源目录，并复用与 Java 完全相同的包路径和层名；业务含义是现有 mjs 能力无需为迁移被强制改写语言。 -->
rule_engine_node_layer_root = src/main/node/com/sp/selplat/local/code/<layer>/

<!-- 规则、协议、注册信息和规则资产继续位于标准 resources source set，并以首级目录表达所属层；业务含义是规则可以被 Gradle 正常打包且不会与 Java 源码混放。 -->
rule_engine_resource_layer_root = src/main/resources/local/<layer>/

<!-- 固定层名为 core 与 common；用户层直接使用从 AGENTS.md 读取并经过路径安全校验的稳定用户标识。 -->
rule_engine_fixed_layers = core,common
rule_engine_user_layer_pattern = <stable-user-id>
rule_engine_user_layer_example = <stable-user-id>

<!-- Java、Python、Node 与 resources 必须使用相同层标识；业务含义是当前用户各语言代码只与同一当前用户规则组成覆盖层。 -->
rule_engine_code_resource_layer_name_must_match = true

## 来源归属与迁移

<!-- 已退役记忆库中经人工盘点后保留的协议、规则、注册信息和能力语义已形成 core 初始基线；该字段只记录迁移来源，不构成运行时路径。 -->
rule_engine_core_initial_source = retired_memory_repository_inventory

<!-- 迁移前 rule-engine 中经人工盘点后保留的规则和能力形成 common 初始内容；业务含义是既有规则引擎成果作为公共修正和扩展继续生效。 -->
rule_engine_common_initial_source = preexisting_rule_engine

<!-- AGENTS 的详细协议和约束已随旧记忆资料分类迁入 core；最终 AGENTS 只保留绝对根、启动入口、失败阻断和索引加载要求。 -->
agents_convergence_sequence = AGENTS_detail -> retired_memory_inventory -> rule_engine_core
agents_final_scope = absolute_root,startup_entry,fail_closed,index_loading_requirement

<!-- Python 与 Node 保持原语言迁入各自标准源目录；禁止放入 Java 目录，也禁止仅为统一目录而强制改写语言。 -->
language_native_executable_migration = java_to_java_source_set,python_to_python_source_set,node_to_node_source_set

<!-- 旧记忆库中的 Python/Node 初始能力已经归入 core，迁移前 rule-engine 中的 Python/Node 初始能力已经归入 common。 -->
python_node_core_initial_source = retired_memory_python_and_node
python_node_common_initial_source = preexisting_rule_engine_python_and_node

<!-- 各语言迁移必须同步调用路径、注册表和对应测试；业务含义是物理移动后能力仍由原语言入口执行。 -->
language_native_migration_verification = update_call_paths,update_registries,run_language_specific_tests

## 加载顺序与冲突优先级

<!-- 生产加载先建立 core 基线，再叠加 common，最后只叠加当前身份绑定的一个用户层。 -->
rule_engine_production_loading_order = local/core -> local/common -> local/active_user

<!-- 同主题且适用范围相同的冲突由后加载层获胜；业务含义是当前用户修正优先于公共修正，公共修正优先于不可变基础。 -->
rule_engine_conflict_priority = local/active_user > local/common > local/core

<!-- common 内部先建立跨工程通用基线，再叠加当前明确命中的一个项目或作用域；用户层仍保持最高优先级。 -->
rule_engine_hierarchical_loading_order = local/core -> local/common/跨工程通用规则 -> local/common/matched_scope -> local/active_user
rule_engine_hierarchical_conflict_priority = local/active_user > local/common/matched_scope > local/common/跨工程通用规则 > local/core

<!-- 当前工程或作用域必须由调用上下文或索引路由显式确定；禁止扫描并同时叠加多个 common 工程作用域。 -->
rule_engine_common_scope_selection = explicit_current_scope_only
rule_engine_forbid_common_scope_loading = guessed_scope,all_scopes,multiple_unrelated_scopes

<!-- 没有已验证当前用户时只加载 core 与 common；禁止猜测用户、加载全部用户或把多个用户目录合成生产结果。 -->
rule_engine_missing_user_loading = local/core -> local/common
rule_engine_forbid_user_loading = guessed_user,all_users,multiple_users

<!-- 覆盖必须通过唯一索引中的稳定逻辑标识显式声明；禁止依靠同名文件、目录遍历顺序或类路径偶然顺序覆盖。 -->
rule_engine_override_registration = explicit_stable_logical_id_in_root_RULE_INDEX

<!-- 分级索引启用后，稳定逻辑 ID 在所属叶子索引唯一登记；根索引通过 common 汇总索引可达，不再复制 common 规则条目。 -->
rule_engine_hierarchical_override_registration = explicit_stable_logical_id_in_owning_leaf_index
rule_engine_root_index_common_content = common_aggregate_index_reference_only

<!-- 递归索引必须限制在 resources/local 下，并闭锁处理循环、重复 ID、路径越界、缺失子索引和过深嵌套。 -->
rule_engine_recursive_index_allowed_root = resources/local/
rule_engine_recursive_index_max_depth = 16
rule_engine_recursive_index_must_block = cycle,duplicate_logical_id,path_escape,missing_child_index,depth_overflow

## 写入与人工合并权限

<!-- core 在初始迁移、验证和冻结完成后永久禁止修正；自动化和后续人工合并流程都没有写入权限。 -->
rule_engine_core_after_freeze_write_policy = forbidden

<!-- common 只允许人工审查后手工合并；自动修复器、生成器和用户任务不得直接写入。 -->
rule_engine_common_write_policy = manual_reviewed_merge_only

<!-- 自动生成的后续修正只能写入当前已验证用户层；业务含义是修正不会跨用户污染，也不会绕过公共层审核。 -->
rule_engine_automatic_correction_target = active_user_only

<!-- 用户方案的唯一公共合并目标是 common，core 永远不是修正合并目标。 -->
rule_engine_user_manual_merge_target = common
rule_engine_user_merge_to_core_is_forbidden = true

## 迁移缺陷的一次性修复例外

<!-- 问题：初始迁移可能把原语言能力误改写成不完整的并行实现；若冻结规则绝对禁止清理，会永久保留已确认的迁移缺陷。 -->
<!-- 场景：仅处理初始迁移新增、功能弱于既有权威实现且造成入口冲突的 core 文件，不适用于普通功能修正、规则升级或用户偏好。 -->
<!-- 业务含义：core 仍默认永久冻结，但经两阶段人工确认后可以一次性删除迁移误产物并恢复迁移前已有的完整权威入口。 -->
rule_engine_core_migration_defect_repair_exception = explicit_user_confirmed_one_time_repair_only

<!-- 迁移缺陷必须同时满足来源、完整性、替代实现、引用和验证五项证据，任一不满足都不得打开 core。 -->
rule_engine_core_migration_defect_required_evidence = introduced_by_initial_migration,incomplete_or_semantically_inferior,authoritative_equivalent_exists,all_references_identified,relevant_tests_available

<!-- 迁移缺陷治理和实际目标变更必须分别取得独立确认；业务含义是批准修正规则不等于批准立即删除 core 文件。 -->
rule_engine_core_migration_defect_confirmation_sequence = governance_change_standalone_1 -> target_change_standalone_1

<!-- 例外只允许删除误产物、清理引用和恢复既有权威入口，禁止借机新增功能、改写无关 core 内容或扩大写入范围。 -->
rule_engine_core_migration_defect_allowed_actions = remove_migration_artifact,remove_artifact_references,restore_existing_authoritative_entry,update_tests_and_index
rule_engine_core_migration_defect_forbidden_actions = unrelated_core_change,new_feature,user_customization,broad_refactor

<!-- 当前已治理案例：Java 启动加载器是迁移新增的不完整并行实现，Python 启动加载器是迁移前已有且注册表仍登记的完整权威实现。 -->
rule_engine_current_migration_defect_case = repaired_java_startup_protocol_loader_duplicate_removed_python_authority_restored
rule_engine_current_migration_defect_target_change_gate = closed_core_refrozen

<!-- 本次目标修复通过验证后必须立即关闭例外状态，core 恢复永久冻结。 -->
rule_engine_core_migration_defect_repair_close_condition = target_removed,references_cleaned,python_startup_verified,java_tests_passed,index_verified
rule_engine_current_migration_defect_repair_result = all_close_conditions_satisfied

## 分级索引切换的一次性加载器适配

<!-- 问题：迁移期旧分层加载实现只解析根索引简单赋值，无法执行已经确认的 common 分级索引结构。 -->
<!-- 场景：建立 common 汇总索引、一级作用域索引和叶子项目索引，并保持 core 规则由根索引直接登记。 -->
<!-- 业务含义：允许在两阶段人工确认后仅扩展索引递归解析与安全闭锁，不得借机改变规则正文或扩大 core 其他能力。 -->
rule_engine_core_hierarchical_index_loader_exception = explicit_user_confirmed_one_time_structural_cutover

<!-- 加载器适配必须保持现有 core 逻辑 ID 行为，并新增递归、循环、重复、越界、缺失和深度验证。 -->
rule_engine_hierarchical_loader_required_compatibility = existing_core_logical_ids,active_user_isolation,fail_closed_unknown_id
rule_engine_hierarchical_loader_required_guards = cycle,duplicate_logical_id,path_escape,missing_child_index,depth_overflow

<!-- 本次切换已依次取得治理确认和实施确认；该确认序列仅作为审计记录，不再保持写入窗口。 -->
rule_engine_hierarchical_index_cutover_confirmation_sequence = governance_change_standalone_1 -> implementation_standalone_1
rule_engine_hierarchical_index_cutover_components = python_layered_rule_loader,rule_package_generator,index_structure_tests
rule_engine_current_hierarchical_index_cutover_case = completed_common_scope_index_aggregation_and_recursive_loader
rule_engine_current_hierarchical_index_cutover_gate = closed_core_refrozen
rule_engine_current_hierarchical_index_cutover_result = nine_indexes_seventy_one_rules_all_guards_verified

<!-- 实施验证全部通过后必须关闭切换例外并恢复 core 永久冻结。 -->
rule_engine_hierarchical_index_cutover_close_condition = child_indexes_created,root_common_entries_removed,recursive_loader_tests_passed,all_index_targets_valid,core_refrozen

## Python 唯一分层加载入口

<!-- 问题：Java 分层加载器要求启动 JVM，并与已统一使用 Python 的协议、能力和门禁入口形成跨语言切换成本。 -->
<!-- 场景：根索引、common 作用域、当前用户、依赖闭包和加载回执需要在同一任务进程中多次读取。 -->
<!-- 业务含义：分层加载统一由 Python 完成，复用未变化的 UTF-8 资源快照并消除 Java 加载链。 -->
rule_engine_layered_loader_authority = apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core/abilities/layered_rule_loader.py
<!-- 生产加载、索引验证和依赖闭包都必须使用同一个 Python ability，禁止恢复 Java fallback。 -->
rule_engine_layered_loading_runtime_language = python_only
<!-- 原 Java 加载器已被 Python 完整替代并清理源码、测试、索引和调用引用。 -->
rule_engine_java_layered_loader_status = retired_fully_superseded_no_fallback
<!-- Python 实现必须保持既有分层顺序、覆盖模式、用户隔离、依赖闭包、回执和全部安全闭锁。 -->
rule_engine_python_layered_loader_compatibility = loading_order,extend_replace,user_isolation,dependency_closure,receipts,cycle_duplicate_escape_missing_depth_guards
<!-- 同一进程按文件修改时间与大小复用 UTF-8 资源快照，文件变化后自动读取新版本。 -->
rule_engine_python_layered_loader_cache_policy = resource_path_plus_mtime_ns_plus_size,refresh_after_change
<!-- 切换必须同步根索引、ability 注册、说明文档、Python 测试并验证 Java 引用为零。 -->
rule_engine_python_only_layered_loader_cutover = root_index,ability_registry,readme,python_tests,zero_java_loader_runtime_references

## 合并、删除与过渡

<!-- 同主题内容必须先做语义、适用范围、调用入口和测试比较；可合并内容收敛为一个权威入口，禁止简单按文件名覆盖。 -->
rule_engine_merge_decision_basis = semantics,applicability,callers,tests

<!-- 只有重复、失效、无调用入口、被完整替代或冲突裁决后明确落败的内容才允许删除。 -->
rule_engine_deletion_allowed_for = duplicate,obsolete,unreferenced,fully_superseded,adjudicated_conflict_loser

<!-- 删除前必须记录保留方、清理全部引用并通过相关测试；业务含义是“不能合并就删除”不会造成唯一能力静默丢失。 -->
rule_engine_deletion_evidence = retained_winner,reference_cleanup,index_cleanup,relevant_tests

<!-- 分层迁移完成前，旧 resources 和 code 位置只允许作为迁移输入继续读取；不得继续新增规则或能力。 -->
rule_engine_legacy_layout_transition_policy = read_for_migration_only,no_new_authoring

<!-- 分层切换必须一次同步根 RULE_INDEX、构建验证、启动链、注册表、调用路径和测试；全部通过前不得删除旧入口。 -->
rule_engine_layer_cutover_atomic_sync = root_RULE_INDEX,startup_chain,registries,call_paths,build,tests
