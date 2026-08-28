# 控件治理规则索引

<!-- 本叶子索引由原索引按职责无损分片；逻辑 ID、路径和触发映射保持不变。 -->

<!-- SELPLAT 全部现有和未来公共控件统一执行先登记后实现、应用禁止私造和硬依赖自动检查。 -->
SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT公共控件治理门禁规则.md

<!-- 业务应用出现原生 createElement 或要求统一 DOM 创建入口时加载，改用 sel.core.element。 -->
load_rule_for_selplat_application_document_create_element_or_dom_node_creation = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改 sel.core.element 或业务动态节点结构时加载，保持公共实现与应用消费边界。 -->
load_rule_for_selplat_core_element_or_application_dynamic_dom = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 新增、拆分、迁移或删除任一公共控件时加载，禁止未登记源码和旧私有实现兼容分支。 -->
load_rule_for_active_user_selplat_public_component_create_split_migrate_or_delete = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 应用新增状态交互、body 门户、键盘焦点生命周期或可复用 DOM/CSS/事件组合时加载，先判断是否应建立公共控件。 -->
load_rule_for_active_user_selplat_application_reusable_interaction_or_private_control = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改控件 API、主题令牌、ARIA 角色、硬依赖或应用资源顺序时加载，保证登记与调用方同步。 -->
load_rule_for_active_user_selplat_component_api_theme_accessibility_dependency_or_resource_order = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 新建或既有工程接入 SEL UI，选择现有主题或把稳定自有 UI 沉淀为新主题包时加载。 -->
load_rule_for_active_user_selplat_application_sel_ui_adoption_or_new_theme_pack = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- Java 通过资源 JAR、Node Vite Electron 通过模块出口或 React 通过生命周期适配使用 SEL UI 时加载。 -->
load_rule_for_active_user_selplat_java_node_electron_or_react_sel_ui_host_adoption = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- SELUI 中央登记新增控件、同步 Node 正式出口或检查 package exports 一致性时加载，登记必须自动形成稳定脚本和样式入口。 -->
load_rule_for_active_user_selplat_component_registry_node_export_sync_or_gate = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 应用需要消费尚未公开导出的 SELUI 控件时加载，必须先补共通正式出口，禁止引用 shared 内部文件。 -->
load_rule_for_active_user_selplat_application_requires_unexported_sel_ui_component = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 既有 UI 硬编码视觉迁移到统一令牌并要求保持原外观时加载。 -->
load_rule_for_active_user_selplat_existing_ui_token_migration_with_visual_preservation = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改 window.sel 命名空间、selKernel、sel.core.freeze、应用组件解构或 JavaScript 组件说明时加载。 -->
load_rule_for_active_user_selplat_namespace_kernel_freeze_dependency_declaration_or_js_component_documentation = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改应用装配脚本的页面入口、SEL 公共别名或业务模块前缀时加载，保证短名不丢失归属语义。 -->
load_rule_for_active_user_selplat_application_javascript_entry_framework_alias_or_business_prefix_naming = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改只读配置、payload、状态快照、运行时控制器或生成脚本冻结结构时加载，保证完整边界只调用一次 selFreeze。 -->
load_rule_for_active_user_selplat_immutable_boundary_runtime_controller_or_generated_freeze_structure = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES,SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

<!-- 新增或修改页面编辑模式、控件坐标、实时草稿、取消恢复、显式保存或管理员显示能力时加载。 -->
load_rule_for_active_user_selplat_page_editor_mode_coordinate_draft_cancel_save_or_authorization = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- load_rule_for_active_user_selplat_page_editor_switch_per_control_save_navigation_or_window_geometry 的当前独立事实为 SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES,SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES。 -->
load_rule_for_active_user_selplat_page_editor_switch_per_control_save_navigation_or_window_geometry = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES,SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- 修改 Window 外框保存、内部字段登记、parentKind=WINDOW 清理或防复发约束时加载。 -->
load_rule_for_active_user_selplat_window_outer_geometry_or_inner_control_cleanup = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES,SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- 将表格、菜单、树、下拉或数据类型接入统一页面编辑适配器时加载，禁止应用私造编辑外壳或把管理筛选器冒充业务控件。 -->
load_rule_for_active_user_selplat_control_page_editor_adapter_registration = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 新增或修改页面控件绑定、引用数据类型与选项关联或按页面坐标查询下拉选项时加载。 -->
load_rule_for_active_user_selplat_reference_dropdown_control_binding_type_and_option_relation = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES,SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES

