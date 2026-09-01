const { contextBridge, ipcRenderer } = require("electron");

// 沙箱 preload 不能加载 node:path；主进程先解析真实工程根，再通过隔离测试环境传入纯字符串。
const projectRoot = process.env.AI_DESKTOP_INTERACTION_PROJECT_ROOT;
if (!projectRoot) throw new Error("交互测试缺少工程根。 ");
const linghuDefault = JSON.parse(process.env.AI_DESKTOP_INTERACTION_LINGHU_DEFAULT || "null");
if (!linghuDefault?.title || !linghuDefault?.content) throw new Error("交互测试缺少生产令狐默认文案。 ");
const workspace = {
  primaryId: "interaction-root",
  roots: [{ id: "interaction-root", name: "SELPLAT", path: projectRoot, permission: "workspace-write" }],
};
let harnessStatus = {
  connected: true,
  account: { authenticated: true, authMode: "test", email: "interaction@test.invalid", planType: "test", requiresOpenaiAuth: false },
  error: null,
  runtime: { source: "bundled", version: "0.149.0" },
};
let desktopSettings = { locale: "zh-CN", sandboxMode: "workspace-write", defaultModel: "gpt-5.6-terra", reasoningEffort: "medium", serviceTier: "default", codexAppCorpusIngestionEnabled: false };
let pendingUserInput = null;
let finishManagedTurn = null;
let clarificationAnswers = {};
let activeThreadId = "interaction-thread";
let screenRecordingSettingsOpened = false;
let dispatchState = { activeTask: null, queue: [] };
const dispatchListeners = new Set();
const streamListeners = new Set();
const collaborationStateListeners = new Set();
const collaborationStreamListeners = new Set();
const collaborationTimelineListeners = new Set();
const linghuAutomationListeners = new Set();
const nangongEvolutionListeners = new Set();
const evolutionWorkbenchChangeListeners = new Set();
const evolutionWorkbenchPreferences = new Map();
let nangongNewConversationCalls = 0;
let taskTimelineFixtureEnabled = false;
const collaborationNames = ["韩立", "南宫婉", "令狐老祖", "紫灵", "元瑶", "宋玉", "冰魄仙子", "墨彩环", "墨大夫", "厉飞雨", "张铁", "李化元"];
let collaborationState = {
  version: 1,
  mode: "single-conversation",
  selectedMemberId: "han-li",
  members: collaborationNames.map((displayName, index) => ({
    memberId: index === 0 ? "han-li" : displayName === "南宫婉" ? "nangong-wan" : displayName === "令狐老祖" ? "linghu-ancestor" : `isolated-member-${index}`,
    displayName,
    kind: index === 0 ? "conversation-owner" : "worker",
    protected: index === 0 || displayName === "令狐老祖",
    enabled: true,
    state: index === 0 ? "conversation" : "idle",
    role: index === 0 ? "conversation" : null,
    phase: null,
    generation: index === 0 ? 1 : 0,
    currentTaskId: null,
    blockingReason: null,
    lastHeartbeatAt: null,
    lastProtocolProgressAt: null,
    lastAssignedAt: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  })),
  tasks: [],
  integrationBatches: [],
  nextIntegrationGeneration: 1,
  updatedAt: "2026-08-23T00:00:00.000Z",
};
let linghuAutomationState = {
  version: 2,
  enabled: false,
  pollIntervalMs: 30000,
  cycle: 1,
  currentModule: "flow-completion",
  activePromptId: "linghu-default-flow-guardian",
  activeTaskId: null,
  pendingRepairProposalId: null,
  recoveryAttemptCount: 0,
  currentFaultFingerprint: null,
  recoveryAttemptsByFingerprint: {},
  detectionCursor: null,
  flowSnapshots: [],
  testResourceState: null,
  recoveryCheckpoint: null,
  lastDispatchAt: null,
  lastCompletedAt: null,
  lastCheckedAt: "2026-08-23T00:00:00.000Z",
  blockingReason: "自动执行已关闭",
  lastFeedback: null,
  lastModuleReport: null,
  prompts: [{ promptId: "linghu-default-flow-guardian", title: linghuDefault.title, content: linghuDefault.content, enabled: true, createdAt: "2026-08-23T00:00:00.000Z", updatedAt: "2026-08-23T00:00:00.000Z" }],
  updatedAt: "2026-08-23T00:00:00.000Z",
};
let evolutionState = { version: 8, automaticEvolutionEnabled: false, automaticNangongApprovalEnabled: false, automaticLinghuApprovalEnabled: false, automaticExecutionEnabled: false, automationSettings: { maxRoundsPerTopic: 5, maxCorrectionRounds: 5 }, automationRuntime: { status: "idle", completedRounds: 0, correctionRounds: 0, stopReason: null, startedAt: null, pausedAt: null }, oneShotConfirmation: null, oneShotRun: null, automationContext: { workspaceState: null, locale: "zh-CN" }, preferenceSnapshotVersion: 0, activeTopicId: null, topics: [], proposals: [], deliberations: [], archiveRecords: [], conversation: { conversationId: "nangong-conversation-isolated", messages: [], updatedAt: "2026-08-24T00:00:00.000Z" }, updatedAt: "2026-08-24T00:00:00.000Z" };
const publishNangongEvolution = (reason) => {
  const previousStateVersion = evolutionState.updatedAt;
  evolutionState.updatedAt = new Date().toISOString();
  const event = { state: structuredClone(evolutionState), reason, topicId: evolutionState.activeTopicId, proposalId: null };
  const workbenchChange = { entityType: reason.startsWith("automation.") ? "automation" : reason.startsWith("conversation.") ? "conversation" : "topic", entityId: evolutionState.activeTopicId || evolutionState.conversation.conversationId, topicId: evolutionState.activeTopicId, proposalId: null, reason, previousState: null, currentState: evolutionState.topics.find((item) => item.topicId === evolutionState.activeTopicId)?.status || null, currentStage: null, currentOwner: null, blockingReason: null, nextAction: null, previousStateVersion, stateVersion: evolutionState.updatedAt, updatedAt: evolutionState.updatedAt, affectedViews: ["topics", "deliberations", "pending-approvals", "approvals", "proposals", "tasks", "releases", "archives", "automation-runs", "recovery", "exceptions"] };
  for (const listener of evolutionWorkbenchChangeListeners) listener(structuredClone(workbenchChange));
  for (const listener of nangongEvolutionListeners) listener(event);
  return event.state;
};
const assertEvolutionMutation = (request) => {
  if (!request?.idempotencyKey || request.expectedStateVersion !== evolutionState.updatedAt) throw new Error("状态已更新，请重新确认后再执行。");
};
const createInteractionTopic = (request, evidence) => {
  const now = new Date().toISOString();
  const topicId = `interaction-topic-${Date.now()}`;
  evolutionState.topics.push({ topicId, title: request.title, goal: request.goal, scope: request.scope, exclusions: request.exclusions || [], evidence, acceptanceCriteria: request.acceptanceCriteria, workspaceState: request.workspaceState, locale: request.locale, origin: "nangong", sourceConversationMessageIds: evolutionState.conversation.messages.map((item) => item.messageId), deliberationId: null, continuationOfTopicId: null, nextTopicId: null, seriesId: topicId, roundNumber: 1, status: "registered", topicRevision: 1, currentProposalVersion: 0, recoveryPoint: "topic-registered", createdAt: now, updatedAt: now });
  evolutionState.archiveRecords.push({ recordId: `interaction-topic-created-${Date.now()}`, deliberationId: null, topicId, proposalId: null, taskId: null, sequenceNumber: 1, category: "topic", eventType: "topic.created", actor: "nangong-wan", title: "南宫婉已登记专题", payload: { status: "registered", nextOwner: "nangong-wan" }, occurredAt: now });
  evolutionState.activeTopicId = topicId;
  return publishNangongEvolution("topic.created");
};
const createCompletedEvolutionTask = (proposal) => {
  const now = new Date().toISOString();
  return {
    taskId: `interaction-evolution-task-${Date.now()}`, taskRevision: 1, state: "integrated", phase: "ready", evolutionProposalId: proposal.proposalId,
    initiator: { memberId: "nangong-wan", displayName: "南宫婉" },
    snapshot: { title: proposal.title, problemStatement: "演化课题等待执行。", confirmedIntent: proposal.content, constraints: [], acceptanceCriteria: proposal.acceptanceCriteria, sourceMessageIds: [], attachmentIds: [], workspaceState: workspace, locale: "zh-CN", contentHash: "interaction-evolution" },
    executionRecords: [{ assignmentId: "interaction-evolution-assignment", executor: { memberId: "isolated-member-4", displayName: "宋玉" }, workerGeneration: 1, status: "code-verified", assignedAt: now, executionStartedAt: now, completedAt: now, transferFromAssignmentId: null, handoffType: "initial", result: "演化任务已完成", blockingReason: null, changedFiles: ["apps/ai-desktop/src/applications/developer/DeveloperApplication.tsx"] }],
    resultSummary: { outcome: "succeeded", finalResult: "南宫婉提案已经审批、分发并完成。", originalProblem: "演化方向尚未进入执行链路。", solvedProblem: "提案已通过韩立审批并形成可审计完成记录。", changes: "完成课题、提案、审批、分发和归档链路。", remaining: "无已知遗留内容。", success: true, generatedAt: now },
    finalResult: "南宫婉提案已经审批、分发并完成。", startedAt: now, createdAt: now, updatedAt: now, completedAt: now,
  };
};
const publishLinghuAutomation = (reason) => {
  linghuAutomationState.updatedAt = new Date().toISOString();
  const event = { state: structuredClone(linghuAutomationState), reason };
  for (const listener of linghuAutomationListeners) listener(event);
  return event.state;
};
const publishCollaborationState = (reason) => {
  const copy = structuredClone(collaborationState);
  const taskIds = copy.tasks.map((task) => task.taskId);
  for (const listener of collaborationStateListeners) listener({ state: copy, reason, taskIds });
  return copy;
};
const publishCollaborationTimelineChanged = () => {
  const event = { committedAt: new Date().toISOString(), groupIds: ["topic:interaction-timeline"], groupVersions: { "topic:interaction-timeline": 1 } };
  for (const listener of collaborationTimelineListeners) listener(structuredClone(event));
};
const interactionTimelineSnapshot = () => {
  if (!taskTimelineFixtureEnabled) return { version: 1, groups: [], updatedAt: evolutionState.updatedAt };
  const proposal = evolutionState.proposals.find((item) => item.proposalId === "interaction-timeline-proposal");
  if (!proposal) return { version: 1, groups: [], updatedAt: evolutionState.updatedAt };
  const pending = proposal.status === "pending-approval";
  const startedAt = proposal.createdAt;
  const nodes = [{
    nodeId: `proposal:${proposal.proposalId}`, taskId: null, kind: "approval-application",
    actor: { memberId: "nangong-wan", displayName: "南宫婉" }, recipients: [{ memberId: "han-li", displayName: "韩立" }],
    status: pending ? "current" : "completed", action: "审批申请", summary: proposal.content, content: proposal.content,
    detail: "保留截图、附件和发送流程；统一主会话与南宫婉会话的验收范围。", startedAt,
    completedAt: pending ? null : proposal.updatedAt, durationMs: pending ? 360_000 : 420_000,
    automaticOpen: pending, manualApprovalProposalId: pending ? proposal.proposalId : null,
  }];
  if (!pending) {
    const approval = proposal.approvals.at(-1);
    nodes.push({
      nodeId: `approval:${approval.approvalId}`, taskId: null, kind: "approval-decision",
      actor: { memberId: "han-li", displayName: "韩立" }, recipients: [{ memberId: "nangong-wan", displayName: "南宫婉" }],
      status: approval.decision === "approved" ? "completed" : "failed", action: approval.decision === "approved" ? "审批通过" : approval.decision === "supplement-required" ? "审批退回补充" : "审批驳回",
      summary: approval.advice, content: approval.advice, detail: "人工审批结论已写入统一时间线。", startedAt: approval.createdAt,
      completedAt: approval.createdAt, durationMs: 472_000, automaticOpen: false, manualApprovalProposalId: null,
    });
    if (approval.decision !== "approved") {
      nodes.push({
        nodeId: `supplement:${proposal.proposalId}`, taskId: null, kind: "analysis",
        actor: { memberId: "nangong-wan", displayName: "南宫婉" }, recipients: [{ memberId: "han-li", displayName: "韩立" }],
        status: "current", action: "正在补充审批材料", summary: `根据韩立的退回原因补充方案：${approval.advice}`,
        content: approval.advice, detail: approval.advice, startedAt: approval.createdAt, completedAt: null,
        durationMs: 15_000, automaticOpen: true, manualApprovalProposalId: null,
      });
    } else {
      const people = collaborationState.members.slice(2, 12);
      nodes.push({
        nodeId: "distribution:interaction-timeline-proposal", taskId: null, kind: "distribution",
        actor: { memberId: "nangong-wan", displayName: "南宫婉" }, recipients: people.map(({ memberId, displayName }) => ({ memberId, displayName })),
        status: "completed", action: "任务分发", summary: "并行分发实现、验证与异常捕捉任务。",
        content: "完成时间线接口、人物节点、手动审批、流式内容与统一异常日志；包含审批退回后的补充细节。",
        detail: people.map((person, index) => `${person.displayName}：并行子任务 ${index + 1}`).join("\n"), startedAt: approval.createdAt,
        completedAt: approval.createdAt, durationMs: 78_000, automaticOpen: false, manualApprovalProposalId: null,
      });
      people.forEach((person, index) => nodes.push({
        nodeId: `task:interaction-parallel-${index}`, taskId: `interaction-parallel-${index}`,
        kind: index % 3 === 0 ? "verification" : index === 8 ? "analysis" : "execution",
        actor: { memberId: person.memberId, displayName: person.displayName }, recipients: [{ memberId: "nangong-wan", displayName: "南宫婉" }],
        status: index < 2 ? "current" : index < 8 ? "completed" : "waiting",
        action: index < 2 ? (index === 0 ? "当前正在验证" : "当前正在执行") : index < 8 ? "执行完成" : "等待接手",
        summary: index === 0 ? "正在验证任务协作群的审批按钮、布局和多人流程。" : `并行子任务 ${index + 1} 的自然语言摘要。`,
        content: index === 0 ? "当前正在验证审批申请、人工审批窗口、十人顺序布局和所有展开按钮。" : `正在处理第 ${index + 1} 项任务，输出按流式内容持续追加。`,
        detail: `原始步骤 ${index + 1}\n文件变化与技术证据均保留在折叠详情。`, startedAt: new Date(Date.parse(approval.createdAt) + index * 1_000).toISOString(),
        completedAt: index >= 2 && index < 8 ? new Date(Date.parse(approval.createdAt) + (index + 2) * 60_000).toISOString() : null,
        durationMs: (index + 1) * 60_000, automaticOpen: index < 2, manualApprovalProposalId: null,
      }));
    }
  }
  for (const node of nodes) {
    node.eventType ||= `interaction.${node.kind}`;
    node.contentRole ||= node.kind === "approval-application" ? "approval-content"
      : node.kind === "approval-decision" ? "approval-reason"
        : node.kind === "distribution" ? "task-content"
          : node.kind === "verification" ? "verification-output"
            : node.kind === "execution" ? "execution-output" : "analysis-output";
    node.detailRole ||= node.kind === "approval-application" ? "application-evidence"
      : node.kind === "approval-decision" ? "approval-scope"
        : node.kind === "distribution" ? "task-breakdown"
          : node.kind === "verification" ? "verification-evidence" : "changed-files";
  }
  const currentCount = nodes.filter((node) => node.status === "current").length;
  return { version: 1, groups: [{
    groupId: "topic:interaction-timeline", topicId: "interaction-timeline", proposalId: proposal.proposalId,
    title: "专题任务 01 · 修订截图按钮可用态", status: pending ? "waiting-approval" : proposal.status === "approved" ? "running" : "running",
    summary: pending ? proposal.content : "多人并行执行与验证正在按时间顺序推进。", nodes,
    executingCount: nodes.filter((node) => node.kind === "execution" && node.status === "current").length,
    verifyingCount: nodes.filter((node) => node.kind === "verification" && node.status === "current").length,
    waitingCount: nodes.filter((node) => node.status === "waiting").length, completedCount: nodes.filter((node) => node.status === "completed").length,
    startedAt, updatedAt: evolutionState.updatedAt, durationMs: 2_160_000,
    nextStep: pending ? "韩立审批 · 等待中" : proposal.status !== "approved" ? "南宫婉 · 正在补充审批材料" : currentCount ? `结果汇总与验收 · 等待 ${currentCount} 个节点完成` : "结果汇总与验收 · 等待中",
  }], updatedAt: evolutionState.updatedAt };
};
const publishDispatchState = () => {
  const copy = structuredClone(dispatchState);
  for (const listener of dispatchListeners) listener(copy);
  return copy;
};
const emitStreamEvent = async (event) => {
  for (const listener of streamListeners) listener(structuredClone(event));
  await new Promise((resolve) => setTimeout(resolve, 20));
};
const readInteractionAiMemoryDatabaseStatus = () => {
  const state = new URLSearchParams(globalThis.location.search).get("interactionAiMemoryState");
  return state === "recovery-required"
    ? { state, schemaVersion: null, message: "已初始化的 AI Memory 数据库丢失，请先恢复原文件。" }
    : { state: "ready", schemaVersion: "1000", message: null };
};

