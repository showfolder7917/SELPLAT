# Code Python Rules

## 说明

- 这是编码主题下的 Python 规则文件
- 本文件承接 Python 主题的正式规则
- 本文件使用结构化规则写法，不重复声明启动层和协议层已声明约束

## 强制规则（Mandatory）

<!-- 修改前先确认目标文件和目标目录 -->
confirm_target_file_and_directory_before_python_change

<!-- Python 任务优先保持项目现有结构与风格 -->
prefer_existing_project_structure_and_style_for_python_tasks

<!-- 优先先阅读已有实现，再新增模块 -->
read_existing_python_implementation_before_new_module

<!-- 优先保持现有项目代码风格一致 -->
keep_existing_python_style_consistent

<!-- 非必要不引入复杂抽象 -->
avoid_unnecessary_python_abstraction

<!-- 改完后尽量补最基本测试或验证步骤 -->
add_basic_python_test_or_verification_after_change

<!-- 新增或修改 Python 代码默认要求中文注释 -->
require_chinese_comments_for_new_or_modified_python_code

## 注释规则（Comment Rules）

<!-- 学习型样板和技能库样板优先逐行中文注释 -->
prefer_line_by_line_chinese_comments_for_learning_or_library_samples

<!-- 普通业务代码至少解释关键逻辑、返回结果和复杂分支 -->
comment_key_logic_return_values_and_complex_branches

<!-- 新增或修改的 Python 业务代码必须用中文说明业务意图 覆盖接口调用 文件读写 状态变更 分支判断 外部命令调用和结果回写等关键行或关键逻辑块 -->
require_business_intent_comments_for_new_or_modified_python_business_code

<!-- 用户明确要求逐行详细注释时 Python 代码必须按业务语义做到逐行级说明 禁止机械复述语法 -->
require_line_level_business_comments_for_python_when_user_requests_detailed_comments

<!-- 单行语句优先在行尾或上一行补中文说明 -->
prefer_inline_or_previous_line_comment_for_single_line_python_statement

<!-- 多行逻辑优先在逻辑块前补简要中文说明 -->
prefer_block_comment_before_multi_line_python_logic

<!-- 注释必须解释作用，不只重复变量或函数名 -->
comments_must_explain_purpose_not_repeat_names

## 编码规则（Coding Rules）

<!-- 文件路径优先使用 pathlib -->
prefer_pathlib_for_python_paths

<!-- 能写清楚类型时优先补类型标注 -->
prefer_type_hints_when_types_are_clear

<!-- 测试优先使用项目现有方案；若无约定，优先使用 pytest -->
prefer_existing_test_solution_or_pytest

<!-- 导入顺序、命名方式和空行规则优先遵循 PEP 8 -->
follow_pep8_for_import_naming_and_spacing

## 禁止事项（Forbidden）

<!-- 禁止随意改动无关文件 -->
forbid_unrelated_python_file_changes

<!-- 禁止写死绝对路径 -->
forbid_hardcoded_absolute_paths_in_python_changes

<!-- 禁止在规则层重复声明启动层和协议层通用约束 -->
forbid_redeclare_starter_or_protocol_level_constraints
