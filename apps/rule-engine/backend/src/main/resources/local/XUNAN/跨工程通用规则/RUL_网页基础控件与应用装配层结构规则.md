# 网页基础控件与应用装配层结构规则

<!-- 问题：基础控件、业务数据、页面布局和演示素材混在同一目录时，通用控件会逐渐读取业务全局对象、接口和实体，新增模块只能复制旧页面并继续扩大耦合。 -->
<!-- 场景：网页应用需要复用面板、表格、树、菜单、下拉等基础控件，并由应用装配层组合业务实例、演示数据和主题。 -->
<!-- 业务含义：基础层提供稳定能力和输入契约，应用层识别业务并组织调用；新增模块优先复用基础控件，缺少能力时先补基础层而不是在业务页面另写一套。 -->

<!-- web_static_base_root 的当前独立事实为 static/sel/。 -->
web_static_base_root = static/sel/
<!-- web_static_base_core_directory 的当前独立事实为 static/sel/core/。 -->
web_static_base_core_directory = static/sel/core/
<!-- web_static_base_component_directory_pattern 的当前独立事实为 static/sel/components/<component>/。 -->
web_static_base_component_directory_pattern = static/sel/components/<component>/
<!-- web_static_base_asset_root 的当前独立事实为 static/sel/assets/。 -->
web_static_base_asset_root = static/sel/assets/
<!-- web_static_base_component_asset_directory_pattern 的当前独立事实为 static/sel/assets/components/<component>/。 -->
web_static_base_component_asset_directory_pattern = static/sel/assets/components/<component>/
<!-- web_static_base_theme_asset_directory_pattern 的当前独立事实为 static/sel/assets/themes/<theme-id>/。 -->
web_static_base_theme_asset_directory_pattern = static/sel/assets/themes/<theme-id>/
<!-- web_static_base_theme_skin_bundle_directory_pattern 的当前独立事实为 static/sel/assets/themes/<theme-id>/<mode>/base/|static/sel/assets/themes/<theme-id>/<mode>/accents/<accent-id>/。 -->
web_static_base_theme_skin_bundle_directory_pattern = static/sel/assets/themes/<theme-id>/<mode>/base/|static/sel/assets/themes/<theme-id>/<mode>/accents/<accent-id>/
<!-- web_static_base_shared_asset_directory 的当前独立事实为 static/sel/assets/shared/。 -->
web_static_base_shared_asset_directory = static/sel/assets/shared/
<!-- web_static_base_background_asset_directory 的当前独立事实为 static/sel/assets/backgrounds/。 -->
web_static_base_background_asset_directory = static/sel/assets/backgrounds/
<!-- web_static_base_cursor_asset_directory 的当前独立事实为 static/sel/assets/cursors/。 -->
web_static_base_cursor_asset_directory = static/sel/assets/cursors/
<!-- web_static_base_icon_asset_directory 的当前独立事实为 static/sel/assets/icons/。 -->
web_static_base_icon_asset_directory = static/sel/assets/icons/
<!-- web_static_application_directory_pattern 的当前独立事实为 static/<application>/。 -->
web_static_application_directory_pattern = static/<application>/
<!-- web_static_application_entry_pattern 的当前独立事实为 static/<application>/<application>.html|css|js。 -->
web_static_application_entry_pattern = static/<application>/<application>.html|css|js
<!-- web_static_application_mock_directory 的当前独立事实为 static/<application>/mock/。 -->
web_static_application_mock_directory = static/<application>/mock/
<!-- web_static_application_theme_directory 的当前独立事实为 static/<application>/theme/。 -->
web_static_application_theme_directory = static/<application>/theme/
<!-- web_static_application_asset_directory 的当前独立事实为 static/<application>/assets/。 -->
web_static_application_asset_directory = static/<application>/assets/

<!-- 基础素材统一进入 static/sel/assets 并按用途分层；控件专用素材保留组件归属，主题独占素材保留主题归属，真正被多个控件复用的素材才允许进入 shared。 -->
web_static_base_asset_root_must_not_be_flat = true
<!-- web_static_component_specific_asset_must_live_in 的当前独立事实为 static/sel/assets/components/<component>/。 -->
web_static_component_specific_asset_must_live_in = static/sel/assets/components/<component>/
<!-- web_static_theme_specific_asset_must_live_in 的当前独立事实为 static/sel/assets/themes/<theme-id>/。 -->
web_static_theme_specific_asset_must_live_in = static/sel/assets/themes/<theme-id>/
<!-- web_static_theme_asset_owner 的当前独立事实为 static/sel/theme/packs/<theme-id>/manifest.js。 -->
web_static_theme_asset_owner = static/sel/theme/packs/<theme-id>/manifest.js
<!-- web_static_shared_asset_requires_multiple_component_consumers 的当前独立事实为 true。 -->
web_static_shared_asset_requires_multiple_component_consumers = true
<!-- web_static_application_specific_asset_must_not_live_in_base_asset_root 的当前独立事实为 true。 -->
web_static_application_specific_asset_must_not_live_in_base_asset_root = true

