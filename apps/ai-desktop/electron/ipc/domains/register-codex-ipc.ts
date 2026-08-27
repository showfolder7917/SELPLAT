/** Codex 领域 IPC：集中认证、审批、用户输入和自动测试预检，避免桌面组合入口复制治理判断。 */
import { shell } from "electron";

import type { ResolveCodexUserInputRequest } from "../../../contracts/codex/codex.js";
import { prepareAutomaticTesting } from "../../services/automatic-test-preflight.js";
import type { CodexService } from "../../services/codex-service.js";
import type { ConversationDispatchStore } from "../../services/conversation-dispatch-store.js";
import type { CollaborationCodexRegistry } from "../../services/collaboration/collaboration-codex-sessions.js";
import type { EventCenterFacade } from "../../services/event-center/event-center-facade.js";
import type { WorkflowRepository } from "../../services/event-center/workflow-repository.js";
import type { SettingsStore } from "../../services/settings-store.js";
import type { TrustedCommandStore } from "../../services/trusted-command-store.js";
import type { WorkspaceStore } from "../../services/workspace-store.js";
import { registerEventCenterIpcHandler } from "../event-center-ipc.js";

interface CodexIpcDependencies {
  appRoot: string;
  codex: CodexService;
  collaborationRegistry: CollaborationCodexRegistry;
  trustedCommands: TrustedCommandStore;
  settings: SettingsStore;
  workspaces: WorkspaceStore;
  dispatch: ConversationDispatchStore;
  workflowRepository: WorkflowRepository | null;
  eventCenter: EventCenterFacade;
  activeAuditTasks: Map<number, string>;
  publishDispatchState(): unknown;
}

/** 注册 Codex 领域 handler；审批只记录必要元数据，用户答案正文不会进入业务日志。 */
export function registerCodexIpc(dependencies: CodexIpcDependencies): void {
  const { appRoot, codex, collaborationRegistry, trustedCommands, settings, workspaces, dispatch, workflowRepository, eventCenter, activeAuditTasks, publishDispatchState } = dependencies;
  const seenApprovalRequests = new Set<number>();
  const approvalAuditTasks = new Map<number, string>();
  const handle = <Arguments extends unknown[]>(channel: string, handler: Parameters<typeof registerEventCenterIpcHandler<Arguments>>[2], boundary: "business" | "technical" | "auto" = "auto") => registerEventCenterIpcHandler(eventCenter, channel, handler, boundary);

  handle("desktop:get-codex-models", () => codex.getModels());
  handle("desktop:get-codex-status", () => codex.getStatus());
  handle("desktop:get-active-codex-session", () => codex.activeSession());
  handle("desktop:login-with-chatgpt", async () => {
    const login = await codex.loginWithChatGPT();
    await shell.openExternal(login.authUrl);
    return login;
  });
  handle("desktop:logout-codex", () => codex.logout());
  handle("desktop:get-codex-approvals", () => {
    const approvals = [...codex.pendingApprovals(), ...collaborationRegistry.pendingApprovals()];
    for (const approval of approvals) {
      if (seenApprovalRequests.has(approval.requestId)) continue;
      seenApprovalRequests.add(approval.requestId);
      const taskId = [...activeAuditTasks.values()].at(-1);
      if (taskId) approvalAuditTasks.set(approval.requestId, taskId);
      eventCenter.recordEvent("approval.requested", {
        requestId: approval.requestId,
        kind: approval.kind,
        title: approval.title,
        command: approval.command,
        cwd: approval.cwd,
      }, taskId);
    }
    return approvals;
  });
  handle("desktop:resolve-codex-approval", (_event, requestId: number, decision: "accept" | "decline") => {
    if (!Number.isSafeInteger(requestId) || (decision !== "accept" && decision !== "decline")) throw new Error("Invalid Codex approval response.");
    // 固定项目命令可随“允许”建立信任；文件修改和高风险命令仍由服务层拒绝持久信任。
    const pendingApproval = [...codex.pendingApprovals(), ...collaborationRegistry.pendingApprovals()].find((item) => item.requestId === requestId);
    if (!pendingApproval) {
      seenApprovalRequests.delete(requestId);
      approvalAuditTasks.delete(requestId);
      eventCenter.recordEvent("approval.expired_response_ignored", { requestId, decision, message: "审批请求已结束，迟到响应已忽略。" });
      return { status: "expired", trusted: false } as const;
    }
    const trustResult = requestId >= 1_000_000
      ? collaborationRegistry.resolveApproval(requestId, decision, decision === "accept")
      : codex.resolveApproval(requestId, decision, decision === "accept");
    workflowRepository?.recordCodexApprovalDecision({
      requestId,
      title: pendingApproval.title,
      kind: pendingApproval.kind,
      decision,
      command: pendingApproval.command ?? undefined,
      cwd: pendingApproval.cwd ?? undefined,
      trusted: trustResult.trusted,
      correlationId: approvalAuditTasks.get(requestId) || null,
    });
    eventCenter.recordApproval(approvalAuditTasks.get(requestId), requestId, decision, trustResult.trusted);
    seenApprovalRequests.delete(requestId);
    approvalAuditTasks.delete(requestId);
    return { status: "resolved", trusted: trustResult.trusted } as const;
  });
  handle("desktop:get-trusted-command-info", () => ({ count: trustedCommands.count() }));
  handle("desktop:clear-trusted-commands", () => {
    trustedCommands.clear();
    eventCenter.recordEvent("trusted_commands.cleared");
    return { count: 0 };
  });
  handle("desktop:prepare-automatic-testing", async () => {
    const result = await prepareAutomaticTesting({ appRoot, codexStatus: await codex.getStatus(), locale: settings.read().locale, trustedCommands, workspaces: workspaces.read() });
    eventCenter.recordEvent("automatic_test.preflight", { status: result.status, failedChecks: result.checks.filter((check) => check.status === "failed").map((check) => check.id) });
    if (result.status === "ready") eventCenter.recordEvent("trusted_command.decision", { action: "automatic-test-authorized", command: "npm run test:document", cwd: appRoot });
    return result;
  });
  handle("desktop:get-codex-user-inputs", () => [...codex.pendingUserInputs(), ...collaborationRegistry.pendingUserInputs()]);
  handle("desktop:resolve-codex-user-input", (_event, request: ResolveCodexUserInputRequest) => {
    if (request.requestId >= 1_000_000) collaborationRegistry.resolveUserInput(request);
    else codex.resolveUserInput(request);
    // 只记录问题生命周期和回答数量，避免把可能敏感的答案正文写入审计。
    eventCenter.recordEvent("user_input.resolved", { requestId: request.requestId, answerCount: Object.keys(request.answers || {}).length });
  });
  handle("desktop:new-chat", async () => {
    await codex.newChat();
    dispatch.clear();
    return publishDispatchState();
  });
}
