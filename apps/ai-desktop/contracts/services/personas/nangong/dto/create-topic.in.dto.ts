/**
 * 南宫婉新建 Evolution 专题输入协议。
 * 生产者：Renderer 南宫婉页面；消费者：南宫婉专题应用服务。
 * 数据方向：Renderer -> 南宫婉 -> Evolution。
 * 本文件不包含审批或分发决定。
 */
import type { LocaleValue } from "../../../../foundation/index.js";
import type { WorkspaceStateOutDto } from "../../../support/platform/workspace/index.js";

export interface CreateNangongTopicInDto {
  title: string;
  goal: string;
  scope: string[];
  exclusions?: string[];
  evidence: string[];
  acceptanceCriteria: string[];
  workspaceState: WorkspaceStateOutDto;
  locale: LocaleValue;
}
