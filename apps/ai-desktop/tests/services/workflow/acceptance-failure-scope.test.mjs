import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { transform } from "esbuild";

// 直接转换当前工作树源码，避免未构建的隔离工作树错误加载旧产物或不存在的构建目录。
const source = readFileSync("electron/services/workflow/domain/acceptance-failure-scope.policy.ts", "utf8");
const transformed = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
const { AcceptanceFailureScopePolicy } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`);

/** 建立只包含范围判断所需字段的原提案。 */
function proposal(criteria = ["右侧边缘可以拖动加宽", "放大图片后仍可拖动查看边缘"]) {
  return { acceptanceCriteria: criteria };
}

/** 建立一轮包含真实操作、判断和截图的韩立验收结果。 */
function failedRun(criteria = ["右侧边缘可以拖动加宽", "放大图片后仍可拖动查看边缘"], checkId = "criterion-2") {
  const now = "2026-09-06T00:00:00.000Z";
  return {
    version: 3,
    mode: "page-experience",
    runId: "acceptance-run-1",
    topicId: "topic-1",
    proposalId: "proposal-1",
    criteria,
    status: "failed",
    windowTitle: "AI Desktop",
    initialBounds: { x: 0, y: 0, width: 1000, height: 800 },
    finalBounds: { x: 0, y: 0, width: 1000, height: 800 },
    interactionSteps: [
      { checkId: "interaction", operationIndex: 0, operation: { type: "click", x: 500, y: 300, reason: "打开图片预览" }, status: "passed", actual: "图片预览已打开", layoutStatus: "passed", layoutActual: "预览布局待判断", layoutScreenshotAttachmentId: "shot-1", screenshotAttachmentId: "shot-1", occurredAt: now },
    ],
    stepResults: [
      { checkId, operationIndex: 1, operation: { type: "judgement", criterionId: checkId }, status: "failed", actual: "向右拖动后图片完全离开预览区域", layoutStatus: "passed", layoutActual: "没有额外布局异常", layoutScreenshotAttachmentId: "shot-2", screenshotAttachmentId: "shot-2", occurredAt: now },
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

test("功能成功但布局失败仍提取为原验收范围内缺陷", () => {
  const run = failedRun();
  const judgement = run.stepResults[0];
  judgement.status = "passed";
  judgement.actual = "控件可以选择";
  judgement.layoutStatus = "failed";
  judgement.layoutActual = "模型选择器单独占行并挤压输入区";
  const review = new AcceptanceFailureScopePolicy().review(proposal(), run);
  assert.equal(review.decision, "within-original-acceptance");
  assert.match(review.defects[0].actual, /布局：模型选择器单独占行/);
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

test("源码审查失败有唯一源码条件和文件证据时交给令狐，页面受阻不冒充缺陷", () => {
  const expected = ["真实页面区分各阶段结论", "模拟结论保存失败不能显示最终通过"];
  const currentProposal = {
    ...proposal(expected),
    acceptancePlan: { conditions: [
      { conditionId: "criterion-1", evidenceType: "page-experience" },
      { conditionId: "criterion-2", evidenceType: "code-conformance" },
    ] },
  };
  const run = failedRun(expected, "criterion-1");
  run.stepResults[0].status = "blocked";
  run.stepResults[0].layoutStatus = "blocked";
  run.sourceReview = {
    status: "failed",
    actual: "另一条归档路径可绕过唯一结论记录直接显示完成。",
    evidenceReferences: ["electron/services/evolution/internal/evolution-state.store.ts:429"],
  };
  const review = new AcceptanceFailureScopePolicy().review(currentProposal, run);
  assert.equal(review.decision, "within-original-acceptance");
  assert.equal(review.defects.length, 1);
  assert.equal(review.defects[0].checkId, "criterion-2");
  assert.match(review.defects[0].actual, /绕过唯一结论记录/);
  assert.deepEqual(review.defects[0].sourceReferences, run.sourceReview.evidenceReferences);
  assert.deepEqual(review.defects[0].screenshotAttachmentIds, []);
});

test("源码审查失败缺少唯一原条件或文件证据时不自动扩大修复范围", () => {
  const run = failedRun();
  run.stepResults[0].status = "blocked";
  run.stepResults[0].layoutStatus = "blocked";
  run.sourceReview = { status: "failed", actual: "源码存在缺口", evidenceReferences: [] };
  const review = new AcceptanceFailureScopePolicy().review(proposal(), run);
  assert.equal(review.decision, "outside-original-acceptance");
  assert.match(review.reason, /源码审查失败/);
});

test("多个逐项源码失败保留各自文件依据，不伪造页面截图和操作", () => {
  const expected = ["归档结论必须有唯一记录", "当前专题投影不得绕过该记录"];
  const currentProposal = {
    ...proposal(expected),
    acceptancePlan: { conditions: expected.map((criterion, index) => ({ conditionId: `criterion-${index + 1}`, criterion, evidenceType: "code-conformance" })) },
  };
  const run = failedRun(expected, "criterion-1");
  run.mode = "code-conformance";
  run.sourceReview = { status: "passed", actual: "结构审查通过", evidenceReferences: ["structure.ts:1"] };
  run.stepResults = expected.map((criterion, index) => ({
    ...run.stepResults[0], checkId: `criterion-${index + 1}`, operationIndex: index,
    evidenceMode: "code-conformance", actual: `${criterion}仍未实现`,
    evidenceReferences: [`source-${index + 1}.ts:10`], screenshotAttachmentId: null, layoutScreenshotAttachmentId: null,
    layoutStatus: "not-applicable",
  }));
  const review = new AcceptanceFailureScopePolicy().review(currentProposal, run);
  assert.equal(review.decision, "within-original-acceptance");
  assert.equal(review.defects.length, 2);
  assert.deepEqual(review.defects.map((defect) => defect.sourceReferences), [["source-1.ts:10"], ["source-2.ts:10"]]);
  assert.deepEqual(review.defects.map((defect) => defect.screenshotAttachmentIds), [[], []]);
  assert.deepEqual(review.defects.map((defect) => defect.reproductionOperations), [[], []]);
  run.stepResults[0].evidenceReferences = [];
  assert.equal(new AcceptanceFailureScopePolicy().review(currentProposal, run).decision, "outside-original-acceptance");
});

test("多条源码条件中总体审查与逐项失败共享文件时仍沿原条件返修", () => {
  const expected = ["三语立即一致显示", "三语重启后一致恢复"];
  const currentProposal = {
    ...proposal(expected),
    acceptancePlan: { conditions: expected.map((criterion, index) => ({ conditionId: `criterion-${index + 1}`, criterion, evidenceType: "code-conformance" })) },
  };
  const run = failedRun(expected, "criterion-1");
  run.mode = "code-conformance";
  run.stepResults = expected.map((criterion, index) => ({
    ...run.stepResults[0], checkId: `criterion-${index + 1}`, operationIndex: index,
    evidenceMode: "code-conformance", actual: `${criterion}仍未实现`,
    evidenceReferences: [`apps/ai-desktop/src/fixed-copy.ts:${index + 10}`],
    screenshotAttachmentId: null, layoutScreenshotAttachmentId: null, layoutStatus: "not-applicable",
  }));
  run.sourceReview = {
    status: "failed", actual: "旧语言分支仍在", evidenceReferences: ["apps/ai-desktop/src/fixed-copy.ts:50"],
  };
  const review = new AcceptanceFailureScopePolicy().review(currentProposal, run);
  assert.equal(review.decision, "within-original-acceptance");
  assert.deepEqual(review.defects.map((defect) => defect.checkId), ["criterion-1", "criterion-2"]);
  run.sourceReview.evidenceReferences = ["apps/ai-desktop/src/unrelated.ts:50"];
  assert.equal(new AcceptanceFailureScopePolicy().review(currentProposal, run).decision, "outside-original-acceptance");
});
