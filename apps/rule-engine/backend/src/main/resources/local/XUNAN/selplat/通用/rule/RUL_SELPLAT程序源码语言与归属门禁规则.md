# SELPLAT 程序源码语言与归属门禁规则

<!-- 本规则覆盖 SELPLAT 的 apps、shared 和 rule-engine 全部正式程序源码。 -->
rule_scope = active_user_selplat_all_program_source_ownership
<!-- 3.4.0 增加 MDA 新生成标准业务表默认字段的快速静态门禁。 -->
rule_version = 3.4.0
<!-- 规则所有者始终由 AGENTS.md 当前稳定用户动态解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示生产扫描能力、索引和测试已经形成闭环。 -->
rule_status = active
<!-- Java 能力由现有 Gradle 模块和 rule-engine 分层源码承载。 -->
java_ability_refs = none
<!-- 全工程源码归属由当前用户 Python 能力进行可重复审计。 -->
python_ability_refs = apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/selplat_source_ownership_guard.py
<!-- 当前规则不新增 Node 专用能力。 -->
node_ability_refs = none
<!-- 本规则来自 Japanese 应用误建未参与构建的 src/main/python 后的全工程防复发修正。 -->
upgrade_record = 2026-08-09:建立SELPLAT全部程序的语言白名单_源码归属预检_用户能力分层_实验工具隔离_字节码缓存定向_公共HTTP请求输出协议复用_无调用方表Domain禁止生成_受管工程技术层优先包结构和交付扫描门禁;2026-08-10:纠正受管数据库应用为业务目录优先_禁止顶层技术目录拆散同一表业务_common仅承载跨业务能力;2026-08-10:增加受管数据库应用common职责白名单和一业务一Service配对门禁_规则只检查抽象职责与真实结构不写死Japanese或具体能力名;2026-08-10:非生成数据库应用必须显式登记受管身份并扫描backend正式Java_避免contract误判和未授权工程被隐式纳管;2026-08-10:common_persistence只保留项目BaseDao和PersistenceConfiguration_限定名基础设施Bean替代数据库上下文包装类;2026-08-10:树_下拉_右键菜单按HTTP表示拆分Controller并共享同一业务Service;2026-08-10:受管数据库应用common外一级目录与真实schema表双向对应_表业务只允许controller_service_dao_common_util只供Service调用;2026-08-10:严格数据库应用固定db根文件_每张业务表对应CommonSequenceSegment唯一号段_业务主键禁止identity并支持多进程乐观锁抢号;2026-08-10:严格本地数据库模块属性默认账号密码固定sa和123456_正式空密码阻断;2026-08-10:严格数据库应用contract必须存在外部生产Java调用方_内部返回结构统一使用CommonResult和Map_List;2026-08-10:应用manifest必须显式登记真实src_main读取程序_禁止只保存身份和未来路由的无调用方目录;2026-08-10:数据库应用身份迁移到当前用户rule_engine中央登记_删除业务工程内可自删绕过的隐藏受管文件_MDA原子维护登记;2026-08-10:中央登记数据库应用根只允许真实工程组成_禁止contract_manifest_registry_temp和未来预留目录;2026-08-10:数据库应用禁止嵌套gitignore_H2运行文件统一由SELPLAT根排除;2026-08-10:增加数据库重建SQL静态门禁_阻断非幂等建表索引_破坏式刷新和覆盖式种子;2026-08-10:根Git规则必须放行apps正式mvdb_继续阻断trace_lock_temp;2026-08-10:禁止根mvdb通配忽略_确保编辑器显示所有正式数据库;2026-08-10:嵌套gitignore扫描扩展到全部apps_shared_关闭未中央登记模块绕过;2026-08-10:建立selplatQuickGate_selplatSpecialGate_selplatFullGate三级Gradle入口_根check统一执行全量门禁;2026-08-10:专项门禁从Gradle叶子项目动态发现apps_backend_未来项目加入settings后自动映射自身test;2026-08-10:MDA标准业务表默认字段进入快速静态门禁_阻断缺失中日英标签或回退name的生成模板

## 创建前分类

