# 当前用户 SELPLAT 通用规则索引

<!-- 本索引只登记当前用户在 SELPLAT 各应用之间复用的个人工程规则。 -->
active_user_selplat_general_rule_root = local/XUNAN/selplat/通用/rule/

<!-- SELPLAT 跨应用 Node.js 与 TypeScript 公共运行能力统一执行唯一源码根、包依赖和安装包白名单。 -->
SELPLAT_NODE_COMMON_CAPABILITY_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLATNode共通能力规则.md

<!-- 新建、迁移或修改 shared/node/common-core 及其公共 API 时加载。 -->
load_rule_for_active_user_selplat_node_common_create_migrate_or_api_change = SELPLAT_NODE_COMMON_CAPABILITY_RULES

<!-- 应用把重复 Node 工具、路径解析或平台基础能力提升到公共层时加载。 -->
load_rule_for_active_user_selplat_application_node_utility_or_path_resolver_promotion = SELPLAT_NODE_COMMON_CAPABILITY_RULES

<!-- Electron 应用新增公共 Node 依赖、调整打包文件或验证安装包内容时加载。 -->
load_rule_for_active_user_selplat_electron_node_common_dependency_packaging_or_artifact_inspection = SELPLAT_NODE_COMMON_CAPABILITY_RULES

<!-- SELPLAT Node.js、TypeScript 和 Electron 应用统一执行源码、配置、依赖、脚本、测试与交付目录边界；单应用协议进入 contracts，根 shared 只承载跨工程共通。 -->
SELPLAT_NODE_APPLICATION_PROJECT_STRUCTURE_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLATNode工程结构规则.md

<!-- 新建、整理、迁移或审查任一 SELPLAT Node.js、TypeScript 或 Electron 应用工程结构时加载。 -->
load_rule_for_active_user_selplat_node_application_create_organize_migrate_or_structure_review = SELPLAT_NODE_APPLICATION_PROJECT_STRUCTURE_RULES

<!-- 移动或删除 Node 应用文件、清理源码树生成物或调整 package 脚本和配置入口时加载。 -->
load_rule_for_active_user_selplat_node_application_file_move_delete_generated_cleanup_or_package_entry_change = SELPLAT_NODE_APPLICATION_PROJECT_STRUCTURE_RULES

<!-- SELPLAT 当前和未来应用统一按真实工程名隔离源码、缓存、构建、临时控制面与长期归档，并阻止 build、cache 与 OPTION/temp 合并或越过清理门槛。 -->
SELPLAT_APPLICATION_PROJECT_DATA_LAYOUT_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT应用工程数据目录结构规则.md

<!-- 新建、整理、迁移或检查任一应用的 cache、build、OPTION/temp、log 或源码目录时加载。 -->
load_rule_for_active_user_selplat_application_cache_build_temp_log_or_source_layout = SELPLAT_APPLICATION_PROJECT_DATA_LAYOUT_RULES

<!-- 新增或修改任务、测试、审批、诊断和协同材料的待执行、运行中、归档或清理流程时加载。 -->
load_rule_for_active_user_selplat_application_execution_archive_or_temp_cleanup_lifecycle = SELPLAT_APPLICATION_PROJECT_DATA_LAYOUT_RULES

<!-- 交付前检查应用临时数据散落、工程名写死、跨工程缓存冲突或源码树污染时加载。 -->
load_rule_for_active_user_selplat_application_data_layout_delivery_scan = SELPLAT_APPLICATION_PROJECT_DATA_LAYOUT_RULES

<!-- SELPLAT 全部现有和未来公共控件统一执行先登记后实现、应用禁止私造和硬依赖自动检查。 -->
SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT公共控件治理门禁规则.md

