# 当前用户 SELPLAT 通用规则索引

<!-- 本索引只登记当前用户在 SELPLAT 各应用之间复用的个人工程规则。 -->
active_user_selplat_general_rule_root = local/XUNAN/selplat/通用/rule/

<!-- 本索引只维护 SELPLAT 各应用可以共同复用的规则。 -->
selplat_common_rule_root = local/XUNAN/selplat/通用/rule/

<!-- selplat_common_template_root 的当前独立事实为 local/XUNAN/selplat/通用/template/。 -->
selplat_common_template_root = local/XUNAN/selplat/通用/template/

<!-- 本索引仅汇总下级索引；规则逻辑 ID 与触发映射均保留在对应叶子索引。 -->
current_index_child_reference_only = true

<!-- 工程结构规则由独立叶子索引承载，父索引只负责导航。 -->
SELPLAT_GENERAL_ENGINEERING_RULE_INDEX = local/XUNAN/selplat/通用/index/工程结构/RULE_INDEX.md

<!-- 控件治理规则由独立叶子索引承载，父索引只负责导航。 -->
SELPLAT_GENERAL_COMPONENT_GOVERNANCE_RULE_INDEX = local/XUNAN/selplat/通用/index/控件治理/RULE_INDEX.md

<!-- 界面运行时规则由独立叶子索引承载，父索引只负责导航。 -->
SELPLAT_GENERAL_UI_RUNTIME_RULE_INDEX = local/XUNAN/selplat/通用/index/界面运行时/RULE_INDEX.md

<!-- 数据库基础规则由独立叶子索引承载，父索引只负责导航。 -->
SELPLAT_GENERAL_DATABASE_FOUNDATION_RULE_INDEX = local/XUNAN/selplat/通用/index/数据库基础/RULE_INDEX.md

<!-- Java服务与测试规则由独立叶子索引承载，父索引只负责导航。 -->
SELPLAT_GENERAL_JAVA_SERVICE_TEST_RULE_INDEX = local/XUNAN/selplat/通用/index/Java服务与测试/RULE_INDEX.md
