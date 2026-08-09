# SELPLAT 应用脚手架生成规则

<!-- 当前规则由 MDA Java 生成器执行，因此同时登记稳定接口与 Spring 实现能力。 -->
java_ability_refs = apps/mda/backend/src/main/java/com/sp/selplat/mda/projectgenerator/service/MdaProjectGeneratorService.java,apps/mda/backend/src/main/java/com/sp/selplat/mda/projectgenerator/service/impl/MdaProjectGeneratorServiceImpl.java
<!-- 当前规则不需要 Python 能力；生成、冲突检查和回滚均在运行中的 MDA Java 服务内完成。 -->
python_ability_refs = none
<!-- 页面脚本由模板生成并使用现有浏览器与前端语法验证，不登记额外 Node 能力。 -->
node_ability_refs = none
<!-- 本版补齐生成器自身的 Service 接口分层，并将防遗漏约束升级为构建失败门禁。 -->
rule_version = 1.1.0
<!-- 规则所有者始终由 AGENTS.md 当前稳定用户动态解析，未经审查不得提升到 common。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示规则、生成器、索引和真实隔离文件测试已经形成闭环。 -->
rule_status = active
<!-- 本规则来源于用户要求从 uniauth 抽取模板并让后续 AI 可重复接手。 -->
upgrade_record = 2026-08-09:建立SELPLAT工程与业务表脚手架生成_冲突保护_reference-data扩展和左树右表页面规则;2026-08-09:修正MDA生成器具体类冒充Service接口并增加接口实现目录_Controller依赖和模板输出的自动门禁

<!-- 问题：手工复制既有应用容易遗漏项目数据源、号段、Host 登记、SQL 顺序、默认审计字段、页面资源或引用数据注册。 -->
<!-- 场景：在 SELPLAT apps 下新建业务工程，或向已由脚手架创建的工程追加一张业务表。 -->
<!-- 业务含义：两个稳定输入即可生成可编译、可启动、可继续扩展且不会覆盖既有文件的完整业务骨架。 -->

## 规则包组成

<!-- 工程模板以 MDA Java 模板目录为唯一实现，禁止运行时直接复制和改写 uniauth 现有业务文件。 -->
template_implementation = apps/mda/backend/src/main/java/com/sp/selplat/mda/projectgenerator/template/MdaProjectTemplateCatalog.java
<!-- uniauth 只提供分层、注释、私有数据源和静态资源命名的已验证参考，不作为运行时可变源目录。 -->
verified_reference_application = apps/uniauth
<!-- MDA 工程生成接口是页面和后续 AI 调用的唯一稳定契约。 -->
generator_contract = apps/mda/backend/src/main/java/com/sp/selplat/mda/projectgenerator/service/MdaProjectGeneratorService.java
<!-- MDA 工程生成实现是唯一执行文件写入的 Spring Service。 -->
generator_program = apps/mda/backend/src/main/java/com/sp/selplat/mda/projectgenerator/service/impl/MdaProjectGeneratorServiceImpl.java
<!-- 交付验证必须覆盖隔离目录生成、追加表、重复目标无覆盖、路径逃逸拒绝、MDA 编译和真实页面窗口。 -->
verification_scope = isolated_project_generation,table_append,no_overwrite_collision,path_escape_rejection,service_architecture_gate,mda_compile,real_browser_window

## 输入、命名与所有权

<!-- 创建入口固定接收工程名和表名两个字段；首次提交创建完整工程，既有受管工程提交创建新表。 -->
selplat_scaffold_required_inputs = projectName,tableName
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

<!-- 每个新工程必须同时生成 backend、db/sql、manifest、README 和所有权标记。 -->
selplat_scaffold_project_roots = backend,db/sql,manifest,README.md,ownership_marker
<!-- Java 固定采用 Controller → Service → 项目 BaseService → DAO → 项目 BaseDao 的继承和调用顺序。 -->
selplat_scaffold_java_layering = controller,service,project_base_service,dao,project_base_dao
<!-- 每项功能的 service 根目录只允许公开 Service 接口，具体实现必须进入 service/impl 并以 ServiceImpl 命名。 -->
selplat_scaffold_service_contract_and_implementation = service/<Feature>Service.java:interface,service/impl/<Feature>ServiceImpl.java:implementation
<!-- Controller 只允许依赖 Service 接口，禁止导入或构造 service.impl 中的实现类。 -->
selplat_scaffold_controller_service_dependency = interface_only,no_service_impl_import
<!-- Service 实现必须显式 implements 对应接口并由 Spring @Service 注册，禁止用一个具体类同时冒充契约和实现。 -->
selplat_scaffold_service_implementation_registration = implements_contract,spring_service_annotation
<!-- 每个工程必须拥有自己的具名 DataSource、事务管理器、BaseDataSourceContext 和 CommonSequenceSegmentDao。 -->
selplat_scaffold_private_persistence = named_datasource,named_transaction_manager,named_base_context,named_sequence_dao
<!-- 新工程必须登记到 settings.gradle 和 Host implementation，模块使用 AutoConfiguration 进入统一运行时。 -->
selplat_scaffold_host_registration = settings_module,physical_project_dir,host_implementation,boot_auto_configuration
<!-- 根登记和工程文件必须使用临时文件替换并在失败时恢复原正文、删除本轮新文件。 -->
selplat_scaffold_write_transaction = preflight_all_targets,atomic_file_replace,restore_registries,remove_only_new_files_on_failure

