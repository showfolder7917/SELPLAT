# SELPLAT 数据库 Schema 与表模型规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 2.18.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 本职责没有独立 Java 能力入口。 -->
java_ability_refs = none
<!-- 本职责没有独立 Python 能力入口。 -->
python_ability_refs = none
<!-- 本职责没有独立 Node 能力入口。 -->
node_ability_refs = none

<!-- 每个正式表使用与真实表名一致的独立 schema SQL 文件。 -->
selplat_schema_sql_filename_pattern = schema-<ActualTableName>.sql
<!-- 表存在初始化数据时必须使用 data-实际表名.sql；没有种子数据的空业务表可以不创建空 data 文件。 -->
selplat_data_sql_filename_pattern = data-<ActualTableName>.sql
<!-- data 文件只表达真实种子数据；缺少 data 文件表示首次建库保持空表，不得为满足目录对称生成无意义空文件。 -->
selplat_optional_seed_data_file_policy = required_when_seed_rows_exist
<!-- selplat_optional_seed_data_file_policy.2 的当前独立事实为 absent_means_empty_initial_table。 -->
selplat_optional_seed_data_file_policy.2 = absent_means_empty_initial_table
<!-- selplat_optional_seed_data_file_policy.3 的当前独立事实为 no_empty_placeholder_file。 -->
selplat_optional_seed_data_file_policy.3 = no_empty_placeholder_file
<!-- 一个 schema 文件只允许创建文件名对应的一张正式业务表，禁止使用 tables.sql 或 create_*_tables.sql 聚合多张表。 -->
selplat_schema_sql_single_formal_table_policy = one_schema_file_creates_exactly_one_named_formal_table
<!-- 一个 data 文件只允许初始化文件名对应表的数据，禁止把多个无关表的种子数据混入同一文件。 -->
selplat_data_sql_single_target_table_policy = one_data_file_initializes_exactly_one_named_table
<!-- schema 文件只允许幂等建表、幂等索引、注释和带存在性条件的兼容 ALTER；启动脚本禁止删除表或清空数据。 -->
selplat_schema_sql_allowed_same_target_operations = create_table_if_not_exists
<!-- selplat_schema_sql_allowed_same_target_operations.2 的当前独立事实为 index_if_not_exists。 -->
selplat_schema_sql_allowed_same_target_operations.2 = index_if_not_exists
<!-- selplat_schema_sql_allowed_same_target_operations.3 的当前独立事实为 comment。 -->
selplat_schema_sql_allowed_same_target_operations.3 = comment
<!-- selplat_schema_sql_allowed_same_target_operations.4 的当前独立事实为 idempotent_compatible_alter。 -->
selplat_schema_sql_allowed_same_target_operations.4 = idempotent_compatible_alter
<!-- selplat_schema_sql_allowed_same_target_operations.5 的当前独立事实为 no_drop_table。 -->
selplat_schema_sql_allowed_same_target_operations.5 = no_drop_table
<!-- selplat_schema_sql_allowed_same_target_operations.6 的当前独立事实为 no_truncate。 -->
selplat_schema_sql_allowed_same_target_operations.6 = no_truncate
<!-- selplat_schema_sql_allowed_same_target_operations.7 的当前独立事实为 no_delete。 -->
selplat_schema_sql_allowed_same_target_operations.7 = no_delete
<!-- 已存在的旧式 schema-<app>.sql 不得因规则建立被自动批量拆分；只有用户明确提出迁移时才按本规则重构并完成兼容验证。 -->
selplat_legacy_application_schema_migration_policy = preserve_until_explicit_migration_request_then_refactor_with_compatibility_verification

## 表与字段职责

