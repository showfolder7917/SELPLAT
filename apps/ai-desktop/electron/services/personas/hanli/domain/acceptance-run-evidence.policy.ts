import type { HanliAcceptanceRunOutDto } from "../../../../../contracts/services/personas/hanli/index.js";

export interface AcceptanceCriterionEvidenceDiagnostic {
  criterionId: string;
  resultCount: number;
  hasActual: boolean;
  hasLayoutActual: boolean;
  functionalScreenshotRegistered: boolean;
  layoutScreenshotRegistered: boolean;
  valid: boolean;
}

export interface AcceptanceRunEvidenceValidation {
  valid: boolean;
  hasEvidence: boolean;
  hasInteractionSteps: boolean;
  hasValidVersion: boolean;
  criteria: AcceptanceCriterionEvidenceDiagnostic[];
}

/**
 * 在验收记录进入状态机前逐项检查可归档证据，并返回不含截图内容的诊断事实。
 * 该策略只复用既有通过门槛；消费者据此审计或拒绝记录，不能借诊断降低真实交互要求。
 */
export function inspectAcceptanceRunEvidence(run: HanliAcceptanceRunOutDto): AcceptanceRunEvidenceValidation {
  const evidence = new Set(run.evidenceAttachmentIds);
  const criteria = run.criteria.map((_criterion, index) => {
    const criterionId = `criterion-${index + 1}`;
    const matches = run.stepResults.filter((step) => step.checkId === criterionId);
    const step = matches[0];
    const hasActual = Boolean(step?.actual?.trim());
    const hasLayoutActual = Boolean(step?.layoutActual?.trim());
    const functionalScreenshotRegistered = Boolean(step?.screenshotAttachmentId && evidence.has(step.screenshotAttachmentId));
    const layoutScreenshotRegistered = Boolean(step?.layoutScreenshotAttachmentId && evidence.has(step.layoutScreenshotAttachmentId));
    const valid = matches.length === 1
      && step !== undefined
      && ["passed", "failed", "blocked"].includes(step.status)
      && hasActual
      && functionalScreenshotRegistered
      && ["passed", "failed", "blocked"].includes(step.layoutStatus)
      && hasLayoutActual
      && layoutScreenshotRegistered;
    return { criterionId, resultCount: matches.length, hasActual, hasLayoutActual, functionalScreenshotRegistered, layoutScreenshotRegistered, valid };
  });
  const hasValidVersion = run.version === 2;
  const hasInteractionSteps = run.stepResults.length > 0;
  const hasEvidence = run.evidenceAttachmentIds.length > 0;
  return { valid: hasValidVersion && hasInteractionSteps && hasEvidence && criteria.every((criterion) => criterion.valid), hasEvidence, hasInteractionSteps, hasValidVersion, criteria };
}
