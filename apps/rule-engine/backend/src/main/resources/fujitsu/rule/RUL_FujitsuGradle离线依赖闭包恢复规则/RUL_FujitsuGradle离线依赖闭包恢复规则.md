# Fujitsu Gradle 离线依赖闭包恢复规则

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none

## 适用范围

<!-- 问题：Fujitsu Gradle 工程使用动态版本、私有构件或不完整 POM 时，标准离线解析可能在本机实际已有 JAR 的情况下提前停止测试。 -->
<!-- 场景：CP、IT、SB、AP 开头的 Fujitsu 工程在禁止联网的 Windows 或其他离线环境中执行编译、测试、Checkstyle 或 JaCoCo。 -->
<!-- 业务含义：先重建可审计的本机依赖闭包，再继续走真实 Gradle 测试入口，禁止把依赖元数据缺口误报成代码或测试不可执行。 -->
rule_scope = fujitsu/gradle/offline_dependency_closure_and_normal_test

<!-- 组织级规则保存共享恢复算法；项目规则只声明特殊坐标、兼容版本、只读参考工程和额外验证项。 -->
fujitsu_offline_recovery_authority = organization_shared_algorithm + project_specific_configuration

<!-- 本主题的公共说明和模板必须保存在主规则同级的同名资产目录；真实项目差异进入对应项目主规则的同名资产目录。 -->
offline_recovery_rule_asset_directories = docs/,template/
offline_recovery_project_specific_rule_location = fujitsu/rule/<project>/RUL_<project>离线依赖配置规则/

## 无网络边界

<!-- Gradle Wrapper、Maven 构件、插件、测试工具和辅助程序都不得在恢复过程中联网下载。 -->
offline_recovery_forbids_network_download = gradle_distribution,maven_artifact,plugin,test_tool,helper_binary

<!-- 首次验证必须显式使用 offline；Wrapper 缺少本地分发包时停止 Wrapper，并回退到本机相同版本 Gradle。 -->
offline_gradle_entry_order = project_wrapper_if_distribution_is_local -> installed_same_version_gradle
every_gradle_invocation_must_include = --offline

<!-- 仅为跨过构建脚本的凭据属性求值，可以向一次性进程传入无权限占位值；禁止写入真实凭据或借此授权网络。 -->
offline_credential_placeholder_scope = configuration_evaluation_only

## 缺口分类与本机构件发现

<!-- 离线解析失败后必须先分类，不能把动态元数据缺失、插件缺失或运行时类缺失统称为依赖不存在。 -->
offline_gap_classification = gradle_distribution,declared_artifact,dynamic_version_metadata,plugin_metadata,transitive_runtime_artifact,tool_runtime_artifact

<!-- 本机构件查找按当前工程缓存、本机 Gradle/Maven 缓存、显式只读参考工程的顺序执行；禁止从 MEMORY_ROOT 反推当前工程或任意扫描无关磁盘。 -->
offline_artifact_search_order = <CURRENT_PROJECT_ROOT>/cache -> local_gradle_or_maven_cache -> explicitly_loaded_project_reference

<!-- sources、javadoc、测试夹具和主运行构件必须区分；非运行构件不得代替正式 classpath。 -->
offline_runtime_artifact_excludes = *-sources.jar,*-javadoc.jar

<!-- 动态版本必须解析为本机真实存在且有兼容证据的明确版本；多版本并存时禁止无记录地选择最高版本。 -->
dynamic_dependency_resolution_requires = concrete_cached_version + compatibility_evidence

## 依赖闭包恢复

<!-- 可复用 Maven 构件与运行时 JAR 必须物化到当前工程 cache，禁止长期保存在 OPTION/temp、源码或 resources。 -->
offline_dependency_cache_root = <CURRENT_PROJECT_ROOT>/cache/gradle-offline
offline_maven_repository_root = <CURRENT_PROJECT_ROOT>/cache/gradle-offline/maven-repository
offline_runtime_jar_root = <CURRENT_PROJECT_ROOT>/cache/gradle-offline/runtime-jars

<!-- 恢复清单、候选证据、临时 init script 和命令日志属于一次性运行数据，统一进入当前工程 OPTION/temp。 -->
offline_recovery_runtime_output_root = <CURRENT_PROJECT_ROOT>/OPTION/temp/gradle-offline

<!-- 依赖恢复通过一次性 Gradle init script 清除远程仓库、挂载本地仓库、锁定明确版本并补充无 POM 运行时 JAR；禁止仅为绕过环境缺口修改正式 build.gradle。 -->
offline_gradle_recovery_mechanism = local_maven_repository + concrete_version_pins + explicit_runtime_jars + temporary_init_script
forbid_persistent_build_change_only_for_offline_recovery = true

<!-- 本地 Maven 目录必须保留 group/artifact/version 结构；只有 JAR 而无可用 POM 时必须显式记录为运行时补充，禁止伪造未知传递依赖。 -->
offline_repository_materialization_requires = coordinate_path + artifact_origin + selected_version
missing_pom_artifact_policy = explicit_runtime_jar_with_manifest

## 正常测试恢复

<!-- 依赖闭包满足后必须回到工程原有 Gradle test 任务，真实进入 JUnit、Spring、业务入口、Mapper、测试数据库和 JaCoCo；目标 javac 或手工 JUnit 启动器不能冒充正常测试。 -->
offline_normal_test_entry = gradle --offline test
normal_test_must_not_be_replaced_by = static_read,targeted_javac,manual_junit_launcher,mock_only_execution

<!-- 测试与构建报告继续写入当前工程 build；能力日志和依赖恢复清单写入 OPTION/temp；Gradle 用户缓存写入 cache。 -->
offline_gradle_user_home = <CURRENT_PROJECT_ROOT>/cache/gradle-user-home
offline_build_and_test_reports = <CURRENT_PROJECT_ROOT>/build

<!-- 完成后必须记录失败基线、构件来源、版本选择、最终命令、测试数量和覆盖率；只有真实任务成功才能声明测试通过。 -->
offline_recovery_evidence = initial_failure,artifact_sources,version_pins,offline_command,test_result,coverage_result

<!-- 本机不存在实际构件或兼容证据不足时必须报告硬阻塞，不得创建空 JAR、伪造 POM、跳过测试或声称成功。 -->
missing_real_artifact_or_compatibility_evidence_must_block = true
