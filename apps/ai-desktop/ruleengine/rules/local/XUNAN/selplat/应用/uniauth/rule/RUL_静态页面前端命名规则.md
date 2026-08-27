# uniauth 静态页面前端命名规则

<!-- 问题：静态演示页面若使用 project、item、button、is-open 等无模块归属类名，多个组件组合后无法从名称判断样式来源，重构时也容易误改其他模块。 -->
<!-- 场景：apps/uniauth 的静态 HTML、CSS、JavaScript 文件名、模块标识、公开接口、事件、组件样式及脚本动态创建或切换的样式类。 -->
<!-- 业务含义：每个文件和名称直接表达所属基础能力或组件、业务分组和具体用途，使公共运行时、表格、菜单及后续组件可以独立维护并安全组合。 -->

<!-- uniauth_static_ui_component_prefix_pattern 的当前独立事实为 sel<component>。 -->
uniauth_static_ui_component_prefix_pattern = sel<component>
<!-- uniauth_grid_component_prefix 的当前独立事实为 selgrid。 -->
uniauth_grid_component_prefix = selgrid
<!-- uniauth_panel_component_prefix 的当前独立事实为 selpanel。 -->
uniauth_panel_component_prefix = selpanel
<!-- uniauth_tree_component_prefix 的当前独立事实为 seltree。 -->
uniauth_tree_component_prefix = seltree
<!-- uniauth_search_component_prefix 的当前独立事实为 selsearch。 -->
uniauth_search_component_prefix = selsearch
<!-- uniauth_dropdown_component_prefix 的当前独立事实为 seldropdown。 -->
uniauth_dropdown_component_prefix = seldropdown
<!-- uniauth_cursor_component_prefix 的当前独立事实为 selcursor。 -->
uniauth_cursor_component_prefix = selcursor
<!-- uniauth_dropdown_menu_style_file 的当前独立事实为 selDropdownMenu.css。 -->
uniauth_dropdown_menu_style_file = selDropdownMenu.css
<!-- uniauth_dropdown_menu_javascript_file 的当前独立事实为 selDropdownMenu.js。 -->
uniauth_dropdown_menu_javascript_file = selDropdownMenu.js
<!-- uniauth_dropdown_menu_root_attribute 的当前独立事实为 data-sel-dropdown-menu。 -->
uniauth_dropdown_menu_root_attribute = data-sel-dropdown-menu
<!-- uniauth_grid_instance_key_pattern 的当前独立事实为 <BackendEntity><OptionalBusinessView>Grid。 -->
uniauth_grid_instance_key_pattern = <BackendEntity><OptionalBusinessView>Grid
<!-- uniauth_grid_instance_key_examples 的当前独立事实为 UniauthUserGrid。 -->
uniauth_grid_instance_key_examples = UniauthUserGrid
<!-- uniauth_grid_instance_key_examples.2 的当前独立事实为 UniauthUserTypeGrid。 -->
uniauth_grid_instance_key_examples.2 = UniauthUserTypeGrid
<!-- uniauth_grid_backend_entity_attribute 的当前独立事实为 data-sel-entity。 -->
uniauth_grid_backend_entity_attribute = data-sel-entity
<!-- uniauth_grid_child_role_attribute 的当前独立事实为 data-sel-grid-role。 -->
uniauth_grid_child_role_attribute = data-sel-grid-role

<!-- 单独样式使用“组件前缀 + 单独名称”；适用于组件根节点或不属于子分组的独立元素。 -->
uniauth_standalone_css_class_pattern = <component-prefix>-<name>

<!-- 同一业务下存在一组样式时必须加入稳定组名；适用于项目、负责人、状态、进度、操作、分页、菜单等组合结构。 -->
uniauth_grouped_css_class_pattern = <component-prefix>-<group>-<name>
<!-- uniauth_grid_grouped_css_class_pattern 的当前独立事实为 selgrid-<group>-<name>。 -->
uniauth_grid_grouped_css_class_pattern = selgrid-<group>-<name>
<!-- css_group_name_must_describe_business_role 的当前独立事实为 true。 -->
css_group_name_must_describe_business_role = true

