import type { BrowserWindow } from "electron";
import type { EvolutionStateOutDto, CurrentTopicStageOutDto } from "../../../../../../contracts/services/evolution/index.js";
import type { CollaborationStateOutDto, CollaborationTimelineGroupOutDto, CollaborationTimelineSnapshotOutDto } from "../../../../../../contracts/services/workflow/index.js";
import type { HanliComputerAcceptanceInDto } from "../../../../../../contracts/services/personas/hanli/index.js";

/**
 * 韩立正式验收期间的内存专题场景。
 *
 * 它只为绑定的窗口临时覆盖读模型，用于观察“无指导、完整指导、复查中、新阻塞”四个
 * 已批准验收状态；绝不写入 Evolution、协作任务、SQLite 时间线或历史档案。
 */
export class HanliTaskCollaborationScenario {
  #active: ActiveScenario | null = null;

  constructor(
    private readonly readState: () => EvolutionStateOutDto,
    private readonly readTimeline: () => CollaborationTimelineSnapshotOutDto,
    private readonly readCollaborationState: () => CollaborationStateOutDto,
    private readonly publish: (window: BrowserWindow, state: EvolutionStateOutDto, timeline: CollaborationTimelineSnapshotOutDto, reason: string) => void,
  ) {}

  begin(window: BrowserWindow, goal: HanliComputerAcceptanceInDto): void {
    if (this.#active) throw new Error("任务协作群验收场景已在运行。");
    const state = this.readState();
    const baseStage = state.currentTopicStage;
    const group = this.readTimeline().groups.find((item) => item.topicId === goal.topicId && item.proposalId === goal.proposalId);
    if (!baseStage || !group) throw new Error("当前专题缺少正式阶段或时间线，不能建立隔离验收场景。");
    this.#active = {
      window,
      webContentsId: window.webContents.id,
      goal,
      baseState: state,
      baseTimeline: this.readTimeline(),
      group,
      stage: 0,
      taskId: `hanli-acceptance-scenario:${goal.topicId}:${goal.proposalId}`,
    };
    this.#publish("acceptance-scenario.no-guidance");
  }

  /** 场景步骤由验收器显式推进，不能由页面或普通 IPC 任意跳转。 */
  advance(webContentsId: number): void {
    const active = this.#requireActive(webContentsId);
    if (active.stage === 0) active.stage = 1;
    else if (active.stage === 2) active.stage = 3;
    else throw new Error("当前验收场景不能推进；请先观察或提交当前唯一确认入口。");
    this.#publish("acceptance-scenario.advance");
  }

  /** 当前窗口进入场景时，普通继续入口必须仍被阻断。 */
  isActiveFor(webContentsId: number): boolean {
    return this.#active?.webContentsId === webContentsId;
  }

  /** 只有场景窗口、专用任务标识和“完整指导”阶段同时成立时才接受确认。 */
  confirm(webContentsId: number, taskId: string): CollaborationStateOutDto | null {
    const active = this.#active;
    if (!active || active.webContentsId !== webContentsId || active.taskId !== taskId || active.stage !== 1) return null;
    active.stage = 2;
    this.#publish("acceptance-scenario.confirmed");
    // 返回真实协作快照但不调用 continueTask，页面操作不会写入任何任务事实。
    return this.readCollaborationState();
  }

  stateFor(webContentsId: number, actual: EvolutionStateOutDto): EvolutionStateOutDto {
    const active = this.#active;
    if (!active || active.webContentsId !== webContentsId) return actual;
    return { ...actual, currentTopicStage: createStage(active.baseState.currentTopicStage!, active) };
  }

  timelineFor(webContentsId: number, actual: CollaborationTimelineSnapshotOutDto): CollaborationTimelineSnapshotOutDto {
    const active = this.#active;
    if (!active || active.webContentsId !== webContentsId) return actual;
    // 固定开始时的只读快照，避免正式后台事件改变场景中的历史对照。
    return { ...active.baseTimeline, updatedAt: new Date().toISOString(), groups: active.baseTimeline.groups.map((group) => group.groupId === active.group.groupId ? presentGroup(group, active) : group) };
  }

