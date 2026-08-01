# Detailed Design XLS Rules

## 说明

- 这是详细设计 Excel 工作簿的专项规则文件
- 本文件承接“按既有日式详细设计样例生成或重写 XLS 模板与正式详细设计”的场景
- 本文件约束 sheet 拆分方式、方法定义区块、处理详细粒度、调用块写法、颜色模块语义与低耦合设计要求

## 强制规则（Mandatory）

<!-- 详细设计 Excel 不是概要说明书，而是能让实现者按页签与步骤落代码的处理详细书 -->
detailed_design_xls_is_implementation_mapping_document = true

<!-- sheet 数量必须按功能、接口契约、入口处理、错误处理和内部方法动态扩展，禁止固定套用少量样板页 -->
sheet_count_must_expand_by_function_interface_entry_error_and_internal_method = true

<!-- 批处理、API、页面调用必须分开建模：主处理可用于批处理入口或 API 框架入口，但必须在页签和概要中写清入口类型 -->
batch_api_and_page_call_design_must_use_distinct_entry_models = true

<!-- API 处理详细允许使用“01_主处理”，但含义是 API/框架入口；页面事件本身不得伪装成批处理主处理 -->
main_process_sheet_may_be_used_for_batch_or_api_framework_entry = true

<!-- API 处理详细必须采用“功能构成、接口项目规格、01_主处理、02_错误时处理、Lxx_内部方法”的页签组 -->
api_design_must_follow_function_interface_main_error_and_lxx_internal_method_sheets = true

<!-- 接口项目规格与 API 处理详细必须分开：接口项目规格写字段契约，处理详细写代码实现顺序 -->
interface_item_spec_and_api_process_detail_must_be_separate_sheet_groups = true

<!-- 页面调用链必须显式覆盖页面、前端事件、前端 API、后端 Controller、Service、DAO、Domain、数据库表/SQL 的职责边界 -->
page_call_design_must_show_screen_frontend_api_controller_service_dao_domain_db_layers = true

<!-- Java 端必须显式展现 Controller / Service / DAO / Domain 职责；逻辑较薄时可合并到同一 Lxx 方法页的调用块和映射表，不得拆成空页 -->
java_backend_layers_must_be_visible_without_creating_empty_thin_sheets = true

<!-- 前端侧必须显式展现页面事件、状态/桥接、services/API、路由/窗口跳转；逻辑较薄时可合并到同一 Lxx 页面方法页 -->
frontend_layers_must_be_visible_without_creating_empty_thin_sheets = true

<!-- 工作簿中的标题、页签、表头、字段说明和处理详细必须统一使用中文；只有源码标识符、URL、SQLID、类名、方法名允许保留原文 -->
detailed_design_workbook_must_be_chinese_except_code_identifiers = true

<!-- 功能构成页必须先定义业务功能、输入输出和方法一览，后续方法页必须与方法一览一一对应 -->
function_overview_sheet_must_define_io_and_method_catalog = true

<!-- 每个方法页必须同时包含方法定义和处理详细，不得只写标题或概述 -->
method_sheet_must_include_method_definition_and_process_detail = true

<!-- 处理详细必须写到步骤、子步骤、分支、循环、内部方法、共通部品、DAO/SQL、参数、返回值这一层 -->
process_detail_must_cover_steps_branches_loops_calls_params_returns = true

<!-- 调用内部方法、共通部品、业务部品、接口或 DB 时，必须紧跟调用块写明类别、参数、返回值和必要备注 -->
call_block_must_follow_each_internal_common_business_api_or_db_invocation = true

<!-- 详细设计中的表格不是固定摆设，而是由当前步骤语义驱动生成 -->
tables_must_be_generated_from_step_semantics_not_template_decoration = true

<!-- 参考样例中的横向合并区块是排版骨架，生成表格时必须保留横向展开布局，不得把区块拆成单列竖排单元格 -->
table_blocks_must_preserve_reference_horizontal_merged_layout = true

<!-- 功能构成页的业务功能定义、接口入输出和方法一览必须整体按横向合并表格重画，禁止把页签名、ID、名称、说明写入窄列导致竖排碎字 -->
overview_io_and_method_catalog_must_use_horizontal_merged_tables = true

<!-- 正式生成工作簿时必须把工作表视图恢复为 normal，并清除旧参考件残留的 pageBreakPreview 与无效分页线 -->
generated_workbook_sheets_must_use_normal_view_and_clear_stale_page_break_preview = true

