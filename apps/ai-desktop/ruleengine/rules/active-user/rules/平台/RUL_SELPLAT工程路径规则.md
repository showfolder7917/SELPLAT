# SELPLAT 工程路径规则

<!-- active-user 物理目录的真实规则层始终从 AGENTS.md 当前稳定用户解析。 -->
rule_resource_layer_source = AGENTS.md.current_stable_user_id

<!-- 当前工程根由用户明确路径或最近项目标记识别；适用于源码命令和执行内务；业务含义是不得根据 MEMORIES 位置反推工程 -->
current_project_root_must_be_resolved_independently = true

<!-- 当前执行文档和执行池固定在 OPTION，已完成的历史文档固定在 OPTION/temp；适用于任务状态、历史与执行池；业务含义是当前任务状态保持稳定入口，历史归档统一进入可清理的运行数据目录 -->
selplat_execution_internal_root = OPTION
<!-- selplat_execution_history_root 的当前独立事实为 OPTION/temp。 -->
selplat_execution_history_root = OPTION/temp

<!-- Gradle 编译产物和构建报告进入工程根 build；适用于 class、处理后资源、测试框架报告和构建元数据；业务含义是编译生命周期保持集中 -->
selplat_build_artifact_root = build

<!-- Java、Python、能力、脚本和其他执行工具生成的全部运行数据进入 OPTION/temp；适用于业务输出、中间文件、日志、验证结果和临时副本；业务含义是运行副作用只有一个统一出口 -->
selplat_tool_runtime_generated_data_root = OPTION/temp

<!-- 应用自身拥有且需要跨服务重启长期保留的权威业务数据库允许进入对应应用的 db 目录；适用于用户明确指定由应用本身管理的本地文件数据库；业务含义是正式业务数据不被当作可清理的工具临时产物。 -->
selplat_application_authoritative_local_database_root = apps/<app>/db

<!-- 应用 db 目录只允许保存数据库迁移脚本、初始化脚本和本地数据库文件；构建产物、缓存、日志、测试报告与普通临时文件仍必须进入 build、cache 或 OPTION/temp。 -->
selplat_application_db_allowed_content = migration_scripts
<!-- selplat_application_db_allowed_content.2 的当前独立事实为 seed_scripts。 -->
selplat_application_db_allowed_content.2 = seed_scripts
<!-- selplat_application_db_allowed_content.3 的当前独立事实为 authoritative_local_database_files。 -->
selplat_application_db_allowed_content.3 = authoritative_local_database_files
<!-- selplat_application_db_forbidden_content 的当前独立事实为 build_artifacts。 -->
selplat_application_db_forbidden_content = build_artifacts
<!-- selplat_application_db_forbidden_content.2 的当前独立事实为 dependency_cache。 -->
selplat_application_db_forbidden_content.2 = dependency_cache
<!-- selplat_application_db_forbidden_content.3 的当前独立事实为 tool_logs。 -->
selplat_application_db_forbidden_content.3 = tool_logs
<!-- selplat_application_db_forbidden_content.4 的当前独立事实为 test_reports。 -->
selplat_application_db_forbidden_content.4 = test_reports
<!-- selplat_application_db_forbidden_content.5 的当前独立事实为 temporary_copies。 -->
selplat_application_db_forbidden_content.5 = temporary_copies

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

<!-- rule-engine 新运行基础设施统一进入独立 Python 包。 -->
selplat_rule_python_root = apps/ai-desktop/ruleengine/python/ruleengine

<!-- core、common 预留层和当前用户能力统一位于扁平 local 根。 -->
selplat_rule_python_layer_root = apps/ai-desktop/ruleengine/python/local

<!-- 全部派生路径统一从公共路径配置文件解析。 -->
selplat_rule_engine_path_config = apps/ai-desktop/ruleengine/rules/config/路径配置.toml

<!-- rule-engine 的 Java 正式源码根不得重新建立。 -->
selplat_rule_engine_forbidden_source_root = apps/ai-desktop/ruleengine/backend
<!-- selplat_rule_engine_forbidden_source_root.2 的当前独立事实为 apps/ai-desktop/ruleengine/src。 -->
selplat_rule_engine_forbidden_source_root.2 = apps/ai-desktop/ruleengine/src
<!-- selplat_rule_engine_forbidden_source_root.3 的当前独立事实为 apps/ai-desktop/ruleengine/python/com/sp/selplat。 -->
selplat_rule_engine_forbidden_source_root.3 = apps/ai-desktop/ruleengine/python/com/sp/selplat

<!-- 规则、协议、注册信息、文档和模板统一由标准 resources 承载，并由 Python 加载器按索引直接读取。 -->
selplat_rule_resource_root = apps/ai-desktop/ruleengine/rules
<!-- 新增或调整后的 rule-engine 专项规则进入新的资源命名空间。 -->
selplat_rule_engine_new_rule_root = apps/ai-desktop/ruleengine/rules/active-user/rules
<!-- selplat_rule_resource_layer_pattern 的当前独立事实为 apps/ai-desktop/ruleengine/rules/local/<layer>/。 -->
selplat_rule_resource_layer_pattern = apps/ai-desktop/ruleengine/rules/local/<layer>/
<!-- selplat_rule_resource_layer_values 的当前独立事实为 core。 -->
selplat_rule_resource_layer_values = core
<!-- selplat_rule_resource_layer_values.2 的当前独立事实为 common。 -->
selplat_rule_resource_layer_values.2 = common
<!-- selplat_rule_resource_layer_values.3 的当前独立事实为 <stable-user-id>。 -->
selplat_rule_resource_layer_values.3 = <stable-user-id>

