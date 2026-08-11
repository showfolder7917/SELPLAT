# SELPLAT 基础 DAO 项目数据源上下文规则

<!-- 本规则没有独立 Java 自动化入口，正确性由 common-db、业务应用与 Host 的真实数据库测试共同验证。 -->
java_ability_refs = none
<!-- 本规则不生成 Python 成品，因此不虚构 Python 能力。 -->
python_ability_refs = none
<!-- 本规则不涉及 Node 执行代码。 -->
node_ability_refs = none
<!-- 1.6.0 统一表格头真实表名、SEL表格实例、数据库字段、渲染器和图标字段职责。 -->
rule_version = 1.6.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已进入当前用户索引并完成 Uniauth 首个接入验证。 -->
rule_status = active
<!-- 升级记录说明本规则来自 Uniauth 多项目数据源继承修正。 -->
upgrade_record = 2026-08-07:公共BaseDAO改为项目数据源上下文并由Uniauth项目基类首个接入;2026-08-07:Uniauth增加数据库元数据默认表格定义及未来reference-data配置优先入口;2026-08-08:Uniauth退出Host全局数据源并建立模块私有永久数据库和隔离测试库;2026-08-08:删除业务Service中无调用方的旧主键重载与只调用super的重复覆盖;2026-08-08:MDA与Uniauth号段DAO改按项目具名数据源注册并由公共发号器按真实seqCode唯一路由;2026-08-11:reference-data建立一行一列的数据库驱动页面表格头并由真实页面消费;2026-08-11:表格头坐标改为tableName_gridId_gridColumnId并补齐数据库字段_单元格渲染_图标_审计职责

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

## 公共 Base Service 边界

<!-- 业务 Service 接口必须直接继承 BaseService 的 CommonParam、CommonPageParam 和 CommonBatchParam 标准签名，只声明真实新增业务动作。 -->
business_service_interface_contract = inherit_standard_base_service_signatures_and_declare_real_extensions_only
<!-- 业务 ServiceImpl 只有增加过滤、排序、字段规范化、校验、事务差异或外部副作用时才允许覆盖公共 CRUD。 -->
business_service_override_allowed_reasons = filtering,sorting,normalization,validation,transaction_difference,external_side_effect
<!-- 只转换 long 主键到 CommonParam、只补默认分页对象或只调用 super 的方法属于重复包装，确认无调用方后必须删除。 -->
business_service_redundant_wrapper_policy = remove_unused_long_id_no_arg_paging_and_super_only_wrappers
<!-- 与父类完全相同的日志和事务注解不能单独成为覆盖理由，公共父类注解已经承担统一行为。 -->
business_service_annotation_only_override_policy = forbidden_when_same_as_base_contract
<!-- 删除旧签名前必须检索 Controller、前端、测试和其他 Java 调用方，并同步接口、实现和回归测试。 -->
business_service_legacy_signature_removal_verification = controller,frontend,tests,java_callers,interface_and_implementation_sync

## 动态数据库边界

<!-- 固定业务表可以继承公共 Base CRUD；运行时选择任意外部数据库的元数据和 SQL 不属于固定表 Base CRUD。 -->
dynamic_database_boundary = fixed_business_tables_use_Base_runtime_target_sql_uses_private_dynamic_context
<!-- Host 聚合多个模块时，各项目 DAO 仍只读取自己的上下文，不得依据 @Primary 改变数据库归属。 -->
host_aggregation_policy = module_context_ownership_not_primary_datasource_guessing
<!-- Host 不得通过 spring.config.import 把任一业务模块数据库据为全局宿主数据源。 -->
host_business_datasource_import_policy = forbidden
<!-- Uniauth 永久数据库固定属于自己的工程目录，重启后继续打开同一个文件。 -->
uniauth_private_database_path = apps/uniauth/db/uniauth.mv.db
<!-- Uniauth 的首选 DataSource 只兼容现有 Boot MyBatis 和公共号段基础设施，业务 BaseDao 仍必须使用具名项目上下文。 -->
uniauth_primary_candidate_boundary = boot_mybatis_and_common_sequence_infrastructure_only_business_base_dao_remains_qualified
<!-- 多个项目同时使用 CommonSequenceSegment 时，每个项目必须用自身具名 DataSource 注册独立号段 DAO；业务含义是 MDA 与 Uniauth 的游标只在各自私有库推进。 -->
project_sequence_dao_binding = qualified_project_DataSource_to_project_CommonSequenceSegmentDao
<!-- 公共发号器必须根据数据库中真实存在且启用的 seqCode 唯一选择项目号段 DAO，禁止依据 @Primary、Bean 注册顺序或包扫描碰巧命中数据源。 -->
shared_sequence_generator_project_routing = unique_active_seqCode_owner_without_primary_datasource_guessing
<!-- 同一 seqCode 在多个项目数据库同时启用时必须在发号前阻断；业务含义是禁止两个数据库分别生成可能重复的同一业务主键。 -->
duplicate_active_sequence_code_across_projects_policy = fail_before_sequence_allocation
<!-- Uniauth 和 Host 自动测试必须覆盖隔离内存 URL，禁止读写开发永久库。 -->
uniauth_test_database_policy = isolated_memory_database_only

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

## 数据库驱动页面表格头

<!-- 页面每个实际显示字段必须对应一条表格头记录，并由真实表名、SEL表格实例ID和列ID形成稳定唯一坐标。 -->
database_grid_header_row_granularity = one_record_per_rendered_column,unique_tableName_gridId_gridColumnId
<!-- 每条配置必须同时承载租户与操作员、真实字段、第二字段、三语表头、宽度、渲染器、图标及其显示开关、列显示开关、生命周期状态和排序。 -->
database_grid_header_required_configuration = tenantId,lastOperateUserId,tableFieldName,tableSecondaryFieldName,labelZh,labelJa,labelEn,width,cellRenderer,cellIcon,cellIconVisible,visible,status,sortnum
<!-- 页面必须从解析接口消费当前启用且显示的列；只有数据库没有任何配置时才允许最小安全兜底，禁止维护第二份完整硬编码表头。 -->
database_grid_header_frontend_source = resolved_active_visible_database_columns,safe_minimum_only_when_empty,no_parallel_full_hardcoded_headers
<!-- 表格头新增、编辑、启停或显示开关保存后必须重新解析并原位刷新当前表格，重启不得覆盖人工配置。 -->
database_grid_header_runtime_refresh = write_then_resolve_and_refresh,empty_initial_table,no_restart_seed_or_overwrite
<!-- 真实数据库测试必须覆盖新增多语言列、解析宽度和标签、关闭显示后列消失及逻辑删除。 -->
database_grid_header_real_database_test = create_multilingual_column,resolve_label_and_width,visible_false_excluded,logical_delete

## 验证

<!-- 公共层变更后至少执行 common-db 与 common-service 的真实数据库测试。 -->
shared_verification_required = common_db_real_database_tests,common_service_real_database_tests
<!-- 首个或新增业务项目接入时必须执行该项目测试和 Host 聚合启动测试。 -->
project_verification_required = application_tests,host_aggregation_tests
<!-- 结构测试必须断言具体 DAO、项目 BaseDao 与公共 BaseDaoImpl 的三层继承关系。 -->
inheritance_boundary_test_required = true
