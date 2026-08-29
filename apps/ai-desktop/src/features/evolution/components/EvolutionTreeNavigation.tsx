/** 使用 SELUI Tree 承载演化模块导航，业务页面只提供节点和选择状态。 */
import { useEffect, useRef } from "react";

type SelTreeController = { destroy: () => boolean; select: (id: string) => boolean; getExpandedIds(): string[] };
type SelTreeApi = { mount: (root: HTMLElement, data: Record<string, unknown>) => SelTreeController | null };

export function EvolutionTreeNavigation({ id, label, selectedId, items, onSelect, onExpandedChange }: { id: string; label: string; selectedId: string; items: Array<Record<string, unknown>>; onSelect(id: string): void; onExpandedChange?(ids: string[]): void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SelTreeController | null>(null);
  const onSelectRef = useRef(onSelect);
  const onExpandedChangeRef = useRef(onExpandedChange);
  onSelectRef.current = onSelect;
  onExpandedChangeRef.current = onExpandedChange;
  useEffect(() => {
    const root = rootRef.current;
    const tree = (window as typeof window & { sel?: { components?: { tree?: SelTreeApi } } }).sel?.components?.tree;
    if (!root || !tree) return;
    const handleSelect = (event: Event) => onSelectRef.current(String((event as CustomEvent<{ id?: string }>).detail?.id || ""));
    const handleExpandedChange = (event: Event) => onExpandedChangeRef.current?.((event as CustomEvent<{ expandedIds?: string[] }>).detail?.expandedIds || []);
    root.addEventListener("selTree:select", handleSelect);
    root.addEventListener("selTree:expandedChange", handleExpandedChange);
    const controller = tree.mount(root, {
      selectedId,
      expandLabelTemplate: "展开{label}",
      collapseLabelTemplate: "收起{label}",
      contextMenuLabelTemplate: "{label}操作",
      items,
    });
    controllerRef.current = controller;
    return () => { root.removeEventListener("selTree:select", handleSelect); root.removeEventListener("selTree:expandedChange", handleExpandedChange); controller?.destroy(); controllerRef.current = null; };
  }, [id, items]);
  useEffect(() => { controllerRef.current?.select(selectedId); }, [selectedId]);
  return <div ref={rootRef} className="evolution-tree-host" data-sel-grid={id} data-sel-entity="EvolutionWorkspace"><nav data-sel-grid-role="tree" aria-label={label} /></div>;
}
