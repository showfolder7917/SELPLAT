# SELPLAT 程序源码语言与归属门禁规则

<!-- 本规则覆盖 SELPLAT 的 apps、shared 和 rule-engine 全部正式程序源码。 -->
rule_scope = active_user_selplat_all_program_source_ownership
<!-- 当前版本建立全部程序统一的语言登记、能力归属和交付扫描门禁。 -->
rule_version = 1.2.0
<!-- 规则所有者始终由 AGENTS.md 当前稳定用户动态解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示生产扫描能力、索引和测试已经形成闭环。 -->
rule_status = active
<!-- Java 能力由现有 Gradle 模块和 rule-engine 分层源码承载。 -->
java_ability_refs = none
<!-- 全工程源码归属由当前用户 Python 能力进行可重复审计。 -->
python_ability_refs = apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/selplat_source_ownership_guard.py
<!-- 当前规则不新增 Node 专用能力。 -->
node_ability_refs = none
<!-- 本规则来自 Japanese 应用误建未参与构建的 src/main/python 后的全工程防复发修正。 -->
upgrade_record = 2026-08-09:建立SELPLAT全部程序的语言白名单_源码归属预检_用户能力分层_实验工具隔离_字节码缓存定向_公共HTTP请求输出协议复用和交付扫描门禁

## 创建前分类

<!-- 新程序创建前必须确认生产调用方、构建入口和生命周期，无法确认时禁止进入 src/main。 -->
selplat_program_source_preflight = production_caller,build_entry,lifecycle_owner
<!-- 正式应用实现、规则能力和一次性工具必须使用互斥归属，禁止以方便为由混放。 -->
selplat_program_source_classification = application_runtime|rule_engine_ability|disposable_task_tool
<!-- 一次性或失败实验程序只能进入 OPTION/temp 的任务 tools 目录，禁止残留在正式源码树。 -->
selplat_disposable_program_root = <SELPLAT_ROOT>/OPTION/temp/<application>/<task>/tools

## 应用语言登记

<!-- apps 与 shared 中的普通 Gradle 后端当前默认只登记 Java 正式源码。 -->
selplat_standard_gradle_backend_language_allowlist = java
<!-- rule-engine 是唯一登记 Java、Python、Node 三种分层能力源码的模块。 -->
selplat_rule_engine_language_allowlist = java,python,node
<!-- 新增其他语言目录必须先建立构建调用链、运行入口、测试和明确登记，禁止仅创建目录即视为支持。 -->
selplat_new_language_registration_gate = build_integration,runtime_entry,ownership_rule,automated_test
<!-- 未登记的 src/main/python、src/main/node、src/main/swift 等语言根即使为空也属于结构污染。 -->
selplat_unregistered_language_root_policy = forbidden_even_when_empty

## rule-engine 分层

<!-- rule-engine 各语言源码必须位于统一 local/code 分层根。 -->
selplat_rule_engine_source_pattern = src/main/<language>/com/sp/selplat/local/code/<layer>/
<!-- 有效层只有 core、common 和从 AGENTS.md 动态解析的当前稳定用户。 -->
selplat_rule_engine_source_layers = core,common,<active-stable-user-id>
<!-- 当前用户可复用程序必须进入当前用户 abilities，禁止散落到业务应用的未登记语言目录。 -->
selplat_active_user_reusable_program_root = apps/rule-engine/backend/src/main/<language>/com/sp/selplat/local/code/<active-stable-user-id>/abilities/

## 自动门禁

<!-- 业务应用的单条、批量和分页请求必须复用 shared 已有公共参数容器。 -->
selplat_application_http_request_contract = CommonParam,CommonBatchParam,CommonPageParam
<!-- 业务应用的非分页和分页输出必须复用 shared 已有公共结果容器。 -->
selplat_application_http_response_contract = CommonResult,CommonPageResult,CommonStoreResult
<!-- apps 中禁止新建以 Request、Response、Result、Page 或 Param 结尾的专用 HTTP 协议类。 -->
selplat_application_private_http_protocol_type_policy = forbidden
<!-- 交付前必须扫描 apps 与 shared 的语言根、构建登记、rule-engine 分层和源码污染。 -->
selplat_source_ownership_delivery_scan = language_roots,gradle_registration,rule_engine_layers,application_http_protocol_types,source_pollution
<!-- 正式源码树禁止出现 pyc、__pycache__、DS_Store 和其他生成缓存。 -->
selplat_source_tree_generated_file_policy = reject_pyc,reject_pycache,reject_DS_Store
<!-- Python 程序导入本地模块前必须将字节码缓存定向到工程 cache，禁止在源码旁生成。 -->
selplat_python_bytecode_cache_root = <SELPLAT_ROOT>/cache/python-pycache
<!-- 任一未登记语言目录、未知用户层、错误扩展名或源码缓存都会阻断任务完成。 -->
selplat_source_ownership_blocking_gate = zero_violations_required
