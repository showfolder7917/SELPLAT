# SELPLAT 应用脚手架生成规则

<!-- 当前规则由 MDA Java 生成器执行，因此同时登记稳定接口与 Spring 实现能力。 -->
java_ability_refs = apps/mda/backend/src/main/java/com/sp/selplat/mda/capability/projectgenerator/service/MdaProjectGeneratorService.java,apps/mda/backend/src/main/java/com/sp/selplat/mda/capability/projectgenerator/service/impl/MdaProjectGeneratorServiceImpl.java
<!-- 当前规则不需要 Python 能力；生成、冲突检查和回滚均在运行中的 MDA Java 服务内完成。 -->
python_ability_refs = none
<!-- 页面脚本由模板生成并使用现有浏览器与前端语法验证，不登记额外 Node 能力。 -->
node_ability_refs = none
<!-- 本版将新生成标准业务表的中日英标签与平台默认字段纳入生成和快速门禁。 -->
rule_version = 1.13.0
<!-- 规则所有者始终由 AGENTS.md 当前稳定用户动态解析，未经审查不得提升到 common。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示规则、生成器、索引和真实隔离文件测试已经形成闭环。 -->
rule_status = active
<!-- 本规则来源于用户要求从 uniauth 抽取模板并让后续 AI 可重复接手。 -->
upgrade_record = 2026-08-09:建立SELPLAT工程与业务表脚手架生成_冲突保护_reference-data扩展和左树右表页面规则;2026-08-09:修正MDA生成器具体类冒充Service接口并增加接口实现目录_Controller依赖和模板输出的自动门禁;2026-08-09:修正独立启动误扫描公共DAO_引用数据接口未装配和纯注释空数据脚本启动失败并增加真实启动门禁;2026-08-09:修正只登记Host依赖却遗漏桌面入口和同源路径白名单_将统一桌面闭环加入原子生成与构建门禁;2026-08-09:修正生成页面只加载单一皮肤并手写树_表格_窗口_改为完整SEL主题运行时和公共控件装配并增加模板输出门禁;2026-08-09:修正MDA自建Request_Result协议_统一复用CommonParam_CommonResult并增加生成门禁;2026-08-10:删除无调用方表Domain模板_统一使用CommonParam_Map_真实数据库元数据;2026-08-10:将生成包结构统一为技术层优先_层内按业务分目录_通用能力进入common;2026-08-10:以Uniauth为准改为数据库业务目录优先_Controller_Service_DAO_Reference聚合到同一业务_common只保存跨业务能力;2026-08-10:抽象SELPLAT数据库应用职责门禁_一业务一Service_common仅config_persistence_util_能力与框架扩展必须有真实需求后创建;2026-08-10:新工程原子写入rule_engine中央数据库应用登记_停止生成无读取方manifest目录;2026-08-10:号段种子由MERGE改为INSERT_WHERE_NOT_EXISTS_禁止重启覆盖游标和版本;2026-08-10:新生成标准业务表统一中日英标签与平台默认字段_生成器测试和快速门禁同步阻断旧name字段;2026-08-11:生成器作为全项目无状态能力进入统一capability分层_取消宿主项目专属结构口径

<!-- 问题：手工复制既有应用容易遗漏项目数据源、号段、Host 登记、SQL 顺序、默认审计字段或页面资源，也容易无需求预留公共层和框架扩展。 -->
<!-- 场景：在 SELPLAT apps 下新建业务工程，或向已由脚手架创建的工程追加一张业务表。 -->
<!-- 业务含义：两个稳定输入即可生成可编译、可启动、可继续扩展且不会覆盖既有文件的完整业务骨架。 -->

## 规则包组成

<!-- 工程模板以 MDA Java 模板目录为唯一实现，禁止运行时直接复制和改写 uniauth 现有业务文件。 -->
template_implementation = apps/mda/backend/src/main/java/com/sp/selplat/mda/common/util/projectgenerator/MdaProjectTemplateCatalog.java
<!-- uniauth 只提供分层、注释、私有数据源和静态资源命名的已验证参考，不作为运行时可变源目录。 -->
verified_reference_application = apps/uniauth
<!-- MDA 工程生成接口是页面和后续 AI 调用的唯一稳定契约。 -->
generator_contract = apps/mda/backend/src/main/java/com/sp/selplat/mda/capability/projectgenerator/service/MdaProjectGeneratorService.java
<!-- MDA 工程生成实现是唯一执行文件写入的 Spring Service。 -->
generator_program = apps/mda/backend/src/main/java/com/sp/selplat/mda/capability/projectgenerator/service/impl/MdaProjectGeneratorServiceImpl.java
<!-- 交付验证必须覆盖隔离目录生成、追加表、重复目标无覆盖、路径逃逸拒绝、MDA 编译和真实页面窗口。 -->
verification_scope = isolated_project_generation,table_append,no_table_domain,no_overwrite_collision,path_escape_rejection,service_architecture_gate,mda_compile,real_browser_window

