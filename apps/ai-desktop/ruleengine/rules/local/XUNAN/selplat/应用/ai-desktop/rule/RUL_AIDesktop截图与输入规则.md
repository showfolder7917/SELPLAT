# AI Desktop 截图与输入规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 5.105.0
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

<!-- 截图必须由主进程选择平台适配器并向隔离窗口交付单张已校验 PNG，再由用户完成区域与标注。 -->
screenshot_capture_and_annotation_boundary = capture_click_state + separate_borderless_screenshot_window + main_window_bounds_unchanged + hide_cached_screenshot_window_on_done_or_cancel + electron_main_preflights_bound_display + one_platform_capture_adapter_entry + macos_usr_sbin_screencapture_x_t_png_D + windows_target_display_physical_pixel_desktopCapturerSource_thumbnail + isolated_screenshot_renderer_receives_one_validated_png_per_round + renderer_region_crop_red_pen_rectangle + validated_png_only
<!-- macOS 原生截图不传 -C；Windows 只读取目标显示器一次性缩略帧；两个平台均禁止视频流、透明指针遮罩和像素修补。 -->
screenshot_cursor_exclusion_contract = macos_native_screencapture_without_C + windows_one_shot_target_display_thumbnail + wait_1200ms_for_automation_pointer_overlay_window_to_expire_before_capture + prohibit_getDisplayMedia_getUserMedia_media_stream + prohibit_getCursorScreenPoint_transparent_cursor_overlay_and_pixel_repair + macos_scratch_png_deleted_immediately_after_read + original_and_annotated_png_without_cursor_artifact
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
<!-- 两个截图按钮共用同一原生控制器，只允许“是否隐藏主窗体”参数不同；每轮执行一次新的原生截图，禁止缓存静态像素。 -->
screenshot_capture_mode_contract = current_screen_button + hidden_capture_button_renders_spinner_before_hide + one_shared_native_capture_controller_with_hide_owner_parameter_only + first_click_only_minimum_spinner_time + reusable_hidden_screenshot_shell_window + reuse_loaded_react_css_and_mask + cached_shell_background_throttling_disabled + restore_owner_before_hiding_cached_shell + reset_selection_annotation_history_between_rounds + renderer_ready_ack_before_owner_hide + owner_hide_is_last_preparation_step + one_fresh_native_png_per_round + never_reuse_frozen_pixels_across_rounds + source_preflight_failure_keeps_owner_visible + bounded_main_to_isolated_renderer_png_ipc + hover_tooltip_for_each_mode + restore_hidden_owner_on_overlay_end + same_selection_annotation_pipeline
<!-- 截图任一后台阶段失败都必须回到可操作状态；隐藏渲染器不得只在自身显示错误并让主界面无限等待。 -->
screenshot_failure_recovery_contract = bounded_source_enumeration_wait + bounded_hidden_renderer_ready_wait + bounded_native_screencapture_wait + validated_frame_ack + scratch_file_finally_unlink + composer_spinner_always_clears + owner_window_restored_on_failure + stale_screenshot_shell_destroyed + next_click_recreates_shell + tcc_failure_must_be_fixed_by_stable_app_identity_and_permission_recovery_not_unreviewed_backend_fallback
<!-- 截图诊断必须按一次尝试关联关键阶段，同时只记录尺寸、状态和业务错误，不记录屏幕像素。 -->
screenshot_diagnostic_log_contract = shared_attempt_id + source_preflight_stage + native_screencapture_requested_and_ready_stage + frame_result_stage + capture_dimensions_only + bounded_error_detail + prohibit_command_output_and_screen_pixels_in_log
<!-- 防复发门禁：截图后端改动必须通过统一入口契约，并分别完成真实 macOS 与 Windows 两入口检查；代码检查不能冒充系统截图通过。 -->
screenshot_backend_regression_gate = exactly_one_platform_dispatch_entry + exactly_one_adapter_per_supported_platform + git_last_known_good_comparison + contract_rejects_getDisplayMedia_getUserMedia_cursor_overlay_and_uncontrolled_fallback + contract_requires_macos_screencapture_without_C_and_windows_target_display_physical_thumbnail + automation_overlay_settle + macos_scratch_cleanup + real_macos_current_and_hidden_capture_saved_original_png_assert_no_system_or_automation_cursor + real_windows_current_and_hidden_capture_saved_original_png_assert_valid_target_display_and_no_automation_cursor + macos_tcc_identity_verification + no_completion_on_code_only_tests
<!-- 清空全部红色绘画标注属于可逆编辑动作，但必须先显示确认，只有确认后才恢复无标注底图。 -->
screenshot_clear_annotation_contract = clear_drawing_button + explicit_confirmation_before_clear + decline_preserves_annotations + accept_restores_cropped_base_image
<!-- 截图原图、标注图和元数据统一进入应用自身 temp；渲染层发送主进程签发的 ID，主进程解析后按官方协议传 localImage 路径。 -->
screenshot_temp_and_local_image_contract = selplat_OPTION_temp_ai_desktop_only + main_process_signed_attachment_id + official_turn_start_localImage_path
<!-- 系统剪贴板中的图片必须能从输入框直接粘贴，普通文字粘贴不受影响；图片统一转 PNG 后复用现有安全附件链路。 -->
clipboard_image_paste_contract = ctrl_or_command_v_in_composer + preserve_plain_text_paste + normalize_to_png + reuse_temp_signed_attachment_and_localImage + max_five_images
<!-- 设置必须能够用系统文件管理器打开 temp，并在用户确认后清空全部内容但立即恢复空 temp 根目录。 -->
screenshot_temp_management_contract = system_file_manager_open + confirmed_clear_all_contents + keep_empty_temp_root
