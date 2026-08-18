# MDA 本地数据库工作台功能规则

<!-- 本规则没有稳定 Java 自动化入口，应用实现仍按 MDA 模块测试验证。 -->
java_ability_refs = none
<!-- 本规则没有需要重复生成的 Python 成品，因此不虚构 Python 能力。 -->
python_ability_refs = none
<!-- 本规则没有独立 Node 程序，前端行为由 MDA 应用脚本和浏览器回归承载。 -->
node_ability_refs = none
<!-- 3.11.0 增加真实结果字段表头复选框，并按右键当前行生成 AND 多字段条件。 -->
rule_version = 3.11.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已经进入当前用户索引并完成实现回归。 -->
rule_status = active
<!-- 本次升级把用户确认的选区优先执行行为固化到 MDA 工作台，避免按钮和快捷键以后再次分叉。 -->
selected_sql_upgrade_record = 2026-08-11:execute_nonblank_editor_selection_first_fallback_to_full_value_preserve_unexecuted_dirty_state
<!-- 本次修复把工具栏夺取焦点造成的选区丢失纳入防复发约束。 -->
selected_sql_selection_lifecycle_upgrade_record = 2026-08-11:capture_selection_before_toolbar_focus_change_restore_after_execution
<!-- 本次升级禁止未选中时整体提交编辑器内的多条 SQL，避免显示结果与实际副作用不一致。 -->
selected_sql_required_upgrade_record = 2026-08-11:require_nonblank_selection_warn_and_send_no_request_when_missing
<!-- 本次升级把多字段选择固定为公共 selGrid 表头能力，并保留未勾选时的单字段兼容行为。 -->
multi_field_where_upgrade_record = 2026-08-11:shared_grid_header_field_selection_current_row_values_joined_by_AND
<!-- 升级记录说明本规则来自用户对双数据库和连接配置职责的纠正。 -->
upgrade_record = 2026-08-07:固定MDA单控制库与动态目标数据库连接架构;2026-08-08:控制库与动态目标库升级为隔离连接池并增加闲置回收和元数据短缓存;2026-08-08:控制库统一继承MdaBaseDao并将动态目标数据库能力归并到targetdatabase;2026-08-08:控制库改为直接绑定HikariConfig并删除重复属性类和connectionprofile/common层;2026-08-08:控制库配置提升到MDA项目common/persistence与Uniauth结构统一;2026-08-08:动态查询结果启用公共selGrid可选宽表模式;2026-08-08:宽表横向滚动条升级为静止可发现的主题化反馈;2026-08-08:横向与纵向滚动条统一静止亮度和主题反馈;2026-08-08:滚动条反馈提升为所有selGrid真实溢出时的通用默认行为;2026-08-08:连接配置CRUD改为空实现并将定义解析连接测试和连接池生命周期拆入独立职责;2026-08-08:数据库页面升级为左树右查询页签且页签内上方SQL下方结果表格;2026-08-09:数据库连接与表视图节点增加编辑删除复制右键菜单并固定删除确认边界;2026-08-09:删除确认迁移为紧凑公共确认框并默认聚焦取消;2026-08-09:控制库删除认证租户操作人表字段与迁移残留;2026-08-09:默认查询改为裸表名且结构编辑按真实数据库生成原注释模板;2026-08-09:双击查询结果行按真实主键标色并通过共享窗口安全更新单行;2026-08-09:编辑窗口仅显示字段名并保留字符长文本多行输入且标色聚焦双击字段;2026-08-10:SELPLAT应用H2相对路径固定从工程根解析_阻止Host子目录误建同名空库;2026-08-10:MDA查询Tab接入selContextMenu_增加关闭右侧_关闭其他_全部关闭并保留未保存检查;2026-08-11:MDA数据库树默认展开数据库目录与PUBLIC_Schema_系统Schema与表保持折叠;2026-08-11:修正异步元数据替换保留空展开集合_首次加载与切换连接重新挂载树;2026-08-11:表与数据库右键增加中央登记H2启动SQL全量导出_原子替换并失败回滚;2026-08-11:删除_覆盖导出_未保存SQL关闭_跨文件工程生成统一使用公共确认框_表导出移到菜单末尾;2026-08-11:删除MDA专属架构门禁_固定表业务_无状态能力_common全部服从SELPLAT全项目通用结构;2026-08-11:表右键首项增加A5风格只读结构页签_展示属性字段含义索引外键且复用公共Tab与Grid;2026-08-11:数据库连接栏接入公共selPanel栏目拖拽_默认360_最小240_最大720;2026-08-11:全部默认表查询字段表头悬停显示数据库COMMENT_无注释不显示提示;2026-08-11:查询结果单元格增加Select_From_Where_按JDBC类型生成字面量并通过公共编辑器API追加

