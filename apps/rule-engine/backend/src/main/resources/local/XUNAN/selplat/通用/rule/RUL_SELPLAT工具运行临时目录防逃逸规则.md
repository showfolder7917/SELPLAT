# SELPLAT 工具运行临时目录防逃逸规则

<!-- 本规则约束当前用户在 SELPLAT 中运行 PDF、OCR、导入器和其他生成工具时的短期数据归属。 -->
rule_scope = active_user_selplat_tool_runtime_temp_ownership
<!-- 当前版本建立工程规则覆盖通用技能默认目录的程序化防线。 -->
rule_version = 1.0.0
<!-- 规则所有者始终由 AGENTS.md 当前稳定用户动态解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示路径规则、生产守卫和回归测试已经形成闭环。 -->
rule_status = active
<!-- 本规则来自 PDF 导入误用工程根 tmp 后的防复发修正。 -->
upgrade_record = 2026-08-09:禁止通用技能默认tmp覆盖SELPLAT_OPTION_temp并增加程序路径守卫_默认任务目录_迁移与污染扫描

## 唯一运行数据根

<!-- Java、Python、Node、技能和脚本产生的中间文件、日志、报告与验证数据只有一个稳定出口。 -->
selplat_active_user_tool_runtime_root = <SELPLAT_ROOT>/OPTION/temp
<!-- 每项任务必须使用应用和任务子目录，禁止直接把大量文件写入 OPTION/temp 根。 -->
selplat_active_user_tool_runtime_task_pattern = <SELPLAT_ROOT>/OPTION/temp/<application>/<task>/
<!-- PDF 或其他通用技能声明的 tmp、output 等默认目录不能覆盖当前工程规则。 -->
selplat_project_rule_overrides_generic_skill_temp_default = true

## 程序化门禁

<!-- 工具必须从工程根推导 OPTION/temp，禁止使用机器固定绝对路径或当前工作目录猜测工程。 -->
selplat_temp_root_resolution = locate_settings_gradle_then_resolve_OPTION_temp
<!-- 所有运行数据输入输出参数必须在读写前解析规范路径并验证属于 OPTION/temp 子目录。 -->
selplat_temp_path_preflight = resolve_before_io,descendant_of_OPTION_temp,root_itself_forbidden
<!-- 相对路径、绝对路径和符号链接解析后发生目录逃逸时必须立即失败。 -->
selplat_temp_path_escape_policy = reject_relative_escape,reject_absolute_escape,reject_symlink_escape
<!-- 工具必须提供位于应用任务目录的安全默认值，不能要求调用者每次手工拼接临时根。 -->
selplat_temp_safe_default_policy = required_for_runtime_tools

## 迁移与完成门槛

<!-- 发现工程根 tmp 或其他误放运行目录时，先核对目标不存在，再整体迁移到 OPTION/temp 对应任务目录。 -->
selplat_legacy_temp_migration = verify_source,verify_target_absent,move_to_owned_task_root,remove_empty_legacy_root
<!-- 任务交付前必须扫描工程根新增的 tmp、runtime、普通日志和临时副本，存在污染则不得完成。 -->
selplat_root_pollution_delivery_gate = scan_tmp_runtime_logs_and_temporary_copies,block_on_violation
<!-- 回归测试必须覆盖安全子目录、工程根 tmp 逃逸、OPTION/temp 根滥用和命令行错误路径。 -->
selplat_temp_path_guard_test_gate = accept_owned_descendant,reject_project_tmp,reject_broad_OPTION_temp,reject_cli_escape
