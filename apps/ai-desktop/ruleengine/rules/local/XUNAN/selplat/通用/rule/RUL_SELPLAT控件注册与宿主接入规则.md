# SELPLAT 控件注册与宿主接入规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 5.22.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 公共控件职责不建立 Java 能力入口。 -->
java_ability_refs = none
<!-- 公共控件职责由源码归属门禁提供可重复验证。 -->
python_ability_refs = apps/ai-desktop/ruleengine/python/local/<active-stable-user-id>/abilities/selplat_source_ownership_guard.py
<!-- 公共控件实现属于 shared 前端源码，不建立 rule-engine Node 能力。 -->
node_ability_refs = none

selplat_component_creation_sequence = classify_reusable_interaction
<!-- selplat_component_creation_sequence.2 的当前独立事实为 register_public_component。 -->
selplat_component_creation_sequence.2 = register_public_component
<!-- selplat_component_creation_sequence.3 的当前独立事实为 implement_public_component。 -->
selplat_component_creation_sequence.3 = implement_public_component
<!-- selplat_component_creation_sequence.4 的当前独立事实为 connect_first_consumer。 -->
selplat_component_creation_sequence.4 = connect_first_consumer
<!-- selplat_component_creation_sequence.5 的当前独立事实为 verify。 -->
selplat_component_creation_sequence.5 = verify
<!-- 门禁只负责阻断和报告缺少的控件，不得静默自动生成未经过登记的公共 API。 -->
selplat_component_gate_auto_creation_policy = block_and_report
<!-- selplat_component_gate_auto_creation_policy.2 的当前独立事实为 no_silent_component_generation。 -->
selplat_component_gate_auto_creation_policy.2 = no_silent_component_generation
<!-- 公共控件唯一登记位于 sel-ui 组件根，版本、策略和控件数组缺一不可。 -->
selplat_component_registry = shared/frontend/sel-ui/src/components/component-registry.json
<!-- 全部已登记控件必须从中央登记生成 Node 脚本与样式正式出口；适用于 Node、TypeScript、Electron 和 React 应用消费 SELUI；业务含义是登记即具备稳定包入口。 -->
selplat_component_registry_generates_node_exports = all_registered_component_scripts_and_styles
<!-- 新控件登记后的包生命周期必须自动同步正式出口；适用于本地 file 依赖安装、prepare 和人工同步；业务含义是后续新增控件不再依赖人工重复编辑 exports。 -->
selplat_component_export_sync = package_prepare + explicit_sync_command
<!-- 公共构建必须核对登记表与已提交正式出口完全一致；适用于共享回归和应用 SELUI 门禁；业务含义是漏接、过期出口或内部路径绕行都会在交付前阻断。 -->
selplat_component_export_gate = registry_and_package_exports_exact_match
<!-- selplat_component_registry.2 的当前独立事实为 version=2。 -->
selplat_component_registry.2 = version=2
<!-- selplat_component_registry.3 的当前独立事实为 one_authoritative_source。 -->
selplat_component_registry.3 = one_authoritative_source
<!-- selplat_component_registry.4 的当前独立事实为 kernel=core/selKernel.js。 -->
selplat_component_registry.4 = kernel=core/selKernel.js
<!-- 每个公开单元必须登记稳定 ID、目录、类型、JS、CSS、命名空间 API、硬依赖和主题属性。 -->
selplat_component_registration_required_fields = id
<!-- selplat_component_registration_required_fields.2 的当前独立事实为 directory。 -->
selplat_component_registration_required_fields.2 = directory
<!-- selplat_component_registration_required_fields.3 的当前独立事实为 type。 -->
selplat_component_registration_required_fields.3 = type
<!-- selplat_component_registration_required_fields.4 的当前独立事实为 scripts。 -->
selplat_component_registration_required_fields.4 = scripts
<!-- selplat_component_registration_required_fields.5 的当前独立事实为 styles。 -->
selplat_component_registration_required_fields.5 = styles
<!-- selplat_component_registration_required_fields.6 的当前独立事实为 publicApi。 -->
selplat_component_registration_required_fields.6 = publicApi
<!-- selplat_component_registration_required_fields.7 的当前独立事实为 dependencies。 -->
selplat_component_registration_required_fields.7 = dependencies
<!-- selplat_component_registration_required_fields.8 的当前独立事实为 themeAware。 -->
selplat_component_registration_required_fields.8 = themeAware
<!-- 新控件目录和顶层 JS/CSS 必须且只能属于一个登记单元，未登记与重复所有者均直接阻断。 -->
selplat_component_source_ownership_gate = every_directory_registered
<!-- selplat_component_source_ownership_gate.2 的当前独立事实为 every_top_level_js_css_exactly_one_owner。 -->
selplat_component_source_ownership_gate.2 = every_top_level_js_css_exactly_one_owner
<!-- selplat_component_source_ownership_gate.3 的当前独立事实为 no_duplicate_owner。 -->
selplat_component_source_ownership_gate.3 = no_duplicate_owner

