# 规则生命周期治理

<!-- 规则正文统一由 rule-engine 的标准 resources/rule 承载；适用于规则新增、更新、移动与删除；业务含义是规则资源由 Gradle 自动识别并与运行工具组成独立单元 -->
rule_module_root = apps/rule-engine/backend/src/main/resources/rule

<!-- 跨工程通用规则直接放在 rule 根目录；适用于不依赖组织或工程语义的稳定规则；业务含义是避免通用规则被某个应用私有化 -->
cross_project_rules_must_live_in_rule_root = apps/rule-engine/backend/src/main/resources/rule/

<!-- 组织共同规则放入组织目录；适用于 Fujitsu 等跨项目共用约束；业务含义是组织规则可以共享但不提升为全平台规则 -->
organization_scoped_rules_must_live_under_organization_subdirectory = apps/rule-engine/backend/src/main/resources/rule/<organization>/

<!-- 单一项目规则放入组织和项目子目录；适用于只服务一个交付项目的约束；业务含义是保持项目边界清晰 -->
project_specific_rules_must_live_under_applicable_organization_and_project = apps/rule-engine/backend/src/main/resources/rule/<organization>/<applicable_project>/

<!-- SELPLAT 自身规则保留独立目录；适用于平台工程内部构建、路径和治理约束；业务含义是不得让其他工程误用 SELPLAT 专属规则 -->
selplat_project_rules_must_live_under = apps/rule-engine/backend/src/main/resources/rule/SELPLAT/

<!-- 新规则必须先查唯一索引和现有近义规则；适用于所有规则沉淀；业务含义是更新或合并已有模块而非重复堆叠 -->
new_rule_must_check_and_merge_existing_semantics = true

<!-- 规则变更必须同步唯一索引；适用于新增、移动、改名和删除；业务含义是任何有效规则始终拥有可调用入口 -->
rule_change_must_sync_rule_index = MEMORIES/ai/protocol/RULE_INDEX.md

<!-- 被完全替代或失去入口的规则必须删除并清理索引；适用于规则退役；业务含义是避免旧规则继续误导执行 -->
obsolete_rule_and_index_reference_must_be_removed = true
