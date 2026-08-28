# 网页个性化预设、生命周期与验收规则

<!-- 本规则是原聚合规则的独立职责分片；当前有效 DSL 原值保持不变。 -->
rule_version = 1.0.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 本职责分片处于生产启用状态。 -->
rule_status = active

<!-- 本职责没有独立 Java 能力入口。 -->
java_ability_refs = none
<!-- 本职责没有独立 Python 能力入口。 -->
python_ability_refs = none
<!-- 本职责没有独立 Node 能力入口。 -->
node_ability_refs = none

web_personalization_presets = deep-space
<!-- web_personalization_presets.2 的当前独立事实为 transparent。 -->
web_personalization_presets.2 = transparent
<!-- web_personalization_presets.3 的当前独立事实为 eye-care。 -->
web_personalization_presets.3 = eye-care
<!-- web_personalization_presets.4 的当前独立事实为 high-contrast。 -->
web_personalization_presets.4 = high-contrast
<!-- web_personalization_presets.5 的当前独立事实为 default。 -->
web_personalization_presets.5 = default
<!-- web_personalization_default_preset_values 的当前独立事实为 frame-opacity:100。 -->
web_personalization_default_preset_values = frame-opacity:100
<!-- web_personalization_default_preset_values.2 的当前独立事实为 panel-opacity:48。 -->
web_personalization_default_preset_values.2 = panel-opacity:48
<!-- web_personalization_default_preset_values.3 的当前独立事实为 background-frost:39。 -->
web_personalization_default_preset_values.3 = background-frost:39
<!-- web_personalization_default_preset_values.4 的当前独立事实为 theme-tint:68。 -->
web_personalization_default_preset_values.4 = theme-tint:68
<!-- web_personalization_default_preset_values.5 的当前独立事实为 panel-radius:50。 -->
web_personalization_default_preset_values.5 = panel-radius:50
<!-- web_personalization_default_preset_values.6 的当前独立事实为 frame-width:50。 -->
web_personalization_default_preset_values.6 = frame-width:50
<!-- web_personalization_default_preset_values.7 的当前独立事实为 panel-scale:50。 -->
web_personalization_default_preset_values.7 = panel-scale:50
<!-- web_personalization_default_preset_values.8 的当前独立事实为 inner-panel-fit:100。 -->
web_personalization_default_preset_values.8 = inner-panel-fit:100
<!-- web_personalization_default_preset_values.9 的当前独立事实为 content-inset:50。 -->
web_personalization_default_preset_values.9 = content-inset:50
<!-- web_personalization_default_preset_values.10 的当前独立事实为 panel-gap:50。 -->
web_personalization_default_preset_values.10 = panel-gap:50
<!-- web_personalization_default_preset_values.11 的当前独立事实为 glow-spread:55。 -->
web_personalization_default_preset_values.11 = glow-spread:55
<!-- web_personalization_default_preset_values.12 的当前独立事实为 control-gap:50。 -->
web_personalization_default_preset_values.12 = control-gap:50
<!-- web_personalization_default_preset_values.13 的当前独立事实为 window-motion:60。 -->
web_personalization_default_preset_values.13 = window-motion:60
<!-- web_personalization_default_preset_values.14 的当前独立事实为 glow-motion:46。 -->
web_personalization_default_preset_values.14 = glow-motion:46
<!-- web_personalization_default_preset_values.15 的当前独立事实为 reduced-motion:false。 -->
web_personalization_default_preset_values.15 = reduced-motion:false
<!-- web_personalization_manual_change_state 的当前独立事实为 custom-runtime-only。 -->
web_personalization_manual_change_state = custom-runtime-only
<!-- web_personalization_manual_change_must_not_create_visible_preset 的当前独立事实为 true。 -->
web_personalization_manual_change_must_not_create_visible_preset = true
<!-- web_personalization_preset_must_be_skin_independent 的当前独立事实为 true。 -->
web_personalization_preset_must_be_skin_independent = true
<!-- web_personalization_manual_change_clears_visible_preset_selection 的当前独立事实为 true。 -->
web_personalization_manual_change_clears_visible_preset_selection = true

<!-- 临时个性化模式禁止写入浏览器持久化存储，刷新页面必须恢复代码默认值。 -->
web_personalization_persistence_mode = ephemeral-page-state
<!-- web_personalization_must_not_write 的当前独立事实为 local-storage。 -->
web_personalization_must_not_write = local-storage
<!-- web_personalization_must_not_write.2 的当前独立事实为 session-storage。 -->
web_personalization_must_not_write.2 = session-storage
<!-- web_personalization_must_not_write.3 的当前独立事实为 indexed-db。 -->
web_personalization_must_not_write.3 = indexed-db
<!-- web_personalization_must_not_write.4 的当前独立事实为 cookie。 -->
web_personalization_must_not_write.4 = cookie
<!-- web_personalization_reload_result 的当前独立事实为 code-defaults。 -->
web_personalization_reload_result = code-defaults

<!-- 交付前验证两级信息架构、全部参数、预设、换肤 token、紧凑视口、浮层定位、刷新复位、键盘路径和控制台。 -->
web_personalization_qa = two-top-level-sections
<!-- web_personalization_qa.2 的当前独立事实为 all-ranges。 -->
web_personalization_qa.2 = all-ranges
<!-- web_personalization_qa.3 的当前独立事实为 all-presets。 -->
web_personalization_qa.3 = all-presets
<!-- web_personalization_qa.4 的当前独立事实为 theme-token-override。 -->
web_personalization_qa.4 = theme-token-override
<!-- web_personalization_qa.5 的当前独立事实为 arbitrary-color。 -->
web_personalization_qa.5 = arbitrary-color
<!-- web_personalization_qa.6 的当前独立事实为 quick-swatches。 -->
web_personalization_qa.6 = quick-swatches
<!-- web_personalization_qa.7 的当前独立事实为 follow-skin。 -->
web_personalization_qa.7 = follow-skin
<!-- web_personalization_qa.8 的当前独立事实为 shared-frame-tint。 -->
web_personalization_qa.8 = shared-frame-tint
<!-- web_personalization_qa.9 的当前独立事实为 structural-surface-color-scan。 -->
web_personalization_qa.9 = structural-surface-color-scan
<!-- web_personalization_qa.10 的当前独立事实为 semantic-color-isolation。 -->
web_personalization_qa.10 = semantic-color-isolation
<!-- web_personalization_qa.11 的当前独立事实为 compact-viewport。 -->
web_personalization_qa.11 = compact-viewport
<!-- web_personalization_qa.12 的当前独立事实为 popup-positioning。 -->
web_personalization_qa.12 = popup-positioning
<!-- web_personalization_qa.13 的当前独立事实为 reload-defaults。 -->
web_personalization_qa.13 = reload-defaults
<!-- web_personalization_qa.14 的当前独立事实为 keyboard。 -->
web_personalization_qa.14 = keyboard
<!-- web_personalization_qa.15 的当前独立事实为 console。 -->
web_personalization_qa.15 = console
<!-- web_personalization_qa.16 的当前独立事实为 visual-comparison。 -->
web_personalization_qa.16 = visual-comparison
