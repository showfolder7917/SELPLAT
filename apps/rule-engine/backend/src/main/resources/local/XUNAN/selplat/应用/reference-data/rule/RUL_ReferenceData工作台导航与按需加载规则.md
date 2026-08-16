# Reference Data 工作台导航与按需加载规则

<!-- 本规则没有独立 Java 自动化程序，生产能力由 reference-data 应用源码实现。 -->
java_ability_refs = none
<!-- 本规则没有 Python 成品，不虚构 Python 能力。 -->
python_ability_refs = none
<!-- 本规则没有独立 Node 程序，前端行为由应用脚本与契约测试验证。 -->
node_ability_refs = none
<!-- 1.26.0 固定 Window 只由 ReferenceDataWindow 保存外框几何，禁止内部字段进入 ControlLayout。 -->
rule_version = 1.26.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示规则已完成索引登记和应用回归。 -->
rule_status = active
<!-- 本次升级来自用户对多接口首屏加载和表格字段一级菜单的架构纠正。 -->
upgrade_record = 2026-08-11:navigation_moves_to_database_free_capability_five_top_level_modules_lazy_load_table_definition_drills_into_columns;2026-08-11:table_definition_uses_business_detail_info_columns_preview_full_crud_and_idempotent_demo_data;2026-08-15:window_remains_top_level_without_record_children_or_expand_menu;2026-08-15:page_edit_table_heading_uses_active_module_title_and_ReferenceDataTable_code;2026-08-15:all_management_windows_share_one_ReferenceDataWindow_page_edit_control;2026-08-15:table_edit_action_moves_beside_code_and_uses_shared_page_editor_accent;2026-08-15:table_and_each_management_window_save_independently_window_geometry_becomes_next_default_navigation_remains_available;2026-08-15:query_toolbar_has_parent_layout_and_five_independently_draggable_resizable_code_addressed_children;2026-08-15:page_controls_remains_top_level_without_page_record_children_or_expand_menu;2026-08-15:query_editor_cards_removed_one_shared_current_control_save_action_after_reset_single_child_payload;2026-08-15:query_width_change_reflows_following_siblings_and_save_action_follows_reset;2026-08-15:type_catalog_owns_tree_dropdown_and_menu_classification_tree_module_only_reads_TREE_nodes
<!-- 独立树升级记录说明树节点页面不再依赖类型目录。 -->
upgrade_record_20260815_independent_tree = 树节点模块不加载数据类型_使用根节点code筛选_编辑只维护parentId_nodeValue_多语言名称_状态排序
<!-- 查询条件内部结构由 selSearch 配置拥有，页面控件表只保留整组搜索及三个同级动作。 -->
upgrade_record_20260816_query_condition_group = toolbar逐条登记当前可见查询元素_输入和下拉变化不立即查询_查询按钮统一提交全部草稿_字段结构切换重绑真实根_无记录使用默认布局_禁止search空父组残留
<!-- 本次升级让数据类型页面与精简后的全局分类表保持同一字段边界。 -->
upgrade_record_20260816_type_catalog = 数据类型模块只维护全局唯一categoryCode_多语言名称_状态排序_不显示项目资源坐标或说明字段
<!-- 本次升级把数据类型改为页面控件拥有的值目录，并支持同控件父子菜单。 -->
upgrade_record_20260816_type_control_binding = 数据类型使用controlCode绑定页面控件_valueCode保存业务值_parentTypeCode建立二级及多级菜单_页面控件删除typeId_categoryCode废弃
<!-- 本次升级把同一页面六份伪表定义收敛为一条真实 Grid，子元素使用 viewCode 表达业务视图。 -->
upgrade_record_20260816_single_grid = ReferenceDataTable每页面每Grid唯一一条_ReferenceDataTableElement使用tableId外键加viewCode区分六类视图_Service只通过业务Service与BaseDao查询
<!-- 本次升级消除 HTTP tableCode 与元素 viewCode 同名歧义，并删除唯一 Grid 场景的多父级 IN 查询。 -->
upgrade_record_20260816_table_code_query = getGridColumn使用tableCode定位唯一Grid_元素使用tableId等值查询加自身viewCode_页面读取保存禁止tableIdIn
<!-- 本次升级把结构搜索收紧为对象 code 和真实父级坐标，不再混入多语名称或业务值。 -->
upgrade_record_20260816_code_parent_search = 工作台搜索只使用code和真实父级字段_无父级字段的模块只搜索code_名称值项目页面字段不参与
<!-- 本次升级纠正历史分类边界：TREE 是树节点视图，不是 ReferenceDataType 类型值。 -->
upgrade_record_20260816_tree_type_cleanup = ReferenceDataType物理删除TREE并禁止再次保存_ReferenceDataTreeNode保留真实树节点_Window旧树与选项名称定向改为树节点
<!-- 本次升级让数据类型与其他管理模块保持相同一级入口，记录只在右侧 Grid 展示。 -->
upgrade_record_20260816_type_top_level_only = 数据类型左侧导航无展开箭头无记录子节点_数量仍显示_右侧表格和编辑功能保留
<!-- 本次升级给树节点增加可辨认来源，但不改变独立建树和搜索字段。 -->
upgrade_record_20260816_tree_ownership = 树节点保存projectCode_pageCode用于表格与表单归属展示_建树只使用code_parentId_搜索仍只使用code_parentId
<!-- 本次升级让页面和 Window 真实子控件通过唯一 control code 使用可共享选项组。 -->
upgrade_record_20260816_option_set_controls = Type删除controlCode改用optionSetCode_页面和Window多个真实控件可共享选项组_Window子控件使用WINDOW加windowCode父坐标并逐字段独立code
<!-- 本次升级明确废弃上一版 Window 子字段登记；内部表单不参与拖拽，95 条历史记录必须物理清理且不得重建。 -->
upgrade_record_20260816_window_layout_boundary = Window外框使用ReferenceDataWindow_内部字段不登记ControlLayout_parentKind_WINDOW服务和数据库拒绝_启动不得生成
<!-- 本次升级把页面控件查询拆为三个独立字段，并使用 BaseDao AND 与真实后台分页。 -->
upgrade_record_20260816_control_remote_query = 控件code_父控件code_选项组code三个输入独立提交_BaseDao_AND_后台当前页_totalCount_禁止全量前端过滤
<!-- 本次升级纠正数据类型仍使用单 keyword 的回退，并清理类型筛选器上浮的旧纵坐标表现。 -->
upgrade_record_20260816_type_independent_query = 数据类型code_parentTypeCode两个独立输入_逐字段AND_类型状态重置与输入共享横向基线