<!-- 基础控件只接收标准输入，不识别具体应用、实体、接口地址、演示文件路径或应用全局对象。 -->
web_base_component_input = host-element
<!-- web_base_component_input.2 的当前独立事实为 standard-data。 -->
web_base_component_input.2 = standard-data
<!-- web_base_component_input.3 的当前独立事实为 generic-options。 -->
web_base_component_input.3 = generic-options
<!-- web_base_component_business_entity_knowledge_is_forbidden 的当前独立事实为 true。 -->
web_base_component_business_entity_knowledge_is_forbidden = true
<!-- web_base_component_application_global_read_is_forbidden 的当前独立事实为 true。 -->
web_base_component_application_global_read_is_forbidden = true
<!-- web_base_component_direct_application_api_request_is_forbidden 的当前独立事实为 true。 -->
web_base_component_direct_application_api_request_is_forbidden = true
<!-- web_base_component_mock_path_knowledge_is_forbidden 的当前独立事实为 true。 -->
web_base_component_mock_path_knowledge_is_forbidden = true

<!-- 通用网络能力独立于页面运行时和 UI 控件；应用装配层拥有真实地址，selAjax 只执行显式配置并返回解析结果。 -->
web_base_ajax_file = static/sel/core/selAjax.js
<!-- web_base_ajax_public_api 的当前独立事实为 window.selAjax。 -->
web_base_ajax_public_api = window.selAjax
<!-- web_base_ajax_input 的当前独立事实为 explicit-url。 -->
web_base_ajax_input = explicit-url
<!-- web_base_ajax_input.2 的当前独立事实为 method。 -->
web_base_ajax_input.2 = method
<!-- web_base_ajax_input.3 的当前独立事实为 headers。 -->
web_base_ajax_input.3 = headers
<!-- web_base_ajax_input.4 的当前独立事实为 data。 -->
web_base_ajax_input.4 = data
<!-- web_base_ajax_input.5 的当前独立事实为 signal。 -->
web_base_ajax_input.5 = signal
<!-- web_base_ajax_output 的当前独立事实为 parsed-json-or-explicit-error。 -->
web_base_ajax_output = parsed-json-or-explicit-error
<!-- web_base_ajax_business_path_registry_is_forbidden 的当前独立事实为 true。 -->
web_base_ajax_business_path_registry_is_forbidden = true
<!-- web_base_ajax_entity_or_instance_path_inference_is_forbidden 的当前独立事实为 true。 -->
web_base_ajax_entity_or_instance_path_inference_is_forbidden = true
<!-- web_application_request_path_owner 的当前独立事实为 application-assembler-data-source-registry。 -->
web_application_request_path_owner = application-assembler-data-source-registry
<!-- web_base_runtime_network_request_responsibility_is_forbidden 的当前独立事实为 true。 -->
web_base_runtime_network_request_responsibility_is_forbidden = true

<!-- 基础脚本加载后只注册能力；业务实例必须由应用装配层通过 mount 显式创建。 -->
web_base_component_public_mount_required = true
<!-- web_base_component_public_structure_factory 的当前独立事实为 create(host,instance-definition)。 -->
web_base_component_public_structure_factory = create(host,instance-definition)
<!-- web_base_component_public_data_mount 的当前独立事实为 mount(component-root,standard-payload-and-options)。 -->
web_base_component_public_data_mount = mount(component-root,standard-payload-and-options)
<!-- web_base_component_document_auto_scan_and_mount_is_forbidden 的当前独立事实为 true。 -->
web_base_component_document_auto_scan_and_mount_is_forbidden = true
<!-- web_base_component_duplicate_mount_must_reuse_or_reject 的当前独立事实为 true。 -->
web_base_component_duplicate_mount_must_reuse_or_reject = true
<!-- web_base_component_invalid_host_or_data_result 的当前独立事实为 null-or-false-with-explicit-diagnostic。 -->
web_base_component_invalid_host_or_data_result = null-or-false-with-explicit-diagnostic
<!-- web_base_component_registry_key 的当前独立事实为 complete-business-instance-key。 -->
web_base_component_registry_key = complete-business-instance-key

