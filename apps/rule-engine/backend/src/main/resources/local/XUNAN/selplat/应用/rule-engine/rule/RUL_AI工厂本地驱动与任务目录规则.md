# AI 工厂本地驱动与任务目录规则

<!-- 当前规则用于约束 SELPLAT AI 工厂的 memory、ai-factory、Agent、Gate、生成物和可视化职责。 -->
rule_scope = active_user_selplat_ai_factory_architecture_and_runtime_ownership
<!-- 规则版本从用户确认的首个稳定双端职责模型开始。 -->
rule_version = 1.2.0
<!-- 规则所有者从工程根 AGENTS.md 动态获取，不在正文固定用户名。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 当前规则已经进入用户层索引并完成文档追踪检查。 -->
rule_status = active
<!-- 升级记录说明本轮将多次用户修正统一沉淀为可复用架构约束。 -->
upgrade_record = 2026-08-19:确立Python唯一驱动_Agent服务端登记_memory本地启动_中文任务目录和japanese式Java结构;2026-08-19:统一memory正式资源父目录;2026-08-20:建立需求分析启动链_统一文件读取器_中文Python业务文件名_按独立功能拆分要件

## 双端职责

<!-- memory 的 Python 常驻进程负责监听、调度、连接和启动，是工作流唯一主动驱动者。 -->
ai_factory_only_active_workflow_driver = local_memory_python_daemon
<!-- Java 服务端只提供登记、校验、权威持久化、服务端审计和只读可视化。 -->
ai_factory_java_responsibility = registry_http_validation_authoritative_persistence_server_audit_read_only_visualization
<!-- Java 不得启动 Agent、连接 Codex、执行本地 Gate、读取本地任务目录或主动调度阶段。 -->
ai_factory_java_forbidden_capabilities = start_agent_connect_codex_run_local_gate_read_local_task_root_schedule_stage
<!-- 所有工作流动作必须由 Python 调用 HTTP API 发起，Java仅在请求内校验并落库。 -->
ai_factory_workflow_change_trigger = python_initiated_http_api_only

## 角色与 Agent

<!-- 角色、Agent、版本、逻辑地址、协议、能力和绑定关系统一登记在 ai-factory。 -->
ai_factory_role_agent_authority = java_registry
<!-- Python 必须先取得阶段角色，再解析已批准 Agent 登记，最后访问并启动对应 Agent。 -->
memory_agent_start_sequence = fetch_stage_role_resolve_approved_agent_acquire_connection_start_agent
<!-- 每次运行只能绑定一个角色和一个 Agent，并冻结双方版本与摘要。 -->
memory_single_run_binding = one_role_one_agent_one_frozen_registration
<!-- 本地 Codex 连接由 Python 连接池管理，连接必须按 run 独占并隔离异常会话。 -->
memory_codex_connection_policy = python_pool_run_exclusive_quarantine_uncertain_session
<!-- 服务端不得返回长期凭据，只能返回短期授权或凭据引用。 -->
agent_credential_delivery_policy = short_lived_grant_or_secret_reference_only

## Gate 与审计

<!-- Gate 定义、样例、Runner 和执行证据在 memory 本地生成与运行。 -->
ai_factory_gate_execution_owner = local_memory_python_agent
<!-- Java 只登记 Gate 版本、证据摘要和结果，并提供查询展示。 -->
ai_factory_java_gate_scope = register_validate_persist_and_visualize_only
<!-- Python 保存完整本地执行事实，Java只审计其实际观察到的 API 请求、校验和状态结果。 -->
ai_factory_audit_fact_boundary = python_local_execution_facts_java_server_observed_api_facts
<!-- Java验证上报摘要不得被表述为Java亲自执行或直接观察了本地动作。 -->
server_verified_must_not_impersonate_local_execution = true

## 生成目录与命名

