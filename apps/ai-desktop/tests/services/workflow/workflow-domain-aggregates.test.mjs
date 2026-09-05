// 使用 Node 内置断言验证聚合输出的精确业务状态。
import assert from "node:assert/strict";
// 使用 Node 内置测试运行器保持与现有 Workflow 测试一致。
import test from "node:test";

// 从 Electron 构建产物读取单任务聚合，验证公开运行时真实使用的代码。
import { CollaborationTaskAggregate } from "../../../../../build/ai-desktop/electron/electron/services/workflow/domain/collaboration-task.aggregate.js";
// 从同一构建产物读取提案执行聚合。
import { ProposalExecutionAggregate } from "../../../../../build/ai-desktop/electron/electron/services/workflow/domain/proposal-execution.aggregate.js";
// 从同一构建产物读取卡点聚合。
import { WorkflowCheckpointAggregate } from "../../../../../build/ai-desktop/electron/electron/services/workflow/domain/workflow-checkpoint.aggregate.js";
// 从同一构建产物读取研讨聚合。
import { HanliNangongDeliberationAggregate } from "../../../../../build/ai-desktop/electron/electron/services/workflow/domain/hanli-nangong-deliberation.aggregate.js";

// 创建聚合测试需要的最小协作任务事实。
function task(taskId, state, overrides = {}) {
  // 使用稳定时间保证替代任务排序结果可预测。
  const createdAt = overrides.createdAt || "2026-09-06T00:00:00.000Z";
  // 返回与生产 DTO 字段语义一致的任务对象。
  return {
    // 保存测试任务稳定标识。
    taskId,
    // 初始修订版本为 1。
    taskRevision: 1,
    // 本测试不需要真实执行分配。
    assignmentId: null,
    // 本测试不需要工作代际。
    workerGeneration: 0,
    // 使用调用方指定的权威任务状态。
    state,
    // 阶段不是本测试判断条件。
    phase: null,
    // 测试任务没有固定执行人。
    executorMemberId: null,
    // 没有首选执行人。
    preferredExecutorMemberId: null,
    // 没有原执行人快照。
    originalExecutor: null,
    // 没有当前处理人快照。
    currentHandler: null,
    // 普通任务没有执行修复类型。
    repairKind: null,
    // 没有修复失败原因。
    repairFailureReason: null,
    // 没有统一测试快照。
    unifiedTest: null,
    // 尚未形成执行方案。
    currentPlanVersion: 0,
    // 没有基础设施失败。
    infrastructureFailureCount: 0,
    // 单任务使用独立集成策略。
    mergeStrategy: "INDEPENDENT",
    // 不属于原子任务组。
    atomicGroupId: null,
    // 没有依赖任务。
    dependencyTaskIds: [],
    // 尚未分配集成代际。
    integrationGeneration: null,
    // 本测试不核对发起人。
    initiator: null,
    // 调用方可以覆盖令狐自动来源。
    automationSource: null,
    // 调用方可以覆盖所属提案。
    evolutionProposalId: null,
    // 本测试不需要演化轮次。
    evolutionRoundId: null,
    // 调用方可以覆盖明确替代关系。
    replacementForTaskId: null,
    // 尚未交回南宫婉。
    returnedToNangongAt: null,
    // 不是人物自升级任务。
    selfUpgradeTargetMemberId: null,
    // 没有自升级能力范围。
    selfUpgradeCapabilityScope: null,
    // 没有来源审批标识。
    sourceEvolutionApprovalId: null,
    // 测试快照视为完整历史。
    historyCompleteness: "complete",
    // 提供页面和错误说明使用的冻结任务摘要。
    snapshot: {
      // 标题使用稳定任务标识。
      title: taskId,
      // 问题说明使用稳定任务标识。
      problemStatement: taskId,
      // 已确认意图使用稳定任务标识。
      confirmedIntent: taskId,
      // 本测试没有附加约束。
      constraints: [],
      // 本测试没有验收清单。
      acceptanceCriteria: [],
      // 本测试没有来源消息。
      sourceMessageIds: [],
      // 本测试没有附件。
      attachmentIds: [],
      // 聚合测试不读取工作区内容。
      workspaceState: { roots: [] },
      // 使用稳定语言环境。
      locale: "zh-CN",
      // 使用稳定内容哈希占位。
      contentHash: taskId,
      // 本测试不读取任务规则上下文。
      ruleContext: null,
    },
    // 本测试不读取方案记录。
    plans: [],
    // 本测试不读取执行记录。
    executionRecords: [],
    // 本测试不读取时间线事件。
    flowEvents: [],
    // 本测试不读取工作树。
    versionWorkspace: null,
    // 本测试默认没有集成失败。
    integrationFailure: null,
    // 本测试默认没有客户行动指导。
    customerActionGuidance: null,
    // 本测试不读取最终正文。
    finalResult: null,
    // 本测试不读取结果摘要。
    resultSummary: null,
    // 本测试默认没有阻塞原因。
    blockingReason: null,
    // 本测试默认没有恢复目标状态。
    recoveryTargetState: null,
    // 使用稳定开始时间。
    startedAt: createdAt,
    // 本测试不读取代码验证时间。
    codeVerifiedAt: null,
    // 保存稳定创建时间。
    createdAt,
    // 保存稳定更新时间。
    updatedAt: createdAt,
    // 集成任务使用创建时间作为完成时间。
    completedAt: state === "integrated" ? createdAt : null,
    // 最后应用调用方需要覆盖的关联事实。
    ...overrides,
  };
}

