import { useEffect, useMemo, useRef, useState } from "react";

import type { EvolutionWorkbenchChangeEvent, EvolutionWorkbenchPage, EvolutionWorkbenchRow, EvolutionWorkbenchView, EvolutionWorkspaceLocation, Locale } from "../../../../contracts/desktop/desktop";
import { evolutionStatusLabel } from "../model/evolution-workbench";

type SelGridApi = {
  create(host: HTMLElement, options: Record<string, unknown>): HTMLElement | null;
  mount(root: HTMLElement, payload: Record<string, unknown>): { destroy?(): void } | null;
};
type WorkbenchSortField = "updatedAt" | "createdAt" | "title" | "status";
type WorkbenchQuery = { page: number; pageSize: number; keyword: string; status: string; sortField: WorkbenchSortField; sortDirection: "asc" | "desc" };
const DEFAULT_QUERY: WorkbenchQuery = { page: 1, pageSize: 20, keyword: "", status: "", sortField: "updatedAt", sortDirection: "desc" };
const WORKBENCH_COLUMN_IDS = ["title", "status", "stage", "owner", "nextStep", "updatedAt"] as const;
type WorkbenchColumnId = typeof WORKBENCH_COLUMN_IDS[number];

/**
 * 从 SQLite 读取一个专题工作台叶节点，并用正式 SELUI Grid 提供远程搜索、分页、选择和恢复动作。
 * 真实传参示例：view="pending-approvals"、perspective="hanli"、nodeId="manual-approval"。
 * 真实返回示例：查询返回 20 行时渲染当前页并通过 onSelectRow 返回选中行，页码与选择写入独立视图偏好表。
 * 异常或副作用示例：版本断档或后台恢复只重查当前页；查询失败不修改业务数据；恢复与令狐动作继续调用既有桌面能力。
 */
