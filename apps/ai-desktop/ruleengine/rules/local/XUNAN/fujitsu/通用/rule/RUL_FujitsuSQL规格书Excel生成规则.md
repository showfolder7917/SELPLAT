# SQL Specification XLS Rules

<!-- SQL规格书生成和修正统一调用当前用户 Python 工作簿能力。 -->
python_ability_refs = apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/fujitsu_excel_tools.py
<!-- 当前规则不再使用 Java 能力。 -->
java_ability_refs = none
<!-- 当前规则不需要 Node 程序。 -->
node_ability_refs = none

## 适用范围

<!-- 本规则适用于从 Java/MyBatis 实际调用链生成 SQL 仕様書；业务含义是规格书范围必须来自被分析程序的真实 SQL 使用情况 -->
sql_spec_scope_source = target_java_actual_mapper_calls

## 生成契约

<!-- 参考样式为“一条 SQL 一个工作簿、一个可见 Sheet”时必须保持该粒度；业务含义是禁止把多条 SQL 塞进编号 Sheet 并留下空白页 -->
sql_spec_follow_reference_workbook_granularity = one_sql_one_workbook_one_visible_sheet

<!-- 文件名、Sheet 名、SQLID、SQL 名必须来自同一条 SQL 的业务定义；业务含义是禁止复制模板后残留其他 SQL 的名称或公式 -->
sql_spec_identity_fields_must_match = filename
<!-- sql_spec_identity_fields_must_match.2 的当前独立事实为 sheet_name。 -->
sql_spec_identity_fields_must_match.2 = sheet_name
<!-- sql_spec_identity_fields_must_match.3 的当前独立事实为 sql_id。 -->
sql_spec_identity_fields_must_match.3 = sql_id
<!-- sql_spec_identity_fields_must_match.4 的当前独立事实为 sql_name。 -->
sql_spec_identity_fields_must_match.4 = sql_name

<!-- SQL 详细必须从离线 Mapper 正本读取，并保留 foreach 等动态 SQL 结构；业务含义是规格书应反映实际执行语句，不得仅凭 Java 方法名手写近似 SQL -->
sql_spec_detail_source = offline_mapper_xml_with_dynamic_sql_tags

<!-- 利用表、输入参数、取得项必须结合 Mapper 与 DataBean 业务定义填写；业务含义是重要字段（例如组织名称）不得因模板行数或生成器错配而留空 -->
sql_spec_semantic_sections_must_be_nonblank_when_applicable = tables
<!-- sql_spec_semantic_sections_must_be_nonblank_when_applicable.2 的当前独立事实为 parameters。 -->
sql_spec_semantic_sections_must_be_nonblank_when_applicable.2 = parameters
<!-- sql_spec_semantic_sections_must_be_nonblank_when_applicable.3 的当前独立事实为 outputs。 -->
sql_spec_semantic_sections_must_be_nonblank_when_applicable.3 = outputs
<!-- sql_spec_semantic_sections_must_be_nonblank_when_applicable.4 的当前独立事实为 overview。 -->
sql_spec_semantic_sections_must_be_nonblank_when_applicable.4 = overview
<!-- sql_spec_semantic_sections_must_be_nonblank_when_applicable.5 的当前独立事实为 sql_detail。 -->
sql_spec_semantic_sections_must_be_nonblank_when_applicable.5 = sql_detail

<!-- 通用生成器必须把模板、输出、调用源、Mapper 来源和 SQL 业务结构外置到 UTF-8 JSON；业务含义是新增或修正规格书时只修改数据，不复制业务专用 Python 实现 -->
generic_sql_spec_generator_input = utf8_json
<!-- generic_sql_spec_json_must_define 的当前独立事实为 template。 -->
generic_sql_spec_json_must_define = template
<!-- generic_sql_spec_json_must_define.2 的当前独立事实为 output。 -->
generic_sql_spec_json_must_define.2 = output
<!-- generic_sql_spec_json_must_define.3 的当前独立事实为 batch_source。 -->
generic_sql_spec_json_must_define.3 = batch_source
<!-- generic_sql_spec_json_must_define.4 的当前独立事实为 mapper_sources。 -->
generic_sql_spec_json_must_define.4 = mapper_sources
<!-- generic_sql_spec_json_must_define.5 的当前独立事实为 sql_specifications。 -->
generic_sql_spec_json_must_define.5 = sql_specifications