<!-- 业务应用出现原生 createElement 或要求统一 DOM 创建入口时加载，改用 sel.core.element。 -->
load_rule_for_selplat_application_document_create_element_or_dom_node_creation = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改 sel.core.element 或业务动态节点结构时加载，保持公共实现与应用消费边界。 -->
load_rule_for_selplat_core_element_or_application_dynamic_dom = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 新增、拆分、迁移或删除任一公共控件时加载，禁止未登记源码和旧私有实现兼容分支。 -->
load_rule_for_active_user_selplat_public_component_create_split_migrate_or_delete = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 应用新增状态交互、body 门户、键盘焦点生命周期或可复用 DOM/CSS/事件组合时加载，先判断是否应建立公共控件。 -->
load_rule_for_active_user_selplat_application_reusable_interaction_or_private_control = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改控件 API、主题令牌、ARIA 角色、硬依赖或应用资源顺序时加载，保证登记与调用方同步。 -->
load_rule_for_active_user_selplat_component_api_theme_accessibility_dependency_or_resource_order = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 新建或既有工程接入 SEL UI，选择现有主题或把稳定自有 UI 沉淀为新主题包时加载。 -->
load_rule_for_active_user_selplat_application_sel_ui_adoption_or_new_theme_pack = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- Java 通过资源 JAR、Node Vite Electron 通过模块出口或 React 通过生命周期适配使用 SEL UI 时加载。 -->
load_rule_for_active_user_selplat_java_node_electron_or_react_sel_ui_host_adoption = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- SELUI 中央登记新增控件、同步 Node 正式出口或检查 package exports 一致性时加载，登记必须自动形成稳定脚本和样式入口。 -->
load_rule_for_active_user_selplat_component_registry_node_export_sync_or_gate = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 应用需要消费尚未公开导出的 SELUI 控件时加载，必须先补共通正式出口，禁止引用 shared 内部文件。 -->
load_rule_for_active_user_selplat_application_requires_unexported_sel_ui_component = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 既有 UI 硬编码视觉迁移到统一令牌并要求保持原外观时加载。 -->
load_rule_for_active_user_selplat_existing_ui_token_migration_with_visual_preservation = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改 window.sel 命名空间、selKernel、sel.core.freeze、应用组件解构或 JavaScript 组件说明时加载。 -->
load_rule_for_active_user_selplat_namespace_kernel_freeze_dependency_declaration_or_js_component_documentation = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改应用装配脚本的页面入口、SEL 公共别名或业务模块前缀时加载，保证短名不丢失归属语义。 -->
load_rule_for_active_user_selplat_application_javascript_entry_framework_alias_or_business_prefix_naming = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改只读配置、payload、状态快照、运行时控制器或生成脚本冻结结构时加载，保证完整边界只调用一次 selFreeze。 -->
load_rule_for_active_user_selplat_immutable_boundary_runtime_controller_or_generated_freeze_structure = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES,SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

