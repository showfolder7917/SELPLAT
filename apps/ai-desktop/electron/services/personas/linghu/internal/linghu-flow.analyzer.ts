// 协同状态与任务类型提供令狐只读分析所需的权威事实，不允许本模块修改任务。
import type { CollaborationStateOutDto, CollaborationTask } from "../../../../../contracts/collaboration/workflow/index.js";
// 令狐协议定义健康状态、阻塞分类、快照和模块报告的数据形状。
import type { LinghuAutomaticFlowSnapshotOutDto, LinghuAutomationModuleOutDto, LinghuBlockingKindOutDto, LinghuFlowHealthOutDto } from "../../../../../contracts/collaboration/linghu/index.js";
// 测试资源快照只被转换为任务说明文字，本模块不申请或释放资源。
import type { TestResourceCoordinatorState } from "../../../../../contracts/capabilities/testing/index.js";
// 模块顺序来自状态仓库的唯一常量，避免分析与持久化使用不同轮转顺序。
import { LINGHU_AUTOMATION_MODULES } from "./linghu-automation.store.js";

// 默认执行人用于旧任务缺少执行人快照时生成完整报告，不改变真实成员归属。
const LINGHU_MEMBER_ID = "linghu-ancestor";
// 两分钟没有心跳、协议进度或状态变化时，执行态任务进入停点检查。
const FLOW_STALE_AFTER_MS = 120_000;

/** 把所有未终结协同任务转换为令狐可持久化的只读流程快照。 */
export function automaticFlowSnapshots(state: CollaborationStateOutDto, activeTaskId: string | null, checkedAt: string): LinghuAutomaticFlowSnapshotOutDto[] {
  // `activeTaskId` 暂时只保留为调用契约的一部分；令狐必须检查自身任务和其他人物任务，不能过滤活动任务。
  void activeTaskId;
  // 已集成和已取消任务已经终结，其历史由时间线保存，不进入持续恢复扫描。
  return state.tasks.filter((task) => task.state !== "integrated" && task.state !== "cancelled")
    // 每条任务独立形成快照，使一个故障不会污染其他人物的恢复预算。
    .map((task) => automaticFlowSnapshot(state, task, checkedAt));
}

/** 根据任务、成员心跳和检查时间生成单条自动保障快照。 */
function automaticFlowSnapshot(state: CollaborationStateOutDto, task: CollaborationTask, checkedAt: string): LinghuAutomaticFlowSnapshotOutDto {
  // 只有当前确实持有该任务的成员心跳才属于本任务，避免复用人物上一任务的时间。
  const member = state.members.find((candidate) => candidate.memberId === task.executorMemberId && candidate.currentTaskId === task.taskId);
  // 最近进展优先比较心跳、协议进度和任务状态更新时间。
  const progressAt = latestTime(member?.lastHeartbeatAt, member?.lastProtocolProgressAt, task.updatedAt);
  // 超过安全阈值只形成停点事实，是否恢复仍由 Facade 的权限和次数门禁决定。
  const stale = Date.parse(checkedAt) - Date.parse(progressAt) > FLOW_STALE_AFTER_MS;
  // 健康状态必须先读取结构化任务状态，再考虑时间阈值。
  const health = flowHealth(task, stale);
  // 终态条件保留给兼容历史快照；当前扫描通常已过滤 integrated。
  const completedConditions = task.state === "integrated" ? ["源码已集成", "任务已进入完成终态"] : [];
  // 返回值只包含可审计数据，不携带 Coordinator 或成员对象引用。
  return {
    flowId: `automatic:${task.taskId}`,
    sourceTaskId: task.taskId,
    health,
    state: task.state,
    phase: task.phase,
    executorMemberId: task.executorMemberId,
    workerGeneration: task.workerGeneration,
    lastHeartbeatAt: member?.lastHeartbeatAt || null,
    lastProtocolProgressAt: member?.lastProtocolProgressAt || null,
    lastStateChangedAt: task.updatedAt,
    waitingPoint: waitingPoint(task, health),
    completionConditions: ["任务完成代码级验证", "集成候选验证通过", "结果进入 integrated 终态"],
    completedConditions,
    recoveryCheckpoint: task.recoveryTargetState ? `${task.taskId}:${task.recoveryTargetState}:${task.workerGeneration}` : null,
    blockingReason: task.blockingReason,
    blockingKind: blockingKind(task),
  };
}

