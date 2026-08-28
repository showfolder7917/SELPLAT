# 日本语题库 AI 媒体生成执行规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 1.28.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 本职责按真实 Japanese 调用方登记 Java、Python 与 Node 边界。 -->
java_ability_refs = apps/japanese/backend/src/main/java/com/sp/selplat/japanese/common/util/media/JapaneseMediaStorage.java
python_ability_refs = none
node_ability_refs = none

japanese_codex_cli_boundary = image_only
<!-- japanese_codex_cli_boundary.2 的当前独立事实为 local_codex_exec。 -->
japanese_codex_cli_boundary.2 = local_codex_exec
<!-- japanese_codex_cli_boundary.3 的当前独立事实为 configurable_executable。 -->
japanese_codex_cli_boundary.3 = configurable_executable
<!-- japanese_codex_cli_boundary.4 的当前独立事实为 no_shell_command_concatenation。 -->
japanese_codex_cli_boundary.4 = no_shell_command_concatenation
<!-- Codex 图片执行使用系统临时隔离目录，只允许写临时工作区。 -->
japanese_codex_execution_scope = ephemeral_temp_directory
<!-- japanese_codex_execution_scope.2 的当前独立事实为 image_workspace_write。 -->
japanese_codex_execution_scope.2 = image_workspace_write
<!-- 免费语音与翻译插件统一归档到 OPTION/plugin，并以独立虚拟环境隔离依赖。 -->
japanese_free_plugin_root = OPTION/plugin
<!-- japanese_free_plugin_root.2 的当前独立事实为 edge-tts-venv。 -->
japanese_free_plugin_root.2 = edge-tts-venv
<!-- japanese_free_plugin_root.3 的当前独立事实为 deep-translator-venv。 -->
japanese_free_plugin_root.3 = deep-translator-venv
<!-- japanese_free_plugin_root.4 的当前独立事实为 separate_dependencies。 -->
japanese_free_plugin_root.4 = separate_dependencies
<!-- 语音入口先接受环境覆盖，否则按当前平台从工程根下的 edge-tts 虚拟环境解析，禁止机器绝对路径。 -->
japanese_edge_tts_default_executable = env:JAPANESE_EDGE_TTS_EXECUTABLE_or_platform_resolved_<SELPLAT_ROOT>/OPTION/plugin/edge-tts-venv
<!-- 翻译入口先接受环境覆盖，否则按当前平台从工程根下的 deep-translator 虚拟环境解析。 -->
japanese_deep_translator_default_executable = env:JAPANESE_DEEP_TRANSLATOR_EXECUTABLE_or_platform_resolved_<SELPLAT_ROOT>/OPTION/plugin/deep-translator-venv
<!-- 外部翻译请求的数据边界只有 audioText，禁止携带题干、选项、答案和用户数据。 -->
japanese_translation_external_payload = provider:google
<!-- japanese_translation_external_payload.2 的当前独立事实为 allowed:audioText。 -->
japanese_translation_external_payload.2 = allowed:audioText
<!-- japanese_translation_external_payload.3 的当前独立事实为 forbidden:questionText|options|correctOption|userData。 -->
japanese_translation_external_payload.3 = forbidden:questionText|options|correctOption|userData
<!-- 日语语音音色固定为 NanamiNeural，输出格式为 MP3。 -->
japanese_audio_generation = voice:ja-JP-NanamiNeural
<!-- japanese_audio_generation.2 的当前独立事实为 format:mp3。 -->
japanese_audio_generation.2 = format:mp3
<!-- 朗读文本必须把正确选项填入所有题干占位符；“やら／やら”等成对答案按顺序填入多个空格。 -->
japanese_audio_text_completion = locked_correct_option_fills_all_placeholders
<!-- japanese_audio_text_completion.2 的当前独立事实为 paired_answer_segments_supported。 -->
japanese_audio_text_completion.2 = paired_answer_segments_supported
<!-- japanese_audio_text_completion.3 的当前独立事实为 no_parenthesis_placeholder_to_tts。 -->
japanese_audio_text_completion.3 = no_parenthesis_placeholder_to_tts
<!-- 图片原图必须经 FFmpeg 压缩成 WebP，当前质量参数为 82。 -->
japanese_image_generation = codex_original
<!-- japanese_image_generation.2 的当前独立事实为 ffmpeg_webp。 -->
japanese_image_generation.2 = ffmpeg_webp
<!-- japanese_image_generation.3 的当前独立事实为 quality:82。 -->
japanese_image_generation.3 = quality:82

## 存储与访问

<!-- 图片和语音分别写入 Japanese 静态资源目录，页面使用稳定根路径访问。 -->
japanese_local_media_paths = image:static/pic:/pic/
<!-- japanese_local_media_paths.2 的当前独立事实为 audio:static/audio:/audio/。 -->
japanese_local_media_paths.2 = audio:static/audio:/audio/
<!-- 题表只保存提供方、对象键和访问 URL，禁止保存机器绝对路径。 -->
japanese_media_database_contract = storageProvider
<!-- japanese_media_database_contract.2 的当前独立事实为 storageKey。 -->
japanese_media_database_contract.2 = storageKey
<!-- japanese_media_database_contract.3 的当前独立事实为 url。 -->
japanese_media_database_contract.3 = url
<!-- japanese_media_database_contract.4 的当前独立事实为 no_absolute_filesystem_path。 -->
japanese_media_database_contract.4 = no_absolute_filesystem_path
<!-- 业务 Service 只依赖 JapaneseMediaStorage 接口，未来云存储通过替换实现接入。 -->
japanese_media_cloud_migration_boundary = JapaneseMediaStorage_interface
<!-- japanese_media_cloud_migration_boundary.2 的当前独立事实为 replaceable_provider_implementation。 -->
japanese_media_cloud_migration_boundary.2 = replaceable_provider_implementation
