/**
 * 当前专题阶段只读投影。
 * 生产者：Evolution/Workflow 运行时；消费者：Renderer 中需要展示当前专题结论的页面。
 * 数据方向：Evolution/Workflow -> Renderer。
 * 本文件不保存任务、验收或历史记录，也不从页面反推专题状态。
 */
export type CurrentTopicStageStatusValue =
  | "awaiting-confirmation"
  | "executing"
  | "verifying"
  | "awaiting-release"
  | "awaiting-restart-health"
  | "pending-acceptance"
  | "accepting"
  | "completed"
  | "failed-pending-repair"
  | "not-run";

/** 当前专题的最近一次真实验收结论；空值表示尚未产生真实验收。 */
export interface CurrentTopicAcceptanceOutDto {
  /** 韩立真实操作验收的稳定运行标识。 */
  runId: string;
  /** 真实验收的结果，不能由任务集成状态代替。 */
  status: "running" | "passed" | "failed" | "blocked";
  /** 该验收事实写入 Evolution 档案的时间。 */
  occurredAt: string;
}

/** 最终候选交付闭环的四项不可互相替代的事实。 */
export interface CurrentTopicDeliveryEvidenceOutDto {
  /** 当前有效任务链共同指向的最终候选；缺失时禁止把任意历史结果拼成完成。 */
  candidate: { generation: number; integrationSha: string } | null;
  /** 最终候选的完整统一测试结论。 */
  unifiedTest: "missing" | "passed" | "failed";
  /** 最终候选已经发布的独立事实。 */
  release: "missing" | "published";
  /** 发布版本已经完成重启健康检查的独立事实。 */
  restartHealth: "missing" | "passed";
  /** 当前验收计划轮次的真实验收结论。 */
  acceptance: "missing" | "running" | "passed" | "failed" | "blocked";
}

/** 一个专题在当前时刻唯一可展示的阶段结论。 */
export interface CurrentTopicStageOutDto {
  /** 当前专题；没有已建立专题时为 null。 */
  topicId: string | null;
  /** 当前专题正在处理的提案；没有提案时为 null。 */
  proposalId: string | null;
  /** 页面必须统一使用的当前阶段。 */
  status: CurrentTopicStageStatusValue;
  /** 当前专题标题或等待说明。 */
  title: string;
  /** 当前阶段的可读说明。 */
  summary: string;
  /** 当前有效任务提供的修复内容；没有任务时为空。 */
  repairContent: string;
  /** 当前阶段尚未满足的条件或失败原因；没有时为空。 */
  remaining: string;
  /** 当前正在等待的人或系统事实，页面不得从时间线节点反推。 */
  waitingFor: string;
  /** 用户可直接理解的下一步，页面不得从时间线节点反推。 */
  nextAction: string;
  /** 当前是否需要用户操作；读取受阻时由 Renderer 覆盖为重试政策。 */
  userAction: "none" | "confirmation" | "resume";
  /** 当前有效任务链，供页面关联只读执行记录。 */
  effectiveTaskIds: string[];
  /** 替代链损坏或任务缺失时保留稳定标识，禁止猜测完成。 */
  missingTaskIds: string[];
  /** 最新真实验收结论；历史记录不覆盖此字段。 */
  latestAcceptance: CurrentTopicAcceptanceOutDto | null;
  /** 最终候选的完整交付闭环证据。 */
  deliveryEvidence: CurrentTopicDeliveryEvidenceOutDto;
  /** 生成此投影时使用的最新权威事实时间。 */
  updatedAt: string;
}
