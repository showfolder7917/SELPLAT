/** 设置领域浮层适配器：SELUI 管理外壳生命周期，React 只渲染业务内容。 */
import { Dismiss20Regular, Settings24Regular } from "@fluentui/react-icons";
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
    const controller = floatingPanel.mount(host, {
      id: "developer-settings",
      title: locale === "ja" ? "接続と実行設定" : "连接与执行设置",
      label: locale === "ja" ? "接続と実行設定" : "连接与执行设置",
      openLabel: locale === "ja" ? "接続と実行設定を開く" : "打开连接与执行设置",
      closeLabel: locale === "ja" ? "接続と実行設定を閉じる" : "关闭连接与执行设置",
      content,
      classes: { control: "dev-settings-control", trigger: "activity-settings", panel: "dev-settings" },
      resizable: {
        minWidth: MINIMUM_WIDTH,
        maxWidth: MAXIMUM_WIDTH,
        labels: { left: locale === "ja" ? "設定パネルの幅を調整" : "调整设置面板宽度" },
        resetLabel: locale === "ja" ? "ダブルクリックで既定の幅に戻す" : "双击恢复默认宽度",
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
    setPortalBody(controller.body);
    if (openRef.current) controller.open();
    return () => {
      setPortalBody(null);
      triggerIconRoot.unmount();
      closeIconRoot?.unmount();
      controller.destroy();
    };
  }, [locale, onOpenChange]);

  return <div ref={hostRef} className="dev-settings-host">{portalBody && open && createPortal(children, portalBody)}</div>;
}
