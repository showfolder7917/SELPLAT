# 规则生命周期治理

<!-- 规则正文统一由 rule-engine 的标准 resources 承载；Python 加载器通过唯一索引直接读取，不依赖 Gradle 识别。 -->
rule_resource_root = apps/rule-engine/backend/src/main/resources

<!-- 正式规则在标准 resources 内按 core、空预留 common 或稳定用户标识分层；适用于分层迁移完成后的全部规则维护。 -->
rule_layer_root_pattern = apps/rule-engine/backend/src/main/resources/local/<layer>/
<!-- rule_layer_values 的当前独立事实为 core。 -->
rule_layer_values = core
<!-- rule_layer_values.2 的当前独立事实为 common。 -->
rule_layer_values.2 = common
<!-- rule_layer_values.3 的当前独立事实为 <stable-user-id>。 -->
rule_layer_values.3 = <stable-user-id>

<!-- 跨工程通用规则直接放在“跨工程通用规则”目录；适用于不依赖组织或工程语义的稳定规则；业务含义是目录语义明确，避免被误认作任意模块规则 -->
cross_project_rules_must_live_in_rule_root = apps/rule-engine/backend/src/main/resources/local/<layer>/跨工程通用规则/

<!-- 当前用户中除“跨工程通用规则”外，每个一级目录都是一个大项目；业务含义是 Fujitsu、SELPLAT、中文教学等项目拥有独立索引和分类边界。 -->
active_user_first_level_project_pattern = apps/rule-engine/backend/src/main/resources/local/<stable-user-id>/<large-project>/

<!-- 大项目跨子项目共享的规则统一进入“通用/rule”；业务含义是共享规则不再与应用规则或材料混放。 -->
active_user_large_project_general_rule_root = apps/rule-engine/backend/src/main/resources/local/<stable-user-id>/<large-project>/通用/rule/

<!-- 大项目的二级子项目统一进入“应用/<subproject>”；业务含义是每个二级项目在一个位置聚合自己的规则和真实材料。 -->
active_user_large_project_application_root = apps/rule-engine/backend/src/main/resources/local/<stable-user-id>/<large-project>/应用/<subproject>/

<!-- 二级子项目规则正文统一进入自己的 rule 目录。 -->
active_user_subproject_rule_root = apps/rule-engine/backend/src/main/resources/local/<stable-user-id>/<large-project>/应用/<subproject>/rule/

<!-- SELPLAT 的 apps 目录允许持续新增应用工程；适用于当前和未来任意 apps/<app>；业务含义是新增应用不再膨胀规则资源顶层目录 -->
selplat_application_source_pattern = apps/<app>/

<!-- SELPLAT 内部应用同样遵循大项目分类，不再维护“通用规则”和“应用规则”两套旧目录名。 -->
selplat_general_rule_path = apps/rule-engine/backend/src/main/resources/local/<stable-user-id>/selplat/通用/rule/
<!-- selplat_application_rule_path_pattern 的当前独立事实为当前用户 SELPLAT 应用规则目录。 -->
selplat_application_rule_path_pattern = apps/rule-engine/backend/src/main/resources/local/<stable-user-id>/selplat/应用/<app>/rule/

<!-- apps 下应用不得在规则资源根创建同名顶层目录；适用于新增或迁移 SELPLAT 应用规则；业务含义是避免把平台内部应用误判成组织级或跨项目业务模块 -->
selplat_application_must_not_create_resource_root_peer = true

<!-- 新规则必须先查唯一索引和现有近义规则；适用于所有规则沉淀；业务含义是更新或合并已有模块而非重复堆叠 -->
new_rule_must_check_and_merge_existing_semantics = true

<!-- 规则变更必须同步唯一索引；适用于新增、移动、改名和删除；业务含义是任何有效规则始终拥有可调用入口 -->
rule_change_must_sync_rule_index = RULE_INDEX.md

## 分级规则索引

