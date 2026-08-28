# 古诗教学图片生成全流程规则

<!-- 核定 DOCX 解析、清单导出和教学图生成统一使用当前用户 Python 能力。 -->
python_ability_refs = apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/teaching_image_tools.py

<!-- 当前规则不再使用 Java 能力。 -->
java_ability_refs = none

<!-- 当前规则不再使用 Node 能力。 -->
node_ability_refs = none

<!-- 古诗教学图片全流程必须先加载无文字底图的稳定迁移规则，避免任务只读到自然语言引用。 -->
requires_rule_ids = ANCIENT_POEM_BACKGROUND_RULES

## 说明

- 本规则用于从核定版 DOCX、审校内容和已审核插画生成古诗、诗词或文言文教学图片。
- 本规则约束单图样例和正式批量生成的完整阶段、工具边界、字体、锚点、长文本分页及最终视觉验收。
- 本规则不允许图片模型生成需要核定的汉字、拼音、作者、解释或页码。
- 无文字底图的生成、重试、临时文件迁移和专项验收，按需加载稳定逻辑 ID `ANCIENT_POEM_BACKGROUND_RULES`；本规则不重复维护该专项细节，也不绑定已退役的物理文件名。
- 当交付目标为可编辑PPT时，按需引用同目录的`RUL_古诗教学图片PPT文字排版工作流程规则.md`；PPT工具、PPT字号、可编辑对象和PPT实际渲染验收以该专项规则为准。
- 当目标受众为8岁以下儿童，且任务涉及三页整张底图、素材板处理或严格复刻已确认少儿样例时，必须同时引用同目录的`RUL_少儿古诗三页整张底图PPT严格套版通用规则.md`；该规则对正式底图形态、图片数量和严格样例复刻拥有专项优先级。
- 每份源 DOCX 必须在 `OPTION/temp/中文教学/项目/<源DOCX基名>/` 建立独立项目目录，并在 `OPTION/temp/中文教学/教学图片与PPT生成/<项目临时分类名>/` 建立对应临时目录；底图、可编辑批量稿和当前项目专用参考资料留在项目内，编号数据、生成过程和最终导出进入 OPTION 统一临时总类。

## 一、流程与工具分工

<!-- 古诗教学图片必须先确定完整阶段和每阶段工具；适用于单图样例及批量任务；业务含义是避免把数据解析、美术生成、排字和验收混成不可追踪的一次生成 -->
poetry_image_generation_sequence = source_preflight -> source_parse -> extension_content_route -> pagination_preflight -> illustration_route -> template_anchor_map -> deterministic_text_render -> structural_validation -> visual_crop_validation -> delivery_package -> delivery

<!-- 核定版 DOCX 必须由 Python DOCX 解析能力读取；适用于标题、朝代作者、逐字拼音和原文；业务含义是禁止重新调用拼音库或让模型猜测核定内容 -->
poetry_source_parse_tool = python_docx_teaching_image_parser

<!-- 故事、解读、核心意境、生活启示和页脚只有在内容文件明确匹配当前源DOCX、篇目编号和目标年龄时才可复用；适用于解释性扩展内容；业务含义是禁止把初中、其他项目或来源不明的旧数据混入小学少儿成品 -->
poetry_reviewed_content_tool = current_source_and_age_matched_project_content_json_only

<!-- 某篇缺少当前项目扩展内容时，必须依据当前核定原诗自动生成同一结构、符合目标年龄的教学内容 JSON 并继续批量流程；适用于 DOCX 仅提供原诗和拼音的批量任务；业务含义是不因尚未预置教学文案而阻塞图片生产 -->
poetry_missing_extension_content_must_generate_current_age_project_json_and_continue = true

<!-- 自动生成的扩展文案必须在生成清单中标明AI生成来源，不得标为人工已审校；来源记录只用于追溯，不得成为暂停或等待人工审核的门槛 -->
poetry_generated_extension_content_must_record_ai_source_without_review_gate = true

<!-- 无文字主题插画或美术底图由内置 imagegen 生成；适用于当前诗词缺少已审核且匹配的主题素材时；业务含义是让模型只负责视觉创作，不承担文字正确性 -->
poetry_art_generation_tool = builtin_imagegen_without_text

<!-- 每首诗都必须拥有与本诗主题匹配的独立无文字主题插画；适用于单图与批量任务；业务含义是避免把其他诗词的主题图错误复用于当前篇目 -->
every_poetry_must_have_own_matching_text_free_theme_illustration = true

<!-- 已有并通过审核且与当前诗词匹配的插画或美术底图必须直接复用；适用于重复生成、分页和批量重跑；业务含义是避免对同一诗词重复生图造成风格漂移、成本增加和主体变化 -->
approved_matching_poetry_art_asset_must_skip_regeneration = true