export function EvolutionDatabaseGrid({ id, title, view, perspective, nodeId, requestedLocation, onLocationChange, locale, onError, onSelectRow }: { id: string; title: string; view: EvolutionWorkbenchView; perspective: "nangong" | "hanli"; nodeId: string; requestedLocation: EvolutionWorkspaceLocation | null; onLocationChange(location: EvolutionWorkspaceLocation): void; locale: Locale; onError(message: string): void; onSelectRow?(row: EvolutionWorkbenchRow | null): void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<EvolutionWorkbenchPage>({ view, page: 1, pageSize: 20, total: 0, rows: [], stateVersion: "", generatedAt: "" });
  const [selected, setSelected] = useState<EvolutionWorkbenchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const requestRef = useRef(0);
  const queryRef = useRef<WorkbenchQuery>(DEFAULT_QUERY);
  const pageVersionRef = useRef("");
  const lastSyncAtRef = useRef(Date.now());
  const preferredRowIdRef = useRef<string | null>(null);
  const preferenceReadyRef = useRef(false);
  const columnWidthsRef = useRef<Partial<Record<WorkbenchColumnId, number>>>({});

  const savePreference = (selectedRowId: string | null) => {
    if (!preferenceReadyRef.current) return;
    const { page: currentPage, pageSize, keyword, status } = queryRef.current;
    void window.desktop?.saveEvolutionWorkbenchPreference({ perspective, nodeId, page: currentPage, pageSize, keyword, status, selectedRowId }).catch(() => undefined);
  };
  const publishLocation = (selectedRowId: string | null) => {
    const { page: currentPage, pageSize, keyword, status } = queryRef.current;
    onLocationChange({ perspective, nodeId, page: currentPage, pageSize, keyword, status, selectedRowId });
  };
  const saveSortPreference = () => void window.desktop?.saveEvolutionWorkbenchPreference({ perspective, nodeId: `${nodeId}::sort`, page: 1, pageSize: 20, keyword: queryRef.current.sortField, status: queryRef.current.sortDirection, selectedRowId: null }).catch(() => undefined);
  const saveColumnWidths = () => void window.desktop?.saveEvolutionWorkbenchPreference({ perspective, nodeId: `${nodeId}::columns`, page: 1, pageSize: 20, keyword: serializeColumnWidths(columnWidthsRef.current), status: "", selectedRowId: null }).catch(() => undefined);
  const load = (query: Partial<WorkbenchQuery> = {}) => {
    const requestId = ++requestRef.current;
    const nextQuery = { ...queryRef.current, ...query };
    queryRef.current = nextQuery;
    setLoading(true);
    setLoadError("");
    void window.desktop?.queryEvolutionWorkbench({ view, ...nextQuery })
      .then((next) => {
        if (requestRef.current !== requestId) return;
        // ref 在用户点击行时同步更新；事件订阅中的 load 可能仍闭包到上一次 selected，
        // 因此必须优先采用 ref，避免实时刷新把刚选中的新提案退回旧行。
        const requestedRowId = preferredRowIdRef.current || selected?.id;
        // 审批通过后，该记录会立即离开“待审批”结果集；仍保留稳定选中 ID，
        // 让右侧详情继续展示已通过事实并允许执行下一动作，不能悄悄跳到另一条待办。
        const nextSelected = next.rows.find((row) => row.id === requestedRowId) || (requestedRowId ? null : next.rows[0]) || null;
        const stableSelectedRowId = nextSelected?.id || requestedRowId || null;
        preferredRowIdRef.current = stableSelectedRowId;
        pageVersionRef.current = next.stateVersion;
        lastSyncAtRef.current = Date.now();
        setPage(next); setSelected(nextSelected); setLoadError(""); setSyncNotice("");
        savePreference(stableSelectedRowId);
        publishLocation(stableSelectedRowId);
        if (nextSelected) onSelectRow?.(nextSelected);
      })
      .catch((error) => { if (requestRef.current === requestId) { const message = readableError(error, `无法读取${title}。`); setLoadError(message); onError(message); } })
      .finally(() => { if (requestRef.current === requestId) setLoading(false); });
  };

  useEffect(() => {
    let active = true;
    preferenceReadyRef.current = false;
    void Promise.all([window.desktop?.getEvolutionWorkbenchPreference(perspective, nodeId), window.desktop?.getEvolutionWorkbenchPreference(perspective, `${nodeId}::sort`), window.desktop?.getEvolutionWorkbenchPreference(perspective, `${nodeId}::columns`)]).then(([preference, sortPreference, columnPreference]) => {
      if (!active) return;
      const sortField = (["updatedAt", "createdAt", "title", "status"] as string[]).includes(sortPreference?.keyword || "") ? sortPreference!.keyword as WorkbenchSortField : "updatedAt";
      const sortDirection = sortPreference?.status === "asc" ? "asc" : "desc";
      queryRef.current = requestedLocation ? { page: requestedLocation.page, pageSize: requestedLocation.pageSize, keyword: requestedLocation.keyword, status: requestedLocation.status, sortField, sortDirection } : preference ? { page: preference.page, pageSize: preference.pageSize, keyword: preference.keyword, status: preference.status, sortField, sortDirection } : { ...DEFAULT_QUERY, sortField, sortDirection };
      columnWidthsRef.current = parseColumnWidths(columnPreference?.keyword || "");
      preferredRowIdRef.current = requestedLocation?.selectedRowId || preference?.selectedRowId || null;
      preferenceReadyRef.current = true;
      load();
    }).catch(() => { if (active) { queryRef.current = DEFAULT_QUERY; preferenceReadyRef.current = true; load(); } });
    return () => { active = false; };
  }, [nodeId, perspective, requestedLocation, view]);

  useEffect(() => {
    const unsubscribe = window.desktop?.onEvolutionWorkbenchChanged((event: EvolutionWorkbenchChangeEvent) => {
      if (!event.affectedViews.includes(view)) return;
      const missedChange = Boolean(pageVersionRef.current && pageVersionRef.current !== event.previousStateVersion);
      setSyncNotice(missedChange ? "检测到状态版本断档，正在重新同步当前页…" : "收到实时状态更新，正在刷新当前页…");
      load({ page: queryRef.current.page, pageSize: queryRef.current.pageSize });
    });
    const refreshAfterBackground = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastSyncAtRef.current < 30_000) return;
      setSyncNotice("页面已从后台恢复，正在核对最新状态…");
      load({ page: queryRef.current.page, pageSize: queryRef.current.pageSize });
    };
    document.addEventListener("visibilitychange", refreshAfterBackground);
    return () => { unsubscribe?.(); document.removeEventListener("visibilitychange", refreshAfterBackground); };
  }, [view]);

  const continueSelectedTask = async () => {
    if (!selected?.taskId || actionBusy) return;
    setActionBusy(true);
    try { await window.desktop?.continueCollaborationTask(selected.taskId); load({ page: page.page, pageSize: page.pageSize }); }
    catch (error) { onError(readableError(error, "当前任务不能从这个恢复点继续。")); }
    finally { setActionBusy(false); }
  };
  const handToLinghu = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try { await window.desktop?.setLinghuAutomationEnabled(true); load({ page: page.page, pageSize: page.pageSize }); }
    catch (error) { onError(readableError(error, "无法把异常交给令狐自动修复。")); }
    finally { setActionBusy(false); }
  };

  const payload = useMemo(() => ({
    grid: { mode: "records", selectionMode: "SINGLE", idField: "id", searchFields: ["title", "stage", "owner"], horizontalScroll: true, columnResize: true, deferToolbarFiltersUntilSubmit: true },
    data: { items: page.rows.map((row) => ({ ...row, status: evolutionStatusLabel(row.status), updatedAt: formatTime(row.updatedAt, locale) })), selectedIds: selected ? [selected.id] : [] },
    column: { gridId: id, tableTitle: title, tableCode: "", ariaLabel: `${title}数据库列表`, emptyText: loading ? "正在读取数据库…" : `暂无${title}记录`, items: [
      { id: "title", field: "title", label: "事项", renderer: "text", width: `${columnWidthsRef.current.title || 260}px`, sortable: true, sortAriaLabel: "按事项排序", sortDirection: queryRef.current.sortField === "title" ? (queryRef.current.sortDirection === "desc" ? "descending" : "ascending") : undefined },
      { id: "status", field: "status", label: "状态", renderer: "badge", width: `${columnWidthsRef.current.status || 116}px`, sortable: true, sortAriaLabel: "按状态排序", sortDirection: queryRef.current.sortField === "status" ? (queryRef.current.sortDirection === "desc" ? "descending" : "ascending") : undefined },
      { id: "stage", field: "stage", label: "当前环节", renderer: "text", width: `${columnWidthsRef.current.stage || 140}px` },
      { id: "owner", field: "owner", label: "当前负责人", renderer: "text", width: `${columnWidthsRef.current.owner || 112}px` },
      { id: "nextStep", field: "nextStep", label: "下一步", renderer: "text", width: `${columnWidthsRef.current.nextStep || 230}px` },
      { id: "updatedAt", field: "updatedAt", label: "最近更新", renderer: "text", width: `${columnWidthsRef.current.updatedAt || 160}px`, sortable: true, sortAriaLabel: "按最近更新时间排序", sortDirection: queryRef.current.sortField === "updatedAt" ? (queryRef.current.sortDirection === "desc" ? "descending" : "ascending") : undefined },
    ] },
    title: { messages: { selectProject: "选择当前记录" } },
    search: { fields: [
      { name: "keyword", label: `搜索${title}`, placeholder: `搜索${title}、环节或负责人`, icon: "ri-search-line", defaultValue: queryRef.current.keyword },
      { name: "status", label: "状态筛选", placeholder: "输入状态，例如：待审批", icon: "ri-filter-3-line", defaultValue: queryRef.current.status },
    ], submitLabel: "查询", resetLabel: "重置" },
    select: { pageSize: { options: [20, 50, 100].map((size) => ({ value: String(size), label: `${size} 条/页` })) } },
    pagination: { mode: "REMOTE", currentPage: page.page, pageSize: page.pageSize, totalCount: page.total, summaryAll: "共 {total} 条", summaryFiltered: "当前 {visible} 条 · 共 {total} 条", previousLabel: "上一页", nextLabel: "下一页", pageChangedMessage: "已切换到第 {page} 页", pageSizeChangedMessage: "每页显示 {size} 条" },
  }), [id, loading, locale, page, selected, title]);

  useEffect(() => {
    const host = hostRef.current;
    const grid = (window as typeof window & { sel?: { components?: { grid?: SelGridApi } } }).sel?.components?.grid;
    if (!host || !grid) return;
    const root = grid.create(host, { gridId: id, entity: `EvolutionWorkbench:${view}`, ariaLabel: `${title}数据库列表` });
    if (!root) return;
    const handleQuery = (event: Event) => {
      const detail = (event as CustomEvent<{ pageNo?: number; pageSize?: number; keyword?: string; status?: string; values?: Record<string, string> }>).detail || {};
      load({ page: detail.pageNo, pageSize: detail.pageSize, keyword: detail.values?.keyword ?? detail.keyword, status: detail.values?.status ?? detail.status });
    };
    const handleSelection = (event: Event) => {
      const rowId = String((event as CustomEvent<{ selectedIds?: string[] }>).detail?.selectedIds?.[0] || "");
      const nextSelected = page.rows.find((row) => row.id === rowId) || null;
      preferredRowIdRef.current = nextSelected?.id || null;
      setSelected(nextSelected); savePreference(nextSelected?.id || null); publishLocation(nextSelected?.id || null); onSelectRow?.(nextSelected);
    };
    const handleSort = (event: Event) => {
      const detail = (event as CustomEvent<{ sortField?: string; sortDirection?: "asc" | "desc" }>).detail;
      if (!detail || !["updatedAt", "createdAt", "title", "status"].includes(detail.sortField || "")) return;
      queryRef.current = { ...queryRef.current, page: 1, sortField: detail.sortField as WorkbenchSortField, sortDirection: detail.sortDirection === "asc" ? "asc" : "desc" };
      saveSortPreference();
      load(queryRef.current);
    };
    const handleColumnResize = (event: Event) => {
      const widths = (event as CustomEvent<{ columnWidths?: Record<string, number> }>).detail?.columnWidths;
      if (!widths) return;
      columnWidthsRef.current = Object.fromEntries(WORKBENCH_COLUMN_IDS.flatMap((columnId) => {
        const width = Math.round(Number(widths[columnId]));
        return Number.isFinite(width) && width >= 72 && width <= 960 ? [[columnId, width]] : [];
      }));
      saveColumnWidths();
    };
    root.addEventListener("selGrid:queryChange", handleQuery);
    root.addEventListener("selGrid:selectionChange", handleSelection);
    root.addEventListener("selGrid:sortChange", handleSort);
    root.addEventListener("selGrid:columnResizeChange", handleColumnResize);
    const controller = grid.mount(root, payload);
    return () => { root.removeEventListener("selGrid:queryChange", handleQuery); root.removeEventListener("selGrid:selectionChange", handleSelection); root.removeEventListener("selGrid:sortChange", handleSort); root.removeEventListener("selGrid:columnResizeChange", handleColumnResize); controller?.destroy?.(); host.replaceChildren(); };
  }, [id, page.rows, payload, title, view]);

  return <section className="evolution-database-page" aria-label={`${title}数据页`}>
    <div className="evolution-database-page-heading"><div><span>数据库实时视图</span><h2>{title}</h2></div><strong>{page.total} 条</strong></div>
    {syncNotice && <div className="evolution-database-sync" role="status">{syncNotice}</div>}
    {loadError && <div className="evolution-database-error" role="alert"><span>{loadError} 数据没有被修改，请检查数据库状态后重试。</span><button type="button" onClick={() => load()}>重新查询</button></div>}
    <div ref={hostRef} className="evolution-database-grid-host" />
    {selected && <article className="evolution-workbench-selection"><div><span>{evolutionStatusLabel(selected.status)}</span><h3>{selected.title}</h3><nav>{selected.taskId && ["blocked", "test-failed", "stalled", "failed", "recovering"].includes(selected.status) && <button type="button" className="primary" disabled={actionBusy} onClick={() => void continueSelectedTask()}>从恢复点继续</button>}{(view === "exceptions" || view === "recovery") && <button type="button" disabled={actionBusy} onClick={() => void handToLinghu()}>交给令狐自动修复</button>}</nav></div><dl><div><dt>当前负责人</dt><dd>{selected.owner}</dd></div><div><dt>当前环节</dt><dd>{selected.stage}</dd></div><div><dt>下一步</dt><dd>{selected.nextStep}</dd></div><div><dt>恢复点</dt><dd>{selected.recoveryPoint || "当前无需恢复"}</dd></div>{selected.blockedReason && <div><dt>卡点</dt><dd>{selected.blockedReason}</dd></div>}</dl></article>}
  </section>;
}

function readableError(error: unknown, fallback: string): string {
  return (error instanceof Error ? error.message : fallback).replace(/^Error invoking remote method '[^']+':\s*/, "");
}
function formatTime(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function serializeColumnWidths(widths: Partial<Record<WorkbenchColumnId, number>>): string {
  return WORKBENCH_COLUMN_IDS.flatMap((columnId) => Number.isFinite(widths[columnId]) ? [`${columnId}=${Math.round(widths[columnId]!)}`] : []).join(",");
}

function parseColumnWidths(value: string): Partial<Record<WorkbenchColumnId, number>> {
  const allowed = new Set<string>(WORKBENCH_COLUMN_IDS);
  return Object.fromEntries(value.split(",").flatMap((entry) => {
    const [columnId, rawWidth] = entry.split("=");
    const width = Math.round(Number(rawWidth));
    return allowed.has(columnId) && Number.isFinite(width) && width >= 72 && width <= 960 ? [[columnId, width]] : [];
  })) as Partial<Record<WorkbenchColumnId, number>>;
}
