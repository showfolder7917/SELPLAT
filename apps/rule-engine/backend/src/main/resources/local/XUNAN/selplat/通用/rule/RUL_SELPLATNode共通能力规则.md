# SELPLAT Node 共通能力规则

<!-- 本规则适用于 SELPLAT 跨应用 Node.js 与 TypeScript 公共运行能力。 -->
rule_scope = selplat/shared/node/common_core
<!-- Node 共通能力的权威说明统一从 docs 统一规范目录读取。 -->
canonical_document = docs/统一规范/Node共通能力规范.md
<!-- 规则所有者始终通过工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 1.1.0 增加锁文件专属依赖缓存路径能力，并完成 AI Desktop 首个真实接入。 -->
rule_version = 1.1.0
<!-- 当前规则已经登记到 XUNAN 的 SELPLAT 通用规则索引。 -->
rule_status = active

<!-- Node 公共运行能力只有一个正式源码根，禁止建立平行公共目录。 -->
node_common_source_root_contract = shared/node/common-core_only + no_shared_typescript_common_node_utils_or_parallel_root
<!-- 只有真实跨应用复用或平台基础设施能力才能进入公共层。 -->
node_common_promotion_contract = two_or_more_real_application_consumers_or_confirmed_platform_infrastructure + survives_single_application_removal + business_neutral + independently_testable + no_reverse_application_dependency
<!-- 应用只能通过公共包导出入口消费能力，禁止复制源码或引用内部文件。 -->
node_common_consumption_contract = package_name_@selplat/node-common-core + explicit_package_exports + application_package_dependency + no_source_copy + no_cross_directory_internal_import
<!-- 工程根、工程名和业务标识必须显式传入并完成安全校验。 -->
node_common_path_contract = explicit_selplat_root_and_application_name + safe_identifier_validation + prohibit_separator_parent_traversal_and_absolute_path + final_root_containment_check + resolver_has_no_write_delete_or_migration_side_effect
<!-- 锁文件缓存键和依赖根必须由公共生命周期能力计算，业务服务不得重复实现哈希目录语义。 -->
node_common_dependency_lifecycle_contract = raw_lockfile_content_to_sha256 + dependency_cache_root_parameter + deterministic_lock_specific_cache_and_node_modules_paths + no_filesystem_mutation_in_resolver
<!-- 公共包编译产物和缓存必须离开源码树并进入统一根。 -->
node_common_build_contract = build/shared/node/common-core + build/shared/node/common-core/reports + cache/shared/node/common-core + no_source_dist_build_coverage_or_tsbuildinfo
<!-- Electron 只能按白名单打包所需 Node 编译产物，禁止宽泛复制 shared。 -->
node_common_electron_packaging_contract = exact_compiled_runtime_allowlist + prohibit_shared_wildcard + prohibit_shared_backend_ruleengine_python_java_class_jar_gradle_py_pyc_pycache_tests_cache_and_temp
<!-- 安装包验证必须检查公共入口可加载及 Java、Python、Gradle 文件不存在。 -->
node_common_package_verification_contract = real_packaged_artifact_inspection + runtime_entry_loadable + no_java_class_jar_py_pyc_pycache_gradle_or_ruleengine_source + source_regex_is_not_sufficient
<!-- 公共包修改必须同步真实调用方、独立测试、应用集成和安装包门禁，并删除被替代副本。 -->
node_common_change_completion_contract = existing_capability_search + public_api_and_version_update + all_real_consumers_updated + independent_cross_platform_tests + application_build_and_integration + electron_package_inspection + remove_replaced_duplicates_without_compatibility_code