<!-- 问题：当前用户层中多个工程、组织和业务域全部平铺到根索引后，任何局部维护都会扩大根索引冲突和审查范围。 -->
<!-- 场景：当前稳定用户层存在 SELPLAT、Fujitsu、中文教学及未来新增的独立规则作用域。 -->
<!-- 业务含义：每个作用域维护自己的权威索引，上级索引只负责汇总子索引，根索引保持稳定全局入口。 -->
active_user_first_level_directory_semantics = independent_rule_scope
<!-- active_user_rule_scope_examples 的当前独立事实为 fujitsu。 -->
active_user_rule_scope_examples = fujitsu
<!-- active_user_rule_scope_examples.2 的当前独立事实为 selplat。 -->
active_user_rule_scope_examples.2 = selplat
<!-- active_user_rule_scope_examples.3 的当前独立事实为中文教学。 -->
active_user_rule_scope_examples.3 = 中文教学

<!-- 跨工程通用规则是所有工程可按需使用的共享作用域，不等同某个具体项目，也不得因适用范围广而默认全量加载。 -->
cross_project_common_scope = local/<stable-user-id>/跨工程通用规则/
<!-- cross_project_common_index 的当前独立事实为当前用户跨工程通用规则索引。 -->
cross_project_common_index = local/<stable-user-id>/跨工程通用规则/RULE_INDEX.md
<!-- cross_project_common_loading_policy 的当前独立事实为 matched_rules_only。 -->
cross_project_common_loading_policy = matched_rules_only
<!-- cross_project_common_loading_policy.2 的当前独立事实为 no_bulk_loading。 -->
cross_project_common_loading_policy.2 = no_bulk_loading

<!-- 当前用户汇总索引只登记一级作用域索引；禁止复制子索引内的规则逻辑 ID。 -->
active_user_aggregate_index = local/<stable-user-id>/RULE_INDEX.md
<!-- active_user_aggregate_index_content 的当前独立事实为只登记子作用域索引。 -->
active_user_aggregate_index_content = child_scope_index_references_only

<!-- 每个当前用户一级大项目必须维护自己的索引，并分别汇总通用索引与应用索引。 -->
active_user_scope_index_pattern = local/<stable-user-id>/<scope>/RULE_INDEX.md
<!-- active_user_general_index_pattern 的当前独立事实为当前用户作用域通用索引。 -->
active_user_general_index_pattern = local/<stable-user-id>/<scope>/通用/RULE_INDEX.md
<!-- active_user_application_aggregate_index_pattern 的当前独立事实为当前用户作用域应用汇总索引。 -->
active_user_application_aggregate_index_pattern = local/<stable-user-id>/<scope>/应用/RULE_INDEX.md
<!-- active_user_application_leaf_index_pattern 的当前独立事实为当前用户具体应用叶子索引。 -->
active_user_application_leaf_index_pattern = local/<stable-user-id>/<scope>/应用/<subproject>/RULE_INDEX.md

<!-- 最下级所属索引唯一登记规则逻辑 ID 和主规则文件；所有父索引只登记子索引入口。 -->
rule_logical_id_authority = nearest_owning_leaf_index
<!-- parent_index_must_not_duplicate_child_rule_entries 的当前独立事实为 true。 -->
parent_index_must_not_duplicate_child_rule_entries = true

<!-- 根索引直接登记冻结 core 规则、空 common 入口与动态用户入口；core 平铺指索引登记，不得移动 core 实体文件。 -->
root_index_core_registration = direct_core_rule_entries
<!-- root_index_common_registration 的当前独立事实为空 common 预留索引。 -->
root_index_common_registration = local/common/RULE_INDEX.md
<!-- root_index_active_user_registration 的当前独立事实为动态用户索引模式。 -->
root_index_active_user_registration = local/<stable-user-id>/RULE_INDEX.md
<!-- core_flattening_means_index_entries_not_file_moves 的当前独立事实为 true。 -->
core_flattening_means_index_entries_not_file_moves = true

<!-- 任一规则新增、移动、改名或删除必须更新所属叶子索引，并沿父链验证到根索引可达。 -->
hierarchical_rule_change_sync_chain = owning_leaf_index -> active_user_parent_indexes -> active_user_aggregate_index -> root_RULE_INDEX

