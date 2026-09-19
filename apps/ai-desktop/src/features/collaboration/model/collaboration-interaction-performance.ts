import { getOptionalCollaborationDesktopApi } from "../../../foundation/desktop-api";

/** 页面根属性定义一次可复现操作路径；baseline 与 candidate 必须使用同一标识。 */
function performanceContext(): { datasetId: string; scenarioId: string; phase: "baseline" | "candidate" } {
  const root = document.documentElement.dataset;
  return {
    datasetId: root.collaborationPerformanceDataset?.trim() || "retained-history",
    scenarioId: root.collaborationPerformanceScenario?.trim() || "manual",
    phase: root.collaborationPerformancePhase === "baseline" ? "baseline" : "candidate",
  };
}

/** 把页面耗时异步保存为非业务证据，并记录实际视口以供比较报告核对。 */
export function recordCollaborationInteractionPerformance(operation: string, startedAt: number, details: Record<string, string | number | boolean | null>): void {
  const desktop = getOptionalCollaborationDesktopApi();
  if (!desktop) return;
  const context = performanceContext();
  void desktop.recordCollaborationInteractionPerformance({
    operation,
    durationMs: Math.max(0, performance.now() - startedAt),
    datasetId: context.datasetId,
    scenarioId: context.scenarioId,
    phase: context.phase,
    details: { ...details, viewport: `${window.innerWidth}x${window.innerHeight}` },
  }).catch((error: unknown) => {
    // 韩立只读验收期间主进程会拒绝非读取 IPC；性能采样失败不能变成页面未处理异常。
    console.warn("协作页面性能采样未保存", error);
  });
}
