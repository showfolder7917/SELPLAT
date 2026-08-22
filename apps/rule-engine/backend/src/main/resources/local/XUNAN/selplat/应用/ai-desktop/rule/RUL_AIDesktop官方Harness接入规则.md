# AI Desktop 官方 Harness 接入规则

<!-- 本规则由应用 Electron/TypeScript 源码直接实现，不建立 Java 能力。 -->
java_ability_refs = none
<!-- 本规则没有独立 Python 自动化职责，不建立空能力入口。 -->
python_ability_refs = none
<!-- 官方 harness 适配属于应用生产源码，不是 rule-engine Node 能力，因此不伪造 ability ID。 -->
node_ability_refs = none
<!-- 真实应用程序入口固定为 Electron 主进程服务，供规则核对调用方和验证路径。 -->
application_program_path = apps/ai-desktop/electron/services/codex-service.ts
<!-- 5.14.0 以固定签名外壳加载最新外部构建，避免每次开发启动令 TCC 授权失效。 -->
rule_version = 5.14.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 当前规则已经登记到 SELPLAT 应用索引。 -->
rule_status = active
<!-- 升级记录同时保留首次接入与真实统一测试发现的协议修复。 -->
upgrade_record = 2026-08-21:接入openai_codex_app_server与ChatGPT浏览器OAuth并逐次审批;2026-08-21:按0.146.0使用短横线sandbox枚举并固定approvalsReviewer为user防止全局auto_review静默代审;2026-08-21:Windows开发包固定x64并显式携带0.146.0_win32_x64平台别名包;2026-08-21:旧应用名整体迁移为ai-desktop并同步规则逻辑ID与路径;2026-08-22:设置浮层增加外部点击与Escape关闭且内部交互和审批弹窗隔离;2026-08-22:新增真实多工作区Accordion_用户数据持久化_逐根权限_turn_start_writableRoots;2026-08-22:开发版关键文字统一提升至桌面IDE可读密度;2026-08-22:新增区域截图_红色标注_应用temp统一清理_官方localImage发送;2026-08-22:截图编辑层改为临时全屏并在完成取消后恢复主窗口;2026-08-22:长会话增加独立滚动区_可见滚动条_新消息自动定位;2026-08-22:官方app_server文字delta_计划_命令_文件变更真实流式回显;2026-08-22:详细执行过程默认折叠_折叠栏保留项数与当前步骤;2026-08-22:支持Ctrl_Command_V粘贴系统截图_temp统一落盘_localImage发送;2026-08-22:截图选区确定_默认方框_标注确定入对话框;2026-08-22:截图按钮点击即框选_冻结画面蒙版_选择阶段无工具栏;2026-08-22:截图层无动画覆盖屏幕_选区确定旁取消_Escape恢复窗口;2026-08-22:独立无边框截图窗口_主窗口尺寸不变_安全附件回传;2026-08-22:截图窗口绘制完成后再显示_独立主题变量保证操作按钮可读;2026-08-22:标注窗口按截图尺寸自适应_可拖动缩放最大化;2026-08-22:截图一比一无边框_松开自动标注_返回重选_完成回填调查提示_隐藏主窗截图_清空标注确认;2026-08-22:隐藏截图先转圈预热_准备成功后隐藏;2026-08-22:修复macOS微型缩略图空值造成的预热权限误判;2026-08-22:截图窗体后台就绪后最后隐藏主窗口并替换真实背景;2026-08-22:常驻复用截图壳_一次权限预热_每轮单次最新真实抓屏;2026-08-22:双截图入口统一长期桌面流_隐藏后按新视频帧冻结;2026-08-22:macOS简单全屏蒙版覆盖菜单栏与Dock_透明缓存不抢焦点
<!-- 4.3.0 补充同图多标注及跟随完成、取消的稳定交互升级记录。 -->
upgrade_record_4_3 = 2026-08-22:同图连续红框_跟随完成全部或取消最新标注
<!-- 4.4.0 补充工作区权限、主目录和删除操作的稳定可见性约束。 -->
upgrade_record_4_4 = 2026-08-22:工作区权限图标同行常显_只读点亮_默认写入_主目录与删除按状态显隐
<!-- 4.5.0 补充旧配置一次性迁移和后续手动只读不被覆盖的约束。 -->
upgrade_record_4_5 = 2026-08-22:旧工作区默认迁移为写入_锁图标默认不点亮_手动只读持续保存
<!-- 4.6.0 补充同行图标即时状态提示和键盘聚焦可见性约束。 -->
upgrade_record_4_6 = 2026-08-22:权限_主目录_删除图标即时Tip_状态动态文字_键盘聚焦可见_删除前确认
<!-- 4.7.0 将权限提示收敛为简短状态词，避免遮挡工作区树。 -->
upgrade_record_4_7 = 2026-08-22:权限Tip固定为当前只读或当前可写入
<!-- 4.8.0 补充开发版侧栏分区折叠与任务入口定位约束。 -->
upgrade_record_4_8 = 2026-08-22:资源管理器与工作区标题可折叠_新建任务固定在任务标题右侧
<!-- 4.9.0 补充整栏折叠、任务事实链和部分完成自动诊断约束。 -->
upgrade_record_4_9 = 2026-08-22:资源管理器整栏折叠_活动栏恢复_业务事件时间线_任务摘要_部分完成原因码_设置打开日志目录
<!-- 5.0.0 补充任务托管与测试托管的职责、门禁和受控重启边界。 -->
upgrade_record_5_0 = 2026-08-22:任务托管停在代码级验证_测试托管独立构建复测_必要时单次受控重启_禁止自动串联
<!-- 5.1.0 补充同一回复卡内按回合追加并局部校准文本的约束。 -->
upgrade_record_5_1 = 2026-08-22:托管多轮回答按序保留_完成事件仅校准当前轮_最终响应禁止覆盖历史轮次
<!-- 5.2.0 补充四阶段授权状态机、独立 1 等价跳转和可重复操作按钮。 -->
upgrade_record_5_2 = 2026-08-22:会话托管默认_需求只读分析_确认后任务执行_确认后测试_按钮图标文字_点击后高亮重命名_独立1逐级推进
<!-- 5.3.0 补充开发侧栏双分隔器和默认空间分配约束。 -->
upgrade_record_5_3 = 2026-08-22:资源管理器右边界拖拽调宽_工作区任务分隔线拖拽调高_默认工作区占满剩余高度_键盘无障碍调整
<!-- 5.4.0 补充任务区折叠、单分隔线和后台交互测试失败修复闭环。 -->
upgrade_record_5_4 = 2026-08-22:任务标题真实折叠_单一1px视觉分隔线_Playwright后台隔离Electron交互测试_失败截图进应用temp_最多五轮修复复测
<!-- 5.5.0 补充截图固定完成入口和 requestUserInput 逐题确认约束。 -->
upgrade_record_5_5 = 2026-08-22:无红色标注也可固定完成_仅有标注时追加红色部分提示_requestUserInput逐题选项确认_继续原Harness回合_答案后重新输出完整意图
<!-- 5.6.0 补充首次允许后的项目内精确信任与渲染、主进程分层热更新约束。 -->
upgrade_record_5_6 = 2026-08-22:允许并信任当前项目精确命令_危险命令继续逐次审批_设置可统一清除信任_开发版渲染HMR_主进程预加载共享代码自动重启
<!-- 5.7.0 防止 AI Desktop 内部会话进入官方 Codex 任务列表并污染自动标题。 -->
upgrade_record_5_7 = 2026-08-22:thread_start_ephemeral不落盘_语言约束进入developerInstructions_用户正文只保留工作区上下文和真实任务_同进程按配置复用
<!-- 5.8.0 依据用户确认，以跨重建恢复当前任务和显式新建即丢弃替代临时线程。 -->
upgrade_record_5_8 = 2026-08-22:单一活动持久线程_thread_resume跨重建恢复_新建任务thread_delete丢弃_本地正文同步恢复_安全GFM渲染_自然协作表达
<!-- 5.9.0 依据用户确认，让每个疑问单独确认并保持最新阶段按钮在运行期间可见但不可操作。 -->
upgrade_record_5_9 = 2026-08-22:默认模式requestUserInput_单次一个最高优先级疑问_疑问旁确认_多题容错完整回传_最新阶段按钮运行中可见禁用_历史按钮不可推进
<!-- 5.10.0 防止旧二进制读取新模型缓存时因协议字段不一致而退出。 -->
upgrade_record_5_10 = 2026-08-22:每次Harness连接重新探测本机Codex_优先匹配models_cache_client_version_无精确匹配时选最高有效本机版本_仅无本机可用时回退应用锁定包_界面与审计显示实际来源路径版本
<!-- 5.11.0 依据用户确认，阻断 macOS 双击开发版时继续使用过期构建产物。 -->
upgrade_record_5_11 = 2026-08-22:macOS开发版command双击启动_依赖检查_先正式构建最新开发版_构建失败禁止启动
<!-- 5.12.0 防止 macOS 屏幕录制权限异常泄露 Electron 原始 IPC 错误。 -->
upgrade_record_5_12 = 2026-08-22:macOS截图权限状态预检_结构化错误码_中日文恢复提示_固定系统设置入口
<!-- 5.13.0 依据用户确认，把本轮七项返工收敛为可复用的统一执行契约。 -->
upgrade_record_5_13 = 2026-08-22:执行期截图粘贴与排队发送_卡片边界收缩_终态防晚到覆盖_亮点生命周期_逐回合分段_共享测试锁与即时归档_固定AI_Desktop应用身份
<!-- 5.14.0 修复同名 AI Desktop 开关开启但临时签名每次变化导致系统仍判定未授权。 -->
upgrade_record_5_14 = 2026-08-22:固定签名Bootstrap外壳_普通源码构建只加载仓库最新外部产物_身份输入变化才重新打包签名_重新签名后明确提示刷新权限

