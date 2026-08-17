# 日本语题库 AI 与媒体生成规则

<!-- 当前能力由 Japanese 后端 Service 实现，页面只调用稳定 HTTP 接口。 -->
java_ability_refs = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/n2bluebookquestion/service/JapaneseN2BlueBookQuestionService.java,apps/japanese/backend/src/main/java/com/sp/selplat/japanese/n2bluebookquestion/service/impl/JapaneseN2BlueBookQuestionServiceImpl.java,apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/translation/DeepTranslatorUtil.java,apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/codex/CodexCliUtil.java,apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/speech/EdgeTtsSpeechUtil.java,apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/image/FfmpegImageUtil.java,apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/media/JapaneseMediaStorage.java
<!-- 扫描题库导入由 Japanese 应用内的可重复 Python 导入器实现。 -->
python_ability_refs = apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/japanese_n2_red_blue_book_importer.py,apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/japanese_n2_ai_question_reviewer.py
<!-- 页面行为由 Japanese 独立 JavaScript 实现。 -->
node_ability_refs = apps/japanese/backend/src/main/resources/static/japanese/japanese.js
<!-- 本版固定插件统一目录、免费翻译外发边界与朗读文本单一翻译输入。 -->
rule_version = 1.28.0
<!-- 规则所有者始终由 AGENTS.md 当前稳定用户动态解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示实现、索引和隔离进程测试已形成闭环。 -->
rule_status = active
<!-- 本次升级把 N2 查询和共享保存位置修正为平台默认修复基线。 -->
upgrade_record_20260816_default_query = 题号与题干独立查询_后台分页AND_编辑态保存紧跟重置
<!-- 本次升级让列表隐藏正确答案与图片、显示四个选项，并统一为一个可生成保存后播放的语音按钮。 -->
upgrade_record_20260816_question_grid_audio = 隐藏正确答案和图片_显示ABCD选项_统一播放语音按钮_缺失时生成保存并自动播放
<!-- 本次升级把练习状态从题目主表拆出，并固定一次页面请求、后端多表 Service 编排的边界。 -->
upgrade_record_20260817_learning_progress = 独立轮次表与逐题作答表_服务端用户身份_列表恢复当前轮选择_累计正确错误_查看解释_新一轮保留历史
<!-- 轮次标签与新一轮按钮按一个稳定复合根登记，避免内部元素分裂保存。 -->
upgrade_record_20260817_toolbar_page_editor = 轮次业务动作ControlLayout登记_复合根整体拖动调宽_共享保存跟随工具条末项
<!-- 本次升级修复首次答案被重复复用的问题，并固定零次数不显示图标。 -->
upgrade_record_20260817_answer_attempt = 每次选项点击实时判题并新增明细_同轮同题允许多次作答_每个选项始终显示单选圆圈_非零正确错误次数显示语义图标_零次数纯数字
<!-- 正确领先才显示绿色图标；错误领先或非零打平均显示红色图标。 -->
upgrade_record_20260817_count_dominance_icon = 正确较大仅正确显示绿色图标_错误较大或非零相等仅错误显示红色图标_零比零不显示图标_数字始终保留
<!-- 新一轮是会结束当前轮的业务动作，取消确认时不得请求后台。 -->
upgrade_record_20260817_next_round_confirmation = 点击新一轮先打开公共selConfirmDialog_取消保持当前轮且零请求_确认后才调用next-round并刷新_历史记录保留
<!-- 解释生成不得覆盖人工修订，长耗时必须在按钮本体直接反馈。 -->
upgrade_record_20260817_explanation_append_feedback = 生成按钮立即显示aria_busy与正在生成_返回解释以双换行追加到原解释末尾_禁止覆盖人工内容_超过8000字阻断_已有题目立即持久化_新增题目标准保存
<!-- 生成期间编辑区可能更新节点引用，完成时必须同时恢复原点击按钮和当前生成区按钮。 -->
upgrade_record_20260817_generation_button_reset = finally直接恢复activeButton_同步扫描当前generationView_成功失败均移除aria_busy与is_running_恢复默认文案_更新静态资源版本
<!-- 题目解释生成改为朗读文本单一输入的简体中文翻译，禁止题干回退和选项上下文泄漏。 -->
upgrade_record_20260817_audio_text_translation = 只读取audioText_空值直接拒绝_禁止questionText回退_禁止选项与正确答案进入提示词_只输出简体中文译文
<!-- 免费语音和翻译环境统一归档到 OPTION/plugin，翻译只允许外发已确认的朗读文本。 -->
upgrade_record_20260817_free_plugin_directory_and_translation = OPTION_plugin统一父目录_edge-tts与deep-translator独立venv_后端受控进程调用_Google提供方_仅audioText外发_Codex仅保留图片生成
<!-- 本次升级纠正“隐藏等于不传”的错误实现，双击编辑必须直接取得当前记录的真实答案和解释。 -->
upgrade_record_20260817_management_hidden_fields = 管理列表保留correctOption与explanation_正确答案表头登记但visible_false_双击复用当前记录_禁止默认A覆盖真实答案_禁止二次详情请求
<!-- 本次升级消除单选判题后的滚动条跳动，选择和次数通过公共 Grid 单行 API 原位写回。 -->
upgrade_record_20260817_answer_in_place_update = 判题成功只更新当前题目_单选状态与正确错误次数原位写回_selGrid_updateRecord_禁止japaneseRefresh整表重绘_保持滚动与焦点
<!-- 语音按钮只更新当前行忙碌状态；完整播放两遍并在中间停顿半秒。 -->
upgrade_record_20260817_audio_repeat_in_place = 播放按钮禁止setLocale与japaneseRefresh_当前行updateRecord_完整播放第一遍_停顿500毫秒_从头播放第二遍_不重建滚动容器
<!-- Codex exec 等非交互进程收到完整参数后必须立即收到 stdin EOF，禁止等待不存在的追加输入。 -->
upgrade_record_20260817_external_process_stdin_eof = ProcessBuilder启动后立即关闭getOutputStream_关闭失败强制终止子进程_再进入超时等待_回归探针验证EOF
<!-- 生成按钮执行时图标使用进度语义色和脉冲，结束或失败后由 is-running 移除恢复默认。 -->
upgrade_record_20260817_generation_icon_running_tone = is_running图标使用semantic_progress_执行中脉冲与光晕_finally移除is_running_恢复默认图标表面
<!-- 本规则来自用户对日语题库、直接生成和指定 edge-tts 环境的确认。 -->
upgrade_record = 2026-08-09:建立N2蓝宝书1000题题库_Codex图片解释_NanamiNeural语音_WebP和云存储预留规则;2026-08-09:修正Japanese页面未完整继承SEL主题运行时并手写树_表格_窗口_改用公共控件且保留紧凑字号;2026-08-09:增加扫描PDF题库的官方答案优先_OCR纠错_连续题号_排除范围_未决阻断和幂等导入门槛;2026-08-09:将未参与Japanese构建的Python导入器迁入当前用户rule-engine能力层并清理失败实验源码;2026-08-09:删除Japanese专用生成Request_全部复用CommonParam_CommonResult并接入全应用协议门禁;2026-08-10:删除无调用方Japanese表Domain_继续使用CommonParam_Map_数据库元数据CRUD;2026-08-10:重组Japanese为技术层优先_层内按题库业务分目录_生成媒体和外部进程统一进入common;2026-08-10:纠正为Uniauth式数据库业务目录优先_题库表相关代码聚合_common仅保存跨题库能力;2026-08-10:删除未启用的ReferenceDataProvider和独立reference-data装配_题型树暂由页面固定配置提供;2026-08-10:清理common伪Service和碎片目录_业务生成编排回归题库Service_Codex_语音_图片_媒体_进程拆分为分类共通工具;2026-08-10:删除仅有一个调用方的JapaneseCrudSupport_默认字段_有效查询_稳定排序和更新时间回归N2业务Service;2026-08-10:合并仅服务N2题库的ContentService_一个业务只保留一个Service接口和实现_生成编排直接调用分类共通工具;2026-08-10:增加不查PDF的Codex全题语义审校_锁定官方答案字母_唯一选项_完整朗读拼接_应用API同步门禁;2026-08-16:按平台默认修复基线接入三语国际化_引用数据自动登记_Grid表头_题型树_查询元素与Window页面编辑_无配置回退

