# SELPLAT 数据库 SQL 同步与恢复规则

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

<!-- 数据库 Schema 必须为表、列和约束提供业务注释，保证恢复材料可审查。 -->
selplat_schema_business_comment_requirement = table
<!-- selplat_schema_business_comment_requirement.2 的当前独立事实为 column。 -->
selplat_schema_business_comment_requirement.2 = column
<!-- selplat_schema_business_comment_requirement.3 的当前独立事实为 constraint。 -->
selplat_schema_business_comment_requirement.3 = constraint
<!-- selplat_schema_business_comment_requirement.4 的当前独立事实为 index。 -->
selplat_schema_business_comment_requirement.4 = index
<!-- 每张表和每个字段必须声明 COMMENT ON TABLE 与 COMMENT ON COLUMN，保证数据库元数据查询可以直接返回业务含义。 -->
selplat_database_metadata_comment_requirement = COMMENT_ON_TABLE
<!-- selplat_database_metadata_comment_requirement.2 的当前独立事实为 COMMENT_ON_COLUMN。 -->
selplat_database_metadata_comment_requirement.2 = COMMENT_ON_COLUMN
<!-- 初始化数据必须使用稳定业务坐标和 NOT EXISTS 或等价幂等条件，应用重启不得覆盖后台已经维护的名称、状态、说明或排序。 -->
selplat_seed_data_policy = stable_business_coordinate
<!-- selplat_seed_data_policy.2 的当前独立事实为 idempotent_insert。 -->
selplat_seed_data_policy.2 = idempotent_insert
<!-- selplat_seed_data_policy.3 的当前独立事实为 no_restart_overwrite。 -->
selplat_seed_data_policy.3 = no_restart_overwrite
<!-- data 文件只能按稳定坐标补充缺失行；禁止 MERGE、UPDATE、DELETE、DDL 或无 NOT EXISTS 的 INSERT。 -->
selplat_seed_sql_write_gate = insert_where_not_exists
<!-- selplat_seed_sql_write_gate.2 的当前独立事实为 read_only_noop。 -->
selplat_seed_sql_write_gate.2 = read_only_noop
<!-- selplat_seed_sql_write_gate.3 的当前独立事实为 no_merge。 -->
selplat_seed_sql_write_gate.3 = no_merge
<!-- selplat_seed_sql_write_gate.4 的当前独立事实为 no_update。 -->
selplat_seed_sql_write_gate.4 = no_update
<!-- selplat_seed_sql_write_gate.5 的当前独立事实为 no_delete。 -->
selplat_seed_sql_write_gate.5 = no_delete
<!-- selplat_seed_sql_write_gate.6 的当前独立事实为 no_ddl。 -->
selplat_seed_sql_write_gate.6 = no_ddl
<!-- 从正式数据库反向生成启动 SQL 时，必须先由中央登记唯一确认应用、数据库文件和 schemaRoot，禁止根据连接显示名猜目录。 -->
selplat_database_export_target_resolution = exact_managed_application_registry_match_no_display_name_or_working_directory_guess
<!-- 反向导出必须先完成整批表结构、主键、注释和数据校验，再生成一表一份 schema/data，禁止通过一半后留下部分新文件。 -->
selplat_database_export_prewrite_gate = complete_batch_metadata_primary_key_comment_and_data_validation_before_any_formal_file_replace
<!-- 反向导出先写同目录临时文件再原子替换，任一步失败必须恢复所有原正文并清理本轮临时文件。 -->
selplat_database_export_atomic_write = sibling_temp_files_atomic_replace_restore_all_originals_and_cleanup_on_failure
<!-- Java 或其他初始化入口必须显式登记 SQL 的业务执行顺序，禁止依赖目录遍历或文件名偶然排序。 -->
selplat_database_sql_loader_policy = explicit_ordered_resource_registry
<!-- SQL 改名、拆分、移动或删除时必须同步构建复制配置、运行加载清单、说明、调用方、测试和构建产物清理。 -->
selplat_database_sql_change_atomic_sync = build_copy
<!-- selplat_database_sql_change_atomic_sync.2 的当前独立事实为 loader_registry。 -->
selplat_database_sql_change_atomic_sync.2 = loader_registry
<!-- selplat_database_sql_change_atomic_sync.3 的当前独立事实为 documentation。 -->
selplat_database_sql_change_atomic_sync.3 = documentation
<!-- selplat_database_sql_change_atomic_sync.4 的当前独立事实为 callers。 -->
selplat_database_sql_change_atomic_sync.4 = callers
<!-- selplat_database_sql_change_atomic_sync.5 的当前独立事实为 tests。 -->
selplat_database_sql_change_atomic_sync.5 = tests
<!-- selplat_database_sql_change_atomic_sync.6 的当前独立事实为 stale_build_resource_cleanup。 -->
selplat_database_sql_change_atomic_sync.6 = stale_build_resource_cleanup
<!-- 连接、Window 等缺失后必须自动恢复的配置表由中央登记显式列出；每张表必须同时有幂等 data SQL 与生产初始化加载。 -->
selplat_database_recovery_configuration_sync_gate = central_registry_startupRecoveryTables
<!-- selplat_database_recovery_configuration_sync_gate.2 的当前独立事实为 data_<table>_required。 -->
selplat_database_recovery_configuration_sync_gate.2 = data_<table>_required
<!-- selplat_database_recovery_configuration_sync_gate.3 的当前独立事实为 production_loader_required。 -->
selplat_database_recovery_configuration_sync_gate.3 = production_loader_required
<!-- selplat_database_recovery_configuration_sync_gate.4 的当前独立事实为 insert_missing_only。 -->
selplat_database_recovery_configuration_sync_gate.4 = insert_missing_only
<!-- selplat_database_recovery_configuration_sync_gate.5 的当前独立事实为 contract_test_required。 -->
selplat_database_recovery_configuration_sync_gate.5 = contract_test_required
<!-- 用户作答、操作历史等持续增长的运行数据不是启动种子；它们依靠正式 mv.db 与备份恢复，禁止启动时反向覆盖。 -->
selplat_runtime_business_data_recovery_boundary = authoritative_mvdb_and_backup
<!-- selplat_runtime_business_data_recovery_boundary.2 的当前独立事实为 no_startup_seed_export。 -->
selplat_runtime_business_data_recovery_boundary.2 = no_startup_seed_export
<!-- selplat_runtime_business_data_recovery_boundary.3 的当前独立事实为 no_restart_overwrite。 -->
selplat_runtime_business_data_recovery_boundary.3 = no_restart_overwrite