<!-- 本规则复用 SELPLAT 既有 OPTION/temp 防逃逸规则，不建立第二个临时根。 -->
ai_factory_runtime_path_parent_rule = SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES
<!-- AI 工厂所有可生成内容统一进入工程相对运行根。 -->
ai_factory_runtime_generated_root = <SELPLAT_ROOT>/OPTION/temp/ai-factory
<!-- 一个 task_id 必须唯一对应一个中文任务根目录。 -->
ai_factory_task_root_pattern = <SELPLAT_ROOT>/OPTION/temp/ai-factory/任务/<task_id>/
<!-- 当前任务文档、Agent记录、产物、Gate、证据、审计日志、运行日志和恢复点都必须归属于该 task_id。 -->
ai_factory_task_owned_content = 当前任务_智能体_产物_门禁_证据_审计日志_运行日志_恢复点
<!-- 源码目录只允许程序和固定资源，禁止出现任务运行生成物。 -->
ai_factory_source_tree_runtime_output_policy = forbidden
<!-- memory 的入口、规则、智能体和门禁四类正式资源必须统一归入 memory 资源父目录，禁止重新散落到 resources 根。 -->
memory_formal_resource_root = apps/ai-memory/src/main/resources/memory
<!-- memory 正式资源根下只按入口、规则、智能体和门禁四类目录保存对应资源。 -->
memory_formal_resource_categories = 入口_规则_智能体_门禁
<!-- memory 的需求分析核心资源统一从独立 core 根进入，避免与普通 Agent 资源混放。 -->
memory_requirement_core_resource_root = apps/ai-memory/src/main/resources/core
<!-- 需求分析师启动时依次加载用户协议、核心规则、Agent 定义和用户材料，再生成需求文档与需求要件。 -->
memory_requirement_agent_startup_chain = USER_PROTOCOL_then_core_rules_then_requirement_agent_then_user_materials
<!-- 同一个需求分析师负责需求文档与需求要件，禁止重新建立独立需求要件分析师角色。 -->
memory_requirement_document_and_items_owner = single_requirement_analyst_agent
<!-- 每个需求要件只对应一个可独立开发、调用、测试和验收的功能。 -->
memory_requirement_item_unit = one_independently_developable_callable_testable_acceptable_function
<!-- 页面、批处理与监听程序分别按按钮业务动作、批处理启动调用和事件处理调用确定功能边界。 -->
memory_requirement_item_entry_boundary = one_button_action_or_one_batch_invocation_or_one_listener_event_handling
<!-- 同一功能涉及的页面、接口、业务逻辑和数据库处理不得按技术层重复拆成多个要件。 -->
memory_requirement_item_technical_layer_split_policy = forbidden_for_same_business_action
<!-- memory 所有受管文件读取必须经过统一文件读取器，文档新类型等待专用 Reader 登记。 -->
memory_managed_file_read_entry = apps/ai-memory/src/main/python/com/sp/selplat/core/文件读取器.py
<!-- memory Python 业务源文件使用中文文件名，程序内部类函数参数变量和稳定标识保持英文。 -->
memory_python_business_filename_and_identifier_policy = chinese_filename_english_internal_identifiers
<!-- Python 包初始化等解释器约定文件继续保留标准名称，不受中文业务文件名要求影响。 -->
memory_python_standard_filename_exceptions = __init__.py
<!-- 本地开发服务器的数据库、日志和备份也必须进入统一运行根，生产服务器改用受控外部数据根。 -->
ai_factory_local_dev_server_generated_root = <SELPLAT_ROOT>/OPTION/temp/ai-factory/服务端开发数据
<!-- 中文规则资源使用 RUL_ 前缀，便于索引和人工识别。 -->
ai_factory_chinese_resource_filename_patterns = RUL_中文
<!-- 中文 Agent 定义使用 AGENT_ 前缀，禁止视觉相似字符。 -->
ai_factory_chinese_resource_filename_patterns.2 = AGENT_中文
<!-- 中文索引使用 IDX_ 前缀，保持唯一入口可识别。 -->
ai_factory_chinese_resource_filename_patterns.3 = IDX_中文
<!-- 中文门禁定义使用 GATE_ 前缀，与规则和 Agent 分离。 -->
ai_factory_chinese_resource_filename_patterns.4 = GATE_中文
<!-- 中文文件统一 UTF-8 与 NFC；程序包、API、数据库字段和稳定 ID 保持英文。 -->
ai_factory_name_encoding_and_identifier_policy = utf8_nfc_chinese_resources_ascii_stable_program_identifiers

## Java 与页面结构

<!-- ai-factory Java 工程必须参照 apps/japanese，以 backend 为实际 Gradle 子项目并采用业务模块优先分层。 -->
ai_factory_java_reference_architecture = apps/japanese_backend_feature_first_controller_service_impl_dao
<!-- ai-factory 静态资源目录固定无横线，文件名也使用 aifactory。 -->
ai_factory_static_resource_root = backend/src/main/resources/static/aifactory
<!-- 可视化页面只能查询任务、角色、Agent、进度、Gate、审计和审批，不得启动或推进工作流。 -->
ai_factory_visualization_mode = read_only_no_agent_start_no_workflow_transition

## 验证

<!-- 交付前必须验证双端禁止依赖、Agent登记解析顺序、每角色Agent绑定和页面只读性。 -->
ai_factory_architecture_delivery_gate = dependency_scan_agent_resolution_contract_single_role_agent_binding_read_only_ui
<!-- 交付前必须扫描源码污染、跨 task_id 文件、非法中文名、绝对路径和符号链接逃逸。 -->
ai_factory_runtime_directory_delivery_gate = source_pollution_cross_task_invalid_name_absolute_path_symlink_escape_scan
<!-- 当前规则为架构与文档约束，尚无独立稳定程序入口，禁止调用方猜测执行器。 -->
python_ability_refs = none
<!-- 当前规则不由 Java 自动修改或执行。 -->
java_ability_refs = none
<!-- 当前规则无 Node 能力。 -->
node_ability_refs = none
