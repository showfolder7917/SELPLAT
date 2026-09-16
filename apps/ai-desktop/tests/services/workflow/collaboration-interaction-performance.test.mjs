import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { CollaborationInteractionPerformanceLog } from "../../../electron/services/workflow/internal/collaboration/collaboration-interaction-performance.log.ts";

// 测试临时样本必须留在当前 worktree，不能依赖受控运行器重定向后的系统临时目录。
const temporaryMaterialsRoot = path.join(process.cwd(), "OPTION", "temp", "ai-desktop", "临时材料");
mkdirSync(temporaryMaterialsRoot, { recursive: true });

test("同一数据集和场景汇总 baseline 与 candidate 原始样本", () => {
  const directory = mkdtempSync(path.join(temporaryMaterialsRoot, "collaboration-performance-"));
  try {
    const log = new CollaborationInteractionPerformanceLog(directory);
    const record = (phase, operation, durationMs) => log.record({ datasetId: "retained-history", scenarioId: "1000x700-members-a-b-toggle-4-scroll-full", phase, operation, durationMs, details: { viewport: "1000x700" } });
    record("baseline", "member-page-feedback", 10);
    record("baseline", "member-page-feedback", 30);
    record("baseline", "navigation-preference-ipc", 5);
    record("baseline", "timeline-read-processing", 8);
    record("baseline", "task-card-page-update", 12);
    record("baseline", "long-task-continuous-scroll", 40);
    record("candidate", "member-page-feedback", 20);
    record("candidate", "member-page-feedback", 40);
    record("candidate", "navigation-preference-ipc", 4);
    record("candidate", "timeline-read-processing", 7);
    record("candidate", "task-card-page-update", 11);
    record("candidate", "long-task-continuous-scroll", 25);
    const comparison = log.comparison("retained-history", "1000x700-members-a-b-toggle-4-scroll-full");
    const feedback = comparison.operations.find((operation) => operation.operation === "member-page-feedback");
    assert.equal(comparison.comparable, true);
    assert.deepEqual(comparison.longTaskCount, { baseline: 1, candidate: 1 });
    assert.deepEqual(feedback?.baseline, { sampleCount: 2, samples: [10, 30], averageMs: 20, medianMs: 20, maxMs: 30 });
    assert.deepEqual(feedback?.candidate, { sampleCount: 2, samples: [20, 40], averageMs: 30, medianMs: 30, maxMs: 40 });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("不同场景不能混入同一性能比较", () => {
  const directory = mkdtempSync(path.join(temporaryMaterialsRoot, "collaboration-performance-"));
  try {
    const log = new CollaborationInteractionPerformanceLog(directory);
    log.record({ datasetId: "retained-history", scenarioId: "narrow-window", phase: "baseline", operation: "member-page-feedback", durationMs: 10, details: { viewport: "1000x700" } });
    log.record({ datasetId: "retained-history", scenarioId: "wide-window", phase: "candidate", operation: "member-page-feedback", durationMs: 10, details: { viewport: "1366x768" } });
    const comparison = log.comparison("retained-history", "narrow-window");
    assert.equal(comparison.comparable, false);
    assert.equal(comparison.operations[0]?.candidate.sampleCount, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