<!-- 每张正式表必须表达单一业务职责；ReferenceDataType 保存分类与多语言目录，ReferenceDataTreeNode 仅通过自身 code 与 parentId 保存独立父子树。 -->
selplat_database_table_single_business_responsibility = type_catalog_classification_and_localized_names
<!-- selplat_database_table_single_business_responsibility.2 的当前独立事实为 tree_node_independent_code_plus_parent_id。 -->
selplat_database_table_single_business_responsibility.2 = tree_node_independent_code_plus_parent_id
<!-- selplat_database_table_single_business_responsibility.3 的当前独立事实为 no_type_foreign_key。 -->
selplat_database_table_single_business_responsibility.3 = no_type_foreign_key
<!-- selplat_database_table_single_business_responsibility.4 的当前独立事实为 no_dropdown_or_menu_detail_in_tree_table。 -->
selplat_database_table_single_business_responsibility.4 = no_dropdown_or_menu_detail_in_tree_table
<!-- selplat_database_table_single_business_responsibility.5 的当前独立事实为 separate_table_only_for_distinct_lifecycle_or_constraints。 -->
selplat_database_table_single_business_responsibility.5 = separate_table_only_for_distinct_lifecycle_or_constraints
<!-- 类型目录表通过 optionSetCode 建立可复用选项组，以 valueCode 保存真实业务值，并只允许 parentTypeCode 指向同组选项。 -->
selplat_type_catalog_required_responsibility = table_record_code
<!-- selplat_type_catalog_required_responsibility.2 的当前独立事实为 optionSetCode_shared_logical_group。 -->
selplat_type_catalog_required_responsibility.2 = optionSetCode_shared_logical_group
<!-- selplat_type_catalog_required_responsibility.3 的当前独立事实为 valueCode。 -->
selplat_type_catalog_required_responsibility.3 = valueCode
<!-- selplat_type_catalog_required_responsibility.4 的当前独立事实为 parentTypeCode_same_option_set_hierarchy。 -->
selplat_type_catalog_required_responsibility.4 = parentTypeCode_same_option_set_hierarchy
<!-- selplat_type_catalog_required_responsibility.5 的当前独立事实为 localized_names。 -->
selplat_type_catalog_required_responsibility.5 = localized_names
<!-- selplat_type_catalog_required_responsibility.6 的当前独立事实为 status。 -->
selplat_type_catalog_required_responsibility.6 = status
<!-- selplat_type_catalog_required_responsibility.7 的当前独立事实为 sort。 -->
selplat_type_catalog_required_responsibility.7 = sort
<!-- selplat_type_catalog_required_responsibility.8 的当前独立事实为 audit。 -->
selplat_type_catalog_required_responsibility.8 = audit
<!-- selplat_type_catalog_required_responsibility.9 的当前独立事实为 no_project_page_duplication。 -->
selplat_type_catalog_required_responsibility.9 = no_project_page_duplication
<!-- selplat_type_catalog_required_responsibility.10 的当前独立事实为 no_controlCode。 -->
selplat_type_catalog_required_responsibility.10 = no_controlCode
<!-- selplat_type_catalog_required_responsibility.11 的当前独立事实为 no_categoryCode。 -->
selplat_type_catalog_required_responsibility.11 = no_categoryCode
<!-- selplat_type_catalog_required_responsibility.12 的当前独立事实为 no_ControlLayout_typeId。 -->
selplat_type_catalog_required_responsibility.12 = no_ControlLayout_typeId
<!-- TREE 是独立树表职责，不得作为 Type.valueCode；历史误入记录按明确不兼容策略物理删除。 -->
selplat_reference_data_type_reserved_values = TREE:forbidden_and_physical_cleanup
<!-- selplat_reference_data_type_reserved_values.2 的当前独立事实为 tree_data_only_in_ReferenceDataTreeNode。 -->
selplat_reference_data_type_reserved_values.2 = tree_data_only_in_ReferenceDataTreeNode
<!-- 树节点表维护系统 code、展示归属、parentId、节点业务值、多语言标签、状态、排序和审计信息；归属坐标不得参与树关系，且禁止重新加入类型外键、业务别名或无调用扩展桶。 -->
selplat_tree_node_table_required_responsibility = global_code
<!-- selplat_tree_node_table_required_responsibility.2 的当前独立事实为 projectCode_and_pageCode_attribution_only。 -->
selplat_tree_node_table_required_responsibility.2 = projectCode_and_pageCode_attribution_only
<!-- selplat_tree_node_table_required_responsibility.3 的当前独立事实为 parent_id。 -->
selplat_tree_node_table_required_responsibility.3 = parent_id
<!-- selplat_tree_node_table_required_responsibility.4 的当前独立事实为 node_value。 -->
selplat_tree_node_table_required_responsibility.4 = node_value
<!-- selplat_tree_node_table_required_responsibility.5 的当前独立事实为 localized_labels。 -->
selplat_tree_node_table_required_responsibility.5 = localized_labels
<!-- selplat_tree_node_table_required_responsibility.6 的当前独立事实为 status。 -->
selplat_tree_node_table_required_responsibility.6 = status
<!-- selplat_tree_node_table_required_responsibility.7 的当前独立事实为 sort。 -->
selplat_tree_node_table_required_responsibility.7 = sort
<!-- selplat_tree_node_table_required_responsibility.8 的当前独立事实为 audit。 -->
selplat_tree_node_table_required_responsibility.8 = audit
<!-- selplat_tree_node_table_required_responsibility.9 的当前独立事实为 tree_relation_code_plus_parentId。 -->
selplat_tree_node_table_required_responsibility.9 = tree_relation_code_plus_parentId
<!-- selplat_tree_node_table_required_responsibility.10 的当前独立事实为 no_type_reference。 -->
selplat_tree_node_table_required_responsibility.10 = no_type_reference
<!-- selplat_tree_node_table_required_responsibility.11 的当前独立事实为 no_node_code_alias。 -->
selplat_tree_node_table_required_responsibility.11 = no_node_code_alias
<!-- selplat_tree_node_table_required_responsibility.12 的当前独立事实为 no_attributes_bucket。 -->
selplat_tree_node_table_required_responsibility.12 = no_attributes_bucket
<!-- 用户明确废弃且不兼容的字段和记录必须从结构、正式库、查询、表单和测试同步物理删除；禁止以 SELECT 字段白名单长期掩盖旧列。 -->
selplat_confirmed_deprecated_data_and_field_cleanup = physical_delete_records_and_columns
<!-- selplat_confirmed_deprecated_data_and_field_cleanup.2 的当前独立事实为 schema_and_runtime_database_sync。 -->
selplat_confirmed_deprecated_data_and_field_cleanup.2 = schema_and_runtime_database_sync
<!-- selplat_confirmed_deprecated_data_and_field_cleanup.3 的当前独立事实为 restore_real_table_structure_query。 -->
selplat_confirmed_deprecated_data_and_field_cleanup.3 = restore_real_table_structure_query
<!-- selplat_confirmed_deprecated_data_and_field_cleanup.4 的当前独立事实为 no_long_term_projection_compatibility。 -->
selplat_confirmed_deprecated_data_and_field_cleanup.4 = no_long_term_projection_compatibility
<!-- 新增数据库字段前必须识别真实读取、写入和控制调用链；只有保存但不参与业务行为的配置字段不得进入正式表。 -->
selplat_database_field_requires_real_call_chain = write_path
<!-- selplat_database_field_requires_real_call_chain.2 的当前独立事实为 read_path。 -->
selplat_database_field_requires_real_call_chain.2 = read_path
<!-- selplat_database_field_requires_real_call_chain.3 的当前独立事实为 business_effect。 -->
selplat_database_field_requires_real_call_chain.3 = business_effect
<!-- selplat_database_field_requires_real_call_chain.4 的当前独立事实为 tests。 -->
selplat_database_field_requires_real_call_chain.4 = tests
<!-- 受管业务表的通用物理字段顺序固定为主键、公开 code、身份、业务字段、状态排序和时间，新增字段不得随意追加到审计时间之后。 -->
selplat_managed_business_table_physical_column_order = id
<!-- selplat_managed_business_table_physical_column_order.2 的当前独立事实为 code。 -->
selplat_managed_business_table_physical_column_order.2 = code
<!-- selplat_managed_business_table_physical_column_order.3 的当前独立事实为 tenantId。 -->
selplat_managed_business_table_physical_column_order.3 = tenantId
<!-- selplat_managed_business_table_physical_column_order.4 的当前独立事实为 lastOperateUserId。 -->
selplat_managed_business_table_physical_column_order.4 = lastOperateUserId
<!-- selplat_managed_business_table_physical_column_order.5 的当前独立事实为 business_fields。 -->
selplat_managed_business_table_physical_column_order.5 = business_fields
<!-- selplat_managed_business_table_physical_column_order.6 的当前独立事实为 status。 -->
selplat_managed_business_table_physical_column_order.6 = status
<!-- selplat_managed_business_table_physical_column_order.7 的当前独立事实为 sortnum。 -->
selplat_managed_business_table_physical_column_order.7 = sortnum
<!-- selplat_managed_business_table_physical_column_order.8 的当前独立事实为 createdAt。 -->
selplat_managed_business_table_physical_column_order.8 = createdAt
<!-- selplat_managed_business_table_physical_column_order.9 的当前独立事实为 updatedAt。 -->
selplat_managed_business_table_physical_column_order.9 = updatedAt
<!-- ReferenceDataType 的业务字段顺序固定为控件归属、类型值、父级和中日英名称，查询台与页面使用同一可读顺序。 -->
selplat_reference_data_type_physical_column_order = id
<!-- selplat_reference_data_type_physical_column_order.2 的当前独立事实为 code。 -->
selplat_reference_data_type_physical_column_order.2 = code
<!-- selplat_reference_data_type_physical_column_order.3 的当前独立事实为 tenantId。 -->
selplat_reference_data_type_physical_column_order.3 = tenantId
<!-- selplat_reference_data_type_physical_column_order.4 的当前独立事实为 lastOperateUserId。 -->
selplat_reference_data_type_physical_column_order.4 = lastOperateUserId
<!-- selplat_reference_data_type_physical_column_order.5 的当前独立事实为 optionSetCode。 -->
selplat_reference_data_type_physical_column_order.5 = optionSetCode
<!-- selplat_reference_data_type_physical_column_order.6 的当前独立事实为 valueCode。 -->
selplat_reference_data_type_physical_column_order.6 = valueCode
<!-- selplat_reference_data_type_physical_column_order.7 的当前独立事实为 parentTypeCode。 -->
selplat_reference_data_type_physical_column_order.7 = parentTypeCode
<!-- selplat_reference_data_type_physical_column_order.8 的当前独立事实为 nameZh。 -->
selplat_reference_data_type_physical_column_order.8 = nameZh
<!-- selplat_reference_data_type_physical_column_order.9 的当前独立事实为 nameJa。 -->
selplat_reference_data_type_physical_column_order.9 = nameJa
<!-- selplat_reference_data_type_physical_column_order.10 的当前独立事实为 nameEn。 -->
selplat_reference_data_type_physical_column_order.10 = nameEn
<!-- selplat_reference_data_type_physical_column_order.11 的当前独立事实为 status。 -->
selplat_reference_data_type_physical_column_order.11 = status
<!-- selplat_reference_data_type_physical_column_order.12 的当前独立事实为 sortnum。 -->
selplat_reference_data_type_physical_column_order.12 = sortnum
<!-- selplat_reference_data_type_physical_column_order.13 的当前独立事实为 createdAt。 -->
selplat_reference_data_type_physical_column_order.13 = createdAt
<!-- selplat_reference_data_type_physical_column_order.14 的当前独立事实为 updatedAt。 -->
selplat_reference_data_type_physical_column_order.14 = updatedAt
