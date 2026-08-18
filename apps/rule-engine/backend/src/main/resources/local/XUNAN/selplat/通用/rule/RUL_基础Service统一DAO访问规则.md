# 基础 Service 统一 DAO 访问规则

<!-- 问题：每个业务 ServiceImpl 重复保存 DAO 字段并声明 DAO 构造函数，会让基础持久层入口分散，增加跨模块样板代码和注入方式差异。 -->
<!-- 场景：SELPLAT 任意业务 ServiceImpl 需要调用继承 BaseDao 的业务 DAO 接口。 -->
<!-- 业务含义：DAO 依赖由公共基础 Service 按业务泛型统一装配，业务 Service 只通过 getDao() 使用 BaseDao 门面能力。 -->

<!-- BaseServiceImpl 必须以 D extends BaseDao 声明 DAO 泛型，并由 Spring 在基础类中统一注入当前业务 DAO。 -->
selplat_base_service_impl_signature = BaseServiceImpl<D extends BaseDao>

<!-- 简单单表业务的分页、查询、写入和假删除接口只能由 BaseService 统一声明；适用于 BaseController、业务 Service 接口和 BaseServiceImpl；业务含义是公共 Service 只有一个稳定契约入口。 -->
selplat_base_service_public_contract_owner = BaseService

<!-- 禁止为了区分 CRUD 与非 CRUD 再创建 BaseCrudService 等平行基础接口；适用于 shared 公共 Service 维护；业务含义是相同 CRUD 契约不得出现两个继承入口。 -->
selplat_parallel_base_crud_service_interface_is_forbidden = BaseCrudService

<!-- 元数据浏览、SQL 执行等不提供简单单表 CRUD 的服务不得继承 BaseService；适用于 MDA JdbcMetadataService、JdbcSqlService 等工具服务；业务含义是非 CRUD 服务不会被迫实现或意外暴露数据维护能力。 -->
selplat_non_crud_service_must_not_extend_base_service = true

<!-- 基础 Service 只允许通过受保护的强类型 getDao() 向业务子类提供 DAO；业务含义是外部调用方不能越过 Service 直接取得持久层对象。 -->
selplat_base_service_dao_accessor = protected D getDao()

<!-- 业务 ServiceImpl 必须在继承处绑定自己的 DAO 接口，例如 BaseServiceImpl<UniauthUserDao>；禁止绑定 DAO 实现类或原始 BaseDao。 -->
selplat_application_service_dao_binding = BaseServiceImpl<ApplicationDaoInterface>

<!-- 业务 ServiceImpl 不得重复声明 DAO 字段、DAO setter 或包含 DAO 的构造函数；适用于全部简单单表业务服务；业务含义是 DAO 装配只有基础类一个维护入口。 -->
selplat_application_service_must_not_declare_dao_dependency = field
<!-- selplat_application_service_must_not_declare_dao_dependency.2 的当前独立事实为 setter。 -->
selplat_application_service_must_not_declare_dao_dependency.2 = setter
<!-- selplat_application_service_must_not_declare_dao_dependency.3 的当前独立事实为 constructor。 -->
selplat_application_service_must_not_declare_dao_dependency.3 = constructor

<!-- 业务 ServiceImpl 调用持久层时必须使用 getDao() 的 BaseDao 公开能力，禁止直接访问基础类 DAO 字段或深层 DAO 实现。 -->
selplat_application_service_dao_call_form = getDao().BaseDaoPublicMethod

<!-- 发号器、远程客户端等非 DAO 依赖不得塞入 getDao()；适用于业务编排依赖；业务含义是 getDao() 始终只代表当前业务持久层门面。 -->
selplat_base_service_get_dao_scope = BaseDao_only

<!-- 公共发号器由 BaseExtendsServiceImpl 统一可选注入，并通过无参数 getSequence() 读取 BaseServiceImpl.getDao() 的主键号段定义；使用平台号段的模块必须提供 SequenceGenerator，使用数据库 identity 的独立控制库可以覆盖新增入口且不注册错误数据源的发号器。 -->
selplat_base_extends_service_sequence_entry = protected getSequence() -> SequenceGenerator.getSequence(getDao().getIdSequenceDefinition())
<!-- selplat_sequence_generator_requirement 的当前独立事实为 platform_sequence:required;database_generated_identity:not_required。 -->
selplat_sequence_generator_requirement = platform_sequence:required;database_generated_identity:not_required

<!-- 非分页成功结果必须由 BaseExtendsServiceImpl.buildSuccessResult 统一构建固定 CommonResult，并由 BaseServiceImpl 的默认 CRUD 调用；普通入口使用 data、message，写入入口增加已确认的 affectedRows 参数；业务含义是业务 Service 不再重复设置 success、data、affectedRows 和 msg。 -->
selplat_base_extends_service_success_result_entry = protected buildSuccessResult(data,message)
<!-- selplat_base_extends_service_success_result_entry.2 的当前独立事实为 protected buildSuccessResult(data,affectedRows,message) -> CommonResult。 -->
selplat_base_extends_service_success_result_entry.2 = protected buildSuccessResult(data,affectedRows,message) -> CommonResult

