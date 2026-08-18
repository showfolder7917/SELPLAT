# Command Protocol

## 说明

- 这是命令执行层的协议文件
- 本文件承接命令执行、路径处理、结果返回的高频约束

## 强制协议（Mandatory）

<!-- COMMAND 协议装载完成后，必须继续通过 ai_memory_file_reader 装载唯一正式根 RULE_INDEX.md；该装载属于协议链后的规则入口装载，不构成执行，不需要用户确认 -->
after_command_must_load_rule_index_via_ability = ai_memory_file_reader
after_command_rule_index = ${RES}RULE_INDEX.md
rule_index_loading_is_not_execution = true
rule_index_is_mandatory_rule_entry = true
rule_index_loaded_before_first_rule_file = true

<!-- 新增或变更任何规则文件后，必须同步唯一规则索引文件 RULE_INDEX.md -->
sync_unique_rule_index_md_after_rule_file_change = true

<!-- 后续核心启动能力统一通过 STARTER 声明的 Python 入口调度 -->
post_starter_ability_executor = ${EXE}

<!-- 所有 SELPLAT Python 入口必须在导入工程模块前把字节码缓存固定到工程 cache，禁止在 main/test 源码目录生成 __pycache__。 -->
python_process_pycache_prefix = <CURRENT_PROJECT_ROOT>/cache/python-pycache
python_source_tree_pycache_policy = forbidden

<!-- rule-engine Python 测试统一通过自带入口运行，入口负责当前进程和子进程的缓存归属。 -->
rule_engine_python_test_entry = apps/rule-engine/backend/src/test/python/run_tests.py
rule_engine_python_test_command = python3 apps/rule-engine/backend/src/test/python/run_tests.py all
<!-- 成功测试默认只回传摘要，失败时保留完整定位输出。 -->
rule_engine_python_test_summary_flag = --summary
<!-- 同线程重复规则加载使用资源版本控制的精简快照。 -->
same_thread_rule_snapshot_ability = rule_snapshot_manager
<!-- 多个无交互能力动作允许通过唯一执行器的 --batch 单进程执行。 -->
ability_executor_batch_mode = --batch

<!-- 执行文档能力通过 ruleengine 唯一执行器开放，文件名使用中文，路径由公共配置解析。 -->
execution_doc_manager_entry = src/main/python/com/sp/selplat/ruleengine/执行器.py execution_doc_manager
execution_doc_manager_migration_status = ruleengine_chinese_named_entry
run_execution_doc_check_before_formal_task = true
<!-- 独立 1 后由 begin 写入授权；步骤既可单项 step，也可用 complete_steps 一次回写。 -->
execution_doc_manager_command_actions = check,begin,step,complete_steps,active,ready,finish
execution_doc_manager_build_integration = quick_special_require_active,task_finish_requires_ready_and_recorded_test_plan
<!-- 测试文档能力使用相同执行器和线程来源；结果既可单项 result，也可用 complete_tests 一次回写。 -->
test_doc_manager_entry = src/main/python/com/sp/selplat/ruleengine/执行器.py test_doc_manager
test_doc_manager_command_actions = check,record,result,complete_tests,pending,ready,finish
test_doc_manager_build_integration = task_finish_requires_pending_test_item,root_check_is_manual_unified_test_entry
<!-- 两份文档均 ready 后由 finish_all 一次完成联合归档。 -->
task_lifecycle_manager_entry = src/main/python/com/sp/selplat/ruleengine/执行器.py task_lifecycle_manager
task_lifecycle_manager_command_actions = finish_all
restricted_runtime_must_use_verified_python_override_without_repeating_failed_default = true

<!-- 读完本启动协议后，后续 AI 记忆命名空间内正式 .md 文件统一通过该能力读取 -->
post_starter_markdown_access_ability = ai_memory_file_reader

<!-- 读完本启动协议后，AI 记忆命名空间内正式 .md 文件一律不得再以普通文件读取方式进入 -->
forbid_any_direct_markdown_read_after_starter = true

<!-- 改代码优先小改，不随意大改结构 -->
prefer_small_changes_over_large_refactors

<!-- 工具失败时必须向用户说明核心失败原因，不得只报告失败结论 -->
report_core_tool_failure_reason

<!-- 执行后必须返回关键结果 -->
return_key_results_after_command_execution

<!-- 命令失败时返回核心报错 -->
report_core_errors_when_command_fails

<!-- 简单命令直接返回结果 -->
return_direct_result_for_simple_commands

<!-- 复杂命令返回结论和关键输出 -->
return_conclusion_and_key_output_for_complex_commands

<!-- 最终答复不得直接输出工具调用 JSON 或原始工具参数结构 -->
forbid_raw_tool_json_as_final_answer


## 路径规则（Path Rules）

<!-- SELFSP 内部命令优先进入 SELFSP -->
prefer_selfsp_as_workdir_for_selfsp_internal_commands

<!-- 非机器绝对定位场景优先使用相对路径 -->
prefer_relative_paths_unless_absolute_machine_location_is_required

## 禁止事项（Forbidden）

<!-- 禁止只给计划不执行命令 -->
forbid_returning_plan_without_execution_when_execution_is_expected