<!-- 正式生成工作簿时必须清除旧参考件残留的冻结窗格、pane、topLeftCell 和 selection，所有 sheet 打开视窗必须定位 A1 -->
generated_workbook_sheets_must_open_at_a1_without_stale_pane_or_scroll = true

<!-- 清理内容区后，必须先按参考样例的跨度与 merged ranges 重建横向区块骨架，再写入表格内容 -->
content_reset_must_be_followed_by_reference_merge_reconstruction = true

<!-- 语义表格禁止退化为单格标签列、竖排字符列或未合并的散点单元格 -->
semantic_tables_must_not_fallback_to_single_cell_vertical_layout = true

<!-- 若方法存在多个职责段，必须继续拆成 1. / 1.1 / 1.1.1 / (1) / ① 级别，直到实现路径可对应代码 -->
process_detail_must_expand_to_code_traceable_hierarchy = true

<!-- 详细设计页应尽量写满有效内容，禁止大量保留空白占位而不展开实际处理 -->
method_sheet_must_avoid_large_unexplained_blank_areas = true

<!-- 前端页面、接口契约、后端分层实现必须按职责分离，控制低耦合；接口契约必须独立成页，薄的 Controller/Service/DAO 可在 Lxx 方法页中用调用块分层表达 -->
screen_api_backend_concerns_must_be_separated_by_contract_and_lxx_method = true

<!-- 后端任一层若存在多个复杂方法或明显子职责，必须继续按方法拆 Lxx sheet，不得在单页堆叠多个复杂方法 -->
backend_complex_logic_must_split_by_lxx_method_sheet = true

<!-- 页面页若包含多个事件或多个处理链路，必须继续按事件拆 Lxx sheet，不得把多个复杂事件挤在同一页 -->
screen_complex_logic_must_split_by_lxx_event_sheet = true

<!-- 接口项目规格若存在多个接口、不同 HTTP 动作或不同契约版本，必须继续按 IFxx 接口项目 sheet 拆分 -->
interface_item_spec_must_split_by_endpoint_method_or_contract_version = true

<!-- Controller、Service、DAO、Domain 任一层存在多个复杂方法或对象职责时，必须继续按 Lxx 方法或领域对象拆 sheet -->
backend_layer_complex_logic_must_split_by_lxx_method_or_domain_sheet = true

## 结构规则（Structure Rules）

<!-- 功能构成页用于定义功能边界、输入输出和方法目录，是整个工作簿的入口 -->
function_overview_sheet_role = overview

<!-- 功能构成页的推荐名称是“功能构成_功能名” -->
function_overview_sheet_name_should_follow_function_overview_prefix = true

<!-- API 或页面调用的内部方法页推荐以“Lxx_方法名（职责）”命名，并在方法概要中注明页面、前端 API、Controller、Service、DAO、Domain 所属层 -->
lxx_internal_method_sheet_name_should_follow_number_method_and_layer_role = true

<!-- 接口项目规格页推荐以“IFxx_接口名_接口项目”命名，并只描述接口字段契约、字段来源、必填、类型、长度和设置内容 -->
interface_item_spec_sheet_name_should_follow_ifxx_endpoint_contract = true

<!-- 不推荐把薄逻辑机械拆成“*_Controller / *_Service / *_DAO / *_Domain”空页；应优先在对应 Lxx 方法页中用调用块、DAO 块和字段映射表体现分层 -->
avoid_mechanical_empty_layer_sheet_split_for_thin_logic = true

<!-- 方法一览中的每一条记录都必须能追溯到至少一个详细页签 -->
method_catalog_entries_must_map_to_detail_sheets = true

<!-- 若业务存在主处理，主处理页必须列出主流程并显式引用其调用的 Lxx 内部方法页 -->
main_process_sheet_must_reference_called_lxx_method_sheets = true

<!-- 页面调用总览页只汇总调用链，不承载完整实现；详细实现必须落到 IFxx 接口项目页和 Lxx 方法页 -->
page_call_overview_sheet_must_only_summarize_cross_layer_flow = true

<!-- 错误时处理页必须写清前端异常、Controller 校验异常、Service 业务异常、DAO/DB 异常与响应/提示映射 -->
error_process_sheet_must_cover_frontend_controller_service_dao_exception_mapping = true

## 内容粒度规则（Detail Rules）

