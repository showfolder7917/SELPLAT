/** 设置领域浮层适配器：SELUI 管理外壳生命周期，React 只渲染业务内容。 */
import { Dismiss20Regular, Settings24Regular } from "@fluentui/react-icons";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
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

export function SettingsFloatingPanel({ locale, open, onOpenChange, languageFeedbackKey = null, children }: { locale: LocaleValue; open: boolean; onOpenChange: (open: boolean) => void; languageFeedbackKey?: string | null; children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const [portalBody, setPortalBody] = useState<HTMLElement | null>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
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
    setScrollContainer(content);
    if (openRef.current) controller.open();
    return () => {
      setPortalBody(null);
      setScrollContainer(null);
      triggerIconRoot.unmount();
      closeIconRoot?.unmount();
      controller.destroy();
    };
  }, [locale, onOpenChange]);

  useLayoutEffect(() => {
    if (!open || !portalBody || !scrollContainer) return;
    // 滚动容器由浮层拥有：同一时机只能执行置顶或反馈定位，不能让子视图滚动后再被置顶覆盖。
    const languageFeedback = languageFeedbackKey
      ? portalBody.querySelector<HTMLElement>("[data-language-settings-field]")
      : null;
    if (!languageFeedback) {
      scrollContainer.scrollTo({ top: 0 });
      return;
    }

    const revealLanguageFeedback = () => {
      const contentRect = scrollContainer.getBoundingClientRect();
      const feedbackRect = languageFeedback.getBoundingClientRect();
      const safeInset = 8;
      const bottomOverflow = feedbackRect.bottom - contentRect.bottom + safeInset;
      const topOverflow = feedbackRect.top - contentRect.top - safeInset;
      // 不能只依赖 nearest：多行错误及操作按钮会在文本重排后把字段底边推出滚动区。
      if (bottomOverflow > 0) scrollContainer.scrollTop += bottomOverflow;
      else if (topOverflow < 0) scrollContainer.scrollTop += topOverflow;
    };

    revealLanguageFeedback();
    // 图标、字体和多语言文本可能在首个布局周期后改变字段高度，下一帧按最终矩形补偿。
    const animationFrame = window.requestAnimationFrame(revealLanguageFeedback);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [open, portalBody, scrollContainer, languageFeedbackKey]);

  return <div ref={hostRef} className="dev-settings-host">{portalBody && open && createPortal(children, portalBody)}</div>;
}
