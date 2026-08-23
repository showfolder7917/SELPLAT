import type { CollaborationMember, CollaborationTask, LinghuAutomationState, Locale } from "../../../shared/contracts/desktop";

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

const STAGE_IDS: CollaborationProgressStageId[] = ["intent", "approval", "execution", "repair", "unified-test"];

/** 把持久化的任务事实收敛成唯一页面进度，避免各卡片分别猜测当前负责人和流程位置。 */
export function deriveCollaborationTaskProgress(
  task: CollaborationTask,
  member: CollaborationMember,
  automation: LinghuAutomationState | null,
  locale: Locale,
): CollaborationTaskProgress {
  const isJapanese = locale === "ja";
  const currentPlan = task.plans.find((plan) => plan.version === task.currentPlanVersion) || task.plans.at(-1);
  const latestReview = task.reviews.at(-1);
  const latestReviewAttempt = task.reviewAttempts.at(-1);
  const latestExecution = task.executionRecords.at(-1);
  const executorName = latestExecution?.executor.displayName || currentPlan?.ownerDisplayName || member.displayName;
  const reviewerName = task.currentReviewerMemberId
    ? latestReviewAttempt?.reviewerMemberId === task.currentReviewerMemberId ? latestReviewAttempt.reviewerDisplayName : isJapanese ? "レビュー担当" : "当前审核人"
    : latestReview?.reviewerDisplayName || latestReviewAttempt?.reviewerDisplayName || (isJapanese ? "空きレビュー担当" : "空闲审核员");
  const automationOwnsTask = member.memberId === "linghu-ancestor" && automation?.activeTaskId === task.taskId;
  const unifiedTestActive = automationOwnsTask && automation?.currentModule === "unified-test-restart";
  const repairEvents = task.flowEvents.filter((event) => event.stage === "recovery" || event.error);
  const repairActive = !unifiedTestActive && (
    task.state === "optimizing"
    || task.state === "blocked"
    || task.state === "recovering"
    || (automationOwnsTask && Boolean(automation?.recoveryAttemptCount))
  );

  let currentStageId: CollaborationProgressStageId;
  if (unifiedTestActive) currentStageId = "unified-test";
  else if (repairActive) currentStageId = "repair";
  else if (["queued-reviewer", "reviewing"].includes(task.state)) currentStageId = "approval";
  else if (["approved", "forced-after-review-limit", "executing", "ready-for-integration", "queued-integration", "integrating", "integrated"].includes(task.state)) currentStageId = "execution";
  else currentStageId = "intent";

  const terminal = task.state === "integrated" || task.state === "cancelled";
  const analysisCompleted = task.plans.length > 0;
  const approvalCompleted = task.plans.some((plan) => plan.status === "approved" || plan.status === "forced");
  const executionCompleted = task.state === "integrated" || latestExecution?.status === "code-verified";
  const repairCompleted = repairEvents.some((event) => event.stage === "recovery" && event.status === "completed") && !repairActive;
  const unifiedTestCompleted = automationOwnsTask && automation?.currentModule !== "unified-test-restart" && automation.lastFeedback?.taskId === task.taskId;

  const stageFacts: Array<Omit<CollaborationProgressStage, "statusLabel"> & { completed: boolean }> = [
    { id: "intent", label: isJapanese ? "意図分析" : "意图分析", owner: currentPlan?.ownerDisplayName || executorName, status: "not-started", waitingFor: null, updatedAt: currentPlan?.createdAt || null, completed: analysisCompleted },
    { id: "approval", label: isJapanese ? "承認" : "审批", owner: reviewerName, status: "not-started", waitingFor: analysisCompleted ? null : isJapanese ? `${executorName}の分析完了待ち` : `等待${executorName}完成意图分析`, updatedAt: latestReview?.createdAt || latestReviewAttempt?.completedAt || null, completed: approvalCompleted },
    { id: "execution", label: isJapanese ? "実行" : "执行", owner: executorName, status: "not-started", waitingFor: approvalCompleted ? null : isJapanese ? `${reviewerName}の承認待ち` : `等待${reviewerName}完成审批`, updatedAt: latestExecution?.completedAt || latestExecution?.executionStartedAt || latestExecution?.assignedAt || null, completed: executionCompleted },
    { id: "repair", label: isJapanese ? "問題修正" : "问题修复", owner: repairEvents.at(-1)?.actor?.displayName || (repairActive ? member.displayName : executorName), status: "not-started", waitingFor: repairEvents.length ? null : isJapanese ? "失敗または中断の検出待ち" : "等待发现失败或流程中断", updatedAt: repairEvents.at(-1)?.occurredAt || null, completed: repairCompleted },
    { id: "unified-test", label: isJapanese ? "統合テスト" : "统一测试", owner: member.memberId === "linghu-ancestor" ? member.displayName : executorName, status: "not-started", waitingFor: executionCompleted ? null : isJapanese ? `${executorName}の実行完了待ち` : `等待${executorName}完成执行`, updatedAt: unifiedTestActive ? automation?.lastCheckedAt || automation?.updatedAt || null : unifiedTestCompleted ? automation?.lastFeedback?.recordedAt || null : null, completed: Boolean(unifiedTestCompleted) },
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
  const next = nextDestination(task, currentStageId, executorName, reviewerName, member.displayName, isJapanese);
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

function currentAction(task: CollaborationTask, stage: CollaborationProgressStageId, automation: LinghuAutomationState | null, ja: boolean): string {
  if (stage === "unified-test") return ja ? "統合テストと再起動復元を確認中" : "正在执行统一测试与恢复检查";
  if (stage === "repair") {
    if (task.state === "blocked") return ja ? "中断原因を確認中" : "正在检查任务中断原因";
    const count = automation?.recoveryAttemptCount || 0;
    return count > 0 ? (ja ? `${count}回目の自動復旧を実行中` : `正在执行第 ${count} 次自动恢复`) : (ja ? "失敗内容を修正中" : "正在修复流程问题");
  }
  if (stage === "approval") return task.state === "queued-reviewer" ? (ja ? "レビュー担当を待機中" : "正在等待审批人") : (ja ? "修正案をレビュー中" : "正在审批方案");
  if (stage === "execution") {
    if (["ready-for-integration", "queued-integration"].includes(task.state)) return ja ? "統合待ち" : "正在等待集成";
    if (task.state === "integrating") return ja ? "変更を統合中" : "正在集成修改";
    if (task.phase === "verifying") return ja ? "コード検証中" : "正在验证代码";
    if (task.phase === "finalizing") return ja ? "実行結果を整理中" : "正在整理执行结果";
    return ja ? "承認済み案を実行中" : "正在执行已审批方案";
  }
  if (task.state === "queued-executor") return ja ? "実行担当を待機中" : "正在等待执行人";
  if (task.state === "preparing-worktree") return ja ? "タスクスナップショットと独立版を確認中" : "正在检查任务快照并准备独立版本";
  return ja ? "要件と証拠を分析中" : "正在分析意图与问题证据";
}

function nextDestination(task: CollaborationTask, stage: CollaborationProgressStageId, executor: string, reviewer: string, member: string, ja: boolean) {
  if (task.state === "integrated") return { owner: ja ? "完了" : "已完成", action: ja ? "次のタスクを待機" : "等待下一项任务" };
  if (task.state === "cancelled") return { owner: ja ? "担当者" : "人工处理", action: ja ? "再開判断待ち" : "等待是否恢复任务" };
  if (stage === "intent") return { owner: reviewer, action: ja ? "分析案をレビュー" : "审批分析方案" };
  if (stage === "approval") return { owner: executor, action: ja ? "承認済み案を実行" : "执行审批通过的方案" };
  if (stage === "repair") {
    const targetReview = task.recoveryTargetState === "reviewing" || task.recoveryTargetState === "queued-reviewer" || task.state === "optimizing";
    return targetReview ? { owner: reviewer, action: ja ? "修正案を再レビュー" : "重新审批修复方案" } : { owner: executor, action: ja ? "修正後の実行を再開" : "重新执行修复后的任务" };
  }
  if (stage === "unified-test") return { owner: member, action: ja ? "結果を記録して次の循環へ" : "记录结果并进入下一轮" };
  return { owner: member, action: ja ? "統合テストを実行" : "执行统一测试" };
}
