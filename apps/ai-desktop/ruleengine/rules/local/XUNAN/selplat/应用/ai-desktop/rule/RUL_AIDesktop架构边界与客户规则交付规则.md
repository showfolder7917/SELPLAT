# AI Desktop 架构边界与客户规则交付规则

<!-- 本规则只约束 AI Desktop 应用的协议分层、运行边界、模块化、业务注释和客户规则交付。 -->
rule_scope = selplat/application/ai-desktop/architecture_boundary_and_rule_delivery
<!-- 规则所有者始终从工程根当前稳定用户声明解析，禁止固定用户分支。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 2.18.0 将中文业务名称优先扩展为新手模块整目录检查，覆盖导入、参数、状态、分支、返回字段和专属子组件。 -->
rule_version = 2.18.0
<!-- active 表示规则正文、叶子索引和生产规则白名单已经形成可达入口。 -->
rule_status = active
<!-- 本轮架构重构由应用 TypeScript、Node 构建脚本和静态门禁实现，不建立 Java 能力。 -->
java_ability_refs = none
<!-- 生产规则 bundle 由应用 Node 脚本生成，Python 继续承担工程期规则治理但不作为客户运行时依赖。 -->
python_ability_refs = none
<!-- 应用生产程序直接实现规则加载，不在 rule-engine 内伪造第二个 Node ability。 -->
node_ability_refs = none
<!-- 真实生产规则加载入口固定为主进程规则服务。 -->
application_program_path = apps/ai-desktop/electron/services/support/capabilities/rules/active-user-rule.facade.ts

