# AI 视觉审美终审规则

<!-- 问题：结构、边界、字号和重叠等自动检测通过，只能证明视觉成品满足已编码约束，不能证明页面在视觉上协调、自然、清楚或具有足够的设计质量。 -->
<!-- 场景：PPT、教学图片、文档页面、海报、长图、网页截图及其他需要以渲染画面交付的视觉成品。 -->
<!-- 业务含义：所有自动检测之后必须增加 AI 逐页审美终审；AI 必须使用当前可用的视觉理解、设计判断和推理能力主动发现并修正未被规则枚举的审美问题。 -->

<!-- ai_visual_aesthetic_final_review_scope 的当前独立事实为 ppt。 -->
ai_visual_aesthetic_final_review_scope = ppt
<!-- ai_visual_aesthetic_final_review_scope.2 的当前独立事实为 slides。 -->
ai_visual_aesthetic_final_review_scope.2 = slides
<!-- ai_visual_aesthetic_final_review_scope.3 的当前独立事实为 teaching_image。 -->
ai_visual_aesthetic_final_review_scope.3 = teaching_image
<!-- ai_visual_aesthetic_final_review_scope.4 的当前独立事实为 document_page。 -->
ai_visual_aesthetic_final_review_scope.4 = document_page
<!-- ai_visual_aesthetic_final_review_scope.5 的当前独立事实为 poster。 -->
ai_visual_aesthetic_final_review_scope.5 = poster
<!-- ai_visual_aesthetic_final_review_scope.6 的当前独立事实为 long_image。 -->
ai_visual_aesthetic_final_review_scope.6 = long_image
<!-- ai_visual_aesthetic_final_review_scope.7 的当前独立事实为 webpage_screenshot。 -->
ai_visual_aesthetic_final_review_scope.7 = webpage_screenshot
<!-- ai_visual_aesthetic_final_review_scope.8 的当前独立事实为 other_rendered_visual_artifact。 -->
ai_visual_aesthetic_final_review_scope.8 = other_rendered_visual_artifact

<!-- AI 审美终审必须位于结构、数值、内容和渲染检查之后；适用于所有视觉交付流程；业务含义是自动检查通过不是最终交付条件。 -->
visual_delivery_gate_order = automatic_check -> render_every_page -> ai_aesthetic_review_every_page -> repair_source_or_generator_or_rule -> rerender_and_review -> final_delivery
<!-- automatic_check_pass_does_not_equal_visual_acceptance 的当前独立事实为 true。 -->
automatic_check_pass_does_not_equal_visual_acceptance = true

<!-- 必须把最终版本的每一页分别渲染成完整截图并逐页打开；适用于多页和批量成品；业务含义是禁止只看封面、抽样页、缩略图或蒙太奇就宣布全量合格。 -->
render_final_version_every_page_as_individual_complete_image = true
<!-- ai_must_open_and_review_every_rendered_page 的当前独立事实为 true。 -->
ai_must_open_and_review_every_rendered_page = true
<!-- thumbnail_montage_may_support_overview_but_must_not_replace_page_review 的当前独立事实为 true。 -->
thumbnail_montage_may_support_overview_but_must_not_replace_page_review = true
<!-- sampling_must_not_replace_full_visual_review 的当前独立事实为 true。 -->
sampling_must_not_replace_full_visual_review = true

<!-- AI 必须同时使用规则约束和自身当前可用的审美判断；适用于规则未覆盖、数值难以表达或多项局部正确但整体不好看的页面；业务含义是 AI 不得以“没有对应规则”作为忽略明显设计问题的理由。 -->
ai_review_must_apply_current_visual_reasoning_and_design_judgment = true
<!-- ai_must_reject_rule_compliant_but_visually_poor_page 的当前独立事实为 true。 -->
ai_must_reject_rule_compliant_but_visually_poor_page = true
<!-- missing_explicit_rule_must_not_suppress_aesthetic_problem 的当前独立事实为 true。 -->
missing_explicit_rule_must_not_suppress_aesthetic_problem = true

