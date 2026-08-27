# Fujitsu 基本设计 Excel 生成规则

<!-- 基本设计 Excel 生成统一调用当前用户 Python 工作簿能力。 -->
python_ability_refs = apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/fujitsu_excel_tools.py
<!-- 当前基本设计生成不再使用 Java 能力。 -->
java_ability_refs = none
<!-- 当前基本设计生成不使用Node程序；业务含义是避免多语言生成结果发生格式漂移。 -->
node_ability_refs = none

## 适用范围

<!-- 本规则适用于Fujitsu工程的API概要与接口项目规格基本设计；业务含义是BAT和详细设计模板不得混入SBMAA编号成果。 -->
fujitsu_basic_design_excel_scope = api_overview
<!-- fujitsu_basic_design_excel_scope.2 的当前独立事实为 interface_item_specification。 -->
fujitsu_basic_design_excel_scope.2 = interface_item_specification
<!-- API编号、BAT编号和文件编号必须按模板标题及正式工程编号区分；业务含义是SBMAA、SBMAB和SBMAF不得互相套用。 -->
fujitsu_basic_design_document_id_families = API:SBMAA
<!-- fujitsu_basic_design_document_id_families.2 的当前独立事实为 BAT:SBMAB。 -->
fujitsu_basic_design_document_id_families.2 = BAT:SBMAB
<!-- fujitsu_basic_design_document_id_families.3 的当前独立事实为 FILE:SBMAF。 -->
fujitsu_basic_design_document_id_families.3 = FILE:SBMAF

## 事实来源与草案边界

<!-- 业务内容必须来自事象、需求流程、业务处理详细、共通规则和正式接口资料；业务含义是模板旧内容只能提供版式，不能作为新业务事实。 -->
fujitsu_basic_design_business_fact_sources = issue
<!-- fujitsu_basic_design_business_fact_sources.2 的当前独立事实为 requirement_flow。 -->
fujitsu_basic_design_business_fact_sources.2 = requirement_flow
<!-- fujitsu_basic_design_business_fact_sources.3 的当前独立事实为 business_process_description。 -->
fujitsu_basic_design_business_fact_sources.3 = business_process_description
<!-- fujitsu_basic_design_business_fact_sources.4 的当前独立事实为 common_rule。 -->
fujitsu_basic_design_business_fact_sources.4 = common_rule
<!-- fujitsu_basic_design_business_fact_sources.5 的当前独立事实为 approved_interface_contract。 -->
fujitsu_basic_design_business_fact_sources.5 = approved_interface_contract
<!-- 模板内旧项目的系统名、业务名、ID、接口、文件、表和图形文字必须清理或替换；业务含义是生成结果不得残留参考项目语义。 -->
fujitsu_basic_design_template_stale_business_content_policy = remove_or_replace_all
<!-- 正式ID、URI、HTTP、字段、错误码、文件物理定义或日志规格缺失时统一使用日语待确认标记；业务含义是草案不得把推测伪装成设计事实。 -->
fujitsu_basic_design_unconfirmed_marker = 未確定（要確認）
<!-- 暂定、未确定、要确认和需要详细设计确认的内容必须使用红色字体，并保留模板其他样式；业务含义是客户评审时能够直接识别所有尚未定稿事项。 -->
fujitsu_basic_design_review_marker_visual_policy = red_font
<!-- fujitsu_basic_design_review_marker_visual_policy.2 的当前独立事实为 preserve_template_border_fill_alignment。 -->
fujitsu_basic_design_review_marker_visual_policy.2 = preserve_template_border_fill_alignment
<!-- 用户明确指定目标API与参考处理详细采用同一处理方式时，可以采用上下文取得、文件路径组合、压缩、日志和响应等共通流程；业务含义是处理方式复用具有明确授权依据。 -->
fujitsu_basic_design_reference_processing_adoption_condition = explicit_user_same_processing_authorization
<!-- 采用参考处理方式不得复制参考API专属文件常量名、ZIP文件名、接口ID或消息代码；业务含义是共通流程可以确认，但目标契约仍须以待确认标记隔离。 -->
fujitsu_basic_design_reference_processing_exclusion = reference_specific_file_constants
<!-- fujitsu_basic_design_reference_processing_exclusion.2 的当前独立事实为 zip_filename。 -->
fujitsu_basic_design_reference_processing_exclusion.2 = zip_filename
<!-- fujitsu_basic_design_reference_processing_exclusion.3 的当前独立事实为 interface_ids。 -->
fujitsu_basic_design_reference_processing_exclusion.3 = interface_ids
<!-- fujitsu_basic_design_reference_processing_exclusion.4 的当前独立事实为 message_codes。 -->
fujitsu_basic_design_reference_processing_exclusion.4 = message_codes