## 输入、命名与所有权

<!-- 创建入口固定接收工程名和表名两个字段；首次提交创建完整工程，既有受管工程提交创建新表。 -->
selplat_scaffold_required_inputs = projectName,tableName
<!-- MDA 创建入口必须复用 shared 公共参数和公共输出，禁止生成或维护专用 Request、Response、Result、Page、Param 协议类。 -->
selplat_scaffold_http_contract = CommonParam,CommonResult,no_private_Request_Response_Result_Page_Param
<!-- 工程名和表名只允许小写字母、数字和短横线，必须以字母开头且最长三十二位。 -->
selplat_scaffold_code_pattern = [a-z][a-z0-9-]{0,31}
<!-- Java 类和真实表名由短横线编码转换为 PascalCase，真实表名固定为工程类名加表类名。 -->
selplat_scaffold_actual_table_naming = PascalCase(projectName)+PascalCase(tableName)
<!-- 生成器必须在工程根写所有权标记；没有标记的同名工程视为用户既有工程并拒绝追加。 -->
selplat_scaffold_project_ownership_marker = apps/<projectName>/.selplat-generated-project.json
<!-- 任一目标文件已存在时整次操作拒绝，禁止覆盖、合并猜测或只生成剩余文件。 -->
selplat_scaffold_existing_target_policy = reject_entire_operation_without_overwrite
<!-- 所有派生路径规范化后必须仍位于当前 SELPLAT 根内，路径逃逸立即作为业务错误拒绝。 -->
selplat_scaffold_path_boundary = normalized_target_must_remain_inside_SELPLAT_ROOT

## 工程分层与登记

<!-- 每个新工程必须同时生成 backend、db/sql、README 和所有权标记；无真实读取程序不得预留 manifest。 -->
selplat_scaffold_project_roots = backend,db/sql,README.md,ownership_marker,no_unconsumed_manifest
<!-- Java 固定采用 Controller → 当前业务唯一 Service → DAO → 项目 BaseDao 的继承和调用顺序。 -->
selplat_scaffold_java_layering = controller,business_service,dao,project_base_dao
<!-- 与一张业务表相关的 Controller、Service、DAO 必须聚合在同一业务目录；common 顶层职责只允许 config、persistence、util。 -->
selplat_scaffold_java_package_pattern = <business>/controller,<business>/service,<business>/service/impl,<business>/dao,common/config,common/persistence,common/util/<capability>
<!-- 公共 CRUD 由 CommonParam、Map 和数据库元数据直接完成，生成器禁止为业务表创建无调用方的 domain 目录和类。 -->
selplat_scaffold_table_domain_policy = no_domain_use_CommonParam_Map_database_metadata
<!-- 每项功能的 service 根目录只允许公开 Service 接口，具体实现必须进入 service/impl 并以 ServiceImpl 命名。 -->
selplat_scaffold_service_contract_and_implementation = <business>/service/<Feature>Service.java:interface,<business>/service/impl/<Feature>ServiceImpl.java:implementation
<!-- 一张业务表只生成一个 Service 接口和一个实现；表的默认字段、排序和专属编排保留在该实现中，禁止生成项目 BaseService 或单调用方中间 Service。 -->
selplat_scaffold_business_service_cardinality = one_table_one_service_contract_one_service_impl,no_project_base_service,no_single_consumer_intermediate_service
<!-- common 只接受真实跨业务复用或基础设施能力；能力必须进入 util 下按职责命名，禁止创建空目录或把具体示例名称写成通用要求。 -->
selplat_scaffold_common_role_boundary = config,persistence,util/<actual-capability>,real_consumer_required,no_empty_placeholder,no_hardcoded_example_capability
<!-- Controller 只允许依赖 Service 接口，禁止导入或构造 service.impl 中的实现类。 -->
selplat_scaffold_controller_service_dependency = interface_only,no_service_impl_import
<!-- Service 实现必须显式 implements 对应接口并由 Spring @Service 注册，禁止用一个具体类同时冒充契约和实现。 -->
selplat_scaffold_service_implementation_registration = implements_contract,spring_service_annotation
<!-- 每个工程必须拥有自己的具名 DataSource、事务管理器、BaseDataSourceContext 和 CommonSequenceSegmentDao。 -->
selplat_scaffold_private_persistence = named_datasource,named_transaction_manager,named_base_context,named_sequence_dao
<!-- 独立应用只能扫描自己的持久层，禁止扫描 common.db 让抽象模板 DAO 被当作 Mapper 实例化。 -->
selplat_scaffold_standalone_component_scan_boundary = own_project,common_service,common_web,no_common_db_scan
<!-- ReferenceDataProvider 等框架扩展只有出现真实接口、调用方、依赖和注册需求时才允许创建；默认脚手架禁止预留。 -->
selplat_scaffold_framework_extension_policy = real_interface_and_caller_and_dependency_and_registration_required,no_default_reference_data_provider
<!-- 新工程必须登记到 settings.gradle 和 Host implementation，模块使用 AutoConfiguration 进入统一运行时。 -->
selplat_scaffold_host_registration = settings_module,physical_project_dir,host_implementation,boot_auto_configuration
<!-- 应用桌面身份只登记到 Host applications.json；没有真实 src/main 读取程序时禁止另建工程 manifest。 -->
selplat_scaffold_application_identity_source = host_desktop_applications_json,no_unconsumed_project_manifest
<!-- 新工程必须同时登记 Host 桌面应用清单和同源内部路径白名单，禁止出现已构建但桌面不可见或入口禁用。 -->
selplat_scaffold_desktop_registration = applications_json_entry,internal_path_allowlist,clickable_same_origin_url
<!-- Host 健康接口必须从桌面应用清单派生模块代码，禁止维护第二份容易遗漏的硬编码模块数组。 -->
selplat_scaffold_runtime_module_health_source = desktop_applications_json,no_hardcoded_duplicate_module_list
<!-- Gradle、Host、桌面、白名单和中央数据库应用登记属于同一生成事务，任一失败必须恢复全部登记并删除本轮新文件。 -->
selplat_scaffold_unified_registration_transaction = settings,host_dependency,desktop_manifest,desktop_allowlist,managed_database_central_registry,atomic_rollback
<!-- 根登记和工程文件必须使用临时文件替换并在失败时恢复原正文、删除本轮新文件。 -->
selplat_scaffold_write_transaction = preflight_all_targets,atomic_file_replace,restore_registries,remove_only_new_files_on_failure

