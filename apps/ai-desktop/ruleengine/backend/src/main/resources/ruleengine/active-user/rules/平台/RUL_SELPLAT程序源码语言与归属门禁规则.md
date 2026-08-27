# SELPLAT 程序源码语言与归属门禁规则

<!-- active-user 物理目录的真实规则层始终从 AGENTS.md 当前稳定用户解析。 -->
rule_resource_layer_source = AGENTS.md.current_stable_user_id

<!-- 本规则覆盖 SELPLAT 的 apps、shared 和 rule-engine 全部正式程序源码。 -->
rule_scope = active_user_selplat_all_program_source_ownership
<!-- 3.15.0 在现有数据库应用中央登记中增加运行类型与数据库引擎，分流 Java/H2 和 Electron/SQLite 门禁。 -->
rule_version = 3.15.0
<!-- 非 Gradle 应用的语言所有权只能来自当前用户中央登记，禁止在扫描器中按项目名放行。 -->
program_language_application_registry = local/<active-stable-user-id>/selplat/通用/registry/program-language-applications.json
<!-- 每项登记必须同时指向真实构建材料、运行入口、测试入口和生命周期所有者。 -->
program_language_registration_required_evidence = languages,buildEntry,runtimeEntry,testEntry,lifecycleOwner
<!-- 本次升级阻断运行数据库因启动写入反复进入提交，同时保留SQL和说明材料的版本治理。 -->
upgrade_record_20260821_runtime_database_git_boundary = ignore_apps_db_mvdb_exactly,track_db_sql_and_docs,no_broad_mvdb_ignore
<!-- 规则所有者始终由 AGENTS.md 当前稳定用户动态解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示生产扫描能力、索引和测试已经形成闭环。 -->
rule_status = active
<!-- 本次升级删除中央登记 structure 开关和任何项目名放行；真实表、无状态能力与 common 三类职责对现在及未来全部应用一致生效。 -->
uniform_architecture_upgrade_record = 2026-08-11:no_registry_structure_switch
<!-- uniform_architecture_upgrade_record.2 的当前独立事实为 no_project_name_bypass。 -->
uniform_architecture_upgrade_record.2 = no_project_name_bypass
<!-- uniform_architecture_upgrade_record.3 的当前独立事实为 table_business_plus_capability_plus_common_for_all_projects。 -->
uniform_architecture_upgrade_record.3 = table_business_plus_capability_plus_common_for_all_projects
<!-- rule-engine 不承载 Java 能力，现有 Java 能力只属于其他已登记 Gradle 模块。 -->
java_ability_refs = none
<!-- 全工程源码归属由当前用户 Python 能力进行可重复审计。 -->
python_ability_refs = apps/ai-desktop/ruleengine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/selplat_source_ownership_guard.py
<!-- 当前规则不新增 Node 专用能力。 -->
node_ability_refs = none
<!-- 本规则来自 Japanese 应用误建未参与构建的 src/main/python 后的全工程防复发修正。 -->
upgrade_record = 2026-08-09:建立SELPLAT全部程序的语言白名单_源码归属预检_用户能力分层_实验工具隔离_字节码缓存定向_公共HTTP请求输出协议复用_无调用方表Domain禁止生成_受管工程技术层优先包结构和交付扫描门禁;2026-08-10:纠正受管数据库应用为业务目录优先_禁止顶层技术目录拆散同一表业务_common仅承载跨业务能力;2026-08-10:增加受管数据库应用common职责白名单和一业务一Service配对门禁_规则只检查抽象职责与真实结构不写死Japanese或具体能力名;2026-08-10:非生成数据库应用必须显式登记受管身份并扫描backend正式Java_避免contract误判和未授权工程被隐式纳管;2026-08-10:common_persistence只保留项目BaseDao和PersistenceConfiguration_限定名基础设施Bean替代数据库上下文包装类;2026-08-10:树_下拉_右键菜单按HTTP表示拆分Controller并共享同一业务Service;2026-08-10:受管数据库应用common外一级目录与真实schema表双向对应_表业务只允许controller_service_dao_common_util只供Service调用;2026-08-10:严格数据库应用固定db根文件_每张业务表对应CommonSequenceSegment唯一号段_业务主键禁止identity并支持多进程乐观锁抢号;2026-08-10:严格本地数据库模块属性默认账号密码固定sa和123456_正式空密码阻断;2026-08-10:严格数据库应用contract必须存在外部生产Java调用方_内部返回结构统一使用CommonResult和Map_List;2026-08-10:应用manifest必须显式登记真实src_main读取程序_禁止只保存身份和未来路由的无调用方目录;2026-08-10:数据库应用身份迁移到当前用户rule_engine中央登记_删除业务工程内可自删绕过的隐藏受管文件_MDA原子维护登记;2026-08-10:中央登记数据库应用根只允许真实工程组成_禁止contract_manifest_registry_temp和未来预留目录;2026-08-10:数据库应用禁止嵌套gitignore_H2运行文件统一由SELPLAT根排除;2026-08-10:增加数据库重建SQL静态门禁_阻断非幂等建表索引_破坏式刷新和覆盖式种子;2026-08-10:根Git规则必须放行apps正式mvdb_继续阻断trace_lock_temp;2026-08-10:禁止根mvdb通配忽略_确保编辑器显示所有正式数据库;2026-08-10:嵌套gitignore扫描扩展到全部apps_shared_关闭未中央登记模块绕过;2026-08-10:建立selplatQuickGate_selplatSpecialGate_selplatFullGate三级Gradle入口_根check统一执行全量门禁;2026-08-10:专项门禁从Gradle叶子项目动态发现apps_backend_未来项目加入settings后自动映射自身test;2026-08-10:MDA标准业务表默认字段进入快速静态门禁_阻断缺失中日英标签或回退name的生成模板;2026-08-11:公共控件中央登记_应用私造body门户和sel全局API阻断_生成模板硬依赖顺序检查;2026-08-11:中央登记应用增加具名Hikari私有池和无池数据源退化检查;2026-08-13:Windows_macOS路径判断统一使用语言原生Path组件_禁止固定斜杠字符串断言;2026-08-13:SEL_UI源码扫描阻断旧式平铺API_内核外Object.freeze_缺失selKernel和错误加载顺序;2026-08-14:应用_shared_生成模板统一阻断嵌套selFreeze_运行时控制器不作为深冻结边界;2026-08-15:中央登记增加全局code命名空间聚合号段策略_无种子业务表允许省略data文件_查询表示按真实持久化模型归属
<!-- 独立树升级记录固定类型和树节点各自拥有独立查询表示。 -->
upgrade_record_20260815_independent_tree = Type与TreeNode各自拥有独立查询表示_TreeNode禁止跨表DAO和typeId外键_使用code与parentId完成树查询

