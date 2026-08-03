# uniauth 静态页面前端命名规则

<!-- 问题：静态演示页面若使用 project、item、button、is-open 等无模块归属类名，多个组件组合后无法从名称判断样式来源，重构时也容易误改其他模块。 -->
<!-- 场景：apps/uniauth 的静态 HTML、CSS、JavaScript 文件名、模块标识、公开接口、事件、组件样式及脚本动态创建或切换的样式类。 -->
<!-- 业务含义：每个文件和名称直接表达所属基础能力或组件、业务分组和具体用途，使公共运行时、表格、菜单及后续组件可以独立维护并安全组合。 -->

uniauth_static_ui_component_prefix_pattern = sel<component>
uniauth_grid_component_prefix = selgrid
uniauth_panel_component_prefix = selpanel
uniauth_tree_component_prefix = seltree
uniauth_search_component_prefix = selsearch
uniauth_dropdown_component_prefix = seldropdown
uniauth_cursor_component_prefix = selcursor
uniauth_dropdown_menu_style_file = selDropdownMenu.css
uniauth_dropdown_menu_javascript_file = selDropdownMenu.js
uniauth_dropdown_menu_root_attribute = data-sel-dropdown-menu
uniauth_grid_instance_key_pattern = <BackendEntity><OptionalBusinessView>Grid
uniauth_grid_instance_key_examples = UniauthUserGrid,UniauthUserTypeGrid
uniauth_grid_backend_entity_attribute = data-sel-entity
uniauth_grid_child_role_attribute = data-sel-grid-role

<!-- 单独样式使用“组件前缀 + 单独名称”；适用于组件根节点或不属于子分组的独立元素。 -->
uniauth_standalone_css_class_pattern = <component-prefix>-<name>

<!-- 同一业务下存在一组样式时必须加入稳定组名；适用于项目、负责人、状态、进度、操作、分页、菜单等组合结构。 -->
uniauth_grouped_css_class_pattern = <component-prefix>-<group>-<name>
uniauth_grid_grouped_css_class_pattern = selgrid-<group>-<name>
css_group_name_must_describe_business_role = true

<!-- 状态类必须保留所属业务组，禁止继续使用无归属的 is-open、is-active、is-selected、is-current 等通用状态名称。 -->
uniauth_state_class_pattern = <component-prefix>-<group>-<state>
unscoped_generic_state_class_is_forbidden = true

<!-- 组件自定义变量使用相同命名空间，避免多个静态组件共享页面时发生变量覆盖。 -->
uniauth_css_custom_property_pattern = --<component-prefix>-<group>-<name>
uniauth_grid_css_custom_property_pattern = --selgrid-<group>-<name>

<!-- HTML 静态类、CSS 选择器和 JavaScript 动态类必须在同一任务中原子同步，禁止保留新旧类名兼容层。 -->
css_class_rename_must_sync = html,css,javascript
legacy_css_class_alias_after_namespace_migration_is_forbidden = true

<!-- Remix Icon 等第三方库类名由外部库契约控制，不得为了满足业务前缀而重命名。 -->
third_party_css_class_namespace_is_exempt = true

<!-- CSS 子规则不强制修改稳定 DOM id 与 data 属性；自定义事件和公开 JavaScript API 由本文件下方的 JavaScript 子规则约束。 -->
css_class_naming_rule_does_not_force_rename = dom_id,data_attribute

<!-- 表格菜单继续使用独立样式文件，并在 selgrid-menu 分组下命名，避免菜单内部选择器回流到表格主体样式。 -->
uniauth_grid_menu_class_pattern = selgrid-menu-<name>
uniauth_grid_menu_style_must_remain_in = static/sel/components/grid/selGridMenu.css
uniauth_grid_host_style_must_not_own_menu_internal_selector = true

## JavaScript 文件与模块标识

<!-- 公共基础脚本使用 selBase 加具体名称并位于 static/sel；适用于不依赖单一页面的 DOM、请求、格式化、存储和反馈能力。 -->
uniauth_base_javascript_file_pattern = selBase<Name>.js
uniauth_base_javascript_identifier_pattern = selBase<Name>
uniauth_base_javascript_constructor_pattern = SelBase<Name>
uniauth_base_javascript_public_global_pattern = selBase<Name>
uniauth_base_static_root = static/sel
uniauth_base_component_directory_pattern = static/sel/components/<component>/
uniauth_base_asset_root = static/sel/assets/
uniauth_base_component_asset_directory_pattern = static/sel/assets/components/<component>/
uniauth_base_shared_asset_directory = static/sel/assets/shared/

<!-- 通用异步请求能力采用独立 selAjax 命名，不继续混入 selBaseRuntime。 -->
uniauth_ajax_javascript_file = static/sel/core/selAjax.js
uniauth_ajax_javascript_identifier_pattern = selAjax<Name>
uniauth_ajax_public_api = window.selAjax
uniauth_ajax_json_call_pattern = selAjax.json({url:<application-explicit-path>})
uniauth_ajax_request_call_pattern = selAjax.request({url:<application-explicit-path>,method:<http-method>})
uniauth_ajax_business_path_constant_is_forbidden = true

