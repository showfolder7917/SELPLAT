# 基础 Service 统一 DAO 访问规则

<!-- 问题：每个业务 ServiceImpl 重复保存 DAO 字段并声明 DAO 构造函数，会让基础持久层入口分散，增加跨模块样板代码和注入方式差异。 -->
<!-- 场景：SELPLAT 任意业务 ServiceImpl 需要调用继承 BaseDao 的业务 DAO 接口。 -->
<!-- 业务含义：DAO 依赖由公共基础 Service 按业务泛型统一装配，业务 Service 只通过 getDao() 使用 BaseDao 门面能力。 -->

<!-- BaseServiceImpl 必须以 D extends BaseDao 声明 DAO 泛型，并由 Spring 在基础类中统一注入当前业务 DAO。 -->
selplat_base_service_impl_signature = BaseServiceImpl<D extends BaseDao>

<!-- 基础 Service 只允许通过受保护的强类型 getDao() 向业务子类提供 DAO；业务含义是外部调用方不能越过 Service 直接取得持久层对象。 -->
selplat_base_service_dao_accessor = protected D getDao()

<!-- 业务 ServiceImpl 必须在继承处绑定自己的 DAO 接口，例如 BaseServiceImpl<UniauthUserDao>；禁止绑定 DAO 实现类或原始 BaseDao。 -->
selplat_application_service_dao_binding = BaseServiceImpl<ApplicationDaoInterface>

<!-- 业务 ServiceImpl 不得重复声明 DAO 字段、DAO setter 或包含 DAO 的构造函数；适用于全部简单单表业务服务；业务含义是 DAO 装配只有基础类一个维护入口。 -->
selplat_application_service_must_not_declare_dao_dependency = field,setter,constructor

<!-- 业务 ServiceImpl 调用持久层时必须使用 getDao() 的 BaseDao 公开能力，禁止直接访问基础类 DAO 字段或深层 DAO 实现。 -->
selplat_application_service_dao_call_form = getDao().BaseDaoPublicMethod

<!-- 发号器、远程客户端等非 DAO 依赖不得塞入 getDao()；适用于业务编排依赖；业务含义是 getDao() 始终只代表当前业务持久层门面。 -->
selplat_base_service_get_dao_scope = BaseDao_only

<!-- 公共发号器必须由 BaseExtendsServiceImpl 统一注入，并通过无参数 getSequence() 读取 BaseServiceImpl.getDao() 的主键号段定义；适用于所有需要新增单主键或复合主键数据的业务 Service；业务含义是业务类不再重复保存 SequenceGenerator 字段或拼接定义。 -->
selplat_base_extends_service_sequence_entry = protected getSequence() -> SequenceGenerator.getSequence(getDao().getIdSequenceDefinition())

<!-- 非分页成功结果必须由 BaseExtendsServiceImpl.buildSuccessResult 统一构建固定 CommonResult，并由 BaseServiceImpl 的默认 CRUD 调用；普通入口使用 data、message，写入入口增加已确认的 affectedRows 参数；业务含义是业务 Service 不再重复设置 success、data、affectedRows 和 msg。 -->
selplat_base_extends_service_success_result_entry = protected buildSuccessResult(data,message),protected buildSuccessResult(data,affectedRows,message) -> CommonResult

<!-- 业务 ServiceImpl 不得重复声明 SequenceGenerator 字段或 buildSuccessResult 实现；适用于继承 BaseServiceImpl 的全部模块；业务含义是公共依赖与公共返回构建只有一个维护入口。 -->
selplat_application_service_must_not_redeclare_common_service_capability = SequenceGenerator,buildSuccessResult

<!-- BaseServiceImpl 统一提供简单单表模块的分页、详情、批量详情、新增、批量新增、更新、批量更新、假删除和批量假删除默认实现；适用于只需透传 CommonParam/CommonBatchParam 并调用 BaseDao 门面的业务；业务含义是 DAO 装配、getDao 与默认 CRUD 收口在业务类直接继承的稳定基础层。 -->
selplat_base_service_default_crud_capabilities = getStore,getById,getByIds,insert,insertBatch,update,updateBatch,delete,deleteBatch