<!-- 当前诗词没有已审核匹配插画时，必须为该诗调用 imagegen 生成独立的无文字插画，不得因素材缺失中断批量任务；适用于首次批量生成；业务含义是把“逐首补图”固定为流程责任，而非人工前置条件 -->
missing_matching_poetry_art_must_generate_per_poem_and_not_block_batch = true

<!-- 正式统一批量排字必须使用工作区捆绑 Python 与 Pillow 确定性合成器；适用于生产输出；业务含义是在保留可重复文字坐标与像素结果的同时，允许按每张无文字底图进行可视化微调，不再使用 Java 排版 -->
poetry_batch_text_render_tool = bundled_python_pillow_visual_layout_compositor

<!-- 单图方案验证与正式批量使用同一套工作区捆绑 Python 与 Pillow 排字器；适用于样例及批量任务；业务含义是样例确认后的可视化版式可直接复用到正式输出，避免 Java 与样例渲染结果不一致 -->
poetry_single_sample_text_render_tool = bundled_python_pillow_visual_layout_compositor

<!-- 本地成品必须使用 view_image 查看整图，并由输出验证链生成关键区域裁切证据；适用于所有最终 JPG 或 PNG；业务含义是禁止只看文件存在、尺寸或缩略图就宣称排版通过 -->
poetry_visual_inspection_tools = view_image_full_resolution + output_verifier_region_crops

## 二、输入与内容正确性

<!-- 生成前必须记录源 DOCX、内容 JSON、插画、美术底图、字体和输出目录；适用于单图及批量任务；业务含义是让每张图片可以回溯到实际输入 -->
poetry_image_preflight_must_record_all_input_paths = true

<!-- 标题、朝代、作者、原文、标点和逐字拼音只能来自核定版 DOCX；适用于所有教学文字；业务含义是保证教学内容不被生成模型或排字工具改写 -->
verified_poetry_text_must_come_only_from_approved_docx = true

<!-- 当前项目不得读取其他学段、其他源DOCX或旧中间稿中的标题、原诗、拼音、扩展文案和插画；适用于项目切换和历史目录仍存在时；业务含义是从输入层杜绝跨项目数据污染 -->
poetry_project_data_must_be_isolated_from_other_grade_source_and_legacy_intermediates = true

<!-- 图片模型不得生成汉字、拼音、数字、页码、标签、品牌或水印；适用于插画和整页美术底图；业务含义是杜绝模型乱码进入核定成品 -->
image_model_must_not_render_verified_text_or_page_metadata = true

<!-- 用户明确要求品牌版、封面或角标时，必须复用中文教学公共品牌素材；适用于 JPG、PNG 和后续 PPT 的品牌标识；业务含义是品牌图标不随任务临时生成，且不自动遮挡普通教学内容 -->
chinese_teaching_brand_icon_asset = local/XUNAN/中文教学/通用/template/RUL_中文教学公共品牌素材使用规则/新思度华文学堂.png

<!-- 未明确要求品牌版、封面或角标时禁止自动加入品牌图标；适用于普通教学图片；业务含义是教学内容保持优先，避免品牌元素覆盖正文、拼音或插画安全区 -->
chinese_teaching_brand_icon_requires_explicit_request = true

<!-- 解析后必须逐篇建立结构化数据并校验拼音与汉字字元数量；适用于逐字注音；业务含义是提前发现表格错位、漏字和拼音映射断裂 -->
poetry_annotated_tokens_must_pass_count_and_order_validation = true

## 三、字体与文字可读性

<!-- 标题、栏目、诗文、说明正文和拼音必须使用分层字体角色；适用于所有模板；业务含义是形成书法展示、诗文阅读、正文说明和拉丁注音的清晰层级 -->
poetry_typography_roles = calligraphy_title + calligraphy_section + readable_poem_kaiti + readable_body_songti + diacritic_pinyin_sans

<!-- 所用字体必须记录字体文件、字体族、字重和授权来源；适用于跨平台和批量生成；业务含义是避免系统静默回退导致不同机器字形变化 -->
poetry_fonts_must_be_explicitly_registered_and_reported = true

<!-- 字体缺失或加载失败时必须停止当前篇目，不得静默回退到 Dialog 或未知字体；适用于正式批量输出；业务含义是防止未发现的字体错配破坏整批视觉一致性 -->
poetry_font_load_failure_must_block_current_artifact = true

<!-- 在 1053×1493 基准画布上，标题、栏目、诗文、拼音、正文和页脚不得低于各自最低字号；适用于分页预检；业务含义是文字过多时优先分页而不是无限缩小 -->
poetry_minimum_font_sizes_at_1053x1493 = title:64
<!-- poetry_minimum_font_sizes_at_1053x1493.2 的当前独立事实为 section:30。 -->
poetry_minimum_font_sizes_at_1053x1493.2 = section:30
<!-- poetry_minimum_font_sizes_at_1053x1493.3 的当前独立事实为 poem_hanzi:42。 -->
poetry_minimum_font_sizes_at_1053x1493.3 = poem_hanzi:42
<!-- poetry_minimum_font_sizes_at_1053x1493.4 的当前独立事实为 pinyin:18。 -->
poetry_minimum_font_sizes_at_1053x1493.4 = pinyin:18
<!-- poetry_minimum_font_sizes_at_1053x1493.5 的当前独立事实为 body:24。 -->
poetry_minimum_font_sizes_at_1053x1493.5 = body:24
<!-- poetry_minimum_font_sizes_at_1053x1493.6 的当前独立事实为 footer:24。 -->
poetry_minimum_font_sizes_at_1053x1493.6 = footer:24

