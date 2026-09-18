import type { EvolutionStateOutDto } from "../../../contracts/services/evolution/index.js";

/** Evolution 业务状态所需的最小持久化能力；不得暴露 SQLite 连接或 SQL。 */
export interface EvolutionStatePersistencePort {
  load(): EvolutionStateOutDto | null;
  loadLatestConversation(): EvolutionStateOutDto["conversation"] | null;
  loadLatestBlockedOneShotRecovery?(topicId: string, proposalId: string): {
    runId: string;
    startedAt: string;
    blockedAt: string;
    reason: string;
  } | null;
  save(state: EvolutionStateOutDto): void;
}
