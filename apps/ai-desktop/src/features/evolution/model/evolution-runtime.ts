import type { EvolutionStateOutDto } from "../../../../contracts/system/desktop/index";

/** 为人物发起的专题写操作生成状态版本快照和不可复用的幂等键。 */
export function evolutionMutationRequest(state: EvolutionStateOutDto) {
  return { expectedStateVersion: state.updatedAt, idempotencyKey: crypto.randomUUID() };
}