<!-- 拼音字元列必须按实际拼音宽度、汉字宽度和最小列宽计算，连续同音拼音之间必须保留可见间距；适用于逐字注音；业务含义是防止 xiang_xiang 等连续拼音粘连 -->
pinyin_token_column_width_must_include_measured_text_and_visible_gap = true

<!-- 标点使用独立的窄列且不得占用完整汉字拼音列；适用于古诗原文；业务含义是保持诗句节奏并减少不自然的大间隔 -->
poetry_punctuation_must_use_narrow_non_pinyin_columns = true

## 四、模板锚点与安全区

<!-- AI 美术底图进入排字前必须建立实际像素锚点映射；适用于标题框、原诗框、内容框和页脚框；业务含义是禁止根据肉眼猜测固定 y 坐标 -->
ai_poetry_background_must_have_measured_anchor_map_before_text_render = true

<!-- 锚点映射必须记录每个框的 left、top、right、bottom 和文字内边距；适用于确定性排字；业务含义是让文字位置可以计算和自动验证 -->
poetry_anchor_map_required_fields = left
<!-- poetry_anchor_map_required_fields.2 的当前独立事实为 top。 -->
poetry_anchor_map_required_fields.2 = top
<!-- poetry_anchor_map_required_fields.3 的当前独立事实为 right。 -->
poetry_anchor_map_required_fields.3 = right
<!-- poetry_anchor_map_required_fields.4 的当前独立事实为 bottom。 -->
poetry_anchor_map_required_fields.4 = bottom
<!-- poetry_anchor_map_required_fields.5 的当前独立事实为 padding_left。 -->
poetry_anchor_map_required_fields.5 = padding_left
<!-- poetry_anchor_map_required_fields.6 的当前独立事实为 padding_top。 -->
poetry_anchor_map_required_fields.6 = padding_top
<!-- poetry_anchor_map_required_fields.7 的当前独立事实为 padding_right。 -->
poetry_anchor_map_required_fields.7 = padding_right
<!-- poetry_anchor_map_required_fields.8 的当前独立事实为 padding_bottom。 -->
poetry_anchor_map_required_fields.8 = padding_bottom

<!-- 底图缩放、裁切或改变画布比例后必须重新计算全部锚点；适用于 imagegen 常见输出尺寸转标准尺寸；业务含义是防止底图移动而文字仍沿用旧坐标 -->
poetry_anchor_map_must_recompute_after_resize_or_crop = true

<!-- 每段文字绘制前必须计算实际文字包围框；适用于标题、作者、诗文、正文、栏目和页脚；业务含义是把框内判断从目视估计升级为可验证几何条件 -->
every_poetry_text_block_must_have_measured_bounding_box = true

<!-- 所有文字包围框必须完全位于对应内容框内，并在基准画布上保留至少 16 像素安全边距；适用于最终渲染；业务含义是禁止文字压线、越框或贴边 -->
poetry_text_bbox_must_stay_inside_anchor_with_minimum_margin_px = 16

<!-- 页脚文字必须按页脚框实际上下边界垂直居中，不得使用全局固定基线；适用于总结句和页码；业务含义是直接防止文字落在页脚框上方或压住边线 -->
poetry_footer_text_must_center_within_measured_footer_anchor = true

<!-- 装饰插画不得进入正文安全区；若底图装饰已进入安全区，必须增加高不透明宣纸遮罩或调整锚点；适用于竹叶、山水、笔筒等边角装饰；业务含义是保证打印和缩放后的正文对比度 -->
poetry_decoration_must_not_reduce_text_safe_zone_contrast = true

<!-- 每个文字锚点在使用前必须先与底图中的真实边框、分隔线和装饰线几何区域进行校验；适用于标题、作者、栏目、诗文、正文、页码和页脚；业务含义是防止错误锚点本身跨线时仍让文字包围框检查误判为通过 -->
poetry_anchor_must_pass_real_border_and_decoration_geometry_validation_before_text_layout = true

<!-- 文字锚点不得与任何真实边框、分隔线或装饰线相交；适用于所有文字区域；业务含义是把“锚点本身无效”作为生成失败，而不是等到文字压线后再靠目视发现 -->
poetry_anchor_must_not_intersect_border_divider_or_decoration_lines = true

<!-- 任一文字包围框都不得与边框、分隔线、角花、横线或其他非文字线条相交；适用于标题、作者、栏目、原诗、解释、页脚和页码；业务含义是建立独立于锚点包含关系的第二层碰撞检测 -->
poetry_text_bbox_must_not_intersect_any_non_text_line_geometry = true

