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
  LocaleValue,
} from "../../../../../contracts/system/desktop/index";
import { fixedUiText } from "../../../../../contracts/foundation";

/** 南宫婉页面当前动作卡片所需的最小公开状态。 */
type NangongConversationActivityProps = {
  /** 当前演化状态（state）已经持久化，重启后仍能恢复研讨轮次和阻塞原因。 */
  state: EvolutionStateOutDto;
  /** 当前全局授权请求；只有 ownerMemberId 为南宫婉时才在本页解释。 */
  approval: CodexApprovalOutDto | null;
  /** 当前页面语言只决定固定界面文本，不改写状态的原始内容。 */
  locale: LocaleValue;
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
  const locale = props.locale;
  // 南宫婉授权请求（nangongApproval）只保留明确归属于南宫婉的信息。
  const nangongApproval = approval?.ownerMemberId === "nangong-wan" ? approval : null;
  if (nangongApproval) {
    return (
      /* 等待授权卡片：说明被阻塞的原因、命令和恢复方式。 */
      <section className="nangong-conversation-activity waiting" role="status" aria-label={fixedUiText(locale, "nangongActivityAwaitingApproval")}>
        <strong>{fixedUiText(locale, "nangongActivityAwaitingApprovalTitle")}</strong>
        <span>{nangongApproval.reason || fixedUiText(locale, "collaborationAwaitingConfirmation")}</span>
        {nangongApproval.command && <code>{nangongApproval.command}</code>}
        <small>{fixedUiText(locale, "nangongActivityApprovalHint")}</small>
      </section>
    );
  }

  const run = state.oneShotRun;
  if (run?.status === "blocked") {
    return (
      /* 调查阻塞卡片：展示后端记录的真实阻塞原因。 */
      <section className="nangong-conversation-activity blocked" role="alert" aria-label={fixedUiText(locale, "nangongActivityBlocked")}>
        <strong>{fixedUiText(locale, "nangongActivityBlockedTitle")}</strong>
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
    const detail = round.confirmation?.offer || fixedUiText(locale, "nangongActivityDefaultScope");
    return (
      /* 方案整理卡片：说明调查已经进入形成修复方案阶段。 */
      <section className="nangong-conversation-activity active" role="status" aria-label={fixedUiText(locale, "nangongActivityPreparing")}>
        <strong>{fixedUiText(locale, "nangongActivityPreparingTitle")}</strong>
        <span>{detail}</span>
      </section>
    );
  }

  if (!round.answer) {
    return (
      /* 调查进行卡片：显示轮次、当前问题和后台动作。 */
      <section className="nangong-conversation-activity active" role="status" aria-label={fixedUiText(locale, "nangongActivityInvestigating")}>
        <strong>{fixedUiText(locale, "nangongActivityInvestigatingTitle").replace("{round}", String(round.roundNumber))}</strong>
        <span>{round.question}</span>
        <small>{run?.action || fixedUiText(locale, "nangongActivityDefaultFollowup")}</small>
      </section>
    );
  }

  return (
    /* 回答完成卡片：说明当前轮次已返回并等待韩立继续判断。 */
    <section className="nangong-conversation-activity active" role="status" aria-label={fixedUiText(locale, "nangongActivityAnswered")}>
      <strong>{fixedUiText(locale, "nangongActivityAnsweredTitle").replace("{round}", String(round.roundNumber))}</strong>
      <span>{fixedUiText(locale, "nangongActivityAnsweredHint")}</span>
    </section>
  );
}
