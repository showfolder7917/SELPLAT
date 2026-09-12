import type { PersonaConversationActivity, useCollaborationWorkspace } from "../../../features/collaboration";
import type { useCodexWorkspace, usePersonaConversation } from "../../../features/conversation";

type Options = {
  collaboration: ReturnType<typeof useCollaborationWorkspace>;
  codex: ReturnType<typeof useCodexWorkspace>;
  hanli: ReturnType<typeof usePersonaConversation>;
  nangong: ReturnType<typeof usePersonaConversation>;
};

type PersonaActivities = Record<"han-li" | "nangong-wan", PersonaConversationActivity | null>;

/** 综合当前页面、回复、调查和审批状态，生成左侧人物圆点状态。 */
export function getDeveloperPersonaActivities({ collaboration, codex, hanli, nangong }: Options): PersonaActivities {
  // 只有协作模式中的人物页面，才会把当前人物标记为正在查看。
  const activePersonaId = collaboration.navigation.collaborationMode && collaboration.navigation.panel === "member"
    ? collaboration.navigation.selectedMember?.memberId
    : null;

  // 新问题已经发送但尚未受理时，旧排查状态不再代表当前问题。
  const pendingRequestId = hanli.pendingMessage?.messageId;
  const inquiry = pendingRequestId && pendingRequestId !== hanli.conversation.activity?.requestId
    ? undefined : hanli.conversation.activity;
  // 韩立状态按照等待授权、新建会话、回复和当前页面的优先级判断。
  let hanliActivity: PersonaConversationActivity | null = null;
  if (codex.interaction.approval?.ownerMemberId === "han-li") hanliActivity = "waiting-approval";
  else if (hanli.newConversationBusy) hanliActivity = "creating";
  else if (inquiry?.status === "retryable" || inquiry?.status === "interrupted") hanliActivity = "waiting-recovery";
  else if (inquiry?.status === "running") {
    const phase = inquiry.phase;
    if (phase === "queued" || phase === "investigating") hanliActivity = "waiting-investigation";
    else if (phase === "assessing") hanliActivity = "assessing";
    else hanliActivity = "explaining";
  }
  else if (hanli.sending) hanliActivity = "responding";
  else if (activePersonaId === "han-li") hanliActivity = "active";

  // 南宫婉额外支持“正在调查”，其余状态优先级与韩立一致。
  let nangongActivity: PersonaConversationActivity | null = null;
  if (codex.interaction.approval?.ownerMemberId === "nangong-wan") nangongActivity = "waiting-approval";
  else if (nangong.newConversationBusy) nangongActivity = "creating";
  else if (nangong.sending) nangongActivity = "responding";
  else if (hanli.delegatedResponderPersonaId === "nangong-wan") nangongActivity = "investigating";
  else if (activePersonaId === "nangong-wan") nangongActivity = "active";

  // 成员 ID 必须与协作状态中的真实人物 ID 保持一致。
  return { "han-li": hanliActivity, "nangong-wan": nangongActivity };
}
