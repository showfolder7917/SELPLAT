# MDA 本地数据库工作台架构规则

<!-- 本规则没有稳定 Java 自动化入口，应用实现仍按 MDA 模块测试验证。 -->
java_ability_refs = none
<!-- 本规则没有需要重复生成的 Python 成品，因此不虚构 Python 能力。 -->
python_ability_refs = none
<!-- 本规则没有独立 Node 程序，前端行为由 MDA 应用脚本和浏览器回归承载。 -->
node_ability_refs = none
<!-- 1.8.0 将滚动条反馈交给 selGrid 通用默认规则，MDA 只保留动态宽表布局声明。 -->
rule_version = 1.8.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已经进入当前用户索引并完成实现回归。 -->
rule_status = active
<!-- 升级记录说明本规则来自用户对双数据库和连接配置职责的纠正。 -->
upgrade_record = 2026-08-07:固定MDA单控制库与动态目标数据库连接架构;2026-08-08:控制库与动态目标库升级为隔离连接池并增加闲置回收和元数据短缓存;2026-08-08:控制库统一继承MdaBaseDao并将动态目标数据库能力归并到targetdatabase;2026-08-08:控制库改为直接绑定HikariConfig并删除重复属性类和connectionprofile/common层;2026-08-08:控制库配置提升到MDA项目common/persistence与Uniauth结构统一;2026-08-08:动态查询结果启用公共selGrid可选宽表模式;2026-08-08:宽表横向滚动条升级为静止可发现的主题化反馈;2026-08-08:横向与纵向滚动条统一静止亮度和主题反馈;2026-08-08:滚动条反馈提升为所有selGrid真实溢出时的通用默认行为

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
<!-- 动态目标数据库公共连接能力统一进入 targetdatabase/common，元数据与 SQL 分别保留独立分层。 -->
mda_target_database_package_boundary = targetdatabase_common_plus_metadata_plus_sql
<!-- 动态目标数据库能力不得继承绑定控制库的 MdaBaseDao，防止运行时查询误入 mda.mv.db。 -->
mda_target_database_base_dao_policy = forbidden_to_extend_control_database_mda_base_dao
<!-- 升级后不保留根级 metadata、根级 sql 或 common/jdbc 兼容包。 -->
mda_legacy_package_compatibility = forbidden

## 前端组件

<!-- 连接新增、编辑和删除必须使用共享窗口和共享下拉组件，禁止原生弹窗和裸 select 形成第二套样式。 -->
mda_connection_management_components = shared_window_and_shared_dropdown_only
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

## 规则包组成与验证

<!-- 本规则只固定架构决策，不生成重复结构成品，因此模板不适用。 -->
template_not_applicable_reason = architecture_constraints_have_no_repeatable_output_template
<!-- 集成测试和真实浏览器流程已经直接构成正确案例，因此不再复制一份容易过期的示例文件。 -->
example_not_applicable_reason = verified_integration_and_browser_flow_are_the_authoritative_example
<!-- 当前动作跨 Spring、H2 和浏览器公共组件，暂不适合抽成单一独立程序。 -->
program_not_applicable_reason = verification_spans_application_runtime_database_and_browser_components
<!-- 后端必须通过 MDA 离线测试，前端必须通过语法检查和真实 8080 页面 CRUD 回归。 -->
verification_required = mda_offline_tests,javascript_syntax_check,host_build,browser_connection_crud_regression