<!-- 基础控件已经具备结构工厂时，应用 HTML 默认只声明应用级挂载点；标题、工具栏、树、表格、菜单和分页等内部结构通常由基础控件创建。 -->
<!-- 为便于静态页面评审，应用可显式保留可见的页面结构；此时基础控件只绑定控制器、数据和交互，不得由应用复制通用控件逻辑或接管基础控件样式。 -->
web_application_html_component_internal_markup_is_forbidden = default-true-except-explicit-static-review-structure
<!-- web_application_html_static_review_structure_requires 的当前独立事实为 explicit-application-declaration。 -->
web_application_html_static_review_structure_requires = explicit-application-declaration
<!-- web_application_html_static_review_structure_requires.2 的当前独立事实为 base-controller-binding。 -->
web_application_html_static_review_structure_requires.2 = base-controller-binding
<!-- web_application_html_static_review_structure_requires.3 的当前独立事实为 base-standard-data-contract。 -->
web_application_html_static_review_structure_requires.3 = base-standard-data-contract
<!-- web_application_html_static_review_structure_requires.4 的当前独立事实为 no-generic-control-reimplementation。 -->
web_application_html_static_review_structure_requires.4 = no-generic-control-reimplementation
<!-- web_application_html_static_review_structure_requires.5 的当前独立事实为 no-base-internal-style-ownership。 -->
web_application_html_static_review_structure_requires.5 = no-base-internal-style-ownership
<!-- web_application_html_allowed_runtime_structure 的当前独立事实为 resource-loading。 -->
web_application_html_allowed_runtime_structure = resource-loading
<!-- web_application_html_allowed_runtime_structure.2 的当前独立事实为 application-mount-point。 -->
web_application_html_allowed_runtime_structure.2 = application-mount-point
<!-- web_application_html_allowed_runtime_structure.3 的当前独立事实为 application-specific-static-content。 -->
web_application_html_allowed_runtime_structure.3 = application-specific-static-content
<!-- web_application_html_allowed_runtime_structure.4 的当前独立事实为 explicit-static-review-structure。 -->
web_application_html_allowed_runtime_structure.4 = explicit-static-review-structure
<!-- web_application_assembler_must_use_base_structure_factory 的当前独立事实为 unless-explicit-static-review-structure。 -->
web_application_assembler_must_use_base_structure_factory = unless-explicit-static-review-structure
<!-- web_application_assembler_generic_option_button_or_region_dom_creation_is_forbidden 的当前独立事实为 true。 -->
web_application_assembler_generic_option_button_or_region_dom_creation_is_forbidden = true

<!-- 应用可以声明基础控件位于上、左、中、右、下哪个区域，但只能传组件名、标准 payload 路径、受控 slot 和 children；真实 DOM 仍由基础面板建立。 -->
web_application_assembler_layout_declaration = layout-id -> top
<!-- web_application_assembler_layout_declaration.2 的当前独立事实为 left。 -->
web_application_assembler_layout_declaration.2 = left
<!-- web_application_assembler_layout_declaration.3 的当前独立事实为 center。 -->
web_application_assembler_layout_declaration.3 = center
<!-- web_application_assembler_layout_declaration.4 的当前独立事实为 right。 -->
web_application_assembler_layout_declaration.4 = right
<!-- web_application_assembler_layout_declaration.5 的当前独立事实为 bottom。 -->
web_application_assembler_layout_declaration.5 = bottom
<!-- web_application_assembler_layout_item_fields 的当前独立事实为 component。 -->
web_application_assembler_layout_item_fields = component
<!-- web_application_assembler_layout_item_fields.2 的当前独立事实为 payload。 -->
web_application_assembler_layout_item_fields.2 = payload
<!-- web_application_assembler_layout_item_fields.3 的当前独立事实为 slot。 -->
web_application_assembler_layout_item_fields.3 = slot
<!-- web_application_assembler_layout_item_fields.4 的当前独立事实为 children。 -->
web_application_assembler_layout_item_fields.4 = children
<!-- web_application_assembler_layout_may_reorder_or_remove_optional_region 的当前独立事实为 true。 -->
web_application_assembler_layout_may_reorder_or_remove_optional_region = true
<!-- web_application_assembler_layout_must_not_contain_html 的当前独立事实为 true。 -->
web_application_assembler_layout_must_not_contain_html = true
<!-- web_base_panel_must_render_layout_from_controlled_component_registry 的当前独立事实为 true。 -->
web_base_panel_must_render_layout_from_controlled_component_registry = true
<!-- web_application_component_mount_must_follow_declared_layout 的当前独立事实为 true。 -->
web_application_component_mount_must_follow_declared_layout = true

