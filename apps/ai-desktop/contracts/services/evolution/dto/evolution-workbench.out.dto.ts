import type { EvolutionWorkbenchViewValue } from "../value/evolution-workbench.value.js";
/**
 * Evolution 工作台查询、分页、定位和轻量事件协议。
 * 生产者：Evolution 查询服务；消费者：Renderer Evolution 工作台。
 * 数据方向：Renderer 查询 -> Evolution，查询结果和事件 -> Renderer。
 * 本文件不包含人物命令、原始 JSON、内部路径或持久化实现。
 */

/** 每行只公开人可读字段和稳定业务关联，不把原始 JSON、内部路径或机器字段交给页面。 */
export interface EvolutionWorkbenchRowOutDto {
  id: string;
  topicId: string | null;
  proposalId: string | null;
  taskId: string | null;
  title: string;
  status: string;
  stage: string;
  owner: string;
  blockedReason: string | null;
  recoveryPoint: string | null;
  nextStep: string;
  updatedAt: string;
}

export interface EvolutionWorkbenchPageOutDto {
  view: EvolutionWorkbenchViewValue;
  page: number;
  pageSize: number;
  total: number;
  rows: EvolutionWorkbenchRowOutDto[];
  stateVersion: string;
  generatedAt: string;
}

export interface EvolutionWorkbenchPreferenceOutDto {
  perspective: "nangong" | "hanli";
  nodeId: string;
  page: number;
  pageSize: number;
  keyword: string;
  status: string;
  selectedRowId: string | null;
  updatedAt: string;
}

/** 独立工作台的位置同时描述人物、树节点、列表查询和当前记录。 */
export interface EvolutionWorkspaceLocationOutDto {
  perspective: "nangong" | "hanli";
  nodeId: string | null;
  page: number;
  pageSize: number;
  keyword: string;
  status: string;
  selectedRowId: string | null;
}
