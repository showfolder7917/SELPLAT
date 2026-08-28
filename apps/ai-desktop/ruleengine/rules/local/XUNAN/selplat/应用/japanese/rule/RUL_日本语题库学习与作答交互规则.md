# 日本语题库学习与作答交互规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 1.28.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 本职责按真实 Japanese 调用方登记 Java、Python 与 Node 边界。 -->
java_ability_refs = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/n2bluebookquestion/service/JapaneseN2BlueBookQuestionService.java
<!-- 本职责没有独立 Python 能力入口。 -->
python_ability_refs = none
<!-- 学习与作答交互由 Japanese 页面脚本承载。 -->
node_ability_refs = apps/japanese/backend/src/main/resources/static/japanese/japanese.js

<!-- 每轮作答必须分别保存轮次和题目记录，支持完整复盘。 -->
japanese_answer_history_storage = JapaneseN2QuestionAnswerRound
<!-- japanese_answer_history_storage.2 的当前独立事实为 JapaneseN2QuestionAnswerRecord。 -->
japanese_answer_history_storage.2 = JapaneseN2QuestionAnswerRecord
<!-- japanese_answer_history_storage.3 的当前独立事实为 roundId_to_round_id。 -->
japanese_answer_history_storage.3 = roundId_to_round_id
<!-- japanese_answer_history_storage.4 的当前独立事实为 questionId_to_question_id。 -->
japanese_answer_history_storage.4 = questionId_to_question_id
<!-- japanese_answer_history_storage.5 的当前独立事实为 repeated_round_question_records_allowed。 -->
japanese_answer_history_storage.5 = repeated_round_question_records_allowed
<!-- japanese_answer_history_storage.6 的当前独立事实为 one_record_per_click。 -->
japanese_answer_history_storage.6 = one_record_per_click
<!-- japanese_answer_history_storage.7 的当前独立事实为 per_table_sequence。 -->
japanese_answer_history_storage.7 = per_table_sequence
<!-- japanese_answer_history_storage.8 的当前独立事实为 no_question_table_progress_fields。 -->
japanese_answer_history_storage.8 = no_question_table_progress_fields
<!-- 页面只请求一次学习分页；后端通过三个业务 Service 分次查询并编排，禁止 JOIN、自写 SQL 和前端传 userId。 -->
japanese_learning_progress_query = one_frontend_page_request
<!-- japanese_learning_progress_query.2 的当前独立事实为 question_page_plus_current_round_plus_user_records。 -->
japanese_learning_progress_query.2 = question_page_plus_current_round_plus_user_records
<!-- japanese_learning_progress_query.3 的当前独立事实为 service_orchestration。 -->
japanese_learning_progress_query.3 = service_orchestration
<!-- japanese_learning_progress_query.4 的当前独立事实为 no_join。 -->
japanese_learning_progress_query.4 = no_join
<!-- japanese_learning_progress_query.5 的当前独立事实为 no_custom_sql。 -->
japanese_learning_progress_query.5 = no_custom_sql
<!-- japanese_learning_progress_query.6 的当前独立事实为 server_identity_only。 -->
japanese_learning_progress_query.6 = server_identity_only
<!-- 选项使用公共 Grid choice 单选；服务端判定和落库后 Toast 反馈，管理记录保留编辑字段但 Grid 默认不渲染正确答案。 -->
japanese_answer_interaction = selGrid_choice_A_B_C_D
<!-- japanese_answer_interaction.2 的当前独立事实为 visible_radio_every_option。 -->
japanese_answer_interaction.2 = visible_radio_every_option
<!-- japanese_answer_interaction.3 的当前独立事实为 repeated_attempt_per_click。 -->
japanese_answer_interaction.3 = repeated_attempt_per_click
<!-- japanese_answer_interaction.4 的当前独立事实为 backend_judgement。 -->
japanese_answer_interaction.4 = backend_judgement
<!-- japanese_answer_interaction.5 的当前独立事实为 one_record_per_click。 -->
japanese_answer_interaction.5 = one_record_per_click
<!-- japanese_answer_interaction.6 的当前独立事实为 persist_before_toast。 -->
japanese_answer_interaction.6 = persist_before_toast
<!-- japanese_answer_interaction.7 的当前独立事实为 selection_visual_resets_after_reload。 -->
japanese_answer_interaction.7 = selection_visual_resets_after_reload
<!-- japanese_answer_interaction.8 的当前独立事实为 management_record_keeps_correctOption_and_explanation。 -->
japanese_answer_interaction.8 = management_record_keeps_correctOption_and_explanation
<!-- japanese_answer_interaction.9 的当前独立事实为 correctOption_visible_false。 -->
japanese_answer_interaction.9 = correctOption_visible_false
<!-- 判题响应只修改当前行的单选、正确次数和错误次数，表头、分页与滚动容器保持原实例。 -->
japanese_answer_result_rendering = current_record_only
<!-- japanese_answer_result_rendering.2 的当前独立事实为 displaySelectedOption。 -->
japanese_answer_result_rendering.2 = displaySelectedOption
<!-- japanese_answer_result_rendering.3 的当前独立事实为 correctCount。 -->
japanese_answer_result_rendering.3 = correctCount
<!-- japanese_answer_result_rendering.4 的当前独立事实为 wrongCount。 -->
japanese_answer_result_rendering.4 = wrongCount
<!-- japanese_answer_result_rendering.5 的当前独立事实为 selGrid_updateRecord。 -->
japanese_answer_result_rendering.5 = selGrid_updateRecord
<!-- japanese_answer_result_rendering.6 的当前独立事实为 no_japaneseRefresh。 -->
japanese_answer_result_rendering.6 = no_japaneseRefresh
<!-- japanese_answer_result_rendering.7 的当前独立事实为 no_table_header_or_pagination_rebuild。 -->
japanese_answer_result_rendering.7 = no_table_header_or_pagination_rebuild
<!-- japanese_answer_result_rendering.8 的当前独立事实为 preserve_scroll_and_action_focus。 -->
japanese_answer_result_rendering.8 = preserve_scroll_and_action_focus
<!-- 语音播放属于行内动作，生成结果只合并当前记录，不允许刷新题目分页。 -->
japanese_audio_playback = current_record_only
<!-- japanese_audio_playback.2 的当前独立事实为 audioBusy_updateRecord。 -->
japanese_audio_playback.2 = audioBusy_updateRecord
<!-- japanese_audio_playback.3 的当前独立事实为 no_setLocale。 -->
japanese_audio_playback.3 = no_setLocale
<!-- japanese_audio_playback.4 的当前独立事实为 no_japaneseRefresh。 -->
japanese_audio_playback.4 = no_japaneseRefresh
<!-- japanese_audio_playback.5 的当前独立事实为 play_once_then_wait_500ms_then_play_once。 -->
japanese_audio_playback.5 = play_once_then_wait_500ms_then_play_once
<!-- japanese_audio_playback.6 的当前独立事实为 no_scroll_container_rebuild。 -->
japanese_audio_playback.6 = no_scroll_container_rebuild
<!-- 正确错误次数从用户逐题历史聚合；查看解释必须已作答，新轮次保留全部历史。 -->
japanese_answer_review = per_attempt_correct_and_wrong_counts
<!-- japanese_answer_review.2 的当前独立事实为 correct_lead_success_green。 -->
japanese_answer_review.2 = correct_lead_success_green
<!-- japanese_answer_review.3 的当前独立事实为 wrong_lead_or_nonzero_tie_danger_red。 -->
japanese_answer_review.3 = wrong_lead_or_nonzero_tie_danger_red
<!-- japanese_answer_review.4 的当前独立事实为 zero_zero_plain。 -->
japanese_answer_review.4 = zero_zero_plain
<!-- japanese_answer_review.5 的当前独立事实为 explanation_after_answer_only。 -->
japanese_answer_review.5 = explanation_after_answer_only
<!-- japanese_answer_review.6 的当前独立事实为 new_round_preserves_history。 -->
japanese_answer_review.6 = new_round_preserves_history
<!-- 新一轮创建必须位于确认结果之后，禁止按钮直接请求后台。 -->
japanese_next_round_confirmation = public_selConfirmDialog
<!-- japanese_next_round_confirmation.2 的当前独立事实为 cancel_keeps_current_round。 -->
japanese_next_round_confirmation.2 = cancel_keeps_current_round
<!-- japanese_next_round_confirmation.3 的当前独立事实为 no_backend_request_before_confirm。 -->
japanese_next_round_confirmation.3 = no_backend_request_before_confirm
<!-- japanese_next_round_confirmation.4 的当前独立事实为 confirm_then_next_round_request。 -->
japanese_next_round_confirmation.4 = confirm_then_next_round_request
<!-- japanese_next_round_confirmation.5 的当前独立事实为 refresh_after_success。 -->
japanese_next_round_confirmation.5 = refresh_after_success
<!-- japanese_next_round_confirmation.6 的当前独立事实为 preserve_history。 -->
japanese_next_round_confirmation.6 = preserve_history
<!-- 固定界面使用中日英三语资源和统一语言运行时；题目正文保持原始日文，切换语言不得清空搜索、分页、选中行或编辑表单。 -->
japanese_i18n_policy = zh-CN
<!-- japanese_i18n_policy.2 的当前独立事实为 ja-JP。 -->
japanese_i18n_policy.2 = ja-JP
<!-- japanese_i18n_policy.3 的当前独立事实为 en-US。 -->
japanese_i18n_policy.3 = en-US
<!-- japanese_i18n_policy.4 的当前独立事实为 selLocaleRuntime。 -->
japanese_i18n_policy.4 = selLocaleRuntime
<!-- japanese_i18n_policy.5 的当前独立事实为 question_content_unchanged。 -->
japanese_i18n_policy.5 = question_content_unchanged
<!-- japanese_i18n_policy.6 的当前独立事实为 preserve_search_page_selection_editor_state。 -->
japanese_i18n_policy.6 = preserve_search_page_selection_editor_state
<!-- AI 与语音生成按钮不得弹二次确认，点击后直接执行并展示进度和结果。 -->
japanese_generation_confirmation_policy = direct_execution_without_second_confirmation
<!-- 已有题目的追加解释即时保存；尚无主键的新题仍由标准新增动作统一建档。 -->
japanese_explanation_generation = immediate_button_busy_feedback
<!-- japanese_explanation_generation.2 的当前独立事实为 aria_busy。 -->
japanese_explanation_generation.2 = aria_busy
<!-- japanese_explanation_generation.3 的当前独立事实为 disable_generation_siblings。 -->
japanese_explanation_generation.3 = disable_generation_siblings
<!-- japanese_explanation_generation.4 的当前独立事实为 preserve_existing_explanation。 -->
japanese_explanation_generation.4 = preserve_existing_explanation
<!-- japanese_explanation_generation.5 的当前独立事实为 append_double_newline。 -->
japanese_explanation_generation.5 = append_double_newline
<!-- japanese_explanation_generation.6 的当前独立事实为 never_overwrite_manual_text。 -->
japanese_explanation_generation.6 = never_overwrite_manual_text
<!-- japanese_explanation_generation.7 的当前独立事实为 max_8000_guard。 -->
japanese_explanation_generation.7 = max_8000_guard
<!-- japanese_explanation_generation.8 的当前独立事实为 existing_question_update_immediately。 -->
japanese_explanation_generation.8 = existing_question_update_immediately
<!-- japanese_explanation_generation.9 的当前独立事实为 new_question_standard_save。 -->
japanese_explanation_generation.9 = new_question_standard_save