<!-- 问题：直接调用模型 API、一次性 SDK 或自制认证会丢失 Codex 会话事件、ChatGPT 账号能力和官方审批边界。 -->
<!-- 场景：SELPLAT 的 ai-desktop 开发版接入、升级或调用 Codex。 -->
<!-- 业务含义：桌面 UI 只作为可信客户端，真正的 Codex 会话、认证和执行协议由官方 harness 承担。 -->
rule_scope = selplat/application/ai-desktop/official_harness

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
<!-- 点击普通项目命令的允许按钮等价于允许并信任；信任只绑定真实项目根、cwd、逐字命令和 npm/pnpm/yarn 脚本正文签名，任何一项变化都重新审批。 -->
trusted_project_command_identity_contract = explicit_allow_and_trust + electron_userData_persistence + exact_project_root_cwd_command_and_package_script_signature + changed_identity_requires_new_approval
<!-- 删除、提权、权限扩张、破坏 Git 状态和文件变更请求永不进入命令信任；设置必须显示登记数量、支持确认后统一清除，并记录首次信任与自动允许业务日志。 -->
trusted_project_command_safety_and_management_contract = destructive_privileged_permission_or_git_state_command_always_review + file_change_never_trusted_as_command + settings_count_and_confirmed_clear + audit_trusted_and_auto_allowed
<!-- 未实现的权限、动态工具或结构化请求不得被隐式接受；业务含义是未知能力默认保持最小权限。 -->
unsupported_harness_server_request_policy = deny_or_cancel_without_permission_expansion

