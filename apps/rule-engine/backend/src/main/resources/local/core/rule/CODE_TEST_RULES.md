# CODE TEST RULES

## 说明

- 本文件承接代码测试、前端测试、页面测试和回归验证相关规则。
- 本文件只在涉及测试、验证、页面布局核验或用户明确要求测试时按需读取。
- 语言专项测试仍可同时读取对应语言规则；本文件负责测试行为约束。

## 强制规则（Mandatory）

<!--页面测试必须真实打开页面-->
page_test_must_use_real_page = true

<!--网页 UI 测试必须查看实际页面布局-->
web_ui_test_must_inspect_actual_layout = true

<!--不得只用构建、接口、DOM 或代码阅读代替页面布局验证-->
forbid_replace_layout_verification_with_build_api_dom_or_code_only = true

<!--涉及视觉、布局、首屏、遮挡、重叠、滚动、响应式时必须截图或等价可视化检查-->
visual_layout_test_requires_screenshot_or_equivalent_visual_check = true

<!-- 涉及页面交互 弹窗 进度条 滚动条 流式输出或可视状态变化时 必须使用真实 Chrome 或 Playwright 做交互可视化验证 -->
interactive_visual_state_test_must_use_real_chrome_or_playwright = true

<!-- 真实 Chrome 或 Playwright 页面验证必须留下截图 result.json 日志或等价证据路径 -->
real_browser_visual_test_must_record_screenshot_json_or_log_evidence = true

<!--截图验证优先使用内置 Browser；不可用时使用本机浏览器或 Playwright 等真实浏览器渲染-->
prefer_builtin_browser_screenshot_for_visual_test = true

<!-- 内置 Browser 不可用时必须退回到本机浏览器或 Playwright 截图验证 -->
fallback_to_real_browser_or_playwright_screenshot_when_builtin_browser_unavailable = true

<!-- 标准页面测试工具卡住或不可用时 必须记录阻塞原因 并使用真实 Chrome 或 Playwright fallback 完成验证 -->
fallback_to_real_chrome_or_playwright_when_standard_page_tester_blocks = true

<!--网页页面测试标准能力-->
standard_web_page_visual_test_ability = apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core/abilities/page_visual_tester.py

<!-- 网页页面可视化测试必须调用标准能力形成统一证据格式 -->
web_page_visual_test_must_call_standard_ability = true

<!-- 标准页面测试能力必须输出 JSON 结果和截图路径 便于复核 -->
standard_ability_must_output_json_and_screenshot_paths = true

<!-- 自动纠错、自愈、自我修复或能力升级任务在测试闭环缺失时不得宣称稳定；业务含义是把“先补测再纠错”提升为通用硬约束 -->
auto_correction_must_not_claim_stable_without_minimal_test_closure = true

<!-- 自动纠错最小测试闭环至少覆盖主路径、异常或边界路径和相邻回归路径；业务含义是避免只修成功路径就宣称闭环完成 -->
auto_correction_minimal_test_closure_requires_main_boundary_and_regression = true

<!-- 当规则升级、能力升级或生成器修复因缺测试而无法判定是否生效时，必须先补最小测试入口或验证证据，再继续修复；业务含义是把测试缺口正式纳入修复前置条件 -->
auto_correction_must_fill_validation_gap_before_repair_claim = true

## 页面测试要求

1. 页面测试必须真实启动或连接目标页面，打开实际 URL 后再判断结果。
2. 只要任务涉及页面布局、视觉效果、首屏呈现、元素位置、遮挡、重叠、滚动区域或响应式表现，必须查看真实页面布局。
3. 真实页面布局验证必须使用截图或等价的可视化检查；仅凭构建通过、接口返回、DOM 存在、样式代码阅读或文本快照，不得宣称页面布局已验证。
4. 网页页面测试必须优先调用标准能力 `apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core/abilities/page_visual_tester.py`；调用时应提供真实 URL、必要视口条件，以及与当前验证目标对应的滚动、选择器计数或文本检查参数，并输出 JSON 结果。
5. 如果内置 Browser 可用，可同时使用内置 Browser 查看截图或交互状态；若内置 Browser 不可用，必须说明原因，并继续使用标准能力完成真实页面渲染与截图验证。
6. 标准能力调用结果必须写明检查过的页面 URL、视口尺寸或设备条件、`result.json` 路径、截图文件路径、选择器/文本检查结果，以及发现的问题或确认结果。
7. 页面存在内部滚动容器时，必须通过标准能力的 `scrolls` 参数滚动目标容器后截图；不得只截首屏就宣称下方布局已验证。
8. 涉及页面交互、弹窗、进度条、滚动条、流式输出或可视状态变化时，必须使用真实 Chrome 或 Playwright 验证实际交互状态，并留下截图、`result.json`、日志或等价证据路径。
9. 标准页面测试工具卡住、超时或不可用时，必须记录阻塞原因，再使用真实 Chrome 或 Playwright fallback 完成页面验证；不得把工具卡住当作页面已验证。

## 标准能力调用格式

```bash
python3 apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core/abilities/page_visual_tester.py \
  --url "http://127.0.0.1:5174/?view=governance" \
  --viewport 1600x900 \
  --scroll ".governance-layout:640" \
  --count "facts=.fact-field-row:8:8" \
  --must-contain "body=事实字段"
```

返回 JSON 中至少应关注：

- `status`：必须为 `completed` 才能作为通过结果。
- `result_path`：记录本次标准能力输出的 JSON 文件路径。
- `screenshots`：必须包含可查看的截图路径。
- `selector_results` / `text_results`：用于说明 DOM 数量或页面文本检查是否通过。

## 普通测试要求

1. 代码变更后应按风险运行最小必要测试；共享逻辑、能力、协议或规则变更必须运行对应单测、编译检查或格式校验。
2. 测试失败时必须说明失败命令、核心原因和后续处理，不得只写“测试失败”。
3. 无法运行测试时必须说明阻塞原因，并给出已完成的替代验证动作。
4. 自动纠错、自愈、自我修复或自动升级任务，若当前测试只能覆盖部分成功路径，必须先补最小测试闭环，再宣称问题已稳定修复。
5. 如果测试缺口本身阻塞了自动纠错判断，应把“补测试或补验证入口”作为正式修复步骤，而不是继续依赖口头判断或静态阅读。
