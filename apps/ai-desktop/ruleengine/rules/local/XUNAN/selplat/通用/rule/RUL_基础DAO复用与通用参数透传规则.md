# 基础 DAO 复用与通用参数透传规则

<!-- java_ability_refs 的当前独立事实为 none。 -->
java_ability_refs = none
<!-- python_ability_refs 的当前独立事实为 none。 -->
python_ability_refs = none
<!-- node_ability_refs 的当前独立事实为 none。 -->
node_ability_refs = none
<!-- 2.0.0 表示应用 DAO 接入结构已经从直接继承公共 Base 升级为项目 BaseDao 中间层。 -->
rule_version = 2.0.0

<!-- 问题：各应用 DAO 为基础类已有的增删改查能力重复建立包装方法，并在通用查询内部硬编码业务字段时，会造成接口膨胀、隐藏查询条件和跨应用实现漂移。 -->
<!-- 场景：SELPLAT 任意 apps/<app> 的简单单表 DAO 经项目 BaseDao 接入 BaseDao、BaseDaoImpl、CommonParam、CommonPageParam 或公共主键号段能力。 -->
<!-- 业务含义：应用 DAO 只保留真正包含业务增量的动作；公共 CRUD、分页、动态条件和主键号段定义统一复用基础类，让前端参数来源、实际 SQL 条件与生成主键归属保持可追踪。 -->

<!-- BaseDao 已公开的查询、新增、更新、删除和分页能力必须由 Service 直接调用；适用于没有额外业务处理的薄包装方法；业务含义是禁止业务 DAO 仅改名后再次委托基础方法。 -->
selplat_service_must_call_base_dao_directly = getIdSequenceDefinition
<!-- selplat_service_must_call_base_dao_directly.2 的当前独立事实为 getPageList。 -->
selplat_service_must_call_base_dao_directly.2 = getPageList
<!-- selplat_service_must_call_base_dao_directly.3 的当前独立事实为 getById。 -->
selplat_service_must_call_base_dao_directly.3 = getById
<!-- selplat_service_must_call_base_dao_directly.4 的当前独立事实为 getByIds。 -->
selplat_service_must_call_base_dao_directly.4 = getByIds
<!-- selplat_service_must_call_base_dao_directly.5 的当前独立事实为 getByQuery。 -->
selplat_service_must_call_base_dao_directly.5 = getByQuery
<!-- selplat_service_must_call_base_dao_directly.6 的当前独立事实为 insert。 -->
selplat_service_must_call_base_dao_directly.6 = insert
<!-- selplat_service_must_call_base_dao_directly.7 的当前独立事实为 insertBatch。 -->
selplat_service_must_call_base_dao_directly.7 = insertBatch
<!-- selplat_service_must_call_base_dao_directly.8 的当前独立事实为 update。 -->
selplat_service_must_call_base_dao_directly.8 = update
<!-- selplat_service_must_call_base_dao_directly.9 的当前独立事实为 updateBatch。 -->
selplat_service_must_call_base_dao_directly.9 = updateBatch
<!-- selplat_service_must_call_base_dao_directly.10 的当前独立事实为 softDelete。 -->
selplat_service_must_call_base_dao_directly.10 = softDelete
<!-- selplat_service_must_call_base_dao_directly.11 的当前独立事实为 softDeleteBatch。 -->
selplat_service_must_call_base_dao_directly.11 = softDeleteBatch

<!-- 业务 Service 对 BaseDao 公开能力的直接调用统一通过 BaseServiceImpl.getDao() 完成；适用于所有绑定业务 DAO 泛型的 ServiceImpl；业务含义是 DAO 字段与装配入口不在业务类重复出现。 -->
selplat_service_base_dao_public_call_entry = getDao()

<!-- 公共 DAO 的继承方向固定为门面层、CRUD 层、分页查询层、支撑层；适用于 common-db 基础类维护；业务含义是上层扩展入口稳定且实现职责逐层下沉。 -->
selplat_base_dao_inheritance_chain = BaseDaoImpl extends BaseCrudDaoImpl extends BasePagingQueryDaoImpl extends BaseDaoSupportImpl

<!-- 明确修改基础 DAO 的受保护契约时，关联实现、内部调用、测试、注释和命中规则必须在同一变更中同步；适用于方法名、参数、返回结构或继承职责调整；业务含义是公共链路不会留下旧入口或规则失配。 -->
selplat_base_dao_contract_change_atomic_sync = implementation
<!-- selplat_base_dao_contract_change_atomic_sync.2 的当前独立事实为 internal_callers。 -->
selplat_base_dao_contract_change_atomic_sync.2 = internal_callers
<!-- selplat_base_dao_contract_change_atomic_sync.3 的当前独立事实为 tests。 -->
selplat_base_dao_contract_change_atomic_sync.3 = tests
<!-- selplat_base_dao_contract_change_atomic_sync.4 的当前独立事实为 comments。 -->
selplat_base_dao_contract_change_atomic_sync.4 = comments
<!-- selplat_base_dao_contract_change_atomic_sync.5 的当前独立事实为 applicable_rules。 -->
selplat_base_dao_contract_change_atomic_sync.5 = applicable_rules
<!-- selplat_base_dao_contract_change_atomic_sync.6 的当前独立事实为 rule_index。 -->
selplat_base_dao_contract_change_atomic_sync.6 = rule_index

