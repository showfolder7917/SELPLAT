# 工具运行生成数据规则

<!-- Java、Python、能力脚本及其他执行工具运行时生成的数据统一进入当前工程 OPTION/temp；适用于业务数据、中间文件、报告、日志、验证输出和临时副本；业务含义是所有运行副作用拥有单一可清理归属 -->
tool_runtime_generated_data_root = <CURRENT_PROJECT_ROOT>/OPTION/temp

<!-- 工具必须根据用户指定工程或最近项目标记解析当前工程根；适用于能力系统位于其他工程或工具处理外部项目的场景；业务含义是禁止根据工具源码位置反推输出归属 -->
tool_runtime_output_must_resolve_current_project_root = true

<!-- 不同工程禁止共享 OPTION/temp；适用于跨工程调用 Java、Python 和统一能力；业务含义是运行生成数据不得污染能力宿主工程或其他业务工程 -->
tool_runtime_output_must_not_cross_project_option = true

<!-- 工具运行数据禁止写入源码、resources、工程根散落目录或系统临时目录；适用于所有正常、异常和验证分支；业务含义是执行结束后可以通过单一目录治理残留 -->
tool_runtime_output_must_not_write_source_resource_root_or_system_temp = true

<!-- Gradle 编译产物和构建报告继续进入 build；适用于 class、处理后资源、测试框架报告和构建元数据；业务含义是编译生命周期不与工具业务输出混淆 -->
gradle_build_artifacts_are_exempt_and_stay_in = <CURRENT_PROJECT_ROOT>/build

<!-- 可复用依赖和缓存继续进入 cache；适用于离线 jar、Gradle 缓存和 Python 字节码缓存；业务含义是缓存不被误判为一次性工具业务数据 -->
reusable_dependency_and_runtime_cache_are_exempt_and_stay_in = <CURRENT_PROJECT_ROOT>/cache

<!-- 大体积且可复用的运行资源（如字体、模型和离线模板）必须存入当前工程 cache，不得提交到 Git；适用于需要稳定跨平台输出的工具；业务含义是仓库保持轻量而本机缓存可复用 -->
large_reusable_runtime_assets_must_live_in = <CURRENT_PROJECT_ROOT>/cache

<!-- 可复用运行资源缺失时，工具只能从其声明的官方来源下载并写入当前工程 cache；适用于首次运行或缓存被清理后的恢复；业务含义是下载行为可追溯且不会污染源码和 resources -->
missing_large_runtime_asset_must_download_from_declared_official_source_to_cache = true
