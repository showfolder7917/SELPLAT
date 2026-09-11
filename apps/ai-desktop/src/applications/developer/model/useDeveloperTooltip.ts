import { useEffect, type RefObject } from "react";

type SelTooltipController = { destroy: () => boolean };
type SelTooltipApi = { attach: (host: Element, options: Record<string, unknown>) => SelTooltipController | null };

/** 为 Developer 窗口中带有 data-sel-tooltip 的元素统一启用工具提示。 */
export function useDeveloperTooltip(shellRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    // 工具提示只能挂到已经渲染完成的真实窗体节点。
    const host = shellRef.current;
    const tooltip = (window as typeof window & { sel?: { components?: { tooltip?: SelTooltipApi } } }).sel?.components?.tooltip;
    if (!host || !tooltip) return;

    // 所有匹配元素共享一个控制器，避免各组件重复初始化 SELUI。
    const controller = tooltip.attach(host, {
      id: "ai-desktop:developer-tooltip",
      selector: "[data-sel-tooltip]",
      delay: 260,
    });

    // 窗口卸载时销毁监听器，防止旧节点继续响应事件。
    return () => { controller?.destroy(); };
  }, [shellRef]);
}