<!-- 状态类必须保留所属业务组，禁止继续使用无归属的 is-open、is-active、is-selected、is-current 等通用状态名称。 -->
uniauth_state_class_pattern = <component-prefix>-<group>-<state>
<!-- unscoped_generic_state_class_is_forbidden 的当前独立事实为 true。 -->
unscoped_generic_state_class_is_forbidden = true

<!-- 组件自定义变量使用相同命名空间，避免多个静态组件共享页面时发生变量覆盖。 -->
uniauth_css_custom_property_pattern = --<component-prefix>-<group>-<name>
<!-- uniauth_grid_css_custom_property_pattern 的当前独立事实为 --selgrid-<group>-<name>。 -->
uniauth_grid_css_custom_property_pattern = --selgrid-<group>-<name>

<!-- HTML 静态类、CSS 选择器和 JavaScript 动态类必须在同一任务中原子同步，禁止保留新旧类名兼容层。 -->
css_class_rename_must_sync = html
<!-- css_class_rename_must_sync.2 的当前独立事实为 css。 -->
css_class_rename_must_sync.2 = css
<!-- css_class_rename_must_sync.3 的当前独立事实为 javascript。 -->
css_class_rename_must_sync.3 = javascript
<!-- legacy_css_class_alias_after_namespace_migration_is_forbidden 的当前独立事实为 true。 -->
legacy_css_class_alias_after_namespace_migration_is_forbidden = true

<!-- Remix Icon 等第三方库类名由外部库契约控制，不得为了满足业务前缀而重命名。 -->
third_party_css_class_namespace_is_exempt = true

<!-- CSS 子规则不强制修改稳定 DOM id 与 data 属性；自定义事件和公开 JavaScript API 由本文件下方的 JavaScript 子规则约束。 -->
css_class_naming_rule_does_not_force_rename = dom_id
<!-- css_class_naming_rule_does_not_force_rename.2 的当前独立事实为 data_attribute。 -->
css_class_naming_rule_does_not_force_rename.2 = data_attribute

<!-- 表格菜单继续使用独立样式文件，并在 selgrid-menu 分组下命名，避免菜单内部选择器回流到表格主体样式。 -->
uniauth_grid_menu_class_pattern = selgrid-menu-<name>
<!-- uniauth_grid_menu_style_must_remain_in 的当前独立事实为 static/sel/components/grid/selGridMenu.css。 -->
uniauth_grid_menu_style_must_remain_in = static/sel/components/grid/selGridMenu.css
<!-- uniauth_grid_host_style_must_not_own_menu_internal_selector 的当前独立事实为 true。 -->
uniauth_grid_host_style_must_not_own_menu_internal_selector = true

## JavaScript 文件与模块标识

