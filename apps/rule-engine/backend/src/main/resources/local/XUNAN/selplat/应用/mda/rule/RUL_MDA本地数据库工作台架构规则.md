# MDA 本地数据库工作台架构规则

<!-- 本规则没有稳定 Java 自动化入口，应用实现仍按 MDA 模块测试验证。 -->
java_ability_refs = none
<!-- 本规则没有需要重复生成的 Python 成品，因此不虚构 Python 能力。 -->
python_ability_refs = none
<!-- 本规则没有独立 Node 程序，前端行为由 MDA 应用脚本和浏览器回归承载。 -->
node_ability_refs = none
<!-- 2.2.0 把删除确认从大型业务窗口迁移到紧凑公共确认框。 -->
rule_version = 2.2.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已经进入当前用户索引并完成实现回归。 -->
rule_status = active
<!-- 升级记录说明本规则来自用户对双数据库和连接配置职责的纠正。 -->
upgrade_record = 2026-08-07:固定MDA单控制库与动态目标数据库连接架构;2026-08-08:控制库与动态目标库升级为隔离连接池并增加闲置回收和元数据短缓存;2026-08-08:控制库统一继承MdaBaseDao并将动态目标数据库能力归并到targetdatabase;2026-08-08:控制库改为直接绑定HikariConfig并删除重复属性类和connectionprofile/common层;2026-08-08:控制库配置提升到MDA项目common/persistence与Uniauth结构统一;2026-08-08:动态查询结果启用公共selGrid可选宽表模式;2026-08-08:宽表横向滚动条升级为静止可发现的主题化反馈;2026-08-08:横向与纵向滚动条统一静止亮度和主题反馈;2026-08-08:滚动条反馈提升为所有selGrid真实溢出时的通用默认行为;2026-08-08:连接配置CRUD改为空实现并将定义解析连接测试和连接池生命周期拆入独立职责;2026-08-08:数据库页面升级为左树右查询页签且页签内上方SQL下方结果表格;2026-08-09:数据库连接与表视图节点增加编辑删除复制右键菜单并固定删除确认边界;2026-08-09:删除确认迁移为紧凑公共确认框并默认聚焦取消

## 数据库边界

<!-- MDA 只允许维护一个永久控制库，禁止再次自动生成默认工作库。 -->
mda_permanent_database_model = single_control_database_only
<!-- 控制库的工程相对位置固定，便于开发者备份和确认数据归属。 -->
mda_control_database_path = apps/mda/db/mda.mv.db
<!-- 控制表只记录目标数据库连接属性，不复制目标数据库业务表或数据。 -->
mda_control_table_responsibility = persist_dynamic_target_connection_profiles_only
<!-- 页面没有连接配置时必须呈现可新增的空状态，禁止偷偷插入演示连接。 -->
mda_default_connection_seed_policy = forbidden
<!-- 旧默认工作库退出架构后只能迁移到可恢复备份或由用户明确删除。 -->
mda_retired_workspace_disposition = recoverable_backup_or_explicit_user_deletion

## 连接与口令边界

<!-- 树、元数据和 SQL 必须使用当前连接配置取得目标库连接；关闭请求连接只归还连接池，不得每次重新创建物理连接。 -->
mda_target_connection_lifecycle = load_selected_profile_borrow_from_reusable_pool_return_after_request
<!-- 每份目标库配置拥有独立的小型连接池；不同配置、控制库和宿主主数据源禁止共用连接池。 -->
mda_target_pool_scope = one_isolated_pool_per_effective_connection_definition
<!-- 目标连接池长时间没有借出连接且当前没有活动连接时必须整体关闭并从注册表移除。 -->
mda_target_pool_idle_disposal = close_and_remove_pool_after_configured_idle_timeout_when_no_active_connection
<!-- 更新或删除连接配置后必须立即关闭旧配置对应的连接池，禁止继续复用旧 URL、账号或口令。 -->
mda_target_pool_profile_change_policy = invalidate_old_pool_after_successful_update_or_delete
<!-- 应用停止时必须关闭全部目标连接池；关闭浏览器页面不直接控制后端连接生命周期。 -->
mda_target_pool_shutdown_policy = application_shutdown_closes_all_pools_browser_close_does_not
<!-- 元数据树允许使用短时内存缓存；SQL 成功执行后必须使当前连接的缓存失效，避免 DDL 后继续展示旧结构。 -->
mda_metadata_cache_policy = short_lived_in_memory_cache_invalidated_after_successful_sql
<!-- 当前用户明确 MDA 不上线，因此连接密码按开发工具要求明文保存。 -->
mda_password_storage = plaintext_for_local_development_only
<!-- 明文密码必须在连接列表和详情中原样返回，保证页面可以直接编辑和重连。 -->
mda_password_response = plaintext
<!-- 明文规则成立的前提是 MDA 不得随业务系统部署到生产环境。 -->
mda_deployment_boundary = local_development_only_never_production
<!-- 数据库账号自身权限是查询和修改的最终边界，MDA 不用关键词过滤伪造权限。 -->
mda_sql_authority_boundary = target_database_account_permissions

