# Code Java Coding Rules

## 目标
- 本文件定义 Java 通用编码规范、注释规范、Javadoc 规范、命名规范与通用编码约束
- 本文件不承担 Java 后端工程分层、主键策略、启动生命周期等项目架构职责
- 本文件不承担 Java 测试策略主规范，测试闭环与 bug 修复验证规则以 `CODE_JAVA_TEST_RULES.md` 为准

## 必须遵守
<!-- 修改 Java 文件前，必须先确认目标文件和目录，避免在错误包路径或错误模块下改动 -->
confirm_target_file_and_directory_before_java_change

<!-- Java 编码任务优先复用现有项目的风格和实现方式，不允许无必要地引入新流派 -->
prefer_existing_project_structure_and_style_for_java_tasks

<!-- Java 包名必须和目录结构一致，避免包路径和物理目录脱节 -->
keep_java_package_name_consistent_with_directory

<!-- Java 代码修改后必须与现有代码风格保持一致，包括缩进、命名和组织方式 -->
keep_existing_java_style_consistent

<!-- Java 实现应避免无必要抽象，优先直接、可运行、可维护的实现 -->
avoid_unnecessary_java_abstraction

<!-- Java 文件操作优先使用 java.nio.file 体系，避免继续扩散旧式 IO 用法 -->
prefer_java_nio_file_for_file_operations

<!-- Java 代码改动默认要求中文业务注释，便于后续工程代理与人员共同维护 -->
require_chinese_comments_for_java_code_changes

## 编码规则
<!-- Java 代码应优先保持简单直接和可运行，不输出伪代码或残缺片段 -->
prefer_simple_direct_runnable_java_code

<!-- Java 代码输出必须完整，不能省略 import、关键类型或关键异常路径 -->
output_complete_java_code_without_omitting_imports_or_using_pseudocode

<!-- Java 工具类在适合静态方法时优先保持无状态实现，避免无意义实例化 -->
prefer_static_methods_for_java_utility_classes

<!-- Java 代码中必须显式处理异常路径，不能把关键异常处理留给隐式默认行为 -->
require_explicit_java_exception_handling

<!-- Java 业务代码记录运行信息时优先使用日志框架，不用 System.out 作为正式方案 -->
prefer_logging_framework_over_system_out

## 注释规则
<!-- Java 代码改动必须补充注释，至少要说明业务意图或关键约束 -->
require_comments_for_java_code_changes

<!-- 新增或修改业务代码时，必须写清楚业务目的和边界，而不是只解释语法动作 -->
require_business_intent_comments_for_new_or_modified_java_business_code

<!-- 当用户要求详细注释时，Java 代码需要下沉到逐行或逐块业务说明粒度 -->
require_line_level_business_comments_for_java_when_user_requests_detailed_comments

<!-- Java 变更后的 Javadoc 必须符合 checkstyle 约束，避免只补业务逻辑不补文档 -->
require_checkstyle_compliant_javadoc_after_java_changes

<!-- Entity 和 DTO 字段在信息含义不直观时，优先在字段上方补双斜线业务注释 -->
prefer_double_slash_comments_above_java_fields_in_entity_and_dto

<!-- Java 方法注释优先多行展开，避免把关键说明压缩成模糊单行 -->
write_java_method_comments_in_multiple_lines

<!-- 方法、构造器和 throws 场景优先使用 Javadoc，便于 IDE 和检查工具读取 -->
prefer_javadoc_for_java_methods_constructors_and_throws

<!-- ServiceImpl 中的重要业务判断、状态迁移和边界处理必须写解释性注释 -->
require_explanatory_comments_for_key_logic_blocks_in_java_service_impl

<!-- 复杂注释优先拆行或分点，避免写成长段难读注释 -->
prefer_split_lines_or_bullets_for_complex_java_comments

<!-- Java 文件如需文件头说明，应放在 package 之前，保持统一读取顺序 -->
prefer_java_file_header_comment_above_package

<!-- 文件头元信息应尽量使用统一格式，避免每个文件各写一套 -->
prefer_standard_java_file_header_metadata

<!-- 需要保留改动历史时，使用统一时间戳格式记录，避免随意书写 -->
record_java_modification_history_with_timestamp

## 场景规则
<!-- Java 业务代码中如需统一返回结构，应遵守项目已有响应封装，不额外创造响应风格 -->
prefer_unified_java_response_structure

## 禁止事项
<!-- 禁止在正式 Java 业务代码中继续扩散 System.out.println -->
forbid_system_out_println_in_java_business_code

<!-- 禁止添加没有业务意义的注释，例如简单重复代码字面意思 -->
forbid_meaningless_java_comments

<!-- 禁止使用不符合项目约定的 Java 命名风格 -->
forbid_nonstandard_java_naming

<!-- 禁止在 Java 任务中顺手修改与目标无关的文件 -->
forbid_unrelated_java_file_changes

<!-- 禁止在本文件里重复声明启动协议或上层协议已经定义的通用约束 -->
forbid_redeclare_starter_or_protocol_level_constraints