/** 把结构化停点转换成人可以立即判断“谁、哪项任务、停在哪里、发现什么”的报告。 */
export function taskHumanReport(state: CollaborationStateOutDto, task: CollaborationTask, snapshot: LinghuAutomaticFlowSnapshotOutDto | undefined): string {
  // 当前执行人 ID 是负责人判断的第一权威来源。
  const responsibleMemberId = task.executorMemberId;
  // 依次使用实时成员、冻结原执行人和当前处理人，旧记录缺字段时仍能给出可读负责人。
  const responsible = state.members.find((member) => member.memberId === responsibleMemberId)?.displayName
    || (responsibleMemberId === task.originalExecutor?.memberId ? task.originalExecutor.displayName : null)
    || task.currentHandler?.displayName
    || "未识别负责人";
  // 阶段名称根据结构化状态确定，不从自由文本猜测。
  const stage = ["ready-for-integration", "queued-integration", "integrating"].includes(task.state) || task.integrationFailure ? "版本集成阶段"
    : (["unified-testing", "test-failed"].includes(task.state) ? "统一测试阶段"
      : (task.state === "awaiting-restart" ? "应用重启验收阶段" : "任务执行阶段"));
  // 优先保留最具体的集成失败详情，其次使用阻塞原因和快照等待点。
  const finding = task.integrationFailure?.detail || task.blockingReason || snapshot?.waitingPoint || "任务进展超过安全阈值，尚未收到新的执行事实";
  // 单句报告供日志、页面和修正提案共同使用，避免各层重新解释状态。
  return `${responsible}负责的“${task.snapshot.title}”停在${stage}（状态：${task.state}${task.phase ? `，阶段：${task.phase}` : ""}）；发现：${finding}`;
}

/** 将任务状态和停滞事实归一为令狐健康状态。 */
function flowHealth(task: CollaborationTask, stale: boolean): LinghuFlowHealthOutDto {
  // 明确终态和人工终止状态优先于任何时间判断。
  if (task.state === "integrated") return "completed";
  if (task.state === "cancelled") return "human-blocked";
  // 结构化失败和恢复态分别映射到停点或恢复中。
  if (task.state === "blocked") return "stalled";
  if (task.state === "recovering") return "recovering";
  if (task.state === "test-failed") return "stalled";
  if (task.state === "unified-testing") return "testing";
  if (task.state === "repairing-execution") return "repairing";
  // 有明确队列释放条件的等待不是停点，不能仅凭排队时长触发具有副作用的恢复。
  if (["queued-executor", "returned-to-nangong", "queued-integration", "ready-for-integration", "awaiting-restart"].includes(task.state)) return "waiting";
  // 只有普通执行态没有新事实超过阈值时才标记停滞。
  if (stale) return "stalled";
  if (["executing", "integrating"].includes(task.state)) return "repairing";
  // 其余状态没有异常证据，保持健康。
  return "healthy";
}

/** 为等待或停点状态提供下一步可读说明。 */
function waitingPoint(task: CollaborationTask, health: LinghuFlowHealthOutDto): string | null {
  // 人工终止和结构化停点优先显示恢复条件。
  if (health === "human-blocked") return "等待人工重新选择是否继续";
  if (health === "stalled" || health === "recovering") return task.blockingReason || "等待安全恢复条件";
  // 正常排队状态分别说明真正的释放条件。
  if (task.state === "queued-executor") return "等待执行者容量";
  if (task.state === "returned-to-nangong") return "等待本轮全部任务返回南宫婉";
  if (task.state === "awaiting-restart") return "等待新版本重启健康检查";
  if (task.state === "ready-for-integration" || task.state === "queued-integration") return "等待令狐整批集成";
  // 非等待状态无需制造提示文字。
  return null;
}

