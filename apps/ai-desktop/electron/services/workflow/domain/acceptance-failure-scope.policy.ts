import type { EvolutionProposalOutDto } from "../../../../contracts/services/evolution/index.js";
import type {
  HanliAcceptanceOperationValue,
  HanliAcceptanceRunOutDto,
} from "../../../../contracts/services/personas/hanli/index.js";

/** 韩立本轮验收发现的一项真实新缺陷。 */
export interface AcceptanceFailureDefect {
  /** 失败对应的原验收条件标识。 */
  checkId: string;
  /** 失败对应的具体原验收条件。 */
  target: string;
  /** 韩立在真实界面中观察到的实际结果。 */
  actual: string;
  /** 原提案要求达到的明确结果。 */
  expected: string;
  /** 从本轮开始到失败位置的真实操作步骤。 */
  reproductionOperations: HanliAcceptanceOperationValue[];
  /** 可以回看失败画面的截图标识。 */
  screenshotAttachmentIds: string[];
}

/** 本轮新缺陷与原验收范围的判断结果。 */
export interface AcceptanceFailureScopeReview {
  /** 只有全部失败都能对应原验收条件时才允许自动修复。 */
  decision: "within-original-acceptance" | "outside-original-acceptance";
  /** 面向人物和客户说明的完整结论。 */
  summary: string;
  /** 说明为什么属于或不属于原验收范围。 */
  reason: string;
  /** 从本轮真实失败步骤提取的新缺陷。 */
  defects: AcceptanceFailureDefect[];
}

/**
 * 韩立验收失败范围策略。
 *
 * 业务作用：只根据原提案验收条件和本轮真实操作证据判断能否进入令狐修复。
 * 真实传参示例：传入验收条件“右侧可拖动”和 criterion-1 的失败截图记录。
 * 真实返回示例：返回 within-original-acceptance，并列出实际结果、期望结果和截图。
 * 异常或副作用示例：未知 checkId 或验收条件被替换时返回范围外；本策略不写状态、不派任务。
 */
export class AcceptanceFailureScopePolicy {
  /** 从本轮失败步骤提取缺陷，并与原提案验收条件逐项核对。 */
  review(proposal: EvolutionProposalOutDto, run: HanliAcceptanceRunOutDto): AcceptanceFailureScopeReview {
    // 只把明确失败的判断步骤作为产品缺陷；工具受阻沿独立卡点线路处理。
    const failedSteps = run.stepResults.filter((step) => step.status === "failed");
    // 验收运行必须原样携带当前提案验收条件，防止旧目标或相邻目标混入修复任务。
    const criteriaUnchanged = sameTextList(run.criteria, proposal.acceptanceCriteria);
    // 每个失败步骤必须能定位到一个原验收条件。
    const resolvedSteps = failedSteps.map((step) => {
      // criterion-1 对应验收条件数组的第 1 项。
      const match = /^criterion-(\d+)$/.exec(step.checkId);
      // 无法识别的检查标识不能猜测范围。
      if (!match) return null;
      // 把面向人的序号转换为数组下标。
      const criterionIndex = Number(match[1]) - 1;
      // 越界条件不属于当前提案已经确认的验收范围。
      if (!Number.isInteger(criterionIndex) || criterionIndex < 0 || criterionIndex >= proposal.acceptanceCriteria.length) return null;
      // 读取原提案中对应的具体验收条件。
      const expected = proposal.acceptanceCriteria[criterionIndex].trim();
      // 空验收条件不能授权自动修改代码。
      if (!expected) return null;
      // 截图去重后保留本步骤截图和本轮公共证据。
      const screenshotAttachmentIds = [...new Set([
        step.screenshotAttachmentId,
        ...run.evidenceAttachmentIds,
      ].filter((item): item is string => Boolean(item)))];
      // 返回一项可以直接交给令狐复现的真实新缺陷。
      return {
        checkId: step.checkId,
        target: `验收条件 ${criterionIndex + 1}：${expected}`,
        actual: step.actual.trim() || "本轮真实界面结果未达到验收条件",
        expected,
        reproductionOperations: run.stepResults
          .slice(0, step.operationIndex + 1)
          .map((item) => structuredClone(item.operation)),
        screenshotAttachmentIds,
      } satisfies AcceptanceFailureDefect;
    });
    // 没有真实失败，或者任一失败无法定位原条件时，禁止自动进入原范围修复。
    const isWithinOriginalAcceptance = criteriaUnchanged
      && failedSteps.length > 0
      && resolvedSteps.every((step) => step !== null);
    // 只在范围确认后把完整缺陷列表交给令狐。
    const defects = isWithinOriginalAcceptance
      ? resolvedSteps.filter((step): step is AcceptanceFailureDefect => step !== null)
      : [];
    // 范围内结论必须点名具体失败对象，不能只传达“验收未通过”。
    if (isWithinOriginalAcceptance) {
      return {
        decision: "within-original-acceptance",
        summary: defects.map((defect) => `${defect.target}；实际结果：${defect.actual}；期望结果：${defect.expected}`).join("\n"),
        reason: "本轮每项真实失败都能逐项对应原提案中未改变的验收条件，因此属于原验收范围。",
        defects,
      };
    }
    // 范围外结果说明缺少哪一种确定关系，等待客户或后续调查明确。
    const reason = !criteriaUnchanged
      ? "本轮验收条件与原提案验收条件不一致，不能确认新缺陷仍属于原范围。"
      : failedSteps.length === 0
        ? "本轮记录没有可提取的真实失败判断，不能据此创建代码修复任务。"
        : "至少一项失败无法对应原提案中的具体验收条件，不能自动扩大修复范围。";
    return {
      decision: "outside-original-acceptance",
      summary: "本轮验收失败尚不能确认属于原验收范围，未创建令狐代码修复任务。",
      reason,
      defects: [],
    };
  }
}

/** 比较两份验收条件是否保持相同顺序和相同内容。 */
function sameTextList(left: string[], right: string[]): boolean {
  // 数量不同说明本轮目标已经发生变化。
  if (left.length !== right.length) return false;
  // 每一项都必须与原提案条件完全一致。
  return left.every((item, index) => item.trim() === right[index]?.trim());
}
