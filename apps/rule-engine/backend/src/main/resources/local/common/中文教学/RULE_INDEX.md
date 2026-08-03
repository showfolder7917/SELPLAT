# 中文教学规则作用域索引

<!-- 本索引维护中文教学业务工程规则和语言原生能力路径。 -->
chinese_teaching_rule_root = local/common/中文教学/rule/
chinese_teaching_brand_asset_root = local/common/中文教学/assets/品牌/
chinese_teaching_pinyin_code_root = ../java/com/sp/selplat/local/code/common/中文教学/拼音生成/
chinese_teaching_image_ppt_code_root = ../java/com/sp/selplat/local/code/common/中文教学/教学图片与PPT生成/
chinese_teaching_python_code_root = ../python/com/sp/selplat/local/code/common/中文教学/
chinese_teaching_node_code_root = ../node/com/sp/selplat/local/code/common/中文教学/
children_oral_performance_middle_node_code_root = ../node/com/sp/selplat/local/code/common/中文教学/教学图片与PPT生成/口才与表演/中册/
children_oral_performance_middle_template_root = local/common/中文教学/template/口才与表演/中册/
children_oral_performance_middle_runtime_cache_root = <CURRENT_PROJECT_ROOT>/cache/中文教学/口才与表演/中册/

<!-- 中文教学横版课件页面结构、素材边界与验收。 -->
HORIZONTAL_TEACHING_PPT_RULES = local/common/中文教学/rule/教学图片与PPT生成/RUL_横版教学PPT通用排版与检查规则.md
load_rule_for_horizontal_teaching_ppt_generation = HORIZONTAL_TEACHING_PPT_RULES

<!-- 少儿口才与表演全册通用制作。 -->
CHILDREN_ORAL_PERFORMANCE_ALL_VOLUMES_RULES = local/common/中文教学/rule/口才与表演/RUL_少儿口才与表演全册通用制作规则.md
load_rule_for_children_oral_performance_all_volumes = CHILDREN_ORAL_PERFORMANCE_ALL_VOLUMES_RULES

<!-- 少儿口才与表演中册补图与音频。 -->
CHILDREN_ORAL_PERFORMANCE_MIDDLE_PPT_RULES = local/common/中文教学/rule/口才与表演/RUL_少儿口才与表演中册PPT重制补图与音频规则.md
load_rule_for_children_oral_performance_middle_ppt_generation = CHILDREN_ORAL_PERFORMANCE_MIDDLE_PPT_RULES
load_rule_for_children_oral_performance_middle_ppt_audio_or_supplemental_images = CHILDREN_ORAL_PERFORMANCE_MIDDLE_PPT_RULES

<!-- 少儿口才与表演下册完整制作。 -->
CHILDREN_ORAL_PERFORMANCE_LOWER_PPT_RULES = local/common/中文教学/rule/口才与表演/RUL_少儿口才与表演下册PPT完整制作规则.md
load_rule_for_children_oral_performance_lower_ppt_generation = CHILDREN_ORAL_PERFORMANCE_LOWER_PPT_RULES
load_rule_for_children_oral_performance_lower_ppt_quality_check = CHILDREN_ORAL_PERFORMANCE_LOWER_PPT_RULES

<!-- 中文教学拼音标注校正与目录工作流。 -->
CHINESE_PINYIN_CORRECTION_RULES = local/common/中文教学/rule/拼音生成/RUL_拼音标注与朗读版校正规则.md
CHINESE_PINYIN_WORKFLOW_RULES = local/common/中文教学/rule/拼音生成/RUL_拼音生成目录分类与工作流程规则.md
load_rule_for_chinese_pinyin_correction = CHINESE_PINYIN_CORRECTION_RULES
load_rule_for_chinese_pinyin_project_workflow = CHINESE_PINYIN_WORKFLOW_RULES

<!-- 古诗教学图片、底图、PPT 排版与少儿三页严格套版。 -->
ANCIENT_POEM_IMAGE_FULL_FLOW_RULES = local/common/中文教学/rule/教学图片与PPT生成/RUL_古诗教学图片生成全流程规则.md
ANCIENT_POEM_BACKGROUND_RULES = local/common/中文教学/rule/教学图片与PPT生成/RUL_古诗无文字底图生成工作流程规则.md
ANCIENT_POEM_PPT_LAYOUT_RULES = local/common/中文教学/rule/教学图片与PPT生成/RUL_古诗教学图片PPT文字排版工作流程规则.md
CHILD_POETRY_THREE_FULL_PAGE_BACKGROUND_STRICT_TEMPLATE_RULES = local/common/中文教学/rule/教学图片与PPT生成/RUL_少儿古诗三页整张底图PPT严格套版通用规则.md
load_rule_for_ancient_poem_teaching_image_generation = ANCIENT_POEM_IMAGE_FULL_FLOW_RULES
load_rule_for_ancient_poem_no_text_background_generation = ANCIENT_POEM_BACKGROUND_RULES
load_rule_for_ancient_poem_editable_ppt_generation = ANCIENT_POEM_PPT_LAYOUT_RULES
load_rule_for_child_poetry_three_full_page_background_generation = CHILD_POETRY_THREE_FULL_PAGE_BACKGROUND_STRICT_TEMPLATE_RULES
load_rule_for_child_poetry_strict_ppt_template_generation = CHILD_POETRY_THREE_FULL_PAGE_BACKGROUND_STRICT_TEMPLATE_RULES
load_rule_for_child_poetry_ppt_layout_correction = CHILD_POETRY_THREE_FULL_PAGE_BACKGROUND_STRICT_TEMPLATE_RULES
load_rule_for_child_poetry_visual_balance_and_readability_repair = CHILD_POETRY_THREE_FULL_PAGE_BACKGROUND_STRICT_TEMPLATE_RULES
load_rule_for_poetry_atlas_to_full_page_background_task = CHILD_POETRY_THREE_FULL_PAGE_BACKGROUND_STRICT_TEMPLATE_RULES

<!-- 成语典故绘本制作。 -->
IDIOM_FABLE_PICTURE_BOOK_PPT_RULES = local/common/中文教学/rule/成语典故/RUL_成语典故绘本PPT制作规则.md
load_rule_for_idiom_fable_picture_book_ppt_generation = IDIOM_FABLE_PICTURE_BOOK_PPT_RULES

<!-- 小学成语典故国风连续绘本。 -->
PRIMARY_SCHOOL_IDIOM_STORY_PICTURE_BOOK_RULES = local/common/中文教学/rule/成语典故/RUL_小学成语典故国风连续绘本图片生成规则.md
load_rule_for_primary_school_idiom_story_picture_book_generation = PRIMARY_SCHOOL_IDIOM_STORY_PICTURE_BOOK_RULES
load_rule_for_idiom_story_grading_and_storyboard_planning = PRIMARY_SCHOOL_IDIOM_STORY_PICTURE_BOOK_RULES
load_rule_for_primary_school_idiom_story_ppt_generation = PRIMARY_SCHOOL_IDIOM_STORY_PICTURE_BOOK_RULES
load_rule_for_idiom_story_ppt_layout_and_text_avoidance = PRIMARY_SCHOOL_IDIOM_STORY_PICTURE_BOOK_RULES

<!-- 三字经教学 PPT 批量生成。 -->
THREE_CHARACTER_CLASSIC_PPT_RULES = local/common/中文教学/rule/教学图片与PPT生成/RUL_三字经教学PPT批量生成工作流程规则.md
load_rule_for_three_character_classic_ppt_generation = THREE_CHARACTER_CLASSIC_PPT_RULES
