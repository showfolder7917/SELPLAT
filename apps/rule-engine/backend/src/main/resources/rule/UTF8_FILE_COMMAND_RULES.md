# UTF-8 File and Command Rules

## 说明

- 本规则用于 Windows 下的文本读取、文件写入、Python、PowerShell 和 BAT 命令执行。
- 本文件位于 `src/main/resources/rule/` 根目录，承接跨工程通用的中文防乱码约束。

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
