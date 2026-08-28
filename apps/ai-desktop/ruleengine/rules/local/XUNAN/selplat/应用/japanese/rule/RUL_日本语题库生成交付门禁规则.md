# 日本语题库生成交付门禁规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 1.28.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 本职责按真实 Japanese 调用方登记 Java、Python 与 Node 边界。 -->
java_ability_refs = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/n2bluebookquestion/service/impl/JapaneseN2BlueBookQuestionServiceImpl.java
python_ability_refs = none
node_ability_refs = apps/japanese/backend/src/main/resources/static/japanese/japanese.js

japanese_generation_test_isolation = fake_process_runner
<!-- japanese_generation_test_isolation.2 的当前独立事实为 no_real_deep_translator。 -->
japanese_generation_test_isolation.2 = no_real_deep_translator
<!-- japanese_generation_test_isolation.3 的当前独立事实为 no_real_codex。 -->
japanese_generation_test_isolation.3 = no_real_codex
<!-- japanese_generation_test_isolation.4 的当前独立事实为 no_real_edge_tts。 -->
japanese_generation_test_isolation.4 = no_real_edge_tts
<!-- japanese_generation_test_isolation.5 的当前独立事实为 no_real_ffmpeg。 -->
japanese_generation_test_isolation.5 = no_real_ffmpeg
<!-- 外部进程输入只允许通过受控参数列表传递，父进程不得保持空 stdin 管道。 -->
japanese_external_process_stdin = command_arguments_complete_before_start
<!-- japanese_external_process_stdin.2 的当前独立事实为 close_child_stdin_immediately。 -->
japanese_external_process_stdin.2 = close_child_stdin_immediately
<!-- japanese_external_process_stdin.3 的当前独立事实为 close_failure_destroy_forcibly。 -->
japanese_external_process_stdin.3 = close_failure_destroy_forcibly
<!-- japanese_external_process_stdin.4 的当前独立事实为 wait_only_after_eof。 -->
japanese_external_process_stdin.4 = wait_only_after_eof
<!-- japanese_external_process_stdin.5 的当前独立事实为 no_interactive_confirmation_pipe。 -->
japanese_external_process_stdin.5 = no_interactive_confirmation_pipe
<!-- 三种生成动作共享同一运行图标状态，完成和失败都必须恢复默认。 -->
japanese_generation_running_icon = is_running_only_active_button
<!-- japanese_generation_running_icon.2 的当前独立事实为 semantic_progress_color。 -->
japanese_generation_running_icon.2 = semantic_progress_color
<!-- japanese_generation_running_icon.3 的当前独立事实为 pulse_and_glow。 -->
japanese_generation_running_icon.3 = pulse_and_glow
<!-- japanese_generation_running_icon.4 的当前独立事实为 finally_direct_active_button_restore。 -->
japanese_generation_running_icon.4 = finally_direct_active_button_restore
<!-- japanese_generation_running_icon.5 的当前独立事实为 current_generation_view_sweep。 -->
japanese_generation_running_icon.5 = current_generation_view_sweep
<!-- japanese_generation_running_icon.6 的当前独立事实为 remove_aria_busy_and_running_class。 -->
japanese_generation_running_icon.6 = remove_aria_busy_and_running_class
<!-- japanese_generation_running_icon.7 的当前独立事实为 idle_label_and_style_restored。 -->
japanese_generation_running_icon.7 = idle_label_and_style_restored
<!-- japanese_generation_running_icon.8 的当前独立事实为 success_failure_same_cleanup。 -->
japanese_generation_running_icon.8 = success_failure_same_cleanup
<!-- 中文翻译只使用用户填写的朗读文本，不得将题干或答案作为备选输入。 -->
japanese_audio_text_translation = deep_translator_google
<!-- japanese_audio_text_translation.2 的当前独立事实为 audioText_only。 -->
japanese_audio_text_translation.2 = audioText_only
<!-- japanese_audio_text_translation.3 的当前独立事实为 audioText_required。 -->
japanese_audio_text_translation.3 = audioText_required
<!-- japanese_audio_text_translation.4 的当前独立事实为 no_questionText_fallback。 -->
japanese_audio_text_translation.4 = no_questionText_fallback
<!-- japanese_audio_text_translation.5 的当前独立事实为 no_question_type_options_or_correct_answer_or_user_data。 -->
japanese_audio_text_translation.5 = no_question_type_options_or_correct_answer_or_user_data
<!-- japanese_audio_text_translation.6 的当前独立事实为 simplified_chinese_translation_only。 -->
japanese_audio_text_translation.6 = simplified_chinese_translation_only
<!-- japanese_audio_text_translation.7 的当前独立事实为 no_title_original_analysis_or_example。 -->
japanese_audio_text_translation.7 = no_title_original_analysis_or_example
<!-- 交付必须覆盖 SQL、生成编排、媒体目录、SEL 控件资源与挂载、页面动作、真实启动、CRUD 和引用数据树。 -->
japanese_question_bank_delivery_gate = schema_test
<!-- japanese_question_bank_delivery_gate.2 的当前独立事实为 generation_orchestration_test。 -->
japanese_question_bank_delivery_gate.2 = generation_orchestration_test
<!-- japanese_question_bank_delivery_gate.3 的当前独立事实为 media_path_test。 -->
japanese_question_bank_delivery_gate.3 = media_path_test
<!-- japanese_question_bank_delivery_gate.4 的当前独立事实为 sel_theme_and_component_contract_test。 -->
japanese_question_bank_delivery_gate.4 = sel_theme_and_component_contract_test
<!-- japanese_question_bank_delivery_gate.5 的当前独立事实为 javascript_syntax。 -->
japanese_question_bank_delivery_gate.5 = javascript_syntax
<!-- japanese_question_bank_delivery_gate.6 的当前独立事实为 real_startup。 -->
japanese_question_bank_delivery_gate.6 = real_startup
<!-- japanese_question_bank_delivery_gate.7 的当前独立事实为 crud_http_check。 -->
japanese_question_bank_delivery_gate.7 = crud_http_check
<!-- japanese_question_bank_delivery_gate.8 的当前独立事实为 reference_data_tree_http_check。 -->
japanese_question_bank_delivery_gate.8 = reference_data_tree_http_check
<!-- japanese_question_bank_delivery_gate.9 的当前独立事实为 real_browser_visual_check。 -->
japanese_question_bank_delivery_gate.9 = real_browser_visual_check
