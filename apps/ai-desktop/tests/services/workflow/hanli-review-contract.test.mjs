import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { build } from "esbuild";

const prompt = readFileSync("prompts/personas/hanli/result-acceptance.md", "utf8");
const computerPrompt = readFileSync("prompts/personas/hanli/computer-acceptance.md", "utf8");
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
  assert.match(coordinator, /sourceEvidenceStatus: sourceEvidence\.status/);
  assert.match(prompt, /sourceEvidence` 是唯一已授权、去重后的源码片段/);
  assert.match(prompt, /sourceEvidenceStatus=available/);
});

test("成员均 idle 的原条件仍归任务协作群同屏验收", () => {
  assert.match(runtime, /成员\.\*\(\?:空闲\|idle\)/u);
  assert.match(runtime, /\(\?:空闲\|idle\)\.\*成员/u);
  assert.match(computer, /taskCollaborationCriterionIds\.has\(criterionId\)/u);
});

test("源码审查证据覆盖同提案已集成原任务与修复任务，不读取测试或越界文件", async () => {
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
  assert.equal(context.sourceEvidenceScope, "integrated-proposal-task-files-and-two-level-relative-imports");
  const sourceFiles = context.sourceEvidence.map((item) => item.file);
  assert.ok(sourceFiles.includes("apps/ai-desktop/electron/services/workflow/domain/current-topic-stage.projection.ts"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/electron/services/workflow/domain/current-topic-technical-recovery.projection.ts"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/electron/services/workflow/internal/acceptance/hanli-result-review.coordinator.ts"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/electron/services/workflow/domain/current-topic-read-recovery.ts"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/src/features/collaboration/components/TaskCollaborationGroup/TaskTimelineNode.tsx"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/src/features/collaboration/components/TaskCollaborationGroup/TaskGroupAuditCard.tsx"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/src/features/collaboration/components/TaskCollaborationGroup/TaskGroupAcceptanceEvidence.tsx"));
  assert.ok(sourceFiles.includes("apps/ai-desktop/src/features/collaboration/components/TaskCollaborationGroup/timeline-display.ts"));
  assert.ok(sourceFiles.every((file) => file.startsWith("apps/ai-desktop/") && !/(?:^|\/)(?:tests?|__tests__)\//u.test(file)));
  assert.match(context.sourceEvidence[0].content, /currentTopicStage|CurrentTopicStage/u);
  assert.match(context.sourceEvidence[0].content, /projectCurrentTechnicalRecovery/u);
  const technicalSource = context.sourceEvidence.find((item) => item.file.endsWith("/current-topic-technical-recovery.projection.ts"))?.content || "";
  assert.match(technicalSource, /const systemOnlyAcceptanceRetry/u);
  assert.match(technicalSource, /recovery\.occurrences/u);
  assert.doesNotMatch(context.sourceEvidence[0].content, /源码中段省略/u);
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

test("冻结的当前验收计划必须逐项复用且不得在结果审查时重新分区", () => {
  assert.match(prompt, /acceptancePlan\.version 为 2/);
  assert.match(prompt, /必须逐项照用其中的 evidenceType/);
  assert.match(prompt, /findings 必须逐项覆盖其余 code-conformance 条件/);
  assert.match(prompt, /不存在 page-experience 条件时返回 code-conformance/);
  assert.match(decision, /acceptancePlan 已存在时必须保持其 evidenceType 分区/);
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
