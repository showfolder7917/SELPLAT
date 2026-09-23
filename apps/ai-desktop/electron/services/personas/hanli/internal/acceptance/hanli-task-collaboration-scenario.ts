import type { BrowserWindow } from "electron";
import type { EvolutionStateOutDto, CurrentTopicStageOutDto } from "../../../../../../contracts/services/evolution/index.js";
import type { CollaborationStateOutDto, CollaborationTimelineGroupOutDto, CollaborationTimelineSnapshotOutDto } from "../../../../../../contracts/services/workflow/index.js";
import type { HanliComputerAcceptanceInDto } from "../../../../../../contracts/services/personas/hanli/index.js";

/** 验收器只读观察的窗口绑定阶段；真实客户确认仍只能由页面按钮触发。 */
export type HanliTaskCollaborationScenarioStage = "no-guidance" | "customer-guidance" | "reviewing" | "new-blocker";

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
    private readonly publish: (window: BrowserWindow, state: EvolutionStateOutDto, timeline: CollaborationTimelineSnapshotOutDto, collaborationState: CollaborationStateOutDto, reason: string) => void,
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

  /** 当前场景阶段只供正式验收器提示下一安全动作，Renderer 与普通 IPC 不可写入。 */
  stageFor(webContentsId: number): HanliTaskCollaborationScenarioStage | null {
    const active = this.#active;
    return active && active.webContentsId === webContentsId ? scenarioStage(active.stage) : null;
  }

  /**
   * 只由验收器按当前条件准备不含客户确认的观察阶段。
   *
   * 示例：完整指导条件把“无指导”准备为“完整指导”；新阻塞条件只能在真实确认后的
   * “复查中”阶段准备。第 1 到第 2 阶段不在这里处理，必须点击页面唯一确认按钮。
   */
  prepare(webContentsId: number, target: Exclude<HanliTaskCollaborationScenarioStage, "no-guidance" | "reviewing">): void {
    const active = this.#requireActive(webContentsId);
    if (target === "customer-guidance" && active.stage === 0) {
      active.stage = 1;
    } else if (target === "new-blocker" && active.stage === 2) {
      active.stage = 3;
    } else if (scenarioStage(active.stage) !== target) {
      throw new Error("当前验收条件尚未满足场景阶段顺序；请先观察或点击当前页面唯一确认入口。");
    }
    this.#publish(`acceptance-scenario.prepared.${target}`);
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
    // 返回窗口专用快照但不调用 continueTask，页面操作不会写入任何任务事实。
    return this.collaborationStateFor(webContentsId, this.readCollaborationState());
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

  /**
   * 成员空闲条件也只能在隔离窗口中投影；真实协作任务和成员占用事实始终保持原样。
   *
   * 任务列表保留真实内容，避免验收场景伪造任务完成；只移除成员当前占用，让页面能
   * 核对“全员空闲不会额外签发恢复入口”的显示规则。
   */
  collaborationStateFor(webContentsId: number, actual: CollaborationStateOutDto): CollaborationStateOutDto {
    if (!this.isActiveFor(webContentsId)) return actual;
    return {
      ...actual,
      members: actual.members.map((member) => ({
        ...member,
        state: "idle",
        role: null,
        phase: null,
        currentTaskId: null,
        blockingReason: null,
      })),
    };
  }

  end(webContentsId: number): void {
    const active = this.#active;
    if (!active || active.webContentsId !== webContentsId) return;
    this.#active = null;
    if (!active.window.isDestroyed()) this.publish(active.window, this.readState(), this.readTimeline(), this.readCollaborationState(), "acceptance-scenario.ended");
  }

  #requireActive(webContentsId: number): ActiveScenario {
    const active = this.#active;
    if (!active || active.webContentsId !== webContentsId) throw new Error("当前窗口没有活动的任务协作群验收场景。");
    return active;
  }

  #publish(reason: string): void {
    const active = this.#active;
    if (!active || active.window.isDestroyed()) return;
    this.publish(
      active.window,
      this.stateFor(active.webContentsId, this.readState()),
      this.timelineFor(active.webContentsId, this.readTimeline()),
      this.collaborationStateFor(active.webContentsId, this.readCollaborationState()),
      reason,
    );
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

function scenarioStage(stage: ActiveScenario["stage"]): HanliTaskCollaborationScenarioStage {
  if (stage === 0) return "no-guidance";
  if (stage === 1) return "customer-guidance";
  if (stage === 2) return "reviewing";
  return "new-blocker";
}

function createStage(base: CurrentTopicStageOutDto, active: ActiveScenario): CurrentTopicStageOutDto {
  const now = new Date().toISOString();
  const guidance = {
    affectedFiles: ["apps/ai-desktop/electron/services/workflow/domain/current-topic-stage.projection.ts"],
    problem: "当前专题的恢复入口仍被阻塞，需确认该投影已按本次卡点事实更新。",
    reasonCustomerMustAct: "只有你能确认外部条件已经满足，令狐不能代替你完成该确认。",
    steps: ["核对 current-topic-stage.projection.ts 对应的阻塞说明。", "完成该文件关联的外部确认。", "提交确认并请求令狐复查。"],
    completionCriteria: ["已确认 current-topic-stage.projection.ts 关联的外部条件。", "令狐可据此重新核对当前阻塞。"],
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
