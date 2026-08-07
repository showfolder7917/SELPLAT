# SELPLAT 工程路径规则

<!-- 当前工程根由用户明确路径或最近项目标记识别；适用于源码命令和执行内务；业务含义是不得根据 MEMORIES 位置反推工程 -->
current_project_root_must_be_resolved_independently = true

<!-- 当前执行文档和执行池固定在 OPTION，已完成的历史文档固定在 OPTION/temp；适用于任务状态、历史与执行池；业务含义是当前任务状态保持稳定入口，历史归档统一进入可清理的运行数据目录 -->
selplat_execution_internal_root = OPTION
selplat_execution_history_root = OPTION/temp

<!-- Gradle 编译产物和构建报告进入工程根 build；适用于 class、处理后资源、测试框架报告和构建元数据；业务含义是编译生命周期保持集中 -->
selplat_build_artifact_root = build

<!-- Java、Python、能力、脚本和其他执行工具生成的全部运行数据进入 OPTION/temp；适用于业务输出、中间文件、日志、验证结果和临时副本；业务含义是运行副作用只有一个统一出口 -->
selplat_tool_runtime_generated_data_root = OPTION/temp

<!-- 应用自身拥有且需要跨服务重启长期保留的权威业务数据库允许进入对应应用的 db 目录；适用于用户明确指定由应用本身管理的本地文件数据库；业务含义是正式业务数据不被当作可清理的工具临时产物。 -->
selplat_application_authoritative_local_database_root = apps/<app>/db

<!-- 应用 db 目录只允许保存数据库迁移脚本、初始化脚本和本地数据库文件；构建产物、缓存、日志、测试报告与普通临时文件仍必须进入 build、cache 或 OPTION/temp。 -->
selplat_application_db_allowed_content = migration_scripts,seed_scripts,authoritative_local_database_files
selplat_application_db_forbidden_content = build_artifacts,dependency_cache,tool_logs,test_reports,temporary_copies

<!-- 测试不得读写应用正式 db 目录，必须继续使用可重建的隔离测试数据库；业务含义是自动化验证不会污染用户长期保存的引用数据。 -->
selplat_application_authoritative_database_test_policy = isolated_rebuildable_test_database_only

<!-- Gradle 用户缓存、项目缓存和离线 jar 进入工程根 cache；适用于所有离线构建与依赖解析；业务含义是缓存可复用且不属于正式产物 -->
selplat_cache_root = cache

<!-- 项目自带的 macOS、Windows 或 Linux JDK 按版本进入 cache/jdks；适用于启动、测试和离线构建脚本；业务含义是可重新准备的工具运行时属于项目缓存，不再建立 runtime/jdks。 -->
selplat_project_jdk_cache_root = cache/jdks

<!-- 工程根禁止继续建立 runtime 目录；适用于历史日志、报告、临时产物、缓存和工具运行时迁移；业务含义是旧 runtime 内容必须按 build、cache、OPTION/temp 的稳定职责重新归类。 -->
selplat_legacy_runtime_root_is_forbidden = true

<!-- Python 字节码缓存进入 cache；适用于能力和测试执行；业务含义是源码目录不得产生 __pycache__ -->
selplat_python_pycache_prefix = cache/python-pycache

<!-- 规则引擎模块统一承载 Java 规则能力，并在 code 包下按 core、common 或稳定用户标识分层；业务含义是代码仍使用标准 Java source set，同时拥有明确覆盖层。 -->
selplat_rule_java_root = apps/rule-engine/backend/src/main/java/com/sp/selplat/local/code
selplat_rule_python_root = apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code
selplat_rule_node_root = apps/rule-engine/backend/src/main/node/com/sp/selplat/local/code
selplat_rule_java_layer_pattern = apps/rule-engine/backend/src/main/java/com/sp/selplat/local/code/<layer>/
selplat_rule_java_layer_values = core,common,<stable-user-id>

<!-- 规则、协议、注册信息、文档和模板统一由标准 resources 承载，并按 core、common 或稳定用户标识分层；业务含义是资源由 Gradle 自动识别且不需要额外 sourceSet。 -->
selplat_rule_resource_root = apps/rule-engine/backend/src/main/resources
selplat_rule_resource_layer_pattern = apps/rule-engine/backend/src/main/resources/local/<layer>/
selplat_rule_resource_layer_values = core,common,<stable-user-id>

<!-- SELPLAT 专属规则位于规则包的 SELPLAT 子目录；适用于平台自身规则沉淀；业务含义是保持工程级规则隔离 -->
selplat_project_common_rule_root = apps/rule-engine/backend/src/main/resources/local/<layer>/selplat/通用/rule

<!-- 现有未分层路径在迁移完成前只作为输入继续读取，禁止继续新增内容；业务含义是切换期间保持可运行但不会扩大旧结构。 -->
selplat_legacy_unlayered_rule_engine_path_policy = read_for_migration_only,no_new_authoring