<!-- BaseDao 与 BaseDaoImpl 必须作为唯一接口实现组合逐项对应；适用于分页、主键查询、CommonParam 查询、新增、更新和假删除；业务含义是公共契约的每个方法只在 BaseDaoImpl 存在一个实际实现。 -->
selplat_base_dao_interface_and_impl_must_match_one_to_one = true

<!-- BaseDaoImpl 集中实现 BaseDao 允许业务调用的全部能力；适用于主键号段定义、两个 getPageList 重载、getById、getByQuery、insert、update 和 softDelete；业务含义是深层类不得保留同名公共方法或重复委托实现。 -->
selplat_base_dao_impl_owned_capabilities = getIdSequenceDefinition
<!-- selplat_base_dao_impl_owned_capabilities.2 的当前独立事实为 getPageList。 -->
selplat_base_dao_impl_owned_capabilities.2 = getPageList
<!-- selplat_base_dao_impl_owned_capabilities.3 的当前独立事实为 getById。 -->
selplat_base_dao_impl_owned_capabilities.3 = getById
<!-- selplat_base_dao_impl_owned_capabilities.4 的当前独立事实为 getByIds。 -->
selplat_base_dao_impl_owned_capabilities.4 = getByIds
<!-- selplat_base_dao_impl_owned_capabilities.5 的当前独立事实为 getByQuery。 -->
selplat_base_dao_impl_owned_capabilities.5 = getByQuery
<!-- selplat_base_dao_impl_owned_capabilities.6 的当前独立事实为 insert。 -->
selplat_base_dao_impl_owned_capabilities.6 = insert
<!-- selplat_base_dao_impl_owned_capabilities.7 的当前独立事实为 insertBatch。 -->
selplat_base_dao_impl_owned_capabilities.7 = insertBatch
<!-- selplat_base_dao_impl_owned_capabilities.8 的当前独立事实为 update。 -->
selplat_base_dao_impl_owned_capabilities.8 = update
<!-- selplat_base_dao_impl_owned_capabilities.9 的当前独立事实为 updateBatch。 -->
selplat_base_dao_impl_owned_capabilities.9 = updateBatch
<!-- selplat_base_dao_impl_owned_capabilities.10 的当前独立事实为 softDelete。 -->
selplat_base_dao_impl_owned_capabilities.10 = softDelete
<!-- selplat_base_dao_impl_owned_capabilities.11 的当前独立事实为 softDeleteBatch。 -->
selplat_base_dao_impl_owned_capabilities.11 = softDeleteBatch

<!-- BaseCrudDaoImpl 只保留 BaseDaoImpl 需要的内部主键查询和参数辅助能力；适用于公共继承链内部；业务含义是深层支撑类不再 implements BaseDao，也不再承载批量写入 SQL 或模板层职责。 -->
selplat_base_crud_dao_impl_internal_capabilities = queryById
<!-- selplat_base_crud_dao_impl_internal_capabilities.2 的当前独立事实为 getByIdsBatchGroup。 -->
selplat_base_crud_dao_impl_internal_capabilities.2 = getByIdsBatchGroup
<!-- selplat_base_crud_dao_impl_internal_capabilities.3 的当前独立事实为 resolveIdValues。 -->
selplat_base_crud_dao_impl_internal_capabilities.3 = resolveIdValues
<!-- selplat_base_crud_dao_impl_internal_capabilities.4 的当前独立事实为 buildIdColumnValueMap。 -->
selplat_base_crud_dao_impl_internal_capabilities.4 = buildIdColumnValueMap

<!-- BaseTemplateDao 是通用单条和批量写入的唯一 SQL 模板入口；适用于 BaseDaoImpl 的新增、更新和批量写入委托；业务含义是公共 DAO 门面不直接拼 SQL，深层 CRUD 支撑类也不重复维护模板实现。 -->
selplat_base_template_dao_write_capabilities = insert
<!-- selplat_base_template_dao_write_capabilities.2 的当前独立事实为 insertBatch。 -->
selplat_base_template_dao_write_capabilities.2 = insertBatch
<!-- selplat_base_template_dao_write_capabilities.3 的当前独立事实为 updateByIds。 -->
selplat_base_template_dao_write_capabilities.3 = updateByIds
<!-- selplat_base_template_dao_write_capabilities.4 的当前独立事实为 updateBatchByIds。 -->
selplat_base_template_dao_write_capabilities.4 = updateBatchByIds

