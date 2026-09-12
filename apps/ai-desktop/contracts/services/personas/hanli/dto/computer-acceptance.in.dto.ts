import type { AcceptanceScenePlanOutDto } from "./acceptance-scene.out.dto.js";

/**
 * 场景准备前由演化运行时生成的只读身份快照。
 *
 * 生产者：一次性演化运行时；消费者：令狐场景规划器。
 * 数据方向：运行时 -> 场景规划；禁止职责：不能作为任务、提案或验收状态的写入入口。
 */
export interface AcceptanceSceneRuntimeContextOutDto {
  /** 当前真实专题的稳定标识与只读状态。 */
  topic: { topicId: string; status: string };
  /** 当前真实提案的稳定标识、所属专题与只读状态。 */
  proposal: { proposalId: string; topicId: string; status: string };
  /** 当前一次性运行的关联身份和阶段；不存在时为 null，不能虚构运行记录。 */
  oneShotRun: { topicId: string | null; proposalId: string | null; status: string; phase: string } | null;
}

/**
 * 只携带验收目标、只读场景上下文和准备结果；不携带预生成的操作清单。
 *
 * 生产者：演化运行时；消费者：令狐场景规划与韩立验收器。
 * 数据方向：运行时 -> 场景准备 -> 验收器；禁止职责：不能由此 DTO 修改产品、任务或验收状态。
 */
export interface HanliComputerAcceptanceInDto {
  topicId: string;
  proposalId: string;
  title: string;
  criteria: string[];
  /** 仅当前窗口场景必须提供的运行时身份事实，用于阻止模型臆测记录缺失。 */
  sceneContext?: AcceptanceSceneRuntimeContextOutDto;
  /** 令狐准备成功后附带的场景事实，不代表页面验收通过。 */
  preparedScene?: AcceptanceScenePlanOutDto;
  /** 跨完成态验收的受控阶段；前置门只确认真实验收场景可用，后置阶段只读复核原条件。 */
  reviewMode?: "pre-completion-gate" | "post-completion-review";
}
