# Excel 修订履历填写规则

<!-- 当前规则只约束工作簿修订语义，不提供Java自动化入口。 -->
java_ability_refs = none
<!-- 不同客户工作簿的履历位置和合并结构不同，当前不建立会猜测单元格位置的Python程序。 -->
python_ability_refs = none
<!-- 当前规则不涉及Node处理。 -->
node_ability_refs = none
<!-- 本规则从用户发现全部Sheet误填履历和履历字体不可见的问题开始记录版本。 -->
rule_version = 1.2.0
<!-- 规则所有者始终来自工程根 AGENTS.md 的当前稳定用户声明。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示该规则已由当前用户叶子索引登记。 -->
rule_status = active

<!-- 问题：局部修正工作簿时把版数、更新日和更新者写入所有Sheet，会伪造未修改Sheet的修订记录；沿用空白占位格的白色字体还会造成履历肉眼不可见。 -->
<!-- 场景：当前稳定用户要求 AI 修正既有 Excel，并使用删除线、红字和 Sheet 头部履历表达修订。 -->
<!-- 业务含义：履历必须准确指向真实修改的Sheet，且审查者打开Excel即可看到修订人和日期。 -->

<!-- 只有本次实际发生内容、公式或修订标识变化的Sheet才允许填写本次版数、更新日和更新者。 -->
excel_revision_history_write_scope = actually_modified_worksheets_only
<!-- 未修改Sheet的版数、更新日、更新者、值和显示样式必须保持源文件原样。 -->
excel_unmodified_sheet_history_policy = preserve_source_value_and_style_exactly
<!-- 实际修改包括业务内容变化以及用户明确要求的既存红字转黑、删除线或新增红字。 -->
excel_modified_sheet_definition = content_change
<!-- excel_modified_sheet_definition.2 的当前独立事实为 formula_change。 -->
excel_modified_sheet_definition.2 = formula_change
<!-- excel_modified_sheet_definition.3 的当前独立事实为 user_requested_revision_marker_change。 -->
excel_modified_sheet_definition.3 = user_requested_revision_marker_change
<!-- 履历位置必须从目标Sheet自身的既有标题栏识别，禁止把某个Sheet的坐标批量套用到全部Sheet。 -->
excel_revision_history_position_policy = resolve_from_each_actually_modified_sheet_header_only
<!-- 版号、更新日和更新者属于本次修改履历，必须统一使用与背景有充分对比度的红字。 -->
excel_revision_history_visibility_policy = revision_red_font_for_version_update_date_updater
<!-- excel_revision_history_visibility_policy.2 的当前独立事实为 visible_contrast。 -->
excel_revision_history_visibility_policy.2 = visible_contrast
<!-- 空白占位单元格的字体可能为白色，写值后必须显式核对实际字体颜色，禁止只赋值不验证显示。 -->
excel_blank_placeholder_style_reuse_requires = explicit_font_color_visibility_verification
<!-- 既有XLSX禁止通过字符串或XML节点拼接修改单元格，必须使用能够原生读写工作簿模型的Excel或Apache POI。 -->
excel_cell_edit_implementation_policy = native_excel_or_apache_poi
<!-- excel_cell_edit_implementation_policy.2 的当前独立事实为 no_manual_ooxml_cell_splicing。 -->
excel_cell_edit_implementation_policy.2 = no_manual_ooxml_cell_splicing
<!-- 修订表现采用旧内容删除线、本次新增内容红字；源文件既存红字仅在用户明确要求时转黑。 -->
excel_revision_marker_policy = old_content_strikethrough
<!-- excel_revision_marker_policy.2 的当前独立事实为 new_content_red。 -->
excel_revision_marker_policy.2 = new_content_red
<!-- excel_revision_marker_policy.3 的当前独立事实为 existing_red_to_black_only_when_explicitly_requested。 -->
excel_revision_marker_policy.3 = existing_red_to_black_only_when_explicitly_requested
<!-- 交付前必须逐个实际修改Sheet核对红字、删除线、版数、更新日、更新者和字体可见性。 -->
excel_modified_sheet_verification = revision_markers
<!-- excel_modified_sheet_verification.2 的当前独立事实为 version。 -->
excel_modified_sheet_verification.2 = version
<!-- excel_modified_sheet_verification.3 的当前独立事实为 update_date。 -->
excel_modified_sheet_verification.3 = update_date
<!-- excel_modified_sheet_verification.4 的当前独立事实为 updater。 -->
excel_modified_sheet_verification.4 = updater
<!-- excel_modified_sheet_verification.5 的当前独立事实为 font_visibility。 -->
excel_modified_sheet_verification.5 = font_visibility
<!-- 交付前必须证明未修改Sheet的履历与源文件一致，并检查工作簿可打开性。 -->
excel_unmodified_sheet_and_workbook_verification = source_history_equality
<!-- excel_unmodified_sheet_and_workbook_verification.2 的当前独立事实为 workbook_openability。 -->
excel_unmodified_sheet_and_workbook_verification.2 = workbook_openability
<!-- excel_unmodified_sheet_and_workbook_verification.3 的当前独立事实为 package_integrity。 -->
excel_unmodified_sheet_and_workbook_verification.3 = package_integrity

<!-- 客户Excel版式各异且已有真实源文件，不创建会复制或伪造版式的通用模板。 -->
template_not_applicable_reason = customer_workbook_layouts_are_task_specific_and_source_workbook_is_authoritative
<!-- 当前项番615源文件和修正版是任务材料而非稳定规则资产，不复制二进制作为规则案例。 -->
example_not_applicable_reason = task_workbooks_are_not_stable_rule_assets_and_must_not_be_duplicated
<!-- 履历坐标与实际修改Sheet需要业务语义判断，未达到无猜测自动化阈值。 -->
program_not_applicable_reason = worksheet_change_scope_and_header_coordinates_require_task_specific_semantic_verification
<!-- 验证以源文件逐Sheet履历比较、修订标识检查、字体颜色检查和工作簿可打开性为准。 -->
verification_contract = compare_history_by_sheet
<!-- verification_contract.2 的当前独立事实为 check_revision_markers。 -->
verification_contract.2 = check_revision_markers
<!-- verification_contract.3 的当前独立事实为 check_visible_font_color。 -->
verification_contract.3 = check_visible_font_color
<!-- verification_contract.4 的当前独立事实为 verify_openable_workbook。 -->
verification_contract.4 = verify_openable_workbook
