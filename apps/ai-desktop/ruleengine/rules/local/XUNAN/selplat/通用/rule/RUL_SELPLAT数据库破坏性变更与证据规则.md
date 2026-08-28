# SELPLAT 数据库破坏性变更与证据规则

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

selplat_database_destructive_change_precheck = resolve_exact_target
<!-- selplat_database_destructive_change_precheck.2 的当前独立事实为 read_only_schema_check。 -->
selplat_database_destructive_change_precheck.2 = read_only_schema_check
<!-- selplat_database_destructive_change_precheck.3 的当前独立事实为 row_count_check。 -->
selplat_database_destructive_change_precheck.3 = row_count_check
<!-- selplat_database_destructive_change_precheck.4 的当前独立事实为 preserve_or_migrate_data。 -->
selplat_database_destructive_change_precheck.4 = preserve_or_migrate_data
<!-- 删除建表 SQL 不会清除持久数据库中的既有表；废弃表必须由兼容迁移固定白名单处理，先验证全部为空，再统一删除，任一非空时不得发生部分清理。 -->
selplat_deprecated_table_cleanup = compatibility_migration_fixed_allowlist
<!-- selplat_deprecated_table_cleanup.2 的当前独立事实为 validate_all_row_counts_first。 -->
selplat_deprecated_table_cleanup.2 = validate_all_row_counts_first
<!-- selplat_deprecated_table_cleanup.3 的当前独立事实为 any_nonempty_blocks_all_drops。 -->
selplat_deprecated_table_cleanup.3 = any_nonempty_blocks_all_drops
<!-- selplat_deprecated_table_cleanup.4 的当前独立事实为 empty_tables_drop_idempotently。 -->
selplat_deprecated_table_cleanup.4 = empty_tables_drop_idempotently
<!-- selplat_deprecated_table_cleanup.5 的当前独立事实为 no_schema_startup_drop。 -->
selplat_deprecated_table_cleanup.5 = no_schema_startup_drop
<!-- 自动化测试只能使用内存库或临时目录中的可重建隔离数据库，禁止读写 apps/<app>/db/<app>.mv.db 正式文件。 -->
selplat_database_test_isolation = memory_or_temporary_database_only
<!-- schema 变更必须覆盖新库首次初始化、重复初始化和旧库兼容升级；存在种子数据时还必须验证重复执行后稳定坐标仍只有一条。 -->
selplat_database_schema_test_matrix = fresh_initialization
<!-- selplat_database_schema_test_matrix.2 的当前独立事实为 repeated_initialization。 -->
selplat_database_schema_test_matrix.2 = repeated_initialization
<!-- selplat_database_schema_test_matrix.3 的当前独立事实为 legacy_upgrade。 -->
selplat_database_schema_test_matrix.3 = legacy_upgrade
<!-- selplat_database_schema_test_matrix.4 的当前独立事实为 seed_idempotency_when_seed_exists。 -->
selplat_database_schema_test_matrix.4 = seed_idempotency_when_seed_exists
<!-- 删除数据库文件后必须能只靠登记 SQL 重建；已有文件重复启动必须保留业务记录和号段游标。 -->
selplat_database_rebuild_and_reopen_contract = missing_file_rebuild_from_sql
<!-- selplat_database_rebuild_and_reopen_contract.2 的当前独立事实为 existing_file_no_reset。 -->
selplat_database_rebuild_and_reopen_contract.2 = existing_file_no_reset
<!-- selplat_database_rebuild_and_reopen_contract.3 的当前独立事实为 preserve_business_rows。 -->
selplat_database_rebuild_and_reopen_contract.3 = preserve_business_rows
<!-- selplat_database_rebuild_and_reopen_contract.4 的当前独立事实为 preserve_sequence_cursor。 -->
selplat_database_rebuild_and_reopen_contract.4 = preserve_sequence_cursor
<!-- selplat_database_rebuild_and_reopen_contract.5 的当前独立事实为 compatible_upgrade_only。 -->
selplat_database_rebuild_and_reopen_contract.5 = compatible_upgrade_only
<!-- 控件状态采用显式保存时，数据库只保留真实读取并控制行为的几何字段；rememberLastState 等不参与决策的记忆开关必须删除。 -->
selplat_explicit_control_state_schema = explicit_save_only
<!-- selplat_explicit_control_state_schema.2 的当前独立事实为 geometry_fields_have_runtime_reader。 -->
selplat_explicit_control_state_schema.2 = geometry_fields_have_runtime_reader
<!-- selplat_explicit_control_state_schema.3 的当前独立事实为 no_redundant_remember_flag。 -->
selplat_explicit_control_state_schema.3 = no_redundant_remember_flag
<!-- 字段删除必须同步 Repository、Service、Controller、前端表格、筛选、表单、接口示例和测试，禁止留下只展示或只保存的残余引用。 -->
selplat_database_field_removal_sync = repository
<!-- selplat_database_field_removal_sync.2 的当前独立事实为 service。 -->
selplat_database_field_removal_sync.2 = service
<!-- selplat_database_field_removal_sync.3 的当前独立事实为 controller。 -->
selplat_database_field_removal_sync.3 = controller
<!-- selplat_database_field_removal_sync.4 的当前独立事实为 frontend_grid。 -->
selplat_database_field_removal_sync.4 = frontend_grid
<!-- selplat_database_field_removal_sync.5 的当前独立事实为 filter。 -->
selplat_database_field_removal_sync.5 = filter
<!-- selplat_database_field_removal_sync.6 的当前独立事实为 form。 -->
selplat_database_field_removal_sync.6 = form
<!-- selplat_database_field_removal_sync.7 的当前独立事实为 api_examples。 -->
selplat_database_field_removal_sync.7 = api_examples
<!-- selplat_database_field_removal_sync.8 的当前独立事实为 tests。 -->
selplat_database_field_removal_sync.8 = tests
<!-- 完成证据必须包含真实 SQL 执行结果、数据库元数据、业务记录保留数量、受影响测试结果和存在页面变化时的视觉终审。 -->
selplat_database_change_completion_evidence = sql_execution
<!-- selplat_database_change_completion_evidence.2 的当前独立事实为 database_metadata。 -->
selplat_database_change_completion_evidence.2 = database_metadata
<!-- selplat_database_change_completion_evidence.3 的当前独立事实为 preserved_record_count。 -->
selplat_database_change_completion_evidence.3 = preserved_record_count
<!-- selplat_database_change_completion_evidence.4 的当前独立事实为 relevant_test_results。 -->
selplat_database_change_completion_evidence.4 = relevant_test_results
<!-- selplat_database_change_completion_evidence.5 的当前独立事实为 visual_review_when_applicable。 -->
selplat_database_change_completion_evidence.5 = visual_review_when_applicable