<!-- 应用装配层负责业务数据、语言、实例、页面静态文字、基础控件依赖检查和挂载顺序。 -->
web_application_assembler_responsibility = load-payload
<!-- web_application_assembler_responsibility.2 的当前独立事实为 select-locale。 -->
web_application_assembler_responsibility.2 = select-locale
<!-- web_application_assembler_responsibility.3 的当前独立事实为 create-business-instance。 -->
web_application_assembler_responsibility.3 = create-business-instance
<!-- web_application_assembler_responsibility.4 的当前独立事实为 apply-application-view。 -->
web_application_assembler_responsibility.4 = apply-application-view
<!-- web_application_assembler_responsibility.5 的当前独立事实为 check-base-dependencies。 -->
web_application_assembler_responsibility.5 = check-base-dependencies
<!-- web_application_assembler_responsibility.6 的当前独立事实为 mount-base-components。 -->
web_application_assembler_responsibility.6 = mount-base-components
<!-- web_application_assembler_responsibility.7 的当前独立事实为 expose-application-api。 -->
web_application_assembler_responsibility.7 = expose-application-api
<!-- web_application_assembler_may_know 的当前独立事实为 application。 -->
web_application_assembler_may_know = application
<!-- web_application_assembler_may_know.2 的当前独立事实为 module。 -->
web_application_assembler_may_know.2 = module
<!-- web_application_assembler_may_know.3 的当前独立事实为 business-entity。 -->
web_application_assembler_may_know.3 = business-entity
<!-- web_application_assembler_may_know.4 的当前独立事实为 endpoint。 -->
web_application_assembler_may_know.4 = endpoint
<!-- web_application_assembler_may_know.5 的当前独立事实为 mock-path。 -->
web_application_assembler_may_know.5 = mock-path
<!-- web_application_assembler_may_know.6 的当前独立事实为 locale。 -->
web_application_assembler_may_know.6 = locale
<!-- web_application_assembler_must_not_reimplement_base_component 的当前独立事实为 true。 -->
web_application_assembler_must_not_reimplement_base_component = true
<!-- web_application_missing_base_component_behavior 的当前独立事实为 stop-affected-assembly-and-report-component-name。 -->
web_application_missing_base_component_behavior = stop-affected-assembly-and-report-component-name

<!-- “应用层不能直接使用原生控件”指禁止绕开基础组件重新实现通用 UI；基础控件内部必须继续使用原生语义元素。 -->
web_application_raw_dom_generic_component_implementation_is_forbidden = true
<!-- web_base_component_native_semantic_elements_required 的当前独立事实为 button。 -->
web_base_component_native_semantic_elements_required = button
<!-- web_base_component_native_semantic_elements_required.2 的当前独立事实为 select。 -->
web_base_component_native_semantic_elements_required.2 = select
<!-- web_base_component_native_semantic_elements_required.3 的当前独立事实为 table。 -->
web_base_component_native_semantic_elements_required.3 = table
<!-- web_base_component_native_semantic_elements_required.4 的当前独立事实为 input。 -->
web_base_component_native_semantic_elements_required.4 = input
<!-- web_base_component_native_semantic_elements_required.5 的当前独立事实为 navigation。 -->
web_base_component_native_semantic_elements_required.5 = navigation
<!-- web_base_component_native_semantics_are_not_business_layer_direct_implementation 的当前独立事实为 true。 -->
web_base_component_native_semantics_are_not_business_layer_direct_implementation = true
<!-- web_accessibility_must_not_be_removed_to_avoid_native_elements 的当前独立事实为 true。 -->
web_accessibility_must_not_be_removed_to_avoid_native_elements = true

