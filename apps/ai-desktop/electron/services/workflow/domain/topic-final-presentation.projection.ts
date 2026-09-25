/**
 * 专题最终展示结论的纯读取规则。
 *
 * 生产者：当前专题投影与 SQLite 时间线读模型。
 * 消费者：专题卡状态、摘要和下一步。
 * 数据方向：同专题的终态与后续活动事实 -> 稳定展示结论。
 * 本文件不读取数据库、不写入档案，也不依赖 Renderer。
 */

/** 领域层已经验证的终态事实。 */
export type TopicTerminalPresentationFact = {
  /** 终态发生时间；同一时间戳的活动不应反向覆盖该终态。 */
  occurredAt: string;
  /** 用户可读的最终结论。 */
  summary: string;
};

/** 终态之后仍在生效的真实活动。 */
export type TopicLaterPresentationActivity = {
  /** 活动的真实发生时间。 */
  occurredAt: string;
  /** 只有阻塞、失败、验收和运行活动能够推翻旧终态。 */
  status: "running" | "verifying" | "blocked";
  /** 活动的用户可读摘要。 */
  summary: string;
};

/** 专题卡可直接消费的唯一终态展示结果。 */
export type TopicFinalPresentation = {
  status: "completed" | "running" | "verifying" | "blocked";
  summary: string;
  nextStep: string;
  terminalAt: string | null;
};

/**
 * 在已验证终态与其后的真实活动之间选择专题的最终展示结论。
 *
 * 真实传参示例：传入通过验收 `terminal` 与其后发生的 `blocked` 修复活动，返回阻塞而非旧完成。
 * 真实返回示例：只有通过验收时返回 `completed` 和“可开始下一专题”。
 * 异常或副作用示例：证据不足时返回 null；调用方保留自己的非终态投影，函数不会写入任何状态。
 */
export function projectTopicFinalPresentation(input: {
  terminal: TopicTerminalPresentationFact | null;
  laterActivity: TopicLaterPresentationActivity | null;
}): TopicFinalPresentation | null {
  if (!input.terminal) return null;
  const activity = input.laterActivity;
  if (activity && activity.occurredAt > input.terminal.occurredAt) {
    return {
      status: activity.status,
      summary: activity.summary,
      nextStep: activity.status === "blocked" ? "保留失败证据并从原恢复点处理。" : "完成当前处理后重新读取专题结论。",
      terminalAt: input.terminal.occurredAt,
    };
  }
  return {
    status: "completed",
    summary: input.terminal.summary || "最终验收已通过，专题已完成。",
    nextStep: "可开始下一专题。",
    terminalAt: input.terminal.occurredAt,
  };
}
