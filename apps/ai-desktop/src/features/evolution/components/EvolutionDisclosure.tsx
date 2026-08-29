import { type ReactNode, useEffect, useId, useRef } from "react";

type SelDisclosureController = { setOpen(open: boolean): boolean; destroy(): boolean };
type SelDisclosureApi = { mount(root: HTMLElement, options: { id: string; open: boolean }): SelDisclosureController | null };

/** 专题详情只通过正式 SELUI Disclosure 展开，不在业务模块复制交互实现。 */
export function EvolutionDisclosure({ label, defaultOpen = false, children }: { label: string; defaultOpen?: boolean; children: ReactNode }) {
  const generatedId = useId().replaceAll(":", "");
  const id = `evolution-disclosure-${generatedId}`;
  const rootRef = useRef<HTMLElement>(null);
  const controllerRef = useRef<SelDisclosureController | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    const disclosure = (window as typeof window & { sel?: { components?: { disclosure?: SelDisclosureApi } } }).sel?.components?.disclosure;
    if (!root || !disclosure) return;
    const controller = disclosure.mount(root, { id, open: defaultOpen });
    controllerRef.current = controller;
    return () => { controller?.destroy(); controllerRef.current = null; };
  }, [id]);
  useEffect(() => { controllerRef.current?.setOpen(defaultOpen); }, [defaultOpen]);
  return <section ref={rootRef} className="seldisclosure-root" data-sel-disclosure={id}>
    <button type="button" className="seldisclosure-trigger" data-sel-disclosure-trigger aria-expanded={defaultOpen}><span>{label}</span><i className={defaultOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} data-sel-disclosure-icon aria-hidden="true" /></button>
    <div className="seldisclosure-content" data-sel-disclosure-content hidden={!defaultOpen}>{children}</div>
  </section>;
}
