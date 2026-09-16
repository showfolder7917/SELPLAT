import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type CollaborationInteractionPerformanceSample = {
  operation: string;
  durationMs: number;
  datasetId: string;
  /** 同一数据集下可复现操作路径的唯一标识，baseline 与 candidate 必须相同。 */
  scenarioId: string;
  phase: "baseline" | "candidate";
  details?: Record<string, string | number | boolean | null>;
};

/** 同一操作在一个阶段的原始样本和统计结果，供验收保留可追溯证据。 */
export type CollaborationInteractionPerformanceStatistics = {
  sampleCount: number;
  samples: number[];
  averageMs: number | null;
  medianMs: number | null;
  maxMs: number | null;
};

/** 两个阶段针对一个操作的可比较统计；长任务次数只统计真实滚动操作样本。 */
export type CollaborationInteractionPerformanceComparison = {
  datasetId: string;
  scenarioId: string;
  comparable: boolean;
  longTaskCount: { baseline: number; candidate: number };
  operations: Array<{
    operation: string;
    baseline: CollaborationInteractionPerformanceStatistics;
    candidate: CollaborationInteractionPerformanceStatistics;
  }>;
};

type PersistedSample = CollaborationInteractionPerformanceSample & { recordedAt: string };

/** 性能验收的四类必需耗时口径；任一缺失都不能声称两个阶段可比较。 */
const REQUIRED_OPERATIONS = [
  "member-page-feedback",
  "navigation-preference-ipc",
  "timeline-read-processing",
  "task-card-page-update",
] as const;

/** 用可复核的原始耗时计算统计，避免把聚合值写回协作业务事实。 */
function summarize(samples: PersistedSample[]): CollaborationInteractionPerformanceStatistics {
  const values = samples.map((sample) => sample.durationMs).sort((left, right) => left - right);
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 === 1 ? values[middle] : values.length ? (values[middle - 1] + values[middle]) / 2 : null;
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    sampleCount: values.length,
    samples: values,
    averageMs: values.length ? round(values.reduce((total, value) => total + value, 0) / values.length) : null,
    medianMs: median === null ? null : round(median),
    maxMs: values.length ? values.at(-1)! : null,
  };
}

/** 页面交互性能只写应用临时目录的原始样本，绝不进入 SQLite 协作历史。 */
export class CollaborationInteractionPerformanceLog {
  readonly #root: string;

  constructor(temporaryMaterialsRoot: string) {
    this.#root = path.join(path.resolve(temporaryMaterialsRoot), "协作页面性能");
  }

  record(sample: CollaborationInteractionPerformanceSample): void {
    if (!sample.operation.trim() || !sample.datasetId.trim() || !sample.scenarioId.trim() || !Number.isFinite(sample.durationMs) || sample.durationMs < 0) return;
    mkdirSync(this.#root, { recursive: true });
    const event = {
      recordedAt: new Date().toISOString(),
      operation: sample.operation,
      durationMs: Math.round(sample.durationMs * 100) / 100,
      datasetId: sample.datasetId,
      scenarioId: sample.scenarioId,
      phase: sample.phase,
      details: sample.details || {},
    };
    appendFileSync(path.join(this.#root, "interaction-performance.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
  }

  /** 从保留的原始 JSONL 读取同一场景样本，生成 baseline 与 candidate 的比较结果。 */
  comparison(datasetId: string, scenarioId: string): CollaborationInteractionPerformanceComparison {
    const samples = this.#readSamples().filter((sample) => sample.datasetId === datasetId && sample.scenarioId === scenarioId);
    const operations = [...new Set([...REQUIRED_OPERATIONS, ...samples.map((sample) => sample.operation)])].sort().map((operation) => ({
      operation,
      baseline: summarize(samples.filter((sample) => sample.operation === operation && sample.phase === "baseline")),
      candidate: summarize(samples.filter((sample) => sample.operation === operation && sample.phase === "candidate")),
    }));
    const baseline = samples.filter((sample) => sample.phase === "baseline");
    const candidate = samples.filter((sample) => sample.phase === "candidate");
    const baselineViewports = new Set(baseline.map((sample) => sample.details?.viewport).filter((viewport): viewport is string => typeof viewport === "string"));
    const candidateViewports = new Set(candidate.map((sample) => sample.details?.viewport).filter((viewport): viewport is string => typeof viewport === "string"));
    // 场景标识包含人物顺序、展开次数和滚动路径；视口另以真实记录校验，避免只靠标签混比两种窗口。
    const sameViewport = baselineViewports.size === 1 && candidateViewports.size === 1 && [...baselineViewports][0] === [...candidateViewports][0];
    return {
      datasetId,
      scenarioId,
      comparable: sameViewport && REQUIRED_OPERATIONS.every((operation) => operations.some((summary) => summary.operation === operation && summary.baseline.sampleCount > 0 && summary.candidate.sampleCount > 0)),
      longTaskCount: {
        baseline: baseline.filter((sample) => sample.operation === "long-task-continuous-scroll").length,
        candidate: candidate.filter((sample) => sample.operation === "long-task-continuous-scroll").length,
      },
      operations,
    };
  }

  /** 损坏或旧格式行不参与报告，保留原始文件供人工核查且不影响后续样本。 */
  #readSamples(): PersistedSample[] {
    const filePath = path.join(this.#root, "interaction-performance.jsonl");
    if (!existsSync(filePath)) return [];
    return readFileSync(filePath, "utf8").split("\n").flatMap((line) => {
      if (!line.trim()) return [];
      try {
        const sample = JSON.parse(line) as Partial<PersistedSample>;
        if (typeof sample.recordedAt !== "string" || typeof sample.operation !== "string" || typeof sample.datasetId !== "string" || typeof sample.scenarioId !== "string" || typeof sample.durationMs !== "number" || (sample.phase !== "baseline" && sample.phase !== "candidate")) return [];
        return [{ ...sample, details: sample.details && typeof sample.details === "object" ? sample.details : {} } as PersistedSample];
      } catch {
        return [];
      }
    });
  }
}
