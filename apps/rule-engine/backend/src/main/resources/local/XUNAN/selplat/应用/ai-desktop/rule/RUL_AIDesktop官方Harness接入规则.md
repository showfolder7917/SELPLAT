# AI Desktop 官方 Harness 接入规则

<!-- 本规则由应用 Electron/TypeScript 源码直接实现，不建立 Java 能力。 -->
java_ability_refs = none
<!-- 本规则没有独立 Python 自动化职责，不建立空能力入口。 -->
python_ability_refs = none
<!-- 官方 harness 适配属于应用生产源码，不是 rule-engine Node 能力，因此不伪造 ability ID。 -->
node_ability_refs = none
<!-- 真实应用程序入口固定为 Electron 主进程服务，供规则核对调用方和验证路径。 -->
application_program_path = apps/ai-desktop/electron/services/codex-service.ts
<!-- 4.3.0 标注画布支持连续红框，跟随操作可完成全部标注或只取消最新一笔。 -->
rule_version = 4.3.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 当前规则已经登记到 SELPLAT 应用索引。 -->
rule_status = active
<!-- 升级记录同时保留首次接入与真实统一测试发现的协议修复。 -->
upgrade_record = 2026-08-21:接入openai_codex_app_server与ChatGPT浏览器OAuth并逐次审批;2026-08-21:按0.146.0使用短横线sandbox枚举并固定approvalsReviewer为user防止全局auto_review静默代审;2026-08-21:Windows开发包固定x64并显式携带0.146.0_win32_x64平台别名包;2026-08-21:旧应用名整体迁移为ai-desktop并同步规则逻辑ID与路径;2026-08-22:设置浮层增加外部点击与Escape关闭且内部交互和审批弹窗隔离;2026-08-22:新增真实多工作区Accordion_用户数据持久化_逐根权限_turn_start_writableRoots;2026-08-22:开发版关键文字统一提升至桌面IDE可读密度;2026-08-22:新增区域截图_红色标注_应用temp统一清理_官方localImage发送;2026-08-22:截图编辑层改为临时全屏并在完成取消后恢复主窗口;2026-08-22:长会话增加独立滚动区_可见滚动条_新消息自动定位;2026-08-22:官方app_server文字delta_计划_命令_文件变更真实流式回显;2026-08-22:详细执行过程默认折叠_折叠栏保留项数与当前步骤;2026-08-22:支持Ctrl_Command_V粘贴系统截图_temp统一落盘_localImage发送;2026-08-22:截图选区确定_默认方框_标注确定入对话框;2026-08-22:截图按钮点击即框选_冻结画面蒙版_选择阶段无工具栏;2026-08-22:截图层无动画覆盖屏幕_选区确定旁取消_Escape恢复窗口;2026-08-22:独立无边框截图窗口_主窗口尺寸不变_安全附件回传;2026-08-22:截图窗口绘制完成后再显示_独立主题变量保证操作按钮可读;2026-08-22:标注窗口按截图尺寸自适应_可拖动缩放最大化;2026-08-22:截图一比一无边框_松开自动标注_返回重选_完成回填调查提示_隐藏主窗截图_清空标注确认;2026-08-22:隐藏截图先转圈预热_准备成功后隐藏;2026-08-22:修复macOS微型缩略图空值造成的预热权限误判;2026-08-22:截图窗体后台就绪后最后隐藏主窗口并替换真实背景;2026-08-22:常驻复用截图壳_一次权限预热_每轮单次最新真实抓屏;2026-08-22:双截图入口统一长期桌面流_隐藏后按新视频帧冻结;2026-08-22:macOS简单全屏蒙版覆盖菜单栏与Dock_透明缓存不抢焦点
<!-- 4.3.0 补充同图多标注及跟随完成、取消的稳定交互升级记录。 -->
upgrade_record_4_3 = 2026-08-22:同图连续红框_跟随完成全部或取消最新标注

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
<!-- 没有任何显式可写根时禁止发送空 workspaceWrite 集合，必须降级为 readOnly，防止官方兼容逻辑把 cwd 恢复为默认可写。 -->
workspace_empty_writable_roots_policy = force_readOnly_never_implicit_cwd_write
<!-- 工作区清单或权限变化后必须开启匹配新签名的线程，防止旧线程继续沿用过期授权范围。 -->
workspace_permission_change_thread_policy = workspace_signature_change_requires_new_thread
<!-- 开发版关键导航、工作区树、控件、聊天正文和上下文值使用桌面 IDE 可读字号，禁止关键内容落入 10 至 11 像素微缩文字。 -->
developer_typography_readability_contract = critical_text_13_to_15_css_px + matching_row_height + no_critical_10_to_11_px
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
<!-- 完成标注必须把签发图片和固定红框调查提示放回输入框，保留用户既有文字且不得自动发送。 -->
screenshot_completion_prompt_contract = signed_attachment_to_composer + append_once_调查图片红色部分是什么问题 + preserve_existing_composer_text + never_auto_send
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
