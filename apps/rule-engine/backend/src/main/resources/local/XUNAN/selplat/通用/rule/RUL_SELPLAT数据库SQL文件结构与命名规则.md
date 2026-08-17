# SELPLAT 数据库 SQL 文件结构与命名规则

<!-- 当前规则不需要 Java 专用能力；应用现有数据库初始化器和测试任务直接承担执行验证。 -->
java_ability_refs = none
<!-- 当前规则不需要 Python 专用能力；目录、文件名和 SQL 引用可由现有检索与构建入口验证。 -->
python_ability_refs = none
<!-- 当前规则不需要 Node 专用能力；Node 只在受影响前端字段同步时使用现有语法检查。 -->
node_ability_refs = none
<!-- 首版规则固化 reference-data 重构中已经验证的 SQL 目录和单表文件约束。 -->
rule_version = 2.16.0
<!-- 规则所有者始终来自工程根 AGENTS.md 的当前稳定用户声明，未经人工提升不得扩大到 common。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示规则已完成索引登记、真实案例核对和索引链验证。 -->
rule_status = active
<!-- 首次升级记录说明规则来自用户对 dataShape、混合建表文件和错误命名的连续修正。 -->
upgrade_record = 2026-08-07:根据reference-data数据库重构建立SQL目录_单表文件_职责分离_注释与隔离验证规则;2026-08-07:移除具体用户前缀并通过AGENTS动态解析规则所有者;2026-08-10:权威数据库统一到db根_业务表按TableNameId一表一号段_CommonSequenceSegment自身保留identity避免循环依赖;2026-08-10:严格本地数据库应用默认账号统一为sa_默认密码统一为123456_测试必须显式隔离覆盖;2026-08-10:数据库应用路径_结构_号段策略和数据源前缀统一进入当前用户中央登记_业务工程不再保存受管隐藏文件;2026-08-10:H2忽略规则统一迁移到SELPLAT根_数据库应用禁止嵌套gitignore;2026-08-10:固化缺库SQL重建_已有库幂等升级_禁止启动脚本删除清空覆盖和MERGE种子;2026-08-10:正式apps数据库改为Git可提交_仅忽略H2运行副产物;2026-08-10:移除根mvdb通配忽略_保证编辑器显示所有正式数据库;2026-08-10:删除MDA嵌套gitignore_before备份规则迁移到根_全模块统一禁止嵌套;2026-08-11:数据库反向导出必须中央登记匹配_完整批次门禁_临时文件原子替换与失败恢复;2026-08-11:删除按项目选择structure的专属架构开关_所有受管应用统一采用真实表业务_无状态能力_common三类职责;2026-08-11:固定初始化主键不得超过六位_reference-data统一六位种子保留区并让运行号段从下一完整区间开始;2026-08-15:增加全局code命名空间聚合号段策略_允许无种子业务表省略data文件_类型与树节点通过显式type模型统一承载选择项和菜单节点;2026-08-15:废弃实体表清理由兼容迁移固定白名单执行_先核对全部记录数_任一非空整体阻断_禁止依赖删除建表SQL自动清库
<!-- 本次升级把不可辨认的项目名前缀改为对象类型前缀，并明确父容器关联不得依靠解析前缀。 -->
upgrade_record_20260815_object_code = 全局code使用对象类型前缀加聚合主键_中央登记声明object-kind-plus-global-id_页面父容器使用kind与code显式关联
<!-- 类型和树职责升级记录明确两张表不得混合保存分类与节点明细。 -->
upgrade_record_20260815_type_tree_boundary = ReferenceDataType只维护类型分类与多语言目录_ReferenceDataTreeNode只允许TREE父子节点_菜单和下拉不得混入树管理
<!-- 废弃清理升级记录固定用户确认不兼容时的物理清理边界。 -->
upgrade_record_20260815_type_tree_cleanup = 用户确认废弃即物理删除非TREE节点和无调用字段_恢复按真实表结构通查_禁止长期字段白名单兼容
<!-- 独立树升级记录固定 code 与 parentId 为唯一建树关系。 -->
upgrade_record_20260815_independent_tree = ReferenceDataTreeNode以code和parentId独立建树_删除typeId_nodeCode_attributesJson_类型目录与树表禁止建立外键耦合
<!-- 本次升级把类型目录固定为不依赖项目和资源坐标的全局分类目录。 -->
upgrade_record_20260816_type_catalog = ReferenceDataType只保存global_code_categoryCode_localized_names_status_sort_audit_删除项目资源坐标和说明字段_categoryCode全局唯一
<!-- 类型目录顺序升级记录固定物理表与业务阅读顺序一致，禁止后补字段长期堆在时间列之后。 -->
upgrade_record_20260816_type_column_order = ReferenceDataType按id_code_identity_category_localized_status_sort_time排列_已有库原地保留数据重排
<!-- 本次升级把重复的控件种类字段替换为真实控件归属和值层级，业务关联直接使用稳定 code。 -->
upgrade_record_20260816_type_control_binding = ReferenceDataType使用controlCode绑定ReferenceDataControlLayout_code_valueCode保存业务值_parentTypeCode建立同控件菜单层级_ControlLayout删除typeId_categoryCode物理删除
<!-- 本次升级把 TREE 从类型目录中物理清除，并阻止初始化迁移再次生成。 -->
upgrade_record_20260816_tree_type_cleanup = ReferenceDataType禁止TREE_valueCode_旧TREE物理删除_有效子类型只解除错误父级_ReferenceDataTreeNode数据不受影响
<!-- 本次升级为独立树补充只读归属坐标，同时禁止坐标重新进入建树或类型耦合。 -->
upgrade_record_20260816_tree_ownership = ReferenceDataTreeNode增加projectCode_pageCode用于归属展示查询_code加parentId仍是唯一建树关系_禁止类型外键耦合
<!-- 本次升级恢复六张实体表一表一号段，并把无实体表的共享选项组交给独立通用逻辑号段。 -->
upgrade_record_20260816_option_set_sequence = 六张实体表各用TableNameId且code后缀等于本表id_ReferenceDataObjectId只发optionSetCode等无实体逻辑编码_Type删除controlCode并以optionSetCode建立共享层级
<!-- 本次升级统一独立表号段初始值；表之间依靠表名隔离，不得再用 200000、300000 等人为区间表达表类型。 -->
upgrade_record_20260817_table_sequence_start = 新建独立实体表号段统一从100000开始_不同表允许相同主键数值_禁止以首位数字划分表类型_已有游标不得被启动重置

