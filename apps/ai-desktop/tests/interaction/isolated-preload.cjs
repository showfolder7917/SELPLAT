const path = require("node:path");

const { contextBridge } = require("electron");

const projectRoot = path.resolve(__dirname, "../../../..");
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
let desktopSettings = { locale: "zh-CN", sandboxMode: "workspace-write", defaultModel: "gpt-5.6-terra", reasoningEffort: "medium", serviceTier: "default" };
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
const linghuAutomationListeners = new Set();
const nangongEvolutionListeners = new Set();
let nangongNewConversationCalls = 0;
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
let nangongEvolutionState = { version: 7, automaticEvolutionEnabled: false, automaticNangongApprovalEnabled: false, automaticLinghuApprovalEnabled: false, automaticExecutionEnabled: false, automationSettings: { maxRoundsPerTopic: 5, maxCorrectionRounds: 5 }, automationRuntime: { status: "idle", completedRounds: 0, correctionRounds: 0, stopReason: null, startedAt: null, pausedAt: null }, automationContext: { workspaceState: null, locale: "zh-CN" }, preferenceSnapshotVersion: 0, activeTopicId: null, topics: [], proposals: [], deliberations: [], archiveRecords: [], conversation: { conversationId: "nangong-conversation-isolated", messages: [], updatedAt: "2026-08-24T00:00:00.000Z" }, updatedAt: "2026-08-24T00:00:00.000Z" };
const publishNangongEvolution = (reason) => {
  nangongEvolutionState.updatedAt = new Date().toISOString();
  const event = { state: structuredClone(nangongEvolutionState), reason, topicId: nangongEvolutionState.activeTopicId, proposalId: null };
  for (const listener of nangongEvolutionListeners) listener(event);
  return event.state;
};
const createInteractionTopic = (request, evidence) => {
  const now = new Date().toISOString();
  const topicId = `interaction-topic-${Date.now()}`;
  nangongEvolutionState.topics.push({ topicId, title: request.title, goal: request.goal, scope: request.scope, exclusions: request.exclusions || [], evidence, acceptanceCriteria: request.acceptanceCriteria, workspaceState: request.workspaceState, locale: request.locale, origin: "nangong", sourceConversationMessageIds: nangongEvolutionState.conversation.messages.map((item) => item.messageId), continuationOfTopicId: null, nextTopicId: null, seriesId: topicId, roundNumber: 1, status: "registered", topicRevision: 1, currentProposalVersion: 0, recoveryPoint: "topic-registered", createdAt: now, updatedAt: now });
  nangongEvolutionState.activeTopicId = topicId;
  return publishNangongEvolution("topic.created");
};
const createCompletedEvolutionTask = (proposal) => {
  const now = new Date().toISOString();
  return {
    taskId: `interaction-evolution-task-${Date.now()}`, taskRevision: 1, state: "integrated", phase: "ready", evolutionProposalId: proposal.proposalId,
    initiator: { memberId: "nangong-wan", displayName: "南宫婉" },
    snapshot: { title: proposal.title, problemStatement: "演化课题等待执行。", confirmedIntent: proposal.content, constraints: [], acceptanceCriteria: proposal.acceptanceCriteria, sourceMessageIds: [], attachmentIds: [], workspaceState: workspace, locale: "zh-CN", contentHash: "interaction-evolution" },
    executionRecords: [{ assignmentId: "interaction-evolution-assignment", executor: { memberId: "isolated-member-4", displayName: "宋玉" }, workerGeneration: 1, status: "code-verified", assignedAt: now, executionStartedAt: now, completedAt: now, transferFromAssignmentId: null, handoffType: "initial", result: "演化任务已完成", blockingReason: null, changedFiles: ["apps/ai-desktop/src/variants/developer/DeveloperApp.tsx"] }],
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
    : { state: "ready", schemaVersion: "0006", message: null };
};

// 隔离测试只提供界面渲染需要的确定性数据，不连接真实 Harness、账号、文件选择器或屏幕权限。
contextBridge.exposeInMainWorld("desktop", {
  getEnvironment: async () => ({ projectRoot, platform: process.platform, variant: "developer" }),
  getAiMemoryDatabaseStatus: async () => ({ ...readInteractionAiMemoryDatabaseStatus() }),
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
  resolveCodexApproval: async () => undefined,
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
  getNangongEvolutionState: async () => structuredClone(nangongEvolutionState),
  getEvolutionTopicDossier: async (topicId) => {
    const topic = nangongEvolutionState.topics.find((item) => item.topicId === topicId);
    const deliberation = topic?.deliberationId ? nangongEvolutionState.deliberations.find((item) => item.deliberationId === topic.deliberationId) || null : null;
    return structuredClone({ topic, deliberation, proposals: nangongEvolutionState.proposals.filter((item) => item.topicId === topicId), archiveRecords: nangongEvolutionState.archiveRecords.filter((item) => item.topicId === topicId || item.deliberationId === topic?.deliberationId), executionRecords: [] });
  },
  advanceHanLiDeliberation: async () => publishNangongEvolution("deliberation.advanced"),
  getApprovalGovernance: async () => [],
  sendNangongConversationMessage: async (request) => {
    const now = new Date().toISOString();
    nangongEvolutionState.conversation.messages.push({ messageId: `user-${now}`, role: "user", content: request.message, createdAt: now });
    nangongEvolutionState.conversation.messages.push({ messageId: `nangong-${now}`, role: "nangong", content: "已确认事实：令狐持续修正需要先形成可审批方案。建议方向：把修正方案接入韩立统一审批。", createdAt: now });
    return publishNangongEvolution("conversation.replied");
  },
  newNangongConversation: async () => {
    nangongNewConversationCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (nangongNewConversationCalls > 1) throw new Error("thread already has an active writer");
    nangongEvolutionState.conversation = { conversationId: `nangong-${Date.now()}`, messages: [], updatedAt: new Date().toISOString() };
    return publishNangongEvolution("conversation.created");
  },
  generateNangongTopicDraft: async () => ({ title: "南宫婉完整审批链路", goal: "让令狐持续修正先形成可审批方案，再进入统一审批。", scope: ["AI Desktop", "审批链路"], evidence: ["用户要求草稿由当前对话生成", "南宫婉调查确认修正方案需先审批"], acceptanceCriteria: ["生成内容可编辑", "保存后进入课题卡片"] }),
  convertNangongConversationToTopic: async (request) => createInteractionTopic(request, request.evidence),
  createEvolutionTopic: async (request) => createInteractionTopic(request, request.evidence),
  updateEvolutionTopic: async (topicId, request) => {
    const topic = nangongEvolutionState.topics.find((item) => item.topicId === topicId);
    if (!topic || topic.currentProposalVersion !== 0 || topic.status !== "registered") throw new Error("课题已进入提案流程，不能再修改。");
    if (topic.topicRevision !== request.expectedTopicRevision) throw new Error("课题已被其他保存操作更新，请刷新后重新编辑。");
    Object.assign(topic, { title: request.title, goal: request.goal, scope: request.scope, exclusions: request.exclusions || [], evidence: request.evidence, acceptanceCriteria: request.acceptanceCriteria, topicRevision: topic.topicRevision + 1, recoveryPoint: "topic-updated-before-proposal", updatedAt: new Date().toISOString() });
    return publishNangongEvolution("topic.updated");
  },
  setNangongAutomation: async (kind, enabled) => {
    if (kind === "evolution") nangongEvolutionState.automaticEvolutionEnabled = enabled === true;
    if (kind === "nangong-approval") nangongEvolutionState.automaticNangongApprovalEnabled = enabled === true;
    if (kind === "linghu-approval") nangongEvolutionState.automaticLinghuApprovalEnabled = enabled === true;
    if (kind === "execution") nangongEvolutionState.automaticExecutionEnabled = enabled === true;
    return publishNangongEvolution(`automation.${kind}`);
  },
  configureEvolutionAutomation: async (request) => { nangongEvolutionState.automationSettings = { maxRoundsPerTopic: request.maxRoundsPerTopic, maxCorrectionRounds: request.maxCorrectionRounds }; if (request.workspaceState) nangongEvolutionState.automationContext.workspaceState = structuredClone(request.workspaceState); if (request.locale) nangongEvolutionState.automationContext.locale = request.locale; return publishNangongEvolution("automation.configured"); },
  controlEvolutionAutomation: async (action) => { nangongEvolutionState.automaticEvolutionEnabled = action === "start" || action === "resume"; nangongEvolutionState.automationRuntime.status = action === "stop" ? "stopped" : action === "pause" ? "paused" : "running"; return publishNangongEvolution(`automation.${action}`); },
  decideEvolutionResult: async (proposalId, request) => { const proposal = nangongEvolutionState.proposals.find((item) => item.proposalId === proposalId); if (!proposal || proposal.status !== "pending-acceptance") throw new Error("尚未进入验收"); const now = new Date().toISOString(); proposal.status = request.decision === "approved" ? "completed" : "supplement-required"; proposal.approvals.push({ approvalId: `interaction-result-${Date.now()}`, proposalId, decision: request.decision, source: "manual-user", stage: "result", approverMemberId: "user", approverDisplayName: "用户", advice: request.advice || "", feedbackTarget: "proposal-content", capabilityScope: null, referencedApprovalIds: [], preferenceSnapshotVersion: ++nangongEvolutionState.preferenceSnapshotVersion, createdAt: now }); const topic = nangongEvolutionState.topics.find((item) => item.topicId === proposal.topicId); if (topic) { topic.status = proposal.status; topic.recoveryPoint = request.decision === "approved" ? "han-li-result-accepted" : "han-li-result-correction-required"; } return publishNangongEvolution("proposal.result_decided"); },
  createEvolutionProposal: async (topicId, request) => {
    const topic = nangongEvolutionState.topics.find((item) => item.topicId === topicId);
    if (!topic) throw new Error("专项课题不存在。");
    const now = new Date().toISOString();
    const proposalId = `interaction-proposal-${Date.now()}`;
    topic.status = "pending-approval"; topic.currentProposalVersion += 1; topic.recoveryPoint = "proposal-awaiting-approval"; topic.updatedAt = now;
    nangongEvolutionState.proposals.push({ proposalId, topicId, version: topic.currentProposalVersion, title: topic.title, type: request.type, origin: "nangong", submitterMemberId: "nangong-wan", submitterDisplayName: "南宫婉", purpose: "work-proposal", targetMemberId: null, targetMemberDisplayName: null, capabilityScope: null, supersedesProposalId: null, revisionFeedbackApprovalId: null, content: request.content, evidence: topic.evidence, impactScope: topic.scope, exclusions: topic.exclusions, risks: request.risks, rollbackPlan: request.rollbackPlan, acceptanceCriteria: topic.acceptanceCriteria, distributionUnits: [{ title: topic.title, scope: topic.scope[0], acceptanceCriteria: topic.acceptanceCriteria }], status: "pending-approval", approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now });
    return publishNangongEvolution("proposal.created");
  },
  createLinghuRepairProposal: async () => publishNangongEvolution("linghu.proposal.created"),
  decideEvolutionProposal: async (proposalId, request) => {
    const proposal = nangongEvolutionState.proposals.find((item) => item.proposalId === proposalId);
    if (!proposal) throw new Error("演化提案不存在。");
    const now = new Date().toISOString();
    proposal.status = request.decision; proposal.updatedAt = now;
    proposal.approvals.push({ approvalId: `interaction-approval-${Date.now()}`, proposalId, decision: request.decision, source: "manual-user", stage: "direction", approverMemberId: "user", approverDisplayName: "用户", advice: request.advice || "", feedbackTarget: request.feedbackTarget || "proposal-content", capabilityScope: request.feedbackTarget === "submitter-capability" ? request.capabilityScope : null, referencedApprovalIds: [], preferenceSnapshotVersion: ++nangongEvolutionState.preferenceSnapshotVersion, createdAt: now });
    const topic = nangongEvolutionState.topics.find((item) => item.topicId === proposal.topicId);
    if (topic) { topic.status = request.decision; topic.recoveryPoint = request.decision === "approved" ? "approved-returned-to-nangong" : request.decision; topic.updatedAt = now; }
    return publishNangongEvolution("proposal.decided");
  },
  reviseEvolutionProposal: async (proposalId, request) => {
    const previous = nangongEvolutionState.proposals.find((item) => item.proposalId === proposalId);
    if (!previous || !["supplement-required", "rejected"].includes(previous.status)) throw new Error("提案不在可修订状态。");
    if (previous.submitterMemberId !== request.submitterMemberId) throw new Error("只能由原提交人重新提交该提案。");
    const feedback = previous.approvals.at(-1); const topic = nangongEvolutionState.topics.find((item) => item.topicId === previous.topicId); const now = new Date().toISOString();
    topic.currentProposalVersion += 1; topic.status = "pending-approval"; topic.recoveryPoint = `revised-from:${previous.proposalId}`; topic.updatedAt = now;
    const revised = { ...structuredClone(previous), proposalId: `interaction-revised-${Date.now()}`, version: topic.currentProposalVersion, type: feedback.feedbackTarget === "submitter-capability" ? "规则优化" : previous.type, purpose: feedback.feedbackTarget === "submitter-capability" ? "self-capability-upgrade" : previous.purpose, targetMemberId: feedback.feedbackTarget === "submitter-capability" ? previous.submitterMemberId : previous.targetMemberId, targetMemberDisplayName: feedback.feedbackTarget === "submitter-capability" ? previous.submitterDisplayName : previous.targetMemberDisplayName, capabilityScope: feedback.capabilityScope || previous.capabilityScope, supersedesProposalId: previous.proposalId, revisionFeedbackApprovalId: feedback.approvalId, content: request.content, evidence: request.evidence, impactScope: request.impactScope, risks: request.risks, rollbackPlan: request.rollbackPlan, acceptanceCriteria: request.acceptanceCriteria, distributionUnits: request.impactScope.map((scope) => ({ title: `${previous.title} · ${scope}`, scope, acceptanceCriteria: request.acceptanceCriteria })), status: "pending-approval", approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now };
    nangongEvolutionState.proposals.push(revised);
    return publishNangongEvolution("proposal.revised");
  },
  autoApproveEvolutionProposal: async () => publishNangongEvolution("proposal.auto-decided"),
  dispatchEvolutionProposal: async (proposalId) => {
    const proposal = nangongEvolutionState.proposals.find((item) => item.proposalId === proposalId);
    if (!proposal || proposal.status !== "approved") throw new Error("只有审批通过的提案才能分发。");
    const task = createCompletedEvolutionTask(proposal);
    proposal.status = "pending-acceptance"; proposal.distributedTaskIds = [task.taskId]; proposal.resultSummary = task.resultSummary.finalResult; proposal.updatedAt = task.completedAt;
    const topic = nangongEvolutionState.topics.find((item) => item.topicId === proposal.topicId);
    if (topic) { topic.status = "pending-acceptance"; topic.recoveryPoint = "awaiting-han-li-result-acceptance"; topic.updatedAt = task.completedAt; }
    collaborationState.tasks.push(task);
    publishCollaborationState("evolution.task.completed");
    return publishNangongEvolution("proposal.completed");
  },
  onNangongEvolutionState: (listener) => { nangongEvolutionListeners.add(listener); return () => nangongEvolutionListeners.delete(listener); },
  onCollaborationState: (listener) => { collaborationStateListeners.add(listener); return () => collaborationStateListeners.delete(listener); },
  onCollaborationStream: (listener) => { collaborationStreamListeners.add(listener); return () => collaborationStreamListeners.delete(listener); },
  setInteractionCollaborationReviewFixture: async (active) => {
    collaborationState.tasks = active ? [{
      taskId: "interaction-review-task",
      taskRevision: 1,
      assignmentId: "interaction-assignment",
      workerGeneration: 1,
      state: "blocked",
      phase: "blocked",
      executorMemberId: "isolated-member-10",
      currentReviewerMemberId: null,
      currentPlanVersion: 1,
      explicitRejectionCount: 0,
      infrastructureFailureCount: 0,
      mergeStrategy: "INDEPENDENT",
      atomicGroupId: null,
      dependencyTaskIds: [],
      integrationGeneration: null,
      initiator: { memberId: "nangong-wan", displayName: "南宫婉" },
      historyCompleteness: "complete",
      snapshot: { title: "审核格式兼容", problemStatement: "审核正文不能丢失", confirmedIntent: "保存审核正文并补取结论。", constraints: [], acceptanceCriteria: [], sourceMessageIds: [], attachmentIds: [], workspaceState: workspace, locale: "zh-CN", contentHash: "interaction" },
      plans: [{ version: 1, ownerMemberId: "isolated-member-10", ownerDisplayName: "张铁", status: "awaiting-review", text: "修正审核解析和状态持久化。", contentHash: "plan", createdAt: "2026-08-23T00:00:00.000Z" }],
      reviews: [],
      reviewAttempts: [{ attemptId: "attempt-1", planVersion: 1, reviewerMemberId: "isolated-member-8", reviewerDisplayName: "墨大夫", reviewerGeneration: 1, outcome: "decision-unrecognized", decision: null, decisionSource: null, rawOutput: "审核内容已经完整生成，但旧格式没有首行标记。", clarificationOutput: "仍未返回唯一标记", error: "审核正文已生成，但结论无法识别。", startedAt: "2026-08-23T00:00:00.000Z", completedAt: "2026-08-23T00:01:00.000Z" }],
      executionRecords: [{ assignmentId: "interaction-assignment", executor: { memberId: "isolated-member-10", displayName: "张铁" }, workerGeneration: 1, status: "blocked", assignedAt: "2026-08-23T00:00:00.000Z", executionStartedAt: "2026-08-23T00:00:30.000Z", completedAt: "2026-08-23T00:01:00.000Z", transferFromAssignmentId: null, handoffType: "initial", result: null, blockingReason: "审核正文已保存但结论未确认", changedFiles: ["apps/ai-desktop/src/variants/developer/DeveloperApp.tsx"] }],
      flowEvents: [{ eventId: "flow-1", type: "task.submitted", stage: "task", status: "started", actor: { memberId: "nangong-wan", displayName: "南宫婉" }, summary: "任务已提交", occurredAt: "2026-08-23T00:00:00.000Z", error: false }],
      versionWorkspace: null,
      finalResult: null,
      resultSummary: null,
      blockingReason: "墨大夫审核正文已保存，但结论无法识别，等待其他审核员确认",
      recoveryTargetState: "reviewing",
      startedAt: "2026-08-23T00:00:00.000Z",
      codeVerifiedAt: null,
      createdAt: "2026-08-23T00:00:00.000Z",
      updatedAt: "2026-08-23T00:01:00.000Z",
      completedAt: null,
    }] : [];
    return publishCollaborationState("interaction.review_fixture");
  },
  setInteractionCollaborationExecutionFixture: async (active) => {
    collaborationState.tasks = active ? [{
      taskId: "interaction-execution-task", taskRevision: 1, assignmentId: "assignment-2", workerGeneration: 2, state: "integrated", phase: "ready", executorMemberId: "isolated-member-5", currentReviewerMemberId: null, currentPlanVersion: 1, explicitRejectionCount: 0, infrastructureFailureCount: 0, mergeStrategy: "INDEPENDENT", atomicGroupId: null, dependencyTaskIds: [], integrationGeneration: 2,
      initiator: { memberId: "han-li", displayName: "韩立" }, historyCompleteness: "complete",
      snapshot: { title: "修复协同归档展示", problemStatement: "完成任务仍混在人物历史中。", confirmedIntent: "完成任务进入全局执行列表并显示结果摘要。", constraints: [], acceptanceCriteria: [], sourceMessageIds: [], attachmentIds: [], workspaceState: workspace, locale: "zh-CN", contentHash: "execution" },
      plans: [{ version: 1, ownerMemberId: "isolated-member-4", ownerDisplayName: "宋玉", status: "approved", text: "增加任务归档入口和结构化摘要。", contentHash: "plan", createdAt: "2026-08-23T00:01:00.000Z" }],
      reviews: [{ reviewId: "review-2", planVersion: 1, reviewerMemberId: "isolated-member-5", reviewerDisplayName: "冰魄仙子", reviewerGeneration: 1, decision: "passed", feedback: "满足已确认需求。", createdAt: "2026-08-23T00:02:00.000Z" }],
      reviewAttempts: [{ attemptId: "attempt-2", planVersion: 1, reviewerMemberId: "isolated-member-5", reviewerDisplayName: "冰魄仙子", reviewerGeneration: 1, outcome: "decided", decision: "passed", decisionSource: "tag", rawOutput: "审核通过", clarificationOutput: null, error: null, startedAt: "2026-08-23T00:01:30.000Z", completedAt: "2026-08-23T00:02:00.000Z" }],
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