<!-- 所有文字包围框与最近的边框、分隔线或装饰线必须保留至少 12 像素距离；适用于 1053×1493 基准画布；业务含义是避免文字虽然没有直接压线但仍因贴线产生视觉碰撞 -->
poetry_text_to_nearest_border_or_decoration_minimum_gap_px = 12

<!-- 栏目标签必须完整放在对应内容框内部，并与上边框、左边框至少保留 16 像素内边距；适用于诗意故事、诗句解读、核心意境和生活启示等标签；业务含义是禁止标签覆盖、切断或贴住内容框边线 -->
poetry_section_label_must_stay_inside_panel_with_minimum_inset_px = 16

<!-- 教学说明正文必须使用常规或细体字重，不得使用黑体级宋体或过粗字重填满笔画；适用于故事、解读、核心意境、生活启示和页脚；业务含义是保持长文本清爽、易读并与标题形成明确层级 -->
poetry_explanatory_body_font_weight = regular_or_light_not_black_or_heavy

<!-- 内容框中文字集中在一侧并产生明显空白时，空白侧必须放置与当前栏目语义匹配的淡雅插画，或重新分配文字宽度；适用于双栏卡片和宽幅卡片；业务含义是保持图文视觉重心均衡，避免一边拥挤一边机械留白 -->
poetry_panel_must_balance_text_and_semantically_matching_illustration = true

<!-- 栏目插画必须位于独立视觉平衡区，与正文包围框至少保留 20 像素距离，并与内边框至少保留 16 像素距离；适用于故事、解读、核心和启示小景；业务含义是让插画填补空白但不挤压文字或贴住边线 -->
poetry_panel_illustration_minimum_gap_to_text_px = 20;minimum_inset_to_panel_border_px = 16

<!-- 栏目插画不得以带独立矩形背景、圆角缩略图、照片卡片或二次边框的方式嵌入内容框；适用于故事、解读、核心意境和生活启示；业务含义是避免插画像后贴素材而破坏整页一体感 -->
poetry_panel_illustration_must_not_look_like_embedded_thumbnail_or_photo_card = true

<!-- 栏目插画必须使用透明背景、宣纸同色背景或自然渐隐边缘，并从栏目右侧、右下角或底部景线自然延伸；适用于书卷笔筒、荷花白鹅、山水亭台等小景；业务含义是让插画成为栏目构图的一部分而不是独立图片块 -->
poetry_panel_illustration_integration_style = transparent_or_xuan_paper_matched_background + naturally_feathered_edges + grow_from_panel_edge_or_baseline

<!-- 栏目小景的纸张颜色、笔触颗粒、色彩饱和度、透视方向和光线必须与整页底图一致；适用于 imagegen 生成整页底图及后续补图；业务含义是防止不同来源插画产生拼贴感 -->
poetry_panel_illustration_must_match_page_paper_brush_palette_perspective_and_lighting = true

<!-- 当现有插画无法无痕融入栏目时，必须在 imagegen 无文字整页底图阶段直接生成该栏目的一体化小景，禁止用强羽化矩形遮罩勉强嵌入；适用于首次生成和修正版；业务含义是优先获得用户确认示例中书卷、笔筒、山水亭台式的自然融合效果 -->
non_integrable_existing_art_must_be_regenerated_as_part_of_text_free_full_page_background = true

<!-- 同一页面的不同栏目不得重复使用相同插画主体、道具组合、视角或近似构图；适用于白鹅荷塘、书卷笔筒、山水亭台等栏目小景；业务含义是避免连续出现两个笔筒或两组相同书卷而产生模板复制感 -->
poetry_same_page_section_illustrations_must_be_visually_distinct = subject + prop_combination + viewpoint + composition

<!-- 相邻栏目若都使用书房题材，必须更换核心道具组合，例如书卷笔筒、卷轴砚台、古琴香炉只能各选其一且不得连续重复；适用于诗句解读、核心意境和生活启示；业务含义是保留统一文化气质但形成视觉变化 -->
adjacent_study_theme_panels_must_use_different_primary_props = true

<!-- 无文字底图完成后必须执行同页插画重复检查；当两个栏目主体或轮廓明显相似时必须更换其中一个后重新生成，不得仅靠缩放、镜像或轻微裁切冒充不同插画 -->
poetry_visual_validation_must_fail_on_repeated_section_illustration = true

<!-- 单图样板通过后必须先制作并锁定一张框内无插画、框外装饰完整的空白一体化母版；适用于同一批次后续全部诗词；业务含义是固定标题框、主卡片、双栏卡片、宽栏卡片和页脚框，降低逐首重绘造成的框线漂移 -->
approved_sample_must_produce_locked_blank_integrated_master_before_batch = true

