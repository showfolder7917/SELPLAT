# SELPLAT Node 工程结构规则

<!-- 本规则覆盖 SELPLAT 内 Node.js、TypeScript 和 Electron 应用的工程结构。 -->
rule_scope = selplat/node/application_project_structure
<!-- Node 应用工程结构的权威说明统一从 docs 统一规范目录读取。 -->
canonical_document = docs/统一规范/Node工程结构标准.md
<!-- 本规则递归加载应用数据分域和 Node 公共能力边界，禁止在此重复维护两套定义。 -->
requires_rule_ids = SELPLAT_APPLICATION_PROJECT_DATA_LAYOUT_RULES,SELPLAT_NODE_COMMON_CAPABILITY_RULES
<!-- 规则所有者始终通过工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 首版固化 Node 应用源码根、入口、依赖、脚本、测试、打包和清理判断。 -->
rule_version = 1.1.0
<!-- active 表示规则正文、权威文档和叶子索引已形成可加载入口。 -->
rule_status = active

<!-- 应用根只保存正式源码、配置、永久脚本、永久测试、依赖清单、启动器和说明。 -->
node_application_root_contract = source_configuration_permanent_scripts_permanent_tests_dependency_manifests_launchers_and_documentation_only
<!-- 根级文件必须是工具默认入口或用户可发现入口，其他配置按真实职责进入稳定子目录。 -->
node_application_root_file_contract = package_and_lock_manifest + tool_default_configs + user_launchers + README_and_AGENTS + no_unreferenced_root_clutter
<!-- 源码目录必须按运行边界分离，单运行时使用 src，Electron 额外分离 main、preload、renderer 和共享契约。 -->
node_application_source_boundary_contract = single_runtime_src_or_electron_main_preload_renderer_app_private_contracts + root_shared_reserved_for_cross_application_common + no_generated_output_in_source
<!-- 单应用跨进程协议仍是应用私有代码，统一进入应用根 contracts，禁止创建应用内 shared 混淆公共层语义。 -->
node_application_private_contract_root_contract = app_root_contracts_only + main_preload_renderer_pure_protocols + prohibit_app_local_shared_directory + promote_to_root_shared_only_after_cross_application_review
<!-- 应用私有实现留在应用内，跨应用公共 Node 能力只能通过已登记公共包出口消费。 -->
node_application_reuse_contract = private_implementation_in_application + cross_application_capability_via_registered_package_exports + no_cross_directory_internal_source_import
<!-- 每个 Node 工程只能提交一个权威包清单和对应锁文件，禁止提交 node_modules。 -->
node_application_dependency_manifest_contract = one_authoritative_package_manifest + one_matching_lockfile + no_committed_node_modules
<!-- 可再生依赖按锁文件原始内容哈希进入工程 cache，临时链接必须验证目标并在命令结束后回收。 -->
node_application_dependency_cache_contract = cache_application_dependencies_lock_hash + verified_temporary_link + no_recursive_or_stale_link + detach_after_command
<!-- package scripts 必须提供可发现的开发、类型检查、构建、测试和启动入口，并由永久脚本承载复杂编排。 -->
node_application_script_contract = dev + typecheck + build + test + start + complex_or_cross_platform_flow_in_scripts_directory
<!-- 脚本和源码必须使用 Node path 与真实工程解析能力，禁止固定机器绝对路径或依赖斜杠文本判断。 -->
node_application_path_contract = node_path_api + registered_application_name + verified_project_root + no_machine_absolute_path + no_fixed_separator_assertion
<!-- 编译、打包和测试报告统一进入 build，依赖和可再生运行资源进入 cache。 -->
node_application_generated_output_contract = compile_package_and_reports_to_build + dependencies_and_regenerable_runtime_to_cache
<!-- 待执行、运行中和一次性材料进入 OPTION/temp，所有终态记录进入应用归档日志。 -->
node_application_runtime_data_contract = pending_running_and_disposable_to_OPTION_temp + terminal_audit_to_log_archive
<!-- 永久测试按单元、契约、集成和交互职责组织，fixture 只能服务自动测试且不得成为生产数据入口。 -->
node_application_test_contract = unit_contract_integration_and_interaction_by_real_risk + fixture_test_only + no_runtime_report_or_screenshot_in_tests
<!-- Electron 工程必须显式分离主进程、preload、渲染层和共享 IPC 契约，并使用打包白名单验证真实产物。 -->
node_application_electron_contract = main_preload_renderer_and_app_private_contracts_separation + context_isolation + explicit_packaging_allowlist + real_artifact_inspection
<!-- 用户双击启动器可以保留在根目录，但必须从自身位置解析工程并只调用登记的 package 或永久脚本入口。 -->
node_application_launcher_contract = discoverable_root_launcher + self_relative_project_resolution + delegates_to_registered_script + no_business_logic_duplication
<!-- 文件移动或删除前必须核对 package scripts、模块导入、生成后入口、测试夹具、打包清单和平台启动器。 -->
node_application_delete_preflight = package_scripts + source_imports + compiled_entrypoints + test_fixtures + packaging_files + platform_launchers
<!-- 只有生成物、无调用方草稿或已完整迁移且存在替代关系的文件允许清理，终态历史必须先归档。 -->
node_application_cleanup_contract = generated_artifact_or_verified_unreferenced_draft_or_replaced_file_only + archive_terminal_history_before_source_removal
<!-- 应用内禁止嵌套 gitignore，排除规则只能在 SELPLAT 根按精确路径维护。 -->
node_application_gitignore_contract = root_gitignore_only + exact_application_generated_path + no_nested_gitignore + no_broad_source_hiding
<!-- 交付前必须确认源码树零生成物、入口可达、公共依赖不反向引用应用且待测责任已登记。 -->
node_application_completion_contract = zero_source_generated_pollution + all_entries_reachable + no_public_reverse_application_dependency + test_document_recorded
<!-- 本规则不依赖 Java 执行能力。 -->
java_ability_refs = none
<!-- 本规则不新增 Python 执行能力，现有索引加载器承担可达性验证。 -->
python_ability_refs = none
<!-- 本规则不新增 Node 执行能力，应用现有构建和测试入口承担业务验证。 -->
node_ability_refs = none
