# AI Desktop Harness 工作区与运行时规则

<!-- 5.111.0 要求人物长期 Codex 连接的授权与提问进入现有全局交互路由。 -->
rule_version = 5.111.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 本职责没有独立 Java 能力入口。 -->
java_ability_refs = none
<!-- 本职责没有独立 Python 能力入口。 -->
python_ability_refs = none
<!-- 本职责没有独立 Node 能力入口。 -->
node_ability_refs = none

<!-- 本职责分片延续官方 Harness 聚合规则作用域，供依赖闭包加载与审计识别。 -->
rule_scope = selplat/application/ai-desktop/official_harness
<!-- AI Desktop 只维护 Developer 产品线；启动、构建、打包、运行时契约、样式、文档和测试不得重新引入第二产品变体。 -->
desktop_product_variant_contract = developer_only + no_secondary_variant_entry_or_artifact
<!-- AI Desktop 只维护 Developer 产品线并使用公共开发工作台深色主题；应用 CSS 只维护布局和应用独有几何。 -->
sel_ui_theme_variant_contract = developer_uses_developer_workbench_dark + application_css_layout_only
<!-- React 必须在首次渲染前完成主题属性装配，避免首帧闪烁和组件读取到错误主题。 -->
sel_ui_react_host_contract = apply_theme_state_before_createRoot + root_theme_mode_accent_density_attributes
<!-- Node/Electron 只从正式包出口导入公共主题，SEL UI 为构建期依赖，安装包不得携带其源码目录。 -->
sel_ui_node_delivery_contract = formal_package_exports_only + build_time_dependency + bundled_used_css_only + prohibit_sel_ui_source_in_installer
<!-- 基础令牌必须由宿主通过正式 Node 出口直接加载并位于合同和主题包之前，嵌套 CSS import 不得成为唯一生产加载链。 -->
sel_ui_base_token_loading_contract = formal_theme_tokens_export + host_loads_tokens_before_contract_and_theme_packs + nested_css_import_not_only_runtime_path + runtime_computed_token_visual_verification

<!-- 唯一上游实现固定为 OpenAI 官方 Codex 仓库；业务含义是禁止接入来源不明的二次封装替代核心 harness。 -->
official_codex_upstream_repository = https://github.com/openai/codex.git
<!-- 桌面富交互必须通过官方 app-server JSONL 协议接入；业务含义是能够获得线程、回合、事件、认证和审批完整生命周期。 -->
desktop_codex_harness_interface = codex_app_server_stdio_jsonl
<!-- 应用依赖必须直接锁定 @openai/codex，并让协议版本与实际本地二进制一致。 -->
desktop_codex_runtime_dependency = pinned_direct_@openai/codex

<!-- ChatGPT 账号登录必须调用 account/login/start 的 chatgpt 浏览器流程，禁止收集、代理或硬编码用户账号密码。 -->
chatgpt_login_flow = account_login_start_chatgpt_browser_oauth
<!-- OAuth 回调、令牌保存和刷新由官方 Codex harness 管理，渲染进程不得读取认证令牌。 -->
chatgpt_token_ownership = official_codex_harness_only
<!-- 登录地址只允许系统浏览器打开官方 HTTPS 域名，禁止渲染任意 harness 返回地址。 -->
chatgpt_login_url_allowlist = https_chatgpt.com_or_auth.openai.com

