# 网页业务控件多实例注册与后端实体映射规则

<!-- 问题：表格、树、菜单和筛选若使用页面固定 ID 或单一全局状态，同页复制第二套控件时会出现重复 ID、事件串联和状态覆盖。 -->
<!-- 场景：网页通用增删改查模块、实体列表、子类型列表及其树、菜单、筛选和分页需要在同一文档中存在多个业务实例。 -->
<!-- 业务含义：实例名帮助人员识别业务模块，显式实体元数据负责后端映射，根节点作用域保证每套控件只控制自己的状态和 DOM。 -->

business_control_instance_key_pattern = <BackendEntity><OptionalBusinessView><ControlType>
business_control_instance_key_case = PascalCase
business_control_instance_key_examples = UniauthUserGrid,UniauthUserTypeGrid,UniauthUserTree
business_control_instance_key_must_be_unique_in_document = true

<!-- 实例名用于注册表寻址；后端实体必须通过独立属性声明，禁止拆分实例名猜测实体类。 -->
business_control_instance_attribute = data-sel-grid
business_control_backend_entity_attribute = data-sel-entity
business_control_optional_view_attribute = data-sel-grid-view
business_control_backend_entity_inference_from_instance_key_is_forbidden = true

<!-- 完整表格内部控件使用角色属性并从表格根内查找，禁止把树、菜单、筛选和分页再次变成页面级固定 ID。 -->
business_control_child_role_attribute = data-sel-grid-role
business_control_child_query_scope = current-instance-root
business_control_fixed_document_id_dependency_is_forbidden = true
business_control_embedded_children = tree,menu,filters,pagination,feedback

<!-- 每个控件类型使用 Map 登记实例；公开 API 先按完整业务实例名 get，再操作实例方法或子控制器。 -->
business_control_registry_storage = Map<instance-key,controller>
business_control_registry_get_pattern = selGrid.get(<instance-key>)
business_control_registry_safe_call_pattern = selGrid.get(<instance-key>)?.<method>()
business_control_registry_shortcut_pattern = selGrid.<method>(<instance-key>,<arguments>)
business_control_unknown_instance_must_return = null-or-false

<!-- 内部树和菜单挂在表格控制器下；只有脱离表格独立存在的控件才建立自己的业务实例注册名。 -->
business_control_embedded_access_pattern = selGrid.get(<instance-key>).tree|menu|filters|pagination
standalone_control_registry_threshold = control-has-independent-root-and-lifecycle
standalone_control_instance_key_pattern = <BackendEntity><OptionalBusinessView><Tree|Menu|Editor|Dialog>

<!-- 事件从所属根节点冒泡并携带实例名和实体；禁止在 document 广播无法判断来源的业务事件。 -->
business_control_event_dispatch_root = current-instance-root
business_control_event_detail_required = instance-key,backend-entity
business_control_unscoped_document_business_event_is_forbidden = true

<!-- 同页验收必须至少创建两套实例，分别改变筛选、树、菜单和分页，确认另一实例 DOM 与状态不变。 -->
business_control_multi_instance_qa_minimum = 2
business_control_multi_instance_qa_must_cover = registry,filter,tree,menu,pagination,state-isolation
business_control_duplicate_instance_key_must_block_registration = true

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
