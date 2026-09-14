import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("韩立结果验收只保留页面体验与代码符合性两种方式", () => {
  const prompt = readFileSync("prompts/personas/hanli/result-acceptance.md", "utf8");
  assert.match(prompt, /page-experience/);
  assert.match(prompt, /code-conformance/);
  assert.match(prompt, /不涉及页面体验/);
  assert.match(prompt, /实现是否符合客户原要求/);
  assert.match(prompt, /不得启动隔离环境/);
});

test("页面验收使用当前正式窗口并保持业务写入授权门", () => {
  const ipc = readFileSync("electron/system/ipc/register-desktop-ipc.ts", "utf8");
  const authorization = readFileSync("electron/system/ipc/hanli-page-acceptance-authorization.ts", "utf8");
  assert.match(ipc, /getTitle\(\) === "AI Desktop"/);
  assert.match(ipc, /hanliPageAcceptanceAuthorization\.begin/);
  assert.match(ipc, /action === "persona-navigation"/);
  assert.match(authorization, /只允许读取和安全导航/);
  assert.doesNotMatch(ipc, /planAcceptanceScene|WorkspaceAcceptanceFixture|runHanliAcceptanceSceneSession/);
});

test("非页面审查证据不要求截图或布局", () => {
  const policy = readFileSync("electron/services/personas/hanli/domain/acceptance-run-evidence.policy.ts", "utf8");
  const decision = readFileSync("electron/services/personas/hanli/internal/decision/hanli-decision.service.ts", "utf8");
  assert.match(policy, /run\.mode === "code-conformance"/);
  assert.match(policy, /evidenceReferences/);
  assert.match(decision, /layoutStatus: "not-applicable"/);
  assert.match(decision, /evidenceReferences/);
});

test("旧隔离入口与场景提示已从产品清单移除", () => {
  const manifest = JSON.parse(readFileSync("prompts/manifest.json", "utf8"));
  assert.equal(manifest.prompts.some((item) => item.id === "hanli.acceptance-scene"), false);
  assert.equal(manifest.prompts.some((item) => item.id === "hanli.result-acceptance"), true);
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(packageJson.scripts["start:isolated-acceptance"], undefined);
  const executor = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
  const workspaceIpc = readFileSync("electron/system/ipc/domains/register-workspace-ipc.ts", "utf8");
  assert.doesNotMatch(executor, /WorkspaceAcceptance|send-test-message|send-test-screenshot|scroll-workspace-tree|inspect-workspace-directory-read/);
  assert.doesNotMatch(workspaceIpc, /WorkspaceAcceptanceFixture|hanli-acceptance-fixture|acceptanceFixture/);
});