<!-- 组件脚本使用 sel 加组件名和具体名称；表格组件固定使用 selGrid，禁止继续使用 grid.js、gridmenu.js 等无产品命名空间文件名。 -->
uniauth_component_javascript_file_pattern = sel<Component><Name>.js
uniauth_component_javascript_identifier_pattern = sel<Component><Name>
uniauth_component_root_javascript_file_pattern = sel<Component>.js
uniauth_component_root_public_api_pattern = window.sel<Component>
uniauth_grid_javascript_file_pattern = selGrid<Name>.js
uniauth_grid_javascript_identifier_pattern = selGrid<Name>
uniauth_legacy_grid_javascript_file_is_forbidden = grid.js,gridmenu.js

<!-- 模块级常量、状态、缓存、函数、控制器和公开配置必须使用所属前缀；函数内部的短生命周期变量只需表达当前业务含义，不强制重复模块前缀。 -->
javascript_module_scope_name_must_use_component_prefix = true
javascript_local_scope_name_policy = concise_business_semantic_name_without_forced_module_prefix

<!-- 公开接口与自定义事件必须表达所属模块，跨文件调用只能使用新名称，禁止保留旧 window 对象或旧事件别名。 -->
uniauth_grid_menu_public_api = window.selGridMenu
uniauth_grid_menu_public_config = window.selGridMenuConfig
uniauth_panel_public_api = window.selPanel
uniauth_search_public_api = window.selSearch
uniauth_tree_public_api = window.selTree
uniauth_dropdown_menu_public_api = window.selDropdownMenu
uniauth_grid_public_api = window.selGrid
uniauth_grid_instance_access_pattern = selGrid.get(<grid-instance-key>)
uniauth_grid_child_controller_access_pattern = selGrid.get(<grid-instance-key>).tree|menu|filters|pagination
uniauth_grid_custom_event_pattern = selGrid<Name>:<action>
uniauth_component_custom_event_pattern = sel<Component>:<action>
uniauth_search_javascript_file = static/sel/components/search/selSearch.js
uniauth_search_style_file = static/sel/components/search/selSearch.css
uniauth_search_submit_event = selSearch:submit
legacy_javascript_global_or_event_alias_is_forbidden = true

<!-- Uniauth 应用入口固定使用同名 HTML、CSS 与 JS；应用装配层可以识别业务实体，基础控件禁止反向依赖应用对象。 -->
uniauth_application_entry_html = static/uniauth/uniauth.html
uniauth_application_entry_css = static/uniauth/uniauth.css
uniauth_application_assembler_javascript = static/uniauth/uniauth.js
uniauth_application_mock_directory = static/uniauth/mock/
uniauth_application_specific_theme_directory_optional = static/uniauth/theme/
uniauth_application_asset_directory = static/uniauth/assets/
uniauth_shared_page_background_component_directory = static/sel/components/page-background/
uniauth_shared_page_background_asset_directory = static/sel/assets/backgrounds/
uniauth_shared_cursor_component_directory = static/sel/components/cursor/
uniauth_shared_cursor_asset_directory = static/sel/assets/cursors/
uniauth_shared_theme_or_cursor_must_not_live_in_application_directory = true
uniauth_application_css_class_pattern = uniauth-<group>-<name>
uniauth_application_css_must_not_select_sel_component_internal_class = true
uniauth_application_public_api = window.uniauth
uniauth_application_data_source_registry = uniauthDataSources
uniauth_application_layout_registry = uniauthLayouts
uniauth_application_layout_id_pattern = <ApplicationOrModule><PrimaryComponent>FiveRegion
uniauth_application_layout_id_example = UniauthGridFiveRegion
uniauth_application_instance_layout_field = layoutId
uniauth_application_layout_region_keys = top,left,center,right,bottom
uniauth_application_layout_item_fields = component,payload,slot,children
uniauth_application_data_source_path_must_be_explicit = true
uniauth_application_assembler_may_know_business_entity = true
uniauth_base_component_must_not_read_application_api = true

<!-- 文件头必须说明脚本用途、责任边界和命名前缀；模块级变量、配置、函数、公开接口及关键业务动作必须通过紧邻注释说明实际用途。 -->
javascript_file_header_comment_must_describe = purpose,responsibility,module_prefix
javascript_business_comment_must_cover = module_constant,module_state,module_cache,function,public_api,configuration,condition,event,return,side_effect

<!-- JavaScript 文件重命名、公开接口或事件变更必须同步所有 HTML 与脚本调用方，禁止保留新旧脚本或 API 兼容桥接；旧页面地址只允许保留无控件实现的跳转入口。 -->
javascript_rename_must_sync = html_script_src,javascript_caller,event_listener,documentation
legacy_javascript_file_or_api_compatibility_bridge_is_forbidden = true
legacy_html_location_redirect_without_component_implementation_is_allowed = true

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
