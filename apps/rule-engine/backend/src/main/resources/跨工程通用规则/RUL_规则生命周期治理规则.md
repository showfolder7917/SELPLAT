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

## 主规则与同名资产目录

<!-- 每个新规则的主规则文件必须直接位于所属范围根目录；适用于规则生成、新增和结构性维护；业务含义是 RULE_INDEX 可以用最短稳定路径直接加载权威规则正文。 -->
rule_main_file_pattern = <scope-root>/RUL_<主题>规则.md

<!-- 需要 README、模板、样例、说明或项目配置时，必须在主规则文件同级创建去掉 .md 后同名的资产目录；业务含义是规则正文保持直接可加载，关联资产仍可通过同名关系唯一定位。 -->
rule_asset_directory_pattern = <scope-root>/RUL_<主题>规则/

<!-- 主规则文件与同名资产目录必须并列，禁止把主规则文件放入资产目录；业务含义是规则入口与配套材料职责清晰，不再形成重复规则名嵌套路径。 -->
rule_main_file_and_asset_directory_relationship = sibling
rule_main_file_inside_asset_directory_is_forbidden = true

<!-- 规则说明、模板、样例和项目差异配置只能进入同名资产目录的标准子目录；业务含义是一个主题的完整配套材料保持共同生命周期。 -->
rule_asset_directory_standard_subdirectories = docs/,template/,examples/,project/

<!-- README 保存同名资产目录清单和主规则入口说明，但不得复制主规则正文；业务含义是人可以从资产目录快速了解组成，机器仍以并列主规则文件为唯一约束入口。 -->
rule_asset_readme_policy = manifest_and_sibling_main_rule_entry_only

<!-- RULE_INDEX 必须直接指向范围根目录下的主规则文件，不得指向同名资产目录内部；业务含义是索引只加载唯一权威规则正文。 -->
rule_index_must_reference_sibling_main_rule_file = true

<!-- 公共规则同名资产目录中的 project 只允许保存项目配置 Schema 或非权威示例；业务含义是公共规则可以定义扩展格式，但不能持有真实项目配置。 -->
shared_rule_asset_project_directory_scope = configuration_schema_or_non_authoritative_example_only

<!-- 真实项目主规则必须位于组织下对应项目规则根，项目差异资产进入其同级同名目录；业务含义是项目主规则同样直接可加载，公共范围不会随项目数量持续膨胀。 -->
authoritative_project_rule_path = <organization>/rule/<project>/RUL_<项目主题>规则.md
authoritative_project_rule_asset_path = <organization>/rule/<project>/RUL_<项目主题>规则/

<!-- 规则生成器必须默认创建范围根目录下的主规则文件、同级同名资产目录和其中的 README，并按调用方声明创建标准资产子目录；业务含义是生成结果天然满足并列结构而非事后人工搬运。 -->
rule_generator_default_output = sibling_main_rule_file + same_name_asset_directory + README
rule_generator_optional_asset_directories = docs,template,examples,project

<!-- 非法规则名、越出规则资源根、覆盖既有主规则或资产目录、写入非标准资产目录时必须阻断；业务含义是自动生成不能破坏现有规则或把关联文件再次散开。 -->
rule_generator_must_block = invalid_rule_name,path_escape,existing_main_or_asset_overwrite,nonstandard_asset_directory

<!-- 历史上把主规则放入同名目录的错误结构一旦被发现必须迁出为同级主规则文件，并同步索引和正文引用；业务含义是禁止继续复制旧嵌套结构。 -->
legacy_nested_main_rule_migration_policy = move_main_rule_to_scope_root_and_keep_asset_directory
