# SELPLAT 数据库 SQL 文件结构与命名规则

<!-- 本规则的 Hikari、H2 文件、号段、DAO/Service 与单表 SQL 约束只作用于中央登记的 java-gradle+h2 条目。 -->
selplat_database_sql_rule_h2_scope = central_registration(runtimeType=java-gradle,databaseEngine=h2)
<!-- 中央登记的 electron+sqlite 条目复用 db/sql 归属，但迁移、连接和恢复合同由对应 Electron 应用规则治理。 -->
selplat_database_sql_rule_sqlite_scope = central_registration(runtimeType=electron,databaseEngine=sqlite)+application_persistence_rule

<!-- 当前规则不需要 Java 专用能力；应用现有数据库初始化器和测试任务直接承担执行验证。 -->
java_ability_refs = none
<!-- 当前规则不需要 Python 专用能力；目录、文件名和 SQL 引用可由现有检索与构建入口验证。 -->
python_ability_refs = none
<!-- 当前规则不需要 Node 专用能力；Node 只在受影响前端字段同步时使用现有语法检查。 -->
node_ability_refs = none
<!-- 首版规则固化 reference-data 重构中已经验证的 SQL 目录和单表文件约束。 -->
rule_version = 2.18.0
<!-- 规则所有者始终来自工程根 AGENTS.md 的当前稳定用户声明，未经人工提升不得扩大到 common。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示规则已完成索引登记、真实案例核对和索引链验证。 -->
rule_status = active
<!-- 首次升级记录说明规则来自用户对 dataShape、混合建表文件和错误命名的连续修正。 -->
upgrade_record = 2026-08-07:根据reference-data数据库重构建立SQL目录_单表文件_职责分离_注释与隔离验证规则;2026-08-07:移除具体用户前缀并通过AGENTS动态解析规则所有者;2026-08-10:权威数据库统一到db根_业务表按TableNameId一表一号段_CommonSequenceSegment自身保留identity避免循环依赖;2026-08-10:严格本地数据库应用默认账号统一为sa_默认密码统一为123456_测试必须显式隔离覆盖;2026-08-10:数据库应用路径_结构_号段策略和数据源前缀统一进入当前用户中央登记_业务工程不再保存受管隐藏文件;2026-08-10:H2忽略规则统一迁移到SELPLAT根_数据库应用禁止嵌套gitignore;2026-08-10:固化缺库SQL重建_已有库幂等升级_禁止启动脚本删除清空覆盖和MERGE种子;2026-08-10:正式apps数据库改为Git可提交_仅忽略H2运行副产物;2026-08-10:移除根mvdb通配忽略_保证编辑器显示所有正式数据库;2026-08-10:删除MDA嵌套gitignore_before备份规则迁移到根_全模块统一禁止嵌套;2026-08-11:数据库反向导出必须中央登记匹配_完整批次门禁_临时文件原子替换与失败恢复;2026-08-11:删除按项目选择structure的专属架构开关_所有受管应用统一采用真实表业务_无状态能力_common三类职责;2026-08-11:固定初始化主键不得超过六位_reference-data统一六位种子保留区并让运行号段从下一完整区间开始;2026-08-15:增加全局code命名空间聚合号段策略_允许无种子业务表省略data文件_类型与树节点通过显式type模型统一承载选择项和菜单节点;2026-08-15:废弃实体表清理由兼容迁移固定白名单执行_先核对全部记录数_任一非空整体阻断_禁止依赖删除建表SQL自动清库
<!-- 配置数据恢复门禁把正式库和启动 SQL 绑成同一个可恢复交付，但不将用户产生的运行记录回灌为种子数据。 -->
upgrade_record_20260818_database_recovery_sync = 修改连接_Window等可恢复配置时同步dataSQL_中央登记startupRecoveryTables_门禁检查单表data文件和生产加载清单_运行业务记录不进启动SQL
<!-- 2026-08-21 将活跃H2文件改为本地持久化且不纳入Git，数据库交付以db/sql和说明为准。 -->
upgrade_record_20260821_runtime_database_git_boundary = Git只提交db_sql和说明_apps_db_mvdb精确忽略_本地运行数据通过备份恢复
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
verified_example_refs = apps/reference-data/db/sql/schema-CommonSequenceSegment.sql
<!-- verified_example_refs.2 的当前独立事实为 apps/reference-data/db/sql/data-CommonSequenceSegment.sql。 -->
verified_example_refs.2 = apps/reference-data/db/sql/data-CommonSequenceSegment.sql
<!-- verified_example_refs.3 的当前独立事实为 apps/reference-data/db/sql/schema-ReferenceDataType.sql。 -->
verified_example_refs.3 = apps/reference-data/db/sql/schema-ReferenceDataType.sql
<!-- verified_example_refs.4 的当前独立事实为 apps/reference-data/db/sql/schema-ReferenceDataTreeNode.sql。 -->
verified_example_refs.4 = apps/reference-data/db/sql/schema-ReferenceDataTreeNode.sql
<!-- verified_example_refs.5 的当前独立事实为 apps/reference-data/db/sql/schema-ReferenceDataTable.sql。 -->
verified_example_refs.5 = apps/reference-data/db/sql/schema-ReferenceDataTable.sql
<!-- verified_example_refs.6 的当前独立事实为 apps/reference-data/db/README.md。 -->
verified_example_refs.6 = apps/reference-data/db/README.md
<!-- 当前验证复用应用数据库初始化器、Gradle 测试和 SQL 元数据查询，不重复建设只包装命令的专用程序。 -->
program_not_applicable_reason = existing_application_initializer_gradle_tests_and_database_metadata_queries_provide_repeatable_verification
<!-- 交付时必须同时验证目录结构、文件与表名映射、加载清单、隔离数据库执行和调用方字段引用。 -->
verification_scope = directory_layout
<!-- verification_scope.2 的当前独立事实为 filename_table_mapping。 -->
verification_scope.2 = filename_table_mapping
<!-- verification_scope.3 的当前独立事实为 loader_registry。 -->
verification_scope.3 = loader_registry
<!-- verification_scope.4 的当前独立事实为 isolated_database_execution。 -->
verification_scope.4 = isolated_database_execution
<!-- verification_scope.5 的当前独立事实为 caller_field_references。 -->
verification_scope.5 = caller_field_references
<!-- verification_scope.6 的当前独立事实为 relevant_tests。 -->
verification_scope.6 = relevant_tests

