# Fujitsu Python 规则工具约束

<!-- 能被人工或 AI 直接调用的 Fujitsu 完整程序统一进入当前用户 abilities。 -->
fujitsu_python_ability_root = apps/ai-desktop/ruleengine/python/local/<active-stable-user-id>/abilities

<!-- Fujitsu Excel 工具统一由一个 Python 能力按子命令承载。 -->
fujitsu_excel_ability = fujitsu_excel_tools.py

<!-- Fujitsu 工具只通过 argparse 子命令公开人工和 AI 可复用入口。 -->
fujitsu_python_public_entry = argparse_subcommand

<!-- 规则、文档、配置、模板和样例统一进入对应规则包。 -->
fujitsu_rule_tool_resource_root = apps/ai-desktop/ruleengine/rules/local/<active-stable-user-id>/fujitsu

<!-- Python 依赖统一登记在 rule-engine 的依赖清单。 -->
fujitsu_python_dependency_manifest = apps/ai-desktop/ruleengine/requirements-python.txt

<!-- 工具运行产生的数据统一进入当前工程 OPTION/temp 或用户明确指定的输出目录。 -->
fujitsu_rule_tool_generated_output_policy = current_project_OPTION_temp_or_explicit_output

<!-- 工具修改后必须补充中文业务注释并登记统一测试。 -->
fujitsu_python_tool_change_gate = chinese_business_comments_and_registered_unified_test
