# SELPLAT 基础 DAO 项目数据源上下文规则

<!-- 本规则没有独立 Java 自动化入口，正确性由 common-db、业务应用与 Host 的真实数据库测试共同验证。 -->
java_ability_refs = none
<!-- 受管应用私有连接池结构由当前用户快速源码门禁统一扫描。 -->
python_ability_refs = apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/selplat_source_ownership_guard.py
<!-- 本规则不涉及 Node 执行代码。 -->
node_ability_refs = none
<!-- 1.10.0 在身份写入边界之外补充数据库表头的单双行字段绑定与稳定排序约束。 -->
rule_version = 1.12.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已进入当前用户索引并完成 Uniauth 首个接入验证。 -->
rule_status = active

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

## 私有连接池门禁

<!-- 中央登记的每个永久数据库应用必须用 ConfigurationProperties 绑定模块专属 HikariConfig，禁止各项目手工解释同一组池参数。 -->
managed_application_private_pool_configuration = qualified_HikariConfig_with_project_datasource_prefix
<!-- 私有数据源 Bean 必须返回 HikariDataSource、声明 destroyMethod=close 并保持模块限定名，Host 停止时才能释放连接与文件锁。 -->
managed_application_private_pool_lifecycle = qualified_HikariDataSource_with_destroyMethod_close
<!-- DriverManagerDataSource、SimpleDriverDataSource、直接 DriverManager 建连和未指定类型的 DataSourceBuilder 在受管业务应用正式源码中一律阻断。 -->
managed_application_unpooled_datasource_policy = forbidden_in_production_source
<!-- 模块属性至少必须声明 jdbc-url、pool-name、driver-class-name、minimum-idle 和 maximum-pool-size，账号密码继续遵守中央数据库门禁。 -->
managed_application_private_pool_required_properties = jdbc-url
<!-- managed_application_private_pool_required_properties.2 的当前独立事实为 pool-name。 -->
managed_application_private_pool_required_properties.2 = pool-name
<!-- managed_application_private_pool_required_properties.3 的当前独立事实为 driver-class-name。 -->
managed_application_private_pool_required_properties.3 = driver-class-name
<!-- managed_application_private_pool_required_properties.4 的当前独立事实为 minimum-idle。 -->
managed_application_private_pool_required_properties.4 = minimum-idle
<!-- managed_application_private_pool_required_properties.5 的当前独立事实为 maximum-pool-size。 -->
managed_application_private_pool_required_properties.5 = maximum-pool-size
<!-- 隔离持久层测试必须断言实际返回 HikariDataSource、池名和关闭后重开不丢数据，禁止只检查 SQL 能执行。 -->
managed_application_private_pool_test_contract = datasource_type
<!-- managed_application_private_pool_test_contract.2 的当前独立事实为 pool_name。 -->
managed_application_private_pool_test_contract.2 = pool_name
<!-- managed_application_private_pool_test_contract.3 的当前独立事实为 close_and_reopen_persistence。 -->
managed_application_private_pool_test_contract.3 = close_and_reopen_persistence
<!-- 快速门禁扫描当前及未来所有中央登记应用；发现无池实现、缺 Hikari 配置或缺基础池参数时必须以非零状态阻断。 -->
managed_application_private_pool_delivery_gate = central_registry_driven_source_scan

## 公共 Base Service 边界

