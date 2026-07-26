# SELPLAT 真实数据集成测试规则

## 说明

<!-- 问题：只使用 Mock、反射或手工返回结果的测试无法证明 SELPLAT 的 Service、DAO、SQL、数据库事务和真实表数据能够协同运行。 -->
<!-- 场景：SELPLAT 任意 apps/<app> 或 shared/backend/<module> 修改查询、新增、更新、假删除、分页、排序、事务、发号或数据库映射能力。 -->
<!-- 业务含义：本规则借鉴 Fujitsu 的真实数据库测试形式，但只适用于 SELPLAT 工程及其内部应用，不提升为跨工程通用规则，也不继承 Fujitsu 的表名和 Case 编号。 -->

selplat_real_database_test_scope = apps/<app>/backend,shared/backend/<module>
selplat_real_database_rule_is_cross_project_common = false
selplat_real_database_rule_is_fujitsu_rule = false

## 绝对真实数据测试

<!-- 数据库相关正常业务必须启动完整 Spring 容器并调用真实 Service、DAO、SQL 构建器和 JDBC；业务含义是测试结果必须来自生产调用链而不是测试替身。 -->
selplat_database_normal_flow_must_use_real_chain = SpringContext,Service,Dao,SqlBuilder,Jdbc,Database

<!-- 真实数据验收禁止用 Mock、Spy、反射或预设返回值替代被测数据库正常链路；业务含义是模拟成功只能作为局部单元测试，不能作为数据库功能完成证据。 -->
selplat_real_database_completion_forbids_test_double = Mock,Spy,reflection,stubbed_query_result,stubbed_update_count

<!-- 现有单元测试可以保留用于局部边界，但数据库功能交付必须至少有一个独立真实数据用例；业务含义是单元测试与真实数据库证据并存，不能互相替代。 -->
selplat_unit_test_does_not_replace_real_database_test = true

<!-- 真实数据库测试只能使用可重建、与共享环境隔离的测试库；当前 SELPLAT 默认使用由正式 schema 初始化的 H2 内存库。 -->
selplat_real_database_must_be_isolated_and_rebuildable = schema_initialized_H2_or_equivalent_isolated_test_database

## Fixture 与 Case 隔离

<!-- 普通真实数据必须维护在测试类名目录下的独立 SQL fixture 中，不得散落为测试 Java 内的准备 SQL；业务含义是只看资源路径即可直接定位唯一测试类和测试方法。 -->
selplat_real_fixture_path_pattern = apps/<app>/backend/src/test/resources/fixtures/<TestClassName>/<testMethodName>.sql
selplat_shared_real_fixture_path_pattern = shared/backend/<module>/src/test/resources/fixtures/<TestClassName>/<testMethodName>.sql

<!-- fixture 的一级目录必须使用实际测试类简单名称，禁止使用 app、domain、生产类或 user 等间接分类；业务含义是目录可直接反查 Java 测试类。 -->
selplat_fixture_directory_name = exact_test_class_simple_name

<!-- fixture 文件名必须使用实际测试方法名并保持 Java lowerCamelCase；业务含义是路径第二级可直接定位唯一测试 Case。 -->
selplat_fixture_file_name = exact_test_method_name.sql

<!-- 一份 fixture 原则上只归属于一个测试方法；同一建表或数据场景被多个方法使用时必须分别维护各自文件，禁止共享路径造成归属不明。 -->
selplat_fixture_owner = one_test_class_and_one_test_method

<!-- fixture 首行注释必须写明 TestClassName.testMethodName Case；业务含义是脱离目录查看文件时仍能确认唯一使用方。 -->
selplat_fixture_header_owner = TestClassName.testMethodName

<!-- 测试方法正文只保留一次当前 Case 验证器调用；业务调用、数据库期待查询和断言集中到同域测试验证器，避免测试方法混入数据准备和重复结果提取。 -->
selplat_test_method_body = one_case_verifier_call

<!-- 断言不得因为测试方法简化而删除；业务含义是 fixture 只提供输入，验证器仍必须比较服务结果和独立数据库状态。 -->
selplat_case_verifier_must_keep_assertions = true

<!-- shared 公共模块的正常数据库路径必须使用真实 H2、正式生产类和真实 SQL；缓存竞争、乐观锁冲突、重试耗尽和结构继承等无法仅靠普通数据稳定制造的边界允许使用可控替身或反射。 -->
selplat_shared_normal_database_flow = real_H2_real_production_class_real_SQL
selplat_shared_controlled_double_allowed_scope = concurrency_conflict,retry_exhaustion,structural_inheritance,pure_controller_delegation

