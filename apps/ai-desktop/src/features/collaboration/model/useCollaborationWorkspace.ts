/**
 * 协作工作区状态控制器。
 *
 * 真实页面入口位于 Developer 窗口。左侧“任务”区域和右侧协作工作区共用本 Hook，
 * 因而页面组件只需要读取状态和调用操作，不需要理解 Electron IPC 的订阅细节。
 */

// React 生命周期：页面打开时建立主进程订阅，页面关闭时释放订阅。
import { useEffect } from "react";
// React 状态容器：保存协作状态、时间线、实时输出和当前页面选择。
import { useState } from "react";

import type {
  // 协作状态事件：主进程在成员或任务发生变化时推送完整的新状态。
  CollaborationStateEventOutDto,
  // 协作状态：包含运行模式、成员、任务和当前选中成员。
  CollaborationStateOutDto,
  // 协作流事件：主进程推送某个任务或时间线节点的增量文本。
  CollaborationStreamEventOutDto,
  // 协作任务：用于判断任务是否已经结束。
  CollaborationTaskOutDto,
  // 协作时间线：右侧任务群和人物页展示的权威历史投影。
  CollaborationTimelineSnapshotOutDto,
  // 桌面运行模式：区分普通单会话和多人协作模式。
  DesktopOperatingModeValue,
  // 令狐状态事件：主进程推送自动保障能力的最新状态。
  LinghuAutomationStateEventOutDto,
  // 令狐自动化状态：令狐人物页展示开关和运行情况。
  LinghuAutomationStateOutDto,
  // 界面语言：提交任务时保存用户当前使用的语言。
  LocaleValue,
  // 协作任务请求：Renderer 交给主进程的类型化任务快照。
  SubmitCollaborationTaskInDto,
  // 工作区快照：让执行端知道用户已经登记了哪些源码目录。
  WorkspaceStateOutDto,
} from "../../../../contracts/system/desktop/index";
import { getOptionalCollaborationDesktopApi } from "../../../foundation/desktop-api";
import {
  // 流事件合并器：把 Codex 增量事件安全地累加成一条可显示消息。
  applyCodexStreamEvent,
  // 助手消息工厂：每个新流式回合都从统一消息结构开始。
  createAssistantMessage,
} from "../../conversation";
import type {
  // 会话消息：提交任务时读取已确认文本、消息标识和附件。
  Message,
} from "../../conversation";
import type {
  // 协作实时输出：把消息正文和所属回合绑定，防止不同回合互相串流。
  CollaborationLiveOutput,
} from "./collaboration-live-output";

/** 右侧协作区只有“人物会话”和“任务协作群”两个一级页面。 */
export type CollaborationPanel = "member" | "task-group";

/** 已结束任务不再占用人物，也不进入人物当前任务列表。 */
const TERMINAL_TASK_STATES = new Set<CollaborationTaskOutDto["state"]>([
  "integrated",
  "cancelled",
]);

/** 将 Electron 包装的异常前缀移除，只向用户展示真正的业务原因。 */
function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 从会话历史中寻找最后一条用户原始问题，找不到时由调用方使用确认文本。 */
function findLatestUserMessage(messages: Message[]): Message | undefined {
  return [...messages].reverse().find((item) => item.role === "user");
}

/** 收集整轮会话的附件标识，让协作任务仍能访问用户已经提供的材料。 */
function collectAttachmentIds(messages: Message[]): string[] {
  return messages.flatMap((item) => item.attachments || []).map((attachment) => attachment.id);
}

/**
 * 把一轮已确认会话转换成主进程可接收的任务请求。
 * 每个字段都在这里显式组装，页面调用方不需要了解协作快照协议。
 */
function createConversationTaskRequest(
  confirmedMessage: Message,
  messages: Message[],
  workspaces: WorkspaceStateOutDto,
  locale: LocaleValue,
  state: CollaborationStateOutDto | null,
): SubmitCollaborationTaskInDto {
  const latestUserMessage = findLatestUserMessage(messages);
  const originalQuestion = latestUserMessage?.text || confirmedMessage.text;
  const conversationOwner = state?.members.find((member) => member.kind === "conversation-owner");

  return {
    // 任务标题：主进程和任务群使用的短标题，最多保留 80 个字符。
    title: originalQuestion.slice(0, 80),
    // 原始问题：保留用户最后一次提出的真实需求。
    problemStatement: originalQuestion,
    // 确认意图：保存主会话整理并得到确认的执行目标。
    confirmedIntent: confirmedMessage.text,
    // 执行边界：协作执行先停在代码级验证，后续构建由统一测试流程负责。
    constraints: ["协同执行停在代码级验证，不自动进入构建与应用验证"],
    // 验收条件：当前主会话尚未单独收集结构化条件，因此传递空列表。
    acceptanceCriteria: [],
    // 来源消息：用于从任务结果追溯创建它的整轮会话。
    sourceMessageIds: messages.map((item) => item.id),
    // 来源附件：执行人读取本轮会话材料时使用。
    attachmentIds: collectAttachmentIds(messages),
    // 工作区状态：执行端据此确定可用的工程目录和当前选择。
    workspaceState: workspaces,
    // 界面语言：任务侧反馈沿用用户当前语言。
    locale,
    // 合并策略：每个拆分任务独立交付，不在 Renderer 预先合并源码。
    mergeStrategy: "INDEPENDENT",
    // 真实发起人：使用协作状态登记的会话负责人，不根据人物姓名猜测。
    initiatorMemberId: conversationOwner?.memberId,
  };
}

