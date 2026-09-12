/** 修复调查上下文：只整理任务已有证据，不判断通过、不修改工作流状态。 */
import type { CollaborationTaskOutDto } from "../../../../../../contracts/services/workflow/index.js";

/** 为调查和执行提供相同的跨轮事实，重启后仍从原任务历史恢复。 */
export function repairInvestigationContext(task: CollaborationTaskOutDto, platform: string): string {
  const history = task.flowEvents.filter((event) => event.type.startsWith("unified_test.")
    || event.type.startsWith("execution.repair_") || (event.type.startsWith("integration.") && event.error));
  const recent = history.slice(-12);
  const completedRepairs = history.filter((event) => event.type.endsWith("repair_completed")).length;
  const lines = [
    `实际运行平台：${platform}。环境变量必须按此设置；先验证解释器可用，禁止凭路径猜测操作系统。`,
    `原任务：${task.taskId}；已完成修复轮次：${completedRepairs}。`,
    `任务工作树：${task.versionWorkspace?.rootPath || "尚未签发"}`,
    `已登记结果提交：${task.versionWorkspace?.resultSha || "尚未登记"}`,
    `失败候选目录：${task.integrationFailure?.workspaceRoot || "未记录，先读取发布批次归档"}`,
    `失败批次：${task.integrationFailure?.generation ?? "未记录"}`,
    "先比较任务 HEAD、已登记 resultSha 与失败候选包含的提交。修复未进入候选时先调查调度和交接，不重复修改已经修好的代码。",
  ];
  if (completedRepairs > 0) {
    lines.push("本任务再次失败：必须对照前轮修改与新证据，检查共同根因、相关调用方和相邻失败路径，说明是否需要按职责重构及理由。不得只在最新报错处增加补丁。必要的同工程技术修复可以覆盖已证实的共同原因；新增产品需求仍须确认。");
  }
  if (history.length > recent.length) lines.push(`较早的 ${history.length - recent.length} 条记录未展开，仍保留在原任务历史；证据不足时先读取。`);
  for (const event of recent) {
    lines.push(`${event.occurredAt} ${event.type}：${event.summary}`);
    const detail = event.details;
    for (const value of [detail?.failureSummary, detail?.repairDiagnosis, detail?.repairResult, ...(detail?.technicalEvidence || [])]) {
      if (value) lines.push(value.length > 1200 ? `…前段省略…${value.slice(-1200)}` : value);
    }
  }
  lines.push("交付说明须对应共同根因、实际修改、原失败复测和相邻回归证据；代码级通过后仍须由原流程完成统一测试、发布重启与页面验收。不得跳过或削弱测试制造通过。");
  return lines.join("\n");
}
