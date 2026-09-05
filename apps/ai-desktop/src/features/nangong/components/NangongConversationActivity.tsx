import type { CodexApprovalOutDto, EvolutionStateOutDto } from "../../../../contracts/system/desktop/index";

/** 南宫婉页面当前动作卡片所需的最小公开状态。 */
type NangongConversationActivityProps = {
  /** Evolution 持久状态；重启后仍能恢复当前研讨轮次和阻塞原因。 */
  state: EvolutionStateOutDto;
  /** 当前全局授权请求；只有 ownerMemberId 为南宫婉时才在本页解释。 */
  approval: CodexApprovalOutDto | null;
};

/**
 * 在南宫婉消息区顶部展示真实后台动作。
 * 授权请求优先于一般“处理中”状态，避免用户看到假运行却找不到阻塞入口。
 */
export function NangongConversationActivity({ state, approval }: NangongConversationActivityProps) {
  const nangongApproval = approval?.ownerMemberId === "nangong-wan" ? approval : null;
  if (nangongApproval) {
    return (
      <section className="nangong-conversation-activity waiting" role="status" aria-label="南宫婉等待授权">
        <strong>南宫婉正在等待你的授权</strong>
        <span>{nangongApproval.reason || "需要你确认后才能继续当前调查。"}</span>
        {nangongApproval.command && <code>{nangongApproval.command}</code>}
        <small>授权窗口已经打开；允许或拒绝后，本轮会从当前节点继续。</small>
      </section>
    );
  }

  const run = state.oneShotRun;
  if (run?.status === "blocked") {
    return (
      <section className="nangong-conversation-activity blocked" role="alert" aria-label="南宫婉研讨已阻塞">
        <strong>南宫婉当前无法继续</strong>
        <span>{run.blockingReason || run.action}</span>
      </section>
    );
  }

  const deliberation = [...state.deliberations].reverse().find((item) => item.status === "questioning" || item.status === "ready-to-establish");
  if (!deliberation) return null;
  const round = deliberation.rounds.at(-1);
  if (!round) return null;

  if (deliberation.status === "ready-to-establish") {
    const detail = round.confirmation?.offer || "正在整理已经核实的修复范围。";
    return (
      <section className="nangong-conversation-activity active" role="status" aria-label="南宫婉正在整理方案">
        <strong>南宫婉正在整理修复方案</strong>
        <span>{detail}</span>
      </section>
    );
  }

  if (!round.answer) {
    return (
      <section className="nangong-conversation-activity active" role="status" aria-label="南宫婉正在调查">
        <strong>南宫婉正在处理第 {round.roundNumber} 轮调查</strong>
        <span>{round.question}</span>
        <small>{run?.action || "调查结果返回后，韩立会继续判断。"}</small>
      </section>
    );
  }

  return (
    <section className="nangong-conversation-activity active" role="status" aria-label="南宫婉已完成当前回答">
      <strong>南宫婉已完成第 {round.roundNumber} 轮回答</strong>
      <span>正在等待韩立判断是否继续追问或形成专题。</span>
    </section>
  );
}
