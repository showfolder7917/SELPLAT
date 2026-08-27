# AI Desktop 架构边界与客户规则交付规则

<!-- 本规则只约束 AI Desktop 应用的协议分层、运行边界、模块化、业务注释和客户规则交付。 -->
rule_scope = selplat/application/ai-desktop/architecture_boundary_and_rule_delivery
<!-- 规则所有者始终从工程根当前稳定用户声明解析，禁止固定用户分支。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 首版沉淀用户确认的结构整改、补注释、前后端分离、解耦、分模块和客户规则可用性要求。 -->
rule_version = 1.0.0
<!-- active 表示规则正文、叶子索引和生产规则白名单已经形成可达入口。 -->
rule_status = active
<!-- 本轮架构重构由应用 TypeScript、Node 构建脚本和静态门禁实现，不建立 Java 能力。 -->
java_ability_refs = none
<!-- 生产规则 bundle 由应用 Node 脚本生成，Python 继续承担工程期规则治理但不作为客户运行时依赖。 -->
python_ability_refs = none
<!-- 应用生产程序直接实现规则加载，不在 rule-engine 内伪造第二个 Node ability。 -->
node_ability_refs = none
<!-- 真实生产规则加载入口固定为主进程规则服务。 -->
application_program_path = apps/ai-desktop/electron/services/rules/rule-bundle-service.ts

<!-- 应用私有跨进程协议必须按基础、桌面、Codex、协作和治理领域分层，禁止恢复根目录平铺。 -->
contracts_domain_layout_contract = foundation + desktop + codex + collaboration + governance + no_flat_business_contracts
<!-- contracts 只能定义纯数据和白名单接口，不得依赖 Electron、React、文件系统、SQLite 或具体业务服务。 -->
contracts_purity_contract = pure_types_and_capability_whitelist_only + no_electron_react_node_filesystem_database_or_service_implementation
<!-- 每个协议文件必须说明职责、生产者、消费者、数据方向和禁止职责。 -->
contracts_file_comment_contract = responsibility + producer + consumer + data_direction + forbidden_responsibility
<!-- 公开类型、方法和关键字段必须使用真实业务语义注释，方法依次说明作用、传参、返回和异常或副作用。 -->
contracts_business_comment_contract = public_type_purpose + method_purpose_real_parameter_real_return_exception_or_side_effect + key_field_source_format_nullability_lifecycle_security
<!-- 关键行注释只解释 IPC 安全、状态迁移、数据裁剪、兼容和路径防护，禁止机械复述语法。 -->
contracts_key_line_comment_contract = IPC_security + state_transition + data_redaction + compatibility + path_guard + no_syntax_restatement

<!-- Electron 主进程、preload 和 Renderer 必须保持单向依赖边界，Renderer 只能通过 DesktopApi 使用后端能力。 -->
runtime_boundary_contract = renderer_to_typed_DesktopApi_to_preload_whitelist_to_registered_IPC_to_application_service_to_infrastructure
<!-- preload 只桥接登记能力，IPC handler 只校验和编排，业务服务不反向依赖 Renderer。 -->
runtime_decoupling_contract = preload_no_business_logic + handler_validation_and_orchestration_only + service_no_renderer_dependency + infrastructure_no_UI_callback
<!-- 集中入口只能组合领域模块，不得继续承载多个业务域的具体实现。 -->
composition_root_contract = composition_only + domain_modules_own_implementation + no_god_registration_or_application_component
<!-- 大文件必须按业务能力和状态所有权拆分，禁止只按行数机械切割。 -->
module_split_contract = split_by_business_capability_and_state_ownership + independently_testable_boundary + no_arbitrary_line_partition

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
