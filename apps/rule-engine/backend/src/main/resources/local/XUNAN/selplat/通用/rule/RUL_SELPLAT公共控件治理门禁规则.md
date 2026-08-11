# SELPLAT 公共控件治理门禁规则

<!-- 本规则约束 SELPLAT 现有和未来全部原生前端控件，不依赖控件名称逐项追加规则。 -->
rule_scope = active_user_selplat_shared_ui_component_governance
<!-- 1.2.0 增加统一截断文字提示所有权、Grid/Tree 默认接入、显式关闭与原生 title 禁用门禁。 -->
rule_version = 1.2.0
<!-- 规则所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示登记表、快速门禁、公共构建门禁和回归测试均已接通。 -->
rule_status = active
<!-- 本规则复用源码归属扫描能力，不再建立第二套近义门禁程序。 -->
python_ability_refs = apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/selplat_source_ownership_guard.py
<!-- 公共控件由原生 JavaScript 实现，当前不新增 Java 或 Node 能力入口。 -->
java_ability_refs = none
<!-- 当前门禁由 Python 快速扫描和 Gradle 公共构建执行，不建立重复 Node 能力。 -->
node_ability_refs = none
<!-- 控件治理属于源码归属门禁的专项扩展，加载时必须同时保留其语言、目录和快速门禁约束。 -->
requires_rule_ids = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES

## 创建与登记

<!-- 可复用交互第一次出现时必须先登记公共控件，再由首个业务调用方接入；禁止先写业务私有版本以后再抽取。 -->
selplat_component_creation_sequence = classify_reusable_interaction,register_public_component,implement_public_component,connect_first_consumer,verify
<!-- 门禁只负责阻断和报告缺少的控件，不得静默自动生成未经过登记的公共 API。 -->
selplat_component_gate_auto_creation_policy = block_and_report,no_silent_component_generation
<!-- 公共控件唯一登记位于 sel-ui 组件根，版本、策略和控件数组缺一不可。 -->
selplat_component_registry = shared/frontend/sel-ui/src/components/component-registry.json,version=1,one_authoritative_source
<!-- 每个公开单元必须登记稳定 ID、目录、类型、JS、CSS、公开 API、硬依赖和主题属性。 -->
selplat_component_registration_required_fields = id,directory,type,scripts,styles,globalApi,dependencies,themeAware
<!-- 新控件目录和顶层 JS/CSS 必须且只能属于一个登记单元，未登记与重复所有者均直接阻断。 -->
selplat_component_source_ownership_gate = every_directory_registered,every_top_level_js_css_exactly_one_owner,no_duplicate_owner

## 通用分类与应用边界

<!-- 自有开关状态、body 门户、键盘焦点生命周期、跨页面复用或完整 DOM/CSS/事件生命周期任一成立时必须按公共控件治理。 -->
selplat_reusable_control_classification = own_state|body_portal|keyboard_focus_lifecycle|multi_page_reuse|complete_dom_css_event_lifecycle
<!-- 应用只能提供宿主、数据、动作和回调，不得发布 window.sel<Component> 或自行创建 body 交互门户。 -->
selplat_application_component_boundary = host_data_action_callback_only,no_private_sel_global_api,no_private_body_portal
<!-- 已由公共控件登记拥有的 ARIA 交互角色不得在应用页面或其他控件中重复实现。 -->
selplat_component_owned_interaction_gate = registered_owned_aria_role_single_owner,no_application_reimplementation
<!-- 本轮启用新公共控件后直接删除旧私有 DOM、样式、定位和事件链，不保留兼容选择或降级分支。 -->
selplat_component_legacy_replacement_policy = enable_registered_component,delete_private_legacy_implementation,no_compatibility_branch

## API、主题与依赖

<!-- 带脚本的控件必须发布与登记 ID 相同的全局 API；纯样式单元不得虚构空 API。 -->
selplat_component_public_api_gate = script_global_api_equals_registered_id,style_only_global_api_null
<!-- 主题感知样式必须消费 --sel-theme-* 令牌，应用不得复制控件边框、颜色和交互状态。 -->
selplat_component_theme_gate = themeAware_css_consumes_sel_theme_tokens,no_application_visual_reimplementation
<!-- 控件硬依赖必须指向已登记单元，源码必须真实调用依赖 API，应用与生成模板必须在当前控件前加载依赖 CSS/JS。 -->
selplat_component_dependency_gate = registered_target,no_self_dependency,real_public_api_call,dependency_resource_exists_and_precedes_consumer
<!-- 控件资源依赖检查从中央登记动态生成，新增控件不得再靠人工补一个名称专项扫描。 -->
selplat_component_future_extension_gate = registry_driven_directory_source_api_theme_dependency_and_application_scan

