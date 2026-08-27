# UTF-8 文件与命令规则

## 说明

- 本规则用于跨平台文本读取、文件写入、旧编码批量转换，以及 Windows 下的 Python、PowerShell 和 BAT 命令执行。
- 本文件位于 `src/main/resources/跨工程通用规则/`，承接跨工程通用的中文防乱码约束。

## 强制规则（Mandatory）

<!-- 文本必须按 UTF-8 完整读取和写入；适用于包含中文的工程文件；业务含义是防止系统默认编码造成乱码或内容损坏 -->
text_files_must_be_read_and_written_as_utf8 = true

<!-- PowerShell 读取文件时必须显式声明 UTF-8 和 Raw；适用于完整读取文本；业务含义是保留原文换行、注释和中文内容 -->
powershell_full_utf8_read_command = [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Get-Content -LiteralPath '<ABSOLUTE_PATH>' -Raw -Encoding utf8

<!-- Python 执行前必须设置 UTF-8 模式和标准流编码；适用于 Windows 本机 Python；业务含义是避免 cp932 无法输出中文字符 -->
windows_python_must_set_utf8_environment = PYTHONUTF8=1,PYTHONIOENCODING=utf-8

<!-- BAT 输出中文前必须设置 UTF-8 控制台和 PowerShell 输出编码；适用于本机批处理；业务含义是减少控制台代码页与进程输出编码不一致 -->
windows_batch_must_prepare_utf8_console_before_execution = true

<!-- BAT 在 UTF-8 环境下仍产生乱码时不得据乱码内容继续判断；适用于编码不可控的旧批处理；业务含义是避免把乱码误判为程序结果 -->
garbled_batch_output_must_use_utf8_capable_equivalent_entry_or_report_blocker = true

<!-- 工程文件不得依赖 Windows 默认文本编码；适用于所有读写命令和脚本入口；业务含义是让同一文件在不同机器上保持一致 -->
forbid_default_windows_encoding_for_project_text_io = true

<!-- Windows PowerShell 5.1 直接执行含非 ASCII 内容的 ps1 时，脚本必须带 UTF-8 BOM；若不加 BOM，则脚本正文只能使用 ASCII；业务含义是防止默认 cp932 把多字节字符与换行误解析，导致下一行命令被注释吞掉 -->
windows_powershell_51_utf8_script_contract = utf8_with_bom_when_non_ascii,otherwise_ascii_only

## 旧编码批量转换

<!-- 批量转换前必须建立完整可恢复备份和原始 SHA-256 清单；适用于未受版本控制保护的旧源码、配置和文档目录；业务含义是编码识别或工具失败时可以逐文件恢复原始字节 -->
legacy_text_encoding_conversion_requires_backup_and_hash_manifest = true

<!-- 转换前必须逐文件区分合法 UTF-8、可严格解码的旧编码文本和非文本文件；适用于混合保存源码、class、密钥或其他二进制的目录；业务含义是不能把目录中的全部字节盲目交给同一个字符集转换器 -->
legacy_text_encoding_inventory = valid_utf8,strictly_decodable_legacy_text,non_text

<!-- 旧编码文本只能使用严格解码，禁止忽略非法字节或使用替换字符继续写入；适用于 GBK、GB18030 及其他历史字符集；业务含义是转换不得静默丢失或伪造原文字符 -->
legacy_text_conversion_error_policy = strict_decode;forbid_ignore_or_replacement_character

<!-- macOS 自带 iconv 对部分可由标准 GB18030 严格解码器接受的历史字节序列可能返回失败；遇到工具结果分歧时必须回到严格解码和字符往返验证，不得仅依据 iconv 失败判定文件损坏 -->
macos_legacy_gb18030_conversion_verification = strict_decoder_and_unicode_round_trip_over_iconv_result

<!-- 编码转换必须保持原有 CRLF、LF 或 CR 换行计数，并验证“原始字节按源编码解码”的字符内容与“新字节按 UTF-8 解码”的字符内容一致；业务含义是转换只改变编码载体，不顺带格式化或改写正文 -->
legacy_text_conversion_equivalence = preserve_line_endings_and_unicode_content

<!-- XML、JSP、HTML 等文件完成 UTF-8 转换后必须同步文件自身的 encoding、pageEncoding 或 charset 声明；Java 运行时编码常量、外部协议编码和业务配置不得因文件转换被全局替换；业务含义是声明必须匹配文件字节，同时不改变系统与外部数据的编码契约 -->
utf8_conversion_declaration_scope = file_self_declaration_only;forbid_runtime_or_external_encoding_rewrite

<!-- 转换完成后必须严格验证全部目标文本可按 UTF-8 解码、非文本文件哈希未变化、转换文件与备份字符等价且没有临时替换文件残留 -->
utf8_conversion_completion_evidence = strict_utf8_decode,non_text_hash_unchanged,backup_unicode_equivalence,no_temporary_file_left
