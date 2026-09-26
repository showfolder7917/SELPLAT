import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const acceptanceSource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
const acceptanceFacadeSource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.facade.ts", "utf8");
const acceptanceSessionSource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-acceptance-session.facade.ts", "utf8");
const acceptanceEvidenceSource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-acceptance-evidence.facade.ts", "utf8");
const continuationPolicySource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-acceptance-continuation.policy.ts", "utf8");
const acceptancePrompt = readFileSync("prompts/personas/hanli/computer-acceptance.md", "utf8");
const resultAcceptancePrompt = readFileSync("prompts/personas/hanli/result-acceptance.md", "utf8");
const eventMemoryRuleMetadata = readFileSync("ruleengine/rules/local/XUNAN/selplat/应用/ai-desktop/rule/RUL_AIDesktop事件记忆与统一界面规则.md", "utf8");
const eventMemoryRule = readFileSync("ruleengine/rules/local/XUNAN/selplat/应用/ai-desktop/template/RUL_AIDesktop事件记忆与统一界面规则/requirements.md", "utf8");
const aiDesktopRuleIndex = readFileSync("ruleengine/rules/local/XUNAN/selplat/应用/ai-desktop/RULE_INDEX.md", "utf8");
const operationSource = readFileSync("contracts/services/personas/hanli/value/acceptance.value.ts", "utf8");
const goalSource = readFileSync("contracts/services/personas/hanli/dto/computer-acceptance.in.dto.ts", "utf8");
const runtimeSource = readFileSync("electron/services/workflow/internal/evolution/persona-evolution.runtime.ts", "utf8");
const desktopIpcSource = readFileSync("electron/system/ipc/register-desktop-ipc.ts", "utf8");
const mainWindowLayoutSource = readFileSync("electron/system/window/main-window-layout.cts", "utf8");

