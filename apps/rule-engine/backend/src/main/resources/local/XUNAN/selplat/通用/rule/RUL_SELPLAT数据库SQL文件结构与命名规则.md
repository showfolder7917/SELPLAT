# SELPLAT 数据库 SQL 文件结构与命名规则

<!-- 当前规则不需要 Java 专用能力；应用现有数据库初始化器和测试任务直接承担执行验证。 -->
java_ability_refs = none
<!-- 当前规则不需要 Python 专用能力；目录、文件名和 SQL 引用可由现有检索与构建入口验证。 -->
python_ability_refs = none
<!-- 当前规则不需要 Node 专用能力；Node 只在受影响前端字段同步时使用现有语法检查。 -->
node_ability_refs = none
<!-- 首版规则固化 reference-data 重构中已经验证的 SQL 目录和单表文件约束。 -->
rule_version = 1.1.0
<!-- 规则所有者始终来自工程根 AGENTS.md 的当前稳定用户声明，未经人工提升不得扩大到 common。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示规则已完成索引登记、真实案例核对和索引链验证。 -->
rule_status = active
<!-- 首次升级记录说明规则来自用户对 dataShape、混合建表文件和错误命名的连续修正。 -->
upgrade_record = 2026-08-07:根据reference-data数据库重构建立SQL目录_单表文件_职责分离_注释与隔离验证规则;2026-08-07:移除具体用户前缀并通过AGENTS动态解析规则所有者

<!-- 问题：数据库脚本使用含义模糊的 tables 或 migration 文件名、一个文件创建多张正式表、类型表混入树或选项能力字段时，后续维护者无法从目录和文件名判断真实职责。 -->
<!-- 场景：当前稳定用户在 SELPLAT 中新建、迁移、拆分、改名或审查 apps/<app> 的应用自有数据库和 SQL。 -->
<!-- 业务含义：数据库文件、表名和代码调用保持一一可追踪，类型、树、选项等不同数据职责不会重新混入同一张表或同一个建表文件。 -->

## 规则包组成

<!-- 本规则的格式由 DSL 本身和文件命名模式直接固定，没有独立可复用成品模板，禁止为补齐目录生成空模板。 -->
template_not_applicable_reason = sql_layout_and_filename_patterns_are_fully_declared_in_rule_no_separate_artifact_template
<!-- reference-data 已完成真实数据库升级、回归和页面验证，可作为规则首个已核验正确案例。 -->
verified_example_refs = apps/reference-data/db/sql/schema-ReferenceDataType.sql,apps/reference-data/db/sql/schema-ReferenceDataTreeNode.sql,apps/reference-data/db/sql/data-ReferenceDataType.sql,apps/reference-data/db/README.md
<!-- 当前验证复用应用数据库初始化器、Gradle 测试和 SQL 元数据查询，不重复建设只包装命令的专用程序。 -->
program_not_applicable_reason = existing_application_initializer_gradle_tests_and_database_metadata_queries_provide_repeatable_verification
<!-- 交付时必须同时验证目录结构、文件与表名映射、加载清单、隔离数据库执行和调用方字段引用。 -->
verification_scope = directory_layout,filename_table_mapping,loader_registry,isolated_database_execution,caller_field_references,relevant_tests

## 数据库目录边界

<!-- 应用拥有并跨重启长期保存的本地权威数据库必须位于应用自己的 db/data，禁止进入构建、缓存或临时目录。 -->
selplat_application_authoritative_database_root = apps/<app>/db/data
<!-- 应用权威数据库使用的结构和初始化 SQL 统一位于同级 db/sql，运行数据库文件不得与 SQL 混放。 -->
selplat_application_database_sql_root = apps/<app>/db/sql
<!-- db 目录只允许保存 data、sql、说明和版本控制占位文件，构建产物、日志、报告与测试数据库继续使用工程既有专用目录。 -->
selplat_application_database_directory_allowed_content = data,sql,README.md,.gitignore,.gitkeep

## SQL 文件命名与单表职责