## 题库与页面

<!-- N2 蓝宝书1000题使用独立表，未来 N1 使用新的等级表，不混放物理表。 -->
japanese_question_bank_level_table_boundary = N2:JapaneseN2BlueBookQuestion,N1:separate_future_table
<!-- 题型稳定保留读音、汉字和语法三类。 -->
japanese_question_type_values = PRONUNCIATION,KANJI,GRAMMAR
<!-- 页面固定左侧题型树、右侧表格，双击行打开完整题目编辑窗口。 -->
japanese_question_page_layout = left_type_tree,right_question_grid,double_click_editor
<!-- 页面主题、明暗、背景、密度和文字设置必须由 SEL 主题管理器与个性化控件统一管理。 -->
japanese_question_theme_runtime = selThemeManager,selPageBackground,selPersonalization,all_registered_theme_packs
<!-- 左树右表、搜索、编辑和删除确认必须复用 SEL 公共组件，禁止 Japanese 页面维护第二套公共控件结构。 -->
japanese_question_required_sel_controls = selPanel,selTree,selSearch,selGrid,selWindow,selConfirmDialog
<!-- 默认使用 compact 密度保持用户确认的紧凑字号，应用 CSS 只维护页面舞台与 Codex/Voice 业务区。 -->
japanese_question_visual_density_and_css_boundary = compact,page_stage_and_generation_panel_only,no_public_component_internal_override
<!-- 编辑窗口必须允许选择正确答案，并在当前窗口直接发起三种生成操作。 -->
japanese_question_editor_actions = select_correct_option,generate_explanation,generate_image,generate_audio
<!-- 题库 CRUD 和内容生成 HTTP 入参与输出必须复用 shared 公共协议，禁止 Japanese 自建 Request、Response 或 Result。 -->
japanese_question_http_contract = CommonParam,CommonBatchParam,CommonPageParam,CommonResult,no_private_protocol_types
<!-- Japanese 题表不建立无调用方的镜像 Domain，CRUD 字段以数据库元数据为真实来源。 -->
japanese_question_table_domain_policy = no_domain_use_CommonParam_Map_database_metadata
<!-- Japanese 按数据库题库业务优先组织，题库生成编排属于唯一业务 Service；common 只保存配置、持久化支撑和分类共通工具。 -->
japanese_java_package_structure = n2bluebookquestion|n2questionanswerround|n2questionanswerrecord:controller|service|service/impl|dao,learning_progress_orchestration:n2questionanswerrecord_existing_service,common/config|persistence|util,no_business_directory_without_table,one_service_contract_per_table_business
<!-- 同一业务的 CRUD、解释、图片和语音必须由一个 Service 接口和一个实现承载，禁止为只有一个调用方的内容生成再建中间 Service。 -->
japanese_business_service_policy = one_business_one_service_contract_and_impl,no_single_consumer_content_service,service_calls_common_util_directly
<!-- common 禁止建立业务 Service 或笼统 generation、media、runtime 根目录；Codex、语音、图片、媒体和进程能力必须在 util 下分类。 -->
japanese_common_package_boundary = no_business_service,no_crud_root,no_generation_root,no_media_root,no_runtime_root,util/codex,util/speech,util/image,util/media,util/process
<!-- 只有一个业务表使用的查询排序、审计默认字段和更新时间逻辑必须留在该业务 Service，至少两个业务产生稳定复用后才允许抽取 common 支撑类。 -->
japanese_crud_abstraction_policy = single_business_keep_in_business_service,extract_only_after_multiple_real_consumers
<!-- Japanese 随模块发布 Reference Data 默认声明；Host 自动补齐页面、Grid、列、查询元素、题型树和 Window，独立启动时使用页面默认值。 -->
japanese_reference_data_policy = classpath_default_manifest,project_and_page_key_lookup,business_getGridColumn,configured_question_type_tree,individual_query_layout,window_geometry,standalone_default_fallback,no_private_provider
<!-- N2 查询固定按来源题号和题干两个真实字段独立提交，后台分页返回 totalCount；工具条输入、查询、重置和轮次复合动作逐项保存。 -->
japanese_question_query_and_editor_policy = sourceQuestionNo_exact,questionTextLike,BaseDao_AND,backend_paging,one_shared_submit,individual_toolbar_controls,nextRound_composite_root,shared_save_after_last_editable_toolbar_control
<!-- 管理列表记录保留正确答案供编辑，但业务 Grid 默认隐藏该已登记表头；图片状态仍不作为表头。 -->
japanese_question_grid_columns = sourceQuestionNo,questionTypeLabel,questionText,optionA,optionB,optionC,optionD,correctOption_hidden_by_default,correctCount,wrongCount,audioState,updatedAt,actions,no_imageState
<!-- 语音列始终只显示同一个播放按钮；没有媒体时先生成、写回当前题目媒体字段，再自动播放。 -->
japanese_question_grid_audio_action = one_play_button,existing_audio_play_directly,missing_audio_generate_then_persist_then_auto_play,no_separate_generate_action
<!-- 做题状态不得写回题目主表；轮次和逐题记录分别使用独立业务表、Service 与本表独立号段。 -->
japanese_answer_history_storage = JapaneseN2QuestionAnswerRound,JapaneseN2QuestionAnswerRecord,roundId_to_round_id,questionId_to_question_id,repeated_round_question_records_allowed,one_record_per_click,per_table_sequence,no_question_table_progress_fields
<!-- 页面只请求一次学习分页；后端通过三个业务 Service 分次查询并编排，禁止 JOIN、自写 SQL 和前端传 userId。 -->
japanese_learning_progress_query = one_frontend_page_request,question_page_plus_current_round_plus_user_records,service_orchestration,no_join,no_custom_sql,server_identity_only
<!-- 选项使用公共 Grid choice 单选；服务端判定和落库后 Toast 反馈，管理记录保留编辑字段但 Grid 默认不渲染正确答案。 -->
japanese_answer_interaction = selGrid_choice_A_B_C_D,visible_radio_every_option,repeated_attempt_per_click,backend_judgement,one_record_per_click,persist_before_toast,selection_visual_resets_after_reload,management_record_keeps_correctOption_and_explanation,correctOption_visible_false
<!-- 判题响应只修改当前行的单选、正确次数和错误次数，表头、分页与滚动容器保持原实例。 -->
japanese_answer_result_rendering = current_record_only,displaySelectedOption,correctCount,wrongCount,selGrid_updateRecord,no_japaneseRefresh,no_table_header_or_pagination_rebuild,preserve_scroll_and_action_focus
<!-- 语音播放属于行内动作，生成结果只合并当前记录，不允许刷新题目分页。 -->
japanese_audio_playback = current_record_only,audioBusy_updateRecord,no_setLocale,no_japaneseRefresh,play_once_then_wait_500ms_then_play_once,no_scroll_container_rebuild
<!-- 正确错误次数从用户逐题历史聚合；查看解释必须已作答，新轮次保留全部历史。 -->
japanese_answer_review = per_attempt_correct_and_wrong_counts,correct_lead_success_green,wrong_lead_or_nonzero_tie_danger_red,zero_zero_plain,explanation_after_answer_only,new_round_preserves_history
<!-- 新一轮创建必须位于确认结果之后，禁止按钮直接请求后台。 -->
japanese_next_round_confirmation = public_selConfirmDialog,cancel_keeps_current_round,no_backend_request_before_confirm,confirm_then_next_round_request,refresh_after_success,preserve_history
<!-- 固定界面使用中日英三语资源和统一语言运行时；题目正文保持原始日文，切换语言不得清空搜索、分页、选中行或编辑表单。 -->
japanese_i18n_policy = zh-CN,ja-JP,en-US,selLocaleRuntime,question_content_unchanged,preserve_search_page_selection_editor_state
<!-- AI 与语音生成按钮不得弹二次确认，点击后直接执行并展示进度和结果。 -->
japanese_generation_confirmation_policy = direct_execution_without_second_confirmation
<!-- 已有题目的追加解释即时保存；尚无主键的新题仍由标准新增动作统一建档。 -->
japanese_explanation_generation = immediate_button_busy_feedback,aria_busy,disable_generation_siblings,preserve_existing_explanation,append_double_newline,never_overwrite_manual_text,max_8000_guard,existing_question_update_immediately,new_question_standard_save

## 扫描题库导入

<!-- 扫描题库必须保留来源书名和原题号，原题号是核对、纠错和幂等写入的稳定标识。 -->
japanese_scanned_question_source_identity = sourceBook,sourceQuestionNo,unique_tenant_level_book_number
<!-- 导入范围必须显式声明包含和排除边界；本书基础题只允许 001 至 730，五套模拟题 731 至 1000 禁止进入本次数据集。 -->
japanese_n2_red_blue_book_import_range = include:001-730,exclude:731-1000
<!-- 正确答案以官方详解页答案栏为准，禁止由题意推测或由 OCR 多数票替代官方答案。 -->
japanese_scanned_question_answer_precedence = official_answer_bar_only,no_semantic_guess
<!-- 用户明确选择不再逐题核对 PDF 时，必须由本机 Codex 对全部题干、选项和解释执行结构化语义审校；官方答案字母保持锁定。 -->
japanese_scanned_question_ai_review_without_pdf = explicit_user_choice_only,local_codex_cli,all_records,locked_official_answer_letter,no_pdf_access
<!-- OCR 结果必须经过日语版式识别、全量 AI 语义审校、空字段和唯一选项检查；修正流程必须由可重复能力执行。 -->
japanese_scanned_question_correction_chain = japanese_layout_ocr,codex_semantic_review,required_field_check,distinct_options,reproducible_ai_review
<!-- 原始 OCR、纠正后数据、来源题页、详解页和校验状态必须可追溯，禁止只保留无法复核的最终文本。 -->
japanese_scanned_question_traceability = raw_ocr,corrected_dataset,source_question_page,source_explanation_page,validation_status
<!-- 任一题号缺失、重复、越界，或题干、四个选项、答案、解释为空时，整批写库必须阻断。 -->
japanese_scanned_question_blocking_gate = continuous_source_numbers,no_duplicates,no_excluded_numbers,question_and_four_distinct_options_and_answer_and_explanation_and_audio_required,no_placeholder_in_audio
<!-- 写库必须调用应用数据接口并按来源书名与原题号幂等跳过已有数据，禁止重复插入。 -->
japanese_scanned_question_import_contract = application_http_api,idempotent_skip_existing,no_direct_database_bypass
<!-- 已有题库批量纠错必须使用应用 update 接口按来源题号同步；禁止只改临时数据集或直接操作 H2。 -->
japanese_scanned_question_ai_sync_contract = application_update_api,source_question_number_mapping,create_missing_update_existing,no_direct_h2_write
<!-- 原始 OCR 数据集不得直接 import 或 sync，必须先具有730题完整 Codex 审校标记。 -->
japanese_scanned_question_database_write_prerequisite = codex_ai_review_applied,review_coverage_730,raw_ocr_dataset_blocked

## 本机生成链路

<!-- 图片必须由程序调用本机 Codex CLI，默认使用桌面应用内置 CLI 且允许环境变量覆盖。 -->
japanese_codex_cli_boundary = image_only,local_codex_exec,configurable_executable,no_shell_command_concatenation
<!-- Codex 图片执行使用系统临时隔离目录，只允许写临时工作区。 -->
japanese_codex_execution_scope = ephemeral_temp_directory,image_workspace_write
<!-- 免费语音与翻译插件统一归档到 OPTION/plugin，并以独立虚拟环境隔离依赖。 -->
japanese_free_plugin_root = OPTION/plugin,edge-tts-venv,deep-translator-venv,separate_dependencies
<!-- 语音默认且固定优先使用用户确认的 edge-tts 虚拟环境入口。 -->
japanese_edge_tts_default_executable = /Users/showfolder/Documents/workSpace/SELF/SELPLAT/OPTION/plugin/edge-tts-venv/bin/edge-tts
<!-- 翻译固定使用 deep-translator Google 提供方，只允许发送用户确认的朗读文本。 -->
japanese_deep_translator_default_executable = /Users/showfolder/Documents/workSpace/SELF/SELPLAT/OPTION/plugin/deep-translator-venv/bin/deep-translator
<!-- 外部翻译请求的数据边界只有 audioText，禁止携带题干、选项、答案和用户数据。 -->
japanese_translation_external_payload = provider:google,allowed:audioText,forbidden:questionText|options|correctOption|userData
<!-- 日语语音音色固定为 NanamiNeural，输出格式为 MP3。 -->
japanese_audio_generation = voice:ja-JP-NanamiNeural,format:mp3
<!-- 朗读文本必须把正确选项填入所有题干占位符；“やら／やら”等成对答案按顺序填入多个空格。 -->
japanese_audio_text_completion = locked_correct_option_fills_all_placeholders,paired_answer_segments_supported,no_parenthesis_placeholder_to_tts
<!-- 图片原图必须经 FFmpeg 压缩成 WebP，当前质量参数为 82。 -->
japanese_image_generation = codex_original,ffmpeg_webp,quality:82