<!-- 问题：数据库脚本使用含义模糊的 tables 或 migration 文件名、一个文件创建多张正式表、类型表混入树或选项能力字段时，后续维护者无法从目录和文件名判断真实职责。 -->
<!-- 场景：当前稳定用户在 SELPLAT 中新建、迁移、拆分、改名或审查 apps/<app> 的应用自有数据库和 SQL。 -->
<!-- 业务含义：数据库文件、表名和代码调用保持一一可追踪，类型、树、选项等不同数据职责不会重新混入同一张表或同一个建表文件。 -->

## 规则包组成

<!-- 本规则的格式由 DSL 本身和文件命名模式直接固定，没有独立可复用成品模板，禁止为补齐目录生成空模板。 -->
template_not_applicable_reason = sql_layout_and_filename_patterns_are_fully_declared_in_rule_no_separate_artifact_template
<!-- reference-data 已完成真实数据库升级、回归和页面验证，可作为规则首个已核验正确案例。 -->
verified_example_refs = apps/reference-data/db/sql/schema-CommonSequenceSegment.sql,apps/reference-data/db/sql/data-CommonSequenceSegment.sql,apps/reference-data/db/sql/schema-ReferenceDataType.sql,apps/reference-data/db/sql/schema-ReferenceDataTreeNode.sql,apps/reference-data/db/sql/schema-ReferenceDataTable.sql,apps/reference-data/db/README.md
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
<!-- 表存在初始化数据时必须使用 data-实际表名.sql；没有种子数据的空业务表可以不创建空 data 文件。 -->
selplat_data_sql_filename_pattern = data-<ActualTableName>.sql
<!-- data 文件只表达真实种子数据；缺少 data 文件表示首次建库保持空表，不得为满足目录对称生成无意义空文件。 -->
selplat_optional_seed_data_file_policy = required_when_seed_rows_exist,absent_means_empty_initial_table,no_empty_placeholder_file
<!-- 一个 schema 文件只允许创建文件名对应的一张正式业务表，禁止使用 tables.sql 或 create_*_tables.sql 聚合多张表。 -->
selplat_schema_sql_single_formal_table_policy = one_schema_file_creates_exactly_one_named_formal_table
<!-- 一个 data 文件只允许初始化文件名对应表的数据，禁止把多个无关表的种子数据混入同一文件。 -->
selplat_data_sql_single_target_table_policy = one_data_file_initializes_exactly_one_named_table
<!-- schema 文件只允许幂等建表、幂等索引、注释和带存在性条件的兼容 ALTER；启动脚本禁止删除表或清空数据。 -->
selplat_schema_sql_allowed_same_target_operations = create_table_if_not_exists,index_if_not_exists,comment,idempotent_compatible_alter,no_drop_table,no_truncate,no_delete
<!-- 已存在的旧式 schema-<app>.sql 不得因规则建立被自动批量拆分；只有用户明确提出迁移时才按本规则重构并完成兼容验证。 -->
selplat_legacy_application_schema_migration_policy = preserve_until_explicit_migration_request_then_refactor_with_compatibility_verification

