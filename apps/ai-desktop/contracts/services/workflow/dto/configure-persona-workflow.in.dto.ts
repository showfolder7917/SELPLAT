/**
 * Workflow 自动演化配置输入协议。
 * 生产者：Renderer 自动化控制面；消费者：Workflow 编排服务。
 * 数据方向：Renderer -> preload -> IPC -> Workflow。
 * 本文件不包含任何人物判断，也不直接修改 Evolution 状态。
 */
// LocaleValue 说明自动演化输出应使用的语言和区域设置。
import type { LocaleValue } from "../../../foundation/index.js";
// WorkspaceStateOutDto 限定自动演化允许读取和修改的工作区。
import type { WorkspaceStateOutDto } from "../../support/platform/workspace/index.js";

/** Renderer 提交给 Workflow 的自动演化运行参数。 */
export interface ConfigurePersonaWorkflowInDto {
  /** 每个专题最多自动运行的轮数；null 表示不设置业务轮数上限。 */
  maxRoundsPerTopic: number | null;
  /** 同一专题允许自动纠正失败结果的最大轮数。 */
  maxCorrectionRounds: number;
  /** 仅允许已查明事实的授权范围内代确认；不授予文件或命令权限。 */
  automaticCustodyEnabled?: boolean;
  /** 已经由用户确认的工作区；省略时沿用当前配置。 */
  workspaceState?: WorkspaceStateOutDto;
  /** 自动演化输出语言；省略时沿用当前配置。 */
  locale?: LocaleValue;
}