## 存储与访问

<!-- 图片和语音分别写入 Japanese 静态资源目录，页面使用稳定根路径访问。 -->
japanese_local_media_paths = image:static/pic:/pic/,audio:static/audio:/audio/
<!-- 题表只保存提供方、对象键和访问 URL，禁止保存机器绝对路径。 -->
japanese_media_database_contract = storageProvider,storageKey,url,no_absolute_filesystem_path
<!-- 业务 Service 只依赖 JapaneseMediaStorage 接口，未来云存储通过替换实现接入。 -->
japanese_media_cloud_migration_boundary = JapaneseMediaStorage_interface,replaceable_provider_implementation

## 验证门槛

<!-- 自动化测试必须使用假的外部进程，禁止测试期间真实调用翻译、Codex、edge-tts 或 FFmpeg。 -->
japanese_generation_test_isolation = fake_process_runner,no_real_deep_translator,no_real_codex,no_real_edge_tts,no_real_ffmpeg
<!-- 外部进程输入只允许通过受控参数列表传递，父进程不得保持空 stdin 管道。 -->
japanese_external_process_stdin = command_arguments_complete_before_start,close_child_stdin_immediately,close_failure_destroy_forcibly,wait_only_after_eof,no_interactive_confirmation_pipe
<!-- 三种生成动作共享同一运行图标状态，完成和失败都必须恢复默认。 -->
japanese_generation_running_icon = is_running_only_active_button,semantic_progress_color,pulse_and_glow,finally_direct_active_button_restore,current_generation_view_sweep,remove_aria_busy_and_running_class,idle_label_and_style_restored,success_failure_same_cleanup
<!-- 中文翻译只使用用户填写的朗读文本，不得将题干或答案作为备选输入。 -->
japanese_audio_text_translation = deep_translator_google,audioText_only,audioText_required,no_questionText_fallback,no_question_type_options_or_correct_answer_or_user_data,simplified_chinese_translation_only,no_title_original_analysis_or_example
<!-- 交付必须覆盖 SQL、生成编排、媒体目录、SEL 控件资源与挂载、页面动作、真实启动、CRUD 和引用数据树。 -->
japanese_question_bank_delivery_gate = schema_test,generation_orchestration_test,media_path_test,sel_theme_and_component_contract_test,javascript_syntax,real_startup,crud_http_check,reference_data_tree_http_check,real_browser_visual_check
