# 日本语题库 AI 与媒体生成规则

<!-- 当前能力由 Japanese 后端 Service 实现，页面只调用稳定 HTTP 接口。 -->
java_ability_refs = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/n2bluebookquestion/service/JapaneseQuestionContentService.java,apps/japanese/backend/src/main/java/com/sp/selplat/japanese/n2bluebookquestion/service/impl/JapaneseQuestionContentServiceImpl.java,apps/japanese/backend/src/main/java/com/sp/selplat/japanese/media/JapaneseMediaStorage.java
<!-- 扫描题库导入由 Japanese 应用内的可重复 Python 导入器实现。 -->
python_ability_refs = apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/japanese_n2_red_blue_book_importer.py
<!-- 页面行为由 Japanese 独立 JavaScript 实现。 -->
node_ability_refs = apps/japanese/backend/src/main/resources/static/japanese/japanese.js
<!-- 本版增加扫描题库纠错、范围排除和写库前质量门槛。 -->
rule_version = 1.4.0
<!-- 规则所有者始终由 AGENTS.md 当前稳定用户动态解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示实现、索引和隔离进程测试已形成闭环。 -->
rule_status = active
<!-- 本规则来自用户对日语题库、直接生成和指定 edge-tts 环境的确认。 -->
upgrade_record = 2026-08-09:建立N2蓝宝书1000题题库_Codex图片解释_NanamiNeural语音_WebP和云存储预留规则;2026-08-09:修正Japanese页面未完整继承SEL主题运行时并手写树_表格_窗口_改用公共控件且保留紧凑字号;2026-08-09:增加扫描PDF题库的官方答案优先_OCR纠错_连续题号_排除范围_未决阻断和幂等导入门槛;2026-08-09:将未参与Japanese构建的Python导入器迁入当前用户rule-engine能力层并清理失败实验源码;2026-08-09:删除Japanese专用生成Request_全部复用CommonParam_CommonResult并接入全应用协议门禁

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
<!-- AI 与语音生成按钮不得弹二次确认，点击后直接执行并展示进度和结果。 -->
japanese_generation_confirmation_policy = direct_execution_without_second_confirmation

## 扫描题库导入

<!-- 扫描题库必须保留来源书名和原题号，原题号是核对、纠错和幂等写入的稳定标识。 -->
japanese_scanned_question_source_identity = sourceBook,sourceQuestionNo,unique_tenant_level_book_number
<!-- 导入范围必须显式声明包含和排除边界；本书基础题只允许 001 至 730，五套模拟题 731 至 1000 禁止进入本次数据集。 -->
japanese_n2_red_blue_book_import_range = include:001-730,exclude:731-1000
<!-- 正确答案以官方详解页答案栏为准，禁止由题意推测或由 OCR 多数票替代官方答案。 -->
japanese_scanned_question_answer_precedence = official_answer_bar_only,no_semantic_guess
<!-- OCR 结果必须至少经过纯日语版式识别、空字段检查和人工原图修正；已确认的修正必须固化到可重复导入器。 -->
japanese_scanned_question_correction_chain = japanese_layout_ocr,required_field_check,source_image_correction,reproducible_verified_corrections
<!-- 原始 OCR、纠正后数据、来源题页、详解页和校验状态必须可追溯，禁止只保留无法复核的最终文本。 -->
japanese_scanned_question_traceability = raw_ocr,corrected_dataset,source_question_page,source_explanation_page,validation_status
<!-- 任一题号缺失、重复、越界，或题干、四个选项、答案、解释为空时，整批写库必须阻断。 -->
japanese_scanned_question_blocking_gate = continuous_source_numbers,no_duplicates,no_excluded_numbers,question_and_four_options_and_answer_and_explanation_required
<!-- 写库必须调用应用数据接口并按来源书名与原题号幂等跳过已有数据，禁止重复插入。 -->
japanese_scanned_question_import_contract = application_http_api,idempotent_skip_existing,no_direct_database_bypass

## 本机生成链路

<!-- 解释和图片必须由程序调用本机 Codex CLI，默认使用桌面应用内置 CLI 且允许环境变量覆盖。 -->
japanese_codex_cli_boundary = local_codex_exec,configurable_executable,no_shell_command_concatenation
<!-- Codex 执行使用系统临时隔离目录，解释只读，图片只允许写临时工作区。 -->
japanese_codex_execution_scope = ephemeral_temp_directory,explanation_read_only,image_workspace_write
<!-- 语音默认且固定优先使用用户确认的 edge-tts 虚拟环境入口。 -->
japanese_edge_tts_default_executable = /Users/showfolder/Documents/workSpace/SELF/SELPLAT/OPTION/edge-tts-venv/bin/edge-tts
<!-- 日语语音音色固定为 NanamiNeural，输出格式为 MP3。 -->
japanese_audio_generation = voice:ja-JP-NanamiNeural,format:mp3
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

<!-- 自动化测试必须使用假的外部进程，禁止测试期间真实调用 Codex、edge-tts 或 FFmpeg。 -->
japanese_generation_test_isolation = fake_process_runner,no_real_codex,no_real_edge_tts,no_real_ffmpeg
<!-- 交付必须覆盖 SQL、生成编排、媒体目录、SEL 控件资源与挂载、页面动作、真实启动、CRUD 和引用数据树。 -->
japanese_question_bank_delivery_gate = schema_test,generation_orchestration_test,media_path_test,sel_theme_and_component_contract_test,javascript_syntax,real_startup,crud_http_check,reference_data_tree_http_check,real_browser_visual_check