## SQL、默认字段与号段

<!-- 每张表生成独立 schema-实际表名.sql 和 data-实际表名.sql，加载顺序由 load-order.txt 显式登记。 -->
selplat_scaffold_sql_files = schema-<ActualTableName>.sql,data-<ActualTableName>.sql,load-order.txt
<!-- 新表的默认业务和平台字段固定包含以下八项，业务扩展只能在生成后按具体需求新增。 -->
selplat_scaffold_default_columns = id,tenantId,lastOperateUserId,name,sortnum,status,createdAt,updatedAt
<!-- id 由 CommonSequenceSegment 的实际表名加 Id 号段生成，Service 禁止自行计算主键。 -->
selplat_scaffold_primary_key_sequence = <ActualTableName>Id
<!-- 新增时项目 BaseService 为空值补租户一、操作人一、排序零、有效状态一和当前创建更新时间。 -->
selplat_scaffold_insert_defaults = tenantId:1,lastOperateUserId:1,sortnum:0,status:1,createdAt:now,updatedAt:now
<!-- 新建业务表默认不写业务记录，页面首次访问必须明确显示空表状态。 -->
selplat_scaffold_business_seed_policy = empty_by_default

## 页面与 reference-data

<!-- 首张表固定生成工程名 html/js/css，后续表固定生成表名 html/js/css。 -->
selplat_scaffold_page_naming = first_table:<projectName>.*,additional_table:<tableName>.*
<!-- 页面布局固定为左侧引用数据树、右侧业务表格，并提供刷新、新增、编辑和假删除入口。 -->
selplat_scaffold_page_layout = left_reference_tree,right_business_grid,refresh,create,edit,soft_delete
<!-- 页面 CSS 选择器和 JavaScript 顶层标识必须使用工程名前缀，禁止污染其他应用全局状态。 -->
selplat_scaffold_frontend_namespace = project_prefixed_css_and_javascript
<!-- 每张表必须生成 ReferenceDataProvider，并以工程编码和表编码注册统一树与类型路由。 -->
selplat_scaffold_reference_data_registration = provider(projectCode,resourceCode)
<!-- 初始 Provider 只返回可用根节点和状态选项；未来真实树与类型必须在所属项目 Provider 内实现并继续由 reference-data 路由。 -->
selplat_scaffold_reference_data_extension = owning_project_provider_with_reference_data_routing

## 完成门槛

<!-- 生成器测试必须使用临时目录中的真实文件，不得修改真实 apps 下的业务工程。 -->
selplat_scaffold_test_isolation = junit_temporary_project_root_only
<!-- 至少验证首次完整生成、追加第二张表、重复目标不覆盖、非法路径和非受管工程拒绝。 -->
selplat_scaffold_required_test_cases = first_project,second_table,duplicate_collision,path_escape,unowned_project
<!-- 自动架构测试必须同时检查现有 MDA 分层和生成模板输出，任一接口、实现目录、注册注解或 Controller 依赖遗漏都让构建失败。 -->
selplat_scaffold_service_architecture_gate = current_mda_contract,current_mda_implementation_directory,current_mda_spring_registration,current_mda_controller_interface_dependency,generated_contract,generated_implementation,generated_controller_interface_dependency
<!-- MDA 创建窗口必须明确提示首次创建和追加表语义，成功后返回重启要求及可访问页面 URL。 -->
selplat_scaffold_ui_result = project_or_table_created,restart_required,page_url
<!-- 交付前必须编译 MDA、执行生成器测试、检查 MDA 脚本语法并在真实浏览器核对按钮和窗口。 -->
selplat_scaffold_delivery_gate = mda_compile,generator_tests,service_architecture_tests,active_user_rule_loading,javascript_syntax,real_browser_visual_verification
