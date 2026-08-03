# Java 业务注释与返回示例规则

java_ability_refs = none
python_ability_refs = none
node_ability_refs = none

## 说明

<!-- 问题：只描述类型或语法动作的注释无法让调用方直接判断参数如何流转、方法最终返回什么、数据库状态如何变化。 -->
<!-- 场景：SELPLAT shared、apps 当前及未来应用中的 Java 新增、修改、删除、重构、代码生成、模板生成和代码审核。 -->
<!-- 业务含义：以 BaseDaoSupportImpl 的“输入事实 → 中间结果 → 实际输出示例”风格统一 Java 注释，使调用方不阅读实现也能理解真实返回结构。 -->

selplat_java_business_comment_reference = shared/backend/common-db/src/main/java/com/sp/selplat/common/db/dao/BaseDaoSupportImpl.java
selplat_java_business_comment_scope = shared/**/*.java,apps/**/*.java

## 类、字段和逐行业务注释

<!-- 类级 Javadoc 必须说明该类在业务调用链中的职责和边界，禁止只重复类名；业务含义是调用方可以判断该类负责解析、编排、持久化、转换还是返回。 -->
selplat_java_class_javadoc_must_describe_business_role_and_boundary = true

<!-- 常量、状态字段和注入依赖必须说明它们服务的业务动作及最终使用位置；业务含义是字段注释必须回答“为什么存在”，不能只翻译变量名。 -->
selplat_java_field_comment_must_describe_business_purpose = true

<!-- 关键赋值、条件分支、异常、循环、字段映射、接口调用、SQL 执行和返回动作必须使用相邻业务注释覆盖；业务含义是实现流程可以按注释独立复核。 -->
selplat_java_line_business_comment_required_for = key_assignment,condition,exception,loop,data_mapping,interface_call,persistence,return

<!-- 同一不可拆分业务动作允许用一条注释覆盖紧邻多行，禁止为了形式机械重复每一行；业务含义是注释密度服从业务步骤而不是语法行数。 -->
selplat_java_comment_grouping = one_comment_for_one_indivisible_business_action

<!-- import 不需要注释，普通括号、简单 getter/setter 和没有额外业务含义的语法结构不得堆砌空洞说明。 -->
selplat_java_comment_excluded_syntax = import,plain_brace,trivial_getter_setter,syntax_only_statement

## 参数与实际结果示例

<!-- 公开和受保护方法的 Javadoc 必须描述每个参数来自哪里、代表什么以及实际输入示例；业务含义是 CommonParam、Map 等动态类型也能直接看出允许字段。 -->
selplat_java_param_javadoc_must_include = source,business_meaning,actual_example

<!-- 所有非 void 公开和受保护方法的 @return 必须给出实际结果示例；业务含义是调用方无需推测 Map、List、实体、SQL 字符串或公共结果对象的具体内容。 -->
selplat_java_non_void_public_or_protected_return_must_have_actual_example = true

<!-- 返回 Map、List、数组、实体、元数据、动态字段、主键定义、SQL 字符串、CommonResult 或 CommonPageResult 时必须展示完整可识别结构。 -->
selplat_java_return_example_mandatory_types = Map,List,array,entity,metadata,dynamic_fields,id_definition,sql_string,CommonResult,CommonPageResult

<!-- void 写入方法必须在方法说明中给出实际副作用示例；业务含义是没有返回值也必须说明最终插入、更新、假删除、发送或文件生成结果。 -->
selplat_java_void_method_must_describe_actual_side_effect_example = true

<!-- 异常分支必须说明触发条件和实际异常示例；业务含义是调用方可以区分未找到、非法字段、配置缺失和数据库失败。 -->
selplat_java_exception_comment_must_include_trigger_and_example = true

## 示例格式

<!-- 方法返回示例必须与真实 Java 类型、字段名、大小写和现有返回层级一致，禁止虚构字段或创建未批准的新返回结构。 -->
selplat_java_return_example_must_match_real_contract = java_type,field_name,case,response_level

<!-- 示例禁止使用 xxx、foo、bar、data1 或省略号代替关键结构；业务含义是示例必须能够直接回答“返回什么”。 -->
selplat_java_return_example_forbidden_placeholder = xxx,foo,bar,data1,ellipsis_for_required_fields

<!-- 运行时动态值允许使用带业务意义的稳定说明，例如“运行时随机UUID”或“数据库生成时间”，但字段名和结构必须真实。 -->
selplat_java_dynamic_value_example_policy = real_structure_with_business_meaningful_runtime_value

<!-- 行内业务注释优先使用“输入或动作 → 实际结果”形式；业务含义是中间转换前后内容一眼可见。 -->
selplat_java_line_comment_result_notation = input_or_action -> actual_result

<!-- Map 示例使用真实键值；单主键与复合主键必须分别展示，不能只写 Map<String,Object>。 -->
selplat_java_map_return_example = {"id":1,"loginName":"admin"}
selplat_java_single_id_definition_example = {"id":"UniauthUserId"}
selplat_java_composite_id_definition_example = {"tenantId":"UniauthUserTenantId","orderId":"UniauthUserOrderId"}

<!-- CommonResult 示例保持固定顶层结构，不得把 affectedRows 或其他字段重新塞进 data。 -->
selplat_java_common_result_example = {"success":true,"data":{"id":1,"loginName":"admin"},"msg":"详情查询完成。"}
selplat_java_batch_common_result_example = {"success":true,"data":[{"id":1},{"id":2}],"affectedRows":2,"msg":"批量更新完成。"}

<!-- CommonPageResult 示例必须展示 records、totalCount、pageNo 和 pageSize 的真实层级。 -->
selplat_java_common_page_result_example = {"records":[{"id":2,"loginName":"user-b"},{"id":1,"loginName":"user-a"}],"totalCount":2,"pageNo":1,"pageSize":10}

## 模板、样例和同步

<!-- 新增或生成 Java 注释时必须使用同名资产目录中的模板，并参考 BaseDaoSupportImpl 真实样例；业务含义是规则、生成骨架和人工示例不会漂移。 -->
selplat_java_comment_template = RUL_Java业务注释与返回示例规则/template/Java业务注释模板.md
selplat_java_comment_examples = RUL_Java业务注释与返回示例规则/examples/BaseDaoSupportImpl注释示例.md

<!-- 注释规则变更必须同步模板、样例、RULE_INDEX、AGENTS 和验证测试；业务含义是不能只改规则正文而让执行入口继续使用旧口径。 -->
selplat_java_comment_rule_change_atomic_sync = main_rule,template,examples,RULE_INDEX,AGENTS,tests

<!-- 注释与真实实现不一致时必须修正注释或实现，禁止保留“示例好看但运行结果不同”的失真记录。 -->
selplat_java_comment_example_mismatch_action = block_and_repair_before_delivery