<!-- 新会话、发送任务、中止任务、账号读取、登录和退出必须由同一长期运行 app-server 连接完成。 -->
harness_required_lifecycle = initialize + account + thread + turn + interrupt + logout
<!-- AI Desktop 只保留一个当前官方持久线程；渲染刷新或 Electron 重建后必须从 userData 读取线程 ID 并 thread/resume，同一工作区下托管阶段造成的沙箱变化继续复用；用户点新建任务时必须 thread/delete 并清除本地正文，不提供历史列表。当前活动线程在删除前可能出现在官方 Codex 任务存储中。 -->
harness_active_thread_lifecycle_contract = one_current_official_persistent_thread + electron_userData_active_thread_id + renderer_local_transcript + thread_resume_after_renderer_or_electron_reconstruction + reuse_across_managed_stage_sandbox_changes + explicit_new_task_thread_delete_confirmed_before_clear_local_transcript + delete_or_resume_failure_preserves_recovery_state + lazy_start_on_next_send + no_application_history_list + active_thread_may_exist_in_official_task_storage_until_deleted
<!-- 回复语言属于线程级开发约束，必须通过 developerInstructions 传递；用户正文只能包含工作区上下文、真实任务和附件，禁止把语言模板放在首段形成重复自动标题。 -->
harness_user_input_purity_contract = response_language_in_developerInstructions + user_text_contains_workspace_context_and_real_task_only + no_language_template_in_first_user_message_or_thread_preview
<!-- developerInstructions 必须要求结论先行、自然协作、按复杂度组织 Markdown，禁止机械复述阶段名、规则和固定模板。 -->
harness_natural_response_style_contract = locale_aware_natural_clear_language + outcome_first + thoughtful_collaborator_tone + concise_for_simple_tasks + structured_markdown_for_complex_tasks + no_mechanical_stage_rule_or_template_repetition
<!-- 助手回复使用安全 GFM；禁止原始 HTML，外部链接只允许经主进程校验的 HTTP 或 HTTPS，用户原文继续按纯文本显示。 -->
harness_markdown_rendering_contract = react_markdown_plus_gfm + raw_html_disabled + main_process_validated_http_https_external_links + readable_dark_theme_headings_lists_quotes_code_tables + user_messages_plain_text
<!-- 0.146.0 的 thread/start sandbox 使用短横线枚举；共享白名单值可以原样传递，禁止改写为旧驼峰值。 -->
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
<!-- 开发版关键导航、工作区树、控件、聊天正文和上下文值使用桌面 IDE 可读字号，禁止关键内容落入 10 至 11 像素微缩文字。 -->
developer_typography_readability_contract = critical_text_13_to_15_css_px + matching_row_height + no_critical_10_to_11_px
<!-- Windows 开发版启动器必须进入热开发链路：React/CSS 由 Vite HMR 即时更新，Electron 主进程、preload 和 shared 编译变化由监视器自动重启；正式构建与静态启动命令保持独立。 -->
developer_hot_start_contract = developer_bat_uses_vite_hmr_plus_typescript_watch_plus_electron_process_monitor + renderer_change_without_app_restart + main_preload_shared_change_auto_restarts_electron + formal_build_and_static_start_unchanged
<!-- 开发版资源管理器、工作区和任务分区标题必须提供真实折叠交互和可读展开状态；新建任务作为标题级动作固定在任务标题右侧，禁止再单独占用一行。 -->
developer_sidebar_section_disclosure_contract = explorer_workspace_and_tasks_titles_toggle_visible_content + aria_expanded_state + new_task_action_in_tasks_title_right + no_separate_full_width_new_task_row
<!-- 资源管理器总开关必须收起整个网格列并释放聊天宽度；活动栏文件图标始终保留恢复入口，内部工作区展开状态不得被重置。 -->
developer_explorer_full_column_collapse_contract = title_or_activity_icon_toggle + explorer_grid_column_zero_when_collapsed + hide_entire_explorer + chat_and_composer_expand + activity_icon_restores + preserve_workspace_disclosure_state
<!-- 资源管理器右边界和工作区任务分隔线必须可拖拽且可用键盘调整；默认让工作区占满任务标题上方的剩余高度。 -->
developer_sidebar_dual_resizer_contract = explorer_right_edge_pointer_and_keyboard_width_resize + workspace_tasks_divider_pointer_and_keyboard_height_resize + reset_to_standard_explorer_width + default_workspace_fills_remaining_height_above_tasks
<!-- 工作区与任务区边界只允许一个分隔器负责视觉线；业务含义是保留易拖拽热区但禁止边框叠加成粗线。 -->
developer_sidebar_single_divider_contract = one_workspace_tasks_separator + five_css_px_pointer_hit_area + one_css_px_visual_line + no_neighbor_duplicate_border
<!-- 业务日志只落到应用 log 目录；原始事件时间线追加写，任务摘要原子覆盖，完整关联回合、审批、命令、文件和完成状态，但禁止保存认证秘密或原始推理。 -->
business_audit_log_contract = apps_ai_desktop_log_only + append_only_jsonl_timeline + atomic_per_task_summary + request_workspace_sandbox_turn_approval_command_changed_files_completion_correlation + no_auth_secret_or_raw_reasoning
<!-- 部分完成诊断必须根据真实 Harness 状态、命令开始完成与退出码、文件变更、构建测试观察和源码产物时间自动生成可检索原因码。 -->
partial_completion_diagnosis_contract = harness_failed_or_interrupted + command_completion_and_exit_code + changed_files + build_or_validation_observation + source_vs_bundle_mtime + explicit_reason_codes
<!-- 设置面板必须显示最近任务状态和原因数量，并提供直接打开日志目录的入口。 -->
business_audit_log_ui_contract = settings_latest_task_status_and_reason_count + visible_reason_messages + open_log_directory
<!-- 托管执行必须按会话、需求、任务、测试四阶段推进，默认只理解意图，任何阶段不得自动越过下一次用户确认。 -->
managed_execution_mode_split_contract = conversation_managed_default + requirement_managed_read_only_analysis + task_managed_code_level_validation + test_managed_build_post_build_test_optional_single_restart + no_automatic_stage_skipping
<!-- 任务托管负责源码修改、静态检查和后台隔离 Electron 交互测试；失败证据进入应用 temp 并最多自动修复复测五轮，完成点固定为代码级验证。 -->
task_managed_completion_contract = analysis_source_change + static_check + hidden_isolated_electron + playwright_locator_interaction_test + screenshot_only_on_failure_to_app_temp + close_isolated_instance + maximum_five_fix_retest_rounds + code_verified + prohibit_formal_build_or_current_app_restart
<!-- 后台交互测试必须使用语义定位器，不得依赖屏幕坐标；成功不生成截图，失败保留结果、截图和 trace 供下一轮修复。 -->
task_managed_interaction_test_contract = typescript_playwright_electron + semantic_role_or_aria_locator + no_os_cursor_coordinate_click + one_instance_per_test_group + success_no_screenshot + failure_result_screenshot_trace
<!-- 测试托管只能由界面选择或明确命令触发，执行构建和构建后测试，运行包确需刷新时最多受控重启一次。 -->
test_managed_completion_contract = explicit_only + build + post_build_tests + failure_fix_rebuild_retest + optional_single_controlled_restart
<!-- 主进程必须在任务托管模式拦截构建、启动和重启类命令，并把拦截事实写入流事件与业务日志。 -->
managed_command_policy_contract = task_mode_blocks_build_start_restart + test_mode_allows_build_validation + policy_event_is_auditable
<!-- 任务托管完成代码级验证后，尚未执行构建只登记为后续动作，不得作为部分完成或失败原因。 -->
audit_build_pending_contract = code_verified_without_build_is_completed + build_recorded_as_pending_action + never_partial_only_because_bundle_is_stale
<!-- 托管执行每轮回答必须按顺序保留；新回合建立独立文本起点，完成事件只能替换当前轮片段，最终 IPC 返回不得覆盖累计内容。 -->
managed_multiturn_text_preservation_contract = append_each_turn_with_visible_separator + turn_id_and_segment_id_boundary + completed_message_reconciles_current_turn_only + final_response_never_overwrites_accumulated_rounds + terminal_state_rejects_late_non_error_events
<!-- Harness 执行期间输入区保持可编辑，截图、图片粘贴和后续消息进入有序队列，不得由全局 loading 一并锁死。 -->
managed_running_composer_availability_contract = screenshot_and_image_paste_available_while_running + composer_editable + next_message_fifo_queue + cancel_scoped_to_active_turn
<!-- 执行状态亮点仅在运行中高亮闪烁，终态变暗静止，并按阶段显示准确结果语义。 -->
managed_status_indicator_lifecycle_contract = running_bright_pulsing + terminal_dim_static + analysis_execution_validation_test_completed_labels + failed_and_interrupted_labels
<!-- 回复卡和全部内部执行面板必须允许收缩，长路径不得建立超出卡片的固有宽度。 -->
managed_response_boundary_contract = card_width_100_percent_with_maximum + all_flex_grid_children_min_width_zero + internal_panels_max_width_100_percent + long_path_wrap_or_ellipsis + no_horizontal_boundary_escape
<!-- Harness 连接时必须重新识别运行时；优先使用与共享模型缓存客户端版本一致的本机 Codex，避免旧二进制读取新缓存字段失败。 -->
harness_runtime_version_alignment_contract = reconnect_time_candidate_probe + models_cache_client_version_match_first + highest_valid_local_version_fallback + bundled_official_package_only_when_no_local_runtime + no_hot_swap_during_active_turn + visible_source_path_and_version + audit_selected_runtime
<!-- 会话托管只理解和复述意图，需求托管只读调查并给出方案；两阶段必须强制只读沙箱并拒绝文件修改及命令提权。 -->
managed_analysis_stage_write_guard_contract = conversation_intent_only + requirement_read_only_investigation_and_plan + force_read_only_sandbox + decline_file_change_and_privileged_command
<!-- 每次确认只推进一个阶段；独立 1 和配置短语与按钮等价，关键词不得替代授权，任务阶段必须观察到真实源码变更。 -->
managed_stage_advance_authorization_contract = conversation_to_requirement_to_task_to_test + one_confirmation_one_stage + standalone_1_or_matching_phrase_equivalent + no_keyword_inferred_authorization + task_requires_observed_source_change
<!-- 最新托管回复右下角必须显示与当前阶段匹配的图标文字动作。 -->
managed_stage_action_button_contract = latest_managed_response_lower_right_icon_and_text
<!-- 会话、需求和任务阶段动作分别使用确认意图、执行方案和测试。 -->
managed_stage_action_button_contract.2 = confirm_intent_execute_plan_test_actions
<!-- 最新回复运行期间动作保持可见但必须禁用，完成后才启用。 -->
managed_stage_action_button_contract.3 = latest_action_visible_disabled_while_running_then_enabled_on_completion
<!-- 已点击的历史动作保留高亮状态但不得再次推进或回退阶段。 -->
managed_stage_action_button_contract.4 = historical_clicked_action_highlighted_but_not_actionable
<!-- 独立 1 或完全匹配的配置短语才与按钮等价，包含关键词的长句不构成授权。 -->
managed_stage_action_button_contract.5 = standalone_1_or_exact_configured_phrase_only
<!-- 默认协作模式必须显式启用官方实验性 requestUserInput 能力。 -->
harness_user_input_confirmation_contract = default_mode_experimental_request_user_input_enabled
<!-- 会话托管每次只询问一个最高优先级疑问。 -->
harness_user_input_confirmation_contract.2 = one_highest_priority_question_per_request
<!-- 每个问题独立显示互斥选项、其他输入和紧邻的确认动作。 -->
harness_user_input_confirmation_contract.3 = one_question_one_choice_group_other_input_and_adjacent_confirm
<!-- 正常单题确认必须响应原 requestId 并继续同一 Harness 回合。 -->
harness_user_input_confirmation_contract.4 = respond_original_request_id_and_continue_same_turn
<!-- 异常多题请求必须逐题本地锁定，并在全部确认后一次回传完整答案集合。 -->
harness_user_input_confirmation_contract.5 = multi_question_fallback_local_lock_then_complete_answer_map
<!-- 疑问答案只是重新理解完整会话的中间状态。 -->
managed_clarification_restatement_contract = structured_answer_is_intermediate
<!-- 每次确认后必须重新理解完整会话，有剩余歧义时再提出下一个问题。 -->
managed_clarification_restatement_contract.2 = reunderstand_full_conversation_then_ask_next_remaining_ambiguity
<!-- 完整意图重述完成前，阶段动作只允许显示为禁用占位。 -->
managed_clarification_restatement_contract.3 = stage_action_visible_but_disabled_until_complete_intent_restatement
<!-- 中断、新建任务或 Harness 退出时必须清理全部待确认状态。 -->
managed_clarification_restatement_contract.4 = clear_pending_on_interrupt_new_chat_or_harness_exit
<!-- 聊天历史必须在受高度约束的独立区域滚动，输入框固定，滚动条可见，新消息自动定位到最新内容。 -->
developer_chat_scroll_contract = constrained_independent_vertical_scroll + visible_scrollbar + fixed_composer + append_scrolls_to_latest
<!-- 流式进度只能来自官方 app-server 通知，必须增量显示回答、可读推理摘要、计划、命令、文件和工具生命周期，完成项为最终权威状态。 -->
harness_streaming_ui_contract = official_notifications_only + agent_message_delta + readable_reasoning_summary + plan_and_item_lifecycle + turn_diff_changed_files + completed_item_authoritative
<!-- 详细执行清单默认折叠，折叠栏显示事件项数和最新步骤，用户仍可手动展开查看命令与文件细节。 -->
harness_streaming_activity_disclosure_contract = collapsed_by_default + visible_item_count_and_latest_step + user_expandable_details
<!-- 禁止用定时器伪造步骤或把原始推理正文暴露到渲染层。 -->
harness_streaming_safety_contract = no_fake_progress + no_raw_reasoning_text + renderer_receives_filtered_turn_scoped_events
<!-- 主进程只枚举受控桌面源 ID；屏幕像素由隔离截图窗口的 MediaStream 本地冻结，选区、红色标注和 PNG 校验继续保持既有安全边界。 -->
screenshot_capture_and_annotation_boundary = capture_click_state + separate_borderless_screenshot_window + main_window_bounds_unchanged + hide_cached_screenshot_window_on_done_or_cancel + electron_main_enumerates_desktop_source_id + isolated_screenshot_renderer_owns_media_stream_and_freeze_frame + renderer_region_crop_red_pen_rectangle + validated_png_only
<!-- macOS 截图预热必须先识别系统权限，原生枚举失败转换为结构化结果；界面只显示本地化业务提示并提供固定权限设置入口。 -->
screenshot_permission_recovery_contract = macos_systemPreferences_screen_preflight + denied_or_restricted_skips_native_enumeration + getSources_failure_rechecks_permission + structured_permission_required_or_source_unavailable_result + no_raw_remote_method_error_in_composer + localized_recovery_message + fixed_screen_recording_settings_action + restart_guidance
<!-- 截图交互固定为两阶段：同一图片可连续标注；最新标注旁跟随完成和取消，完成保存全部标注到对话框，取消只撤销最新一笔并保留更早标注。 -->
screenshot_two_step_confirmation_contract = selection_release_auto_enters_annotation + no_selection_confirm_or_cancel_actions + rectangle_default + multiple_annotations_on_same_image + latest_annotation_follow_done_and_cancel_with_edge_flip + follow_cancel_removes_latest_annotation_only + preserve_earlier_annotations_after_follow_cancel + follow_done_saves_all_annotations_to_composer + never_auto_send
<!-- 截图按钮点击后必须直接进入框选；选择阶段冻结点击瞬间画面，只显示蒙版和选区，不显示顶部、底部工具栏或选择操作按钮。 -->
screenshot_direct_selection_contract = screenshot_button_to_immediate_crosshair + click_frame_frozen_background + dim_mask + select_phase_no_header_or_footer_or_action_buttons + no_live_background_movement
<!-- 截图层禁止调用带缩放过渡的全屏 API；Escape 取消整个流程，标注窗口的返回按钮恢复原冻结全屏蒙版重新框选。 -->
screenshot_cancel_and_no_transition_contract = separate_overlay_window_without_main_resize + escape_closes_overlay_and_preserves_main_window + annotation_back_restores_original_frozen_selection_overlay
<!-- macOS 框选蒙版必须通过无动画简单全屏覆盖整块显示器，包括菜单栏和 Dock；透明缓存态禁止置顶、接收鼠标或抢占主窗口焦点。 -->
screenshot_full_display_mask_contract = macos_simple_fullscreen_without_native_zoom_animation + cover_menu_bar_and_dock + enter_while_transparent_then_reveal + leave_while_transparent + idle_cache_zero_opacity_mouse_passthrough_not_always_on_top + restore_owner_focus
<!-- 截图窗口只能取得绑定自身 webContents 的冻结画面，完成后由主进程把签发附件回送发起窗口，禁止渲染层互相持有窗口对象。 -->
screenshot_overlay_window_contract = dedicated_frame_less_window + capture_bound_to_overlay_web_contents + signed_attachment_event_to_owner + no_renderer_window_reference
<!-- 独立截图窗口必须保持隐藏直到冻结画面和蒙版完成首帧绘制，并在自身作用域定义操作按钮主题变量，禁止黑色加载帧和不可读按钮。 -->
screenshot_overlay_first_paint_and_theme_contract = hidden_until_frozen_capture_and_mask_painted + no_black_loading_frame + screenshot_theme_tokens_available_without_developer_shell + readable_confirm_and_cancel_actions
<!-- 框选阶段保持全屏蒙版；确认后标注窗口按截图一比一显示尺寸加必要工具区自适应，并允许拖动、缩放和最大化。 -->
screenshot_annotation_window_contract = full_screen_selection_only + annotation_window_matches_capture_native_pixels_plus_chrome + annotation_canvas_no_padding_border_or_shadow + preserve_aspect_ratio + scale_only_when_exceeding_work_area + small_capture_operable_minimum + draggable_resizable_maximizable + main_window_unchanged
<!-- 标注阶段底部必须始终提供完成按钮；无标注时只回填图片并聚焦输入框，有标注时才追加红色部分提示。 -->
screenshot_completion_prompt_contract = fixed_footer_cancel_done_back + done_without_annotation + signed_attachment_to_composer + focus_composer + append_red_part_prompt_only_when_has_annotations + preserve_existing_composer_text + never_auto_send
<!-- 两个截图按钮必须共用同一控制器、长期桌面流和冻结帧管线，只允许“是否隐藏主窗体”这一参数不同；每轮冻结新帧，禁止复用上一轮静态像素。 -->
screenshot_capture_mode_contract = current_screen_button + hidden_capture_button_renders_spinner_before_hide + one_shared_capture_controller_with_hide_owner_parameter_only + first_successful_source_preflight_cached_for_process_lifetime + first_click_only_minimum_spinner_time + reusable_hidden_screenshot_shell_window + one_persistent_desktop_media_stream_per_display + reuse_loaded_react_css_and_mask + cached_shell_background_throttling_disabled + restore_owner_before_hiding_cached_shell + reset_selection_annotation_history_between_rounds + renderer_and_stream_ready_ack_before_owner_hide + owner_hide_is_last_preparation_step + hidden_mode_waits_for_post_hide_video_frames + one_fresh_stream_frame_per_round + never_reuse_frozen_pixels_across_rounds + source_preflight_failure_keeps_owner_visible + no_full_screen_pixels_over_ipc + hover_tooltip_for_each_mode + restore_hidden_owner_on_overlay_end + same_selection_annotation_pipeline
<!-- 清空全部红色绘画标注属于可逆编辑动作，但必须先显示确认，只有确认后才恢复无标注底图。 -->
screenshot_clear_annotation_contract = clear_drawing_button + explicit_confirmation_before_clear + decline_preserves_annotations + accept_restores_cropped_base_image
<!-- 截图原图、标注图和元数据统一进入应用自身 temp；渲染层发送主进程签发的 ID，主进程解析后按官方协议传 localImage 路径。 -->
screenshot_temp_and_local_image_contract = apps_ai_desktop_temp_only + main_process_signed_attachment_id + official_turn_start_localImage_path
<!-- 系统剪贴板中的图片必须能从输入框直接粘贴，普通文字粘贴不受影响；图片统一转 PNG 后复用现有安全附件链路。 -->
clipboard_image_paste_contract = ctrl_or_command_v_in_composer + preserve_plain_text_paste + normalize_to_png + reuse_temp_signed_attachment_and_localImage + max_five_images
<!-- 设置必须能够用系统文件管理器打开 temp，并在用户确认后清空全部内容但立即恢复空 temp 根目录。 -->
screenshot_temp_management_contract = system_file_manager_open + confirmed_clear_all_contents + keep_empty_temp_root

