# 规则引用迁移修正

<!-- 当前中文教学修正程序统一使用 Python，旧语言路径不得继续登记。 -->
java_ability_refs = none
<!-- Python 智慧整合能力负责验证旧引用和当前路径。 -->
python_ability_refs = ai_rule_package_integrator
<!-- Node 当前没有参与这些引用迁移修正。 -->
node_ability_refs = none
<!-- 当前修正规则升级到 1.3.0，失效的旧实体路径已经替换为当前权威规则入口。 -->
rule_version = 1.3.0
<!-- 规则所有者始终来自工程根 AGENTS.md 的当前稳定用户声明。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示当前用户覆盖已经通过加载测试。 -->
rule_status = active
<!-- 当前版本只保留已验证存在的权威规则路径，禁止迁移包装继续指向已经删除的旧实体。 -->
current_version_change_summary = replace_two_stale_base_rule_paths_with_current_authority

<!-- 问题：规则分层迁移已经完成，但少量规则正文仍引用迁移前路径。 -->
<!-- 场景：当前稳定用户命中下列逻辑 ID 时，必须读取原权威规则语义并使用本文件登记的当前程序或模板路径。 -->
<!-- 业务含义：不修改冻结 core、不自动覆盖 common，也不会因为路径陈旧而删除仍有效的业务规则。 -->

<!-- 用户覆盖只替换登记的失效引用，原规则其他业务语义继续生效。 -->
override_mode = load_original_rule_semantics_then_replace_only_registered_stale_references
<!-- common 对应变更只输出补丁并等待人工审查。 -->
common_merge_target = human_review_patch
<!-- 本规则不生成结构化成品，所以模板不适用并显式说明原因。 -->
template_applicability = not_applicable:本规则只修正引用映射不生成结构化成品
<!-- 正确处理过程复用 AI 智慧整合规则包中的迁移修正案例。 -->
example_path = local/<active-stable-user-id>/selplat/应用/rule-engine/template/RUL_AI规则包智慧整合规则/examples/AI规则整合案例.md
<!-- 失效路径扫描和修正后验证统一使用已登记的智慧整合能力。 -->
verification_program = ai_rule_package_integrator

<!-- 拼音修正逻辑 ID 的当前权威正文就是本迁移收敛规则，禁止再追踪已删除的旧应用规则文件。 -->
CHINESE_PINYIN_CORRECTION_RULES.current_authority_rule = local/XUNAN/中文教学/通用/rule/RUL_规则引用迁移修正规则.md
<!-- 拼音能力已收敛到 rule-engine 当前用户 Python abilities。 -->
CHINESE_PINYIN_CORRECTION_RULES.python_program = apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/pinyin_docx_tools.py
<!-- pinyin_docx_tools.py 是拼音规则的当前统一命令入口。 -->
CHINESE_PINYIN_CORRECTION_RULES.entry = pinyin_docx_tools.py
<!-- 纠音词典由调用方显式提供，程序不再依赖仓库中的固定项目词典。 -->
CHINESE_PINYIN_CORRECTION_RULES.dictionary_policy = caller_supplied_utf8_tsv_via_dictionaryPath
<!-- 迁移前 shared/common-core 下的固定词典路径已经退役，命中时必须阻断使用。 -->
CHINESE_PINYIN_CORRECTION_RULES.retired_dictionary_paths_must_not_be_used = shared/backend/common-core/src/main/resources/pinyin/

<!-- 古诗底图逻辑 ID 的当前权威正文就是本迁移收敛规则，禁止再追踪已删除的旧应用规则文件。 -->
ANCIENT_POEM_BACKGROUND_RULES.current_authority_rule = local/XUNAN/中文教学/通用/rule/RUL_规则引用迁移修正规则.md
<!-- 古诗教学图解析、渲染和清单能力统一进入当前用户 abilities。 -->
ANCIENT_POEM_BACKGROUND_RULES.python_program = apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/teaching_image_tools.py


<!-- 每个替换目标必须先验证存在，禁止用另一个猜测路径覆盖旧路径。 -->
repair_must_verify_target_exists = true
<!-- 修正范围只限引用映射，禁止顺手改变原规则业务语义。 -->
repair_must_not_change_unrelated_rule_semantics = true