// 创建提案聚合测试需要的最小 Evolution 提案事实。
function proposal(distributedTaskIds, status = "blocked") {
  // 返回只包含聚合真实读取字段的稳定提案对象。
  return {
    // 使用稳定提案标识关联修复任务。
    proposalId: "proposal-1",
    // 使用稳定专题标识。
    topicId: "topic-1",
    // 当前提案版本为 1。
    version: 1,
    // 提供人类可读标题。
    title: "修复窗口拖动",
    // 类型不参与本次状态判断。
    type: "代码修正",
    // 来源不参与本次状态判断。
    origin: "customer-request",
    // 保存真实提交人物标识。
    submitterMemberId: "nangong-wan",
    // 保存真实提交人物名称。
    submitterDisplayName: "南宫婉",
    // 普通提案用于实现客户目标。
    purpose: "product-change",
    // 不是人物能力升级提案。
    targetMemberId: null,
    // 没有目标人物名称。
    targetMemberDisplayName: null,
    // 没有人物能力范围。
    capabilityScope: null,
    // 不是修订提案。
    supersedesProposalId: null,
    // 没有返修审批标识。
    revisionFeedbackApprovalId: null,
    // 提供稳定实施正文。
    content: "修复窗口拖动",
    // 本测试不读取提案证据。
    evidence: [],
    // 本测试不读取影响范围。
    impactScope: [],
    // 本测试不读取排除项。
    exclusions: [],
    // 本测试不读取风险。
    risks: [],
    // 本测试不读取回退方案。
    rollbackPlan: "恢复原实现",
    // 本测试不读取验收清单。
    acceptanceCriteria: [],
    // 本测试不读取分发计划内容。
    distributionPlan: null,
    // 使用调用方指定的提案状态。
    status,
    // 本测试不读取审批记录。
    approvals: [],
    // 保存原始分发任务关系。
    distributedTaskIds,
    // 本测试不读取结果摘要。
    resultSummary: null,
    // 使用稳定创建时间。
    createdAt: "2026-09-06T00:00:00.000Z",
    // 使用稳定更新时间。
    updatedAt: "2026-09-06T00:00:00.000Z",
  };
}

test("提案执行聚合使用已集成修复任务替代阻塞原任务", () => {
  // 创建一条阻塞的原分发任务。
  const original = task("task-original", "blocked", { evolutionProposalId: "proposal-1" });
  // 创建一条明确替代原任务且已经集成的修复任务。
  const repair = task("task-repair", "integrated", {
    // 修复任务属于同一提案。
    evolutionProposalId: "proposal-1",
    // 保存显式替代关系。
    replacementForTaskId: "task-original",
    // 标记真实令狐恢复来源。
    automationSource: "linghu-safeguard",
    // 修复任务晚于原任务形成。
    createdAt: "2026-09-06T00:01:00.000Z",
  });
  // 创建提案执行聚合并取得统一视图。
  const view = new ProposalExecutionAggregate({ proposal: proposal(["task-original"]), collaborationTasks: [original, repair] }).view();
  // 当前有效任务必须是修复任务。
  assert.deepEqual(view.effectiveTasks.map((item) => item.taskId), ["task-repair"]);
  // 原任务已经由修复结果替代，不再保持阻塞。
  assert.equal(view.blocked, false);
  // 修复集成完成后应直接等待韩立验收。
  assert.equal(view.nextStatus, "pending-acceptance");
});

test("提案执行聚合在原记录缺失时接受显式替代任务", () => {
  // 创建一条替代缺失原任务的已集成修复任务。
  const repair = task("task-repair", "integrated", {
    // 修复任务属于同一提案。
    evolutionProposalId: "proposal-1",
    // 指向提案仍然保存的原任务标识。
    replacementForTaskId: "task-missing",
    // 标记真实令狐恢复来源。
    automationSource: "linghu-safeguard",
  });
  // 使用只有修复任务的 Workflow 快照还原执行链。
  const view = new ProposalExecutionAggregate({ proposal: proposal(["task-missing"]), collaborationTasks: [repair] }).view();
  // 显式替代关系应消除原任务缺失。
  assert.deepEqual(view.missingTaskIds, []);
  // 已集成替代任务应进入验收阶段。
  assert.equal(view.nextStatus, "pending-acceptance");
});

