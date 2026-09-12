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
  /** 当前有效任务链，供页面关联只读执行记录。 */
  effectiveTaskIds: string[];
  /** 替代链损坏或任务缺失时保留稳定标识，禁止猜测完成。 */
  missingTaskIds: string[];
  /** 最新真实验收结论；历史记录不覆盖此字段。 */
  latestAcceptance: CurrentTopicAcceptanceOutDto | null;
  /** 生成此投影时使用的最新权威事实时间。 */
  updatedAt: string;
}