## 创建前分类

<!-- 新程序创建前必须确认生产调用方、构建入口和生命周期，无法确认时禁止进入 src/main。 -->
selplat_program_source_preflight = production_caller
<!-- selplat_program_source_preflight.2 的当前独立事实为 build_entry。 -->
selplat_program_source_preflight.2 = build_entry
<!-- selplat_program_source_preflight.3 的当前独立事实为 lifecycle_owner。 -->
selplat_program_source_preflight.3 = lifecycle_owner
<!-- 正式应用实现、规则能力和一次性工具必须使用互斥归属，禁止以方便为由混放。 -->
selplat_program_source_classification = application_runtime|rule_engine_ability|disposable_task_tool
<!-- 一次性或失败实验程序只能进入 OPTION/temp 的任务 tools 目录，禁止残留在正式源码树。 -->
selplat_disposable_program_root = <SELPLAT_ROOT>/OPTION/temp/<application>/<task>/tools
<!-- 应用、shared 和 Java 生成模板均由统一扫描阻断嵌套 selFreeze；只读配置和返回快照只能在完整最外层调用一次。 -->
selplat_nested_freeze_source_gate = applications
<!-- selplat_nested_freeze_source_gate.2 的当前独立事实为 shared。 -->
selplat_nested_freeze_source_gate.2 = shared
<!-- selplat_nested_freeze_source_gate.3 的当前独立事实为 java_generated_javascript。 -->
selplat_nested_freeze_source_gate.3 = java_generated_javascript
<!-- selplat_nested_freeze_source_gate.4 的当前独立事实为 zero_nested_selFreeze。 -->
selplat_nested_freeze_source_gate.4 = zero_nested_selFreeze

## 应用语言登记

<!-- apps 与 shared 中的普通 Gradle 后端当前默认只登记 Java 正式源码。 -->
selplat_standard_gradle_backend_language_allowlist = java
<!-- rule-engine 正式运行能力已统一为 Python。 -->
selplat_rule_engine_language_allowlist = python
<!-- 新增其他语言目录必须先建立构建调用链、运行入口、测试和明确登记，禁止仅创建目录即视为支持。 -->
selplat_new_language_registration_gate = build_integration
<!-- selplat_new_language_registration_gate.2 的当前独立事实为 runtime_entry。 -->
selplat_new_language_registration_gate.2 = runtime_entry
<!-- selplat_new_language_registration_gate.3 的当前独立事实为 ownership_rule。 -->
selplat_new_language_registration_gate.3 = ownership_rule
<!-- selplat_new_language_registration_gate.4 的当前独立事实为 automated_test。 -->
selplat_new_language_registration_gate.4 = automated_test
<!-- 未登记的 src/main/python、src/main/node、src/main/swift 等语言根即使为空也属于结构污染。 -->
selplat_unregistered_language_root_policy = forbidden_even_when_empty
<!-- 有真实非 Gradle 生命周期的应用可经中央登记取得语言所有权，但任一证据缺失时不得生效。 -->
selplat_non_gradle_application_language_registration = central_registry_with_all_existing_evidence

## rule-engine 分层

<!-- rule-engine 各语言源码必须位于统一 local/code 分层根。 -->
selplat_rule_engine_source_pattern = src/main/<language>/com/sp/selplat/local/code/<layer>/
<!-- 有效层只有 core、common 和从 AGENTS.md 动态解析的当前稳定用户。 -->
selplat_rule_engine_source_layers = core
<!-- selplat_rule_engine_source_layers.2 的当前独立事实为 common。 -->
selplat_rule_engine_source_layers.2 = common
<!-- selplat_rule_engine_source_layers.3 的当前独立事实为 <active-stable-user-id>。 -->
selplat_rule_engine_source_layers.3 = <active-stable-user-id>
<!-- 当前用户可复用程序必须进入当前用户 abilities，禁止散落到业务应用的未登记语言目录。 -->
selplat_active_user_reusable_program_root = apps/ai-desktop/ruleengine/backend/src/main/<language>/com/sp/selplat/local/code/<active-stable-user-id>/abilities/

<!-- rule-engine 自身运行基础设施允许进入新的独立 Python 包。 -->
selplat_rule_engine_infrastructure_source_root = apps/ai-desktop/ruleengine/backend/src/main/python/com/sp/selplat/ruleengine/

## 自动门禁

