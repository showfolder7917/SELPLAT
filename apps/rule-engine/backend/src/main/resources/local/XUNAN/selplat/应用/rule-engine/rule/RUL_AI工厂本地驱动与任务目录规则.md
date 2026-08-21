# AI 工厂本地驱动与任务目录规则

<!-- 当前规则用于约束 SELPLAT AI 工厂的 memory、ai-factory、Agent、Gate、生成物和可视化职责。 -->
rule_scope = active_user_selplat_ai_factory_architecture_and_runtime_ownership
<!-- 规则版本从用户确认的首个稳定双端职责模型开始。 -->
rule_version = 2.8.0
<!-- 规则所有者从工程根 AGENTS.md 动态获取，不在正文固定用户名。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 当前规则已经进入用户层索引并完成文档追踪检查。 -->
rule_status = active
<!-- 升级记录说明本轮将多次用户修正统一沉淀为可复用架构约束。 -->
upgrade_record = 2026-08-19:确立Python唯一驱动_Agent服务端登记_memory本地启动_中文任务目录和japanese式Java结构;2026-08-19:统一memory正式资源父目录;2026-08-20:建立需求分析启动链_统一文件读取器_中文Python业务文件名_按独立功能拆分要件;2026-08-20:固定ai-factiory根级统一入口_ai-memory独立BAT请求客户端_双Codex池_极简管理页面和执行审计;2026-08-20:AI工厂显式装配到8080统一Host并登记desktop入口;2026-08-20:AI工厂默认白底黑字普通极简主题_恢复统一个性化入口和用户主动主题切换_样式只消费统一令牌;2026-08-20:AI工厂正式运行数据库归位应用db目录_临时根只保存测试审计备份和任务生成物;2026-08-20:AiRole角色类型统一使用引用数据选项组_页面禁止硬编码工程师审核员名称;2026-08-20:角色管理接入公共Grid上下拖拽和公共Window编辑_受控维护元数据但仍禁止启动Agent或推进流程;2026-08-20:AI工厂全部Remix图标改由SEL同源vendor资源交付_禁止外部CDN或空白图标;2026-08-20:角色删除使用公共确认框和服务端引用门禁_公共Window禁用按钮必须保持文字可读;2026-08-21:按用户确认将AI工厂Remix图标切换为固定版本jsDelivr在线加载_公共本地字体保留供其他页面使用;2026-08-21:AI工厂登记公共号段DAO_每张业务表独立CommonSequenceSegment号段_兼容迁移旧自增列和现有数据_统一Host8080作为正常启动入口;2026-08-21:快速流程固定三类开发角色_同类角色允许多实例_门禁类型只保留AI_GATE_代码检查归测试范围_项目规则门禁和流程运行分表_所有KeyValue进入引用数据;2026-08-21:角色管理固定七个业务角色_三个工程师_三个审核员_一个项目经理_历史普通角色逻辑停用

## 双端职责

<!-- ai-memory 的 Python 常驻客户端负责轮询、调度、连接和启动，是工作流唯一主动驱动者。 -->
ai_factory_only_active_workflow_driver = local_ai_memory_python_polling_client
<!-- Java 服务端只提供登记、校验、权威持久化、服务端审计和受控管理可视化。 -->
ai_factory_java_responsibility = registry_http_validation_authoritative_persistence_server_audit_controlled_management_visualization
<!-- Java 不得启动 Agent、连接 Codex、执行本地 Gate、读取本地任务目录或主动调度阶段。 -->
ai_factory_java_forbidden_capabilities = start_agent_connect_codex_run_local_gate_read_local_task_root_schedule_stage
<!-- 所有工作流动作必须由 Python 调用 HTTP API 发起，Java仅在请求内校验并落库。 -->
ai_factory_workflow_change_trigger = python_initiated_http_api_only
<!-- AI 工厂正常运行只通过平台 Host 聚合入口启动，统一提供 8080 HTTP 控制面和页面。 -->
ai_factory_unified_human_start_entry = gradle_:apps:host:backend:run
<!-- AI 工厂独立 backend 启动只用于显式调试，不得作为正常入口或与 Host 同时启动。 -->
ai_factory_backend_run_visibility = standalone_debug_only_not_normal_entry
<!-- ai-memory 必须通过独立 BAT 运行，不得由 ai-factiory 启动或纳入其进程生命周期。 -->
ai_memory_process_ownership = independent_apps/ai-memory/ai-memory.bat
<!-- ai-memory 只作为 HTTP 请求客户端，禁止创建、绑定或监听 HTTP 服务端端口。 -->
ai_memory_http_boundary = outbound_client_only_no_http_listener