/** 优先根据结构化失败类型判定阻塞类别，最后才使用旧自由文本兼容。 */
function blockingKind(task: CollaborationTask): LinghuBlockingKindOutDto {
  // 状态与结构化集成失败比自由文本可靠；测试输出可能引用“用户选择”等规则正文，不能因此误判为业务选择。
  if (task.integrationFailure?.kind === "infrastructure") return "infrastructure";
  if (task.state === "test-failed" || task.integrationFailure?.kind === "verification") return "test";
  if (task.integrationFailure?.kind === "merge-conflict") return "code";
  if (task.integrationFailure?.kind === "local-change-ownership") return "infrastructure";
  // 没有阻塞事实时明确返回 none，避免令狐生成泛化修正方案。
  if (!task.blockingReason) return "none";
  // 旧记录只有文字时按稳定关键词进行最小兼容分类。
  const reason = task.blockingReason;
  if (/用户|人工|选择/.test(reason)) return "business";
  if (/测试|test/i.test(reason)) return "test";
  if (/数据|缺失|记录/.test(reason)) return "data";
  if (/代码|编译|类型/.test(reason)) return "code";
  // 无法细分的技术停点归为基础设施，避免自动替用户做业务决定。
  return "infrastructure";
}

/** 从多个可空 ISO 时间中选出最新时间。 */
function latestTime(...values: Array<string | null | undefined>): string {
  // 过滤空值后按时间倒序，完全缺失时使用 Unix 起点确保首次检查会识别停滞。
  return values.filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || new Date(0).toISOString();
}

/** 生成只随真实故障事实变化的稳定指纹，用于限制重复恢复副作用。 */
export function faultFingerprint(task: CollaborationTask, snapshot: LinghuAutomaticFlowSnapshotOutDto | undefined): string {
  // 任务恢复动作本身会更新 updatedAt，不能把它作为新事实，否则三次上限会被每次副作用自行清零。
  const lastProgressVersion = latestTime(snapshot?.lastHeartbeatAt, snapshot?.lastProtocolProgressAt, task.codeVerifiedAt);
  // 同一状态下的阶段推进同样是新事实，例如失败测试转入修正或验证阶段后应获得新的恢复预算。
  return [task.taskId, task.state, task.phase || "none", task.workerGeneration, blockingKind(task), task.blockingReason || "none", lastProgressVersion].join("|");
}

/** 把已完成任务整理为模块级审计报告。 */
export function moduleCompletionReport(cycle: number, module: LinghuAutomationModuleOutDto, task: CollaborationTask, summary: string, snapshots: LinghuAutomaticFlowSnapshotOutDto[], completedAt: string) {
  // 找到完成任务最近的检测快照，作为报告的结构化证据。
  const snapshot = snapshots.find((candidate) => candidate.sourceTaskId === task.taskId);
  // 报告保留证据、执行者、测试、重启、阻塞和下一模块，供页面和审计共同读取。
  return {
    cycle,
    module,
    evidence: [snapshot ? `流程 ${task.taskId} 检测状态为 ${snapshot.health}` : `流程 ${task.taskId} 已进入 integrated`, summary.slice(0, 2_000)],
    tasks: [{ taskId: task.taskId, type: "自动流程保障", action: task.snapshot.problemStatement, executorMemberId: task.executorMemberId || LINGHU_MEMBER_ID, result: summary.slice(0, 2_000) }],
    tests: module === "test-coverage"
      ? { status: "not-run" as const, summary: "等待执行固定统一测试。" }
      : { status: "passed" as const, summary: "协同任务已通过代码级验证和集成门禁。" },
    restartRecovery: module === "test-coverage"
      ? { status: "not-run" as const, checkpoint: `next-module:${cycle + 1}:flow-completion`, summary: "等待固定统一测试通过后执行受控重启。" }
      : { status: "not-applicable" as const, checkpoint: null, summary: "本模块不要求重启。" },
    blocking: { blocked: false, reason: null, resumeCondition: null },
    nextSuggestion: `继续检测下一独立模块：${moduleLabel(nextModule(module))}`,
    completedAt,
  };
}