<!-- 应用私有协议顶层只保留 foundation、system、services；services 必须与 Electron 的真实业务所有者路径同构。 -->
contracts_domain_layout_contract = foundation + system/desktop + services/personas_evolution_workflow_support + services/support/application_capabilities_platform + mirror_electron_service_owner_path + no_ownerless_theme_root + no_flat_business_contracts + no_root_codex_or_governance_domain
<!-- 协议所有者依次由字段语义、生产与兼容责任、真实 Facade/Service/Repository 和持久化恢复责任判定，页面与消费者不得决定物理归属。 -->
contracts_owner_resolution_contract = semantic_authority_then_producer_and_compatibility_owner_then_real_implementation_then_persistence_and_recovery_owner + renderer_page_and_consumer_never_define_owner
<!-- 跨所有者页面只能由 DesktopApi 或 Application 用例组合数据；底层 DTO、Port 和 Value 必须保留在各自真实所有者入口。 -->
contracts_cross_owner_view_contract = system_desktop_or_application_composition_only + underlying_contracts_stay_with_real_owner + prohibit_ownerless_governance_theme_aggregate
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
<!-- 公开索引的每个导出符号必须分别说明业务对象、使用方和实际含义，禁止用一条总注释覆盖整组符号。 -->
typescript_public_export_comment_contract = one_comment_per_exported_symbol + business_object_and_consumer_and_meaning + no_group_summary_as_symbol_documentation

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
<!-- Electron 根除 main 和发布入口外只保留 system 与 services；services 顶层只保留核心业务区和 support，三类非人物业务能力统一进入 support。 -->
electron_system_services_layout_contract = electron/main_and_packaged_bootstrap + electron/system/bootstrap_config_ipc_preload_policies_window + electron/services/personas_evolution_workflow_support + electron/services/support/application_capabilities_platform + prohibit_legacy_root_bootstrap_config_ipc_preload_policies_window_application + prohibit_services_root_application_capabilities_platform + electron_README_is_structure_entry
<!-- 长期资源必须由应用运行时统一持有并逆序释放；测试数据重置属于应用用例，不得把跨 Store 清理重新塞回 main 或数据库实现。 -->
application_lifecycle_contract = one_startApplication + one_disposeApplication + idempotent_persistence_close + stop_watchers_supervisor_persona_and_codex_before_database + test_data_reset_application_service + no_cross_domain_cleanup_in_main
<!-- 大文件必须按业务能力和状态所有权拆分，禁止只按行数机械切割。 -->
module_split_contract = split_by_business_capability_and_state_ownership + independently_testable_boundary + no_arbitrary_line_partition
<!-- 韩立人物模块使用领域聚合根、按能力分组的 internal、公开门面和唯一索引；会话状态不得继续以零散变量在服务间传递。 -->
hanli_vertical_module_layout_contract = contracts_domain_values_and_ports + electron_personas_hanli_domain_aggregate + internal_application_conversation_decision_acceptance_semantic + facade_and_public_index + no_flat_internal_capability_mix + no_scattered_conversation_state_parameters
<!-- 南宫婉与韩立采用同一可读结构，但各自聚合状态和内部能力，不抽取共享人物基类。 -->
nangong_vertical_module_layout_contract = contracts_domain_values_and_ports + electron_personas_nangong_domain_conversation_aggregate + internal_application_conversation_inquiry_evolution_distribution + facade_and_public_index + no_flat_internal_capability_mix + no_scattered_conversation_state_parameters
<!-- Workflow 使用领域聚合、无状态领域策略、按职责分组的 internal、两个公开门面和唯一索引；Store、Repository、Runtime 与 Service 不得重复拥有聚合状态判断。 -->
workflow_vertical_module_layout_contract = contracts_workflow_DTO_values_and_ports + electron_services_workflow_domain_collaboration_task_proposal_execution_checkpoint_and_deliberation_aggregates + domain_evolution_flow_policy_and_persona_capability_registry + internal_acceptance_checkpoint_collaboration_evolution_and_result + collaboration_and_persona_facades + public_index_and_README + no_flat_internal_capability_mix + no_scattered_state_transition_arrays
<!-- 聚合只维护有稳定身份、跨步骤变化且必须共同保持一致的状态与决定；跨聚合长流程由 Runtime 或 Coordinator 通过稳定标识协调，禁止建立包含人物会话、协作任务、卡点和提案的超级聚合。 -->
workflow_aggregate_boundary_contract = aggregate_owns_identity_state_transition_invariants_and_structured_decision + runtime_or_coordinator_owns_cross_aggregate_sequence_and_side_effect_dispatch + store_and_repository_persist_aggregate_snapshot_only + service_owns_model_message_and_external_IO_only + aggregate_relation_by_stable_ID + no_super_aggregate
<!-- 修复任务必须保存明确替代的原任务标识；提案执行聚合沿替代链选择当前有效任务，修复完成后旧失败任务不得继续把提案投影为阻塞或触发重复派发。 -->
workflow_repair_replacement_contract = repair_task_replacementForTaskId + proposal_execution_aggregate_resolves_effective_task_chain + integrated_replacement_advances_pending_acceptance + restart_never_redispatches_from_superseded_failure + legacy_single_task_repair_compatibility_only_with_same_proposal_linghu_source_and_integrated_fact
<!-- 人物领域与应用代码优先表达真实业务步骤；禁止用嵌套三元、一行多判断或长链式转换换取表面短小。 -->
persona_code_readability_contract = business_named_intermediate_values + explicit_if_else_and_for + one_business_step_per_block + field_source_meaning_lifecycle_and_effect_comments + no_nested_ternary + no_compacted_guard_or_long_transform_chain
<!-- 用户要求采用新手结构分层且页面自身拥有复杂状态时，主页面、参数类型和 use 控制逻辑必须同级；仅属于该页面的子组件进入与主页面同名的目录。 -->
renderer_beginner_page_layout_contract = complex_page_with_owned_state_uses_peer_main_View_props_types_and_use_controller + same_named_directory_for_page_owned_child_components + child_directory_is_module_not_route + no_duplicate_copy_under_model
<!-- 新手结构文件必须在头部说明对应的真实页面入口和可见区域；数据结构字段、use Hook 状态与操作、关键 JSX 节点均逐项写业务用途注释。 -->
renderer_beginner_comment_contract = file_header_real_navigation_and_visible_region + every_props_field_business_comment + every_use_state_and_operation_business_comment + key_JSX_node_real_UI_comment
<!-- 新手注释必须先说明中文业务名称和实际用途，代码变量名仅在需要建立对应关系时放入中文名称后的括号中，禁止以陌生英文标识开头让读者先猜含义。 -->
renderer_beginner_comment_sentence_contract = chinese_business_name_first + optional_code_identifier_in_parentheses_after_meaning + real_purpose_after_identity + prohibit_unknown_identifier_first
<!-- 新手结构中的后端、IPC、服务或跨模块调用必须展开参数对象；每个传出字段独占一行，并用中文说明业务名称、接收端用途及必要的关联关系。 -->
renderer_beginner_outbound_call_comment_contract = multiline_cross_layer_call + one_outbound_field_per_line + chinese_business_name_and_receiver_purpose_per_field + explain_stable_identity_relationship
<!-- 新手结构注释修正必须检查主页面及其同级参数、控制逻辑和专属子模块整棵目录；导入、字段、状态、分支与返回值均禁止用英文标识作为说明开头。 -->
renderer_beginner_module_comment_audit_contract = audit_entire_page_module_tree + include_imports_props_state_branches_returns_and_child_components + chinese_business_concept_before_code_identifier_everywhere + prohibit_fixing_only_reported_line
<!-- 新手结构禁止把异步业务流程直接压进 JSX 事件属性；使用具名方法、显式条件、业务中间变量和分行属性保持从数据到结构可顺序阅读。 -->
renderer_beginner_implementation_contract = named_event_method + explicit_guard_and_error_flow + business_intermediate_values + multiline_JSX_props + no_inline_async_business_flow_or_compacted_catch_finally
<!-- 已由公共控制器供数的纯页面、小型无状态子组件、应用装配、路由、共享 model、theme、foundation、截图 canvas 与 geometry 不得为凑齐三文件而增加空控制层。 -->
renderer_beginner_structure_exception_contract = pure_View_with_existing_shared_controller + small_stateless_leaf + application_composition + router + shared_model_theme_foundation + screenshot_canvas_and_geometry + no_empty_wrapper_or_duplicate_controller
<!-- Renderer 的真实窗口必须由 applications 独立拥有；Application 只装配布局与 feature，禁止一个文件同时定义多个窗口或人物、协作、会话业务页面。 -->
renderer_application_structure_contract = applications/developer + applications/screenshot + one_real_window_per_application + application_composes_layout_and_features_only + no_variants_production_owner + no_evolution_workspace_application
<!-- 代码分割后的每个 Application 必须显式加载自身控件注册和样式副作用，禁止依赖其他窗口或懒加载分支先执行。 -->
renderer_application_runtime_dependency_contract = each_lazy_application_imports_own_control_registration_and_styles + no_cross_application_side_effect_dependency + interaction_test_each_production_application
<!-- Developer 窗口按 Shell、ActivityBar、Explorer、Workspace、StatusBar 布局区域拆分；布局组件不得直接持有 DesktopApi 业务流程。 -->
renderer_layout_structure_contract = applications/developer/layout/DeveloperShell_DeveloperActivityBar_DeveloperExplorer_DeveloperWorkspace_DeveloperStatusBar + layout_slots_only + no_DesktopApi_business_flow_in_layout
<!-- 人物、协作与会话控件必须进入对应 feature；格式化和实时输出类型进入 model，Application 不得重新定义这些控件或保留兼容副本。 -->
renderer_feature_control_ownership_contract = collaboration_components_and_model + conversation_components_and_model + features/nangong + one_owner_per_control + no_duplicate_component_definition_or_compatibility_copy
<!-- 测试必须镜像生产所有者：Renderer 进入 applications/features，主进程进入 services，跨域门禁、真实交互和发布验证分别独立；根目录不得平铺业务测试。 -->
test_owner_structure_contract = tests/applications + tests/features + tests/services_mirror_electron_owner + tests/contracts + tests/interaction + tests/release + tests/support_helpers_only + no_root_business_test + no_legacy_forwarder
<!-- 完整测试入口必须递归发现所有所有者下的 test.mjs，命名脚本使用正式新路径；静态契约、服务、真实交互和发布不得互相代替。 -->
test_owner_execution_contract = recursive_owned_test_discovery + named_scripts_reference_owner_paths + static_service_interaction_release_independent_gates + test_paths_from_single_support_entry
<!-- Electron 服务顶层固定为三个核心业务区与一个 support 支撑区；support 内部三类职责继续隔离，跨区只能经过目标模块 index。 -->
electron_service_zone_contract = personas + evolution + workflow + support/application_capabilities_platform + public_index_only_cross_zone_import + support_platform_no_reverse_business_dependency + no_root_service_implementation
<!-- 南宫、韩立和令狐必须作为 personas 下并列一级模块存在；每个人物只公开自己的 Facade、Runtime 工厂和必要 Port 类型，禁止人物之间导入 internal 或具体 Facade 文件。 -->
parallel_persona_module_contract = personas/nangong + personas/hanli + personas/linghu + personas/executor + one_public_index_per_persona + one_facade_and_runtime_per_persona + no_cross_persona_internal_or_concrete_facade_dependency + no_shared_base_persona
<!-- 动态普通成员必须共用通用 Executor Runtime；执行会话工厂、会话缓存、存活检查和调用行为不得由 Workflow 持有，也不得按成员姓名复制目录。 -->
generic_executor_persona_contract = personas/executor + contracts/services/personas/executor/dto_and_port + one_runtime_for_all_dynamic_workers + member_identity_passed_at_assignment + executor_owns_session_factory_cache_liveness_and_execution_calls + workflow_no_executor_session_factory_or_session_map + no_per_member_executor_directory
<!-- 南宫婉负责生成、解析和校验任务拆分计划并选择偏好执行人；Workflow 只接收结构化任务、排队、状态迁移、恢复、集成和结果回流。 -->
nangong_distribution_ownership_contract = nangong_owns_distribution_prompt_parse_validation_assignee_preference_and_idempotent_dispatch + IPC_calls_NangongFacade + workflow_owns_queue_state_recovery_integration_and_result_collection_only + prohibit_distribution_service_under_workflow
<!-- 人物负责自己的业务判断，Workflow 只依据能力注册和持久事实决定轮转顺序，Evolution 是共同专题、提案、审批与验收状态的唯一所有者。 -->
persona_evolution_workflow_ownership_contract = persona_owns_own_decision + workflow_owns_cross_persona_sequence_and_recovery + evolution_owns_shared_topic_proposal_approval_acceptance_state + no_persona_named_shared_store_repository_state_event_or_IPC
<!-- 新人物必须通过独立目录、最小能力端口和注册表加入；不得要求修改现有人物内部文件，也不得让 Workflow 读取人物 internal。 -->
persona_extension_contract = add_persona_directory + implement_minimal_capability_port + register_capabilities + no_existing_persona_internal_change + workflow_no_persona_internal_import
<!-- 人物公开入口不得导出 Store、Runner、Repository、Analyzer、内部异常或内部常量；组合根只能取得门面与受控生命周期。 -->
persona_public_api_contract = facade + runtime_factory + runtime_and_port_types_only + prohibit_store_runner_repository_analyzer_internal_error_and_internal_constant_export
<!-- 人物 Contracts 与 Electron personas 并列同构，Evolution 与 Workflow 保持中立所有者；旧 collaboration 映射不得保留第二权威定义。 -->
persona_contract_layout_contract = contracts/services/personas/nangong_dto + contracts/services/personas/hanli_dto_and_value + contracts/services/personas/linghu_dto_and_value + contracts/services/personas/executor_dto_and_port + contracts/services/evolution/dto_and_value + contracts/services/workflow/dto_port_value + directional_in_out_and_event_dto_names + one_authoritative_shared_evolution_state + no_legacy_collaboration_contract_root
<!-- 协议角色必须从文件名、公开类型名和目录共同可见；Port 只表示带方法的行为边界，稳定联合类型必须归入 Value。 -->
contracts_protocol_role_contract = dto/in_and_out + dto/event_out + port/callable_behavior_only + value/stable_directionless_value + api/capability_aggregate + InDto_OutDto_EventOutDto_Port_Value_Api_suffixes + prohibit_non_callable_port + no_empty_role_directory
<!-- 每个 contracts 领域 index 必须显式列出公开符号及其物理来源，业务含义是从类型名和唯一入口可以直接定位定义文件。 -->
contracts_public_index_traceability_contract = explicit_named_symbol_exports_with_physical_source + prohibit_export_star_and_export_type_star + one_authoritative_definition_per_public_symbol + no_forwarding_fake_DTO
<!-- 跨模块只允许导入目标模块 index，同模块内部才允许导入自己的具体 DTO；Desktop 聚合只服务 preload 和 Renderer，主进程必须导入所属领域入口。 -->
contracts_import_source_contract = cross_module_target_index_only + same_module_direct_DTO_allowed + desktop_aggregate_for_preload_and_renderer_only + electron_main_process_no_desktop_aggregate_import
<!-- Renderer 的人物输入页面进入各自 feature；Evolution 只保留人物会话和协作流程消费的共享运行态与变更请求模型，不保留工作台界面。 -->
persona_renderer_boundary_contract = features/nangong + features/hanli + features/linghu + shared_evolution_runtime_and_mutation_model_only + developer_shell_composition_only + no_evolution_tree_grid_detail_dossier_or_workspace_UI
<!-- 演化工作台采用不兼容退役：窗口、路由、组件、DesktopApi、IPC、偏好表和别名必须同时归零，禁止重定向、占位页或隐藏兼容窗口。 -->
evolution_workspace_hard_retirement_contract = remove_window_route_components_desktop_api_preload_IPC_query_preference_table_and_capability + no_redirect_placeholder_hidden_window_alias_or_compatibility_copy + preserve_shared_evolution_workflow_state_and_persona_conversation_trigger
<!-- 并列人物重构必须以静态边界、业务、并发、交互、构建和真实启动测试共同验收；旧平铺文件、旧公开出口和兼容别名归零后才可完成。 -->
parallel_persona_completion_gate = boundary + business + concurrency + interaction + build + real_startup + legacy_flat_file_and_public_export_zero + controlled_legacy_state_recovery
<!-- 令狐在 contracts、Electron 主进程和 Renderer 三个既有编译边界下分别使用同名 linghu 目录；主进程令狐根层只保留 index 和 Facade，技术测试执行与持久化通过公共能力端口注入。 -->
linghu_vertical_module_contract = contracts/services/personas/linghu + electron/services/personas/linghu + src/features/linghu + public_index_only + public_index_exports_only_facade_runtime_factory_and_runtime_types + prohibit_public_store_runner_internal_error_and_internal_constant_exports + runtime_internally_constructs_store_and_analyzer_and_accepts_testing_and_persistence_ports + fixed_unified_test_runner_owned_by_support/capabilities/testing + atomic_json_persistence_owned_by_support/platform/persistence + facade_depends_on_minimal_collaboration_port_not_concrete_coordinator + electron_linghu_root_contains_index_and_linghu_automation_facade_only + internal_contains_runtime_store_and_analyzer + facade_store_analyzer_and_runtime_role_names_not_generic_service_names + prohibit_external_direct_internal_or_facade_file_import + preserve_main_preload_renderer_contract_boundaries + main_and_developer_shell_composition_only + flow_analysis_and_UI_owned_by_linghu_module
<!-- 令狐 DTO 固定站在令狐模块边界判断方向：进入令狐为 InDto，离开令狐为 OutDto，主动事件为 EventOutDto；每个文件必须写明生产方、接收方、流向和禁止职责。 -->
linghu_contract_dto_layout_contract = contracts/services/personas/linghu/dto_and_value + one_direction_per_kebab_case_dot_in_or_out_dot_dto_dot_ts_file_with_same_direction_supporting_types + linghu_boundary_is_direction_reference + inbound_names_end_with_InDto + outbound_names_end_with_OutDto + outbound_event_file_uses_dot_event_dot_out_dot_dto_and_type_ends_with_EventOutDto + stable_union_names_end_with_Value + file_comment_declares_producer_consumer_data_flow_and_forbidden_responsibility + linghu_index_is_only_public_facade + prohibit_external_direct_dto_or_value_import + repair_proposal_out_owned_by_linghu_not_nangong

