/** 使用 SELUI Tree 承载演化模块导航，业务页面只提供节点和选择状态。 */
import { useEffect, useRef } from "react";

type SelTreeController = { destroy: () => boolean; select: (id: string) => boolean };
type SelTreeApi = { mount: (root: HTMLElement, data: Record<string, unknown>) => SelTreeController | null };

export function EvolutionTreeNavigation({ id, label, selectedId, items, onSelect }: { id: string; label: string; selectedId: string; items: Array<Record<string, unknown>>; onSelect(id: string): void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    const tree = (window as typeof window & { sel?: { components?: { tree?: SelTreeApi } } }).sel?.components?.tree;
    if (!root || !tree) return;
    const handleSelect = (event: Event) => onSelect(String((event as CustomEvent<{ id?: string }>).detail?.id || ""));
    root.addEventListener("selTree:select", handleSelect);
    const controller = tree.mount(root, {
      selectedId,
      expandLabelTemplate: "展开{label}",
      collapseLabelTemplate: "收起{label}",
      contextMenuLabelTemplate: "{label}操作",
      items,
    });
    return () => { root.removeEventListener("selTree:select", handleSelect); controller?.destroy(); };
  }, [id, items, onSelect, selectedId]);
  return <div ref={rootRef} className="evolution-tree-host" data-sel-grid={id} data-sel-entity="EvolutionWorkspace"><nav data-sel-grid-role="tree" aria-label={label} /></div>;
}