<!-- app-server 必须在 Electron 主进程内以无 Shell 的子进程启动，并通过安全 IPC 向渲染进程暴露最小白名单。 -->
harness_process_and_renderer_boundary = electron_main_process_no_shell_spawn_plus_context_isolated_ipc_allowlist
<!-- 默认和工作区写入模式都必须保留官方 on-request 审批，禁止将 approvalPolicy 固定为 never；项目精确信任只是在官方请求到达后由桌面端按用户既有授权自动答复。 -->
harness_execution_approval_policy = on_request_never_bypass
<!-- 桌面端必须显式指定用户审查器，禁止继承全局 auto_review 后由自动审查器代替 UI 用户作出允许。 -->
harness_approvals_reviewer = user_never_inherit_auto_review
<!-- 文件修改与首次命令请求必须显示真实原因、命令或变更信息；符合精确信任条件的后续同一命令可按用户既有授权自动允许。 -->
harness_approval_ui_requires = reason + command_or_file_change_details + explicit_first_accept_or_decline + exact_trusted_command_auto_response
<!-- 韩立、南宫婉及其调查连接不得丢弃待授权事件；局部请求 ID 映射为全局唯一 ID，并在现有弹窗标明真实人物。 -->
persona_harness_interaction_routing_contract = every_long_lived_persona_conversation_and_inquiry_codex_connection_registered + globally_unique_request_id_mapping + existing_approval_and_structured_input_dialogs + owner_persona_projection + no_discarded_pending_request
<!-- 点击普通项目命令的允许按钮等价于允许并信任；信任只绑定真实项目根、cwd、逐字命令和 npm/pnpm/yarn 脚本正文签名，任何一项变化都重新审批。 -->
trusted_project_command_identity_contract = explicit_allow_and_trust + electron_userData_persistence + exact_project_root_cwd_command_and_package_script_signature + changed_identity_requires_new_approval
<!-- 删除、提权、权限扩张、破坏 Git 状态和文件变更请求永不进入命令信任；设置必须显示登记数量、支持确认后统一清除，并记录首次信任与自动允许业务日志。 -->
trusted_project_command_safety_and_management_contract = destructive_privileged_permission_or_git_state_command_always_review + file_change_never_trusted_as_command + settings_count_and_confirmed_clear + audit_trusted_and_auto_allowed
<!-- 未实现的权限、动态工具或结构化请求不得被隐式接受；业务含义是未知能力默认保持最小权限。 -->
unsupported_harness_server_request_policy = deny_or_cancel_without_permission_expansion
<!-- 固定诊断与路径解析只能读取已准备的依赖缓存；链接修复、迁移和共享缓存写入必须限定在显式准备阶段，禁止普通 paths:resolve 或类型检查反复改写工程外缓存并触发权限审批。 -->
dependency_cache_mutation_boundary_contract = diagnostics_and_paths_resolve_read_prepared_cache_only + repair_migrate_and_symlink_write_in_explicit_prepare_stage_only + no_shared_cache_mutation_during_typecheck_or_fixed_diagnostics + permission_request_visible_waiting_state + no_false_running_while_human_authorization_pending
<!-- node_modules 只能是本机临时链接且必须被 Git 忽略；任何准备、迁移或挂载动作都要先通过未跟踪门禁，防止跨平台绝对链接在 pull 时清理共享源码。 -->
dependency_link_version_control_safety_contract = source_node_modules_never_tracked + exact_gitignore_entry_without_directory_only_trailing_slash_so_file_directory_and_symlink_are_all_ignored + prepare_migrate_attach_verify_untracked_before_mutation + reject_cross_platform_absolute_link_from_repository + shared_local_package_source_never_deleted_by_dependency_link_cleanup
<!-- 所有开发人物、任务验证、集成验证和令狐统一测试必须复用同一受控依赖租约；缓存根由 Git 公共仓库反向验证，禁止信任环境传入任意路径。 -->
managed_worktree_dependency_lease_contract = main_process_prepares_and_releases_link + all_developer_executor_task_test_integration_and_linghu_routes_share_one_contract + lease_environment_contains_identifier_only + source_root_derived_from_registered_git_common_directory + worktree_and_source_lock_hash_equal + exact_shared_cache_link_target + source_build_temp_and_evidence_remain_worktree_isolated + inner_command_read_only_consumes_lease + no_test_task_id_dependency_bypass + release_link_never_delete_shared_cache

