import { useEffect, useRef, useState } from "react";

import type { CurrentTopicReadRecoveryOutDto, DecideHanliProposalInDto, EvolutionStateEventOutDto, EvolutionStateOutDto } from "../../../../contracts/system/desktop/index";
import { getOptionalCollaborationDesktopApi } from "../../../foundation/desktop-api";
import { createEvolutionStateSynchronizer } from "./evolution-state-synchronizer";

/** 桌面桥接本身不可用时保留自动读取政策，禁止页面凭失败次数要求用户介入。 */
const automaticReadRecovery: CurrentTopicReadRecoveryOutDto = {
  policyId: "bridge-unavailable",
  waitingFor: "当前交付投影",
  requiresUserAction: false,
  nextAction: "系统将自动重新读取当前交付投影；读取成功后再显示当前结论。",
};

/**
 * 读取快照失败后，恢复政策仍以主进程投影为准。
 * 隔离窗口或旧 preload 尚未提供该方法时只能安全地自动重试，不能据此提升为人工操作。
 */
async function readRecoveryAfterFailure(
  desktop: ReturnType<typeof getOptionalCollaborationDesktopApi>,
): Promise<CurrentTopicReadRecoveryOutDto> {
  if (!desktop || typeof desktop.getEvolutionReadRecovery !== "function") return automaticReadRecovery;
  try {
    return await desktop.getEvolutionReadRecovery();
  } catch {
    return automaticReadRecovery;
  }
}

/** Evolution Feature 统一拥有跨人物共享状态、订阅和写动作，人物会话只消费该公开模型。 */
export function useEvolutionRuntime() {
  const [state, setState] = useState<EvolutionStateOutDto | null>(null);
  const [readStatus, setReadStatus] = useState<"syncing" | "ready" | "unavailable">("syncing");
  const [readError, setReadError] = useState("");
  const [readRecovery, setReadRecovery] = useState<CurrentTopicReadRecoveryOutDto>(automaticReadRecovery);
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
      if (active && next) {
        setState(next);
        setReadStatus("ready");
        setReadError("");
        setReadRecovery(next.currentTopicStage?.readRecovery || automaticReadRecovery);
      }
    }).catch(async (error) => {
      const recovery = await readRecoveryAfterFailure(desktop);
      if (active) {
        setReadStatus("unavailable");
        setReadError(error instanceof Error ? error.message : "无法读取当前交付信息。");
        setReadRecovery(recovery);
      }
    });
    const unsubscribe = desktop.onEvolutionState((event: EvolutionStateEventOutDto) => {
      if (active) {
        const next = synchronizer.acceptLive(event.state);
        setState(next);
        setReadStatus("ready");
        setReadError("");
        setReadRecovery(next.currentTopicStage?.readRecovery || automaticReadRecovery);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  /** 读取失败后只重取权威快照，不触发恢复或推进任何业务任务。 */
  const retryRead = async () => {
    const desktop = getOptionalCollaborationDesktopApi();
    if (!desktop) {
      setReadStatus("unavailable");
      setReadError("桌面连接不可用，无法重新读取当前交付信息。");
      setReadRecovery(automaticReadRecovery);
      return;
    }
    setReadStatus("syncing");
    try {
      const next = await desktop.getEvolutionState();
      setState(next);
      setReadStatus("ready");
      setReadError("");
      setReadRecovery(next.currentTopicStage?.readRecovery || automaticReadRecovery);
    } catch (error) {
      setReadStatus("unavailable");
      setReadError(error instanceof Error ? error.message : "无法读取当前交付信息。");
      setReadRecovery(await readRecoveryAfterFailure(desktop));
    }
  };

  const decideProposal = async (proposalId: string, request: DecideHanliProposalInDto) => {
    const next = await getOptionalCollaborationDesktopApi()?.decideEvolutionProposal(proposalId, request);
    if (next) setState(next);
    return next;
  };

  /** 状态锁属于共享运行模型，切换任务页签不会产生第二次恢复请求。 */
  const resumeOneShot = async (request: { topicId: string; proposalId: string; runId: string }) => {
    const { runId } = request;
    if (resumeLock.current) return;
    resumeLock.current = true;
    setResumingRunId(runId);
    setResumeFeedback(null);
    try {
      const collaborationApi = getOptionalCollaborationDesktopApi();
      if (!collaborationApi) throw new Error("桌面连接不可用，未发起恢复。");
      const next = await collaborationApi.resumeEvolutionOneShot(request);
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

  return { state, setState, readStatus, readError, readRecovery, retryRead, decideProposal, resumeOneShot, resumingRunId, resumeFeedback };
}
