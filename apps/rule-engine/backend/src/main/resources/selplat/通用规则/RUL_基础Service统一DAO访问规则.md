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

<!-- 公共发号器必须由 BaseServiceImpl 统一注入，并通过无参数 getSequence() 读取当前 getDao() 的主键号段定义；适用于所有需要新增单主键或复合主键数据的业务 Service；业务含义是业务类不再重复保存 SequenceGenerator 字段或拼接定义。 -->
selplat_base_service_sequence_entry = protected getSequence() -> SequenceGenerator.getSequence(getDao().getIdSequenceDefinition())

<!-- 非分页成功结果必须由 BaseServiceImpl.buildSuccessResult 统一构建固定 CommonResult；普通入口使用 data、message，写入入口增加已确认的 affectedRows 参数；业务含义是业务 Service 不再重复设置 success、data、affectedRows 和 msg。 -->
selplat_base_service_success_result_entry = protected buildSuccessResult(data,message),protected buildSuccessResult(data,affectedRows,message) -> CommonResult

<!-- 业务 ServiceImpl 不得重复声明 SequenceGenerator 字段或 buildSuccessResult 实现；适用于继承 BaseServiceImpl 的全部模块；业务含义是公共依赖与公共返回构建只有一个维护入口。 -->
selplat_application_service_must_not_redeclare_common_service_capability = SequenceGenerator,buildSuccessResult

<!-- 基础 Service 的泛型注入必须在存在多个 BaseDao Bean 时通过真实 Spring 容器验证，并纳入 shared 覆盖率门禁。 -->
selplat_base_service_dao_injection_test = SpringContext,multiple_BaseDao_beans,generic_binding,coverage_gate