<!-- 构建产物只携带统一 AGENTS、根索引和构建时当前用户的完整索引树，排除会话、历史和模板。 -->
production_rule_bundle_contract = ruleengine_AGENTS + root_RULE_INDEX + active_user_complete_index_tree + packaged_extraResources + exclude_sessions_history_templates
<!-- AI Desktop 运行时只递归当前用户入口，禁止加载 core、common 和其他用户；用户冲突时当前用户规则优先。 -->
active_user_rule_loading_contract = AGENTS_declared_user_else_authenticated_stable_subject_mapping + active_user_only + no_core_common_or_other_user + active_user_conflict_priority
<!-- UI 主工作区存在 AI Desktop 源码时直接使用源码规则树并保持既有 Git/构建/发布/重启流程。 -->
source_rule_workspace_contract = UI_primary_workspace_only + detect_apps_ai_desktop_package_AGENTS_root_index_and_user_index + source_rule_tree_direct_read + preserve_existing_release_flow
<!-- 未检测到源码时初始化 userData 本地规则工作区；修改立即进入后续任务，并生成只含当前用户的 ZIP outbox。 -->
local_rule_workspace_contract = userData_rule_workspace + writable_active_user_only + immediate_next_task_reload + revisioned_ZIP_outbox + no_installed_archive_mutation
<!-- 每次任务提交冻结用户、人物、专项规则、正文、哈希、索引与回执；任务执行期间不随热更新漂移。 -->
task_rule_snapshot_contract = activeUserId + role + ruleRevision + mandatoryRoleRuleIds + matchedTaskRuleIds + loadedRuleContents + loadedRuleHashes + indexCatalog + ruleReceipt + immutable_during_task
<!-- 韩立、南宫婉、执行者和令狐各自加载专有人物规则，动态执行成员复用执行者规则。 -->
persona_rule_contract = hanli_questioning + nangong_analysis_planning + executor_source_implementation + linghu_failure_test + dynamic_worker_reuses_executor
<!-- 启动时只异步尝试上传最新待传 ZIP 一次；未配置端点或失败时保留 outbox，禁止阻塞本地规则加载。 -->
rule_upload_contract = uploader_port + once_per_process_async_startup_attempt + latest_pending_only + SHA256_idempotency + success_receipt_history + failure_keeps_outbox + disabled_default
<!-- 有效规则通过人物和任务上下文注入 Codex，同时通过只读 IPC 暴露当前用户解析结果。 -->
effective_rule_consumption_contract = role_and_task_snapshot_Codex_injection + read_only_status_list_and_resolve_IPC + source_hash_receipt_traceability
<!-- 客户运行使用 TypeScript 规则加载、ZIP 与上传端口，不要求额外安装 Python。 -->
customer_runtime_language_contract = TypeScript_active_user_loader_and_archive + no_required_external_Python_runtime

