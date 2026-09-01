/**
 * 旧人物页四阶段进度模型，仅供人物页和会话回退视图继续读取。
 * @deprecated 新任务协作群统一消费主进程 CollaborationTimelineSnapshotOutDto；稳定后单独删除本实现。
 */
import type { CollaborationMember, CollaborationTask, LinghuAutomationStateOutDto, Locale } from "../../../../contracts/desktop/desktop";

// 人物页固定展示五个业务环节；审批在协作任务创建前已完成，因此进入任务页时通常已经是完成态。
export type CollaborationProgressStageId = "intent" | "approval" | "execution" | "repair" | "unified-test";
export type CollaborationProgressStageStatus = "completed" | "current" | "waiting" | "not-started" | "failed";

export interface CollaborationProgressStage {
  id: CollaborationProgressStageId;
  label: string;
  owner: string;
  status: CollaborationProgressStageStatus;
  statusLabel: string;
  waitingFor: string | null;
  updatedAt: string | null;
}

export interface CollaborationTaskProgress {
  currentStageId: CollaborationProgressStageId;
  currentOwner: string;
  currentAction: string;
  currentStep: number;
  totalSteps: number;
  updatedAt: string;
  nextOwner: string;
  nextAction: string;
  stages: CollaborationProgressStage[];
}

// 顺序就是新手在页面上理解任务推进时看到的真实先后顺序。
const STAGE_IDS: CollaborationProgressStageId[] = ["intent", "approval", "execution", "repair", "unified-test"];

/** 流式内容到达时先冻结所属环节，后续状态推进不能把旧报告迁移到新的当前卡点。 */
export function deriveCollaborationTaskCurrentStage(
  task: CollaborationTask,
  automation: LinghuAutomationStateOutDto | null,
): CollaborationProgressStageId {
  const automationOwnsTask = automation?.activeTaskId === task.taskId;
  const unifiedTestActive = ["returned-to-nangong", "ready-for-integration", "queued-integration", "integrating", "unified-testing", "awaiting-restart", "test-failed"].includes(task.state)
    || (automationOwnsTask && automation?.currentModule === "test-coverage");
  const repairActive = !unifiedTestActive && (
    task.state === "blocked"
    || task.state === "recovering"
    || task.state === "repairing-execution"
    || (automationOwnsTask && Boolean(automation?.recoveryAttemptCount))
  );

  if (unifiedTestActive) return "unified-test";
  if (repairActive) return "repair";
  if (task.state === "integrated") return "unified-test";
  if (task.state === "executing") return "execution";
  return "intent";
}

/** 把持久化的任务事实收敛成唯一页面进度，避免各卡片分别猜测当前负责人和流程位置。 */
export function deriveCollaborationTaskProgress(
  task: CollaborationTask,
  member: CollaborationMember,
  automation: LinghuAutomationStateOutDto | null,
  locale: Locale,
): CollaborationTaskProgress {
  const isJapanese = locale === "ja";
  const currentPlan = task.plans.find((plan) => plan.version === task.currentPlanVersion) || task.plans.at(-1);
  const latestExecution = task.executionRecords.at(-1);
  const executorName = latestExecution?.executor.displayName || currentPlan?.ownerDisplayName || member.displayName;
  const automationOwnsTask = automation?.activeTaskId === task.taskId;
  const unifiedTestActive = ["returned-to-nangong", "ready-for-integration", "queued-integration", "integrating", "unified-testing", "awaiting-restart", "test-failed"].includes(task.state)
    || (automationOwnsTask && automation?.currentModule === "test-coverage");
  const repairEvents = task.flowEvents.filter((event) => event.stage === "recovery" || event.error);
  const repairActive = !unifiedTestActive && (
    task.state === "blocked"
    || task.state === "recovering"
    || task.state === "repairing-execution"
    || (automationOwnsTask && Boolean(automation?.recoveryAttemptCount))
  );

  const currentStageId = deriveCollaborationTaskCurrentStage(task, automation);

  const terminal = task.state === "integrated" || task.state === "cancelled";
  const analysisCompleted = task.plans.length > 0;
  const executionCompleted = task.state === "integrated" || latestExecution?.status === "code-verified";
  const repairCompleted = repairEvents.some((event) => event.stage === "recovery" && event.status === "completed") && !repairActive;
  const unifiedTestCompleted = task.state === "integrated"
    || (automationOwnsTask && automation?.currentModule !== "test-coverage" && automation.lastFeedback?.taskId === task.taskId);

  const stageFacts: Array<Omit<CollaborationProgressStage, "statusLabel"> & { completed: boolean }> = [
    { id: "intent", label: isJapanese ? "意図分析" : "意图分析", owner: currentPlan?.ownerDisplayName || executorName, status: "not-started", waitingFor: null, updatedAt: currentPlan?.createdAt || null, completed: analysisCompleted },
    // 协作任务由审批通过后的分发动作创建；普通任务没有审批单时按“不需要额外审批”完成该环节。
    { id: "approval", label: isJapanese ? "方向承認" : "方向审批", owner: task.sourceEvolutionApprovalId ? "韩立" : (isJapanese ? "承認不要" : "无需审批"), status: "not-started", waitingFor: analysisCompleted ? null : (isJapanese ? "意図分析の完了待ち" : "等待意图分析完成"), updatedAt: task.createdAt, completed: analysisCompleted },
    { id: "execution", label: isJapanese ? "実行" : "执行", owner: executorName, status: "not-started", waitingFor: analysisCompleted ? null : isJapanese ? `${executorName}の技術分析完了待ち` : `等待${executorName}完成技术分析`, updatedAt: latestExecution?.completedAt || latestExecution?.executionStartedAt || latestExecution?.assignedAt || null, completed: executionCompleted },
    { id: "repair", label: isJapanese ? "問題修正" : "问题修复", owner: repairEvents.at(-1)?.actor?.displayName || (repairActive ? member.displayName : executorName), status: "not-started", waitingFor: repairEvents.length ? null : isJapanese ? "失敗または中断の検出待ち" : "等待发现失败或流程中断", updatedAt: repairEvents.at(-1)?.occurredAt || null, completed: repairCompleted },
    { id: "unified-test", label: isJapanese ? "統合テスト" : "统一测试", owner: "令狐老祖", status: "not-started", waitingFor: executionCompleted ? null : isJapanese ? `${executorName}の実行完了待ち` : `等待${executorName}完成执行`, updatedAt: unifiedTestActive ? automation?.lastCheckedAt || automation?.updatedAt || task.updatedAt : unifiedTestCompleted ? automation?.lastFeedback?.recordedAt || task.completedAt : null, completed: Boolean(unifiedTestCompleted) },
  ];

  const statusLabels = isJapanese
    ? { completed: "完了", current: "進行中", waiting: "待機", "not-started": "未開始", failed: "失敗" }
    : { completed: "已完成", current: "进行中", waiting: "等待中", "not-started": "未开始", failed: "失败" };
  const stages = stageFacts.map(({ completed, ...stage }) => {
    let status: CollaborationProgressStageStatus = completed ? "completed" : stage.id === currentStageId && !terminal ? "current" : "not-started";
    if (!completed && stage.waitingFor) status = "waiting";
    if (stage.id === "repair" && task.state === "blocked") status = "failed";
    if (stage.id === currentStageId && !terminal && task.state !== "blocked") status = "current";
    return { ...stage, status, statusLabel: statusLabels[status] };
  });

  const currentOwner = stages.find((stage) => stage.id === currentStageId)?.owner || member.displayName;
  const action = currentAction(task, currentStageId, automation, isJapanese);
  const next = nextDestination(task, currentStageId, executorName, member.displayName, isJapanese);
  return {
    currentStageId,
    currentOwner,
    currentAction: action,
    currentStep: STAGE_IDS.indexOf(currentStageId) + 1,
    totalSteps: STAGE_IDS.length,
    updatedAt: task.updatedAt,
    nextOwner: next.owner,
    nextAction: next.action,
    stages,
  };
}

