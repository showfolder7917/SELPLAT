import type { CurrentTopicDeliveryEvidenceOutDto } from "../../../../contracts/services/evolution/dto/current-topic-stage.out.dto.js";

/** 尚无候选或门禁事实时，所有当前专题投影共用的完整交付证据。 */
export function emptyCurrentTopicDeliveryEvidence(): CurrentTopicDeliveryEvidenceOutDto {
  return {
    preflight: {
      status: "not-recorded", round: null, candidateSha: null, impactScope: [], testInputs: [],
      evidenceReferences: [], evidenceValid: null, reusableStages: [], issues: [],
    },
    candidate: null,
    unifiedTest: "missing",
    release: "missing",
    restartHealth: "missing",
    acceptance: "missing",
  };
}