<!-- 每条 SQL 必须声明 NEW 或 CORRECT；NEW 使用统一模板，CORRECT 使用该条 SQL 指定的既有工作簿；业务含义是新规和修正共用同一生成入口且输入原本可追溯 -->
sql_spec_json_operation_modes = NEW
<!-- sql_spec_json_operation_modes.2 的当前独立事实为 CORRECT。 -->
sql_spec_json_operation_modes.2 = CORRECT
<!-- sql_spec_correct_mode_requires 的当前独立事实为 base_workbook_path。 -->
sql_spec_correct_mode_requires = base_workbook_path

<!-- SQL 仕様書的通用格式正本是アラート情報一括登録 Demo；业务含义是不得再以格付更新模板的横向、双数据结构布局生成其他 SQL 规格书 -->
sql_spec_common_format_demo = apps/ai-desktop/ruleengine/rules/local/XUNAN/fujitsu/通用/template/RUL_FujitsuSQL规格书Excel生成规则/SQL仕様書生成ツール/reference/SQL仕様書_アラート情報一括登録.xlsx

<!-- 通用版式必须保留 Demo 的纵向打印、唯一可见业务 Sheet、隐藏辅助 Sheet、合并区域和第 51 行分页；业务含义是生成内容变化不能破坏设计书页面骨架 -->
sql_spec_common_layout_must_preserve = portrait
<!-- sql_spec_common_layout_must_preserve.2 的当前独立事实为 one_visible_business_sheet。 -->
sql_spec_common_layout_must_preserve.2 = one_visible_business_sheet
<!-- sql_spec_common_layout_must_preserve.3 的当前独立事实为 hidden_support_sheet。 -->
sql_spec_common_layout_must_preserve.3 = hidden_support_sheet
<!-- sql_spec_common_layout_must_preserve.4 的当前独立事实为 merged_regions。 -->
sql_spec_common_layout_must_preserve.4 = merged_regions
<!-- sql_spec_common_layout_must_preserve.5 的当前独立事实为 row_break_51。 -->
sql_spec_common_layout_must_preserve.5 = row_break_51

<!-- 通用区块以 Demo 行号作为基准，但表、取得项、参数和结构必须一件一行并推动后续区块整体顺延；业务含义是禁止把多件数据用换行压进第 23 行或让 SQL 正文脱离标题与印刷区域 -->
sql_spec_common_base_rows = table_data:16
<!-- sql_spec_common_base_rows.2 的当前独立事实为 output_data:23。 -->
sql_spec_common_base_rows.2 = output_data:23
<!-- sql_spec_common_base_rows.3 的当前独立事实为 parameter_data:28。 -->
sql_spec_common_base_rows.3 = parameter_data:28
<!-- sql_spec_common_base_rows.4 的当前独立事实为 structure_data:36。 -->
sql_spec_common_base_rows.4 = structure_data:36
<!-- sql_spec_common_base_rows.5 的当前独立事实为 sql_detail_start:54。 -->
sql_spec_common_base_rows.5 = sql_detail_start:54
<!-- sql_spec_variable_sections_must_use_one_item_per_row 的当前独立事实为 tables。 -->
sql_spec_variable_sections_must_use_one_item_per_row = tables
<!-- sql_spec_variable_sections_must_use_one_item_per_row.2 的当前独立事实为 outputs。 -->
sql_spec_variable_sections_must_use_one_item_per_row.2 = outputs
<!-- sql_spec_variable_sections_must_use_one_item_per_row.3 的当前独立事实为 parameters。 -->
sql_spec_variable_sections_must_use_one_item_per_row.3 = parameters
<!-- sql_spec_variable_sections_must_use_one_item_per_row.4 的当前独立事实为 structure_tables。 -->
sql_spec_variable_sections_must_use_one_item_per_row.4 = structure_tables
<!-- sql_spec_dynamic_rows_must_shift_following_sections_and_print_break 的当前独立事实为 true。 -->
sql_spec_dynamic_rows_must_shift_following_sections_and_print_break = true