## 后端分层

<!-- 固定业务表可以复用公共 Base CRUD，运行时任意目标数据库元数据和 SQL 不得伪装成固定表 CRUD。 -->
mda_base_crud_reuse_boundary = fixed_business_table_only
<!-- MDA 控制库保持模块私有上下文，不得注册为统一宿主主数据源。 -->
mda_control_datasource_scope = module_private_not_host_primary
<!-- MDA 控制库使用模块私有 Hikari DataSource、JdbcTemplate、事务管理器和 BaseDataSourceContext；禁止回退到逐次 DriverManager 连接。 -->
mda_control_dao_policy = module_private_hikari_datasource_jdbc_template_transaction_manager_and_base_context
<!-- 控制库连接池配置由 MDA 资源文件维护，测试必须覆盖到隔离内存库，禁止读写正式 mda.mv.db。 -->
mda_control_pool_configuration = mda_module_properties_with_isolated_test_override
<!-- 控制库参数直接绑定 HikariConfig，禁止另建一份带重复默认值的控制库属性类。 -->
mda_control_pool_binding = official_hikari_config_direct_binding_without_duplicate_custom_properties
<!-- Controller、Service 和 DAO 职责仍必须分开，数据源隔离不能成为跨层直连的理由。 -->
mda_layering_required = controller_service_dao
<!-- MDA 项目 common/config 只保留模块装配入口，BaseDao 与控制库配置统一放入 common/persistence。 -->
mda_module_configuration_boundary = common_config_contains_module_entry_common_persistence_contains_base_dao_and_control_configuration
<!-- 所有访问控制库固定表的 DAO 必须继承 MdaBaseDao；不得由业务 DAO 重复选择控制数据源。 -->
mda_control_dao_inheritance = all_fixed_control_table_daos_extend_mda_base_dao
<!-- 所有访问控制库固定表的 ServiceImpl 只绑定 MdaBaseServiceImpl 与业务 DAO，不得重写父类已经完整提供的 CRUD。 -->
mda_control_service_inheritance = all_fixed_control_table_service_impls_are_empty_bindings_to_mda_base_service_and_business_dao
<!-- MDA 工程级有效数据查询、审计默认字段和具名事务统一由 MdaBaseServiceImpl 承担，具体业务 Service 不重复添加。 -->
mda_control_service_common_behavior_owner = mda_base_service_only
<!-- 连接配置 CRUD 接口只继承 BaseService，禁止声明目标连接测试、定义解析或连接池管理方法。 -->
mda_connection_profile_service_boundary = control_table_base_crud_only
<!-- 已保存或临时连接字段统一由 targetdatabase/common/jdbc 的定义解析器转换，metadata 与 sql 禁止反向借用连接配置 CRUD Service。 -->
mda_connection_definition_resolution = targetdatabase_common_jdbc_resolver_shared_by_connection_metadata_and_sql
<!-- 真实连接测试进入 targetdatabase/connection，控制器只把测试请求委托给目标连接 Service。 -->
mda_target_connection_test_owner = targetdatabase_connection_service
<!-- 配置更新或删除后的旧目标池失效由独立生命周期处理器承接，不得把 JdbcConnectionFactory 注入连接配置 CRUD ServiceImpl。 -->
mda_profile_pool_invalidation_owner = connection_profile_lifecycle_handler_outside_crud_service_impl
<!-- 动态目标数据库公共连接能力统一进入 targetdatabase/common，连接测试、元数据与 SQL 分别保留独立分层。 -->
mda_target_database_package_boundary = targetdatabase_common_plus_connection_plus_metadata_plus_sql
<!-- 动态目标数据库能力不得继承绑定控制库的 MdaBaseDao，防止运行时查询误入 mda.mv.db。 -->
mda_target_database_base_dao_policy = forbidden_to_extend_control_database_mda_base_dao
<!-- 升级后不保留根级 metadata、根级 sql 或 common/jdbc 兼容包。 -->
mda_legacy_package_compatibility = forbidden

