# Code Vue Frontend Project Rules

## 说明

- 这是编码主题下的 Vue 前端项目规则文件
- 本文件承接 Vue 前端工程实现层的正式规则
- 本文件用于同时约束 Vue 前端项目的分层边界、目录结构、交互策略、工程化重构验证和页面级体验约束
- 通用编码与注释规范以 `CODE_VUE_CODING_RULES.md` 为准，测试闭环以 `CODE_VUE_TEST_RULES.md` 为准

## 强制规则（Mandatory）

<!-- 修改 Vue 工程前，必须先确认目标文件、目标目录和当前分层归属，避免继续把逻辑堆回错误层级 -->
confirm_target_file_directory_and_layer_before_vue_architecture_change

<!-- Vue 架构调整优先保持现有构建工具、入口和公共依赖稳定，避免拆分时顺手更换技术栈 -->
prefer_existing_build_tool_entry_and_dependency_stack_for_vue_architecture_change

<!-- 入口组件优先只承担应用壳职责 -->
prefer_thin_root_app_component_in_vue_projects

<!-- 发生大型页面重构时，必须先把壳层、视图层、组件层、状态层和服务层边界拆开，再逐步迁出遗留实现 -->
require_shell_view_component_state_service_boundary_before_large_vue_refactor

## 结构规则（Structure Rules）

<!-- 页面级组件优先放在 views 目录，避免页面模板和通用组件混放 -->
prefer_views_directory_for_page_level_vue_components

<!-- 可复用界面块优先放在 components 目录，避免页面私有模板长期复制散落 -->
prefer_components_directory_for_reusable_vue_ui_blocks

<!-- 页面状态、选中态、表单态和组合动作优先收敛到 composables 目录 -->
prefer_composables_for_page_state_forms_selections_and_actions_in_vue_projects

<!-- 大型页面的组合入口 composable 可以存在，但不应在入口文件中堆积全部实现细节 -->
prefer_composition_entry_composable_for_large_vue_pages

<!-- 前端接口访问优先收敛到 services 目录，不在页面和组件里直接散落 fetch 细节 -->
prefer_services_directory_for_vue_api_access

<!-- 常量、注入键和稳定配置优先放在 constants 目录，避免魔法字符串散落在页面层 -->
prefer_constants_directory_for_vue_shared_constants_and_injection_keys

<!-- 前端公共算法、格式化和纯函数优先放在 utils 目录，不和页面状态文件混写 -->
prefer_utils_directory_for_reusable_pure_helpers_in_vue_projects

<!-- 根组件优先保持薄壳，并采用 views components composables services constants 的工程结构 -->
prefer_thin_root_app_with_views_components_composables_services_and_constants_structure

## 职责边界规则（Boundary Rules）

<!-- 页面层重点负责视图编排、区块装配和少量展示级计算，不直接承担完整数据接入和持久化细节 -->
prefer_view_layer_for_layout_orchestration_not_full_data_integration

<!-- 组件层重点负责复用 UI 片段和局部交互，不直接拥有跨页面业务状态 -->
prefer_component_layer_for_reusable_ui_and_local_interaction

<!-- composable 层重点负责状态、计算、同步、副作用和动作封装，不直接输出大段静态页面壳 -->
prefer_composable_layer_for_state_computed_sync_and_actions

<!-- service 层重点负责接口调用、桥接参数、legacy 适配和可替换的数据接入，不直接控制页面布局 -->
prefer_service_layer_for_api_bridge_and_runtime_adaptation

<!-- legacy 或运行时接入应通过单独 service 或 adapter 文件进入，不让页面直接 import 大体量遗留模块 -->
prefer_service_or_adapter_entry_for_legacy_runtime_integration

## 注释规则（Comment Rules）

<!-- 页面层注释重点解释每个区块承接什么业务和为什么在该视图层出现 -->
explain_business_responsibility_of_each_major_block_in_vue_views

<!-- 组件层注释重点解释组件负责什么、不负责什么，以及它依赖哪些上层输入 -->
explain_component_boundary_in_vue_components

<!-- composable 层注释重点解释状态块、计算块、同步块、副作用块和回写块 -->
explain_state_computed_sync_side_effect_and_writeback_blocks_in_vue_composables

<!-- legacy 接入层注释必须解释为什么还保留遗留入口、由哪一层封装、后续拆迁目标是什么 -->
explain_legacy_runtime_boundary_and_migration_target_in_vue_adapters

## 场景规则（Scenario Rules）

<!-- 单文件过大时优先拆页面、组件、composables 和 services，不把所有状态、事件和模板长期堆在一个入口文件 -->
split_large_vue_single_file_components_into_views_components_composables_and_services

<!-- 前后端联调页优先把接口层和页面层解耦 -->
prefer_decoupling_api_layer_from_view_layer_in_vue_frontend_projects

<!-- 当业务编号由后端自动生成时 前端表单默认以禁用或只读方式展示 -->
prefer_disabled_or_readonly_business_code_fields_when_generated_by_backend

<!-- 重要保存结果和校验失败应优先使用用户手动关闭的信息框 而不是轻提示 -->
prefer_acknowledgeable_dialogs_over_transient_toasts_for_important_feedback

<!-- 新增或保存动作完成后 业务弹窗默认不自动关闭 应由用户主动关闭 -->
prefer_user_closed_business_modals_after_create_or_save_feedback

