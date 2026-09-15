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
  assert.match(prompt, /criterionCatalog 是页面和代码条件编号的唯一目录/);
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
  const prompt = readFileSync("prompts/personas/hanli/result-acceptance.md", "utf8");
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
  assert.match(runtime, /const verificationEvents = Array\.isArray\(task\.flowEvents\) \? task\.flowEvents : \[\]/);
  assert.match(runtime, /verificationEvidence: verificationEvents/);
  assert.match(runtime, /executor\\\.self_\(test\|repair\)_\(passed\|failed\|completed\)/);
  assert.match(runtime, /event\.type === "unified_test\.passed"/);
  assert.match(runtime, /technicalEvidence: event\.details\?\.technicalEvidence \|\| \[\]/);
  assert.match(runtime, /verificationEvidence: event\.details\?\.verificationEvidence \|\| \[\]/);
  assert.match(runtime, /details: event\.details \|\| null/);
  assert.match(prompt, /verificationEvidence/);
  assert.match(prompt, /scenario、command、status、source 与 completedAt/);
  assert.match(prompt, /统一测试通过.*不能替代/);
  const stateStore = readFileSync("electron/services/evolution/internal/evolution-state.store.ts", "utf8");
  assert.match(stateStore, /requiresPageAcceptanceEvidence/);
  assert.match(stateStore, /客户要求与实际代码/);
});

test("验收受阻先经唯一分类策略，再决定产品修复或可恢复重跑", () => {
  const classification = readFileSync("electron/services/workflow/domain/acceptance-result-classification.policy.ts", "utf8");
  const runtime = readFileSync("electron/services/workflow/internal/evolution/persona-evolution.runtime.ts", "utf8");
  const computer = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
  assert.match(classification, /product-or-safety-failure/);
  assert.match(classification, /materials-insufficient-main-path-judged/);
  assert.match(classification, /acceptance-capability-or-runtime-blocked/);
  assert.match(classification, /blockerKind === "materials-insufficient"/);
  assert.match(computer, /真实页面或安全不符合时必须使用 failed/);
  assert.match(runtime, /const classification = classifyAcceptanceRun\(runResult\)/);
  assert.match(runtime, /classification\.disposition === "materials-insufficient-main-path-judged"/);
  assert.match(runtime, /classification\.disposition === "acceptance-capability-or-runtime-blocked"/);
  assert.doesNotMatch(runtime, /if \(runResult\.status === "blocked"\)/);
});

test("受控测试结论和任务协作群检查保留验收边界", () => {
  const codexContracts = readFileSync("contracts/services/support/platform/codex/index.ts", "utf8");
  const runner = readFileSync("electron/services/support/capabilities/testing/internal/task-worktree-test.runner.ts", "utf8");
  const unifiedRunner = readFileSync("electron/services/support/capabilities/testing/internal/fixed-unified-test.runner.ts", "utf8");
  const workflow = readFileSync("electron/services/workflow/collaboration-workflow.facade.ts", "utf8");
  const pipeline = readFileSync("electron/services/support/capabilities/release/internal/version-integration.pipeline.ts", "utf8");
  const computer = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
  assert.match(runner, /source: "task-worktree-test-runner"/);
  assert.match(runner, /verificationEvidence:/);
  assert.match(runner, /const validationRound = scriptIndex \+ 1/);
  assert.match(workflow, /evidence\.source === "task-worktree-test-runner"/);
  assert.match(workflow, /verificationEvidence,/);
  assert.match(unifiedRunner, /export interface FixedUnifiedTestRunResult/);
  assert.match(codexContracts, /ManagedExecutionVerificationEvidenceOutDto/);
  assert.match(unifiedRunner, /source: "fixed-unified-test-runner"/);
  assert.match(unifiedRunner, /return \{ executable: resolveVerifiedDeveloperExecutable\(buildRoot\), verificationEvidence \}/);
  assert.match(pipeline, /verificationEvidence = verifiedCandidate\.verificationEvidence/);
  assert.match(pipeline, /appendFlow\(task, "unified_test\.passed"[\s\S]*verificationEvidence,/);
  assert.match(computer, /必须先按截图点击既有安全导航进入任务协作群/);
  assert.match(computer, /只有导航后仍不可见时才记录 hidden/);
});

test("验收交接把固定混合摘要与折叠技术详情分开投影", () => {
  const handoff = readFileSync("electron/services/workflow/internal/acceptance/acceptance-handoff.service.ts", "utf8");
  const runtime = readFileSync("electron/services/workflow/internal/evolution/persona-evolution.runtime.ts", "utf8");
  assert.match(handoff, /export interface AcceptanceHandoffContent/);
  assert.match(handoff, /summary: handoff\.summary/);
  assert.match(handoff, /content: handoff\.content/);
  assert.match(handoff, /detail: handoff\.detail/);
  assert.match(runtime, /混合验收没有同时满足页面条件与代码符合性条件/);
  assert.match(runtime, /detail: failureMessage/);
});

test("混合计划语义错误会在模型重试内返回具体分区原因", () => {
  const decision = readFileSync("electron/services/personas/hanli/internal/decision/hanli-decision.service.ts", "utf8");
  assert.match(decision, /#askForStructuredResult\(prompt, state, \(value\) => this\.#createResultAcceptanceReview/);
  assert.match(decision, /const values = parseJsonObjects\(response\)/);
  assert.match(decision, /for \(const value of values\)/);
  assert.match(decision, /return validate\(value\)/);
  assert.match(decision, /只从顶层对象起点开始，避免 findings 等嵌套对象覆盖外层验收结论/);
  assert.match(decision, /if \(depth === 0\) start = index/);
  assert.match(decision, /hasUnclosedObject: depth !== 0/);
  assert.match(decision, /pageCriterionIds 必须是全部 criterion 编号的非空严格子集/);
  assert.match(decision, /mode 只能是 page-experience、code-conformance 或 mixed/);
  assert.match(decision, /pageCriterionIdsValidationResult/);
  assert.match(decision, /if \(!pageCriterionIdsResult\.ok\)/);
  assert.match(decision, /const pageCriterionIds = pageCriterionIdsResult\.pageCriterionIds/);
  assert.match(decision, /韩立混合验收计划页面条件编号/);
  assert.match(decision, /移除非字符串项、重复项和当前条件外编号/);
  assert.match(decision, /pageCriterionIds=\$\{pageCriterionIds\}/);
  assert.match(decision, /请按原始 criterion 编号修正页面与代码条件的完整分区/);
  assert.match(decision, /连续 3 次未返回有效的结果验收判断：\$\{lastError\}/);
});

test("结果验收在独立短会话中重试，不重置客户韩立对话", () => {
  const runtime = readFileSync("electron/system/bootstrap/application-runtime.ts", "utf8");
  const decision = readFileSync("electron/services/personas/hanli/internal/decision/hanli-decision.service.ts", "utf8");
  assert.match(runtime, /createSqliteCodexSessionRepository\(aiMemoryDatabase, "hanli-result-acceptance"\)/);
  assert.match(runtime, /askHanliResultAcceptance: async/);
  assert.match(runtime, /await acceptanceCodex\.newChat\(\)/);
  assert.match(decision, /askHanliResultAcceptance\(request, state\)/);
  assert.match(decision, /#askForStructuredDecision[\s\S]*?askHanli\(request, state\)/);
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