## 前端组件

<!-- 连接新增与编辑使用共享窗口和下拉，删除使用共享紧凑确认框，禁止原生弹窗形成第二套样式。 -->
mda_connection_management_components = shared_window_shared_dropdown_and_shared_compact_confirm_dialog
<!-- 连接窗口必须保留公共窗口的移动、缩放、最小化和最大化能力。 -->
mda_window_capabilities = movable_resizable_minimizable_maximizable
<!-- 空连接时只显示可执行的新增入口，有连接后再显示编辑、删除和 SQL 操作。 -->
mda_empty_state_action_policy = show_create_only_until_connection_exists
<!-- 新增、更新或删除连接后必须刷新连接下拉、当前值、元数据树和统计数字。 -->
mda_connection_change_refresh_scope = dropdown_selection_metadata_tree_and_counts
<!-- 页面骨架和公共组件必须先完成挂载，再异步读取连接配置；控制库响应慢时不得阻塞整个工作台首屏。 -->
mda_initial_render_policy = mount_shared_shell_before_async_connection_profile_loading
<!-- 动态数据库字段数量不固定；MDA 必须通过 payload 显式启用 selGrid 宽表模式，由表格中央视口独立水平滚动。 -->
mda_dynamic_result_grid_layout = shared_selgrid_opt_in_horizontal_scroll
<!-- 宽表列宽由公共契约和应用 payload 声明，禁止在 MDA 页面覆盖 selGrid 内部选择器制造私有滚动实现。 -->
mda_dynamic_result_column_width_owner = selgrid_payload_default_and_per_column_width
<!-- 宽表不得扩张外层面板或文档，长值需要截断并保留查看完整值的可访问入口。 -->
mda_dynamic_result_overflow_boundary = center_grid_viewport_with_ellipsis_and_full_value_title
<!-- 宽表滚动条在未悬停时也必须有可识别的轨道、滑块对比和足够操作高度，禁止只靠用户猜测页面可横向滚动。 -->
mda_dynamic_result_horizontal_scrollbar_discoverability = visible_at_rest_with_theme_track_thumb_contrast_and_operable_size
<!-- 可发现性强化由公共 selGrid 根据真实溢出自动承载，MDA 的 horizontalScroll 只声明宽表列布局。 -->
mda_dynamic_result_scrollbar_style_owner = shared_selgrid_automatic_overflow_state
<!-- 横向滚动条必须与同页左树纵向滚动条复用相同的静止滑块、轨道和光晕令牌，只允许操作尺寸和轨道完整性不同。 -->
mda_dynamic_result_scrollbar_visual_consistency = same_resting_track_thumb_and_glow_tokens_as_tree_scrollbar
<!-- 数据库结构树固定在左侧，查询工作区固定在右侧，两区宽度由公共分隔器调整。 -->
mda_database_workspace_layout = left_metadata_tree_right_dynamic_query_tabs_with_shared_split_pane
<!-- 每个查询页签内部固定为上方 SQL 编辑区、下方查询结果表格，并由独立分隔器调整高度。 -->
mda_query_tab_layout = inline_sql_editor_above_result_grid_with_independent_split_pane
<!-- 点击表节点必须打开或复用对应查询页签，填入当前 schema 和表名的默认查询并立即加载结果。 -->
mda_table_node_open_behavior = open_or_reuse_table_query_tab_and_execute_default_select
<!-- 新建查询必须创建独立页签，不再弹出 SQL 窗口。 -->
mda_new_sql_query_behavior = create_independent_inline_query_tab_without_popup_window
<!-- 每个查询页签独立保存 SQL、列定义、结果、分页和控件实例，切换不得重建。 -->
mda_query_session_scope = one_independent_preserved_session_per_tab
<!-- 页签切换只隐藏并保留状态，关闭必须销毁 DOM、监听器、控制器和全部公共组件注册。 -->
mda_query_tab_lifecycle = switch_preserves_by_hiding_close_destroys_complete_session
<!-- 切换数据库连接必须关闭旧连接的全部查询页签，禁止复用旧连接的 SQL 或结果。 -->
mda_connection_switch_query_policy = destroy_all_query_tabs_before_loading_selected_connection_metadata
<!-- 页签、分隔器、SQL 编辑区和查询结果统一复用公共 selTabs、selSplitPane、selCodeEditor 和 selGrid。 -->
mda_query_workspace_shared_components = selTabs_selSplitPane_selCodeEditor_selGrid
<!-- MDA 工作区颜色、边框、焦点和活动状态只消费公共主题语义令牌，禁止页面内建立第二套颜色值。 -->
mda_query_workspace_visual_tokens = unified_shared_theme_semantic_tokens_only
<!-- 数据库目录节点右键菜单固定提供编辑连接、删除连接和复制名称；删除只影响 MDA 连接配置。 -->
mda_catalog_context_actions = edit_connection_delete_connection_profile_copy_display_label
<!-- 表或视图节点右键菜单固定提供结构编辑、真实删除和复制显示名称，并按 JDBC tableType 区分表与视图。 -->
mda_table_context_actions = edit_structure_delete_real_target_object_copy_display_label_with_table_type
<!-- 编辑表结构只打开未自动执行的安全 DDL 模板，用户补全语句并主动执行后才允许修改目标库。 -->
mda_table_structure_edit_safety = open_non_executed_placeholder_ddl_query_tab
<!-- 删除表或视图前必须显示带 schema 的完整限定名称并等待确认；取消时不得发送 SQL。 -->
mda_table_drop_confirmation = show_qualified_name_and_wait_explicit_confirm_before_drop
<!-- 删除确认属于短消息交互，必须使用不可拖动缩放的紧凑公共确认框，禁止复用大型业务表单窗口。 -->
mda_destructive_confirmation_component = compact_shared_confirm_dialog_without_window_management_controls
<!-- 危险确认默认焦点必须停在取消按钮，避免用户按回车时直接执行删除。 -->
mda_destructive_confirmation_default_focus = cancel_action
<!-- 删除成功后只关闭对应查询与结构编辑页签，刷新元数据树并使用短时 Toast 反馈。 -->
mda_table_drop_refresh_scope = close_target_tabs_refresh_metadata_tree_and_show_transient_toast
<!-- 菜单行为由共享 selTree、确认行为由共享 selConfirmDialog 承担，MDA 只声明动作并处理数据库副作用。 -->
mda_tree_context_component_boundary = shared_seltree_menu_and_shared_confirm_dialog_with_application_owned_side_effects

## 规则包组成与验证

<!-- 本规则只固定架构决策，不生成重复结构成品，因此模板不适用。 -->
template_not_applicable_reason = architecture_constraints_have_no_repeatable_output_template
<!-- 集成测试和真实浏览器流程已经直接构成正确案例，因此不再复制一份容易过期的示例文件。 -->
example_not_applicable_reason = verified_integration_and_browser_flow_are_the_authoritative_example
<!-- 当前动作跨 Spring、H2 和浏览器公共组件，暂不适合抽成单一独立程序。 -->
program_not_applicable_reason = verification_spans_application_runtime_database_and_browser_components
<!-- 后端必须通过 MDA 离线测试，前端必须通过语法检查和真实 8080 页面 CRUD 回归。 -->
verification_required = mda_offline_tests,javascript_syntax_check,host_build,browser_connection_crud_and_query_tab_lifecycle_regression
