import { useEffect, useMemo, useRef } from "react";

import type { LocaleValue, EvolutionStateOutDto } from "../../../../contracts/system/desktop/index";

type EvolutionProposalOutDto = EvolutionStateOutDto["proposals"][number];
type SelGridApi = {
  create(host: HTMLElement, options: Record<string, unknown>): HTMLElement | null;
  mount(root: HTMLElement, payload: Record<string, unknown>): { destroy?(): void } | null;
};

/**
 * 使用正式 SELUI Grid 展示审批或提案进度，并把单选结果返回业务页面。
 * 真实传参示例：mode="approval"、proposals=[{ proposalId: "p1", title: "滚动条修正", ... }]。
 * 真实返回示例：用户选择 p1 时调用 onSelect("p1")，业务详情仍由外层页面决定。
 * 异常或副作用示例：SELUI 尚未装配时保持空宿主；卸载时销毁控制器和事件监听，避免重复响应。
 */
export function EvolutionProposalGrid({ id, proposals, selectedId, locale, mode, onSelect }: { id: string; proposals: EvolutionProposalOutDto[]; selectedId: string | null; locale: LocaleValue; mode: "approval" | "progress"; onSelect(proposalId: string): void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const payload = useMemo(() => {
    const rows = proposals.map((proposal) => {
      const latest = proposal.approvals.at(-1);
      return {
        id: proposal.proposalId,
        title: proposal.title,
        type: proposal.type,
        submitter: proposal.submitterDisplayName,
        approver: latest?.approverDisplayName || "待审批",
        status: proposal.status,
        createdAt: formatTime(proposal.createdAt, locale),
        approvalAt: latest ? formatTime(latest.createdAt, locale) : "—",
      };
    });
    const columns = mode === "approval"
      ? [
        { id: "title", field: "title", label: "标题", renderer: "text", width: "210px" },
        { id: "type", field: "type", label: "类型", renderer: "badge", width: "112px" },
        { id: "submitter", field: "submitter", label: "提交人", renderer: "text", width: "96px" },
        { id: "approver", field: "approver", label: "审批人", renderer: "text", width: "96px" },
        { id: "createdAt", field: "createdAt", label: "创建时间", renderer: "text", width: "150px" },
        { id: "approvalAt", field: "approvalAt", label: "审批时间", renderer: "text", width: "150px" },
      ]
      : [
        { id: "title", field: "title", label: "提案", renderer: "text", width: "220px" },
        { id: "type", field: "type", label: "类型", renderer: "badge", width: "112px" },
        { id: "status", field: "status", label: "状态", renderer: "badge", width: "132px" },
        { id: "createdAt", field: "createdAt", label: "提交时间", renderer: "text", width: "150px" },
      ];
    const pageSize = Math.max(1, rows.length);
    return {
      grid: { mode: "records", selectionMode: "SINGLE", idField: "id", searchFields: [], horizontalScroll: true, columnResize: true },
      data: { items: rows, selectedIds: selectedId ? [selectedId] : [] },
      column: { gridId: id, tableTitle: "", tableCode: "", ariaLabel: mode === "approval" ? "统一演化审批表" : "南宫婉提案进度表", emptyText: mode === "approval" ? "暂无待审批方案" : "讨论成熟后可形成提案", items: columns },
      title: { messages: { selectProject: "选择当前方案" } },
      select: { pageSize: { options: [{ value: String(pageSize), label: `${pageSize} 条` }] } },
      pagination: { mode: "LOCAL", currentPage: 1, pageSize, totalCount: rows.length, summaryAll: "共 {total} 条", summaryFiltered: "当前 {visible} 条 · 共 {total} 条", previousLabel: "上一页", nextLabel: "下一页", pageChangedMessage: "已切换到第 {page} 页", pageSizeChangedMessage: "每页显示 {size} 条" },
    };
  }, [id, locale, mode, proposals, selectedId]);

  useEffect(() => {
    const host = hostRef.current;
    const grid = (window as typeof window & { sel?: { components?: { grid?: SelGridApi } } }).sel?.components?.grid;
    if (!host || !grid) return;
    const root = grid.create(host, { gridId: id, entity: "EvolutionProposalOutDto", ariaLabel: mode === "approval" ? "统一演化审批表" : "南宫婉提案进度表" });
    if (!root) return;
    const handleSelection = (event: Event) => {
      const proposalId = String((event as CustomEvent<{ selectedIds?: string[] }>).detail?.selectedIds?.[0] || "");
      if (proposalId) onSelect(proposalId);
    };
    root.addEventListener("selGrid:selectionChange", handleSelection);
    const controller = grid.mount(root, payload);
    return () => {
      root.removeEventListener("selGrid:selectionChange", handleSelection);
      controller?.destroy?.();
      host.replaceChildren();
    };
  }, [id, mode, onSelect, payload]);

  return <div ref={hostRef} className={`evolution-proposal-grid-host${proposals.length ? "" : " empty"}`} />;
}

function formatTime(value: string, locale: LocaleValue): string {
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
