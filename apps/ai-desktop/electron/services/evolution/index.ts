// Evolution 是专题、提案、审批和验收共同事实的唯一逻辑所有者。
export {
  EvolutionFacade,
  createEvolutionRuntime,
  createEvolutionMutationCoordinator,
  createEvolutionState,
  type EvolutionApplicationPort,
  type EvolutionMutationPort,
  type EvolutionRuntime,
  type EvolutionStatePort,
} from "./evolution.facade.js";
