# SELPLAT 数据库 SQL 文件结构与命名规则

<!-- 当前规则不需要 Java 专用能力；应用现有数据库初始化器和测试任务直接承担执行验证。 -->
java_ability_refs = none
<!-- 当前规则不需要 Python 专用能力；目录、文件名和 SQL 引用可由现有检索与构建入口验证。 -->
python_ability_refs = none
<!-- 当前规则不需要 Node 专用能力；Node 只在受影响前端字段同步时使用现有语法检查。 -->
node_ability_refs = none
<!-- 首版规则固化 reference-data 重构中已经验证的 SQL 目录和单表文件约束。 -->
rule_version = 2.2.0
<!-- 规则所有者始终来自工程根 AGENTS.md 的当前稳定用户声明，未经人工提升不得扩大到 common。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示规则已完成索引登记、真实案例核对和索引链验证。 -->
rule_status = active
<!-- 首次升级记录说明规则来自用户对 dataShape、混合建表文件和错误命名的连续修正。 -->
upgrade_record = 2026-08-07:根据reference-data数据库重构建立SQL目录_单表文件_职责分离_注释与隔离验证规则;2026-08-07:移除具体用户前缀并通过AGENTS动态解析规则所有者;2026-08-10:权威数据库统一到db根_业务表按TableNameId一表一号段_CommonSequenceSegment自身保留identity避免循环依赖;2026-08-10:严格本地数据库应用默认账号统一为sa_默认密码统一为123456_测试必须显式隔离覆盖;2026-08-10:数据库应用路径_结构_号段策略和数据源前缀统一进入当前用户中央登记_业务工程不再保存受管隐藏文件;2026-08-10:H2忽略规则统一迁移到SELPLAT根_数据库应用禁止嵌套gitignore;2026-08-10:固化缺库SQL重建_已有库幂等升级_禁止启动脚本删除清空覆盖和MERGE种子;2026-08-10:正式apps数据库改为Git可提交_仅忽略H2运行副产物;2026-08-10:移除根mvdb通配忽略_保证编辑器显示所有正式数据库;2026-08-10:删除MDA嵌套gitignore_before备份规则迁移到根_全模块统一禁止嵌套;2026-08-11:数据库反向导出必须中央登记匹配_完整批次门禁_临时文件原子替换与失败恢复;2026-08-11:删除按项目选择structure的专属架构开关_所有受管应用统一采用真实表业务_无状态能力_common三类职责;2026-08-11:固定初始化主键不得超过六位_reference-data统一六位种子保留区并让运行号段从下一完整区间开始

<!-- 问题：数据库脚本使用含义模糊的 tables 或 migration 文件名、一个文件创建多张正式表、类型表混入树或选项能力字段时，后续维护者无法从目录和文件名判断真实职责。 -->
<!-- 场景：当前稳定用户在 SELPLAT 中新建、迁移、拆分、改名或审查 apps/<app> 的应用自有数据库和 SQL。 -->
<!-- 业务含义：数据库文件、表名和代码调用保持一一可追踪，类型、树、选项等不同数据职责不会重新混入同一张表或同一个建表文件。 -->

## 规则包组成

<!-- 本规则的格式由 DSL 本身和文件命名模式直接固定，没有独立可复用成品模板，禁止为补齐目录生成空模板。 -->
template_not_applicable_reason = sql_layout_and_filename_patterns_are_fully_declared_in_rule_no_separate_artifact_template
<!-- reference-data 已完成真实数据库升级、回归和页面验证，可作为规则首个已核验正确案例。 -->
verified_example_refs = apps/reference-data/db/sql/schema-CommonSequenceSegment.sql,apps/reference-data/db/sql/data-CommonSequenceSegment.sql,apps/reference-data/db/sql/schema-ReferenceDataType.sql,apps/reference-data/db/sql/schema-ReferenceDataTreeNode.sql,apps/reference-data/db/sql/data-ReferenceDataType.sql,apps/reference-data/db/README.md
<!-- 当前验证复用应用数据库初始化器、Gradle 测试和 SQL 元数据查询，不重复建设只包装命令的专用程序。 -->
program_not_applicable_reason = existing_application_initializer_gradle_tests_and_database_metadata_queries_provide_repeatable_verification
<!-- 交付时必须同时验证目录结构、文件与表名映射、加载清单、隔离数据库执行和调用方字段引用。 -->
verification_scope = directory_layout,filename_table_mapping,loader_registry,isolated_database_execution,caller_field_references,relevant_tests

