# MDA 本地数据库工作台架构规则

<!-- 本规则没有稳定 Java 自动化入口，应用实现仍按 MDA 模块测试验证。 -->
java_ability_refs = none
<!-- 本规则没有需要重复生成的 Python 成品，因此不虚构 Python 能力。 -->
python_ability_refs = none
<!-- 本规则没有独立 Node 程序，前端行为由 MDA 应用脚本和浏览器回归承载。 -->
node_ability_refs = none
<!-- 首版固定用户确认的单控制库、动态目标连接和本地明文口令边界。 -->
rule_version = 1.0.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已经进入当前用户索引并完成实现回归。 -->
rule_status = active
<!-- 升级记录说明本规则来自用户对双数据库和连接配置职责的纠正。 -->
upgrade_record = 2026-08-07:固定MDA单控制库与动态目标数据库连接架构

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

<!-- 树、元数据和 SQL 必须使用当前连接配置按请求建立目标库连接。 -->
mda_target_connection_lifecycle = load_selected_profile_open_per_request_close_after_request
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
<!-- 当前公共 BaseDao 绑定宿主主数据源时，控制库 DAO 必须使用显式私有 JDBC 上下文避免写错库。 -->
mda_control_dao_policy = explicit_private_jdbc_until_base_supports_named_datasources
<!-- Controller、Service 和 DAO 职责仍必须分开，数据源隔离不能成为跨层直连的理由。 -->
mda_layering_required = controller_service_dao

## 前端组件

<!-- 连接新增、编辑和删除必须使用共享窗口和共享下拉组件，禁止原生弹窗和裸 select 形成第二套样式。 -->
mda_connection_management_components = shared_window_and_shared_dropdown_only
<!-- 连接窗口必须保留公共窗口的移动、缩放、最小化和最大化能力。 -->
mda_window_capabilities = movable_resizable_minimizable_maximizable
<!-- 空连接时只显示可执行的新增入口，有连接后再显示编辑、删除和 SQL 操作。 -->
mda_empty_state_action_policy = show_create_only_until_connection_exists
<!-- 新增、更新或删除连接后必须刷新连接下拉、当前值、元数据树和统计数字。 -->
mda_connection_change_refresh_scope = dropdown_selection_metadata_tree_and_counts

## 规则包组成与验证

<!-- 本规则只固定架构决策，不生成重复结构成品，因此模板不适用。 -->
template_not_applicable_reason = architecture_constraints_have_no_repeatable_output_template
<!-- 集成测试和真实浏览器流程已经直接构成正确案例，因此不再复制一份容易过期的示例文件。 -->
example_not_applicable_reason = verified_integration_and_browser_flow_are_the_authoritative_example
<!-- 当前动作跨 Spring、H2 和浏览器公共组件，暂不适合抽成单一独立程序。 -->
program_not_applicable_reason = verification_spans_application_runtime_database_and_browser_components
<!-- 后端必须通过 MDA 离线测试，前端必须通过语法检查和真实 8080 页面 CRUD 回归。 -->
verification_required = mda_offline_tests,javascript_syntax_check,host_build,browser_connection_crud_regression
