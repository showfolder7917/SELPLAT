# 当前用户 SELPLAT Reference Data 应用规则索引

<!-- Reference Data 工作台导航与模块加载行为统一从本规则进入。 -->
REFERENCE_DATA_WORKBENCH_NAVIGATION_AND_LAZY_LOADING_RULES = local/XUNAN/selplat/应用/reference-data/rule/RUL_ReferenceData工作台导航与按需加载规则.md

<!-- 修改 reference-data.html 一级导航、不落库导航能力或模块初始请求时必须加载。 -->
reference_data_workbench_navigation_trigger = REFERENCE_DATA_WORKBENCH_NAVIGATION_AND_LAZY_LOADING_RULES
<!-- 修改唯一 ReferenceDataTable 的 tableCode 请求坐标或到元素的 tableId + viewCode 精确下钻关系时必须加载。 -->
reference_data_table_to_column_drilldown_trigger = REFERENCE_DATA_WORKBENCH_NAVIGATION_AND_LAZY_LOADING_RULES
<!-- 修改 Window 外框几何保存或清理内部字段 ControlLayout 记录时必须加载。 -->
reference_data_page_editor_per_control_save_and_window_geometry_trigger = REFERENCE_DATA_WORKBENCH_NAVIGATION_AND_LAZY_LOADING_RULES
<!-- 修改引用数据查询条件组、结构字段独立输入、同级筛选共同基线或旧子记录迁移时必须加载。 -->
reference_data_query_condition_group_layout_and_legacy_cleanup_trigger = REFERENCE_DATA_WORKBENCH_NAVIGATION_AND_LAZY_LOADING_RULES
<!-- 修改工作台搜索字段白名单、父级坐标、逐字段 AND 或搜索框提示时必须加载。 -->
reference_data_code_parent_search_trigger = REFERENCE_DATA_WORKBENCH_NAVIGATION_AND_LAZY_LOADING_RULES
