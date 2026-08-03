# ACode Java 规则工具约束

<!-- Fujitsu Java 规则工具统一进入标准 Java 包；适用于新增和迁移的规则执行能力；业务含义是 Gradle 与 VS Code 可自动识别源码 -->
java_rule_tool_source_root = apps/rule-engine/backend/src/main/java/com/sp/selplat/local/code/common/fujitsu

<!-- Fujitsu Java 包统一使用 com.sp.selplat.local.code.common.fujitsu，并按 db、sql 等能力继续分包；业务含义是 AI 执行代码与业务大模块边界清晰 -->
fujitsu_java_rule_tool_package_root = com.sp.selplat.local.code.common.fujitsu

<!-- 规则、工具脚本、文档、配置、模板和样例统一进入标准 resources 下的对应大类；适用于所有非 Java 资源；业务含义是独立单元内不再建立私有工程树 -->
java_rule_tool_resource_root = apps/rule-engine/backend/src/main/resources

<!-- 规则工具禁止自带 lib；适用于编译和运行依赖；业务含义是所有离线 jar 只有一个可治理来源 -->
java_rule_tool_dependency_root = cache/cache-jars

<!-- 规则工具禁止自带 build；适用于 class 和 Gradle 构建报告；业务含义是所有编译产物统一进入工程根 build -->
java_rule_tool_build_root = build/apps/rule-engine/backend

<!-- 编译统一通过根 Gradle Wrapper；适用于命令行、脚本和 VS Code；业务含义是禁止再次维护独立 javac 类路径 -->
java_rule_tool_compile_entry = gradlew --offline :apps:rule-engine:backend:classes

<!-- 工具运行产生的全部数据统一进入当前工程 OPTION/temp；适用于工作簿中间文件、验证副本、报告和日志；业务含义是生成物可统一清理且不污染源码与规则资源 -->
java_rule_tool_generated_output_root = <CURRENT_PROJECT_ROOT>/OPTION/temp

<!-- Java 工具修改后必须完成业务语义逐行注释和相应验证；适用于新增、修改与重构；业务含义是工具可维护且迁移后行为可证明 -->
java_rule_tool_change_requires_business_comments_and_verification = true
