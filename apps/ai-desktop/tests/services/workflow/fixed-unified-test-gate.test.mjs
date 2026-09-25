import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, symlinkSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { controlledTestRoot } from "#test-paths";

// 定向门禁测试不得读取上一次构建的验证器；存在同名源码时把编译路径解析到工作树 TypeScript。
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && specifier.endsWith(".js")) {
      const sourceUrl = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
      if (existsSync(sourceUrl)) return { url: sourceUrl.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) {
      const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText;
      return { format: "module", source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { FixedUnifiedTestRunner, cleanupRuntimeActivationStaging } = await import("../../../electron/services/support/capabilities/testing/internal/fixed-unified-test.runner.ts");

function writeAcceptancePlanCandidate(root) {
  const services = path.join(root, "apps", "ai-desktop", "electron", "services");
  const state = path.join(services, "evolution", "internal", "evolution-state.store.ts");
  const runtime = path.join(services, "workflow", "internal", "evolution", "persona-evolution.runtime.ts");
  const projection = path.join(services, "workflow", "domain", "current-topic-stage.projection.ts");
  mkdirSync(path.dirname(state), { recursive: true });
  mkdirSync(path.dirname(runtime), { recursive: true });
  mkdirSync(path.dirname(projection), { recursive: true });
  writeFileSync(state, "saveAcceptancePlan acceptance.plan_frozen reopenCompletedAcceptance acceptance.reopened decideResult(proposalId plan.conditions.find((condition) => condition.conditionId === step.checkId)");
  writeFileSync(runtime, `if (review.mode === "mixed") {
    const pageCriterionIds = plan.conditions.filter((item) => item.evidenceType === "page-experience");
    runResult = composeHanliResultReview(plan, review, pageRun);
  }
  completeAutomaticAcceptance`);
  writeFileSync(projection, "acceptanceRoundId currentRoundId");
}

test("激活暂存清理将 app.asar 作为普通文件而非目录", () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "activation-staging-cleanup-"));
  const resources = path.join(root, "mac-arm64", "AI Desktop.app", "Contents", "Resources");
  mkdirSync(resources, { recursive: true });
  writeFileSync(path.join(resources, "app.asar"), "archive");
  writeFileSync(path.join(resources, "app.asar.unpacked"), "unpacked");
  symlinkSync("app.asar", path.join(resources, "app.asar-link"));
  cleanupRuntimeActivationStaging(root);
  assert.equal(existsSync(root), false);
});