<!-- 新程序创建前必须确认生产调用方、构建入口和生命周期，无法确认时禁止进入 src/main。 -->
selplat_program_source_preflight = production_caller,build_entry,lifecycle_owner
<!-- 正式应用实现、规则能力和一次性工具必须使用互斥归属，禁止以方便为由混放。 -->
selplat_program_source_classification = application_runtime|rule_engine_ability|disposable_task_tool
<!-- 一次性或失败实验程序只能进入 OPTION/temp 的任务 tools 目录，禁止残留在正式源码树。 -->
selplat_disposable_program_root = <SELPLAT_ROOT>/OPTION/temp/<application>/<task>/tools

## 应用语言登记

<!-- apps 与 shared 中的普通 Gradle 后端当前默认只登记 Java 正式源码。 -->
selplat_standard_gradle_backend_language_allowlist = java
<!-- rule-engine 是唯一登记 Java、Python、Node 三种分层能力源码的模块。 -->
selplat_rule_engine_language_allowlist = java,python,node
<!-- 新增其他语言目录必须先建立构建调用链、运行入口、测试和明确登记，禁止仅创建目录即视为支持。 -->
selplat_new_language_registration_gate = build_integration,runtime_entry,ownership_rule,automated_test
<!-- 未登记的 src/main/python、src/main/node、src/main/swift 等语言根即使为空也属于结构污染。 -->
selplat_unregistered_language_root_policy = forbidden_even_when_empty

## rule-engine 分层

<!-- rule-engine 各语言源码必须位于统一 local/code 分层根。 -->
selplat_rule_engine_source_pattern = src/main/<language>/com/sp/selplat/local/code/<layer>/
<!-- 有效层只有 core、common 和从 AGENTS.md 动态解析的当前稳定用户。 -->
selplat_rule_engine_source_layers = core,common,<active-stable-user-id>
<!-- 当前用户可复用程序必须进入当前用户 abilities，禁止散落到业务应用的未登记语言目录。 -->
selplat_active_user_reusable_program_root = apps/rule-engine/backend/src/main/<language>/com/sp/selplat/local/code/<active-stable-user-id>/abilities/

## 自动门禁

