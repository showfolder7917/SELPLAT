# 当前用户 SELPLAT 通用规则索引

<!-- 本索引只登记当前用户在 SELPLAT 各应用之间复用的个人工程规则。 -->
active_user_selplat_general_rule_root = local/XUNAN/selplat/通用/rule/

<!-- SELPLAT 应用本地数据库的 SQL 文件结构、命名、职责和验证约束。 -->
SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT数据库SQL文件结构与命名规则.md
<!-- 新建或整理 apps/<app>/db 时加载，保证数据文件和 SQL 权威来源分层稳定。 -->
load_rule_for_active_user_selplat_application_database_directory_or_sql_layout = SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES
<!-- 新建、拆分、改名或审查 schema/data SQL 时加载，保证文件名与实际表职责一致。 -->
load_rule_for_active_user_selplat_schema_data_sql_creation_split_rename_or_review = SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES
<!-- 修改应用数据库字段、约束、初始化数据或加载清单时加载，保证调用方和隔离测试同步。 -->
load_rule_for_active_user_selplat_database_field_constraint_seed_or_loader_change = SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- SELPLAT 多项目使用公共 Base CRUD 时的数据源上下文、继承结构和 Host 聚合约束。 -->
SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT基础DAO项目数据源上下文规则.md
<!-- 修改公共 BaseDao 数据源注入、模板 DAO 绑定或上下文入口时加载。 -->
load_rule_for_active_user_selplat_base_dao_datasource_or_template_binding_change = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES
<!-- 新建业务项目 BaseDao 或让具体 DAO 接入公共 CRUD 时加载。 -->
load_rule_for_active_user_selplat_project_base_dao_or_common_crud_adoption = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES
<!-- Host 聚合多个含数据库模块或项目新增第二数据源时加载。 -->
load_rule_for_active_user_selplat_host_multi_module_or_additional_datasource = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES
<!-- 为项目业务表返回默认前端列定义，或接入 reference-data 配置覆盖与元数据兜底时加载。 -->
load_rule_for_active_user_selplat_default_table_definition_or_reference_data_fallback = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES
<!-- 修改表格定义的 Controller、Service、DAO 分层或 resourceCode/viewCode/locale 标识时加载。 -->
load_rule_for_active_user_selplat_table_definition_controller_service_dao_layering = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES
