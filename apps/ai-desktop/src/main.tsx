import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

const variant = import.meta.env.VITE_APP_VARIANT === "developer" ? "developer" : "office";
const screenshotMode = variant === "developer" && new URLSearchParams(window.location.search).get("mode") === "screenshot";
const Application = lazy(() => screenshotMode
  ? import("./variants/developer/ScreenshotWindowApp").then(({ ScreenshotWindowApp }) => ({ default: ScreenshotWindowApp }))
  : variant === "developer"
  ? import("./variants/developer/DeveloperApp").then(({ DeveloperApp }) => ({ default: DeveloperApp }))
  : import("./variants/office/OfficeApp").then(({ OfficeApp }) => ({ default: OfficeApp })));

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={null}><Application /></Suspense>
  </React.StrictMode>,
);
