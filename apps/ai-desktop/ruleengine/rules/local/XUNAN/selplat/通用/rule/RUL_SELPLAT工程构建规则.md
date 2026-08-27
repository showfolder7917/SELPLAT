# SELPLAT 当前构建规则

<!-- 本规则所有者始终从 AGENTS.md 当前稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id

<!-- 本规则不依赖 Java 执行能力。 -->
java_ability_refs = none

<!-- 本规则不依赖 Python 执行能力。 -->
python_ability_refs = none

<!-- 本规则不依赖 Node 执行能力。 -->
node_ability_refs = none

<!-- SELPLAT 服务端只从工程根统一入口启动；业务含义是用户不需要识别 Host 内部 Gradle 项目路径。 -->
selplat_platform_runtime_user_entry = <SELPLAT_ROOT>/启动SELPLAT.ps1
<!-- Windows CMD 只保留同一工程根入口的批处理代理；业务含义是两个入口共享一套真实启动逻辑。 -->
selplat_platform_runtime_user_entry.2 = <SELPLAT_ROOT>/启动SELPLAT.bat

<!-- 统一入口编译并启动 Host 及其全部显式 Gradle 依赖；业务含义是服务端业务模块不再提供面向用户的单独启动入口。 -->
selplat_platform_runtime_scope = host_and_all_explicit_gradle_dependencies

<!-- 服务端正式工程范围只由 settings.gradle 的 projectDir 显式登记产生；业务含义是目录存在本身不能让参考材料进入构建、运行或自动治理。 -->
selplat_formal_server_module_authority = settings_gradle_explicit_project_dir
<!-- 未登记应用目录只作为人工参考材料；业务含义是自动门禁不得读取、修改、运行或把它当作架构违规修复目标。 -->
selplat_unregistered_application_directory_policy = human_reference_only
<!-- 未登记参考目录不得成为其他正式模块的源码、依赖、运行入口、测试夹具或规则事实来源；业务含义是参考材料不会反向污染生产实现。 -->
selplat_unregistered_application_cross_module_reference_policy = forbidden
<!-- 自动门禁通过正式登记集合确定范围，禁止为某个参考目录写项目名特例；业务含义是以后增加参考材料也不会要求其他代码认识其名称。 -->
selplat_runtime_gate_scope_resolution = registered_module_set_without_reference_name_exception

<!-- 非桌面服务端业务模块只能提供模块配置供 Host 导入；业务含义是模块自身没有第二套进程生命周期。 -->
selplat_server_module_runtime_shape = host_imported_module_configuration_only
<!-- 服务端业务模块不得应用 application 插件或声明 mainClass；业务含义是 Gradle 不生成模块级 run 与分发任务。 -->
selplat_server_module_forbidden_gradle_runtime_entries = application_plugin_or_main_class
<!-- 服务端业务模块不得保留 Spring main、IDE launch 或应用聚合 run；业务含义是源码、IDE 和 Gradle 都不能绕过 Host 单独启动。 -->
selplat_server_module_forbidden_runtime_entries = spring_main_or_ide_launch_or_app_level_run
<!-- classes、test 和 jar 仍是统一编译与统一测试的内部任务；业务含义是退役运行入口不等于取消模块构建和测试。 -->
selplat_server_module_internal_build_tasks = classes_test_jar_kept

<!-- 统一入口启动前必须结束占用 8080 的旧监听进程；业务含义是新 Host 进程能够接管唯一平台端口。 -->
selplat_platform_runtime_port_ownership = stop_existing_8080_listener_before_host_run

<!-- 桌面应用继续位于 apps 下但不参与服务端统一入口；业务含义是应用归属和启动范围由类型决定而不是由目录位置猜测。 -->
selplat_desktop_application_platform_startup_policy = keep_under_apps_and_exclude_from_platform_runtime

<!-- AI Desktop 保持独立 npm 构建、启动和发行生命周期；业务含义是启动 SELPLAT 服务端不会隐式打开 Electron。 -->
selplat_ai_desktop_runtime_boundary = independent_npm_lifecycle_not_invoked_by_platform_runtime

<!-- 工程根 scripts 已被统一入口和各构建系统正式入口完全替代；业务含义是禁止重新建立无所有者的集中脚本骨架。 -->
selplat_root_scripts_directory_status = retired_no_recreation

<!-- 根 Gradle 是 Java 与前端模块的统一构建入口；Python rule-engine 由解释器按任务调用。 -->
selplat_gradle_entry = gradlew

<!-- 所有 Gradle 项目输出按项目路径进入根 build；适用于 class、资源、测试和报告；业务含义是产物集中且模块之间仍可区分 -->
selplat_gradle_build_output = build/<project-path>

<!-- Gradle 用户缓存固定在工程根 cache；适用于 Wrapper 和 IDE 导入；业务含义是离线资源不依赖用户主目录 -->
selplat_gradle_user_home = cache/gradle-user-home

<!-- Gradle 项目缓存固定在工程根 cache；适用于每次 Wrapper 调用；业务含义是模块目录不产生 .gradle -->
selplat_gradle_project_cache = cache/gradle-project-cache

<!-- 持久化离线 jar 固定在工程根 cache；适用于所有 Java 子项目；业务含义是依赖只有一个共享来源 -->
selplat_offline_jar_root = cache/cache-jars

