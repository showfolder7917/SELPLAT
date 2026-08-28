# 数据库基础规则索引

<!-- 本叶子索引由原索引按职责无损分片；逻辑 ID、路径和触发映射保持不变。 -->

<!-- SELPLAT 应用本地数据库的 SQL 文件结构、命名、职责和验证约束。 -->
SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT数据库SQL文件结构与命名规则.md

<!-- 新建或整理 apps/<app>/db 时加载，保证数据文件和 SQL 权威来源分层稳定。 -->
load_rule_for_active_user_selplat_application_database_directory_or_sql_layout = SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- 新建、拆分、改名或审查 schema/data SQL 时加载，保证文件名与实际表职责一致。 -->
load_rule_for_active_user_selplat_schema_data_sql_creation_split_rename_or_review = SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- 修改应用数据库字段、约束、初始化数据或加载清单时加载，保证调用方和隔离测试同步。 -->
load_rule_for_active_user_selplat_database_field_constraint_seed_or_loader_change = SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- load_rule_for_active_user_selplat_deprecated_table_precheck_migration_or_drop 的当前独立事实为 SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES。 -->
load_rule_for_active_user_selplat_deprecated_table_precheck_migration_or_drop = SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- 修改正式库中需要缺库恢复的连接、Window 等配置时加载，强制同步启动 SQL 和加载契约。 -->
load_rule_for_active_user_selplat_recovery_configuration_database_mutation_or_startup_sql_sync = SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- SELPLAT 多项目使用公共 Base CRUD 与号段时的数据源上下文、继承结构和 Host 聚合约束。 -->
SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT基础DAO项目数据源上下文规则.md

<!-- 修改公共 BaseDao 数据源注入、模板 DAO 绑定或上下文入口时加载。 -->
load_rule_for_active_user_selplat_base_dao_datasource_or_template_binding_change = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- 新建业务项目 BaseDao 或让具体 DAO 接入公共 CRUD 时加载。 -->
load_rule_for_active_user_selplat_project_base_dao_or_common_crud_adoption = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- 清理业务 Service 中旧主键重载、无参分页或只调用 super 的重复覆盖时加载。 -->
load_rule_for_active_user_selplat_base_service_redundant_override_cleanup = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- Host 聚合多个含数据库模块或项目新增第二数据源时加载。 -->
load_rule_for_active_user_selplat_host_multi_module_or_additional_datasource = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- 多个项目注册 CommonSequenceSegment 或调整号段数据源路由时加载，禁止依赖 @Primary 猜测号段归属。 -->
load_rule_for_active_user_selplat_multi_project_sequence_datasource_routing = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- 新建或修改中央登记业务应用的私有数据源、连接池参数或 Bean 生命周期时加载。 -->
load_rule_for_active_user_selplat_managed_application_private_datasource_pool_or_lifecycle = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- 交付前检查 DriverManagerDataSource、缺失 Hikari 配置或缺失基础池参数时加载。 -->
load_rule_for_active_user_selplat_managed_application_datasource_pool_delivery_scan = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- 为项目业务表返回默认前端列定义，或接入 reference-data 配置覆盖与元数据兜底时加载。 -->
load_rule_for_active_user_selplat_default_table_definition_or_reference_data_fallback = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- 修改表格定义的 Controller、Service、DAO 分层或 tableName/gridId/locale 标识时加载。 -->
load_rule_for_active_user_selplat_table_definition_controller_service_dao_layering = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- 新增或修改数据库驱动的页面表格头、列宽、多语言、显示开关和排序配置时加载。 -->
load_rule_for_active_user_selplat_database_driven_grid_header_column_configuration = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- 新增或修改公共管理员判断、管理能力查询或 Service 权限二次校验时加载。 -->
load_rule_for_active_user_selplat_base_service_admin_or_management_authorization = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- 修改 getGridColumn 本地 Provider、独立 Reference Data HTTP 适配、字段名静默降级或统一 columns 返回结构时加载。 -->
load_rule_for_active_user_selplat_grid_column_local_remote_provider_and_silent_field_fallback = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- 可分页管理列表拆分独立查询字段或改为后台分页时加载，保证使用 BaseDao AND 条件与真实 totalCount。 -->
load_rule_for_active_user_selplat_managed_grid_backend_paging_or_independent_query_fields = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- SELPLAT 基础 DAO 复用和通用参数透传。 -->
SELPLAT_BASE_DAO_REUSE_RULES = local/XUNAN/selplat/通用/rule/RUL_基础DAO复用与通用参数透传规则.md

<!-- load_rule_for_selplat_base_dao_crud_or_paging_reuse 的当前独立事实为 SELPLAT_BASE_DAO_REUSE_RULES。 -->
load_rule_for_selplat_base_dao_crud_or_paging_reuse = SELPLAT_BASE_DAO_REUSE_RULES

<!-- load_rule_for_selplat_common_param_dao_query 的当前独立事实为 SELPLAT_BASE_DAO_REUSE_RULES。 -->
load_rule_for_selplat_common_param_dao_query = SELPLAT_BASE_DAO_REUSE_RULES

