import { useEffect, useRef, useState } from "react";

import type { DecideHanliProposalInDto, EvolutionStateEventOutDto, EvolutionStateOutDto } from "../../../../contracts/system/desktop/index";

/** Evolution Feature 统一拥有跨人物共享状态、订阅和写动作，人物会话只消费该公开模型。 */
export function useEvolutionRuntime() {
  const [state, setState] = useState<EvolutionStateOutDto | null>(null);
  const resumeLock = useRef(false);
  const [resumingRunId, setResumingRunId] = useState<string | null>(null);
  const [resumeFeedback, setResumeFeedback] = useState<{ runId: string; error: boolean; message: string } | null>(null);

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

  /** 状态锁属于共享运行模型，切换任务页签不会产生第二次恢复请求。 */
  const resumeOneShot = async (runId: string) => {
    if (resumeLock.current) return;
    resumeLock.current = true;
    setResumingRunId(runId);
    setResumeFeedback(null);
    try {
      if (!window.desktop) throw new Error("桌面连接不可用，未发起恢复。");
      const next = await window.desktop.resumeEvolutionOneShot(runId);
      setState(next);
      const run = next.oneShotRun;
      const blocked = run?.status === "blocked";
      setResumeFeedback({ runId, error: blocked, message: blocked ? run.blockingReason || "仍有阻塞，尚未恢复。" : run?.status === "completed" ? "本轮已完成。" : "已从原卡点继续，请查看后续流程。" });
    } catch (error) {
      setResumeFeedback({ runId, error: true, message: (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+':\s*/, "") });
    } finally {
      resumeLock.current = false;
      setResumingRunId(null);
    }
  };

  return { state, setState, decideProposal, resumeOneShot, resumingRunId, resumeFeedback };
}