<!-- 公共基础脚本使用 selBase 加具体名称并位于 static/sel；适用于不依赖单一页面的 DOM、请求、格式化、存储和反馈能力。 -->
uniauth_base_javascript_file_pattern = selBase<Name>.js
<!-- uniauth_base_javascript_identifier_pattern 的当前独立事实为 selBase<Name>。 -->
uniauth_base_javascript_identifier_pattern = selBase<Name>
<!-- uniauth_base_javascript_constructor_pattern 的当前独立事实为 SelBase<Name>。 -->
uniauth_base_javascript_constructor_pattern = SelBase<Name>
<!-- uniauth_base_javascript_public_global_pattern 的当前独立事实为 selBase<Name>。 -->
uniauth_base_javascript_public_global_pattern = selBase<Name>
<!-- uniauth_base_static_root 的当前独立事实为 static/sel。 -->
uniauth_base_static_root = static/sel
<!-- uniauth_base_component_directory_pattern 的当前独立事实为 static/sel/components/<component>/。 -->
uniauth_base_component_directory_pattern = static/sel/components/<component>/
<!-- uniauth_base_asset_root 的当前独立事实为 static/sel/assets/。 -->
uniauth_base_asset_root = static/sel/assets/
<!-- uniauth_base_component_asset_directory_pattern 的当前独立事实为 static/sel/assets/components/<component>/。 -->
uniauth_base_component_asset_directory_pattern = static/sel/assets/components/<component>/
<!-- uniauth_base_theme_asset_directory_pattern 的当前独立事实为 static/sel/assets/themes/<theme-id>/。 -->
uniauth_base_theme_asset_directory_pattern = static/sel/assets/themes/<theme-id>/
<!-- uniauth_theme_base_skin_bundle_directory_pattern 的当前独立事实为 static/sel/assets/themes/<theme-id>/<mode>/base/。 -->
uniauth_theme_base_skin_bundle_directory_pattern = static/sel/assets/themes/<theme-id>/<mode>/base/
<!-- uniauth_theme_accent_skin_bundle_directory_pattern 的当前独立事实为 static/sel/assets/themes/<theme-id>/<mode>/accents/<accent-id>/。 -->
uniauth_theme_accent_skin_bundle_directory_pattern = static/sel/assets/themes/<theme-id>/<mode>/accents/<accent-id>/
<!-- uniauth_base_shared_asset_directory 的当前独立事实为 static/sel/assets/shared/。 -->
uniauth_base_shared_asset_directory = static/sel/assets/shared/
<!-- uniauth_theme_asset_directory_id_must_equal_theme_pack_id 的当前独立事实为 true。 -->
uniauth_theme_asset_directory_id_must_equal_theme_pack_id = true
<!-- uniauth_theme_asset_reference_owner 的当前独立事实为 static/sel/theme/packs/<theme-id>/manifest.js。 -->
uniauth_theme_asset_reference_owner = static/sel/theme/packs/<theme-id>/manifest.js
<!-- uniauth_theme_automatic_background_directory_pattern 的当前独立事实为 static/sel/assets/themes/<same-theme-id>/。 -->
uniauth_theme_automatic_background_directory_pattern = static/sel/assets/themes/<same-theme-id>/
<!-- uniauth_theme_cross_theme_or_public_automatic_background_reference_is_forbidden 的当前独立事实为 true。 -->
uniauth_theme_cross_theme_or_public_automatic_background_reference_is_forbidden = true

<!-- 通用异步请求能力采用独立 selAjax 命名，不继续混入 selBaseRuntime。 -->
uniauth_ajax_javascript_file = static/sel/core/selAjax.js
<!-- uniauth_ajax_javascript_identifier_pattern 的当前独立事实为 selAjax<Name>。 -->
uniauth_ajax_javascript_identifier_pattern = selAjax<Name>
<!-- uniauth_ajax_public_api 的当前独立事实为 window.selAjax。 -->
uniauth_ajax_public_api = window.selAjax
<!-- uniauth_ajax_json_call_pattern 的当前独立事实为 selAjax.json({url:<application-explicit-path>})。 -->
uniauth_ajax_json_call_pattern = selAjax.json({url:<application-explicit-path>})
<!-- uniauth_ajax_request_call_pattern 的当前独立事实为 selAjax.request({url:<application-explicit-path>,method:<http-method>})。 -->
uniauth_ajax_request_call_pattern = selAjax.request({url:<application-explicit-path>,method:<http-method>})
<!-- uniauth_ajax_business_path_constant_is_forbidden 的当前独立事实为 true。 -->
uniauth_ajax_business_path_constant_is_forbidden = true

<!-- 组件脚本使用 sel 加组件名和具体名称；表格组件固定使用 selGrid，禁止继续使用 grid.js、gridmenu.js 等无产品命名空间文件名。 -->
uniauth_component_javascript_file_pattern = sel<Component><Name>.js
<!-- uniauth_component_javascript_identifier_pattern 的当前独立事实为 sel<Component><Name>。 -->
uniauth_component_javascript_identifier_pattern = sel<Component><Name>
<!-- uniauth_component_root_javascript_file_pattern 的当前独立事实为 sel<Component>.js。 -->
uniauth_component_root_javascript_file_pattern = sel<Component>.js
<!-- uniauth_component_root_public_api_pattern 的当前独立事实为 window.sel<Component>。 -->
uniauth_component_root_public_api_pattern = window.sel<Component>
<!-- uniauth_grid_javascript_file_pattern 的当前独立事实为 selGrid<Name>.js。 -->
uniauth_grid_javascript_file_pattern = selGrid<Name>.js
<!-- uniauth_grid_javascript_identifier_pattern 的当前独立事实为 selGrid<Name>。 -->
uniauth_grid_javascript_identifier_pattern = selGrid<Name>
<!-- uniauth_legacy_grid_javascript_file_is_forbidden 的当前独立事实为 grid.js。 -->
uniauth_legacy_grid_javascript_file_is_forbidden = grid.js
<!-- uniauth_legacy_grid_javascript_file_is_forbidden.2 的当前独立事实为 gridmenu.js。 -->
uniauth_legacy_grid_javascript_file_is_forbidden.2 = gridmenu.js