<!-- 新增或修改页面编辑模式、控件坐标、实时草稿、取消恢复、显式保存或管理员显示能力时加载。 -->
load_rule_for_active_user_selplat_page_editor_mode_coordinate_draft_cancel_save_or_authorization = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- load_rule_for_active_user_selplat_page_editor_switch_per_control_save_navigation_or_window_geometry 的当前独立事实为 SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES,SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES。 -->
load_rule_for_active_user_selplat_page_editor_switch_per_control_save_navigation_or_window_geometry = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES,SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- 修改 Window 外框保存、内部字段登记、parentKind=WINDOW 清理或防复发约束时加载。 -->
load_rule_for_active_user_selplat_window_outer_geometry_or_inner_control_cleanup = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES,SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- 将表格、菜单、树、下拉或数据类型接入统一页面编辑适配器时加载，禁止应用私造编辑外壳或把管理筛选器冒充业务控件。 -->
load_rule_for_active_user_selplat_control_page_editor_adapter_registration = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 新增或修改页面控件绑定、引用数据类型与选项关联或按页面坐标查询下拉选项时加载。 -->
load_rule_for_active_user_selplat_reference_dropdown_control_binding_type_and_option_relation = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES,SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- 修改 selGrid 记录分类字段、工具栏分类或树分类筛选时加载，保证单值和多值统一按成员匹配。 -->
load_rule_for_active_user_selplat_grid_record_type_or_tree_classification_filter = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 同一 selGrid 切换业务模块、替换记录字段契约或修改 selWindow 表单默认项时加载，保证新契约和默认值立即生效。 -->
load_rule_for_active_user_selplat_grid_runtime_module_contract_or_window_form_default = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 新增或修改 SEL 控件实例 ID、业务 gridId 或事件实例键时加载，统一 sel加控件类型加业务含义加Id 的驼峰命名。 -->
load_rule_for_active_user_selplat_component_instance_id_or_business_grid_id_naming = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改公共控件字号、字重、行高或树节点文字层级时加载，统一七级语义文字并阻断旧 primary/secondary 令牌。 -->
load_rule_for_active_user_selplat_component_typography_or_tree_text_hierarchy = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 交付前检查未知新控件和业务私造交互时加载，扫描逻辑由中央登记驱动而非逐个控件写死。 -->
load_rule_for_active_user_selplat_component_governance_delivery_scan = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 新增或修改多字段查询、逐字段 AND、横向组合基线、Grid 后台分页或查询事件时加载。 -->
load_rule_for_active_user_selplat_search_multi_field_or_grid_remote_pagination = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改搜索框默认宽度、配置覆盖或缺少数据库/JSON 配置时的回退布局时加载。 -->
load_rule_for_active_user_selplat_search_default_width_or_configuration_fallback = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改统一查询字段数量、提交时机、共同基线或页面编辑登记边界时加载，每个真实元素必须可独立保存。 -->
load_rule_for_active_user_selplat_query_condition_group_internal_fields_submit_or_page_registration = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- SELPLAT 全部程序统一执行语言登记、源码归属和实验工具隔离门禁；非 Gradle 应用由当前用户中央登记提供完整证据。 -->
SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES = ruleengine/active-user/rules/平台/RUL_SELPLAT程序源码语言与归属门禁规则.md

<!-- 新建、移动或删除任一应用、shared 或 rule-engine 程序源码时加载。 -->
load_rule_for_active_user_selplat_program_source_create_move_or_delete = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

<!-- 业务 Controller、Service 或生成模板变更 HTTP 请求输出类型时加载，禁止重复建立公共协议。 -->
load_rule_for_active_user_selplat_application_http_request_response_or_result_change = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

<!-- 新增 src/main 语言目录、构建语言入口或规则能力时加载。 -->
load_rule_for_active_user_selplat_source_language_root_build_entry_or_ability_change = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

<!-- 交付前检查未登记语言、错误能力归属、实验代码和源码缓存时加载。 -->
load_rule_for_active_user_selplat_all_program_source_ownership_delivery_scan = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

<!-- 新增数据库运行类型、登记 H2/SQLite 应用或调整跨运行时数据库门禁分流时加载。 -->
load_rule_for_active_user_selplat_database_runtime_registration_or_engine_governance_route = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES,SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- SELPLAT 工具运行数据统一进入 OPTION/temp，并由程序路径守卫阻止通用技能默认目录逃逸。 -->
SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT工具运行临时目录防逃逸规则.md

<!-- 运行 PDF、OCR、导入器、媒体生成或其他会产生中间文件的工具时加载。 -->
load_rule_for_active_user_selplat_pdf_ocr_importer_media_or_tool_runtime = SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES

<!-- 新增或修改工具输出参数、临时目录默认值、路径解析和清理逻辑时加载。 -->
load_rule_for_active_user_selplat_tool_output_temp_default_path_guard_or_cleanup = SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES

<!-- 交付前扫描工程根 tmp、runtime、日志或临时副本污染时加载。 -->
load_rule_for_active_user_selplat_root_runtime_pollution_delivery_scan = SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES

<!-- SELPLAT 所有公共 selGrid 在真实横向溢出时默认启用可发现且主题一致的滚动反馈。 -->
SELPLAT_GRID_HORIZONTAL_SCROLL_DEFAULT_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT表格横向滚动默认规则.md

<!-- 创建、装配或调整任一应用的公共 selGrid 时加载，禁止把滚动条可见性降级为应用显式开关。 -->
load_rule_for_active_user_selplat_grid_creation_assembly_or_layout_change = SELPLAT_GRID_HORIZONTAL_SCROLL_DEFAULT_RULES