## 导航能力边界

<!-- 工作台稳定导航不查询数据库，必须进入不落库 capability 并只保留 controller、service、service/impl。 -->
reference_data_navigation_ability_structure = capability/workbenchnavigation/controller|service|service_impl,no_dao,no_database_table
<!-- 导航接口只返回模块定义和下钻方式，禁止为了数量在首次请求中查询六张业务表。 -->
reference_data_navigation_database_boundary = static_module_contract_without_database_query_or_record_count
<!-- 页面访问地址保持稳定，不得因导航能力拆分而新增或迁移页面。 -->
reference_data_workbench_page_path = /reference-data/reference-data.html

## 一级模块与下钻

<!-- 左侧一级导航固定为数据类型、树节点、表格定义、页面控件和 Window。 -->
reference_data_top_level_modules = types,tree,tables,controls,windows
<!-- 数据类型维护分类编码及多语言名称；树节点模块独立展示和维护 code + parentId 父子树，不加载或引用类型目录。 -->
reference_data_type_and_tree_responsibility = type_catalog_record_code_plus_optionSetCode_plus_valueCode_plus_parentTypeCode_plus_localized_names_status_sort,ControlLayout_code_is_real_control_and_optionSetCode_is_optional_binding_and_has_no_typeId,tree_module_independent_code_plus_parentId,tree_projectCode_pageCode_attribution_only,no_type_project_page_duplication,no_controlCode,no_categoryCode,no_dropdown_or_menu_nodes_in_tree_management
<!-- 树节点工程与页面坐标只帮助管理者查看来源，禁止成为父子关系或类型目录关联条件。 -->
reference_data_tree_node_attribution = projectCode_plus_pageCode_for_display_and_query_only,tree_relation_still_code_plus_parentId,no_type_coupling
<!-- TREE 只作为树节点模块和表头视图编码；Type 保存入口、Legacy 迁移和正式库都不得保留 TREE 类型记录。 -->
reference_data_tree_value_ownership = TREE:ReferenceDataTreeNode_and_table_view_only,ReferenceDataType:forbidden,physical_cleanup,no_compatibility_record
<!-- 数据类型管理页只从一级入口进入，具体类型记录统一在右侧 Grid 管理，左树不得生成记录子节点或展开菜单。 -->
reference_data_type_navigation_level = top_level_only_no_record_children_or_expand_menu,keep_type_records_in_management_grid
<!-- Window 管理页只从一级入口进入，具体 Window 记录统一在右侧 Grid 与编辑窗口管理，左树不得生成记录子节点或展开菜单。 -->
reference_data_window_navigation_level = top_level_only_no_record_children_or_expand_menu
<!-- 页面控件管理页只从一级入口进入，PAGE 和其他控件记录统一在右侧 Grid 管理，左树不得生成记录子节点或展开菜单。 -->
reference_data_control_navigation_level = top_level_only_no_record_children_or_expand_menu,keep_page_records_in_management_grid
<!-- Window 页面编辑只调整外框位置和大小；内部表单跟随 Window 内容布局，不登记、不拖拽、不生成 ControlLayout 子记录。 -->
reference_data_window_child_control_registration = forbidden,ReferenceDataWindow_outer_geometry_only,no_parentKind_WINDOW,no_inner_field_drag,no_startup_generation,physical_cleanup
<!-- ReferenceDataTableElement 只作为真实 Grid 的字段明细，不得重新成为一级导航。 -->
reference_data_table_column_navigation_level = ReferenceDataTableElement_internal_table_definition_drilldown_only_not_top_level
<!-- 点击表格定义先读取唯一 ReferenceDataTable，再按 tableId 与 viewCode 读取当前视图元素。 -->
reference_data_table_drilldown_sequence = tables_module_then_single_real_grid_then_tableId_plus_viewCode_elements
<!-- 主表只登记真实 Grid 实例；子表只用 tableId 建立外键，viewCode 区分 TYPE/TREE/CONTROL/WINDOW/TABLE/TABLE_ELEMENT。 -->
reference_data_table_column_binding = ReferenceDataTable_one_record_per_page_gridId,ReferenceDataTableElement.tableId_foreign_key_plus_viewCode,no_business_table_name_parent_rows
<!-- 表头 HTTP 坐标必须显式命名 tableCode；先按 ReferenceDataTable.code 精确命中一条，再按 tableId 等值和元素 viewCode 读取列表。 -->
reference_data_grid_column_query_coordinate = request_tableCode,exact_ReferenceDataTable.code,exact_ReferenceDataTableElement.tableId,element_viewCode,no_tableIdIn
<!-- 表格定义属于业务组件配置而不是 MDA 数据库工具；打开记录后使用基本信息、表格列配置和效果预览三个详情状态。 -->
reference_data_table_definition_experience = business_component_configuration_not_database_tool,detail_tabs_info_columns_preview
<!-- 列配置页只显示当前 tableName 与 gridColumnId/gridId 坐标的记录，并保留新增、查询、编辑、启停和逻辑删除。 -->
reference_data_table_definition_crud = single_grid_master_and_elements_full_create_read_update_toggle_delete,current_tableId_and_viewCode_filter
<!-- 新建列的中文表头必填；页面预览优先显示中文，内部字段和控件 ID 继续使用英文驼峰稳定编码。 -->
reference_data_new_column_naming = labelZh_required_and_visible,gridId_gridColumnId_tableFieldName_camel_case_internal
<!-- 表格定义演示数据只能在缺失时补充，重启不得覆盖管理员修改；固定测试主键与后续号段主键都保持六位。 -->
reference_data_table_definition_demo_seed = idempotent_insert_where_not_exists,no_merge_or_update_overwrite,six_digit_ids