<!-- 应用提示词统一从一个清单进入，正文按人物、执行流程和支撑能力分目录；每条必须登记稳定 ID、名称、描述、所有者、工作流、阶段、触发条件、版本、变量和组合依赖。 -->
application_prompt_library_contract = one_apps_ai_desktop_prompts_manifest + business_grouped_Markdown + stable_id_name_description_owner_workflow_stage_stageName_trigger_version_variables_and_includes + no_single_giant_prompt_file
<!-- 业务服务只能通过公共 PromptLibraryFacade 按逻辑 ID 渲染；禁止组合根、人物服务或执行器自行读取 Markdown、扫描目录猜测提示词或保留第二份内联正文。 -->
application_prompt_runtime_contract = PromptLibraryFacade_single_entry + business_service_uses_logical_id_and_structured_variables + no_direct_Markdown_read + no_directory_guess + no_duplicate_inline_prompt_authority
<!-- 提示词构建必须校验 ID、路径、变量、include 环和内容哈希；开发态读取 build/ai-desktop/prompt-bundle，安装态读取 resources/prompts。 -->
application_prompt_bundle_contract = build_time_id_path_variable_include_cycle_and_hash_validation + development_build_ai_desktop_prompt_bundle + packaged_resources_prompts + builtin_read_only
<!-- 修改提示词只允许改变 AI 表达与业务判断；文件、沙箱、命令、审批、状态机、解析和持久化权限继续由程序门禁决定。 -->
application_prompt_permission_boundary = editable_AI_behavior_only + filesystem_sandbox_command_approval_workflow_parser_and_persistence_remain_program_owned + prompt_never_grants_permission

<!-- 打包验收必须检查真实产物中规则存在、禁止内容不存在，并在脱离源码根的环境中加载成功。 -->
package_acceptance_contract = inspect_real_artifact + required_rule_files_present + forbidden_internal_content_absent + start_and_load_without_SELPLAT_source_root
<!-- 结构和规则交付变更必须登记 contracts、模块边界、bundle、覆盖、Codex 注入和真实打包回归。 -->
test_registration_contract = contracts_layout + dependency_direction + active_user_only_loading + persona_rule_injection + task_rule_snapshot + source_and_local_workspace + ZIP_outbox_and_upload_fallback + rule_and_prompt_bundle_build + prompt_metadata_variable_include_and_hash_validation + real_package_content_and_isolated_startup
