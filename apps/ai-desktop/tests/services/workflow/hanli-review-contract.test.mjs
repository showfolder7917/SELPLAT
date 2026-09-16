import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const prompt = readFileSync("prompts/personas/hanli/result-acceptance.md", "utf8");
const computer = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
const runtime = readFileSync("electron/services/workflow/internal/evolution/persona-evolution.runtime.ts", "utf8");
const decision = readFileSync("electron/services/personas/hanli/internal/decision/hanli-decision.service.ts", "utf8");
const coordinator = readFileSync("electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts", "utf8");

test("韩立固定审查正式页面与源码结构", () => {
  assert.match(prompt, /普通客户/);
  assert.match(prompt, /高内聚、低耦合并且便于新手阅读/);
  assert.match(prompt, /统一测试、异常边界和工程门禁由令狐负责/);
  assert.match(prompt, /无论哪种模式，都必须返回 sourceReview/);
  assert.match(decision, /韩立缺少独立的源码结构与新手可读性审查结论/);
  assert.match(runtime, /composeHanliResultReview\(plan, review, pageRun\)/);
  assert.match(coordinator, /sourceReview: sourceRun\.sourceReview/);
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

test("正式页面截图同时携带客户可见语义和布局边界", () => {
  assert.match(computer, /pageEvidence = await window\.webContents\.executeJavaScript/);
  assert.match(computer, /source: "customer-visible-renderer"/);
  assert.match(computer, /querySelectorAll<HTMLElement>\("\.selconversation-message"\)/);
  assert.match(computer, /atBottom: maxScrollTop - timeline\.scrollTop <= 2/);
  assert.match(computer, /lastMessageComposerOverlap/);
  assert.doesNotMatch(computer, /pageEvidence[\s\S]{0,300}(workflow|timelineNode|taskId|localStorage)/);
});

test("需要发送或创建数据的条件归令狐证据而不是韩立正式页面操作", () => {
  assert.match(prompt, /必须发送消息、新建或重建会话、创建样本或测试数据/);
  assert.match(prompt, /必须进入 code-conformance/);
  assert.match(prompt, /不得因为条件描述了页面结果，就要求韩立在正式软件中制造该结果/);
  assert.match(prompt, /不得创建、重建或恢复任何已退役的隔离验收环境/);
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
  assert.match(appRuntime, /createSqliteCodexSessionRepository\(aiMemoryDatabase, "hanli-result-acceptance"\)/);
  assert.match(appRuntime, /await acceptanceCodex\.newChat\(\)/);
});
