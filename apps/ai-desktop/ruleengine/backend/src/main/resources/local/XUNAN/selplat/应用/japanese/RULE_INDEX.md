# 当前用户 SELPLAT Japanese 应用规则索引

<!-- Japanese 题库的 AI 内容、语音和媒体存储规则由当前用户层优先加载。 -->
JAPANESE_QUESTION_BANK_AI_MEDIA_GENERATION_RULES = local/XUNAN/selplat/应用/japanese/rule/RUL_日本语题库AI媒体生成规则.md

<!-- 修改题型、编辑窗口、解释图片语音按钮或生成确认流程时加载。 -->
japanese_question_editor_or_generation_action_trigger = JAPANESE_QUESTION_BANK_AI_MEDIA_GENERATION_RULES
<!-- 修改 Codex CLI、edge-tts、NanamiNeural、FFmpeg 或媒体目录时加载。 -->
japanese_ai_tts_or_media_pipeline_trigger = JAPANESE_QUESTION_BANK_AI_MEDIA_GENERATION_RULES
<!-- 修改媒体数据库字段、本地存储或未来云存储实现时加载。 -->
japanese_media_storage_contract_trigger = JAPANESE_QUESTION_BANK_AI_MEDIA_GENERATION_RULES
