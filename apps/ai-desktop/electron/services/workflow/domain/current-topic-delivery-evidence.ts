import type { CurrentTopicDeliveryEvidenceOutDto } from "../../../../contracts/services/evolution/dto/current-topic-stage.out.dto.js";
import type { CurrentTopicAcceptanceOutDto } from "../../../../contracts/services/evolution/index.js";
import type { CollaborationStateOutDto, CollaborationTaskOutDto } from "../../../../contracts/services/workflow/index.js";

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

/** 以有效任务和已提交的交付事实构建当前候选的门禁依据。 */
export function projectCurrentTopicDeliveryEvidence(
  tasks: CollaborationTaskOutDto[],
  collaboration: CollaborationStateOutDto,
  acceptance: CurrentTopicAcceptanceOutDto | null,
): CurrentTopicDeliveryEvidenceOutDto {
  if (!tasks.length) return { ...emptyCurrentTopicDeliveryEvidence(), acceptance: acceptance?.status || "missing" };
  const generations = [...new Set(tasks.map((task) => task.integrationGeneration).filter((value): value is number => value !== null))];
  const generation = generations.length === 1 ? generations[0] : null;
  const batch = generation === null ? null : collaboration.integrationBatches?.find((item) => item.generation === generation) || null;
  const candidate = batch?.integrationSha ? { generation: batch.generation, integrationSha: batch.integrationSha } : null;
  const hasEvent = (task: CollaborationTaskOutDto, type: CollaborationTaskOutDto["flowEvents"][number]["type"]) =>
    (Array.isArray(task.flowEvents) ? task.flowEvents : []).some((event) => event.type === type && event.status === "completed");
  const hasUnifiedTestFailure = tasks.some((task) => task.unifiedTest?.status === "failed");
  const completedBatchPreservesPass = batch?.state === "completed" && tasks.every((task) =>
    task.integrationGeneration === batch.generation && hasEvent(task, "unified_test.passed"));
  const unifiedTest = hasUnifiedTestFailure ? "failed"
    : tasks.every((task) => task.unifiedTest?.status === "passed" && hasEvent(task, "unified_test.passed"))
      || completedBatchPreservesPass ? "passed" : "missing";
  const release = candidate && tasks.every((task) => hasEvent(task, "release.published")) ? "published" : "missing";
  const restartHealth = release === "published" && tasks.every((task) => hasEvent(task, "release.restart_healthy")) ? "passed" : "missing";
  const preflightEvent = tasks.flatMap((task) => Array.isArray(task.flowEvents) ? task.flowEvents : [])
    .filter((event) => event.type.startsWith("preflight."))
    .sort((left, right) => (right.occurredAt || "").localeCompare(left.occurredAt || ""))[0];
  const details = preflightEvent?.details;
  const preflightStatus = preflightEvent?.type === "preflight.started" ? "running"
    : preflightEvent?.type === "preflight.issues_found" ? "issues-found"
      : preflightEvent?.type === "preflight.rerun_required" ? "rerun-required"
        : preflightEvent?.type === "preflight.reused" ? "reused" : "not-recorded";
  return {
    preflight: {
      status: preflightStatus,
      round: details?.preflightRound || null,
      candidateSha: typeof details?.candidateSha === "string" ? details.candidateSha : null,
      impactScope: details?.impactScope || [], testInputs: details?.testInputs || [], evidenceReferences: details?.evidenceReferences || [],
      evidenceValid: typeof details?.evidenceValid === "boolean" ? details.evidenceValid : null,
      reusableStages: details?.reusableStages || [], issues: details?.preflightIssues || [],
    },
    candidate, unifiedTest, release, restartHealth, acceptance: acceptance?.status || "missing",
  };
}

/** 真实验收恢复只接受同一候选已完成测试、发布和重启健康的持久化事实。 */
export function hasCurrentTopicAcceptanceDeliveryGate(evidence: CurrentTopicDeliveryEvidenceOutDto): boolean {
  return evidence.candidate !== null
    && evidence.unifiedTest === "passed"
    && evidence.release === "published"
    && evidence.restartHealth === "passed";
}