<!-- 数据结构明细行必须按七个表头列组合并并绘制完整 thin 实线外框；业务含义是 Demo 空白第36行不能原样继承为无格线数据行，动态新增行也必须保持同一表格边界 -->
sql_spec_structure_data_column_groups = E:F
<!-- sql_spec_structure_data_column_groups.2 的当前独立事实为 G:M。 -->
sql_spec_structure_data_column_groups.2 = G:M
<!-- sql_spec_structure_data_column_groups.3 的当前独立事实为 N:S。 -->
sql_spec_structure_data_column_groups.3 = N:S
<!-- sql_spec_structure_data_column_groups.4 的当前独立事实为 T:Z。 -->
sql_spec_structure_data_column_groups.4 = T:Z
<!-- sql_spec_structure_data_column_groups.5 的当前独立事实为 AA:AI。 -->
sql_spec_structure_data_column_groups.5 = AA:AI
<!-- sql_spec_structure_data_column_groups.6 的当前独立事实为 AJ:AT。 -->
sql_spec_structure_data_column_groups.6 = AJ:AT
<!-- sql_spec_structure_data_column_groups.7 的当前独立事实为 AU:BG。 -->
sql_spec_structure_data_column_groups.7 = AU:BG
<!-- sql_spec_structure_data_rows_require_merged_thin_outline 的当前独立事实为 true。 -->
sql_spec_structure_data_rows_require_merged_thin_outline = true

<!-- 输出 XLSX 必须删除模板遗留计算链、SQL 名公式和 Drawing 注记；业务含义是禁止 Excel 打开时修复 calcChain，也禁止生成固定文字说明、动态 SQL 模式文字和虚线图形框 -->
sql_spec_generated_package_must_remove = xl/calcChain.xml
<!-- sql_spec_generated_package_must_remove.2 的当前独立事实为 formula_cells。 -->
sql_spec_generated_package_must_remove.2 = formula_cells
<!-- sql_spec_generated_package_must_remove.3 的当前独立事实为 xl/drawings/drawing1.xml。 -->
sql_spec_generated_package_must_remove.3 = xl/drawings/drawing1.xml
<!-- sql_spec_generated_package_must_remove.4 的当前独立事实为 drawing_relationships。 -->
sql_spec_generated_package_must_remove.4 = drawing_relationships
<!-- sql_spec_generated_package_forbidden_text 的当前独立事实为 固定文字列として変換対象とする。。 -->
sql_spec_generated_package_forbidden_text = 固定文字列として変換対象とする。
<!-- sql_spec_generated_package_forbidden_text.2 的当前独立事实为 動的SQLパターン1。 -->
sql_spec_generated_package_forbidden_text.2 = 動的SQLパターン1
<!-- sql_spec_generated_package_forbidden_drawing_border 的当前独立事实为 dashDot。 -->
sql_spec_generated_package_forbidden_drawing_border = dashDot

<!-- 取得项和参数区块必须在明细后的独立红色 C 列终端格写 E，空区块也不得把 E 写进明细格；业务含义是区块结束位置必须与 Demo 一致并可被程序识别 -->
sql_spec_section_end_marker = column_C
<!-- sql_spec_section_end_marker.2 的当前独立事实为 red_fill。 -->
sql_spec_section_end_marker.2 = red_fill
<!-- sql_spec_section_end_marker.3 的当前独立事实为 value_E。 -->
sql_spec_section_end_marker.3 = value_E
<!-- sql_spec_section_end_marker.4 的当前独立事实为 separate_row_after_detail。 -->
sql_spec_section_end_marker.4 = separate_row_after_detail
<!-- sql_spec_empty_section_must_keep_blank_detail_before_end_marker 的当前独立事实为 true。 -->
sql_spec_empty_section_must_keep_blank_detail_before_end_marker = true