/** 为新流式回合创建一条空的托管助手消息。 */
function createLiveOutput(turnId: string): CollaborationLiveOutput {
  return {
    message: createAssistantMessage(Date.now(), "task-managed"),
    turnId,
  };
}

/**
 * 将一个主进程流事件合并到指定任务或时间线节点。
 * 人物时间线需要保留同一节点的历史；任务流在回合变化时创建新消息。
 */
function mergeLiveOutput(
  current: Record<string, CollaborationLiveOutput>,
  key: string,
  event: CollaborationStreamEventOutDto["event"],
  preserveNodeHistory: boolean,
): Record<string, CollaborationLiveOutput> {
  const existingOutput = current[key];

  let targetOutput = existingOutput;
  const belongsToNewTurn = existingOutput?.turnId !== event.turnId;
  if (!existingOutput || (!preserveNodeHistory && belongsToNewTurn)) {
    targetOutput = createLiveOutput(event.turnId);
  }

  const nextOutput = targetOutput!;
  return {
    ...current,
    [key]: {
      ...nextOutput,
      message: applyCodexStreamEvent(nextOutput.message, event),
    },
  };
}

/** 协作工作区的主进程订阅、页面状态、派生数据和业务操作统一入口。 */
export function useCollaborationWorkspace() {
  // 协作总状态：控制当前模式、成员列表、任务列表和已选人物。
  const [state, setState] = useState<CollaborationStateOutDto | null>(null);
  // 权威时间线：任务群和人物页都从这份 SQLite 投影读取历史。
  const [timeline, setTimeline] = useState<CollaborationTimelineSnapshotOutDto | null>(null);
  // 令狐自动化：令狐人物页显示并更新自动保障运行状态。
  const [linghuAutomation, setLinghuAutomation] = useState<LinghuAutomationStateOutDto | null>(null);
  // 按任务保存的实时输出：主会话中的协作任务状态链使用。
  const [streams, setStreams] = useState<Record<string, CollaborationLiveOutput>>({});
  // 按时间线节点保存的实时输出：任务群和人物页使用。
  const [timelineStreams, setTimelineStreams] = useState<Record<string, CollaborationLiveOutput>>({});
  // 当前协作子页面：默认先显示人物页。
  const [panel, syncPanel] = useState<CollaborationPanel>("member");
  // 导航修订号：重复点击同一入口时也能通知页签重新聚焦。
  const [navigationRevision, setNavigationRevision] = useState(0);
  // 页面错误：集中显示跨进程读取或人工操作失败原因。
  const [error, setError] = useState("");

  useEffect(() => {
    const desktop = getOptionalCollaborationDesktopApi();
    if (!desktop) return;

    /** 重新读取已提交的权威时间线，读取失败时保留当前页面并显示原因。 */
    const refreshTimelineFromDesktop = () => {
      void desktop.getCollaborationTimeline()
        .then(setTimeline)
        .catch((reason) => {
          setError(readableDesktopError(reason, "无法读取任务协作时间线。"));
        });
    };

    // 首次进入页面时读取三份独立状态，后续变化由各自事件通道更新。
    void desktop.getCollaborationState().then((nextState) => {
      setState(nextState);
    });
    refreshTimelineFromDesktop();
    void desktop.getLinghuAutomationState().then((nextState) => {
      setLinghuAutomation(nextState);
    });

    // 成员或任务变化时，主进程会推送完整协作状态。
    const removeStateListener = desktop.onCollaborationState((event: CollaborationStateEventOutDto) => {
      setState(event.state);
    });

    // 时间线只在事务提交事件到达后重新读取，避免 Renderer 自己拼接审计历史。
    const removeTimelineListener = desktop.onCollaborationTimelineChanged(refreshTimelineFromDesktop);

    // 令狐自动化有独立生命周期，不能从普通协作成员状态推断。
    const removeLinghuListener = desktop.onLinghuAutomationState((event: LinghuAutomationStateEventOutDto) => {
      setLinghuAutomation(event.state);
    });

    // 同一流事件分别归档到任务和具体时间线节点，服务两个不同展示区域。
    const removeStreamListener = desktop.onCollaborationStream((envelope: CollaborationStreamEventOutDto) => {
      setStreams((current) => mergeLiveOutput(current, envelope.taskId, envelope.event, false));

      if (envelope.timelineNodeId) {
        setTimelineStreams((current) => mergeLiveOutput(
          current,
          envelope.timelineNodeId!,
          envelope.event,
          true,
        ));
      }
    });

    // 页面卸载时释放全部 Electron 事件监听，防止重复订阅和内存泄漏。
    return () => {
      removeStateListener();
      removeTimelineListener();
      removeLinghuListener();
      removeStreamListener();
    };
  }, []);

  /** 切换协作子页面，并通知外层页签聚焦本次导航。 */
  const setPanel = (nextPanel: CollaborationPanel) => {
    syncPanel(nextPanel);
    setNavigationRevision((current) => current + 1);
  };

  // 当前是否处于多人协作模式。
  const collaborationMode = state?.mode === "collaboration";
  // 当前人物必须来自后端成员列表，找不到时明确返回空。
  const selectedMember = state?.members.find((member) => member.memberId === state.selectedMemberId) || null;
  // 人物当前任务只保留未结束且确实由该人物发起、执行或参与过的任务。
  const selectedMemberTasks = state?.tasks.filter((task) => {
    if (TERMINAL_TASK_STATES.has(task.state)) return false;
    if (task.initiator?.memberId === selectedMember?.memberId) return true;
    if (task.executorMemberId === selectedMember?.memberId) return true;
    return task.executionRecords.some((record) => record.executor.memberId === selectedMember?.memberId);
  }) || [];

  /** 统一接收主进程写操作返回的新协作状态。 */
  const applyStateRequest = async (request: Promise<CollaborationStateOutDto> | undefined) => {
    const nextState = await request;
    if (nextState) setState(nextState);
    return nextState;
  };

  /** 切换普通会话或多人协作运行模式。 */
  const setOperatingMode = (mode: DesktopOperatingModeValue) => {
    return applyStateRequest(getOptionalCollaborationDesktopApi()?.setDesktopOperatingMode(mode));
  };

  /** 选择右侧要打开的协作成员。 */
  const selectMember = (memberId: string) => {
    return applyStateRequest(getOptionalCollaborationDesktopApi()?.selectCollaborationMember(memberId));
  };

  /** 提交已经构造好的类型化协作任务。 */
  const submitTask = (request: SubmitCollaborationTaskInDto) => {
    return applyStateRequest(getOptionalCollaborationDesktopApi()?.submitCollaborationTask(request));
  };

  /** 把已确认的主会话事实冻结为协作任务，并返回本次创建的任务。 */
  const submitConversationTask = async (
    message: Message,
    messages: Message[],
    workspaces: WorkspaceStateOutDto,
    locale: LocaleValue,
  ) => {
    const request = createConversationTaskRequest(message, messages, workspaces, locale, state);
    const nextState = await submitTask(request);

    const tasksCreatedFromMessage = nextState?.tasks.filter((candidate) => {
      return candidate.snapshot.sourceMessageIds.includes(message.id);
    }) || [];

    return tasksCreatedFromMessage.sort((left, right) => {
      return right.createdAt.localeCompare(left.createdAt);
    })[0];
  };

  /** 从最近保存的恢复点继续协作任务。 */
  const continueTask = (taskId: string) => {
    return applyStateRequest(getOptionalCollaborationDesktopApi()?.continueCollaborationTask(taskId));
  };

  /** 取消尚未结束的协作任务。 */
  const cancelTask = (taskId: string) => {
    return applyStateRequest(getOptionalCollaborationDesktopApi()?.cancelCollaborationTask(taskId));
  };

  /** 主动读取一次最新时间线，人工审批完成后使用。 */
  const refreshTimeline = async () => {
    const nextTimeline = await getOptionalCollaborationDesktopApi()?.getCollaborationTimeline();
    if (nextTimeline) setTimeline(nextTimeline);
    return nextTimeline;
  };

  // 公开返回值按“原始状态、页面状态、派生信息、业务操作”排列，调用方可顺序查找。
  return {
    state,
    setState,
    timeline,
    setTimeline,
    linghuAutomation,
    setLinghuAutomation,
    streams,
    timelineStreams,
    panel,
    setPanel,
    error,
    setError,
    navigationRevision,
    syncPanel,
    terminalStates: TERMINAL_TASK_STATES,
    collaborationMode,
    selectedMember,
    selectedMemberTasks,
    setOperatingMode,
    selectMember,
    submitTask,
    submitConversationTask,
    continueTask,
    cancelTask,
    refreshTimeline,
  };
}
