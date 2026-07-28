# CPMAB082 离线依赖配置规则

## 适用范围

<!-- 问题：CPMAB082 除 Fujitsu 通用离线恢复算法外，还需要明确相邻构件来源和持久层替代验证边界。 -->
<!-- 场景：CPMAB082 的 Gradle、Java、Checkstyle、MyBatis 或测试依赖在本机离线解析时出现缺口。 -->
<!-- 业务含义：项目规则只保存 CPMAB082 特例，公共恢复流程统一引用组织级规则包主规则，避免两套算法漂移。 -->
rule_scope = CPMAB082/offline_dependency_configuration

<!-- 执行 CPMAB082 离线恢复前必须加载 Fujitsu 组织级公共规则包主规则。 -->
cpmab082_offline_recovery_shared_rule = ../RUL_FujitsuGradle离线依赖闭包恢复规则.md

<!-- CPMACOMMON 和 CPMAB081 的已构建产物只允许作为显式只读候选 classpath，禁止修改相邻工程。 -->
cpmab082_allowed_readonly_reference_classpath = ../CPMACOMMON/build,../CPMAB081/build

<!-- 多个参考版本并存时必须选择与 CPMAB082 参考编译基线兼容的版本，并在恢复清单中记录来源。 -->
cpmab082_reference_version_selection_requires = compatible_version + evidence

<!-- 标准 compileJava 仍被缺失构件阻塞时，对本次 Java 改动执行 UTF-8 目标编译，但不得把它声明为完整测试通过。 -->
cpmab082_targeted_compile_fallback = javac -encoding UTF-8 -d build/tmp/offline_target_compile

<!-- Checkstyle 仅缺少离线元数据时，使用本机相同版本 CLI 与项目配置继续检查。 -->
cpmab082_checkstyle_fallback = cached_same_version_checkstyle_cli_with_project_config

<!-- MyBatis 改动的替代验证必须使用真实本机 JAR 完成 XML 解析、statement 注册、BoundSql 和参数绑定检查。 -->
cpmab082_mybatis_fallback = xml_parse + statement_registration + bound_sql + parameter_binding
