# 规则生命周期治理

<!-- 规则正文统一由 rule-engine 的标准 resources 承载；适用于规则新增、更新、移动与删除；业务含义是规则资源由 Gradle 自动识别并与运行工具组成独立单元 -->
rule_resource_root = apps/rule-engine/backend/src/main/resources

<!-- 跨工程通用规则直接放在“跨工程通用规则”目录；适用于不依赖组织或工程语义的稳定规则；业务含义是目录语义明确，避免被误认作任意模块规则 -->
cross_project_rules_must_live_in_rule_root = apps/rule-engine/backend/src/main/resources/跨工程通用规则/

<!-- 组织共同规则放入组织目录；适用于 Fujitsu 等跨项目共用约束；业务含义是组织规则可以共享但不提升为全平台规则 -->
organization_scoped_rules_must_live_under_organization_subdirectory = apps/rule-engine/backend/src/main/resources/<organization>/rule/

<!-- 单一项目规则放入组织和项目子目录；适用于只服务一个交付项目的约束；业务含义是保持项目边界清晰 -->
project_specific_rules_must_live_under_applicable_organization_and_project = apps/rule-engine/backend/src/main/resources/<organization>/rule/<applicable_project>/

<!-- SELPLAT 全部应用共用的规则进入明确命名的“通用规则”目录；适用于平台内部构建、路径、DAO 等共同行为；业务含义是既避免其他工程误用，也避免 rule 目录语义不清 -->
selplat_common_rules_must_live_under = apps/rule-engine/backend/src/main/resources/selplat/通用规则/

<!-- SELPLAT 的 apps 目录允许持续新增应用工程；适用于当前和未来任意 apps/<app>；业务含义是新增应用不再膨胀规则资源顶层目录 -->
selplat_application_source_pattern = apps/<app>/

<!-- SELPLAT 内部应用专项规则统一放入“应用规则”下的应用子目录；适用于 uniauth、cms、host 以及未来新增应用；业务含义是平台归属和应用边界可以同时从目录表达 -->
selplat_application_rule_path_pattern = apps/rule-engine/backend/src/main/resources/selplat/应用规则/<app>/

<!-- SELPLAT 规则禁止继续使用语义不明的 rule 目录；适用于规则新增、迁移和索引维护；业务含义是目录名称直接表达规则作用域 -->
selplat_ambiguous_rule_directory_is_forbidden = apps/rule-engine/backend/src/main/resources/selplat/rule/

<!-- apps 下应用不得在规则资源根创建同名顶层目录；适用于新增或迁移 SELPLAT 应用规则；业务含义是避免把平台内部应用误判成组织级或跨项目业务模块 -->
selplat_application_must_not_create_resource_root_peer = true

<!-- 新规则必须先查唯一索引和现有近义规则；适用于所有规则沉淀；业务含义是更新或合并已有模块而非重复堆叠 -->
new_rule_must_check_and_merge_existing_semantics = true

<!-- 规则变更必须同步唯一索引；适用于新增、移动、改名和删除；业务含义是任何有效规则始终拥有可调用入口 -->
rule_change_must_sync_rule_index = RULE_INDEX.md

<!-- 被完全替代或失去入口的规则必须删除并清理索引；适用于规则退役；业务含义是避免旧规则继续误导执行 -->
obsolete_rule_and_index_reference_must_be_removed = true