## SQL、默认字段与号段

<!-- 每张表生成独立 schema-实际表名.sql 和 data-实际表名.sql，加载顺序由 load-order.txt 显式登记。 -->
selplat_scaffold_sql_files = schema-<ActualTableName>.sql,data-<ActualTableName>.sql,load-order.txt
<!-- 新生成标准业务表固定包含主键、租户、操作人、排序、中日英标签、状态和创建修改时间；业务扩展只能在生成后按真实需求新增。 -->
selplat_scaffold_default_columns = id,tenantId,lastOperateUserId,sortnum,labelZh,labelJa,labelEn,status,createdAt,updatedAt
<!-- 通用多语言显示字段只使用 labelZh、labelJa、labelEn，禁止模板同时保留语义不明的 name 字段。 -->
selplat_scaffold_multilingual_label_columns = labelZh:required,labelJa:optional,labelEn:optional,no_legacy_name
<!-- 本约束仅自动作用于今后由 MDA 新生成的标准业务表，既有专用业务表不因快速门禁被自动改名或破坏性迁移。 -->
selplat_scaffold_default_column_scope = future_mda_generated_standard_business_tables,no_automatic_existing_specialized_table_migration
<!-- id 由 CommonSequenceSegment 的实际表名加 Id 号段生成，Service 禁止自行计算主键；初始化只补缺失号段，禁止重启覆盖游标。 -->
selplat_scaffold_primary_key_sequence = <ActualTableName>Id,insert_where_not_exists,no_merge,no_cursor_reset
<!-- 新增时当前表唯一 Service 为空值补租户一、操作人一、排序零、有效状态一和当前创建更新时间。 -->
selplat_scaffold_insert_defaults = tenantId:1,lastOperateUserId:1,sortnum:0,status:1,createdAt:now,updatedAt:now
<!-- 新建业务表默认不写业务记录，页面首次访问必须明确显示空表状态。 -->
selplat_scaffold_business_seed_policy = empty_by_default
<!-- 空业务数据脚本必须包含可执行无副作用语句，禁止纯注释文件触发 ResourceDatabasePopulator 启动失败。 -->
selplat_scaffold_empty_data_script = explanatory_comment,SELECT_1_statement,no_business_rows

## 页面与可选扩展

