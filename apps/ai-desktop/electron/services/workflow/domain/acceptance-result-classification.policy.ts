import type { HanliAcceptanceDispositionValue, HanliAcceptanceRunOutDto } from "../../../../contracts/services/personas/hanli/index.js";

/** 验收写入共同状态前的分流事实；Runtime 只能消费本结果，不能自行解释 blocked。 */
export interface AcceptanceRunClassification {
  /** 通过、真实产品或安全失败、验收能力或环境受阻三种稳定结论。 */
  disposition: HanliAcceptanceDispositionValue;
  /** 分类依据的受阻条件，供时间线详情和可恢复重跑保留事实。 */
  blockedCriterionIds: string[];
  /** 面向后续编排的简短说明，不包含截图正文。 */
  reason: string;
}

/**
 * 将已验证的验收运行归入唯一业务处理类别。
 * 真实 failed 优先于所有受阻；没有受控受阻原因时保守进入能力或环境恢复，绝不猜测产品缺陷。
 */
export function classifyAcceptanceRun(run: HanliAcceptanceRunOutDto): AcceptanceRunClassification {
  const blockedSteps = run.stepResults.filter((step) => step.status === "blocked" || step.layoutStatus === "blocked");
  const blockedCriterionIds = [...new Set(blockedSteps.map((step) => step.checkId))];
  const hasProductOrSafetyFailure = run.sourceReview?.status === "failed"
    || run.stepResults.some((step) => step.status === "failed" || step.layoutStatus === "failed");
  if (hasProductOrSafetyFailure) {
    return { disposition: "product-or-safety-failure", blockedCriterionIds, reason: "已观察到真实页面、代码或安全边界不符合原验收条件。" };
  }
  if (!blockedSteps.length && run.sourceReview?.status === "passed") {
    return { disposition: "passed", blockedCriterionIds: [], reason: "全部验收条件已有完整通过记录。" };
  }
  // 正式业务数据没有出现原条件所需的场景，不等于验收工具坏了，更不能派人修改产品来制造通过。
  if (blockedSteps.length && blockedSteps.every((step) => step.blockerKind === "scenario-precondition")
    && run.sourceReview?.status === "passed") {
    return { disposition: "acceptance-precondition-unavailable", blockedCriterionIds, reason: "正式应用尚未出现原验收条件所需的真实业务前提；保留未验证结果，不派发源码修复。" };
  }
  return { disposition: "acceptance-capability-or-runtime-blocked", blockedCriterionIds, reason: "正式页面检查能力、源码读取能力或运行环境受阻，尚不能判定为产品缺陷。" };
}