<!-- 新会话、发送任务、中止任务、账号读取、登录和退出必须由同一长期运行 app-server 连接完成。 -->
harness_required_lifecycle = initialize + account + thread + turn + interrupt + logout
<!-- AI Desktop 只保留一个当前官方持久线程；渲染刷新或 Electron 重建后必须从 userData 读取线程 ID 并 thread/resume，同一工作区下托管阶段造成的沙箱变化继续复用；用户点新建任务时必须 thread/delete 并清除本地正文，不提供历史列表。 -->
harness_active_thread_lifecycle_contract = one_current_official_persistent_thread + electron_userData_active_thread_id + renderer_local_transcript + thread_resume_after_renderer_or_electron_reconstruction + reuse_across_managed_stage_sandbox_changes + explicit_new_task_thread_delete_confirmed_before_clear_local_transcript + delete_or_resume_failure_preserves_recovery_state + lazy_start_on_next_send + no_application_history_list
<!-- 主会话和全部协同连接必须共用 Electron userData 下的应用专属 CODEX_HOME；运行时探测与 app-server 启动使用同一环境，并删除宿主注入的 Codex Desktop 来源覆盖，禁止再读写默认 ~/.codex。 -->
harness_storage_domain_isolation_contract = electron_userData_ai_desktop_codex_home + main_and_collaboration_share_same_isolated_domain + runtime_probe_and_app_server_use_same_environment + remove_inherited_CODEX_INTERNAL_ORIGINATOR_OVERRIDE + never_use_default_codex_home_for_new_threads
<!-- 旧版会话凭据只允许按当前会话文件中保存的单个线程 ID 回到旧默认数据域删除；成功后才清空并写入带 ai-desktop 数据域标记的新版本，禁止扫描或批量删除 Codex App 其他会话。 -->
harness_legacy_session_migration_contract = version_1_saved_active_thread_only + old_default_domain_thread_delete_by_exact_id + clear_only_after_confirmed_delete + preserve_credential_on_failure + version_2_ai_desktop_storage_domain_marker + no_scan_or_bulk_delete
<!-- serviceName 和 threadSource 只用于事件审计与分析分类，不得替代 CODEX_HOME 的物理存储隔离。 -->
harness_thread_metadata_contract = explicit_ai_desktop_serviceName_and_threadSource + audit_only_never_storage_isolation
<!-- 回复语言属于线程级开发约束，必须通过 developerInstructions 传递；用户正文只能包含真实任务、工作区上下文和附件，且真实任务必须位于首段，禁止内部上下文形成重复自动标题。 -->
harness_user_input_purity_contract = response_language_in_developerInstructions + user_text_contains_real_task_workspace_context_and_attachments_only + real_task_before_workspace_context + no_language_or_internal_context_template_in_first_user_message_or_thread_preview
<!-- developerInstructions 必须要求结论先行、自然协作、按复杂度组织 Markdown，禁止机械复述阶段名、规则和固定模板。 -->
harness_natural_response_style_contract = locale_aware_natural_clear_language + outcome_first + thoughtful_collaborator_tone + concise_for_simple_tasks + structured_markdown_for_complex_tasks + no_mechanical_stage_rule_or_template_repetition
<!-- 托管阶段仍由程序状态机和命令门禁强制执行；提示中的职责必须位于真实用户消息之后并标记为内部边界，禁止变成回答标题、开场白或固定复述。 -->
managed_responsibility_and_response_separation_contract = real_user_message_first + internal_responsibility_after_user_message + never_echo_internal_contract_or_stage_label + ordinary_question_direct_answer + natural_complete_intent_summary_only_when_confirmation_is_needed + managed_status_rendered_separately + state_machine_sandbox_command_and_test_gates_unchanged
<!-- 助手回复使用安全 GFM；禁止原始 HTML，外部链接只允许经主进程校验的 HTTP 或 HTTPS，用户原文继续按纯文本显示。 -->
harness_markdown_rendering_contract = react_markdown_plus_gfm + raw_html_disabled + main_process_validated_http_https_external_links + readable_dark_theme_headings_lists_quotes_code_tables + user_messages_plain_text
<!-- 0.149.0 的 thread/start sandbox 使用短横线枚举；共享白名单值可以原样传递，禁止改写为旧驼峰值。 -->
harness_sandbox_mapping = read-only_to_read-only + workspace-write_to_workspace-write
<!-- 设置面板属于临时浮层；外部点击和 Escape 必须关闭，内部操作保持打开，且不得替用户处理审批弹窗。 -->
settings_panel_dismissal_contract = outside_pointer_or_escape_closes + inside_interaction_stays_open + approval_dialog_isolated