<!-- 修改 selGrid 记录分类字段、工具栏分类或树分类筛选时加载，保证单值和多值统一按成员匹配。 -->
load_rule_for_active_user_selplat_grid_record_type_or_tree_classification_filter = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 同一 selGrid 切换业务模块、替换记录字段契约或修改 selWindow 表单默认项时加载，保证新契约和默认值立即生效。 -->
load_rule_for_active_user_selplat_grid_runtime_module_contract_or_window_form_default = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 新增或修改 SEL 控件实例 ID、业务 gridId 或事件实例键时加载，统一 sel加控件类型加业务含义加Id 的驼峰命名。 -->
load_rule_for_active_user_selplat_component_instance_id_or_business_grid_id_naming = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改公共控件字号、字重、行高或树节点文字层级时加载，统一七级语义文字并阻断旧 primary/secondary 令牌。 -->
load_rule_for_active_user_selplat_component_typography_or_tree_text_hierarchy = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 交付前检查未知新控件和业务私造交互时加载，扫描逻辑由中央登记驱动而非逐个控件写死。 -->
load_rule_for_active_user_selplat_component_governance_delivery_scan = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 新增或修改多字段查询、逐字段 AND、横向组合基线、Grid 后台分页或查询事件时加载。 -->
load_rule_for_active_user_selplat_search_multi_field_or_grid_remote_pagination = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改搜索框默认宽度、配置覆盖或缺少数据库/JSON 配置时的回退布局时加载。 -->
load_rule_for_active_user_selplat_search_default_width_or_configuration_fallback = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 修改统一查询字段数量、提交时机、共同基线或页面编辑登记边界时加载，每个真实元素必须可独立保存。 -->
load_rule_for_active_user_selplat_query_condition_group_internal_fields_submit_or_page_registration = SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES

<!-- 控件中央登记、宿主接入、公共 API 与不可变边界的独立职责规则。 -->
SELPLAT_COMPONENT_REGISTRY_AND_HOST_ADOPTION_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT控件注册与宿主接入规则.md
<!-- 修改控件登记、宿主适配、公共 API、资源顺序或不可变边界时直接加载。 -->
load_rule_for_selplat_component_registry_host_public_api_or_freeze_change = SELPLAT_COMPONENT_REGISTRY_AND_HOST_ADOPTION_RULES

<!-- 表格、搜索、分页、选择、提示和破坏性确认交互的独立职责规则。 -->
SELPLAT_COMPONENT_GRID_SEARCH_INTERACTION_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT表格搜索与交互规则.md
<!-- 修改表格、搜索、分页、选择、提示或确认交互时直接加载。 -->
load_rule_for_selplat_grid_search_pagination_selection_or_confirmation_change = SELPLAT_COMPONENT_GRID_SEARCH_INTERACTION_RULES

<!-- 页面编辑、控件几何、复合工具条和引用下拉的独立职责规则。 -->
SELPLAT_PAGE_EDITOR_AND_REFERENCE_CONTROL_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT页面编辑与引用控件规则.md
<!-- 修改页面编辑模式、控件几何、复合工具条或引用下拉时直接加载。 -->
load_rule_for_selplat_page_editor_geometry_toolbar_or_reference_dropdown_change = SELPLAT_PAGE_EDITOR_AND_REFERENCE_CONTROL_RULES

<!-- 公共控件 quick gate、构建、浏览器和交付扫描的独立职责规则。 -->
SELPLAT_COMPONENT_DELIVERY_GATE_RULES = local/XUNAN/selplat/通用/rule/RUL_SELPLAT控件交付门禁规则.md
<!-- 修改公共控件门禁、构建验证、浏览器回归或交付扫描时直接加载。 -->
load_rule_for_selplat_component_quick_build_browser_or_delivery_gate_change = SELPLAT_COMPONENT_DELIVERY_GATE_RULES
