/**
 * 南宫婉课题草稿生成输入协议。
 * 生产者：Renderer 南宫婉页面；消费者：南宫婉课题整理服务。
 * 数据方向：Renderer -> 南宫婉。
 * 本文件不保存草稿，也不启动专题流转。
 */
import type { LocaleValue } from "../../../../foundation/index.js";
import type { WorkspaceStateOutDto } from "../../../support/platform/workspace/index.js";

export interface GenerateNangongTopicDraftInDto {
  workspaceState: WorkspaceStateOutDto;
  locale: LocaleValue;
}
