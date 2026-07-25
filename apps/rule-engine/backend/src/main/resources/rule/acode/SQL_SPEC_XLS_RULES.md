# SQL Specification XLS Rules

## 适用范围

<!-- 本规则适用于从 Java/MyBatis 实际调用链生成 SQL 仕様書；业务含义是规格书范围必须来自被分析程序的真实 SQL 使用情况 -->
sql_spec_scope_source = target_java_actual_mapper_calls

## 生成契约

<!-- 参考样式为“一条 SQL 一个工作簿、一个可见 Sheet”时必须保持该粒度；业务含义是禁止把多条 SQL 塞进编号 Sheet 并留下空白页 -->
sql_spec_follow_reference_workbook_granularity = one_sql_one_workbook_one_visible_sheet

<!-- 文件名、Sheet 名、SQLID、SQL 名必须来自同一条 SQL 的业务定义；业务含义是禁止复制模板后残留其他 SQL 的名称或公式 -->
sql_spec_identity_fields_must_match = filename,sheet_name,sql_id,sql_name

<!-- SQL 详细必须从离线 Mapper 正本读取，并保留 foreach 等动态 SQL 结构；业务含义是规格书应反映实际执行语句，不得仅凭 Java 方法名手写近似 SQL -->
sql_spec_detail_source = offline_mapper_xml_with_dynamic_sql_tags

<!-- 利用表、输入参数、取得项必须结合 Mapper 与 DataBean 业务定义填写；业务含义是重要字段（例如组织名称）不得因模板行数或生成器错配而留空 -->
sql_spec_semantic_sections_must_be_nonblank_when_applicable = tables,parameters,outputs,overview,sql_detail

<!-- 通用生成器必须把模板、输出、调用源、Mapper 来源和 SQL 业务结构外置到 UTF-8 JSON；业务含义是新增或修正规格书时只修改数据，不复制业务专用 Java 实现 -->
generic_sql_spec_generator_input = utf8_json
generic_sql_spec_json_must_define = template,output,batch_source,mapper_sources,sql_specifications

<!-- 每条 SQL 必须声明 NEW 或 CORRECT；NEW 使用统一模板，CORRECT 使用该条 SQL 指定的既有工作簿；业务含义是新规和修正共用同一生成入口且输入原本可追溯 -->
sql_spec_json_operation_modes = NEW,CORRECT
sql_spec_correct_mode_requires = base_workbook_path

<!-- SQL 仕様書的通用格式正本是アラート情報一括登録 Demo；业务含义是不得再以格付更新模板的横向、双数据结构布局生成其他 SQL 规格书 -->
sql_spec_common_format_demo = apps/rule-engine/backend/src/main/resources/templates/sql-spec/reference/SQL仕様書_アラート情報一括登録.xlsx

<!-- 通用版式必须保留 Demo 的纵向打印、唯一可见业务 Sheet、隐藏辅助 Sheet、合并区域和第 51 行分页；业务含义是生成内容变化不能破坏设计书页面骨架 -->
sql_spec_common_layout_must_preserve = portrait,one_visible_business_sheet,hidden_support_sheet,merged_regions,row_break_51

<!-- 通用区块以 Demo 行号作为基准，但表、取得项、参数和结构必须一件一行并推动后续区块整体顺延；业务含义是禁止把多件数据用换行压进第 23 行或让 SQL 正文脱离标题与印刷区域 -->
sql_spec_common_base_rows = table_data:16,output_data:23,parameter_data:28,structure_data:36,sql_detail_start:54
sql_spec_variable_sections_must_use_one_item_per_row = tables,outputs,parameters,structure_tables
sql_spec_dynamic_rows_must_shift_following_sections_and_print_break = true

<!-- 数据结构明细行必须按七个表头列组合并并绘制完整 thin 实线外框；业务含义是 Demo 空白第36行不能原样继承为无格线数据行，动态新增行也必须保持同一表格边界 -->
sql_spec_structure_data_column_groups = E:F,G:M,N:S,T:Z,AA:AI,AJ:AT,AU:BG
sql_spec_structure_data_rows_require_merged_thin_outline = true

<!-- 输出 XLSX 必须删除模板遗留计算链、SQL 名公式和 Drawing 注记；业务含义是禁止 Excel 打开时修复 calcChain，也禁止生成固定文字说明、动态 SQL 模式文字和虚线图形框 -->
sql_spec_generated_package_must_remove = xl/calcChain.xml,formula_cells,xl/drawings/drawing1.xml,drawing_relationships
sql_spec_generated_package_forbidden_text = 固定文字列として変換対象とする。,動的SQLパターン1
sql_spec_generated_package_forbidden_drawing_border = dashDot

<!-- 取得项和参数区块必须在明细后的独立红色 C 列终端格写 E，空区块也不得把 E 写进明细格；业务含义是区块结束位置必须与 Demo 一致并可被程序识别 -->
sql_spec_section_end_marker = column_C,red_fill,value_E,separate_row_after_detail
sql_spec_empty_section_must_keep_blank_detail_before_end_marker = true

<!-- SQL 詳細的可变行不得混入模板终端样式，正文后依次放置 B:BP 底线行和 A 列红色 E 行；业务含义是长 SQL 中途不得出现横线，最终 E 是通用结构的一部分 -->
sql_spec_detail_footer_sequence = sql_rows,bottom_border_row,red_end_marker_E_row
sql_spec_detail_footer_forbidden = footer_border_inside_sql_rows
sql_spec_print_area_must_end_at = red_end_marker_E_row

<!-- 取得项和参数的数据类型必须取自实际 DataBean/Java 声明；业务含义是规格书描述程序接口，不得填写 VARCHAR、INT、LIST、BEAN 等数据库型或抽象占位型 -->
sql_spec_item_data_type_source = actual_java_declaration
sql_spec_item_data_type_examples = String,List<Map<String_String>>,ConcreteDataBean
sql_spec_item_data_type_forbidden = CHAR,VARCHAR,INT,INTEGER,BIGINT,SMALLINT,DECIMAL,NUMERIC,DATE,TIMESTAMP,CLOB,BLOB,LIST,BEAN

## 验证契约

<!-- 交付前必须核对 Java 调用 SQL 集合与输出文件集合完全一致，并逐文件检查单 Sheet、关键标题、SQL 正文和动态页脚；业务含义是进程成功不等于规格书完整 -->
sql_spec_required_structural_verification = call_set_equals_output_set,one_visible_sheet,demo_hidden_support_sheet,demo_print_setup,dynamic_rows_15pt,no_multiline_packed_items,section_red_end_markers,java_item_types,structure_rows_merged_thin_grid,sql_header_adjacent_page_break,identity_fields,sql_detail,dynamic_footer_line,final_red_end_marker,print_area,no_calc_chain,no_formula,no_forbidden_drawing

<!-- 配置了目标 Java 时，必须用全部离线 Mapper ID 识别实际调用并与 JSON 集合完全一致；业务含义是既防止 JSON 写入无效 SQL，也防止漏写程序实际使用的 SQL -->
sql_spec_java_mapper_json_sets_must_match_exactly = true

<!-- 用户指出的空白字段必须加入自动验证断言；业务含义是修复必须覆盖已报告现象，而不只验证一般文件可打开 -->
reported_blank_sql_spec_field_must_have_regression_assertion = true