<!-- 正式表结构文件必须使用 schema-实际表名.sql，文件名中的表名大小写与 CREATE TABLE 实际表名完全一致。 -->
selplat_schema_sql_filename_pattern = schema-<ActualTableName>.sql
<!-- 初始化数据文件必须使用 data-实际表名.sql，文件名中的表名大小写与 INSERT 目标表名完全一致。 -->
selplat_data_sql_filename_pattern = data-<ActualTableName>.sql
<!-- 一个 schema 文件只允许创建文件名对应的一张正式业务表，禁止使用 tables.sql 或 create_*_tables.sql 聚合多张表。 -->
selplat_schema_sql_single_formal_table_policy = one_schema_file_creates_exactly_one_named_formal_table
<!-- 一个 data 文件只允许初始化文件名对应表的数据，禁止把多个无关表的种子数据混入同一文件。 -->
selplat_data_sql_single_target_table_policy = one_data_file_initializes_exactly_one_named_table
<!-- schema 文件可以对同一目标表执行幂等索引、注释和兼容 ALTER；清理已核验无数据且被新表替代的旧表必须写明证据和替代关系。 -->
selplat_schema_sql_allowed_same_target_operations = create_table,index,comment,idempotent_compatible_alter,verified_legacy_replacement_cleanup
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

## 注释、初始化和加载

<!-- 每张表和每个字段必须在定义旁写中文业务注释，约束与索引必须说明取值、唯一性、关联或查询原因，禁止只复述 SQL 语法。 -->
selplat_schema_business_comment_requirement = table,column,constraint,index
<!-- 每张表和每个字段必须声明 COMMENT ON TABLE 与 COMMENT ON COLUMN，保证数据库元数据查询可以直接返回业务含义。 -->
selplat_database_metadata_comment_requirement = COMMENT_ON_TABLE,COMMENT_ON_COLUMN
<!-- 初始化数据必须使用稳定业务坐标和 NOT EXISTS 或等价幂等条件，应用重启不得覆盖后台已经维护的名称、状态、说明或排序。 -->
selplat_seed_data_policy = stable_business_coordinate,idempotent_insert,no_restart_overwrite
<!-- Java 或其他初始化入口必须显式登记 SQL 的业务执行顺序，禁止依赖目录遍历或文件名偶然排序。 -->
selplat_database_sql_loader_policy = explicit_ordered_resource_registry
<!-- SQL 改名、拆分、移动或删除时必须同步构建复制配置、运行加载清单、说明、调用方、测试和构建产物清理。 -->
selplat_database_sql_change_atomic_sync = build_copy,loader_registry,documentation,callers,tests,stale_build_resource_cleanup

## 数据安全与验证

<!-- 修改正式数据库前必须只读核对目标表、字段和记录数量；删除或替代旧结构时必须证明数据为空或提供完整迁移路径。 -->
selplat_database_destructive_change_precheck = resolve_exact_target,read_only_schema_check,row_count_check,preserve_or_migrate_data
<!-- 自动化测试只能使用内存库或临时目录中的可重建隔离数据库，禁止读写 apps/<app>/db/data 中的正式文件。 -->
selplat_database_test_isolation = memory_or_temporary_database_only
<!-- schema 变更必须覆盖新库首次初始化、重复初始化和旧库兼容升级；数据脚本必须验证重复执行后稳定坐标仍只有一条。 -->
selplat_database_schema_test_matrix = fresh_initialization,repeated_initialization,legacy_upgrade,seed_idempotency
<!-- 字段删除必须同步 Repository、Service、Controller、前端表格、筛选、表单、接口示例和测试，禁止留下只展示或只保存的残余引用。 -->
selplat_database_field_removal_sync = repository,service,controller,frontend_grid,filter,form,api_examples,tests
<!-- 完成证据必须包含真实 SQL 执行结果、数据库元数据、业务记录保留数量、受影响测试结果和存在页面变化时的视觉终审。 -->
selplat_database_change_completion_evidence = sql_execution,database_metadata,preserved_record_count,relevant_test_results,visual_review_when_applicable