## 数据库目录边界

<!-- 应用拥有并跨重启长期保存的本地权威数据库必须直接位于应用 db 根，文件名固定为应用名，禁止建立 db/data 或其他平行运行目录。 -->
selplat_application_authoritative_database_root = apps/<app>/db/<app>.mv.db
<!-- 应用权威数据库使用的结构和初始化 SQL 统一位于 db/sql，运行数据库文件不得进入 sql。 -->
selplat_application_database_sql_root = apps/<app>/db/sql
<!-- db 目录只允许保存唯一正式数据库、sql 和说明；忽略规则统一位于 SELPLAT 根，禁止在应用内散落 .gitignore。 -->
selplat_application_database_directory_allowed_content = <app>.mv.db,sql,README.md,no_nested_gitignore
<!-- SELPLAT 根不得使用 mv.db 通配忽略规则，保证正式数据库在工程视图显示并可提交；只排除 trace、lock、temp。 -->
selplat_h2_gitignore_ownership = SELPLAT_root_only,no_mvdb_ignore_pattern,all_mvdb_visible_and_trackable,trace_ignored,lock_ignored,temp_ignored,before_backup_ignored,no_nested_gitignore_any_module
<!-- 严格本地数据库应用必须在当前用户中央登记中声明 datasourcePrefix，正式模块属性按该前缀唯一登记 sa 与 123456。 -->
selplat_managed_local_database_default_credentials = datasourcePrefix_required,username=sa,password=123456,exactly_once
<!-- 数据库应用的 SQL 根、数据库位置、主键策略和数据源前缀只在 rule-engine 当前用户中央登记维护；架构不可配置，避免任何项目通过登记选择专属结构。 -->
selplat_managed_database_central_registration = projectName,schemaRoot,databaseFile,primaryKeyStrategy,datasourcePrefix,no_structure_switch,no_application_local_managed_marker
<!-- 所有受管应用统一使用三类职责：真实表业务一表一目录、无状态能力进入 capability、复用实现进入 common；禁止项目名分支和专属豁免。 -->
selplat_managed_database_uniform_architecture = table_business:<table-business>/controller|service|dao,non_persistent_capability:capability/<capability>/controller|service,reusable_implementation:common/config|persistence|util,no_project_specific_structure,no_project_name_bypass
<!-- 空密码只允许测试属性在内存库或临时库中显式覆盖，正式模块属性禁止为空。 -->
selplat_database_empty_password_boundary = production_forbidden,test_isolated_override_allowed

## SQL 文件命名与单表职责

<!-- 正式表结构文件必须使用 schema-实际表名.sql，文件名中的表名大小写与 CREATE TABLE 实际表名完全一致。 -->
selplat_schema_sql_filename_pattern = schema-<ActualTableName>.sql
<!-- 初始化数据文件必须使用 data-实际表名.sql，文件名中的表名大小写与 INSERT 目标表名完全一致。 -->
selplat_data_sql_filename_pattern = data-<ActualTableName>.sql
<!-- 一个 schema 文件只允许创建文件名对应的一张正式业务表，禁止使用 tables.sql 或 create_*_tables.sql 聚合多张表。 -->
selplat_schema_sql_single_formal_table_policy = one_schema_file_creates_exactly_one_named_formal_table
<!-- 一个 data 文件只允许初始化文件名对应表的数据，禁止把多个无关表的种子数据混入同一文件。 -->
selplat_data_sql_single_target_table_policy = one_data_file_initializes_exactly_one_named_table
<!-- schema 文件只允许幂等建表、幂等索引、注释和带存在性条件的兼容 ALTER；启动脚本禁止删除表或清空数据。 -->
selplat_schema_sql_allowed_same_target_operations = create_table_if_not_exists,index_if_not_exists,comment,idempotent_compatible_alter,no_drop_table,no_truncate,no_delete
<!-- 已存在的旧式 schema-<app>.sql 不得因规则建立被自动批量拆分；只有用户明确提出迁移时才按本规则重构并完成兼容验证。 -->
selplat_legacy_application_schema_migration_policy = preserve_until_explicit_migration_request_then_refactor_with_compatibility_verification

