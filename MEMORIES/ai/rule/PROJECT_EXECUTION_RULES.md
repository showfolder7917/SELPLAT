# Project Execution Rules

## 说明

- 这是项目执行层的规则文件
- 本文件承接项目执行层的正式执行规则
- 本文件使用结构化规则写法，不重复声明启动层和协议层已声明约束

## 项目上下文（Project Context）

<!-- 默认项目目录 -->
default_project_root=.

<!-- 当前主要项目 -->
primary_project=SELFSP

<!-- 项目目录说明 -->
project.SELFSP=main_application_codebase

<!-- 独立测试运行目录 -->
project.test_run=independent_test_runtime

## 强制规则（Mandatory）

<!-- 默认先在项目内查找现有实现 -->
prefer_existing_implementation_first

<!-- 修改前优先确认目标目录和现有风格 -->
confirm_target_directory_and_style_before_modify

<!-- 新增文件时尽量保持包结构清晰 -->
keep_package_structure_clear_when_adding_files

<!-- 内容归属目录不明确时先询问再建 -->
ask_before_create_when_directory_ownership_is_unclear

<!-- 用户明确要求最终直接交付成果且不要中途讨论时 执行过程应连续推进到收口；适用于连续执行型项目任务；业务含义是减少过程性打断并把结果集中一次性交付 -->
must_execute_continuously_until_final_delivery_when_user_requests_no_midway_discussion = true

<!-- 连续交付型项目任务开始后 必须先建立执行文档 再补任务缺口 再完成回归测试 页面测试和联动验证 最后一次性交付；适用于文档完善与代码实现类项目任务；业务含义是把执行顺序固定为可追踪 可验证 可收口的流水线 -->
continuous_delivery_task_required_sequence = execution_doc_first,gap_closure_then_regression_page_integration_tests,final_single_delivery

<!-- 每个 Codex 任务页面必须保存独立的执行步骤和归档记录；适用于用户同时打开多个任务页面的场景；业务含义是避免页面之间的未完成状态、历史记录和锁文件相互覆盖或阻塞 -->
execution_document_must_be_isolated_by_current_thread = true

<!-- 当前线程执行文档采用带线程标识的文件名；适用于 execution_doc_manager 维护项目 OPTION 目录时；业务含义是让执行记录的归属可直接从文件名辨识 -->
execution_document_filename = 执行文档.<CURRENT_THREAD_ID>.md

<!-- 同日归档必须同时包含线程标识；适用于多个任务页面在同一天完成任务时；业务含义是保证历史记录不会跨页面混写 -->
execution_history_filename = 执行文档.history_YYYY-MM-DD.<CURRENT_THREAD_ID>.md

<!-- 旧的无线程执行文档只能在首次调用时迁移到当前线程文件；适用于能力升级后的兼容迁移；业务含义是保留原有任务且终止旧共享入口 -->
legacy_execution_document_must_migrate_once_to_current_thread = true

## 禁止事项（Forbidden）

<!-- 禁止随意改动无关文件 -->
forbid_unrelated_file_changes

<!-- 用户已明确要求最终一次性交付时 禁止在无硬阻塞情况下中途停下来征求过程性确认或讨论；适用于已授权执行的连续项目任务；业务含义是避免把执行过程拆成多轮确认导致交付中断 -->
forbid_midway_process_discussion_without_hard_blocker_after_continuous_delivery_authorization = true