<!-- 正式批量的 imagegen 输入必须使用已锁定空白母版，只允许在主图右半区和各栏目指定视觉平衡区新增当前诗词插画；适用于逐首无文字底图生成；业务含义是禁止把某首已有插画的成品底图反复改写后传播残留主体或放大栏目小景 -->
poetry_batch_imagegen_must_add_art_only_to_locked_blank_master_visual_zones = main_panel_right_and_bottom + section_panel_right_or_lower_right

<!-- 空白母版及逐首底图完成后必须核对全部内容框和页脚框的数量、形状、位置与线宽；任一框缺失、移动、变形或被插画覆盖都必须判定失败并重做当前底图 -->
poetry_background_validation_must_fail_on_frame_count_position_shape_or_line_weight_drift = true

<!-- 标题、作者、栏目和正文等相邻文字区域必须分别计算包围框及区域间距，不得互相重叠或侵入另一块视觉层级；适用于页首及多模块版式；业务含义是避免单个区域各自通过但组合后发生拥挤或层级混乱 -->
poetry_adjacent_text_regions_must_pass_non_overlap_and_minimum_gap_validation = true

<!-- 作者行必须使用标题框底边与下一条分隔线之间的实际可用带状区域垂直居中；适用于朝代作者；业务含义是禁止作者行沿用猜测坐标而贴住标题框底线 -->
poetry_author_must_center_between_measured_title_frame_bottom_and_next_divider = true

<!-- 锚点包含检查通过不能抵消锚点几何、装饰线碰撞或相邻区域间距失败；适用于最终输出验证；业务含义是明确多层检测必须全部通过，避免再次出现“包围框通过但仍压线”的假阳性 -->
poetry_bbox_inside_anchor_pass_cannot_override_geometry_or_gap_failure = true

## 五、长文本与多页排版

<!-- 在正式绘制前必须按最低字号、实际字体度量和内容框锚点执行分页预检；适用于长诗、词、文言文及较长故事解读；业务含义是先确定页数再绘制，避免生成后才发现溢出 -->
poetry_pagination_preflight_must_run_before_final_render = true

<!-- 任一内容块在最低字号和安全行距下无法进入锚点时必须进入多页计划；适用于原文或解释内容过长；业务含义是禁止继续缩字、压行距或裁掉内容 -->
poetry_overflow_at_minimum_typography_must_trigger_multi_page_layout = true

<!-- 多页第一页优先展示标题、作者、原文起始段和故事入口，续页重复标题、作者和页码并承接未完成内容；适用于长文本；业务含义是保证每页独立可识别且上下页阅读连续 -->
poetry_multi_page_content_order = first_page:title_author_poem_start_story_start;continuation_page:title_author_page_number_remaining_content

<!-- 原文跨页时只能在核定行、句或段边界分页，不得拆开一个汉字与其拼音，也不得把标点单独留在下一页；适用于逐字注音长诗；业务含义是保持教学语义和注音对应完整 -->
poetry_page_break_must_preserve_annotated_token_and_sentence_integrity = true

<!-- 故事、解读、核心意境和生活启示跨页时必须保留栏目标题并避免孤行；适用于解释性内容；业务含义是让续页读者知道内容归属并避免单行悬挂 -->
poetry_multi_page_sections_must_repeat_section_label_and_avoid_orphans = true

<!-- 已审核插画和美术底图在多页中应保持角色设定、色彩、笔触和时代环境一致；成人单页延展可复用审校通过的完整素材，面向8岁以下儿童时必须按原文拼音、诗意字词和品读拓展分别生成三张完整整页底图，并把所需小景融合在相应底图中，禁止用素材板裁切片或PPT图片拼贴替代；业务含义是同时保证跨页统一、整页完整与逐页语义匹配 -->
poetry_multi_page_art_must_reuse_approved_complete_asset_or_generate_independent_complete_full_page_background = true

<!-- 多页文件名必须使用两位页码并保证排序稳定；适用于输出目录；业务含义是让文件系统、打印和后续合并保持正确顺序 -->
poetry_multi_page_filename_pattern = sequence_title_page_01_to_99

## 六、生成后验证

<!-- 最终文件必须重新解码并校验尺寸、色彩模式、文件大小和输出目录；适用于 JPG 与 PNG；业务含义是发现损坏文件、尺寸漂移和写错目录 -->
poetry_output_must_pass_decode_dimension_mode_size_and_path_checks = true

<!-- 最终验证必须同时生成整图、标题与作者区、原诗区、正文区、核心与启示区和页脚区的可视化证据；适用于单页和每一张续页；业务含义是避免整图缩略检查漏掉作者贴线、页脚越框、拼音粘连和小字问题 -->
poetry_visual_evidence_regions = full
<!-- poetry_visual_evidence_regions.2 的当前独立事实为 header_title_author。 -->
poetry_visual_evidence_regions.2 = header_title_author
<!-- poetry_visual_evidence_regions.3 的当前独立事实为 poem。 -->
poetry_visual_evidence_regions.3 = poem
<!-- poetry_visual_evidence_regions.4 的当前独立事实为 body。 -->
poetry_visual_evidence_regions.4 = body
<!-- poetry_visual_evidence_regions.5 的当前独立事实为 core_life。 -->
poetry_visual_evidence_regions.5 = core_life
<!-- poetry_visual_evidence_regions.6 的当前独立事实为 footer。 -->
poetry_visual_evidence_regions.6 = footer