<!-- 重要业务 上传 详情 未保存表单等非瞬时弹窗默认禁止点击遮罩关闭 防止误触丢失当前操作上下文 -->
prefer_disabling_backdrop_close_for_non_transient_business_upload_detail_or_unsaved_modals

<!-- 重要业务 上传 详情 未保存表单等非瞬时弹窗应明确提供取消 关闭 或完成按钮 -->
prefer_explicit_close_actions_for_non_transient_modals

<!-- 上传文件名和文件夹名默认只允许英文 数字 连字符和下划线 前端应在选择阶段直接拦截 -->
prefer_english_only_names_for_uploaded_files_and_folders

<!-- 同一项目内新增弹层应复用既有关闭策略 不应出现部分弹层可点遮罩关闭 部分不可关闭的混乱交互 -->
prefer_consistent_backdrop_close_policy_within_same_vue_project

<!-- 涉及界面布局 交互方式 视觉摆放的调整时 应先给出编号方案并等待用户通过 1 2 等编号确认后再执行 -->
prefer_numbered_user_confirmation_before_ui_layout_or_interaction_changes

<!-- 工作台类页面拖拽或缩放时 应只让主输入区或主编辑区伸缩 并保持按钮 标签页 提示区等非编辑控件固定视觉尺寸 -->
prefer_only_primary_editor_area_to_resize_and_keep_controls_fixed_during_workbench_resizing

<!-- 标签页承载隐藏信息或补充说明时 应优先使用自定义 tooltip 实现即时 稳定 可控的悬浮提示 -->
prefer_custom_tooltip_for_tab_hidden_context_or_supplemental_labels

<!-- 页面继续增多时 优先从手工页面切换迁移到路由机制 -->
prefer_router_before_manual_page_switching_when_vue_project_grows

<!-- 本地前端启动脚本应与终端生命周期绑定 关闭脚本窗口时服务也必须停止 -->
bind_vue_local_dev_server_lifecycle_to_terminal_session

<!-- 本地前端 command 启动脚本不得复用旧前端进程 应由当前脚本自行启动并托管服务生命周期 -->
prefer_frontend_command_scripts_to_own_server_lifecycle

<!-- 本地前端启动脚本启动时应明确打印项目目录和访问地址 -->
print_project_directory_and_access_url_in_vue_local_startup_scripts

<!-- 页面工程化重构后必须验证构建通过 -->
require_vue_build_verification_after_frontend_project_refactor

<!-- 页面工程化迁移后必须按构建测试、composable状态测试、真实页面测试、页面结合测试的最小适用矩阵完成验证 -->
require_build_composable_page_and_page_integration_matrix_after_vue_page_migration

<!-- 当前端结构迁移或接口接线调整触达 bootstrap、bridge、保存响应、生成响应或后端契约时，交付前必须安排真实前后端联动验证 -->
require_real_frontend_backend_integration_verification_for_vue_changes_touching_bootstrap_bridge_save_or_generation_contract

## 禁止事项（Forbidden）

<!-- 禁止把全部状态、事件、模板和接口长期堆在单一 App.vue 或单一大文件 -->
forbid_long_term_all_in_one_vue_root_or_monolithic_runtime_file

<!-- 禁止页面组件直接散落网络请求、桥接参数拼装和运行时加载细节而不经过 services -->
forbid_scattered_api_bridge_or_runtime_loading_logic_inside_vue_views

<!-- 禁止在页面层重复维护与 composable 冲突的局部业务状态 -->
forbid_duplicate_business_state_between_vue_views_and_composables

<!-- 禁止在后端自动生成业务编号的场景下允许用户手工编辑编号字段 -->
forbid_editable_business_code_inputs_when_code_is_backend_generated

<!-- 禁止在关键保存提示弹出后自动关闭当前业务弹窗 -->
forbid_auto_closing_business_modals_immediately_after_important_feedback

<!-- 禁止把点击遮罩关闭作为重要业务弹窗 上传弹窗 详情弹窗和未保存表单弹窗的默认实现 -->
forbid_backdrop_click_close_as_default_for_important_upload_detail_or_unsaved_modals

<!-- 禁止新增弹层绕过项目既有关闭约定 例如直接使用 @click.self 关闭重要业务弹层 -->
forbid_bypassing_existing_modal_close_policy_in_new_vue_modals

<!-- 禁止在未获得用户编号确认前直接修改界面布局 交互流或控件摆放 -->
forbid_executing_ui_layout_or_interaction_changes_before_numbered_user_confirmation

<!-- 禁止工作台按钮 标签页 提示区等非编辑控件因 flex 收缩 容器尺寸变化或垂直拖拽出现变形或被拉伸 -->
forbid_deforming_or_stretching_non_editor_workbench_controls_during_resizing

<!-- 禁止标签页依赖浏览器原生 title 作为默认悬浮提示 原生 title 延迟和重复触发不可控 -->
forbid_native_title_as_default_tooltip_for_tabs

<!-- 禁止在默认本地启动脚本中使用 nohup 等使前端服务脱离会话 -->
forbid_detaching_vue_dev_server_from_terminal_session_by_default

<!-- 禁止本地前端 command 启动脚本直接复用已运行旧服务后退出 否则关闭脚本窗口时无法停止服务 -->
forbid_reusing_existing_frontend_server_without_lifecycle_ownership

<!-- 禁止在没有明确职责说明的情况下随意新增目录层级，避免表面拆分实则更乱 -->
forbid_adding_unclear_directory_layers_without_responsibility_definition
