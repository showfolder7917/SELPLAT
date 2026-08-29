import { type ReactNode, useEffect, useId, useRef } from "react";

type SelDisclosureController = { setOpen(open: boolean): boolean; destroy(): boolean };
type SelDisclosureApi = { mount(root: HTMLElement, options: { id: string; open: boolean }): SelDisclosureController | null };

/** 业务页面只提供标题和内容，展开语义、键盘操作和生命周期统一交给 SELUI Disclosure。 */
export function SelUiDisclosure({ idPrefix, trigger, action, open, className = "", onOpenChange, children }: {
  idPrefix: string;
  trigger: ReactNode;
  action?: ReactNode;
  open: boolean;
  className?: string;
  onOpenChange?(open: boolean): void;
  children: ReactNode;
}) {
  const generatedId = useId().replaceAll(":", "");
  const id = `${idPrefix}-${generatedId}`;
  const rootRef = useRef<HTMLElement>(null);
  const controllerRef = useRef<SelDisclosureController | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    const disclosure = (window as typeof window & { sel?: { components?: { disclosure?: SelDisclosureApi } } }).sel?.components?.disclosure;
    if (!root || !disclosure) return;
    const controller = disclosure.mount(root, { id, open });
    controllerRef.current = controller;
    const changed = (event: Event) => {
      // Disclosure 允许嵌套；只消费当前根自己派发的事件，防止人物节点收起时连带折叠专题任务卡。
      if (event.target !== root) return;
      onOpenChange?.((event as CustomEvent<{ open?: boolean }>).detail?.open === true);
    };
    root.addEventListener("selDisclosure:change", changed);
    return () => {
      root.removeEventListener("selDisclosure:change", changed);
      controller?.destroy();
      controllerRef.current = null;
    };
  }, [id]);
  useEffect(() => { controllerRef.current?.setOpen(open); }, [open]);
  return <section ref={rootRef} className={`seldisclosure-root ${className}`.trim()} data-sel-disclosure={id}>
    <div className="selui-disclosure-heading"><button type="button" className="seldisclosure-trigger" data-sel-disclosure-trigger aria-expanded={open}>
        <span className="selui-disclosure-trigger-content">{trigger}</span>
        <i className={open ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} data-sel-disclosure-icon aria-hidden="true" />
      </button>{action}</div>
    <div className="seldisclosure-content" data-sel-disclosure-content hidden={!open}>{children}</div>
  </section>;
}