// 隔离测试只提供界面渲染需要的确定性数据，不连接真实 Harness、账号、文件选择器或屏幕权限。
contextBridge.exposeInMainWorld("desktop", {
  getEnvironment: async () => ({ projectRoot, platform: process.platform, variant: "developer" }),
  getAiMemoryDatabaseStatus: async () => ({ ...readInteractionAiMemoryDatabaseStatus() }),
  clearTestData: async () => { document.documentElement.dataset.interactionTestDataReset = "true"; return { cleared: true, clearedRecordCount: 42, clearedCandidateBranchCount: 0, clearedCandidateWorktreeCount: 0, candidateCleanupWarnings: [], restartScheduled: true }; },
  getCorpusSemanticBackfillStatus: async () => ({ state: "idle", targetCount: 0, discoveredCount: 0, processedCount: 0, insertedCount: 0, failedCount: 0, message: null, startedAt: null, completedAt: null }),
  startCorpusSemanticBackfill: async () => ({ state: "completed", targetCount: 2, discoveredCount: 2, processedCount: 2, insertedCount: 2, failedCount: 0, message: "补齐完成：新增 2 条 AI 摘要。", startedAt: "2026-08-28T00:00:00.000Z", completedAt: "2026-08-28T00:00:01.000Z" }),
  getSettings: async () => ({ ...desktopSettings }),
  updateSettings: async (settings) => { desktopSettings = { ...desktopSettings, ...settings }; return { ...desktopSettings }; },
  getCodexModels: async () => ({ models: [
    { id: "gpt-5.6-sol", displayName: "5.6 Sol", provider: "OpenAI", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"], supportedServiceTiers: ["default", "fast"], defaultReasoningEffort: "medium", isDefault: false },
    { id: "gpt-5.6-terra", displayName: "5.6 Terra", provider: "OpenAI", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"], supportedServiceTiers: ["default", "fast"], defaultReasoningEffort: "medium", isDefault: true },
  ] }),
  getWorkspaces: async () => workspace,
  addWorkspace: async () => workspace,
  updateWorkspacePermission: async () => workspace,
  setPrimaryWorkspace: async () => workspace,
  removeWorkspace: async () => workspace,
  listWorkspaceEntries: async () => [
    { name: "docs", kind: "directory" },
    { name: "gradle", kind: "directory" },
    { name: "log", kind: "directory" },
    { name: "OPTION", kind: "directory" },
    { name: "scripts", kind: "directory" },
    { name: "shared", kind: "directory" },
  ],
  getCodexStatus: async () => harnessStatus,
  setInteractionAuthenticated: async (authenticated) => {
    harnessStatus = {
      ...harnessStatus,
      account: authenticated
        ? { authenticated: true, authMode: "test", email: "interaction@test.invalid", planType: "test", requiresOpenaiAuth: false }
        : { authenticated: false, authMode: null, email: null, planType: null, requiresOpenaiAuth: true },
    };
    return harnessStatus;
  },
  getActiveCodexSession: async () => ({ threadId: activeThreadId }),
  loginWithChatGPT: async () => ({ loginId: "test", authUrl: "https://chatgpt.com" }),
  logoutCodex: async () => harnessStatus,
  getCodexApprovals: async () => [],
  resolveCodexApproval: async () => ({ status: "resolved", trusted: false }),
  getTrustedCommandInfo: async () => ({ count: 0 }),
  clearTrustedCommands: async () => ({ count: 0 }),
  prepareAutomaticTesting: async () => ({
    status: "ready",
    checkedAt: new Date().toISOString(),
    checks: [
      { id: "harness", status: "passed", label: "Codex 连接", detail: "隔离 Harness 已连接。" },
      { id: "workspace", status: "passed", label: "工作区写入", detail: "隔离工作区可写入。" },
      { id: "runner", status: "passed", label: "测试执行器", detail: "隔离测试执行器完整。" },
      { id: "lock", status: "passed", label: "测试执行锁", detail: "当前无人占用。" },
      { id: "port", status: "passed", label: "本地测试端口", detail: "隔离测试端口可用。" },
      { id: "screen", status: "passed", label: "屏幕录制权限", detail: "隔离权限检查通过。" },
      { id: "command", status: "passed", label: "固定测试命令", detail: "固定入口已授权。" },
    ],
  }),
  getCodexUserInputs: async () => pendingUserInput ? [pendingUserInput] : [],
  resolveCodexUserInput: async ({ requestId, answers }) => {
    if (!pendingUserInput || pendingUserInput.requestId !== requestId || Object.keys(answers || {}).length !== 1) {
      throw new Error("Invalid isolated user input response.");
    }
    clarificationAnswers = { ...clarificationAnswers, ...answers };
    if (requestId === 7001) {
      pendingUserInput = {
        requestId: 7002,
        questions: [
          { id: "copy", header: "提示文字", question: "无红色标注时使用什么提示？", options: [{ label: "不追加提示", description: "只保留附件" }] },
        ],
      };
      return;
    }
    if (requestId !== 7002 || Object.keys(clarificationAnswers).length !== 2) throw new Error("Incomplete isolated clarification sequence.");
    pendingUserInput = null;
    clarificationAnswers = {};
    finishManagedTurn?.();
  },
  newChat: async () => { activeThreadId = null; dispatchState = { activeTask: null, queue: [] }; publishDispatchState(); },
  openExternalUrl: async () => undefined,
  // 隔离交互先模拟 macOS 权限阻断，再在打开设置并返回应用后恢复，覆盖真实的重新检测链路。
  prepareScreenCapture: async () => ({ status: "blocked", reason: "permission-required", canOpenSettings: true }),
  openScreenRecordingSettings: async () => { screenRecordingSettingsOpened = true; },
  restartForScreenRecordingPermission: async () => {
    if (!screenRecordingSettingsOpened) throw new Error("Screen recording settings were not opened first.");
  },
  captureScreen: async () => null,
  // 截图编辑器专项夹具需要跨过真实主进程的窗口尺寸切换，但隔离测试不操作用户窗口。
  enterScreenshotAnnotation: async () => undefined,
  returnScreenshotSelection: async () => undefined,
  saveScreenshot: async () => { throw new Error("Screenshot persistence is disabled in interaction tests."); },
  onScreenshotCompleted: () => () => undefined,
  getTempDirectoryInfo: async () => ({ path: process.env.AI_DESKTOP_TEMP_MATERIALS_ROOT, fileCount: 0, totalBytes: 0 }),
  openTempDirectory: async () => undefined,
  clearTempFiles: async () => ({ path: process.env.AI_DESKTOP_TEMP_MATERIALS_ROOT, fileCount: 0, totalBytes: 0 }),
  getAuditLogInfo: async () => ({ path: process.env.AI_DESKTOP_ARCHIVE_LOG_ROOT, taskCount: 0, latestTask: null }),
  openAuditLogDirectory: async () => undefined,
  getCollaborationState: async () => structuredClone(collaborationState),
  getCollaborationTimeline: async () => structuredClone(interactionTimelineSnapshot()),
  onCollaborationTimelineChanged: (listener) => { collaborationTimelineListeners.add(listener); return () => collaborationTimelineListeners.delete(listener); },
  setDesktopOperatingMode: async (mode) => { collaborationState.mode = mode; return publishCollaborationState("mode.changed"); },
  selectCollaborationMember: async (memberId) => { collaborationState.selectedMemberId = memberId; return publishCollaborationState("member.selected"); },
  createCollaborationMember: async ({ displayName }) => {
    collaborationState.members.push({ ...collaborationState.members[1], memberId: `isolated-member-${Date.now()}`, displayName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return publishCollaborationState("member.created");
  },
  updateCollaborationMember: async (memberId, request) => {
    const member = collaborationState.members.find((item) => item.memberId === memberId);
    if (member && request.displayName) member.displayName = request.displayName;
    return publishCollaborationState("member.updated");
  },
  deleteCollaborationMember: async (memberId) => { collaborationState.members = collaborationState.members.filter((item) => item.memberId !== memberId); return publishCollaborationState("member.deleted"); },
  submitCollaborationTask: async () => publishCollaborationState("task.submitted"),
  continueCollaborationTask: async () => publishCollaborationState("task.recovery_requested"),
  cancelCollaborationTask: async () => publishCollaborationState("task.cancelled"),
  getLinghuAutomationState: async () => structuredClone(linghuAutomationState),
  setLinghuAutomationEnabled: async (enabled) => { linghuAutomationState.enabled = enabled === true; linghuAutomationState.blockingReason = enabled ? null : "自动执行已关闭"; return publishLinghuAutomation(enabled ? "automation.enabled" : "automation.disabled"); },
  createLinghuStartupPrompt: async ({ title, content }) => {
    const now = new Date().toISOString();
    const promptId = `interaction-prompt-${Date.now()}`;
    linghuAutomationState.prompts.push({ promptId, title, content, enabled: true, createdAt: now, updatedAt: now });
    linghuAutomationState.activePromptId = promptId;
    return publishLinghuAutomation("prompt.created");
  },
  updateLinghuStartupPrompt: async (promptId, request) => {
    const prompt = linghuAutomationState.prompts.find((item) => item.promptId === promptId);
    if (!prompt) throw new Error("启动文案不存在。");
    Object.assign(prompt, request, { updatedAt: new Date().toISOString() });
    if (!prompt.enabled && linghuAutomationState.activePromptId === promptId) linghuAutomationState.activePromptId = linghuAutomationState.prompts.find((item) => item.enabled)?.promptId || null;
    return publishLinghuAutomation("prompt.updated");
  },
  deleteLinghuStartupPrompt: async (promptId) => { linghuAutomationState.prompts = linghuAutomationState.prompts.filter((item) => item.promptId !== promptId); if (linghuAutomationState.activePromptId === promptId) linghuAutomationState.activePromptId = linghuAutomationState.prompts.find((item) => item.enabled)?.promptId || null; return publishLinghuAutomation("prompt.deleted"); },
  selectLinghuStartupPrompt: async (promptId) => { linghuAutomationState.activePromptId = promptId; return publishLinghuAutomation("prompt.selected"); },
  onLinghuAutomationState: (listener) => { linghuAutomationListeners.add(listener); return () => linghuAutomationListeners.delete(listener); },
  getEvolutionState: async () => structuredClone(evolutionState),
  setInteractionOneShotRun: async (run) => { evolutionState.oneShotRun = run ? structuredClone(run) : null; return publishNangongEvolution("one-shot.activity"); },
  setInteractionOneShotConfirmation: async (confirmation) => { evolutionState.oneShotConfirmation = confirmation ? structuredClone(confirmation) : null; return publishNangongEvolution("conversation.one-shot-confirmation-changed"); },
  openEvolutionWorkspace: async (location) => ipcRenderer.invoke("desktop:test-open-evolution-workspace", location),
  onEvolutionWorkspaceLocation: (listener) => {
    const handler = (_event, location) => listener(location);
    ipcRenderer.on("desktop:evolution-workspace-location", handler);
    return () => ipcRenderer.removeListener("desktop:evolution-workspace-location", handler);
  },
  getEvolutionTopicDossier: async (topicId) => {
    const topic = evolutionState.topics.find((item) => item.topicId === topicId);
    const deliberation = topic?.deliberationId ? evolutionState.deliberations.find((item) => item.deliberationId === topic.deliberationId) || null : null;
    return structuredClone({ topic, deliberation, proposals: evolutionState.proposals.filter((item) => item.topicId === topicId), archiveRecords: evolutionState.archiveRecords.filter((item) => item.topicId === topicId || item.deliberationId === topic?.deliberationId), executionRecords: [] });
  },
  queryEvolutionWorkbench: async (request) => {
    const topicRows = evolutionState.topics.map((topic) => ({ id: topic.topicId, topicId: topic.topicId, proposalId: null, taskId: null, title: topic.title, status: topic.status, stage: "专题演化", owner: topic.origin === "linghu" ? "令狐老祖" : "南宫婉", blockedReason: topic.status === "blocked" ? "专题已阻塞" : null, recoveryPoint: topic.recoveryPoint, nextStep: topic.status === "approved" ? "返还南宫婉并分发" : "查看专题", updatedAt: topic.updatedAt }));
    const proposalRows = evolutionState.proposals.map((proposal) => ({ id: proposal.proposalId, topicId: proposal.topicId, proposalId: proposal.proposalId, taskId: null, title: proposal.title, status: proposal.status, stage: "提案与任务", owner: proposal.submitterDisplayName, blockedReason: null, recoveryPoint: "proposal", nextStep: proposal.status === "approved" ? "返还南宫婉并分发" : "查看审批意见", updatedAt: proposal.updatedAt }));
    const deliberationRows = evolutionState.deliberations.map((item) => ({ id: item.deliberationId, topicId: item.topicId, proposalId: null, taskId: null, title: item.candidate?.title || "待形成专题", status: item.status, stage: "调查与研讨", owner: "韩立", blockedReason: item.status === "blocked" ? "研讨已阻塞" : null, recoveryPoint: item.deliberationId, nextStep: "推进下一轮研讨", updatedAt: item.updatedAt }));
    const archiveRows = evolutionState.archiveRecords.map((item) => ({ id: item.recordId, topicId: item.topicId, proposalId: item.proposalId, taskId: item.taskId, title: item.title, status: item.eventType, stage: item.category, owner: item.actor, blockedReason: null, recoveryPoint: null, nextStep: "查看专题完整档案", updatedAt: item.occurredAt }));
    const approvalRows = proposalRows.filter((row) => evolutionState.proposals.find((proposal) => proposal.proposalId === row.proposalId)?.approvals.length);
    const byView = { topics: topicRows, deliberations: deliberationRows, "pending-approvals": proposalRows.filter((row) => ["pending-approval", "supplement-required", "approved", "pending-acceptance"].includes(row.status)), approvals: approvalRows, proposals: proposalRows, tasks: proposalRows, releases: proposalRows.filter((row) => ["verifying", "pending-acceptance", "completed"].includes(row.status)), archives: archiveRows, "automation-runs": topicRows, recovery: topicRows.filter((row) => row.status === "blocked"), exceptions: topicRows.filter((row) => row.status === "blocked") };
    const keyword = String(request.keyword || "").toLowerCase();
    const rows = (byView[request.view] || []).filter((row) => !keyword || `${row.title} ${row.stage} ${row.owner}`.toLowerCase().includes(keyword));
    const sortField = ["updatedAt", "title", "status"].includes(request.sortField) ? request.sortField : "updatedAt";
    const sortMultiplier = request.sortDirection === "asc" ? 1 : -1;
    rows.sort((left, right) => String(left[sortField] || "").localeCompare(String(right[sortField] || ""), "zh-CN") * sortMultiplier || String(left.id).localeCompare(String(right.id)));
    const page = Math.max(1, Number(request.page) || 1);
    const pageSize = Math.max(1, Number(request.pageSize) || 20);
    return structuredClone({ view: request.view, page, pageSize, total: rows.length, rows: rows.slice((page - 1) * pageSize, page * pageSize), stateVersion: evolutionState.updatedAt, generatedAt: new Date().toISOString() });
  },
  getEvolutionWorkbenchPreference: async (perspective, nodeId) => structuredClone(evolutionWorkbenchPreferences.get(`${perspective}:${nodeId}`) || null),
  saveEvolutionWorkbenchPreference: async (request) => { const value = { ...request, updatedAt: new Date().toISOString() }; evolutionWorkbenchPreferences.set(`${request.perspective}:${request.nodeId}`, value); return structuredClone(value); },
  onEvolutionWorkbenchChanged: (listener) => { evolutionWorkbenchChangeListeners.add(listener); return () => evolutionWorkbenchChangeListeners.delete(listener); },
  advanceHanLiDeliberation: async () => publishNangongEvolution("deliberation.advanced"),
  getApprovalGovernance: async () => [],
  sendNangongConversationMessage: async (request) => {
    const now = new Date().toISOString();
    const userMessageId = request.clientMessageId || `user-${now}`;
    const nangongMessageId = `nangong-${now}`;
    if (request.message.trim() === "1" && evolutionState.oneShotConfirmation) {
      const sequenceNumber = evolutionState.conversation.messages.length;
      evolutionState.conversation.messages.push({ messageId: userMessageId, sequenceNumber, role: "user", content: "1", replyToMessageId: null, deliveryStatus: "completed", inferredIntent: "确认启动当前一次性完整演化", createdAt: now, completedAt: now });
      evolutionState.conversation.messages.push({ messageId: nangongMessageId, sequenceNumber: sequenceNumber + 1, role: "nangong", content: "已确认启动本轮一次性演化。", replyToMessageId: userMessageId, deliveryStatus: "completed", createdAt: now, completedAt: now });
      evolutionState.oneShotConfirmation = null;
      evolutionState.oneShotRun = { runId: `interaction-one-shot-${Date.now()}`, topicId: null, proposalId: null, status: "running", phase: "preparing-topic", actor: "nangong-wan", actorName: "南宫婉", action: "正在根据当前对话整理演化课题", blockingReason: null, startedAt: now, updatedAt: now, completedAt: null };
      return publishNangongEvolution("one-shot.started");
    }
    const nangongReply = "已确认事实：令狐持续修正需要先形成可审批方案。建议方向：把修正方案接入韩立统一审批。";
    const sequenceNumber = evolutionState.conversation.messages.length;
    evolutionState.conversation.messages.push({ messageId: userMessageId, sequenceNumber, role: "user", content: request.message, replyToMessageId: null, deliveryStatus: "completed", createdAt: now, completedAt: now });
    evolutionState.conversation.messages.push({ messageId: nangongMessageId, sequenceNumber: sequenceNumber + 1, role: "nangong", content: nangongReply, replyToMessageId: userMessageId, deliveryStatus: "completed", createdAt: now, completedAt: now });
    if (request.topicId) evolutionState.archiveRecords.push({ recordId: `interaction-topic-group-${Date.now()}`, deliberationId: null, topicId: request.topicId, proposalId: null, taskId: null, sequenceNumber: evolutionState.archiveRecords.length + 1, category: "source", eventType: "conversation.topic_group_replied", actor: "system", title: "专题群收到用户消息与南宫婉回复", payload: { conversationId: evolutionState.conversation.conversationId, userMessageId, userPreview: request.message, nangongMessageId, nangongPreview: nangongReply, status: "replied", nextOwner: "han-li" }, occurredAt: now });
    return publishNangongEvolution("conversation.replied");
  },
  newNangongConversation: async () => {
    nangongNewConversationCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (nangongNewConversationCalls > 1) throw new Error("thread already has an active writer");
    evolutionState.conversation = { conversationId: `nangong-${Date.now()}`, messages: [], updatedAt: new Date().toISOString() };
    return publishNangongEvolution("conversation.created");
  },
  generateNangongTopicDraft: async () => ({ title: "南宫婉完整审批链路", goal: "让令狐持续修正先形成可审批方案，再进入统一审批。", scope: ["AI Desktop", "审批链路"], evidence: ["用户要求草稿由当前对话生成", "南宫婉调查确认修正方案需先审批"], acceptanceCriteria: ["生成内容可编辑", "保存后进入课题卡片"] }),
  convertNangongConversationToTopic: async (request) => createInteractionTopic(request, request.evidence),
  createEvolutionTopic: async (request) => createInteractionTopic(request, request.evidence),
  updateEvolutionTopic: async (topicId, request) => {
    const topic = evolutionState.topics.find((item) => item.topicId === topicId);
    if (!topic || topic.currentProposalVersion !== 0 || topic.status !== "registered") throw new Error("课题已进入提案流程，不能再修改。");
    if (topic.topicRevision !== request.expectedTopicRevision) throw new Error("课题已被其他保存操作更新，请刷新后重新编辑。");
    Object.assign(topic, { title: request.title, goal: request.goal, scope: request.scope, exclusions: request.exclusions || [], evidence: request.evidence, acceptanceCriteria: request.acceptanceCriteria, topicRevision: topic.topicRevision + 1, recoveryPoint: "topic-updated-before-proposal", updatedAt: new Date().toISOString() });
    return publishNangongEvolution("topic.updated");
  },
  setEvolutionAutomationEnabled: async (kind, enabled) => {
    if (kind === "evolution") evolutionState.automaticEvolutionEnabled = enabled === true;
    if (kind === "nangong-approval") evolutionState.automaticNangongApprovalEnabled = enabled === true;
    if (kind === "linghu-approval") evolutionState.automaticLinghuApprovalEnabled = enabled === true;
    if (kind === "execution") evolutionState.automaticExecutionEnabled = enabled === true;
    return publishNangongEvolution(`automation.${kind}`);
  },
  configureEvolutionAutomation: async (request) => { evolutionState.automationSettings = { maxRoundsPerTopic: request.maxRoundsPerTopic, maxCorrectionRounds: request.maxCorrectionRounds }; if (request.workspaceState) evolutionState.automationContext.workspaceState = structuredClone(request.workspaceState); if (request.locale) evolutionState.automationContext.locale = request.locale; return publishNangongEvolution("automation.configured"); },
  controlEvolutionAutomation: async (action) => { evolutionState.automaticEvolutionEnabled = action === "start" || action === "resume"; evolutionState.automationRuntime.status = action === "stop" ? "stopped" : action === "pause" ? "paused" : "running"; return publishNangongEvolution(`automation.${action}`); },
  decideEvolutionResult: async (proposalId, request) => { assertEvolutionMutation(request.mutation); const proposal = evolutionState.proposals.find((item) => item.proposalId === proposalId); if (!proposal || proposal.status !== "pending-acceptance") throw new Error("尚未进入验收"); const now = new Date().toISOString(); proposal.status = request.decision === "approved" ? "completed" : "supplement-required"; proposal.approvals.push({ approvalId: `interaction-result-${Date.now()}`, proposalId, decision: request.decision, source: "manual-user", stage: "result", approverMemberId: "user", approverDisplayName: "用户", advice: request.advice || "", feedbackTarget: "proposal-content", capabilityScope: null, referencedApprovalIds: [], preferenceSnapshotVersion: ++evolutionState.preferenceSnapshotVersion, createdAt: now }); const topic = evolutionState.topics.find((item) => item.topicId === proposal.topicId); if (topic) { topic.status = proposal.status; topic.recoveryPoint = request.decision === "approved" ? "han-li-result-accepted" : "han-li-result-correction-required"; } return publishNangongEvolution("proposal.result_decided"); },
  generateHanLiAcceptancePlan: async (proposalId) => {
    const proposal = evolutionState.proposals.find((item) => item.proposalId === proposalId);
    if (!proposal || proposal.status !== "pending-acceptance") throw new Error("尚未进入验收");
    const plan = { version: 1, planId: `interaction-plan-${Date.now()}`, topicId: proposal.topicId, proposalId, summary: "检查真实工作台中的执行结果和用户关注细节。", concerns: ["按钮响应", "滚动与内容可达"], checks: [{ checkId: "check-1", category: "交互", target: "审批工作台", action: "聚焦窗口并观察状态", expected: "窗口获得焦点且状态清晰", evidenceRequired: "操作截图", operations: [{ type: "focus-window" }, { type: "capture", label: "审批工作台" }] }, { checkId: "check-2", category: "可达性", target: "长内容区域", action: "缩小窗口并滚动到最后一个控件", expected: "滚动可发现且末项可达", evidenceRequired: "滚动到底部截图", operations: [{ type: "resize-window", width: 980, height: 680 }, { type: "scroll", target: "真实界面验收计划", direction: "down", amount: 600 }, { type: "capture", label: "滚动结果" }] }], generatedAt: new Date().toISOString() };
    evolutionState.archiveRecords.push({ recordId: `interaction-plan-record-${Date.now()}`, deliberationId: null, topicId: proposal.topicId, proposalId, taskId: null, sequenceNumber: evolutionState.archiveRecords.length + 1, category: "acceptance", eventType: "acceptance.plan_generated", actor: "han-li", title: "韩立生成真实界面验收计划", payload: { acceptancePlan: plan, status: "planned", nextOwner: "han-li" }, occurredAt: plan.generatedAt });
    await publishNangongEvolution("acceptance.plan_generated");
    return plan;
  },
  executeHanLiAcceptancePlan: async (planId) => {
    const record = [...evolutionState.archiveRecords].reverse().find((item) => item.eventType === "acceptance.plan_generated" && item.payload.acceptancePlan.planId === planId);
    if (!record) throw new Error("验收计划不存在");
    const plan = record.payload.acceptancePlan;
    const now = new Date().toISOString();
    const run = { version: 1, runId: `interaction-run-${Date.now()}`, planId, topicId: plan.topicId, proposalId: plan.proposalId, status: "passed", windowTitle: "AI Desktop · 专题演化工作台", initialBounds: { x: 0, y: 0, width: 1320, height: 880 }, finalBounds: { x: 0, y: 0, width: 1320, height: 880 }, stepResults: plan.checks.flatMap((check) => check.operations.map((operation, operationIndex) => ({ checkId: check.checkId, operationIndex, operation, status: "passed", actual: operation.type === "scroll" ? "滚动位置 0 → 600，最大 1200。" : "真实窗口操作完成。", screenshotAttachmentId: operation.type === "capture" ? `interaction-shot-${operationIndex}` : null, occurredAt: now }))), evidenceAttachmentIds: ["interaction-shot-1", "interaction-shot-2"], startedAt: now, completedAt: now };
    evolutionState.archiveRecords.push({ recordId: `interaction-run-record-${Date.now()}`, deliberationId: null, topicId: plan.topicId, proposalId: plan.proposalId, taskId: null, sequenceNumber: evolutionState.archiveRecords.length + 1, category: "acceptance", eventType: "acceptance.real_app_checked", actor: "han-li", title: "韩立完成真实应用界面检查", payload: { acceptanceRun: run, status: run.status, nextOwner: "han-li" }, occurredAt: now });
    await publishNangongEvolution("acceptance.real_app_checked");
    return run;
  },
  createEvolutionProposal: async (topicId, request) => {
    const topic = evolutionState.topics.find((item) => item.topicId === topicId);
    if (!topic) throw new Error("专项课题不存在。");
    const now = new Date().toISOString();
    const proposalId = `interaction-proposal-${Date.now()}`;
    topic.status = "pending-approval"; topic.currentProposalVersion += 1; topic.recoveryPoint = "proposal-awaiting-approval"; topic.updatedAt = now;
    evolutionState.proposals.push({ proposalId, topicId, version: topic.currentProposalVersion, title: topic.title, type: request.type, origin: "nangong", submitterMemberId: "nangong-wan", submitterDisplayName: "南宫婉", purpose: "work-proposal", targetMemberId: null, targetMemberDisplayName: null, capabilityScope: null, supersedesProposalId: null, revisionFeedbackApprovalId: null, content: request.content, evidence: topic.evidence, impactScope: topic.scope, exclusions: topic.exclusions, risks: request.risks, rollbackPlan: request.rollbackPlan, acceptanceCriteria: topic.acceptanceCriteria, distributionPlan: null, status: "pending-approval", approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now });
    return publishNangongEvolution("proposal.created");
  },
  createLinghuRepairProposal: async () => publishNangongEvolution("linghu.proposal.created"),
  decideEvolutionProposal: async (proposalId, request) => {
    assertEvolutionMutation(request.mutation);
    const proposal = evolutionState.proposals.find((item) => item.proposalId === proposalId);
    if (!proposal) throw new Error("演化提案不存在。");
    const now = new Date().toISOString();
    proposal.status = request.decision; proposal.updatedAt = now;
    proposal.approvals.push({ approvalId: `interaction-approval-${Date.now()}`, proposalId, decision: request.decision, source: "manual-user", stage: "direction", approverMemberId: "user", approverDisplayName: "用户", advice: request.advice || "", feedbackTarget: request.feedbackTarget || "proposal-content", capabilityScope: request.feedbackTarget === "submitter-capability" ? request.capabilityScope : null, referencedApprovalIds: [], preferenceSnapshotVersion: ++evolutionState.preferenceSnapshotVersion, createdAt: now });
    const topic = evolutionState.topics.find((item) => item.topicId === proposal.topicId);
    if (topic) { topic.status = request.decision; topic.recoveryPoint = request.decision === "approved" ? "approved-returned-to-nangong" : request.decision; topic.updatedAt = now; }
    return publishNangongEvolution("proposal.decided");
  },
  reviseEvolutionProposal: async (proposalId, request) => {
    assertEvolutionMutation(request.mutation);
    const previous = evolutionState.proposals.find((item) => item.proposalId === proposalId);
    if (!previous || !["supplement-required", "rejected"].includes(previous.status)) throw new Error("提案不在可修订状态。");
    if (previous.submitterMemberId !== request.submitterMemberId) throw new Error("只能由原提交人重新提交该提案。");
    const feedback = previous.approvals.at(-1); const topic = evolutionState.topics.find((item) => item.topicId === previous.topicId); const now = new Date().toISOString();
    topic.currentProposalVersion += 1; topic.status = "pending-approval"; topic.recoveryPoint = `revised-from:${previous.proposalId}`; topic.updatedAt = now;
    const revised = { ...structuredClone(previous), proposalId: `interaction-revised-${Date.now()}`, version: topic.currentProposalVersion, type: feedback.feedbackTarget === "submitter-capability" ? "规则优化" : previous.type, purpose: feedback.feedbackTarget === "submitter-capability" ? "self-capability-upgrade" : previous.purpose, targetMemberId: feedback.feedbackTarget === "submitter-capability" ? previous.submitterMemberId : previous.targetMemberId, targetMemberDisplayName: feedback.feedbackTarget === "submitter-capability" ? previous.submitterDisplayName : previous.targetMemberDisplayName, capabilityScope: feedback.capabilityScope || previous.capabilityScope, supersedesProposalId: previous.proposalId, revisionFeedbackApprovalId: feedback.approvalId, content: request.content, evidence: request.evidence, impactScope: request.impactScope, risks: request.risks, rollbackPlan: request.rollbackPlan, acceptanceCriteria: request.acceptanceCriteria, distributionPlan: null, status: "pending-approval", approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now };
    evolutionState.proposals.push(revised);
    return publishNangongEvolution("proposal.revised");
  },
  autoApproveEvolutionProposal: async (_proposalId, request) => { assertEvolutionMutation(request); return publishNangongEvolution("proposal.auto-decided"); },
  dispatchEvolutionProposal: async (proposalId, request) => {
    assertEvolutionMutation(request);
    const proposal = evolutionState.proposals.find((item) => item.proposalId === proposalId);
    if (!proposal || proposal.status !== "approved") throw new Error("只有审批通过的提案才能分发。");
    const task = createCompletedEvolutionTask(proposal);
    proposal.status = "pending-acceptance"; proposal.distributedTaskIds = [task.taskId]; proposal.resultSummary = task.resultSummary.finalResult; proposal.updatedAt = task.completedAt;
    const topic = evolutionState.topics.find((item) => item.topicId === proposal.topicId);
    if (topic) { topic.status = "pending-acceptance"; topic.recoveryPoint = "awaiting-han-li-result-acceptance"; topic.updatedAt = task.completedAt; }
    collaborationState.tasks.push(task);
    publishCollaborationState("evolution.task.completed");
    return publishNangongEvolution("proposal.completed");
  },
  onEvolutionState: (listener) => { nangongEvolutionListeners.add(listener); return () => nangongEvolutionListeners.delete(listener); },
  onCollaborationState: (listener) => { collaborationStateListeners.add(listener); return () => collaborationStateListeners.delete(listener); },
  onCollaborationStream: (listener) => { collaborationStreamListeners.add(listener); return () => collaborationStreamListeners.delete(listener); },
  setInteractionTaskTimelineFixture: async (active) => {
    taskTimelineFixtureEnabled = active === true;
    evolutionState.topics = active ? [{ topicId: "interaction-timeline", title: "专题任务 01 · 修订截图按钮可用态", status: "pending-approval", currentProposalVersion: 1, createdAt: "2026-08-29T00:12:00.000Z", updatedAt: "2026-08-29T00:12:00.000Z" }] : [];
    evolutionState.proposals = active ? [{ proposalId: "interaction-timeline-proposal", topicId: "interaction-timeline", version: 1, title: "修订截图按钮可用态", origin: "nangong", submitterMemberId: "nangong-wan", submitterDisplayName: "南宫婉", content: "统一修正主会话与南宫婉会话截图按钮的可用态、悬停态、键盘焦点态和忙碌禁用态。", status: "pending-approval", approvals: [], distributedTaskIds: [], createdAt: "2026-08-29T00:12:00.000Z", updatedAt: "2026-08-29T00:12:00.000Z" }] : [];
    evolutionState.activeTopicId = active ? "interaction-timeline" : null;
    publishNangongEvolution(active ? "interaction.timeline_fixture" : "interaction.timeline_fixture_cleared");
    publishCollaborationTimelineChanged();
    return structuredClone(interactionTimelineSnapshot());
  },
  setInteractionCollaborationExecutionFixture: async (active) => {
    collaborationState.tasks = active ? [{
      taskId: "interaction-execution-task", taskRevision: 1, assignmentId: "assignment-2", workerGeneration: 2, state: "integrated", phase: "ready", executorMemberId: "isolated-member-5", currentReviewerMemberId: null, currentPlanVersion: 1, explicitRejectionCount: 0, infrastructureFailureCount: 0, mergeStrategy: "INDEPENDENT", atomicGroupId: null, dependencyTaskIds: [], integrationGeneration: 2,
      initiator: { memberId: "han-li", displayName: "韩立" }, historyCompleteness: "complete",
      snapshot: { title: "修复协同归档展示", problemStatement: "完成任务仍混在人物历史中。", confirmedIntent: "完成任务进入全局执行列表并显示结果摘要。", constraints: [], acceptanceCriteria: [], sourceMessageIds: [], attachmentIds: [], workspaceState: workspace, locale: "zh-CN", contentHash: "execution" },
      plans: [{ version: 1, ownerMemberId: "isolated-member-4", ownerDisplayName: "宋玉", status: "ready-for-execution", text: "增加任务归档入口和结构化摘要。", contentHash: "plan", createdAt: "2026-08-23T00:01:00.000Z" }],
      executionRecords: [{ assignmentId: "assignment-1", executor: { memberId: "isolated-member-4", displayName: "宋玉" }, workerGeneration: 1, status: "transferred", assignedAt: "2026-08-23T00:00:00.000Z", executionStartedAt: null, completedAt: "2026-08-23T00:03:00.000Z", transferFromAssignmentId: null, handoffType: "initial", result: null, blockingReason: "恢复后转交" }, { assignmentId: "assignment-2", executor: { memberId: "isolated-member-5", displayName: "冰魄仙子" }, workerGeneration: 2, status: "code-verified", assignedAt: "2026-08-23T00:03:00.000Z", executionStartedAt: "2026-08-23T00:03:30.000Z", completedAt: "2026-08-23T00:08:00.000Z", transferFromAssignmentId: "assignment-1", handoffType: "transfer", result: "归档入口已完成", blockingReason: null }],
      flowEvents: [{ eventId: "flow-2", type: "task.submitted", stage: "task", status: "started", actor: { memberId: "han-li", displayName: "韩立" }, summary: "任务已提交", occurredAt: "2026-08-23T00:00:00.000Z", error: false }, { eventId: "flow-3", type: "integration.completed", stage: "integration", status: "completed", actor: null, summary: "任务已通过集成并归档到执行列表", occurredAt: "2026-08-23T00:10:00.000Z", error: false }],
      versionWorkspace: null, finalResult: "执行列表与结果摘要已完成。", resultSummary: { outcome: "succeeded", finalResult: "执行列表与结果摘要已完成。", originalProblem: "完成任务仍混在人物历史中。", solvedProblem: "完成任务现已独立归档。", changes: "新增执行列表、多人执行记录与折叠详情。", remaining: "无已知遗留内容。", success: true, generatedAt: "2026-08-23T00:10:00.000Z" }, blockingReason: null, recoveryTargetState: null, startedAt: "2026-08-23T00:00:00.000Z", codeVerifiedAt: "2026-08-23T00:08:00.000Z", createdAt: "2026-08-23T00:00:00.000Z", updatedAt: "2026-08-23T00:10:00.000Z", completedAt: "2026-08-23T00:10:00.000Z",
    }] : [];
    return publishCollaborationState("interaction.execution_fixture");
  },
  getConversationDispatchState: async () => structuredClone(dispatchState),
  enqueueMessage: async ({ request, displayText, automatic }) => {
    dispatchState.queue.push({ id: `queue-${Date.now()}`, request, displayText: displayText || request.message, createdAt: new Date().toISOString(), automatic: automatic === true });
    return publishDispatchState();
  },
  supplementQueuedMessage: async (itemId) => {
    dispatchState.queue = dispatchState.queue.filter((item) => item.id !== itemId);
    return publishDispatchState();
  },
  discardQueuedMessage: async (itemId) => {
    dispatchState.queue = dispatchState.queue.filter((item) => item.id !== itemId);
    return publishDispatchState();
  },
  recoverConversationTask: async () => {
    if (dispatchState.activeTask?.status === "recoverable") {
      const active = dispatchState.activeTask;
      dispatchState.activeTask = null;
      dispatchState.queue.unshift({ id: active.id, request: active.request, displayText: "继续执行未完成任务", createdAt: new Date().toISOString(), automatic: false });
    }
    return publishDispatchState();
  },
  discardConversationRecovery: async () => { dispatchState.activeTask = null; return publishDispatchState(); },
  onConversationDispatchState: (listener) => { dispatchListeners.add(listener); return () => dispatchListeners.delete(listener); },
  sendMessage: async ({ message, locale = "zh-CN", sandboxMode = "workspace-write", attachmentIds = [], executionMode = "conversation-managed" }) => {
    activeThreadId ||= "interaction-thread";
    dispatchState.activeTask = { id: `active-${Date.now()}`, request: { message, locale, sandboxMode, attachmentIds, executionMode }, startedAt: new Date().toISOString(), status: "running" };
    publishDispatchState();
    try {
      if (message === "markdown-test") {
        return {
          text: "## 清晰结论\n\n- 自然回答\n- 保留结构\n\n| 场景 | 结果 |\n| --- | --- |\n| 重建 | 恢复 |\n\n使用 `thread/resume`。",
          itemCount: 1,
          threadId: activeThreadId,
        };
      }
      if (message === "multi-turn-test") {
        await emitStreamEvent({
          type: "managed-execution",
          turnId: "managed",
          segmentId: "managed:test-managed:build-validation:1",
          managedExecution: { mode: "test-managed", stage: "build-validation", status: "started", round: 1, maximumRounds: 2, message: "第一轮测试" },
        });
        await emitStreamEvent({ type: "turn-started", turnId: "isolated-turn-1", segmentId: "isolated-turn-1:turn", status: "inProgress" });
        await emitStreamEvent({ type: "message-delta", turnId: "isolated-turn-1", segmentId: "isolated-turn-1:message", itemId: "message-1", delta: "第一轮必须保留的文字" });
        await emitStreamEvent({ type: "message-completed", turnId: "isolated-turn-1", segmentId: "isolated-turn-1:message", itemId: "message-1", text: "第一轮必须保留的文字" });
        await emitStreamEvent({ type: "turn-completed", turnId: "isolated-turn-1", segmentId: "isolated-turn-1:turn", status: "completed" });
        await emitStreamEvent({
          type: "managed-execution",
          turnId: "managed",
          segmentId: "managed:test-managed:build-validation:2",
          managedExecution: { mode: "test-managed", stage: "build-validation", status: "continuing", round: 2, maximumRounds: 2, message: "第二轮测试" },
        });
        await emitStreamEvent({ type: "turn-started", turnId: "isolated-turn-2", segmentId: "isolated-turn-2:turn", status: "inProgress" });
        await emitStreamEvent({ type: "message-delta", turnId: "isolated-turn-2", segmentId: "isolated-turn-2:message", itemId: "message-2", delta: "第二轮向下新增的文字" });
        await emitStreamEvent({ type: "message-completed", turnId: "isolated-turn-2", segmentId: "isolated-turn-2:message", itemId: "message-2", text: "第二轮向下新增的文字" });
        await emitStreamEvent({ type: "turn-completed", turnId: "isolated-turn-2", segmentId: "isolated-turn-2:turn", status: "completed" });
        await emitStreamEvent({
          type: "managed-execution",
          turnId: "managed",
          segmentId: "managed:test-managed:completed:1",
          managedExecution: { mode: "test-managed", stage: "completed", status: "completed", round: 1, maximumRounds: 1, message: "两轮测试完成" },
        });
        return { text: "第二轮向下新增的文字", itemCount: 2, threadId: activeThreadId };
      }
      pendingUserInput = {
        requestId: 7001,
        questions: [
          { id: "target", header: "目标", question: "完成后回到哪里？", options: [{ label: "原对话框", description: "保留截图附件" }, { label: "新会话", description: "打开空白会话" }] },
        ],
      };
      await new Promise((resolve) => { finishManagedTurn = resolve; });
      finishManagedTurn = null;
      return { text: "完整意图已根据两个答案重新整理。", itemCount: 1, threadId: activeThreadId };
    } finally {
      dispatchState.activeTask = null;
      publishDispatchState();
    }
  },
  onCodexStreamEvent: (listener) => { streamListeners.add(listener); return () => streamListeners.delete(listener); },
  cancel: async () => false,
  windowControl: () => undefined,
});
