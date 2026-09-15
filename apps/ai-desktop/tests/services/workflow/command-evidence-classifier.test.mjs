import assert from "node:assert/strict";
import test from "node:test";
import { isReadOnlyInspectionCommand } from "../../../electron/services/support/capabilities/execution/internal/command-evidence.classifier.ts";

test("只读检查缺文件保留为活动事实但不归类为验证失败", () => {
  assert.equal(isReadOnlyInspectionCommand("/bin/zsh -lc 'ls -l electron/missing.ts 2>&1'"), true);
  assert.equal(isReadOnlyInspectionCommand("rg -n 'missing' electron -g '*.ts'"), true);
});

test("测试、类型检查和串联命令失败继续阻断验证", () => {
  assert.equal(isReadOnlyInspectionCommand("npm run test"), false);
  assert.equal(isReadOnlyInspectionCommand("node scripts/run-with-dependencies.mjs tsc -p tsconfig.json --noEmit"), false);
  assert.equal(isReadOnlyInspectionCommand("ls missing && npm run test"), false);
});