<!-- 每页必须逐项检查标题作者、逐字拼音、原文标点、栏目内容、页码和页脚；适用于多页输出；业务含义是防止只检查第一页就宣称整篇通过 -->
every_poetry_page_must_pass_text_and_layout_checklist = true

<!-- 几何验证必须确认每个文字包围框位于锚点安全区内；适用于自动输出验证器；业务含义是把越框和压线变成失败而不是审美建议 -->
poetry_output_verifier_must_fail_on_text_bbox_anchor_violation = true

<!-- 输出验证器必须按锚点有效性、文字包围框包含、非文字线碰撞、最小距离和相邻区域间距的顺序执行；适用于全部页面；业务含义是确保错误锚点不会因后续单项通过而被漏判 -->
poetry_output_geometry_validation_sequence = anchor_geometry -> bbox_containment -> non_text_line_collision -> minimum_gap -> adjacent_region_gap

<!-- 标题与作者局部图必须按原始分辨率单独检查标题框底边、作者文字上下间距和下一条分隔线；适用于每页页首；业务含义是把本次截图暴露的问题固化为每页必查项 -->
poetry_header_crop_must_check_title_frame_author_gap_and_next_divider = true

<!-- 视觉验证必须使用原始分辨率检查并保留局部裁切图；适用于最终收口；业务含义是禁止仅凭缩略图、文件命令或哈希判断视觉正确 -->
poetry_visual_validation_must_inspect_original_resolution_and_keep_crops = true

<!-- 文字、拼音、框线、插画或页脚任一检查失败时必须修正后重新执行全部结构与视觉检查；适用于自我修复循环；业务含义是防止只补局部后跳过相邻回归 -->
poetry_validation_failure_must_rerun_full_structural_and_visual_checks = true

## 七、交付与失败条件

<!-- 未通过分页预检、字体加载、包围框安全区、逐字对应或局部截图检查时禁止交付；适用于正式样例与批量成品；业务含义是统一完成定义 -->
poetry_image_delivery_requires_all_preflight_render_and_visual_checks = true

<!-- 正式交付必须报告源文件、内容数据、素材、字体、渲染工具、输出路径、页数和验证证据路径；适用于可追溯收口；业务含义是明确用了什么工具生成什么结果 -->
poetry_image_delivery_report_fields = source_docx
<!-- poetry_image_delivery_report_fields.2 的当前独立事实为 content_json。 -->
poetry_image_delivery_report_fields.2 = content_json
<!-- poetry_image_delivery_report_fields.3 的当前独立事实为 art_assets。 -->
poetry_image_delivery_report_fields.3 = art_assets
<!-- poetry_image_delivery_report_fields.4 的当前独立事实为 fonts。 -->
poetry_image_delivery_report_fields.4 = fonts
<!-- poetry_image_delivery_report_fields.5 的当前独立事实为 render_tool。 -->
poetry_image_delivery_report_fields.5 = render_tool
<!-- poetry_image_delivery_report_fields.6 的当前独立事实为 output_paths。 -->
poetry_image_delivery_report_fields.6 = output_paths
<!-- poetry_image_delivery_report_fields.7 的当前独立事实为 page_count。 -->
poetry_image_delivery_report_fields.7 = page_count
<!-- poetry_image_delivery_report_fields.8 的当前独立事实为 validation_evidence。 -->
poetry_image_delivery_report_fields.8 = validation_evidence

<!-- 已存在成品默认不得覆盖，修正版必须使用版本化文件名；适用于人工已检查输出；业务含义是保留可比较和可恢复的历史结果 -->
poetry_image_regeneration_must_use_non_destructive_versioned_filename = true

## 八、自动修复、重试上限与失败登记

<!-- 插画仅在个别栏目越过文字安全区、缺少小景、主体重复或局部不协调时，必须优先使用 imagegen 对现有无文字底图做局部修正；适用于主体构图、框线和其余栏目均已合格的底图；业务含义是避免因单一局部问题无谓推翻整张版式 -->
poetry_local_art_problem_must_prefer_targeted_imagegen_edit_before_full_regeneration = true

<!-- 边框数量、位置、形状、线宽、主卡片高度或多个栏目同时漂移时，必须放弃局部修补并从锁定空白母版重新生成；适用于模板几何失真；业务含义是防止在错误版式上继续叠加修补造成累计偏差 -->
poetry_frame_geometry_or_multi_panel_failure_must_restart_from_locked_blank_master = true

