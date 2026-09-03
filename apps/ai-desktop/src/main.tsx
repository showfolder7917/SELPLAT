import React, { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { applySelUiTheme } from "./theme/selUiTheme";
import { SelUiProvider } from "./theme/SelUiProvider";

applySelUiTheme();

function reportRendererException(operation: "window.error" | "window.unhandledrejection" | "react.error-boundary", error: unknown, componentStack?: string): void {
  const normalized = error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));
  window.desktop?.reportRendererException({ operation, message: normalized.message, stack: normalized.stack, componentStack, url: window.location.href });
}

window.addEventListener("error", (event) => reportRendererException("window.error", event.error || event.message));
window.addEventListener("unhandledrejection", (event) => reportRendererException("window.unhandledrejection", event.reason));

class RendererErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo): void { reportRendererException("react.error-boundary", error, info.componentStack || undefined); }
  render(): ReactNode {
    if (this.state.failed) return <main className="screenshot-window-error" role="alert"><strong>页面发生异常，已统一登记并交给令狐处理。</strong><button type="button" onClick={() => window.location.reload()}>重新加载页面</button></main>;
    return this.props.children;
  }
}
const requestedMode = new URLSearchParams(window.location.search).get("mode");
const screenshotMode = requestedMode === "screenshot";
const screenshotInteractionMode = import.meta.env.DEV && requestedMode === "screenshot-interaction";
const desktopBridgeRequired = !screenshotInteractionMode;
const Application = lazy(() => screenshotInteractionMode
  ? import("../tests/interaction/ScreenshotEditorHarness").then(({ ScreenshotEditorHarness }) => ({ default: ScreenshotEditorHarness }))
  : screenshotMode
  ? import("./applications/screenshot/ScreenshotApplication").then(({ ScreenshotApplication }) => ({ default: ScreenshotApplication }))
  : import("./applications/developer/DeveloperApplication").then(({ DeveloperApplication }) => ({ default: DeveloperApplication })));

const root = createRoot(document.getElementById("root")!);
if (desktopBridgeRequired && !window.desktop) {
  // preload 失效时停止展示无法工作的假界面，直接说明所有桌面操作不可用并提供安全的页面重载入口。
  root.render(<main role="alert" style={{ minHeight: "100vh", display: "grid", placeItems: "center", alignContent: "center", gap: 14, color: "#dbe5f6", background: "#080b12", fontFamily: "system-ui, sans-serif" }}><strong>AI Desktop 桌面桥接加载失败，当前按钮无法执行。</strong><span>请重新加载；若仍然失败，请重新构建并启动 AI Desktop。</span><button type="button" onClick={() => window.location.reload()}>重新加载页面</button></main>);
} else {
  root.render(
    <React.StrictMode>
      <RendererErrorBoundary><SelUiProvider><Suspense fallback={null}><Application /></Suspense></SelUiProvider></RendererErrorBoundary>
    </React.StrictMode>,
  );
}