<!-- 基础 Service 的九个默认 CRUD 必须使用 OperationLog 标记；业务含义是所有应用继承的 Service 操作都能统一记录开始、结果、耗时和异常，不在 Controller 或 DAO 重复记业务日志。 -->
selplat_base_service_default_crud_operation_log = OperationLog:getStore,getById,getByIds,insert,insertBatch,update,updateBatch,delete,deleteBatch

<!-- 业务 Service 覆盖默认 CRUD 时也必须使用 OperationLog；业务含义是密码摘要等模块处理发生在调用 super 前时仍可从实际业务入口记录一次日志。 -->
selplat_application_service_override_operation_log = required_on_overridden_default_crud

<!-- OperationLog 日志模块名必须取真实目标实现类去掉 Impl 后缀，动作名必须取真实方法名；业务含义是 UniauthUserServiceImpl.insertBatch 统一记录为 UniauthUserService / insertBatch，无需维护重复字符串。 -->
selplat_service_operation_log_identity = target_implementation_simple_name_without_Impl + invoked_method_name

<!-- BaseServiceImpl 必须继承 BaseExtendsServiceImpl，并在自身保留泛型 DAO 注入、protected getDao 与公开默认 CRUD；适用于所有业务 Service 的稳定继承入口；业务含义是业务类仍只继承 BaseServiceImpl，不直接感知更深层发号和结果构建实现。 -->
selplat_base_service_impl_hierarchy = ApplicationServiceImpl -> BaseServiceImpl -> BaseExtendsServiceImpl

<!-- BaseServiceImpl 的公开 CRUD 方法负责调用 BaseExtendsServiceImpl 的主键生成和结果构建能力，并统一完成 DAO 调用与事务编排；适用于全部简单单表业务；业务含义是零差异模块直接继承默认实现，稳定基础层成为公共 CRUD 的唯一默认实现位置。 -->
selplat_base_service_public_crud_owner = BaseServiceImpl

<!-- 应用 Service 存在密码摘要等模块特有处理时，允许直接覆盖对应公开 CRUD 方法，并在模块处理完成后调用同名 super 方法；适用于新增、更新及其批量入口；业务含义是每个入口保持一个可追踪方法，不增加 before/after 回调协议。 -->
selplat_application_service_special_crud_override = module_process -> super.same_public_crud_method

<!-- 模块覆盖公开 CRUD 时必须调用同名父类实现，禁止复制父类 DAO 调用、结果构建或事务编排；适用于所有模块特有实现；业务含义是模块只增加差异处理，公共主流程仍由 BaseServiceImpl 执行。 -->
selplat_application_service_override_must_call_super = required

<!-- 单条与批量入口必须分别保持真实语义；批量覆盖只能预处理 items 后调用 super.insertBatch、super.updateBatch 或 super.deleteBatch，禁止循环调用单条父类方法冒充批处理；业务含义是模块扩展不能破坏 DAO 一千条分组和真实 JDBC batch。 -->
selplat_application_service_batch_override_boundary = preprocess_items -> super.batch_method;forbid_loop_super_single_method

<!-- 没有模块特有处理的方法必须直接继承 BaseServiceImpl 默认实现；适用于简单单表 ServiceImpl；业务含义是零差异方法不能继续留在应用类中。 -->
selplat_application_service_must_inherit_zero_difference_crud = BaseServiceImpl

<!-- 批量新增、更新和假删除的 BaseServiceImpl 默认实现必须保留事务边界；模块覆盖批量方法时也必须声明事务并调用同名 super 批量方法；业务含义是同一请求全部分组始终保持原子性。 -->
selplat_base_service_batch_write_transaction = insertBatch,updateBatch,deleteBatch;module_override_transaction_required

<!-- 基础 Service 的泛型注入必须在存在多个 BaseDao Bean 时通过真实 Spring 容器验证，并纳入 shared 覆盖率门禁。 -->
selplat_base_service_dao_injection_test = SpringContext,multiple_BaseDao_beans,generic_binding,coverage_gate