/** 按固定顺序计算下一个独立模块。 */
function nextModule(module: LinghuAutomationModuleOutDto): LinghuAutomationModuleOutDto {
  // 当前索引加一并取模，第三模块完成后回到流程保障。
  const index = LINGHU_AUTOMATION_MODULES.indexOf(module);
  return LINGHU_AUTOMATION_MODULES[(index + 1) % LINGHU_AUTOMATION_MODULES.length] || "flow-completion";
}

/** 把模块编码转换为中文业务名称。 */
export function moduleLabel(module: LinghuAutomationModuleOutDto): string {
  // 名称集中在令狐模块，调用方不再重复维护人物文案。
  return {
    "flow-completion": "自动流程完成保障",
    "test-coverage": "测试漏点补充与能力升级",
    "audit-completeness": "日志审计完整性",
  }[module];
}

/** 返回派发给令狐执行会话的模块专属职责说明。 */
export function moduleInstruction(module: LinghuAutomationModuleOutDto): string {
  // 三个说明互斥，防止一条协同任务混入多个职责造成文件冲突。
  return {
    "flow-completion": "最高优先级检查所有人物任务的当前状态、等待点和完成条件。发现停点不能只报告，必须提出最小修正方案并推动审核、执行、集成、统一测试和最终完成。",
    "test-coverage": "根据真实改动和失败证据检查主路径、边界、异常、相邻回归与并发漏点；先补缺失测试再修正复测，并优化排队等待、重复构建和资源占用。",
    "audit-completeness": "检查任务、人物、测试批次、进程、端口、构建目录及排队、占用、冲突、释放、超时、结果是否结构化关联；缺失时补齐审计事实。",
  }[module];
}

/** 把测试资源协调快照转换为令狐任务可以理解的结构化上下文。 */
export function testResourceContext(state: TestResourceCoordinatorState | null): string {
  // 首次启动或协调器不可用时明确说明没有快照，不伪造空闲。
  if (!state) return "当前没有测试资源协调快照。";
  // 占用者说明运行、任务、进程、端口、构建目录和心跳，便于判断真实资源争用。
  const holder = state.holder
    ? `当前占用者：${state.holder.runId}，任务 ${state.holder.taskId || "全局统一测试"}，进程 ${state.holder.processId}，端口 ${state.holder.port ?? "无"}，构建目录 ${state.holder.buildRoot}，心跳 ${state.holder.heartbeatAt}`
    : "当前没有测试资源占用者";
  // 等待队列保留稳定顺序，令狐不能绕过前面的测试任务抢占资源。
  const waiters = state.waiters.length > 0
    ? `等待队列：${state.waiters.map((waiter) => `${waiter.runId}(进程${waiter.processId})`).join("、")}`
    : "等待队列为空";
  // 最近事件用于区分正常等待、执行过慢和真实冲突。
  const lastEvent = state.lastEvent
    ? `最近资源事件：${state.lastEvent.type}，等待 ${state.lastEvent.waitDurationMs}ms，执行 ${state.lastEvent.executionDurationMs ?? "未完成"}ms，冲突 ${state.lastEvent.contentionCount} 次`
    : "当前没有资源事件";
  // 三组事实合并为任务上下文，但不改变协调器状态。
  return `测试资源结构化事实：${holder}；${waiters}；${lastEvent}。`;
}