<!-- 业务 ServiceImpl 不得重复声明 SequenceGenerator 字段或 buildSuccessResult 实现；适用于继承 BaseServiceImpl 的全部模块；业务含义是公共依赖与公共返回构建只有一个维护入口。 -->
selplat_application_service_must_not_redeclare_common_service_capability = SequenceGenerator
<!-- selplat_application_service_must_not_redeclare_common_service_capability.2 的当前独立事实为 buildSuccessResult。 -->
selplat_application_service_must_not_redeclare_common_service_capability.2 = buildSuccessResult

<!-- BaseServiceImpl 统一提供简单单表模块的分页、详情、批量详情、新增、批量新增、更新、批量更新、假删除和批量假删除默认实现；适用于只需透传 CommonParam/CommonBatchParam 并调用 BaseDao 门面的业务；业务含义是 DAO 装配、getDao 与默认 CRUD 收口在业务类直接继承的稳定基础层。 -->
selplat_base_service_default_crud_capabilities = getStore
<!-- selplat_base_service_default_crud_capabilities.2 的当前独立事实为 getById。 -->
selplat_base_service_default_crud_capabilities.2 = getById
<!-- selplat_base_service_default_crud_capabilities.3 的当前独立事实为 getByIds。 -->
selplat_base_service_default_crud_capabilities.3 = getByIds
<!-- selplat_base_service_default_crud_capabilities.4 的当前独立事实为 insert。 -->
selplat_base_service_default_crud_capabilities.4 = insert
<!-- selplat_base_service_default_crud_capabilities.5 的当前独立事实为 insertBatch。 -->
selplat_base_service_default_crud_capabilities.5 = insertBatch
<!-- selplat_base_service_default_crud_capabilities.6 的当前独立事实为 update。 -->
selplat_base_service_default_crud_capabilities.6 = update
<!-- selplat_base_service_default_crud_capabilities.7 的当前独立事实为 updateBatch。 -->
selplat_base_service_default_crud_capabilities.7 = updateBatch
<!-- selplat_base_service_default_crud_capabilities.8 的当前独立事实为 delete。 -->
selplat_base_service_default_crud_capabilities.8 = delete
<!-- selplat_base_service_default_crud_capabilities.9 的当前独立事实为 deleteBatch。 -->
selplat_base_service_default_crud_capabilities.9 = deleteBatch

<!-- Grid 默认字段列必须由 BaseController、BaseService 和 BaseServiceImpl 统一提供，并最终调用 BaseDao.getDbColumnsMap；适用于全部简单单表模块；业务含义是应用 Controller 和 Service 不再重复声明或实现同义 getGridColumn。 -->
selplat_base_grid_column_owner_chain = BaseController.getGridColumn -> BaseService.getGridColumn -> BaseServiceImpl.getGridColumn -> BaseDao.getDbColumnsMap
<!-- selplat_application_must_inherit_grid_column_without_redeclaration 的当前独立事实为 true。 -->
selplat_application_must_inherit_grid_column_without_redeclaration = true

<!-- 基础 Service 的九个默认 CRUD 必须使用 OperationLog 标记；业务含义是所有应用继承的 Service 操作都能统一记录开始、结果、耗时和异常，不在 Controller 或 DAO 重复记业务日志。 -->
selplat_base_service_default_crud_operation_log = OperationLog:getStore
<!-- selplat_base_service_default_crud_operation_log.2 的当前独立事实为 getById。 -->
selplat_base_service_default_crud_operation_log.2 = getById
<!-- selplat_base_service_default_crud_operation_log.3 的当前独立事实为 getByIds。 -->
selplat_base_service_default_crud_operation_log.3 = getByIds
<!-- selplat_base_service_default_crud_operation_log.4 的当前独立事实为 insert。 -->
selplat_base_service_default_crud_operation_log.4 = insert
<!-- selplat_base_service_default_crud_operation_log.5 的当前独立事实为 insertBatch。 -->
selplat_base_service_default_crud_operation_log.5 = insertBatch
<!-- selplat_base_service_default_crud_operation_log.6 的当前独立事实为 update。 -->
selplat_base_service_default_crud_operation_log.6 = update
<!-- selplat_base_service_default_crud_operation_log.7 的当前独立事实为 updateBatch。 -->
selplat_base_service_default_crud_operation_log.7 = updateBatch
<!-- selplat_base_service_default_crud_operation_log.8 的当前独立事实为 delete。 -->
selplat_base_service_default_crud_operation_log.8 = delete
<!-- selplat_base_service_default_crud_operation_log.9 的当前独立事实为 deleteBatch。 -->
selplat_base_service_default_crud_operation_log.9 = deleteBatch

<!-- 业务 Service 覆盖默认 CRUD 时也必须使用 OperationLog；业务含义是密码摘要等模块处理发生在调用 super 前时仍可从实际业务入口记录一次日志。 -->
selplat_application_service_override_operation_log = required_on_overridden_default_crud

