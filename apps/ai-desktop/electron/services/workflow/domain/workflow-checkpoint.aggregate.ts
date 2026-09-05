// 从 Workflow 契约读取异常事实，卡点聚合不直接访问事件数据库。
import type { WorkflowExceptionRecordOutDto } from "../../../../contracts/services/workflow/index.js";

/** 卡点聚合允许进入的稳定处理阶段。 */
export type WorkflowCheckpointPhase =
  // reported 表示原流程首次报告卡点。
  | "reported"
  // received 表示令狐已经接收事实但尚未完成调查。
  | "received"
  // repairing 表示真实修复任务正在工作。
  | "repairing"
  // testing 表示修复任务正在统一验证或集成。
  | "testing"
  // returned 表示修复结果已经交回原流程。
  | "returned"
  // resuming 表示原流程正在从保存点复验。
  | "resuming"
  // waiting 表示缺少客户动作或可靠恢复条件。
  | "waiting"
  // resolved 表示原流程已经通过复验并解除卡点。
  | "resolved"
  // exhausted 表示三轮修复后停止重复派发。
  | "exhausted";

/** 卡点聚合持久化的全部业务字段。 */
export interface WorkflowCheckpointState {
  /** 当前修复轮次，从 1 开始并最多推进到 3。 */
  round: number;
  /** 当前处理阶段；旧记录尚未开始时允许为空字符串。 */
  phase: WorkflowCheckpointPhase | "";
  /** 当前轮真实修复任务标识；尚未派发时为 null。 */
  repairTaskId: string | null;
  /** 被卡住的一次性运行标识；普通协作任务卡点允许为 null。 */
  runId: string | null;
  /** 卡点所属提案标识；无法从旧事件恢复时为 null。 */
  proposalId: string | null;
  /** 卡点所属专题标识；无法确认时为 null。 */
  topicId: string | null;
  /** 被替代或需要恢复的原协作任务标识；流程级卡点允许为 null。 */
  taskId: string | null;
  /** 卡点发生时负责原步骤的人物标识。 */
  sourceMemberId: string;
  /** 各调查轮次对应的会话标识，用于恢复人物对话上下文。 */
  conversations: Record<string, string>;
  /** 原流程停住时的业务阶段。 */
  sourcePhase?: string;
  /** 修复完成后必须返回复验的位置。 */
  recoveryPoint?: string;
  /** 原始问题的人类可读说明。 */
  issue?: string;
  /** 卡点对原专题造成的业务影响。 */
  blockedImpact?: string;
  /** 令狐必须完成的受限修复目标。 */
  repairGoal?: string;
  /** 当前阶段最近一次可展示进展。 */
  latestProgress?: string;
  /** 令狐基于真实证据形成的调查结论。 */
  investigation?: string;
  /** 修复任务回交的真实修改结果。 */
  repairResult?: string;
  /** 当前轮统一测试的真实结果。 */
  testResult?: string;
  /** 达到轮次上限或任务取消后为 true，禁止继续自动派发。 */
  exhausted?: boolean;
  /** 最近一次已经交回原流程复验的轮次。 */
  resumedRound?: number;
}

/** 创建新卡点聚合所需的默认事实。 */
export interface WorkflowCheckpointFallbackState {
  /** 当前异常事实。 */
  event: WorkflowExceptionRecordOutDto;
  /** 从事件或任务关系恢复的一次性运行标识。 */
  runId: string | null;
  /** 从事件或任务关系恢复的提案标识。 */
  proposalId: string | null;
  /** 从事件或任务关系恢复的专题标识。 */
  topicId: string | null;
  /** 从事件、提案或任务关系恢复的原任务标识。 */
  taskId: string | null;
  /** 原步骤真实负责人物标识。 */
  sourceMemberId: string;
  /** 原流程真实阶段。 */
  sourcePhase: string;
  /** 修复后必须返回的原步骤。 */
  recoveryPoint: string;
}

/**
 * Workflow 卡点聚合根。
 *
 * 该实体统一维护卡点轮次、修复任务、交回事实和终止条件；
 * Coordinator 只负责调用令狐、保存聚合快照和恢复原流程。
 */
