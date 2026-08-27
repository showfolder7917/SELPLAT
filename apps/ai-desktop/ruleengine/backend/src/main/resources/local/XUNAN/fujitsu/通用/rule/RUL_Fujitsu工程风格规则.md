# Fujitsu Project Style Rules

## 说明

- 本规则承接 Fujitsu 工程的共同实现风格、参考方式、命名、分层、注释和验证边界。
- Fujitsu 工程按项目名前缀识别；项目专属细节继续进入 `local/XUNAN/fujitsu/应用/<project>/rule/`，不得全部提升为组织级规则。
- SELPLAT 不属于本规则适用范围，继续使用自己的工程规则目录。

## 工程识别与目录分级

<!-- CP、IT、SB、AP 开头的工程统一识别为 Fujitsu 工程；适用于规则路由和目录归属；业务含义是让同组织工程共享稳定风格，同时避免与 SELPLAT 混用 -->
fujitsu_project_name_prefixes = CP
<!-- fujitsu_project_name_prefixes.2 的当前独立事实为 IT。 -->
fujitsu_project_name_prefixes.2 = IT
<!-- fujitsu_project_name_prefixes.3 的当前独立事实为 SB。 -->
fujitsu_project_name_prefixes.3 = SB
<!-- fujitsu_project_name_prefixes.4 的当前独立事实为 AP。 -->
fujitsu_project_name_prefixes.4 = AP

<!-- Fujitsu 共同规则放在组织目录，单一工程规则继续进入项目子目录；适用于统一 MEMORIES 承载多层规则；业务含义是区分组织共性和项目特例 -->
fujitsu_shared_rule_root = apps/ai-desktop/ruleengine/backend/src/main/resources/local/XUNAN/fujitsu/通用/rule/
<!-- fujitsu_project_specific_rule_root 的当前独立事实为 apps/ai-desktop/ruleengine/backend/src/main/resources/local/XUNAN/fujitsu/应用/<project>/rule/。 -->
fujitsu_project_specific_rule_root = apps/ai-desktop/ruleengine/backend/src/main/resources/local/XUNAN/fujitsu/应用/<project>/rule/

<!-- SELPLAT 必须排除在 Fujitsu 风格之外；适用于宿主工程和外部工程规则同时存在的场景；业务含义是不能因规则存储在同一 MEMORIES 就交叉加载 -->
fujitsu_project_style_excludes = SELPLAT

## 参考与实现风格

<!-- 修改业务实现前必须同时核对目标工程、相邻同类工程和公共组件的现有写法；适用于存在参考工程或公共层的场景；业务含义是避免只模仿单个文件而遗漏系统级约定 -->
fujitsu_change_must_compare_target_peer_and_common_component_style = true

<!-- 具体参考工程必须由项目专属规则声明，不得在组织级规则中把某个 CP 工程固定为所有 IT、SB、AP 工程的参考；业务含义是共享参考方法但不传播错误项目依赖 -->
fujitsu_reference_project_must_be_declared_by_project_specific_rule = true

## 分层与命名

<!-- 业务编排、数据 Bean、Mapper 和 SQL 必须保持职责分离；适用于 Java 与 MyBatis 持久层改动；业务含义是让类型和 SQL 契约可复用、可定位且便于验证 -->
fujitsu_business_orchestration_and_persistence_contracts_must_be_separated = true

<!-- 新名称必须先检索目标工程、相邻工程和公共组件中已有的业务缩写与命名模式；适用于类名、方法名、Bean、SQL ID 和字段名；业务含义是禁止自由翻译形成同义异名 -->
fujitsu_new_names_must_reuse_existing_business_abbreviations_and_patterns = true

<!-- 项目存在公共 Mapper 或公共持久层时必须优先复用；适用于批处理或服务新增数据库访问；业务含义是禁止无依据建立重复的项目内持久层体系 -->
fujitsu_project_must_prefer_existing_common_mapper_and_persistence_layer = true

## 事实来源与变更边界

<!-- SQL、Bean 和业务字段必须以当前项目设计文档、表定义及既有契约为事实来源；适用于数据库读写实现；业务含义是禁止根据旧代码或名称猜测字段 -->
fujitsu_sql_bean_and_business_fields_must_follow_project_design_and_table_contract = true

<!-- 新业务行为应使用可追踪的新入口或新标识，既有行为不得在未经要求时被暗改；适用于 SQL statement、Mapper 方法和批处理步骤；业务含义是控制回归范围并保留旧实现核对能力 -->
fujitsu_new_behavior_must_be_traceable_and_must_not_silently_change_existing_behavior = true

<!-- 外部文件或电文的长度、字符属性与业务规范值冲突时，必须先修正转换 Bean 契约，使规范值能够通过形式检查，再执行去除补位后的精确业务比较；适用于固定长代码包含符号或设计值短于旧生成定义的场景；业务含义是防止新增相関检查永远无法到达 -->
fujitsu_external_code_conversion_contract_must_accept_canonical_business_value_before_correlation_check = true

<!-- 异常检测位置与消息码必须以当前处理详细或消息分配规格为准，新增处理步骤不得自行顺延既有消息码；共享 message.yml 中存在某个消息码只证明消息可解析，不证明该业务功能获准使用；业务含义是防止实现推断改变正式错误契约 -->
fujitsu_error_detection_message_code_must_follow_explicit_design_assignment_and_must_not_be_inferred_by_sequence = true

## 注释、验证与离线边界

<!-- Java、JavaScript、Python 的新增或修改业务代码必须补充业务语义注释，导入语句除外；适用于 Fujitsu 工程代码交付；业务含义是解释代码在业务流程中的用途而非复述语法 -->
fujitsu_code_changes_require_business_semantic_comments_except_imports = true

<!-- 交付验证必须覆盖本次改动的编译或解析、风格检查、接口或映射注册及关键运行时绑定；适用于语言和框架允许执行相应检查的场景；业务含义是同时验证结构、风格和运行契约 -->
fujitsu_delivery_verification_must_cover_changed_contract_and_adjacent_regression = true

<!-- 离线依赖缺失时必须加载当前任务实际命中的分层恢复规则；common 只声明行为门槛，不反向固定用户层文件。 -->
fujitsu_offline_dependency_gap_requires_matched_scoped_recovery_rule = true

<!-- 目标项目存在特殊坐标、兼容版本、只读参考工程或额外验证时，再加载项目专项配置规则；业务含义是项目只保存差异，不复制组织级恢复算法 -->
fujitsu_offline_project_specific_rule_scope = artifact_coordinate
<!-- fujitsu_offline_project_specific_rule_scope.2 的当前独立事实为 compatible_version。 -->
fujitsu_offline_project_specific_rule_scope.2 = compatible_version
<!-- fujitsu_offline_project_specific_rule_scope.3 的当前独立事实为 readonly_reference。 -->
fujitsu_offline_project_specific_rule_scope.3 = readonly_reference
<!-- fujitsu_offline_project_specific_rule_scope.4 的当前独立事实为 additional_verification。 -->
fujitsu_offline_project_specific_rule_scope.4 = additional_verification
