import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { build } from "esbuild";

const prompt = readFileSync("prompts/personas/hanli/result-acceptance.md", "utf8");
const computerPrompt = readFileSync("prompts/personas/hanli/computer-acceptance.md", "utf8");
const computer = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
const runtime = readFileSync("electron/services/workflow/internal/evolution/persona-evolution.runtime.ts", "utf8");
const applicationRuntime = readFileSync("electron/system/bootstrap/application-runtime.ts", "utf8");
const decision = readFileSync("electron/services/personas/hanli/internal/decision/hanli-decision.service.ts", "utf8");
const coordinator = readFileSync("electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts", "utf8");
const application = readFileSync("electron/services/personas/hanli/internal/application/hanli-application.service.ts", "utf8");
const classification = await build({ entryPoints: ["electron/services/workflow/domain/acceptance-result-classification.policy.ts"], bundle: true, platform: "node", format: "esm", write: false });
const { classifyAcceptanceRun } = await import(`data:text/javascript;base64,${Buffer.from(classification.outputFiles[0].text).toString("base64")}`);

test("韩立固定审查正式页面与源码结构", () => {
  assert.match(prompt, /普通客户/);
  assert.match(prompt, /高内聚、低耦合并且便于新手阅读/);
  assert.match(prompt, /统一测试、异常边界和工程门禁由令狐负责/);
  assert.match(prompt, /无论哪种模式，都必须返回 sourceReview/);
  assert.match(decision, /韩立缺少独立的源码结构与新手可读性审查结论/);
  assert.match(runtime, /composeHanliResultReview\(plan, review, pageRun\)/);
  assert.match(coordinator, /sourceReview: sourceRun\.sourceReview/);
  assert.match(coordinator, /sourceEvidenceStatus: sourceEvidence\.status/);
  assert.match(prompt, /sourceEvidence` 是唯一已授权、去重后的源码片段/);
  assert.match(prompt, /sourceEvidenceStatus=available/);
  assert.match(prompt, /durationEvidence/);
});

test("受阻验收先归档本轮真实结果再进入恢复，当前卡不沿用上一轮", () => {
  const branch = runtime.slice(runtime.indexOf('if (classification.disposition === "acceptance-capability-or-runtime-blocked")'), runtime.indexOf('if (runResult.status === "failed")'));
  assert.match(branch, /this\.#hanli\.completeAutomaticAcceptance\(runResult,/u);
  assert.ok(branch.indexOf("this.#hanli.completeAutomaticAcceptance(runResult,") < branch.indexOf("this.#blockOneShotFailure("));
});

test("真实业务前提缺失独立于验收工具故障，不会被当成可修源码缺陷", () => {
  const run = { sourceReview: { status: "passed" }, stepResults: [
    { checkId: "criterion-1", status: "blocked", layoutStatus: "blocked", blockerKind: "scenario-precondition" },
    { checkId: "criterion-2", status: "passed", layoutStatus: "passed" },
  ] };
  assert.equal(classifyAcceptanceRun(run).disposition, "acceptance-precondition-unavailable");
  assert.equal(classifyAcceptanceRun({ ...run, stepResults: [...run.stepResults, { checkId: "criterion-3", status: "blocked", layoutStatus: "blocked", blockerKind: "runtime-environment" }] }).disposition, "acceptance-capability-or-runtime-blocked");
  assert.match(runtime, /acceptanceFailureKind: "acceptance-precondition-unavailable"/);
  assert.match(computerPrompt, /blockerKind=scenario-precondition/);
});

test("成员均 idle 的原条件仍归任务协作群同屏验收", () => {
  assert.match(runtime, /item\.pageSurface === "task-collaboration"/u);
  assert.doesNotMatch(runtime, /requiresTaskCollaborationSurface/u);
  assert.match(computer, /taskCollaborationCriterionIds\.has\(criterionId\)/u);
});

test("源码审查证据覆盖同提案已集成原任务、测试和布局，不读取越界文件", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { buildHanliResultReviewContext } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const task = (taskId, files) => ({ taskId, state: "integrated", snapshot: { title: taskId, problemStatement: "", confirmedIntent: "", constraints: [], acceptanceCriteria: [] }, executionRecords: [{ changedFiles: files }] });
  const original = task("original", ["apps/ai-desktop/electron/services/workflow/domain/current-topic-stage.projection.ts", "apps/ai-desktop/src/features/collaboration/components/TaskCollaborationGroup/TaskGroupCard.tsx", "../../AGENTS.md", "apps/ai-desktop/tests/services/workflow/hanli-review-contract.test.mjs"]);
  const repair = task("repair", ["apps/ai-desktop/electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"]);
  const workspace = { primaryId: "root", roots: [{ id: "root", path: path.resolve("../..") }] };
  const context = buildHanliResultReviewContext([original, repair], workspace, [original, repair]);
  assert.deepEqual(context.tasks.map((item) => item.taskId), ["original", "repair"]);
  assert.ok(context.tasks.every((item) => item.sourceEvidence === undefined));
  assert.equal(context.sourceEvidenceStatus, "available");
  assert.equal(context.sourceEvidenceScope, "integrated-proposal-task-files-tests-layout-and-two-level-relative-imports");
  const sourceFiles = context.sourceEvidence.map((item) => item.file);
  assert.ok(sourceFiles.includes("apps/ai-desktop/electron/services/workflow/domain/current-topic-stage.projection.ts"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/electron/services/workflow/domain/current-topic-technical-recovery.projection.ts"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/electron/services/workflow/domain/current-topic-read-recovery.ts"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/src/features/collaboration/components/TaskCollaborationGroup/TaskTimelineNode.tsx"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/src/features/collaboration/components/TaskCollaborationGroup/TaskGroupAuditCard.tsx"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/src/features/collaboration/components/TaskCollaborationGroup/TaskGroupAcceptanceEvidence.tsx"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/src/features/collaboration/components/TaskCollaborationGroup/timeline-display.ts"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/tests/services/workflow/hanli-review-contract.test.mjs"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/src/applications/styles/desktop-applications.css"));
  assert.ok(sourceFiles.every((file) => file.startsWith("apps/ai-desktop/")));
  const stageSource = context.sourceEvidence.find((item) => item.file.endsWith("/current-topic-stage.projection.ts"))?.content || "";
  assert.match(stageSource, /currentTopicStage|CurrentTopicStage/u);
  assert.match(stageSource, /projectCurrentTechnicalRecovery/u);
  const technicalSource = context.sourceEvidence.find((item) => item.file.endsWith("/current-topic-technical-recovery.projection.ts"))?.content || "";
  assert.match(technicalSource, /const blockedAcceptanceRetry/u);
  assert.match(technicalSource, /recovery\.occurrences/u);
  assert.doesNotMatch(stageSource, /源码中段省略/u);
});

test("冻结的验收源码清单在无任务变更时仍作为受限只读证据，并拒绝越界清单", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { buildHanliResultReviewContext } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const workspace = { primaryId: "root", roots: [{ id: "root", path: path.resolve("../..") }] };
  const manifest = [
    "apps/ai-desktop/electron/services/workflow/domain/current-topic-stage.projection.ts",
    "apps/ai-desktop/electron/services/workflow/internal/collaboration/collaboration-interaction-performance.log.ts",
  ];
  const context = buildHanliResultReviewContext([], workspace, [], manifest);
  assert.equal(context.sourceEvidenceStatus, "available");
  assert.deepEqual(context.frozenSourceEvidenceFiles, manifest);
  assert.equal(context.sourceEvidenceScope, "integrated-proposal-task-files-and-frozen-acceptance-evidence-with-two-level-relative-imports");
  assert.ok(manifest.every((file) => context.sourceEvidence.some((item) => item.file === file)));
  const missing = "apps/ai-desktop/electron/services/workflow/domain/not-present-for-review.ts";
  const missingContext = buildHanliResultReviewContext([], workspace, [], [missing]);
  assert.match(missingContext.sourceEvidence[0].content, /当前授权工作区不存在/);
  assert.throws(() => buildHanliResultReviewContext([], workspace, [], ["../outside.ts"]), /越界路径/);
  assert.throws(() => buildHanliResultReviewContext([], workspace, [], [manifest[0], manifest[0]]), /清单无效/);
});

test("历史终态和页面读取回归测试被冻结为验收必读证据", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { buildHanliResultReviewContext } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const workspace = { primaryId: "root", roots: [{ id: "root", path: path.resolve("../..") }] };
  const regressions = [
    "apps/ai-desktop/tests/services/workflow/collaboration-timeline.test.mjs",
    "apps/ai-desktop/tests/services/workflow/current-topic-stage-projection.test.mjs",
    "apps/ai-desktop/tests/features/collaboration/collaboration-status-chain-contract.test.mjs",
    "apps/ai-desktop/tests/features/collaboration/task-group-recovery.test.mjs",
    "apps/ai-desktop/tests/services/workflow/hanli-review-contract.test.mjs",
  ];
  const context = buildHanliResultReviewContext([], workspace, [], regressions);
  assert.equal(context.sourceEvidenceStatus, "available");
  assert.deepEqual(context.frozenSourceEvidenceFiles, regressions);
  assert.ok(regressions.every((file) => context.sourceEvidence.some((item) => item.file === file)));
  for (const file of regressions) assert.match(application, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
  assert.deepEqual(context.frozenSourceEvidence.missing, []);
  assert.deepEqual(context.frozenSourceEvidence.regressionFiles, regressions);
  assert.deepEqual(context.frozenSourceEvidence.regressionCoverage["criterion-3"], {
    status: "covered",
    scenarios: [
      { scenario: "同一时间戳活动不覆盖终态", evidenceFiles: ["apps/ai-desktop/tests/services/workflow/current-topic-stage-projection.test.mjs"] },
      { scenario: "终态晚于旧恢复节点时收口为完成", evidenceFiles: ["apps/ai-desktop/tests/services/workflow/collaboration-timeline.test.mjs"] },
      { scenario: "终态后真实恢复活动覆盖完成", evidenceFiles: ["apps/ai-desktop/tests/services/workflow/collaboration-timeline.test.mjs"] },
      { scenario: "专题更新时间未推进不替代事实发生时间", evidenceFiles: ["apps/ai-desktop/tests/services/workflow/collaboration-timeline.test.mjs"] },
    ],
  });
  const maximumFrozenEvidenceFiles = [
    "apps/ai-desktop/electron/services/support/capabilities/release/internal/version-integration.pipeline.ts",
    "apps/ai-desktop/electron/services/workflow/domain/current-topic-stage.projection.ts",
    "apps/ai-desktop/electron/services/workflow/domain/current-topic-delivery-evidence.ts",
    "apps/ai-desktop/electron/services/workflow/internal/collaboration/collaboration-duration.log.ts",
    "apps/ai-desktop/electron/services/workflow/internal/collaboration/collaboration-interaction-performance.log.ts",
    "apps/ai-desktop/electron/system/ipc/domains/register-collaboration-ipc.ts",
    "apps/ai-desktop/src/features/collaboration/components/TaskCollaborationGroup/TaskGroupCard.tsx",
    "apps/ai-desktop/src/features/collaboration/components/TaskCollaborationGroup/TaskGroupAcceptanceEvidence.tsx",
    "apps/ai-desktop/tests/services/workflow/collaboration-timeline.test.mjs",
    "apps/ai-desktop/tests/services/workflow/current-topic-stage-projection.test.mjs",
    "apps/ai-desktop/tests/features/collaboration/collaboration-status-chain-contract.test.mjs",
    "apps/ai-desktop/tests/features/collaboration/task-group-recovery.test.mjs",
    "apps/ai-desktop/tests/services/workflow/hanli-review-contract.test.mjs",
  ];
  assert.doesNotThrow(() => buildHanliResultReviewContext([], workspace, [], maximumFrozenEvidenceFiles));
  assert.throws(
    () => buildHanliResultReviewContext([], workspace, [], [...maximumFrozenEvidenceFiles, "apps/ai-desktop/electron/services/personas/hanli/internal/application/hanli-application.service.ts"]),
    /冻结的验收源码证据清单无效/u,
  );
});

test("历史审计卡只读展开回执包含可见文本和无业务操作的事实", () => {
  const auditActionStart = computer.indexOf("async function toggleTaskAuditCard");
  const auditActionEnd = computer.indexOf("/** 只读取正式页面中可见的任务协作群标识", auditActionStart);
  const auditAction = computer.slice(auditActionStart, auditActionEnd);
  assert.match(auditAction, /auditCardText: card\.innerText/u);
  assert.match(auditAction, /auditDetailText: detail\?\.innerText/u);
  assert.match(auditAction, /businessActionCount: businessActions\.length/u);
  assert.doesNotMatch(auditAction, /desktop:|window\.desktop|onResumeAcceptance|onContinueTask/u);
});

test("韩立验收上下文只传入任务绑定候选的耗时证据", () => {
  assert.match(runtime, /readAcceptanceDurationEvidence\(acceptanceTasks\)/u);
  assert.match(runtime, /beginAcceptanceDuration\(acceptanceTasks\)/u);
  assert.match(applicationRuntime, /"analysis", "source-change", "verification", "preflight", "combination-test", "release", "restart-health", "result-acceptance"/u);
  assert.match(coordinator, /durationEvidence,/u);
  assert.match(prompt, /bindingStatus.*available/u);
  assert.match(prompt, /missingSegments/u);
});

test("耗时证据拒绝用旧候选或旧执行尝试补齐当前阶段", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/collaboration/collaboration-duration.log.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { CollaborationDurationLog } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const parent = process.env.AI_DESKTOP_TEST_TEMP_ROOT || tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(path.join(parent, "hanli-duration-evidence-"));
  try {
    const log = new CollaborationDurationLog(root);
    const finish = (segment, details) => {
      const span = log.start("task-a", segment, details);
      log.finish(span);
    };
    finish("source-change", { executionAttemptId: "attempt-old" });
    finish("source-change", { executionAttemptId: "attempt-current" });
    finish("verification", { executionAttemptId: "attempt-current" });
    finish("preflight", { candidateSha: "c".repeat(40) });
    finish("combination-test", { candidateSha: "a".repeat(40) });
    finish("restart-health", { candidateSha: "b".repeat(40) });
    const resultSha = "b".repeat(40);
    const blocked = log.readTaskEvidence({ taskId: "task-a", assignmentId: "attempt-current", versionWorkspace: { resultSha }, flowEvents: [] }, ["source-change"]);
    assert.equal(blocked.bindingStatus, "candidate-missing");
    assert.deepEqual(blocked.missingSegments, ["source-change"]);
    const available = log.readTaskEvidence({ taskId: "task-a", assignmentId: "attempt-current", versionWorkspace: { resultSha }, flowEvents: [{ details: { candidateSha: "a".repeat(40) } }] }, ["source-change", "verification", "preflight", "combination-test", "restart-health", "result-acceptance"]);
    assert.equal(available.bindingStatus, "available");
    assert.deepEqual(available.completedSegments, ["source-change", "verification", "combination-test"]);
    assert.deepEqual(available.missingSegments, ["preflight", "restart-health", "result-acceptance"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("进程外修复可用已有审计边界补记当前候选真实耗时", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/collaboration/collaboration-duration.log.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { CollaborationDurationLog } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const parent = process.env.AI_DESKTOP_TEST_TEMP_ROOT || tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(path.join(parent, "hanli-duration-recovery-"));
  try {
    const log = new CollaborationDurationLog(root);
    const candidateSha = "d".repeat(40);
    log.recordCompleted("task-a", "source-change", "2026-09-26T06:03:39.000Z", "2026-09-26T06:05:23.000Z", { executionAttemptId: "attempt-current" });
    log.recordCompleted("task-a", "restart-health", "2026-09-26T06:10:45.128Z", "2026-09-26T06:11:46.605Z", { candidateSha });
    const evidence = log.readTaskEvidence({ taskId: "task-a", assignmentId: "attempt-current", versionWorkspace: { resultSha: candidateSha }, flowEvents: [{ details: { candidateSha } }] }, ["source-change", "restart-health"]);
    assert.equal(evidence.bindingStatus, "available");
    assert.deepEqual(evidence.completedSegments, ["source-change", "restart-health"]);
    assert.deepEqual(evidence.missingSegments, []);
    assert.throws(() => log.recordCompleted("task-a", "verification", "2026-09-26T06:06:23.000Z", "2026-09-26T06:05:23.000Z"), /时间边界无效/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("证据达到四十八项上限时仍完整保留冻结源码清单", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { buildHanliResultReviewContext } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const parent = process.env.AI_DESKTOP_TEST_TEMP_ROOT || tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(path.join(parent, "hanli-review-frozen-limit-"));
  try {
    const frozen = Array.from({ length: 8 }, (_, index) => `apps/ai-desktop/electron/services/workflow/domain/frozen-${index}.ts`);
    const changedRuntime = "apps/ai-desktop/electron/services/workflow/internal/evolution/persona-evolution.runtime.ts";
    const renderer = Array.from({ length: 22 }, (_, index) => `apps/ai-desktop/src/features/conversation/saturated-${index}.tsx`);
    const firstLevel = renderer.map((_, index) => `apps/ai-desktop/src/features/conversation/dependency-${index}.ts`);
    const secondLevel = renderer.map((_, index) => `apps/ai-desktop/src/features/conversation/leaf-${index}.ts`);
    const layout = "apps/ai-desktop/src/applications/styles/desktop-applications.css";
    for (const file of [...frozen, changedRuntime, ...renderer, ...firstLevel, ...secondLevel, layout]) mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    for (const [index, file] of renderer.entries()) writeFileSync(path.join(root, file), `import { dependency } from "./dependency-${index}.js";\nexport const surface = dependency;\n`);
    for (const [index, file] of firstLevel.entries()) writeFileSync(path.join(root, file), `import { leaf } from "./leaf-${index}.js";\nexport const dependency = leaf;\n`);
    for (const file of secondLevel) writeFileSync(path.join(root, file), "export const leaf = true;\n");
    for (const file of frozen) writeFileSync(path.join(root, file), `export const frozenEvidence = ${JSON.stringify(file)};\n`);
    writeFileSync(path.join(root, changedRuntime), "export const dynamicCandidate = true;\n");
    writeFileSync(path.join(root, layout), ".saturated { display: grid; }\n");
    const task = { taskId: "saturated-evidence", state: "integrated", snapshot: { title: "saturated", problemStatement: "", confirmedIntent: "", constraints: [], acceptanceCriteria: [] }, executionRecords: [{ changedFiles: [...renderer, changedRuntime] }] };
    const context = buildHanliResultReviewContext([task], { primaryId: "root", roots: [{ id: "root", path: root }] }, [task], frozen);
    const files = context.sourceEvidence.map((item) => item.file);
    assert.equal(files.length, 48);
    for (const file of frozen) assert.ok(files.includes(file), `missing frozen evidence ${file}`);
    assert.ok(files.includes(changedRuntime), "真实生产改动不能被冻结证据或依赖展开挤出");
    assert.ok(files.indexOf(changedRuntime) < files.indexOf(frozen[0]), "真实生产改动必须先于冻结能力证据进入可消费前部");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("真实生产改动与冻结清单合计超过四十八项时阻断源码审查", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { buildHanliResultReviewContext } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const parent = process.env.AI_DESKTOP_TEST_TEMP_ROOT || tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(path.join(parent, "hanli-review-required-evidence-limit-"));
  try {
    const frozen = Array.from({ length: 8 }, (_, index) => `apps/ai-desktop/electron/services/workflow/domain/frozen-${index}.ts`);
    const changed = Array.from({ length: 48 }, (_, index) => `apps/ai-desktop/electron/services/workflow/internal/evolution/changed-${index}.ts`);
    for (const file of [...frozen, ...changed]) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), "export const evidence = true;\n");
    }
    const task = { taskId: "required-evidence-limit", state: "integrated", snapshot: { title: "required", problemStatement: "", confirmedIntent: "", constraints: [], acceptanceCriteria: [] }, executionRecords: [{ changedFiles: changed }] };
    const context = buildHanliResultReviewContext([task], { primaryId: "root", roots: [{ id: "root", path: root }] }, [task], frozen);
    assert.equal(context.sourceEvidenceStatus, "required-evidence-exceeds-limit");
    assert.deepEqual(context.sourceEvidence, []);
    assert.deepEqual(context.sourceEvidenceBatches.flatMap((batch) => batch.files), [...changed, ...frozen]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("已提交任务的流式清单只剩测试文件时从签发提交恢复源码证据", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { buildHanliResultReviewContext } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const parent = process.env.AI_DESKTOP_TEST_TEMP_ROOT || tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(path.join(parent, "hanli-review-commits-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  try {
    git("init", "-q");
    const source = "apps/ai-desktop/electron/services/personas/hanli/thread.ts";
    const testFile = "apps/ai-desktop/tests/hanli-thread.test.mjs";
    mkdirSync(path.dirname(path.join(root, source)), { recursive: true });
    mkdirSync(path.dirname(path.join(root, testFile)), { recursive: true });
    writeFileSync(path.join(root, source), "export const threadOwner = 'before';\n");
    git("add", ".");
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "baseline");
    const baseSha = git("rev-parse", "HEAD");
    writeFileSync(path.join(root, source), "export const threadOwner = 'current-conversation';\n");
    writeFileSync(path.join(root, testFile), "// verification only\n");
    git("add", ".");
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "result");
    const resultSha = git("rev-parse", "HEAD");
    const task = {
      taskId: "integrated-task",
      state: "integrated",
      snapshot: { title: "thread ownership", problemStatement: "", confirmedIntent: "", constraints: [], acceptanceCriteria: [] },
      executionRecords: [{ changedFiles: [testFile] }],
      versionWorkspace: { baseSha, resultSha },
    };
    const context = buildHanliResultReviewContext([task], { primaryId: "root", roots: [{ id: "root", path: root }] });
    assert.equal(context.sourceEvidenceStatus, "available");
    assert.deepEqual(context.sourceEvidence.map((item) => item.file), [source, testFile]);
    assert.match(context.sourceEvidence.find((item) => item.file === source)?.content || "", /current-conversation/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("超过三十个已登记文件时保留场景、布局和场景生产表面", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { buildHanliResultReviewContext } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const parent = process.env.AI_DESKTOP_TEST_TEMP_ROOT || tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(path.join(parent, "hanli-review-batches-"));
  try {
    const scenario = "apps/ai-desktop/tests/interaction/language-settings-acceptance.scenario.ts";
    const settings = "apps/ai-desktop/src/features/settings/components/DeveloperSettingsView.tsx";
    const composer = "apps/ai-desktop/src/features/conversation/components/CodexConversationWorkspace/CodexConversationComposer.tsx";
    const layout = "apps/ai-desktop/src/applications/styles/desktop-applications.css";
    const changedSource = "apps/ai-desktop/src/applications/developer/entry.ts";
    const overflow = Array.from({ length: 31 }, (_, index) => `apps/ai-desktop/tests/overflow/overflow-${index}.test.mjs`);
    for (const file of [...overflow, scenario, settings, composer, layout, changedSource]) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      const content = file === scenario
        ? 'export type Surfaces = [typeof import("../../src/features/settings/components/DeveloperSettingsView").DeveloperSettingsView, typeof import("../../src/features/conversation/components/CodexConversationWorkspace/CodexConversationComposer").CodexConversationComposer];\n'
        : file === settings ? "export function DeveloperSettingsView() { return null; }\n"
          : file === composer ? "export function CodexConversationComposer() { return null; }\n"
            : file === layout ? ".later-batch-layout { display: grid; }\n"
              : "export const source = true;\n";
      writeFileSync(path.join(root, file), content);
    }
    const task = { taskId: "many-files", state: "integrated", snapshot: { title: "batch", problemStatement: "", confirmedIntent: "", constraints: [], acceptanceCriteria: [] }, executionRecords: [{ changedFiles: [...overflow, scenario, changedSource] }] };
    const context = buildHanliResultReviewContext([task], { primaryId: "root", roots: [{ id: "root", path: root }] });
    assert.equal(context.sourceEvidenceStatus, "available");
    assert.equal(context.sourceEvidenceBatches.flatMap((batch) => batch.files).length, context.sourceEvidence.length);
    assert.ok(context.sourceEvidence.length <= 48);
    assert.ok(context.sourceEvidence.map((item) => item.file).includes(settings));
    assert.ok(context.sourceEvidence.map((item) => item.file).includes(composer));
    assert.match(context.sourceEvidence.find((item) => item.file === scenario)?.content || "", /typeof import/u);
    assert.match(context.sourceEvidence.find((item) => item.file === layout)?.content || "", /later-batch-layout/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("三语专题在证据上限内优先保留资源回退、设置持久化和会话调用方", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { buildHanliResultReviewContext } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const parent = process.env.AI_DESKTOP_TEST_TEMP_ROOT || tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(path.join(parent, "hanli-review-locale-priority-"));
  try {
    const resource = "apps/ai-desktop/contracts/foundation/i18n/fixed-ui-text.ts";
    const store = "apps/ai-desktop/electron/services/support/platform/settings/internal/settings.store.ts";
    const fallbackTest = "apps/ai-desktop/tests/services/support/platform/settings/settings-store.test.mjs";
    const composer = "apps/ai-desktop/src/features/conversation/components/CodexConversationWorkspace/CodexConversationComposer.tsx";
    const scenario = "apps/ai-desktop/tests/interaction/language-settings-acceptance.scenario.ts";
    const generic = Array.from({ length: 40 }, (_, index) => `apps/ai-desktop/src/applications/developer/generic-${index}.ts`);
    for (const file of [...generic, resource, store, fallbackTest, composer, scenario]) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), `// ${file}\n`);
    }
    const task = { taskId: "locale-evidence", state: "integrated", snapshot: { title: "three locales", problemStatement: "", confirmedIntent: "", constraints: [], acceptanceCriteria: [] }, executionRecords: [{ changedFiles: [...generic, resource, store, fallbackTest, composer, scenario] }] };
    const context = buildHanliResultReviewContext([task], { primaryId: "root", roots: [{ id: "root", path: root }] });
    const files = context.sourceEvidence.map((item) => item.file);
    for (const critical of [scenario, resource, store, fallbackTest, composer]) assert.ok(files.includes(critical), `missing ${critical}`);
    assert.ok(files.length <= 48);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("韩立源码审查完整读取超过通用上限的固定三语资源", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { buildHanliResultReviewContext } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const file = "apps/ai-desktop/contracts/foundation/i18n/fixed-ui-text.ts";
  const task = { taskId: "fixed-ui-text", state: "integrated", snapshot: { title: "three locales", problemStatement: "", confirmedIntent: "", constraints: [], acceptanceCriteria: [] }, executionRecords: [{ changedFiles: [file] }] };
  const context = buildHanliResultReviewContext([task], { primaryId: "root", roots: [{ id: "root", path: path.resolve("../..") }] });
  const source = context.sourceEvidence.find((item) => item.file === file)?.content || "";
  assert.ok(source.length > 48_000);
  assert.equal(source, readFileSync(path.resolve("../..", file), "utf8"));
  assert.match(source, /hanliContextReadStats/u);
  assert.doesNotMatch(source, /源码中段省略/u);
});

test("韩立审查完整读取可控大小的样式文件中段响应式规则", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { buildHanliResultReviewContext } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const file = "apps/ai-desktop/src/applications/styles/desktop-applications.css";
  const task = { taskId: "layout", state: "integrated", snapshot: { title: "layout", problemStatement: "", confirmedIntent: "", constraints: [], acceptanceCriteria: [] }, executionRecords: [{ changedFiles: [file] }] };
  const context = buildHanliResultReviewContext([task], { primaryId: "root", roots: [{ id: "root", path: path.resolve("../..") }] });
  const source = context.sourceEvidence.find((item) => item.file === file)?.content || "";
  assert.ok(source.length > 48_000);
  assert.match(source, /@media \(max-width: 720px\) \{\s*\.hanli-person-composer \.composer-error/u);
  assert.doesNotMatch(source, /源码中段省略/u);
});

test("韩立源码审查完整读取已声明的语言设置交互场景", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { buildHanliResultReviewContext } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const file = "apps/ai-desktop/tests/interaction/language-settings-acceptance.scenario.ts";
  const task = { taskId: "language-settings", state: "integrated", snapshot: { title: "language settings", problemStatement: "", confirmedIntent: "", constraints: [], acceptanceCriteria: [] }, executionRecords: [{ changedFiles: [file] }] };
  const context = buildHanliResultReviewContext([task], { primaryId: "root", roots: [{ id: "root", path: path.resolve("../..") }] });
  const source = context.sourceEvidence.find((item) => item.file === file)?.content || "";
  assert.match(source, /getMinimumSize\(\)/u);
  assert.match(source, /setInteractionSettingsUpdateFailure/u);
  assert.match(source, /setInteractionSettingsReadSource\("recovered"\)/u);
  assert.match(source, /openInteractionScreenshotWindow/u);
  assert.doesNotMatch(source, /源码中段省略/u);
});

