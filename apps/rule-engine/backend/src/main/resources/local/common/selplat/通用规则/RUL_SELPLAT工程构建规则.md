# SELPLAT 当前构建规则

<!-- 根 Gradle 是全工程唯一编译入口；适用于应用、共享模块和规则工具；业务含义是各模块不得建立独立构建体系 -->
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
selplat_cache_lifecycle = deletable,rebuildable,non_authoritative

<!-- 可选缓存资源不存在时必须返回具体缺失路径并采用已定义的离线回退；适用于字体等不影响核心数据正确性的资源；业务含义是缺失信息可见但不阻断主流程。 -->
selplat_optional_cache_missing_policy = report_missing_resource_path,use_declared_offline_fallback,continue

<!-- Windows 下缓存缺失不得触发联网下载、自动创建假资源或把缺失升级为测试失败；业务含义是离线测试可重复且不会偷偷改变缓存状态。 -->
selplat_windows_optional_cache_missing_forbidden_actions = network_download,synthetic_resource_creation,test_failure_for_absence_alone

<!-- 第三方依赖使用标准 Maven 坐标声明，公共版本统一来自根 gradle.properties；适用于应用和共享模块；业务含义是 VS Code 与命令行读取同一依赖模型 -->
selplat_dependency_declaration = explicit_maven_coordinate_with_root_version_property

<!-- 离线坐标对应的 jar 不存在时必须先补入工程 cache；适用于编译、测试和 IDE 导入；业务含义是禁止联网下载或用错误版本伪装成功 -->
selplat_missing_offline_dependency_policy = stop_and_place_exact_jar_in_cache/cache-jars

<!-- 本机执行默认使用离线模式；适用于编译、测试和运行验证；业务含义是不得为完成任务下载依赖或工具 -->
selplat_gradle_default_mode = offline

<!-- Java 版本由根 Gradle 统一控制；适用于 Gradle 与 VS Code；业务含义是模块不得各自漂移编译版本 -->
selplat_java_version_is_root_managed = true

<!-- rule-engine 使用标准 Java、Python、Node 与 resources 主目录；适用于多语言规则能力和资源打包；业务含义是每种语言保留原生入口并共享同一分层模型。 -->
selplat_rule_engine_uses_standard_main_source_set = true

<!-- core、common 和用户目录必须位于各语言标准源根与 resources 内部；适用于规则引擎分层迁移；业务含义是不同语言使用相同层名且不互相混放。 -->
selplat_rule_engine_layering_inside_standard_source_set = src/main/java/com/sp/selplat/local/code/<layer>,src/main/python/com/sp/selplat/local/code/<layer>,src/main/node/com/sp/selplat/local/code/<layer>,src/main/resources/local/<layer>
selplat_rule_engine_layering_must_not_add_custom_source_set = true

<!-- VS Code 编译与运行必须复用根 Wrapper、build 和 cache；适用于 tasks、launch 和 Java Language Server；业务含义是 IDE 与命令行结果一致 -->
selplat_vscode_uses_unified_gradle_build_and_cache = true

<!-- VS Code 禁用 Gradle Build Server 并使用原生 Gradle 导入；适用于子项目产物集中到工程根 build 的结构；业务含义是避免 Java Language Server 拒绝位于子项目外部的 class 和 resource 输出 -->
selplat_vscode_gradle_build_server = off
