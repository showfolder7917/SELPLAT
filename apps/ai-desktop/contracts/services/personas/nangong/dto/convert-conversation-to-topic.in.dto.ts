/**
 * 南宫婉把当前会话冻结为正式课题的输入协议。
 * 生产者：Renderer 南宫婉页面；消费者：南宫婉专题应用服务。
 * 数据方向：Renderer -> 南宫婉 -> Evolution。
 * 本文件不隐式确认用户意图，也不绕过专题状态版本控制。
 */
import type { LocaleValue } from "../../../../foundation/index.js";
import type { WorkspaceStateOutDto } from "../../../support/platform/workspace/index.js";

export interface ConvertNangongConversationToTopicInDto {
  /** 只有用户在界面中明确确认后，当前对话材料才允许冻结为正式课题。 */
  confirmedByUser: true;
  title: string;
  goal: string;
  scope: string[];
  exclusions?: string[];
  evidence: string[];
  acceptanceCriteria: string[];
  workspaceState: WorkspaceStateOutDto;
  locale: LocaleValue;
}