test("执行完成时以完整 Git 结果覆盖最后一次流式 diff", () => {
  const workflow = readFileSync("electron/services/workflow/collaboration-workflow.facade.ts", "utf8");
  assert.match(workflow, /execution\.changedFiles = normalizeChangedFiles\(result\.changedFiles\)/u);
});

test("已登记但在本版本退役的验收场景文件明确标记缺失，不沿用旧源码", async () => {
  const bundled = await build({ entryPoints: ["electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { buildHanliResultReviewContext } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const removed = "apps/ai-desktop/electron/services/personas/hanli/internal/acceptance/hanli-task-collaboration-scenario.ts";
  const task = { taskId: "original", state: "integrated", snapshot: { title: "original", problemStatement: "", confirmedIntent: "", constraints: [], acceptanceCriteria: [] }, executionRecords: [{ changedFiles: [removed] }] };
  const workspace = { primaryId: "root", roots: [{ id: "root", path: path.resolve("../..") }] };
  const context = buildHanliResultReviewContext([task], workspace);
  assert.deepEqual(context.sourceEvidence, [{ file: removed, content: "[当前授权工作区不存在该源码文件；不能沿用旧实现作为本版本证据]" }]);
});

test("正式页面检查不读取任务时间线或工作区源码", () => {
  const guard = readFileSync("electron/system/ipc/hanli-page-review-guard.ts", "utf8");
  const ipc = readFileSync("electron/system/ipc/register-desktop-ipc.ts", "utf8");
  assert.match(ipc, /getTitle\(\) === "AI Desktop"/);
  assert.match(ipc, /hanliPageReviewGuard\.begin/);
  assert.match(guard, /不能浏览工作区文件/);
  assert.match(computer, /不读取任务时间线或测试记录/);
  assert.doesNotMatch(computer, /inspect-task-collaboration-state|currentAcceptanceWindow|historicalAudit/);
});

test("正式页面验收会话拒绝通用审批，普通会话仍保留交互审批", () => {
  const appRuntime = readFileSync("electron/system/bootstrap/application-runtime.ts", "utf8");
  const codexFacade = readFileSync("electron/services/support/platform/codex/codex.facade.ts", "utf8");
  const acceptanceStart = appRuntime.indexOf('serviceName: "selplat_hanli_computer_acceptance"');
  const acceptanceEnd = appRuntime.indexOf("const acceptanceTimeout", acceptanceStart);
  const acceptanceSession = appRuntime.slice(acceptanceStart, acceptanceEnd);
  const approvalStart = codexFacade.indexOf('method !== "item/commandExecution/requestApproval"');
  const approvalEnd = codexFacade.indexOf("\n  #emitCommandPolicy(", approvalStart);
  const approvalHandler = codexFacade.slice(approvalStart, approvalEnd);

  assert.match(acceptanceSession, /approvalRequestPolicy: "reject"/);
  assert.match(acceptanceSession, /onCommandPolicy: \(details\) => eventCenter\.recordEvent\("hanli\.acceptance\.tool_policy", details\)/);
  assert.match(codexFacade, /approvalRequestPolicy\?: "interactive" \| "reject"/);
  assert.match(approvalHandler, /this\.#options\.approvalRequestPolicy === "reject"[\s\S]*decision: "decline"/);
  assert.ok(approvalHandler.indexOf('this.#options.approvalRequestPolicy === "reject"') < approvalHandler.indexOf("this.#trustedCommands.isTrusted"));
  assert.ok(approvalHandler.indexOf('this.#options.approvalRequestPolicy === "reject"') < approvalHandler.indexOf("this.#approvals.set"));
  assert.match(computerPrompt, /只能使用 `hanli_computer`/);
  assert.doesNotMatch(computerPrompt, /hanli_computer_step/);
  assert.match(computerPrompt, /禁止调用 shell、exec、osascript、System Events、外部窗口枚举或文件修改工具/);
  assert.match(computerPrompt, /不得降级到外部桌面自动化或申请用户审批/);
});

test("旧页面容器和文件授权协议已完整退役", () => {
  const sources = [
    readFileSync("contracts/services/evolution/dto/evolution-acceptance-plan.out.dto.ts", "utf8"),
    readFileSync("contracts/services/personas/hanli/dto/computer-acceptance.in.dto.ts", "utf8"),
    readFileSync("contracts/services/workflow/dto/collaboration-task-snapshot.out.dto.ts", "utf8"),
    readFileSync("contracts/services/workflow/dto/submit-collaboration-task.in.dto.ts", "utf8"),
    runtime,
    computer,
    coordinator,
  ].join("\n");
  assert.doesNotMatch(sources, /AcceptanceMaterial|acceptanceMaterials|currentAcceptanceWindow|resize-acceptance-window/);
  assert.match(computer, /resize-formal-window/);
});

test("正式页面允许安全重开并等待加载后返回新截图", () => {
  const operationValues = readFileSync("contracts/services/personas/hanli/value/acceptance.value.ts", "utf8");
  assert.match(computer, /"reload-formal-page"/);
  assert.match(computer, /await reloadFormalPage\(window\)/);
  assert.match(computer, /formalPage: pageReloadEvidence/);
  assert.match(operationValues, /type: "reload-formal-page"/);
  assert.doesNotMatch(computer, /reloadIgnoringCache/);
});

test("正式页面验收可逐张展开只读历史审计卡并保留截图取证", () => {
  const groupPage = readFileSync("src/features/collaboration/components/TaskCollaborationGroup.tsx", "utf8");
  assert.match(groupPage, /查看历史审计（\$\{auditHistoryGroups\.length\}）/u);
  assert.match(groupPage, /auditHistoryRef\.current[\s\S]*groupsPane\.scrollTo/u);
  assert.match(computerPrompt, /无须先滚完当前专题的长流程/u);
  const operationValues = readFileSync("contracts/services/personas/hanli/value/acceptance.value.ts", "utf8");
  const auditActionStart = computer.indexOf("async function toggleTaskAuditCard");
  const auditActionEnd = computer.indexOf("/** 只读取正式页面中可见的任务协作群标识", auditActionStart);
  const auditAction = computer.slice(auditActionStart, auditActionEnd);

  assert.match(computerPrompt, /toggle-task-audit-card[\s\S]*只用于阅读[\s\S]*页面截图/);
  assert.match(computer, /"toggle-task-audit-card"[\s\S]*auditCardIndex/);
  assert.match(operationValues, /type: "toggle-task-audit-card"; auditCardIndex: number/);
  assert.match(auditAction, /task-collaboration-audit-history[\s\S]*historyTrigger\.click\(\)[\s\S]*requestAnimationFrame/);
  assert.match(auditAction, /task-collaboration-audit-history-card[\s\S]*data-sel-disclosure-trigger[\s\S]*scrollIntoView/);
  assert.doesNotMatch(auditAction, /desktop:|window\.desktop|task-recovery-continue|onResumeAcceptance|onContinueTask/);
});

test("正式页面截图同时携带客户可见语义和布局边界", () => {
  assert.match(computer, /pageEvidence = await window\.webContents\.executeJavaScript/);
  assert.match(computer, /source: "customer-visible-renderer"/);
  assert.match(computer, /querySelectorAll<HTMLElement>\("\.selconversation-message"\)/);
  assert.match(computer, /atBottom: maxScrollTop - timeline\.scrollTop <= 2/);
  assert.match(computer, /lastMessageComposerOverlap/);
  assert.doesNotMatch(computer, /pageEvidence[\s\S]{0,300}(workflow|timelineNode|taskId|localStorage)/);
});

test("未授权的数据操作归工程证据，原条件明确要求的当前会话重建必须真实页面验收", () => {
  assert.match(prompt, /发送消息、创建样本或测试数据、触发新任务、恢复任务、修改设置/);
  assert.match(prompt, /默认必须进入 code-conformance/);
  assert.match(prompt, /当前正式应用点击“新建\/重新建立会话”/);
  assert.match(prompt, /必须进入 pageCriterionIds/);
  assert.match(prompt, /不得创建、重建或恢复任何已退役的隔离验收环境/);
  assert.match(decision, /requiredFormalPageCriterionIds/);
  assert.match(decision, /effectiveMode = pageCriterionIds\.length > 0 \? "mixed"/);
});

test("页面动作和可见历史读取状态不跨句误读技术表述", async () => {
  const bundled = await build({ entryPoints: ["electron/services/personas/hanli/internal/decision/hanli-decision.service.ts"], bundle: true, platform: "node", format: "esm", write: false });
  const { requiredFormalPageCriterionIds } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const criteria = [
    { criterionId: "period", criterion: "请在当前正式应用中展开。任务卡页面验收。" },
    { criterionId: "semicolon", criterion: "请点击；任务卡页面验收。" },
    { criterionId: "question", criterion: "请展开？任务卡页面验收。" },
    { criterionId: "exclamation", criterion: "请打开！任务卡页面验收。" },
    { criterionId: "newline", criterion: "请收起\n任务卡页面验收。" },
    { criterionId: "ascii-period", criterion: "请在当前正式应用中展开. 任务卡页面验收。" },
    { criterionId: "ascii-semicolon", criterion: "请点击; 任务卡页面验收。" },
    { criterionId: "ascii-question", criterion: "请展开? 任务卡页面验收。" },
    { criterionId: "ascii-exclamation", criterion: "请打开! 任务卡页面验收。" },
    { criterionId: "attribution", criterion: "错误归因必须定位到验收条件分类入口。" },
    { criterionId: "repair", criterion: "修复应限制动作词与页面对象只在同一句匹配。" },
    { criterionId: "test", criterion: "测试必须覆盖跨句技术说明和同句页面操作。" },
    { criterionId: "restart", criterion: "重启后必须继续复用冻结计划的证据类型。" },
    { criterionId: "return", criterion: "返回验收时既有混合页面结果结构校验必须保持有效。" },
    { criterionId: "audit-source", criterion: "历史审计读取策略在源码中保留上次成功内容。" },
    { criterionId: "audit-cross-sentence", criterion: "历史区域显示。读取失败后保留上次成功内容。" },
    { criterionId: "audit-visible", criterion: "无可关联历史时，历史区域显示无记录或读取失败的实际状态；读取失败后原有成功内容仍保留。" },
    { criterionId: "interaction", criterion: "在当前正式应用中展开任务卡并点击查看详情按钮。" },
  ];
  assert.deepEqual(requiredFormalPageCriterionIds(criteria), ["audit-visible", "interaction"]);
  assert.match(prompt, /历史审计或历史区域显示[\s\S]*task-collaboration/u);
  assert.match(prompt, /不得因受限源码片段不足把这类可见状态降级为 code-conformance/u);
});

test("冻结的当前验收计划必须逐项复用且不得在结果审查时重新分区", () => {
  assert.match(prompt, /acceptancePlan\.version 为 2 或 3/);
  assert.match(prompt, /v3 的 `sourceEvidenceFiles` 只定义已授权的验收能力源码边界/);
  assert.match(prompt, /清单以外文件/);
  assert.match(prompt, /必须逐项照用其中的 evidenceType/);
  assert.match(prompt, /findings 必须逐项覆盖其余 code-conformance 条件/);
  assert.match(prompt, /不存在 page-experience 条件时返回 code-conformance/);
  assert.match(decision, /acceptancePlan 已存在时必须保持其 evidenceType 分区/);
  assert.match(application, /requiredFormalPageCriterionIds\(proposal\.acceptanceCriteria/u);
  assert.match(application, /retireAcceptanceCapabilityPlan\(proposalId, mandatoryPageCriterionIds\)/u);
});

test("客户未通过摘要与技术详情保持分离", () => {
  const handoff = readFileSync("electron/services/workflow/internal/acceptance/acceptance-handoff.service.ts", "utf8");
  assert.match(handoff, /export interface AcceptanceHandoffContent/);
  assert.match(handoff, /summary: handoff\.summary/);
  assert.match(handoff, /detail: handoff\.detail/);
  assert.match(runtime, /正式页面或源码审查未通过/);
});

test("结构化审查会自纠格式且不污染客户对话", () => {
  const appRuntime = readFileSync("electron/system/bootstrap/application-runtime.ts", "utf8");
  assert.match(decision, /#askForStructuredResult/);
  assert.match(decision, /连续 3 次未返回有效的结果验收判断/);
  assert.match(appRuntime, /createSqliteCodexSessionDao\(workflowDatabase, "hanli-result-acceptance"\)/);
  assert.match(appRuntime, /await acceptanceCodex\.newChat\(\)/);
});

test("结果验收归档实际传入的只读工作区授权边界", () => {
  const appRuntime = readFileSync("electron/system/bootstrap/application-runtime.ts", "utf8");
  const acceptanceStart = appRuntime.indexOf("askHanliResultAcceptance: async");
  const acceptanceEnd = appRuntime.indexOf("    conversation:", acceptanceStart);
  const acceptance = appRuntime.slice(acceptanceStart, acceptanceEnd);
  assert.match(acceptance, /const workspace = mergeWorkspaceState\(workspaces\.read\(\), state\.automationContext\.workspaceState!\)/);
  assert.match(acceptance, /eventCenter\.recordEvent\("han-li\.result_acceptance\.workspace_authorized"/);
  assert.match(acceptance, /roots: workspace\.roots\.map/);
  assert.match(acceptance, /acceptanceCodex\.send\(prompt, state\.automationContext\.locale, "read-only", workspace/);
});
