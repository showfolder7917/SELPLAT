import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { applySelUiTheme } from "./theme/selUiTheme";

const variant = import.meta.env.VITE_APP_VARIANT === "developer" ? "developer" : "office";
applySelUiTheme(variant);
const requestedMode = new URLSearchParams(window.location.search).get("mode");
const screenshotMode = variant === "developer" && requestedMode === "screenshot";
const screenshotInteractionMode = import.meta.env.DEV && variant === "developer" && requestedMode === "screenshot-interaction";
const Application = lazy(() => screenshotInteractionMode
  ? import("../tests/interaction/ScreenshotEditorHarness").then(({ ScreenshotEditorHarness }) => ({ default: ScreenshotEditorHarness }))
  : screenshotMode
  ? import("./variants/developer/ScreenshotWindowApp").then(({ ScreenshotWindowApp }) => ({ default: ScreenshotWindowApp }))
  : variant === "developer"
  ? import("./variants/developer/DeveloperApp").then(({ DeveloperApp }) => ({ default: DeveloperApp }))
  : import("./variants/office/OfficeApp").then(({ OfficeApp }) => ({ default: OfficeApp })));

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={null}><Application /></Suspense>
  </React.StrictMode>,
);
