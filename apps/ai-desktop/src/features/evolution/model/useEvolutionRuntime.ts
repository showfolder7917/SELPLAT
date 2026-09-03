import { useEffect, useState } from "react";

import type { DecideHanliProposalInDto, EvolutionStateEventOutDto, EvolutionStateOutDto } from "../../../../contracts/system/desktop/index";

/** Evolution Feature 统一拥有跨人物共享状态、订阅和写动作，人物会话只消费该公开模型。 */
export function useEvolutionRuntime() {
  const [state, setState] = useState<EvolutionStateOutDto | null>(null);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    void desktop.getEvolutionState().then(setState);
    return desktop.onEvolutionState((event: EvolutionStateEventOutDto) => setState(event.state));
  }, []);

  const decideProposal = async (proposalId: string, request: DecideHanliProposalInDto) => {
    const next = await window.desktop?.decideEvolutionProposal(proposalId, request);
    if (next) setState(next);
    return next;
  };

  return { state, setState, decideProposal };
}
