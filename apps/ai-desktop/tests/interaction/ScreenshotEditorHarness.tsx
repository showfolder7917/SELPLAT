import { useState } from "react";

import { ScreenshotEditor } from "../../src/features/screenshot/components/ScreenshotEditor";
import "../../src/variants/developer/developer.css";

const captureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="460"><rect width="720" height="460" fill="#f5f7fb"/><path d="M0 80h720M0 230h720M240 0v460M520 0v460" stroke="#d5dce8" stroke-width="2"/><text x="32" y="48" fill="#334155" font-family="sans-serif" font-size="24">Screenshot interaction fixture</text></svg>`;
const captureDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(captureSvg)}`;

/** 仅在 Vite 开发模式的隔离 Electron 中提供确定性截图，供 Playwright 验证真实指针交互。 */
export function ScreenshotEditorHarness() {
  const [result, setResult] = useState<{ completed: boolean; hasAnnotations: boolean } | null>(null);
  return <>
    <ScreenshotEditor
      capture={{ dataUrl: captureDataUrl, width: 720, height: 460 }}
      locale="zh-CN"
      onCancel={() => setResult({ completed: false, hasAnnotations: false })}
      onComplete={async (_originalDataUrl, _annotatedDataUrl, hasAnnotations) => {
        setResult({ completed: true, hasAnnotations });
      }}
    />
    {result && <output
      className="screenshot-interaction-result"
      data-completed={String(result.completed)}
      data-has-annotations={String(result.hasAnnotations)}
    >截图交互结果</output>}
  </>;
}
