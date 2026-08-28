# SELPLAT 数据库号段与编码规则

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

<!-- 公共号段表的结构与种子数据必须分别使用固定 SQL 文件。 -->
selplat_common_sequence_sql_files = schema-CommonSequenceSegment.sql
<!-- selplat_common_sequence_sql_files.2 的当前独立事实为 data-CommonSequenceSegment.sql。 -->
selplat_common_sequence_sql_files.2 = data-CommonSequenceSegment.sql
<!-- selplat_common_sequence_sql_files.3 的当前独立事实为 owner_common_persistence。 -->
selplat_common_sequence_sql_files.3 = owner_common_persistence
<!-- 默认应用仍是一表一号段；只有中央登记显式声明全局 code 命名空间的应用，才允许全部业务表共享唯一聚合号段，保证对象类型前缀与全局 id 拼接出的 code 全局不重复且人工可辨认。 -->
selplat_business_table_sequence_cardinality = default:one_table_one_row(seqCode=<ActualTableName>Id,no_partial_seed_set)
<!-- selplat_business_table_sequence_cardinality.2 的当前独立事实为 registered_aggregate_namespace_exception。 -->
selplat_business_table_sequence_cardinality.2 = registered_aggregate_namespace_exception
<!-- selplat_business_table_sequence_cardinality.3 的当前独立事实为 shared_logical_sequence_allowed_for_no-table-object_only。 -->
selplat_business_table_sequence_cardinality.3 = shared_logical_sequence_allowed_for_no-table-object_only
<!-- selplat_business_table_sequence_cardinality.4 的当前独立事实为 reference_data_record_code_suffix_equals_own_table_id。 -->
selplat_business_table_sequence_cardinality.4 = reference_data_record_code_suffix_equals_own_table_id
<!-- 新建独立实体表的 nextStartId 统一为 100000；每表独立 seqCode 已提供命名空间，禁止再分配 200000、300000 等表类型区间。 -->
selplat_independent_table_sequence_initial_value = nextStartId=100000
<!-- selplat_independent_table_sequence_initial_value.2 的当前独立事实为 one_sequence_per_table。 -->
selplat_independent_table_sequence_initial_value.2 = one_sequence_per_table
<!-- selplat_independent_table_sequence_initial_value.3 的当前独立事实为 same_numeric_ids_across_tables_allowed。 -->
selplat_independent_table_sequence_initial_value.3 = same_numeric_ids_across_tables_allowed
<!-- selplat_independent_table_sequence_initial_value.4 的当前独立事实为 no_table_kind_numeric_partition。 -->
selplat_independent_table_sequence_initial_value.4 = no_table_kind_numeric_partition
<!-- selplat_independent_table_sequence_initial_value.5 的当前独立事实为 no_restart_cursor_reset。 -->
selplat_independent_table_sequence_initial_value.5 = no_restart_cursor_reset
<!-- 聚合全局命名空间必须登记对象类型前缀策略；关联仍依靠字段和外键，禁止解析 code 前缀推导数据库关系。 -->
selplat_aggregate_global_code_prefix_strategy = codePrefixStrategy=object-kind-plus-global-id
<!-- selplat_aggregate_global_code_prefix_strategy.2 的当前独立事实为 readable_object_kind_prefix。 -->
selplat_aggregate_global_code_prefix_strategy.2 = readable_object_kind_prefix
<!-- selplat_aggregate_global_code_prefix_strategy.3 的当前独立事实为 shared_global_id_suffix。 -->
selplat_aggregate_global_code_prefix_strategy.3 = shared_global_id_suffix
<!-- selplat_aggregate_global_code_prefix_strategy.4 的当前独立事实为 no_relationship_inference_from_prefix。 -->
selplat_aggregate_global_code_prefix_strategy.4 = no_relationship_inference_from_prefix
<!-- optionSetCode 等没有独立实体表的共享逻辑坐标允许使用 ReferenceDataObjectId；实体表 id 和 code 禁止调用该号段。 -->
selplat_shared_logical_object_sequence = ReferenceDataObjectId:optionSetCode_and_future_registered_no-table_logical_codes_only
<!-- selplat_shared_logical_object_sequence.2 的当前独立事实为 forbid_business_table_primary_key。 -->
selplat_shared_logical_object_sequence.2 = forbid_business_table_primary_key
<!-- CommonSequenceSegment 本身可使用 identity 以避免循环发号；其他业务表 id 禁止 identity，必须调用 shared SequenceGenerator。 -->
selplat_business_table_id_generation = CommonSequenceSegment_identity_exception
<!-- selplat_business_table_id_generation.2 的当前独立事实为 other_business_tables_no_identity。 -->
selplat_business_table_id_generation.2 = other_business_tables_no_identity
<!-- selplat_business_table_id_generation.3 的当前独立事实为 shared_SequenceGenerator_required。 -->
selplat_business_table_id_generation.3 = shared_SequenceGenerator_required
<!-- 显式写在 data SQL 中的固定业务主键不得超过六位，禁止重新引入 900000004003 一类脱离应用初始号段的超长编号。 -->
selplat_fixed_seed_id_maximum_digits = six_digits
<!-- selplat_fixed_seed_id_maximum_digits.2 的当前独立事实为 overlong_fixed_id_blocked_by_quick_gate。 -->
selplat_fixed_seed_id_maximum_digits.2 = overlong_fixed_id_blocked_by_quick_gate
<!-- 应用采用六位种子区时，种子与运行发号区必须分离；reference-data 保留 100001–100999，新建游标从 101000 起。 -->
selplat_seed_and_runtime_sequence_separation = seed_reserved_range
<!-- selplat_seed_and_runtime_sequence_separation.2 的当前独立事实为 runtime_nextStartId_greater_than_all_seed_ids。 -->
selplat_seed_and_runtime_sequence_separation.2 = runtime_nextStartId_greater_than_all_seed_ids
<!-- selplat_seed_and_runtime_sequence_separation.3 的当前独立事实为 no_collision。 -->
selplat_seed_and_runtime_sequence_separation.3 = no_collision
<!-- 多进程通过 versionNo 乐观锁领取互不重叠的缓存号段；允许故障产生号码空洞，禁止回退 nextStartId 或产生重复主键。 -->
selplat_sequence_multi_process_safety = optimistic_version_lock
<!-- selplat_sequence_multi_process_safety.2 的当前独立事实为 disjoint_ranges。 -->
selplat_sequence_multi_process_safety.2 = disjoint_ranges
<!-- selplat_sequence_multi_process_safety.3 的当前独立事实为 gaps_allowed。 -->
selplat_sequence_multi_process_safety.3 = gaps_allowed
<!-- selplat_sequence_multi_process_safety.4 的当前独立事实为 no_cursor_rollback。 -->
selplat_sequence_multi_process_safety.4 = no_cursor_rollback
<!-- selplat_sequence_multi_process_safety.5 的当前独立事实为 no_duplicate_id。 -->
selplat_sequence_multi_process_safety.5 = no_duplicate_id