<!-- BaseDaoImpl 的批量写入只负责空请求处理、每千条拆组和影响行数汇总；适用于 insertBatch 与 updateBatch；业务含义是批次编排保留在公开门面实现，真实 SQL 和 JDBC batch 统一交给模板层。 -->
selplat_base_dao_impl_batch_orchestration = validate_empty_request
<!-- selplat_base_dao_impl_batch_orchestration.2 的当前独立事实为 split_each_1000。 -->
selplat_base_dao_impl_batch_orchestration.2 = split_each_1000
<!-- selplat_base_dao_impl_batch_orchestration.3 的当前独立事实为 delegate_template_batch。 -->
selplat_base_dao_impl_batch_orchestration.3 = delegate_template_batch
<!-- selplat_base_dao_impl_batch_orchestration.4 的当前独立事实为 sum_affected_rows。 -->
selplat_base_dao_impl_batch_orchestration.4 = sum_affected_rows

<!-- BaseCrudDaoImpl 禁止保留 insertBatchGroup、updateBatchGroup、批量 SQL 拼接和批处理结果累计实现；适用于模板层批量能力完成后的基础类清理；业务含义是批量写入只有一个真实实现位置。 -->
selplat_base_crud_dao_impl_must_not_implement_batch_write = insertBatchGroup
<!-- selplat_base_crud_dao_impl_must_not_implement_batch_write.2 的当前独立事实为 updateBatchGroup。 -->
selplat_base_crud_dao_impl_must_not_implement_batch_write.2 = updateBatchGroup
<!-- selplat_base_crud_dao_impl_must_not_implement_batch_write.3 的当前独立事实为 batch_sql_building。 -->
selplat_base_crud_dao_impl_must_not_implement_batch_write.3 = batch_sql_building
<!-- selplat_base_crud_dao_impl_must_not_implement_batch_write.4 的当前独立事实为 batch_count_summing。 -->
selplat_base_crud_dao_impl_must_not_implement_batch_write.4 = batch_count_summing

<!-- 批量查询、新增、更新和假删除必须通过 BaseDao 与 BaseDaoImpl 公开，应用 DAO 不得重新声明或包装；适用于 SELPLAT 当前及未来全部简单单表模块；业务含义是业务层只调用门面能力，深层实现可以独立演进。 -->
selplat_base_dao_batch_public_capabilities = getByIds(CommonBatchParam)
<!-- selplat_base_dao_batch_public_capabilities.2 的当前独立事实为 insertBatch(CommonBatchParam)。 -->
selplat_base_dao_batch_public_capabilities.2 = insertBatch(CommonBatchParam)
<!-- selplat_base_dao_batch_public_capabilities.3 的当前独立事实为 updateBatch(CommonBatchParam)。 -->
selplat_base_dao_batch_public_capabilities.3 = updateBatch(CommonBatchParam)
<!-- selplat_base_dao_batch_public_capabilities.4 的当前独立事实为 softDeleteBatch(CommonBatchParam)。 -->
selplat_base_dao_batch_public_capabilities.4 = softDeleteBatch(CommonBatchParam)

<!-- CommonBatchParam.items 是批量入口唯一的有序参数集合，每一项保持 CommonParam 的前端动态字段结构；适用于 Controller 到 Service 再到 DAO 的整条批量链路；业务含义是批量参数无需在业务层重新拆装为专用对象。 -->
selplat_batch_param_shape = CommonBatchParam.items:list<CommonParam>

<!-- 公共批量操作固定按最多一千项拆组；适用于批量查询、新增、更新和假删除；业务含义是超量请求可稳定分段，同时累计返回全部分组的真实结果。 -->
selplat_base_dao_batch_group_size = 1000

<!-- 每个新增分组必须由 BaseTemplateDao 使用 JdbcTemplate.batchUpdate 或等价数据库批处理，并保持相同写入列集合；禁止循环调用公共单条 insert 冒充批处理；业务含义是模板层统一减少数据库往返并防止列值错位。 -->
selplat_insert_batch_execution = BaseDaoImpl.split_each_1000 -> BaseTemplateDao.jdbc_batch_with_same_columns
<!-- selplat_insert_batch_must_not_loop_public_single_insert 的当前独立事实为 true。 -->
selplat_insert_batch_must_not_loop_public_single_insert = true

