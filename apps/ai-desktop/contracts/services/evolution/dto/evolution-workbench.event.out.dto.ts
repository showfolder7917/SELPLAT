import type { EvolutionWorkbenchViewValue } from "../value/evolution-workbench.value.js";

/** previousStateVersion 与当前页版本不一致时，页面必须重新查询。 */
export interface EvolutionWorkbenchChangeEventOutDto {
  entityType: "topic" | "deliberation" | "proposal" | "automation" | "workspace" | "conversation";
  entityId: string;
  topicId: string | null;
  proposalId: string | null;
  reason: string;
  previousState: string | null;
  currentState: string | null;
  currentStage: string | null;
  currentOwner: string | null;
  blockingReason: string | null;
  nextAction: string | null;
  previousStateVersion: string;
  stateVersion: string;
  updatedAt: string;
  affectedViews: EvolutionWorkbenchViewValue[];
}