<!-- 每次局部修正或整张重生后都必须重新执行框线几何、插画安全区、文字包围框、非文字线碰撞、字体、重复插画和整图局部截图检查；适用于第 1 至第 3 次重试；业务含义是修复不能只看目标区域而遗漏相邻回归 -->
every_poetry_retry_must_rerun_complete_structural_and_visual_validation = true

<!-- 同一篇作品因同一或关联问题自动修复最多尝试三次；适用于 imagegen 底图、确定性排字和生成后验证；业务含义是在自动处理与无限返工之间建立明确上限 -->
poetry_automatic_retry_limit_per_artifact = 3

<!-- 第三次尝试仍未通过时，必须停止该篇自动返工并登记到失败文档，但不得停止后续篇目的批量生成；适用于可隔离的单篇失败；业务含义是把难例留给最终人工集中处理，同时保持批量主流程前进 -->
poetry_after_three_failed_attempts_must_record_failure_and_continue_next_artifact = true

<!-- 失败文档必须记录序号、标题、页码、尝试次数、每次失败原因、失败阶段、底图与输出稿路径、最后一次验证证据、建议人工处理方式和登记时间；适用于全部达到重试上限的作品；业务含义是让人工复核能够直接定位问题而无需重放整条链路 -->
poetry_failure_record_required_fields = sequence
<!-- poetry_failure_record_required_fields.2 的当前独立事实为 title。 -->
poetry_failure_record_required_fields.2 = title
<!-- poetry_failure_record_required_fields.3 的当前独立事实为 page。 -->
poetry_failure_record_required_fields.3 = page
<!-- poetry_failure_record_required_fields.4 的当前独立事实为 attempt_count。 -->
poetry_failure_record_required_fields.4 = attempt_count
<!-- poetry_failure_record_required_fields.5 的当前独立事实为 attempt_reasons。 -->
poetry_failure_record_required_fields.5 = attempt_reasons
<!-- poetry_failure_record_required_fields.6 的当前独立事实为 failure_stage。 -->
poetry_failure_record_required_fields.6 = failure_stage
<!-- poetry_failure_record_required_fields.7 的当前独立事实为 draft_paths。 -->
poetry_failure_record_required_fields.7 = draft_paths
<!-- poetry_failure_record_required_fields.8 的当前独立事实为 last_validation_evidence。 -->
poetry_failure_record_required_fields.8 = last_validation_evidence
<!-- poetry_failure_record_required_fields.9 的当前独立事实为 recommended_manual_action。 -->
poetry_failure_record_required_fields.9 = recommended_manual_action
<!-- poetry_failure_record_required_fields.10 的当前独立事实为 recorded_at。 -->
poetry_failure_record_required_fields.10 = recorded_at

<!-- 只有字体文件整体缺失、核定 DOCX 无法读取、输出存储不可写、锁定母版损坏或清单结构无法恢复等影响整批的硬阻塞，才允许停止整个任务；遇到硬阻塞前必须先尝试诊断和安全修复，无法恢复时在失败文档记录并向用户报告 -->
poetry_batch_may_stop_only_for_unrecoverable_shared_dependency_or_source_failure_after_diagnosis = true

<!-- 最终压缩包只允许收入已通过全部验证的图片；达到三次上限的失败项不得混入成品包，必须在最终验证报告和失败文档中列为人工待处理，并明确通过数量与缺失数量 -->
poetry_archive_must_exclude_failed_artifacts_and_report_verified_and_failed_counts = true

## 九、正式批量压缩包交付

<!-- 正式批量图片只有在全部篇目、全部分页和全部验证通过后才能进入压缩阶段；适用于最终批量交付；业务含义是禁止把未完成或未验收图片提前打入最终包 -->
poetry_batch_archive_must_run_only_after_all_artifacts_pass_validation = true

<!-- 正式批量压缩使用支持 UTF-8 中文文件名的系统 zip 工具；适用于 macOS、Windows 和后续自动化环境；业务含义是保证中文篇名和目录名在解压后不乱码 -->
poetry_batch_archive_tool = system_zip_with_utf8_filenames

<!-- 默认按每个源 DOCX 生成一个独立最终压缩包，只有用户明确要求时才合并多个源文件；适用于多源批量任务；业务含义是避免不同教材或年级成果混包 -->
poetry_batch_archive_scope = one_verified_archive_per_source_docx_unless_user_requests_combined_package

<!-- 压缩包必须包含最终图片、页序清单、生成清单和最终验证报告；适用于单页与多页作品；业务含义是让收件方可以核对数量、顺序、来源和验收结果 -->
poetry_batch_archive_required_contents = final_images
<!-- poetry_batch_archive_required_contents.2 的当前独立事实为 page_order_manifest。 -->
poetry_batch_archive_required_contents.2 = page_order_manifest
<!-- poetry_batch_archive_required_contents.3 的当前独立事实为 generation_manifest。 -->
poetry_batch_archive_required_contents.3 = generation_manifest
<!-- poetry_batch_archive_required_contents.4 的当前独立事实为 final_validation_report。 -->
poetry_batch_archive_required_contents.4 = final_validation_report