export class WorkflowCheckpointAggregate {
  /** 当前卡点的可变领域状态，所有修改只能经过聚合方法。 */
  readonly #state: WorkflowCheckpointState;

  /** 使用经过校验的卡点状态创建聚合根。 */
  constructor(state: WorkflowCheckpointState) {
    // 轮次必须是从 1 开始的整数，损坏数据不能继续自动修复。
    if (!Number.isInteger(state.round) || state.round < 1) {
      // 明确抛错让异常入口保留原事实。
      throw new Error("卡点持久状态缺少有效修复轮次，禁止猜测恢复位置。");
    }
    // 阶段必须是字符串，旧数据空阶段仍允许从 reported 开始。
    if (typeof state.phase !== "string") {
      // 阶段损坏时禁止继续派发。
      throw new Error("卡点持久状态缺少有效处理阶段，禁止猜测恢复位置。");
    }
    // 会话映射必须存在，避免重启后丢失真实调查上下文。
    if (!state.conversations || typeof state.conversations !== "object") {
      // 结构不完整时阻断恢复。
      throw new Error("卡点持久状态缺少调查会话，禁止猜测恢复位置。");
    }
    // 原步骤人物必须明确，防止时间线伪造发件人。
    if (typeof state.sourceMemberId !== "string" || !state.sourceMemberId.trim()) {
      // 人物缺失时阻断恢复。
      throw new Error("卡点持久状态缺少原步骤人物，禁止猜测恢复位置。");
    }
    // 深拷贝状态，调用方后续修改事件 payload 不会污染当前聚合。
    this.#state = structuredClone(state);
  }

  /** 从异常 payload 恢复旧聚合；没有快照时使用已核对的原流程事实创建。 */
  static restore(saved: unknown, fallback: WorkflowCheckpointFallbackState): WorkflowCheckpointAggregate {
    // payload 中存在持久快照时必须先校验再恢复。
    if (saved && typeof saved === "object") {
      // 复制旧数据，避免补充兼容字段时改写原异常对象。
      const restored = structuredClone(saved) as WorkflowCheckpointState;
      // 升级前数据缺少可读原阶段时使用当前异常事实补齐。
      restored.sourcePhase = restored.sourcePhase || fallback.sourcePhase;
      // 升级前数据缺少恢复点时使用当前异常事实补齐。
      restored.recoveryPoint = restored.recoveryPoint || fallback.recoveryPoint;
      // 升级前数据缺少问题说明时保留原异常正文。
      restored.issue = restored.issue || fallback.event.message;
      // 返回经过构造器完整校验的聚合。
      return new WorkflowCheckpointAggregate(restored);
    }
    // 没有旧快照时建立第一轮卡点状态。
    return new WorkflowCheckpointAggregate({
      // 新卡点从第一轮调查开始。
      round: 1,
      // 空阶段允许 Coordinator 发布 reported 事实。
      phase: "",
      // 尚未创建修复任务。
      repairTaskId: null,
      // 保存已核对的一次性运行标识。
      runId: fallback.runId,
      // 保存已核对的提案标识。
      proposalId: fallback.proposalId,
      // 保存已核对的专题标识。
      topicId: fallback.topicId,
      // 保存需要恢复或替代的原任务标识。
      taskId: fallback.taskId,
      // 保存原步骤负责人物。
      sourceMemberId: fallback.sourceMemberId,
      // 新卡点尚未建立调查会话。
      conversations: {},
      // 保存原阶段用于页面说明和恢复定位。
      sourcePhase: fallback.sourcePhase,
      // 保存真实恢复点。
      recoveryPoint: fallback.recoveryPoint,
      // 保存原异常正文。
      issue: fallback.event.message,
      // 明确说明原流程仍未完成。
      blockedImpact: `原流程停在${fallback.recoveryPoint}，尚不能继续完成专题。`,
      // 固定令狐的受限修复目标。
      repairGoal: "查明并修复已确认的阻塞原因，完成针对性验证后回到原节点复验。",
    });
  }

