/**
 * Workflow 自动演化配置输入协议。
 * 生产者：Renderer 自动化控制面；消费者：Workflow 编排服务。
 * 数据方向：Renderer -> preload -> IPC -> Workflow。
 * 本文件不包含任何人物判断，也不直接修改 Evolution 状态。
 */
import type { LocaleValue } from "../../../foundation/index.js";
import type { WorkspaceStateOutDto } from "../../support/platform/workspace/index.js";

export interface ConfigurePersonaWorkflowInDto {
  maxRoundsPerTopic: number | null;
  maxCorrectionRounds: number;
  workspaceState?: WorkspaceStateOutDto;
  locale?: LocaleValue;
}