function currentAction(task: CollaborationTask, stage: CollaborationProgressStageId, automation: LinghuAutomationStateOutDto | null, ja: boolean): string {
  if (stage === "unified-test") {
    if (task.state === "integrated") return ja ? "統合テスト完了" : "统一测试已通过";
    if (task.state === "test-failed") return ja ? "統合テスト失敗を修正中" : "正在修复统一测试失败";
    return ja ? "統合テストと再起動復元を確認中" : "正在执行统一测试与恢复检查";
  }
  if (stage === "repair") {
    if (task.state === "blocked") return ja ? "中断原因を確認中" : "正在检查任务中断原因";
    const count = automation?.recoveryAttemptCount || 0;
    return count > 0 ? (ja ? `${count}回目の自動復旧を実行中` : `正在执行第 ${count} 次自动恢复`) : (ja ? "失敗内容を修正中" : "正在修复流程问题");
  }
  // 审批环节通常已在任务创建前结束，这个分支用于恢复旧快照时给出可理解说明。
  if (stage === "approval") return ja ? "実行方向を確認中" : "正在确认执行方向";
  if (stage === "execution") {
    if (task.state === "returned-to-nangong") return ja ? "南宮婉がラウンド結果を収集中" : "南宫婉正在收集本轮结果";
    if (task.state === "awaiting-restart") return ja ? "新しいバージョンの再起動確認待ち" : "等待新版本重启健康检查";
    if (["ready-for-integration", "queued-integration"].includes(task.state)) return ja ? "令狐の一括統合待ち" : "等待令狐整批集成";
    if (task.state === "integrating") return ja ? "変更を統合中" : "正在集成修改";
    if (task.phase === "verifying") return ja ? "コード検証中" : "正在验证代码";
    if (task.phase === "finalizing") return ja ? "実行結果を整理中" : "正在整理执行结果";
    return ja ? "技術分析に沿って実行中" : "正在按技术分析执行";
  }
  if (task.state === "queued-executor") return ja ? "実行担当を待機中" : "正在等待执行人";
  if (task.state === "preparing-worktree") return ja ? "タスクスナップショットと独立版を確認中" : "正在检查任务快照并准备独立版本";
  return ja ? "要件と証拠を分析中" : "正在分析意图与问题证据";
}

function nextDestination(task: CollaborationTask, stage: CollaborationProgressStageId, executor: string, member: string, ja: boolean) {
  if (task.state === "integrated") return { owner: ja ? "完了" : "已完成", action: ja ? "次のタスクを待機" : "等待下一项任务" };
  if (task.state === "cancelled") return { owner: ja ? "担当者" : "人工处理", action: ja ? "再開判断待ち" : "等待是否恢复任务" };
  if (stage === "intent") return { owner: task.sourceEvolutionApprovalId ? "韩立" : executor, action: task.sourceEvolutionApprovalId ? (ja ? "方向を承認" : "审批执行方向") : (ja ? "技術分析に沿って実行" : "按技术分析直接执行") };
  if (stage === "approval") return { owner: executor, action: ja ? "承認済み方向に沿って実行" : "按已审批方向执行" };
  if (stage === "repair") {
    return { owner: executor, action: ja ? "修正後の実行を再開" : "重新执行修复后的任务" };
  }
  if (stage === "unified-test") return { owner: member, action: ja ? "結果を記録して次の循環へ" : "记录结果并进入下一轮" };
  return { owner: member, action: ja ? "統合テストを実行" : "执行统一测试" };
}