## 数据库边界

<!-- MDA 只允许维护一个永久控制库，禁止再次自动生成默认工作库。 -->
mda_permanent_database_model = single_control_database_only
<!-- 控制库的工程相对位置固定，便于开发者备份和确认数据归属。 -->
mda_control_database_path = apps/mda/db/mda.mv.db
<!-- 控制表只记录目标数据库连接属性，不复制目标数据库业务表或数据。 -->
mda_control_table_responsibility = persist_dynamic_target_connection_profiles_only
<!-- MDA 控制库只保留连接配置和其主键号段，禁止加入认证、租户、角色、权限或操作人表。 -->
mda_control_database_forbidden_business_tables = authentication
<!-- mda_control_database_forbidden_business_tables.2 的当前独立事实为 tenant。 -->
mda_control_database_forbidden_business_tables.2 = tenant
<!-- mda_control_database_forbidden_business_tables.3 的当前独立事实为 role。 -->
mda_control_database_forbidden_business_tables.3 = role
<!-- mda_control_database_forbidden_business_tables.4 的当前独立事实为 permission。 -->
mda_control_database_forbidden_business_tables.4 = permission
<!-- mda_control_database_forbidden_business_tables.5 的当前独立事实为 operator。 -->
mda_control_database_forbidden_business_tables.5 = operator
<!-- MDA 固定表不得保存租户和操作人标识，防止通用业务表字段重新把身份边界带入本地工具。 -->
mda_control_database_forbidden_identity_columns = tenantId
<!-- mda_control_database_forbidden_identity_columns.2 的当前独立事实为 lastOperateUserId。 -->
mda_control_database_forbidden_identity_columns.2 = lastOperateUserId
<!-- 旧库升级只保留 MDA 连接配置和号段数据，禁止在生产脚本或测试 fixture 中重建其他应用的表来执行清理。 -->
mda_legacy_identity_artifact_policy = remove_from_mda_without_recreating_foreign_application_tables_or_fixtures
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
<!-- 目标数据库连接账号决定原始 SQL 实际可执行范围，MDA 只负责执行和返回结果。 -->
mda_sql_execution_boundary = target_database_connection_account_capabilities
<!-- file:./apps/... 是 SELPLAT 工程坐标，必须从包含 settings.gradle 与 apps 的工程根解析，禁止按 Host 或 Gradle 当前目录解释。 -->
mda_selplat_h2_relative_path_resolution = file_dot_slash_apps_resolves_from_verified_selplat_project_root_never_process_working_directory

## 后端业务边界

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
<!-- MDA 不拥有专属结构：真实表、无状态能力和公共实现必须分别进入通用 table-business、capability 与 common 目录。 -->
mda_source_structure_owner = SELPLAT_uniform_managed_application_gate_no_mda_exception
<!-- 所有访问控制库固定表的 DAO 必须继承 MdaBaseDao；不得由业务 DAO 重复选择控制数据源。 -->
mda_control_dao_inheritance = all_fixed_control_table_daos_extend_mda_base_dao
<!-- 每张固定表只有一个业务 Service 接口和一个实现；表专属默认值和事务留在该表 ServiceImpl，禁止项目级 BaseService 特例。 -->
mda_control_service_boundary = one_table_one_service_contract_and_impl
<!-- mda_control_service_boundary.2 的当前独立事实为 no_project_base_service_exception。 -->
mda_control_service_boundary.2 = no_project_base_service_exception
<!-- 连接配置 CRUD 接口只继承 BaseService，禁止声明目标连接测试、定义解析或连接池管理方法。 -->
mda_connection_profile_service_boundary = control_table_base_crud_only
<!-- 已保存或临时连接字段统一由 common/util/jdbc 解析器转换，metadata 与 sql 能力禁止反向借用连接配置 CRUD Service。 -->
mda_connection_definition_resolution = common_util_jdbc_resolver_shared_by_capability_services
<!-- 真实连接测试、元数据、SQL、行编辑、导出和工程生成统一进入 capability/<能力>/controller|service。 -->
mda_non_persistent_capability_owner = capability/targetconnection|metadata|sql|rowdata|sqlexport|projectgenerator
<!-- 配置更新或删除后的旧目标池失效由 common/config 生命周期处理器承接，不得形成业务目录第四种角色。 -->
mda_profile_pool_invalidation_owner = common_config_lifecycle_handler_outside_table_business_roles
<!-- 动态目标数据库能力不得继承绑定控制库的 MdaBaseDao，防止运行时查询误入 mda.mv.db。 -->
mda_target_database_base_dao_policy = forbidden_to_extend_control_database_mda_base_dao
<!-- 升级后不保留 projectgenerator、targetdatabase、common/service 或 connectionprofile/lifecycle 旧包。 -->
mda_legacy_package_compatibility = projectgenerator_targetdatabase_common_service_connectionprofile_lifecycle_forbidden

