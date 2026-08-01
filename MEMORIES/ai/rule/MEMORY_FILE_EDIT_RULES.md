# Memory File Edit Rules

## 说明

- 这是记忆库文件编辑场景的规则文件
- 本文件承接 `MEMORIES/` 目录内文本文件编辑时的读取与保真约束
- 本文件使用结构化规则写法，不重复声明启动层和协议层已声明约束

## 强制规则（Mandatory）

<!-- 编辑记忆库文件时必须使用完整读取能力 -->
edit_memory_file_must_use_full_reader = memory_file_full_reader

<!-- 规则文件必须使用 HTML 注释说明业务意图 并使用 DSL 行承载可执行规则 -->
rule_files_must_use_html_comments_plus_dsl_entries = true

<!-- HTML 注释必须说明规则要解决的问题 适用场景和业务含义 -->
html_comments_must_explain_rule_problem_scenario_and_business_meaning = true

<!-- DSL 行必须表达稳定可检索的规则动作或约束 不得只写自然语言段落 -->
dsl_entries_must_express_stable_searchable_rule_actions_or_constraints = true

<!-- 读取后要补充或修改记忆库文件时必须先走完整原文读取 -->
read_full_content_before_appending_or_modifying_memory_file = true

<!-- 编辑时必须保留原始注释、空行和人类文本 -->
preserve_original_comments_blank_lines_and_human_text_when_editing_memory_files = true

## 场景规则（Scenario Rules）

<!-- ai_memory_file_reader 仅用于协议和规则的机器清洗读取 -->
use_ai_memory_file_reader_only_for_protocol_rule_machine_reading = true

<!-- 向用户展示规则时禁止只给清洗后的单行结果而不补充注释语义 -->
forbid_presenting_cleaned_rule_line_without_comment_context = true

<!-- 向规则文件新增规则前 必须先检查当前文件和同主题规则文件中是否已有近义或可吸收规则 -->
check_existing_same_theme_rules_before_adding_new_rule = true

<!-- 若新规则可并入现有规则 应优先修改或收敛到现有规则 而不是并列追加近义规则 -->
prefer_merging_into_existing_rule_over_adding_near_duplicate_rule = true

## 禁止事项（Forbidden）

<!-- 禁止新增只有自然语言说明而没有 DSL 条目的规则 -->
forbid_rule_entries_with_natural_language_only_without_dsl = true

<!-- 禁止新增只有 DSL 而没有 HTML 注释解释业务意图的规则 -->
forbid_rule_entries_with_dsl_only_without_html_comment = true

<!-- 禁止在记忆库编辑场景使用清洗读取能力 -->
forbid_using_ai_memory_file_reader_for_memory_edit = true

<!-- 禁止在规则文件中追加仅措辞不同但语义重复的近义规则 -->
forbid_adding_near_duplicate_rule_entries_without_merge = true
