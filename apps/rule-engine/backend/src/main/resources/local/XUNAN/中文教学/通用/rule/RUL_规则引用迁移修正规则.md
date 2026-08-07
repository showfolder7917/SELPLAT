# 规则引用迁移修正

<!-- Java 当前没有独立修正程序，实际 Java 工具路径由本规则映射。 -->
java_ability_refs = none
<!-- Python 智慧整合能力负责验证旧引用和当前路径。 -->
python_ability_refs = ai_rule_package_integrator
<!-- Node 当前没有参与这些引用迁移修正。 -->
node_ability_refs = none
<!-- 当前修正规则从 1.0.0 开始记录版本。 -->
rule_version = 1.2.0
<!-- 规则所有者始终来自工程根 AGENTS.md 的当前稳定用户声明。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示当前用户覆盖已经通过加载测试。 -->
rule_status = active
<!-- 首次升级记录说明本规则处理的是迁移后旧路径。 -->
upgrade_record = 2026-08-03:为迁移后失效程序与模板路径建立用户层修正;2026-08-03:core表结构规则完成正式路径修复后移除冗余用户覆盖;2026-08-03:用户确认详细设计与XLS规则及能力整体退役;2026-08-07:所有者与用户资产路径改为动态当前用户语义

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

<!-- 拼音规则的原业务语义继续从 common 权威规则读取。 -->
CHINESE_PINYIN_CORRECTION_RULES.base_rule = local/common/中文教学/应用/拼音生成/rule/RUL_拼音标注与朗读版校正规则.md
<!-- 拼音 Java 程序已迁入 rule-engine 的语言原生 common 目录。 -->
CHINESE_PINYIN_CORRECTION_RULES.java_program_root = apps/rule-engine/backend/src/main/java/com/sp/selplat/local/code/common/中文教学/拼音生成/
<!-- PinyinDocxGenerationTool 是拼音规则的当前统一命令入口。 -->
CHINESE_PINYIN_CORRECTION_RULES.entry = PinyinDocxGenerationTool.java
<!-- 纠音词典由调用方显式提供，程序不再依赖仓库中的固定项目词典。 -->
CHINESE_PINYIN_CORRECTION_RULES.dictionary_policy = caller_supplied_utf8_tsv_via_dictionaryPath
<!-- 迁移前 shared/common-core 下的固定词典路径已经退役，命中时必须阻断使用。 -->
CHINESE_PINYIN_CORRECTION_RULES.retired_dictionary_paths_must_not_be_used = shared/backend/common-core/src/main/resources/pinyin/

<!-- 古诗底图规则的原业务语义继续从中文教学 common 规则读取。 -->
ANCIENT_POEM_BACKGROUND_RULES.base_rule = local/common/中文教学/应用/教学图片与PPT生成/rule/RUL_古诗无文字底图生成工作流程规则.md
<!-- 古诗底图验证程序已迁入 rule-engine 的 Python common 目录。 -->
ANCIENT_POEM_BACKGROUND_RULES.python_program = apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/common/中文教学/教学图片与PPT生成/古诗教学图片通用Pillow排版器.py


<!-- 每个替换目标必须先验证存在，禁止用另一个猜测路径覆盖旧路径。 -->
repair_must_verify_target_exists = true
<!-- 修正范围只限引用映射，禁止顺手改变原规则业务语义。 -->
repair_must_not_change_unrelated_rule_semantics = true
