# SELPLAT 应用工程数据目录结构规则

<!-- 本规则适用于 SELPLAT 内当前和未来的应用工程，不固定任何单一应用名称。 -->
rule_scope = selplat/application/project_data_layout
<!-- 当前权威说明文档固定从工程 docs 目录读取，规则正文不复制另一套目录定义。 -->
canonical_document = docs/统一规范/工程临时目录规范.md
<!-- 规则所有者始终通过工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 当前版本固化 build、cache 与 OPTION/temp 的独立职责和安全清理门槛。 -->
rule_version = 1.1.0
<!-- 当前规则已经登记到由 AGENTS.md 解析的当前稳定用户 SELPLAT 通用规则索引。 -->
rule_status = active
<!-- 本次升级来自对三类根目录是否可合并、可删除的工程级确认。 -->
upgrade_record = 2026-08-25:固化_build_cache_OPTION_temp_不可合并_职责判定_Gradle映射_离线缓存与任务现场清理门槛

<!-- 工程名必须从当前被操作应用的登记、清单或已验证源码根解析，禁止复制示例名。 -->
application_name_resolution_contract = registered_application_or_verified_source_root_basename + exactly_one_application_scope_per_turn + safe_identifier_validation + no_example_name_copy + no_arbitrary_path_as_name
<!-- 每个应用必须拥有独立缓存、构建、临时和归档根，禁止与其他应用混写。 -->
application_data_root_contract = cache_application_name + build_application_name + OPTION_temp_application_name + log_application_name_archive_log + no_cross_application_collision
<!-- build、cache 与 OPTION/temp 必须使用三个不同的物理根目录。 -->
application_generated_root_separation_contract = distinct_physical_roots
<!-- 禁止把三类目录中的任意两类合并。 -->
application_generated_root_separation_contract.2 = no_merge
<!-- 禁止通过符号链接、Junction 或配置别名绕过物理隔离。 -->
application_generated_root_separation_contract.3 = no_symlink_junction_or_configuration_alias
<!-- 应用源码根只保留正式工程材料，所有生成数据按职责离开源码树。 -->
application_source_root_contract = source_formal_tests_permanent_scripts_configuration_dependency_manifests_and_documentation_only + no_build_runtime_temp_or_archive_data
<!-- build 只保存由源码、锁定依赖和工具链可重建的产物与报告。 -->
application_build_root_contract = reproducible_artifacts_and_reports_only
<!-- cache 只保存可由明确来源重建或重新获取的复用资源。 -->
application_cache_root_contract = reusable_regenerable_or_refetchable_resources_only
<!-- 应用临时根只能直接包含执行日志和临时材料，其他目录必须进入对应分类。 -->
application_temp_root_contract = only_execution_log_and_temporary_materials_direct_children + pending_and_running_under_execution_log + screenshot_test_evidence_download_extract_transform_ipc_and_other_under_temporary_materials + no_scattered_directories
<!-- build 清理前必须确认没有活动进程正在使用目标。 -->
application_build_cleanup_contract = no_active_consumer
<!-- build 清理前必须转移需要保留、交付或归档的产物。 -->
application_build_cleanup_contract.2 = retained_artifacts_transferred
<!-- build 清理前必须确认源码、锁定依赖和工具链可支持重建。 -->
application_build_cleanup_contract.3 = rebuild_inputs_available
<!-- cache 批量清理前必须已知重建命令。 -->
application_cache_cleanup_contract = rebuild_command_known
<!-- cache 批量清理前必须确认需要的资源来源可用。 -->
application_cache_cleanup_contract.2 = resource_source_available
<!-- cache 批量清理前必须确认 SELPLAT 默认离线环境的回退可用。 -->
application_cache_cleanup_contract.3 = offline_fallback_available
<!-- OPTION/temp 清理前必须确认没有待执行或运行中任务。 -->
application_temp_cleanup_contract = no_pending_or_running_task
<!-- OPTION/temp 清理前必须确认没有仍然有效的执行锁。 -->
application_temp_cleanup_contract.2 = no_valid_execution_lock
<!-- OPTION/temp 清理前必须确认需要保留的终态记录已归档并通过完整性检查。 -->
application_temp_cleanup_contract.3 = required_archive_complete_and_verified
<!-- 待执行项目开始时原子迁入运行中，任何终态都先归档并校验，再清理临时原件。 -->
application_execution_lifecycle_contract = pending_to_running_atomic_move + success_failure_cancel_rejected_terminal_and_partial_all_archive + archive_integrity_before_temp_cleanup + archive_failure_preserves_running_material + stale_lock_recovery
<!-- 长期归档按类型、年月和业务标识分层，支持从任务、测试或审批反查。 -->
application_archive_contract = execution_test_collaboration_approval_and_diagnostic_categories + year_month_partition + task_run_or_approval_identifier_partition + structured_summary_event_and_artifact_manifest + long_term_query_and_audit
<!-- 可再生依赖必须按锁文件哈希隔离；临时链接不得提交并在执行完成后移除。 -->
application_dependency_cache_contract = cache_application_dependencies_lock_hash + exact_lockfile_match + no_unverified_cross_application_node_modules_reuse + temporary_link_not_committed + remove_link_after_execution
<!-- 所有动态路径片段都必须经过安全标识校验和最终根内检查。 -->
application_data_path_security_contract = alphanumeric_dash_underscore_identifier_only + prohibit_separator_parent_traversal_and_absolute_path + final_path_must_remain_inside_application_data_root
