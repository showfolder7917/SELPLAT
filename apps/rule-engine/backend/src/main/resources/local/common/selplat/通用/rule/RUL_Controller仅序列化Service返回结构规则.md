# Controller 仅序列化 Service 返回结构规则

<!-- 问题：Service 已返回 CommonResult 或 CommonPageResult 等完整结构时，Controller 再调用响应构建方法会改变字段、层级或消息，形成重复包装。 -->
<!-- 场景：SELPLAT Controller 的 Service 方法已经返回可直接对外序列化的统一结果对象。 -->
<!-- 业务含义：Service 决定业务返回结构和内容，Controller 只完成 HTTP JSON 表达，前端看到的字段与 Service 返回对象保持一致。 -->

<!-- Service 已返回统一结果结构时，Controller 必须直接使用公共 JSON 工具序列化，不得再次调用 buildResponseJson、buildPageResponseJson 或构造另一层返回对象。 -->
selplat_controller_complete_service_result_action = JsonUtils.toJsonIgnoreNull(serviceResult)

<!-- CommonResult 的 success、data、affectedRows、msg 与异常字段由 Service 或全局异常处理器一次性生成；适用于详情、新增、更新、假删除和统一异常响应；业务含义是 Controller 不再补默认消息、模块编码、影响行数或请求路径。 -->
selplat_common_result_owner = Service

<!-- CommonResult 异常字段固定为 errorType、errorCode、requestId、stackTrace；适用于业务和系统异常；业务含义是前端只判断 success=false 与 msg，同时可按错误类型和编码执行精确交互。 -->
selplat_common_result_error_fields = errorType:String,errorCode:String,requestId:String,stackTrace:String

<!-- 成功结果的四个异常字段必须为 null，并由 JsonUtils.toJsonIgnoreNull 省略；业务含义是成功 JSON 不携带无意义错误字段。 -->
selplat_common_result_success_omits_error_fields = JsonUtils.toJsonIgnoreNull + null_error_fields

<!-- 业务异常使用 BUSINESS 类型和可展示 msg；系统异常使用 SYSTEM 类型和通用 msg；业务含义是前端可统一弹框并保留精确处理分支。 -->
selplat_common_result_error_type_contract = BUSINESS:business_message,SYSTEM:generic_system_message

<!-- stackTrace 仅 dev/test 异常响应可以赋值，prod 必须为 null 并省略；业务含义是诊断效率不以生产技术信息泄露为代价。 -->
selplat_common_result_stack_trace_profile_policy = dev_test:include,prod:omit

<!-- 公共业务异常和系统异常类型统一位于 common-core；适用于 Service、DAO 和基础设施；业务含义是下层可抛稳定异常而不反向依赖 Web。 -->
selplat_common_exception_type_owner = shared/backend/common-core:com.sp.selplat.common.exception

<!-- 全局异常处理器统一位于 common-web；适用于当前及未来应用；业务含义是应用不得重复实现同构 HTTP 错误 JSON 和堆栈开关。 -->
selplat_common_web_exception_handler_owner = shared/backend/common-web:com.sp.selplat.common.web.exception

<!-- requestId、X-Request-Id、MDC 和 HTTP 耗时日志统一位于 common-web 的 trace 包；适用于 /api/**；业务含义是静态资源不进入业务追踪，所有应用 API 使用同一关联语义。 -->
selplat_common_web_request_trace_owner = shared/backend/common-web:trace
selplat_common_web_request_trace_path = /api/**

<!-- 参数解析器和请求追踪只由 common-web 的单一 config 配置注册；适用于 Spring MVC 自动装配；业务含义是应用不得再建立同构 WebMvcConfigurer，也不为简单注册引入 SPI 或多层工厂。 -->
selplat_common_web_mvc_registration_owner = shared/backend/common-web:config
selplat_application_duplicate_common_web_registration = forbidden

<!-- CommonPageResult 的 records、totalCount、pageNo 和 pageSize 由 Service 与 DAO 查询链路生成；适用于普通分页列表；业务含义是 Controller 不再把 records 改名包装成 rows。 -->
selplat_common_page_result_owner = Service

<!-- 对外返回类型固定为 CommonResult 和 CommonPageResult，禁止业务模块创造第三种返回类型、专用响应类或嵌套 Map。 -->
selplat_fixed_response_types = CommonResult,CommonPageResult

<!-- 固定返回类型的现有字段不足时必须立即终止实现并向用户报告拟新增字段名、字段类型、放置位置、业务用途和不能复用现有字段的理由；只有用户明确确认后才能扩展公共返回类型并继续生成代码。 -->
selplat_response_field_shortage_action = stop_and_report(field_name,field_type,owner_type,business_usage,why_existing_fields_are_insufficient)
selplat_response_field_extension_requires_explicit_user_confirmation = true

<!-- 批量写入的 CommonResult.data 必须直接返回 CommonBatchParam.items，DAO 累计影响行数使用经确认新增的 CommonResult.affectedRows 顶层字段，不得构造 {affectedRows,items} 二次包装。 -->
selplat_batch_common_result_data = CommonBatchParam.items
selplat_batch_common_result_affected_rows = CommonResult.affectedRows:Integer
selplat_batch_common_result_must_not_wrap_data_map = true

<!-- Controller 直接序列化时不得修改 Service 返回对象；适用于空消息、空可选字段和分页字段；业务含义是返回结构不会因经过 HTTP 层而发生隐式变化。 -->
selplat_controller_must_not_mutate_complete_service_result = true

<!-- 公共 Controller 基类只能保留生产代码实际调用的 HTTP 公共能力；适用于清理旧参数适配器、响应包装器和兼容入口；业务含义是公共继承面不会继续暴露已退出真实请求链路的接口。 -->
selplat_base_controller_public_or_protected_api_requires_production_reference = true

<!-- 测试代码不得作为保留无生产调用旧接口的唯一依据；适用于公共 Controller 能力收敛；业务含义是测试应验证当前有效契约，而不是反向固化已经废弃的实现。 -->
selplat_tests_must_not_preserve_controller_legacy_api_without_production_usage = true
