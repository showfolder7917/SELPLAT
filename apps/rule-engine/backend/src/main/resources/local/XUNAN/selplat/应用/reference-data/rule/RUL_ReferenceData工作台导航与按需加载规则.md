# Reference Data 工作台导航与按需加载规则

<!-- 本规则没有独立 Java 自动化程序，生产能力由 reference-data 应用源码实现。 -->
java_ability_refs = none
<!-- 本规则没有 Python 成品，不虚构 Python 能力。 -->
python_ability_refs = none
<!-- 本规则没有独立 Node 程序，前端行为由应用脚本与契约测试验证。 -->
node_ability_refs = none
<!-- 1.1.0 增加表格定义业务详情、完整 CRUD、效果预览和幂等演示数据。 -->
rule_version = 1.1.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示规则已完成索引登记和应用回归。 -->
rule_status = active
<!-- 本次升级来自用户对多接口首屏加载和表格字段一级菜单的架构纠正。 -->
upgrade_record = 2026-08-11:navigation_moves_to_database_free_capability_five_top_level_modules_lazy_load_table_definition_drills_into_columns;2026-08-11:table_definition_uses_business_detail_info_columns_preview_full_crud_and_idempotent_demo_data

## 导航能力边界

<!-- 工作台稳定导航不查询数据库，必须进入不落库 capability 并只保留 controller、service、service/impl。 -->
reference_data_navigation_ability_structure = capability/workbenchnavigation/controller|service|service_impl,no_dao,no_database_table
<!-- 导航接口只返回模块定义和下钻方式，禁止为了数量在首次请求中查询六张业务表。 -->
reference_data_navigation_database_boundary = static_module_contract_without_database_query_or_record_count
<!-- 页面访问地址保持稳定，不得因导航能力拆分而新增或迁移页面。 -->
reference_data_workbench_page_path = /reference-data/reference-data.html

## 一级模块与下钻

<!-- 左侧一级导航固定为数据类型、树节点、下拉选项、菜单项目和表格定义。 -->
reference_data_top_level_modules = types,tree,options,menus,tables
<!-- ReferenceDataTableColumn 只作为表格定义的字段明细，不得重新成为一级导航。 -->
reference_data_table_column_navigation_level = internal_table_definition_drilldown_only_not_top_level
<!-- 点击表格定义先读取 ReferenceDataTable，点击具体表格后再读取 ReferenceDataTableColumn。 -->
reference_data_table_drilldown_sequence = tables_module_then_registered_table_then_matching_columns
<!-- 主表 gridColumnId 表示表格配置 ID，并与字段表 gridId 匹配；字段表 gridColumnId 继续表示单列 ID。 -->
reference_data_table_column_binding = ReferenceDataTable.gridColumnId_equals_ReferenceDataTableColumn.gridId,child_gridColumnId_is_column_identity
<!-- 表格定义属于业务组件配置而不是 MDA 数据库工具；打开记录后使用基本信息、表格列配置和效果预览三个详情状态。 -->
reference_data_table_definition_experience = business_component_configuration_not_database_tool,detail_tabs_info_columns_preview
<!-- 列配置页只显示当前 tableName 与 gridColumnId/gridId 坐标的记录，并保留新增、查询、编辑、启停和逻辑删除。 -->
reference_data_table_definition_crud = master_and_columns_full_create_read_update_toggle_delete,current_table_column_filter
<!-- 新建列的中文表头必填；页面预览优先显示中文，内部字段和控件 ID 继续使用英文驼峰稳定编码。 -->
reference_data_new_column_naming = labelZh_required_and_visible,gridId_gridColumnId_tableFieldName_camel_case_internal
<!-- 表格定义演示数据只能在缺失时补充，重启不得覆盖管理员修改；固定测试主键与后续号段主键都保持六位。 -->
reference_data_table_definition_demo_seed = idempotent_insert_where_not_exists,no_merge_or_update_overwrite,six_digit_ids

## 请求与缓存

<!-- 首次打开只允许请求导航、当前模块数据和当前模块表头，不得并行加载所有业务模块记录。 -->
reference_data_initial_business_request_scope = navigation_plus_active_module_records_plus_active_module_columns_only
<!-- 其他模块在用户首次点击时加载，并在当前页面会话中缓存。 -->
reference_data_lazy_module_cache = load_on_first_activation_then_reuse_in_page_session
<!-- 新增、修改、删除或切换状态后只强制刷新当前模块，禁止重新请求全部模块。 -->
reference_data_mutation_refresh_scope = active_module_only

## 验证

<!-- 交付前必须验证导航接口、前端语法、首次无全量加载、表格字段下钻和 Reference Data 专项门禁。 -->
verification_required = navigation_controller_test,javascript_syntax_check,no_load_all_contract,table_business_detail_contract,master_column_crud_real_database_test,idempotent_seed_test,reference_data_special_gate
