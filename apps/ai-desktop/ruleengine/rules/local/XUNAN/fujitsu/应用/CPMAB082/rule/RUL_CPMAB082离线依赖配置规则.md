# CPMAB082 离线依赖配置规则

<!-- 本规则所有者始终从 AGENTS.md 当前稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示当前用户执行 CPMAB082 离线恢复时加载本规则。 -->
rule_status = active

<!-- 本规则不提供 Java 能力。 -->
java_ability_refs = none
<!-- CPMAB082 离线配置复用当前用户 Fujitsu 恢复能力。 -->
python_ability_refs = apps/ai-desktop/ruleengine/python/local/<active-stable-user-id>/abilities/fujitsu_gradle_offline_test_restorer.py
<!-- 本规则不提供 Node 能力。 -->
node_ability_refs = none

## 适用范围

<!-- 问题：CPMAB082 除当前用户 Fujitsu 通用离线恢复算法外，还需要明确相邻构件来源和持久层替代验证边界。 -->
<!-- 场景：CPMAB082 的 Gradle、Java、Checkstyle、MyBatis 或测试依赖在本机离线解析时出现缺口。 -->
<!-- 业务含义：项目规则只保存 CPMAB082 特例，恢复流程统一引用当前用户 Fujitsu 通用规则包主规则，避免两套算法漂移。 -->
rule_scope = CPMAB082/offline_dependency_configuration

<!-- 执行 CPMAB082 离线恢复前必须加载当前用户 Fujitsu 通用规则包主规则。 -->
cpmab082_offline_recovery_shared_rule = local/<active-stable-user-id>/fujitsu/通用/rule/RUL_FujitsuGradle离线依赖闭包恢复规则.md

<!-- CPMACOMMON 和 CPMAB081 的已构建产物只允许作为显式只读候选 classpath，禁止修改相邻工程。 -->
cpmab082_allowed_readonly_reference_classpath = ../CPMACOMMON/build
<!-- cpmab082_allowed_readonly_reference_classpath.2 的当前独立事实为 ../CPMAB081/build。 -->
cpmab082_allowed_readonly_reference_classpath.2 = ../CPMAB081/build

<!-- 多个参考版本并存时必须选择与 CPMAB082 参考编译基线兼容的版本，并在恢复清单中记录来源。 -->
cpmab082_reference_version_selection_requires = compatible_version + evidence

<!-- 标准 compileJava 仍被缺失构件阻塞时，对本次 Java 改动执行 UTF-8 目标编译，但不得把它声明为完整测试通过。 -->
cpmab082_targeted_compile_fallback = javac -encoding UTF-8 -d build/tmp/offline_target_compile

<!-- Checkstyle 仅缺少离线元数据时，使用本机相同版本 CLI 与项目配置继续检查。 -->
cpmab082_checkstyle_fallback = cached_same_version_checkstyle_cli_with_project_config

<!-- MyBatis 改动的替代验证必须使用真实本机 JAR 完成 XML 解析、statement 注册、BoundSql 和参数绑定检查。 -->
cpmab082_mybatis_fallback = xml_parse + statement_registration + bound_sql + parameter_binding
