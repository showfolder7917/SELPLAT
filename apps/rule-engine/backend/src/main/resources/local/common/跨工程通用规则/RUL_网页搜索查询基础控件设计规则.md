# 网页搜索查询基础控件设计规则

<!-- 问题：搜索输入框写死在面板或表格内部并监听每次输入后，无法配置查询按钮、后端提交时机、多语言文案和同页多实例隔离。 -->
<!-- 场景：网页工具栏、列表、树表和业务管理页需要关键词搜索，并需要明确的查询按钮、Enter、清空、加载状态和未来后端查询能力。 -->
<!-- 业务含义：搜索结构与交互由独立基础控件提供；业务表格只响应所属实例的标准提交事件，应用装配层提供本地化配置。 -->

web_search_component_directory = static/sel/components/search/
web_search_component_javascript_file = selSearch.js
web_search_component_style_file = selSearch.css
web_search_component_public_api = window.selSearch
web_search_component_mount = selSearch.mount(business-instance-root,search-payload)
web_search_component_registry_key = complete-business-instance-key

<!-- 面板只声明搜索宿主，搜索基础控件负责创建原生语义结构。 -->
web_search_panel_owned_structure = host-only
web_search_component_required_native_elements = form[role=search],input[type=search],button[type=submit]
web_search_component_configurable_elements = label,placeholder,search-icon,clear-button,submit-button,button-label,button-icon
web_search_component_clear_button_visibility = visible-only-when-keyword-exists
web_search_component_submit_button_required = true

<!-- 查询提交必须由明确动作触发；输入过程默认只改变输入值，不直接执行数据查询。 -->
web_search_default_submit_triggers = submit-button,Enter
web_search_input_event_default_query_is_forbidden = true
web_search_submit_on_enter_must_be_configurable = true
web_search_submit_on_clear_must_be_configurable = true
web_search_allow_empty_and_trim_must_be_configurable = true
web_search_loading_state_must_prevent_duplicate_submit = true

<!-- 搜索控件不请求接口、不筛选表格，只广播带完整实例键和关键词的稳定事件。 -->
web_search_component_direct_api_request_is_forbidden = true
web_search_component_direct_grid_filter_is_forbidden = true
web_search_submit_event = selSearch:submit
web_search_submit_event_detail = gridId,keyword
web_search_consumer_must_verify_instance_key = true

<!-- 每个业务控件拥有独立本地化 search JSON，按钮名称可按业务使用查询、搜索或其他语言表达。 -->
web_search_payload_file_pattern = <BusinessControlInstance>.search.json
web_search_payload_localized = true
web_search_payload_required_fields = label,placeholder,buttonLabel,clearLabel
web_search_payload_optional_fields = icon,buttonIcon,clearIcon,defaultValue,clearable,submitOnEnter,submitOnClear,allowEmpty,trim
web_search_base_component_fixed_application_copy_is_forbidden = true

<!-- 验收必须覆盖点击、Enter、清空、空值、加载态、多语言和两个实例互不影响。 -->
web_search_qa_must_cover = button-submit,enter-submit,clear-submit,empty-policy,loading-state,locales,multi-instance,isolation,browser-console

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none
