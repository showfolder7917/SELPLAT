/**
 * Evolution 长期自动化设置与运行事实输出协议。
 * 生产者：Workflow 自动化编排；消费者：Evolution 状态聚合与 Renderer 控制面。
 * 数据方向：Workflow -> Evolution 状态 -> Renderer。
 * 本文件不定义控制命令，也不启动或停止运行时。
 */
export interface EvolutionAutomationSettingsOutDto {
  /** null 表示研讨无限模式；轮次数只控制韩立发问过程，不能代替专题确立判断。 */
  maxRoundsPerTopic: number | null;
  maxCorrectionRounds: number;
  /** 缺省关闭；与令狐巡检和执行任务的存活状态独立。 */
  automaticCustodyEnabled?: boolean;
}

export interface EvolutionAutomationRuntimeOutDto {
  status: "idle" | "running" | "paused" | "stopped" | "blocked";
  completedRounds: number;
  correctionRounds: number;
  stopReason: string | null;
  startedAt: string | null;
  pausedAt: string | null;
}
