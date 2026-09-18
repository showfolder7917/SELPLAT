cpmab082_offline_recovery_shared_rule = local/<active-stable-user-id>/fujitsu/通用/rule/RUL_FujitsuGradle离线依赖闭包恢复规则.md
cpmab082_allowed_readonly_reference_classpath = ../CPMACOMMON/build
cpmab082_allowed_readonly_reference_classpath.2 = ../CPMAB081/build
cpmab082_reference_version_selection_requires = compatible_version + evidence
cpmab082_targeted_compile_fallback = javac -encoding UTF-8 -d build/tmp/offline_target_compile
cpmab082_checkstyle_fallback = cached_same_version_checkstyle_cli_with_project_config
cpmab082_mybatis_fallback = xml_parse + statement_registration + bound_sql + parameter_binding