## 角色与 Agent

<!-- 角色、Agent、版本、逻辑地址、协议、能力和绑定关系统一登记在 ai-factory。 -->
ai_factory_role_agent_authority = java_registry
<!-- Python 必须先取得阶段角色，再解析已批准 Agent 登记，最后访问并启动对应 Agent。 -->
memory_agent_start_sequence = fetch_stage_role_resolve_approved_agent_acquire_connection_start_agent
<!-- 每次运行只能绑定一个角色和一个 Agent，并冻结双方版本与摘要。 -->
memory_single_run_binding = one_role_one_agent_one_frozen_registration
<!-- 本地 Codex 连接由 Python 连接池管理，连接必须按 run 独占并隔离异常会话。 -->
memory_codex_connection_policy = python_pool_run_exclusive_quarantine_uncertain_session
<!-- 有经验角色使用常驻 Codex 池，无经验角色使用释放即废弃连接的临时池。 -->
memory_role_experience_pool_mapping = EXPERIENCED:PERSISTENT_INEXPERIENCED:DISPOSABLE
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
<!-- AI 工厂门禁类型只允许引用数据稳定 Key AI_GATE，禁止重新建立规则门禁或代码门禁类型。 -->
ai_factory_gate_type_set = AI_GATE_only
<!-- 快速开发只登记需求检测员、代码检测员和项目经理总控三个 AI 门禁职责。 -->
ai_factory_gate_responsibility_set = REQUIREMENT_CHECKER_CODE_CHECKER_PROJECT_MANAGER_CONTROL
<!-- 代码质量检查属于测试工程师的测试范围，不得作为独立代码门禁类型或门禁树节点。 -->
ai_factory_code_quality_scope = testing_responsibility_not_gate_type

## 生成目录与命名

