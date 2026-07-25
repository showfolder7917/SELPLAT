# SELPLAT 工程路径规则

<!-- 当前工程根由用户明确路径或最近项目标记识别；适用于源码命令和执行内务；业务含义是不得根据 MEMORIES 位置反推工程 -->
current_project_root_must_be_resolved_independently = true

<!-- 执行文档仍属于项目内务并固定在 OPTION；适用于任务状态、历史与执行池；业务含义是正式执行记录不与 OPTION/temp 的一次性运行数据混放 -->
selplat_execution_internal_root = OPTION

<!-- Gradle 编译产物和构建报告进入工程根 build；适用于 class、处理后资源、测试框架报告和构建元数据；业务含义是编译生命周期保持集中 -->
selplat_build_artifact_root = build

<!-- Java、Python、能力、脚本和其他执行工具生成的全部运行数据进入 OPTION/temp；适用于业务输出、中间文件、日志、验证结果和临时副本；业务含义是运行副作用只有一个统一出口 -->
selplat_tool_runtime_generated_data_root = OPTION/temp

<!-- Gradle 用户缓存、项目缓存和离线 jar 进入工程根 cache；适用于所有离线构建与依赖解析；业务含义是缓存可复用且不属于正式产物 -->
selplat_cache_root = cache

<!-- Python 字节码缓存进入 cache；适用于能力和测试执行；业务含义是源码目录不得产生 __pycache__ -->
selplat_python_pycache_prefix = cache/python-pycache

<!-- 规则引擎模块统一承载 Java 规则能力；适用于规则和相关工具迁移；业务含义是它们可以随模块共同编译 -->
selplat_rule_java_root = apps/rule-engine/backend/src/main/java/com/sp/selplat/ruleengine

<!-- 规则、文档和模板统一由标准 resources 承载；适用于通用、组织及项目规则；业务含义是资源由 Gradle 自动识别且不需要额外 sourceSet -->
selplat_rule_resource_root = apps/rule-engine/backend/src/main/resources

<!-- SELPLAT 专属规则位于规则包的 SELPLAT 子目录；适用于平台自身规则沉淀；业务含义是保持工程级规则隔离 -->
selplat_project_rule_root = apps/rule-engine/backend/src/main/resources/rule/SELPLAT