<!-- 首张表固定生成工程名 html/js/css，后续表固定生成表名 html/js/css。 -->
selplat_scaffold_page_naming = first_table:<projectName>.*,additional_table:<tableName>.*
<!-- 页面布局固定为左侧引用数据树、右侧业务表格，并提供刷新、新增、编辑和假删除入口。 -->
selplat_scaffold_page_layout = left_reference_tree,right_business_grid,refresh,create,edit,soft_delete
<!-- 生成页面必须加载主题注册表、全部已登记主题 manifest、主题管理器、背景和个性化控件，禁止把 glass-admin dark 写成不可切换的唯一皮肤。 -->
selplat_scaffold_theme_runtime = theme_registry,all_registered_theme_manifests,theme_manager,page_background,personalization,dark_light_switchable
<!-- 页面主要交互必须由 SEL 公共组件装配，应用只提供五区布局、标准 payload、接口和业务事件。 -->
selplat_scaffold_required_sel_controls = selPanel,selTree,selSearch,selDropdownMenu,selGrid,selWindow,selConfirmDialog
<!-- 禁止在生成模板中手写公共树节点、表格行、模态窗口和 window.confirm 回退；公共组件缺失必须明确停止初始化。 -->
selplat_scaffold_no_native_control_fallback = no_handwritten_tree,no_handwritten_grid,no_native_dialog,no_window_confirm,fail_on_missing_sel_component
<!-- 生成页面的应用 CSS 只允许分配页面舞台和业务专属内容，公共控件视觉必须消费 SEL 主题令牌并由组件样式维护。 -->
selplat_scaffold_application_css_boundary = page_stage_and_business_specific_only,no_public_component_internal_override,sel_theme_tokens_only
<!-- 默认密度使用 compact 保留后台工作台紧凑字号，用户仍可通过个性化控件调整主题、明暗、密度和文字。 -->
selplat_scaffold_default_visual_density = compact,personalization_remains_effective
<!-- 页面 CSS 选择器和 JavaScript 顶层标识必须使用工程名前缀，禁止污染其他应用全局状态。 -->
selplat_scaffold_frontend_namespace = project_prefixed_css_and_javascript
<!-- 默认左树只使用页面本地的“全部数据”根节点，禁止为展示空树而伪造后端 Provider；真实树需求出现后再按框架契约接入。 -->
selplat_scaffold_default_tree_source = local_all_records_root,no_placeholder_backend_api,real_tree_requirement_before_framework_extension

## 完成门槛

<!-- 生成器测试必须使用临时目录中的真实文件，不得修改真实 apps 下的业务工程。 -->
selplat_scaffold_test_isolation = junit_temporary_project_root_only
<!-- 至少验证首次完整生成、追加第二张表、重复目标不覆盖、非法路径和非受管工程拒绝。 -->
selplat_scaffold_required_test_cases = first_project,second_table,business_first_packages,one_table_one_service,no_project_base_service,no_default_framework_extension,no_table_domain,duplicate_collision,path_escape,unowned_project
<!-- 自动架构测试必须同时检查现有 MDA 分层和生成模板输出，任一接口、实现目录、注册注解或 Controller 依赖遗漏都让构建失败。 -->
selplat_scaffold_service_architecture_gate = current_mda_contract,current_mda_implementation_directory,current_mda_spring_registration,current_mda_controller_interface_dependency,generated_contract,generated_implementation,generated_controller_interface_dependency
<!-- 生成器测试必须读取真实生成的 HTML、JS、CSS，验证主题运行时、公共控件调用、无原生确认回退和应用 CSS 职责边界。 -->
selplat_scaffold_frontend_component_gate = generated_html_theme_runtime_and_component_resources,generated_javascript_sel_mount_calls,no_window_confirm,generated_css_stage_only
<!-- MDA 创建窗口必须明确提示首次创建和追加表语义，成功后返回重启要求及可访问页面 URL。 -->
selplat_scaffold_ui_result = project_or_table_created,restart_required,page_url
<!-- 最终验收必须启动统一 PlatformRuntimeApplication；业务独立启动只能用于局部开发，不能作为完成证据。 -->
selplat_scaffold_final_runtime = unified_host_required,standalone_application_not_sufficient
<!-- 交付前必须编译 MDA、执行生成器测试、启动统一 Host 并核对桌面、业务页面、列表和当前真实存在的扩展接口。 -->
selplat_scaffold_delivery_gate = mda_compile,generator_tests,service_architecture_tests,active_user_rule_loading,javascript_syntax,unified_host_real_startup,desktop_http_200,desktop_application_entry,application_page_http_200,declared_extension_only,real_browser_visual_verification
