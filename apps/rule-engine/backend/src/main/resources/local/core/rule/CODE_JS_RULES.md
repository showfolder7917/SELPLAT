# Code JS Rules

## 说明

- 这是编码主题下的 JavaScript 规则文件
- 本文件承接 JavaScript 主题的正式规则
- 本文件使用结构化规则写法，不重复声明启动层和协议层已声明约束

## 强制规则（Mandatory）

<!-- 修改前先确认目标文件和目标目录 -->
confirm_target_file_and_directory_before_js_change

<!-- JavaScript 任务优先保持项目现有结构与风格 -->
prefer_existing_project_structure_and_style_for_js_tasks

<!-- 优先先阅读已有实现，再新增模块 -->
read_existing_js_implementation_before_new_module

<!-- 优先保持现有项目代码风格一致 -->
keep_existing_js_style_consistent

<!-- 非必要不引入复杂抽象 -->
avoid_unnecessary_js_abstraction

<!-- 改完后尽量补最基本测试或验证步骤 -->
add_basic_js_test_or_verification_after_change

<!-- 项目有 ESLint 或 Prettier 时优先遵循 -->
prefer_existing_eslint_or_prettier_conventions

<!-- 项目没有明确配置时优先使用一致清晰可维护的风格 -->
prefer_consistent_clear_maintainable_js_style_when_project_has_no_config

## 通用规范（General Conventions）

<!-- 优先使用 const，其次 let，避免使用 var -->
prefer_const_then_let_avoid_var

<!-- 比较运算优先使用严格相等 -->
prefer_strict_equality_for_js_comparisons

<!-- 变量名和函数名优先使用 camelCase -->
prefer_camel_case_for_js_variables_and_functions

<!-- 类名优先使用 PascalCase -->
prefer_pascal_case_for_js_classes

<!-- 导入顺序保持稳定并优先分组组织 -->
keep_js_import_order_stable_and_grouped

<!-- 避免未使用变量、未使用导入和死代码 -->
avoid_unused_variables_imports_and_dead_code

## 代码组织规则（Structure Rules）

<!-- 优先早返回减少多层嵌套 -->
prefer_early_return_to_reduce_nesting

<!-- 函数职责尽量单一 -->
keep_js_function_responsibility_single

<!-- 错误处理必须明确 -->
require_explicit_error_handling_in_js

<!-- 异步逻辑优先使用 async await -->
prefer_async_await_for_js_async_logic

<!-- 非必要不要混用多种异步风格 -->
avoid_mixing_multiple_js_async_styles_without_need

## 注释规则（Comment Rules）

<!-- 新增或修改的 JavaScript 业务代码必须用中文说明业务意图 覆盖接口调用 缓存读写 状态变更 分支判断 回显和流式输出等关键行或关键逻辑块 -->
require_business_intent_comments_for_new_or_modified_js_business_code

<!-- 用户明确要求逐行详细注释时 JavaScript 代码必须按业务语义做到逐行级说明 覆盖导入 状态字段 返回结构 关键赋值和分支 禁止机械复述语法 -->
require_line_level_business_comments_for_js_when_user_requests_detailed_comments

<!-- 当用户明确要求每行写业务注释时 本轮新增或重构的 JavaScript 文件必须补齐逐行业务注释后才能收口 -->
require_line_level_business_comments_for_refactored_js_before_closeout_when_user_explicitly_requests_it

<!-- JavaScript 注释必须解释业务目的 不得只复述变量 函数名或语法动作 -->
js_comments_must_explain_business_purpose_not_repeat_syntax_or_names

## 场景规则（Scenario Rules）

<!-- React 组件名使用 PascalCase -->
use_pascal_case_for_react_component_names

<!-- React Hooks 必须以 use 开头 -->
require_react_hooks_to_start_with_use

<!-- 不要在渲染过程中写过重计算逻辑 -->
avoid_heavy_computation_during_render

<!-- Node.js 脚本优先复用现有入口和目录结构 -->
prefer_existing_entry_and_structure_for_node_scripts

<!-- Vue 任务应切换加载新的 Vue 编码规则；涉及架构拆分和测试闭环时再额外加载对应 Vue 规则 -->
load_vue_rule_for_vue_sfc_or_vue_project_task = CODE_VUE_CODING_RULES

## 禁止事项（Forbidden）

<!-- 禁止随意改动无关文件 -->
forbid_unrelated_js_file_changes

<!-- 禁止写死绝对路径 -->
forbid_hardcoded_absolute_paths_in_js_changes

<!-- 禁止在规则层重复声明启动层和协议层通用约束 -->
forbid_redeclare_starter_or_protocol_level_constraints
