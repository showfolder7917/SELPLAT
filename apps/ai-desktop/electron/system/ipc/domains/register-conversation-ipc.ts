/** 主会话领域 IPC：集中队列、发送、取消和任务审计，使 Renderer 可以沿 conversation 同名路径找到实现。 */
import path from "node:path";

import { app } from "electron";
import { BrowserWindow } from "electron";

import { LOCALES } from "../../../../contracts/foundation/index.js";
import { SANDBOX_MODES } from "../../../../contracts/foundation/index.js";
import type { ManagedExecutionModeValue } from "../../../../contracts/foundation/index.js";
import type { EnqueueMessageInDto, SendMessageInDto } from "../../../../contracts/services/support/capabilities/conversation/index.js";
import type { CodexFacade } from "../../../services/support/platform/codex/index.js";
import type { ConversationFacade } from "../../../services/support/capabilities/conversation/index.js";
import type { EventCenterFacade } from "../../../services/support/capabilities/event-center/index.js";
import { ManagedExecutionFacade } from "../../../services/support/capabilities/execution/index.js";
import type { PromptLibraryPort } from "../../../services/support/capabilities/prompts/index.js";
import type { AttachmentFacade } from "../../../services/support/platform/attachments/index.js";
import type { WorkspaceFacade } from "../../../services/support/platform/workspace/index.js";
import { registerEventCenterIpcHandler } from "../event-center-ipc.js";

interface ConversationIpcDependencies {
  projectRoot: string;
  appRoot: string;
  codex: CodexFacade;
  screenshots: AttachmentFacade;
  workspaces: WorkspaceFacade;
  dispatch: ConversationFacade;
  eventCenter: EventCenterFacade;
  prompts: PromptLibraryPort;
  activeAuditTasks: Map<number, string>;
  publishDispatchState(): unknown;
  prepareForApplicationExit(): void;
}

