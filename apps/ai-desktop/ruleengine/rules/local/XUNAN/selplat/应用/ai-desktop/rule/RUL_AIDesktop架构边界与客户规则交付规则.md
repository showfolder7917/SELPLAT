# AI Desktop 架构边界与客户规则交付规则

<!-- 本规则只约束 AI Desktop 应用的协议分层、运行边界、模块化、业务注释和客户规则交付。 -->
rule_scope = selplat/application/ai-desktop/architecture_boundary_and_rule_delivery
<!-- 规则所有者始终从工程根当前稳定用户声明解析，禁止固定用户分支。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 2.0.0 固化 Electron 薄入口、分层 Bootstrap 和统一资源释放边界，防止数据库与应用初始化回流 main.ts。 -->
rule_version = 2.0.0
<!-- active 表示规则正文、叶子索引和生产规则白名单已经形成可达入口。 -->
rule_status = active
<!-- 本轮架构重构由应用 TypeScript、Node 构建脚本和静态门禁实现，不建立 Java 能力。 -->
java_ability_refs = none
<!-- 生产规则 bundle 由应用 Node 脚本生成，Python 继续承担工程期规则治理但不作为客户运行时依赖。 -->
python_ability_refs = none
<!-- 应用生产程序直接实现规则加载，不在 rule-engine 内伪造第二个 Node ability。 -->
node_ability_refs = none
<!-- 真实生产规则加载入口固定为主进程规则服务。 -->
application_program_path = apps/ai-desktop/electron/services/capabilities/rules/rule-bundle.facade.ts

<!-- 应用私有跨进程协议必须按基础、桌面聚合、平台、能力、协作和治理领域分层，禁止恢复根目录平铺或独立 codex 根。 -->
contracts_domain_layout_contract = foundation + desktop_aggregate + platform + capabilities + collaboration + governance + no_flat_business_contracts + no_root_codex_domain
<!-- contracts 只能定义纯数据和白名单接口，不得依赖 Electron、React、文件系统、SQLite 或具体业务服务。 -->
contracts_purity_contract = pure_types_and_capability_whitelist_only + no_electron_react_node_filesystem_database_or_service_implementation
<!-- 每个协议文件必须说明职责、生产者、消费者、数据方向和禁止职责。 -->
contracts_file_comment_contract = responsibility + producer + consumer + data_direction + forbidden_responsibility
<!-- 公开类型、方法和关键字段必须使用真实业务语义注释，方法依次说明作用、传参、返回和异常或副作用。 -->
contracts_business_comment_contract = public_type_purpose + method_purpose_real_parameter_real_return_exception_or_side_effect + key_field_source_format_nullability_lifecycle_security
<!-- 关键行注释只解释 IPC 安全、状态迁移、数据裁剪、兼容和路径防护，禁止机械复述语法。 -->
contracts_key_line_comment_contract = IPC_security + state_transition + data_redaction + compatibility + path_guard + no_syntax_restatement

<!-- 用户要求新手级详细说明时，分组 import 中每个符号必须分别写注释，禁止只在 import 上方概括整个模块。 -->
typescript_grouped_import_beginner_comment_contract = each_imported_symbol_has_individual_comment
<!-- 每个导入符号的注释必须沿公开 index 说明到真实定义文件，禁止只重复 from 路径。 -->
typescript_grouped_import_beginner_comment_contract.2 = public_index_to_physical_definition_source
<!-- 每个导入符号的注释必须说明它是运行时工厂、类、函数还是纯类型，以及创建或处理的真实业务对象。 -->
typescript_grouped_import_beginner_comment_contract.3 = runtime_or_type_role_plus_real_business_effect
<!-- 每个导入符号的注释必须说明当前文件怎样使用；当前未使用的类型也必须明确标出，禁止让读者猜测。 -->
typescript_grouped_import_beginner_comment_contract.4 = current_caller_usage_or_explicit_unused_status

