# Code Vue Test Rules

## 目标
- 本文件定义 Vue 前端的测试策略、测试分层、页面测试、页面结合测试和自动修复 bug 级验证规则。
- 本文件只负责回答 Vue 改动后应该怎么验证，才能支撑自动修复 bug 和页面级回归判断。
- 通用页面测试工具、截图和标准能力要求仍以 `CODE_TEST_RULES.md` 为准，本文件负责 Vue 任务的测试入口选择和验证闭环。

## 必须遵守
<!-- Vue 代码变更后必须做可执行验证，不能只靠构建通过或静态阅读判断正确 -->
require_executable_verification_after_vue_change

<!-- Vue 页面或工程迁移后必须至少完成构建测试、状态层测试、真实页面测试和页面结合测试中的最小适用集合 -->
require_vue_migration_test_matrix_after_structure_or_runtime_migration

<!-- 当 bug 可以稳定复现时，优先先构造失败测试、失败页面证据或失败交互证据，再进行修复 -->
prefer_failing_test_or_visual_evidence_before_vue_bug_fix_when_reproducible

<!-- Vue bug 修复至少要有最小复现页面、失败截图、失败日志、失败接口、失败录屏或失败脚本中的一种证据 -->
require_minimal_repro_or_evidence_for_vue_bug_fix

<!-- Vue bug 修复完成后必须补针对性回归验证，不能只验证主路径恢复 -->
require_targeted_regression_test_after_vue_bug_fix

<!-- 涉及页面布局、弹窗、滚动、可视状态或交互时，必须同时遵守 CODE_TEST_RULES.md 的真实页面验证要求 -->
require_real_page_verification_for_visual_or_interactive_vue_changes

## 测试分层规则
<!-- 修复或新增功能前，先识别问题位于 pure_logic、composable、component、view、service、api_contract、page_layout、page_interaction、cross_page_flow 哪一层，再选最小测试入口 -->
require_layer_identification_before_vue_test_selection

<!-- 页面或运行时迁移时必须先识别迁移影响落在 constants、service、composable、view、component、page_runtime_bridge 哪些层，再决定测试矩阵 -->
require_layer_mapping_before_vue_migration_test_selection

## 构建测试规则
<!-- 迁移、重构或目录结构调整后必须先执行构建测试，确保导入关系、编译入口和静态资源引用未断 -->
require_build_verification_after_vue_structure_or_runtime_migration

<!-- 构建测试是迁移后的最低层验证，不能单独作为页面或 bug 修复完成证据 -->
forbid_using_build_verification_alone_as_vue_migration_or_bug_fix_evidence

<!-- 纯逻辑、格式化、转换和校验优先使用单元测试或脚本级断言 -->
prefer_unit_tests_for_pure_vue_logic

<!-- composable 的状态迁移、计算结果、副作用和同步逻辑优先使用 composable 级测试 -->
prefer_composable_tests_for_vue_state_and_side_effect_logic

<!-- 当 legacy 页面迁出状态机、选中态、模块切换、桥接派生或缓存同步逻辑到 composable 时，必须补 composable 级测试 -->
require_composable_tests_when_migrating_vue_state_selection_module_switch_or_cache_logic

<!-- 组件的 props、emits、局部交互和局部渲染优先使用组件级测试 -->
prefer_component_tests_for_vue_props_emits_and_local_rendering

<!-- 页面视图的区块组合、页面入口和主流程交互优先使用页面测试 -->
prefer_page_tests_for_vue_view_orchestration_and_main_user_flow

<!-- 页面与后端接口、桥接参数、启动链或多个模块联动时，优先使用页面结合测试 -->
prefer_page_integration_tests_for_vue_api_bridge_and_cross_module_flow

## Bugfix/Test Matrix
<!-- Bug 修复测试必须按问题类型选择最小而稳定的验证层，不允许凭感觉随意跳层 -->
require_bugfix_test_matrix_selection_for_vue_bug_fix = true

<!-- 问题在 formatter、parser、mapper、validator 等纯逻辑层时，优先写单元测试 -->
matrix_pure_logic_bug_prefers_vue_unit_test = formatter,parser,mapper,validator,pure_logic -> unit_test

<!-- 问题在 composable 状态迁移、watch、副作用、缓存同步时，优先写 composable 测试 -->
matrix_composable_bug_prefers_vue_composable_test = composable,state_transition,watch_effect,cache_sync -> composable_test

<!-- 问题在 props、emits、局部渲染、局部交互时，优先写组件测试 -->
matrix_component_bug_prefers_vue_component_test = component,props,emits,local_render,local_interaction -> component_test

<!-- 问题在页面布局、首屏、遮挡、重叠、滚动、响应式和整体区块回显时，优先写页面测试 -->
matrix_page_layout_bug_prefers_vue_page_test = page_layout,first_screen,overlap,scroll,responsive,section_render -> page_test

<!-- 问题在页面与后端接口、桥接参数、启动入口、保存链路和跨模块联动时，优先写页面结合测试 -->
matrix_page_flow_bug_prefers_vue_page_integration_test = api_bridge,startup_flow,save_flow,cross_module_flow,backend_echo -> page_integration_test

<!-- Vue 问题跨越多层时，先选最小复现层，再补一层相邻回归；规则键保留 Vue 范围，避免与其他技术栈加载时互相覆盖 -->
vue_matrix_cross_layer_bug_prefers_smallest_repro_then_neighbor_regression = cross_layer -> smallest_repro_plus_neighbor_regression