/** 注册主会话的完整跨进程入口；复杂执行仍委托公开 Facade，不在 IPC 中实现模型或持久化能力。 */
export function registerConversationIpc(dependencies: ConversationIpcDependencies): void {
  const {
    projectRoot,
    appRoot,
    codex,
    screenshots,
    workspaces,
    dispatch,
    eventCenter,
    prompts,
    activeAuditTasks,
    publishDispatchState,
    prepareForApplicationExit,
  } = dependencies;
  const managedExecutor = new ManagedExecutionFacade(prompts);
  const handle = <Arguments extends unknown[]>(channel: string, handler: Parameters<typeof registerEventCenterIpcHandler<Arguments>>[2], boundary: "business" | "technical" | "auto" = "auto"): void => registerEventCenterIpcHandler(eventCenter, channel, handler, boundary);

  handle("desktop:get-conversation-dispatch-state", () => dispatch.state());
  handle("desktop:enqueue-message", (_event, value: EnqueueMessageInDto) => {
    if (!value?.request || typeof value.request.message !== "string") throw new Error("Invalid queued message request.");
    dispatch.enqueue(value.request, value.displayText, value.automatic === true);
    return publishDispatchState();
  });
  handle("desktop:supplement-queued-message", async (_event, itemId: string) => {
    const item = dispatch.queueItem(itemId);
    if (!item) throw new Error("排队消息已被处理或不存在。");
    const active = dispatch.state().activeTask;
    if (!active || active.status !== "running") throw new Error("当前没有正在执行、可以接收补充的任务。");
    const attachmentPaths = await screenshots.resolveAttachmentPaths(item.request.attachmentIds || []);
    await codex.steer(item.request.message, attachmentPaths);
    dispatch.removeQueued(itemId, "supplemented");
    eventCenter.recordEvent("task.supplement_delivered", {
      dispatchId: item.id,
      attachmentCount: attachmentPaths.length,
    }, activeAuditTasks.values().next().value);
    return publishDispatchState();
  });
  handle("desktop:discard-queued-message", (_event, itemId: string) => {
    dispatch.removeQueued(itemId, "discarded");
    return publishDispatchState();
  });
  handle("desktop:recover-conversation-task", () => {
    dispatch.recover();
    return publishDispatchState();
  });
  handle("desktop:discard-conversation-recovery", () => {
    dispatch.discardRecovery();
    return publishDispatchState();
  });
  handle("desktop:send-message", async (ipcEvent, request: SendMessageInDto) => {
    if (!request || typeof request.message !== "string") throw new Error("Invalid message request.");
    if (!LOCALES.includes(request.locale)) throw new Error("Invalid locale.");
    if (!SANDBOX_MODES.includes(request.sandboxMode)) throw new Error("Invalid sandbox mode.");
    if (dispatch.state().activeTask) {
      const queued = dispatch.enqueue(request, request.message);
      publishDispatchState();
      return { text: "消息已进入等待队列。", itemCount: 0, disposition: "queued" as const, queueItemId: queued.id };
    }
    let effectiveRequest = request;
    let dispatchId = request.queueItemId;
    if (dispatchId) effectiveRequest = dispatch.takeQueued(dispatchId).request;
    dispatchId = dispatch.begin(effectiveRequest, dispatchId);
    publishDispatchState();
    let taskId: string | undefined;
    try {
      const executionMode: ManagedExecutionModeValue = isManagedExecutionMode(effectiveRequest.executionMode)
        ? effectiveRequest.executionMode
        : "conversation-managed";
      const attachmentPaths = await screenshots.resolveAttachmentPaths(effectiveRequest.attachmentIds || []);
      const workspaceState = workspaces.read();
      const previousTask = eventCenter.info().latestTask;
      const appRelativeRoot = path.relative(projectRoot, appRoot).replaceAll(path.sep, "/");
      const restartRequired = executionMode === "test-managed" && Boolean(previousTask?.changedFiles.some((file) => {
        const normalized = file.replaceAll("\\", "/").replace(/^\.\//, "");
        return normalized.startsWith(`${appRelativeRoot}/src/`)
          || normalized.startsWith(`${appRelativeRoot}/electron/`)
          || normalized.startsWith(`${appRelativeRoot}/contracts/`)
          || normalized === `${appRelativeRoot}/package.json`
          || normalized === `${appRelativeRoot}/vite.config.mjs`;
      }));
      taskId = eventCenter.startTask({
        message: effectiveRequest.message,
        locale: effectiveRequest.locale,
        sandboxMode: effectiveRequest.sandboxMode,
        workspaces: workspaceState,
        attachmentCount: attachmentPaths.length,
        managedMode: executionMode,
      });
      activeAuditTasks.set(ipcEvent.sender.id, taskId);
      let firstTurn = true;
      const emit = (streamEvent: Parameters<typeof eventCenter.recordStreamEvent>[1]) => {
        eventCenter.recordStreamEvent(taskId!, streamEvent);
        // 进度只回送给发起本轮任务的窗口，避免多窗口之间串流或泄露任务上下文。
        if (!ipcEvent.sender.isDestroyed()) ipcEvent.sender.send("desktop:codex-stream-event", streamEvent);
      };
      const response = await managedExecutor.run({
        mode: executionMode,
        message: effectiveRequest.message,
        restartRequired,
        emit,
        runTurn: async (message, onEvent, mode) => {
          const currentAttachments = firstTurn ? attachmentPaths : [];
          firstTurn = false;
          const effectiveSandbox = mode === "conversation-managed" || mode === "requirement-managed" ? "read-only" : effectiveRequest.sandboxMode;
          return codex.send(message, effectiveRequest.locale, effectiveSandbox, workspaceState, currentAttachments, onEvent, mode);
        },
      });
      eventCenter.finishTask(taskId, "completed", undefined, response.managedStatus, response.pendingActions);
      dispatch.finish(dispatchId, "completed");
      publishDispatchState();
      if (response.restartRequired) {
        eventCenter.recordEvent("application.controlled_restart_scheduled", { reason: "test_managed_completed" }, taskId);
        setTimeout(() => {
          app.relaunch();
          prepareForApplicationExit();
          app.exit(0);
        }, 1_200);
      }
      return { ...response, disposition: "completed" as const };
    } catch (error) {
      if (taskId) eventCenter.finishTask(taskId, "failed", error instanceof Error ? error.message : "Codex task failed.");
      dispatch.finish(dispatchId, "failed");
      publishDispatchState();
      throw error;
    } finally {
      activeAuditTasks.delete(ipcEvent.sender.id);
    }
  });
}

/** 只有四种托管执行模式可以进入主会话执行器。 */
function isManagedExecutionMode(value: unknown): value is ManagedExecutionModeValue {
  return value === "conversation-managed" || value === "requirement-managed" || value === "task-managed" || value === "test-managed";
}
