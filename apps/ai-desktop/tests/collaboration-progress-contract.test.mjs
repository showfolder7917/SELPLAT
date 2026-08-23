import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const developerApp = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const progressModel = readFileSync(new URL("../src/variants/developer/collaboration-task-progress.ts", import.meta.url), "utf8");
const developerStyles = readFileSync(new URL("../src/variants/developer/developer.css", import.meta.url), "utf8");

test("人物页以真实五环节进度替代整页报告", () => {
  for (const stageId of ["intent", "approval", "execution", "repair", "unified-test"]) {
    assert.match(progressModel, new RegExp(`\\"${stageId}\\"`));
  }
  assert.match(developerApp, /deriveCollaborationTaskProgress/);
  assert.equal(developerApp.includes("`第 ${progress.currentStep}/${progress.totalSteps} 步`"), true);
  assert.match(developerApp, /下一步去向/);
  assert.match(developerApp, /setOpenStages\(new Set\(\[progress\.currentStageId\]\)\)/);
  assert.match(developerApp, /scrollIntoView\(\{ block: "nearest" \}\)/);
  assert.match(developerApp, /stage\.id === liveOutput\?\.stageId \? liveOutput\.message : null/);
  assert.match(developerApp, /deriveCollaborationTaskCurrentStage\(task, linghuAutomationStateRef\.current\)/);
  assert.match(developerApp, /existing\?\.turnId === envelope\.event\.turnId/);
  assert.match(progressModel, /automati(?:on)?\.lastFeedback\?\.taskId === task\.taskId/);
  assert.doesNotMatch(developerApp, /<p>\{currentTask\.snapshot\.confirmedIntent\}<\/p>/);
});

test("状态卡固定且窄窗口收敛为单列", () => {
  assert.match(developerStyles, /\.task-progress-card \{ position: sticky;/);
  assert.match(developerStyles, /\.task-progress-facts \{ grid-template-columns: 1fr; \}/);
  assert.match(developerStyles, /\.task-progress-stage\.current/);
  assert.match(developerStyles, /\.task-progress-stage\.completed/);
  assert.match(developerStyles, /\.task-progress-stage\.failed/);
});
