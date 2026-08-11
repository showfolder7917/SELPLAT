# 当前用户 SELPLAT 通用规则索引

<!-- 本索引只登记当前用户在 SELPLAT 各应用之间复用的个人工程规则。 -->
active_user_selplat_general_rule_root = local/XUNAN/selplat/通用/rule/

<!-- SELPLAT 全部现有和未来公共控件统一执行先登记后实现、应用禁止私造和硬依赖自动检查。 -->
SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT公共控件治理门禁规则.md
<!-- 新增、拆分、迁移或删除任一公共控件时加载，禁止未登记源码和旧私有实现兼容分支。 -->
load_rule_for_active_user_selplat_public_component_create_split_migrate_or_delete = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES
<!-- 应用新增状态交互、body 门户、键盘焦点生命周期或可复用 DOM/CSS/事件组合时加载，先判断是否应建立公共控件。 -->
load_rule_for_active_user_selplat_application_reusable_interaction_or_private_control = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES
<!-- 修改控件 API、主题令牌、ARIA 角色、硬依赖或应用资源顺序时加载，保证登记与调用方同步。 -->
load_rule_for_active_user_selplat_component_api_theme_accessibility_dependency_or_resource_order = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES
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

<!-- SELPLAT 全部程序统一执行语言登记、源码归属和实验工具隔离门禁。 -->
SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT程序源码语言与归属门禁规则.md
<!-- 新建、移动或删除任一应用、shared 或 rule-engine 程序源码时加载。 -->
load_rule_for_active_user_selplat_program_source_create_move_or_delete = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES
<!-- 业务 Controller、Service 或生成模板变更 HTTP 请求输出类型时加载，禁止重复建立公共协议。 -->
load_rule_for_active_user_selplat_application_http_request_response_or_result_change = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES
<!-- 新增 src/main 语言目录、构建语言入口或规则能力时加载。 -->
load_rule_for_active_user_selplat_source_language_root_build_entry_or_ability_change = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES
<!-- 交付前检查未登记语言、错误能力归属、实验代码和源码缓存时加载。 -->
load_rule_for_active_user_selplat_all_program_source_ownership_delivery_scan = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

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
<!-- 修改 getGridColumn 本地 Provider、独立 Reference Data HTTP 适配、字段名静默降级或统一 columns 返回结构时加载。 -->
load_rule_for_active_user_selplat_grid_column_local_remote_provider_and_silent_field_fallback = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- SELPLAT 新业务工程和可追加业务表统一由 MDA 脚手架生成，并实行无覆盖冲突保护。 -->
SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT应用脚手架生成规则.md
<!-- 使用工程名和表名创建 apps 下的新应用时加载，保证完整分层、默认字段和 Host 登记同步生成。 -->
load_rule_for_active_user_selplat_application_scaffold_creation = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES
<!-- 向已由 MDA 生成器拥有的工程追加业务表时加载，保证新表和页面三件套不覆盖既有文件。 -->
load_rule_for_active_user_selplat_generated_project_table_append = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES
<!-- 修改脚手架模板、默认字段、引用数据扩展点、生成页面或冲突策略时加载。 -->
load_rule_for_active_user_selplat_scaffold_template_defaults_reference_data_or_collision_change = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES
