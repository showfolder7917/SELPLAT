# 当前用户 SELPLAT MDA 应用规则索引

<!-- MDA 本地数据库工作台架构规则由当前用户层优先加载。 -->
MDA_LOCAL_DATABASE_WORKBENCH_RULES = local/XUNAN/selplat/应用/mda/rule/RUL_MDA本地数据库工作台架构规则.md

<!-- 修改连接配置 Service、目标连接解析、metadata、sql 或连接池生命周期时必须加载 MDA 架构规则。 -->
mda_connection_profile_and_target_runtime_boundary_trigger = MDA_LOCAL_DATABASE_WORKBENCH_RULES
