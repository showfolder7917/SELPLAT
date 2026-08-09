# 当前用户 SELPLAT 通用规则索引

<!-- 本索引只登记当前用户在 SELPLAT 各应用之间复用的个人工程规则。 -->
active_user_selplat_general_rule_root = local/XUNAN/selplat/通用/rule/

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
<!-- 为项目业务表返回默认前端列定义，或接入 reference-data 配置覆盖与元数据兜底时加载。 -->
load_rule_for_active_user_selplat_default_table_definition_or_reference_data_fallback = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES
<!-- 修改表格定义的 Controller、Service、DAO 分层或 resourceCode/viewCode/locale 标识时加载。 -->
load_rule_for_active_user_selplat_table_definition_controller_service_dao_layering = SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- SELPLAT 新业务工程和可追加业务表统一由 MDA 脚手架生成，并实行无覆盖冲突保护。 -->
SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT应用脚手架生成规则.md
<!-- 使用工程名和表名创建 apps 下的新应用时加载，保证完整分层、默认字段和 Host 登记同步生成。 -->
load_rule_for_active_user_selplat_application_scaffold_creation = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES
<!-- 向已由 MDA 生成器拥有的工程追加业务表时加载，保证新表和页面三件套不覆盖既有文件。 -->
load_rule_for_active_user_selplat_generated_project_table_append = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES
<!-- 修改脚手架模板、默认字段、引用数据扩展点、生成页面或冲突策略时加载。 -->
load_rule_for_active_user_selplat_scaffold_template_defaults_reference_data_or_collision_change = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES
