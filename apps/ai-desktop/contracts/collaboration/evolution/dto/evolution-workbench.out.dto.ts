/**
 * Evolution 工作台查询、分页、定位和轻量事件协议。
 * 生产者：Evolution 查询服务；消费者：Renderer Evolution 工作台。
 * 数据方向：Renderer 查询 -> Evolution，查询结果和事件 -> Renderer。
 * 本文件不包含人物命令、原始 JSON、内部路径或持久化实现。
 */
export type EvolutionWorkbenchView =
  | "topics"
  | "deliberations"
  | "pending-approvals"
  | "approvals"
  | "proposals"
  | "tasks"
  | "releases"
  | "archives"
  | "automation-runs"
  | "recovery"
  | "exceptions";

export interface QueryEvolutionWorkbenchRequest {
  view: EvolutionWorkbenchView;
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  sortField?: "updatedAt" | "createdAt" | "title" | "status";
  sortDirection?: "asc" | "desc";
}

/** 每行只公开人可读字段和稳定业务关联，不把原始 JSON、内部路径或机器字段交给页面。 */
export interface EvolutionWorkbenchRow {
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

export interface EvolutionWorkbenchPage {
  view: EvolutionWorkbenchView;
  page: number;
  pageSize: number;
  total: number;
  rows: EvolutionWorkbenchRow[];
  stateVersion: string;
  generatedAt: string;
}

/** previousStateVersion 与当前页版本不一致时，页面必须重新查询，禁止以旧事件覆盖新事实。 */
export interface EvolutionWorkbenchChangeEvent {
  entityType: "topic" | "deliberation" | "proposal" | "automation" | "workspace" | "conversation";
  entityId: string;
  topicId: string | null;
  proposalId: string | null;
  reason: string;
  previousState: string | null;
  currentState: string | null;
  currentStage: string | null;
  currentOwner: string | null;
  blockingReason: string | null;
  nextAction: string | null;
  previousStateVersion: string;
  stateVersion: string;
  updatedAt: string;
  affectedViews: EvolutionWorkbenchView[];
}

export interface EvolutionWorkbenchPreference {
  perspective: "nangong" | "hanli";
  nodeId: string;
  page: number;
  pageSize: number;
  keyword: string;
  status: string;
  selectedRowId: string | null;
  updatedAt: string;
}

export type SaveEvolutionWorkbenchPreferenceRequest = Omit<EvolutionWorkbenchPreference, "updatedAt">;

/** 独立工作台的位置同时描述人物、树节点、列表查询和当前记录。 */
export interface EvolutionWorkspaceLocation {
  perspective: "nangong" | "hanli";
  nodeId: string | null;
  page: number;
  pageSize: number;
  keyword: string;
  status: string;
  selectedRowId: string | null;
}
