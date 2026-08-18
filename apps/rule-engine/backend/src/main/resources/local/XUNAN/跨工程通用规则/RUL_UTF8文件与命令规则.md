# UTF-8 文件与命令规则用户扩展

<!-- 当前扩展不需要 Java 能力，分层加载与回归测试直接验证规则契约。 -->
java_ability_refs = none
<!-- 当前扩展不新建 Python 能力，HTTP 字节解码使用现有标准库即可执行。 -->
python_ability_refs = none
<!-- 当前扩展不需要 Node 能力，前端 JSON 契约由现有应用回归承担。 -->
node_ability_refs = none
<!-- 首版针对 Windows PowerShell 5.1、日文代码页和无 charset JSON 响应引起的重复乱码建立写入阻断。 -->
rule_version = 1.0.0
<!-- 规则所有者只从工程根 AGENTS.md 的当前稳定用户动态解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示用户层扩展已登记索引并接入分层加载验证。 -->
rule_status = active
<!-- 用户层只扩展 common 同名逻辑 ID，未冲突的文件读写与旧编码转换约束继续保留。 -->
override_mode = extend
<!-- 本次升级记录固定 PowerShell HTTP 显式 UTF-8 解码、最小更新载荷和乱码写入阻断。 -->
upgrade_record = 2026-08-18:powershell_51_http_raw_bytes_utf8_decode_and_mojibake_mutation_block

## Windows 命令编码边界

<!-- Windows PowerShell 5.1 调用原生程序前必须同时统一控制台输入、控制台输出和管道输出，禁止保留 US-ASCII 默认值。 -->
windows_powershell_51_native_pipeline_utf8_preflight = console_input_utf8,console_output_utf8,powershell_output_encoding_utf8,verified_native_runtime_encoding
<!-- 当前代码页不是 UTF-8 时必须在本次命令边界显式切换并验证，不得依据语言区域推测文本编码。 -->
windows_console_code_page_gate = explicit_utf8_for_text_pipeline,verify_before_non_ascii_transfer,no_locale_inference
<!-- Python 标准流与偏好编码必须在命令执行前均为 UTF-8，任一项未验证时禁止传递中日文。 -->
windows_python_unicode_pipeline_gate = PYTHONUTF8_1,PYTHONIOENCODING_utf8,stdin_utf8,stdout_utf8,preferred_encoding_utf8

## HTTP JSON 解码与写入阻断

<!-- PowerShell 5.1 读取未声明 charset 的 JSON 时禁止直接信任 Invoke-WebRequest 或 Invoke-RestMethod 的自动字符串解码。 -->
powershell_51_unlabeled_json_auto_decode_policy = forbidden_for_unicode_read_or_mutation_input
<!-- JSON HTTP 响应必须先保留原始字节，再使用严格 UTF-8 解码并完成 JSON 解析，禁止 Latin1、Shift_JIS 或系统默认编码回退。 -->
http_json_response_decode_gate = raw_bytes,strict_utf8_decode,json_parse,no_latin1_shift_jis_or_system_default_fallback
<!-- 服务端可控时必须明确返回带 UTF-8 charset 的 JSON，客户端仍必须校验字节可严格解码。 -->
http_json_response_content_type_contract = application_json_charset_utf8,client_strict_utf8_validation_still_required
<!-- JSON 变更请求必须把序列化结果显式编码为 UTF-8 字节，并声明 application/json;charset=UTF-8。 -->
http_json_mutation_request_contract = serialize_json_then_encode_utf8_bytes,content_type_application_json_charset_utf8
<!-- 更新接口默认只提交主键和用户明确要修改的字段，禁止把 GET 整条记录未经筛选地回写。 -->
http_mutation_payload_minimization = primary_key_plus_explicit_target_fields_only,forbid_full_record_unfiltered_writeback
<!-- 来源文本存在编码歧义或已显示乱码时不得作为文件、HTTP、数据库或消息写入的输入。 -->
ambiguous_or_mojibake_text_reuse_policy = block_filesystem_http_database_and_message_mutation

## 乱码检测和写后保全

<!-- 任何写入前必须验证严格 UTF-8 往返、替换字符、C1 控制字符和已知 UTF-8 被当作单字节编码的特征。 -->
unicode_text_prewrite_integrity_gate = strict_utf8_round_trip,no_replacement_character,no_c1_control_characters,no_known_utf8_as_single_byte_mojibake
<!-- 检出问号替换序列、拉丁字符重复转码特征或不可见控制字符时必须立即阻断，保留原始字节并报告边界。 -->
detected_mojibake_action = stop_before_write,preserve_original_bytes,report_decode_boundary_and_source
<!-- 写入前必须保存所有非目标文本字段的 Unicode 码点快照，写入后逐字段比较完全一致。 -->
non_target_unicode_field_preservation_gate = snapshot_code_points_before_write,compare_all_non_target_fields_after_write,exact_match_required
<!-- 中文、日文和 ASCII 混合文本必须覆盖读取、修改无关字段、回写与再读取回归，任一非目标字段变化均阻断交付。 -->
unicode_http_round_trip_regression = chinese,japanese,mixed_ascii,update_unrelated_field,reread_non_target_exact_match
<!-- 交付证据必须同时包含响应头、原始字节严格 UTF-8 结果、最小更新载荷和非目标字段写后对比。 -->
unicode_mutation_completion_evidence = response_content_type,raw_bytes_strict_utf8,minimal_target_field_payload,non_target_before_after_match

## 规则包边界

<!-- 本规则只增加编码与写入门禁，没有可重复的文件或请求成品，因此不建立模板。 -->
template_not_applicable_reason = declarative_encoding_and_mutation_gate_has_no_repeatable_artifact
<!-- 真实故障已由分层加载和 Unicode 往返回归表达，禁止再复制一份容易过期的示例成品。 -->
example_not_applicable_reason = layered_loading_and_unicode_round_trip_regression_are_authoritative
<!-- 现有标准库已能执行原始字节和严格 UTF-8 校验，本次不创建只包装一条命令的程序。 -->
program_not_applicable_reason = standard_raw_byte_and_strict_utf8_apis_are_sufficient
<!-- 验证必须覆盖 common 与用户层 extend 合并、索引可达、逐行中文注释和关键写入阻断语义。 -->
verification_contract = layered_common_plus_active_user_extend,index_reachability,line_level_chinese_comments,utf8_http_mutation_gate_semantics
