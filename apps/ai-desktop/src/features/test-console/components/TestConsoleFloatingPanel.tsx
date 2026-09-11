import { Beaker24Regular, Dismiss20Regular } from "@fluentui/react-icons";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import type { LocaleValue } from "../../../../contracts/system/desktop/index";

type SelFloatingPanelController = {
  body: HTMLElement;
  panel: HTMLElement;
  trigger: HTMLButtonElement;
  open: () => boolean;
  destroy: () => void;
};
type SelFloatingPanelApi = { mount: (host: HTMLElement, options: Record<string, unknown>) => SelFloatingPanelController | null };

const DEFAULT_WIDTH = 480;
const MINIMUM_WIDTH = 360;
const MAXIMUM_WIDTH = 840;

/** 测试台使用 SELUI 浮动窗口，入口固定在左侧活动栏并允许用户调整宽度。 */
export function TestConsoleFloatingPanel({ locale, open, onOpenChange, children }: { locale: LocaleValue; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const [portalBody, setPortalBody] = useState<HTMLElement | null>(null);
  openRef.current = open;

  useEffect(() => {
    const host = hostRef.current;
    const floatingPanel = (window as typeof window & { sel?: { components?: { floatingPanel?: SelFloatingPanelApi } } }).sel?.components?.floatingPanel;
    if (!host || !floatingPanel) return;
    const content = document.createElement("div");
    content.className = "dev-test-console-content";
    const controller = floatingPanel.mount(host, {
      id: "developer-test-console",
      title: locale === "ja" ? "テスト台" : "测试台",
      label: locale === "ja" ? "テスト台" : "测试台",
      openLabel: locale === "ja" ? "テスト台を開く" : "打开测试台",
      closeLabel: locale === "ja" ? "テスト台を閉じる" : "关闭测试台",
      content,
      classes: { control: "dev-test-console-control", trigger: "activity-test-console", panel: "dev-test-console" },
      resizable: {
        minWidth: MINIMUM_WIDTH,
        maxWidth: MAXIMUM_WIDTH,
        right: true,
        labels: {
          left: locale === "ja" ? "テスト台の幅を調整" : "调整测试台宽度",
          right: locale === "ja" ? "右側からテスト台の幅を調整" : "从右侧调整测试台宽度",
        },
        resetLabel: locale === "ja" ? "ダブルクリックで既定幅に戻す" : "双击恢复默认宽度",
      },
      onOpenChange,
    });
    if (!controller) return;
    const triggerIconRoot: Root = createRoot(controller.trigger);
    triggerIconRoot.render(<Beaker24Regular />);
    const headingIcon = controller.panel.querySelector<HTMLElement>(".selfloating-heading-icon");
    const headingIconRoot = headingIcon ? createRoot(headingIcon) : null;
    headingIconRoot?.render(<Beaker24Regular />);
    const closeButton = controller.panel.querySelector<HTMLButtonElement>(".selfloating-close");
    const closeIconRoot = closeButton ? createRoot(closeButton) : null;
    closeIconRoot?.render(<Dismiss20Regular />);
    controller.panel.style.width = `${DEFAULT_WIDTH}px`;
    setPortalBody(content);
    if (openRef.current) controller.open();
    return () => {
      setPortalBody(null);
      triggerIconRoot.unmount();
      headingIconRoot?.unmount();
      closeIconRoot?.unmount();
      controller.destroy();
    };
  }, [locale, onOpenChange]);

  useEffect(() => {
    if (open) portalBody?.scrollTo({ top: 0 });
  }, [open, portalBody]);

  return <div ref={hostRef} className="dev-test-console-host">{portalBody && open && createPortal(children, portalBody)}</div>;
}