<!-- 应用 CSS 只负责页面级布局和应用专属外观，不得选择基础控件内部类；尺寸等合法差异通过基础控件公开选项或 CSS 变量传入。 -->
web_application_css_may_own = application-page-layout
<!-- web_application_css_may_own.2 的当前独立事实为 application-specific-static-content。 -->
web_application_css_may_own.2 = application-specific-static-content
<!-- web_application_css_base_internal_selector_is_forbidden 的当前独立事实为 true。 -->
web_application_css_base_internal_selector_is_forbidden = true
<!-- web_application_base_visual_override_entry 的当前独立事实为 base-component-public-option-or-namespaced-css-variable。 -->
web_application_base_visual_override_entry = base-component-public-option-or-namespaced-css-variable

<!-- 新增应用模块必须先声明实例和标准 payload；现有基础能力不足时先建立基础控件，再由应用装配层调用。 -->
web_new_module_steps = declare-instance-and-entity
<!-- web_new_module_steps.2 的当前独立事实为 define-standard-payload。 -->
web_new_module_steps.2 = define-standard-payload
<!-- web_new_module_steps.3 的当前独立事实为 declare-five-region-layout。 -->
web_new_module_steps.3 = declare-five-region-layout
<!-- web_new_module_steps.4 的当前独立事实为 bind-component-to-payload-path。 -->
web_new_module_steps.4 = bind-component-to-payload-path
<!-- web_new_module_steps.5 的当前独立事实为 check-existing-base-components。 -->
web_new_module_steps.5 = check-existing-base-components
<!-- web_new_module_steps.6 的当前独立事实为 create-missing-base-component。 -->
web_new_module_steps.6 = create-missing-base-component
<!-- web_new_module_steps.7 的当前独立事实为 mount-in-application-assembler。 -->
web_new_module_steps.7 = mount-in-application-assembler
<!-- web_new_module_steps.8 的当前独立事实为 verify-multi-instance。 -->
web_new_module_steps.8 = verify-multi-instance
<!-- web_new_module_must_not_modify_base_component_for_application_name_only 的当前独立事实为 true。 -->
web_new_module_must_not_modify_base_component_for_application_name_only = true
<!-- web_new_module_missing_base_capability_must_prompt_before_business_fallback 的当前独立事实为 true。 -->
web_new_module_missing_base_capability_must_prompt_before_business_fallback = true
<!-- web_new_base_component_required_files 的当前独立事实为 sel<Component>.js。 -->
web_new_base_component_required_files = sel<Component>.js
<!-- web_new_base_component_required_files.2 的当前独立事实为 sel<Component>.css。 -->
web_new_base_component_required_files.2 = sel<Component>.css
<!-- web_new_base_component_optional_files 的当前独立事实为 assets/。 -->
web_new_base_component_optional_files = assets/
<!-- web_new_base_component_optional_files.2 的当前独立事实为 README.md。 -->
web_new_base_component_optional_files.2 = README.md

<!-- 页面资源按依赖顺序加载：基础令牌、基础组件、应用主题、应用装配层。 -->
web_static_resource_load_order = base-core-css
<!-- web_static_resource_load_order.2 的当前独立事实为 base-component-css。 -->
web_static_resource_load_order.2 = base-component-css
<!-- web_static_resource_load_order.3 的当前独立事实为 application-css-and-theme。 -->
web_static_resource_load_order.3 = application-css-and-theme
<!-- web_static_resource_load_order.4 的当前独立事实为 base-core-js。 -->
web_static_resource_load_order.4 = base-core-js
<!-- web_static_resource_load_order.5 的当前独立事实为 base-component-js。 -->
web_static_resource_load_order.5 = base-component-js
<!-- web_static_resource_load_order.6 的当前独立事实为 application-theme-js。 -->
web_static_resource_load_order.6 = application-theme-js
<!-- web_static_resource_load_order.7 的当前独立事实为 application-assembler-js。 -->
web_static_resource_load_order.7 = application-assembler-js
<!-- web_application_assembler_javascript_must_load_last 的当前独立事实为 true。 -->
web_application_assembler_javascript_must_load_last = true

