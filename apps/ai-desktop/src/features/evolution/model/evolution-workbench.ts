import type { EvolutionWorkspaceLocation, NangongEvolutionState } from "../../../../contracts/desktop/desktop";

const STATUS_LABELS: Record<string, string> = {
  registered: "已登记", investigating: "调查中", "pending-approval": "待审批", "supplement-required": "待补充", rejected: "已退回",
  approved: "已通过", executing: "执行中", verifying: "验证中", "pending-acceptance": "待验收", completed: "已完成", blocked: "已阻塞",
  questioning: "研讨中", "ready-to-establish": "可确立专题", established: "已确立", open: "待处理", processing: "处理中", resolved: "已解决",
  passed: "已通过", failed: "失败", pending: "等待中", running: "运行中", recovering: "恢复中", stalled: "已停滞",
  idle: "空闲", paused: "已暂停", stopped: "已停止",
};

export function evolutionStatusLabel(status: string): string { return STATUS_LABELS[status] || status; }
export function workbenchOwnerLabel(owner: string): string { return ({ "han-li": "韩立", "nangong-wan": "南宫婉", "linghu-ancestor": "令狐老祖", "collaboration-coordinator": "协同调度" } as Record<string, string>)[owner] || owner; }
export function evolutionOwnerForStatus(status: string, origin: string): string {
  if (status === "pending-approval") return "han-li";
  if (["executing", "verifying", "pending-acceptance"].includes(status)) return "collaboration-coordinator";
  return origin === "linghu" ? "linghu-ancestor" : "nangong-wan";
}

/** 为一次人工专题写操作生成页面版本快照和不可复用的幂等键。 */
export function evolutionMutationRequest(state: NangongEvolutionState) {
  return { expectedStateVersion: state.updatedAt, idempotencyKey: crypto.randomUUID() };
}

export function defaultEvolutionWorkspaceLocation(perspective: "nangong" | "hanli", nodeId: string | null = null): EvolutionWorkspaceLocation {
  return { perspective, nodeId: nodeId || (perspective === "hanli" ? "manual-approval" : "manual-topic"), page: 1, pageSize: 20, keyword: "", status: "", selectedRowId: null };
}

/** 从窗口地址恢复稳定人物、节点、查询页和选中记录；非法数值回到当前基线，不猜测旧格式。 */
export function evolutionWorkspaceLocationFromSearch(search: string): EvolutionWorkspaceLocation {
  const params = new URLSearchParams(search);
  const perspective = params.get("perspective") === "hanli" ? "hanli" : "nangong";
  const pageSizeValue = Number(params.get("pageSize"));
  return {
    perspective,
    nodeId: params.get("node")?.trim() || null,
    page: Math.max(1, Math.floor(Number(params.get("page")) || 1)),
    pageSize: [20, 50, 100].includes(pageSizeValue) ? pageSizeValue : 20,
    keyword: params.get("keyword")?.slice(0, 120) || "",
    status: params.get("status")?.slice(0, 80) || "",
    selectedRowId: params.get("selected")?.trim().slice(0, 200) || null,
  };
}

export function evolutionWorkspaceLocationSearch(location: EvolutionWorkspaceLocation): string {
  const params = new URLSearchParams({ mode: "evolution-workspace", perspective: location.perspective, node: location.nodeId || "", page: String(location.page), pageSize: String(location.pageSize), keyword: location.keyword, status: location.status, selected: location.selectedRowId || "" });
  return `?${params.toString()}`;
}
