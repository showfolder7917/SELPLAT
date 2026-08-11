# 当前用户 SELPLAT Reference Data 应用规则索引

<!-- Reference Data 工作台导航与模块加载行为统一从本规则进入。 -->
REFERENCE_DATA_WORKBENCH_NAVIGATION_AND_LAZY_LOADING_RULES = local/XUNAN/selplat/应用/reference-data/rule/RUL_ReferenceData工作台导航与按需加载规则.md

<!-- 修改 reference-data.html 一级导航、不落库导航能力或模块初始请求时必须加载。 -->
reference_data_workbench_navigation_trigger = REFERENCE_DATA_WORKBENCH_NAVIGATION_AND_LAZY_LOADING_RULES
<!-- 修改表格定义到 ReferenceDataTableColumn 下钻关系时必须加载。 -->
reference_data_table_to_column_drilldown_trigger = REFERENCE_DATA_WORKBENCH_NAVIGATION_AND_LAZY_LOADING_RULES
