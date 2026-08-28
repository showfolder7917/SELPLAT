# Reference Data 工作台导航与按需加载规则

<!-- 本规则没有独立 Java 自动化程序，生产能力由 reference-data 应用源码实现。 -->
java_ability_refs = none
<!-- 本规则没有 Python 成品，不虚构 Python 能力。 -->
python_ability_refs = none
<!-- 本规则没有独立 Node 程序，前端行为由应用脚本与契约测试验证。 -->
node_ability_refs = none
<!-- 1.28.0 固定引用数据管理中日英资源分层、数据库多语言字段回退和无刷新原位切换。 -->
rule_version = 1.29.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示规则已完成索引登记和应用回归。 -->
rule_status = active

## 公共选项查询

<!-- 业务页面按稳定选项组 code 和页面语言查询共享选项，不得提交表名或 SQL。 -->
reference_data_option_set_public_query = GET_/api/reference-data/options/<optionSetCode>?locale=<locale>
<!-- 公共结果只公开稳定 code、value、当前语言 label 和可选 parentCode。 -->
reference_data_option_set_public_result = enabled_only_code_value_localized_label_optional_parentCode

## 导航能力边界

<!-- 工作台稳定导航不查询数据库，必须进入不落库 capability 并只保留 controller、service、service/impl。 -->
reference_data_navigation_ability_structure = capability/workbenchnavigation/controller|service|service_impl
<!-- reference_data_navigation_ability_structure.2 的当前独立事实为 no_dao。 -->
reference_data_navigation_ability_structure.2 = no_dao
<!-- reference_data_navigation_ability_structure.3 的当前独立事实为 no_database_table。 -->
reference_data_navigation_ability_structure.3 = no_database_table
<!-- 导航接口只返回模块定义和下钻方式，禁止为了数量在首次请求中查询六张业务表。 -->
reference_data_navigation_database_boundary = static_module_contract_without_database_query_or_record_count
<!-- 页面访问地址保持稳定，不得因导航能力拆分而新增或迁移页面。 -->
reference_data_workbench_page_path = /reference-data/reference-data.html

## 一级模块与下钻