test("正式窗口销毁后释放验收锁并有界重试，不把旧窗口标记为持续验收", () => {
  assert.match(desktopIpcSource, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/);
  assert.match(desktopIpcSource, /const webContentsId = targetWindow\.webContents\.id;[\s\S]*hanliPageReviewGuard\.begin\(webContentsId\)/);
  assert.match(desktopIpcSource, /finally \{\s*hanliPageReviewGuard\.end\(webContentsId\)/);
  assert.doesNotMatch(desktopIpcSource, /hanliPageReviewGuard\.end\(targetWindow\.webContents\.id\)/);
  assert.match(acceptanceSource, /closed = true;[\s\S]*this\.#active = false/);
});

test("任务卡页面验收使用明确目标、语义导航和页面截图门禁", () => {
  assert.match(goalSource, /taskCollaborationCriterionIds/);
  assert.match(runtimeSource, /taskCollaborationCriterionIds[\s\S]*item\.pageSurface === "task-collaboration"/);
  assert.doesNotMatch(runtimeSource, /requiresTaskCollaborationSurface/);
  assert.match(operationSource, /type: "open-task-panel"[\s\S]*type: "close-task-panel"[\s\S]*type: "open-task-collaboration"/);
  assert.match(acceptanceSource, /taskCollaborationCriterionIds\.has\(criterionId\)[\s\S]*不能由自由讨论页判定产品结果/);
  assert.match(acceptanceSource, /taskCollaborationAction[\s\S]*coveredCriterionIds\.some\(\(criterionId\) => !taskCollaborationCriterionIds\.has\(criterionId\)\)[\s\S]*任务协作群操作只能核对任务卡条件/);
  assert.match(acceptanceSource, /不能由任务协作群页面截图裁决，应先导航到该条件要求的页面/);
  assert.match(acceptanceSource, /navigateTaskCollaboration[\s\S]*button\.section-toggle\[aria-controls="developer-task-list"\][\s\S]*button\.collaboration-task-group-entry/);
  assert.match(acceptanceSource, /async function navigateTaskCollaboration[\s\S]*waitForPanel[\s\S]*task-panel-not-open[\s\S]*task-panel-not-closed[\s\S]*task-group-not-visible/);
  assert.match(acceptanceSource, /taskCollaborationTarget = \{ topicId: goal\.topicId, proposalId: goal\.proposalId \}/);
  assert.match(acceptanceSource, /dataset\.taskCollaborationTopicId === target\.topicId[\s\S]*dataset\.taskCollaborationProposalId === target\.proposalId/);
  assert.match(acceptanceSource, /:scope > \.seldisclosure-content > \.task-timeline-detail-pane/);
  assert.match(acceptanceSource, /attempt < 12[\s\S]*detail-pane-zero-height[\s\S]*task-group-detail-not-ready/);
  assert.doesNotMatch(acceptanceSource, /document\.querySelector<HTMLButtonElement>\("\.task-collaboration-group > \.selui-disclosure-heading/);
  assert.match(acceptanceSource, /return \{ \.\.\.detail, status: detail\.status === "ready" \? "already-visible" : detail\.status/);
  assert.match(acceptanceSource, /return \{ \.\.\.detail, status: detail\.status === "ready" \? "navigated" : detail\.status/);
  assert.match(acceptanceSource, /result\.status !== "task-group-not-visible"[\s\S]*result\.status !== "task-group-detail-not-ready"[\s\S]*result\.status !== "detail-pane-zero-height"/);
  assert.match(acceptanceSource, /taskCollaborationVisible: true/);
  assert.match(mainWindowLayoutSource, /minimum:\s*\{ width: 680, height: 700 \}/);
  assert.match(acceptanceSource, /resize-formal-window[\s\S]*window\.getMinimumSize\(\)[\s\S]*width: minimumWidth, height: minimumHeight/);
  assert.match(acceptanceSource, /resizePreset === "restore"[\s\S]*window\.setBounds\(initialBounds\)/);
  assert.match(acceptanceSource, /仅当本步 criterionIds 包含任务卡条件[\s\S]*no-visible-conversation[\s\S]*韩立人物入口[\s\S]*不发送消息、不修改任务或设置/);
  assert.match(acceptanceSource, /任务卡页面条件只能依据当前截图可见的主卡、交付依据、成员状态和详情面板几何裁决[\s\S]*提交号、内部事件关联、历史批次成因和未来复用行为不是页面条件[\s\S]*不得因这些不可见内部事实报告验收能力受阻/);
  assert.match(acceptanceSource, /currentDelivery 给出当前已验证候选及其门禁，是页面批次判断的唯一基线；旧条件中的批次号不得覆盖它/);
  assert.match(acceptanceSource, /acceptanceRunContext[\s\S]*current-formal-run[\s\S]*不得仅因本轮尚未 finish 或结论尚未写回而判 scenario-precondition[\s\S]*finish\(passed\) 后，系统会立即写入唯一最终结论/);
  const surfaceStart = acceptanceSource.indexOf("function readTaskCollaborationSurface");
  const surfaceEnd = acceptanceSource.indexOf("function navigateTaskCollaboration", surfaceStart);
  const surfaceSource = acceptanceSource.slice(surfaceStart, surfaceEnd);
  assert.match(surfaceSource, /const currentDelivery = \(\(\) => \{[\s\S]*候选批次：[\s\S]*统一测试：[\s\S]*发布：[\s\S]*重启健康：[\s\S]*真实验收：/);
  assert.match(surfaceSource, /\.task-acceptance-summary[\s\S]*acceptanceSummaryVisible[\s\S]*acceptanceSummary:/);
  assert.doesNotMatch(surfaceSource, /readCurrentDeliveryEvidence/);
  assert.match(operationSource, /type: "open-hanli-conversation"/);
  assert.match(acceptanceSource, /async function navigateHanliConversation[\s\S]*task-panel-unavailable[\s\S]*task-panel-not-open/);
  assert.match(acceptanceSource, /button\.section-toggle\[aria-controls="developer-task-list"\]/);
  assert.match(acceptanceSource, /panel\.querySelectorAll[\s\S]*button\.collaboration-member[\s\S]*startsWith\("韩立"\)/);
  assert.match(acceptanceSource, /navigateHanliConversation[\s\S]*requestAnimationFrame[\s\S]*conversation-not-visible/);
  assert.match(acceptanceSource, /open-hanli-conversation[\s\S]*当前正式验收未获韩立会话导航授权[\s\S]*hanliConversation/);
  assert.match(runtimeSource, /item\.evidenceType === "page-experience"[\s\S]*item\.pageSurface === "task-collaboration"/);
  assert.match(runtimeSource, /assertTaskCollaborationCriteriaUseDynamicCandidate\(pageCriteria, pageCriterionIds, taskCollaborationCriterionIds\)/);
  assert.match(runtimeSource, /function assertTaskCollaborationCriteriaUseDynamicCandidate[\s\S]*固定候选批次[\s\S]*当前最新已验证候选/);
  assert.match(acceptanceSource, /所有状态必须来自当前正式业务数据/);
  assert.doesNotMatch(acceptanceSource, /taskCollaborationScenarioTarget|TaskCollaborationScenario/);
  assert.match(acceptanceSource, /#developer-task-list button\.collaboration-member[\s\S]*:scope > span > i[\s\S]*memberStates/);
  assert.doesNotMatch(acceptanceSource, /advance-task-collaboration-scenario/);
});

test("结果验收计划不申请外部进程或桌面权限", () => {
  assert.match(resultAcceptancePrompt, /当前正式应用窗口与运行版本已经由主进程选定/);
  assert.match(resultAcceptancePrompt, /禁止调用 `ps`、shell、exec、osascript、System Events、外部窗口枚举或截图命令/);
  assert.match(resultAcceptancePrompt, /禁止为这些动作申请用户审批/);
  assert.match(resultAcceptancePrompt, /页面条件应进入 pageCriterionIds/);
  assert.match(resultAcceptancePrompt, /pageCriterionSurfaces/);
});

test("初始验收提示词只引用实际注册的交互工具名", () => {
  assert.match(acceptanceSource, /name: "hanli_computer"/);
  assert.match(acceptancePrompt, /调用 `hanli_computer` 的 `observe`/);
  assert.doesNotMatch(acceptancePrompt, /hanli_computer_step/);
});

test("任务协作群滚动只移动详情面板，并等待窄窗口布局回显", () => {
  const scrollStart = acceptanceSource.indexOf("function scrollTaskCollaboration");
  const scrollEnd = acceptanceSource.indexOf("function readTaskCollaborationSurface", scrollStart);
  const scrollSource = acceptanceSource.slice(scrollStart, scrollEnd);
  assert.match(scrollSource, /dataset\.taskCollaborationTopicId === target\.topicId[\s\S]*dataset\.taskCollaborationProposalId === target\.proposalId/);
  assert.match(scrollSource, /:scope > \.seldisclosure-content > \.task-timeline-detail-pane/);
  assert.match(scrollSource, /detail\.scrollTop/);
  assert.match(scrollSource, /pageScrollTop/);
  assert.match(scrollSource, /getBoundingClientRect/);
  assert.doesNotMatch(scrollSource, /offsetParent/);
  assert.doesNotMatch(scrollSource, /page\.scrollTop\s*=/);
  assert.match(scrollSource, /attempt < 12[\s\S]*requestAnimationFrame/);
  assert.match(scrollSource, /detailScrollHeight[\s\S]*detail-pane-zero-height[\s\S]*stableFrames: 12/);
  assert.match(acceptanceSource, /detailPaneConnected[\s\S]*detailPaneVisible[\s\S]*detailPaneSize[\s\S]*detailPaneScrollHeight/);
  assert.match(acceptanceSource, /currentTimelineNode[\s\S]*currentTimelineNodeVisible/);
  assert.match(acceptanceSource, /task-delivery-evidence[\s\S]*deliveryEvidenceVisible[\s\S]*deliveryEvidence:/);
  assert.match(acceptanceSource, /result\.status !== "scrolled" && result\.status !== "at-boundary" && result\.status !== "not-ready" && result\.status !== "detail-pane-zero-height"/);
  assert.match(acceptanceSource, /coversTaskCollaborationCriterion[\s\S]*args\.action === "scroll" \|\| args\.action === "key"[\s\S]*必须使用 scroll-task-collaboration[\s\S]*禁止通用滚动或按键进入历史审计区域/);
  assert.match(acceptanceSource, /任务卡条件只能使用 scroll-task-collaboration[\s\S]*禁止使用通用 scroll 或方向键把视口带入历史审计卡/);
  assert.match(acceptanceSource, /audit-history-not-ready[\s\S]*audit-card-not-ready/);
  assert.match(acceptancePrompt, /成员空闲条件要在同一张任务协作群截图中同时核对 `memberStates`/);
  assert.match(acceptancePrompt, /detail-pane-zero-height[\s\S]*真实页面失败/);
});

test("韩立首项失败后仍须逐项取得本轮全部条件自己的证据", () => {
  assert.match(acceptanceEvidenceSource, /#criterionEvidenceIds = new Map<string, Set<string>>/);
  assert.match(acceptanceSource, /validateCriterionCoverage\(args\.criterionIds, criterionIds, true\)/);
  assert.match(acceptanceSource, /evidence\.hasCriterionEvidence\(criterionId, finding\.evidenceId/);
  assert.match(acceptanceEvidenceSource, /#criterionEvidenceIds\.get\(criterionId\)\?\.has\(id\)/);
  assert.match(acceptanceSource, /记录当前失败后继续执行其余可安全验收条件，再一次提交完整结果/);
  assert.match(acceptancePrompt, /发现某条失败时先保存该条件证据，然后继续执行其余仍可安全检查的条件/);
  assert.match(resultAcceptancePrompt, /发现一项失败后仍继续检查其余条件，最终一次返回完整 findings/);
  assert.match(eventMemoryRule, /criterion_scoped_action_and_screenshot_coverage/);
  assert.match(eventMemoryRule, /first_failure_preserved_then_all_independent_safe_criteria_continue_in_same_round/);
  assert.match(eventMemoryRuleMetadata, /rule_version = 5\.164\.0/);
  assert.match(aiDesktopRuleIndex, /AI_DESKTOP_EVENT_MEMORY_UI_RULES = .*RUL_AIDesktop事件记忆与统一界面规则\.md/);
});

test("被拒绝的 finish 仅允许一次受限纠正回合", () => {
  assert.match(acceptanceSessionSource, /#correctionAttempted = false/);
  assert.match(continuationPolicySource, /!input\.finishRejection \|\| input\.correctionAttempted/);
  assert.match(acceptanceSessionSource, /continuation\?\.kind === "correction"[\s\S]*#correctionAttempted = true/);
  assert.match(acceptanceSource, /仅可补齐原条件证据后重新提交 finish/);
});

test("验收入口通过门面隔离 runner、证据账本与可恢复会话状态", () => {
  assert.match(acceptanceFacadeSource, /class HanliComputerAcceptance[\s\S]*#runner: HanliComputerAcceptanceRunner/);
  assert.match(acceptanceFacadeSource, /return this\.#runner\.run\(goal, window, model, progress, interactions\)/);
  assert.match(acceptanceSource, /new HanliAcceptanceEvidenceFacade\(\)/);
  assert.match(acceptanceSource, /new HanliAcceptanceSessionFacade\(\)/);
  assert.match(acceptanceEvidenceSource, /archiveScreenshot[\s\S]*bindLatestToCriteria[\s\S]*hasCriterionEvidence/);
  assert.match(acceptanceSessionSource, /nextContinuation\(hasArchivedScreenshot/);
  assert.match(eventMemoryRule, /hanli_computer_acceptance_facade_contract = one_public_acceptance_facade/);
  assert.match(eventMemoryRule, /prompt_tool_name_exactly_matches_registered_dynamic_tool/);
});

test("首回合未产生截图时会恢复观察而不是直接结束验收", () => {
  assert.match(continuationPolicySource, /!input\.hasArchivedScreenshot[\s\S]*retry-observation/);
  assert.match(acceptanceSessionSource, /#observationRecoveryAttempted = true/);
  assert.match(acceptanceSource, /首回合未调用窗口工具[\s\S]*重新获取真实截图后完成判断/);
});