<!-- 启动器必须从自身目录解析应用和 SELPLAT 根，检查 Node/npm 与官方 Codex 依赖后进入开发热启动链路；正式构建由独立命令执行。 -->
windows_developer_launcher_contract = self_relative_path + dependency_check + developer_hot_start + formal_build_is_separate
<!-- macOS 开发版双击启动器必须从自身目录解析工程，检查 Node、npm、Electron 和官方 Codex 依赖，每次先正式构建最新开发版，构建失败时禁止启动 Electron。 -->
macos_developer_launcher_contract = self_relative_path + node_npm_electron_and_official_codex_dependency_check + mandatory_fresh_developer_build_before_launch + build_failure_blocks_launch + package_fixed_bundle_id_ai_desktop_app + stable_signed_bootstrap_shell_loads_external_latest_runtime + ordinary_source_build_never_repackages_or_resigns_shell + repackage_only_when_bootstrap_builder_or_dependency_manifest_changes + permission_refresh_after_identity_change + launchservices_register + open_packaged_app_never_raw_dependency_electron
<!-- AI Desktop 测试只维护一个共享测试文档；执行者取得独占锁，其他读取者看到占用身份，完成后立即归档。 -->
shared_test_document_lifecycle_contract = one_apps_ai_desktop_test_document_md + no_thread_scoped_document + exclusive_execution_lock + executor_task_thread_pid_start_item_heartbeat_metadata + concurrent_reader_reports_owner + stale_lock_recovery + completed_run_immediate_archive + next_run_new_document + legacy_thread_documents_archived_not_deleted
<!-- Electron 打包必须把官方 Codex JavaScript 入口和当前平台原生二进制解包到可执行文件系统，禁止从 asar 内直接拉起。 -->
packaged_harness_binary_contract = asar_unpack_@openai_codex_and_platform_package
<!-- macOS 跨平台生成 Windows 包时 npm 只自动选择宿主可选依赖，因此 Windows x64 平台别名包必须作为直接锁定依赖随安装包携带。 -->
windows_harness_platform_dependency = direct_alias_@openai/codex-win32-x64_to_@openai/codex@0.146.0-win32-x64
<!-- 规则没有重复文档结构，不创建虚假模板或案例；官方协议 README 和应用真实源码构成可核对依据。 -->
template_and_example_policy = not_applicable_because_protocol_and_existing_application_source_are_authoritative
<!-- 验证责任按托管模式登记：任务托管只完成类型检查和针对性快速测试；Electron 与渲染构建、运行验证只属于显式测试托管。 -->
harness_verification_requires = task_managed_typecheck_and_hidden_isolated_electron_playwright_interaction_test + test_managed_electron_and_renderer_build_and_post_build_test + account_read_login + approval_decline_path