<!-- 每页必须检查整体构图与视觉重心；适用于全图、图文分栏、卡片和多模块页面；业务含义是人物、文字、留白和装饰必须形成稳定平衡，不能一侧拥挤而另一侧空洞。 -->
ai_review_dimension_composition = visual_center
<!-- ai_review_dimension_composition.2 的当前独立事实为 balance。 -->
ai_review_dimension_composition.2 = balance
<!-- ai_review_dimension_composition.3 的当前独立事实为 proportion。 -->
ai_review_dimension_composition.3 = proportion
<!-- ai_review_dimension_composition.4 的当前独立事实为 alignment。 -->
ai_review_dimension_composition.4 = alignment
<!-- ai_review_dimension_composition.5 的当前独立事实为 grouping。 -->
ai_review_dimension_composition.5 = grouping
<!-- ai_review_dimension_composition.6 的当前独立事实为 negative_space。 -->
ai_review_dimension_composition.6 = negative_space
<!-- ai_review_dimension_composition.7 的当前独立事实为 edge_safety。 -->
ai_review_dimension_composition.7 = edge_safety

<!-- 每页必须检查文字层级与阅读节奏；适用于标题、提示、正文、拼音、注释和按钮；业务含义是字号、行距、段距、行长和对齐应符合内容角色，不能仅因放得下就判定合格。 -->
ai_review_dimension_typography = hierarchy
<!-- ai_review_dimension_typography.2 的当前独立事实为 font_size。 -->
ai_review_dimension_typography.2 = font_size
<!-- ai_review_dimension_typography.3 的当前独立事实为 line_spacing。 -->
ai_review_dimension_typography.3 = line_spacing
<!-- ai_review_dimension_typography.4 的当前独立事实为 paragraph_spacing。 -->
ai_review_dimension_typography.4 = paragraph_spacing
<!-- ai_review_dimension_typography.5 的当前独立事实为 line_length。 -->
ai_review_dimension_typography.5 = line_length
<!-- ai_review_dimension_typography.6 的当前独立事实为 alignment。 -->
ai_review_dimension_typography.6 = alignment
<!-- ai_review_dimension_typography.7 的当前独立事实为 readability。 -->
ai_review_dimension_typography.7 = readability
<!-- ai_review_dimension_typography.8 的当前独立事实为 rhythm。 -->
ai_review_dimension_typography.8 = rhythm

<!-- 每页必须检查图像质量和图文语义；适用于照片、插画、图标和生成图片；业务含义是图片必须完整、清晰、风格一致并解释当前文字，不能用相近但无关的图片填充。 -->
ai_review_dimension_imagery = semantic_match
<!-- ai_review_dimension_imagery.2 的当前独立事实为 subject_integrity。 -->
ai_review_dimension_imagery.2 = subject_integrity
<!-- ai_review_dimension_imagery.3 的当前独立事实为 subject_saliency。 -->
ai_review_dimension_imagery.3 = subject_saliency
<!-- ai_review_dimension_imagery.4 的当前独立事实为 style_consistency。 -->
ai_review_dimension_imagery.4 = style_consistency
<!-- ai_review_dimension_imagery.5 的当前独立事实为 image_quality。 -->
ai_review_dimension_imagery.5 = image_quality
<!-- ai_review_dimension_imagery.6 的当前独立事实为 crop_quality。 -->
ai_review_dimension_imagery.6 = crop_quality
<!-- ai_review_dimension_imagery.7 的当前独立事实为 text_safe_area。 -->
ai_review_dimension_imagery.7 = text_safe_area

<!-- 每页必须检查色彩、底板和装饰关系；适用于半透明底板、渐变、品牌色和栏目标签；业务含义是颜色应支持阅读和情绪，底板不得遮挡主体或因面积、透明度和质感不协调而破坏画面。 -->
ai_review_dimension_color_and_surface = palette_harmony
<!-- ai_review_dimension_color_and_surface.2 的当前独立事实为 contrast。 -->
ai_review_dimension_color_and_surface.2 = contrast
<!-- ai_review_dimension_color_and_surface.3 的当前独立事实为 background_plate_ratio。 -->
ai_review_dimension_color_and_surface.3 = background_plate_ratio
<!-- ai_review_dimension_color_and_surface.4 的当前独立事实为 opacity。 -->
ai_review_dimension_color_and_surface.4 = opacity
<!-- ai_review_dimension_color_and_surface.5 的当前独立事实为 texture。 -->
ai_review_dimension_color_and_surface.5 = texture
<!-- ai_review_dimension_color_and_surface.6 的当前独立事实为 decoration_restraint。 -->
ai_review_dimension_color_and_surface.6 = decoration_restraint
<!-- ai_review_dimension_color_and_surface.7 的当前独立事实为 brand_consistency。 -->
ai_review_dimension_color_and_surface.7 = brand_consistency

