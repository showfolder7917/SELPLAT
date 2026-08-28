# SELPLAT 数据库根与运行注册规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 2.18.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 本职责没有独立 Java 能力入口。 -->
java_ability_refs = none
<!-- 本职责没有独立 Python 能力入口。 -->
python_ability_refs = none
<!-- 本职责没有独立 Node 能力入口。 -->
node_ability_refs = none

<!-- 每个应用唯一权威 H2 数据库位于应用 db 根，禁止产生并行数据库副本。 -->
selplat_application_authoritative_database_root = apps/<app>/db/<app>.mv.db
<!-- 应用权威数据库使用的结构和初始化 SQL 统一位于 db/sql，运行数据库文件不得进入 sql。 -->
selplat_application_database_sql_root = apps/<app>/db/sql
<!-- db 目录只允许保存唯一正式数据库、sql 和说明；忽略规则统一位于 SELPLAT 根，禁止在应用内散落 .gitignore。 -->
selplat_application_database_directory_allowed_content = <app>.mv.db
<!-- selplat_application_database_directory_allowed_content.2 的当前独立事实为 sql。 -->
selplat_application_database_directory_allowed_content.2 = sql
<!-- selplat_application_database_directory_allowed_content.3 的当前独立事实为 README.md。 -->
selplat_application_database_directory_allowed_content.3 = README.md
<!-- selplat_application_database_directory_allowed_content.4 的当前独立事实为 no_nested_gitignore。 -->
selplat_application_database_directory_allowed_content.4 = no_nested_gitignore
<!-- SELPLAT 根统一精确忽略 apps/*/db/*.mv.db；活跃运行库保留在本地，但不得因启动写入进入Git提交。 -->
selplat_h2_gitignore_ownership = SELPLAT_root_only
<!-- selplat_h2_gitignore_ownership.2 的当前独立事实为 ignore_apps_db_runtime_mvdb_exactly。 -->
selplat_h2_gitignore_ownership.2 = ignore_apps_db_runtime_mvdb_exactly
<!-- selplat_h2_gitignore_ownership.3 的当前独立事实为 track_db_sql_and_readme_only。 -->
selplat_h2_gitignore_ownership.3 = track_db_sql_and_readme_only
<!-- selplat_h2_gitignore_ownership.4 的当前独立事实为 trace_ignored。 -->
selplat_h2_gitignore_ownership.4 = trace_ignored
<!-- selplat_h2_gitignore_ownership.5 的当前独立事实为 lock_ignored。 -->
selplat_h2_gitignore_ownership.5 = lock_ignored
<!-- selplat_h2_gitignore_ownership.6 的当前独立事实为 temp_ignored。 -->
selplat_h2_gitignore_ownership.6 = temp_ignored
<!-- selplat_h2_gitignore_ownership.7 的当前独立事实为 before_backup_ignored。 -->
selplat_h2_gitignore_ownership.7 = before_backup_ignored
<!-- selplat_h2_gitignore_ownership.8 的当前独立事实为 no_nested_gitignore_any_module。 -->
selplat_h2_gitignore_ownership.8 = no_nested_gitignore_any_module
<!-- 禁止使用 *.mv.db 或 **/*.mv.db 宽泛规则，避免隐藏应用db根之外的数据库材料。 -->
selplat_h2_gitignore_ownership.9 = no_broad_mvdb_ignore_pattern
<!-- 严格本地数据库应用必须在当前用户中央登记中声明 datasourcePrefix，正式模块属性按该前缀唯一登记 sa 与 123456。 -->
selplat_managed_local_database_default_credentials = datasourcePrefix_required
<!-- selplat_managed_local_database_default_credentials.2 的当前独立事实为 username=sa。 -->
selplat_managed_local_database_default_credentials.2 = username=sa
<!-- selplat_managed_local_database_default_credentials.3 的当前独立事实为 password=123456。 -->
selplat_managed_local_database_default_credentials.3 = password=123456
<!-- selplat_managed_local_database_default_credentials.4 的当前独立事实为 exactly_once。 -->
selplat_managed_local_database_default_credentials.4 = exactly_once
<!-- 数据库应用的 SQL 根、数据库位置、主键策略和数据源前缀只在 rule-engine 当前用户中央登记维护；架构不可配置，避免任何项目通过登记选择专属结构。 -->
selplat_managed_database_central_registration = projectName
<!-- selplat_managed_database_central_registration.2 的当前独立事实为 schemaRoot。 -->
selplat_managed_database_central_registration.2 = schemaRoot
<!-- selplat_managed_database_central_registration.3 的当前独立事实为 databaseFile。 -->
selplat_managed_database_central_registration.3 = databaseFile
<!-- selplat_managed_database_central_registration.4 的当前独立事实为 primaryKeyStrategy。 -->
selplat_managed_database_central_registration.4 = primaryKeyStrategy
<!-- selplat_managed_database_central_registration.5 的当前独立事实为 datasourcePrefix。 -->
selplat_managed_database_central_registration.5 = datasourcePrefix
<!-- selplat_managed_database_central_registration.6 的当前独立事实为 no_structure_switch。 -->
selplat_managed_database_central_registration.6 = no_structure_switch
<!-- selplat_managed_database_central_registration.7 的当前独立事实为 no_application_local_managed_marker。 -->
selplat_managed_database_central_registration.7 = no_application_local_managed_marker
<!-- 所有受管应用统一使用三类职责：真实表业务一表一目录、无状态能力进入 capability、复用实现进入 common；禁止项目名分支和专属豁免。 -->
selplat_managed_database_uniform_architecture = table_business:<table-business>/controller|service|dao
<!-- selplat_managed_database_uniform_architecture.2 的当前独立事实为 non_persistent_capability:capability/<capability>/controller|service。 -->
selplat_managed_database_uniform_architecture.2 = non_persistent_capability:capability/<capability>/controller|service
<!-- selplat_managed_database_uniform_architecture.3 的当前独立事实为 reusable_implementation:common/config|persistence|util。 -->
selplat_managed_database_uniform_architecture.3 = reusable_implementation:common/config|persistence|util
<!-- selplat_managed_database_uniform_architecture.4 的当前独立事实为 no_project_specific_structure。 -->
selplat_managed_database_uniform_architecture.4 = no_project_specific_structure
<!-- selplat_managed_database_uniform_architecture.5 的当前独立事实为 no_project_name_bypass。 -->
selplat_managed_database_uniform_architecture.5 = no_project_name_bypass
<!-- 空密码只允许测试属性在内存库或临时库中显式覆盖，正式模块属性禁止为空。 -->
selplat_database_empty_password_boundary = production_forbidden
<!-- selplat_database_empty_password_boundary.2 的当前独立事实为 test_isolated_override_allowed。 -->
selplat_database_empty_password_boundary.2 = test_isolated_override_allowed
