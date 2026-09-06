import assert from "node:assert/strict";
import test from "node:test";

import { AcceptanceFailureScopePolicy } from "../../../../../build/ai-desktop/electron/electron/services/workflow/domain/acceptance-failure-scope.policy.js";

/** 建立只包含范围判断所需字段的原提案。 */
function proposal(criteria = ["右侧边缘可以拖动加宽", "放大图片后仍可拖动查看边缘"]) {
  return { acceptanceCriteria: criteria };
}

/** 建立一轮包含真实操作、判断和截图的韩立验收结果。 */
function failedRun(criteria = ["右侧边缘可以拖动加宽", "放大图片后仍可拖动查看边缘"], checkId = "criterion-2") {
  const now = "2026-09-06T00:00:00.000Z";
  return {
    version: 2,
    runId: "acceptance-run-1",
    topicId: "topic-1",
    proposalId: "proposal-1",
    criteria,
    status: "failed",
    windowTitle: "AI Desktop",
    initialBounds: { x: 0, y: 0, width: 1000, height: 800 },
    finalBounds: { x: 0, y: 0, width: 1000, height: 800 },
    stepResults: [
      { checkId: "interaction", operationIndex: 0, operation: { type: "click", x: 500, y: 300, reason: "打开图片预览" }, status: "passed", actual: "图片预览已打开", screenshotAttachmentId: "shot-1", occurredAt: now },
      { checkId, operationIndex: 1, operation: { type: "judgement", criterionId: checkId }, status: "failed", actual: "向右拖动后图片完全离开预览区域", screenshotAttachmentId: "shot-2", occurredAt: now },
    ],
    evidenceAttachmentIds: ["shot-1", "shot-2"],
    startedAt: now,
    completedAt: now,
  };
}

test("韩立本轮真实失败逐项对应原验收条件后才允许令狐修复", () => {
  const review = new AcceptanceFailureScopePolicy().review(proposal(), failedRun());
  assert.equal(review.decision, "within-original-acceptance");
  assert.equal(review.defects.length, 1);
  assert.equal(review.defects[0].target, "验收条件 2：放大图片后仍可拖动查看边缘");
  assert.equal(review.defects[0].actual, "向右拖动后图片完全离开预览区域");
  assert.equal(review.defects[0].expected, "放大图片后仍可拖动查看边缘");
  assert.deepEqual(review.defects[0].screenshotAttachmentIds, ["shot-2", "shot-1"]);
  assert.equal(review.defects[0].reproductionOperations.length, 2);
});

test("验收条件变化或失败标识不能对应原条件时禁止自动扩大修复范围", () => {
  const policy = new AcceptanceFailureScopePolicy();
  const changed = policy.review(proposal(), failedRun(["另一个页面也要支持预览"]));
  assert.equal(changed.decision, "outside-original-acceptance");
  assert.match(changed.reason, /验收条件.*不一致/);
  const unknown = policy.review(proposal(), failedRun(undefined, "new-neighbor-feature"));
  assert.equal(unknown.decision, "outside-original-acceptance");
  assert.match(unknown.reason, /无法对应原提案/);
});