<!-- 多页作品的全部页必须按稳定页码进入同一源文件压缩包；适用于长诗、词和文言文；业务含义是防止只打包第一页或漏掉续页 -->
poetry_batch_archive_must_include_every_verified_multi_page_output = true

<!-- 最终压缩包禁止包含草稿、失败版本、检查裁切图、临时字体、缓存、源 DOCX 和未要求交付的原始插画；适用于正式交付；业务含义是保持最终包干净并避免泄露中间资料 -->
poetry_batch_archive_forbidden_contents = drafts
<!-- poetry_batch_archive_forbidden_contents.2 的当前独立事实为 failed_versions。 -->
poetry_batch_archive_forbidden_contents.2 = failed_versions
<!-- poetry_batch_archive_forbidden_contents.3 的当前独立事实为 visual_check_crops。 -->
poetry_batch_archive_forbidden_contents.3 = visual_check_crops
<!-- poetry_batch_archive_forbidden_contents.4 的当前独立事实为 temp_fonts。 -->
poetry_batch_archive_forbidden_contents.4 = temp_fonts
<!-- poetry_batch_archive_forbidden_contents.5 的当前独立事实为 caches。 -->
poetry_batch_archive_forbidden_contents.5 = caches
<!-- poetry_batch_archive_forbidden_contents.6 的当前独立事实为 source_docx。 -->
poetry_batch_archive_forbidden_contents.6 = source_docx
<!-- poetry_batch_archive_forbidden_contents.7 的当前独立事实为 unrequested_source_art。 -->
poetry_batch_archive_forbidden_contents.7 = unrequested_source_art

<!-- 压缩包名称必须包含源文件基名、最终版、生成日期和版本号，并且不得覆盖已有压缩包；适用于可追溯版本交付；业务含义是让用户可以区分不同批次并恢复历史版本 -->
poetry_batch_archive_filename_pattern = source_basename_古诗教学图片_最终版_YYYY-MM-DD_vNN.zip

<!-- 压缩后必须执行完整性测试、UTF-8 文件名检查、清单数量比对和 SHA-256 记录；适用于最终收口；业务含义是发现损坏压缩包、漏图、多图和中文路径异常 -->
poetry_batch_archive_validation = unzip_test + utf8_filename_check + manifest_count_match + sha256_record

<!-- 压缩包内图片数量必须等于生成清单中全部单页与多页输出数量之和；适用于批量验证；业务含义是把漏页和重复页作为交付失败处理 -->
poetry_batch_archive_image_count_must_equal_manifest_page_count = true

<!-- 正式交付报告必须增加压缩包路径、包内文件数量、完整性测试结果和 SHA-256；适用于最终批量交付；业务含义是明确最终拿哪个包以及包是否已验证 -->
poetry_batch_delivery_report_fields = archive_path
<!-- poetry_batch_delivery_report_fields.2 的当前独立事实为 archive_file_count。 -->
poetry_batch_delivery_report_fields.2 = archive_file_count
<!-- poetry_batch_delivery_report_fields.3 的当前独立事实为 archive_integrity_result。 -->
poetry_batch_delivery_report_fields.3 = archive_integrity_result
<!-- poetry_batch_delivery_report_fields.4 的当前独立事实为 archive_sha256。 -->
poetry_batch_delivery_report_fields.4 = archive_sha256

## 十、目录与临时文件路由

<!-- AI 原始生成文件必须迁入项目 AI 临时目录；业务含义是避免项目中间图长期堆积在 Codex 全局缓存 -->
poetry_imagegen_raw_output_must_move_to_project_ai_temp = <当前临时目录>/图片生成中间文件/YYYY-MM-DD_批次名称

<!-- 人工确认的正式无文字底图只有一个工作入口；业务含义是避免参考底图、历史通过稿和正式底图多处并存导致选错版本 -->
poetry_approved_background_single_working_location = <当前项目>/底图

<!-- 排字成品、验证证据和最终压缩包统一进入人工输出目录；业务含义是让 AI 中间文件与人工交付物彻底分离 -->
poetry_final_human_output_location = <当前临时目录>/最终输出（可重新生成）

<!-- 所有可重建的生成中间稿、检查截图、样例 PPT、失败废稿、最终导出和缓存统一进入单一临时入口；业务含义是允许人工一次清理派生成果而不误删正式底图和可编辑批量稿 -->
poetry_deletable_intermediate_single_location = <当前临时目录>

<!-- DOCX 转换和排字 JSON 及执行工具归入 AI 目录，规则保持独立；业务含义是目录迁移后 AI 理解数据、程序排字输入和执行规则仍可按职责稳定定位 -->
poetry_workspace_responsibility_directories = <当前临时目录>/PPT排版数据（可由DOCX重新生成） + 公共/工具 + local/XUNAN/中文教学/应用/教学图片与PPT生成/rule
