# 当前用户 SELPLAT MDA 应用规则索引

<!-- MDA 本地数据库工作台架构规则由当前用户层优先加载。 -->
MDA_LOCAL_DATABASE_WORKBENCH_RULES = local/XUNAN/selplat/应用/mda/rule/RUL_MDA本地数据库工作台架构规则.md

<!-- 修改连接配置 Service、目标连接解析、metadata、sql 或连接池生命周期时必须加载 MDA 架构规则。 -->
mda_connection_profile_and_target_runtime_boundary_trigger = MDA_LOCAL_DATABASE_WORKBENCH_RULES
<!-- 修改 MDA 左树右页签、页签内 SQL 编辑区或查询结果区时必须加载 MDA 架构规则。 -->
mda_database_query_workspace_layout_trigger = MDA_LOCAL_DATABASE_WORKBENCH_RULES
<!-- 修改默认表查询、结构编辑 SQL、数据库方言或表字段注释模板时必须加载 MDA 架构规则。 -->
mda_table_query_and_structure_sql_template_trigger = MDA_LOCAL_DATABASE_WORKBENCH_RULES
<!-- 修改查询结果双击标色、数据编辑窗口、主键定位或单行保存时必须加载 MDA 架构规则。 -->
mda_result_row_edit_trigger = MDA_LOCAL_DATABASE_WORKBENCH_RULES
<!-- 修改数据库连接、表或视图节点右键菜单及真实删除行为时必须加载 MDA 架构规则。 -->
mda_tree_context_actions_trigger = MDA_LOCAL_DATABASE_WORKBENCH_RULES
<!-- 修改 MDA 控制库表、字段、初始化脚本或旧库迁移时必须加载，防止认证与身份数据重新进入。 -->
mda_control_database_schema_or_identity_cleanup_trigger = MDA_LOCAL_DATABASE_WORKBENCH_RULES
