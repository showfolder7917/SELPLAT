# 网页业务控件后端聚合 JSON 与国际化规则

<!-- 问题：表格、树、菜单、分页和下拉框数据写死在前端脚本后，后端无法统一下发，语言切换会污染稳定业务代码，多个业务实例也难以复用同一数据契约。 -->
<!-- 场景：通用增删改查表格及其标题、列、树、菜单、分页和筛选下拉框由后端提供，并需要支持中文、日文、英文及后续语言扩展。 -->
<!-- 业务含义：业务实例拥有一套可追踪的数据片段；静态页面用多 JSON 验证字段边界，生产环境由后端单接口一次返回相同聚合结构。 -->

business_control_payload_group_directory = <BusinessControlInstance>/
business_control_payload_file_pattern = <BusinessControlInstance>.<business-part>.json
business_control_payload_allowed_parts = data,column,tree,title,search,menu,pagination,select.<select-name>
business_control_backend_payload_schema_or_config_suffix_is_forbidden = true

<!-- 行数据保存稳定业务值；面向用户的列名、状态名、菜单名、分页单位和下拉文字按 locale 返回。 -->
business_control_payload_stable_data_file = <BusinessControlInstance>.data.json
business_control_payload_localized_directory_pattern = <locale>/
business_control_payload_localized_parts = column,tree,title,search,menu,pagination,select.<select-name>
business_control_payload_stable_codes_must_not_change_with_locale = true
business_control_payload_filter_match_field = stable-code
business_control_payload_display_field = localized-label

<!-- 每一个选择下拉框独占一份业务 JSON，避免类型、状态和每页条数复用时发生字段覆盖。 -->
business_control_select_payload_file_pattern = <BusinessControlInstance>.select.<select-name>.json
business_control_select_payload_one_file_per_control = true
business_control_select_option_required_fields = value,label
business_control_select_option_value_semantics = stable-business-code

<!-- 生产页面只消费后端聚合对象；静态多文件请求仅作为数据契约样例和无后端演示，不得成为生产网络协议。 -->
business_control_production_api_shape = one-aggregated-response-per-business-control
business_control_static_fragment_fetch_usage = fixture-and-contract-demo-only
business_control_aggregate_required_parts = data,column,tree,title,search,menu,pagination,select
business_control_incomplete_payload_must_block_initialization = true

<!-- 应用装配层负责请求、语言选择和实例映射；基础控件只消费聚合结果，不自行猜测文件名、实体或语言。 -->
business_control_payload_owner = application-assembler
business_control_base_component_input = aggregated-payload
business_control_base_component_direct_business_json_fetch_is_forbidden = true
business_control_instance_source_mapping_must_be_explicit = true
business_control_shared_source_state_must_remain_instance_isolated = true

<!-- 国际化目录允许继续增加语言；不支持的 locale 必须采用显式回退策略，不能混合显示多种界面语言。 -->
business_control_locale_code_pattern = BCP-47
business_control_locale_default_must_be_explicit = true
business_control_locale_fallback_must_be_explicit = true
business_control_localized_payload_required_for_each_supported_locale = true
business_control_stable_data_may_contain_backend_business_names = true

<!-- 涉及“当前值、选择、展开、收起”等语序差异的可访问文案必须由 locale JSON 提供完整模板，基础控件只替换占位符。 -->
business_control_localized_accessibility_sentence_owner = localized-payload
business_control_localized_sentence_template_examples = {label}，当前：{value}|{label},current:{value}|{label}、現在：{value}
business_control_base_component_fixed_language_sentence_fragment_is_forbidden = true
business_control_i18n_template_placeholders_must_be_language_neutral = label,value

<!-- JSON 不允许注释；字段、来源、生产接口和扩展方法统一写入数据组目录 README。 -->
business_control_json_comments_are_forbidden_by_standard = true
business_control_payload_documentation_file = README.md
business_control_payload_documentation_language = project-primary-language

<!-- 验收同时覆盖 JSON 完整性、至少三种语言、稳定代码筛选、两个实例隔离和浏览器控制台错误。 -->
business_control_payload_qa_must_cover = json-parse,localized-parts,stable-code-filter,multi-instance-isolation,browser-console
business_control_payload_i18n_qa_minimum_locales = 3

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