<!-- 模块级常量、状态、缓存、函数、控制器和公开配置必须使用所属前缀；函数内部的短生命周期变量只需表达当前业务含义，不强制重复模块前缀。 -->
javascript_module_scope_name_must_use_component_prefix = true
<!-- javascript_local_scope_name_policy 的当前独立事实为 concise_business_semantic_name_without_forced_module_prefix。 -->
javascript_local_scope_name_policy = concise_business_semantic_name_without_forced_module_prefix

<!-- 公开接口与自定义事件必须表达所属模块，跨文件调用只能使用新名称，禁止保留旧 window 对象或旧事件别名。 -->
uniauth_grid_menu_public_api = window.selGridMenu
<!-- uniauth_grid_menu_public_config 的当前独立事实为 window.selGridMenuConfig。 -->
uniauth_grid_menu_public_config = window.selGridMenuConfig
<!-- uniauth_panel_public_api 的当前独立事实为 window.selPanel。 -->
uniauth_panel_public_api = window.selPanel
<!-- uniauth_search_public_api 的当前独立事实为 window.selSearch。 -->
uniauth_search_public_api = window.selSearch
<!-- uniauth_tree_public_api 的当前独立事实为 window.selTree。 -->
uniauth_tree_public_api = window.selTree
<!-- uniauth_dropdown_menu_public_api 的当前独立事实为 window.selDropdownMenu。 -->
uniauth_dropdown_menu_public_api = window.selDropdownMenu
<!-- uniauth_grid_public_api 的当前独立事实为 window.selGrid。 -->
uniauth_grid_public_api = window.selGrid
<!-- uniauth_grid_instance_access_pattern 的当前独立事实为 selGrid.get(<grid-instance-key>)。 -->
uniauth_grid_instance_access_pattern = selGrid.get(<grid-instance-key>)
<!-- uniauth_grid_child_controller_access_pattern 的当前独立事实为 selGrid.get(<grid-instance-key>).tree|menu|filters|pagination。 -->
uniauth_grid_child_controller_access_pattern = selGrid.get(<grid-instance-key>).tree|menu|filters|pagination
<!-- uniauth_grid_custom_event_pattern 的当前独立事实为 selGrid<Name>:<action>。 -->
uniauth_grid_custom_event_pattern = selGrid<Name>:<action>
<!-- uniauth_component_custom_event_pattern 的当前独立事实为 sel<Component>:<action>。 -->
uniauth_component_custom_event_pattern = sel<Component>:<action>
<!-- uniauth_search_javascript_file 的当前独立事实为 static/sel/components/search/selSearch.js。 -->
uniauth_search_javascript_file = static/sel/components/search/selSearch.js
<!-- uniauth_search_style_file 的当前独立事实为 static/sel/components/search/selSearch.css。 -->
uniauth_search_style_file = static/sel/components/search/selSearch.css
<!-- uniauth_search_submit_event 的当前独立事实为 selSearch:submit。 -->
uniauth_search_submit_event = selSearch:submit
<!-- legacy_javascript_global_or_event_alias_is_forbidden 的当前独立事实为 true。 -->
legacy_javascript_global_or_event_alias_is_forbidden = true