<!-- 每个更新分组必须由 BaseTemplateDao 按更新字段集合形成 SQL 结构子组后使用真实 JDBC batch，禁止循环调用公共单条 update；适用于同一请求中不同记录更新字段不同的场景；业务含义是模板层统一保留动态参数能力并保证每种 SQL 参数顺序一致。 -->
selplat_update_batch_execution = BaseDaoImpl.split_each_1000 -> BaseTemplateDao.group_by_update_column_shape_then_jdbc_batch
<!-- selplat_update_batch_must_not_loop_public_single_update 的当前独立事实为 true。 -->
selplat_update_batch_must_not_loop_public_single_update = true

<!-- 批量删除只允许由 BaseDaoImpl 把统一假删除字段补入每一项后复用 updateBatch，最终委托 BaseTemplateDao.updateBatchByIds；禁止新增独立假删除模板或物理批量删除能力；业务含义是批量与单条删除遵循同一数据保留和审计口径。 -->
selplat_soft_delete_batch_execution = BaseDaoImpl.enrich_status_and_updatedAt -> updateBatch -> BaseTemplateDao.updateBatchByIds
<!-- selplat_batch_hard_delete_is_not_exposed 的当前独立事实为 true。 -->
selplat_batch_hard_delete_is_not_exposed = true

<!-- 一个业务批量写入请求的全部千条分组必须由 Service 事务包围；适用于 insertBatch、updateBatch 和 softDeleteBatch；业务含义是任一分组或记录失败时不得留下前面分组的部分提交。 -->
selplat_batch_write_service_transaction = all_groups_atomic

<!-- 真删除能力当前不得通过 BaseDao 暴露或在 BaseDaoImpl、BaseCrudDaoImpl 中实现；适用于所有 SELPLAT 应用；业务含义是删除流程暂时只能使用平台统一假删除。 -->
selplat_base_dao_hard_delete_is_not_exposed = true

<!-- 业务模块的 DAO 接口默认只作为 extends BaseDao 的类型标记；只有公共契约无法表达的数据库差异（数据库生成主键回填、跨多列 OR 检索或业务复合唯一性）可以增加明确命名的方法；禁止重新声明 BaseDao 已有 CRUD。 -->
selplat_application_dao_default_is_base_dao_marker = true
<!-- selplat_application_dao_allowed_extensions 的当前独立事实为 database_generated_id_return。 -->
selplat_application_dao_allowed_extensions = database_generated_id_return
<!-- selplat_application_dao_allowed_extensions.2 的当前独立事实为 cross_column_or_search。 -->
selplat_application_dao_allowed_extensions.2 = cross_column_or_search
<!-- selplat_application_dao_allowed_extensions.3 的当前独立事实为 business_composite_uniqueness。 -->
selplat_application_dao_allowed_extensions.3 = business_composite_uniqueness
<!-- selplat_application_dao_must_not_redeclare_base_crud 的当前独立事实为 true。 -->
selplat_application_dao_must_not_redeclare_base_crud = true
<!-- selplat_application_dao_inheritance_chain 的当前独立事实为 ConcreteDaoImpl extends ProjectBaseDao extends BaseDaoImpl。 -->
selplat_application_dao_inheritance_chain = ConcreteDaoImpl extends ProjectBaseDao extends BaseDaoImpl

<!-- 每个拥有独立数据库的项目必须在自身 common/config 创建 BaseDataSourceContext，并由 common/persistence 的项目 BaseDao 通过限定名注入；适用于 Host 同时装配多个应用数据库；业务含义是元数据、模板 SQL 与批处理始终访问同一个项目数据库。 -->
selplat_independent_project_datasource_chain = ProjectPersistenceConfiguration -> qualified_BaseDataSourceContext -> ProjectBaseDao -> BaseDaoImpl
<!-- selplat_independent_project_datasource_must_not_be_host_primary_candidate 的当前独立事实为 true。 -->
selplat_independent_project_datasource_must_not_be_host_primary_candidate = true

<!-- 项目 common 只收纳被两个以上业务模块复用且不表达具体页面动作的基础能力；例如 MDA 的连接工厂、驱动注册表和连接定义可以进入 common/jdbc，元数据浏览与 SQL 执行的 Controller、Service 必须分别留在 metadata、sql 业务包。 -->
selplat_project_common_package_boundary = reusable_infrastructure_without_controller_or_business_orchestration
<!-- selplat_project_common_jdbc_example 的当前独立事实为 common/jdbc:connection_factory。 -->
selplat_project_common_jdbc_example = common/jdbc:connection_factory
<!-- selplat_project_common_jdbc_example.2 的当前独立事实为 driver_registry。 -->
selplat_project_common_jdbc_example.2 = driver_registry
<!-- selplat_project_common_jdbc_example.3 的当前独立事实为 connection_definition;metadata:controller_and_service;sql:controller_and_service。 -->
selplat_project_common_jdbc_example.3 = connection_definition;metadata:controller_and_service;sql:controller_and_service
<!-- selplat_project_common_must_not_contain_business_controller 的当前独立事实为 true。 -->
selplat_project_common_must_not_contain_business_controller = true