## 前端组件

<!-- 连接新增与编辑使用共享窗口和下拉，删除使用共享紧凑确认框，禁止原生弹窗形成第二套样式。 -->
mda_connection_management_components = shared_window_shared_dropdown_and_shared_compact_confirm_dialog
<!-- 连接窗口必须保留公共窗口的移动、缩放、最小化和最大化能力。 -->
mda_window_capabilities = movable_resizable_minimizable_maximizable
<!-- 空连接时只显示可执行的新增入口，有连接后再显示编辑、删除和 SQL 操作。 -->
mda_empty_state_action_policy = show_create_only_until_connection_exists
<!-- 新增、更新或删除连接后必须刷新连接下拉、当前值、元数据树和统计数字。 -->
mda_connection_change_refresh_scope = dropdown_selection_metadata_tree_and_counts
<!-- 数据库连接栏的横向宽度调整必须使用公共 selPanel 工具栏栏目能力，禁止 MDA 自建分隔线、样式或 pointer 事件。 -->
mda_connection_toolbar_resize_owner = shared_selPanel_toolbar_column_resize
<!-- mda_connection_toolbar_resize_owner.2 的当前独立事实为 no_private_dom_css_pointer_logic。 -->
mda_connection_toolbar_resize_owner.2 = no_private_dom_css_pointer_logic
<!-- MDA 初始宽度保持紧凑，人工拖拽只能在公共安全边界内变化，双击回到初始宽度。 -->
mda_connection_toolbar_resize_widths = default:360
<!-- mda_connection_toolbar_resize_widths.2 的当前独立事实为 min:240。 -->
mda_connection_toolbar_resize_widths.2 = min:240
<!-- mda_connection_toolbar_resize_widths.3 的当前独立事实为 max:720。 -->
mda_connection_toolbar_resize_widths.3 = max:720
<!-- mda_connection_toolbar_resize_widths.4 的当前独立事实为 double_click_restore_default。 -->
mda_connection_toolbar_resize_widths.4 = double_click_restore_default
<!-- 页面骨架和公共组件必须先完成挂载，再异步读取连接配置；控制库响应慢时不得阻塞整个工作台首屏。 -->
mda_initial_render_policy = mount_shared_shell_before_async_connection_profile_loading
<!-- 动态数据库字段数量不固定；MDA 必须通过 payload 显式启用 selGrid 宽表模式，由表格中央视口独立水平滚动。 -->
mda_dynamic_result_grid_layout = shared_selgrid_opt_in_horizontal_scroll
<!-- 默认表查询的每个真实字段必须把 JDBC 元数据 COMMENT 作为公共表格头 tooltip 输入，禁止前端写死字段说明。 -->
mda_dynamic_result_header_comment_source = jdbc_metadata_column_remarks_to_selgrid_column_tooltip
<!-- 字段 COMMENT 为空或查询表达式无法匹配真实表字段时不得生成空提示；有 COMMENT 时不以表头是否截断作为显示条件。 -->
mda_dynamic_result_header_comment_behavior = all_real_columns_mouse_hover
<!-- mda_dynamic_result_header_comment_behavior.2 的当前独立事实为 show_nonblank_comment_without_truncation_requirement。 -->
mda_dynamic_result_header_comment_behavior.2 = show_nonblank_comment_without_truncation_requirement
<!-- mda_dynamic_result_header_comment_behavior.3 的当前独立事实为 no_empty_tooltip。 -->
mda_dynamic_result_header_comment_behavior.3 = no_empty_tooltip
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
<!-- 数据库结构树初次挂载时只默认展开数据库目录和名称大小写归一后等于 PUBLIC 的 Schema。 -->
mda_metadata_tree_default_expansion = catalog_and_exact_public_schema_only
<!-- INFORMATION_SCHEMA、其他 Schema、表和字段必须保持默认折叠，避免大库首次加载展开过多节点。 -->
mda_metadata_tree_default_collapsed_nodes = information_schema_other_schema_table_and_column
<!-- 页面空骨架后的首次异步元数据加载及切换连接必须重新挂载 MDA 树，确保新 payload 的默认展开集合被采集。 -->
mda_metadata_tree_default_expansion_apply_timing = initial_async_metadata_and_connection_switch_remount
<!-- 同一连接内普通元数据刷新继续使用 setLocale 保留用户当前展开集合，禁止每次刷新强制复位。 -->
mda_metadata_tree_same_connection_refresh = preserve_user_expansion_via_setLocale
<!-- 每个查询页签内部固定为上方 SQL 编辑区、下方查询结果表格，并由独立分隔器调整高度。 -->
mda_query_tab_layout = inline_sql_editor_above_result_grid_with_independent_split_pane
<!-- 点击表节点必须使用不带 schema 和标识符引号的真实表名生成默认查询并立即加载结果。 -->
mda_table_node_open_behavior = open_or_reuse_table_query_tab_execute_select_from_plain_table_name_without_schema_or_identifier_quotes
<!-- 双击结果行必须立即标色同一条真实数据，并使用共享业务窗口承载字段编辑。 -->
mda_result_row_double_click_behavior = highlight_exact_row_and_open_shared_data_edit_window
<!-- 数据编辑窗口标签只显示真实数据库字段名，数据库类型不得挤入标签文字。 -->
mda_row_edit_field_label_policy = database_field_name_only_without_inline_type
<!-- VARCHAR、CHARACTER VARYING 等字符长文本字段必须继续使用多行输入，不得因标签精简退回单行。 -->
mda_row_edit_character_field_control = multiline_textarea
<!-- 双击非主键单元格后必须在共享窗口中持续标色并聚焦对应可编辑字段，明确当前修改目标。 -->
mda_double_clicked_cell_field_feedback = highlight_and_focus_matching_editable_control
<!-- 双击主键只确定记录身份，主键不可编辑且不得错误标色其他可编辑字段。 -->
mda_double_clicked_primary_key_feedback = identity_only_without_editable_field_highlight
<!-- 数据编辑必须使用 JDBC 元数据读取的真实主键唯一定位；无主键表禁止保存。 -->
mda_row_edit_target_identity = actual_database_primary_key_required
<!-- 主键只作为目标记录身份展示，当前编辑窗口不得修改主键值。 -->
mda_row_edit_primary_key_policy = display_as_target_identity_not_editable
<!-- 保存必须使用参数化单行 UPDATE，影响行数不是一时回滚；成功后刷新查询并重新标色目标行。 -->
mda_row_edit_save_policy = prepared_single_row_update_then_refresh_and_reselect
<!-- 取消或关闭编辑窗口清除标色；成功刷新后保留目标行标色，明确刚修改的数据。 -->
mda_row_edit_close_highlight_policy = clear_on_cancel_or_close_preserve_after_successful_refresh
<!-- 自定义 SQL、被用户改写的表查询和缺少完整主键的结果只读，禁止猜测表与目标记录。 -->
mda_ad_hoc_query_edit_policy = read_only_without_verified_table_and_primary_key
<!-- 新建查询必须创建独立页签，不再弹出 SQL 窗口。 -->
mda_new_sql_query_behavior = create_independent_inline_query_tab_without_popup_window
<!-- 每个查询页签独立保存 SQL、列定义、结果、分页和控件实例，切换不得重建。 -->
mda_query_session_scope = one_independent_preserved_session_per_tab
<!-- 页签切换只隐藏并保留状态，关闭必须销毁 DOM、监听器、控制器和全部公共组件注册。 -->
mda_query_tab_lifecycle = switch_preserves_by_hiding_close_destroys_complete_session
<!-- 切换数据库连接必须关闭旧连接的全部查询页签，禁止复用旧连接的 SQL 或结果。 -->
mda_connection_switch_query_policy = destroy_all_query_tabs_before_loading_selected_connection_metadata
<!-- 页签、右键菜单、分隔器、SQL 编辑区和查询结果统一复用公共 selTabs、selContextMenu、selSplitPane、selCodeEditor 和 selGrid。 -->
mda_query_workspace_shared_components = selTabs_selContextMenu_selSplitPane_selCodeEditor_selGrid
<!-- SQL 编辑器只允许执行非空选区；没有有效选区时提示先选中 SQL 且不发送请求，按钮和 Ctrl/Command+Enter 必须共用同一动作入口。 -->
mda_query_execute_selection_policy = selection_required
<!-- mda_query_execute_selection_policy.2 的当前独立事实为 empty_or_whitespace_selection_warns_and_sends_no_request。 -->
mda_query_execute_selection_policy.2 = empty_or_whitespace_selection_warns_and_sends_no_request
<!-- mda_query_execute_selection_policy.3 的当前独立事实为 button_and_ctrl_or_command_enter_same_action。 -->
mda_query_execute_selection_policy.3 = button_and_ctrl_or_command_enter_same_action
<!-- 选区只能通过 selCodeEditor 公开 API 读取；只执行选区时未执行的其余编辑内容继续保持未保存状态。 -->
mda_query_selection_editor_boundary = shared_selCodeEditor_getSelectedValue
<!-- mda_query_selection_editor_boundary.2 的当前独立事实为 no_internal_textarea_access。 -->
mda_query_selection_editor_boundary.2 = no_internal_textarea_access
<!-- mda_query_selection_editor_boundary.3 的当前独立事实为 unexecuted_remainder_stays_dirty。 -->
mda_query_selection_editor_boundary.3 = unexecuted_remainder_stays_dirty
<!-- 工具栏动作必须在焦点变化前保存选区；选中 SQL 无论成功或失败都恢复原选区并保持可见高亮。 -->
mda_query_execute_selection_visual_lifecycle = capture_before_toolbar_focus_change
<!-- mda_query_execute_selection_visual_lifecycle.2 的当前独立事实为 restore_after_success_or_failure。 -->
mda_query_execute_selection_visual_lifecycle.2 = restore_after_success_or_failure
<!-- mda_query_execute_selection_visual_lifecycle.3 的当前独立事实为 selected_highlight_remains_visible。 -->
mda_query_execute_selection_visual_lifecycle.3 = selected_highlight_remains_visible
<!-- 查询 Tab 右键操作固定提供关闭右侧、关闭其他和全部关闭，当前 Tab 由已有关闭按钮处理；无目标时显示禁用状态。 -->
mda_query_tab_context_actions = close_right
<!-- mda_query_tab_context_actions.2 的当前独立事实为 close_others。 -->
mda_query_tab_context_actions.2 = close_others
<!-- mda_query_tab_context_actions.3 的当前独立事实为 close_all。 -->
mda_query_tab_context_actions.3 = close_all
<!-- mda_query_tab_context_actions.4 的当前独立事实为 current_uses_existing_close_button。 -->
mda_query_tab_context_actions.4 = current_uses_existing_close_button
<!-- mda_query_tab_context_actions.5 的当前独立事实为 disabled_when_unavailable。 -->
mda_query_tab_context_actions.5 = disabled_when_unavailable
<!-- 查询结果真实字段单元格右键固定提供 Select From Where，并把完整查询作为两行新语句追加到当前 SQL 编辑框。 -->
mda_result_cell_select_from_where_action = shared_context_menu
<!-- mda_result_cell_select_from_where_action.2 的当前独立事实为 SELECT_all_from_current_table_then_WHERE_real_column_equals_clicked_value。 -->
mda_result_cell_select_from_where_action.2 = SELECT_all_from_current_table_then_WHERE_real_column_equals_clicked_value
<!-- mda_result_cell_select_from_where_action.3 的当前独立事实为 append_as_two_lines。 -->
mda_result_cell_select_from_where_action.3 = append_as_two_lines
<!-- 查询结果只给真实数据库字段显示公共表头复选框；业务层只能通过 selGrid 公开 API 读取已选字段。 -->
mda_result_header_field_selection = real_database_columns_only
<!-- mda_result_header_field_selection.2 的当前独立事实为 shared_selGrid_headerSelectable。 -->
mda_result_header_field_selection.2 = shared_selGrid_headerSelectable
<!-- mda_result_header_field_selection.3 的当前独立事实为 read_via_getSelectedColumnKeys。 -->
mda_result_header_field_selection.3 = read_via_getSelectedColumnKeys
<!-- mda_result_header_field_selection.4 的当前独立事实为 no_application_header_dom_access。 -->
mda_result_header_field_selection.4 = no_application_header_dom_access
<!-- 勾选字段时取右键当前行的对应值并用 AND 连接；没有勾选字段时保持右键单元格单字段条件。 -->
mda_result_cell_multi_field_where_policy = selected_header_fields_use_context_row_values_joined_by_AND
<!-- mda_result_cell_multi_field_where_policy.2 的当前独立事实为 no_selected_header_field_falls_back_to_clicked_cell。 -->
mda_result_cell_multi_field_where_policy.2 = no_selected_header_field_falls_back_to_clicked_cell
<!-- SQL 字面量必须按 JDBC 类型生成；数值和布尔不加单引号，其他非空值单引号包裹并把内部单引号翻倍，NULL 使用 IS NULL。 -->
mda_result_cell_where_literal_policy = jdbc_numeric_and_boolean_unquoted
<!-- mda_result_cell_where_literal_policy.2 的当前独立事实为 other_non_null_single_quoted_with_escape。 -->
mda_result_cell_where_literal_policy.2 = other_non_null_single_quoted_with_escape
<!-- mda_result_cell_where_literal_policy.3 的当前独立事实为 null_uses_IS_NULL。 -->
mda_result_cell_where_literal_policy.3 = null_uses_IS_NULL
<!-- 应用只能调用 selCodeEditor appendValue 追加 SQL，由公共控件统一更新行号、光标、焦点和变更事件。 -->
mda_result_cell_sql_editor_boundary = shared_selCodeEditor_appendValue
<!-- mda_result_cell_sql_editor_boundary.2 的当前独立事实为 no_application_textarea_mutation。 -->
mda_result_cell_sql_editor_boundary.2 = no_application_textarea_mutation
<!-- SQL 相对页签初始值或最近一次成功执行值发生变化即为未保存；关闭、批量关闭和切换连接前合并确认。 -->
mda_query_tab_unsaved_close_policy = compare_initial_or_last_successful_execution
<!-- mda_query_tab_unsaved_close_policy.2 的当前独立事实为 single_and_batch_and_connection_switch_confirm。 -->
mda_query_tab_unsaved_close_policy.2 = single_and_batch_and_connection_switch_confirm
<!-- mda_query_tab_unsaved_close_policy.3 的当前独立事实为 one_dialog_for_all_dirty_tabs。 -->
mda_query_tab_unsaved_close_policy.3 = one_dialog_for_all_dirty_tabs
<!-- MDA 工作区颜色、边框、焦点和活动状态只消费公共主题语义令牌，禁止页面内建立第二套颜色值。 -->
mda_query_workspace_visual_tokens = unified_shared_theme_semantic_tokens_only
<!-- 数据库目录节点右键菜单固定提供编辑连接、删除连接和复制名称；删除只影响 MDA 连接配置。 -->
mda_catalog_context_actions = edit_connection
<!-- mda_catalog_context_actions.2 的当前独立事实为 delete_connection_profile。 -->
mda_catalog_context_actions.2 = delete_connection_profile
<!-- mda_catalog_context_actions.3 的当前独立事实为 copy_display_label。 -->
mda_catalog_context_actions.3 = copy_display_label
<!-- mda_catalog_context_actions.4 的当前独立事实为 export_registered_application_database_last。 -->
mda_catalog_context_actions.4 = export_registered_application_database_last
<!-- 表或视图节点右键菜单首项固定为查看结构，其后提供结构编辑、真实删除和复制显示名称，并保持物理表导出在末尾。 -->
mda_table_context_actions = inspect_structure_first_edit_structure_delete_real_target_object_copy_display_label_with_table_type_physical_table_export_last
<!-- 查看结构必须使用连接、Schema 和表名形成稳定 ID，在右侧打开或复用可关闭的只读独立 Tab。 -->
mda_table_structure_view_tab = stable_per_table_reusable_closable_read_only_independent_tab
<!-- 结构页只保留字段表格，字段名后紧跟字段注释，再显示类型、主键、可空、默认值、自增和生成列。 -->
mda_table_structure_view_content = field_grid_only_name_comment_type_primary_nullable_default_auto_increment_generated
<!-- 结构查看只消费 JDBC 元数据，不得生成、执行或暗中提交 SQL。 -->
mda_table_structure_view_safety = jdbc_metadata_only_without_sql_execution_or_database_mutation
<!-- 结构页签必须复用唯一公共 selGrid，关闭时销毁该 Grid 控制器和会话登记。 -->
mda_table_structure_view_component_lifecycle = shared_selTabs_and_one_selGrid_destroy_controller_on_close
<!-- 查询结果和动态结构 selGrid 必须复用同一份完整 title.messages 契约，禁止只传列与数据形成半成品实例。 -->
mda_dynamic_grid_payload_contract = shared_complete_title_messages_for_query_and_structure_grids
<!-- 表导出只允许物理表；视图继续保留结构编辑和删除能力，但不得伪装成可重建的全量表启动 SQL。 -->
mda_startup_sql_export_object_scope = physical_tables_only_no_views_no_system_schemas
<!-- 导出连接必须是中央登记唯一匹配的 SELPLAT H2 文件库，无法确认工程归属时直接阻断。 -->
mda_startup_sql_export_application_resolution = exact_central_registry_match_for_selplat_h2_file_database_only
<!-- 单表导出生成一份 schema 和一份 data；数据库导出遍历业务 Schema 全部物理表，数据按主键稳定排序。 -->
mda_startup_sql_export_content = one_table_one_schema_and_data_file_full_rows_ordered_by_primary_key
<!-- 全部表先完成主键、标识符和中文业务注释检查，再写临时文件并原子替换；失败恢复全部原正文。 -->
mda_startup_sql_export_write_safety = validate_complete_batch_then_temp_files_atomic_replace_and_restore_on_failure
<!-- 导出会替换同名启动 SQL，前端必须先使用共享确认框明确表级或数据库级覆盖范围；取消时禁止调用导出接口。 -->
mda_startup_sql_export_confirmation = shared_confirm_dialog_before_overwrite_cancel_sends_no_request
<!-- 创建工程会跨文件生成源码、页面、SQL 和中央登记，必须在发送请求前显示工程名与表名并等待一次确认。 -->
mda_project_generation_confirmation = shared_confirm_dialog_with_project_and_table_before_request_cancel_writes_nothing
<!-- 同一导出同时属于覆盖和跨文件写入时只显示一个确认框，禁止重复打断用户。 -->
mda_multiple_risk_confirmation = combine_overwrite_and_cross_file_write_into_one_export_dialog
<!-- 编辑表结构必须按 JDBC 当前数据库产品生成完整 DDL 模板，并写入当前数据库读取到的原表注释和全部原字段注释。 -->
mda_table_structure_edit_template = current_jdbc_database_dialect_with_original_table_and_column_comments
<!-- 数据库中不存在原字段注释时必须输出空字符串，禁止用字段名、新描述或其他合成文本代替。 -->
mda_missing_original_column_comment = emit_empty_sql_string_without_synthetic_fallback
<!-- 结构编辑 SQL 只打开页签而不自动执行，用户主动点击执行后才允许修改目标库。 -->
mda_table_structure_edit_safety = open_non_executed_database_specific_ddl_query_tab
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

<!-- 本规则只固定 MDA 业务行为，不生成重复结构成品，因此模板不适用。 -->
template_not_applicable_reason = application_behavior_constraints_have_no_repeatable_output_template
<!-- 集成测试和真实浏览器流程已经直接构成正确案例，因此不再复制一份容易过期的示例文件。 -->
example_not_applicable_reason = verified_integration_and_browser_flow_are_the_authoritative_example
<!-- 当前动作跨 Spring、H2 和浏览器公共组件，暂不适合抽成单一独立程序。 -->
program_not_applicable_reason = verification_spans_application_runtime_database_and_browser_components
<!-- 后端必须通过 MDA 离线测试，前端必须通过语法检查和真实 8080 页面 CRUD 回归。 -->
verification_required = mda_offline_tests
<!-- verification_required.2 的当前独立事实为 javascript_syntax_check。 -->
verification_required.2 = javascript_syntax_check
<!-- verification_required.3 的当前独立事实为 host_build。 -->
verification_required.3 = host_build
<!-- verification_required.4 的当前独立事实为 browser_connection_crud_and_query_tab_lifecycle_regression。 -->
verification_required.4 = browser_connection_crud_and_query_tab_lifecycle_regression