  timelineGroupsFor(webContentsId: number, groupIds: string[], actual: CollaborationTimelineSnapshotOutDto): CollaborationTimelineSnapshotOutDto {
    const snapshot = this.timelineFor(webContentsId, actual);
    return { ...snapshot, groups: snapshot.groups.filter((group) => groupIds.includes(group.groupId)) };
  }

  end(webContentsId: number): void {
    const active = this.#active;
    if (!active || active.webContentsId !== webContentsId) return;
    this.#active = null;
    if (!active.window.isDestroyed()) this.publish(active.window, this.readState(), this.readTimeline(), "acceptance-scenario.ended");
  }

  #requireActive(webContentsId: number): ActiveScenario {
    const active = this.#active;
    if (!active || active.webContentsId !== webContentsId) throw new Error("当前窗口没有活动的任务协作群验收场景。");
    return active;
  }

  #publish(reason: string): void {
    const active = this.#active;
    if (!active || active.window.isDestroyed()) return;
    this.publish(active.window, this.stateFor(active.webContentsId, this.readState()), this.timelineFor(active.webContentsId, this.readTimeline()), reason);
  }
}

type ActiveScenario = {
  window: BrowserWindow;
  webContentsId: number;
  goal: HanliComputerAcceptanceInDto;
  baseState: EvolutionStateOutDto;
  baseTimeline: CollaborationTimelineSnapshotOutDto;
  group: CollaborationTimelineGroupOutDto;
  stage: 0 | 1 | 2 | 3;
  taskId: string;
};

function createStage(base: CurrentTopicStageOutDto, active: ActiveScenario): CurrentTopicStageOutDto {
  const now = new Date().toISOString();
  const guidance = {
    affectedFiles: ["任务协作群卡点记录"],
    problem: "当前阻塞需要你确认已完成指定操作。",
    reasonCustomerMustAct: "只有你能确认外部条件已经满足。",
    steps: ["核对阻塞说明", "完成指定操作", "提交确认并请求令狐复查"],
    completionCriteria: ["操作已完成", "可由令狐复查"],
    resumeLabel: "提交确认并请求令狐复查",
  };
  const common = { ...base, topicId: active.goal.topicId, proposalId: active.goal.proposalId, title: active.goal.title, updatedAt: now, resumeOneShotRunId: null, effectiveTaskIds: [] };
  if (active.stage === 0) return { ...common, status: "failed-pending-repair", summary: "令狐正在核对当前阻塞。", remaining: "尚未形成完整客户操作指导。", waitingFor: "令狐老祖", nextAction: "令狐正在核对；当前无需你操作。", userAction: "none", resumeTaskId: null, customerActionGuidance: null };
  if (active.stage === 1) return { ...common, status: "failed-pending-repair", summary: "需要你完成一项操作后请求令狐复查。", remaining: "等待客户确认。", waitingFor: "你", nextAction: "完成指导中的操作后，提交确认并请求令狐复查。", userAction: "resume", resumeTaskId: active.taskId, customerActionGuidance: guidance };
  if (active.stage === 2) return { ...common, status: "verifying", summary: "已提交确认，令狐正在复查。", remaining: "等待令狐复查结果。", waitingFor: "令狐老祖", nextAction: "令狐正在复查；当前无需你操作。", userAction: "none", resumeTaskId: null, customerActionGuidance: null };
  return { ...common, status: "failed-pending-repair", summary: "复查发现新的阻塞事实。", remaining: "新的阻塞原因：验收连接中断。", waitingFor: "令狐老祖", nextAction: "令狐将依据新的阻塞原因继续核对。", userAction: "none", resumeTaskId: null, customerActionGuidance: null };
}

function presentGroup(group: CollaborationTimelineGroupOutDto, active: ActiveScenario): CollaborationTimelineGroupOutDto {
  const stage = createStage(active.baseState.currentTopicStage!, active);
  return { ...group, status: stage.status === "verifying" ? "verifying" : "blocked", summary: stage.summary, nextStep: stage.nextAction, failureNextStep: stage.status === "failed-pending-repair" ? stage.nextAction : null, updatedAt: stage.updatedAt };
}
