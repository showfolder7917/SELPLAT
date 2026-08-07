# 当前用户跨工程通用规则索引

<!-- 用户明确委托规则适用于当前稳定用户点名的任意 core/common 修改，不归属单个业务项目。 -->
RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES = local/XUNAN/跨工程通用规则/RUL_用户明确委托AI修正规则.md

<!-- Excel 修订履历规则只对当前稳定用户的工作簿修正任务生效，避免把局部修改误登记到全部 Sheet。 -->
EXCEL_REVISION_HISTORY_RULES = local/XUNAN/跨工程通用规则/RUL_Excel修订履历填写规则.md
<!-- 用户要求修正Excel内容、修订标识或履历时加载本规则。 -->
load_rule_for_active_user_excel_revision_or_correction = EXCEL_REVISION_HISTORY_RULES