## 数据库目录边界

<!-- 应用拥有并跨重启长期保存的本地权威数据库必须直接位于应用 db 根，文件名固定为应用名，禁止建立 db/data 或其他平行运行目录。 -->
selplat_application_authoritative_database_root = apps/<app>/db/<app>.mv.db
<!-- 应用权威数据库使用的结构和初始化 SQL 统一位于 db/sql，运行数据库文件不得进入 sql。 -->
selplat_application_database_sql_root = apps/<app>/db/sql
<!-- db 目录只允许保存唯一正式数据库、sql 和说明；忽略规则统一位于 SELPLAT 根，禁止在应用内散落 .gitignore。 -->
selplat_application_database_directory_allowed_content = <app>.mv.db
<!-- selplat_application_database_directory_allowed_content.2 的当前独立事实为 sql。 -->
selplat_application_database_directory_allowed_content.2 = sql
<!-- selplat_application_database_directory_allowed_content.3 的当前独立事实为 README.md。 -->
selplat_application_database_directory_allowed_content.3 = README.md
<!-- selplat_application_database_directory_allowed_content.4 的当前独立事实为 no_nested_gitignore。 -->
selplat_application_database_directory_allowed_content.4 = no_nested_gitignore
<!-- SELPLAT 根统一精确忽略 apps/*/db/*.mv.db；活跃运行库保留在本地，但不得因启动写入进入Git提交。 -->
selplat_h2_gitignore_ownership = SELPLAT_root_only
<!-- selplat_h2_gitignore_ownership.2 的当前独立事实为 ignore_apps_db_runtime_mvdb_exactly。 -->
selplat_h2_gitignore_ownership.2 = ignore_apps_db_runtime_mvdb_exactly
<!-- selplat_h2_gitignore_ownership.3 的当前独立事实为 track_db_sql_and_readme_only。 -->
selplat_h2_gitignore_ownership.3 = track_db_sql_and_readme_only
<!-- selplat_h2_gitignore_ownership.4 的当前独立事实为 trace_ignored。 -->
selplat_h2_gitignore_ownership.4 = trace_ignored
<!-- selplat_h2_gitignore_ownership.5 的当前独立事实为 lock_ignored。 -->
selplat_h2_gitignore_ownership.5 = lock_ignored
<!-- selplat_h2_gitignore_ownership.6 的当前独立事实为 temp_ignored。 -->
selplat_h2_gitignore_ownership.6 = temp_ignored
<!-- selplat_h2_gitignore_ownership.7 的当前独立事实为 before_backup_ignored。 -->
selplat_h2_gitignore_ownership.7 = before_backup_ignored
<!-- selplat_h2_gitignore_ownership.8 的当前独立事实为 no_nested_gitignore_any_module。 -->
selplat_h2_gitignore_ownership.8 = no_nested_gitignore_any_module
<!-- 禁止使用 *.mv.db 或 **/*.mv.db 宽泛规则，避免隐藏应用db根之外的数据库材料。 -->
selplat_h2_gitignore_ownership.9 = no_broad_mvdb_ignore_pattern
<!-- 严格本地数据库应用必须在当前用户中央登记中声明 datasourcePrefix，正式模块属性按该前缀唯一登记 sa 与 123456。 -->
selplat_managed_local_database_default_credentials = datasourcePrefix_required
<!-- selplat_managed_local_database_default_credentials.2 的当前独立事实为 username=sa。 -->
selplat_managed_local_database_default_credentials.2 = username=sa
<!-- selplat_managed_local_database_default_credentials.3 的当前独立事实为 password=123456。 -->
selplat_managed_local_database_default_credentials.3 = password=123456
<!-- selplat_managed_local_database_default_credentials.4 的当前独立事实为 exactly_once。 -->
selplat_managed_local_database_default_credentials.4 = exactly_once
<!-- 数据库应用的 SQL 根、数据库位置、主键策略和数据源前缀只在 rule-engine 当前用户中央登记维护；架构不可配置，避免任何项目通过登记选择专属结构。 -->
selplat_managed_database_central_registration = projectName
<!-- selplat_managed_database_central_registration.2 的当前独立事实为 schemaRoot。 -->
selplat_managed_database_central_registration.2 = schemaRoot
<!-- selplat_managed_database_central_registration.3 的当前独立事实为 databaseFile。 -->
selplat_managed_database_central_registration.3 = databaseFile
<!-- selplat_managed_database_central_registration.4 的当前独立事实为 primaryKeyStrategy。 -->
selplat_managed_database_central_registration.4 = primaryKeyStrategy
<!-- selplat_managed_database_central_registration.5 的当前独立事实为 datasourcePrefix。 -->
selplat_managed_database_central_registration.5 = datasourcePrefix
<!-- selplat_managed_database_central_registration.6 的当前独立事实为 no_structure_switch。 -->
selplat_managed_database_central_registration.6 = no_structure_switch
<!-- selplat_managed_database_central_registration.7 的当前独立事实为 no_application_local_managed_marker。 -->
selplat_managed_database_central_registration.7 = no_application_local_managed_marker
<!-- 所有受管应用统一使用三类职责：真实表业务一表一目录、无状态能力进入 capability、复用实现进入 common；禁止项目名分支和专属豁免。 -->
selplat_managed_database_uniform_architecture = table_business:<table-business>/controller|service|dao
<!-- selplat_managed_database_uniform_architecture.2 的当前独立事实为 non_persistent_capability:capability/<capability>/controller|service。 -->
selplat_managed_database_uniform_architecture.2 = non_persistent_capability:capability/<capability>/controller|service
<!-- selplat_managed_database_uniform_architecture.3 的当前独立事实为 reusable_implementation:common/config|persistence|util。 -->
selplat_managed_database_uniform_architecture.3 = reusable_implementation:common/config|persistence|util
<!-- selplat_managed_database_uniform_architecture.4 的当前独立事实为 no_project_specific_structure。 -->
selplat_managed_database_uniform_architecture.4 = no_project_specific_structure
<!-- selplat_managed_database_uniform_architecture.5 的当前独立事实为 no_project_name_bypass。 -->
selplat_managed_database_uniform_architecture.5 = no_project_name_bypass
<!-- 空密码只允许测试属性在内存库或临时库中显式覆盖，正式模块属性禁止为空。 -->
selplat_database_empty_password_boundary = production_forbidden
<!-- selplat_database_empty_password_boundary.2 的当前独立事实为 test_isolated_override_allowed。 -->
selplat_database_empty_password_boundary.2 = test_isolated_override_allowed

## SQL 文件命名与单表职责

<!-- 正式表结构文件必须使用 schema-实际表名.sql，文件名中的表名大小写与 CREATE TABLE 实际表名完全一致。 -->
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

## 主键号段

<!-- 严格数据库业务应用必须提供 CommonSequenceSegment 的独立结构与初始化数据脚本，由 common/persistence 绑定当前应用私有数据源。 -->
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

## 注释、初始化和加载

<!-- 每张表和每个字段必须在定义旁写中文业务注释，约束与索引必须说明取值、唯一性、关联或查询原因，禁止只复述 SQL 语法。 -->
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

## 数据安全与验证

<!-- 修改正式数据库前必须只读核对目标表、字段和记录数量；删除或替代旧结构时必须证明数据为空或提供完整迁移路径。 -->
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