<!-- 本规则复用 SELPLAT 既有 OPTION/temp 防逃逸规则，不建立第二个临时根。 -->
ai_factory_runtime_path_parent_rule = SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES
<!-- AI 工厂任务、审计、测试、备份等可丢弃或可重建内容统一进入工程相对运行根，正式运行数据库除外。 -->
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
<!-- AI 工厂本地正式运行 H2 主库属于应用持久数据，必须与同类应用一致归入应用 db 目录。 -->
ai_factory_local_persistent_database_root = <SELPLAT_ROOT>/apps/ai-factiory/db
<!-- AI 工厂每张业务表必须登记独立 CommonSequenceSegment 号段并通过公共 SequenceGenerator 发号，业务列禁止 H2 identity。 -->
ai_factory_primary_key_strategy = one_table_one_CommonSequenceSegment_shared_SequenceGenerator_no_business_identity
<!-- 旧库迁移必须原位保留数据、解除业务列自增，并把游标单向提升到现有最大主键之后。 -->
ai_factory_legacy_primary_key_migration = preserve_rows_drop_business_identity_advance_cursor_only
<!-- 本地开发服务器的测试库、日志、备份和一次性运行数据进入统一临时根；生产服务器可改用受控外部数据根。 -->
ai_factory_local_dev_server_generated_root = <SELPLAT_ROOT>/OPTION/temp/ai-factory
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
<!-- AI 工厂管理登记与流程定义、流程运行分表；旧 AiStageExecution 模型永久废止。 -->
ai_factory_management_table_set = AiRole_AiProject_AiGate_AiRule_AiWorkflowDefinition_AiWorkflowVersion_AiWorkflowNode_AiWorkflowEdge_AiWorkflowRun_AiWorkflowNodeRun
<!-- 项目表只保存项目登记，当前阶段和完成百分比必须由最新流程节点运行事实计算。 -->
ai_factory_project_progress_source = latest_AiWorkflowRun_and_AiWorkflowNodeRun_no_project_fake_progress_columns
<!-- 默认快速流程只显示需求分析师、软件工程师和测试工程师，并按该顺序连接。 -->
ai_factory_default_quick_workflow_roles = REQUIREMENT_ANALYST_then_SOFTWARE_ENGINEER_then_TEST_ENGINEER
<!-- AI 工厂角色管理只允许三个工程角色、三个对应审核员和一个项目经理共七个业务角色。 -->
ai_factory_managed_business_role_set = REQUIREMENT_ANALYST|SOFTWARE_ENGINEER|TEST_ENGINEER|REQUIREMENT_REVIEWER|SOFTWARE_REVIEWER|TEST_QUALITY_REVIEWER|PROJECT_MANAGER
<!-- 固定角色树的三个结构节点不计入七个业务角色；集合外历史普通角色必须逻辑停用并保留历史引用含义。 -->
ai_factory_legacy_role_convergence = keep_ROLE_ROOT|ENGINEER_ROOT|REVIEWER_ROOT_soft_delete_other_business_roles_no_id_repurpose
<!-- 流程画布允许重复添加同一开发角色实例，用节点数量表达同类角色并行工作数量。 -->
ai_factory_repeated_role_node_policy = allowed_same_role_multiple_node_instances
<!-- AI 工厂管理页默认使用普通白底黑字主题，并由公共 Panel、Tree、Grid 组成。 -->
ai_factory_management_ui_structure = plain-minimal_selPanel_selTree_selGrid
<!-- AI 工厂管理树必须以项目为作用域，项目节点下固定承载规则管理、AI门禁、流程设计和执行进度，角色管理保持根级独立叶子；禁止退化为平铺功能菜单。 -->
ai_factory_project_scoped_management_tree = 项目管理_then_当前项目_then_规则管理|AI门禁|流程设计|执行进度_plus_root_角色管理_no_flat_navigation
<!-- 项目管理树的业务叶子不得显示无效下拉箭头，右侧表格必须限制合理内容宽度，禁止在宽屏上无限拉伸字段间距。 -->
ai_factory_management_tree_leaf_and_workspace_width = leaf_no_expand_control_workspace_content_width_bounded_no_viewport_stretch
<!-- AI 工厂每次打开默认使用 plain-minimal 浅色基础皮肤，不得把晶透、水晶、糖果或其他醒目主题设为默认。 -->
ai_factory_management_default_theme = plain-minimal_light_base
<!-- AI 工厂必须挂载统一个性化入口，用户可主动切换已登记主题，但页面刷新后仍回到普通极简默认值。 -->
ai_factory_management_theme_switching = personalization_available_user_initiated
<!-- AI 工厂主题入口旁必须保留顶部区域显示隐藏按钮，标题折叠后该按钮不得随之消失。 -->
ai_factory_header_visibility_control = persistent_next_to_theme_toggle_title_and_statistics_only
<!-- AI 工厂主题库统一登记普通极简、水晶科技、糖果冒险和晶透管理四套公共主题。 -->
ai_factory_management_theme_pack_set = plain-minimal_crystal-tech_candy-adventure_glass-admin
<!-- AI 工厂应用 CSS 仍必须消费 SEL 统一语义令牌，禁止用固定色值模拟白底黑字。 -->
ai_factory_management_theme_token_policy = sel_theme_tokens_only_no_application_hardcoded_color
<!-- AI 工厂 Remix 图标使用与既有管理页面一致的固定版本 jsDelivr 地址；SEL 公共本地图标资源不因本应用切换而删除。 -->
ai_factory_icon_resource = jsdelivr_remixicon_4_6_0_keep_shared_local_vendor_assets
<!-- AI 工厂默认极简视觉禁止发光、玻璃、水晶、动画背景和高辨识度装饰；该限制不覆盖用户主动切换后的主题。 -->
ai_factory_management_default_visual_attention_policy = no_glow_no_glass_no_crystal_no_animated_background_low_attention
<!-- AI 工厂所有业务 Key/Value 必须在 reference-data 选项组登记，业务表和页面只保存稳定 Key。 -->
ai_factory_reference_data_registration = required_for_role_type_gate_type_rule_type_workflow_node_edge_version_run_join_policy
<!-- AiRole.roleType 的稳定值统一登记在引用数据共享选项组，当前只包含工程师和审核员。 -->
ai_factory_role_type_reference_option_set = optionSet103006:ENGINEER|REVIEWER
<!-- AI 工厂运行时必须查询引用数据名称，禁止在页面复制工程师和审核员中文。 -->
ai_factory_role_type_display_source = reference_data_runtime_query_no_hardcoded_label
<!-- 节点运行审计必须记录起止时间、耗时、当前工作、本地日志路径和超时原因。 -->
ai_factory_node_run_audit_fields = startedAt_endedAt_elapsedMillis_currentWork_localLogPath_slowReason
<!-- 统一工作桌面必须通过显式模块配置把 AI 工厂控制面、API 和静态页面装配到8080。 -->
ai_factory_desktop_host_integration = required_on_platform_runtime_8080
<!-- Host 只导入 AI 工厂模块配置，不扫描或启动 AI 工厂独立 Spring Boot 入口。 -->
ai_factory_host_module_configuration = AiFactoryModuleConfiguration_excluding_AiFactoryBackendApplication
<!-- desktop 应用清单必须登记可见可用的 AI 工厂同源入口。 -->
ai_factory_desktop_manifest_entry = ai-factory_/aifactory/aifactory.html_visible_enabled
<!-- desktop 安全白名单必须显式允许 /aifactory/，禁止因清单登记而绕过同源路径校验。 -->
ai_factory_desktop_same_origin_allowlist = /aifactory/
<!-- ai-factory 静态资源目录固定无横线，文件名也使用 aifactory。 -->
ai_factory_static_resource_root = backend/src/main/resources/static/aifactory
<!-- 管理页面允许编辑和排序登记元数据，但不得启动 Agent、执行 Gate、审批或推进工作流。 -->
ai_factory_visualization_mode = controlled_registry_metadata_edit_no_agent_start_no_gate_execution_no_approval_no_workflow_transition
<!-- 角色表上下排序必须使用公共 Grid dragHandle 与 rowReorder，并一次提交完整主键顺序持久化 sortnum。 -->
ai_factory_role_reorder_contract = selGrid_dragHandle_rowReorder_complete_id_order_server_generated_sortnum
<!-- 角色类型、工程师和审核员三个节点只用于构造固定树，不得进入普通角色编辑、删除或排序。 -->
ai_factory_role_tree_structure = 角色类型_then_工程师|审核员_immutable_structure_nodes
<!-- 角色树到工程师和审核员分类为止，不继续展开具体角色；点击分类后由右表展示该类全部角色。 -->
ai_factory_role_tree_filter_behavior = category_leaf_without_dropdown_filters_grid_by_roleType
<!-- 分类筛选表继续保留排序和操作列，排序必须提交当前类型的全部角色主键才能保存。 -->
ai_factory_role_category_reorder = complete_current_roleType_id_order_required
<!-- 普通角色表的排序列必须位于操作列紧前方，保持编辑删除在最右侧。 -->
ai_factory_role_grid_column_order = role_fields_then_rowOrder_then_actions
<!-- 角色编辑必须使用公共 Window，只开放名称、引用数据角色类型、经验级别和专业范围。 -->
ai_factory_role_edit_contract = selWindow_roleName_reference_roleType_experienceLevel_specialty_only
<!-- Codex 连接池禁止由角色编辑窗口任意组合，必须继续从经验级别自动派生。 -->
ai_factory_role_edit_pool_derivation = EXPERIENCED:PERSISTENT_INEXPERIENCED:DISPOSABLE
<!-- 角色删除必须使用公共二次确认框，服务端执行根节点、子节点和Agent版本引用门禁后才能逻辑删除。 -->
ai_factory_role_delete_contract = selConfirmDialog_server_root_child_registered_version_guards_soft_delete
<!-- 公共Window主按钮禁用时必须使用统一禁用文字与底板令牌，禁止在浅色背景上保留白字。 -->
sel_window_disabled_primary_readability = semantic_disabled_text_and_control_surface_required

## 验证

<!-- 交付前必须验证双端禁止依赖、Agent登记解析顺序、每角色Agent绑定和受控管理边界。 -->
ai_factory_architecture_delivery_gate = dependency_scan_agent_resolution_contract_single_role_agent_binding_controlled_management_ui
<!-- 交付前必须扫描源码污染、跨 task_id 文件、非法中文名、绝对路径和符号链接逃逸。 -->
ai_factory_runtime_directory_delivery_gate = source_pollution_cross_task_invalid_name_absolute_path_symlink_escape_scan
<!-- 当前规则为架构与文档约束，尚无独立稳定程序入口，禁止调用方猜测执行器。 -->
python_ability_refs = none
<!-- 当前规则不由 Java 自动修改或执行。 -->
java_ability_refs = none
<!-- 当前规则无 Node 能力。 -->
node_ability_refs = none
