import type { CollaborationStateOutDto } from "../../services/workflow/index.js";
import type { EvolutionStateOutDto } from "../../services/evolution/index.js";
import type { LinghuAutomationStateOutDto } from "../../services/personas/linghu/index.js";

export interface WorkflowStateReaderPort {
  collaboration(): CollaborationStateOutDto;
  evolution(): EvolutionStateOutDto;
  linghu(): LinghuAutomationStateOutDto;
}