## 通用分类与应用边界

<!-- 自有开关状态、body 门户、键盘焦点生命周期、跨页面复用或完整 DOM/CSS/事件生命周期任一成立时必须按公共控件治理。 -->
selplat_reusable_control_classification = own_state|body_portal|keyboard_focus_lifecycle|multi_page_reuse|complete_dom_css_event_lifecycle
<!-- 应用只能提供宿主、数据、动作和回调，不得发布 window.sel<Component> 或自行创建 body 交互门户。 -->
selplat_application_component_boundary = host_data_action_callback_only
<!-- selplat_application_component_boundary.2 的当前独立事实为 no_private_sel_global_api。 -->
selplat_application_component_boundary.2 = no_private_sel_global_api
<!-- selplat_application_component_boundary.3 的当前独立事实为 no_private_body_portal。 -->
selplat_application_component_boundary.3 = no_private_body_portal
<!-- 已由公共控件登记拥有的 ARIA 交互角色不得在应用页面或其他控件中重复实现。 -->
selplat_component_owned_interaction_gate = registered_owned_aria_role_single_owner
<!-- selplat_component_owned_interaction_gate.2 的当前独立事实为 no_application_reimplementation。 -->
selplat_component_owned_interaction_gate.2 = no_application_reimplementation
<!-- 本轮启用新公共控件后直接删除旧私有 DOM、样式、定位和事件链，不保留兼容选择或降级分支。 -->
selplat_component_legacy_replacement_policy = enable_registered_component
<!-- selplat_component_legacy_replacement_policy.2 的当前独立事实为 delete_private_legacy_implementation。 -->
selplat_component_legacy_replacement_policy.2 = delete_private_legacy_implementation
<!-- selplat_component_legacy_replacement_policy.3 的当前独立事实为 no_compatibility_branch。 -->
selplat_component_legacy_replacement_policy.3 = no_compatibility_branch

## 通用布局与可访问语义

<!-- 控件根声明原生 hidden 后必须完全退出布局；公共 display 规则不得覆盖浏览器隐藏语义，避免备用实例制造空白页和错误滚动。 -->
selplat_native_hidden_layout_contract = hidden_root_display_none
<!-- selplat_native_hidden_layout_contract.2 的当前独立事实为 public_display_rule_must_not_override_hidden。 -->
selplat_native_hidden_layout_contract.2 = public_display_rule_must_not_override_hidden
<!-- selplat_native_hidden_layout_contract.3 的当前独立事实为 no_inactive_instance_layout_space。 -->
selplat_native_hidden_layout_contract.3 = no_inactive_instance_layout_space
<!-- 树的父节点展开符号使用具名按钮，叶子只使用 aria-hidden 的非交互对齐占位，禁止无名称 button 污染键盘和辅助技术控件树。 -->
selplat_tree_toggle_semantics = parent_named_button
<!-- selplat_tree_toggle_semantics.2 的当前独立事实为 leaf_noninteractive_aria_hidden_placeholder。 -->
selplat_tree_toggle_semantics.2 = leaf_noninteractive_aria_hidden_placeholder
<!-- selplat_tree_toggle_semantics.3 的当前独立事实为 no_unnamed_leaf_button。 -->
selplat_tree_toggle_semantics.3 = no_unnamed_leaf_button
<!-- 常见窄屏下标题、状态和快捷动作不得重叠；动作文字空间不足时先收为保留可访问名称与提示的图标按钮。 -->
selplat_panel_compact_header_contract = no_title_status_action_overlap
<!-- selplat_panel_compact_header_contract.2 的当前独立事实为 compact_icon_actions_before_overlap。 -->
selplat_panel_compact_header_contract.2 = compact_icon_actions_before_overlap
<!-- selplat_panel_compact_header_contract.3 的当前独立事实为 preserve_accessible_name_and_tip。 -->
selplat_panel_compact_header_contract.3 = preserve_accessible_name_and_tip
<!-- 工具栏业务状态动作由 Panel 提供稳定宿主，与 Search、筛选和重置在视觉及语义上明确分组。 -->
selplat_panel_toolbar_business_action = toolbarAction_public_host
<!-- selplat_panel_toolbar_business_action.2 的当前独立事实为 after_query_and_reset。 -->
selplat_panel_toolbar_business_action.2 = after_query_and_reset
<!-- selplat_panel_toolbar_business_action.3 的当前独立事实为 context_badge。 -->
selplat_panel_toolbar_business_action.3 = context_badge
<!-- selplat_panel_toolbar_business_action.4 的当前独立事实为 semantic_accent_button。 -->
selplat_panel_toolbar_business_action.4 = semantic_accent_button
<!-- selplat_panel_toolbar_business_action.5 的当前独立事实为 accessible_label。 -->
selplat_panel_toolbar_business_action.5 = accessible_label
<!-- selplat_panel_toolbar_business_action.6 的当前独立事实为 application_owned_command。 -->
selplat_panel_toolbar_business_action.6 = application_owned_command
<!-- selplat_panel_toolbar_business_action.7 的当前独立事实为 no_header_action_dependency。 -->
selplat_panel_toolbar_business_action.7 = no_header_action_dependency
<!-- selplat_panel_toolbar_business_action.8 的当前独立事实为 composite_root_page_edit_registration。 -->
selplat_panel_toolbar_business_action.8 = composite_root_page_edit_registration