<!-- 修改 selGrid 列宽、数据刷新、面板缩放或滚动反馈时加载，保证真实溢出状态自动同步。 -->
load_rule_for_active_user_selplat_grid_columns_data_resize_or_scrollbar_change = SELPLAT_GRID_HORIZONTAL_SCROLL_DEFAULT_RULES

<!-- 对比多个应用的表格滚动条亮度、尺寸和轨道样式时加载，保证复用公共主题令牌。 -->
load_rule_for_active_user_selplat_grid_scrollbar_visual_consistency_review = SELPLAT_GRID_HORIZONTAL_SCROLL_DEFAULT_RULES

<!-- SELPLAT 非阻断操作结果统一使用公共短时 Toast，禁止完成提示长期占用工作区状态栏。 -->
SELPLAT_TRANSIENT_OPERATION_FEEDBACK_TOAST_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT短时操作反馈规则.md

<!-- 新增或修改保存、查询、清空、刷新和可恢复错误提示时加载，保证反馈自动消失且不挤占业务布局。 -->
load_rule_for_active_user_selplat_non_blocking_operation_feedback = SELPLAT_TRANSIENT_OPERATION_FEEDBACK_TOAST_RULES

<!-- 修改编辑器状态栏、公共 Toast 运行时或提示生命周期时加载，保证常驻信息与短时反馈职责分开。 -->
load_rule_for_active_user_selplat_editor_status_or_toast_lifecycle = SELPLAT_TRANSIENT_OPERATION_FEEDBACK_TOAST_RULES

<!-- 验证 Toast 显示、超时删除、错误语义和连续排列时加载，保证真实浏览器闭环。 -->
load_rule_for_active_user_selplat_transient_feedback_browser_regression = SELPLAT_TRANSIENT_OPERATION_FEEDBACK_TOAST_RULES

<!-- SELPLAT 动态页签工作区统一采用切换保留、关闭销毁和公共主题语义令牌。 -->
SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT动态页签工作区生命周期规则.md

<!-- 新增或修改动态业务页签、页签注册表和关闭行为时加载，防止隐藏实例持续积累。 -->
load_rule_for_active_user_selplat_dynamic_tabs_creation_registry_switch_or_close = SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES

<!-- 组合页签、分隔器、代码编辑器和表格形成工作区时加载，保证子组件由统一清理入口回收。 -->
load_rule_for_active_user_selplat_dynamic_workspace_component_assembly = SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES

<!-- 调整动态工作区颜色、边框、焦点或活动状态时加载，保证只消费统一主题语义令牌。 -->
load_rule_for_active_user_selplat_dynamic_workspace_visual_token_change = SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES

<!-- 新增或修改 Tab 右键菜单、关闭右侧、关闭其他或全部关闭时加载，保证复用 selContextMenu 并保留关闭检查。 -->
load_rule_for_active_user_selplat_tab_context_menu_or_batch_close_change = SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES

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

<!-- SELPLAT 新业务工程和可追加业务表统一由 MDA 脚手架生成，并实行无覆盖冲突保护。 -->
SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT应用脚手架生成规则.md
<!-- SELPLAT 运行时、模块登记或页面修改完成后立即执行目标启动冒烟测试，避免未启动状态继续跑偏。 -->
SELPLAT_RUNTIME_CHANGE_IMMEDIATE_STARTUP_TEST_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT运行时修改后即时启动测试规则.md

<!-- 使用工程名和表名创建 apps 下的新应用时加载，保证完整分层、默认字段和 Host 登记同步生成。 -->
load_rule_for_active_user_selplat_application_scaffold_creation = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES

<!-- 向已由 MDA 生成器拥有的工程追加业务表时加载，保证新表和页面三件套不覆盖既有文件。 -->
load_rule_for_active_user_selplat_generated_project_table_append = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES

<!-- 修改脚手架模板、默认字段、引用数据扩展点、生成页面或冲突策略时加载。 -->
load_rule_for_active_user_selplat_scaffold_template_defaults_reference_data_or_collision_change = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES

<!-- 审查新增或既有应用的默认修复完整性时，同时核对独立后台查询和编辑态保存位置。 -->
load_rule_for_active_user_selplat_default_repair_query_and_page_editor_audit = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES,SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES,SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- 本索引只维护 SELPLAT 各应用可以共同复用的规则。 -->
selplat_common_rule_root = local/XUNAN/selplat/通用/rule/

<!-- selplat_common_template_root 的当前独立事实为 local/XUNAN/selplat/通用/template/。 -->
selplat_common_template_root = local/XUNAN/selplat/通用/template/

<!-- SELPLAT 水晶窗体、菜单、浮层和面板材质。 -->
SELPLAT_CRYSTAL_UI_MATERIAL_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT水晶界面材质规则.md

<!-- load_rule_for_selplat_crystal_window_menu_or_floating_panel 的当前独立事实为 SELPLAT_CRYSTAL_UI_MATERIAL_RULES。 -->
load_rule_for_selplat_crystal_window_menu_or_floating_panel = SELPLAT_CRYSTAL_UI_MATERIAL_RULES

<!-- load_rule_for_selplat_crystal_nine_slice_center_fill_or_non_hollow_surface 的当前独立事实为 SELPLAT_CRYSTAL_UI_MATERIAL_RULES。 -->
load_rule_for_selplat_crystal_nine_slice_center_fill_or_non_hollow_surface = SELPLAT_CRYSTAL_UI_MATERIAL_RULES

<!-- load_rule_for_selplat_crystal_content_safe_area_popup_boundary_or_alpha_shaped_effect 的当前独立事实为 SELPLAT_CRYSTAL_UI_MATERIAL_RULES。 -->
load_rule_for_selplat_crystal_content_safe_area_popup_boundary_or_alpha_shaped_effect = SELPLAT_CRYSTAL_UI_MATERIAL_RULES

<!-- load_rule_for_selplat_crystal_default_resize_maximize_restore_visual_qa 的当前独立事实为 SELPLAT_CRYSTAL_UI_MATERIAL_RULES。 -->
load_rule_for_selplat_crystal_default_resize_maximize_restore_visual_qa = SELPLAT_CRYSTAL_UI_MATERIAL_RULES

<!-- SELPLAT 工程目录、构建产物、项目 JDK、运行数据与缓存。 -->
SELPLAT_PROJECT_PATH_RULES = ruleengine/active-user/rules/平台/RUL_SELPLAT工程路径规则.md

<!-- load_rule_for_selplat_project_path_or_runtime_output 的当前独立事实为 SELPLAT_PROJECT_PATH_RULES。 -->
load_rule_for_selplat_project_path_or_runtime_output = SELPLAT_PROJECT_PATH_RULES

<!-- load_rule_for_selplat_application_authoritative_local_database 的当前独立事实为 SELPLAT_PROJECT_PATH_RULES。 -->
load_rule_for_selplat_application_authoritative_local_database = SELPLAT_PROJECT_PATH_RULES

<!-- load_rule_for_python_bytecode_cache_location 的当前独立事实为 SELPLAT_PROJECT_PATH_RULES。 -->
load_rule_for_python_bytecode_cache_location = SELPLAT_PROJECT_PATH_RULES

<!-- load_rule_for_selplat_project_jdk_cache_or_legacy_runtime_migration 的当前独立事实为 SELPLAT_PROJECT_PATH_RULES。 -->
load_rule_for_selplat_project_jdk_cache_or_legacy_runtime_migration = SELPLAT_PROJECT_PATH_RULES

<!-- 发布安装版、发布压缩包版的平台数据、缓存、日志、会话和诊断目录统一加载 SELPLAT 工程路径规则。 -->
load_rule_for_selplat_installed_application_data_cache_log_session_or_diagnostics_path = SELPLAT_PROJECT_PATH_RULES

<!-- 开发版源码、编译桌面、安装包或压缩包的工程内缓存与日志目录统一加载 SELPLAT 工程路径规则。 -->
load_rule_for_selplat_developer_application_package_cache_runtime_log_or_diagnostics_path = SELPLAT_PROJECT_PATH_RULES

