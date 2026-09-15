import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("韩立按条件分区页面体验与代码符合性验收", () => {
  const prompt = readFileSync("prompts/personas/hanli/result-acceptance.md", "utf8");
  assert.match(prompt, /page-experience/);
  assert.match(prompt, /code-conformance/);
  assert.match(prompt, /按每条原始条件选择证据来源/);
  assert.match(prompt, /受控失败、并发或延迟时序、重复触发、路径越界、符号链接、默认应用不可用、定向测试、回归或版本控制证据/);
  assert.match(prompt, /pageCriterionIds/);
  assert.match(prompt, /两组不得重复、不得遗漏/);
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

test("混合运行按条件强制页面截图与代码引用证据", () => {
  const policy = readFileSync("electron/services/personas/hanli/domain/acceptance-run-evidence.policy.ts", "utf8");
  const decision = readFileSync("electron/services/personas/hanli/internal/decision/hanli-decision.service.ts", "utf8");
  const contract = readFileSync("contracts/services/personas/hanli/value/acceptance.value.ts", "utf8");
  const dto = readFileSync("contracts/services/personas/hanli/dto/acceptance-run.out.dto.ts", "utf8");
  const runtime = readFileSync("electron/services/workflow/internal/evolution/persona-evolution.runtime.ts", "utf8");
  assert.match(contract, /"mixed"/);
  assert.match(dto, /evidenceMode: HanliAcceptanceEvidenceModeValue/);
  assert.match(dto, /pageCriterionIds/);
  assert.match(policy, /requiresPageAcceptanceEvidence/);
  assert.match(policy, /evidenceReferences/);
  assert.match(decision, /value\.mode !== "mixed"/);
  assert.match(decision, /codeCriterionIds/);
  assert.match(decision, /layoutStatus: "not-applicable"/);
  assert.match(runtime, /review\.mode === "mixed"/);
  assert.match(runtime, /criterionIds: pageCriterionIds/);
  assert.match(runtime, /mode: "mixed"/);
  const stateStore = readFileSync("electron/services/evolution/internal/evolution-state.store.ts", "utf8");
  assert.match(stateStore, /requiresPageAcceptanceEvidence/);
  assert.match(stateStore, /客户要求与实际代码/);
});

test("混合计划语义错误会在模型重试内返回具体分区原因", () => {
  const decision = readFileSync("electron/services/personas/hanli/internal/decision/hanli-decision.service.ts", "utf8");
  assert.match(decision, /#askForStructuredResult\(prompt, state, \(value\) => this\.#createResultAcceptanceReview/);
  assert.match(decision, /const values = parseJsonObjects\(response\)/);
  assert.match(decision, /for \(const value of values\)/);
  assert.match(decision, /return validate\(value\)/);
  assert.match(decision, /韩立混合验收计划缺少有效且不重复的页面条件编号/);
  assert.match(decision, /请按原始 criterion 编号修正页面与代码条件的完整分区/);
  assert.match(decision, /连续 3 次未返回有效的结果验收判断：\$\{lastError\}/);
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