<!-- 每页必须检查内容气质和目标受众适配；适用于教学、儿童、商务和其他不同业务场景；业务含义是视觉语言必须符合主题、年龄、使用场景和情绪目标，禁止套用与内容无关的通用模板审美。 -->
ai_review_dimension_context = audience_fit
<!-- ai_review_dimension_context.2 的当前独立事实为 age_fit。 -->
ai_review_dimension_context.2 = age_fit
<!-- ai_review_dimension_context.3 的当前独立事实为 topic_fit。 -->
ai_review_dimension_context.3 = topic_fit
<!-- ai_review_dimension_context.4 的当前独立事实为 emotional_tone。 -->
ai_review_dimension_context.4 = emotional_tone
<!-- ai_review_dimension_context.5 的当前独立事实为 teaching_clarity。 -->
ai_review_dimension_context.5 = teaching_clarity
<!-- ai_review_dimension_context.6 的当前独立事实为 scene_credibility。 -->
ai_review_dimension_context.6 = scene_credibility

<!-- 多页成品还必须检查跨页节奏；适用于整套 PPT、绘本、报告和连续页面；业务含义是页面之间既要保持系统一致，也要避免连续重复同一构图、同一图片或同一视觉强度。 -->
ai_review_dimension_sequence = cross_page_consistency
<!-- ai_review_dimension_sequence.2 的当前独立事实为 layout_variety。 -->
ai_review_dimension_sequence.2 = layout_variety
<!-- ai_review_dimension_sequence.3 的当前独立事实为 image_variety。 -->
ai_review_dimension_sequence.3 = image_variety
<!-- ai_review_dimension_sequence.4 的当前独立事实为 visual_pacing。 -->
ai_review_dimension_sequence.4 = visual_pacing
<!-- ai_review_dimension_sequence.5 的当前独立事实为 module_transition。 -->
ai_review_dimension_sequence.5 = module_transition
<!-- ai_review_dimension_sequence.6 的当前独立事实为 repetition_control。 -->
ai_review_dimension_sequence.6 = repetition_control

<!-- AI 发现审美问题后必须给出页码、问题、判断依据和可执行修正动作；适用于自动修复和审计报告；业务含义是禁止只写“页面不好看”或依赖模糊主观描述。 -->
ai_aesthetic_issue_record_fields = artifact
<!-- ai_aesthetic_issue_record_fields.2 的当前独立事实为 page。 -->
ai_aesthetic_issue_record_fields.2 = page
<!-- ai_aesthetic_issue_record_fields.3 的当前独立事实为 problem。 -->
ai_aesthetic_issue_record_fields.3 = problem
<!-- ai_aesthetic_issue_record_fields.4 的当前独立事实为 severity。 -->
ai_aesthetic_issue_record_fields.4 = severity
<!-- ai_aesthetic_issue_record_fields.5 的当前独立事实为 visual_reason。 -->
ai_aesthetic_issue_record_fields.5 = visual_reason
<!-- ai_aesthetic_issue_record_fields.6 的当前独立事实为 repair_action。 -->
ai_aesthetic_issue_record_fields.6 = repair_action
<!-- aesthetic_issue_severity 的当前独立事实为 blocker。 -->
aesthetic_issue_severity = blocker
<!-- aesthetic_issue_severity.2 的当前独立事实为 major。 -->
aesthetic_issue_severity.2 = major
<!-- aesthetic_issue_severity.3 的当前独立事实为 minor。 -->
aesthetic_issue_severity.3 = minor

<!-- blocker 和 major 问题必须在交付前由 AI 主动调整；适用于可修改的源文件、生成器、视觉资产和规则；业务含义是终审不是只出报告，必须形成修正、重渲染和复查闭环。 -->
ai_must_repair_before_delivery = blocker
<!-- ai_must_repair_before_delivery.2 的当前独立事实为 major。 -->
ai_must_repair_before_delivery.2 = major
<!-- repair_must_update_correct_source_layer 的当前独立事实为 source_document。 -->
repair_must_update_correct_source_layer = source_document
<!-- repair_must_update_correct_source_layer.2 的当前独立事实为 generator。 -->
repair_must_update_correct_source_layer.2 = generator
<!-- repair_must_update_correct_source_layer.3 的当前独立事实为 layout_logic。 -->
repair_must_update_correct_source_layer.3 = layout_logic
<!-- repair_must_update_correct_source_layer.4 的当前独立事实为 visual_asset。 -->
repair_must_update_correct_source_layer.4 = visual_asset
<!-- repair_must_update_correct_source_layer.5 的当前独立事实为 rule。 -->
repair_must_update_correct_source_layer.5 = rule
<!-- after_repair_must_rerender_affected_pages 的当前独立事实为 true。 -->
after_repair_must_rerender_affected_pages = true
<!-- after_repair_must_repeat_ai_aesthetic_review 的当前独立事实为 true。 -->
after_repair_must_repeat_ai_aesthetic_review = true

