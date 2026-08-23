const path = require("node:path");

const { contextBridge } = require("electron");

const projectRoot = path.resolve(__dirname, "../../../..");
const workspace = {
  primaryId: "interaction-root",
  roots: [{ id: "interaction-root", name: "SELPLAT", path: projectRoot, permission: "workspace-write" }],
};
let harnessStatus = {
  connected: true,
  account: { authenticated: true, authMode: "test", email: "interaction@test.invalid", planType: "test", requiresOpenaiAuth: false },
  error: null,
  runtime: { source: "bundled", path: "/Applications/AI Desktop.app/Contents/Resources/app.asar.unpacked/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex", version: "0.149.0" },
};
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
const collaborationNames = ["韩立", "南宫婉", "紫灵", "元瑶", "宋玉", "冰魄仙子", "墨彩环", "墨大夫", "厉飞雨", "张铁", "令狐老祖", "李化元"];
let collaborationState = {
  version: 1,
  mode: "single-conversation",
  selectedMemberId: "han-li",
  members: collaborationNames.map((displayName, index) => ({
    memberId: index === 0 ? "han-li" : `isolated-member-${index}`,
    displayName,
    kind: index === 0 ? "conversation-owner" : "worker",
    protected: index === 0,
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

// 隔离测试只提供界面渲染需要的确定性数据，不连接真实 Harness、账号、文件选择器或屏幕权限。
contextBridge.exposeInMainWorld("desktop", {
  getEnvironment: async () => ({ projectRoot, platform: process.platform, variant: "developer" }),
  getSettings: async () => ({ locale: "zh-CN", sandboxMode: "workspace-write" }),
  updateSettings: async (settings) => ({ locale: settings.locale || "zh-CN", sandboxMode: settings.sandboxMode || "workspace-write" }),
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
    { name: "package-meta", kind: "directory" },
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
      initiator: { memberId: "han-li", displayName: "韩立" },
      historyCompleteness: "complete",
      snapshot: { title: "审核格式兼容", problemStatement: "审核正文不能丢失", confirmedIntent: "保存审核正文并补取结论。", constraints: [], acceptanceCriteria: [], sourceMessageIds: [], attachmentIds: [], workspaceState: workspace, locale: "zh-CN", contentHash: "interaction" },
      plans: [{ version: 1, ownerMemberId: "isolated-member-10", ownerDisplayName: "张铁", status: "awaiting-review", text: "修正审核解析和状态持久化。", contentHash: "plan", createdAt: "2026-08-23T00:00:00.000Z" }],
      reviews: [],
      reviewAttempts: [{ attemptId: "attempt-1", planVersion: 1, reviewerMemberId: "isolated-member-7", reviewerDisplayName: "墨大夫", reviewerGeneration: 1, outcome: "decision-unrecognized", decision: null, decisionSource: null, rawOutput: "审核内容已经完整生成，但旧格式没有首行标记。", clarificationOutput: "仍未返回唯一标记", error: "审核正文已生成，但结论无法识别。", startedAt: "2026-08-23T00:00:00.000Z", completedAt: "2026-08-23T00:01:00.000Z" }],
      executionRecords: [{ assignmentId: "interaction-assignment", executor: { memberId: "isolated-member-10", displayName: "张铁" }, workerGeneration: 1, status: "blocked", assignedAt: "2026-08-23T00:00:00.000Z", executionStartedAt: "2026-08-23T00:00:30.000Z", completedAt: "2026-08-23T00:01:00.000Z", transferFromAssignmentId: null, handoffType: "initial", result: null, blockingReason: "审核正文已保存但结论未确认", changedFiles: ["apps/ai-desktop/src/variants/developer/DeveloperApp.tsx"] }],
      flowEvents: [{ eventId: "flow-1", type: "task.submitted", stage: "task", status: "started", actor: { memberId: "han-li", displayName: "韩立" }, summary: "任务已提交", occurredAt: "2026-08-23T00:00:00.000Z", error: false }],
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
