/**
 * 人物服务向 Renderer 输出当前真实处理阶段。
 * 主进程从持久恢复点和本进程运行事实组合，页面只展示，不调度任务或推断完成。
 */
export interface PersonaConversationActivityOutDto {
  /** 原始用户消息编号；重试必须沿用，禁止复制新一轮用户消息。 */
  requestId: string;
  /** 当前动作所属业务；普通自由回答不提供此投影。 */
  kind: "inquiry";
  /** 当前实际阶段，不代表整个任务已经完成。 */
  phase: "queued" | "investigating" | "assessing" | "explaining" | "completed" | "blocked";
  /** interrupted 表示恢复点存在但当前进程没有执行者，可以从原阶段恢复。 */
  status: "running" | "retryable" | "interrupted" | "completed" | "blocked";
  /** 当前调查轮次，从 1 开始；重试同阶段不增加轮次。 */
  round: number;
  /** 面向客户的阶段说明或明确失败原因，不包含模型内部判断原文。 */
  summary: string;
  /** 当前阶段真正开始的时间，不随页面读取变化。 */
  updatedAt: string;
}