<!-- 审美问题暴露稳定、可复用或跨任务约束缺口时，必须同步更新对应规则和规则索引；适用于同类页面可能再次生成同类缺陷的场景；业务含义是禁止只修当前成品而让后续任务重复跑偏。 -->
reusable_aesthetic_problem_must_update_matched_rule = true
<!-- rule_change_must_update_rule_index 的当前独立事实为 true。 -->
rule_change_must_update_rule_index = true
<!-- single_artifact_exception_must_not_be_overgeneralized_into_rule 的当前独立事实为 true。 -->
single_artifact_exception_must_not_be_overgeneralized_into_rule = true

<!-- 仅修改截图像素而不修正源文件会导致成品与检查结果不一致；适用于 PPT、文档和程序生成成品；业务含义是所有调整必须回写实际交付源或生成能力。 -->
repairing_rendered_screenshot_only_is_forbidden = true
<!-- final_review_must_target_same_version_as_delivered_artifact 的当前独立事实为 true。 -->
final_review_must_target_same_version_as_delivered_artifact = true

<!-- 无法在当前任务权限、工具或素材范围内修正时必须保留失败状态并说明阻塞；适用于确实缺少源文件、关键素材或必要能力的场景；业务含义是禁止为了交付而把未解决审美问题降级为合格。 -->
unresolved_blocker_or_major_aesthetic_issue_blocks_delivery = true
<!-- blocked_visual_delivery_must_report 的当前独立事实为 affected_page。 -->
blocked_visual_delivery_must_report = affected_page
<!-- blocked_visual_delivery_must_report.2 的当前独立事实为 unresolved_problem。 -->
blocked_visual_delivery_must_report.2 = unresolved_problem
<!-- blocked_visual_delivery_must_report.3 的当前独立事实为 blocking_reason。 -->
blocked_visual_delivery_must_report.3 = blocking_reason
<!-- blocked_visual_delivery_must_report.4 的当前独立事实为 remaining_risk。 -->
blocked_visual_delivery_must_report.4 = remaining_risk

<!-- 最终结果必须保存逐页审美记录和整体验收结论；适用于批量和可追溯视觉任务；业务含义是后续可以确认 AI 实际看过全部页面，而不是只运行了数值检测。 -->
ai_aesthetic_review_report_root = <CURRENT_PROJECT_ROOT>/OPTION/temp
<!-- ai_aesthetic_review_report_must_include 的当前独立事实为 total_page_count。 -->
ai_aesthetic_review_report_must_include = total_page_count
<!-- ai_aesthetic_review_report_must_include.2 的当前独立事实为 reviewed_page_count。 -->
ai_aesthetic_review_report_must_include.2 = reviewed_page_count
<!-- ai_aesthetic_review_report_must_include.3 的当前独立事实为 issue_page_count。 -->
ai_aesthetic_review_report_must_include.3 = issue_page_count
<!-- ai_aesthetic_review_report_must_include.4 的当前独立事实为 repaired_page_count。 -->
ai_aesthetic_review_report_must_include.4 = repaired_page_count
<!-- ai_aesthetic_review_report_must_include.5 的当前独立事实为 remaining_blocker_count。 -->
ai_aesthetic_review_report_must_include.5 = remaining_blocker_count
<!-- ai_aesthetic_review_report_must_include.6 的当前独立事实为 remaining_major_count。 -->
ai_aesthetic_review_report_must_include.6 = remaining_major_count
<!-- ai_aesthetic_review_report_must_include.7 的当前独立事实为 final_status。 -->
ai_aesthetic_review_report_must_include.7 = final_status
<!-- visual_artifact_final_status 的当前独立事实为 passed_only_when_all_pages_reviewed_and_no_unresolved_blocker_or_major。 -->
visual_artifact_final_status = passed_only_when_all_pages_reviewed_and_no_unresolved_blocker_or_major