<!-- Java 固定表业务包必须使用数据库表名去除项目重复前缀后的全小写稳定资源名；表名本身就是资源名时直接全小写，例如 MdaConnectionProfile 对应 connectionprofile、ReferenceDataType 对应 referencedatatype；禁止大驼峰目录。 -->
selplat_business_package_directory_pattern = lowercase_stable_table_resource_name
<!-- selplat_business_package_directory_examples 的当前独立事实为 user。 -->
selplat_business_package_directory_examples = user
<!-- selplat_business_package_directory_examples.2 的当前独立事实为 role。 -->
selplat_business_package_directory_examples.2 = role
<!-- selplat_business_package_directory_examples.3 的当前独立事实为 permission。 -->
selplat_business_package_directory_examples.3 = permission
<!-- selplat_business_package_directory_examples.4 的当前独立事实为 connectionprofile。 -->
selplat_business_package_directory_examples.4 = connectionprofile
<!-- selplat_business_package_directory_examples.5 的当前独立事实为 referencedatatype。 -->
selplat_business_package_directory_examples.5 = referencedatatype
<!-- selplat_business_package_directory_must_be_lowercase 的当前独立事实为 true。 -->
selplat_business_package_directory_must_be_lowercase = true

<!-- 固定表模块通过完整包路径表达项目归属，通过类型名称表达数据库表归属；适用于 apps/uniauth 等业务应用；业务含义是 com.sp.selplat.uniauth.user 已足以区分项目，类名无需再次污染包目录。 -->
selplat_project_ownership_source = full_java_package_path
<!-- selplat_table_ownership_source 的当前独立事实为 entity_and_dao_simple_class_name。 -->
selplat_table_ownership_source = entity_and_dao_simple_class_name

<!-- 简单单表模块的数据库表名、实体简单类名和 DAO 实现去掉 DaoImpl 后的名称必须一致；适用于 BaseDaoSupportImpl.getTableName 自动推导；业务含义是 UniauthUserDaoImpl 可稳定映射 UniauthUser 表。 -->
selplat_fixed_table_type_mapping = databaseTableName == entitySimpleName == removeSuffix(concreteDaoSimpleName,DaoImpl)
<!-- selplat_fixed_table_type_mapping_example 的当前独立事实为 package:connectionprofile。 -->
selplat_fixed_table_type_mapping_example = package:connectionprofile
<!-- selplat_fixed_table_type_mapping_example.2 的当前独立事实为 table:MdaConnectionProfile。 -->
selplat_fixed_table_type_mapping_example.2 = table:MdaConnectionProfile
<!-- selplat_fixed_table_type_mapping_example.3 的当前独立事实为 entity:MdaConnectionProfile。 -->
selplat_fixed_table_type_mapping_example.3 = entity:MdaConnectionProfile
<!-- selplat_fixed_table_type_mapping_example.4 的当前独立事实为 dao:MdaConnectionProfileDaoImpl。 -->
selplat_fixed_table_type_mapping_example.4 = dao:MdaConnectionProfileDaoImpl
<!-- 表名只能由具体 DAO 类名推导，禁止根据全小写业务包目录猜测数据库表名。 -->
selplat_base_dao_table_name_source = BaseDaoSupportImpl.getTableName(concreteDaoSimpleName)
<!-- selplat_package_directory_must_not_determine_table_name 的当前独立事实为 true。 -->
selplat_package_directory_must_not_determine_table_name = true

<!-- 除 BaseDao 已声明的 getDbColumnsMap 只读字段元数据门面外，BasePagingQueryDaoImpl、BaseCrudDaoImpl 和 BaseDaoSupportImpl 的深层方法只允许公共 DAO 继承链内部使用；适用于业务 Service 与业务 DAO；业务含义是模块调用必须全部通过 BaseDao 公开签名。 -->
selplat_application_must_not_call_deep_dao_methods = except_BaseDao.getDbColumnsMap

<!-- 应用 DAO 不得保留仅调用同名基础能力的包装方法；适用于 insertUser、updateUser、getStorePage 等没有业务增量的接口；业务含义是减少重复接口和维护点。 -->
selplat_dao_must_remove_zero_value_base_wrappers = true

<!-- 主键业务查询统一使用 BaseDao.getById(CommonParam)；适用于单主键和复合主键场景；业务含义是前端主键字段从 Controller 经 Service 原样传入公共 DAO。 -->
selplat_dao_primary_key_query_signature = getById(CommonParam)

