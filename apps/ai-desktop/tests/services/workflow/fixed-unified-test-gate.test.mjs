import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { controlledTestRoot } from "#test-paths";
import { FixedUnifiedTestRunner } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/testing/internal/fixed-unified-test.runner.js";

test("全量测试失败时固定流程保留失败证据且不进入后续验证或发布", async () => {
  mkdirSync(controlledTestRoot, { recursive: true });
  const root = mkdtempSync(path.join(controlledTestRoot, "full-test-gate-"));
  const appRoot = path.join(root, "apps", "ai-desktop");
  mkdirSync(appRoot, { recursive: true });
  writeFileSync(path.join(appRoot, "package.json"), JSON.stringify({ scripts: {
    test: "node -e \"console.error('full-suite-regression');process.exit(17)\"",
    "test:interaction": "node -e \"require('fs').writeFileSync('should-not-run','bad')\"",
  }}));
  const events = [];
  const runner = new FixedUnifiedTestRunner({
    sourceProjectRoot: root, applicationName: "ai-desktop", buildRoot: path.join(root, "build"),
    initiatorMemberId: "linghu-ancestor", eventNamespace: "gate",
    recordEvent: (type, details) => events.push({ type, details }),
    testResources: { run: async (_request, execute) => execute() },
  });
  try {
    await assert.rejects(runner.run(), /full-suite-regression/);
    assert.deepEqual(events.map(({type,details}) => [type,details.script]),
      [["gate.unified_test.started","test"],["gate.unified_test.failed","test"]]);
    assert.equal(existsSync(path.join(appRoot, "should-not-run")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