  /** 返回当前聚合快照，Repository 可以持久化但不能修改内部状态。 */
  snapshot(): WorkflowCheckpointState {
    // 深拷贝全部嵌套会话字段。
    return structuredClone(this.#state);
  }

  /** 返回当前处理阶段。 */
  phase(): WorkflowCheckpointState["phase"] {
    // 阶段只由聚合状态提供。
    return this.#state.phase;
  }

  /** 返回当前修复轮次。 */
  round(): number {
    // 轮次用于生成稳定任务标记。
    return this.#state.round;
  }

  /** 返回当前轮修复任务标识。 */
  repairTaskId(): string | null {
    // 没有派发任务时返回 null。
    return this.#state.repairTaskId;
  }

  /** 返回原任务标识，修复任务据此建立显式替代关系。 */
  originalTaskId(): string | null {
    // 流程级卡点没有单个原任务时允许为空。
    return this.#state.taskId;
  }

  /** 返回是否已经禁止继续自动修复。 */
  isExhausted(): boolean {
    // 只认聚合持久状态，不根据页面文案判断。
    return this.#state.exhausted === true;
  }

  /** 因任务取消或不可恢复事实立即结束自动修复。 */
  exhaust(): void {
    // 保存稳定终止标记，后续轮询不得再次派发。
    this.#state.exhausted = true;
    // 阶段由 Coordinator 通过 moveTo 同步发布，避免领域状态先于交接事实变化。
  }

  /** 推进到一个明确阶段并保存与该阶段一致的最新进展。 */
  moveTo(phase: WorkflowCheckpointPhase, progress: string): void {
    // 阶段变更和展示进展必须在同一个聚合操作内完成。
    this.#state.phase = phase;
    // 保存去除首尾空白后的业务说明。
    this.#state.latestProgress = progress.trim();
  }

  /** 登记当前轮真实修复任务。 */
  registerRepairTask(taskId: string): void {
    // 空任务标识无法在重启后查重，必须明确阻断。
    if (!taskId.trim()) {
      // 拒绝保存不可恢复关系。
      throw new Error("未获得真实修复任务标识，不能登记卡点修复。");
    }
    // 保存当前轮唯一修复任务。
    this.#state.repairTaskId = taskId.trim();
  }

  /** 清除旧修复任务并开始下一轮调查。 */
  startNextRound(): void {
    // 三轮是当前自动修复硬上限。
    if (this.#state.round >= 3) {
      // 记录耗尽事实，调用方只能等待新增证据或人工处理。
      this.#state.exhausted = true;
      // 阶段由 Coordinator 在发布耗尽交接时统一改变，不创建第四轮修复任务。
      return;
    }
    // 进入下一轮真实调查。
    this.#state.round += 1;
    // 新一轮尚未创建修复任务。
    this.#state.repairTaskId = null;
    // 新一轮从已接收原点复验失败事实开始。
    this.#state.phase = "received";
  }

  /** 标记当前轮已经交回原流程复验。 */
  markResumed(): void {
    // 保存具体轮次，重启后不会反复交回同一结果。
    this.#state.resumedRound = this.#state.round;
  }

  /** 判断当前轮是否已经交回但原点再次失败。 */
  needsAnotherRound(): boolean {
    // 相同轮次已复验代表旧修复结果不能再次重放。
    return this.#state.resumedRound === this.#state.round;
  }

  /** 保存修复任务返回的调查、修改与测试证据。 */
  recordRepairEvidence(investigation: string | undefined, repairResult: string | undefined, testResult: string | undefined): void {
    // 只有真实存在的调查结论才覆盖旧值。
    if (investigation?.trim()) {
      // 保存令狐本轮调查正文。
      this.#state.investigation = investigation.trim();
    }
    // 只有真实存在的修复结果才覆盖旧值。
    if (repairResult?.trim()) {
      // 保存执行结果正文。
      this.#state.repairResult = repairResult.trim();
    }
    // 只有真实存在的测试结果才覆盖旧值。
    if (testResult?.trim()) {
      // 保存统一测试正文。
      this.#state.testResult = testResult.trim();
    }
  }
}
