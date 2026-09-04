# Fujitsu 确认点结果文档判定规则

<!-- 本规则适用于依据规格书、表定义、代码定义和当前源码复核 Fujitsu 确认点结果 Excel。 -->
fujitsu_confirmation_result_review_scope = specification_table_code_definition_and_current_source_based_excel_review

<!-- 每一行只判定该行所见描述的检出内容，其他问题必须进入对应行或独立修正清单。 -->
fujitsu_confirmation_result_row_scope = current_row_finding_only

<!-- OK 只表示证据已经证明当前检出内容无需修改。 -->
fujitsu_confirmation_result_status_ok = evidence_proves_no_change_required

<!-- NG 只表示证据已经证明代码、SQL、Bean、配置、UI 或规格书至少一处必须修改。 -->
fujitsu_confirmation_result_status_ng = evidence_proves_change_required

<!-- 当前资料不能确定 OK 或 NG 时，结果必须明确写为要確認。 -->
fujitsu_confirmation_result_status_pending = 要確認

<!-- 判定证据必须按功能 ID 和处理 ID 对应规格，并追踪到当前 PG、SQL、Bean、共通部品及实际常量值。 -->
fujitsu_confirmation_result_evidence_chain = function_and_process_matched_specification_to_current_pg_sql_bean_common_component_and_constant_value

<!-- DB 项目必须从现行表定义按物理表名和物理列名重新取得类型、精度、NULL、默认值及备注。 -->
fujitsu_confirmation_result_db_evidence = current_table_definition_lookup_by_physical_table_and_column

<!-- 派生数值必须按每一个条件分支验证输入约束、运算最大值、语言类型溢出和 DB 精度上限。 -->
fujitsu_confirmation_result_derived_value_check = every_branch_input_bound_arithmetic_max_language_overflow_and_db_precision

<!-- 多个 DB 数值相加时，单个字段精度不能证明合计值可写入目标字段。 -->
fujitsu_confirmation_result_sum_precision_policy = component_precision_does_not_prove_sum_precision

<!-- 缺少业务上限或字段间不变量时不得以测试样例或通常业务值代替保证。 -->
fujitsu_confirmation_result_missing_invariant_policy = pending_not_inferred_from_examples_or_typical_values

<!-- 要確認行的结果与结果判定根拠两个单元格必须标黄，其他单元格不得计入待确认颜色数量。 -->
fujitsu_confirmation_result_pending_color_scope = result_and_rationale_cells_only

<!-- 黄色校验按要確認行数执行，不按黄色单元格总数执行。 -->
fujitsu_confirmation_result_pending_color_count = pending_row_count

<!-- 同一结果判定根拠禁止同时保留问题なし和仍待确认的最终结论。 -->
fujitsu_confirmation_result_rationale_state_consistency = one_current_final_state_without_resolved_and_pending_contradiction

<!-- 待确认事项取得证据后才允许改为 OK 或 NG，并在根拠中记录证据和确认日期。 -->
fujitsu_confirmation_result_pending_resolution = evidence_then_status_update_with_confirmation_date

<!-- NG 行必须整行标红，并在根拠中完整列出与当前所见直接相关的全部已确认差异。 -->
fujitsu_confirmation_result_ng_visual_and_rationale = full_row_red_and_all_direct_confirmed_differences

<!-- OK 行不得沿用 NG 或要確認的红色、黄色状态。 -->
fujitsu_confirmation_result_ok_visual = no_ng_or_pending_fill

<!-- 交付前必须核对结果非空、根拠非空、状态数量、颜色行数、非目标工作表保全及工作簿可重新打开。 -->
fujitsu_confirmation_result_delivery_gate = populated_results_and_rationales_status_counts_color_row_counts_untouched_sheet_preservation_and_reopen

<!-- 本规则不依赖 Java 执行能力。 -->
java_ability_refs = none

<!-- 本规则不依赖 Python 执行能力。 -->
python_ability_refs = none

<!-- 本规则不依赖 Node 执行能力。 -->
node_ability_refs = none