<!-- 方法定义区必须写明方法中文名、方法名、方法概要、参数、返回值 -->
method_definition_block_must_include_name_summary_args_and_returns = true

<!-- 处理详细中的描述必须以“做什么 + 何时做 + 调谁做 + 结果如何流转”为基本句型 -->
process_detail_sentence_must_state_action_condition_target_and_result_flow = true

<!-- 处理详细的每个编号步骤必须在编号后直接写中文说明句，禁止只出现 1. / 2. / 3. 而没有可见文字 -->
process_detail_numbered_step_must_include_visible_chinese_sentence = true

<!-- 处理详细步骤说明行必须使用横向合并单元格或足够宽的可读区域，禁止把完整步骤句写入窄列导致只显示编号 -->
process_detail_step_sentence_must_use_horizontal_readable_merged_range = true

<!-- 分支处理必须写明判断条件、进入后的动作和退出去向 -->
branch_steps_must_include_condition_action_and_exit_path = true

<!-- 循环处理必须写明循环对象、循环条件、循环内动作和终止条件 -->
loop_steps_must_include_subject_condition_body_and_exit_condition = true

<!-- 调用块中若为 DB 或 SQL 相关处理，必须补充 SQLID、锁表对象或查询目标 -->
db_call_block_must_include_sqlid_and_lock_or_target_information = true

<!-- 调用块中若为共通部品或内部方法，必须写明部品类别、方法名、输入参数、返回值和用途 -->
common_or_internal_call_block_must_include_category_method_args_returns_and_purpose = true

<!-- 接口项目规格页必须逐字段写明字段名、类型、长度、必填、来源/设置内容、备注和返回/请求方向 -->
interface_item_spec_sheet_must_cover_field_level_contract_source_and_required_rules = true

<!-- 若步骤的核心动作是对象组装、字段设值、状态回填或响应映射，应生成字段映射表，而不是套用调用块 -->
field_mapping_table_must_be_used_for_object_assembly_state_backfill_and_response_mapping = true

<!-- 若步骤仅为说明性分支、结束、继续、跳过或 return，且不存在结构化字段动作，则不得硬生成空表 -->
do_not_generate_empty_tables_for_non_structural_steps = true

<!-- 若步骤只发生内部方法/接口/DAO/共通部品调用，则优先生成调用块，不得再额外摆放无意义空表 -->
prefer_single_semantically_correct_table_per_step = true

<!-- 一个步骤内若同时存在调用和字段组装，可先写调用块，再按后续字段设值单独生成字段映射表 -->
allow_multiple_tables_only_when_step_has_multiple_real_structural_actions = true

<!-- 页面事件方法页必须写清点击、输入、状态同步、跳转和 URL/参数桥接，不得只写“调用接口” -->
screen_method_sheet_must_describe_event_state_transition_navigation_and_bridge_parameters = true

<!-- API 处理方法页必须写清路由、HTTP 动作、入参、返回体、Controller 到 Service 的调用、异常前置校验和响应封装 -->
api_process_method_sheet_must_describe_route_http_contract_service_and_validation = true

<!-- Service/DAO 处理必须写清校验、查询、组装、分支、返回和 DAO/SQL/内部函数调用顺序，可放在对应 Lxx 方法页 -->
backend_lxx_method_must_describe_validation_query_assembly_branch_return_and_invocation_order = true

## 低耦合设计规则（Low Coupling Rules）

<!-- 详细设计必须主动体现低耦合：页面层负责触发与桥接，前端 API 负责 HTTP 封装，Controller 负责路由，Service 负责业务，DAO 负责 SQL，Domain 负责字段边界 -->
design_must_explicitly_enforce_low_coupling_by_layer = true

<!-- 页面事件页不得直接承载后端实现细节，只能引用前端 API、接口契约或后续分层页 -->
screen_sheet_must_not_embed_backend_implementation_details = true

<!-- 接口页不得混入多个后端方法的详细流程，只能说明接口契约与入口职责 -->
api_sheet_must_not_embed_multiple_backend_method_details = true

<!-- 后端页应优先通过拆分内部方法、共通函数和 DTO/VO 约束来降低耦合 -->
backend_design_should_reduce_coupling_via_internal_method_and_contract_split = true

<!-- 页面调用链必须通过 DTO/输入输出对象隔离层间依赖：页面不得依赖 DAO，Controller 不得直接访问数据库，DAO 不得包含业务分支 -->
page_call_layers_must_be_decoupled_by_contract_objects = true