<!-- 左侧一级导航固定为数据类型、树节点、表格定义、页面控件和 Window。 -->
reference_data_top_level_modules = types
<!-- reference_data_top_level_modules.2 的当前独立事实为 tree。 -->
reference_data_top_level_modules.2 = tree
<!-- reference_data_top_level_modules.3 的当前独立事实为 tables。 -->
reference_data_top_level_modules.3 = tables
<!-- reference_data_top_level_modules.4 的当前独立事实为 controls。 -->
reference_data_top_level_modules.4 = controls
<!-- reference_data_top_level_modules.5 的当前独立事实为 windows。 -->
reference_data_top_level_modules.5 = windows
<!-- 数据类型维护分类编码及多语言名称；树节点模块独立展示和维护 code + parentId 父子树，不加载或引用类型目录。 -->
reference_data_type_and_tree_responsibility = type_catalog_record_code_plus_optionSetCode_plus_valueCode_plus_parentTypeCode_plus_localized_names_status_sort
<!-- reference_data_type_and_tree_responsibility.2 的当前独立事实为 ControlLayout_code_is_real_control_and_optionSetCode_is_optional_binding_and_has_no_typeId。 -->
reference_data_type_and_tree_responsibility.2 = ControlLayout_code_is_real_control_and_optionSetCode_is_optional_binding_and_has_no_typeId
<!-- reference_data_type_and_tree_responsibility.3 的当前独立事实为 tree_module_independent_code_plus_parentId。 -->
reference_data_type_and_tree_responsibility.3 = tree_module_independent_code_plus_parentId
<!-- reference_data_type_and_tree_responsibility.4 的当前独立事实为 tree_projectCode_pageCode_attribution_only。 -->
reference_data_type_and_tree_responsibility.4 = tree_projectCode_pageCode_attribution_only
<!-- reference_data_type_and_tree_responsibility.5 的当前独立事实为 no_type_project_page_duplication。 -->
reference_data_type_and_tree_responsibility.5 = no_type_project_page_duplication
<!-- reference_data_type_and_tree_responsibility.6 的当前独立事实为 no_controlCode。 -->
reference_data_type_and_tree_responsibility.6 = no_controlCode
<!-- reference_data_type_and_tree_responsibility.7 的当前独立事实为 no_categoryCode。 -->
reference_data_type_and_tree_responsibility.7 = no_categoryCode
<!-- reference_data_type_and_tree_responsibility.8 的当前独立事实为 no_dropdown_or_menu_nodes_in_tree_management。 -->
reference_data_type_and_tree_responsibility.8 = no_dropdown_or_menu_nodes_in_tree_management
<!-- 树节点工程与页面坐标只帮助管理者查看来源，禁止成为父子关系或类型目录关联条件。 -->
reference_data_tree_node_attribution = projectCode_plus_pageCode_for_display_and_query_only
<!-- reference_data_tree_node_attribution.2 的当前独立事实为 tree_relation_still_code_plus_parentId。 -->
reference_data_tree_node_attribution.2 = tree_relation_still_code_plus_parentId
<!-- reference_data_tree_node_attribution.3 的当前独立事实为 no_type_coupling。 -->
reference_data_tree_node_attribution.3 = no_type_coupling
<!-- TREE 只作为树节点模块和表头视图编码；Type 保存入口、Legacy 迁移和正式库都不得保留 TREE 类型记录。 -->
reference_data_tree_value_ownership = TREE:ReferenceDataTreeNode_and_table_view_only
<!-- reference_data_tree_value_ownership.2 的当前独立事实为 ReferenceDataType:forbidden。 -->
reference_data_tree_value_ownership.2 = ReferenceDataType:forbidden
<!-- reference_data_tree_value_ownership.3 的当前独立事实为 physical_cleanup。 -->
reference_data_tree_value_ownership.3 = physical_cleanup
<!-- reference_data_tree_value_ownership.4 的当前独立事实为 no_compatibility_record。 -->
reference_data_tree_value_ownership.4 = no_compatibility_record
<!-- 数据类型管理页只从一级入口进入，具体类型记录统一在右侧 Grid 管理，左树不得生成记录子节点或展开菜单。 -->
reference_data_type_navigation_level = top_level_only_no_record_children_or_expand_menu
<!-- reference_data_type_navigation_level.2 的当前独立事实为 keep_type_records_in_management_grid。 -->
reference_data_type_navigation_level.2 = keep_type_records_in_management_grid
<!-- Window 管理页只从一级入口进入，具体 Window 记录统一在右侧 Grid 与编辑窗口管理，左树不得生成记录子节点或展开菜单。 -->
reference_data_window_navigation_level = top_level_only_no_record_children_or_expand_menu
<!-- 页面控件管理页只从一级入口进入，PAGE 和其他控件记录统一在右侧 Grid 管理，左树不得生成记录子节点或展开菜单。 -->
reference_data_control_navigation_level = top_level_only_no_record_children_or_expand_menu
<!-- reference_data_control_navigation_level.2 的当前独立事实为 keep_page_records_in_management_grid。 -->
reference_data_control_navigation_level.2 = keep_page_records_in_management_grid
<!-- Window 页面编辑只调整外框位置和大小；内部表单跟随 Window 内容布局，不登记、不拖拽、不生成 ControlLayout 子记录。 -->
reference_data_window_child_control_registration = forbidden
<!-- reference_data_window_child_control_registration.2 的当前独立事实为 ReferenceDataWindow_outer_geometry_only。 -->
reference_data_window_child_control_registration.2 = ReferenceDataWindow_outer_geometry_only
<!-- reference_data_window_child_control_registration.3 的当前独立事实为 no_parentKind_WINDOW。 -->
reference_data_window_child_control_registration.3 = no_parentKind_WINDOW
<!-- reference_data_window_child_control_registration.4 的当前独立事实为 no_inner_field_drag。 -->
reference_data_window_child_control_registration.4 = no_inner_field_drag
<!-- reference_data_window_child_control_registration.5 的当前独立事实为 no_startup_generation。 -->
reference_data_window_child_control_registration.5 = no_startup_generation
<!-- reference_data_window_child_control_registration.6 的当前独立事实为 physical_cleanup。 -->
reference_data_window_child_control_registration.6 = physical_cleanup
<!-- ReferenceDataTableElement 只作为真实 Grid 的字段明细，不得重新成为一级导航。 -->
reference_data_table_column_navigation_level = ReferenceDataTableElement_internal_table_definition_drilldown_only_not_top_level
<!-- 点击表格定义先读取唯一 ReferenceDataTable，再按 tableId 与 viewCode 读取当前视图元素。 -->
reference_data_table_drilldown_sequence = tables_module_then_single_real_grid_then_tableId_plus_viewCode_elements
<!-- 主表只登记真实 Grid 实例；子表只用 tableId 建立外键，viewCode 区分 TYPE/TREE/CONTROL/WINDOW/TABLE/TABLE_ELEMENT。 -->
reference_data_table_column_binding = ReferenceDataTable_one_record_per_page_gridId
<!-- reference_data_table_column_binding.2 的当前独立事实为 ReferenceDataTableElement.tableId_foreign_key_plus_viewCode。 -->
reference_data_table_column_binding.2 = ReferenceDataTableElement.tableId_foreign_key_plus_viewCode
<!-- reference_data_table_column_binding.3 的当前独立事实为 no_business_table_name_parent_rows。 -->
reference_data_table_column_binding.3 = no_business_table_name_parent_rows
<!-- 表头 HTTP 坐标必须显式命名 tableCode；先按 ReferenceDataTable.code 精确命中一条，再按 tableId 等值和元素 viewCode 读取列表。 -->
reference_data_grid_column_query_coordinate = request_tableCode
<!-- reference_data_grid_column_query_coordinate.2 的当前独立事实为 exact_ReferenceDataTable.code。 -->
reference_data_grid_column_query_coordinate.2 = exact_ReferenceDataTable.code
<!-- reference_data_grid_column_query_coordinate.3 的当前独立事实为 exact_ReferenceDataTableElement.tableId。 -->
reference_data_grid_column_query_coordinate.3 = exact_ReferenceDataTableElement.tableId
<!-- reference_data_grid_column_query_coordinate.4 的当前独立事实为 element_viewCode。 -->
reference_data_grid_column_query_coordinate.4 = element_viewCode
<!-- reference_data_grid_column_query_coordinate.5 的当前独立事实为 no_tableIdIn。 -->
reference_data_grid_column_query_coordinate.5 = no_tableIdIn
<!-- 表格定义属于业务组件配置而不是 MDA 数据库工具；打开记录后使用基本信息、表格列配置和效果预览三个详情状态。 -->
reference_data_table_definition_experience = business_component_configuration_not_database_tool
<!-- reference_data_table_definition_experience.2 的当前独立事实为 detail_tabs_info_columns_preview。 -->
reference_data_table_definition_experience.2 = detail_tabs_info_columns_preview
<!-- 列配置页只显示当前 tableName 与 gridColumnId/gridId 坐标的记录，并保留新增、查询、编辑、启停和逻辑删除。 -->
reference_data_table_definition_crud = single_grid_master_and_elements_full_create_read_update_toggle_delete
<!-- reference_data_table_definition_crud.2 的当前独立事实为 current_tableId_and_viewCode_filter。 -->
reference_data_table_definition_crud.2 = current_tableId_and_viewCode_filter
<!-- 新建列的中文表头必填；页面预览优先显示中文，内部字段和控件 ID 继续使用英文驼峰稳定编码。 -->
reference_data_new_column_naming = labelZh_required_and_visible
<!-- reference_data_new_column_naming.2 的当前独立事实为 gridId_gridColumnId_tableFieldName_camel_case_internal。 -->
reference_data_new_column_naming.2 = gridId_gridColumnId_tableFieldName_camel_case_internal
<!-- 表格定义演示数据只能在缺失时补充，重启不得覆盖管理员修改；固定测试主键与后续号段主键都保持六位。 -->
reference_data_table_definition_demo_seed = idempotent_insert_where_not_exists
<!-- reference_data_table_definition_demo_seed.2 的当前独立事实为 no_merge_or_update_overwrite。 -->
reference_data_table_definition_demo_seed.2 = no_merge_or_update_overwrite
<!-- reference_data_table_definition_demo_seed.3 的当前独立事实为 six_digit_ids。 -->
reference_data_table_definition_demo_seed.3 = six_digit_ids