<!-- load_rule_for_selplat_common_batch_param_or_thousand_item_batch 的当前独立事实为 SELPLAT_BASE_DAO_REUSE_RULES。 -->
load_rule_for_selplat_common_batch_param_or_thousand_item_batch = SELPLAT_BASE_DAO_REUSE_RULES

<!-- load_rule_for_selplat_id_sequence_code_or_composite_id_mapping 的当前独立事实为 SELPLAT_BASE_DAO_REUSE_RULES。 -->
load_rule_for_selplat_id_sequence_code_or_composite_id_mapping = SELPLAT_BASE_DAO_REUSE_RULES

<!-- load_rule_for_selplat_project_base_dao_inheritance_or_datasource_boundary 的当前独立事实为 SELPLAT_BASE_DAO_REUSE_RULES。 -->
load_rule_for_selplat_project_base_dao_inheritance_or_datasource_boundary = SELPLAT_BASE_DAO_REUSE_RULES

<!-- load_rule_for_selplat_independent_project_database_or_multiple_datasource_context 的当前独立事实为 SELPLAT_BASE_DAO_REUSE_RULES。 -->
load_rule_for_selplat_independent_project_database_or_multiple_datasource_context = SELPLAT_BASE_DAO_REUSE_RULES

<!-- load_rule_for_selplat_database_identity_generated_id_or_special_dao_extension 的当前独立事实为 SELPLAT_BASE_DAO_REUSE_RULES。 -->
load_rule_for_selplat_database_identity_generated_id_or_special_dao_extension = SELPLAT_BASE_DAO_REUSE_RULES

<!-- load_rule_for_selplat_project_common_package_or_reusable_infrastructure_boundary 的当前独立事实为 SELPLAT_BASE_DAO_REUSE_RULES。 -->
load_rule_for_selplat_project_common_package_or_reusable_infrastructure_boundary = SELPLAT_BASE_DAO_REUSE_RULES

<!-- load_rule_for_selplat_business_package_entity_dao_or_table_naming 的当前独立事实为 SELPLAT_BASE_DAO_REUSE_RULES。 -->
load_rule_for_selplat_business_package_entity_dao_or_table_naming = SELPLAT_BASE_DAO_REUSE_RULES

<!-- load_rule_for_selplat_database_column_metadata_or_table_definition 的当前独立事实为 SELPLAT_BASE_DAO_REUSE_RULES。 -->
load_rule_for_selplat_database_column_metadata_or_table_definition = SELPLAT_BASE_DAO_REUSE_RULES

<!-- load_rule_for_selplat_project_metadata_dao_or_column_dto 的当前独立事实为 SELPLAT_BASE_DAO_REUSE_RULES。 -->
load_rule_for_selplat_project_metadata_dao_or_column_dto = SELPLAT_BASE_DAO_REUSE_RULES

<!-- 数据库权威根、运行文件边界、中央登记和统一架构的独立职责规则。 -->
SELPLAT_DATABASE_ROOT_AND_RUNTIME_REGISTRATION_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT数据库根与运行注册规则.md
<!-- 修改数据库根、运行文件 Git 边界、凭据或中央登记时直接加载。 -->
load_rule_for_selplat_database_root_runtime_file_credentials_or_registration_change = SELPLAT_DATABASE_ROOT_AND_RUNTIME_REGISTRATION_RULES

<!-- SQL 文件命名、单表职责、字段模型与物理列顺序的独立职责规则。 -->
SELPLAT_DATABASE_SCHEMA_TABLE_MODEL_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT数据库Schema与表模型规则.md
<!-- 修改 Schema/Data SQL、表职责、字段或列顺序时直接加载。 -->
load_rule_for_selplat_database_schema_data_table_field_or_column_order_change = SELPLAT_DATABASE_SCHEMA_TABLE_MODEL_RULES

<!-- 独立表号段、聚合编码、固定种子和多进程安全的独立职责规则。 -->
SELPLAT_DATABASE_SEQUENCE_AND_CODE_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT数据库号段与编码规则.md
<!-- 修改数据库号段、全局编码、种子区间或并发分配时直接加载。 -->
load_rule_for_selplat_database_sequence_global_code_seed_or_concurrency_change = SELPLAT_DATABASE_SEQUENCE_AND_CODE_RULES

<!-- SQL 注释、种子写入、反向导出、原子同步与恢复边界的独立职责规则。 -->
SELPLAT_DATABASE_SQL_SYNC_AND_RECOVERY_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT数据库SQL同步与恢复规则.md
<!-- 修改 SQL 注释、种子、导出、同步或恢复配置时直接加载。 -->
load_rule_for_selplat_database_seed_export_atomic_sync_or_recovery_change = SELPLAT_DATABASE_SQL_SYNC_AND_RECOVERY_RULES

<!-- 破坏性变更预检、废弃清理、隔离测试和完成证据的独立职责规则。 -->
SELPLAT_DATABASE_DESTRUCTIVE_CHANGE_AND_EVIDENCE_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT数据库破坏性变更与证据规则.md
<!-- 修改删表删字段、重建测试或数据库完成证据时直接加载。 -->
load_rule_for_selplat_database_destructive_cleanup_rebuild_test_or_evidence_change = SELPLAT_DATABASE_DESTRUCTIVE_CHANGE_AND_EVIDENCE_RULES
