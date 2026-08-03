# Auto Upgrade And Repair Rules

## 说明

- 本文件用于约束各类自动生成器在能力不足、规则不足、规则分散、模板错配和输出失败时的通用升级与修复行为
- 本文件不绑定某一个专项生成器，可被 API、BAT、页面调用或其他文档/代码生成器复用
- 本文件承接通用修复协议，并把“补能力、补规则、规则合并、引用清理、验证收口”固化为可检索规则

## 强制规则（Mandatory）

<!-- 若生成器缺少所需能力，必须优先新增或升级正式能力文件，并同步更新能力注册；业务含义是禁止长期依赖任务内临时实现 -->
missing_generator_capability_must_add_or_upgrade_formal_ability = true

<!-- 一旦识别为能力缺口，必须明确提示应升级哪类能力，并说明对应问题层级、落点文件和验证方式；业务含义是让升级动作从笼统“补能力”变成可执行任务 -->
missing_generator_capability_must_explicitly_name_capability_type = true

<!-- 即使本轮没有修复任何能力或规则，也必须显式说明未修复状态和原因；业务含义是避免用户误以为本轮已经完成能力/规则升级 -->
must_explicitly_state_when_no_capability_or_rule_was_repaired = true

<!-- 若生成器缺少规则入口，必须新增或升级规则文件，并同步更新 RULE_INDEX；业务含义是避免后续任务继续靠手动说明 -->
missing_generator_rule_must_add_rule_and_sync_rule_index = true

<!-- 若近义规则或协议并存，应优先并入更通用或更主干的文件，并清理旧文件和旧引用；业务含义是把规则系统做收敛治理 -->
near_duplicate_generator_rule_or_protocol_must_merge_then_cleanup_old_references = true

<!-- 若专项规则已被更通用规则覆盖，应删除专项重复文件，而不是长期并存；业务含义是降低规则查找成本 -->
specialized_rule_must_be_removed_when_general_rule_fully_covers_it = true

<!-- 升级生成器时必须同步修正能力代码、规则路径、协议路径和注册信息，不得只修其中一层；业务含义是保证调用链真正打通 -->
generator_upgrade_must_sync_code_rules_protocol_and_registry = true

<!-- 若问题由用户截图、预览图或可视化反馈触发，必须先判断它是否暴露了可复用缺口；业务含义是防止只在单次产物上打补丁 -->
visual_feedback_issue_must_be_checked_for_reusable_gap = true

<!-- 截图反馈若暴露可重复问题，必须同步升级能力代码、规则文件或验证链，而不是只修当前成品文件；业务含义是让同类问题后续优先被正式能力吸收 -->
repeated_visual_feedback_must_upgrade_capability_rule_or_verification_chain = true

<!-- 若输出依赖模板骨架，升级后必须保留模板路径、模式分流口和验证阶段；业务含义是防止升级后丢掉渲染基础设施 -->
generator_upgrade_must_keep_template_route_and_verification_contract = true

<!-- 任何自动升级或自动修复完成后，都必须进行编译、能力返回和索引检索验证；业务含义是防止只改文本不验可用性 -->
auto_upgrade_or_repair_must_run_compile_return_and_index_verification = true

## 收敛规则（Convergence Rules）

1. 通用协议优先放在 `protocol/`，用于定义修复顺序和升级原则。
2. 通用规则优先放在 `rule/common_rules/`，用于定义可检索的升级、修复和合并约束。
3. 专项规则只保留无法被通用规则吸收的业务差异，不得承载通用修复原则。
4. 若删除旧规则或旧协议，必须同步清理能力代码、`RULE_INDEX.md` 和注册文件中的全部引用。
5. 若某类截图反馈在多个任务中重复出现，应优先把修复沉淀为正式能力或通用规则，不得长期依赖手工逐次改产物。
6. 若确认是能力缺口，必须在对外说明和执行文档中明确写出要升级的能力类型；优先从 `fact_extractor`、`template_router`、`workbook_renderer`、`output_verifier`、`rule_loader` 中选取，必要时再说明新增能力类别。
7. 若本轮没有实际修改任何能力文件或规则文件，必须在对外说明、执行文档或验证结果中明确写出“本轮未修复任何能力和规则”，并说明未修的原因，例如仅修成品、仅做评估、仅补证据或当前缺少可落地的正式能力实现。

## 验证规则（Verification Rules）

1. Python 能力代码升级后至少执行 `py_compile` 或等价编译验证。
2. 能力注册文件升级后必须验证 JSON 可解析且新能力键存在。
3. 规则索引升级后必须检索确认新规则/协议入口存在，旧入口已移除。
4. 若生成器支持多模式分流，必须验证非目标模式会正确返回扩展口或阻塞信息，而不是误走默认模式。
5. 若升级由截图反馈触发，验证结果中必须保留截图、预览图或等价可视化证据，并说明哪些修复已回写到能力、规则或验证链。
6. 若本轮确认了能力缺口，验证结果中必须同时说明：最终判定的能力类型、对应修改文件或待修改文件、以及为何不是其他能力类型。