## API、主题与依赖

<!-- SEL UI 的主题、运行时、公共控件和素材只能来自 shared/frontend/sel-ui，Java 与 Node 允许不同交付方式但不得形成第二份源码。 -->
selplat_ui_authoritative_source = shared/frontend/sel-ui
<!-- selplat_ui_authoritative_source.2 的当前独立事实为 one_theme_contract_and_component_registry。 -->
selplat_ui_authoritative_source.2 = one_theme_contract_and_component_registry
<!-- selplat_ui_authoritative_source.3 的当前独立事实为 no_application_sel_ui_copy。 -->
selplat_ui_authoritative_source.3 = no_application_sel_ui_copy
<!-- 新工程 UI 必须先匹配现有 theme、mode、accent、density；只有稳定且可跨页面或跨工程复用的完整视觉体系才能建立新主题包。 -->
selplat_new_application_theme_adoption = existing_theme_mode_accent_density_first
<!-- selplat_new_application_theme_adoption.2 的当前独立事实为 reusable_stable_visual_system_creates_theme_pack。 -->
selplat_new_application_theme_adoption.2 = reusable_stable_visual_system_creates_theme_pack
<!-- selplat_new_application_theme_adoption.3 的当前独立事实为 layout_or_business_difference_stays_in_application。 -->
selplat_new_application_theme_adoption.3 = layout_or_business_difference_stays_in_application
<!-- 既有 UI 令牌化第一阶段只替换视觉值来源，必须以相同真实值和截图基线证明主题接入没有擅自改变外观。 -->
selplat_existing_ui_token_migration = exact_visual_values_to_sel_semantic_tokens
<!-- selplat_existing_ui_token_migration.2 的当前独立事实为 before_after_same_environment_visual_baseline。 -->
selplat_existing_ui_token_migration.2 = before_after_same_environment_visual_baseline
<!-- selplat_existing_ui_token_migration.3 的当前独立事实为 redesign_is_separate_task。 -->
selplat_existing_ui_token_migration.3 = redesign_is_separate_task
<!-- Java 工程通过 Gradle 公共资源 JAR 和 /sel 路径加载 SEL UI，禁止复制公共静态文件或借 Node 安装 Java 页面资源。 -->
selplat_java_sel_ui_adoption = gradle_resource_jar_to_META_INF_resources_sel
<!-- selplat_java_sel_ui_adoption.2 的当前独立事实为 browser_loads_registered_sel_url_resources。 -->
selplat_java_sel_ui_adoption.2 = browser_loads_registered_sel_url_resources
<!-- selplat_java_sel_ui_adoption.3 的当前独立事实为 no_static_copy_and_no_node_install。 -->
selplat_java_sel_ui_adoption.3 = no_static_copy_and_no_node_install
<!-- Node、Vite 与 Electron 通过正式模块发布出口收集同一 SEL UI 的 CSS、JavaScript 和素材，不得深层相对引用或打入整个 shared。 -->
selplat_node_sel_ui_adoption = registered_module_exports_from_same_sel_ui_source
<!-- selplat_node_sel_ui_adoption.2 的当前独立事实为 build_collects_used_browser_runtime_only。 -->
selplat_node_sel_ui_adoption.2 = build_collects_used_browser_runtime_only
<!-- selplat_node_sel_ui_adoption.3 的当前独立事实为 no_deep_relative_import_and_no_whole_shared_packaging。 -->
selplat_node_sel_ui_adoption.3 = no_deep_relative_import_and_no_whole_shared_packaging
<!-- React 优先使用正式包装组件；尚无包装时只允许 ref 与 effect 接入公开 API，并在卸载阶段调用真实销毁入口。 -->
selplat_react_sel_ui_adapter = registered_wrapper_or_ref_effect_public_api
<!-- selplat_react_sel_ui_adapter.2 的当前独立事实为 one_mount_and_real_destroy。 -->
selplat_react_sel_ui_adapter.2 = one_mount_and_real_destroy
<!-- selplat_react_sel_ui_adapter.3 的当前独立事实为 no_component_dom_css_or_keyboard_copy。 -->
selplat_react_sel_ui_adapter.3 = no_component_dom_css_or_keyboard_copy
<!-- 接入后允许直接使用已登记公共控件，但调用方必须满足硬依赖、公开 API、主题感知和销毁生命周期。 -->
selplat_registered_component_cross_host_consumption = java_or_native_window_sel_api
<!-- selplat_registered_component_cross_host_consumption.2 的当前独立事实为 node_renderer_registered_module_runtime。 -->
selplat_registered_component_cross_host_consumption.2 = node_renderer_registered_module_runtime
<!-- selplat_registered_component_cross_host_consumption.3 的当前独立事实为 react_lifecycle_adapter。 -->
selplat_registered_component_cross_host_consumption.3 = react_lifecycle_adapter