<!-- SELPLAT 程序与测试必须同时兼容 Windows 和 macOS 路径语义；业务含义是本机分隔符差异不能造成真实文件存在却被误判失败。 -->
selplat_supported_desktop_path_platforms = windows
<!-- selplat_supported_desktop_path_platforms.2 的当前独立事实为 macos。 -->
selplat_supported_desktop_path_platforms.2 = macos
<!-- Java 使用 java.nio.file.Path、Python 使用 pathlib.Path 比较路径组件或相对尾部，禁止把固定正斜杠或反斜杠字符串作为路径正确性依据。 -->
selplat_cross_platform_path_comparison = java.nio.file.Path
<!-- selplat_cross_platform_path_comparison.2 的当前独立事实为 python.pathlib.Path。 -->
selplat_cross_platform_path_comparison.2 = python.pathlib.Path
<!-- selplat_cross_platform_path_comparison.3 的当前独立事实为 component_or_relative_suffix。 -->
selplat_cross_platform_path_comparison.3 = component_or_relative_suffix
<!-- selplat_cross_platform_path_comparison.4 的当前独立事实为 no_fixed_separator_string_assertion。 -->
selplat_cross_platform_path_comparison.4 = no_fixed_separator_string_assertion

<!-- 业务应用的单条、批量和分页请求必须复用 shared 已有公共参数容器。 -->
selplat_application_http_request_contract = CommonParam
<!-- selplat_application_http_request_contract.2 的当前独立事实为 CommonBatchParam。 -->
selplat_application_http_request_contract.2 = CommonBatchParam
<!-- selplat_application_http_request_contract.3 的当前独立事实为 CommonPageParam。 -->
selplat_application_http_request_contract.3 = CommonPageParam
<!-- 业务应用的非分页和分页输出必须复用 shared 已有公共结果容器。 -->
selplat_application_http_response_contract = CommonResult
<!-- selplat_application_http_response_contract.2 的当前独立事实为 CommonPageResult。 -->
selplat_application_http_response_contract.2 = CommonPageResult
<!-- selplat_application_http_response_contract.3 的当前独立事实为 CommonStoreResult。 -->
selplat_application_http_response_contract.3 = CommonStoreResult
<!-- apps 中禁止新建以 Request、Response、Result、Page 或 Param 结尾的专用 HTTP 协议类。 -->
selplat_application_private_http_protocol_type_policy = forbidden
<!-- 公共 CRUD 已使用 CommonParam、Map 和真实数据库元数据，apps 中禁止再生成无调用方的表镜像 Domain。 -->
selplat_application_table_domain_policy = forbidden_use_CommonParam_Map_database_metadata
<!-- 受管数据库应用必须先按真实 schema 表聚合，common 外不允许无表业务或技术扩展目录。 -->
selplat_managed_application_package_pattern = <table-business>/controller|service|dao
<!-- selplat_managed_application_package_pattern.2 的当前独立事实为 common/config|persistence|util/<actual-capability>。 -->
selplat_managed_application_package_pattern.2 = common/config|persistence|util/<actual-capability>
<!-- common 外一级表业务目录必须与 db/sql/schema-<Table>.sql 双向对应；应用名前缀可以在目录名中省略。 -->
selplat_table_business_schema_mapping = bidirectional
<!-- selplat_table_business_schema_mapping.2 的当前独立事实为 normalize_case_and_separator。 -->
selplat_table_business_schema_mapping.2 = normalize_case_and_separator
<!-- selplat_table_business_schema_mapping.3 的当前独立事实为 allow_application_prefix_omission。 -->
selplat_table_business_schema_mapping.3 = allow_application_prefix_omission
<!-- 每个表业务恰好包含 controller、service、dao，Service 实现只允许位于 service/impl。 -->
selplat_table_business_role_set = controller
<!-- selplat_table_business_role_set.2 的当前独立事实为 service。 -->
selplat_table_business_role_set.2 = service
<!-- selplat_table_business_role_set.3 的当前独立事实为 service/impl。 -->
selplat_table_business_role_set.3 = service/impl
<!-- selplat_table_business_role_set.4 的当前独立事实为 dao。 -->
selplat_table_business_role_set.4 = dao
<!-- selplat_table_business_role_set.5 的当前独立事实为 no_other_role。 -->
selplat_table_business_role_set.5 = no_other_role
<!-- Controller 只调用本表 Service；Service 可调用本表 DAO、其他表 Service 和 common/util，禁止跨表直接调用 DAO。 -->
selplat_table_business_call_boundary = controller_to_own_service
<!-- selplat_table_business_call_boundary.2 的当前独立事实为 service_to_own_dao。 -->
selplat_table_business_call_boundary.2 = service_to_own_dao
<!-- selplat_table_business_call_boundary.3 的当前独立事实为 service_to_other_service。 -->
selplat_table_business_call_boundary.3 = service_to_other_service
<!-- selplat_table_business_call_boundary.4 的当前独立事实为 service_to_common_util。 -->
selplat_table_business_call_boundary.4 = service_to_common_util
<!-- selplat_table_business_call_boundary.5 的当前独立事实为 no_cross_table_dao。 -->
selplat_table_business_call_boundary.5 = no_cross_table_dao
<!-- common/util 只提供无业务状态方法给 Service，不能声明 Controller、Service、DAO 或独立数据所有权。 -->
selplat_common_util_boundary = stateless_methods_for_service
<!-- selplat_common_util_boundary.2 的当前独立事实为 no_controller。 -->
selplat_common_util_boundary.2 = no_controller
<!-- selplat_common_util_boundary.3 的当前独立事实为 no_service_annotation。 -->
selplat_common_util_boundary.3 = no_service_annotation
<!-- selplat_common_util_boundary.4 的当前独立事实为 no_dao。 -->
selplat_common_util_boundary.4 = no_dao
<!-- selplat_common_util_boundary.5 的当前独立事实为 no_table_ownership。 -->
selplat_common_util_boundary.5 = no_table_ownership
<!-- Common 前缀基础设施表由 common/persistence 统一维护，不强制建立 common 外表业务目录。 -->
selplat_common_infrastructure_table_exception = table_name_prefix_Common
<!-- selplat_common_infrastructure_table_exception.2 的当前独立事实为 owner_common_persistence。 -->
selplat_common_infrastructure_table_exception.2 = owner_common_persistence
<!-- 每个严格数据库应用的永久 H2 文件只能直接位于 db/<application-name>.mv.db，禁止再建立 db/data 或其他平行运行目录。 -->
selplat_managed_database_file_location = db/<application-name>.mv.db
<!-- selplat_managed_database_file_location.2 的当前独立事实为 no_nested_data_directory。 -->
selplat_managed_database_file_location.2 = no_nested_data_directory
<!-- selplat_managed_database_file_location.3 的当前独立事实为 no_parallel_migration_directory。 -->
selplat_managed_database_file_location.3 = no_parallel_migration_directory
<!-- 严格数据库应用中央登记必须声明 datasourcePrefix，正式模块属性按此前缀唯一配置 sa 与 123456，空密码直接阻断。 -->
selplat_managed_database_credential_gate = datasourcePrefix_required
<!-- selplat_managed_database_credential_gate.2 的当前独立事实为 username=sa。 -->
selplat_managed_database_credential_gate.2 = username=sa
<!-- selplat_managed_database_credential_gate.3 的当前独立事实为 password=123456。 -->
selplat_managed_database_credential_gate.3 = password=123456
<!-- selplat_managed_database_credential_gate.4 的当前独立事实为 production_empty_password_forbidden。 -->
selplat_managed_database_credential_gate.4 = production_empty_password_forbidden
<!-- 应用 contract 只有存在当前应用之外的真实生产 Java 调用方时才允许建立；内部返回结构使用公共结果和 Map/List，禁止为未来拆服务预留模块。 -->
selplat_managed_application_contract_gate = external_production_java_caller_required
<!-- selplat_managed_application_contract_gate.2 的当前独立事实为 no_future_placeholder。 -->
selplat_managed_application_contract_gate.2 = no_future_placeholder
<!-- selplat_managed_application_contract_gate.3 的当前独立事实为 internal_shape_use_CommonResult_Map_List。 -->
selplat_managed_application_contract_gate.3 = internal_shape_use_CommonResult_Map_List
<!-- 应用 manifest 只有存在真实 src/main 读取程序时才允许保留，中央登记必须用工程根相对 manifestConsumer 指向该读取文件。 -->
selplat_managed_application_manifest_gate = manifestConsumer_required
<!-- selplat_managed_application_manifest_gate.2 的当前独立事实为 root_relative_reader_path。 -->
selplat_managed_application_manifest_gate.2 = root_relative_reader_path
<!-- selplat_managed_application_manifest_gate.3 的当前独立事实为 src_main_reader。 -->
selplat_managed_application_manifest_gate.3 = src_main_reader
<!-- selplat_managed_application_manifest_gate.4 的当前独立事实为 manifest_module_json_read_evidence。 -->
selplat_managed_application_manifest_gate.4 = manifest_module_json_read_evidence
<!-- selplat_managed_application_manifest_gate.5 的当前独立事实为 no_metadata_placeholder。 -->
selplat_managed_application_manifest_gate.5 = no_metadata_placeholder
<!-- 严格数据库应用必须同时提供 CommonSequenceSegment 结构与数据脚本，由 common/persistence 绑定当前应用私有数据源。 -->
selplat_common_sequence_sql_requirement = schema-CommonSequenceSegment.sql
<!-- selplat_common_sequence_sql_requirement.2 的当前独立事实为 data-CommonSequenceSegment.sql。 -->
selplat_common_sequence_sql_requirement.2 = data-CommonSequenceSegment.sql
<!-- selplat_common_sequence_sql_requirement.3 的当前独立事实为 owner_common_persistence。 -->
selplat_common_sequence_sql_requirement.3 = owner_common_persistence
<!-- 默认应用保持一表一号段；只有中央登记声明 aggregate-global-code-sequence 且 globalCodeNamespace=true 时，才允许全部业务表共享唯一 aggregateSequenceCode。 -->
selplat_table_sequence_mapping = default:fully_empty_for_manual_setup_or_one_business_table_one_sequence_row(seqCode=<TableName>Id,no_partial_seed_set)
<!-- selplat_table_sequence_mapping.2 的当前独立事实为 aggregate-global-code-sequence:exactly_one_aggregateSequenceCode(globalCodeNamespace=true)。 -->
selplat_table_sequence_mapping.2 = aggregate-global-code-sequence:exactly_one_aggregateSequenceCode(globalCodeNamespace=true)
<!-- CommonSequenceSegment 自身为避免循环依赖允许 identity；其他业务表 id 必须由公共 SequenceGenerator 生成。 -->
selplat_business_primary_key_strategy = CommonSequenceSegment:id_identity_exception
<!-- selplat_business_primary_key_strategy.2 的当前独立事实为 business_table:no_identity。 -->
selplat_business_primary_key_strategy.2 = business_table:no_identity
<!-- selplat_business_primary_key_strategy.3 的当前独立事实为 use_shared_SequenceGenerator。 -->
selplat_business_primary_key_strategy.3 = use_shared_SequenceGenerator
<!-- 多进程实例从数据库通过 versionNo 乐观锁领取互不重叠号段；进程退出允许产生空洞但不得回退游标或重复主键。 -->
selplat_multi_process_sequence_policy = shared_database
<!-- selplat_multi_process_sequence_policy.2 的当前独立事实为 optimistic_version_lock。 -->
selplat_multi_process_sequence_policy.2 = optimistic_version_lock
<!-- selplat_multi_process_sequence_policy.3 的当前独立事实为 disjoint_cached_ranges。 -->
selplat_multi_process_sequence_policy.3 = disjoint_cached_ranges
<!-- selplat_multi_process_sequence_policy.4 的当前独立事实为 no_nextStartId_rollback。 -->
selplat_multi_process_sequence_policy.4 = no_nextStartId_rollback
<!-- selplat_multi_process_sequence_policy.5 的当前独立事实为 gaps_allowed_duplicates_forbidden。 -->
selplat_multi_process_sequence_policy.5 = gaps_allowed_duplicates_forbidden
<!-- 本结构只适用于显式登记或生成标记的数据库业务应用；Host、rule-engine、shared、contract、frontend 和一次性工具使用各自登记结构。 -->
selplat_table_business_structure_exempt_module_kinds = host
<!-- selplat_table_business_structure_exempt_module_kinds.2 的当前独立事实为 rule-engine。 -->
selplat_table_business_structure_exempt_module_kinds.2 = rule-engine
<!-- selplat_table_business_structure_exempt_module_kinds.3 的当前独立事实为 shared。 -->
selplat_table_business_structure_exempt_module_kinds.3 = shared
<!-- selplat_table_business_structure_exempt_module_kinds.4 的当前独立事实为 contract。 -->
selplat_table_business_structure_exempt_module_kinds.4 = contract
<!-- selplat_table_business_structure_exempt_module_kinds.5 的当前独立事实为 frontend。 -->
selplat_table_business_structure_exempt_module_kinds.5 = frontend
<!-- selplat_table_business_structure_exempt_module_kinds.6 的当前独立事实为 disposable-tool。 -->
selplat_table_business_structure_exempt_module_kinds.6 = disposable-tool
<!-- 任何拥有 db/sql、生成器所有权标记或中央登记的应用都必须进入同一中央登记；删除标记或漏登记不得绕过。 -->
selplat_managed_database_application_detection = db_sql_directory|generated_project_ownership_marker|active_user_central_registry
<!-- selplat_managed_database_application_detection.2 的当前独立事实为 central_registration_required_for_all。 -->
selplat_managed_database_application_detection.2 = central_registration_required_for_all
<!-- 中央登记必须显式声明应用运行类型，禁止扫描器依据目录名称推断。 -->
selplat_managed_database_runtime_type = java-gradle|electron
<!-- 中央登记必须显式声明数据库引擎，禁止把所有 db/sql 自动解释为 H2。 -->
selplat_managed_database_engine = h2|sqlite
<!-- Java Gradle 与 H2 组合继续执行 Hikari、号段、DAO、Service 和业务表结构门禁。 -->
selplat_managed_database_governance_route = java-gradle+h2:java_h2_uniform_architecture
<!-- Electron 与 SQLite 组合执行固定路径配置、迁移清单、单连接和恢复合同，不套用 Java 业务分层。 -->
selplat_managed_database_governance_route.2 = electron+sqlite:electron_sqlite_persistence_contract
<!-- 未登记的 db/sql 无论属于何种运行时都必须阻断，禁止靠非 Gradle 身份跳过数据库治理。 -->
selplat_unregistered_database_runtime_policy = block_and_require_central_registration
<!-- 中央登记按 AGENTS 当前稳定用户动态定位，每个项目名只能出现一次，登记项目不存在也必须阻断。 -->
selplat_managed_database_application_registry = local/<active-stable-user-id>/selplat/通用/registry/managed-database-applications.json
<!-- selplat_managed_database_application_registry.2 的当前独立事实为 version=1。 -->
selplat_managed_database_application_registry.2 = version=1
<!-- selplat_managed_database_application_registry.3 的当前独立事实为 unique_projectName。 -->
selplat_managed_database_application_registry.3 = unique_projectName
<!-- selplat_managed_database_application_registry.4 的当前独立事实为 registered_project_required。 -->
selplat_managed_database_application_registry.4 = registered_project_required
<!-- 中央登记数据库应用根只允许真实工程组成；工程登记与规则不得回流应用，生成器所有权标记只服务追加表冲突保护。 -->
selplat_managed_database_application_root_allowlist = backend
<!-- selplat_managed_database_application_root_allowlist.2 的当前独立事实为 frontend。 -->
selplat_managed_database_application_root_allowlist.2 = frontend
<!-- selplat_managed_database_application_root_allowlist.3 的当前独立事实为 db。 -->
selplat_managed_database_application_root_allowlist.3 = db
<!-- selplat_managed_database_application_root_allowlist.4 的当前独立事实为 doc。 -->
selplat_managed_database_application_root_allowlist.4 = doc
<!-- selplat_managed_database_application_root_allowlist.5 的当前独立事实为 README.md。 -->
selplat_managed_database_application_root_allowlist.5 = README.md
<!-- selplat_managed_database_application_root_allowlist.6 的当前独立事实为 build.gradle。 -->
selplat_managed_database_application_root_allowlist.6 = build.gradle
<!-- selplat_managed_database_application_root_allowlist.7 的当前独立事实为 generated_project_ownership_marker。 -->
selplat_managed_database_application_root_allowlist.7 = generated_project_ownership_marker
<!-- selplat_managed_database_application_root_allowlist.8 的当前独立事实为 no_contract。 -->
selplat_managed_database_application_root_allowlist.8 = no_contract
<!-- selplat_managed_database_application_root_allowlist.9 的当前独立事实为 no_manifest。 -->
selplat_managed_database_application_root_allowlist.9 = no_manifest
<!-- selplat_managed_database_application_root_allowlist.10 的当前独立事实为 no_registry。 -->
selplat_managed_database_application_root_allowlist.10 = no_registry
<!-- selplat_managed_database_application_root_allowlist.11 的当前独立事实为 no_temp。 -->
selplat_managed_database_application_root_allowlist.11 = no_temp
<!-- selplat_managed_database_application_root_allowlist.12 的当前独立事实为 no_placeholder。 -->
selplat_managed_database_application_root_allowlist.12 = no_placeholder
<!-- apps 与 shared 全部模块都不得散落 .gitignore；所有排除规则只维护在 SELPLAT 根，禁止依赖中央登记缩小扫描范围。 -->
selplat_nested_gitignore_policy = apps_and_shared_forbidden
<!-- selplat_nested_gitignore_policy.2 的当前独立事实为 use_SELPLAT_root_gitignore。 -->
selplat_nested_gitignore_policy.2 = use_SELPLAT_root_gitignore
<!-- selplat_nested_gitignore_policy.3 的当前独立事实为 scan_all_modules。 -->
selplat_nested_gitignore_policy.3 = scan_all_modules
<!-- 根忽略规则必须精确排除 apps/*/db/*.mv.db，避免活跃运行库因启动写入反复进入提交。 -->
selplat_authoritative_database_git_tracking_gate = ignore_apps_db_runtime_mvdb_exactly
<!-- selplat_authoritative_database_git_tracking_gate.2 的当前独立事实为 db_sql_and_docs_trackable。 -->
selplat_authoritative_database_git_tracking_gate.2 = db_sql_and_docs_trackable
<!-- selplat_authoritative_database_git_tracking_gate.3 的当前独立事实为 ignore_trace。 -->
selplat_authoritative_database_git_tracking_gate.3 = ignore_trace
<!-- selplat_authoritative_database_git_tracking_gate.4 的当前独立事实为 ignore_lock。 -->
selplat_authoritative_database_git_tracking_gate.4 = ignore_lock
<!-- selplat_authoritative_database_git_tracking_gate.5 的当前独立事实为 ignore_temp。 -->
selplat_authoritative_database_git_tracking_gate.5 = ignore_temp
<!-- 禁止使用 *.mv.db 或 **/*.mv.db 宽泛规则，避免隐藏应用db根之外的受审数据库材料。 -->
selplat_authoritative_database_git_tracking_gate.6 = no_broad_mvdb_ignore_pattern
<!-- 启动 SQL 必须支持缺库重建和已有库幂等升级；禁止 DROP/TRUNCATE/DELETE、非幂等建表索引、MERGE 和覆盖式种子写入。 -->
selplat_managed_database_rebuild_sql_gate = schema_create_if_not_exists
<!-- selplat_managed_database_rebuild_sql_gate.2 的当前独立事实为 index_create_if_not_exists。 -->
selplat_managed_database_rebuild_sql_gate.2 = index_create_if_not_exists
<!-- selplat_managed_database_rebuild_sql_gate.3 的当前独立事实为 data_file_required_only_when_seed_exists。 -->
selplat_managed_database_rebuild_sql_gate.3 = data_file_required_only_when_seed_exists
<!-- selplat_managed_database_rebuild_sql_gate.4 的当前独立事实为 seed_insert_where_not_exists。 -->
selplat_managed_database_rebuild_sql_gate.4 = seed_insert_where_not_exists
<!-- selplat_managed_database_rebuild_sql_gate.5 的当前独立事实为 no_drop。 -->
selplat_managed_database_rebuild_sql_gate.5 = no_drop
<!-- selplat_managed_database_rebuild_sql_gate.6 的当前独立事实为 no_truncate。 -->
selplat_managed_database_rebuild_sql_gate.6 = no_truncate
<!-- selplat_managed_database_rebuild_sql_gate.7 的当前独立事实为 no_delete。 -->
selplat_managed_database_rebuild_sql_gate.7 = no_delete
<!-- selplat_managed_database_rebuild_sql_gate.8 的当前独立事实为 no_seed_update。 -->
selplat_managed_database_rebuild_sql_gate.8 = no_seed_update
<!-- selplat_managed_database_rebuild_sql_gate.9 的当前独立事实为 no_seed_merge。 -->
selplat_managed_database_rebuild_sql_gate.9 = no_seed_merge
<!-- SELPLAT 应用脚手架的标准业务表模板必须保留平台与中日英标签字段；规则按生成能力识别，不按承载生成器的项目名建立专属门禁。 -->
selplat_application_scaffold_generated_business_default_field_gate = tenantId
<!-- selplat_application_scaffold_generated_business_default_field_gate.2 的当前独立事实为 lastOperateUserId。 -->
selplat_application_scaffold_generated_business_default_field_gate.2 = lastOperateUserId
<!-- selplat_application_scaffold_generated_business_default_field_gate.3 的当前独立事实为 sortnum。 -->
selplat_application_scaffold_generated_business_default_field_gate.3 = sortnum
<!-- selplat_application_scaffold_generated_business_default_field_gate.4 的当前独立事实为 labelZh。 -->
selplat_application_scaffold_generated_business_default_field_gate.4 = labelZh
<!-- selplat_application_scaffold_generated_business_default_field_gate.5 的当前独立事实为 labelJa。 -->
selplat_application_scaffold_generated_business_default_field_gate.5 = labelJa
<!-- selplat_application_scaffold_generated_business_default_field_gate.6 的当前独立事实为 labelEn。 -->
selplat_application_scaffold_generated_business_default_field_gate.6 = labelEn
<!-- selplat_application_scaffold_generated_business_default_field_gate.7 的当前独立事实为 status。 -->
selplat_application_scaffold_generated_business_default_field_gate.7 = status
<!-- selplat_application_scaffold_generated_business_default_field_gate.8 的当前独立事实为 createdAt。 -->
selplat_application_scaffold_generated_business_default_field_gate.8 = createdAt
<!-- selplat_application_scaffold_generated_business_default_field_gate.9 的当前独立事实为 updatedAt。 -->
selplat_application_scaffold_generated_business_default_field_gate.9 = updatedAt
<!-- selplat_application_scaffold_generated_business_default_field_gate.10 的当前独立事实为 no_legacy_name。 -->
selplat_application_scaffold_generated_business_default_field_gate.10 = no_legacy_name
<!-- selplat_application_scaffold_generated_business_default_field_gate.11 的当前独立事实为 future_generated_tables_only。 -->
selplat_application_scaffold_generated_business_default_field_gate.11 = future_generated_tables_only
<!-- selplat_application_scaffold_generated_business_default_field_gate.12 的当前独立事实为 no_host_project_exception。 -->
selplat_application_scaffold_generated_business_default_field_gate.12 = no_host_project_exception
<!-- 结构门禁只分析应用 backend 正式 Java，跨模块 contract 继续按真实调用方独立维护。 -->
selplat_managed_database_application_scan_root = backend/src/main/java
<!-- 每个业务目录存在 Service 时必须且只能有一个接口和一个 impl 实现，禁止项目 BaseService 和单调用方中间 Service。 -->
selplat_managed_business_service_cardinality = one_contract
<!-- selplat_managed_business_service_cardinality.2 的当前独立事实为 one_impl。 -->
selplat_managed_business_service_cardinality.2 = one_impl
<!-- selplat_managed_business_service_cardinality.3 的当前独立事实为 no_common_service。 -->
selplat_managed_business_service_cardinality.3 = no_common_service
<!-- selplat_managed_business_service_cardinality.4 的当前独立事实为 no_common_crud。 -->
selplat_managed_business_service_cardinality.4 = no_common_crud
<!-- common 顶层只允许配置、持久化和按实际能力分类的 util；目录和能力名称必须来自真实调用关系，禁止预留空能力。 -->
selplat_managed_common_role_allowlist = config
<!-- selplat_managed_common_role_allowlist.2 的当前独立事实为 persistence。 -->
selplat_managed_common_role_allowlist.2 = persistence
<!-- selplat_managed_common_role_allowlist.3 的当前独立事实为 util/<actual-capability>。 -->
selplat_managed_common_role_allowlist.3 = util/<actual-capability>
<!-- selplat_managed_common_role_allowlist.4 的当前独立事实为 no_placeholder。 -->
selplat_managed_common_role_allowlist.4 = no_placeholder
<!-- 不对应数据库表的正式功能统一进入 capability/<能力>/controller|service；所有项目使用同一结构，DAO 与复用实现不得进入 capability。 -->
selplat_managed_non_persistent_capability_structure = capability/<actual-capability>/controller|service
<!-- selplat_managed_non_persistent_capability_structure.2 的当前独立事实为 one_service_contract。 -->
selplat_managed_non_persistent_capability_structure.2 = one_service_contract
<!-- selplat_managed_non_persistent_capability_structure.3 的当前独立事实为 one_service_impl。 -->
selplat_managed_non_persistent_capability_structure.3 = one_service_impl
<!-- selplat_managed_non_persistent_capability_structure.4 的当前独立事实为 no_dao。 -->
selplat_managed_non_persistent_capability_structure.4 = no_dao
<!-- selplat_managed_non_persistent_capability_structure.5 的当前独立事实为 reusable_helpers_to_common_util。 -->
selplat_managed_non_persistent_capability_structure.5 = reusable_helpers_to_common_util
<!-- selplat_managed_non_persistent_capability_structure.6 的当前独立事实为 no_project_name_branch。 -->
selplat_managed_non_persistent_capability_structure.6 = no_project_name_branch
<!-- common/persistence 只保留项目 BaseDao 与持久化配置；DataSource、JdbcTemplate 和事务能力使用限定名 Bean，禁止再包装 Database 上下文类。 -->
selplat_managed_common_persistence_class_pattern = <project>BaseDao
<!-- selplat_managed_common_persistence_class_pattern.2 的当前独立事实为 <capability>PersistenceConfiguration。 -->
selplat_managed_common_persistence_class_pattern.2 = <capability>PersistenceConfiguration
<!-- selplat_managed_common_persistence_class_pattern.3 的当前独立事实为 no_database_context_wrapper。 -->
selplat_managed_common_persistence_class_pattern.3 = no_database_context_wrapper
<!-- selplat_managed_common_persistence_class_pattern.4 的当前独立事实为 use_qualified_infrastructure_beans。 -->
selplat_managed_common_persistence_class_pattern.4 = use_qualified_infrastructure_beans
<!-- 表业务 Service 与不落库 capability Service 只允许通过业务 Service/BaseDao 编排查询；JdbcTemplate 只属于持久化初始化和迁移基础设施。 -->
selplat_application_service_database_access = business_service_or_BaseDao_only
<!-- selplat_application_service_database_access.2 的当前独立事实为 no_direct_JdbcTemplate_in_service。 -->
selplat_application_service_database_access.2 = no_direct_JdbcTemplate_in_service
<!-- selplat_application_service_database_access.3 的当前独立事实为 JdbcTemplate_allowed_only_in_persistence_or_migration。 -->
selplat_application_service_database_access.3 = JdbcTemplate_allowed_only_in_persistence_or_migration
<!-- 查询表示按真实持久化模型归属；Type 维护分类目录，TreeNode 独立通过 code 与 parentId 建树，禁止跨表 DAO 或类型外键重新制造耦合。 -->
selplat_query_representation_controller_boundary = own_table_when_distinct_persistence_model
<!-- selplat_query_representation_controller_boundary.2 的当前独立事实为 type_catalog_independent。 -->
selplat_query_representation_controller_boundary.2 = type_catalog_independent
<!-- selplat_query_representation_controller_boundary.3 的当前独立事实为 tree_node_code_plus_parentId_independent。 -->
selplat_query_representation_controller_boundary.3 = tree_node_code_plus_parentId_independent
<!-- selplat_query_representation_controller_boundary.4 的当前独立事实为 no_cross_table_dao。 -->
selplat_query_representation_controller_boundary.4 = no_cross_table_dao
<!-- selplat_query_representation_controller_boundary.5 的当前独立事实为 no_type_foreign_key。 -->
selplat_query_representation_controller_boundary.5 = no_type_foreign_key
<!-- selplat_query_representation_controller_boundary.6 的当前独立事实为 no_ui_name_driven_duplicate_table_business。 -->
selplat_query_representation_controller_boundary.6 = no_ui_name_driven_duplicate_table_business
<!-- 交付前必须扫描 apps 与 shared 的语言根、构建登记、rule-engine 分层和源码污染。 -->
selplat_source_ownership_delivery_scan = language_roots
<!-- selplat_source_ownership_delivery_scan.2 的当前独立事实为 gradle_registration。 -->
selplat_source_ownership_delivery_scan.2 = gradle_registration
<!-- selplat_source_ownership_delivery_scan.3 的当前独立事实为 rule_engine_layers。 -->
selplat_source_ownership_delivery_scan.3 = rule_engine_layers
<!-- selplat_source_ownership_delivery_scan.4 的当前独立事实为 application_http_protocol_types。 -->
selplat_source_ownership_delivery_scan.4 = application_http_protocol_types
<!-- selplat_source_ownership_delivery_scan.5 的当前独立事实为 application_table_domain_types。 -->
selplat_source_ownership_delivery_scan.5 = application_table_domain_types
<!-- selplat_source_ownership_delivery_scan.6 的当前独立事实为 managed_application_package_structure。 -->
selplat_source_ownership_delivery_scan.6 = managed_application_package_structure
<!-- selplat_source_ownership_delivery_scan.7 的当前独立事实为 managed_common_roles。 -->
selplat_source_ownership_delivery_scan.7 = managed_common_roles
<!-- selplat_source_ownership_delivery_scan.8 的当前独立事实为 managed_business_service_cardinality。 -->
selplat_source_ownership_delivery_scan.8 = managed_business_service_cardinality
<!-- selplat_source_ownership_delivery_scan.9 的当前独立事实为 sel_ui_component_registry_and_application_private_control。 -->
selplat_source_ownership_delivery_scan.9 = sel_ui_component_registry_and_application_private_control
<!-- selplat_source_ownership_delivery_scan.10 的当前独立事实为 source_pollution。 -->
selplat_source_ownership_delivery_scan.10 = source_pollution
<!-- 正式源码树禁止出现 pyc、__pycache__、DS_Store 和其他生成缓存。 -->
selplat_source_tree_generated_file_policy = reject_pyc
<!-- selplat_source_tree_generated_file_policy.2 的当前独立事实为 reject_pycache。 -->
selplat_source_tree_generated_file_policy.2 = reject_pycache
<!-- selplat_source_tree_generated_file_policy.3 的当前独立事实为 reject_DS_Store。 -->
selplat_source_tree_generated_file_policy.3 = reject_DS_Store
<!-- Python 程序导入本地模块前必须将字节码缓存定向到工程 cache，禁止在源码旁生成。 -->
selplat_python_bytecode_cache_root = <SELPLAT_ROOT>/cache/python-pycache
<!-- 任一未登记语言目录、未知用户层、错误扩展名或源码缓存都会阻断任务完成。 -->
selplat_source_ownership_blocking_gate = zero_violations_required
<!-- 开发过程的快速门禁只运行生产结构扫描，不启动 Spring 或连接正式业务数据库。 -->
selplat_quick_gate_entry = ./gradlew selplatQuickGate
<!-- selplat_quick_gate_entry.2 的当前独立事实为 source_ownership_static_database_sql_and_component_governance_gate。 -->
selplat_quick_gate_entry.2 = source_ownership_static_database_sql_and_component_governance_gate
<!-- selplat_quick_gate_entry.3 的当前独立事实为 no_spring。 -->
selplat_quick_gate_entry.3 = no_spring
<!-- selplat_quick_gate_entry.4 的当前独立事实为 no_formal_database_connection。 -->
selplat_quick_gate_entry.4 = no_formal_database_connection
<!-- 专项门禁从 Gradle 已登记 Java 应用动态建立 scope 与 test 映射。 -->
selplat_special_gate_entry = ./gradlew selplatSpecialGate
<!-- selplat_special_gate_entry.2 的当前独立事实为 dynamic_gradle_apps_backend_scope_to_own_test。 -->
selplat_special_gate_entry.2 = dynamic_gradle_apps_backend_scope_to_own_test
<!-- selplat_special_gate_entry.3 的当前独立事实为 unknown_or_empty_falls_back_all。 -->
selplat_special_gate_entry.3 = unknown_or_empty_falls_back_all
<!-- selplat_special_gate_entry.4 的当前独立事实为 rule-engine 通过根任务直接执行 Python 测试而不注册 Gradle 子项目。 -->
selplat_special_gate_entry.4 = rule_engine_direct_python_without_gradle_subproject
<!-- 提交和重大重构前的全量门禁必须覆盖所有 Java 叶子模块 check、公共前端边界与全部规则 Python 测试。 -->
selplat_full_gate_entry = ./gradlew selplatFullGate
<!-- selplat_full_gate_entry.2 的当前独立事实为 all_java_leaf_checks。 -->
selplat_full_gate_entry.2 = all_java_leaf_checks
<!-- selplat_full_gate_entry.3 的当前独立事实为 sel_ui_boundary。 -->
selplat_full_gate_entry.3 = sel_ui_boundary
<!-- selplat_full_gate_entry.4 的当前独立事实为 all_rule_python_tests。 -->
selplat_full_gate_entry.4 = all_rule_python_tests
<!-- 根 check 固定委托全量门禁；Python 启动器只允许通过 Gradle 属性或环境变量覆盖，禁止提交机器绝对路径。 -->
selplat_root_check_and_python_launcher = check_depends_on_full_gate
<!-- selplat_root_check_and_python_launcher.2 的当前独立事实为 selplatPython_or_SELPLAT_PYTHON。 -->
selplat_root_check_and_python_launcher.2 = selplatPython_or_SELPLAT_PYTHON
<!-- selplat_root_check_and_python_launcher.3 的当前独立事实为 no_machine_absolute_path。 -->
selplat_root_check_and_python_launcher.3 = no_machine_absolute_path
