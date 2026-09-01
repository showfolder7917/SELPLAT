/**
 * Workflow 统一审批投影允许收录的真实业务来源。
 *
 * 生产者：Workflow Repository 在写入审批投影时赋值。
 * 消费者：审批治理查询与 Renderer 只读视图。
 * 数据方向：Workflow -> DesktopApi -> Renderer。
 * 本 Value 不定义各来源内部的审批状态机或决策含义。
 */
export type ApprovalGovernanceDomainValue = "evolution" | "collaboration-review" | "codex-command";