## 分栏、方法与详细设计追踪

<!-- 基本设计的一个处理分栏只对应一个业务方法；业务含义是概要流程中的业务动作具备单一实现职责。 -->
fujitsu_basic_design_section_to_method_cardinality = one_section_to_one_method
<!-- 每个业务方法只对应详细设计中的一个Sheet；业务含义是基本设计到详细设计能够按处理ID一对一追踪。 -->
fujitsu_basic_design_method_to_detail_sheet_cardinality = one_method_to_one_detail_sheet
<!-- 暂定编号必须显式标记且不得被后续代码直接视为正式接口；业务含义是SBMAA9xx-001等只用于草案追踪。 -->
fujitsu_basic_design_provisional_trace_id_policy = explicit_draft_marker_and_formal_confirmation_required

## 模板保持与输出

<!-- 业务单元格、文件清单、图形替换和评审标识必须保存在独立UTF-8 JSON中；业务含义是Python生成器只负责解释模板和数据，不得硬编码具体API的设计内容。 -->
fujitsu_basic_design_generator_data_separation = python_engine_plus_independent_utf8_json
<!-- JSON必须声明参考模板、生成目标、业务内容和待确认标识；业务含义是单次生成的输入输出与评审范围可以不读Python代码而完整审查。 -->
fujitsu_basic_design_json_contract = template
<!-- fujitsu_basic_design_json_contract.2 的当前独立事实为 output。 -->
fujitsu_basic_design_json_contract.2 = output
<!-- fujitsu_basic_design_json_contract.3 的当前独立事实为 cells。 -->
fujitsu_basic_design_json_contract.3 = cells
<!-- fujitsu_basic_design_json_contract.4 的当前独立事实为 related_files。 -->
fujitsu_basic_design_json_contract.4 = related_files
<!-- fujitsu_basic_design_json_contract.5 的当前独立事实为 drawing_replacements。 -->
fujitsu_basic_design_json_contract.5 = drawing_replacements
<!-- fujitsu_basic_design_json_contract.6 的当前独立事实为 review_markers。 -->
fujitsu_basic_design_json_contract.6 = review_markers

