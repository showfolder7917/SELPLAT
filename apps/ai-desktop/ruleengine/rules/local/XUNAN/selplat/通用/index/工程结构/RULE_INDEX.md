# 工程结构规则索引

<!-- 本叶子索引由原索引按职责无损分片；逻辑 ID、路径和触发映射保持不变。 -->

<!-- SELPLAT 跨应用 Node.js 与 TypeScript 公共运行能力统一执行唯一源码根、包依赖和安装包白名单。 -->
SELPLAT_NODE_COMMON_CAPABILITY_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLATNode共通能力规则.md

<!-- 新建、迁移或修改 shared/node/common-core 及其公共 API 时加载。 -->
load_rule_for_active_user_selplat_node_common_create_migrate_or_api_change = SELPLAT_NODE_COMMON_CAPABILITY_RULES

<!-- 应用把重复 Node 工具、路径解析或平台基础能力提升到公共层时加载。 -->
load_rule_for_active_user_selplat_application_node_utility_or_path_resolver_promotion = SELPLAT_NODE_COMMON_CAPABILITY_RULES

<!-- Electron 应用新增公共 Node 依赖、调整打包文件或验证安装包内容时加载。 -->
load_rule_for_active_user_selplat_electron_node_common_dependency_packaging_or_artifact_inspection = SELPLAT_NODE_COMMON_CAPABILITY_RULES

<!-- SELPLAT Node.js、TypeScript 和 Electron 应用统一执行源码、配置、依赖、脚本、测试与交付目录边界；单应用协议进入 contracts，根 shared 只承载跨工程共通。 -->
SELPLAT_NODE_APPLICATION_PROJECT_STRUCTURE_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLATNode工程结构规则.md

<!-- 新建、整理、迁移或审查任一 SELPLAT Node.js、TypeScript 或 Electron 应用工程结构时加载。 -->
load_rule_for_active_user_selplat_node_application_create_organize_migrate_or_structure_review = SELPLAT_NODE_APPLICATION_PROJECT_STRUCTURE_RULES

<!-- 移动或删除 Node 应用文件、清理源码树生成物或调整 package 脚本和配置入口时加载。 -->
load_rule_for_active_user_selplat_node_application_file_move_delete_generated_cleanup_or_package_entry_change = SELPLAT_NODE_APPLICATION_PROJECT_STRUCTURE_RULES

<!-- SELPLAT 当前和未来应用统一按真实工程名隔离源码、缓存、构建、临时控制面与长期归档，并阻止 build、cache 与 OPTION/temp 合并或越过清理门槛。 -->
SELPLAT_APPLICATION_PROJECT_DATA_LAYOUT_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT应用工程数据目录结构规则.md

<!-- 新建、整理、迁移或检查任一应用的 cache、build、OPTION/temp、log 或源码目录时加载。 -->
load_rule_for_active_user_selplat_application_cache_build_temp_log_or_source_layout = SELPLAT_APPLICATION_PROJECT_DATA_LAYOUT_RULES

<!-- 新增或修改任务、测试、审批、诊断和协同材料的待执行、运行中、归档或清理流程时加载。 -->
load_rule_for_active_user_selplat_application_execution_archive_or_temp_cleanup_lifecycle = SELPLAT_APPLICATION_PROJECT_DATA_LAYOUT_RULES

<!-- 交付前检查应用临时数据散落、工程名写死、跨工程缓存冲突或源码树污染时加载。 -->
load_rule_for_active_user_selplat_application_data_layout_delivery_scan = SELPLAT_APPLICATION_PROJECT_DATA_LAYOUT_RULES

<!-- SELPLAT 全部程序统一执行语言登记、源码归属和实验工具隔离门禁；非 Gradle 应用由当前用户中央登记提供完整证据。 -->
SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT程序源码语言与归属门禁规则.md

<!-- 新建、移动或删除任一应用、shared 或 rule-engine 程序源码时加载。 -->
load_rule_for_active_user_selplat_program_source_create_move_or_delete = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

<!-- 业务 Controller、Service 或生成模板变更 HTTP 请求输出类型时加载，禁止重复建立公共协议。 -->
load_rule_for_active_user_selplat_application_http_request_response_or_result_change = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

<!-- 新增 src/main 语言目录、构建语言入口或规则能力时加载。 -->
load_rule_for_active_user_selplat_source_language_root_build_entry_or_ability_change = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

<!-- 交付前检查未登记语言、错误能力归属、实验代码和源码缓存时加载。 -->
load_rule_for_active_user_selplat_all_program_source_ownership_delivery_scan = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

<!-- 新增数据库运行类型、登记 H2/SQLite 应用或调整跨运行时数据库门禁分流时加载。 -->
load_rule_for_active_user_selplat_database_runtime_registration_or_engine_governance_route = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES,SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- SELPLAT 工具运行数据统一进入 OPTION/temp，并由程序路径守卫阻止通用技能默认目录逃逸。 -->
SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT工具运行临时目录防逃逸规则.md

<!-- 运行 PDF、OCR、导入器、媒体生成或其他会产生中间文件的工具时加载。 -->
load_rule_for_active_user_selplat_pdf_ocr_importer_media_or_tool_runtime = SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES

<!-- 新增或修改工具输出参数、临时目录默认值、路径解析和清理逻辑时加载。 -->
load_rule_for_active_user_selplat_tool_output_temp_default_path_guard_or_cleanup = SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES

<!-- 交付前扫描工程根 tmp、runtime、日志或临时副本污染时加载。 -->
load_rule_for_active_user_selplat_root_runtime_pollution_delivery_scan = SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES

<!-- SELPLAT 新业务工程和可追加业务表统一由 MDA 脚手架生成，并实行无覆盖冲突保护。 -->
SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT应用脚手架生成规则.md
<!-- SELPLAT 运行时、模块登记或页面修改完成后立即执行目标启动冒烟测试，避免未启动状态继续跑偏。 -->
SELPLAT_RUNTIME_CHANGE_IMMEDIATE_STARTUP_TEST_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT运行时修改后即时启动测试规则.md

<!-- 使用工程名和表名创建 apps 下的新应用时加载，保证完整分层、默认字段和 Host 登记同步生成。 -->
load_rule_for_active_user_selplat_application_scaffold_creation = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES

<!-- 向已由 MDA 生成器拥有的工程追加业务表时加载，保证新表和页面三件套不覆盖既有文件。 -->
load_rule_for_active_user_selplat_generated_project_table_append = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES

<!-- 修改脚手架模板、默认字段、引用数据扩展点、生成页面或冲突策略时加载。 -->
load_rule_for_active_user_selplat_scaffold_template_defaults_reference_data_or_collision_change = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES

<!-- 审查新增或既有应用的默认修复完整性时，同时核对独立后台查询和编辑态保存位置。 -->
load_rule_for_active_user_selplat_default_repair_query_and_page_editor_audit = SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES,SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES,SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES

<!-- SELPLAT 工程目录、构建产物、项目 JDK、运行数据与缓存。 -->
SELPLAT_PROJECT_PATH_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT工程路径规则.md

<!-- load_rule_for_selplat_project_path_or_runtime_output 的当前独立事实为 SELPLAT_PROJECT_PATH_RULES。 -->
load_rule_for_selplat_project_path_or_runtime_output = SELPLAT_PROJECT_PATH_RULES

<!-- load_rule_for_selplat_application_authoritative_local_database 的当前独立事实为 SELPLAT_PROJECT_PATH_RULES。 -->
load_rule_for_selplat_application_authoritative_local_database = SELPLAT_PROJECT_PATH_RULES

<!-- load_rule_for_python_bytecode_cache_location 的当前独立事实为 SELPLAT_PROJECT_PATH_RULES。 -->
load_rule_for_python_bytecode_cache_location = SELPLAT_PROJECT_PATH_RULES

<!-- load_rule_for_selplat_project_jdk_cache_or_legacy_runtime_migration 的当前独立事实为 SELPLAT_PROJECT_PATH_RULES。 -->
load_rule_for_selplat_project_jdk_cache_or_legacy_runtime_migration = SELPLAT_PROJECT_PATH_RULES

<!-- 发布安装版、发布压缩包版的平台数据、缓存、日志、会话和诊断目录统一加载 SELPLAT 工程路径规则。 -->
load_rule_for_selplat_installed_application_data_cache_log_session_or_diagnostics_path = SELPLAT_PROJECT_PATH_RULES

<!-- 开发版源码、编译桌面、安装包或压缩包的工程内缓存与日志目录统一加载 SELPLAT 工程路径规则。 -->
load_rule_for_selplat_developer_application_package_cache_runtime_log_or_diagnostics_path = SELPLAT_PROJECT_PATH_RULES

<!-- AI 通过运行路径清单或桌面接口定位日志时统一加载 SELPLAT 工程路径规则。 -->
load_rule_for_selplat_ai_runtime_path_manifest_or_log_discovery = SELPLAT_PROJECT_PATH_RULES

<!-- SELPLAT 根 Gradle、离线坐标、Wrapper 与 VS Code 导入。 -->
SELPLAT_PROJECT_BUILD_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT工程构建规则.md

<!-- load_rule_for_selplat_gradle_dependency_or_build_output 的当前独立事实为 SELPLAT_PROJECT_BUILD_RULES。 -->
load_rule_for_selplat_gradle_dependency_or_build_output = SELPLAT_PROJECT_BUILD_RULES

<!-- load_rule_for_selplat_vscode_gradle_import_or_cache 的当前独立事实为 SELPLAT_PROJECT_BUILD_RULES。 -->
load_rule_for_selplat_vscode_gradle_import_or_cache = SELPLAT_PROJECT_BUILD_RULES

<!-- 调整正式工程扫描范围、隔离未登记参考目录或检查跨模块引用时加载当前构建规则。 -->
load_rule_for_active_user_selplat_formal_module_scope_or_reference_directory_isolation = SELPLAT_PROJECT_BUILD_RULES

<!-- SELPLAT 规则适配审查与冲突阻断。 -->
SELPLAT_RULE_COMPATIBILITY_BLOCKING_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT规则适配审查与阻断规则.md

<!-- load_rule_for_any_selplat_change_task_compatibility_check 的当前独立事实为 SELPLAT_RULE_COMPATIBILITY_BLOCKING_RULES。 -->
load_rule_for_any_selplat_change_task_compatibility_check = SELPLAT_RULE_COMPATIBILITY_BLOCKING_RULES

<!-- load_rule_for_selplat_rule_incompatible_request_blocking 的当前独立事实为 SELPLAT_RULE_COMPATIBILITY_BLOCKING_RULES。 -->
load_rule_for_selplat_rule_incompatible_request_blocking = SELPLAT_RULE_COMPATIBILITY_BLOCKING_RULES