<!-- 业务 Service 接口必须直接继承 BaseService 的 CommonParam、CommonPageParam 和 CommonBatchParam 标准签名，只声明真实新增业务动作。 -->
business_service_interface_contract = inherit_standard_base_service_signatures_and_declare_real_extensions_only
<!-- 业务 ServiceImpl 只有增加过滤、排序、字段规范化、校验、事务差异或外部副作用时才允许覆盖公共 CRUD。 -->
business_service_override_allowed_reasons = filtering
<!-- business_service_override_allowed_reasons.2 的当前独立事实为 sorting。 -->
business_service_override_allowed_reasons.2 = sorting
<!-- business_service_override_allowed_reasons.3 的当前独立事实为 normalization。 -->
business_service_override_allowed_reasons.3 = normalization
<!-- business_service_override_allowed_reasons.4 的当前独立事实为 validation。 -->
business_service_override_allowed_reasons.4 = validation
<!-- business_service_override_allowed_reasons.5 的当前独立事实为 transaction_difference。 -->
business_service_override_allowed_reasons.5 = transaction_difference
<!-- business_service_override_allowed_reasons.6 的当前独立事实为 external_side_effect。 -->
business_service_override_allowed_reasons.6 = external_side_effect
<!-- 只转换 long 主键到 CommonParam、只补默认分页对象或只调用 super 的方法属于重复包装，确认无调用方后必须删除。 -->
business_service_redundant_wrapper_policy = remove_unused_long_id_no_arg_paging_and_super_only_wrappers
<!-- 与父类完全相同的日志和事务注解不能单独成为覆盖理由，公共父类注解已经承担统一行为。 -->
business_service_annotation_only_override_policy = forbidden_when_same_as_base_contract
<!-- 删除旧签名前必须检索 Controller、前端、测试和其他 Java 调用方，并同步接口、实现和回归测试。 -->
business_service_legacy_signature_removal_verification = controller
<!-- business_service_legacy_signature_removal_verification.2 的当前独立事实为 frontend。 -->
business_service_legacy_signature_removal_verification.2 = frontend
<!-- business_service_legacy_signature_removal_verification.3 的当前独立事实为 tests。 -->
business_service_legacy_signature_removal_verification.3 = tests
<!-- business_service_legacy_signature_removal_verification.4 的当前独立事实为 java_callers。 -->
business_service_legacy_signature_removal_verification.4 = java_callers
<!-- business_service_legacy_signature_removal_verification.5 的当前独立事实为 interface_and_implementation_sync。 -->
business_service_legacy_signature_removal_verification.5 = interface_and_implementation_sync
<!-- 当前操作员只能从 BaseServiceImpl.getCurrentOperatorId 取得；登录接入前固定返回管理员 1，业务 Service 不得另行写死或接受前端操作员。 -->
base_service_current_operator_source = BaseServiceImpl.getCurrentOperatorId
<!-- base_service_current_operator_source.2 的当前独立事实为 temporary_admin_id_1。 -->
base_service_current_operator_source.2 = temporary_admin_id_1
<!-- 当前租户只能从 BaseServiceImpl.getCurrentTenantId 取得；登录接入前固定返回租户 1，业务 Service 不得另行写死或接受前端租户。 -->
base_service_current_tenant_source = BaseServiceImpl.getCurrentTenantId
<!-- base_service_current_tenant_source.2 的当前独立事实为 temporary_tenant_id_1。 -->
base_service_current_tenant_source.2 = temporary_tenant_id_1
<!-- 当前管理员结论只能从 BaseServiceImpl.isAdmin 取得；权限接入前固定返回 true，管理能力必须在 Service 中二次校验，前端只消费能力结果。 -->
base_service_current_admin_source = BaseServiceImpl.isAdmin
<!-- base_service_current_admin_source.2 的当前独立事实为 temporary_true。 -->
base_service_current_admin_source.2 = temporary_true
<!-- base_service_current_admin_source.3 的当前独立事实为 service_authorization_recheck。 -->
base_service_current_admin_source.3 = service_authorization_recheck
<!-- base_service_current_admin_source.4 的当前独立事实为 no_frontend_only_permission。 -->
base_service_current_admin_source.4 = no_frontend_only_permission
<!-- 新增、更新、批量写入和假删除必须在 DAO 调用前按真实表已有身份列由 BaseServiceImpl 覆盖；无身份列控制表不得追加未知字段。 -->
base_service_identity_write_policy = insert
<!-- base_service_identity_write_policy.2 的当前独立事实为 insertBatch。 -->
base_service_identity_write_policy.2 = insertBatch
<!-- base_service_identity_write_policy.3 的当前独立事实为 update。 -->
base_service_identity_write_policy.3 = update
<!-- base_service_identity_write_policy.4 的当前独立事实为 updateBatch。 -->
base_service_identity_write_policy.4 = updateBatch
<!-- base_service_identity_write_policy.5 的当前独立事实为 delete。 -->
base_service_identity_write_policy.5 = delete
<!-- base_service_identity_write_policy.6 的当前独立事实为 deleteBatch:override_existing_identity_columns_before_DAO。 -->
base_service_identity_write_policy.6 = deleteBatch:override_existing_identity_columns_before_DAO
<!-- base_service_identity_write_policy.7 的当前独立事实为 no_unknown_column_injection。 -->
base_service_identity_write_policy.7 = no_unknown_column_injection
<!-- 所有应用页面和生成页面都不得把 tenantId 或 lastOperateUserId 作为编辑字段或保存删除参数提交后台。 -->
frontend_identity_write_policy = tenantId
<!-- frontend_identity_write_policy.2 的当前独立事实为 lastOperateUserId:read_only_or_hidden。 -->
frontend_identity_write_policy.2 = lastOperateUserId:read_only_or_hidden
<!-- frontend_identity_write_policy.3 的当前独立事实为 forbid_form_and_write_payload。 -->
frontend_identity_write_policy.3 = forbid_form_and_write_payload
<!-- 将来接入 Cookie 或会话登录时只能替换两个当前身份函数的取值来源，Controller 与业务 Service 调用契约保持不变。 -->
login_identity_migration_boundary = replace_BaseServiceImpl_identity_source_only
<!-- login_identity_migration_boundary.2 的当前独立事实为 no_controller_identity_parameter。 -->
login_identity_migration_boundary.2 = no_controller_identity_parameter
<!-- login_identity_migration_boundary.3 的当前独立事实为 no_business_service_identity_parameter。 -->
login_identity_migration_boundary.3 = no_business_service_identity_parameter

