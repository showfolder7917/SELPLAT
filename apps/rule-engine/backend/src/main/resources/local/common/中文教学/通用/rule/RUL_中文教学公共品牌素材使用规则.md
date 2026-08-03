# 中文教学公共品牌素材使用规则

<!-- Java 当前没有承载品牌素材调用的登记能力，显式写 none 防止猜测入口。 -->
java_ability_refs = none
<!-- Python 当前没有承载品牌素材调用的登记能力，显式写 none 防止猜测入口。 -->
python_ability_refs = none
<!-- Node 生成器是素材消费者而非登记能力，显式写 none 保持注册边界真实。 -->
node_ability_refs = none
<!-- 规则从 1.0.0 起步，品牌素材或使用边界变化时必须升级版本。 -->
rule_version = 1.0.0
<!-- 本规则属于中文教学大项目的跨子项目通用层。 -->
rule_owner = common/中文教学
<!-- active 表示规则已由中文教学通用索引登记并进入生产加载树。 -->
rule_status = active
<!-- 本次升级把原先散放的公共 Logo 收敛为唯一规则包，禁止各应用复制二进制资产。 -->
upgrade_record = 2026-08-03:建立中文教学公共品牌素材唯一规则包并迁移真实Logo

<!-- 问题：同一真实品牌 Logo 被多个中文教学子项目使用，若分别放入应用模板会造成二进制复制和版本分叉。 -->
<!-- 场景：口才与表演、古诗教学或其他中文教学成品明确要求品牌版、封面或角标。 -->
<!-- 业务含义：所有子项目复用一个经过确认的真实品牌文件，不临时生成、不仿制、不复制。 -->

<!-- 公共品牌素材固定进入本规则对应的可选 template 材料目录。 -->
chinese_teaching_public_brand_template_root = local/common/中文教学/通用/template/RUL_中文教学公共品牌素材使用规则/
<!-- 当前唯一确认的品牌文件使用稳定相对路径，供规则和生成器共同定位。 -->
chinese_teaching_public_brand_logo = local/common/中文教学/通用/template/RUL_中文教学公共品牌素材使用规则/新思度华文学堂.png
<!-- 多个中文教学子项目必须复用同一文件，禁止把 Logo 复制到各应用 template。 -->
chinese_teaching_brand_asset_reuse_policy = one_shared_binary_no_application_copy
<!-- 只有用户或上级规则明确要求品牌版、封面或角标时才允许加入品牌素材。 -->
chinese_teaching_brand_usage_requires = explicit_brand_cover_or_corner_mark_requirement
<!-- 品牌图必须作为真实二进制嵌入，禁止由图片模型生成、重绘或仿制。 -->
chinese_teaching_brand_logo_must_use_verified_binary = true
<!-- 品牌图不得遮挡标题、正文、拼音、插画主体、导航或其他教学安全区。 -->
chinese_teaching_brand_logo_must_not_cover = title,body,pinyin,illustration_subject,navigation,teaching_safe_area
<!-- 未明确要求品牌时禁止自动加入，保证教学内容优先。 -->
chinese_teaching_brand_logo_must_not_be_added_implicitly = true

<!-- 当前规则已有真实 Logo 材料，因此 template 目录适用且不得用生成文件替换。 -->
template_applicability = applicable_verified_existing_brand_binary
<!-- 品牌二进制本身就是核定材料，不另造案例以免产生第二份 Logo。 -->
example_not_applicable_reason = verified_logo_binary_is_the_only_authoritative_visual_material
<!-- 程序只消费本规则材料，当前没有需要单独登记的新品牌处理能力。 -->
program_not_applicable_reason = existing_generators_consume_asset_without_new_brand_processing_ability
<!-- 验证必须确认文件存在可解码、所有消费者使用唯一新路径且旧品牌目录已经移除。 -->
verification_contract = asset_exists_and_decodes,all_consumers_use_single_path,legacy_brand_path_absent
