/**
 * 南宫婉会话页面中的“后台动作”子模块。
 *
 * 本文件对应南宫婉消息区顶部的状态卡片，展示等待授权、调查阻塞、调查中或方案整理状态。
 * 它只服务 NangongConversationWorkspace，不是可以独立进入的页面。
 */

import type {
  // 授权请求类型（CodexApprovalOutDto）表示当前等待客户处理的授权信息。
  CodexApprovalOutDto,
  // 演化状态类型（EvolutionStateOutDto）表示后台调查和课题的权威状态。
  EvolutionStateOutDto,
} from "../../../../../contracts/system/desktop/index";

/** 南宫婉页面当前动作卡片所需的最小公开状态。 */
type NangongConversationActivityProps = {
  /** 当前演化状态（state）已经持久化，重启后仍能恢复研讨轮次和阻塞原因。 */
  state: EvolutionStateOutDto;
  /** 当前全局授权请求；只有 ownerMemberId 为南宫婉时才在本页解释。 */
  approval: CodexApprovalOutDto | null;
};

/**
 * 在南宫婉消息区顶部展示真实后台动作。
 * 授权请求优先于一般“处理中”状态，避免用户看到假运行却找不到阻塞入口。
 */
export function NangongConversationActivity(props: NangongConversationActivityProps) {
  // 当前演化状态（state）是后端已经保存的演化与调查状态。
  const state = props.state;
  // 当前授权请求（approval）是可能归属于南宫婉的客户授权信息。
  const approval = props.approval;
  // 南宫婉授权请求（nangongApproval）只保留明确归属于南宫婉的信息。
  const nangongApproval = approval?.ownerMemberId === "nangong-wan" ? approval : null;
  if (nangongApproval) {
    return (
      /* 等待授权卡片：说明被阻塞的原因、命令和恢复方式。 */
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
      /* 调查阻塞卡片：展示后端记录的真实阻塞原因。 */
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
    // 方案说明（detail）优先使用韩立给出的确认内容，没有时使用默认文案。
    const detail = round.confirmation?.offer || "正在整理已经核实的修复范围。";
    return (
      /* 方案整理卡片：说明调查已经进入形成修复方案阶段。 */
      <section className="nangong-conversation-activity active" role="status" aria-label="南宫婉正在整理方案">
        <strong>南宫婉正在整理修复方案</strong>
        <span>{detail}</span>
      </section>
    );
  }

  if (!round.answer) {
    return (
      /* 调查进行卡片：显示轮次、当前问题和后台动作。 */
      <section className="nangong-conversation-activity active" role="status" aria-label="南宫婉正在调查">
        <strong>南宫婉正在处理第 {round.roundNumber} 轮调查</strong>
        <span>{round.question}</span>
        <small>{run?.action || "调查结果返回后，韩立会继续判断。"}</small>
      </section>
    );
  }

  return (
    /* 回答完成卡片：说明当前轮次已返回并等待韩立继续判断。 */
    <section className="nangong-conversation-activity active" role="status" aria-label="南宫婉已完成当前回答">
      <strong>南宫婉已完成第 {round.roundNumber} 轮回答</strong>
      <span>正在等待韩立判断是否继续追问或形成专题。</span>
    </section>
  );
}
