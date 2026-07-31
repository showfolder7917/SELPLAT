# 网页基础控件与应用装配层结构规则

<!-- 问题：基础控件、业务数据、页面布局和演示素材混在同一目录时，通用控件会逐渐读取业务全局对象、接口和实体，新增模块只能复制旧页面并继续扩大耦合。 -->
<!-- 场景：网页应用需要复用面板、表格、树、菜单、下拉等基础控件，并由应用装配层组合业务实例、演示数据和主题。 -->
<!-- 业务含义：基础层提供稳定能力和输入契约，应用层识别业务并组织调用；新增模块优先复用基础控件，缺少能力时先补基础层而不是在业务页面另写一套。 -->

web_static_base_root = static/sel/
web_static_base_core_directory = static/sel/core/
web_static_base_component_directory_pattern = static/sel/components/<component>/
web_static_base_asset_root = static/sel/assets/
web_static_base_component_asset_directory_pattern = static/sel/assets/components/<component>/
web_static_base_shared_asset_directory = static/sel/assets/shared/
web_static_base_background_asset_directory = static/sel/assets/backgrounds/
web_static_base_cursor_asset_directory = static/sel/assets/cursors/
web_static_base_icon_asset_directory = static/sel/assets/icons/
web_static_application_directory_pattern = static/<application>/
web_static_application_entry_pattern = static/<application>/<application>.html|css|js
web_static_application_mock_directory = static/<application>/mock/
web_static_application_theme_directory = static/<application>/theme/
web_static_application_asset_directory = static/<application>/assets/

<!-- 基础素材统一进入 static/sel/assets 并按用途分层；控件专用素材保留组件归属，真正被多个控件复用的素材才允许进入 shared。 -->
web_static_base_asset_root_must_not_be_flat = true
web_static_component_specific_asset_must_live_in = static/sel/assets/components/<component>/
web_static_shared_asset_requires_multiple_component_consumers = true
web_static_application_specific_asset_must_not_live_in_base_asset_root = true

<!-- 基础控件只接收标准输入，不识别具体应用、实体、接口地址、演示文件路径或应用全局对象。 -->
web_base_component_input = host-element,standard-data,generic-options
web_base_component_business_entity_knowledge_is_forbidden = true
web_base_component_application_global_read_is_forbidden = true
web_base_component_direct_application_api_request_is_forbidden = true
web_base_component_mock_path_knowledge_is_forbidden = true

<!-- 通用网络能力独立于页面运行时和 UI 控件；应用装配层拥有真实地址，selAjax 只执行显式配置并返回解析结果。 -->
web_base_ajax_file = static/sel/core/selAjax.js
web_base_ajax_public_api = window.selAjax
web_base_ajax_input = explicit-url,method,headers,data,signal
web_base_ajax_output = parsed-json-or-explicit-error
web_base_ajax_business_path_registry_is_forbidden = true
web_base_ajax_entity_or_instance_path_inference_is_forbidden = true
web_application_request_path_owner = application-assembler-data-source-registry
web_base_runtime_network_request_responsibility_is_forbidden = true

<!-- 基础脚本加载后只注册能力；业务实例必须由应用装配层通过 mount 显式创建。 -->
web_base_component_public_mount_required = true
web_base_component_public_structure_factory = create(host,instance-definition)
web_base_component_public_data_mount = mount(component-root,standard-payload-and-options)
web_base_component_document_auto_scan_and_mount_is_forbidden = true
web_base_component_duplicate_mount_must_reuse_or_reject = true
web_base_component_invalid_host_or_data_result = null-or-false-with-explicit-diagnostic
web_base_component_registry_key = complete-business-instance-key

<!-- 基础控件已经具备结构工厂时，应用 HTML 只声明应用级挂载点；标题、工具栏、树、表格、菜单和分页等内部结构由基础控件创建。 -->
web_application_html_component_internal_markup_is_forbidden = true
web_application_html_allowed_runtime_structure = resource-loading,application-mount-point,application-specific-static-content
web_application_assembler_must_use_base_structure_factory = true
web_application_assembler_generic_option_button_or_region_dom_creation_is_forbidden = true

