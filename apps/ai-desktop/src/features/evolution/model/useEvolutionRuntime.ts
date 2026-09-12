import { useEffect, useRef, useState } from "react";

import type { DecideHanliProposalInDto, EvolutionStateEventOutDto, EvolutionStateOutDto } from "../../../../contracts/system/desktop/index";
import { getOptionalCollaborationDesktopApi } from "../../../foundation/desktop-api";
import { createEvolutionStateSynchronizer } from "./evolution-state-synchronizer";

/** Evolution Feature 统一拥有跨人物共享状态、订阅和写动作，人物会话只消费该公开模型。 */
export function useEvolutionRuntime() {
  const [state, setState] = useState<EvolutionStateOutDto | null>(null);
  const resumeLock = useRef(false);
  const [resumingRunId, setResumingRunId] = useState<string | null>(null);
  const [resumeFeedback, setResumeFeedback] = useState<{ runId: string; error: boolean; message: string } | null>(null);

  useEffect(() => {
    const desktop = getOptionalCollaborationDesktopApi();
    if (!desktop) return;
    const synchronizer = createEvolutionStateSynchronizer();
    let active = true;
    void desktop.getEvolutionState().then((initial) => {
      const next = synchronizer.acceptInitial(initial);
      if (active && next) setState(next);
    });
    const unsubscribe = desktop.onEvolutionState((event: EvolutionStateEventOutDto) => {
      if (active) setState(synchronizer.acceptLive(event.state));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const decideProposal = async (proposalId: string, request: DecideHanliProposalInDto) => {
    const next = await getOptionalCollaborationDesktopApi()?.decideEvolutionProposal(proposalId, request);
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
      const collaborationApi = getOptionalCollaborationDesktopApi();
      if (!collaborationApi) throw new Error("桌面连接不可用，未发起恢复。");
      const next = await collaborationApi.resumeEvolutionOneShot(runId);
      setState(next);
      const run = next.oneShotRun;
      const blocked = run?.status === "blocked";
      setResumeFeedback({ runId, error: blocked, message: blocked ? `已检查但仍未恢复：${run.blockingReason || "仍有阻塞，尚未满足恢复条件。"}` : run?.status === "completed" ? "本轮已完成。" : "已从原卡点继续，请查看后续流程。" });
    } catch (error) {
      setResumeFeedback({ runId, error: true, message: (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+':\s*/, "") });
    } finally {
      resumeLock.current = false;
      setResumingRunId(null);
    }
  };

  return { state, setState, decideProposal, resumeOneShot, resumingRunId, resumeFeedback };
}
