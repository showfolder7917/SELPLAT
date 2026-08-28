# 日本语题库 AI 与媒体生成规则

<!-- 当前能力由 Japanese 后端 Service 实现，页面只调用稳定 HTTP 接口。 -->
java_ability_refs = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/n2bluebookquestion/service/JapaneseN2BlueBookQuestionService.java
<!-- java_ability_refs.2 的当前独立事实为 apps/japanese/backend/src/main/java/com/sp/selplat/japanese/n2bluebookquestion/service/impl/JapaneseN2BlueBookQuestionServiceImpl.java。 -->
java_ability_refs.2 = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/n2bluebookquestion/service/impl/JapaneseN2BlueBookQuestionServiceImpl.java
<!-- java_ability_refs.3 的当前独立事实为 apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/translation/DeepTranslatorUtil.java。 -->
java_ability_refs.3 = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/translation/DeepTranslatorUtil.java
<!-- java_ability_refs.4 的当前独立事实为 apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/codex/CodexCliUtil.java。 -->
java_ability_refs.4 = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/codex/CodexCliUtil.java
<!-- java_ability_refs.5 的当前独立事实为 apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/speech/EdgeTtsSpeechUtil.java。 -->
java_ability_refs.5 = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/speech/EdgeTtsSpeechUtil.java
<!-- java_ability_refs.6 的当前独立事实为 apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/image/FfmpegImageUtil.java。 -->
java_ability_refs.6 = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/image/FfmpegImageUtil.java
<!-- java_ability_refs.7 的当前独立事实为 apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/media/JapaneseMediaStorage.java。 -->
java_ability_refs.7 = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/media/JapaneseMediaStorage.java
<!-- 扫描题库导入由 Japanese 应用内的可重复 Python 导入器实现。 -->
python_ability_refs = apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/japanese_n2_red_blue_book_importer.py
<!-- python_ability_refs.2 的当前独立事实为 apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/japanese_n2_ai_question_reviewer.py。 -->
python_ability_refs.2 = apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/japanese_n2_ai_question_reviewer.py
<!-- 页面行为由 Japanese 独立 JavaScript 实现。 -->
node_ability_refs = apps/japanese/backend/src/main/resources/static/japanese/japanese.js
<!-- 本版固定插件统一目录、免费翻译外发边界与朗读文本单一翻译输入。 -->
rule_version = 1.28.0
<!-- 规则所有者始终由 AGENTS.md 当前稳定用户动态解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示实现、索引和隔离进程测试已形成闭环。 -->
rule_status = active

<!-- 原逻辑 ID 保留为兼容聚合入口，并显式加载已拆分的职责规则。 -->
requires_rule_ids = JAPANESE_QUESTION_BANK_UI_AND_APPLICATION_RULES,JAPANESE_QUESTION_LEARNING_INTERACTION_RULES,JAPANESE_SCANNED_QUESTION_IMPORT_RULES,JAPANESE_AI_MEDIA_GENERATION_RULES,JAPANESE_GENERATION_DELIVERY_GATE_RULES