<!-- Electron 主进程、preload 和 Renderer 必须保持单向依赖边界，Renderer 只能通过 DesktopApi 使用后端能力。 -->
runtime_boundary_contract = renderer_to_typed_DesktopApi_to_preload_whitelist_to_registered_IPC_to_application_service_to_infrastructure
<!-- preload 只桥接登记能力，IPC handler 只校验和编排，业务服务不反向依赖 Renderer。 -->
runtime_decoupling_contract = preload_no_business_logic + handler_validation_and_orchestration_only + service_no_renderer_dependency + infrastructure_no_UI_callback
<!-- Electron 沙箱 preload 可以按领域维护源码，但生产构建必须打包为只保留 electron 外部依赖的单一物理文件；真实沙箱测试必须覆盖全部领域代表能力。 -->
sandboxed_preload_delivery_contract = domain_source_modules + build_single_CJS_bundle + external_electron_only + sandbox_true_runtime_smoke_across_all_capability_domains + renderer_blocks_fake_interactive_UI_when_bridge_missing
<!-- 集中入口只能组合领域模块，不得继续承载多个业务域的具体实现。 -->
composition_root_contract = composition_only + domain_modules_own_implementation + no_god_registration_or_application_component
<!-- Electron main.ts 只登记 ready、before-quit 和 window-all-closed；环境、数据库、公共能力、协作、人物和 IPC 必须由独立 bootstrap 按单向顺序装配。 -->
electron_bootstrap_layer_contract = thin_main_lifecycle_entry + startup_context + persistence_context + capability_context + collaboration_context + persona_application_context + IPC_application_ports + application_runtime_composition + no_database_persona_or_IPC_construction_in_main
<!-- 长期资源必须由应用运行时统一持有并逆序释放；测试数据重置属于应用用例，不得把跨 Store 清理重新塞回 main 或数据库实现。 -->
application_lifecycle_contract = one_startApplication + one_disposeApplication + idempotent_persistence_close + stop_watchers_supervisor_persona_and_codex_before_database + test_data_reset_application_service + no_cross_domain_cleanup_in_main
<!-- 大文件必须按业务能力和状态所有权拆分，禁止只按行数机械切割。 -->
module_split_contract = split_by_business_capability_and_state_ownership + independently_testable_boundary + no_arbitrary_line_partition
<!-- Electron 服务固定分为五个平行区域；跨区只能经过目标模块 index，platform 不得反向依赖人物或业务能力。 -->
electron_service_zone_contract = personas + evolution + workflow + capabilities + platform + public_index_only_cross_zone_import + platform_no_reverse_business_dependency + no_root_service_implementation
<!-- 南宫、韩立和令狐必须作为 personas 下并列一级模块存在；每个人物只公开自己的 Facade、Runtime 工厂和必要 Port 类型，禁止人物之间导入 internal 或具体 Facade 文件。 -->
parallel_persona_module_contract = personas/nangong + personas/hanli + personas/linghu + personas/executor + one_public_index_per_persona + one_facade_and_runtime_per_persona + no_cross_persona_internal_or_concrete_facade_dependency + no_shared_base_persona
<!-- 动态普通成员必须共用通用 Executor Runtime；执行会话工厂、会话缓存、存活检查和调用行为不得由 Workflow 持有，也不得按成员姓名复制目录。 -->
generic_executor_persona_contract = personas/executor + contracts/collaboration/executor/dto_and_port + one_runtime_for_all_dynamic_workers + member_identity_passed_at_assignment + executor_owns_session_factory_cache_liveness_and_execution_calls + workflow_no_executor_session_factory_or_session_map + no_per_member_executor_directory
<!-- 南宫婉负责生成、解析和校验任务拆分计划并选择偏好执行人；Workflow 只接收结构化任务、排队、状态迁移、恢复、集成和结果回流。 -->
nangong_distribution_ownership_contract = nangong_owns_distribution_prompt_parse_validation_assignee_preference_and_idempotent_dispatch + IPC_calls_NangongFacade + workflow_owns_queue_state_recovery_integration_and_result_collection_only + prohibit_distribution_service_under_workflow
<!-- 人物负责自己的业务判断，Workflow 只依据能力注册和持久事实决定轮转顺序，Evolution 是共同专题、提案、审批与验收状态的唯一所有者。 -->
persona_evolution_workflow_ownership_contract = persona_owns_own_decision + workflow_owns_cross_persona_sequence_and_recovery + evolution_owns_shared_topic_proposal_approval_acceptance_state + no_persona_named_shared_store_repository_state_event_or_IPC
<!-- 新人物必须通过独立目录、最小能力端口和注册表加入；不得要求修改现有人物内部文件，也不得让 Workflow 读取人物 internal。 -->
persona_extension_contract = add_persona_directory + implement_minimal_capability_port + register_capabilities + no_existing_persona_internal_change + workflow_no_persona_internal_import
<!-- 人物公开入口不得导出 Store、Runner、Repository、Analyzer、内部异常或内部常量；组合根只能取得门面与受控生命周期。 -->
persona_public_api_contract = facade + runtime_factory + runtime_and_port_types_only + prohibit_store_runner_repository_analyzer_internal_error_and_internal_constant_export
<!-- 协作 Contracts 必须按 nangong、hanli、linghu、evolution、workflow 分模块，并以 .in.dto、.out.dto、事件或 port 表达数据方向；旧人物混合契约不得保留第二权威定义。 -->
persona_contract_layout_contract = contracts/collaboration/nangong/dto + contracts/collaboration/hanli/dto + contracts/collaboration/linghu/dto + contracts/collaboration/executor/dto_and_port + contracts/collaboration/evolution/dto + contracts/collaboration/workflow/dto_and_port + directional_in_out_dto_names + one_authoritative_shared_evolution_state + no_legacy_nangong_evolution_contract
<!-- 每个 contracts 领域 index 必须显式列出公开符号及其物理来源，业务含义是从类型名和唯一入口可以直接定位定义文件。 -->
contracts_public_index_traceability_contract = explicit_named_symbol_exports_with_physical_source + prohibit_export_star_and_export_type_star + one_authoritative_definition_per_public_symbol + no_forwarding_fake_DTO
<!-- 跨模块只允许导入目标模块 index，同模块内部才允许导入自己的具体 DTO；Desktop 聚合只服务 preload 和 Renderer，主进程必须导入所属领域入口。 -->
contracts_import_source_contract = cross_module_target_index_only + same_module_direct_DTO_allowed + desktop_aggregate_for_preload_and_renderer_only + electron_main_process_no_desktop_aggregate_import
<!-- Renderer 的南宫和韩立输入页面进入各自 feature；Evolution 只保留共享表格、详情、档案、树和工作台模型，开发壳层只组合公开人物页面。 -->
persona_renderer_boundary_contract = features/nangong + features/hanli + features/linghu + shared_evolution_read_models_and_navigation_only + developer_shell_composition_only
<!-- 并列人物重构必须以静态边界、业务、并发、交互、构建和真实启动测试共同验收；旧平铺文件、旧公开出口和兼容别名归零后才可完成。 -->
parallel_persona_completion_gate = boundary + business + concurrency + interaction + build + real_startup + legacy_flat_file_and_public_export_zero + controlled_legacy_state_recovery
<!-- 令狐在 contracts、Electron 主进程和 Renderer 三个既有编译边界下分别使用同名 linghu 目录；主进程令狐根层只保留 index 和 Facade，技术测试执行与持久化通过公共能力端口注入。 -->
linghu_vertical_module_contract = contracts/collaboration/linghu + electron/services/personas/linghu + src/features/linghu + public_index_only + public_index_exports_only_facade_runtime_factory_and_runtime_types + prohibit_public_store_runner_internal_error_and_internal_constant_exports + runtime_internally_constructs_store_and_analyzer_and_accepts_testing_and_persistence_ports + fixed_unified_test_runner_owned_by_capabilities/testing + atomic_json_persistence_owned_by_platform/persistence + facade_depends_on_minimal_collaboration_port_not_concrete_coordinator + electron_linghu_root_contains_index_and_linghu_automation_facade_only + internal_contains_runtime_store_and_analyzer + facade_store_analyzer_and_runtime_role_names_not_generic_service_names + prohibit_external_direct_internal_or_facade_file_import + preserve_main_preload_renderer_contract_boundaries + main_and_developer_shell_composition_only + flow_analysis_and_UI_owned_by_linghu_module
<!-- 令狐 DTO 固定站在令狐模块边界判断方向：进入令狐为 InDto，离开令狐为 OutDto，主动事件为 EventOutDto；每个文件必须写明生产方、接收方、流向和禁止职责。 -->
linghu_contract_dto_layout_contract = contracts/collaboration/linghu/dto + one_direction_per_kebab_case_dot_in_or_out_dot_dto_dot_ts_file_with_same_direction_supporting_types + linghu_boundary_is_direction_reference + inbound_names_end_with_InDto + outbound_names_end_with_OutDto + outbound_event_names_end_with_EventOutDto + file_comment_declares_producer_consumer_data_flow_and_forbidden_responsibility + linghu_index_is_only_public_facade + prohibit_external_direct_dto_import + repair_proposal_out_owned_by_linghu_not_nangong