## 请求与缓存

<!-- 引用数据应用固定文案必须提供 zh-CN、ja-JP、en-US 三份同构 JSON，禁止把应用文案混入公共组件语言包。 -->
reference_data_application_i18n_resources = reference-data/i18n/zh-CN.json|ja-JP.json|en-US.json
<!-- reference_data_application_i18n_resources.2 的当前独立事实为 isomorphic_leaf_keys。 -->
reference_data_application_i18n_resources.2 = isomorphic_leaf_keys
<!-- reference_data_application_i18n_resources.3 的当前独立事实为 application_messages_only。 -->
reference_data_application_i18n_resources.3 = application_messages_only
<!-- Window 和个性化属于 SEL 公共组件，必须从各自公共 i18n 目录加载，应用语言包不得复制其内部文案。 -->
reference_data_public_component_i18n_boundary = selWindow_public_pack
<!-- reference_data_public_component_i18n_boundary.2 的当前独立事实为 selPersonalization_public_pack。 -->
reference_data_public_component_i18n_boundary.2 = selPersonalization_public_pack
<!-- reference_data_public_component_i18n_boundary.3 的当前独立事实为 no_application_duplication。 -->
reference_data_public_component_i18n_boundary.3 = no_application_duplication
<!-- URL lang 优先，其次读取应用语言偏好，非法值回退中文；切换成功后同步 URL、偏好、document.lang 和标题。 -->
reference_data_locale_resolution = url_lang_then_selplat_reference_data_locale_preference_then_zh_CN
<!-- reference_data_locale_resolution.2 的当前独立事实为 supported:zh_CN|ja_JP|en_US。 -->
reference_data_locale_resolution.2 = supported:zh_CN|ja_JP|en_US
<!-- 数据库多语言字段按当前语言优先并回退；表格 description 只作管理说明，不可替代多语言 name 字段成为标题。 -->
reference_data_business_locale_fallback = zh:Zh_En_Ja
<!-- reference_data_business_locale_fallback.2 的当前独立事实为 ja:Ja_Zh_En。 -->
reference_data_business_locale_fallback.2 = ja:Ja_Zh_En
<!-- reference_data_business_locale_fallback.3 的当前独立事实为 en:En_Zh_Ja。 -->
reference_data_business_locale_fallback.3 = en:En_Zh_Ja
<!-- reference_data_business_locale_fallback.4 的当前独立事实为 final:code_or_fieldName。 -->
reference_data_business_locale_fallback.4 = final:code_or_fieldName
<!-- reference_data_business_locale_fallback.5 的当前独立事实为 table_title_uses_name_not_description。 -->
reference_data_business_locale_fallback.5 = table_title_uses_name_not_description
<!-- 语言切换必须先完整加载公共与应用资源，再原位更新现有控制器并保留业务状态，禁止刷新或重建业务会话。 -->
reference_data_runtime_locale_switch = locale_runtime_atomic_load_then_apply
<!-- reference_data_runtime_locale_switch.2 的当前独立事实为 preserve_active_module_query_filters_pagination_selection_detail_page_edit_and_window_form。 -->
reference_data_runtime_locale_switch.2 = preserve_active_module_query_filters_pagination_selection_detail_page_edit_and_window_form
<!-- reference_data_runtime_locale_switch.3 的当前独立事实为 no_page_reload。 -->
reference_data_runtime_locale_switch.3 = no_page_reload

