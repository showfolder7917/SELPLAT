# CPMAB082 Offline Dependency Rules

## 说明

- 本规则只适用于 CPMAB082 在本机离线环境中的依赖解析、编译和替代验证。
- 本文件中的工程内相对路径以 CPMAB082 工程根目录为基准，不因本规则存储在统一 MEMORIES 中而改按 SELPLAT 工程解释。

## 适用范围

<!-- 本模块仅约束 CPMAB082 的 Gradle、Java、Checkstyle 或测试依赖缺失处理；业务含义是禁止为了完成任务临时联网或伪报验证成功 -->
rule_scope = CPMAB082/offline_dependency_resolution_and_verification

<!-- 规则内相对路径以 CPMAB082 工程根目录为基准；业务含义是查找当前工程与相邻参考工程产物时不会落入 SELPLAT -->
relative_path_base = CPMAB082_project_root

## 基本原则

<!-- 所有编译、依赖解析和验证必须使用本机已有资源；业务含义是遵守离线执行边界并保证过程可复现 -->
dependency_resolution_must_use_local_resources_only = true

<!-- 禁止下载 Gradle 分发包、Maven 依赖、插件或辅助工具；业务含义是不能用越权联网掩盖本机资源缺口 -->
forbid_network_download_for_missing_build_dependency = true

<!-- 禁止仅为绕过离线缺口而修改构建配置或依赖版本；业务含义是环境问题不得转化为未经要求的工程配置变更 -->
forbid_build_configuration_or_dependency_version_change_only_to_bypass_offline_gap = true

## Gradle 入口回退顺序

<!-- 首次构建优先使用工程 Wrapper 并显式启用 offline；业务含义是优先遵循工程声明的 Gradle 版本和任务入口 -->
first_gradle_entry = project_wrapper_with_offline

<!-- Wrapper 尝试联网下载时必须停止该入口并回退；业务含义是不得等待或重试网络下载 -->
wrapper_network_download_attempt_must_stop_and_fallback = true

<!-- Wrapper 缺少本地分发包时查找本机相同版本 Gradle，调用时仍须 offline；业务含义是保持版本一致且不修改 Wrapper -->
wrapper_distribution_missing_fallback = installed_same_version_gradle
installed_gradle_must_run_offline = true

<!-- 配置阶段仅因凭据属性缺失时可向一次性进程注入无权限占位值；业务含义是只跨过配置求值，不写凭据也不授权网络访问 -->
offline_credential_placeholder_allowed_only_for_configuration_evaluation = true

<!-- 临时变量未进入复用 Daemon 时使用 no-daemon 或一次性 Daemon；业务含义是避免为进程环境差异修改持久配置 -->
gradle_daemon_environment_mismatch_fallback = no_daemon_offline_process

## 本机依赖定位顺序

<!-- 离线解析失败后必须区分缺口类型；业务含义是不能把动态元数据缺失误判为实际类库不存在 -->
must_classify_offline_dependency_gap = gradle_distribution,artifact_jar,dynamic_version_metadata,plugin_metadata,tool_runtime_dependency

<!-- 动态版本元数据缺失时检查缓存中的明确版本 JAR；业务含义是优先复用已存在的可执行产物 -->
dynamic_version_metadata_missing_must_check_cached_concrete_versions = true

<!-- CPMACOMMON 和 CPMAB081 的构建产物只允许作为只读 classpath；业务含义是复用参考基线而不修改相邻工程 -->
allowed_readonly_reference_classpath = ../CPMACOMMON/build,../CPMAB081/build

<!-- 本机运行 classpath 排除 sources 和 javadoc；业务含义是防止把非运行产物当作依赖 -->
runtime_classpath_must_exclude_sources_and_javadoc_jars = true

<!-- 多个缓存版本并存时选择与参考编译基线兼容的版本并记录证据；业务含义是避免静默混用不兼容版本 -->
multiple_cached_versions_require_compatible_version_selection_and_evidence = true

## 目标编译与替代验证

<!-- Gradle compileJava 因离线依赖阻塞时必须对本次改动 Java 执行目标 javac；业务含义是至少证明本次类型和语法契约成立 -->
gradle_compile_blocked_requires_targeted_javac_for_changed_java_files = true

<!-- 目标 javac 显式使用 UTF-8 并写入独立临时目录；业务含义是保护源码编码且不污染正式 classes -->
targeted_javac_encoding = UTF-8
targeted_javac_output = build/tmp/offline_target_compile

<!-- Checkstyle 仅因离线元数据缺失时调用缓存中的同版本 CLI 和项目配置；业务含义是继续执行原规范而不是跳过检查 -->
gradle_checkstyle_metadata_block_fallback = cached_same_version_checkstyle_cli_with_project_config

<!-- MyBatis 改动必须用本机真实 JAR 解析 XML 并确认 statement 注册；业务含义是验证 Mapper 契约可实际加载 -->
mybatis_offline_fallback_requires_real_xml_parser_and_statement_registration = true

<!-- 动态 SQL 必须生成 BoundSql 并核对参数数量和关键字段；业务含义是 XML 合法不能替代运行时绑定验证 -->
dynamic_sql_offline_verification_requires_bound_sql = true

<!-- 标准全量构建阻塞时的最小替代验证必须覆盖以下路径；业务含义是形成可回放的持久层验证闭环 -->
minimum_offline_fallback_verification = targeted_java_compile,project_checkstyle,xml_structure_parse,mybatis_statement_registration,bound_sql_parameter_binding

## 失败记录与交付边界

<!-- 每次依赖回退必须记录失败命令、核心错误、本机替代资源和验证结果；业务含义是让后续人员能够复现判断 -->
offline_dependency_fallback_evidence = failed_command,core_error,local_fallback_resources,verification_result

<!-- 仅完成目标替代验证时禁止宣称全量构建或测试通过；业务含义是明确区分代码级验证与完整工程回归 -->
forbid_claiming_full_build_or_test_passed_when_only_targeted_fallback_passed = true

<!-- 交付时必须说明未验证的数据库、Spring 上下文、完整测试套件及其他风险；业务含义是避免替代验证被误解为生产运行证明 -->
offline_fallback_delivery_must_state_residual_risks = true

<!-- 本机既无实际依赖也无兼容参考产物时必须报告硬阻塞；业务含义是禁止用静态阅读伪装可执行验证成功 -->
missing_artifact_and_compatible_reference_must_report_hard_blocker = true
