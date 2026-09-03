import { useEffect, useRef, useState } from "react";

import type { CollaborationStateEventOutDto, CollaborationStateOutDto, CollaborationStreamEventOutDto, CollaborationTaskOutDto, CollaborationTimelineSnapshotOutDto, CreateCollaborationMemberInDto, DesktopOperatingModeValue, LinghuAutomationStateEventOutDto, LinghuAutomationStateOutDto, LocaleValue, SubmitCollaborationTaskInDto, UpdateCollaborationMemberInDto, WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";
import { applyCodexStreamEvent, createAssistantMessage, type Message } from "../../conversation/model/chat-message";
import { deriveCollaborationTaskCurrentStage } from "./collaboration-task-progress";
import type { CollaborationLiveOutput } from "./collaboration-live-output";

export type CollaborationPanel = "member" | "execution-list" | "task-group" | "task-detail";

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 协同工作区的主进程订阅、流式输出归档和当前选择派生状态。 */
export function useCollaborationWorkspace() {
  const [state, setState] = useState<CollaborationStateOutDto | null>(null);
  const [timeline, setTimeline] = useState<CollaborationTimelineSnapshotOutDto | null>(null);
  const [linghuAutomation, setLinghuAutomation] = useState<LinghuAutomationStateOutDto | null>(null);
  const [streams, setStreams] = useState<Record<string, CollaborationLiveOutput>>({});
  const [timelineStreams, setTimelineStreams] = useState<Record<string, CollaborationLiveOutput>>({});
  const [panel, setPanel] = useState<CollaborationPanel>("member");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const stateRef = useRef<CollaborationStateOutDto | null>(null);
  const linghuAutomationRef = useRef<LinghuAutomationStateOutDto | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { linghuAutomationRef.current = linghuAutomation; }, [linghuAutomation]);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    const refreshTimeline = () => void desktop.getCollaborationTimeline().then(setTimeline)
      .catch((reason) => setError(readableDesktopError(reason, "无法读取任务协作时间线。")));
    void desktop.getCollaborationState().then((value) => { stateRef.current = value; setState(value); });
    refreshTimeline();
    void desktop.getLinghuAutomationState().then((value) => { linghuAutomationRef.current = value; setLinghuAutomation(value); });
    const removeStateListener = desktop.onCollaborationState((event: CollaborationStateEventOutDto) => { stateRef.current = event.state; setState(event.state); });
    const removeTimelineListener = desktop.onCollaborationTimelineChanged(refreshTimeline);
    const removeLinghuListener = desktop.onLinghuAutomationState((event: LinghuAutomationStateEventOutDto) => { linghuAutomationRef.current = event.state; setLinghuAutomation(event.state); });
    const removeStreamListener = desktop.onCollaborationStream((envelope: CollaborationStreamEventOutDto) => {
      const updateStream = (current: Record<string, CollaborationLiveOutput>, key: string, preserveNodeHistory = false) => {
        const existing = current[key];
        const task = stateRef.current?.tasks.find((candidate) => candidate.taskId === envelope.taskId);
        const next = preserveNodeHistory && existing
          ? existing
          : existing?.turnId === envelope.event.turnId
            ? existing
            : {
              message: createAssistantMessage(Date.now(), "task-managed"),
              stageId: task ? deriveCollaborationTaskCurrentStage(task, linghuAutomationRef.current) : "intent",
              turnId: envelope.event.turnId,
            };
        return { ...current, [key]: { ...next, message: applyCodexStreamEvent(next.message, envelope.event) } };
      };
      setStreams((current) => updateStream(current, envelope.taskId));
      if (envelope.timelineNodeId) setTimelineStreams((current) => updateStream(current, envelope.timelineNodeId!, true));
    });
    return () => { removeStateListener(); removeTimelineListener(); removeLinghuListener(); removeStreamListener(); };
  }, []);

  const terminalStates = new Set<CollaborationTaskOutDto["state"]>(["integrated", "cancelled"]);
  const collaborationMode = state?.mode === "collaboration";
  const selectedMember = state?.members.find((member) => member.memberId === state.selectedMemberId) || null;
  const completedTasks = state?.tasks.filter((task) => terminalStates.has(task.state)).sort((left, right) => (right.completedAt || right.updatedAt).localeCompare(left.completedAt || left.updatedAt)) || [];
  const selectedMemberTasks = state?.tasks.filter((task) => !terminalStates.has(task.state) && (
    task.initiator?.memberId === selectedMember?.memberId
    || task.executorMemberId === selectedMember?.memberId
    || task.executionRecords.some((record) => record.executor.memberId === selectedMember?.memberId)
  )) || [];
  const selectedTask = state?.tasks.find((task) => task.taskId === selectedTaskId) || null;
  const selectedTaskMember = selectedTask
    ? state?.members.find((member) => member.memberId === selectedTask.executorMemberId)
      || state?.members.find((member) => member.memberId === selectedTask.initiator?.memberId)
      || selectedMember
    : null;

  const applyState = async (request: Promise<CollaborationStateOutDto> | undefined) => {
    const next = await request;
    if (next) setState(next);
    return next;
  };
  const setOperatingMode = (mode: DesktopOperatingModeValue) => applyState(window.desktop?.setDesktopOperatingMode(mode));
  const selectMember = (memberId: string) => applyState(window.desktop?.selectCollaborationMember(memberId));
  const createMember = (request: CreateCollaborationMemberInDto) => applyState(window.desktop?.createCollaborationMember(request));
  const updateMember = (memberId: string, request: UpdateCollaborationMemberInDto) => applyState(window.desktop?.updateCollaborationMember(memberId, request));
  const deleteMember = (memberId: string) => applyState(window.desktop?.deleteCollaborationMember(memberId));
  const submitTask = (request: SubmitCollaborationTaskInDto) => applyState(window.desktop?.submitCollaborationTask(request));
  /** 把已确认的主会话事实冻结为协作任务，避免 Application 理解协作快照结构。 */
  const submitConversationTask = async (message: Message, messages: Message[], workspaces: WorkspaceStateOutDto, locale: LocaleValue) => {
    const latestUser = [...messages].reverse().find((item) => item.role === "user");
    const attachmentIds = messages.flatMap((item) => item.attachments || []).map((attachment) => attachment.id);
    const next = await submitTask({
      title: (latestUser?.text || message.text).slice(0, 80),
      problemStatement: latestUser?.text || message.text,
      confirmedIntent: message.text,
      constraints: ["协同执行停在代码级验证，不自动进入构建与应用验证"],
      acceptanceCriteria: [],
      sourceMessageIds: messages.map((item) => item.id),
      attachmentIds,
      workspaceState: workspaces,
      locale,
      mergeStrategy: "INDEPENDENT",
      initiatorMemberId: state?.members.find((member) => member.kind === "conversation-owner")?.memberId,
    });
    return next?.tasks
      .filter((candidate) => candidate.snapshot.sourceMessageIds.includes(message.id))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  };
  const continueTask = (taskId: string) => applyState(window.desktop?.continueCollaborationTask(taskId));
  const cancelTask = (taskId: string) => applyState(window.desktop?.cancelCollaborationTask(taskId));
  const refreshTimeline = async () => {
    const next = await window.desktop?.getCollaborationTimeline();
    if (next) setTimeline(next);
    return next;
  };

  return {
    state, setState, timeline, setTimeline, linghuAutomation, setLinghuAutomation, streams, timelineStreams, panel, setPanel,
    error, setError,
    selectedTaskId, setSelectedTaskId, terminalStates, collaborationMode, selectedMember, completedTasks,
    selectedMemberTasks, selectedTask, selectedTaskMember, setOperatingMode, selectMember, createMember, updateMember,
    deleteMember, submitTask, submitConversationTask, continueTask, cancelTask, refreshTimeline,
  };
}
