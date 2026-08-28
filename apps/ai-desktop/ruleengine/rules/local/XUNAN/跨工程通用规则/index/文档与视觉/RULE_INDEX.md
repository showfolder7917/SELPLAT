# 文档与视觉规则索引

<!-- 本叶子索引由原索引按职责无损分片；逻辑 ID、路径和触发映射保持不变。 -->

<!-- Excel 修订履历规则只对当前稳定用户的工作簿修正任务生效，避免把局部修改误登记到全部 Sheet。 -->
EXCEL_REVISION_HISTORY_RULES = local/XUNAN/跨工程通用规则/RUL_Excel修订履历填写规则.md

<!-- 用户要求修正Excel内容、修订标识或履历时加载本规则。 -->
load_rule_for_active_user_excel_revision_or_correction = EXCEL_REVISION_HISTORY_RULES

<!-- 所有视觉成品在自动检测后执行 AI 审美终审。 -->
AI_VISUAL_AESTHETIC_FINAL_REVIEW_RULES = local/XUNAN/跨工程通用规则/RUL_AI视觉审美终审规则.md

<!-- 任意渲染视觉产物创建、修改，以及信息架构、主流程、工作台或导航层级重大改造时加载；重大改造必须先生成三套画面、由用户选择，再按选定画面实现和对比验收。 -->
load_rule_for_any_rendered_visual_artifact_creation_or_modification = AI_VISUAL_AESTHETIC_FINAL_REVIEW_RULES

<!-- load_rule_for_ppt_slide_image_document_page_or_webpage_visual_delivery 的当前独立事实为 AI_VISUAL_AESTHETIC_FINAL_REVIEW_RULES。 -->
load_rule_for_ppt_slide_image_document_page_or_webpage_visual_delivery = AI_VISUAL_AESTHETIC_FINAL_REVIEW_RULES

<!-- load_rule_for_full_page_render_review_or_visual_quality_acceptance 的当前独立事实为 AI_VISUAL_AESTHETIC_FINAL_REVIEW_RULES。 -->
load_rule_for_full_page_render_review_or_visual_quality_acceptance = AI_VISUAL_AESTHETIC_FINAL_REVIEW_RULES
