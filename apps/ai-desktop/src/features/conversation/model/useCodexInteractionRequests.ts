import { useEffect, useState } from "react";

import type { CodexAccountOutDto, CodexApprovalOutDto, CodexHarnessStatusOutDto, CodexUserInputRequestOutDto } from "../../../../contracts/system/desktop/index";

const EMPTY_ACCOUNT: CodexAccountOutDto = { authenticated: false, authMode: null, email: null, planType: null, requiresOpenaiAuth: true };
const EMPTY_STATUS: CodexHarnessStatusOutDto = { connected: false, account: EMPTY_ACCOUNT, error: null, runtime: null };

type InteractionRequestOptions = {
  browserOpenedMessage: string;
  onError: (message: string) => void;
  onLogout: () => void;
  onTrustedCommandChanged: () => void;
};

/** Codex 账号状态、审批请求和结构化追问的唯一 Renderer 状态所有者。 */
export function useCodexInteractionRequests({ browserOpenedMessage, onError, onLogout, onTrustedCommandChanged }: InteractionRequestOptions) {
  const [status, setStatus] = useState<CodexHarnessStatusOutDto>(EMPTY_STATUS);
  const [approval, setApproval] = useState<CodexApprovalOutDto | null>(null);
  const [userInputRequest, setUserInputRequest] = useState<CodexUserInputRequestOutDto | null>(null);
  const [userInputAnswers, setUserInputAnswers] = useState<Record<string, string>>({});
  const [customAnswerIds, setCustomAnswerIds] = useState<Set<string>>(new Set());
  const [confirmedQuestionIds, setConfirmedQuestionIds] = useState<Set<string>>(new Set());
  const [userInputSubmitting, setUserInputSubmitting] = useState(false);
  const [loginHint, setLoginHint] = useState("");

  useEffect(() => {
    const refreshStatus = () => window.desktop?.getCodexStatus().then(setStatus);
    const refreshApprovals = () => window.desktop?.getCodexApprovals().then((items) => setApproval(items[0] || null));
    const refreshUserInputs = () => window.desktop?.getCodexUserInputs().then((items) => setUserInputRequest(items[0] || null));
    void refreshStatus();
    void refreshApprovals();
    void refreshUserInputs();
    const statusTimer = window.setInterval(refreshStatus, 2_500);
    const approvalTimer = window.setInterval(refreshApprovals, 700);
    const userInputTimer = window.setInterval(refreshUserInputs, 350);
    return () => { window.clearInterval(statusTimer); window.clearInterval(approvalTimer); window.clearInterval(userInputTimer); };
  }, []);

  useEffect(() => {
    if (!userInputRequest) {
      setUserInputAnswers({});
      setCustomAnswerIds(new Set());
      setConfirmedQuestionIds(new Set());
      setUserInputSubmitting(false);
      return;
    }
    setUserInputAnswers({});
    setCustomAnswerIds(new Set(userInputRequest.questions.filter((question) => question.options.length === 0).map((question) => question.id)));
    setConfirmedQuestionIds(new Set());
    setUserInputSubmitting(false);
  }, [userInputRequest?.requestId]);

  const login = async () => {
    setLoginHint("");
    try {
      await window.desktop?.loginWithChatGPT();
      setLoginHint(browserOpenedMessage);
    } catch (error) {
      setLoginHint(error instanceof Error ? error.message : "ChatGPT login unavailable");
    }
  };

  const logout = async () => {
    const next = await window.desktop?.logoutCodex();
    if (next) setStatus(next);
    onLogout();
  };

  const resolveApproval = async (decision: "accept" | "decline") => {
    if (!approval) return;
    const result = await window.desktop?.resolveCodexApproval(approval.requestId, decision);
    if (result?.status === "resolved" && decision === "accept" && approval.kind === "command" && approval.trustEligible) onTrustedCommandChanged();
    setApproval(null);
  };

  const submitUserInput = async (questionId: string) => {
    if (!userInputRequest || userInputSubmitting) return;
    if (!userInputAnswers[questionId]?.trim()) return;
    const nextConfirmed = new Set(confirmedQuestionIds).add(questionId);
    setConfirmedQuestionIds(nextConfirmed);
    if (nextConfirmed.size < userInputRequest.questions.length) return;
    const answers: Record<string, string[]> = Object.fromEntries(userInputRequest.questions.map((question) => [question.id, [userInputAnswers[question.id]?.trim() || ""]]));
    if (Object.values(answers).some((values) => !values[0])) return;
    setUserInputSubmitting(true);
    try {
      await window.desktop?.resolveCodexUserInput({ requestId: userInputRequest.requestId, answers });
      setUserInputRequest(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to submit clarification answers.");
      setConfirmedQuestionIds((current) => {
        const next = new Set(current);
        next.delete(questionId);
        return next;
      });
      setUserInputSubmitting(false);
    }
  };

  return {
    status, approval, userInputRequest, setUserInputRequest, userInputAnswers, setUserInputAnswers, customAnswerIds,
    setCustomAnswerIds, confirmedQuestionIds, userInputSubmitting, loginHint, setLoginHint, login, logout, resolveApproval, submitUserInput,
  };
}