## 表与字段职责

<!-- 每张正式表必须表达单一业务职责；ReferenceDataType 保存分类与多语言目录，ReferenceDataTreeNode 仅通过自身 code 与 parentId 保存独立父子树。 -->
selplat_database_table_single_business_responsibility = type_catalog_classification_and_localized_names,tree_node_independent_code_plus_parent_id,no_type_foreign_key,no_dropdown_or_menu_detail_in_tree_table,separate_table_only_for_distinct_lifecycle_or_constraints
<!-- 类型目录表通过 optionSetCode 建立可复用选项组，以 valueCode 保存真实业务值，并只允许 parentTypeCode 指向同组选项。 -->
selplat_type_catalog_required_responsibility = table_record_code,optionSetCode_shared_logical_group,valueCode,parentTypeCode_same_option_set_hierarchy,localized_names,status,sort,audit,no_project_page_duplication,no_controlCode,no_categoryCode,no_ControlLayout_typeId
<!-- TREE 是独立树表职责，不得作为 Type.valueCode；历史误入记录按明确不兼容策略物理删除。 -->
selplat_reference_data_type_reserved_values = TREE:forbidden_and_physical_cleanup,tree_data_only_in_ReferenceDataTreeNode
<!-- 树节点表维护系统 code、展示归属、parentId、节点业务值、多语言标签、状态、排序和审计信息；归属坐标不得参与树关系，且禁止重新加入类型外键、业务别名或无调用扩展桶。 -->
selplat_tree_node_table_required_responsibility = global_code,projectCode_and_pageCode_attribution_only,parent_id,node_value,localized_labels,status,sort,audit,tree_relation_code_plus_parentId,no_type_reference,no_node_code_alias,no_attributes_bucket
<!-- 用户明确废弃且不兼容的字段和记录必须从结构、正式库、查询、表单和测试同步物理删除；禁止以 SELECT 字段白名单长期掩盖旧列。 -->
selplat_confirmed_deprecated_data_and_field_cleanup = physical_delete_records_and_columns,schema_and_runtime_database_sync,restore_real_table_structure_query,no_long_term_projection_compatibility
<!-- 新增数据库字段前必须识别真实读取、写入和控制调用链；只有保存但不参与业务行为的配置字段不得进入正式表。 -->
selplat_database_field_requires_real_call_chain = write_path,read_path,business_effect,tests
<!-- 受管业务表的通用物理字段顺序固定为主键、公开 code、身份、业务字段、状态排序和时间，新增字段不得随意追加到审计时间之后。 -->
selplat_managed_business_table_physical_column_order = id,code,tenantId,lastOperateUserId,business_fields,status,sortnum,createdAt,updatedAt
<!-- ReferenceDataType 的业务字段顺序固定为控件归属、类型值、父级和中日英名称，查询台与页面使用同一可读顺序。 -->
selplat_reference_data_type_physical_column_order = id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum,createdAt,updatedAt