<!-- BaseCrudDaoImpl.queryById 必须接收同一个 CommonParam，并按 getPrimaryKeyColumnNameList 元数据顺序提取全部主键字段；适用于单主键和复合主键；业务含义是内部方法明确表达单条查询，避免与公开批量 getByIds 混淆，同时 Service 不再读取、转换或重新组装主键值列表。 -->
selplat_base_crud_query_by_id_signature = queryById(CommonParam)

<!-- 复合主键查询缺少任一元数据主键字段时必须在 SQL 前终止；适用于 tenantId 与 itemId 等组合；业务含义是不完整主键不得退化成部分条件查询。 -->
selplat_composite_primary_key_query_requires_all_id_columns = true

<!-- 动态单条查询统一接收 CommonParam；适用于唯一性校验和任意字段组合查询；业务含义是查询字段可以从 Controller 经 Service 一路传递到 DAO。 -->
selplat_dao_dynamic_single_query_signature = getByQuery(CommonParam)

<!-- getByQuery 只能复制并消费上游 CommonParam 中实际存在的动态字段；适用于所有 SELPLAT 应用 DAO；业务含义是 DAO 不得硬编码 loginName、status 或其他模块特定查询条件。 -->
selplat_dao_get_by_query_must_not_inject_specific_parameters = true

<!-- 空通用查询条件必须在 DAO 查询前终止；适用于返回单条记录的通用查询；业务含义是避免空参数意外退化成全表首条查询。 -->
selplat_dao_empty_single_query_must_not_access_database = true

<!-- 平台统一假删除由 BaseDaoImpl 在原 CommonParam 中补充 status 和 updatedAt 后调用 update，前端传入的 lastOperateUserId 等审计字段保持原样；适用于遵循 SELPLAT 公共审计列约定的表；业务含义是应用 DAO 和 Service 不再保留假删除包装。 -->
selplat_base_dao_soft_delete_generated_columns = status
<!-- selplat_base_dao_soft_delete_generated_columns.2 的当前独立事实为 updatedAt。 -->
selplat_base_dao_soft_delete_generated_columns.2 = updatedAt
<!-- selplat_base_dao_soft_delete_passthrough_columns 的当前独立事实为 lastOperateUserId。 -->
selplat_base_dao_soft_delete_passthrough_columns = lastOperateUserId

<!-- 主键号段定义的具体组装逻辑必须由 BaseDaoSupportImpl 读取 getTableName 与 getPrimaryKeyColumnNameList 自动完成，BaseDaoImpl 只复写接口并委托受保护构建方法；适用于全部单主键和复合主键 DAO；业务含义是公共门面保持简洁且 Service 与应用 DAO 不再硬编码模块号段常量。 -->
selplat_id_sequence_definition_source = BaseDaoImpl.getIdSequenceDefinition -> BaseDaoSupportImpl.buildIdSequenceDefinition(getTableName,getPrimaryKeyColumnNameList)

<!-- 下沉的号段定义构建方法只能使用 protected 可见性；适用于公共 DAO 继承链；业务含义是业务 DAO 和 Service 仍只能调用 BaseDao 公开能力，不能绕过门面访问深层实现。 -->
selplat_id_sequence_builder_visibility = protected

<!-- 每个主键字段的号段编码均由表对应类名加该字段完整 UpperCamelCase 名称生成；适用于单主键与复合主键；业务含义是每个生成值都有独立且可追溯的数据库号段记录。 -->
selplat_id_sequence_code_pattern = each(idColumn => tableClassName + upperCamelCase(idColumn))

<!-- 单主键字段为 id 时保留完整字段语义；适用于 UniauthUser 等常规主表；业务含义是 id 明确对应数据库中的 UniauthUserId 号段。 -->
selplat_plain_id_sequence_code_example = UniauthUser:[id]=>{id:UniauthUserId}

<!-- 复合主键的每个字段必须分别形成独立号段编码，禁止把多个字段合并为一个编码；适用于 tenantId 与 orderId 等组合；业务含义是数据库能分别返回两个主键字段各自的数值。 -->
selplat_composite_id_sequence_code_example = UniauthUser:[tenantId,orderId]=>{tenantId:UniauthUserTenantId,orderId:UniauthUserOrderId}

<!-- 主键号段定义必须使用有序的字段名到独立号段编码映射，发号结果必须使用同序的字段名到 Long 映射；适用于单主键和复合主键创建流程；业务含义是调用方无需猜测每条数据库号段及其生成值应写入哪个主键列。 -->
selplat_id_sequence_definition_shape = ordered_map<idColumn
<!-- selplat_id_sequence_definition_shape.2 的当前独立事实为 sequenceCode>。 -->
selplat_id_sequence_definition_shape.2 = sequenceCode>
<!-- selplat_generated_id_result_shape 的当前独立事实为 ordered_map<idColumn。 -->
selplat_generated_id_result_shape = ordered_map<idColumn
<!-- selplat_generated_id_result_shape.2 的当前独立事实为 Long>。 -->
selplat_generated_id_result_shape.2 = Long>