<!-- SQL 詳細的可变行不得混入模板终端样式，正文后依次放置 B:BP 底线行和 A 列红色 E 行；业务含义是长 SQL 中途不得出现横线，最终 E 是通用结构的一部分 -->
sql_spec_detail_footer_sequence = sql_rows
<!-- sql_spec_detail_footer_sequence.2 的当前独立事实为 bottom_border_row。 -->
sql_spec_detail_footer_sequence.2 = bottom_border_row
<!-- sql_spec_detail_footer_sequence.3 的当前独立事实为 red_end_marker_E_row。 -->
sql_spec_detail_footer_sequence.3 = red_end_marker_E_row
<!-- sql_spec_detail_footer_forbidden 的当前独立事实为 footer_border_inside_sql_rows。 -->
sql_spec_detail_footer_forbidden = footer_border_inside_sql_rows
<!-- sql_spec_print_area_must_end_at 的当前独立事实为 red_end_marker_E_row。 -->
sql_spec_print_area_must_end_at = red_end_marker_E_row

<!-- 取得项和参数的数据类型必须取自实际 DataBean/Java 声明；业务含义是规格书描述程序接口，不得填写 VARCHAR、INT、LIST、BEAN 等数据库型或抽象占位型 -->
sql_spec_item_data_type_source = actual_java_declaration
<!-- sql_spec_item_data_type_examples 的当前独立事实为 String。 -->
sql_spec_item_data_type_examples = String
<!-- sql_spec_item_data_type_examples.2 的当前独立事实为 List<Map<String_String>>。 -->
sql_spec_item_data_type_examples.2 = List<Map<String_String>>
<!-- sql_spec_item_data_type_examples.3 的当前独立事实为 ConcreteDataBean。 -->
sql_spec_item_data_type_examples.3 = ConcreteDataBean
<!-- sql_spec_item_data_type_forbidden 的当前独立事实为 CHAR。 -->
sql_spec_item_data_type_forbidden = CHAR
<!-- sql_spec_item_data_type_forbidden.2 的当前独立事实为 VARCHAR。 -->
sql_spec_item_data_type_forbidden.2 = VARCHAR
<!-- sql_spec_item_data_type_forbidden.3 的当前独立事实为 INT。 -->
sql_spec_item_data_type_forbidden.3 = INT
<!-- sql_spec_item_data_type_forbidden.4 的当前独立事实为 INTEGER。 -->
sql_spec_item_data_type_forbidden.4 = INTEGER
<!-- sql_spec_item_data_type_forbidden.5 的当前独立事实为 BIGINT。 -->
sql_spec_item_data_type_forbidden.5 = BIGINT
<!-- sql_spec_item_data_type_forbidden.6 的当前独立事实为 SMALLINT。 -->
sql_spec_item_data_type_forbidden.6 = SMALLINT
<!-- sql_spec_item_data_type_forbidden.7 的当前独立事实为 DECIMAL。 -->
sql_spec_item_data_type_forbidden.7 = DECIMAL
<!-- sql_spec_item_data_type_forbidden.8 的当前独立事实为 NUMERIC。 -->
sql_spec_item_data_type_forbidden.8 = NUMERIC
<!-- sql_spec_item_data_type_forbidden.9 的当前独立事实为 DATE。 -->
sql_spec_item_data_type_forbidden.9 = DATE
<!-- sql_spec_item_data_type_forbidden.10 的当前独立事实为 TIMESTAMP。 -->
sql_spec_item_data_type_forbidden.10 = TIMESTAMP
<!-- sql_spec_item_data_type_forbidden.11 的当前独立事实为 CLOB。 -->
sql_spec_item_data_type_forbidden.11 = CLOB
<!-- sql_spec_item_data_type_forbidden.12 的当前独立事实为 BLOB。 -->
sql_spec_item_data_type_forbidden.12 = BLOB
<!-- sql_spec_item_data_type_forbidden.13 的当前独立事实为 LIST。 -->
sql_spec_item_data_type_forbidden.13 = LIST
<!-- sql_spec_item_data_type_forbidden.14 的当前独立事实为 BEAN。 -->
sql_spec_item_data_type_forbidden.14 = BEAN

<!-- 生成 SQL、输入 Bean 与 Mapper 前必须核对目标 Java 调用方实际设置的参数；业务含义是调用方已设置的业务条件必须同时进入输入契约和 SQL 绑定，不能只按规格书占位行生成无参查询。 -->
sql_spec_generated_parameter_contract_must_match_target_java_caller = true