<!-- 工作台搜索是结构定位：每个模块只允许 code 和其真实父级坐标，无父级时只保留 code。 -->
reference_data_search_field_whitelist = types:code|parentTypeCode
<!-- reference_data_search_field_whitelist.2 的当前独立事实为 tree:code|parentId。 -->
reference_data_search_field_whitelist.2 = tree:code|parentId
<!-- reference_data_search_field_whitelist.3 的当前独立事实为 tables:code。 -->
reference_data_search_field_whitelist.3 = tables:code
<!-- reference_data_search_field_whitelist.4 的当前独立事实为 table_elements:code|tableId。 -->
reference_data_search_field_whitelist.4 = table_elements:code|tableId
<!-- reference_data_search_field_whitelist.5 的当前独立事实为 controls:code&parentCode&optionSetCode。 -->
reference_data_search_field_whitelist.5 = controls:code&parentCode&optionSetCode
<!-- reference_data_search_field_whitelist.6 的当前独立事实为 windows:code。 -->
reference_data_search_field_whitelist.6 = windows:code
<!-- 多语名称、类型值、项目、页面、控件种类和来源表均不属于结构搜索白名单。 -->
reference_data_search_non_structural_fields = nameZh|nameJa|nameEn|valueCode|nodeValue|projectCode|pageCode|controlKind|sourceTableName:forbidden
<!-- 页面搜索框必须根据当前模块真实白名单显示 Code 与父级坐标提示，禁止再写“多语言名称”。 -->
reference_data_search_placeholder = active_module_code_plus_real_parent_coordinate_only
<!-- reference_data_search_placeholder.2 的当前独立事实为 no_multilingual_name_claim。 -->
reference_data_search_placeholder.2 = no_multilingual_name_claim
<!-- 白名单含两个及以上结构字段时必须渲染同数量输入，提交后逐字段 AND，禁止一个 keyword 通过 OR 代替。 -->
reference_data_structural_query_input_contract = one_input_per_whitelisted_field
<!-- reference_data_structural_query_input_contract.2 的当前独立事实为 types:code&parentTypeCode。 -->
reference_data_structural_query_input_contract.2 = types:code&parentTypeCode
<!-- reference_data_structural_query_input_contract.3 的当前独立事实为 tree:code&parentId。 -->
reference_data_structural_query_input_contract.3 = tree:code&parentId
<!-- reference_data_structural_query_input_contract.4 的当前独立事实为 table_elements:code&tableId。 -->
reference_data_structural_query_input_contract.4 = table_elements:code&tableId
<!-- reference_data_structural_query_input_contract.5 的当前独立事实为 tables:code。 -->
reference_data_structural_query_input_contract.5 = tables:code
<!-- reference_data_structural_query_input_contract.6 的当前独立事实为 windows:code。 -->
reference_data_structural_query_input_contract.6 = windows:code
<!-- reference_data_structural_query_input_contract.7 的当前独立事实为 AND_only。 -->
reference_data_structural_query_input_contract.7 = AND_only
<!-- reference_data_structural_query_input_contract.8 的当前独立事实为 no_combined_keyword_OR。 -->
reference_data_structural_query_input_contract.8 = no_combined_keyword_OR
<!-- reference_data_structural_query_input_contract.9 的当前独立事实为 horizontal_toolbar_shared_vertical_baseline。 -->
reference_data_structural_query_input_contract.9 = horizontal_toolbar_shared_vertical_baseline
<!-- 页面控件三个输入分别映射 codeLike、parentCodeLike、optionSetCodeLike，条件之间只允许 BaseDao AND。 -->
reference_data_control_query_contract = independent_inputs:code|parentCode|optionSetCode
<!-- reference_data_control_query_contract.2 的当前独立事实为 BaseDao_parameters:codeLike|parentCodeLike|optionSetCodeLike。 -->
reference_data_control_query_contract.2 = BaseDao_parameters:codeLike|parentCodeLike|optionSetCodeLike
<!-- reference_data_control_query_contract.3 的当前独立事实为 AND_only。 -->
reference_data_control_query_contract.3 = AND_only
<!-- reference_data_control_query_contract.4 的当前独立事实为 no_OR。 -->
reference_data_control_query_contract.4 = no_OR
<!-- 页面控件 Grid 必须使用后台 pageNo/pageSize/totalCount，禁止循环读取全部页后在浏览器过滤。 -->
reference_data_control_pagination_contract = remote_current_page
<!-- reference_data_control_pagination_contract.2 的当前独立事实为 totalCount。 -->
reference_data_control_pagination_contract.2 = totalCount
<!-- reference_data_control_pagination_contract.3 的当前独立事实为 no_load_all_for_grid_search。 -->
reference_data_control_pagination_contract.3 = no_load_all_for_grid_search