<!-- 公共发号器按 DAO 号段定义返回单主键或复合主键映射时统一使用 getSequence；适用于全部 SELPLAT 应用；业务含义是业务层无需理解内部 nextId 的逐号实现。 -->
selplat_sequence_generator_definition_entry = getSequence(IdSequenceDefinition)

<!-- 业务 Service 的新增动作统一使用 insert 命名并直接调用 BaseDao.insert；适用于简单主数据模块；业务含义是 Service、DAO 的新增语义一致，不再混用 create 与 insert。 -->
selplat_service_insert_method_name = insert(CommonParam)

<!-- Controller 绑定得到的 CommonParam 和 CommonPageParam 必须由 Service 公开方法直接读取，禁止仅为判空或换局部变量重复构造等价参数对象；适用于 getStore、getById、insert、update 等前端入口；业务含义是参数来源可直接追溯。 -->
selplat_service_must_not_create_zero_value_normalized_param = true

<!-- Service 公开方法注释必须说明参数由前端直接传入以及当前保留的必要转换；适用于动态 CommonParam 无法从类型签名展示字段的场景；业务含义是调用方无需阅读私有代码就能知道参数流向。 -->
selplat_common_param_service_comment_must_describe_frontend_passthrough = true

<!-- BaseDao 的新增、更新和假删除统一直接接收 CommonParam；适用于简单单表写入；业务含义是 Service 不再把前端动态字段逐项复制到新的 Map。 -->
selplat_base_dao_common_param_write_signatures = insert(CommonParam)
<!-- selplat_base_dao_common_param_write_signatures.2 的当前独立事实为 update(CommonParam)。 -->
selplat_base_dao_common_param_write_signatures.2 = update(CommonParam)
<!-- selplat_base_dao_common_param_write_signatures.3 的当前独立事实为 softDelete(CommonParam)。 -->
selplat_base_dao_common_param_write_signatures.3 = softDelete(CommonParam)
<!-- selplat_base_dao_common_batch_param_write_signatures 的当前独立事实为 insertBatch(CommonBatchParam)。 -->
selplat_base_dao_common_batch_param_write_signatures = insertBatch(CommonBatchParam)
<!-- selplat_base_dao_common_batch_param_write_signatures.2 的当前独立事实为 updateBatch(CommonBatchParam)。 -->
selplat_base_dao_common_batch_param_write_signatures.2 = updateBatch(CommonBatchParam)
<!-- selplat_base_dao_common_batch_param_write_signatures.3 的当前独立事实为 softDeleteBatch(CommonBatchParam)。 -->
selplat_base_dao_common_batch_param_write_signatures.3 = softDeleteBatch(CommonBatchParam)

<!-- BaseDao.update 必须按 getPrimaryKeyColumnNameList 元数据顺序从 CommonParam 自动提取单主键或复合主键并从 set 字段中移除；适用于全部通用更新；业务含义是前端只传一个参数对象即可准确区分 where 与 set。 -->
selplat_base_dao_update_id_extraction = ordered_extract(getPrimaryKeyColumnNameList,CommonParam)

<!-- 当前 Service 写入链路不分散实现必填、唯一性、默认值或类型验证，这些验证等待后续统一能力；适用于 insert、update、delete；业务含义是 Service 继续直接透传 CommonParam，不重复建设临时验证。 -->
selplat_service_deferred_write_validation = required
<!-- selplat_service_deferred_write_validation.2 的当前独立事实为 uniqueness。 -->
selplat_service_deferred_write_validation.2 = uniqueness
<!-- selplat_service_deferred_write_validation.3 的当前独立事实为 default_value。 -->
selplat_service_deferred_write_validation.3 = default_value
<!-- selplat_service_deferred_write_validation.4 的当前独立事实为 type_conversion。 -->
selplat_service_deferred_write_validation.4 = type_conversion

<!-- 公共 DAO 必须通过 BaseDaoSupportImpl.getDbColumnsMap 从当前 DAO 对应真实表的数据库元数据读取有序字段映射；适用于查询、新增、更新和批量写入；业务含义是 Map 键作为后端真实列名，ColumnMetadata 作为后续类型、长度和主键校验依据，最终进入 SQL 的列名不由前端字段名直接决定。 -->
selplat_base_dao_real_column_source = BaseDaoSupportImpl.getDbColumnsMap():ordered_map<columnName
<!-- selplat_base_dao_real_column_source.2 的当前独立事实为 ColumnMetadata>。 -->
selplat_base_dao_real_column_source.2 = ColumnMetadata>