## 表与字段职责

<!-- 每张正式表必须表达单一业务职责，类型目录、树节点、普通选项和其他资源不得因共享部分字段而混入同一张表。 -->
selplat_database_table_single_business_responsibility = type_catalog,tree_node,option_item,and_other_resources_remain_separate
<!-- 类型目录表只维护类型坐标、名称、说明、状态、排序和审计信息，不得保存没有真实查询控制链路的输出形态或界面展示字段。 -->
selplat_type_catalog_forbidden_unenforced_capability_fields = dataShape,tree_or_option_display_only_flags,other_fields_without_runtime_enforcement
<!-- 树节点表只维护类型归属、父子关系、节点稳定值、多语言标签、扩展属性、状态、排序和审计信息。 -->
selplat_tree_node_table_required_responsibility = type_reference,parent_reference,node_code,node_value,localized_labels,attributes,status,sort,audit
<!-- 新增数据库字段前必须识别真实读取、写入和控制调用链；只有保存但不参与业务行为的配置字段不得进入正式表。 -->
selplat_database_field_requires_real_call_chain = write_path,read_path,business_effect,tests

## 主键号段

<!-- 严格数据库业务应用必须提供 CommonSequenceSegment 的独立结构与初始化数据脚本，由 common/persistence 绑定当前应用私有数据源。 -->
selplat_common_sequence_sql_files = schema-CommonSequenceSegment.sql,data-CommonSequenceSegment.sql,owner_common_persistence
<!-- 号段数据脚本允许整体为空并由管理员逐条建立；一旦预置任一号段，就必须完整覆盖每张非 Common 业务表且禁止多表共享号段。 -->
selplat_business_table_sequence_cardinality = fully_empty_for_manual_setup_or_one_table_one_row,seqCode=<ActualTableName>Id,no_shared_business_sequence,no_partial_seed_set
<!-- CommonSequenceSegment 本身可使用 identity 以避免循环发号；其他业务表 id 禁止 identity，必须调用 shared SequenceGenerator。 -->
selplat_business_table_id_generation = CommonSequenceSegment_identity_exception,other_business_tables_no_identity,shared_SequenceGenerator_required
<!-- 显式写在 data SQL 中的固定业务主键不得超过六位，禁止重新引入 900000004003 一类脱离应用初始号段的超长编号。 -->
selplat_fixed_seed_id_maximum_digits = six_digits,overlong_fixed_id_blocked_by_quick_gate
<!-- 应用采用六位种子区时，种子与运行发号区必须分离；reference-data 保留 100001–100999，新建游标从 101000 起。 -->
selplat_seed_and_runtime_sequence_separation = seed_reserved_range,runtime_nextStartId_greater_than_all_seed_ids,no_collision
<!-- 多进程通过 versionNo 乐观锁领取互不重叠的缓存号段；允许故障产生号码空洞，禁止回退 nextStartId 或产生重复主键。 -->
selplat_sequence_multi_process_safety = optimistic_version_lock,disjoint_ranges,gaps_allowed,no_cursor_rollback,no_duplicate_id

## 注释、初始化和加载

