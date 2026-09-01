/**
 * DTO 方向：Out，表示完整状态从令狐模块输出到页面和协作投影。
 *
 * 数据生产方：LinghuAutomationFacade、LinghuAutomationStore 和流程分析器。
 * 数据接收方：Renderer 令狐面板、事件中心和协作进度投影。
 * 数据流向：令狐 Service -> IPC / 事件桥 -> 页面及只读消费者。
 * 作用：描述流程健康、恢复、模块报告和完整状态快照。
 * 禁止职责：不得检测流程、执行测试、读写状态文件或批准修正提案。
 */
// 令狐状态输出引用协同任务阶段，但协议层只依赖类型，不触发任何运行逻辑。
import type { CollaborationTaskState } from "../../workflow/index.js";
// 测试资源快照只作为跨进程数据字段，不能让协议层控制测试执行器。
import type { TestResourceCoordinatorState } from "../../../capabilities/testing/test-resource.js";

// 启动文案属于独立输出 DTO，状态 DTO 只通过类型组合它。
import type { LinghuStartupPromptOutDto } from "./startup-prompt.out.dto.js";

// 三个值分别代表流程完成、测试覆盖和审计完整性；新增模块必须同步 Store 中的轮转顺序。
export type LinghuAutomationModuleOutDto = "flow-completion" | "test-coverage" | "audit-completeness";

/** 一个令狐模块完成后向外提供的简要反馈 DTO。 */
export interface LinghuAutomationFeedbackOutDto {
  // 循环编号表示三模块轮转到第几轮。
  cycle: number;
  // 模块编码说明这份反馈属于哪一种独立职责。
  module: LinghuAutomationModuleOutDto;
  // 关联任务 ID 让页面和审计能够反查真实执行记录。
  taskId: string;
  // 完成反馈时的结构化任务状态，禁止只靠摘要文字判断结果。
  taskState: CollaborationTaskState;
  // 摘要只保存可展示结论，不包含原始推理。
  summary: string;
  // 记录时间用于恢复后判断反馈的新旧顺序。
  recordedAt: string;
}

// 健康状态覆盖正常、等待、停滞、修复、测试、恢复、人工阻塞和完成八种可观察阶段。
export type LinghuFlowHealthOutDto = "healthy" | "waiting" | "stalled" | "repairing" | "testing" | "recovering" | "human-blocked" | "completed";
// 阻塞类别优先来自结构化失败类型，旧记录才会使用文字兼容分类。
export type LinghuBlockingKindOutDto = "none" | "infrastructure" | "data" | "code" | "test" | "business";

/** 自动保障每轮向外提供的流程事实 DTO；页面、审计和恢复逻辑共享同一份快照。 */
export interface LinghuAutomaticFlowSnapshotOutDto {
  // 流程 ID 使用令狐命名空间，避免与原任务 ID 混淆。
  flowId: string;
  // 原协同任务 ID 是恢复、日志和页面关联的权威键。
  sourceTaskId: string;
  // 健康状态由主进程只读分析生成，Renderer 不得自行重算。
  health: LinghuFlowHealthOutDto;
  // 原任务状态保留给恢复策略做结构化判断。
  state: CollaborationTaskState;
  // 任务内部阶段可能为空，空值表示旧任务或尚未进入具体阶段。
  phase: string | null;
  // 当前执行人可能在排队时为空，不能由页面猜测为令狐。
  executorMemberId: string | null;
  // 执行代数用于拒绝旧进程或旧结果触发恢复。
  workerGeneration: number;
  // 最近心跳表示进程是否仍存活。
  lastHeartbeatAt: string | null;
  // 最近协议进度表示任务是否产生真实业务推进。
  lastProtocolProgressAt: string | null;
  // 状态变化时间来自任务记录，不使用页面接收时间代替。
  lastStateChangedAt: string;
  // 等待点解释当前释放条件；非等待状态可以为空。
  waitingPoint: string | null;
  // 完成条件与已完成条件分开，方便页面展示真实差距。
  completionConditions: string[];
  // 已完成条件只记录已经具备证据的事实。
  completedConditions: string[];
  // 恢复点由任务 ID、目标状态和执行代数组成，重启后继续使用。
  recoveryCheckpoint: string | null;
  // 阻塞原因保留服务端原文，页面不能隐藏或改写。
  blockingReason: string | null;
  // 阻塞类型控制令狐能否自动恢复，business 必须等待人工决定。
  blockingKind: LinghuBlockingKindOutDto;
}

