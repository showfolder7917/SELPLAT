/** 修复调查上下文：只整理任务已有证据，不判断通过、不修改工作流状态。 */
import type { CollaborationTaskOutDto } from "../../../../../../contracts/services/workflow/index.js";

/** 为调查和执行提供相同的跨轮事实，重启后仍从原任务历史恢复。 */
export function repairInvestigationContext(task: CollaborationTaskOutDto, platform: string): string {
  const history = task.flowEvents.filter((event) => event.type.startsWith("unified_test.")
    || event.type.startsWith("execution.repair_")
    || event.type.startsWith("executor.self_test_")
    || event.type.startsWith("executor.self_repair_")
    || (event.type.startsWith("integration.") && event.error));
  const recent = history.slice(-12);
  const completedRepairs = history.filter((event) => event.type.endsWith("repair_completed")).length;
  const lines = [
    `实际运行平台：${platform}。环境变量必须按此设置；先验证解释器可用，禁止凭路径猜测操作系统。`,
    `原任务：${task.taskId}；已完成修复轮次：${completedRepairs}。`,
    `任务工作树：${task.versionWorkspace?.rootPath || "尚未签发"}`,
    `已登记结果提交：${task.versionWorkspace?.resultSha || "尚未登记"}`,
    `失败候选目录：${task.integrationFailure?.workspaceRoot || "未记录，先读取发布批次归档"}`,
    `失败批次：${task.integrationFailure?.generation ?? "未记录"}`,
    "先比较任务 HEAD、已登记 resultSha、运行应用携带的候选 SHA 与失败候选包含的提交。版本包含关系必须用候选清单和 Git ancestry 验证；所有时间先解析为带时区的绝对时间，禁止用不同时区的墙上钟点推断修复是否已进入运行版本。",
    "页面缺陷必须使用同一个稳定业务标识建立运行证据链：依次记录持久化事实、主进程/窗口 API DTO 和真实页面 DOM 的实际值。任一层尚未读取都只能报告证据缺口，不能凭源码存在组件或测试通过认定页面已经具备能力。",
    "新候选完成发布重启后若真实页面仍复现同一症状，前一轮根因与修复结论自动降级为待证伪假设；必须沿实际运行数据重新定位第一个丢失或变形的边界，禁止重复发布、重复原补丁或仅以源码审查结束。",
    "统一测试若一次报告多个未通过项，先按共同根因分组，列全每组的调用方、边界、修复项和回归项；全部纳入同一修复计划后再实施，不得处理第一项后提前交回。",
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
