import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const { findRetiredAssessmentMarkers } = await import("../../scripts/assert-no-retired-assessment-markers.mjs");
const { controlledTestRoot } = await import("../support/test-paths.mjs");

test("已退役会话标识门禁在无命中时通过，并报告真实命中", () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "retired-assessment-marker-"));
  try {
    mkdirSync(path.join(root, "electron"));
    mkdirSync(path.join(root, "src"));
    writeFileSync(path.join(root, "electron", "current.ts"), 'export const messageId = "customer-message";');
    assert.deepEqual(findRetiredAssessmentMarkers(root), []);
    writeFileSync(path.join(root, "src", "legacy.ts"), 'value.endsWith(":assessment");');
    assert.deepEqual(findRetiredAssessmentMarkers(root), [path.join(root, "src", "legacy.ts") + ':endsWith(":assessment")']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
