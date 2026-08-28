# 日本语扫描题库导入与审校规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 1.28.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 本职责按真实 Japanese 调用方登记 Java、Python 与 Node 边界。 -->
java_ability_refs = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/n2bluebookquestion/service/impl/JapaneseN2BlueBookQuestionServiceImpl.java
python_ability_refs = apps/ai-desktop/ruleengine/python/local/<active-stable-user-id>/abilities/japanese_n2_red_blue_book_importer.py
node_ability_refs = none

japanese_scanned_question_source_identity = sourceBook
<!-- japanese_scanned_question_source_identity.2 的当前独立事实为 sourceQuestionNo。 -->
japanese_scanned_question_source_identity.2 = sourceQuestionNo
<!-- japanese_scanned_question_source_identity.3 的当前独立事实为 unique_tenant_level_book_number。 -->
japanese_scanned_question_source_identity.3 = unique_tenant_level_book_number
<!-- 导入范围必须显式声明包含和排除边界；本书基础题只允许 001 至 730，五套模拟题 731 至 1000 禁止进入本次数据集。 -->
japanese_n2_red_blue_book_import_range = include:001-730
<!-- japanese_n2_red_blue_book_import_range.2 的当前独立事实为 exclude:731-1000。 -->
japanese_n2_red_blue_book_import_range.2 = exclude:731-1000
<!-- 正确答案以官方详解页答案栏为准，禁止由题意推测或由 OCR 多数票替代官方答案。 -->
japanese_scanned_question_answer_precedence = official_answer_bar_only
<!-- japanese_scanned_question_answer_precedence.2 的当前独立事实为 no_semantic_guess。 -->
japanese_scanned_question_answer_precedence.2 = no_semantic_guess
<!-- 用户明确选择不再逐题核对 PDF 时，必须由本机 Codex 对全部题干、选项和解释执行结构化语义审校；官方答案字母保持锁定。 -->
japanese_scanned_question_ai_review_without_pdf = explicit_user_choice_only
<!-- japanese_scanned_question_ai_review_without_pdf.2 的当前独立事实为 local_codex_cli。 -->
japanese_scanned_question_ai_review_without_pdf.2 = local_codex_cli
<!-- japanese_scanned_question_ai_review_without_pdf.3 的当前独立事实为 all_records。 -->
japanese_scanned_question_ai_review_without_pdf.3 = all_records
<!-- japanese_scanned_question_ai_review_without_pdf.4 的当前独立事实为 locked_official_answer_letter。 -->
japanese_scanned_question_ai_review_without_pdf.4 = locked_official_answer_letter
<!-- japanese_scanned_question_ai_review_without_pdf.5 的当前独立事实为 no_pdf_access。 -->
japanese_scanned_question_ai_review_without_pdf.5 = no_pdf_access
<!-- OCR 结果必须经过日语版式识别、全量 AI 语义审校、空字段和唯一选项检查；修正流程必须由可重复能力执行。 -->
japanese_scanned_question_correction_chain = japanese_layout_ocr
<!-- japanese_scanned_question_correction_chain.2 的当前独立事实为 codex_semantic_review。 -->
japanese_scanned_question_correction_chain.2 = codex_semantic_review
<!-- japanese_scanned_question_correction_chain.3 的当前独立事实为 required_field_check。 -->
japanese_scanned_question_correction_chain.3 = required_field_check
<!-- japanese_scanned_question_correction_chain.4 的当前独立事实为 distinct_options。 -->
japanese_scanned_question_correction_chain.4 = distinct_options
<!-- japanese_scanned_question_correction_chain.5 的当前独立事实为 reproducible_ai_review。 -->
japanese_scanned_question_correction_chain.5 = reproducible_ai_review
<!-- 原始 OCR、纠正后数据、来源题页、详解页和校验状态必须可追溯，禁止只保留无法复核的最终文本。 -->
japanese_scanned_question_traceability = raw_ocr
<!-- japanese_scanned_question_traceability.2 的当前独立事实为 corrected_dataset。 -->
japanese_scanned_question_traceability.2 = corrected_dataset
<!-- japanese_scanned_question_traceability.3 的当前独立事实为 source_question_page。 -->
japanese_scanned_question_traceability.3 = source_question_page
<!-- japanese_scanned_question_traceability.4 的当前独立事实为 source_explanation_page。 -->
japanese_scanned_question_traceability.4 = source_explanation_page
<!-- japanese_scanned_question_traceability.5 的当前独立事实为 validation_status。 -->
japanese_scanned_question_traceability.5 = validation_status
<!-- 任一题号缺失、重复、越界，或题干、四个选项、答案、解释为空时，整批写库必须阻断。 -->
japanese_scanned_question_blocking_gate = continuous_source_numbers
<!-- japanese_scanned_question_blocking_gate.2 的当前独立事实为 no_duplicates。 -->
japanese_scanned_question_blocking_gate.2 = no_duplicates
<!-- japanese_scanned_question_blocking_gate.3 的当前独立事实为 no_excluded_numbers。 -->
japanese_scanned_question_blocking_gate.3 = no_excluded_numbers
<!-- japanese_scanned_question_blocking_gate.4 的当前独立事实为 question_and_four_distinct_options_and_answer_and_explanation_and_audio_required。 -->
japanese_scanned_question_blocking_gate.4 = question_and_four_distinct_options_and_answer_and_explanation_and_audio_required
<!-- japanese_scanned_question_blocking_gate.5 的当前独立事实为 no_placeholder_in_audio。 -->
japanese_scanned_question_blocking_gate.5 = no_placeholder_in_audio
<!-- 写库必须调用应用数据接口并按来源书名与原题号幂等跳过已有数据，禁止重复插入。 -->
japanese_scanned_question_import_contract = application_http_api
<!-- japanese_scanned_question_import_contract.2 的当前独立事实为 idempotent_skip_existing。 -->
japanese_scanned_question_import_contract.2 = idempotent_skip_existing
<!-- japanese_scanned_question_import_contract.3 的当前独立事实为 no_direct_database_bypass。 -->
japanese_scanned_question_import_contract.3 = no_direct_database_bypass
<!-- 已有题库批量纠错必须使用应用 update 接口按来源题号同步；禁止只改临时数据集或直接操作 H2。 -->
japanese_scanned_question_ai_sync_contract = application_update_api
<!-- japanese_scanned_question_ai_sync_contract.2 的当前独立事实为 source_question_number_mapping。 -->
japanese_scanned_question_ai_sync_contract.2 = source_question_number_mapping
<!-- japanese_scanned_question_ai_sync_contract.3 的当前独立事实为 create_missing_update_existing。 -->
japanese_scanned_question_ai_sync_contract.3 = create_missing_update_existing
<!-- japanese_scanned_question_ai_sync_contract.4 的当前独立事实为 no_direct_h2_write。 -->
japanese_scanned_question_ai_sync_contract.4 = no_direct_h2_write
<!-- 原始 OCR 数据集不得直接 import 或 sync，必须先具有730题完整 Codex 审校标记。 -->
japanese_scanned_question_database_write_prerequisite = codex_ai_review_applied
<!-- japanese_scanned_question_database_write_prerequisite.2 的当前独立事实为 review_coverage_730。 -->
japanese_scanned_question_database_write_prerequisite.2 = review_coverage_730
<!-- japanese_scanned_question_database_write_prerequisite.3 的当前独立事实为 raw_ocr_dataset_blocked。 -->
japanese_scanned_question_database_write_prerequisite.3 = raw_ocr_dataset_blocked