## 页面测试规则
<!-- 页面测试必须真实启动或连接目标页面，并查看真实 URL -->
require_real_url_for_vue_page_test

<!-- 页面测试必须覆盖当前问题所在的页面区块、首屏状态和必要滚动区域 -->
require_target_area_and_scroll_coverage_for_vue_page_test

<!-- 页面迁移后至少要验证首屏骨架、关键按钮、标题、模块区块、弹窗宿主或核心容器是否正常回显 -->
require_shell_headline_button_module_and_modal_host_checks_after_vue_page_migration

<!-- 页面测试必须留下截图、result.json、日志或等价结构化证据 -->
require_structured_visual_evidence_for_vue_page_test

<!-- 页面测试优先调用标准页面测试能力，不得只靠 DOM 存在或构建通过宣称页面已验证 -->
prefer_standard_page_visual_test_ability_for_vue_page_test

## 页面结合测试规则
<!-- 页面结合测试必须覆盖真实页面与至少一个相邻层依赖，例如后端接口、桥接参数、缓存回写或跨页面入口 -->
require_real_page_plus_neighbor_dependency_for_vue_page_integration_test

<!-- 对依赖 URL bridge、bootstrap、选中态、生成链、弹窗链或跨模块入口的页面，迁移后必须补页面结合测试 -->
require_page_integration_test_for_vue_pages_depending_on_bridge_bootstrap_selection_generation_or_modal_flow

<!-- 当改动同时触达前端 request/service、后端响应契约、bootstrap 数据、bridge 参数或 generation-job 回显链路时，必须执行真实前后端联动测试，不能只做页面壳检查或 mock 页面结合测试 -->
require_real_frontend_backend_integration_test_when_vue_change_touches_api_contract_bootstrap_bridge_or_generation_flow

<!-- 前后端联动测试必须通过真实页面调用真实后端接口或等价的真实联调环境，并核对页面可见结果是否与接口返回和业务前置条件一致 -->
require_real_backend_or_equivalent_integrated_environment_for_vue_frontend_backend_test

<!-- 前后端联动测试必须记录真实 URL、关键前置数据、触发动作、主要接口或契约场景、页面可见结果以及 result.json 或截图证据路径 -->
require_url_preconditions_actions_contract_and_evidence_for_vue_frontend_backend_integration_test

<!-- 当前后端联动测试失败时，必须说明更像前端接线错误、后端数据问题、前后端契约不一致还是测试夹具缺失，禁止只写联动失败 -->
require_failure_layer_attribution_for_vue_frontend_backend_integration_test

<!-- 页面结合测试必须说明主验证层为何选页面结合测试，而不是仅做组件测试或仅做接口测试 -->
require_primary_page_integration_test_explanation_for_vue_bug_fix

<!-- 页面结合测试必须记录触发动作、相邻层输入、页面可见结果和结构化证据路径 -->
require_actions_inputs_visible_result_and_evidence_for_vue_page_integration_test

<!-- 页面结合测试应优先核对 bridge 参数、bootstrap 数据、当前选中实体、关键动作按钮和主流程入口是否与页面可见状态一致 -->
prefer_bridge_bootstrap_selection_action_and_entry_alignment_checks_in_vue_page_integration_test

## 自动修复级别要求
<!-- 自动修复级别的 Vue 测试规范要求能够让代理判断问题复现、修复生效和相邻回归都已完成 -->
auto_bug_fix_validation_must_cover_repro_fix_and_regression_for_vue = true

<!-- 自动修复判断不能只依赖构建通过，必须有目标验证动作和结构化结果 -->
forbid_declaring_vue_bug_fixed_without_executable_verification

<!-- 自动修复类任务优先选择最小且稳定的测试入口，避免用脆弱的大而全流程代替目标验证 -->
prefer_smallest_stable_test_entry_for_vue_bug_fix

<!-- 自动修复类任务完成时，验证输出中至少要体现复现证据、修复证据和回归证据三部分 -->
require_repro_fix_regression_evidence_triplet_for_vue_auto_bug_fix = true

<!-- 复现证据应明确失败页面、失败参数、失败按钮、失败文案、失败截图或失败日志中的至少一类 -->
require_explicit_failure_target_in_vue_repro_evidence

<!-- 修复证据应直接对应同一入口、同一参数或同一操作后的通过结果，避免用无关页面替代 -->
require_same_entry_or_same_action_success_evidence_for_vue_fix_validation

<!-- 回归证据至少覆盖一项相邻链路，例如 bridge 后续模块、保存按钮、生成动作、弹窗关闭或选中态保持 -->
require_neighbor_flow_regression_evidence_for_vue_bug_fix

<!-- 当页面问题本质是视觉或交互问题时，不得只用单元测试替代真实页面验证 -->
forbid_replacing_real_page_evidence_with_unit_test_for_visual_or_interactive_vue_bug

## 禁止事项
<!-- 禁止改完 Vue bug 后只看构建成功就宣称已修复 -->
forbid_build_only_as_vue_bug_fix_evidence

<!-- 禁止只跑全量大测试而没有与当前问题直接对应的目标测试 -->
forbid_full_suite_only_without_targeted_vue_test

<!-- 禁止在没有说明原因的情况下跳过失败复现而直接声称修复 -->
forbid_skipping_repro_without_reason_in_vue_bug_fix

<!-- 禁止在本文件中重复声明启动协议或通用编码规范 -->
forbid_redeclare_protocol_or_vue_coding_rules_in_vue_test_rules
