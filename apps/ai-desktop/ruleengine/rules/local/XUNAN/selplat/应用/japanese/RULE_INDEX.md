# 当前用户 SELPLAT Japanese 应用规则索引

<!-- Japanese 题库的 AI 内容、语音和媒体存储规则由当前用户层优先加载。 -->
JAPANESE_QUESTION_BANK_AI_MEDIA_GENERATION_RULES = local/XUNAN/selplat/应用/japanese/rule/RUL_日本语题库AI媒体生成规则.md

<!-- 修改题型、编辑窗口、解释图片语音按钮或生成确认流程时加载。 -->
japanese_question_editor_or_generation_action_trigger = JAPANESE_QUESTION_BANK_AI_MEDIA_GENERATION_RULES
<!-- 修改 Codex CLI、edge-tts、NanamiNeural、FFmpeg 或媒体目录时加载。 -->
japanese_ai_tts_or_media_pipeline_trigger = JAPANESE_QUESTION_BANK_AI_MEDIA_GENERATION_RULES
<!-- 修改媒体数据库字段、本地存储或未来云存储实现时加载。 -->
japanese_media_storage_contract_trigger = JAPANESE_QUESTION_BANK_AI_MEDIA_GENERATION_RULES

<!-- 日本语题库页面、应用分层、公共控件和 HTTP 契约的独立职责规则。 -->
JAPANESE_QUESTION_BANK_UI_AND_APPLICATION_RULES = local/XUNAN/selplat/应用/japanese/rule/RUL_日本语题库界面与应用结构规则.md
<!-- 修改日本语题库页面、分层、查询编辑或公共控件时直接加载。 -->
load_rule_for_japanese_question_bank_ui_application_or_query_editor_change = JAPANESE_QUESTION_BANK_UI_AND_APPLICATION_RULES

<!-- 日本语题库轮次、作答、复习、播放和解释生成交互的独立职责规则。 -->
JAPANESE_QUESTION_LEARNING_INTERACTION_RULES = local/XUNAN/selplat/应用/japanese/rule/RUL_日本语题库学习与作答交互规则.md
<!-- 修改学习轮次、判题、复习、播放或解释交互时直接加载。 -->
load_rule_for_japanese_learning_round_answer_review_or_explanation_change = JAPANESE_QUESTION_LEARNING_INTERACTION_RULES

<!-- 扫描题源导入、官方答案优先、AI 审校和写库前阻断的独立职责规则。 -->
JAPANESE_SCANNED_QUESTION_IMPORT_RULES = local/XUNAN/selplat/应用/japanese/rule/RUL_日本语扫描题库导入与审校规则.md
<!-- 修改扫描题库导入范围、OCR 修正、AI 审校或追溯链时直接加载。 -->
load_rule_for_japanese_scanned_question_import_review_or_traceability_change = JAPANESE_SCANNED_QUESTION_IMPORT_RULES

<!-- Codex、翻译、edge-tts、图片和媒体存储执行链的独立职责规则。 -->
JAPANESE_AI_MEDIA_GENERATION_RULES = local/XUNAN/selplat/应用/japanese/rule/RUL_日本语题库AI媒体生成执行规则.md
<!-- 修改日本语题库 AI、翻译、语音、图片或媒体存储执行时直接加载。 -->
load_rule_for_japanese_ai_translation_tts_image_or_media_execution_change = JAPANESE_AI_MEDIA_GENERATION_RULES

<!-- 外部进程隔离、生成状态恢复和题库交付证据的独立职责规则。 -->
JAPANESE_GENERATION_DELIVERY_GATE_RULES = local/XUNAN/selplat/应用/japanese/rule/RUL_日本语题库生成交付门禁规则.md
<!-- 修改生成进程、运行状态、翻译边界或交付门禁时直接加载。 -->
load_rule_for_japanese_generation_process_state_or_delivery_gate_change = JAPANESE_GENERATION_DELIVERY_GATE_RULES
