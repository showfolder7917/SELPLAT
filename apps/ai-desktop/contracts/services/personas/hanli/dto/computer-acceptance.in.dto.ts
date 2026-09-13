import type { AcceptanceSceneSegmentOutDto } from "./acceptance-scene.out.dto.js";

/**
 * 运行时签发给韩立真实验收会话的最小交互范围。
 *
 * 生产者：演化运行时；消费者：韩立窗口验收器。
 * 数据方向：已批准提案 -> 运行时 -> 验收器；禁止职责：模型和 Renderer 不能自行添加此范围。
 */
export type HanliAcceptanceInteractionCapability = "workspace-explorer" | "workspace-explorer-scenarios";

/**
 * 已签发工作区验收夹具的只读操作说明。
 * 生产者：桌面 IPC 组合根；消费者：韩立场景规划和界面验收；禁止职责：不暴露临时路径，不允许模型创建、选择或修改夹具。
 */
export interface WorkspaceAcceptanceFixtureContextOutDto {
  kind: "workspace-explorer";
  mode: "basic" | "scenarios";
  /** 本轮临时根的可见名称；用于在不泄露路径的前提下确认添加前后状态。 */
  displayName: string;
  instructions: string[];
}

/**
 * 场景准备前由演化运行时生成的只读身份快照。
 *
 * 生产者：一次性演化运行时；消费者：韩立场景规划器。
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
 * 生产者：演化运行时；消费者：韩立场景规划与验收器。
 * 数据方向：运行时 -> 场景准备 -> 验收器；禁止职责：不能由此 DTO 修改产品、任务或验收状态。
 */
export interface HanliComputerAcceptanceInDto {
  topicId: string;
  proposalId: string;
  title: string;
  criteria: string[];
  /**
   * 当前场景中每条条件对应的原提案稳定编号；缺省时按完整提案顺序生成。
   * 该字段只由主进程拆分场景时写入，避免模型把局部序号冒充原条件编号。
   */
  criterionIds?: string[];
  /**
   * 当前提案明确允许验收器执行的受限页面交互；缺省时保持既有导航白名单。
   *
   * 来源：演化运行时根据已批准范围签发；生命周期：仅当前验收运行有效；安全边界：不能由场景计划或模型文字提升。
   */
  interactionCapabilities?: HanliAcceptanceInteractionCapability[];
  /** 当前运行已预备的临时验收数据说明；只用于选择并执行受控验收场景。 */
  workspaceAcceptanceFixture?: WorkspaceAcceptanceFixtureContextOutDto;
  /** 仅当前窗口场景必须提供的运行时身份事实，用于阻止模型臆测记录缺失。 */
  sceneContext?: AcceptanceSceneRuntimeContextOutDto;
  /** 韩立当前证据阶段的已准备场景，不代表页面验收通过。 */
  preparedScene?: AcceptanceSceneSegmentOutDto;
  /** 跨完成态验收的受控阶段；前置门只确认真实验收场景可用，后置阶段只读复核原条件。 */
  reviewMode?: "pre-completion-gate" | "post-completion-review";
  /** 后续证据段可读取的前序阶段可信摘要；只传递已归档事实，不授予历史截图或已释放夹具的操作能力。 */
  priorPhaseEvidence?: { summary: string; evidenceAttachmentIds: string[] };
}
