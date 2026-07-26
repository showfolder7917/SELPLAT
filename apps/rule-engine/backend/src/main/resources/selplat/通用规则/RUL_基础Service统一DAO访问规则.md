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

<!-- BaseServiceImpl 统一提供简单单表模块的分页、详情、批量详情、新增、批量新增、更新、批量更新、假删除和批量假删除默认实现；适用于只需透传 CommonParam/CommonBatchParam 并调用 BaseDao 门面的业务；业务含义是应用 Service 不再复制相同 CRUD 编排。 -->
selplat_base_service_default_crud_capabilities = getStore,getById,getByIds,insert,insertBatch,update,updateBatch,delete,deleteBatch

<!-- BaseServiceImpl 的公开 CRUD 方法作为固定模板控制主键生成、DAO 调用、事务和 CommonResult 构建；适用于全部简单单表业务；业务含义是公共主流程不会因子类扩展而被跳过、重排或重复实现。 -->
selplat_base_service_public_crud_template_owner = BaseServiceImpl

<!-- 应用 Service 存在密码摘要等模块专属落库转换时，只覆盖父类提供的 protected 前置与后置单项回调；适用于新增和更新的单条及批量入口；业务含义是父类主动调用业务差异，子类不再覆盖公开 CRUD 或自行调用 super。 -->
selplat_application_service_special_crud_extension = BaseServiceImpl.public_template -> protected_before_item_callback -> BaseDao -> protected_after_item_callback

<!-- 单条和批量写入必须复用同一组单项回调，父类批量模板按 items 顺序逐项调用；适用于密码摘要、敏感字段清理和其他逐记录转换；业务含义是同一业务差异不再分别实现单条与批量两套逻辑。 -->
selplat_base_service_single_and_batch_callback_reuse = beforeInsertItem,afterInsertItem,beforeUpdateItem,afterUpdateItem

<!-- 基础回调默认使用空实现，业务子类只覆盖需要的差异点；适用于没有额外落库转换的当前及未来模块；业务含义是零差异模块可以直接继承全部公共 CRUD。 -->
selplat_base_service_callback_default_behavior = no_op

<!-- 业务 Service 禁止覆盖 BaseServiceImpl 的公开 CRUD 模板方法；适用于分页、详情、批量详情、新增、批量新增、更新、批量更新、假删除和批量假删除；业务含义是事务和公共调用顺序只有父类一个维护入口。 -->
selplat_application_service_must_not_override_public_crud_template = true

<!-- 没有模块专属处理的分页、查询和假删除方法必须直接继承 BaseServiceImpl 默认实现；适用于简单单表 ServiceImpl；业务含义是零差异方法不能继续留在应用类中。 -->
selplat_application_service_must_inherit_zero_difference_crud = true

<!-- 批量新增、更新和假删除的父类模板必须保留事务边界，子类回调只处理单项差异且不得接管事务；业务含义是同一请求全部分组始终保持原子性。 -->
selplat_base_service_batch_write_transaction = insertBatch,updateBatch,deleteBatch

<!-- 基础 Service 的泛型注入必须在存在多个 BaseDao Bean 时通过真实 Spring 容器验证，并纳入 shared 覆盖率门禁。 -->
selplat_base_service_dao_injection_test = SpringContext,multiple_BaseDao_beans,generic_binding,coverage_gate
