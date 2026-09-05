import type { CollaborationStateOutDto, WorkflowExceptionRecordOutDto, SubmitCollaborationTaskInDto } from "../../../../contracts/services/workflow/index.js";
import type { EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { CheckpointState } from "./checkpoint-state.js";
import type { CheckpointHandoffService } from "./checkpoint-handoff.service.js";

export interface CheckpointCoordinatorOptions {
  evolution(): EvolutionStateOutDto;
  collaboration(): CollaborationStateOutDto;
  pending(): WorkflowExceptionRecordOutDto[];
  save(eventId: string, state: CheckpointState): void;
  resolve(eventId: string, reason: string): void;
  resume(runId: string): Promise<EvolutionStateOutDto>;
  handleTask(taskId: string, stalled?: boolean): Promise<void>;
  submitRepair(request: SubmitCollaborationTaskInDto): CollaborationStateOutDto;
  handoff: Pick<CheckpointHandoffService, "publish">;
}

/** 统一卡点分流只持有原事实与恢复关系；调查和改代码由令狐真实任务完成。 */
export class CheckpointCoordinator {
  #busy = false;
  constructor(private readonly options: CheckpointCoordinatorOptions) {}

  async process(events: WorkflowExceptionRecordOutDto[]): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    try {
      for (const event of events.filter((item) => item.flowImpact === "blocked")) {
        try { await this.#advance(event); }
        catch (error) {
          const state = this.#state(event);
          this.#phase(event, state, "waiting", `处理未完成：${error instanceof Error ? error.message : String(error)}。保留原卡点，后续检查继续核对。`);
        }
      }
    } finally { this.#busy = false; }
  }

  #state(event: WorkflowExceptionRecordOutDto): CheckpointState {
    if (event.payload.checkpoint) {
      const saved = event.payload.checkpoint as CheckpointState;
      if (!Number.isInteger(saved.round) || saved.round < 1 || typeof saved.phase !== "string" || !saved.conversations || typeof saved.sourceMemberId !== "string") throw new Error("卡点持久状态不完整，禁止猜测恢复位置");
      return { ...structuredClone(saved), sourcePhase: saved.sourcePhase || text(event.payload.phase) || "未知节点", recoveryPoint: saved.recoveryPoint || text(event.payload.recoveryPoint) || "等待恢复原步骤", issue: saved.issue || event.message };
    }
    const evolution = this.options.evolution();
    const task = this.options.collaboration().tasks.find((item) => item.taskId === event.correlationId || item.taskId === event.payload.taskId);
    const proposal = evolution.proposals.find((item) => item.proposalId === event.payload.proposalId || item.proposalId === task?.evolutionProposalId);
    return { round: 1, phase: "", repairTaskId: null, runId: typeof event.payload.runId === "string" ? event.payload.runId : null,
      proposalId: proposal?.proposalId || null, topicId: proposal?.topicId || null, taskId: task?.taskId || null,
      sourceMemberId: event.payload.phase === "accepting" || event.payload.operation === "run_real_application_acceptance" ? "han-li" : task?.executorMemberId || "nangong-wan", conversations: {},
      sourcePhase: text(event.payload.phase) || task?.phase || "未知节点", recoveryPoint: text(event.payload.recoveryPoint) || "等待恢复原步骤", issue: event.message,
      blockedImpact: `原流程停在${text(event.payload.recoveryPoint) || text(event.payload.phase) || task?.phase || "当前步骤"}，尚不能继续完成专题。`,
      repairGoal: "查明并修复已确认的阻塞原因，完成针对性验证后回到原节点复验。" };
  }

  #phase(event: WorkflowExceptionRecordOutDto, state: CheckpointState, phase: string, content: string): void {
    state.latestProgress = content;
    if (state.phase === phase) {
      this.options.save(event.eventId, state);
      return;
    }
    this.options.handoff.publish(event, state, phase, content);
    state.phase = phase;
    this.options.save(event.eventId, state);
    event.payload.checkpoint = structuredClone(state);
  }

  async #advance(event: WorkflowExceptionRecordOutDto): Promise<void> {
    const state = this.#state(event);
    if (!state.phase) this.#phase(event, state, "reported", event.message);
    if (state.phase === "reported") this.#phase(event, state, "received", "令狐已接收原因和原流程标识；接收不代表修复完成。");
    const evolution = this.options.evolution();
    const task = this.options.collaboration().tasks.find((item) => item.taskId === state.taskId);
    const run = evolution.oneShotRun;
    const proposal = evolution.proposals.find((item) => item.proposalId === state.proposalId);
    if (task?.state === "integrated" || (state.runId && run?.runId === state.runId && run.status === "completed")) {
      this.#phase(event, state, "resolved", "原任务已完成验证，确认此卡点解除；历史轮次保留。");
      this.options.resolve(event.eventId, "原任务完成事实已确认");
      return;
    }
    // 明确暂停、取消及业务授权问题不能因统一受理而变成自动放权。
    if ((state.runId === run?.runId && ["paused", "stopped"].includes(evolution.automationRuntime.status)) || task?.state === "cancelled" || event.category === "business-exception" || task?.integrationFailure?.kind === "local-change-ownership") {
      this.#phase(event, state, "waiting", "已保留卡点，当前为人工暂停、业务选择或归属问题，需用户明确后继续，不自动改写授权。");
      return;
    }
    if (task) {
      const member = this.options.collaboration().members.find((item) => item.memberId === task.executorMemberId);
      const heartbeat = [member?.lastHeartbeatAt, member?.lastProtocolProgressAt, task.updatedAt].filter((value): value is string => Boolean(value)).sort().at(-1);
      const stalled = event.category === "stalled" && heartbeat === event.payload.lastHeartbeatAt;
      // 原执行人的自修复和正常测试不抢占；只把真正停住的任务送给既有令狐恢复能力。
      if (["blocked", "recovering"].includes(task.state) || stalled) {
        this.#phase(event, state, "repairing", "已交给令狐核对原任务恢复条件，沿既有任务修复链处理。");
        await this.options.handleTask(task.taskId, stalled);
      } else this.#phase(event, state, "resuming", `原任务正在${task.phase}，继续观察，不抢占执行人自修复。`);
      return;
    }
    const topic = evolution.topics.find((item) => item.topicId === state.topicId);
    if (!topic || !proposal || !state.runId || run?.runId !== state.runId || run.proposalId !== proposal.proposalId) {
      this.#phase(event, state, "waiting", "无法确认原任务或授权工作区，已交令狐留痕等待核实；不猜测目标、不派发无范围修复。");
      return;
    }
    if (run.status === "running") {
      this.#phase(event, state, "resuming", "已回到原流程继续验证；尚未认定整个任务通过。");
      return;
    }
    if (run.status !== "blocked") {
      this.#phase(event, state, "waiting", "原运行并非可自动恢复的受阻状态，保留事实等待明确恢复条件。");
      return;
    }
    if (state.exhausted) return;
    // 同一原运行的重复异常共享最早的持久处理记录；不同事件不能各派一份修复。
    const primary = this.options.pending().filter((item) => item.payload.runId === state.runId)
      .sort((a, b) => Number(Boolean((b.payload.checkpoint as CheckpointState | undefined)?.repairTaskId)) - Number(Boolean((a.payload.checkpoint as CheckpointState | undefined)?.repairTaskId)) || a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId))[0];
    if (primary && primary.eventId !== event.eventId) {
      this.#phase(event, state, "waiting", `同一原流程已有卡点 ${primary.eventId} 正在处理，本条保留关联，不重复派发。`);
      return;
    }
    // 上轮恢复异步返回running后仍可能再次受阻，必须开新修复轮，不能无限重放旧成果。
    if (state.resumedRound === state.round) {
      if (state.round >= 3) { state.exhausted = true; this.#phase(event, state, "exhausted", "三轮修复后的原点复验仍受阻，停止重复派发，等待新增事实。"); return; }
      state.round += 1; state.repairTaskId = null;
      this.#phase(event, state, "received", `原点复验再次受阻：${run.blockingReason || event.message}。进入下一轮调查。`);
    }
    // 用持久任务标记查重，覆盖创建任务后、保存关联前崩溃的窗口。
    const marker = `卡点标识：${state.runId}:round:${state.round}`;
    const repair = this.options.collaboration().tasks.find((item) => item.taskId === state.repairTaskId || item.snapshot.constraints.includes(marker));
    if (repair) {
      state.repairTaskId = repair.taskId;
      state.investigation = repair.repairDiagnosis ? `${repair.repairDiagnosis.failureSummary}\n修复方案：${repair.repairDiagnosis.repairInstruction}` : state.investigation;
      state.repairResult = repair.resultSummary ? `${repair.resultSummary.solvedProblem}\n具体改变：${repair.resultSummary.changes}\n遗留：${repair.resultSummary.remaining || "无"}` : repair.repairResult || state.repairResult;
      state.testResult = repair.unifiedTest ? `统一测试：${repair.unifiedTest.status}${repair.unifiedTest.failureReason ? `；${repair.unifiedTest.failureReason}` : ""}` : state.testResult;
      if (repair.state === "integrated") {
        this.#phase(event, state, "returned", `令狐修复任务 ${repair.taskId} 已完成测试与集成，交回原步骤重新验证。`);
        // 先持久化返回点；失败或重启仍会重试恢复，不把返回当作解除。
        const resumed = await this.options.resume(state.runId);
        state.resumedRound = state.round;
        if (resumed.oneShotRun?.status === "blocked") {
          if (state.round >= 3) { state.exhausted = true; this.#phase(event, state, "exhausted", "同一卡点三轮修复后仍受阻，停止重复派发，等待新增事实或人工处理。"); return; }
          state.round += 1; state.repairTaskId = null;
          this.#phase(event, state, "received", `原点复验仍受阻：${resumed.oneShotRun.blockingReason || "尚未解除"}。开始下一轮调查。`);
        } else this.#phase(event, state, "resuming", "修复已交回，原流程正在重新验证；未直接标记验收通过。");
      } else if (repair.state === "cancelled") {
        state.exhausted = true;
        this.#phase(event, state, "exhausted", "修复任务已取消，保留原卡点，不自动重新派发。");
      } else if (["blocked", "recovering"].includes(repair.state)) {
        this.#phase(event, state, "waiting", `令狐修复任务仍受阻：${repair.blockingReason || repair.state}；沿此修复任务处理，不重复创建。`);
        await this.options.handleTask(repair.taskId);
      } else this.#phase(event, state, ["unified-testing", "awaiting-restart", "integrating", "queued-integration"].includes(repair.state) ? "testing" : "repairing", `令狐修复任务 ${repair.taskId}：${repair.state}。${repair.blockingReason || "正在沿调查、执行、自检和统一测试流程处理。"}`);
      return;
    }
    if (this.options.collaboration().members.find((member) => member.memberId === "linghu-ancestor")?.currentTaskId) return;
    const result = this.options.submitRepair({ title: `修复流程卡点：${topic.title}`, problemStatement: event.message,
      confirmedIntent: `调查并修复原流程卡点，完成后回到 ${proposal.title} 原步骤，不代替韩立验收。\n故障事实：${JSON.stringify(event.payload, (key, value) => key === "checkpoint" ? undefined : value)}`,
      constraints: [marker, "仅修复已确认目标范围内的技术故障；先调查再修改，保留原任务历史和恢复点。", "不得修改生产数据库、跳过测试、扩大业务范围或关闭权限门禁；需要用户授权时报告受阻。"],
      acceptanceCriteria: ["复现并解释具体阻塞原因", "修复有针对性回归测试且不绕过权限和原验收条件", "提交真实修复与验证证据供原流程重新验收"],
      workspaceState: topic.workspaceState, locale: topic.locale, initiatorMemberId: "nangong-wan", preferredExecutorMemberId: "linghu-ancestor", automationSource: "linghu-safeguard",
      evolutionProposalId: proposal.proposalId, evolutionRoundId: proposal.proposalId });
    state.repairTaskId = result.tasks.find((item) => item.snapshot.constraints.includes(marker))?.taskId || null;
    if (!state.repairTaskId) throw new Error("未获得真实修复任务标识，不能报告派发完成");
    this.#phase(event, state, "repairing", `令狐已接收第 ${state.round} 轮真实调查修复任务 ${state.repairTaskId}。`);
  }
}

function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