<!-- Uniauth 应用入口固定使用同名 HTML、CSS 与 JS；应用装配层可以识别业务实体，基础控件禁止反向依赖应用对象。 -->
uniauth_application_entry_html = static/uniauth/uniauth.html
<!-- uniauth_application_entry_css 的当前独立事实为 static/uniauth/uniauth.css。 -->
uniauth_application_entry_css = static/uniauth/uniauth.css
<!-- uniauth_application_assembler_javascript 的当前独立事实为 static/uniauth/uniauth.js。 -->
uniauth_application_assembler_javascript = static/uniauth/uniauth.js
<!-- uniauth_application_mock_directory 的当前独立事实为 static/uniauth/mock/。 -->
uniauth_application_mock_directory = static/uniauth/mock/
<!-- uniauth_application_specific_theme_directory_optional 的当前独立事实为 static/uniauth/theme/。 -->
uniauth_application_specific_theme_directory_optional = static/uniauth/theme/
<!-- uniauth_application_asset_directory 的当前独立事实为 static/uniauth/assets/。 -->
uniauth_application_asset_directory = static/uniauth/assets/
<!-- uniauth_shared_page_background_component_directory 的当前独立事实为 static/sel/components/page-background/。 -->
uniauth_shared_page_background_component_directory = static/sel/components/page-background/
<!-- uniauth_shared_page_background_asset_directory 的当前独立事实为 static/sel/assets/backgrounds/。 -->
uniauth_shared_page_background_asset_directory = static/sel/assets/backgrounds/
<!-- uniauth_shared_cursor_component_directory 的当前独立事实为 static/sel/components/cursor/。 -->
uniauth_shared_cursor_component_directory = static/sel/components/cursor/
<!-- uniauth_shared_cursor_asset_directory 的当前独立事实为 static/sel/assets/cursors/。 -->
uniauth_shared_cursor_asset_directory = static/sel/assets/cursors/
<!-- uniauth_shared_theme_or_cursor_must_not_live_in_application_directory 的当前独立事实为 true。 -->
uniauth_shared_theme_or_cursor_must_not_live_in_application_directory = true
<!-- uniauth_application_css_class_pattern 的当前独立事实为 uniauth-<group>-<name>。 -->
uniauth_application_css_class_pattern = uniauth-<group>-<name>
<!-- uniauth_application_css_must_not_select_sel_component_internal_class 的当前独立事实为 true。 -->
uniauth_application_css_must_not_select_sel_component_internal_class = true
<!-- uniauth_application_public_api 的当前独立事实为 window.uniauth。 -->
uniauth_application_public_api = window.uniauth
<!-- uniauth_application_data_source_registry 的当前独立事实为 uniauthDataSources。 -->
uniauth_application_data_source_registry = uniauthDataSources
<!-- uniauth_application_layout_registry 的当前独立事实为 uniauthLayouts。 -->
uniauth_application_layout_registry = uniauthLayouts
<!-- uniauth_application_layout_id_pattern 的当前独立事实为 <ApplicationOrModule><PrimaryComponent>FiveRegion。 -->
uniauth_application_layout_id_pattern = <ApplicationOrModule><PrimaryComponent>FiveRegion
<!-- uniauth_application_layout_id_example 的当前独立事实为 UniauthGridFiveRegion。 -->
uniauth_application_layout_id_example = UniauthGridFiveRegion
<!-- uniauth_application_instance_layout_field 的当前独立事实为 layoutId。 -->
uniauth_application_instance_layout_field = layoutId
<!-- uniauth_application_layout_region_keys 的当前独立事实为 top。 -->
uniauth_application_layout_region_keys = top
<!-- uniauth_application_layout_region_keys.2 的当前独立事实为 left。 -->
uniauth_application_layout_region_keys.2 = left
<!-- uniauth_application_layout_region_keys.3 的当前独立事实为 center。 -->
uniauth_application_layout_region_keys.3 = center
<!-- uniauth_application_layout_region_keys.4 的当前独立事实为 right。 -->
uniauth_application_layout_region_keys.4 = right
<!-- uniauth_application_layout_region_keys.5 的当前独立事实为 bottom。 -->
uniauth_application_layout_region_keys.5 = bottom
<!-- uniauth_application_layout_item_fields 的当前独立事实为 component。 -->
uniauth_application_layout_item_fields = component
<!-- uniauth_application_layout_item_fields.2 的当前独立事实为 payload。 -->
uniauth_application_layout_item_fields.2 = payload
<!-- uniauth_application_layout_item_fields.3 的当前独立事实为 slot。 -->
uniauth_application_layout_item_fields.3 = slot
<!-- uniauth_application_layout_item_fields.4 的当前独立事实为 children。 -->
uniauth_application_layout_item_fields.4 = children
<!-- uniauth_application_data_source_path_must_be_explicit 的当前独立事实为 true。 -->
uniauth_application_data_source_path_must_be_explicit = true
<!-- uniauth_application_assembler_may_know_business_entity 的当前独立事实为 true。 -->
uniauth_application_assembler_may_know_business_entity = true
<!-- uniauth_base_component_must_not_read_application_api 的当前独立事实为 true。 -->
uniauth_base_component_must_not_read_application_api = true