<!-- 工作区登记必须由 Electron 主进程系统目录选择器完成并校验真实绝对目录；渲染层只能传工作区 ID，禁止提交任意路径。 -->
workspace_registration_security = main_process_directory_picker + real_absolute_existing_directory + renderer_id_only
<!-- 文件系统根和用户主目录范围过宽，不允许直接登记为工作区；新登记目录默认允许工作区写入。 -->
workspace_registration_default_and_broad_path_guard = new_root_workspace_write + reject_filesystem_root_and_home
<!-- 旧版未登记默认权限版本的配置只迁移一次到工作区写入；写入版本标记后必须保留用户后续手动切换的只读状态。 -->
workspace_permission_default_migration_contract = legacy_profile_without_permission_defaults_version_migrates_once_to_workspace_write + persist_permission_defaults_version + preserve_later_manual_read_only
<!-- 多工作区配置属于本机用户运行数据，必须持久化到 Electron userData，禁止写入工程源码或修改官方 harness。 -->
workspace_registry_storage = electron_userData_json_not_project_source_or_harness_source
<!-- 左侧工作区使用可同时展开多个面板的 Accordion；每个根独立展示真实路径、目录项、主目录和权限。 -->
workspace_accordion_contract = multiple_independent_expansion + real_entries + primary_marker + per_root_permission
<!-- 权限按钮必须和项目名称同行并始终可见；只读使用填充高亮，写入使用常规弱化图标，点击双向切换且提示当前状态，展开区不得重复权限下拉框。 -->
workspace_header_permission_control_contract = always_visible_permission_icon + workspace_write_regular_dim + read_only_filled_highlight + two_way_toggle + dynamic_tooltip + no_duplicate_expanded_select
<!-- 当前主目录星标始终显示且不可重复点击；未选主目录星标与删除按钮仅在行悬停或键盘聚焦时显示，唯一工作区的删除按钮必须禁用并说明原因。 -->
workspace_header_secondary_action_visibility_contract = active_primary_star_always_visible_and_disabled + inactive_primary_star_hover_or_focus_only + delete_hover_or_focus_only + one_root_delete_disabled_with_reason
<!-- 权限、主目录和删除图标必须在悬停或键盘聚焦时立即显示可读 Tip，文字反映当前状态或禁用原因，并同步无障碍名称。 -->
workspace_header_action_tooltip_contract = permission_primary_delete_icons + immediate_hover_or_keyboard_focus_tip + dynamic_current_state_or_disabled_reason + matching_accessible_name
<!-- 权限图标提示只表达当前状态，中文固定为“当前只读”或“当前可写入”，禁止在窄侧栏展示操作说明长句。 -->
workspace_permission_tooltip_copy_contract = concise_current_state_only + zh_current_read_only_or_current_writable + no_instruction_sentence_in_narrow_sidebar
<!-- 从登记列表移除工作区前必须显示包含目录名称的确认提示；取消不改变登记，确认只移除登记信息，禁止删除磁盘真实目录。 -->
workspace_removal_confirmation_contract = named_workspace_confirmation_before_remove + decline_preserves_registry + accept_removes_registry_only + never_delete_real_directory
<!-- 主目录作为 Codex 回合 cwd；全局只读优先，工作区写入时只把已登记且显式标记可写的目录传给官方 writableRoots。 -->
workspace_harness_sandbox_mapping = primary_root_to_turn_cwd + global_read_only_overrides + registered_workspace_write_roots_to_turn_start_sandboxPolicy_writableRoots
<!-- 没有任何显式可写根时禁止发送空 workspaceWrite 集合，必须降级为 readOnly，防止官方兼容逻辑把 cwd 恢复为默认可写。 -->
workspace_empty_writable_roots_policy = force_readOnly_never_implicit_cwd_write
<!-- 工作区清单或权限变化后必须开启匹配新签名的线程，防止旧线程继续沿用过期授权范围。 -->
workspace_permission_change_thread_policy = workspace_signature_change_requires_new_thread
<!-- 候选工作树只承载待测源码；所有测试数据、缓存、日志、临时材料和证据必须由所选工作区根统一解析，禁止从脚本或候选源码位置反推。 -->
selected_workspace_test_data_root_contract = selected_workspace_root_single_facade + explicit_SELPLAT_ROOT_or_registered_primary_workspace + candidate_worktree_source_root_code_only + OPTION_cache_log_temp_evidence_and_build_under_selected_workspace + no_import_meta_url_or_test_location_data_root_inference + reject_any_data_path_under_collaboration_worktrees + missing_or_invalid_workspace_reports_工作区中没有工程请添加工程 + logical_workspace_relative_path_in_UI_and_report + source_and_data_root_boundary_tests
<!-- 开发版关键导航、工作区树、控件、聊天正文和上下文值使用桌面 IDE 可读字号，禁止关键内容落入 10 至 11 像素微缩文字。 -->
developer_typography_readability_contract = critical_text_13_to_15_css_px + matching_row_height + no_critical_10_to_11_px
<!-- Windows 开发版启动器必须先正式构建，再由 Electron 加载本地 renderer 文件；禁止 Vite HTTP、localhost 开发端口、环境 URL 注入和热重启监视器进入桌面启动链。 -->
developer_local_file_start_contract = developer_bat_builds_current_runtime_then_electron_loads_local_renderer_file + no_vite_http_server + no_localhost_development_port + no_VITE_DEV_SERVER_URL + no_hot_restart_monitor
<!-- 开发版工作区和任务标题必须保持真实折叠状态，且打开其中一个时只允许该分区展开。 -->
developer_sidebar_section_disclosure_contract = explorer_workspace_and_tasks_titles_toggle_visible_content
<!-- 工作区与任务标题必须回显真实的无障碍展开状态。 -->
developer_sidebar_section_disclosure_contract.2 = aria_expanded_state
<!-- 工作区与任务只允许一个活动分区。 -->
developer_sidebar_section_disclosure_contract.3 = workspace_tasks_single_active
<!-- 新建任务入口位于 SELUI 页签栏同行的会话操作区，悬停与键盘聚焦必须显示本地化的“重新建立一个 Codex 会话”Tip，任务标题不得保留重复入口。 -->
developer_sidebar_section_disclosure_contract.4 = refresh_conversation_action_beside_selui_tabs_with_localized_rebuild_session_tip
<!-- 新建任务动作禁止额外单独占用一行。 -->
developer_sidebar_section_disclosure_contract.5 = no_separate_full_width_new_task_row
<!-- 资源管理器总开关必须收起整个网格列并释放聊天宽度；活动栏文件图标始终保留恢复入口，内部工作区展开状态不得被重置。 -->
developer_explorer_full_column_collapse_contract = title_or_activity_icon_toggle + explorer_grid_column_zero_when_collapsed + hide_entire_explorer + chat_and_composer_expand + activity_icon_restores + preserve_workspace_disclosure_state
<!-- 侧栏只保留资源管理器右边界的宽度调节，工作区和任务不再通过分隔器分配高度。 -->
developer_sidebar_resizer_contract = explorer_right_edge_pointer_and_keyboard_width_resize
<!-- 资源管理器宽度调节支持恢复标准宽度。 -->
developer_sidebar_resizer_contract.2 = reset_to_standard_explorer_width
<!-- 工作区和任务之间禁止继续显示高度分隔器。 -->
developer_sidebar_resizer_contract.3 = no_workspace_tasks_height_divider
<!-- 活动侧栏分区必须排在顶部并占满扣除其他标题后的高度，非活动分区只在底部保留标题入口。 -->
developer_sidebar_active_section_layout_contract = active_section_top_and_fill_available_height
<!-- 非活动侧栏分区只在底部保留标题入口。 -->
developer_sidebar_active_section_layout_contract.2 = inactive_section_heading_only_at_bottom

<!-- 人物和任务使用正式 SELUI 多页签，关闭只影响视图，不能停止或删除后台工作。 -->
developer_workspace_tabs_contract = formal_selTabs_component_and_styles + stable_persona_and_task_ids + repeated_navigation_focuses_existing_tab + mounted_inactive_pages_preserve_input_scroll_and_messages + working_close_button_and_keyboard + neighbor_selected_on_close + close_never_cancels_task_or_deletes_history + no_private_fake_tab