<!-- 浏览器只允许 window.sel 一个 SEL 公共根；selGrid 等名称继续作为稳定控件 ID、文件名、CSS 前缀和内部标识，禁止重新发布平铺全局变量。 -->
selplat_public_api_namespace = window.sel
<!-- selplat_public_api_namespace.2 的当前独立事实为 one_public_root。 -->
selplat_public_api_namespace.2 = one_public_root
<!-- selplat_public_api_namespace.3 的当前独立事实为 no_window_selComponent。 -->
selplat_public_api_namespace.3 = no_window_selComponent
<!-- selplat_public_api_namespace.4 的当前独立事实为 stable_component_id_preserved。 -->
selplat_public_api_namespace.4 = stable_component_id_preserved
<!-- 内核必须先于基础运行时、主题和组件加载；后续能力只能通过 register/registerAll 登记且重复路径直接阻断。 -->
selplat_kernel_registration_contract = selKernel_first
<!-- selplat_kernel_registration_contract.2 的当前独立事实为 register_or_registerAll。 -->
selplat_kernel_registration_contract.2 = register_or_registerAll
<!-- selplat_kernel_registration_contract.3 的当前独立事实为 duplicate_path_blocked。 -->
selplat_kernel_registration_contract.3 = duplicate_path_blocked
<!-- selplat_kernel_registration_contract.4 的当前独立事实为 no_compatibility_alias。 -->
selplat_kernel_registration_contract.4 = no_compatibility_alias
<!-- 控件 ID 去掉 sel 并把首字母转小写后形成唯一调用路径，例如 selGrid 对应 sel.components.grid。 -->
selplat_component_public_api_mapping = sel<ComponentId>->sel.components.<lowerCamelComponentId>
<!-- selplat_component_public_api_mapping.2 的当前独立事实为 registry_and_source_match。 -->
selplat_component_public_api_mapping.2 = registry_and_source_match
<!-- 应用必须在文件顶部使用 sel.require 校验依赖并只解构实际调用的能力；同一文件不得在各函数重复解构或重新包装同名组件。 -->
selplat_application_api_consumption = top_level_require
<!-- selplat_application_api_consumption.2 的当前独立事实为 destructure_once。 -->
selplat_application_api_consumption.2 = destructure_once
<!-- selplat_application_api_consumption.3 的当前独立事实为 used_dependencies_only。 -->
selplat_application_api_consumption.3 = used_dependencies_only
<!-- selplat_application_api_consumption.4 的当前独立事实为 no_component_redefinition。 -->
selplat_application_api_consumption.4 = no_component_redefinition
<!-- 应用装配脚本的最外层入口统一使用 app；从 window.sel 取得的公共基础能力使用 sel 前缀短名，例如 selBase、selAjax。 -->
selplat_application_javascript_entry_and_framework_alias_naming = entry:app
<!-- selplat_application_javascript_entry_and_framework_alias_naming.2 的当前独立事实为 window_sel_alias:sel<Capability>。 -->
selplat_application_javascript_entry_and_framework_alias_naming.2 = window_sel_alias:sel<Capability>
<!-- selplat_application_javascript_entry_and_framework_alias_naming.3 的当前独立事实为 examples:selBase|selAjax。 -->
selplat_application_javascript_entry_and_framework_alias_naming.3 = examples:selBase|selAjax
<!-- 模块级业务状态、配置、接口和函数使用所属项目的 lowerCamelCase 前缀；函数内短生命周变量只需表达当前业务含义，禁止为缩短而丢失归属。 -->
selplat_application_javascript_business_prefix_naming = module_scope:<projectNameLowerCamelCase>*
<!-- selplat_application_javascript_business_prefix_naming.2 的当前独立事实为 function_local:concise_business_meaning。 -->
selplat_application_javascript_business_prefix_naming.2 = function_local:concise_business_meaning
<!-- selplat_application_javascript_business_prefix_naming.3 的当前独立事实为 no_ambiguous_abbreviation。 -->
selplat_application_javascript_business_prefix_naming.3 = no_ambiguous_abbreviation
<!-- 业务应用创建动态节点必须复用公共 element 的安全文本和属性入口；原生 DOM 创建只属于 sel-ui 公共实现层。 -->
selplat_application_dom_creation_entry = sel.core.element
<!-- selplat_application_dom_creation_entry.2 的当前独立事实为 application_no_direct_native_create_element。 -->
selplat_application_dom_creation_entry.2 = application_no_direct_native_create_element
<!-- selplat_application_dom_creation_entry.3 的当前独立事实为 shared_component_implementation_keeps_native_boundary。 -->
selplat_application_dom_creation_entry.3 = shared_component_implementation_keeps_native_boundary
<!-- 原生 Object.freeze 只允许出现在 selKernel；其余 shared、应用和生成模板统一调用 sel.core.freeze。 -->
selplat_freeze_single_entry = sel.core.freeze
<!-- selplat_freeze_single_entry.2 的当前独立事实为 Object.freeze_kernel_only。 -->
selplat_freeze_single_entry.2 = Object.freeze_kernel_only
<!-- selplat_freeze_single_entry.3 的当前独立事实为 shared_apps_templates_use_public_entry。 -->
selplat_freeze_single_entry.3 = shared_apps_templates_use_public_entry
<!-- 深度冻结只递归普通对象与数组，并通过 WeakSet 处理循环引用；DOM、函数、Map、Set、Date 和类实例保持自身生命周期。 -->
selplat_deep_freeze_boundary = plain_object_and_array
<!-- selplat_deep_freeze_boundary.2 的当前独立事实为 cycle_safe。 -->
selplat_deep_freeze_boundary.2 = cycle_safe
<!-- selplat_deep_freeze_boundary.3 的当前独立事实为 skip_dom_function_map_set_date_class_instance。 -->
selplat_deep_freeze_boundary.3 = skip_dom_function_map_set_date_class_instance
<!-- 一个完整配置、聚合 payload 或对外状态快照只在最外层调用一次 selFreeze；内部对象、数组、map 结果和字段不得再次逐层或逐项冻结。 -->
selplat_freeze_one_call_per_immutable_boundary = complete_config_payload_or_snapshot_single_call
<!-- selplat_freeze_one_call_per_immutable_boundary.2 的当前独立事实为 no_nested_selFreeze。 -->
selplat_freeze_one_call_per_immutable_boundary.2 = no_nested_selFreeze
<!-- selplat_freeze_one_call_per_immutable_boundary.3 的当前独立事实为 no_item_by_item_freeze。 -->
selplat_freeze_one_call_per_immutable_boundary.3 = no_item_by_item_freeze
<!-- DOM、控制器、实例注册表和其他运行时生命周期对象保持可变；需要对外返回状态时创建独立副本并只冻结该返回快照。 -->
selplat_runtime_object_freeze_boundary = runtime_controller_dom_registry_mutable
<!-- selplat_runtime_object_freeze_boundary.2 的当前独立事实为 freeze_returned_copy_only。 -->
selplat_runtime_object_freeze_boundary.2 = freeze_returned_copy_only
<!-- MDA 等生成器输出的 JavaScript 必须与现有应用遵守同一冻结结构，禁止模板继续生成已清理的嵌套写法。 -->
selplat_generated_javascript_freeze_parity = generated_template_same_boundary_rule
<!-- selplat_generated_javascript_freeze_parity.2 的当前独立事实为 nested_freeze_gate。 -->
selplat_generated_javascript_freeze_parity.2 = nested_freeze_gate
<!-- selplat_generated_javascript_freeze_parity.3 的当前独立事实为 regression_test。 -->
selplat_generated_javascript_freeze_parity.3 = regression_test
<!-- 应用装配脚本文件头必须说明公共组件用途；非简单函数必须写中文契约，复杂函数内部每个连续关键语句组必须解释业务目的，禁止为括号、逗号和语法字面量堆积机械注释。 -->
selplat_component_usage_documentation = application_header_chinese_component_purpose
<!-- selplat_component_usage_documentation.2 的当前独立事实为 nontrivial_function_chinese_contract。 -->
selplat_component_usage_documentation.2 = nontrivial_function_chinese_contract
<!-- selplat_component_usage_documentation.3 的当前独立事实为 complex_statement_group_business_intent_comment。 -->
selplat_component_usage_documentation.3 = complex_statement_group_business_intent_comment
<!-- selplat_component_usage_documentation.4 的当前独立事实为 no_punctuation_or_syntax_literal_comment。 -->
selplat_component_usage_documentation.4 = no_punctuation_or_syntax_literal_comment
<!-- selplat_component_usage_documentation.5 的当前独立事实为 public_api_table。 -->
selplat_component_usage_documentation.5 = public_api_table
<!-- selplat_component_usage_documentation.6 的当前独立事实为 minimal_mount_example。 -->
selplat_component_usage_documentation.6 = minimal_mount_example
<!-- 全部应用入口脚本统一扫描 app、selBase、可选 selAjax 和具名业务函数前置中文契约，后续项目不得退回独立命名体系。 -->
selplat_application_javascript_uniform_structure_gate = all_application_javascript
<!-- selplat_application_javascript_uniform_structure_gate.2 的当前独立事实为 entry_app。 -->
selplat_application_javascript_uniform_structure_gate.2 = entry_app
<!-- selplat_application_javascript_uniform_structure_gate.3 的当前独立事实为 selBase_required。 -->
selplat_application_javascript_uniform_structure_gate.3 = selBase_required
<!-- selplat_application_javascript_uniform_structure_gate.4 的当前独立事实为 selAjax_when_used。 -->
selplat_application_javascript_uniform_structure_gate.4 = selAjax_when_used
<!-- selplat_application_javascript_uniform_structure_gate.5 的当前独立事实为 named_business_function_preceding_chinese_contract。 -->
selplat_application_javascript_uniform_structure_gate.5 = named_business_function_preceding_chinese_contract