<!-- 生成结果不得把横线或其他占位符直接写成 Java 字段、getter 或 setter；业务含义是规格书占位符不能泄漏到可交付源码。 -->
sql_spec_generated_java_must_reject_placeholder_identifiers = true

## 验证契约

<!-- 交付前必须核对目标程序调用 SQL 集合与输出文件集合完全一致，并逐文件检查单 Sheet、关键标题、SQL 正文和动态页脚；业务含义是进程成功不等于规格书完整 -->
sql_spec_required_structural_verification = call_set_equals_output_set
<!-- sql_spec_required_structural_verification.2 的当前独立事实为 one_visible_sheet。 -->
sql_spec_required_structural_verification.2 = one_visible_sheet
<!-- sql_spec_required_structural_verification.3 的当前独立事实为 demo_hidden_support_sheet。 -->
sql_spec_required_structural_verification.3 = demo_hidden_support_sheet
<!-- sql_spec_required_structural_verification.4 的当前独立事实为 demo_print_setup。 -->
sql_spec_required_structural_verification.4 = demo_print_setup
<!-- sql_spec_required_structural_verification.5 的当前独立事实为 dynamic_rows_15pt。 -->
sql_spec_required_structural_verification.5 = dynamic_rows_15pt
<!-- sql_spec_required_structural_verification.6 的当前独立事实为 no_multiline_packed_items。 -->
sql_spec_required_structural_verification.6 = no_multiline_packed_items
<!-- sql_spec_required_structural_verification.7 的当前独立事实为 section_red_end_markers。 -->
sql_spec_required_structural_verification.7 = section_red_end_markers
<!-- sql_spec_required_structural_verification.8 的当前独立事实为 java_item_types。 -->
sql_spec_required_structural_verification.8 = java_item_types
<!-- sql_spec_required_structural_verification.9 的当前独立事实为 structure_rows_merged_thin_grid。 -->
sql_spec_required_structural_verification.9 = structure_rows_merged_thin_grid
<!-- sql_spec_required_structural_verification.10 的当前独立事实为 sql_header_adjacent_page_break。 -->
sql_spec_required_structural_verification.10 = sql_header_adjacent_page_break
<!-- sql_spec_required_structural_verification.11 的当前独立事实为 identity_fields。 -->
sql_spec_required_structural_verification.11 = identity_fields
<!-- sql_spec_required_structural_verification.12 的当前独立事实为 sql_detail。 -->
sql_spec_required_structural_verification.12 = sql_detail
<!-- sql_spec_required_structural_verification.13 的当前独立事实为 dynamic_footer_line。 -->
sql_spec_required_structural_verification.13 = dynamic_footer_line
<!-- sql_spec_required_structural_verification.14 的当前独立事实为 final_red_end_marker。 -->
sql_spec_required_structural_verification.14 = final_red_end_marker
<!-- sql_spec_required_structural_verification.15 的当前独立事实为 print_area。 -->
sql_spec_required_structural_verification.15 = print_area
<!-- sql_spec_required_structural_verification.16 的当前独立事实为 no_calc_chain。 -->
sql_spec_required_structural_verification.16 = no_calc_chain
<!-- sql_spec_required_structural_verification.17 的当前独立事实为 no_formula。 -->
sql_spec_required_structural_verification.17 = no_formula
<!-- sql_spec_required_structural_verification.18 的当前独立事实为 no_forbidden_drawing。 -->
sql_spec_required_structural_verification.18 = no_forbidden_drawing

<!-- 配置了目标 Java 时，必须用全部离线 Mapper ID 识别实际调用并与 JSON 集合完全一致；业务含义是既防止 JSON 写入无效 SQL，也防止漏写程序实际使用的 SQL -->
sql_spec_java_mapper_json_sets_must_match_exactly = true

<!-- 用户指出的空白字段必须加入自动验证断言；业务含义是修复必须覆盖已报告现象，而不只验证一般文件可打开 -->
reported_blank_sql_spec_field_must_have_regression_assertion = true