<!-- 低耦合不是把每一层拆成空 sheet；必须以接口契约、Lxx 内部方法、调用块和字段映射表表现层间边界 -->
low_coupling_must_be_expressed_by_contract_lxx_call_blocks_and_mapping_tables = true

## 颜色模块规则（Color Module Rules）

<!-- 颜色模块必须按参考样例语义使用，禁止为了好看随意换色或混用 -->
color_modules_must_follow_reference_semantics = true

<!-- 深蓝模块用于文档页头、系统名、子系统名、功能名、版本、日期等文档元数据 -->
dark_blue_module_is_document_metadata_header = true

<!-- 浅蓝模块用于方法定义、接口输入输出、字段映射、业务固有对象、DAO/DB/SQL、Domain 对象和数据表相关块 -->
light_blue_module_is_definition_mapping_business_specific_db_or_domain = true

<!-- 绿色模块用于业务共通部品、跨层业务调用、Controller 调 Service、Service 调共通业务能力等业务共通调用块 -->
green_module_is_business_common_or_cross_layer_business_call = true

<!-- 黄色模块用于系统共通部品、框架、浏览器 API、日志、异常、URL/window/fetch 等系统或平台共通能力 -->
yellow_module_is_system_common_framework_browser_log_exception = true

<!-- 生成调用块或映射表前必须先判定模块语义，再选择颜色；颜色选择应写入设计规则和模板说明，不能由生成脚本随机决定 -->
block_color_must_be_selected_from_semantic_category_before_rendering = true

## 模板使用规则（Template Rules）

<!-- 正式模板的作用是复用样式、页头和表格骨架，不是固定业务页签数量 -->
template_is_style_and_structure_skeleton_not_fixed_sheet_count = true

<!-- 模板必须区分批处理模板、API/页面调用模板；批处理和 API 都可有主处理，但 API 主处理必须是框架入口并配套 IFxx 与 Lxx 页签 -->
template_must_separate_batch_and_api_page_call_template = true

<!-- 模板可保留表格样式类型示例，但正式生成时必须先清除无意义占位表格，再按步骤语义动态插入 -->
template_may_keep_block_style_samples_but_generated_workbook_must_remove_unused_placeholder_tables = true

<!-- 重画表格时应优先复用参考件的列跨度、合并区和横向区块节奏，不得随意缩成单格标签列 -->
redrawn_tables_should_follow_reference_span_merge_and_horizontal_rhythm = true

<!-- 调用块和字段映射表必须以参考样例的 merged ranges 为权威骨架，不能只复制边框或底色 -->
call_and_mapping_blocks_must_use_reference_merged_ranges_as_layout_source = true

<!-- 生成完成后必须校验关键调用块和字段映射表的 merged ranges 是否存在，不能只验证有内容 -->
generated_workbook_must_validate_expected_merged_ranges = true

<!-- 生成完成后必须校验不存在“有边框或底色但无值”的空表残留，并同时校验未出现竖排回退 -->
generated_workbook_must_validate_no_empty_styled_rows_and_no_vertical_fallback = true

<!-- 详细设计工作簿生成完成后必须执行结构检查和可视化预览验证；适用于所有正式详细设计 xlsx 成品；业务含义是避免只导出文件不核对模板贴合度 -->
detailed_design_xls_must_run_post_generation_structure_and_visual_verification = true

<!-- 详细设计工作簿验证时必须检查系统名、功能名、页签名和示例文本都已替换为当前项目内容；适用于模板复制生成场景；业务含义是防止旧系统或示例业务残留 -->
detailed_design_xls_must_verify_project_metadata_and_remove_sample_text = true

<!-- 生成正式详细设计时，应优先从 ai/rule/template 默认模板复制，再按实际功能增删重命名 sheet -->
generation_should_copy_default_template_then_rename_and_expand_sheets = true

<!-- 若参考样例已存在更高密度的日式写法，应优先向参考样例的粒度和排版靠拢 -->
prefer_reference_japanese_style_density_and_layout_when_available = true

## 使用说明（Usage Notes）

- 当任务是生成、重写或修复详细设计 Excel 成品时，除本规则外，应同时加载 `common_rules/xls_output_test_rules.md` 做生成后验收。
- 详细设计工作簿的生成后验收至少应覆盖 sheet 结构检查、关键区域值检查和关键页预览或截图验证。
