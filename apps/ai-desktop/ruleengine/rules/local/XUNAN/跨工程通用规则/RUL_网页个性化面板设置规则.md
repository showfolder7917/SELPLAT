# 网页个性化面板设置规则

<!-- 问题：把背景、面板材质、边框间距和动效分别散落在页面中，会导致入口重复、颜色写死，并在换皮肤或浮层定位时产生回归。 -->
<!-- 场景：网页需要用一个个性化入口管理背景以及面板外观、边框间距、动效和预设，同时允许刷新恢复默认。 -->
<!-- 业务含义：个性化外壳只负责组合独立能力和实时参数；背景仍是独立模块，所有水晶表面共享可换肤 token。 -->

<!-- 1.0.0 将聚合正文拆成表面材质、颜色文字滚动条、几何动效和预设验收四个职责。 -->
rule_version = 1.0.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 聚合入口与四个职责规则均处于生产启用状态。 -->
rule_status = active
<!-- 当前版本变化只描述职责拆分，原有有效事实全部由依赖规则继续承载。 -->
current_version_change_summary = compatibility_umbrella_requires_four_personalization_responsibility_rules
<!-- 聚合规则没有独立 Java 能力入口。 -->
java_ability_refs = none
<!-- python_ability_refs 的当前独立事实为 none。 -->
python_ability_refs = none
<!-- node_ability_refs 的当前独立事实为 none。 -->
node_ability_refs = none

<!-- 原逻辑 ID 保留为兼容聚合入口，并显式加载已拆分的职责规则。 -->
requires_rule_ids = WEB_PERSONALIZATION_SURFACE_MATERIAL_RULES,WEB_PERSONALIZATION_COLOR_TEXT_SCROLLBAR_RULES,WEB_PERSONALIZATION_GEOMETRY_MOTION_RULES,WEB_PERSONALIZATION_PRESET_LIFECYCLE_QA_RULES