<!-- 分层迁移期间旧目录只作为迁移输入读取；新规则和新能力不得继续写入旧布局，业务含义是过渡期不扩大待迁移范围。 -->
legacy_unlayered_rule_layout_policy = read_for_migration_only
<!-- legacy_unlayered_rule_layout_policy.2 的当前独立事实为 no_new_authoring。 -->
legacy_unlayered_rule_layout_policy.2 = no_new_authoring

<!-- 被完全替代或失去入口的规则必须删除并清理索引；适用于规则退役；业务含义是避免旧规则继续误导执行 -->
obsolete_rule_and_index_reference_must_be_removed = true

## 规则正文与可选真实材料

<!-- 当前用户大项目中的主规则文件必须位于所属通用或应用子项目的 rule 目录。 -->
active_user_rule_main_file_pattern = <project-or-subproject>/rule/RUL_<主题>规则.md

<!-- 规则需要真实辅助材料时，材料统一进入同一项目下 template 中与规则文件去扩展名同名的目录。 -->
active_user_rule_template_material_pattern = <project-or-subproject>/template/RUL_<主题>规则/

<!-- template 目录和规则同名材料目录都不是必建项；没有真实材料时不得创建空目录。 -->
active_user_rule_template_directory_policy = optional_create_only_when_verified_material_exists

<!-- template 只能收集已经存在、来源可说明且确实帮助规则稳定运行的材料，禁止为补齐结构自行生成模板、案例或素材。 -->
active_user_rule_template_material_source_policy = collect_verified_existing_material_only
<!-- active_user_rule_template_material_source_policy.2 的当前独立事实为不生成虚假材料。 -->
active_user_rule_template_material_source_policy.2 = no_synthetic_material

<!-- 无法证明材料属于哪条规则时必须停止归类并报告，禁止按文件名或目录相似度猜测。 -->
unowned_template_material_policy = report_without_guessing_or_copying

<!-- 同一真实材料被多个子项目复用时必须提升到大项目通用规则包，禁止复制二进制或维护多个版本。 -->
shared_template_material_policy = promote_to_large_project_general_rule_package
<!-- shared_template_material_policy.2 的当前独立事实为 no_duplicate_binary。 -->
shared_template_material_policy.2 = no_duplicate_binary

<!-- 需要解释材料来源、用途、使用方法或主规则入口时可以编写 README，但不得复制规则正文。 -->
active_user_rule_template_readme_policy = optional_manifest_source_usage_and_rule_entry_only

<!-- RULE_INDEX 只指向 rule 下的主规则文件，不得指向 template 材料或 README。 -->
active_user_rule_index_target_policy = rule_main_file_only
<!-- active_user_rule_index_target_policy.2 的当前独立事实为索引不得指向模板或说明文件。 -->
active_user_rule_index_target_policy.2 = no_template_or_readme_target

<!-- 跨工程通用规则是明确例外，继续直接位于其作用域根；已有真实同名材料目录可以保留，但不强制创建。 -->
cross_project_rule_layout_exception = direct_rule_file_in_cross_project_root
<!-- cross_project_rule_layout_exception.2 的当前独立事实为 optional_existing_same_name_material_directory。 -->
cross_project_rule_layout_exception.2 = optional_existing_same_name_material_directory

<!-- 当前用户规则层使用大项目、通用/应用、rule 和可选 template 结构；业务含义是未来规则经审查提升到 common 时可以保持相对分类和规则包边界。 -->
active_user_rule_layout_policy = project_general_application_rule_optional_template_structure

<!-- 用户根索引只汇总跨工程和大项目索引，具体逻辑 ID 由最下级所属索引维护。 -->
active_user_index_pattern = local/<stable-user-id>/RULE_INDEX.md -> cross-project-or-project-index -> owning-leaf-index

<!-- 用户注册表和二次执行器不是规则提升所需结构；没有多个真实程序路由需求时不得预建。 -->
active_user_program_registry_policy = create_only_for_multiple_registered_runtime_routes
<!-- active_user_program_registry_policy.2 的当前独立事实为 otherwise_direct_program_entry。 -->
active_user_program_registry_policy.2 = otherwise_direct_program_entry

