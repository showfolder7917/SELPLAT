# 日本语题库界面与应用结构规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 1.28.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 本职责按真实 Japanese 调用方登记 Java、Python 与 Node 边界。 -->
java_ability_refs = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/n2bluebookquestion/service/JapaneseN2BlueBookQuestionService.java
python_ability_refs = none
node_ability_refs = apps/japanese/backend/src/main/resources/static/japanese/japanese.js

japanese_question_bank_level_table_boundary = N2:JapaneseN2BlueBookQuestion
<!-- japanese_question_bank_level_table_boundary.2 的当前独立事实为 N1:separate_future_table。 -->
japanese_question_bank_level_table_boundary.2 = N1:separate_future_table
<!-- 题型稳定保留读音、汉字和语法三类。 -->
japanese_question_type_values = PRONUNCIATION
<!-- japanese_question_type_values.2 的当前独立事实为 KANJI。 -->
japanese_question_type_values.2 = KANJI
<!-- japanese_question_type_values.3 的当前独立事实为 GRAMMAR。 -->
japanese_question_type_values.3 = GRAMMAR
<!-- 页面固定左侧题型树、右侧表格，双击行打开完整题目编辑窗口。 -->
japanese_question_page_layout = left_type_tree
<!-- japanese_question_page_layout.2 的当前独立事实为 right_question_grid。 -->
japanese_question_page_layout.2 = right_question_grid
<!-- japanese_question_page_layout.3 的当前独立事实为 double_click_editor。 -->
japanese_question_page_layout.3 = double_click_editor
<!-- 页面主题、明暗、背景、密度和文字设置必须由 SEL 主题管理器与个性化控件统一管理。 -->
japanese_question_theme_runtime = selThemeManager
<!-- japanese_question_theme_runtime.2 的当前独立事实为 selPageBackground。 -->
japanese_question_theme_runtime.2 = selPageBackground
<!-- japanese_question_theme_runtime.3 的当前独立事实为 selPersonalization。 -->
japanese_question_theme_runtime.3 = selPersonalization
<!-- japanese_question_theme_runtime.4 的当前独立事实为 all_registered_theme_packs。 -->
japanese_question_theme_runtime.4 = all_registered_theme_packs
<!-- 左树右表、搜索、编辑和删除确认必须复用 SEL 公共组件，禁止 Japanese 页面维护第二套公共控件结构。 -->
japanese_question_required_sel_controls = selPanel
<!-- japanese_question_required_sel_controls.2 的当前独立事实为 selTree。 -->
japanese_question_required_sel_controls.2 = selTree
<!-- japanese_question_required_sel_controls.3 的当前独立事实为 selSearch。 -->
japanese_question_required_sel_controls.3 = selSearch
<!-- japanese_question_required_sel_controls.4 的当前独立事实为 selGrid。 -->
japanese_question_required_sel_controls.4 = selGrid
<!-- japanese_question_required_sel_controls.5 的当前独立事实为 selWindow。 -->
japanese_question_required_sel_controls.5 = selWindow
<!-- japanese_question_required_sel_controls.6 的当前独立事实为 selConfirmDialog。 -->
japanese_question_required_sel_controls.6 = selConfirmDialog
<!-- 默认使用 compact 密度保持用户确认的紧凑字号，应用 CSS 只维护页面舞台与 Codex/Voice 业务区。 -->
japanese_question_visual_density_and_css_boundary = compact
<!-- japanese_question_visual_density_and_css_boundary.2 的当前独立事实为 page_stage_and_generation_panel_only。 -->
japanese_question_visual_density_and_css_boundary.2 = page_stage_and_generation_panel_only
<!-- japanese_question_visual_density_and_css_boundary.3 的当前独立事实为 no_public_component_internal_override。 -->
japanese_question_visual_density_and_css_boundary.3 = no_public_component_internal_override
<!-- 编辑窗口必须允许选择正确答案，并在当前窗口直接发起三种生成操作。 -->
japanese_question_editor_actions = select_correct_option
<!-- japanese_question_editor_actions.2 的当前独立事实为 generate_explanation。 -->
japanese_question_editor_actions.2 = generate_explanation
<!-- japanese_question_editor_actions.3 的当前独立事实为 generate_image。 -->
japanese_question_editor_actions.3 = generate_image
<!-- japanese_question_editor_actions.4 的当前独立事实为 generate_audio。 -->
japanese_question_editor_actions.4 = generate_audio
<!-- 题库 CRUD 和内容生成 HTTP 入参与输出必须复用 shared 公共协议，禁止 Japanese 自建 Request、Response 或 Result。 -->
japanese_question_http_contract = CommonParam
<!-- japanese_question_http_contract.2 的当前独立事实为 CommonBatchParam。 -->
japanese_question_http_contract.2 = CommonBatchParam
<!-- japanese_question_http_contract.3 的当前独立事实为 CommonPageParam。 -->
japanese_question_http_contract.3 = CommonPageParam
<!-- japanese_question_http_contract.4 的当前独立事实为 CommonResult。 -->
japanese_question_http_contract.4 = CommonResult
<!-- japanese_question_http_contract.5 的当前独立事实为 no_private_protocol_types。 -->
japanese_question_http_contract.5 = no_private_protocol_types
<!-- Japanese 题表不建立无调用方的镜像 Domain，CRUD 字段以数据库元数据为真实来源。 -->
japanese_question_table_domain_policy = no_domain_use_CommonParam_Map_database_metadata
<!-- Japanese 按数据库题库业务优先组织，题库生成编排属于唯一业务 Service；common 只保存配置、持久化支撑和分类共通工具。 -->
japanese_java_package_structure = n2bluebookquestion|n2questionanswerround|n2questionanswerrecord:controller|service|service/impl|dao
<!-- japanese_java_package_structure.2 的当前独立事实为 learning_progress_orchestration:n2questionanswerrecord_existing_service。 -->
japanese_java_package_structure.2 = learning_progress_orchestration:n2questionanswerrecord_existing_service
<!-- japanese_java_package_structure.3 的当前独立事实为 common/config|persistence|util。 -->
japanese_java_package_structure.3 = common/config|persistence|util
<!-- japanese_java_package_structure.4 的当前独立事实为 no_business_directory_without_table。 -->
japanese_java_package_structure.4 = no_business_directory_without_table
<!-- japanese_java_package_structure.5 的当前独立事实为 one_service_contract_per_table_business。 -->
japanese_java_package_structure.5 = one_service_contract_per_table_business
<!-- 同一业务的 CRUD、解释、图片和语音必须由一个 Service 接口和一个实现承载，禁止为只有一个调用方的内容生成再建中间 Service。 -->
japanese_business_service_policy = one_business_one_service_contract_and_impl
<!-- japanese_business_service_policy.2 的当前独立事实为 no_single_consumer_content_service。 -->
japanese_business_service_policy.2 = no_single_consumer_content_service
<!-- japanese_business_service_policy.3 的当前独立事实为 service_calls_common_util_directly。 -->
japanese_business_service_policy.3 = service_calls_common_util_directly
<!-- common 禁止建立业务 Service 或笼统 generation、media、runtime 根目录；Codex、语音、图片、媒体和进程能力必须在 util 下分类。 -->
japanese_common_package_boundary = no_business_service
<!-- japanese_common_package_boundary.2 的当前独立事实为 no_crud_root。 -->
japanese_common_package_boundary.2 = no_crud_root
<!-- japanese_common_package_boundary.3 的当前独立事实为 no_generation_root。 -->
japanese_common_package_boundary.3 = no_generation_root
<!-- japanese_common_package_boundary.4 的当前独立事实为 no_media_root。 -->
japanese_common_package_boundary.4 = no_media_root
<!-- japanese_common_package_boundary.5 的当前独立事实为 no_runtime_root。 -->
japanese_common_package_boundary.5 = no_runtime_root
<!-- japanese_common_package_boundary.6 的当前独立事实为 util/codex。 -->
japanese_common_package_boundary.6 = util/codex
<!-- japanese_common_package_boundary.7 的当前独立事实为 util/speech。 -->
japanese_common_package_boundary.7 = util/speech
<!-- japanese_common_package_boundary.8 的当前独立事实为 util/image。 -->
japanese_common_package_boundary.8 = util/image
<!-- japanese_common_package_boundary.9 的当前独立事实为 util/media。 -->
japanese_common_package_boundary.9 = util/media
<!-- japanese_common_package_boundary.10 的当前独立事实为 util/process。 -->
japanese_common_package_boundary.10 = util/process
<!-- 只有一个业务表使用的查询排序、审计默认字段和更新时间逻辑必须留在该业务 Service，至少两个业务产生稳定复用后才允许抽取 common 支撑类。 -->
japanese_crud_abstraction_policy = single_business_keep_in_business_service
<!-- japanese_crud_abstraction_policy.2 的当前独立事实为 extract_only_after_multiple_real_consumers。 -->
japanese_crud_abstraction_policy.2 = extract_only_after_multiple_real_consumers
<!-- Japanese 随模块发布 Reference Data 默认声明；Host 自动补齐页面、Grid、列、查询元素、题型树和 Window，声明尚未登记时使用页面默认值。 -->
japanese_reference_data_policy = classpath_default_manifest
<!-- japanese_reference_data_policy.2 的当前独立事实为 project_and_page_key_lookup。 -->
japanese_reference_data_policy.2 = project_and_page_key_lookup
<!-- japanese_reference_data_policy.3 的当前独立事实为 business_getGridColumn。 -->
japanese_reference_data_policy.3 = business_getGridColumn
<!-- japanese_reference_data_policy.4 的当前独立事实为 configured_question_type_tree。 -->
japanese_reference_data_policy.4 = configured_question_type_tree
<!-- japanese_reference_data_policy.5 的当前独立事实为 individual_query_layout。 -->
japanese_reference_data_policy.5 = individual_query_layout
<!-- japanese_reference_data_policy.6 的当前独立事实为 window_geometry。 -->
japanese_reference_data_policy.6 = window_geometry
<!-- japanese_reference_data_policy.7 的当前独立事实为 standalone_default_fallback。 -->
japanese_reference_data_policy.7 = standalone_default_fallback
<!-- japanese_reference_data_policy.8 的当前独立事实为 no_private_provider。 -->
japanese_reference_data_policy.8 = no_private_provider
<!-- N2 查询固定按来源题号和题干两个真实字段独立提交，后台分页返回 totalCount；工具条输入、查询、重置和轮次复合动作逐项保存。 -->
japanese_question_query_and_editor_policy = sourceQuestionNo_exact
<!-- japanese_question_query_and_editor_policy.2 的当前独立事实为 questionTextLike。 -->
japanese_question_query_and_editor_policy.2 = questionTextLike
<!-- japanese_question_query_and_editor_policy.3 的当前独立事实为 BaseDao_AND。 -->
japanese_question_query_and_editor_policy.3 = BaseDao_AND
<!-- japanese_question_query_and_editor_policy.4 的当前独立事实为 backend_paging。 -->
japanese_question_query_and_editor_policy.4 = backend_paging
<!-- japanese_question_query_and_editor_policy.5 的当前独立事实为 one_shared_submit。 -->
japanese_question_query_and_editor_policy.5 = one_shared_submit
<!-- japanese_question_query_and_editor_policy.6 的当前独立事实为 individual_toolbar_controls。 -->
japanese_question_query_and_editor_policy.6 = individual_toolbar_controls
<!-- japanese_question_query_and_editor_policy.7 的当前独立事实为 nextRound_composite_root。 -->
japanese_question_query_and_editor_policy.7 = nextRound_composite_root
<!-- japanese_question_query_and_editor_policy.8 的当前独立事实为 shared_save_after_last_editable_toolbar_control。 -->
japanese_question_query_and_editor_policy.8 = shared_save_after_last_editable_toolbar_control
<!-- 管理列表记录保留正确答案供编辑，但业务 Grid 默认隐藏该已登记表头；图片状态仍不作为表头。 -->
japanese_question_grid_columns = sourceQuestionNo
<!-- japanese_question_grid_columns.2 的当前独立事实为 questionTypeLabel。 -->
japanese_question_grid_columns.2 = questionTypeLabel
<!-- japanese_question_grid_columns.3 的当前独立事实为 questionText。 -->
japanese_question_grid_columns.3 = questionText
<!-- japanese_question_grid_columns.4 的当前独立事实为 optionA。 -->
japanese_question_grid_columns.4 = optionA
<!-- japanese_question_grid_columns.5 的当前独立事实为 optionB。 -->
japanese_question_grid_columns.5 = optionB
<!-- japanese_question_grid_columns.6 的当前独立事实为 optionC。 -->
japanese_question_grid_columns.6 = optionC
<!-- japanese_question_grid_columns.7 的当前独立事实为 optionD。 -->
japanese_question_grid_columns.7 = optionD
<!-- japanese_question_grid_columns.8 的当前独立事实为 correctOption_hidden_by_default。 -->
japanese_question_grid_columns.8 = correctOption_hidden_by_default
<!-- japanese_question_grid_columns.9 的当前独立事实为 correctCount。 -->
japanese_question_grid_columns.9 = correctCount
<!-- japanese_question_grid_columns.10 的当前独立事实为 wrongCount。 -->
japanese_question_grid_columns.10 = wrongCount
<!-- japanese_question_grid_columns.11 的当前独立事实为 audioState。 -->
japanese_question_grid_columns.11 = audioState
<!-- japanese_question_grid_columns.12 的当前独立事实为 updatedAt。 -->
japanese_question_grid_columns.12 = updatedAt
<!-- japanese_question_grid_columns.13 的当前独立事实为 actions。 -->
japanese_question_grid_columns.13 = actions
<!-- japanese_question_grid_columns.14 的当前独立事实为 no_imageState。 -->
japanese_question_grid_columns.14 = no_imageState
<!-- 语音列始终只显示同一个播放按钮；没有媒体时先生成、写回当前题目媒体字段，再自动播放。 -->
japanese_question_grid_audio_action = one_play_button
<!-- japanese_question_grid_audio_action.2 的当前独立事实为 existing_audio_play_directly。 -->
japanese_question_grid_audio_action.2 = existing_audio_play_directly
<!-- japanese_question_grid_audio_action.3 的当前独立事实为 missing_audio_generate_then_persist_then_auto_play。 -->
japanese_question_grid_audio_action.3 = missing_audio_generate_then_persist_then_auto_play
<!-- japanese_question_grid_audio_action.4 的当前独立事实为 no_separate_generate_action。 -->
japanese_question_grid_audio_action.4 = no_separate_generate_action
