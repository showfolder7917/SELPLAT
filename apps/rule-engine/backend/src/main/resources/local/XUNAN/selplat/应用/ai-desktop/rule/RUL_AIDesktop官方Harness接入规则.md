# AI Desktop 官方 Harness 接入规则

<!-- 本规则由应用 Electron/TypeScript 源码直接实现，不建立 Java 能力。 -->
java_ability_refs = none
<!-- 本规则没有独立 Python 自动化职责，不建立空能力入口。 -->
python_ability_refs = none
<!-- 官方 harness 适配属于应用生产源码，不是 rule-engine Node 能力，因此不伪造 ability ID。 -->
node_ability_refs = none
<!-- 真实应用程序入口固定为 Electron 主进程服务，供规则核对调用方和验证路径。 -->
application_program_path = apps/ai-desktop/electron/services/codex-service.ts
<!-- 2.2.0 增加多工作区登记、持久化、逐目录权限和官方 turn sandboxPolicy 映射门禁。 -->
rule_version = 2.2.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 当前规则已经登记到 SELPLAT 应用索引。 -->
rule_status = active
<!-- 升级记录同时保留首次接入与真实统一测试发现的协议修复。 -->
upgrade_record = 2026-08-21:接入openai_codex_app_server与ChatGPT浏览器OAuth并逐次审批;2026-08-21:按0.146.0使用短横线sandbox枚举并固定approvalsReviewer为user防止全局auto_review静默代审;2026-08-21:Windows开发包固定x64并显式携带0.146.0_win32_x64平台别名包;2026-08-21:旧应用名整体迁移为ai-desktop并同步规则逻辑ID与路径;2026-08-22:设置浮层增加外部点击与Escape关闭且内部交互和审批弹窗隔离;2026-08-22:新增真实多工作区Accordion_用户数据持久化_逐根权限_turn_start_writableRoots

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
<!-- 默认和工作区写入模式都必须保留官方 on-request 审批，禁止将 approvalPolicy 固定为 never。 -->
harness_execution_approval_policy = on_request_never_bypass
<!-- 桌面端必须显式指定用户审查器，禁止继承全局 auto_review 后由自动审查器代替 UI 用户作出允许。 -->
harness_approvals_reviewer = user_never_inherit_auto_review
<!-- 命令执行与文件修改请求必须显示真实原因、命令或变更信息，并由用户逐次允许或拒绝。 -->
harness_approval_ui_requires = reason + command_or_file_change_details + explicit_accept_or_decline
<!-- 未实现的权限、动态工具或结构化请求不得被隐式接受；业务含义是未知能力默认保持最小权限。 -->
unsupported_harness_server_request_policy = deny_or_cancel_without_permission_expansion

<!-- 新会话、发送任务、中止任务、账号读取、登录和退出必须由同一长期运行 app-server 连接完成。 -->
harness_required_lifecycle = initialize + account + thread + turn + interrupt + logout
<!-- 0.146.0 的 thread/start sandbox 使用短横线枚举；共享白名单值可以原样传递，禁止改写为旧驼峰值。 -->
harness_sandbox_mapping = read-only_to_read-only + workspace-write_to_workspace-write
<!-- 设置面板属于临时浮层；外部点击和 Escape 必须关闭，内部操作保持打开，且不得替用户处理审批弹窗。 -->
settings_panel_dismissal_contract = outside_pointer_or_escape_closes + inside_interaction_stays_open + approval_dialog_isolated

<!-- 工作区登记必须由 Electron 主进程系统目录选择器完成并校验真实绝对目录；渲染层只能传工作区 ID，禁止提交任意路径。 -->
workspace_registration_security = main_process_directory_picker + real_absolute_existing_directory + renderer_id_only
<!-- 文件系统根和用户主目录范围过宽，不允许直接登记为工作区；新目录默认只读。 -->
workspace_registration_default_and_broad_path_guard = new_root_read_only + reject_filesystem_root_and_home
<!-- 多工作区配置属于本机用户运行数据，必须持久化到 Electron userData，禁止写入工程源码或修改官方 harness。 -->
workspace_registry_storage = electron_userData_json_not_project_source_or_harness_source
<!-- 左侧工作区使用可同时展开多个面板的 Accordion；每个根独立展示真实路径、目录项、主目录和权限。 -->
workspace_accordion_contract = multiple_independent_expansion + real_entries + primary_marker + per_root_permission
<!-- 主目录作为 Codex 回合 cwd；全局只读优先，工作区写入时只把已登记且显式标记可写的目录传给官方 writableRoots。 -->
workspace_harness_sandbox_mapping = primary_root_to_turn_cwd + global_read_only_overrides + registered_workspace_write_roots_to_turn_start_sandboxPolicy_writableRoots
<!-- 工作区清单或权限变化后必须开启匹配新签名的线程，防止旧线程继续沿用过期授权范围。 -->
workspace_permission_change_thread_policy = workspace_signature_change_requires_new_thread

<!-- 启动器必须从自身目录解析应用和 SELPLAT 根，检查 Node/npm 与官方 Codex 依赖后再构建启动。 -->
windows_developer_launcher_contract = self_relative_path + dependency_check + developer_build + electron_start
<!-- Electron 打包必须把官方 Codex JavaScript 入口和当前平台原生二进制解包到可执行文件系统，禁止从 asar 内直接拉起。 -->
packaged_harness_binary_contract = asar_unpack_@openai_codex_and_platform_package
<!-- macOS 跨平台生成 Windows 包时 npm 只自动选择宿主可选依赖，因此 Windows x64 平台别名包必须作为直接锁定依赖随安装包携带。 -->
windows_harness_platform_dependency = direct_alias_@openai/codex-win32-x64_to_@openai/codex@0.146.0-win32-x64
<!-- 规则没有重复文档结构，不创建虚假模板或案例；官方协议 README 和应用真实源码构成可核对依据。 -->
template_and_example_policy = not_applicable_because_protocol_and_existing_application_source_are_authoritative
<!-- 验证责任必须登记类型检查、Electron 构建、开发版渲染构建、harness 初始化登录和审批拒绝路径。 -->
harness_verification_requires = typecheck + electron_build + developer_renderer_build + account_read_login + approval_decline_path
