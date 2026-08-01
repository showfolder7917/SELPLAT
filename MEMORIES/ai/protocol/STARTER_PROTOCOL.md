<!-- AI 信息状态由运行时提供，可取 known、unknown 或 partial -->
AI_INFO_STATE: provided by runtime (known | unknown | partial)

<!-- 默认输出目录 -->
OUT = ./OPTION/
<!-- 默认日志目录 -->
LOG = ${OUT}log/
<!-- 记忆库根目录 -->
MEM = ./MEMORIES/
<!-- 人类侧记忆目录 -->
HUM = ${MEM}human/
<!-- AI 侧记忆目录 -->
AI  = ${MEM}ai/
<!-- 协议文件目录 -->
PRT = ${AI}protocol/  
<!-- 规则文件目录 -->
RUL = ${AI}rule/
<!-- 代码能力根目录 -->
COD = ${AI}code/
<!-- ability 能力目录 -->
ABL = ${COD}abilities/
<!-- ability 统一执行入口 -->
EXE = ${COD}executor.py

<!-- 最小启动链入口文件 -->
minimal_protocol_chain_entry = ${PRT}STARTER_PROTOCOL.md
<!-- 最小启动链的下一份协议文件 -->
minimal_protocol_chain_next = ${PRT}USER.PROTOCOL.md
<!-- 启动阶段只执行最小协议链，不默认扩展到其他规则或记忆 -->
minimum_protocol_chain_only = true
<!-- 默认输出语言为中文 -->
default_language = zh
<!-- STARTER 是唯一直接入口，其他协议必须通过链式装载进入 -->
startup_entry_is_single_minimum_entry = true
<!-- STARTER 是启动后唯一允许直接读取的协议文件 -->
starter_is_the_only_directly_readable_protocol_file = true
<!-- 读取 STARTER 后必须通过 ai_memory_file_reader 继续装载 USER 协议 -->
after_starter_must_load_user_protocol_via_ability = ai_memory_file_reader
<!-- STARTER 后续装载目标是 USER.PROTOCOL.md -->
after_starter_target_protocol = ${PRT}USER.PROTOCOL.md
<!-- 协议链通过读取器装载不视为具体任务执行 -->
protocol_chain_loading_via_reader_is_not_execution = true
<!-- USER.PROTOCOL.md 不享受直接文件读取豁免 -->
user_protocol_direct_file_read_exemption = false
<!-- 启动协议链的声明顺序 -->
startup_protocol_chain_order = STARTER_PROTOCOL.md -> USER.PROTOCOL.md -> CODE.PROTOCOL.md -> COMMAND.PROTOCOL.md -> RULE_INDEX.md