<!-- 文件头必须说明脚本用途、责任边界和命名前缀；模块级变量、配置、函数、公开接口及关键业务动作必须通过紧邻注释说明实际用途。 -->
javascript_file_header_comment_must_describe = purpose
<!-- javascript_file_header_comment_must_describe.2 的当前独立事实为 responsibility。 -->
javascript_file_header_comment_must_describe.2 = responsibility
<!-- javascript_file_header_comment_must_describe.3 的当前独立事实为 module_prefix。 -->
javascript_file_header_comment_must_describe.3 = module_prefix
<!-- javascript_business_comment_must_cover 的当前独立事实为 module_constant。 -->
javascript_business_comment_must_cover = module_constant
<!-- javascript_business_comment_must_cover.2 的当前独立事实为 module_state。 -->
javascript_business_comment_must_cover.2 = module_state
<!-- javascript_business_comment_must_cover.3 的当前独立事实为 module_cache。 -->
javascript_business_comment_must_cover.3 = module_cache
<!-- javascript_business_comment_must_cover.4 的当前独立事实为 function。 -->
javascript_business_comment_must_cover.4 = function
<!-- javascript_business_comment_must_cover.5 的当前独立事实为 public_api。 -->
javascript_business_comment_must_cover.5 = public_api
<!-- javascript_business_comment_must_cover.6 的当前独立事实为 configuration。 -->
javascript_business_comment_must_cover.6 = configuration
<!-- javascript_business_comment_must_cover.7 的当前独立事实为 condition。 -->
javascript_business_comment_must_cover.7 = condition
<!-- javascript_business_comment_must_cover.8 的当前独立事实为 event。 -->
javascript_business_comment_must_cover.8 = event
<!-- javascript_business_comment_must_cover.9 的当前独立事实为 return。 -->
javascript_business_comment_must_cover.9 = return
<!-- javascript_business_comment_must_cover.10 的当前独立事实为 side_effect。 -->
javascript_business_comment_must_cover.10 = side_effect

<!-- JavaScript 文件重命名、公开接口或事件变更必须同步所有 HTML 与脚本调用方，禁止保留新旧脚本或 API 兼容桥接；旧页面地址只允许保留无控件实现的跳转入口。 -->
javascript_rename_must_sync = html_script_src
<!-- javascript_rename_must_sync.2 的当前独立事实为 javascript_caller。 -->
javascript_rename_must_sync.2 = javascript_caller
<!-- javascript_rename_must_sync.3 的当前独立事实为 event_listener。 -->
javascript_rename_must_sync.3 = event_listener
<!-- javascript_rename_must_sync.4 的当前独立事实为 documentation。 -->
javascript_rename_must_sync.4 = documentation
<!-- legacy_javascript_file_or_api_compatibility_bridge_is_forbidden 的当前独立事实为 true。 -->
legacy_javascript_file_or_api_compatibility_bridge_is_forbidden = true
<!-- legacy_html_location_redirect_without_component_implementation_is_allowed 的当前独立事实为 true。 -->
legacy_html_location_redirect_without_component_implementation_is_allowed = true

<!-- java_ability_refs 的当前独立事实为 none。 -->
java_ability_refs = none
<!-- python_ability_refs 的当前独立事实为 none。 -->
python_ability_refs = none
<!-- node_ability_refs 的当前独立事实为 none。 -->
node_ability_refs = none