## 请求与缓存

<!-- 工作台搜索是结构定位：每个模块只允许 code 和其真实父级坐标，无父级时只保留 code。 -->
reference_data_search_field_whitelist = types:code|parentTypeCode,tree:code|parentId,tables:code,table_elements:code|tableId,controls:code&parentCode&optionSetCode,windows:code
<!-- 多语名称、类型值、项目、页面、控件种类和来源表均不属于结构搜索白名单。 -->
reference_data_search_non_structural_fields = nameZh|nameJa|nameEn|valueCode|nodeValue|projectCode|pageCode|controlKind|sourceTableName:forbidden
<!-- 页面搜索框必须根据当前模块真实白名单显示 Code 与父级坐标提示，禁止再写“多语言名称”。 -->
reference_data_search_placeholder = active_module_code_plus_real_parent_coordinate_only,no_multilingual_name_claim
<!-- 白名单含两个及以上结构字段时必须渲染同数量输入，提交后逐字段 AND，禁止一个 keyword 通过 OR 代替。 -->
reference_data_structural_query_input_contract = one_input_per_whitelisted_field,types:code&parentTypeCode,AND_only,no_combined_keyword_OR,horizontal_toolbar_shared_vertical_baseline
<!-- 页面控件三个输入分别映射 codeLike、parentCodeLike、optionSetCodeLike，条件之间只允许 BaseDao AND。 -->
reference_data_control_query_contract = independent_inputs:code|parentCode|optionSetCode,BaseDao_parameters:codeLike|parentCodeLike|optionSetCodeLike,AND_only,no_OR
<!-- 页面控件 Grid 必须使用后台 pageNo/pageSize/totalCount，禁止循环读取全部页后在浏览器过滤。 -->
reference_data_control_pagination_contract = remote_current_page,totalCount,no_load_all_for_grid_search

