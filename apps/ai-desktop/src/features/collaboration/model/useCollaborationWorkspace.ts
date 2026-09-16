/**
 * 协作工作区状态控制器。
 *
 * 真实页面入口位于 Developer 窗口。左侧“任务”区域和右侧协作工作区共用本 Hook，
 * 因而页面组件只需要读取状态和调用操作，不需要理解 Electron IPC 的订阅细节。
 */

// React 生命周期：页面打开时建立主进程订阅，页面关闭时释放订阅。
import { useEffect, useRef } from "react";
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
import {
  reconcileChangedCollaborationTimeline,
  reconcileCollaborationTimeline,
  reconcileInitialCollaborationTimeline,
} from "./reconcileCollaborationTimeline";

/** 右侧协作区只有“人物会话”和“任务协作群”两个一级页面。 */
export type CollaborationPanel = "member" | "task-group";
/** 协作状态存储的当前读取结果，和时间线读取结果分开保存。 */
export type CollaborationStateReadStatus = "syncing" | "ready" | "unavailable";

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
  input: {
    /** 已经获得用户确认、即将转换为协作任务的消息。 */
    confirmedMessage: Message;
    /** 当前完整会话，用于寻找原始问题、来源消息和附件。 */
    messages: Message[];
    /** 当前登记的工作区边界。 */
    workspaces: WorkspaceStateOutDto;
    /** 当前界面语言。 */
    locale: LocaleValue;
    /** 当前协作状态，用于确定真实会话负责人。 */
    state: CollaborationStateOutDto | null;
  },
): SubmitCollaborationTaskInDto {
  // 具名输入让调用方无需记忆五个相邻业务参数的位置顺序。
  const { confirmedMessage, messages, workspaces, locale, state } = input;
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
  input: {
    /** 当前按任务或节点保存的实时输出。 */
    current: Record<string, CollaborationLiveOutput>;
    /** 本次增量所属的任务或时间线节点标识。 */
    key: string;
    /** 主进程推送的单个 Codex 流事件。 */
    event: CollaborationStreamEventOutDto["event"];
    /** 新回合到来时是保留节点历史，还是为任务建立新输出。 */
    historyMode: "preserve-node-history" | "reset-on-new-turn";
  },
): Record<string, CollaborationLiveOutput> {
  // 具名输入和枚举式策略替代含义不明确的布尔位置参数。
  const { current, key, event, historyMode } = input;
  const existingOutput = current[key];

  let targetOutput = existingOutput;
  const belongsToNewTurn = existingOutput?.turnId !== event.turnId;
  if (!existingOutput || (historyMode === "reset-on-new-turn" && belongsToNewTurn)) {
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

/**
 * 先接通实时事件，再读取当前快照；启动期间若已有新事件到达，迟到的旧快照不能覆盖它。
 * 所有人物页面共享这一入口，避免各页面分别处理 Electron 初始化竞态。
 */
function connectAuthoritativeSnapshot<Snapshot>(input: {
  read: () => Promise<Snapshot>;
  subscribe: (listener: (snapshot: Snapshot) => void) => () => void;
  apply: (snapshot: Snapshot) => void;
  unavailable: (reason: unknown) => void;
}): () => void {
  let disposed = false;
  let receivedEvent = false;
  const unsubscribe = input.subscribe((snapshot) => {
    receivedEvent = true;
    if (!disposed) input.apply(snapshot);
  });

  void input.read()
    .then((snapshot) => {
      if (!disposed && !receivedEvent) input.apply(snapshot);
    })
    .catch((reason) => {
      if (!disposed && !receivedEvent) input.unavailable(reason);
    });

  return () => {
    disposed = true;
    unsubscribe();
  };
}

/** 订阅只通知“数据已变化”时，以递增读取序号保证最后发起的权威读取最后生效。 */
function connectAuthoritativeRefresh<Snapshot>(input: {
  read: () => Promise<Snapshot>;
  subscribe: (refresh: () => void) => () => void;
  apply: (snapshot: Snapshot) => void;
  unavailable: (reason: unknown) => void;
}): () => void {
  let disposed = false;
  let readSequence = 0;
  const refresh = () => {
    const currentSequence = ++readSequence;
    void input.read()
      .then((snapshot) => {
        if (!disposed && currentSequence === readSequence) input.apply(snapshot);
      })
      .catch((reason) => {
        if (!disposed && currentSequence === readSequence) input.unavailable(reason);
      });
  };
  const unsubscribe = input.subscribe(refresh);
  refresh();
  return () => {
    disposed = true;
    unsubscribe();
  };
}

/** 受控性能 fixture 通过根元素数据属性指定相同数据集及对比阶段；普通页面沿用候选阶段默认值。 */
function interactionPerformanceContext(): { datasetId: string; phase: "baseline" | "candidate" } {
  const datasetId = document.documentElement.dataset.collaborationPerformanceDataset?.trim() || "retained-history";
  const phase = document.documentElement.dataset.collaborationPerformancePhase;
  return { datasetId, phase: phase === "baseline" ? "baseline" : "candidate" };
}

/** 交互样本只在性能 API 可用时异步落入临时目录，不影响页面和协作事实。 */
function recordInteractionPerformance(operation: string, startedAt: number, details: Record<string, string | number | boolean | null>): void {
  const desktop = getOptionalCollaborationDesktopApi();
  if (!desktop) return;
  const context = interactionPerformanceContext();
  void desktop.recordCollaborationInteractionPerformance({ operation, durationMs: Math.max(0, performance.now() - startedAt), datasetId: context.datasetId, phase: context.phase, details });
}

/** 协作工作区的主进程订阅、页面状态、派生数据和业务操作统一入口。 */
export function useCollaborationWorkspace() {
  // 协作总状态：控制当前模式、成员列表、任务列表和已选人物。
  const [state, setState] = useState<CollaborationStateOutDto | null>(null);
  // 状态未返回或读取失败时，人物区域不能用旧时间线冒充当前成员状态。
  const [stateReadStatus, setStateReadStatus] = useState<CollaborationStateReadStatus>("syncing");
  // 权威时间线：任务群和人物页都从这份 SQLite 投影读取历史。
  const [timeline, setTimeline] = useState<CollaborationTimelineSnapshotOutDto | null>(null);
  const [timelineReadStatus, setTimelineReadStatus] = useState<CollaborationStateReadStatus>("syncing");
  const [timelineReadError, setTimelineReadError] = useState("");
  // 令狐自动化：令狐人物页显示并更新自动保障运行状态。
  const [linghuAutomation, setLinghuAutomation] = useState<LinghuAutomationStateOutDto | null>(null);
  // 按任务保存的实时输出：主会话中的协作任务状态链使用。
  const [streams, setStreams] = useState<Record<string, CollaborationLiveOutput>>({});
  // 按时间线节点保存的实时输出：任务群和人物页使用。
  const [timelineStreams, setTimelineStreams] = useState<Record<string, CollaborationLiveOutput>>({});
  // 当前协作子页面：默认先显示人物页。
  const [panel, syncPanel] = useState<CollaborationPanel>("member");
  // 当前查看人物只是 Renderer 导航偏好，不能再写入协作成员和任务事实。
  const [selectedMemberId, setSelectedMemberId] = useState("han-li");
  // 保存中的人物只影响对应按钮，其他人物仍可立即切换。
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const navigationIntent = useRef(0);
  const navigationPreferenceRestored = useRef(false);
  const timelineGroupVersions = useRef(new Map<string, number>());
  // 导航修订号：重复点击同一入口时也能通知页签重新聚焦。
  const [navigationRevision, setNavigationRevision] = useState(0);
  // 页面错误：集中显示跨进程读取或人工操作失败原因。
  const [error, setError] = useState("");

  useEffect(() => {
    const desktop = getOptionalCollaborationDesktopApi();
    if (!desktop) {
      setStateReadStatus("unavailable");
      setError("无法连接协作状态服务。");
      return;
    }

    // 先建立事件订阅再读初始快照，防止应用恢复任务时的新状态被迟到的启动快照覆盖。
    const removeStateListener = connectAuthoritativeSnapshot({
      read: () => desktop.getCollaborationState(),
      subscribe: (listener) => desktop.onCollaborationState((event: CollaborationStateEventOutDto) => listener(event.state)),
      apply: (nextState) => {
        setState(nextState);
        setStateReadStatus("ready");
      },
      unavailable: (reason) => {
        setStateReadStatus("unavailable");
        setError(readableDesktopError(reason, "无法读取协作状态。"));
      },
    });
    // 首次读取完整权威快照；后续只读取提交通知指定的专题卡。
    let timelineDisposed = false;
    let initialTimelineReadPending = true;
    const changedGroupIdsDuringInitialRead = new Set<string>();
    const readInitialTimeline = () => void desktop.getCollaborationTimeline()
      .then((snapshot) => {
        initialTimelineReadPending = false;
        if (!timelineDisposed) {
          setTimeline((current) => reconcileInitialCollaborationTimeline(current, snapshot, changedGroupIdsDuringInitialRead));
          setTimelineReadStatus("ready");
          setTimelineReadError("");
        }
      })
      .catch((reason) => {
        initialTimelineReadPending = false;
        if (!timelineDisposed) {
          setTimelineReadStatus("unavailable");
          setTimelineReadError(readableDesktopError(reason, "无法读取任务协作时间线。"));
        }
      });
    const removeTimelineListener = desktop.onCollaborationTimelineChanged((event) => {
      const changedGroupIds = event.groupIds.filter((groupId) => {
        const version = event.groupVersions[groupId];
        if (!Number.isInteger(version) || version < 1) return false;
        const previousVersion = timelineGroupVersions.current.get(groupId) || 0;
        if (version <= previousVersion) return false;
        timelineGroupVersions.current.set(groupId, version);
        return true;
      });
      if (initialTimelineReadPending) changedGroupIds.forEach((groupId) => changedGroupIdsDuringInitialRead.add(groupId));
      if (!changedGroupIds.length) return;
      const requestedVersions = new Map(changedGroupIds.map((groupId) => [groupId, timelineGroupVersions.current.get(groupId)!]));
      const startedAt = performance.now();
      void desktop.getCollaborationTimelineGroups(changedGroupIds)
        .then((snapshot) => {
          if (timelineDisposed || changedGroupIds.some((groupId) => timelineGroupVersions.current.get(groupId) !== requestedVersions.get(groupId))) return;
          setTimeline((current) => reconcileChangedCollaborationTimeline(current, snapshot, changedGroupIds));
          setTimelineReadStatus("ready");
          setTimelineReadError("");
          recordInteractionPerformance("timeline-read-processing", startedAt, { groupCount: changedGroupIds.length });
        })
        .catch((reason) => {
          // 同一版本的读取失败不能被视为已消费；保留最近成功内容并允许该专题的下一次通知或人工重读再次请求。
          for (const groupId of changedGroupIds) if (timelineGroupVersions.current.get(groupId) === requestedVersions.get(groupId)) timelineGroupVersions.current.delete(groupId);
          if (!timelineDisposed) { setTimelineReadStatus("unavailable"); setTimelineReadError(readableDesktopError(reason, "无法读取已变化专题。")); }
        });
    });
    readInitialTimeline();
    const removeLinghuListener = connectAuthoritativeSnapshot({
      read: () => desktop.getLinghuAutomationState(),
      subscribe: (listener) => desktop.onLinghuAutomationState((event: LinghuAutomationStateEventOutDto) => listener(event.state)),
      apply: setLinghuAutomation,
      unavailable: (reason) => setError(readableDesktopError(reason, "无法读取令狐自动巡检状态。")),
    });

    // 同一流事件分别归档到任务和具体时间线节点，服务两个不同展示区域。
    const removeStreamListener = desktop.onCollaborationStream((envelope: CollaborationStreamEventOutDto) => {
      setStreams((current) => mergeLiveOutput({
        current,
        key: envelope.taskId,
        event: envelope.event,
        historyMode: "reset-on-new-turn",
      }));

      if (envelope.timelineNodeId) {
        setTimelineStreams((current) => mergeLiveOutput({
          current,
          key: envelope.timelineNodeId!,
          event: envelope.event,
          historyMode: "preserve-node-history",
        }));
      }
    });

    // 页面卸载时释放全部 Electron 事件监听，防止重复订阅和内存泄漏。
    return () => {
      removeStateListener();
      timelineDisposed = true;
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
  // 首次取得成员清单后恢复主进程已校验的导航偏好；用户先点击时不接受迟到的恢复结果。
  useEffect(() => {
    const desktop = getOptionalCollaborationDesktopApi();
    if (!desktop || !state?.members.length || navigationPreferenceRestored.current) return;
    navigationPreferenceRestored.current = true;
    const intentAtRead = navigationIntent.current;
    void desktop.getCollaborationNavigationPreference().then((memberId) => {
      if (memberId && navigationIntent.current === intentAtRead) setSelectedMemberId(memberId);
    }).catch((reason) => setError(readableDesktopError(reason, "无法恢复上次查看的人物。")));
  }, [state]);
  // 状态恢复后校验本地导航目标；已退出成员时回退到会话负责人。
  useEffect(() => {
    if (!state?.members.length) return;
    if (state.members.some((member) => member.memberId === selectedMemberId)) return;
    setSelectedMemberId(state.members.find((member) => member.kind === "conversation-owner")?.memberId || state.members[0]!.memberId);
  }, [selectedMemberId, state]);
  // 当前人物必须来自后端成员列表，找不到时明确返回空。
  const selectedMember = state?.members.find((member) => member.memberId === selectedMemberId) || null;
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

  /** 选择右侧要打开的协作成员；先切换页面，偏好保存保持异步且不触发协作状态同步。 */
  const selectMember = async (memberId: string) => {
    navigationIntent.current += 1;
    const intent = navigationIntent.current;
    const startedAt = performance.now();
    setSelectedMemberId(memberId);
    setSavingMemberId(memberId);
    requestAnimationFrame(() => requestAnimationFrame(() => recordInteractionPerformance("member-page-feedback", startedAt, { memberId })));
    const desktop = getOptionalCollaborationDesktopApi();
    if (!desktop) {
      setSavingMemberId(null);
      setError("无法连接协作导航偏好服务。");
      return;
    }
    const ipcStartedAt = performance.now();
    void desktop.saveCollaborationNavigationPreference(memberId)
      .then(() => recordInteractionPerformance("navigation-preference-ipc", ipcStartedAt, { memberId }))
      .catch((reason) => { if (navigationIntent.current === intent) setError(readableDesktopError(reason, "无法保存查看位置，请重试。")); })
      .finally(() => { if (navigationIntent.current === intent) setSavingMemberId(null); });
  };

  /** 选择成员并切换到对应人物页，不创建或提交协作任务。 */
  const openMemberPage = async (memberId: string) => {
    setPanel("member");
    void selectMember(memberId);
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
    const request = createConversationTaskRequest({
      confirmedMessage: message,
      messages,
      workspaces,
      locale,
      state,
    });
    const nextState = await submitTask(request);

    const tasksCreatedFromMessage = nextState?.tasks.filter((candidate) => {
      return candidate.snapshot.sourceMessageIds.includes(message.id);
    }) || [];

    return tasksCreatedFromMessage.sort((left, right) => {
      return right.createdAt.localeCompare(left.createdAt);
    })[0];
  };

  /** 从最近保存的恢复点继续协作任务。 */
  const continueTask = async (taskId: string) => {
    const desktop = getOptionalCollaborationDesktopApi();
    // API 不可用不能伪装成已恢复；调用方会结束按钮忙碌并显示这条可重试错误。
    if (!desktop) throw new Error("无法连接协作状态服务。");
    return applyStateRequest(desktop.continueCollaborationTask(taskId));
  };

  /** 取消尚未结束的协作任务。 */
  const cancelTask = (taskId: string) => {
    return applyStateRequest(getOptionalCollaborationDesktopApi()?.cancelCollaborationTask(taskId));
  };

  /** 主动读取一次最新时间线，人工审批完成后使用。 */
  const refreshTimeline = async () => {
    setTimelineReadStatus("syncing");
    try {
      const nextTimeline = await getOptionalCollaborationDesktopApi()?.getCollaborationTimeline();
      if (nextTimeline) { setTimeline((current) => reconcileCollaborationTimeline(current, nextTimeline)); setTimelineReadStatus("ready"); setTimelineReadError(""); }
      return nextTimeline;
    } catch (error) { setTimelineReadStatus("unavailable"); setTimelineReadError(readableDesktopError(error, "无法读取任务协作时间线。")); throw error; }
  };

  /** 恢复等待超时后同时重读主进程协作状态和已落库时间线。 */
  const refreshRecoveryState = async () => {
    const desktop = getOptionalCollaborationDesktopApi();
    if (!desktop) throw new Error("无法连接协作状态服务。");
    const [nextState, nextTimeline] = await Promise.all([
      desktop.getCollaborationState(),
      desktop.getCollaborationTimeline(),
    ]);
    setState(nextState);
    setStateReadStatus("ready");
    setTimeline((current) => reconcileCollaborationTimeline(current, nextTimeline));
    return { state: nextState, timeline: nextTimeline };
  };

  // 公开返回值按“权威数据、导航状态、反馈、业务操作、稳定配置”分组，调用方不再面对二十多个平铺字段。
  return {
    // 权威数据（data）来自主进程状态、SQLite 时间线或实时事件投影。
    data: {
      // 协作总状态：保存模式、成员、任务和当前后端选择。
      state,
      // 状态读取结果：人物显示模型据此展示同步或未更新，而不沿用历史任务状态。
      stateReadStatus,
      // 权威时间线：保存已经落库的专题和人物节点。
      timeline,
      timelineReadStatus,
      timelineReadError,
      // 令狐自动化：保存自动保障和会话显示边界。
      linghuAutomation,
      // 任务实时输出：供主 Codex 会话中的协作状态链读取。
      streams,
      // 节点实时输出：供任务群和人物页面读取。
      timelineStreams,
    },
    // 导航状态（navigation）只描述当前打开的协作页面和对应人物任务。
    navigation: {
      // 当前面板：区分人物页面和任务协作群页面。
      panel,
      // 导航修订号：重复选择相同目标时仍可通知页签聚焦。
      revision: navigationRevision,
      // 协作模式：说明当前是否启用多人协作工作区。
      collaborationMode,
      // 当前人物：从权威成员列表解析，缺失时明确为空。
      selectedMember,
      selectedMemberId,
      savingMemberId,
      // 当前人物任务：只保留尚未结束且与该人物真实相关的任务。
      selectedMemberTasks,
    },
    // 页面反馈（feedback）集中承载跨进程读取或业务操作错误。
    feedback: {
      // 当前错误：由工作区统一显示，空字符串表示没有错误。
      error,
    },
    // 业务操作（actions）是调用方允许触发的状态更新和跨进程动作。
    actions: {
      // 协作状态写入：接收主进程返回的完整新状态。
      setState,
      // 时间线写入：接收重新读取的权威时间线。
      setTimeline,
      // 令狐状态写入：接收令狐操作返回的新状态。
      setLinghuAutomation,
      // 导航切换：更新面板并递增导航修订号。
      setPanel,
      // 面板同步：只更新当前面板，不递增导航修订号。
      syncPanel,
      // 错误写入：统一清除或显示协作页面错误。
      setError,
      // 模式切换：请求主进程切换单会话或多人协作模式。
      setOperatingMode,
      // 人物选择：请求主进程保存当前协作成员。
      selectMember,
      // 人物页导航：选择成员成功后打开对应人物会话，不涉及任务提交。
      openMemberPage,
      // 任务提交：提交已经构造好的类型化协作任务。
      submitTask,
      // 会话任务提交：把已确认主会话转换并提交为协作任务。
      submitConversationTask,
      // 任务继续：从主进程保存的最近恢复点继续协作任务。
      continueTask,
      // 任务取消：取消尚未进入终态的协作任务。
      cancelTask,
      // 时间线刷新：人工审批后重新读取已经落库的历史。
      refreshTimeline,
      // 恢复复查：一次读取协作状态和时间线，供页面结束本地等待。
      refreshRecoveryState,
    },
    // 稳定配置（configuration）公开任务终态集合，供路由派生只读人物视图。
    configuration: {
      // 任务终态集合：统一判断任务是否仍占用人物或允许继续操作。
      terminalTaskStates: TERMINAL_TASK_STATES,
    },
  };
}
