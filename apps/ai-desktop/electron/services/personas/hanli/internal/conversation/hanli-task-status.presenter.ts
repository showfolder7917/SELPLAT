import type { CollaborationFlowEventOutDto, CollaborationTaskOutDto } from "../../../../../../contracts/services/workflow/index.js";

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