## 后台分页查询

<!-- 可分页管理列表的每个查询字段必须使用独立输入和稳定参数名；业务含义是字段来源与实际 SQL 条件可以一一追踪。 -->
managed_grid_query_input_contract = one_input_one_real_column
<!-- managed_grid_query_input_contract.2 的当前独立事实为 stable_field_name。 -->
managed_grid_query_input_contract.2 = stable_field_name
<!-- managed_grid_query_input_contract.3 的当前独立事实为 no_cross_column_keyword_box。 -->
managed_grid_query_input_contract.3 = no_cross_column_keyword_box
<!-- 多个查询字段统一透传 CommonPageParam，由 BaseDao 按 AND 组合；业务含义是无需为通用管理查询增加 OR SQL 或业务 DAO 包装。 -->
managed_grid_query_combination = CommonPageParam_dynamic_fields_to_BaseDao_AND
<!-- managed_grid_query_combination.2 的当前独立事实为 no_cross_column_OR。 -->
managed_grid_query_combination.2 = no_cross_column_OR
<!-- managed_grid_query_combination.3 的当前独立事实为 no_custom_sql。 -->
managed_grid_query_combination.3 = no_custom_sql
<!-- 文本模糊条件使用真实字段名加 Like 后缀，枚举和状态使用等值条件；业务含义是 codeLike、parentCodeLike、status 可直接映射公共查询构造器。 -->
managed_grid_query_operator_mapping = text:fieldNameLike
<!-- managed_grid_query_operator_mapping.2 的当前独立事实为 enum_and_status:fieldName。 -->
managed_grid_query_operator_mapping.2 = enum_and_status:fieldName
<!-- Grid 只能请求当前 pageNo/pageSize 并消费后台 totalCount；禁止先循环读取全部分页再在浏览器过滤。 -->
managed_grid_pagination_boundary = backend_current_page_plus_totalCount
<!-- managed_grid_pagination_boundary.2 的当前独立事实为 no_load_all_pages_for_grid_filter。 -->
managed_grid_pagination_boundary.2 = no_load_all_pages_for_grid_filter
<!-- managed_grid_pagination_boundary.3 的当前独立事实为 no_current_page_only_local_search。 -->
managed_grid_pagination_boundary.3 = no_current_page_only_local_search
<!-- 公共 Grid 的 REMOTE 模式只发布页码与独立条件状态，应用负责调用自身业务 Controller；公共控件不得识别接口或数据库字段。 -->
managed_grid_remote_component_boundary = selGrid_query_event
<!-- managed_grid_remote_component_boundary.2 的当前独立事实为 application_business_request。 -->
managed_grid_remote_component_boundary.2 = application_business_request
<!-- managed_grid_remote_component_boundary.3 的当前独立事实为 BaseController_getStore。 -->
managed_grid_remote_component_boundary.3 = BaseController_getStore
<!-- managed_grid_remote_component_boundary.4 的当前独立事实为 public_component_no_business_endpoint。 -->
managed_grid_remote_component_boundary.4 = public_component_no_business_endpoint

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
<!-- Reference Data 配置未命中或不可用时，默认列标题直接使用真实字段名，不把备注或技术失败变成页面提示。 -->
default_table_column_title = real_column_name_without_user_prompt
<!-- 同一业务资源可有多个前端表格，返回结构必须同时保留 resourceCode、viewCode 和 locale。 -->
table_definition_identity = resourceCode_plus_viewCode_plus_locale
<!-- 口令摘要等敏感字段可保留元数据供配置校验，但默认必须不可见。 -->
sensitive_column_default_visibility = hidden

## 配置覆盖与分层