## 统一语义文字

<!-- 全部公共控件和应用消费控件时只允许使用七级可读文字角色；业务含义是新增页面不再退回只有大中小三档、层级无法表达的字号体系。 -->
selplat_semantic_typography_roles = display,title,heading,body,label,caption,micro
<!-- 七级字号必须配套统一 regular、medium、semibold、bold 字重及角色行高；业务含义是相同角色跨控件保持可读密度和视觉重量。 -->
selplat_semantic_typography_metrics = font_size,font_weight,line_height
<!-- primary 与 secondary 旧字号令牌已删除且禁止兼容；业务含义是新旧名称不会并存造成不同控件继续走不同体系。 -->
selplat_legacy_typography_token_policy = forbid(--sel-theme-font-size-primary,--sel-theme-font-size-secondary),no_compatibility_alias
<!-- 可读文字禁止直接写像素字号，图标、头像、复选框及其他几何图形尺寸除外；业务含义是主题缩放只改变文字，不破坏控件图形比例。 -->
selplat_component_text_size_boundary = readable_text_uses_semantic_tokens,icon_avatar_checkbox_geometry_may_use_fixed_size
<!-- 公共树按通用节点类型表达层级，调用方也可显式覆盖；未知类型回落 label，禁止按应用名推测。 -->
selplat_tree_typography_mapping = database|catalog:heading,schema:body,table|view:label,field|column:caption,unknown:label,explicit:typographyRole

## 统一截断文字提示

<!-- 截断文字提示由登记的 selTooltip 独占门户、role=tooltip、定位、延时和可访问关联，Grid、Tree 或应用不得复制实现。 -->
selplat_truncated_text_tooltip_owner = selTooltip,one_body_portal,owned_role_tooltip,no_private_reimplementation
<!-- Grid 与 Tree 默认接入统一提示，只在真实 overflow 时展示完整文字；鼠标、键盘、滚动、缩放和 Escape 生命周期必须一致。 -->
selplat_truncated_text_tooltip_behavior = grid_and_tree_default_enabled,real_overflow_only,pointer_and_focus,hide_on_scroll_resize_escape
<!-- 调用方只有明确不需要提示时才可通过 grid.tooltip=false 或 tree.tooltip=false 关闭，禁止建立相反的默认关闭配置。 -->
selplat_truncated_text_tooltip_disable_api = grid.tooltip=false,tree.tooltip=false,default_enabled
<!-- Grid 与 Tree 的截断文字不得使用浏览器原生 title；启用 selTooltip 后必须删除旧 title 路径且不保留兼容分支。 -->
selplat_truncated_text_native_title_policy = forbidden_in_grid_and_tree,delete_legacy_title,no_compatibility_branch

## 验证

<!-- 快速门禁执行登记、源码归属、应用私造和生成模板依赖检查，不启动浏览器或业务数据库。 -->
selplat_component_quick_gate = selplat_source_ownership_guard,zero_component_governance_violations
<!-- 快速门禁同步检查七级令牌完整性、树层级选择器和旧字号令牌清零。 -->
selplat_component_typography_quick_gate = seven_roles,weight_and_line_height_metrics,tree_role_mapping,zero_primary_secondary_legacy_token
<!-- 公共前端 check 必须独立解析同一登记，阻断未登记源码、错误 API、缺失主题令牌和错误资源顺序。 -->
selplat_component_build_gate = shared_frontend_sel_ui_verifySelUiSourceBoundary,one_registry_same_policy
<!-- 快速门禁和公共构建同时验证 selTooltip 关键生命周期、Grid/Tree 消费、原生 title 清零和依赖资源顺序。 -->
selplat_tooltip_gate = tooltip_contract,grid_tree_consumers,zero_native_title,registry_dependency_resource_order
<!-- 控件迁移至少验证旧选择器清零、新公共 API 调用、应用装配测试和真实浏览器交互与控制台。 -->
selplat_component_migration_verification = no_legacy_selector,registered_api_call,application_tests,real_browser_interaction_and_console
<!-- 登记结构和首个调用方是权威样例，不复制会与真实控件漂移的静态模板。 -->
template_not_applicable_reason = component_registry_and_first_consumer_are_the_authoritative_structure
<!-- 同一生产门禁同时覆盖全部控件，无需建立控件治理专用第二程序。 -->
program_not_applicable_reason = existing_source_ownership_guard_is_extended_as_the_single_quick_gate