<!-- AI 通过运行路径清单或桌面接口定位日志时统一加载 SELPLAT 工程路径规则。 -->
load_rule_for_selplat_ai_runtime_path_manifest_or_log_discovery = SELPLAT_PROJECT_PATH_RULES

<!-- SELPLAT 根 Gradle、离线坐标、Wrapper 与 VS Code 导入。 -->
SELPLAT_PROJECT_BUILD_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT工程构建规则.md

<!-- load_rule_for_selplat_gradle_dependency_or_build_output 的当前独立事实为 SELPLAT_PROJECT_BUILD_RULES。 -->
load_rule_for_selplat_gradle_dependency_or_build_output = SELPLAT_PROJECT_BUILD_RULES

<!-- load_rule_for_selplat_vscode_gradle_import_or_cache 的当前独立事实为 SELPLAT_PROJECT_BUILD_RULES。 -->
load_rule_for_selplat_vscode_gradle_import_or_cache = SELPLAT_PROJECT_BUILD_RULES

<!-- 调整正式工程扫描范围、隔离未登记参考目录或检查跨模块引用时加载当前构建规则。 -->
load_rule_for_active_user_selplat_formal_module_scope_or_reference_directory_isolation = SELPLAT_PROJECT_BUILD_RULES

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

<!-- SELPLAT Java 逐行业务注释和真实返回示例。 -->
SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES = local/XUNAN/selplat/通用/rule/RUL_Java业务注释与返回示例规则.md

<!-- load_rule_for_any_selplat_java_creation_modification_or_refactor 的当前独立事实为 SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES。 -->
load_rule_for_any_selplat_java_creation_modification_or_refactor = SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES

<!-- load_rule_for_selplat_java_javadoc_param_return_or_exception 的当前独立事实为 SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES。 -->
load_rule_for_selplat_java_javadoc_param_return_or_exception = SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES

<!-- load_rule_for_selplat_map_list_entity_common_result_or_page_result_comment 的当前独立事实为 SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES。 -->
load_rule_for_selplat_map_list_entity_common_result_or_page_result_comment = SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES

<!-- load_rule_for_selplat_java_comment_template_or_actual_result_example 的当前独立事实为 SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES。 -->
load_rule_for_selplat_java_comment_template_or_actual_result_example = SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES

<!-- load_rule_for_selplat_java_method_purpose_param_return_exception_sequence 的当前独立事实为 SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES。 -->
load_rule_for_selplat_java_method_purpose_param_return_exception_sequence = SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES

<!-- load_rule_for_selplat_common_business_or_system_exception_comment 的当前独立事实为 SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES。 -->
load_rule_for_selplat_common_business_or_system_exception_comment = SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES

<!-- SELPLAT 基础 Service 唯一 CRUD 契约、统一 DAO 访问及非 CRUD 服务边界。 -->
SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES = local/XUNAN/selplat/通用/rule/RUL_基础Service统一DAO访问规则.md

<!-- load_rule_for_selplat_base_service_get_dao 的当前独立事实为 SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES。 -->
load_rule_for_selplat_base_service_get_dao = SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES

<!-- load_rule_for_selplat_service_dao_field_or_constructor 的当前独立事实为 SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES。 -->
load_rule_for_selplat_service_dao_field_or_constructor = SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES

<!-- load_rule_for_selplat_base_service_default_crud_or_special_callback 的当前独立事实为 SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES。 -->
load_rule_for_selplat_base_service_default_crud_or_special_callback = SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES

<!-- load_rule_for_selplat_identity_insert_or_optional_sequence_generator 的当前独立事实为 SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES。 -->
load_rule_for_selplat_identity_insert_or_optional_sequence_generator = SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES

<!-- load_rule_for_selplat_base_service_interface_or_parallel_crud_interface 的当前独立事实为 SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES。 -->
load_rule_for_selplat_base_service_interface_or_parallel_crud_interface = SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES

<!-- load_rule_for_selplat_non_crud_service_inheritance 的当前独立事实为 SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES。 -->
load_rule_for_selplat_non_crud_service_inheritance = SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES

<!-- load_rule_for_selplat_grid_column_controller_or_service 的当前独立事实为 SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES。 -->
load_rule_for_selplat_grid_column_controller_or_service = SELPLAT_BASE_SERVICE_DAO_ACCESS_RULES

<!-- SELPLAT 真实数据库集成测试。 -->
SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT真实数据集成测试规则.md

<!-- load_rule_for_selplat_real_database_query_or_write_test 的当前独立事实为 SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES。 -->
load_rule_for_selplat_real_database_query_or_write_test = SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES

<!-- load_rule_for_selplat_paging_sorting_or_transaction_integration_test 的当前独立事实为 SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES。 -->
load_rule_for_selplat_paging_sorting_or_transaction_integration_test = SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES

<!-- load_rule_for_selplat_batch_group_boundary_or_rollback_test 的当前独立事实为 SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES。 -->
load_rule_for_selplat_batch_group_boundary_or_rollback_test = SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES

<!-- load_rule_for_selplat_shared_database_sequence_or_web_regression_test 的当前独立事实为 SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES。 -->
load_rule_for_selplat_shared_database_sequence_or_web_regression_test = SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES

<!-- load_rule_for_selplat_test_fixture_class_and_method_path 的当前独立事实为 SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES。 -->
load_rule_for_selplat_test_fixture_class_and_method_path = SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES

<!-- load_rule_for_selplat_mock_fake_stub_or_fixed_business_test_cleanup 的当前独立事实为 SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES。 -->
load_rule_for_selplat_mock_fake_stub_or_fixed_business_test_cleanup = SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES

<!-- Controller 仅序列化 Service 返回结构。 -->
SELPLAT_CONTROLLER_SERVICE_RESULT_SERIALIZATION_RULES = local/XUNAN/selplat/通用/rule/RUL_Controller仅序列化Service返回结构规则.md

<!-- load_rule_for_selplat_controller_service_result_serialization 的当前独立事实为 SELPLAT_CONTROLLER_SERVICE_RESULT_SERIALIZATION_RULES。 -->
load_rule_for_selplat_controller_service_result_serialization = SELPLAT_CONTROLLER_SERVICE_RESULT_SERIALIZATION_RULES

<!-- load_rule_for_selplat_controller_duplicate_response_wrapping 的当前独立事实为 SELPLAT_CONTROLLER_SERVICE_RESULT_SERIALIZATION_RULES。 -->
load_rule_for_selplat_controller_duplicate_response_wrapping = SELPLAT_CONTROLLER_SERVICE_RESULT_SERIALIZATION_RULES

<!-- load_rule_for_selplat_fixed_common_result_or_batch_response_shape 的当前独立事实为 SELPLAT_CONTROLLER_SERVICE_RESULT_SERIALIZATION_RULES。 -->
load_rule_for_selplat_fixed_common_result_or_batch_response_shape = SELPLAT_CONTROLLER_SERVICE_RESULT_SERIALIZATION_RULES

<!-- load_rule_for_selplat_base_controller_unused_api_cleanup 的当前独立事实为 SELPLAT_CONTROLLER_SERVICE_RESULT_SERIALIZATION_RULES。 -->
load_rule_for_selplat_base_controller_unused_api_cleanup = SELPLAT_CONTROLLER_SERVICE_RESULT_SERIALIZATION_RULES

<!-- SELPLAT 规则适配审查与冲突阻断。 -->
SELPLAT_RULE_COMPATIBILITY_BLOCKING_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT规则适配审查与阻断规则.md

<!-- load_rule_for_any_selplat_change_task_compatibility_check 的当前独立事实为 SELPLAT_RULE_COMPATIBILITY_BLOCKING_RULES。 -->
load_rule_for_any_selplat_change_task_compatibility_check = SELPLAT_RULE_COMPATIBILITY_BLOCKING_RULES

<!-- load_rule_for_selplat_rule_incompatible_request_blocking 的当前独立事实为 SELPLAT_RULE_COMPATIBILITY_BLOCKING_RULES。 -->
load_rule_for_selplat_rule_incompatible_request_blocking = SELPLAT_RULE_COMPATIBILITY_BLOCKING_RULES