<!-- 首次打开只允许请求导航、当前模块数据和当前模块表头，不得并行加载所有业务模块记录。 -->
reference_data_initial_business_request_scope = navigation_plus_active_module_records_plus_active_module_columns_only
<!-- 其他模块在用户首次点击时加载，并在当前页面会话中缓存。 -->
reference_data_lazy_module_cache = load_on_first_activation_then_reuse_in_page_session
<!-- 新增、修改、删除或切换状态后只强制刷新当前模块，禁止重新请求全部模块。 -->
reference_data_mutation_refresh_scope = active_module_only

## 页面编辑表格头

<!-- 页面编辑关闭时表格配置头完全消失；开启整页手动编辑后才显示当前模块表格名称、ReferenceDataTable.code 和编辑入口。 -->
reference_data_page_edit_table_heading = switch_off_hidden,switch_on_active_module_table_title_plus_ReferenceDataTable_code_plus_adjacent_accent_edit_action,no_business_column_occupation
<!-- 本页六个管理 Window 必须各自绑定一条 ReferenceDataWindow；标题栏按钮保存当前实例宽高与 x/y，下一次打开从已保存矩形出现。 -->
reference_data_page_edit_window_heading = six_management_windows_six_ReferenceDataWindow_records,bind_by_triggerControlCode,switch_off_hidden,switch_on_code_plus_save_action,save_width_height_x_y_as_custom_next_default
<!-- 编辑开关开启期间仍允许切换树和业务模块；未点控件保存按钮不弹提示、不阻断，也不自动提交。 -->
reference_data_page_edit_navigation = always_switchable,no_unsaved_prompt,no_automatic_save
<!-- 查询工具栏只提供共同查询边界；每个可见输入、下拉、查询按钮和重置都用自身 code 单独保存，条件由查询按钮统一提交。 -->
reference_data_page_edit_query_controls = toolbar_parent_only,every_visible_query_element_independent_record,keyword_and_multi_field_layout_profiles,dropdown_change_draft_only,submit_commits_all_conditions,remount_updates_real_root,missing_record_uses_default,independent_width_ordered_auto_reflow,one_shared_save_follows_reset,current_control_code_single_record_payload,no_editor_cards,no_query_value_persistence

## 验证

<!-- 交付前必须验证导航接口、前端语法、首次无全量加载、表格字段下钻和 Reference Data 专项门禁。 -->
verification_required = navigation_controller_test,javascript_syntax_check,no_load_all_contract,table_business_detail_contract,master_column_crud_real_database_test,idempotent_seed_test,reference_data_special_gate
