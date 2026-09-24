/** 设置领域浮层适配器：SELUI 管理外壳生命周期，React 只渲染业务内容。 */
import { Dismiss20Regular, Settings24Regular } from "@fluentui/react-icons";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import type { LocaleValue } from "../../../../contracts/system/desktop/index";
import { fixedUiText } from "../../../../contracts/foundation";

type SelFloatingPanelController = {
  body: HTMLElement;
  panel: HTMLElement;
  trigger: HTMLButtonElement;
  open: () => boolean;
  destroy: () => void;
};
type SelFloatingPanelApi = { mount: (host: HTMLElement, options: Record<string, unknown>) => SelFloatingPanelController | null };

const DEFAULT_WIDTH = 390;
const MINIMUM_WIDTH = 320;
const MAXIMUM_WIDTH = 720;

export function SettingsFloatingPanel({ locale, open, onOpenChange, children }: { locale: LocaleValue; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const [portalBody, setPortalBody] = useState<HTMLElement | null>(null);
  openRef.current = open;

  useEffect(() => {
    const host = hostRef.current;
    const floatingPanel = (window as typeof window & { sel?: { components?: { floatingPanel?: SelFloatingPanelApi } } }).sel?.components?.floatingPanel;
    if (!host || !floatingPanel) return;
    const content = document.createElement("div");
    content.className = "dev-settings-content";
    const scrollStack = document.createElement("div");
    scrollStack.className = "dev-settings-scroll-stack";
    content.append(scrollStack);
    const controller = floatingPanel.mount(host, {
      id: "developer-settings",
      title: fixedUiText(locale, "developerSettings"), label: fixedUiText(locale, "developerSettings"),
      openLabel: fixedUiText(locale, "developerSettingsOpen"), closeLabel: fixedUiText(locale, "developerSettingsClose"),
      content,
      classes: { control: "dev-settings-control", trigger: "activity-settings", panel: "dev-settings" },
      resizable: {
        minWidth: MINIMUM_WIDTH,
        maxWidth: MAXIMUM_WIDTH,
        right: true,
        labels: {
          left: fixedUiText(locale, "settingsPanelResize"), right: fixedUiText(locale, "settingsPanelResizeRight"),
        },
        resetLabel: fixedUiText(locale, "settingsPanelResizeReset"),
      },
      onOpenChange,
    });
    if (!controller) return;
    const triggerIconRoot: Root = createRoot(controller.trigger);
    triggerIconRoot.render(<Settings24Regular />);
    const closeButton = controller.panel.querySelector<HTMLButtonElement>(".selfloating-close");
    const closeIconRoot = closeButton ? createRoot(closeButton) : null;
    closeIconRoot?.render(<Dismiss20Regular />);
    controller.panel.style.width = `${DEFAULT_WIDTH}px`;
    // 业务内容必须进入专属滚动栈；外层只负责滚动，内层保持内容最小高度，不能直接挂到会裁剪溢出的 SELUI body。
    setPortalBody(scrollStack);
    if (openRef.current) controller.open();
    return () => {
      setPortalBody(null);
      triggerIconRoot.unmount();
      closeIconRoot?.unmount();
      controller.destroy();
    };
  }, [locale, onOpenChange]);

  useEffect(() => {
    if (open) portalBody?.scrollTo({ top: 0 });
  }, [open, portalBody]);

  return <div ref={hostRef} className="dev-settings-host">{portalBody && open && createPortal(children, portalBody)}</div>;
}
