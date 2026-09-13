import type { CollaborationFlowEventOutDto, CollaborationTaskOutDto } from "../../../../../../contracts/services/workflow/index.js";
import type { EvolutionStateOutDto } from "../../../../../../contracts/services/evolution/index.js";

const VISIBLE_EVENTS = new Set<CollaborationFlowEventOutDto["type"]>([
  "task.scope_revised", "executor.assigned", "executor.reassigned", "technical_analysis.ready",
  "execution.started", "task.blocked", "execution.repair_started", "execution.repair_investigated",
  "execution.repair_completed", "execution.repair_waiting", "integration.merge_conflict",
  "integration.infrastructure_failed", "unified_test.started", "unified_test.failed",
  "unified_test.repair_started", "unified_test.repair_investigated", "unified_test.repair_completed",
  "unified_test.repair_failed", "unified_test.passed", "release.restart_healthy", "task.cancelled",
]);

/** 把内部任务状态转换成客户能直接判断进展的四段式反馈。 */
export function presentHanliTaskStatus(task: CollaborationTaskOutDto, event: CollaborationFlowEventOutDto): string | null {
  if (!VISIBLE_EVENTS.has(event.type)) return null;
  const current = currentStatus(event);
  const failed = failureReason(task, event);
  const next = nextStep(task, event);
  const action = task.customerActionGuidance
    ? `需要。${task.customerActionGuidance.title}`
    : task.repairRequiresUserConfirmation
      ? "需要。请确认任务卡中列出的修改范围后继续。"
      : "暂时不需要；需要你决定范围或授权时，我会明确说明。";
  return [`任务：${task.snapshot.title}`, `当前在做：${current}`, `失败原因：${failed}`, `接下来：${next}`, `需要你处理：${action}`].join("\n");
}

/** 在正式执行任务建立前及最终验收阶段，把统一流程状态转换成客户能读懂的反馈。 */
export function presentHanliWorkflowStatus(state: EvolutionStateOutDto): string | null {
  const run = state.oneShotRun;
  if (!run) return null;
  const proposal = run.proposalId ? state.proposals.find((item) => item.proposalId === run.proposalId) : null;
  const topic = run.topicId ? state.topics.find((item) => item.topicId === run.topicId) : null;
  const title = proposal?.title || topic?.title || "当前需求";
  if (run.status === "running" && ["executing", "testing"].includes(run.phase)) return null;
  const current = workflowCurrentStatus(run);
  const failed = run.status === "blocked" ? run.blockingReason || "当前步骤没有完成。" : "目前没有新的失败。";
  const next = workflowNextStep(run);
  const action = run.status === "blocked"
    ? "需要。请在任务协作群查看原因并选择“从卡点继续”；需要确认范围或授权时我会单独说明。"
    : "暂时不需要；需要你决定范围或授权时，我会明确说明。";
  return [`任务：${title}`, `当前在做：${current}`, `失败原因：${failed}`, `接下来：${next}`, `需要你处理：${action}`].join("\n");
}

function workflowCurrentStatus(run: NonNullable<EvolutionStateOutDto["oneShotRun"]>): string {
  if (run.status === "blocked") return "当前步骤没有完成，流程已停在可恢复位置。";
  if (run.status === "completed") return "本轮任务和真实页面验收已经完成。";
  switch (run.phase) {
    case "preparing-topic": return "韩立正在明确需求，南宫婉正在补齐事实。";
    case "forming-proposal": return "南宫婉正在根据调查结果整理修复方案。";
    case "approving": return "韩立正在检查方案的架构、页面布局和用户操作路径。";
    case "distributing": return "方案已通过，南宫婉正在拆分并指派执行任务。";
    case "accepting": return "韩立正在按真实用户路径检查新版本。";
    default: return run.action;
  }
}

function workflowNextStep(run: NonNullable<EvolutionStateOutDto["oneShotRun"]>): string {
  if (run.status === "blocked") return "从原卡点恢复后重新执行当前步骤，不新建重复专题。";
  if (run.status === "completed") return "归档本轮记录；自动托管开启时继续寻找下一个有证据的问题。";
  switch (run.phase) {
    case "preparing-topic": return "形成清楚的目标和范围后交给南宫婉整理方案。";
    case "forming-proposal": return "方案形成后由韩立检查并决定是否可以执行。";
    case "approving": return "审批通过后由南宫婉指派普通执行人。";
    case "distributing": return "执行人接收任务后开始修改和自检。";
    case "accepting": return "验收通过后完成本轮；失败则按真实原因回到对应步骤。";
    default: return "完成当前步骤后继续下一阶段。";
  }
}

function currentStatus(event: CollaborationFlowEventOutDto): string {
  switch (event.type) {
    case "executor.assigned": case "executor.reassigned": return "执行人已接到任务，正在准备本轮修改。";
    case "technical_analysis.ready": return "已经理清修改方法，正在开始实施。";
    case "execution.started": return "正在修改并进行本轮自检。";
    case "task.scope_revised": return "客户最新纠正已经写回原任务，旧执行已经停止。";
    case "unified_test.started": return "本轮修改已完成，正在做整体验证。";
    case "unified_test.passed": return "整体验证已经通过，正在准备发布。";
    case "release.restart_healthy": return "新版本已发布并完成重启检查。";
    case "execution.repair_started": case "unified_test.repair_started": return "令狐正在调查本轮失败。";
    case "execution.repair_investigated": case "unified_test.repair_investigated": return "令狐已经查到原因，正在修复。";
    case "execution.repair_completed": case "unified_test.repair_completed": return "令狐已完成修复，正在重新验证。";
    case "task.cancelled": return "任务已经停止。";
    default: return event.summary;
  }
}

function failureReason(task: CollaborationTaskOutDto, event: CollaborationFlowEventOutDto): string {
  if (event.error || event.status === "failed" || task.state === "blocked" || task.state === "test-failed") {
    return task.blockingReason || event.details?.failureSummary || event.summary;
  }
  return "目前没有新的失败。";
}

function nextStep(task: CollaborationTaskOutDto, event: CollaborationFlowEventOutDto): string {
  if (task.customerActionGuidance || task.repairRequiresUserConfirmation) return "收到你的处理结果后，从当前节点继续。";
  if (event.type === "release.restart_healthy") return "韩立核对真实页面和内部证据，给出本轮验收结论。";
  if (event.type === "unified_test.passed") return "打包、发布并关闭旧进程后重启。";
  if (event.type === "unified_test.failed" || event.type === "task.blocked") return "令狐先查明原因，在原任务中修复后重新验证。";
  if (event.type === "task.cancelled") return "不再继续这项任务。";
  return "完成当前步骤后继续验证；失败时由令狐在原任务中处理。";
}
