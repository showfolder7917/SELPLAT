# Reference Data 工作台导航与按需加载规则

<!-- 本规则没有独立 Java 自动化程序，生产能力由 reference-data 应用源码实现。 -->
java_ability_refs = none
<!-- 本规则没有 Python 成品，不虚构 Python 能力。 -->
python_ability_refs = none
<!-- 本规则没有独立 Node 程序，前端行为由应用脚本与契约测试验证。 -->
node_ability_refs = none
<!-- 1.0.0 固化不落库导航能力、五个一级模块、按需加载和表格字段下钻。 -->
rule_version = 1.0.0
<!-- 所有者只能从工程根 AGENTS.md 的当前稳定用户声明动态取得。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示规则已完成索引登记和应用回归。 -->
rule_status = active
<!-- 本次升级来自用户对多接口首屏加载和表格字段一级菜单的架构纠正。 -->
upgrade_record = 2026-08-11:navigation_moves_to_database_free_capability_five_top_level_modules_lazy_load_table_definition_drills_into_columns

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

## 请求与缓存

<!-- 首次打开只允许请求导航、当前模块数据和当前模块表头，不得并行加载所有业务模块记录。 -->
reference_data_initial_business_request_scope = navigation_plus_active_module_records_plus_active_module_columns_only
<!-- 其他模块在用户首次点击时加载，并在当前页面会话中缓存。 -->
reference_data_lazy_module_cache = load_on_first_activation_then_reuse_in_page_session
<!-- 新增、修改、删除或切换状态后只强制刷新当前模块，禁止重新请求全部模块。 -->
reference_data_mutation_refresh_scope = active_module_only

## 验证

<!-- 交付前必须验证导航接口、前端语法、首次无全量加载、表格字段下钻和 Reference Data 专项门禁。 -->
verification_required = navigation_controller_test,javascript_syntax_check,no_load_all_contract,table_to_column_drilldown_contract,reference_data_special_gate