<!-- 生成器必须保留模板合并单元格、样式、图形、公式、分页和打印区域；业务含义是业务内容变化不能破坏客户设计书版式。 -->
fujitsu_basic_design_template_structure_must_preserve = merged_cells
<!-- fujitsu_basic_design_template_structure_must_preserve.2 的当前独立事实为 styles。 -->
fujitsu_basic_design_template_structure_must_preserve.2 = styles
<!-- fujitsu_basic_design_template_structure_must_preserve.3 的当前独立事实为 drawings。 -->
fujitsu_basic_design_template_structure_must_preserve.3 = drawings
<!-- fujitsu_basic_design_template_structure_must_preserve.4 的当前独立事实为 formulas。 -->
fujitsu_basic_design_template_structure_must_preserve.4 = formulas
<!-- fujitsu_basic_design_template_structure_must_preserve.5 的当前独立事实为 page_breaks。 -->
fujitsu_basic_design_template_structure_must_preserve.5 = page_breaks
<!-- fujitsu_basic_design_template_structure_must_preserve.6 的当前独立事实为 print_area。 -->
fujitsu_basic_design_template_structure_must_preserve.6 = print_area
<!-- 模板中的旧业务图形文字必须在原图形内替换；业务含义是既保留流程图视觉结构又避免残留无关项目。 -->
fujitsu_basic_design_drawing_text_policy = replace_business_text_preserve_geometry
<!-- 替换图形文字后必须显式设置与图形底色可辨识的字体颜色，再对待确认图形覆盖红色；业务含义是模板继承的浅色主题字体不得造成已写内容视觉空白。 -->
fujitsu_basic_design_drawing_text_visibility_policy = explicit_readable_base_font_color_then_review_red_override
<!-- 生成器不得为容纳长正文而拉高模板行、改变列宽或缩小模板正文字号；业务含义是内容补全不能造成客户模板整体比例变形。 -->
fujitsu_basic_design_template_geometry_policy = preserve_source_row_heights
<!-- fujitsu_basic_design_template_geometry_policy.2 的当前独立事实为 preserve_source_column_widths。 -->
fujitsu_basic_design_template_geometry_policy.2 = preserve_source_column_widths
<!-- fujitsu_basic_design_template_geometry_policy.3 的当前独立事实为 preserve_source_body_font_size。 -->
fujitsu_basic_design_template_geometry_policy.3 = preserve_source_body_font_size
<!-- 处理概要只写可在模板单行内表达的取得规则，完整ID、名称和逐文件条件写入同一Sheet的相关文件一览；业务含义是信息完整性通过概要与一览共同满足，而不是把全部明细挤进处理区。 -->
fujitsu_basic_design_long_detail_placement_policy = concise_process_summary_plus_complete_related_file_list
<!-- 多个相关文件必须在一览中逐文件占一行；业务含义是15个下载对象均能单独追踪文件ID和缺失物理定义。 -->
fujitsu_basic_design_related_file_row_policy = one_file_one_row
<!-- Python生成结果必须进入JSON明确指定的当前工程OPTION子目录；业务含义是原模板保持只读，并允许按任务约定交付至OPTION/create或生成至OPTION/temp。 -->
fujitsu_basic_design_generated_output_root = json_declared_current_project_OPTION_subdirectory

## 验证

<!-- 交付前必须在项目配置的解释器中加载并实际运行Python生成器；业务含义是源码存在不代表工作簿能够生成。 -->
fujitsu_basic_design_python_generator_verification = configured_python_import_and_execute
<!-- 工作簿验证必须覆盖可打开性、Sheet、日语内容、旧业务残留、待确认标记及红色、已确认内容未误标、合并区域、图形和打印范围；业务含义是结构、业务语义和评审状态同时可证明。 -->
fujitsu_basic_design_workbook_verification = openable
<!-- fujitsu_basic_design_workbook_verification.2 的当前独立事实为 sheet_contract。 -->
fujitsu_basic_design_workbook_verification.2 = sheet_contract
<!-- fujitsu_basic_design_workbook_verification.3 的当前独立事实为 japanese_content。 -->
fujitsu_basic_design_workbook_verification.3 = japanese_content
<!-- fujitsu_basic_design_workbook_verification.4 的当前独立事实为 no_stale_business_text。 -->
fujitsu_basic_design_workbook_verification.4 = no_stale_business_text
<!-- fujitsu_basic_design_workbook_verification.5 的当前独立事实为 unconfirmed_markers_red。 -->
fujitsu_basic_design_workbook_verification.5 = unconfirmed_markers_red
<!-- fujitsu_basic_design_workbook_verification.6 的当前独立事实为 confirmed_content_not_red。 -->
fujitsu_basic_design_workbook_verification.6 = confirmed_content_not_red
<!-- fujitsu_basic_design_workbook_verification.7 的当前独立事实为 merged_regions。 -->
fujitsu_basic_design_workbook_verification.7 = merged_regions
<!-- fujitsu_basic_design_workbook_verification.8 的当前独立事实为 drawings。 -->
fujitsu_basic_design_workbook_verification.8 = drawings
<!-- fujitsu_basic_design_workbook_verification.9 的当前独立事实为 print_area。 -->
fujitsu_basic_design_workbook_verification.9 = print_area
