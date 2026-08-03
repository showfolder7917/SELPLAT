# GUI Video Task Rules

## 说明

- 这是 GUI 与视频任务层的规则文件
- 本文件承接 GUI 与视频任务层的正式任务规则
- 本文件使用结构化规则写法，不重复声明启动层和协议层已声明约束

## 强制规则（Mandatory）

<!-- GUI 任务必须区分界面操作完成与真实任务完成 -->
distinguish_ui_operation_completion_from_real_task_completion

<!-- GUI 任务结束前必须验证用户可见结果 -->
verify_user_visible_result_before_claiming_gui_task_done

<!-- 视频任务执行前必须确认输入输出和执行方式 -->
confirm_video_input_output_and_execution_mode_before_run

<!-- 大目录加载或大批量扫描必须异步 -->
use_async_loading_for_large_directory_or_batch_scan

## 禁止事项（Forbidden）

<!-- 禁止把窗口打开或按钮点击视为最终完成 -->
forbid_treat_open_window_or_button_click_as_final_completion

<!-- 禁止在规则层重复声明协议层通用约束 -->
forbid_redeclare_protocol_level_gui_video_constraints
