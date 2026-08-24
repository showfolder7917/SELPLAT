import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { applySelUiTheme } from "./theme/selUiTheme";

applySelUiTheme();
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
    <Suspense fallback={null}><Application /></Suspense>
  </React.StrictMode>,
);