<!-- Service 先使用同进程 Provider，应用拆分后根据服务地址调用相同 HTTP 契约；无数据、超时和异常都静默降级字段名。 -->
table_definition_resolution = local_reference_data_provider_then_remote_resolve_http_then_real_field_names_silent
<!-- Controller 只接收 viewCode、locale 并序列化结果，Service 选择定义来源，DAO 负责项目数据库元数据。 -->
table_definition_layering = Controller_serializes_Service_resolves_DAO_reads_project_metadata
<!-- 配置命中和字段名降级必须返回同一 SEL Grid columns 数组，禁止前端为两种来源维护不同解析分支。 -->
table_definition_response_shape = same_SEL_Grid_columns_array_for_configured_and_field_name_fallback
<!-- Reference Data 服务不可达、非 2xx、超时、异常或无配置时只允许后台调试日志，页面不弹窗、不提示且列表继续显示。 -->
table_definition_failure_user_experience = silent_field_name_fallback_without_toast_dialog_or_error_message
<!-- 当前单工程不允许 Controller 通过 HTTP 调用同进程接口；远程 HTTP 只在未装配本地 Provider 且显式配置服务地址时启用。 -->
table_definition_deployment_adapter = same_process_direct_provider
<!-- table_definition_deployment_adapter.2 的当前独立事实为 separate_process_configured_remote_http。 -->
table_definition_deployment_adapter.2 = separate_process_configured_remote_http
<!-- table_definition_deployment_adapter.3 的当前独立事实为 no_self_http。 -->
table_definition_deployment_adapter.3 = no_self_http

## 数据库驱动页面表格头

