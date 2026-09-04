import type { HanliAcceptancePlanOutDto, HanliAcceptanceRunOutDto } from "../../../../../contracts/services/personas/hanli/index.js";

/** 检查计划与实际执行一一对应；截图和聚焦只提供材料，不能证明用户操作成功。 */
export function acceptanceEvidenceProblems(plan: HanliAcceptancePlanOutDto, run?: HanliAcceptanceRunOutDto): string[] {
  const problems: string[] = [];
  if (!plan.checks.length) problems.push("没有可执行验收项目");
  for (const check of plan.checks) {
    const operations = check.operations;
    const assertions = operations.flatMap((operation, index) => operation.type === "inspect-text" || operation.type === "inspect-layout" ? [index] : []);
    const interactions = operations.flatMap((operation, index) => ["click", "scroll", "press-key", "resize-window"].includes(operation.type) ? [index] : []);
    if (!assertions.length) problems.push(`${check.checkId}：缺少结果断言，截图不能代替验收`);
    // 默认要求真实操作；只有明确声明为观察项才允许不改变页面。
    if (check.verificationMode !== "observation" && !interactions.length) problems.push(`${check.checkId}：缺少真实交互操作`);
    if (interactions.some((index) => !assertions.some((assertion) => assertion > index))) problems.push(`${check.checkId}：交互后没有验证结果`);
    if (!run) continue;
    for (const [index, operation] of operations.entries()) {
      const results = run.stepResults.filter((step) => step.checkId === check.checkId && step.operationIndex === index);
      if (results.length !== 1 || results[0].status !== "passed" || JSON.stringify(results[0].operation) !== JSON.stringify(operation)) problems.push(`${check.checkId} 第 ${index + 1} 步：缺失、失败或与计划不符`);
    }
    if (!run.stepResults.some((step) => step.checkId === check.checkId && step.screenshotAttachmentId && run.evidenceAttachmentIds.includes(step.screenshotAttachmentId))) problems.push(`${check.checkId}：没有关联真实截图证据`);
  }
  return problems;
}
