import type { EvolutionStateOutDto } from "../../../../contracts/system/desktop/index";

/**
 * 初始 IPC 读取和实时事件会并发抵达。实时状态一旦到达，就不能再让较早发起的
 * 初始读取覆盖它，否则验收失败会被先前的“验收中”快照回写到测试台。
 */
export function createEvolutionStateSynchronizer() {
  let receivedLiveState = false;
  return {
    acceptInitial(state: EvolutionStateOutDto): EvolutionStateOutDto | null {
      return receivedLiveState ? null : state;
    },
    acceptLive(state: EvolutionStateOutDto): EvolutionStateOutDto {
      receivedLiveState = true;
      return state;
    },
  };
}