<!-- 每张表和每个字段必须在定义旁写中文业务注释，约束与索引必须说明取值、唯一性、关联或查询原因，禁止只复述 SQL 语法。 -->
selplat_schema_business_comment_requirement = table,column,constraint,index
<!-- 每张表和每个字段必须声明 COMMENT ON TABLE 与 COMMENT ON COLUMN，保证数据库元数据查询可以直接返回业务含义。 -->
selplat_database_metadata_comment_requirement = COMMENT_ON_TABLE,COMMENT_ON_COLUMN
<!-- 初始化数据必须使用稳定业务坐标和 NOT EXISTS 或等价幂等条件，应用重启不得覆盖后台已经维护的名称、状态、说明或排序。 -->
selplat_seed_data_policy = stable_business_coordinate,idempotent_insert,no_restart_overwrite
<!-- data 文件只能按稳定坐标补充缺失行；禁止 MERGE、UPDATE、DELETE、DDL 或无 NOT EXISTS 的 INSERT。 -->
selplat_seed_sql_write_gate = insert_where_not_exists,read_only_noop,no_merge,no_update,no_delete,no_ddl
<!-- 从正式数据库反向生成启动 SQL 时，必须先由中央登记唯一确认应用、数据库文件和 schemaRoot，禁止根据连接显示名猜目录。 -->
selplat_database_export_target_resolution = exact_managed_application_registry_match_no_display_name_or_working_directory_guess
<!-- 反向导出必须先完成整批表结构、主键、注释和数据校验，再生成一表一份 schema/data，禁止通过一半后留下部分新文件。 -->
selplat_database_export_prewrite_gate = complete_batch_metadata_primary_key_comment_and_data_validation_before_any_formal_file_replace
<!-- 反向导出先写同目录临时文件再原子替换，任一步失败必须恢复所有原正文并清理本轮临时文件。 -->
selplat_database_export_atomic_write = sibling_temp_files_atomic_replace_restore_all_originals_and_cleanup_on_failure
<!-- Java 或其他初始化入口必须显式登记 SQL 的业务执行顺序，禁止依赖目录遍历或文件名偶然排序。 -->
selplat_database_sql_loader_policy = explicit_ordered_resource_registry
<!-- SQL 改名、拆分、移动或删除时必须同步构建复制配置、运行加载清单、说明、调用方、测试和构建产物清理。 -->
selplat_database_sql_change_atomic_sync = build_copy,loader_registry,documentation,callers,tests,stale_build_resource_cleanup

## 数据安全与验证

<!-- 修改正式数据库前必须只读核对目标表、字段和记录数量；删除或替代旧结构时必须证明数据为空或提供完整迁移路径。 -->
selplat_database_destructive_change_precheck = resolve_exact_target,read_only_schema_check,row_count_check,preserve_or_migrate_data
<!-- 自动化测试只能使用内存库或临时目录中的可重建隔离数据库，禁止读写 apps/<app>/db/<app>.mv.db 正式文件。 -->
selplat_database_test_isolation = memory_or_temporary_database_only
<!-- schema 变更必须覆盖新库首次初始化、重复初始化和旧库兼容升级；数据脚本必须验证重复执行后稳定坐标仍只有一条。 -->
selplat_database_schema_test_matrix = fresh_initialization,repeated_initialization,legacy_upgrade,seed_idempotency
<!-- 删除数据库文件后必须能只靠登记 SQL 重建；已有文件重复启动必须保留业务记录和号段游标。 -->
selplat_database_rebuild_and_reopen_contract = missing_file_rebuild_from_sql,existing_file_no_reset,preserve_business_rows,preserve_sequence_cursor,compatible_upgrade_only
<!-- 字段删除必须同步 Repository、Service、Controller、前端表格、筛选、表单、接口示例和测试，禁止留下只展示或只保存的残余引用。 -->
selplat_database_field_removal_sync = repository,service,controller,frontend_grid,filter,form,api_examples,tests
<!-- 完成证据必须包含真实 SQL 执行结果、数据库元数据、业务记录保留数量、受影响测试结果和存在页面变化时的视觉终审。 -->
selplat_database_change_completion_evidence = sql_execution,database_metadata,preserved_record_count,relevant_test_results,visual_review_when_applicable
