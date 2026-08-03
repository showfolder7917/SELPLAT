# Code Vue Coding Rules

## 目标
- 本文件定义 Vue 单文件组件、组合式 API、命名、注释和通用编码约束。
- 本文件只负责回答 Vue 代码应该怎么写、注释应该怎么落、关键逻辑应该怎么表达。
- Vue 工程分层与目录边界以 `CODE_VUE_FRONTEND_PROJECT_RULES.md` 为准，Vue 测试和自动修复 bug 验证以 `CODE_VUE_TEST_RULES.md` 为准。

## 必须遵守
<!-- 修改 Vue 文件前，必须先确认目标文件和目标目录，避免在错误层级下继续追加代码 -->
confirm_target_file_and_directory_before_vue_change

<!-- Vue 任务优先保持项目现有结构、现有风格和现有实现方式，不无必要引入新流派 -->
prefer_existing_project_structure_and_style_for_vue_tasks

<!-- 优先先阅读已有 Vue 实现，再新增组件、状态块或模块 -->
read_existing_vue_implementation_before_new_component

<!-- 优先复用项目现有构建工具、入口文件和目录结构 -->
prefer_existing_build_tool_and_entry_structure_for_vue_project

<!-- Vue 代码改完后必须补最基本验证步骤，不能只靠静态阅读结束 -->
add_basic_vue_verification_after_change

## 通用规范
<!-- 单文件组件结构保持 template script style 顺序一致 -->
keep_vue_sfc_structure_consistent_template_script_style_order

<!-- 项目已使用 script setup 时优先保持一致 -->
prefer_script_setup_when_project_uses_it

<!-- props 和 emits 优先显式声明 -->
prefer_props_and_emits_to_be_explicit

<!-- 禁止直接修改 props -->
avoid_mutating_props_directly

<!-- 模板中的复杂派生逻辑优先提到 computed -->
prefer_computed_over_template_inline_complex_logic

<!-- watch 只用于副作用，不用于纯派生 -->
prefer_watch_only_for_side_effects_not_derivation

<!-- 非必要不要使用 deep watch -->
avoid_deep_watch_without_clear_need

<!-- v-if 和 v-for 不要放在同一个元素上 -->
prefer_v_if_and_v_for_not_on_same_element

<!-- 组件文件名和组件名优先使用 PascalCase -->
prefer_pascal_case_for_component_files_and_component_names

<!-- props emits composables 优先使用 camelCase -->
prefer_camel_case_for_props_emits_and_composables

<!-- 导入顺序保持稳定并优先分组组织 -->
keep_vue_import_order_stable_and_grouped

<!-- 避免未使用组件导入和死代码 -->
avoid_unused_components_imports_and_dead_code_in_vue_files

## 编码规则
<!-- Vue 代码应优先保持简单直接和可运行，不输出伪代码或残缺片段 -->
prefer_simple_direct_runnable_vue_code

<!-- Vue 页面和组件里的业务分支、状态迁移和回显逻辑必须清楚表达，不依赖隐式副作用猜测 -->
require_explicit_business_flow_in_vue_state_and_render_logic

<!-- 前端接口调用、缓存读写、桥接参数和进度状态变更必须显式表达输入输出边界 -->
require_explicit_input_output_boundary_for_vue_api_cache_bridge_and_progress_logic

## 注释规则
<!-- 新增或修改的 Vue 业务代码必须用中文说明业务意图，覆盖接口调用、缓存读写、状态变更、分支判断、页面回显和流式输出等关键行或关键逻辑块 -->
require_business_intent_comments_for_new_or_modified_vue_business_code

<!-- 当用户明确要求详细业务注释时，Vue 代码必须按业务语义做到逐行级说明，禁止机械复述模板或脚本语法 -->
require_line_level_business_comments_for_vue_when_user_requests_detailed_comments

<!-- 当任务目标包含“为后续代理自动修复 bug 提供足够上下文”时，新增或修改的关键业务逻辑默认要求逐行或逐语义段落级中文注释 -->
require_line_level_or_semantic_block_comments_for_vue_code_when_auto_bug_fix_context_is_requested

<!-- Vue 注释必须解释组件、页面、状态或服务调用的业务目的，不得只复述变量名、函数名或模板语法 -->
vue_comments_must_explain_business_purpose_not_repeat_syntax_or_names

<!-- 关键业务代码的注释必须写清楚触发条件、依赖数据、写回结果和用户可见影响 -->
require_trigger_input_writeback_and_visible_effect_comments_for_key_vue_logic

<!-- 只允许在关键业务行或关键业务块添加高密度注释，禁止为了凑行数写无意义逐词注释 -->
forbid_meaningless_line_by_line_comments_without_business_value_in_vue_code

## 场景规则
<!-- 模板优先使用语义化且可访问的标记 -->
prefer_accessible_semantic_markup_in_template

<!-- 项目使用局部样式时优先保持 scoped style -->
prefer_scoped_style_when_project_uses_local_component_styles

<!-- 生成型前端链路注释必须解释触发条件、上下文来源、覆盖策略、后端或生成器调用、落库结果和前端回显 -->
explain_generation_flow_trigger_context_override_backend_result_and_frontend_echo

<!-- 前端缓存、接口、状态同步、进度窗和流式输出代码变更时，必须说明该行或逻辑块影响的业务数据和用户可见状态 -->
explain_business_data_and_visible_state_for_frontend_cache_api_sync_progress_and_streaming_changes

## 禁止事项
<!-- 禁止随意改动无关 Vue 文件 -->
forbid_unrelated_vue_file_changes

<!-- 禁止写死绝对路径 -->
forbid_hardcoded_absolute_paths_in_vue_changes

<!-- 禁止在正式业务代码里添加没有业务意义的注释 -->
forbid_meaningless_vue_comments

<!-- 禁止在本文件里重复声明启动层、项目架构层或测试闭环层的规则 -->
forbid_redeclare_protocol_vue_architecture_or_vue_test_constraints_in_vue_coding_rules
