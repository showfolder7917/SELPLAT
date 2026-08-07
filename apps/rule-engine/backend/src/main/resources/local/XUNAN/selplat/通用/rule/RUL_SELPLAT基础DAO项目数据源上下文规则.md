# SELPLAT 基础 DAO 项目数据源上下文规则

<!-- 本规则没有独立 Java 自动化入口，正确性由 common-db、业务应用与 Host 的真实数据库测试共同验证。 -->
java_ability_refs = none
<!-- 本规则不生成 Python 成品，因此不虚构 Python 能力。 -->
python_ability_refs = none
<!-- 本规则不涉及 Node 执行代码。 -->
node_ability_refs = none
<!-- 首版固定公共 Base 与业务项目之间的数据源职责边界。 -->
rule_version = 1.1.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已进入当前用户索引并完成 Uniauth 首个接入验证。 -->
rule_status = active
<!-- 升级记录说明本规则来自 Uniauth 多项目数据源继承修正。 -->
upgrade_record = 2026-08-07:公共BaseDAO改为项目数据源上下文并由Uniauth项目基类首个接入;2026-08-07:Uniauth增加数据库元数据默认表格定义及未来reference-data配置优先入口

## 公共 Base 边界

<!-- 公共 Base DAO 只声明抽象上下文入口，禁止自动注入或猜测宿主默认 DataSource。 -->
common_base_datasource_policy = abstract_project_context_only
<!-- 公共 Base 不得保存无 Qualifier 的 DataSource 或 BaseTemplateDao 自动注入字段。 -->
common_base_global_injection_policy = forbidden
<!-- 上下文必须同时绑定 DataSource 与对应 BaseTemplateDao，避免元数据和 SQL 落到不同数据库。 -->
base_datasource_context_members = same_database_DataSource_and_BaseTemplateDao
<!-- 上下文缺失时必须在 SQL 执行前明确失败，禁止静默回退至其他模块数据源。 -->
missing_context_policy = fail_before_sql_without_fallback

## 项目接入结构

<!-- 每个使用公共 CRUD 的业务项目必须建立自己的项目 BaseDao。 -->
project_base_dao_required = true
<!-- 具体 DAO 只能继承项目 BaseDao，由项目 BaseDao 一次性实现公共上下文入口。 -->
concrete_dao_inheritance = concrete_DAO_to_project_BaseDao_to_common_BaseDaoImpl
<!-- 项目上下文 Bean 必须有模块专属名称或限定符，禁止依赖类型碰巧只有一个候选。 -->
project_context_qualifier_required = true
<!-- 项目后续增加第二数据源时，必须为该数据源建立匹配的 Mapper 会话、BaseTemplateDao 和上下文。 -->
additional_datasource_binding = DataSource_SqlSession_BaseTemplateDao_Context_must_match

## 动态数据库边界

<!-- 固定业务表可以继承公共 Base CRUD；运行时选择任意外部数据库的元数据和 SQL 不属于固定表 Base CRUD。 -->
dynamic_database_boundary = fixed_business_tables_use_Base_runtime_target_sql_uses_private_dynamic_context
<!-- Host 聚合多个模块时，各项目 DAO 仍只读取自己的上下文，不得依据 @Primary 改变数据库归属。 -->
host_aggregation_policy = module_context_ownership_not_primary_datasource_guessing

## 默认表格定义

<!-- 项目默认表格列必须由当前项目 BaseDao 读取真实数据库字段名、备注与类型，禁止 Controller 或前端重复写死。 -->
default_table_definition_source = project_BaseDao_real_database_metadata
<!-- 数据库备注作为默认列标题；备注缺失时才回退到真实字段名。 -->
default_table_column_title = database_comment_then_column_name
<!-- 同一业务资源可有多个前端表格，返回结构必须同时保留 resourceCode、viewCode 和 locale。 -->
table_definition_identity = resourceCode_plus_viewCode_plus_locale
<!-- 口令摘要等敏感字段可保留元数据供配置校验，但默认必须不可见。 -->
sensitive_column_default_visibility = hidden

## 配置覆盖与分层

<!-- 未来接入 reference-data 后，Service 只在完整配置存在时返回配置，未配置则继续返回项目 BaseDao 默认元数据。 -->
table_definition_resolution = reference_data_configuration_when_present_otherwise_project_metadata
<!-- Controller 只接收 viewCode、locale 并序列化结果，Service 选择定义来源，DAO 负责项目数据库元数据。 -->
table_definition_layering = Controller_serializes_Service_resolves_DAO_reads_project_metadata

## 验证

<!-- 公共层变更后至少执行 common-db 与 common-service 的真实数据库测试。 -->
shared_verification_required = common_db_real_database_tests,common_service_real_database_tests
<!-- 首个或新增业务项目接入时必须执行该项目测试和 Host 聚合启动测试。 -->
project_verification_required = application_tests,host_aggregation_tests
<!-- 结构测试必须断言具体 DAO、项目 BaseDao 与公共 BaseDaoImpl 的三层继承关系。 -->
inheritance_boundary_test_required = true