<!-- 规则生成器只创建 rule 主文件和索引入口；真实材料的核验与 template 收集保持人工处理，避免程序复制或生成虚假材料。 -->
rule_generator_default_output = rule_main_file + owning_leaf_rule_index_entry
<!-- rule_generator_template_output_condition 的当前独立事实为 manual_collection_after_source_verification_only。 -->
rule_generator_template_output_condition = manual_collection_after_source_verification_only

<!-- Java、Python 和 Node 能力统一保存在 rule-engine 的对应源码根；适用于规则自动生成、检测、迁移和工具交付；业务含义是能力可被多个规则包引用且不会复制到 resources。 -->
rule_engine_ability_source_roots = ../java/com/sp/selplat/local/code/<layer>/
<!-- rule_engine_language_native_source_roots 的当前独立事实为 ../python/com/sp/selplat/local/code/<layer>/。 -->
rule_engine_language_native_source_roots = ../python/com/sp/selplat/local/code/<layer>/
<!-- rule_engine_language_native_source_roots.2 的当前独立事实为 ../node/com/sp/selplat/local/code/<layer>/。 -->
rule_engine_language_native_source_roots.2 = ../node/com/sp/selplat/local/code/<layer>/
<!-- rule_engine_legacy_non_java_migration_policy 的当前独立事实为 preserve_original_language_with_equivalence_test_or_retire_with_deletion_evidence。 -->
rule_engine_legacy_non_java_migration_policy = preserve_original_language_with_equivalence_test_or_retire_with_deletion_evidence

<!-- 每个规则正文必须显式登记可复用能力入口；未使用的语言写 none；业务含义是读取规则后可直接定位执行工具，不依赖目录猜测。 -->
rule_ability_reference_fields = java_ability_refs
<!-- rule_ability_reference_fields.2 的当前独立事实为 python_ability_refs。 -->
rule_ability_reference_fields.2 = python_ability_refs
<!-- rule_ability_reference_fields.3 的当前独立事实为 node_ability_refs。 -->
rule_ability_reference_fields.3 = node_ability_refs

<!-- 规则可以引用同一个能力，能力不得因多规则复用而复制到多个规则包；业务含义是共享实现只有一个维护位置。 -->
rule_ability_reuse_policy = multiple_rule_packages_may_reference_one_ability

<!-- 规则没有稳定、可重复且可验证的自动化职责时，不得创建空能力目录或虚假入口；业务含义是规则约束与可执行能力保持真实边界。 -->
rule_ability_creation_threshold = stable
<!-- rule_ability_creation_threshold.2 的当前独立事实为 repeated。 -->
rule_ability_creation_threshold.2 = repeated
<!-- rule_ability_creation_threshold.3 的当前独立事实为 verifiable_automation_only。 -->
rule_ability_creation_threshold.3 = verifiable_automation_only

<!-- 非法规则名、路径逃逸、覆盖既有规则、创建空模板目录或生成虚假材料时必须阻断。 -->
rule_generator_must_block = invalid_rule_name
<!-- rule_generator_must_block.2 的当前独立事实为 path_escape。 -->
rule_generator_must_block.2 = path_escape
<!-- rule_generator_must_block.3 的当前独立事实为 existing_main_overwrite。 -->
rule_generator_must_block.3 = existing_main_overwrite
<!-- rule_generator_must_block.4 的当前独立事实为 empty_template_directory。 -->
rule_generator_must_block.4 = empty_template_directory
<!-- rule_generator_must_block.5 的当前独立事实为 synthetic_material。 -->
rule_generator_must_block.5 = synthetic_material

<!-- common 旧“通用规则/应用规则”、根 rule/template、散落 docs/assets 和规则旁同名资产目录必须迁入新分类并清理旧引用。 -->
legacy_common_layout_migration_policy = move_to_general_or_application_rule_and_optional_template
<!-- legacy_common_layout_migration_policy.2 的当前独立事实为 clean_old_paths。 -->
legacy_common_layout_migration_policy.2 = clean_old_paths