test("独立验证一次收齐全部失败且不进入发布链", async () => {
  mkdirSync(controlledTestRoot, { recursive: true });
  const root = mkdtempSync(path.join(controlledTestRoot, "full-test-gate-"));
  const appRoot = path.join(root, "apps", "ai-desktop");
  mkdirSync(appRoot, { recursive: true });
  writeFileSync(path.join(appRoot, "package.json"), JSON.stringify({ scripts: {
    test: "node -e \"console.error('full-suite-regression');process.exit(17)\"",
    "test:interaction": "node -e \"require('fs').writeFileSync('interaction-ran','yes')\"",
    "test:collaboration": "node -e \"console.error('collaboration-regression');process.exit(19)\"",
    "test:managed": "node -e \"require('fs').writeFileSync('managed-ran','yes')\"",
    "package:mac:developer": "node -e \"require('fs').writeFileSync('package-must-not-run','bad')\"",
  }}));
  writeAcceptancePlanCandidate(root);
  const events = [];
  const runner = new FixedUnifiedTestRunner({
    sourceProjectRoot: root, applicationName: "ai-desktop", buildRoot: path.join(root, "build"),
    initiatorMemberId: "linghu-ancestor", eventNamespace: "gate",
    recordEvent: (type, details) => events.push({ type, details }),
    testResources: { run: async (_request, execute) => execute() },
  });
  try {
    await assert.rejects(runner.run(), (error) => {
      assert.equal(error.name, "UnifiedTestAggregateError");
      assert.deepEqual(error.failures.map((failure) => failure.script), ["test", "test:collaboration"]);
      assert.match(error.message, /full-suite-regression/);
      assert.match(error.message, /collaboration-regression/);
      return true;
    });
    assert.deepEqual(events.map(({type,details}) => [type,details.script]),
      [["gate.unified_test.started","test"],["gate.unified_test.failed","test"],
       ["gate.unified_test.started","test:interaction"],["gate.unified_test.completed","test:interaction"],
       ["gate.unified_test.started","test:collaboration"],["gate.unified_test.failed","test:collaboration"],
       ["gate.unified_test.started","test:managed"],["gate.unified_test.completed","test:managed"]]);
    assert.equal(existsSync(path.join(appRoot, "interaction-ran")), true);
    assert.equal(existsSync(path.join(appRoot, "managed-ran")), true);
    assert.equal(existsSync(path.join(appRoot, "package-must-not-run")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("长输出仍把同一脚本的早晚失败用例一次交给修复", async () => {
  mkdirSync(controlledTestRoot, { recursive: true });
  const root = mkdtempSync(path.join(controlledTestRoot, "full-failure-evidence-"));
  const appRoot = path.join(root, "apps", "ai-desktop");
  mkdirSync(appRoot, { recursive: true });
  const script = [
    "process.stdout.write('not ok 1 - early-contract\\n  ---\\n  location: early.test.mjs:10\\n  error: early mismatch\\n  ...\\n');",
    "process.stdout.write('passed-noise\\n'.repeat(3000));",
    "process.stdout.write('not ok 2 - late-contract\\n  ---\\n  location: late.test.mjs:20\\n  error: late mismatch\\n  ...\\n');",
    "process.exit(1);",
  ].join("");
  writeFileSync(path.join(appRoot, "package.json"), JSON.stringify({ scripts: {
    test: `node -e ${JSON.stringify(script)}`,
    "test:interaction": "node -e \"process.exit(0)\"",
    "test:collaboration": "node -e \"process.exit(0)\"",
    "test:managed": "node -e \"process.exit(0)\"",
  }}));
  writeAcceptancePlanCandidate(root);
  const runner = new FixedUnifiedTestRunner({
    sourceProjectRoot: root, applicationName: "ai-desktop", buildRoot: path.join(root, "build"),
    initiatorMemberId: "linghu-ancestor", eventNamespace: "gate",
    recordEvent: () => undefined,
    testResources: { run: async (_request, execute) => execute() },
  });
  try {
    await assert.rejects(runner.validate(), (error) => {
      assert.equal(error.name, "UnifiedTestAggregateError");
      assert.deepEqual(error.failures.map((failure) => failure.script), ["test"]);
      assert.match(error.message, /early-contract[\s\S]*early\.test\.mjs:10/);
      assert.match(error.message, /late-contract[\s\S]*late\.test\.mjs:20/);
      return true;
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("固定测试超时保留脚本、时限和最后输出，不再误报为普通 SIGTERM", async () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "unified-test-timeout-"));
  const appRoot = path.join(root, "apps", "ai-desktop");
  mkdirSync(appRoot, { recursive: true });
  writeFileSync(path.join(appRoot, "package.json"), JSON.stringify({ scripts: {
    test: "node -e \"console.error('still-running');setInterval(() => {}, 1000)\"",
    "test:interaction": "node -e \"process.exit(0)\"",
    "test:collaboration": "node -e \"process.exit(0)\"",
    "test:managed": "node -e \"process.exit(0)\"",
  }}));
  writeAcceptancePlanCandidate(root);
  const runner = new FixedUnifiedTestRunner({
    sourceProjectRoot: root, applicationName: "ai-desktop", buildRoot: path.join(root, "build"),
    initiatorMemberId: "linghu-ancestor", eventNamespace: "gate", scriptTimeoutMs: 500,
    recordEvent: () => undefined,
    testResources: { run: async (_request, execute) => execute() },
  });
  try {
    await assert.rejects(runner.run(), (error) => {
      assert.equal(error.name, "UnifiedTestAggregateError");
      assert.equal(error.failures[0].script, "test");
      assert.match(error.failures[0].detail, /超过 500ms/);
      assert.match(error.failures[0].detail, /still-running/);
      return true;
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("候选分别缺少每项验收计划能力时固定流程不执行全量测试", async () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "missing-acceptance-capability-"));
  const appRoot = path.join(root, "apps", "ai-desktop");
  mkdirSync(appRoot, { recursive: true });
  writeFileSync(path.join(appRoot, "package.json"), JSON.stringify({ scripts: {
    test: "node -e \"require('fs').writeFileSync('must-not-run','bad')\"",
  }}));
  const state = path.join(root, "apps", "ai-desktop", "electron", "services", "evolution", "internal", "evolution-state.store.ts");
  const runtime = path.join(root, "apps", "ai-desktop", "electron", "services", "workflow", "internal", "evolution", "persona-evolution.runtime.ts");
  const candidates = [
    ["验收计划持久化", () => writeFileSync(state, "reopenCompletedAcceptance acceptance.reopened decideResult(proposalId plan.conditions.find((condition) => condition.conditionId === step.checkId)")],
    ["同专题重开", () => writeFileSync(state, "saveAcceptancePlan acceptance.plan_frozen decideResult(proposalId plan.conditions.find((condition) => condition.conditionId === step.checkId)")],
    ["混合证据汇总", () => writeFileSync(runtime, "if (review.mode === \"mixed\") { const pageCriterionIds = plan.conditions.filter((item) => item.evidenceType === \"page-experience\"); } completeAutomaticAcceptance")],
    ["混合证据汇总", () => writeFileSync(runtime, "if (review.mode === \"mixed\") { runResult = composeHanliResultReview(plan, review, pageRun); } completeAutomaticAcceptance")],
    ["混合证据汇总", () => writeFileSync(runtime, "const pageCriterionIds = plan.conditions.filter((item) => item.evidenceType === \"page-experience\"); runResult = composeHanliResultReview(plan, review, pageRun); completeAutomaticAcceptance")],
    ["自动与人工共用完成门禁", () => writeFileSync(runtime, 'if (review.mode === "mixed") { const pageCriterionIds = plan.conditions.filter((item) => item.evidenceType === "page-experience"); runResult = composeHanliResultReview(plan, review, pageRun); }')],
    ["失败归因", () => writeFileSync(state, "saveAcceptancePlan acceptance.plan_frozen reopenCompletedAcceptance acceptance.reopened decideResult(proposalId")],
  ];
  const events = [];
  let resourceRuns = 0;
  const runner = new FixedUnifiedTestRunner({
    sourceProjectRoot: root, applicationName: "ai-desktop", buildRoot: path.join(root, "build"),
    initiatorMemberId: "linghu-ancestor", eventNamespace: "gate",
    recordEvent: (type, details) => events.push({ type, details }),
    testResources: { run: async (_request, execute) => {
      resourceRuns += 1;
      return execute();
    } },
  });
  try {
    for (const [capability, removeCapability] of candidates) {
      writeAcceptancePlanCandidate(root);
      removeCapability();
      await assert.rejects(runner.run(), new RegExp(capability));
      assert.deepEqual(events, []);
      assert.equal(resourceRuns, 0);
      assert.equal(existsSync(path.join(appRoot, "must-not-run")), false);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