/** 每个模块向外提供的完整审计报告 DTO。 */
export interface LinghuModuleCompletionReportOutDto {
  // 循环编号标识报告属于第几轮自动保障。
  cycle: number;
  // 模块编码标识报告属于流程、测试还是审计职责。
  module: LinghuAutomationModuleOutDto;
  // 证据只保存可审计事实和结果摘要。
  evidence: string[];
  // 每条执行记录保留任务、动作、实际执行人和结果。
  tasks: Array<{ taskId: string; type: string; action: string; executorMemberId: string; result: string }>;
  // 测试结果显式区分通过、失败、未执行和不适用。
  tests: { status: "passed" | "failed" | "not-run" | "not-applicable"; summary: string };
  // 重启恢复结果包含持久化检查点，避免把测试通过误当应用已恢复。
  restartRecovery: { status: "passed" | "failed" | "not-run" | "not-applicable"; checkpoint: string | null; summary: string };
  // 阻塞结构同时说明原因和恢复条件，不能只保存布尔值。
  blocking: { blocked: boolean; reason: string | null; resumeCondition: string | null };
  // 下一步建议只用于显示，真正轮转由 Store 状态决定。
  nextSuggestion: string;
  // 完成时间用于排序和恢复判断。
  completedAt: string;
}

/** 令狐向外返回的完整自动保障状态 DTO。 */
export interface LinghuAutomationStateOutDto {
  // 版本号控制旧 JSON 的迁移逻辑，当前固定为 2。
  version: 2;
  // 只有用户开关能改变 enabled，检测逻辑不能自行关闭。
  enabled: boolean;
  // 固定 30 秒轮询间隔属于协议事实。
  pollIntervalMs: 30_000;
  // 循环从 1 开始，三个模块完成后递增。
  cycle: number;
  // 当前模块决定本轮只处理哪一种职责。
  currentModule: LinghuAutomationModuleOutDto;
  // 当前启动文案允许为空，表示尚未选择可用入口。
  activePromptId: string | null;
  // 当前任务允许为空，表示尚未派发令狐任务。
  activeTaskId: string | null;
  // 待处理修正提案允许为空，表示当前没有提案等待审批。
  pendingRepairProposalId: string | null;
  // 当前故障次数用于页面显示，权威限制使用下方指纹映射。
  recoveryAttemptCount: number;
  // 当前指纹标识正在处理的真实停点。
  currentFaultFingerprint: string | null;
  // 每个故障指纹独立计数，避免一条流程的恢复次数阻塞其他人物。
  recoveryAttemptsByFingerprint: Record<string, number>;
  // 检测游标记录最近一次处理事实的时间，支持重启恢复。
  detectionCursor: string | null;
  // 每轮检测保存所有未终结任务的只读快照。
  flowSnapshots: LinghuAutomaticFlowSnapshotOutDto[];
  // 测试资源状态来自唯一协调器，空值表示尚无快照。
  testResourceState: TestResourceCoordinatorState | null;
  // 恢复检查点保存下一次能够安全继续的位置。
  recoveryCheckpoint: string | null;
  // 最近派发时间允许为空，表示尚未派发过任务。
  lastDispatchAt: string | null;
  // 最近完成时间允许为空，表示尚未完成过模块。
  lastCompletedAt: string | null;
  // 最近检测时间允许为空，表示自动保障尚未执行检查。
  lastCheckedAt: string | null;
  // 阻塞原因供页面直接显示，空值表示没有已知阻塞。
  blockingReason: string | null;
  // 最近反馈服务简要状态页面，尚无反馈时为空。
  lastFeedback: LinghuAutomationFeedbackOutDto | null;
  // 最近模块报告服务完整审计，尚无报告时为空。
  lastModuleReport: LinghuModuleCompletionReportOutDto | null;
  // 启动文案数组保留用户历史；当前入口由 activePromptId 指向。
  prompts: LinghuStartupPromptOutDto[];
  // 任一原子状态提交都会刷新更新时间。
  updatedAt: string;
}