<!-- 应用可以声明基础控件位于上、左、中、右、下哪个区域，但只能传组件名、标准 payload 路径、受控 slot 和 children；真实 DOM 仍由基础面板建立。 -->
web_application_assembler_layout_declaration = layout-id -> top,left,center,right,bottom
web_application_assembler_layout_item_fields = component,payload,slot,children
web_application_assembler_layout_may_reorder_or_remove_optional_region = true
web_application_assembler_layout_must_not_contain_html = true
web_base_panel_must_render_layout_from_controlled_component_registry = true
web_application_component_mount_must_follow_declared_layout = true

<!-- 应用装配层负责业务数据、语言、实例、页面静态文字、基础控件依赖检查和挂载顺序。 -->
web_application_assembler_responsibility = load-payload,select-locale,create-business-instance,apply-application-view,check-base-dependencies,mount-base-components,expose-application-api
web_application_assembler_may_know = application,module,business-entity,endpoint,mock-path,locale
web_application_assembler_must_not_reimplement_base_component = true
web_application_missing_base_component_behavior = stop-affected-assembly-and-report-component-name

<!-- “应用层不能直接使用原生控件”指禁止绕开基础组件重新实现通用 UI；基础控件内部必须继续使用原生语义元素。 -->
web_application_raw_dom_generic_component_implementation_is_forbidden = true
web_base_component_native_semantic_elements_required = button,select,table,input,navigation
web_base_component_native_semantics_are_not_business_layer_direct_implementation = true
web_accessibility_must_not_be_removed_to_avoid_native_elements = true

<!-- 应用 CSS 只负责页面级布局和应用专属外观，不得选择基础控件内部类；尺寸等合法差异通过基础控件公开选项或 CSS 变量传入。 -->
web_application_css_may_own = application-page-layout,application-specific-static-content
web_application_css_base_internal_selector_is_forbidden = true
web_application_base_visual_override_entry = base-component-public-option-or-namespaced-css-variable

<!-- 新增应用模块必须先声明实例和标准 payload；现有基础能力不足时先建立基础控件，再由应用装配层调用。 -->
web_new_module_steps = declare-instance-and-entity,define-standard-payload,declare-five-region-layout,bind-component-to-payload-path,check-existing-base-components,create-missing-base-component,mount-in-application-assembler,verify-multi-instance
web_new_module_must_not_modify_base_component_for_application_name_only = true
web_new_module_missing_base_capability_must_prompt_before_business_fallback = true
web_new_base_component_required_files = sel<Component>.js,sel<Component>.css
web_new_base_component_optional_files = assets/,README.md

<!-- 页面资源按依赖顺序加载：基础令牌、基础组件、应用主题、应用装配层。 -->
web_static_resource_load_order = base-core-css,base-component-css,application-css-and-theme,base-core-js,base-component-js,application-theme-js,application-assembler-js
web_application_assembler_javascript_must_load_last = true

<!-- 注释必须让维护者不读实现也能判断文件用途、区域边界、样式归属和缺失依赖处理。 -->
web_javascript_comment_must_cover = file-purpose,responsibility-boundary,public-api,standard-input,state,condition,event,side-effect,return
web_html_comment_must_cover = resource-group,region-begin,region-end,responsibility,deletion-impact,script-load-order
web_css_comment_must_cover = file-purpose,responsibility-boundary,component-group,state-group,responsive-or-accessibility-rule
web_json_comment_is_forbidden_use_readme_instead = true

<!-- 旧地址兼容入口不得继续承载组件代码、旧脚本或复制页面，只允许转交查询参数和锚点。 -->
web_legacy_page_compatibility_allowed = redirect-only
web_legacy_page_compatibility_component_implementation_is_forbidden = true

<!-- 交付必须验证目录引用、脚本语法、静态资源、应用依赖提示、多语言和双实例隔离。 -->
web_layered_frontend_qa_must_cover = path-reference,script-syntax,resource-http-status,missing-component-diagnostic,locales,multi-instance,isolation,browser-console

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
