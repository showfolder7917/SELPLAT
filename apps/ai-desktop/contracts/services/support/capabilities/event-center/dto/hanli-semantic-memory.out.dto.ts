/** 韩立语义记忆查询结果；由事件记忆服务生产，韩立人物服务只读消费。 */

export type HanliConcernStatusValue = "candidate" | "confirmed" | "conflicted" | "changed" | "invalid";
export type HanliRequirementNodeStatusValue = "confirmed" | "investigate" | "inferred" | "conflicted" | "waiting-customer" | "implemented-pending-acceptance" | "accepted";

export interface HanliCustomerConcernOutDto {
  concernId: string;
  semanticKey: string;
  name: string;
  description: string;
  category: string;
  scopeType: "global" | "system-type" | "project" | "module" | "page";
  scopeId: string | null;
  status: HanliConcernStatusValue;
  confidence: number;
  weight: number;
  lastObservedAt: string;
  evidence: Array<{
    evidenceId: string;
    source: "codex" | "nangong" | "hanli";
    sourceMessageId: string;
    evidenceType: "explicit" | "correction" | "rejection" | "choice" | "acceptance" | "inference";
    stance: "supporting" | "counterexample" | "changed";
    evidenceExcerpt: string;
    occurredAt: string;
  }>;
}

export interface HanliRequirementNodeOutDto {
  requirementNodeId: string;
  nodeKey: string;
  parentNodeKey: string | null;
  title: string;
  category: string;
  status: HanliRequirementNodeStatusValue;
  statement: string;
  critical: boolean;
  evidenceMessageIds: string[];
}

export interface HanliRequirementTrajectoryOutDto {
  trajectoryId: string;
  sourceCorpusTopicId: string;
  projectScope: string;
  customerGoal: string;
  confirmedFacts: string[];
  assumptions: string[];
  conflicts: string[];
  informationGaps: string[];
  implicitRequirements: string[];
  selectedAction: string;
  questionAsked: string | null;
  questionReason: string | null;
  resultSummary: string | null;
  evolutionDirection: string | null;
  maturityScore: number;
  updatedAt: string;
  nodes: HanliRequirementNodeOutDto[];
}

export interface HanliInspectionExperienceOutDto {
  inspectionExperienceId: string;
  title: string;
  projectScope: string;
  scopeLevel: "finding" | "project" | "stable-rule-candidate";
  applicableObjectTypes: string[];
  applicabilityConditions: string[];
  sourceFindingIds: string[];
  confidenceStatus: "candidate" | "verified-project" | "conflicted" | "limited" | "superseded" | "retired";
  updatedAt: string;
}

export interface HanliSemanticContextOutDto {
  stableUserId: string;
  projectScope: string;
  concerns: HanliCustomerConcernOutDto[];
  trajectories: HanliRequirementTrajectoryOutDto[];
  inspectionExperiences: HanliInspectionExperienceOutDto[];
}

export interface HanliCorpusExtractionCandidateOutDto {
  extractionId: string;
  corpusTopicId: string;
  stableUserId: string;
  source: "codex" | "nangong" | "hanli";
  sourceConversationId: string;
  sourceTurnId: string;
  title: string;
  topicType: string;
  inferredIntent: string | null;
  tags: string[];
  sourceContentHash: string;
  extractorVersion: string;
  projectScope: string;
  messages: Array<{ sourceMessageId: string; speakerRole: "user" | "codex" | "nangong" | "hanli"; content: string; createdAt: string }>;
  existingConcerns: HanliCustomerConcernOutDto[];
}