<!-- cache 属于可删除、可重建的非权威资源；适用于字体、渲染素材和工具缓存；业务含义是用户清理缓存后不能被误判为源码或规则损坏。 -->
selplat_cache_lifecycle = deletable
<!-- selplat_cache_lifecycle.2 的当前独立事实为 rebuildable。 -->
selplat_cache_lifecycle.2 = rebuildable
<!-- selplat_cache_lifecycle.3 的当前独立事实为 non_authoritative。 -->
selplat_cache_lifecycle.3 = non_authoritative

<!-- 可选缓存资源不存在时必须返回具体缺失路径并采用已定义的离线回退；适用于字体等不影响核心数据正确性的资源；业务含义是缺失信息可见但不阻断主流程。 -->
selplat_optional_cache_missing_policy = report_missing_resource_path
<!-- selplat_optional_cache_missing_policy.2 的当前独立事实为 use_declared_offline_fallback。 -->
selplat_optional_cache_missing_policy.2 = use_declared_offline_fallback
<!-- selplat_optional_cache_missing_policy.3 的当前独立事实为 continue。 -->
selplat_optional_cache_missing_policy.3 = continue

<!-- Windows 下缓存缺失不得触发联网下载、自动创建假资源或把缺失升级为测试失败；业务含义是离线测试可重复且不会偷偷改变缓存状态。 -->
selplat_windows_optional_cache_missing_forbidden_actions = network_download
<!-- selplat_windows_optional_cache_missing_forbidden_actions.2 的当前独立事实为 synthetic_resource_creation。 -->
selplat_windows_optional_cache_missing_forbidden_actions.2 = synthetic_resource_creation
<!-- selplat_windows_optional_cache_missing_forbidden_actions.3 的当前独立事实为 test_failure_for_absence_alone。 -->
selplat_windows_optional_cache_missing_forbidden_actions.3 = test_failure_for_absence_alone

<!-- 第三方依赖使用标准 Maven 坐标声明，公共版本统一来自根 gradle.properties；适用于应用和共享模块；业务含义是 VS Code 与命令行读取同一依赖模型 -->
selplat_dependency_declaration = explicit_maven_coordinate_with_root_version_property

<!-- 离线坐标对应的 jar 不存在时必须先补入工程 cache；适用于编译、测试和 IDE 导入；业务含义是禁止联网下载或用错误版本伪装成功 -->
selplat_missing_offline_dependency_policy = stop_and_place_exact_jar_in_cache/cache-jars

<!-- 本机执行默认使用离线模式；适用于编译、测试和运行验证；业务含义是不得为完成任务下载依赖或工具 -->
selplat_gradle_default_mode = offline

<!-- Java 版本由根 Gradle 统一控制；适用于 Gradle 与 VS Code；业务含义是模块不得各自漂移编译版本 -->
selplat_java_version_is_root_managed = true

<!-- rule-engine 运行能力只使用按任务调用的 Python；业务含义是规则加载和能力执行不需要常驻服务。 -->
selplat_rule_engine_runtime_language = on_demand_python

<!-- rule-engine 不注册为 Gradle 子项目，避免无意义的 Gradle 配置、启动和 IDE 工程模型。 -->
selplat_rule_engine_gradle_project_type = not_a_gradle_subproject

<!-- rule-engine 只通过规则执行器、加载器或具名 ability 进入；业务含义是不存在独立 HTTP 启动入口。 -->
selplat_rule_engine_runtime_entry = task_executor_or_loader_or_named_ability

<!-- rule-engine 禁止重新建立健康检查、页面转发或桌面代理 HTTP 服务；业务含义是唯一平台 HTTP 端口归 Host 所有。 -->
selplat_rule_engine_http_runtime_status = retired_no_recreation

<!-- 根工程门禁按文件路径直接调用 rule-engine Python 测试，不建立模块 Gradle 任务。 -->
selplat_root_gate_rule_engine_integration = direct_python_task_without_subproject

<!-- core、common 和用户代码目录必须位于 Python 标准源根内部。 -->
selplat_rule_engine_layering_inside_standard_source_set = apps/ai-desktop/ruleengine/python/local/<layer>
<!-- selplat_rule_engine_layering_inside_standard_source_set.2 的当前独立事实为 apps/ai-desktop/ruleengine/rules/local/<layer>。 -->
selplat_rule_engine_layering_inside_standard_source_set.2 = apps/ai-desktop/ruleengine/rules/local/<layer>
<!-- selplat_rule_engine_layering_must_not_add_custom_source_set 的当前独立事实为 true。 -->
selplat_rule_engine_layering_must_not_add_custom_source_set = true

<!-- VS Code 中 Java 模块的编译与运行必须复用根 Wrapper、build 和 cache。 -->
selplat_vscode_uses_unified_gradle_build_and_cache = true

<!-- VS Code 不得为 Python-only rule-engine 登记 Java 编译任务或 Java 启动配置。 -->
selplat_vscode_rule_engine_java_configuration = forbidden

<!-- VS Code 不得登记 rule-engine 常驻运行任务；业务含义是编辑器只能按具体测试或能力命令调用 Python。 -->
selplat_vscode_rule_engine_run_entry = forbidden_use_task_specific_python_commands

<!-- VS Code 禁用 Gradle Build Server 并使用原生 Gradle 导入；适用于子项目产物集中到工程根 build 的结构；业务含义是避免 Java Language Server 拒绝位于子项目外部的 class 和 resource 输出 -->
selplat_vscode_gradle_build_server = off
