import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

const variant = import.meta.env.VITE_APP_VARIANT === "developer" ? "developer" : "office";
const Application = lazy(() => variant === "developer"
  ? import("./variants/developer/DeveloperApp").then(({ DeveloperApp }) => ({ default: DeveloperApp }))
  : import("./variants/office/OfficeApp").then(({ OfficeApp }) => ({ default: OfficeApp })));

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={null}><Application /></Suspense>
  </React.StrictMode>,
);
