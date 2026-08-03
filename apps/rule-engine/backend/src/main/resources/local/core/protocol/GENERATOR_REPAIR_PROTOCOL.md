# Generator Repair Protocol

## 说明

- 本协议用于约束各类自动生成器在能力不足、规则不足、模板错配、输出失真或规则重复分散时的通用修复顺序
- 本协议适用于 API 详细设计生成器、BAT 详细设计生成器、页面调用生成器以及其他后续生成器
- 本协议只定义“发现生成器问题后如何自动升级、修复、合并和收敛”，不替代各专项生成规则

## 强制协议（Mandatory Protocol）

<!-- 生成器失败时必须先分类问题层级，再决定补能力、补规则、修模板还是重跑输出；业务含义是避免在成品层盲修 -->
generator_must_classify_failure_before_repair = true

<!-- 通用失败层级固定为：输入事实层、规则路由层、能力编排层、模板骨架层、成品输出层、规则收敛层；业务含义是让“规则不够”和“规则分散”也进入正式修复链 -->
generator_failure_layers = input_fact -> rule_routing -> ability_orchestration -> template_skeleton -> workbook_output -> rule_convergence

<!-- 能力不足时必须优先升级能力，而不是长期依赖单次任务内手工拼装；业务含义是把补丁沉淀为正式能力 -->
generator_ability_gap_must_upgrade_capability = true

<!-- 一旦判定为能力缺口，必须明确提示应升级哪类能力，例如事实抽取、模板路由、工作簿渲染、输出校验或规则加载；业务含义是避免只说“补能力”却不说明升级落点 -->
generator_ability_gap_must_identify_capability_type_to_upgrade = true

<!-- 无论本轮是否真的修了能力或规则，都必须在对外收口时明确说明结果；业务含义是避免把“未修能力/规则”默默带过，造成用户误判 -->
generator_repair_must_explicitly_state_whether_capability_or_rule_was_changed = true

<!-- 规则不足时必须优先补规则并更新 RULE_INDEX，不得继续在任务内默写临时规则；业务含义是保证后续任务可稳定命中 -->
generator_rule_gap_must_add_rule_and_sync_rule_index = true

<!-- 若出现近义规则、重复规则或职责重叠规则，必须优先合并或收敛到主规则文件，再清理旧引用；业务含义是防止规则越修越散 -->
near_duplicate_generator_rules_must_merge_into_primary_rule = true

<!-- 模板骨架问题必须先修 merged ranges、锚点映射和页签骨架，不得直接在成品页手工补救长期绕过；业务含义是保证重跑可复现 -->
generator_template_skeleton_error_must_repair_rendering_basis = true

<!-- 成品输出问题必须重跑结构检查、残留词检索和关键页预览验证；业务含义是把生成器修复闭环固定下来 -->
generator_output_error_must_rerun_structural_and_visual_verification = true

<!-- 若用户通过截图、预览图或可视化证据指出问题，不能只修当前成品，必须进一步判断是否属于能力、规则、模板或验证链缺口；业务含义是把截图反馈升级为正式修复触发器 -->
user_visual_feedback_must_trigger_gap_classification_beyond_current_artifact = true

<!-- 截图反馈若暴露出同类问题可能重复出现，必须把修复沉淀回能力代码、规则文件、协议入口或验证链，而不是停留在单次成品修补；业务含义是避免同类截图问题反复人工返工 -->
repeated_visual_feedback_must_promote_capability_rule_or_verification_upgrade = true

<!-- 若自动纠错因测试缺口无法判断修复是否生效，必须先把测试缺口提升为正式修复项；业务含义是避免在验证不完整时误判自愈成功 -->
generator_repair_must_promote_missing_test_closure_to_formal_fix_item = true

<!-- 生成器、规则或能力升级完成后，若缺少主路径、边界路径或回归路径验证，不得宣称已自愈完成；业务含义是把测试闭环纳入协议层完成条件 -->
generator_repair_must_not_claim_self_healed_without_test_closure = true

<!-- 每次生成器升级都必须保留其他类型扩展口，不得因为实现一个专项生成器就封死后续分流；业务含义是保证 API/BAT/页面调用/其他类型都可扩展 -->
generator_upgrade_must_keep_extension_ports = true

<!-- 生成器修复必须采用最小边界修复：先修抽象层，再修专项层，再修成品；业务含义是减少无关回归 -->
generator_repair_must_follow_minimal_repair_boundary = true

## 修复顺序（Repair Sequence）

1. 判断问题属于输入事实、规则路由、能力编排、模板骨架、成品输出还是规则收敛层。
2. 若属于输入事实层，先回源重新抽取事实，不在生成结果上硬改业务内容。
3. 若属于规则路由层，先修模式判断、规则命中和索引入口。
4. 若属于能力编排层，先明确提示应升级的能力类型，再补能力返回结构、阶段定义、自我修复循环或扩展口。
   能力类型至少应在 `fact_extractor / template_router / workbook_renderer / output_verifier / rule_loader` 中选择最贴近的一类；若都不匹配，必须说明为何需要新增能力类别。
   若本轮最终没有实际修改任何能力文件或规则文件，也必须明确说明“本轮未修复任何能力和规则”，并说明原因。
5. 若测试闭环不足以证明修复生效，先补最小测试入口、失败证据或回归验证，再继续判断是否完成自愈。
6. 若问题由截图、预览图或其他可视化反馈触发，必须额外判断本次问题是否会在同类任务重复出现；若会重复出现，先补能力、规则或验证链入口，再决定是否只修当前成品。
7. 若属于模板骨架层，先补 merged ranges、锚点映射、横向布局和页签骨架。
8. 若属于成品输出层，重跑结构检查、残留词检查和关键页截图验证。
9. 若属于规则收敛层，先合并近义规则并清理旧规则引用，再继续验证。
10. 修复完成后，必须把修复结果沉淀回协议、规则、能力代码或注册信息，而不是只修当前输出。

## 适用口径（Scope）

- API 类生成器：优先检查接口契约、主处理、错误处理和 Lxx 分层。
- BAT / 批处理生成器：优先检查批处理入口、批次步骤和与 API 模式的分流边界。
- 页面调用生成器：优先检查页面事件、前端 API、Controller、Service、DAO、Domain 链路骨架。
- 其他生成器：若未实现专属能力，必须先暴露扩展口和缺口清单，不得伪装成功。