<!-- OperationLog 日志模块名必须取真实目标实现类去掉 Impl 后缀，动作名必须取真实方法名；业务含义是 UniauthUserServiceImpl.insertBatch 统一记录为 UniauthUserService / insertBatch，无需维护重复字符串。 -->
selplat_service_operation_log_identity = target_implementation_simple_name_without_Impl + invoked_method_name

<!-- BaseServiceImpl 必须继承 BaseExtendsServiceImpl，并在自身保留泛型 DAO 注入、protected getDao 与公开默认 CRUD；适用于所有业务 Service 的稳定继承入口；业务含义是业务类仍只继承 BaseServiceImpl，不直接感知更深层发号和结果构建实现。 -->
selplat_base_service_impl_hierarchy = ApplicationServiceImpl -> BaseServiceImpl -> BaseExtendsServiceImpl

<!-- BaseServiceImpl 必须直接实现唯一 BaseService 接口，业务 Service 接口也只继承 BaseService；适用于全部简单单表模块；业务含义是接口契约与默认实现保持一一对应。 -->
selplat_base_service_interface_hierarchy = ApplicationService extends BaseService;BaseServiceImpl implements BaseService

<!-- BaseServiceImpl 的公开 CRUD 方法负责调用 BaseExtendsServiceImpl 的主键生成和结果构建能力，并统一完成 DAO 调用与事务编排；适用于全部简单单表业务；业务含义是零差异模块直接继承默认实现，稳定基础层成为公共 CRUD 的唯一默认实现位置。 -->
selplat_base_service_public_crud_owner = BaseServiceImpl

<!-- 应用 Service 存在密码摘要等模块特有处理时，允许直接覆盖对应公开 CRUD 方法，并在模块处理完成后调用同名 super 方法；适用于新增、更新及其批量入口；业务含义是每个入口保持一个可追踪方法，不增加 before/after 回调协议。 -->
selplat_application_service_special_crud_override = module_process -> super.same_public_crud_method

<!-- 模块覆盖公开 CRUD 时默认调用同名父类实现；数据库 identity 生成主键且必须返回生成值时，允许调用 DAO 的 insertReturningId 并继续复用 buildSuccessResult；业务含义是只有真实数据库生成策略可以替代父类号段新增。 -->
selplat_application_service_override_must_call_super = required_except_database_generated_identity_insert
<!-- selplat_database_generated_identity_insert_chain 的当前独立事实为 ApplicationService.insert -> ApplicationDao.insertReturningId -> BaseExtendsServiceImpl.buildSuccessResult。 -->
selplat_database_generated_identity_insert_chain = ApplicationService.insert -> ApplicationDao.insertReturningId -> BaseExtendsServiceImpl.buildSuccessResult

<!-- 单条与批量入口必须分别保持真实语义；批量覆盖只能预处理 items 后调用 super.insertBatch、super.updateBatch 或 super.deleteBatch，禁止循环调用单条父类方法冒充批处理；业务含义是模块扩展不能破坏 DAO 一千条分组和真实 JDBC batch。 -->
selplat_application_service_batch_override_boundary = preprocess_items -> super.batch_method;forbid_loop_super_single_method

<!-- 没有模块特有处理的方法必须直接继承 BaseServiceImpl 默认实现；适用于简单单表 ServiceImpl；业务含义是零差异方法不能继续留在应用类中。 -->
selplat_application_service_must_inherit_zero_difference_crud = BaseServiceImpl

<!-- 批量新增、更新和假删除的 BaseServiceImpl 默认实现必须保留事务边界；identity 模块覆盖批量新增时允许在预处理后直接调用 BaseDao.insertBatch，但仍必须声明事务并保留真实 JDBC batch；禁止循环单条新增。 -->
selplat_base_service_batch_write_transaction = insertBatch
<!-- selplat_base_service_batch_write_transaction.2 的当前独立事实为 updateBatch。 -->
selplat_base_service_batch_write_transaction.2 = updateBatch
<!-- selplat_base_service_batch_write_transaction.3 的当前独立事实为 deleteBatch;module_override_transaction_required。 -->
selplat_base_service_batch_write_transaction.3 = deleteBatch;module_override_transaction_required
<!-- selplat_identity_batch_insert_override 的当前独立事实为 preprocess_items -> BaseDao.insertBatch;transaction_required;forbid_loop_single_insert。 -->
selplat_identity_batch_insert_override = preprocess_items -> BaseDao.insertBatch;transaction_required;forbid_loop_single_insert

<!-- 基础 Service 的泛型注入必须在存在多个 BaseDao Bean 时通过真实 Spring 容器验证，并纳入 shared 覆盖率门禁。 -->
selplat_base_service_dao_injection_test = SpringContext
<!-- selplat_base_service_dao_injection_test.2 的当前独立事实为 multiple_BaseDao_beans。 -->
selplat_base_service_dao_injection_test.2 = multiple_BaseDao_beans
<!-- selplat_base_service_dao_injection_test.3 的当前独立事实为 generic_binding。 -->
selplat_base_service_dao_injection_test.3 = generic_binding
<!-- selplat_base_service_dao_injection_test.4 的当前独立事实为 coverage_gate。 -->
selplat_base_service_dao_injection_test.4 = coverage_gate
