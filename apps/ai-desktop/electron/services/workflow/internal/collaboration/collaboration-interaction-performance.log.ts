import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export type CollaborationInteractionPerformanceSample = {
  operation: string;
  durationMs: number;
  datasetId: string;
  phase: "baseline" | "candidate";
  details?: Record<string, string | number | boolean | null>;
};

/** 页面交互性能只写应用临时目录的原始样本，绝不进入 SQLite 协作历史。 */
export class CollaborationInteractionPerformanceLog {
  readonly #root: string;

  constructor(temporaryMaterialsRoot: string) {
    this.#root = path.join(path.resolve(temporaryMaterialsRoot), "协作页面性能");
  }

  record(sample: CollaborationInteractionPerformanceSample): void {
    if (!sample.operation.trim() || !sample.datasetId.trim() || !Number.isFinite(sample.durationMs) || sample.durationMs < 0) return;
    mkdirSync(this.#root, { recursive: true });
    const event = {
      recordedAt: new Date().toISOString(),
      operation: sample.operation,
      durationMs: Math.round(sample.durationMs * 100) / 100,
      datasetId: sample.datasetId,
      phase: sample.phase,
      details: sample.details || {},
    };
    appendFileSync(path.join(this.#root, "interaction-performance.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
  }
}