<!-- 每个 fixture 必须先清理本 Case 会修改的全部表，再插入完整且满足正式表约束的数据；业务含义是测试结果不继承应用初始化数据或其他用例残留。 -->
selplat_real_fixture_case_isolation = delete_all_mutable_case_tables_then_insert_complete_rows

<!-- fixture 表结构和字段必须以当前应用正式 schema 为事实来源；业务含义是缺表、错列和非空字段缺失属于测试数据错误，不能当成业务异常覆盖。 -->
selplat_fixture_schema_source = apps/<app>/backend/src/main/resources/schema-<app>.sql

<!-- 排序、筛选和条件分支的 fixture 必须让不同候选规则产生不同结果；业务含义是 sortnum 测试中的 id 顺序不能与 sortnum 顺序相同。 -->
selplat_fixture_must_discriminate_target_behavior = true

## 数据库期待结果与事务

<!-- 测试必须通过 JdbcTemplate 或等价真实数据库入口读取最终表状态或独立期待 SQL，并与被测链路返回比较；业务含义是断言依据来自数据库而不是复制实现代码。 -->
selplat_real_database_assertion_source = database_expected_query_or_table_state_diff

<!-- 固定千条分组的批处理必须使用至少一千零一条真实数据覆盖跨组边界，并核对完整影响行数和最终表状态；业务含义是测试必须证明第二组被实际处理，不能只验证单组样本。 -->
selplat_batch_group_boundary_real_data_case_size = 1001

<!-- 批量写入必须使用真实约束制造中途失败并核对数据库没有部分提交；业务含义是 Service 事务必须覆盖全部分组和全部记录。 -->
selplat_batch_write_transaction_rollback_test = real_database_constraint_failure_then_zero_partial_commit

<!-- 批量性能语义必须由生产实现中的 JDBC batch 调用和跨组真实数据用例共同证明，禁止用循环单条调用的成功结果作为批处理证据。 -->
selplat_batch_completion_requires_true_jdbc_batch = true

<!-- 公共 JDBC 执行器必须通过 Spring DataSourceUtils 获取和释放连接；业务含义是 fixture、业务 SQL 和期待查询在事务测试中观察同一数据状态。 -->
selplat_jdbc_executor_transaction_connection = DataSourceUtils.getConnection_and_releaseConnection

<!-- 当前 SELPLAT 通用持久层使用注解式 BaseTemplateDao 和 JDBC 查询链路；没有实际调用入口的历史 XML Mapper 必须删除，禁止为了测试启动保留失效类型别名或旧 SQL。 -->
selplat_current_mapper_form = annotation_BaseTemplateDao_and_Jdbc
selplat_obsolete_unreferenced_xml_mapper_must_be_removed = true

## 分页和完成证据

<!-- getStore 使用公共默认排序时必须调用 BaseDao 三参数 getPageList，由基础实现唯一维护 sortnum desc；业务含义是应用 Service 不再重复指定排序表达式。 -->
selplat_get_store_default_sort_entry = BaseDao.getPageList(queryColumnValueMap,pageNo,pageSize)
selplat_get_store_default_sort = sortnum_desc

<!-- 真实数据库测试完成证据至少包含实际执行用例数、fixture 路径、真实 SQL 结果或表状态断言以及完整测试任务结果。 -->
selplat_real_database_completion_evidence = executed_case_count,fixture_path,database_expected_result,full_test_task_result

<!-- 覆盖率必须由 JaCoCo 或等价真实执行报告测量；Case 数量和 fixture 数量不得被表述成覆盖率。 -->
selplat_coverage_must_use_execution_report = jacoco_or_equivalent

<!-- 当前用户业务执行覆盖范围逐类包含 Controller、ServiceImpl 和 DaoImpl；纯实体 getter、接口和启动 main 不得混入业务覆盖率口径。 -->
selplat_user_business_execution_coverage_scope = Controller,ServiceImpl,DaoImpl

<!-- 纳入覆盖门禁的用户业务执行类要求行覆盖 100%，包含业务分支的 ServiceImpl 同时要求分支覆盖 100%。 -->
selplat_user_business_execution_line_coverage = 100_percent_each_class
selplat_service_business_branch_coverage = 100_percent

<!-- shared 核心门面按模块分别执行覆盖门禁；业务含义是公共 DAO、基础 Service、公共发号和公共控制器的覆盖缺口不能被其他简单类平均稀释。 -->
selplat_shared_core_coverage_scope = BaseDaoImpl,BaseServiceImpl,SequenceGeneratorImpl,BaseExtendsController
selplat_shared_core_line_coverage = 100_percent_each_class

<!-- sharedRegression 是 shared 后端统一回归入口，必须包含 common-core、common-db、common-service 和 common-web 的测试及覆盖门禁。 -->
selplat_shared_regression_task = sharedRegression
