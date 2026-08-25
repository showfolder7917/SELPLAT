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
const Application = lazy(() => screenshotInteractionMode
  ? import("../tests/interaction/ScreenshotEditorHarness").then(({ ScreenshotEditorHarness }) => ({ default: ScreenshotEditorHarness }))
  : screenshotMode
  ? import("./variants/developer/ScreenshotWindowApp").then(({ ScreenshotWindowApp }) => ({ default: ScreenshotWindowApp }))
  : import("./variants/developer/DeveloperApp").then(({ DeveloperApp }) => ({ default: DeveloperApp })));

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RendererErrorBoundary><SelUiProvider><Suspense fallback={null}><Application /></Suspense></SelUiProvider></RendererErrorBoundary>
  </React.StrictMode>,
);