<!-- 页面每个实际显示字段必须对应一条表格头记录，并由真实表名、SEL表格实例ID和列ID形成稳定唯一坐标。 -->
database_grid_header_row_granularity = one_record_per_rendered_column
<!-- database_grid_header_row_granularity.2 的当前独立事实为 unique_tableName_gridId_gridColumnId。 -->
database_grid_header_row_granularity.2 = unique_tableName_gridId_gridColumnId
<!-- 每条配置必须同时承载租户与操作员、真实字段、第二字段、三语表头、宽度、渲染器、图标及其显示开关、列显示开关、生命周期状态和排序。 -->
database_grid_header_required_configuration = tenantId
<!-- database_grid_header_required_configuration.2 的当前独立事实为 lastOperateUserId。 -->
database_grid_header_required_configuration.2 = lastOperateUserId
<!-- database_grid_header_required_configuration.3 的当前独立事实为 tableFieldName。 -->
database_grid_header_required_configuration.3 = tableFieldName
<!-- database_grid_header_required_configuration.4 的当前独立事实为 tableSecondaryFieldName。 -->
database_grid_header_required_configuration.4 = tableSecondaryFieldName
<!-- database_grid_header_required_configuration.5 的当前独立事实为 labelZh。 -->
database_grid_header_required_configuration.5 = labelZh
<!-- database_grid_header_required_configuration.6 的当前独立事实为 labelJa。 -->
database_grid_header_required_configuration.6 = labelJa
<!-- database_grid_header_required_configuration.7 的当前独立事实为 labelEn。 -->
database_grid_header_required_configuration.7 = labelEn
<!-- database_grid_header_required_configuration.8 的当前独立事实为 width。 -->
database_grid_header_required_configuration.8 = width
<!-- database_grid_header_required_configuration.9 的当前独立事实为 cellRenderer。 -->
database_grid_header_required_configuration.9 = cellRenderer
<!-- database_grid_header_required_configuration.10 的当前独立事实为 cellIcon。 -->
database_grid_header_required_configuration.10 = cellIcon
<!-- database_grid_header_required_configuration.11 的当前独立事实为 cellIconVisible。 -->
database_grid_header_required_configuration.11 = cellIconVisible
<!-- database_grid_header_required_configuration.12 的当前独立事实为 visible。 -->
database_grid_header_required_configuration.12 = visible
<!-- database_grid_header_required_configuration.13 的当前独立事实为 status。 -->
database_grid_header_required_configuration.13 = status
<!-- database_grid_header_required_configuration.14 的当前独立事实为 sortnum。 -->
database_grid_header_required_configuration.14 = sortnum
<!-- 单值列必须使用 text 并清空第二字段；只有两个真实字段需要同格展示时才使用 stack，禁止用空占位横线伪造第二行。 -->
database_grid_header_renderer_secondary_field_contract = single:text+secondaryFieldName_null
<!-- database_grid_header_renderer_secondary_field_contract.2 的当前独立事实为 compound:stack+existing_secondary_field。 -->
database_grid_header_renderer_secondary_field_contract.2 = compound:stack+existing_secondary_field
<!-- database_grid_header_renderer_secondary_field_contract.3 的当前独立事实为 no_empty_secondary_placeholder。 -->
database_grid_header_renderer_secondary_field_contract.3 = no_empty_secondary_placeholder
<!-- ReferenceDataType 页面按业务阅读顺序显示，英文与日文是唯一双行组合列。 -->
reference_data_type_grid_column_order = code
<!-- reference_data_type_grid_column_order.2 的当前独立事实为 optionSetCode。 -->
reference_data_type_grid_column_order.2 = optionSetCode
<!-- reference_data_type_grid_column_order.3 的当前独立事实为 valueCode。 -->
reference_data_type_grid_column_order.3 = valueCode
<!-- reference_data_type_grid_column_order.4 的当前独立事实为 parentTypeCode。 -->
reference_data_type_grid_column_order.4 = parentTypeCode
<!-- reference_data_type_grid_column_order.5 的当前独立事实为 nameZh。 -->
reference_data_type_grid_column_order.5 = nameZh
<!-- reference_data_type_grid_column_order.6 的当前独立事实为 nameEn_with_nameJa_secondary。 -->
reference_data_type_grid_column_order.6 = nameEn_with_nameJa_secondary
<!-- reference_data_type_grid_column_order.7 的当前独立事实为 status。 -->
reference_data_type_grid_column_order.7 = status
<!-- reference_data_type_grid_column_order.8 的当前独立事实为 sortnum。 -->
reference_data_type_grid_column_order.8 = sortnum
<!-- reference_data_type_grid_column_order.9 的当前独立事实为 id_actions。 -->
reference_data_type_grid_column_order.9 = id_actions
<!-- 页面只能调用当前业务 Controller 的 getGridColumn；内部本地或远程解析由 Service 决定，前端禁止直接调用 resolve.htm。 -->
database_grid_header_frontend_source = business_getGridColumn_only
<!-- database_grid_header_frontend_source.2 的当前独立事实为 no_frontend_direct_resolve_endpoint。 -->
database_grid_header_frontend_source.2 = no_frontend_direct_resolve_endpoint
<!-- database_grid_header_frontend_source.3 的当前独立事实为 no_parallel_hardcoded_headers。 -->
database_grid_header_frontend_source.3 = no_parallel_hardcoded_headers
<!-- 表格头新增、编辑、启停或显示开关保存后必须重新解析并原位刷新当前表格，重启不得覆盖人工配置。 -->
database_grid_header_runtime_refresh = write_then_getGridColumn_and_refresh
<!-- database_grid_header_runtime_refresh.2 的当前独立事实为 idempotent_missing_test_seed_without_overwrite。 -->
database_grid_header_runtime_refresh.2 = idempotent_missing_test_seed_without_overwrite
<!-- 真实数据库测试必须覆盖新增多语言列、解析宽度和标签、关闭显示后列消失及逻辑删除。 -->
database_grid_header_real_database_test = create_multilingual_column
<!-- database_grid_header_real_database_test.2 的当前独立事实为 getGridColumn_local_provider。 -->
database_grid_header_real_database_test.2 = getGridColumn_local_provider
<!-- database_grid_header_real_database_test.3 的当前独立事实为 resolve_label_and_width。 -->
database_grid_header_real_database_test.3 = resolve_label_and_width
<!-- database_grid_header_real_database_test.4 的当前独立事实为 visible_false_field_name_fallback。 -->
database_grid_header_real_database_test.4 = visible_false_field_name_fallback
<!-- database_grid_header_real_database_test.5 的当前独立事实为 logical_delete。 -->
database_grid_header_real_database_test.5 = logical_delete
<!-- database_grid_header_real_database_test.6 的当前独立事实为 remote_http_contract。 -->
database_grid_header_real_database_test.6 = remote_http_contract

## 验证

<!-- 公共层变更后至少执行 common-db 与 common-service 的真实数据库测试。 -->
shared_verification_required = common_db_real_database_tests
<!-- shared_verification_required.2 的当前独立事实为 common_service_real_database_tests。 -->
shared_verification_required.2 = common_service_real_database_tests
<!-- 首个或新增业务项目接入时必须执行该项目测试和 Host 聚合启动测试。 -->
project_verification_required = application_tests
<!-- project_verification_required.2 的当前独立事实为 host_aggregation_tests。 -->
project_verification_required.2 = host_aggregation_tests
<!-- 结构测试必须断言具体 DAO、项目 BaseDao 与公共 BaseDaoImpl 的三层继承关系。 -->
inheritance_boundary_test_required = true