<!-- SELPLAT 专属规则位于规则包的 SELPLAT 子目录；适用于平台自身规则沉淀；业务含义是保持工程级规则隔离 -->
selplat_project_common_rule_root = apps/ai-desktop/ruleengine/rules/local/<layer>/selplat/通用/rule

<!-- 现有未分层路径在迁移完成前只作为输入继续读取，禁止继续新增内容；业务含义是切换期间保持可运行但不会扩大旧结构。 -->
selplat_legacy_unlayered_rule_engine_path_policy = read_for_migration_only
<!-- selplat_legacy_unlayered_rule_engine_path_policy.2 的当前独立事实为 no_new_authoring。 -->
selplat_legacy_unlayered_rule_engine_path_policy.2 = no_new_authoring

<!-- 安装版和免安装压缩包版的程序目录只保存不可变程序文件；业务含义是日志、配置、会话、诊断、生成文件和缓存不得因打包方式变化而写入安装目录。 -->
selplat_packaged_application_install_root_is_immutable = true

<!-- 应用运行目录只按开发版或发布版分流；业务含义是是否安装、是否压缩包和可执行文件所在位置都不得改变版本对应的路径策略。 -->
selplat_application_runtime_path_branch_key = application_variant

<!-- Windows 发布应用的默认数据根使用当前用户 LOCALAPPDATA；业务含义是应用无需管理员权限且移动安装目录后仍能找到运行数据。 -->
selplat_release_application_windows_data_root = %LOCALAPPDATA%/SELPLAT/<applicationId>

<!-- macOS 发布应用的持久数据进入 Application Support；业务含义是不得向签名的 app 包或 DMG 挂载目录写入可变数据。 -->
selplat_release_application_macos_data_root = ~/Library/Application Support/SELPLAT/<applicationId>

<!-- macOS 发布应用日志使用系统标准 Logs 目录；业务含义是日志可以被应用和诊断工具稳定定位且不污染安装资源。 -->
selplat_release_application_macos_log_root = ~/Library/Logs/SELPLAT/<applicationId>

<!-- macOS 发布应用缓存使用系统标准 Caches 目录；业务含义是缓存可独立清理且不会删除用户配置、会话或日志。 -->
selplat_release_application_macos_cache_root = ~/Library/Caches/SELPLAT/<applicationId>

<!-- Linux 发布应用遵守 XDG Base Directory；业务含义是数据、配置、缓存和状态目录分别使用 XDG_DATA_HOME、XDG_CONFIG_HOME、XDG_CACHE_HOME 与 XDG_STATE_HOME。 -->
selplat_release_application_linux_path_policy = xdg_base_directory

<!-- 所有开发版入口都必须携带明确 SELPLAT_ROOT 并遵守工程临时目录规范；业务含义是源码热更新、编译桌面版、开发安装包和开发压缩包都把日志与运行数据归入同一个工程根。 -->
selplat_developer_application_runtime_root_policy = explicit_selplat_root_plus_engineering_temporary_directory_spec

<!-- 开发版缓存进入工程 cache/<applicationId>；业务含义是可重建数据集中在工程缓存根，便于开发调试和统一清理。 -->
selplat_developer_application_cache_root = <SELPLAT_ROOT>/cache/<applicationId>

<!-- 开发版运行日志和临时材料进入工程 OPTION/temp/<applicationId>；业务含义是执行中证据继续遵守工程临时目录规范。 -->
selplat_developer_application_runtime_output_root = <SELPLAT_ROOT>/OPTION/temp/<applicationId>

<!-- 开发版终态日志进入工程 log/<applicationId>/归档日志；业务含义是调试结束后的日志可以按现有工程归档入口统一分析。 -->
selplat_developer_application_archive_log_root = <SELPLAT_ROOT>/log/<applicationId>/归档日志

<!-- 发布版默认使用操作系统标准用户目录；业务含义是发布包不得依赖、内置或推断开发机工程绝对路径。 -->
selplat_release_application_runtime_root_policy = operating_system_standard_user_directory

<!-- --selplat-root 只允许开发版、测试和明确内部协作使用；业务含义是发布版不得携带、读取或推断开发工程根。 -->
selplat_root_argument_scope = all_developer_variants_only

<!-- 开发版路径清单进入工程 OPTION/temp；业务含义是 AI 与开发工具可以从工程统一临时入口定位当前日志。 -->
selplat_developer_application_runtime_path_manifest = <SELPLAT_ROOT>/OPTION/temp/<applicationId>/运行路径/runtime-paths.json

<!-- 发布版路径清单进入平台数据根；业务含义是应用移动或升级后仍能从操作系统标准目录定位日志。 -->
selplat_release_application_runtime_path_manifest = <dataRoot>/runtime-paths.json

<!-- AI 的日志定位顺序区分开发版工程清单和发布版平台清单；业务含义是入口均不可用时报告路径不可用，禁止扫描用户磁盘。 -->
selplat_ai_log_discovery_order = desktop_ipc -> SELPLAT_RUNTIME_PATHS_FILE -> developer_selplat_root_manifest_or_release_platform_manifest -> unavailable_without_disk_scan

<!-- 随包 _data 模式只能由用户明确启用并先验证目录可写；业务含义是免安装默认不等于把运行数据写在解压目录旁边。 -->
selplat_release_application_portable_data_mode = explicit_opt_in_and_writable_executable_root_only
