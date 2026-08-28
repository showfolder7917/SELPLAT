# AI Desktop 官方 Harness 接入规则

<!-- 本规则由应用 Electron/TypeScript 源码直接实现，不建立 Java 能力。 -->
java_ability_refs = none
<!-- 本规则没有独立 Python 自动化职责，不建立空能力入口。 -->
python_ability_refs = none
<!-- 官方 harness 适配属于应用生产源码，不是 rule-engine Node 能力，因此不伪造 ability ID。 -->
node_ability_refs = none
<!-- 真实应用程序入口固定为 Electron 主进程服务，供规则核对调用方和验证路径。 -->
application_program_path = apps/ai-desktop/electron/services/codex-service.ts
<!-- 5.107.0 增加 Codex 桌面当前工作区逐轮训练语料显式入库开关与完成监听。 -->
<!-- 5.108.0 统一 Codex、南宫婉与韩立训练语料来源，并由 AI 回合元数据确认主题、标签和 300 字主旨。 -->
<!-- 5.110.0 增加历史 Codex 最终回答的隔离 AI 语义补齐、全局近期优先与原消息去重。 -->
rule_version = 5.110.0
<!-- 规则所有者始终从工程根稳定用户声明解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 当前规则已经登记到 SELPLAT 应用索引。 -->
rule_status = active

<!-- 原逻辑 ID 保留为兼容聚合入口，并显式加载已拆分的职责规则。 -->
requires_rule_ids = AI_DESKTOP_EVENT_MEMORY_UI_RULES,AI_DESKTOP_HARNESS_WORKSPACE_RUNTIME_RULES,AI_DESKTOP_COLLABORATION_AUTOMATION_RULES,AI_DESKTOP_SCREENSHOT_INPUT_RULES,AI_DESKTOP_EVOLUTION_PERSISTENCE_RELEASE_RULES