<!-- 所有应用传给 SEL 公共控件的实例 ID 必须由 sel、控件类型、正确英文业务含义和 Id 组成，并使用 lowerCamelCase。 -->
selplat_component_instance_id_naming = sel<ControlType><BusinessMeaning>Id
<!-- selplat_component_instance_id_naming.2 的当前独立事实为 lowerCamelCase。 -->
selplat_component_instance_id_naming.2 = lowerCamelCase
<!-- selplat_component_instance_id_naming.3 的当前独立事实为 correct_english_business_spelling。 -->
selplat_component_instance_id_naming.3 = correct_english_business_spelling
<!-- 同一物理控件切换多个业务模块时使用一个物理实例 ID；模块自己的 gridId 只作为数据库表格头稳定坐标，禁止混用事件实例键。 -->
selplat_shared_physical_grid_and_business_grid_id_boundary = physical_grid_instance_id_for_event_routing
<!-- selplat_shared_physical_grid_and_business_grid_id_boundary.2 的当前独立事实为 business_gridId_for_database_header_coordinate。 -->
selplat_shared_physical_grid_and_business_grid_id_boundary.2 = business_gridId_for_database_header_coordinate

<!-- 带脚本的控件必须通过内核发布登记的命名空间 API；纯样式单元不得虚构空 API。 -->
selplat_component_public_api_gate = script_registers_namespaced_publicApi
<!-- selplat_component_public_api_gate.2 的当前独立事实为 style_only_publicApi_null。 -->
selplat_component_public_api_gate.2 = style_only_publicApi_null
<!-- 主题感知样式必须消费 --sel-theme-* 令牌，应用不得复制控件边框、颜色和交互状态。 -->
selplat_component_theme_gate = themeAware_css_consumes_sel_theme_tokens
<!-- selplat_component_theme_gate.2 的当前独立事实为 no_application_visual_reimplementation。 -->
selplat_component_theme_gate.2 = no_application_visual_reimplementation
<!-- 玻璃主题工具栏外壳不得用贯穿容器的上下边线制造空白区域痕迹；边界视觉只属于内部真实控件。 -->
selplat_glass_admin_toolbar_surface_boundary = full_width_toolbar_has_no_top_or_bottom_border
<!-- selplat_glass_admin_toolbar_surface_boundary.2 的当前独立事实为 controls_keep_own_borders。 -->
selplat_glass_admin_toolbar_surface_boundary.2 = controls_keep_own_borders
<!-- selplat_glass_admin_toolbar_surface_boundary.3 的当前独立事实为 no_drag_or_layout_change。 -->
selplat_glass_admin_toolbar_surface_boundary.3 = no_drag_or_layout_change
<!-- 公共主题内容发生变化时，全部消费页面必须同步更新对应资源 URL 版本标识，确保普通刷新加载新样式。 -->
selplat_shared_theme_cache_delivery = shared_theme_content_change_requires_all_consumer_url_version_bumps
<!-- selplat_shared_theme_cache_delivery.2 的当前独立事实为 normal_reload_fetches_current_style。 -->
selplat_shared_theme_cache_delivery.2 = normal_reload_fetches_current_style
<!-- selplat_shared_theme_cache_delivery.3 的当前独立事实为 no_stale_open_page_cache。 -->
selplat_shared_theme_cache_delivery.3 = no_stale_open_page_cache
<!-- SEL内核或公共JavaScript能力变化时，消费页面必须同步提升内核、依赖能力和应用装配脚本的URL版本。 -->
selplat_shared_script_cache_delivery = kernel_dependency_and_application_url_versions_bump_together
<!-- 新内核不得与旧缓存能力脚本混载，普通刷新后所有require能力必须来自同一发布批次。 -->
selplat_shared_script_cache_delivery.2 = no_new_kernel_with_stale_capability_scripts
<!-- 页面启动关键CSS、字体和图标必须由SELPLAT同源资源交付，禁止依赖可能被浏览器隐私策略阻断的外部CDN。 -->
selplat_browser_critical_asset_origin = repository_managed_same_origin_only
<!-- 外部图标字体不可用时不得导致入口空白；桌面图标必须拥有同源文本或本地素材。 -->
selplat_browser_critical_asset_origin.2 = no_external_icon_cdn_and_local_fallback_required
<!-- 独立拖拽查询的父级只负责布局，不得绘制组合背景或内阴影；子控件位置变化后也只能看到真实控件。 -->
selplat_independent_search_parent_surface = transparent_parent
<!-- selplat_independent_search_parent_surface.2 的当前独立事实为 no_parent_inset_shadow。 -->
selplat_independent_search_parent_surface.2 = no_parent_inset_shadow
<!-- selplat_independent_search_parent_surface.3 的当前独立事实为 real_children_keep_own_surfaces。 -->
selplat_independent_search_parent_surface.3 = real_children_keep_own_surfaces
<!-- selplat_independent_search_parent_surface.4 的当前独立事实为 persisted_child_geometry_unchanged。 -->
selplat_independent_search_parent_surface.4 = persisted_child_geometry_unchanged
<!-- 控件硬依赖必须指向已登记单元，源码必须真实调用依赖 API，应用与生成模板必须在当前控件前加载依赖 CSS/JS。 -->
selplat_component_dependency_gate = registered_target
<!-- selplat_component_dependency_gate.2 的当前独立事实为 no_self_dependency。 -->
selplat_component_dependency_gate.2 = no_self_dependency
<!-- selplat_component_dependency_gate.3 的当前独立事实为 real_public_api_call。 -->
selplat_component_dependency_gate.3 = real_public_api_call
<!-- selplat_component_dependency_gate.4 的当前独立事实为 dependency_resource_exists_and_precedes_consumer。 -->
selplat_component_dependency_gate.4 = dependency_resource_exists_and_precedes_consumer
<!-- 公共表格编辑器只编排 Window、Grid 和调用方确认回调，列表交互不得复制公共基础控件。 -->
selplat_table_editor_public_composition = selWindow_outer
<!-- selplat_table_editor_public_composition.2 的当前独立事实为 selGrid_records_and_switch。 -->
selplat_table_editor_public_composition.2 = selGrid_records_and_switch
<!-- selplat_table_editor_public_composition.3 的当前独立事实为 selConfirmDialog_from_consumer。 -->
selplat_table_editor_public_composition.3 = selConfirmDialog_from_consumer
<!-- selplat_table_editor_public_composition.4 的当前独立事实为 grid_action_event。 -->
selplat_table_editor_public_composition.4 = grid_action_event
<!-- selplat_table_editor_public_composition.5 的当前独立事实为 forbid_private_table_button_switch_reimplementation。 -->
selplat_table_editor_public_composition.5 = forbid_private_table_button_switch_reimplementation
<!-- 表格编辑器拖拽必须只通过手柄触发，完整顺序先形成草稿并经公共确认后原子保存，取消或失败才回滚。 -->
selplat_table_editor_drag_reorder = selGrid_public_drag_handle_and_keyboard_arrows
<!-- selplat_table_editor_drag_reorder.2 的当前独立事实为 complete_visible_order_event。 -->
selplat_table_editor_drag_reorder.2 = complete_visible_order_event
<!-- selplat_table_editor_drag_reorder.3 的当前独立事实为 dragend_outside_tbody_keeps_valid_draft。 -->
selplat_table_editor_drag_reorder.3 = dragend_outside_tbody_keeps_valid_draft
<!-- selplat_table_editor_drag_reorder.4 的当前独立事实为 preview_draft_before_public_confirmation。 -->
selplat_table_editor_drag_reorder.4 = preview_draft_before_public_confirmation
<!-- selplat_table_editor_drag_reorder.5 的当前独立事实为 confirm_before_atomic_sortnum_batch_save。 -->
selplat_table_editor_drag_reorder.5 = confirm_before_atomic_sortnum_batch_save
<!-- selplat_table_editor_drag_reorder.6 的当前独立事实为 cancel_or_failure_restore_previous_order。 -->
selplat_table_editor_drag_reorder.6 = cancel_or_failure_restore_previous_order
<!-- selplat_table_editor_drag_reorder.7 的当前独立事实为 success_refresh_business_header。 -->
selplat_table_editor_drag_reorder.7 = success_refresh_business_header
<!-- 表头显示开关是呈现配置，不得改变管理列表记录的业务字段完整性。 -->
selplat_management_grid_hidden_column_contract = table_element_registered
<!-- selplat_management_grid_hidden_column_contract.2 的当前独立事实为 visible_false_rendering_only。 -->
selplat_management_grid_hidden_column_contract.2 = visible_false_rendering_only
<!-- selplat_management_grid_hidden_column_contract.3 的当前独立事实为 record_keeps_editor_fields。 -->
selplat_management_grid_hidden_column_contract.3 = record_keeps_editor_fields
<!-- selplat_management_grid_hidden_column_contract.4 的当前独立事实为 double_click_record_no_data_loss。 -->
selplat_management_grid_hidden_column_contract.4 = double_click_record_no_data_loss
<!-- selplat_management_grid_hidden_column_contract.5 的当前独立事实为 no_second_detail_request_for_hidden_field。 -->
selplat_management_grid_hidden_column_contract.5 = no_second_detail_request_for_hidden_field
<!-- 单条记录动作返回后只更新对应行；整表刷新只用于分页、查询、语言或列结构变化。 -->
selplat_grid_record_in_place_update_contract = public_updateRecord_by_id
<!-- selplat_grid_record_in_place_update_contract.2 的当前独立事实为 immutable_record_snapshot。 -->
selplat_grid_record_in_place_update_contract.2 = immutable_record_snapshot
<!-- selplat_grid_record_in_place_update_contract.3 的当前独立事实为 target_row_only。 -->
selplat_grid_record_in_place_update_contract.3 = target_row_only
<!-- selplat_grid_record_in_place_update_contract.4 的当前独立事实为 preserve_scroll_left_and_top。 -->
selplat_grid_record_in_place_update_contract.4 = preserve_scroll_left_and_top
<!-- selplat_grid_record_in_place_update_contract.5 的当前独立事实为 preserve_action_focus。 -->
selplat_grid_record_in_place_update_contract.5 = preserve_action_focus
<!-- selplat_grid_record_in_place_update_contract.6 的当前独立事实为 no_header_or_pagination_rebuild。 -->
selplat_grid_record_in_place_update_contract.6 = no_header_or_pagination_rebuild
<!-- selplat_grid_record_in_place_update_contract.7 的当前独立事实为 action_event_does_not_refresh。 -->
selplat_grid_record_in_place_update_contract.7 = action_event_does_not_refresh
<!-- selplat_grid_record_in_place_update_contract.8 的当前独立事实为 no_view_change_means_zero_render。 -->
selplat_grid_record_in_place_update_contract.8 = no_view_change_means_zero_render
<!-- selplat_grid_record_in_place_update_contract.9 的当前独立事实为 setLocale_for_dataset_or_structure_change_only。 -->
selplat_grid_record_in_place_update_contract.9 = setLocale_for_dataset_or_structure_change_only
<!-- Grid 图标颜色必须使用主题语义令牌，不允许业务模块写死色值。 -->
selplat_grid_cell_icon_tone_contract = public_cellIconTone
<!-- selplat_grid_cell_icon_tone_contract.2 的当前独立事实为 static_or_record_function。 -->
selplat_grid_cell_icon_tone_contract.2 = static_or_record_function
<!-- selplat_grid_cell_icon_tone_contract.3 的当前独立事实为 safe_class_token。 -->
selplat_grid_cell_icon_tone_contract.3 = safe_class_token
<!-- selplat_grid_cell_icon_tone_contract.4 的当前独立事实为 semantic_success_and_danger。 -->
selplat_grid_cell_icon_tone_contract.4 = semantic_success_and_danger
<!-- selplat_grid_cell_icon_tone_contract.5 的当前独立事实为 theme_token_color。 -->
selplat_grid_cell_icon_tone_contract.5 = theme_token_color
<!-- selplat_grid_cell_icon_tone_contract.6 的当前独立事实为 no_business_hardcoded_color。 -->
selplat_grid_cell_icon_tone_contract.6 = no_business_hardcoded_color
<!-- 控件资源依赖检查从中央登记动态生成，新增控件不得再靠人工补一个名称专项扫描。 -->
selplat_component_future_extension_gate = registry_driven_directory_source_api_theme_dependency_and_application_scan