<!-- getDbColumnsMap 必须由 BaseDao 声明并由 BaseDaoSupportImpl 公开实现，返回不可修改的有序 Map；适用于业务 Service 读取默认字段名、备注、类型和主键信息；业务含义是项目不需要再建立同义元数据 DAO。 -->
selplat_base_dao_columns_map_public_contract = public BaseDao.getDbColumnsMap() -> BaseDaoSupportImpl.unmodifiable_ordered_map

<!-- 应用项目不得为 getDbColumnsMap 新建 UniauthTableMetadataDao 等平行接口，也不得复制 ColumnMetadata 为项目专属表格 DTO；适用于默认表格列定义和后续 reference-data 兜底；业务含义是数据库结构只有一个公共可信来源，页面配置只负责覆盖显示属性。 -->
selplat_project_must_not_duplicate_table_metadata_contract = no_project_metadata_dao
<!-- selplat_project_must_not_duplicate_table_metadata_contract.2 的当前独立事实为 no_project_column_metadata_dto。 -->
selplat_project_must_not_duplicate_table_metadata_contract.2 = no_project_column_metadata_dto
<!-- selplat_project_must_not_duplicate_table_metadata_contract.3 的当前独立事实为 reuse_ColumnMetadata。 -->
selplat_project_must_not_duplicate_table_metadata_contract.3 = reuse_ColumnMetadata

<!-- 公共查询字段字符串统一由 BaseDaoSupportImpl.getSelectColumns 复用 getDbColumnsMap 的有序键生成；适用于详情、批量主键查询和分页查询；业务含义是 Java 方法名遵循驼峰规范，查询字段与写入字段共享同一份真实数据库元数据来源。 -->
selplat_base_dao_select_column_source = BaseDaoSupportImpl.getSelectColumns -> BaseDaoSupportImpl.getDbColumnsMap.keySet

<!-- 公共写入只允许遍历 getDbColumnsMap 的有序键并通过 CommonParam.getParam(columnName) 获取前端值；适用于 insert、insertBatch、update、updateBatch 和假删除复用的更新链路；业务含义是前端只提供真实字段对应的值，不能把任意标识符拼入 SQL。 -->
selplat_base_dao_write_value_mapping = each(getDbColumnsMap.key where CommonParam.containsKey(columnName) => CommonParam.getParam(columnName))

<!-- 前端写入参数包含当前真实表不存在的字段时必须在 SQL 执行前终止，禁止静默忽略未知字段；适用于单条和批量新增、更新；业务含义是字段拼写错误、越界字段和 SQL 标识符注入都不能进入模板层。 -->
selplat_base_dao_unknown_write_column_must_fail_before_sql = true

<!-- 前端未传入的真实数据库字段不得主动写成 null；适用于数据库默认值、可空字段和局部更新；业务含义是字段白名单只校验实际传入键，不改变未提交字段的数据库语义。 -->
selplat_base_dao_missing_write_column_must_not_be_written_as_null = true

<!-- 公共删除链路只能使用 softDelete 与 softDeleteBatch，并在补充平台假删除字段后复用真实字段匹配更新；适用于用户所称的通用增删改能力；业务含义是“删”固定表示假删除，不得借字段匹配改造新增物理删除入口。 -->
selplat_base_dao_matched_write_scope = insert
<!-- selplat_base_dao_matched_write_scope.2 的当前独立事实为 insertBatch。 -->
selplat_base_dao_matched_write_scope.2 = insertBatch
<!-- selplat_base_dao_matched_write_scope.3 的当前独立事实为 update。 -->
selplat_base_dao_matched_write_scope.3 = update
<!-- selplat_base_dao_matched_write_scope.4 的当前独立事实为 updateBatch。 -->
selplat_base_dao_matched_write_scope.4 = updateBatch
<!-- selplat_base_dao_matched_write_scope.5 的当前独立事实为 softDelete。 -->
selplat_base_dao_matched_write_scope.5 = softDelete
<!-- selplat_base_dao_matched_write_scope.6 的当前独立事实为 softDeleteBatch。 -->
selplat_base_dao_matched_write_scope.6 = softDeleteBatch

<!-- Uniauth 写入当前只保留主键生成和 password 到 passwordHash 的必要落库转换；适用于用户新增和更新；业务含义是明文密码不会直接写入数据库或返回前端。 -->
selplat_uniauth_current_required_write_processing = id_generation
<!-- selplat_uniauth_current_required_write_processing.2 的当前独立事实为 password_to_passwordHash。 -->
selplat_uniauth_current_required_write_processing.2 = password_to_passwordHash

<!-- 应用列表没有业务专用排序时必须调用 BaseDao 三参数 getPageList，统一复用基础类维护的 sortnum desc；适用于 getStore 等后台列表；业务含义是 Service 不重复硬编码 id desc 或同义默认排序。 -->
selplat_default_store_paging_entry = getPageList(queryColumnValueMap,pageNo,pageSize)
