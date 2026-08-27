# Code Java Backend Project Rules

## 说明

- 这是编码主题下的 Java 后端项目规则文件
- 本文件承接 Java 后端工程实现层的正式规则
- 本文件用于约束 Spring Boot、MyBatis、SQL、数据库主键策略、分层边界等项目实现细节
- 本文件不重复声明通用 Java 语言规则，通用注释和 Javadoc 规则以 `CODE_JAVA_CODING_RULES.md` 为准，测试闭环规则以 `CODE_JAVA_TEST_RULES.md` 为准

## 强制规则（Mandatory）

<!-- 业务表主键默认统一由数据库生成 -->
prefer_database_identity_primary_keys_for_business_tables

<!-- 禁止在 service 层通过 max(id)+1 或手工计算生成业务表主键 -->
forbid_manual_primary_key_generation_in_java_service_layer

<!-- 使用数据库自增主键时 MyBatis insert 必须开启主键回填 -->
require_generated_keys_mapping_for_identity_primary_keys

<!-- 只有初始化种子数据或迁移脚本允许显式指定主键 -->
allow_explicit_ids_only_in_seed_or_migration_data

## 结构规则（Structure Rules）

<!-- Java 后端模块优先保持 controller service service_impl dao mapper entity in out 分层 -->
prefer_clear_layering_for_java_backend_modules

<!-- 聚合型 service 与领域写服务优先分离 -->
prefer_separating_overview_aggregation_from_domain_write_services

<!-- Dao 按领域拆分 不使用单一大而全 Dao -->
prefer_domain_split_dao_over_monolithic_dao

<!-- MyBatis mapper 文件应与 Dao 一一对应 -->
keep_mybatis_mapper_aligned_with_dao

## 数据规则（Data Rules）

<!-- 表结构规则要和 mapper 与 service 实现保持一致 -->
keep_schema_mapper_and_service_consistent

<!-- 初始化数据与运行时业务新增逻辑必须分开考虑 -->
separate_seed_data_strategy_from_runtime_write_strategy

<!-- 业务编号 code 可独立生成 但不得替代数据库主键 id -->
distinguish_business_code_from_database_primary_key

<!-- 教师 课件 学校等业务编号默认由后端基于数据库主键或统一规则自动生成 -->
prefer_backend_generated_business_codes_for_admin_entities

<!-- 业务编号字段需在数据库层保持唯一约束 -->
require_unique_constraint_for_business_code_fields

## 场景规则（Scenario Rules）

<!-- 新增业务表时优先直接采用数据库自增主键 -->
prefer_identity_primary_keys_when_adding_new_business_tables

<!-- 将手工主键改为数据库自增时 需要同步修改 schema mapper service 和测试 -->
update_schema_mapper_service_and_tests_when_migrating_to_identity_primary_keys

<!-- 本地后端启动脚本应与终端生命周期绑定 关闭脚本窗口时服务也必须停止 -->
bind_java_backend_local_server_lifecycle_to_terminal_session

<!-- 本地后端 command 启动脚本不得复用旧后端进程 应由当前脚本自行启动并托管服务生命周期 -->
prefer_backend_command_scripts_to_own_server_lifecycle

<!-- 本地后端 command 启动脚本在目标端口已有旧服务时 应先停止旧进程 再由当前脚本重新拉起并接管 -->
prefer_backend_command_scripts_to_replace_existing_port_process_before_start

<!-- 本地后端启动脚本启动时应明确打印项目目录和访问地址 -->
print_project_directory_and_access_url_in_java_backend_startup_scripts

<!-- 涉及数据库主键策略调整后必须执行编译 校验 和测试验证 -->
require_compile_coding_check_and_test_after_primary_key_strategy_change

<!-- 将业务编号改为后端自动生成时 需要同步修改 schema dao service 接口契约 和测试 -->
update_schema_dao_service_contracts_and_tests_when_migrating_business_codes_to_backend_generation

## 禁止事项（Forbidden）

<!-- 禁止在业务新增流程里手工指定数据库主键 -->
forbid_manual_assignment_of_business_primary_keys_on_runtime_create

<!-- 禁止把数据库主键生成逻辑散落在多个 service 实现里 -->
forbid_scattered_primary_key_generation_logic_across_services

<!-- 禁止在新增或更新流程中默认要求前端手工输入业务编号 -->
forbid_requiring_frontend_manual_business_code_input_by_default

<!-- 禁止在默认本地启动脚本中使用 nohup 等使后端服务脱离会话 -->
forbid_detaching_java_backend_server_from_terminal_session_by_default

<!-- 禁止本地后端 command 启动脚本直接复用已运行旧服务后退出 否则关闭脚本窗口时无法停止服务 -->
forbid_reusing_existing_backend_server_without_lifecycle_ownership

<!-- 禁止本地后端 command 启动脚本在检测到旧端口进程后仍保留旧服务继续运行并退出当前脚本 -->
forbid_leaving_existing_backend_port_process_running_when_command_should_own_lifecycle