test("升级前单任务提案使用已集成令狐任务结束旧阻塞", () => {
  // 创建升级前仍然保留的阻塞原任务。
  const original = task("task-original", "blocked", { evolutionProposalId: "proposal-1" });
  // 创建升级前没有 replacementForTaskId 字段的已集成令狐任务。
  const legacyRepair = task("task-legacy-repair", "integrated", {
    // 旧任务仍然通过提案标识保持可追溯关系。
    evolutionProposalId: "proposal-1",
    // 明确该任务来自令狐卡点恢复。
    automationSource: "linghu-safeguard",
    // 旧修复任务晚于原任务形成。
    createdAt: "2026-09-06T00:02:00.000Z",
  });
  // 使用旧数据恢复提案执行聚合。
  const view = new ProposalExecutionAggregate({ proposal: proposal(["task-original"]), collaborationTasks: [original, legacyRepair] }).view();
  // 唯一原任务场景允许可信旧修复任务接管。
  assert.deepEqual(view.effectiveTasks.map((item) => item.taskId), ["task-legacy-repair"]);
  // 已集成旧修复任务不能再次被判断为提案阻塞。
  assert.equal(view.nextStatus, "pending-acceptance");
});

test("单任务聚合只允许真实阻塞状态恢复并核对人物占用", () => {
  // 使用恢复态任务创建聚合。
  const aggregate = new CollaborationTaskAggregate({ task: task("task-1", "recovering") });
  // 恢复态允许客户或令狐继续。
  assert.equal(aggregate.canRequestRecovery(), true);
  // 工作人物明确持有任务时存在真实所有者。
  assert.equal(aggregate.hasLiveOwner([{ memberId: "linghu-ancestor", currentTaskId: "task-1", state: "repairing" }]), true);
  // 空闲人物的旧任务引用不能冒充仍在执行。
  assert.equal(aggregate.hasLiveOwner([{ memberId: "linghu-ancestor", currentTaskId: "task-1", state: "idle" }]), false);
});

test("卡点聚合最多推进三轮并保留原任务关系", () => {
  // 从没有旧 payload 的异常事实创建第一轮卡点。
  const aggregate = WorkflowCheckpointAggregate.restore(null, {
    // 提供最小异常事实供问题说明使用。
    event: { message: "原任务阻塞" },
    // 关联一次性运行。
    runId: "run-1",
    // 关联原提案。
    proposalId: "proposal-1",
    // 关联原专题。
    topicId: "topic-1",
    // 保存需要被修复任务替代的原任务。
    taskId: "task-original",
    // 原步骤由张铁负责。
    sourceMemberId: "zhang-tie",
    // 原流程停在执行阶段。
    sourcePhase: "executing",
    // 修复后回到执行自检。
    recoveryPoint: "executor-self-check",
  });
  // 原任务关系必须完整保留。
  assert.equal(aggregate.originalTaskId(), "task-original");
  // 第一轮失败后进入第二轮。
  aggregate.startNextRound();
  // 第二轮失败后进入第三轮。
  aggregate.startNextRound();
  // 第三轮再次失败时停止派发。
  aggregate.startNextRound();
  // 聚合必须记录耗尽状态。
  assert.equal(aggregate.isExhausted(), true);
  // 轮次不能增加到第四轮。
  assert.equal(aggregate.round(), 3);
});

test("研讨聚合只把独立数字 1 解释为确认", () => {
  // 创建正在等待用户确认的研讨快照。
  const aggregate = new HanliNangongDeliberationAggregate({
    // 使用稳定研讨标识。
    deliberationId: "deliberation-1",
    // 尚未正式建立专题。
    topicId: null,
    // 候选已经形成并等待确认。
    status: "ready-to-establish",
    // 本测试不读取来源快照。
    sourceSnapshots: [],
    // 保存一轮完整确认事实。
    rounds: [{
      // 使用稳定轮次标识。
      roundId: "round-1",
      // 当前是第一轮。
      roundNumber: 1,
      // 保存韩立原问题。
      question: "是否只保留右侧拖动？",
      // 保存提问原因。
      questionReason: "确认范围",
      // 南宫婉已经回答。
      answer: "是",
      // 韩立已经完成判断。
      assessment: "范围明确",
      // 当前决定建立专题。
      decision: "establish-topic",
      // 保存稳定创建时间。
      createdAt: "2026-09-06T00:00:00.000Z",
      // 保存稳定回答时间。
      answeredAt: "2026-09-06T00:00:10.000Z",
      // 保存稳定判断时间。
      assessedAt: "2026-09-06T00:00:20.000Z",
      // 范围说明已展示但尚未收到回复。
      confirmation: { offer: "只保留右侧拖动", offeredAt: "2026-09-06T00:00:30.000Z", reply: null, repliedAt: null },
    }],
    // 候选存在，满足建立专题的领域条件。
    candidate: { title: "右侧拖动", goal: "恢复右侧拖动", scope: [], exclusions: [], evidence: [], acceptanceCriteria: [], establishmentReason: "用户确认" },
    // 保存稳定创建时间。
    createdAt: "2026-09-06T00:00:00.000Z",
    // 保存稳定更新时间。
    updatedAt: "2026-09-06T00:00:30.000Z",
  });
  // 独立数字 1 返回确认动作。
  assert.equal(aggregate.decideConfirmation(" 1 ").kind, "confirm");
  // 任何完整纠正文案返回继续调查动作。
  assert.equal(aggregate.decideConfirmation("左侧入口也要保留").kind, "revise");
});
