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

<!-- 本机执行默认使用离线模式；适用于编译、测试和运行验证；业务含义是不得为完成任务下载依赖或工具 -->
selplat_gradle_default_mode = offline

<!-- Java 版本由根 Gradle 统一控制；适用于 Gradle 与 VS Code；业务含义是模块不得各自漂移编译版本 -->
selplat_java_version_is_root_managed = true

<!-- rule-engine 使用标准 src/main/java 与 src/main/resources；适用于规则能力编译和资源打包；业务含义是无需自定义 sourceSet 即可共享后端生命周期 -->
selplat_rule_engine_uses_standard_main_source_set = true

<!-- VS Code 编译与运行必须复用根 Wrapper、build 和 cache；适用于 tasks、launch 和 Java Language Server；业务含义是 IDE 与命令行结果一致 -->
selplat_vscode_uses_unified_gradle_build_and_cache = true

<!-- VS Code 禁用 Gradle Build Server 并使用原生 Gradle 导入；适用于子项目产物集中到工程根 build 的结构；业务含义是避免 Java Language Server 拒绝位于子项目外部的 class 和 resource 输出 -->
selplat_vscode_gradle_build_server = off
