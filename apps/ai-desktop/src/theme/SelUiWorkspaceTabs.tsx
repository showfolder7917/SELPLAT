import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "@selplat/sel-ui/core/kernel";
import "@selplat/sel-ui/components/context-menu";
import "@selplat/sel-ui/components/context-menu/styles";
import "@selplat/sel-ui/components/tabs";
import "@selplat/sel-ui/components/tabs/styles";

type Page = { id: string; label: string };
type Tabs = {
  open(options: Page & { mount(panel: HTMLElement): void }): HTMLElement;
  destroy(): void;
};

/** SELUI 负责页签激活、键盘与关闭；React 只挂载当前页面，业务状态由上层 Controller 保留。 */
export function SelUiWorkspaceTabs({ request, revision, renderPage, onActivate }: {
  request: Page | null;
  revision: number;
  renderPage(id: string): ReactNode;
  onActivate(id: string): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const tabs = useRef<Tabs | null>(null);
  const latest = useRef({ request, onActivate });
  latest.current = { request, onActivate };
  const [pages, setPages] = useState<Array<Page & { panel: HTMLElement }>>([]);
  // 当前页签标识：隐藏页只保留 SELUI 页签和容器，不继续渲染长会话与任务时间线。
  const [activePageId, setActivePageId] = useState<string | null>(null);
  useLayoutEffect(() => {
    const element = host.current!;
    const components = (window as typeof window & { sel?: { components?: Record<string, any> } }).sel?.components;
    const instance = components?.tabs?.mount(element, { id: "selTabsDeveloperWorkspaceId", ariaLabel: "任务与人物", emptyTitle: "选择人物或任务", emptyDescription: "关闭页面不会停止后台任务。" }) as Tabs | null;
    if (!instance) throw new Error("SELUI 页签组件未注册。");
    tabs.current = instance;
    const changed = (event: Event) => {
      const id = (event as CustomEvent<{ tabId: string }>).detail.tabId;
      if (!id) return;
      // 先切换可见渲染树，再同步业务导航，避免持久化请求期间看起来没有响应。
      setActivePageId(id);
      latest.current.onActivate(id);
    };
    const closed = (event: Event) => { const id = (event as CustomEvent<{ tabId: string }>).detail.tabId; setPages((items) => items.filter((page) => page.id !== id)); };
    element.addEventListener("selTabs:change", changed);
    element.addEventListener("selTabs:close", closed);
    return () => { element.removeEventListener("selTabs:change", changed); element.removeEventListener("selTabs:close", closed); instance.destroy(); tabs.current = null; setPages([]); };
  }, []);
  const ready = Boolean(request);
  useLayoutEffect(() => {
    const page = latest.current.request;
    if (!page || !tabs.current) return;
    // 用户从左侧导航人物或任务时立即激活目标页，后台状态更新不再拖住可见反馈。
    setActivePageId(page.id);
    tabs.current.open({ ...page, mount(panel) { setPages((items) => [...items, { ...page, panel }]); } });
    // 只有用户导航才重新打开关闭的页面，后台广播不能重新弹出页签。
  }, [revision, ready]);
  return <><div className="developer-tabs-host" ref={host} />{pages.map((page) => createPortal(
    activePageId === page.id
      ? <div className="developer-tab-page">{renderPage(page.id)}</div>
      : null,
    page.panel,
    page.id,
  ))}</>;
}
