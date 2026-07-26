# Controller 仅序列化 Service 返回结构规则

<!-- 问题：Service 已返回 CommonResult 或 CommonPageResult 等完整结构时，Controller 再调用响应构建方法会改变字段、层级或消息，形成重复包装。 -->
<!-- 场景：SELPLAT Controller 的 Service 方法已经返回可直接对外序列化的统一结果对象。 -->
<!-- 业务含义：Service 决定业务返回结构和内容，Controller 只完成 HTTP JSON 表达，前端看到的字段与 Service 返回对象保持一致。 -->

<!-- Service 已返回统一结果结构时，Controller 必须直接使用公共 JSON 工具序列化，不得再次调用 buildResponseJson、buildPageResponseJson 或构造另一层返回对象。 -->
selplat_controller_complete_service_result_action = JsonUtils.toJsonIgnoreNull(serviceResult)

<!-- CommonResult 的 success、data、affectedRows 和 msg 由 Service 一次性生成；适用于详情、新增、更新和假删除；业务含义是 Controller 不再补默认消息、模块编码、影响行数或请求路径。 -->
selplat_common_result_owner = Service

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