<!-- 首次打开只允许请求导航、当前模块数据和当前模块表头，不得并行加载所有业务模块记录。 -->
reference_data_initial_business_request_scope = navigation_plus_active_module_records_plus_active_module_columns_only
<!-- 其他模块在用户首次点击时加载，并在当前页面会话中缓存。 -->
reference_data_lazy_module_cache = load_on_first_activation_then_reuse_in_page_session
<!-- 新增、修改、删除或切换状态后只强制刷新当前模块，禁止重新请求全部模块。 -->
reference_data_mutation_refresh_scope = active_module_only

## 页面编辑表格头

<!-- 页面编辑关闭时表格配置头完全消失；开启整页手动编辑后才显示当前模块表格名称、ReferenceDataTable.code 和编辑入口。 -->
reference_data_page_edit_table_heading = switch_off_hidden
<!-- reference_data_page_edit_table_heading.2 的当前独立事实为 switch_on_active_module_table_title_plus_ReferenceDataTable_code_plus_adjacent_accent_edit_action。 -->
reference_data_page_edit_table_heading.2 = switch_on_active_module_table_title_plus_ReferenceDataTable_code_plus_adjacent_accent_edit_action
<!-- reference_data_page_edit_table_heading.3 的当前独立事实为 no_business_column_occupation。 -->
reference_data_page_edit_table_heading.3 = no_business_column_occupation
<!-- 本页六个管理 Window 必须各自绑定一条 ReferenceDataWindow；标题栏按钮保存当前实例宽高与 x/y，下一次打开从已保存矩形出现。 -->
reference_data_page_edit_window_heading = six_management_windows_six_ReferenceDataWindow_records
<!-- reference_data_page_edit_window_heading.2 的当前独立事实为 bind_by_triggerControlCode。 -->
reference_data_page_edit_window_heading.2 = bind_by_triggerControlCode
<!-- reference_data_page_edit_window_heading.3 的当前独立事实为 switch_off_hidden。 -->
reference_data_page_edit_window_heading.3 = switch_off_hidden
<!-- reference_data_page_edit_window_heading.4 的当前独立事实为 switch_on_code_plus_save_action。 -->
reference_data_page_edit_window_heading.4 = switch_on_code_plus_save_action
<!-- reference_data_page_edit_window_heading.5 的当前独立事实为 save_width_height_x_y_as_custom_next_default。 -->
reference_data_page_edit_window_heading.5 = save_width_height_x_y_as_custom_next_default
<!-- 编辑开关开启期间仍允许切换树和业务模块；未点控件保存按钮不弹提示、不阻断，也不自动提交。 -->
reference_data_page_edit_navigation = always_switchable
<!-- reference_data_page_edit_navigation.2 的当前独立事实为 no_unsaved_prompt。 -->
reference_data_page_edit_navigation.2 = no_unsaved_prompt
<!-- reference_data_page_edit_navigation.3 的当前独立事实为 no_automatic_save。 -->
reference_data_page_edit_navigation.3 = no_automatic_save
<!-- 查询工具栏只提供共同查询边界；每个可见输入、下拉、查询按钮和重置都用自身 code 单独保存，条件由查询按钮统一提交。 -->
reference_data_page_edit_query_controls = toolbar_parent_only
<!-- reference_data_page_edit_query_controls.2 的当前独立事实为 every_real_structural_field_independent_record。 -->
reference_data_page_edit_query_controls.2 = every_real_structural_field_independent_record
<!-- reference_data_page_edit_query_controls.3 的当前独立事实为 no_keyword_record。 -->
reference_data_page_edit_query_controls.3 = no_keyword_record
<!-- reference_data_page_edit_query_controls.4 的当前独立事实为 one_shared_submit_record。 -->
reference_data_page_edit_query_controls.4 = one_shared_submit_record
<!-- reference_data_page_edit_query_controls.5 的当前独立事实为 dropdown_change_draft_only。 -->
reference_data_page_edit_query_controls.5 = dropdown_change_draft_only
<!-- reference_data_page_edit_query_controls.6 的当前独立事实为 submit_commits_all_conditions。 -->
reference_data_page_edit_query_controls.6 = submit_commits_all_conditions
<!-- reference_data_page_edit_query_controls.7 的当前独立事实为 remount_updates_real_root。 -->
reference_data_page_edit_query_controls.7 = remount_updates_real_root
<!-- reference_data_page_edit_query_controls.8 的当前独立事实为 missing_record_uses_default。 -->
reference_data_page_edit_query_controls.8 = missing_record_uses_default
<!-- reference_data_page_edit_query_controls.9 的当前独立事实为 independent_width_ordered_auto_reflow。 -->
reference_data_page_edit_query_controls.9 = independent_width_ordered_auto_reflow
<!-- reference_data_page_edit_query_controls.10 的当前独立事实为 one_shared_save_follows_reset。 -->
reference_data_page_edit_query_controls.10 = one_shared_save_follows_reset
<!-- reference_data_page_edit_query_controls.11 的当前独立事实为 current_control_code_single_record_payload。 -->
reference_data_page_edit_query_controls.11 = current_control_code_single_record_payload
<!-- reference_data_page_edit_query_controls.12 的当前独立事实为 no_editor_cards。 -->
reference_data_page_edit_query_controls.12 = no_editor_cards
<!-- reference_data_page_edit_query_controls.13 的当前独立事实为 no_query_value_persistence。 -->
reference_data_page_edit_query_controls.13 = no_query_value_persistence

## 验证

<!-- 交付前必须验证导航接口、前端语法、首次无全量加载、表格字段下钻和 Reference Data 专项门禁。 -->
verification_required = navigation_controller_test
<!-- verification_required.2 的当前独立事实为 javascript_syntax_check。 -->
verification_required.2 = javascript_syntax_check
<!-- verification_required.3 的当前独立事实为 no_load_all_contract。 -->
verification_required.3 = no_load_all_contract
<!-- verification_required.4 的当前独立事实为 table_business_detail_contract。 -->
verification_required.4 = table_business_detail_contract
<!-- verification_required.5 的当前独立事实为 master_column_crud_real_database_test。 -->
verification_required.5 = master_column_crud_real_database_test
<!-- verification_required.6 的当前独立事实为 idempotent_seed_test。 -->
verification_required.6 = idempotent_seed_test
<!-- verification_required.7 的当前独立事实为 reference_data_special_gate。 -->
verification_required.7 = reference_data_special_gate
