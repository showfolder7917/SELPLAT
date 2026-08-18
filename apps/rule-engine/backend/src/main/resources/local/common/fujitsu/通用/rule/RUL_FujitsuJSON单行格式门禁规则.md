# Fujitsu JSON 单行格式门禁规则

## 说明

- 本规则适用于 Fujitsu 的 CP、IT、SB、AP 系工程中本次任务新增或修改的 JSON 文件。
- 本规则统一 JSON 交付格式：文件内容只有一个物理行，不保留空行，同时保持 JSON 数据语义不变。

## 适用范围

<!-- Fujitsu 工程新增或修改任意 JSON 时必须加载本规则；业务含义是配置、测试数据、期待数据和工具输入使用同一交付格式。 -->
rule_scope = fujitsu_cp_it_sb_ap_changed_or_added_json

<!-- 只检查当前任务实际新增或修改的 JSON，不要求无关历史文件在当前任务中被批量改写；业务含义是门禁严格约束增量，同时避免扩大用户授权范围。 -->
fujitsu_json_single_line_gate_target = current_task_added_and_modified_json_files

## 单行格式

<!-- 每个受检 JSON 文件必须恰好只有一个物理行，文件内容中不得出现 CR 或 LF；业务含义是禁止对象、数组或字段之间产生空行及多行排版。 -->
fujitsu_changed_json_physical_line_requirement = exactly_one_line_and_no_cr_or_lf

<!-- JSON 字符串中的转义换行仍是普通字符序列，不视为物理换行；业务含义是门禁限制文件排版，不改变字段本身允许表达的业务内容。 -->
fujitsu_json_escaped_newline_is_not_physical_newline = true

<!-- 单行化必须通过 JSON 解析后压缩序列化或等价的结构化格式化完成；业务含义是禁止用正则或盲删空白破坏字符串值、数字、布尔值、null、对象或数组。 -->
fujitsu_json_single_line_normalization = parse_json_then_compact_serialize_without_semantic_change

## 交付门禁

<!-- 单行检查前必须按 UTF-8 完整解析 JSON；业务含义是单行文本只有在结构合法且可被正式工具读取时才允许交付。 -->
fujitsu_json_gate_requires_valid_utf8_json = true

<!-- 交付前必须同时检查已跟踪修改、暂存修改和本任务新增但未跟踪的 JSON；业务含义是新增 fixture 或配置不能因尚未加入版本控制而绕过门禁。 -->
fujitsu_json_gate_change_set = tracked_modified_and_staged_and_task_created_untracked_json

<!-- 任一受检 JSON 解析失败、物理行数不等于一或包含 CR/LF 时门禁必须失败且禁止交付；业务含义是所有本次变更 JSON 只有全部合规才算完成。 -->
fujitsu_json_single_line_delivery_gate = valid_utf8_json AND physical_line_count_equals_1 AND no_cr_or_lf

<!-- 门禁结果必须报告受检文件数和违规文件路径；业务含义是执行者能够复核检查范围，并直接定位需要重新压缩的文件。 -->
fujitsu_json_single_line_gate_evidence = checked_json_file_count_and_zero_violation_paths