<!-- 业务应用的单条、批量和分页请求必须复用 shared 已有公共参数容器。 -->
selplat_application_http_request_contract = CommonParam,CommonBatchParam,CommonPageParam
<!-- 业务应用的非分页和分页输出必须复用 shared 已有公共结果容器。 -->
selplat_application_http_response_contract = CommonResult,CommonPageResult,CommonStoreResult
<!-- apps 中禁止新建以 Request、Response、Result、Page 或 Param 结尾的专用 HTTP 协议类。 -->
selplat_application_private_http_protocol_type_policy = forbidden
<!-- 公共 CRUD 已使用 CommonParam、Map 和真实数据库元数据，apps 中禁止再生成无调用方的表镜像 Domain。 -->
selplat_application_table_domain_policy = forbidden_use_CommonParam_Map_database_metadata
<!-- 受管数据库应用必须先按真实 schema 表聚合，common 外不允许无表业务或技术扩展目录。 -->
selplat_managed_application_package_pattern = <table-business>/controller|service|dao,common/config|persistence|util/<actual-capability>
<!-- common 外一级表业务目录必须与 db/sql/schema-<Table>.sql 双向对应；应用名前缀可以在目录名中省略。 -->
selplat_table_business_schema_mapping = bidirectional,normalize_case_and_separator,allow_application_prefix_omission
<!-- 每个表业务恰好包含 controller、service、dao，Service 实现只允许位于 service/impl。 -->
selplat_table_business_role_set = controller,service,service/impl,dao,no_other_role
<!-- Controller 只调用本表 Service；Service 可调用本表 DAO、其他表 Service 和 common/util，禁止跨表直接调用 DAO。 -->
selplat_table_business_call_boundary = controller_to_own_service,service_to_own_dao,service_to_other_service,service_to_common_util,no_cross_table_dao
<!-- common/util 只提供无业务状态方法给 Service，不能声明 Controller、Service、DAO 或独立数据所有权。 -->
selplat_common_util_boundary = stateless_methods_for_service,no_controller,no_service_annotation,no_dao,no_table_ownership
<!-- Common 前缀基础设施表由 common/persistence 统一维护，不强制建立 common 外表业务目录。 -->
selplat_common_infrastructure_table_exception = table_name_prefix_Common,owner_common_persistence
<!-- 每个严格数据库应用的永久 H2 文件只能直接位于 db/<application-name>.mv.db，禁止再建立 db/data 或其他平行运行目录。 -->
selplat_managed_database_file_location = db/<application-name>.mv.db,no_nested_data_directory,no_parallel_migration_directory
<!-- 严格数据库应用中央登记必须声明 datasourcePrefix，正式模块属性按此前缀唯一配置 sa 与 123456，空密码直接阻断。 -->
selplat_managed_database_credential_gate = datasourcePrefix_required,username=sa,password=123456,production_empty_password_forbidden
<!-- 应用 contract 只有存在当前应用之外的真实生产 Java 调用方时才允许建立；内部返回结构使用公共结果和 Map/List，禁止为未来拆服务预留模块。 -->
selplat_managed_application_contract_gate = external_production_java_caller_required,no_future_placeholder,internal_shape_use_CommonResult_Map_List
<!-- 应用 manifest 只有存在真实 src/main 读取程序时才允许保留，中央登记必须用工程根相对 manifestConsumer 指向该读取文件。 -->
selplat_managed_application_manifest_gate = manifestConsumer_required,root_relative_reader_path,src_main_reader,manifest_module_json_read_evidence,no_metadata_placeholder
<!-- 严格数据库应用必须同时提供 CommonSequenceSegment 结构与数据脚本，由 common/persistence 绑定当前应用私有数据源。 -->
selplat_common_sequence_sql_requirement = schema-CommonSequenceSegment.sql,data-CommonSequenceSegment.sql,owner_common_persistence
<!-- 每张非 Common 业务表必须且只能对应一条 <TableName>Id 号段数据，禁止不同表共用 seqCode。 -->
selplat_table_sequence_mapping = one_business_table_one_sequence_row,seqCode=<TableName>Id,exactly_one_active_owner
<!-- CommonSequenceSegment 自身为避免循环依赖允许 identity；其他业务表 id 必须由公共 SequenceGenerator 生成。 -->
selplat_business_primary_key_strategy = CommonSequenceSegment:id_identity_exception,business_table:no_identity,use_shared_SequenceGenerator
<!-- 多进程实例从数据库通过 versionNo 乐观锁领取互不重叠号段；进程退出允许产生空洞但不得回退游标或重复主键。 -->
selplat_multi_process_sequence_policy = shared_database,optimistic_version_lock,disjoint_cached_ranges,no_nextStartId_rollback,gaps_allowed_duplicates_forbidden
<!-- 本结构只适用于显式登记或生成标记的数据库业务应用；Host、rule-engine、shared、contract、frontend 和一次性工具使用各自登记结构。 -->
selplat_table_business_structure_exempt_module_kinds = host,rule-engine,shared,contract,frontend,disposable-tool
<!-- 受管范围包含生成器所有权标记和当前用户中央登记；严格结构只由中央登记启用，删除应用内文件不得绕过。 -->
selplat_managed_database_application_detection = generated_project_ownership_marker|active_user_central_registry
<!-- 中央登记按 AGENTS 当前稳定用户动态定位，每个项目名只能出现一次，登记项目不存在也必须阻断。 -->
selplat_managed_database_application_registry = local/<active-stable-user-id>/selplat/通用/registry/managed-database-applications.json,version=1,unique_projectName,registered_project_required
<!-- 中央登记数据库应用根只允许真实工程组成；工程登记与规则不得回流应用，生成器所有权标记只服务追加表冲突保护。 -->
selplat_managed_database_application_root_allowlist = backend,frontend,db,doc,README.md,build.gradle,generated_project_ownership_marker,no_contract,no_manifest,no_registry,no_temp,no_placeholder
<!-- apps 与 shared 全部模块都不得散落 .gitignore；所有排除规则只维护在 SELPLAT 根，禁止依赖中央登记缩小扫描范围。 -->
selplat_nested_gitignore_policy = apps_and_shared_forbidden,use_SELPLAT_root_gitignore,scan_all_modules
<!-- 根忽略规则不得包含 mv.db 通配模式，保证编辑器显示全部正式数据库；只排除 H2 运行副产物。 -->
selplat_authoritative_database_git_tracking_gate = no_mvdb_ignore_pattern,all_mvdb_visible_and_trackable,ignore_trace,ignore_lock,ignore_temp
<!-- 启动 SQL 必须支持缺库重建和已有库幂等升级；禁止 DROP/TRUNCATE/DELETE、非幂等建表索引、MERGE 和覆盖式种子写入。 -->
selplat_managed_database_rebuild_sql_gate = schema_create_if_not_exists,index_create_if_not_exists,matching_data_file,seed_insert_where_not_exists,no_drop,no_truncate,no_delete,no_seed_update,no_seed_merge
<!-- MDA 标准业务表模板必须保留平台与中日英标签字段，快速门禁仅检查生成源，不破坏性迁移已有专用业务表。 -->
selplat_mda_generated_business_default_field_gate = tenantId,lastOperateUserId,sortnum,labelZh,labelJa,labelEn,status,createdAt,updatedAt,no_legacy_name,future_generated_tables_only
<!-- 结构门禁只分析应用 backend 正式 Java，跨模块 contract 继续按真实调用方独立维护。 -->
selplat_managed_database_application_scan_root = backend/src/main/java
<!-- 每个业务目录存在 Service 时必须且只能有一个接口和一个 impl 实现，禁止项目 BaseService 和单调用方中间 Service。 -->
selplat_managed_business_service_cardinality = one_contract,one_impl,no_common_service,no_common_crud
<!-- common 顶层只允许配置、持久化和按实际能力分类的 util；目录和能力名称必须来自真实调用关系，禁止预留空能力。 -->
selplat_managed_common_role_allowlist = config,persistence,util/<actual-capability>,no_placeholder
<!-- common/persistence 只保留项目 BaseDao 与持久化配置；DataSource、JdbcTemplate 和事务能力使用限定名 Bean，禁止再包装 Database 上下文类。 -->
selplat_managed_common_persistence_class_pattern = <project>BaseDao,<capability>PersistenceConfiguration,no_database_context_wrapper,use_qualified_infrastructure_beans
<!-- 树、下拉和右键菜单各自拥有真实表，因此必须进入自己的表业务 Controller、Service 和 DAO。 -->
selplat_query_representation_controller_boundary = tree:own_table_business,options:own_table_business,context-menu:own_table_business
<!-- 交付前必须扫描 apps 与 shared 的语言根、构建登记、rule-engine 分层和源码污染。 -->
selplat_source_ownership_delivery_scan = language_roots,gradle_registration,rule_engine_layers,application_http_protocol_types,application_table_domain_types,managed_application_package_structure,managed_common_roles,managed_business_service_cardinality,source_pollution
<!-- 正式源码树禁止出现 pyc、__pycache__、DS_Store 和其他生成缓存。 -->
selplat_source_tree_generated_file_policy = reject_pyc,reject_pycache,reject_DS_Store
<!-- Python 程序导入本地模块前必须将字节码缓存定向到工程 cache，禁止在源码旁生成。 -->
selplat_python_bytecode_cache_root = <SELPLAT_ROOT>/cache/python-pycache
<!-- 任一未登记语言目录、未知用户层、错误扩展名或源码缓存都会阻断任务完成。 -->
selplat_source_ownership_blocking_gate = zero_violations_required
<!-- 开发过程的快速门禁只运行生产结构扫描，不启动 Spring 或连接正式业务数据库。 -->
selplat_quick_gate_entry = ./gradlew selplatQuickGate,source_ownership_and_static_database_sql_gate,no_spring,no_formal_database_connection
<!-- 专项门禁从 Gradle 已登记 apps/<项目>/backend 叶子模块动态建立 scope 与 test 映射；无法分类或未提供范围时必须回退全部模块。 -->
selplat_special_gate_entry = ./gradlew selplatSpecialGate,dynamic_gradle_apps_backend_scope_to_own_test,unknown_or_empty_falls_back_all
<!-- 提交和重大重构前的全量门禁必须覆盖所有 Java 叶子模块 check、公共前端边界与全部规则 Python 测试。 -->
selplat_full_gate_entry = ./gradlew selplatFullGate,all_java_leaf_checks,sel_ui_boundary,all_rule_python_tests
<!-- 根 check 固定委托全量门禁；Python 启动器只允许通过 Gradle 属性或环境变量覆盖，禁止提交机器绝对路径。 -->
selplat_root_check_and_python_launcher = check_depends_on_full_gate,selplatPython_or_SELPLAT_PYTHON,no_machine_absolute_path
