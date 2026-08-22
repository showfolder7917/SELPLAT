const path = require("node:path");

const { contextBridge } = require("electron");

const projectRoot = path.resolve(__dirname, "../../../..");
const workspace = {
  primaryId: "interaction-root",
  roots: [{ id: "interaction-root", name: "SELPLAT", path: projectRoot, permission: "workspace-write" }],
};
const harnessStatus = {
  connected: true,
  account: { authenticated: true, authMode: "test", email: "interaction@test.invalid", planType: "test", requiresOpenaiAuth: false },
  error: null,
  runtime: { source: "system", path: "/usr/local/bin/codex", version: "0.149.0" },
};
let pendingUserInput = null;
let finishManagedTurn = null;
let clarificationAnswers = {};
let activeThreadId = "interaction-thread";

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
    { name: "apps", kind: "directory" },
    { name: "OPTION", kind: "directory" },
  ],
  getCodexStatus: async () => harnessStatus,
  getActiveCodexSession: async () => ({ threadId: activeThreadId }),
  loginWithChatGPT: async () => ({ loginId: "test", authUrl: "https://chatgpt.com" }),
  logoutCodex: async () => harnessStatus,
  getCodexApprovals: async () => [],
  resolveCodexApproval: async () => undefined,
  getTrustedCommandInfo: async () => ({ count: 0 }),
  clearTrustedCommands: async () => ({ count: 0 }),
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
  newChat: async () => { activeThreadId = null; },
  openExternalUrl: async () => undefined,
  // 隔离交互固定模拟 macOS 权限阻断，验证界面不会泄露 Electron 原始 IPC 错误并提供恢复入口。
  prepareScreenCapture: async () => ({ status: "blocked", reason: "permission-required", canOpenSettings: true }),
  openScreenRecordingSettings: async () => undefined,
  captureScreen: async () => null,
  saveScreenshot: async () => { throw new Error("Screenshot persistence is disabled in interaction tests."); },
  onScreenshotCompleted: () => () => undefined,
  getTempDirectoryInfo: async () => ({ path: path.join(projectRoot, "apps", "ai-desktop", "temp"), fileCount: 0, totalBytes: 0 }),
  openTempDirectory: async () => undefined,
  clearTempFiles: async () => ({ path: path.join(projectRoot, "apps", "ai-desktop", "temp"), fileCount: 0, totalBytes: 0 }),
  getAuditLogInfo: async () => ({ path: path.join(projectRoot, "apps", "ai-desktop", "log"), taskCount: 0, latestTask: null }),
  openAuditLogDirectory: async () => undefined,
  sendMessage: async ({ message }) => {
    activeThreadId ||= "interaction-thread";
    if (message === "markdown-test") {
      return {
        text: "## 清晰结论\n\n- 自然回答\n- 保留结构\n\n| 场景 | 结果 |\n| --- | --- |\n| 重建 | 恢复 |\n\n使用 `thread/resume`。",
        itemCount: 1,
        threadId: activeThreadId,
      };
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
  },
  onCodexStreamEvent: () => () => undefined,
  cancel: async () => false,
  windowControl: () => undefined,
});