<!-- 客户安装包必须携带由显式白名单构建的生产规则 bundle，禁止依赖 SELPLAT 源码仓库。 -->
production_rule_bundle_contract = explicit_allowlist_build + manifest_and_rules_JSON + packaged_extraResources + no_source_repository_dependency
<!-- 规则 bundle 只允许包含批准的运行规则，必须排除历史、测试、模板、用户会话和无关应用资产。 -->
production_rule_bundle_content_contract = approved_runtime_rules_only + exclude_archive_tests_templates_session_materials_unrelated_application_rules_and_development_abilities
<!-- 安装态内置规则从 resourcesPath/ruleengine 读取，开发态从 build/ai-desktop/rule-bundle 读取。 -->
production_rule_runtime_path_contract = packaged_process_resourcesPath_ruleengine + development_build_ai_desktop_rule_bundle
<!-- 客户覆盖只能进入 userData/ruleengine/overrides，内置规则保持只读。 -->
customer_rule_overlay_path_contract = userData_ruleengine_overrides + builtin_read_only
<!-- 客户覆盖必须显式匹配可覆盖逻辑 ID，经过格式、大小、哈希和冲突校验后才能生效。 -->
customer_rule_overlay_validation_contract = registered_overridable_logical_id + safe_JSON_shape + bounded_content + content_hash + invalid_overlay_rejected_with_diagnostic
<!-- 有效规则必须真实注入 Codex 会话开发约束，同时可通过只读 IPC 查询来源和生效结果。 -->
effective_rule_consumption_contract = inject_into_Codex_developer_instructions + read_only_status_list_and_resolve_IPC + source_traceability
<!-- 客户运行优先使用 TypeScript 加载预编译 bundle，不要求额外安装 Python。 -->
customer_runtime_language_contract = TypeScript_precompiled_bundle_loader + no_required_external_Python_runtime

<!-- 打包验收必须检查真实产物中规则存在、禁止内容不存在，并在脱离源码根的环境中加载成功。 -->
package_acceptance_contract = inspect_real_artifact + required_rule_files_present + forbidden_internal_content_absent + start_and_load_without_SELPLAT_source_root
<!-- 结构和规则交付变更必须登记 contracts、模块边界、bundle、覆盖、Codex 注入和真实打包回归。 -->
test_registration_contract = contracts_layout + dependency_direction + bundle_build + overlay_validation + Codex_instruction_injection + real_package_content_and_isolated_startup