## 主键号段

<!-- 严格数据库业务应用必须提供 CommonSequenceSegment 的独立结构与初始化数据脚本，由 common/persistence 绑定当前应用私有数据源。 -->
selplat_common_sequence_sql_files = schema-CommonSequenceSegment.sql,data-CommonSequenceSegment.sql,owner_common_persistence
<!-- 默认应用仍是一表一号段；只有中央登记显式声明全局 code 命名空间的应用，才允许全部业务表共享唯一聚合号段，保证对象类型前缀与全局 id 拼接出的 code 全局不重复且人工可辨认。 -->
selplat_business_table_sequence_cardinality = default:one_table_one_row(seqCode=<ActualTableName>Id,no_partial_seed_set),registered_aggregate_namespace_exception,shared_logical_sequence_allowed_for_no-table-object_only,reference_data_record_code_suffix_equals_own_table_id
<!-- 新建独立实体表的 nextStartId 统一为 100000；每表独立 seqCode 已提供命名空间，禁止再分配 200000、300000 等表类型区间。 -->
selplat_independent_table_sequence_initial_value = nextStartId=100000,one_sequence_per_table,same_numeric_ids_across_tables_allowed,no_table_kind_numeric_partition,no_restart_cursor_reset
<!-- 聚合全局命名空间必须登记对象类型前缀策略；关联仍依靠字段和外键，禁止解析 code 前缀推导数据库关系。 -->
selplat_aggregate_global_code_prefix_strategy = codePrefixStrategy=object-kind-plus-global-id,readable_object_kind_prefix,shared_global_id_suffix,no_relationship_inference_from_prefix
<!-- optionSetCode 等没有独立实体表的共享逻辑坐标允许使用 ReferenceDataObjectId；实体表 id 和 code 禁止调用该号段。 -->
selplat_shared_logical_object_sequence = ReferenceDataObjectId:optionSetCode_and_future_registered_no-table_logical_codes_only,forbid_business_table_primary_key
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
<!-- 删除建表 SQL 不会清除持久数据库中的既有表；废弃表必须由兼容迁移固定白名单处理，先验证全部为空，再统一删除，任一非空时不得发生部分清理。 -->
selplat_deprecated_table_cleanup = compatibility_migration_fixed_allowlist,validate_all_row_counts_first,any_nonempty_blocks_all_drops,empty_tables_drop_idempotently,no_schema_startup_drop
<!-- 自动化测试只能使用内存库或临时目录中的可重建隔离数据库，禁止读写 apps/<app>/db/<app>.mv.db 正式文件。 -->
selplat_database_test_isolation = memory_or_temporary_database_only
<!-- schema 变更必须覆盖新库首次初始化、重复初始化和旧库兼容升级；存在种子数据时还必须验证重复执行后稳定坐标仍只有一条。 -->
selplat_database_schema_test_matrix = fresh_initialization,repeated_initialization,legacy_upgrade,seed_idempotency_when_seed_exists
<!-- 删除数据库文件后必须能只靠登记 SQL 重建；已有文件重复启动必须保留业务记录和号段游标。 -->
selplat_database_rebuild_and_reopen_contract = missing_file_rebuild_from_sql,existing_file_no_reset,preserve_business_rows,preserve_sequence_cursor,compatible_upgrade_only
<!-- 控件状态采用显式保存时，数据库只保留真实读取并控制行为的几何字段；rememberLastState 等不参与决策的记忆开关必须删除。 -->
selplat_explicit_control_state_schema = explicit_save_only,geometry_fields_have_runtime_reader,no_redundant_remember_flag
<!-- 字段删除必须同步 Repository、Service、Controller、前端表格、筛选、表单、接口示例和测试，禁止留下只展示或只保存的残余引用。 -->
selplat_database_field_removal_sync = repository,service,controller,frontend_grid,filter,form,api_examples,tests
<!-- 完成证据必须包含真实 SQL 执行结果、数据库元数据、业务记录保留数量、受影响测试结果和存在页面变化时的视觉终审。 -->
selplat_database_change_completion_evidence = sql_execution,database_metadata,preserved_record_count,relevant_test_results,visual_review_when_applicable