<!-- 注释必须让维护者不读实现也能判断文件用途、区域边界、样式归属和缺失依赖处理。 -->
web_javascript_comment_must_cover = file-purpose
<!-- web_javascript_comment_must_cover.2 的当前独立事实为 responsibility-boundary。 -->
web_javascript_comment_must_cover.2 = responsibility-boundary
<!-- web_javascript_comment_must_cover.3 的当前独立事实为 public-api。 -->
web_javascript_comment_must_cover.3 = public-api
<!-- web_javascript_comment_must_cover.4 的当前独立事实为 standard-input。 -->
web_javascript_comment_must_cover.4 = standard-input
<!-- web_javascript_comment_must_cover.5 的当前独立事实为 state。 -->
web_javascript_comment_must_cover.5 = state
<!-- web_javascript_comment_must_cover.6 的当前独立事实为 condition。 -->
web_javascript_comment_must_cover.6 = condition
<!-- web_javascript_comment_must_cover.7 的当前独立事实为 event。 -->
web_javascript_comment_must_cover.7 = event
<!-- web_javascript_comment_must_cover.8 的当前独立事实为 side-effect。 -->
web_javascript_comment_must_cover.8 = side-effect
<!-- web_javascript_comment_must_cover.9 的当前独立事实为 return。 -->
web_javascript_comment_must_cover.9 = return
<!-- web_html_comment_must_cover 的当前独立事实为 resource-group。 -->
web_html_comment_must_cover = resource-group
<!-- web_html_comment_must_cover.2 的当前独立事实为 region-begin。 -->
web_html_comment_must_cover.2 = region-begin
<!-- web_html_comment_must_cover.3 的当前独立事实为 region-end。 -->
web_html_comment_must_cover.3 = region-end
<!-- web_html_comment_must_cover.4 的当前独立事实为 responsibility。 -->
web_html_comment_must_cover.4 = responsibility
<!-- web_html_comment_must_cover.5 的当前独立事实为 deletion-impact。 -->
web_html_comment_must_cover.5 = deletion-impact
<!-- web_html_comment_must_cover.6 的当前独立事实为 script-load-order。 -->
web_html_comment_must_cover.6 = script-load-order
<!-- web_css_comment_must_cover 的当前独立事实为 file-purpose。 -->
web_css_comment_must_cover = file-purpose
<!-- web_css_comment_must_cover.2 的当前独立事实为 responsibility-boundary。 -->
web_css_comment_must_cover.2 = responsibility-boundary
<!-- web_css_comment_must_cover.3 的当前独立事实为 component-group。 -->
web_css_comment_must_cover.3 = component-group
<!-- web_css_comment_must_cover.4 的当前独立事实为 state-group。 -->
web_css_comment_must_cover.4 = state-group
<!-- web_css_comment_must_cover.5 的当前独立事实为 responsive-or-accessibility-rule。 -->
web_css_comment_must_cover.5 = responsive-or-accessibility-rule
<!-- web_json_comment_is_forbidden_use_readme_instead 的当前独立事实为 true。 -->
web_json_comment_is_forbidden_use_readme_instead = true

<!-- 旧地址兼容入口不得继续承载组件代码、旧脚本或复制页面，只允许转交查询参数和锚点。 -->
web_legacy_page_compatibility_allowed = redirect-only
<!-- web_legacy_page_compatibility_component_implementation_is_forbidden 的当前独立事实为 true。 -->
web_legacy_page_compatibility_component_implementation_is_forbidden = true

<!-- 交付必须验证目录引用、脚本语法、静态资源、应用依赖提示、多语言和双实例隔离。 -->
web_layered_frontend_qa_must_cover = path-reference
<!-- web_layered_frontend_qa_must_cover.2 的当前独立事实为 script-syntax。 -->
web_layered_frontend_qa_must_cover.2 = script-syntax
<!-- web_layered_frontend_qa_must_cover.3 的当前独立事实为 resource-http-status。 -->
web_layered_frontend_qa_must_cover.3 = resource-http-status
<!-- web_layered_frontend_qa_must_cover.4 的当前独立事实为 missing-component-diagnostic。 -->
web_layered_frontend_qa_must_cover.4 = missing-component-diagnostic
<!-- web_layered_frontend_qa_must_cover.5 的当前独立事实为 locales。 -->
web_layered_frontend_qa_must_cover.5 = locales
<!-- web_layered_frontend_qa_must_cover.6 的当前独立事实为 multi-instance。 -->
web_layered_frontend_qa_must_cover.6 = multi-instance
<!-- web_layered_frontend_qa_must_cover.7 的当前独立事实为 isolation。 -->
web_layered_frontend_qa_must_cover.7 = isolation
<!-- web_layered_frontend_qa_must_cover.8 的当前独立事实为 browser-console。 -->
web_layered_frontend_qa_must_cover.8 = browser-console

<!-- java_ability_refs 的当前独立事实为 none。 -->
java_ability_refs = none
<!-- python_ability_refs 的当前独立事实为 none。 -->
python_ability_refs = none
<!-- node_ability_refs 的当前独立事实为 none。 -->
node_ability_refs = none
