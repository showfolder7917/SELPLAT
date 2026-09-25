import type { LocaleValue } from "../../../../contracts/system/desktop/index";
import { fixedUiText } from "../../../../contracts/foundation";
import type { useCodexWorkspace } from "../model/useCodexWorkspace";
import { CodexUserInputPanel } from "./CodexUserInputPanel";
import { SelUiDialog } from "../../../theme/SelUiProvider";

type CodexController = ReturnType<typeof useCodexWorkspace>;

/** 全窗口共享一个待答入口，人物任务不依赖主会话的消息或当前页签。 */
export function CodexInteractionDialog({ controller, locale }: { controller: CodexController; locale: LocaleValue }) {
  const interaction = controller.interaction;
  const { approval, resolveApproval, userInputRequest, userInputAnswers, setUserInputAnswers,
    customAnswerIds, setCustomAnswerIds, confirmedQuestionIds, userInputSubmitting, userInputError } = interaction;
  /** 预设答案选择：保存选中文本，并退出该问题的自定义输入模式。 */
  function chooseUserInputAnswer(questionId: string, value: string) {
    setCustomAnswerIds((current) => {
      const next = new Set(current);
      next.delete(questionId);
      return next;
    });
    setUserInputAnswers((current) => ({ ...current, [questionId]: value }));
  }

  /** 自定义答案选择：清空旧预设值，等待客户输入真实答案。 */
  function chooseCustomUserInput(questionId: string) {
    setCustomAnswerIds((current) => new Set(current).add(questionId));
    setUserInputAnswers((current) => ({ ...current, [questionId]: "" }));
  }

  /** 自定义答案输入：按问题标识保存客户正在编辑的文本。 */
  function changeCustomUserInput(questionId: string, value: string) {
    setUserInputAnswers((current) => ({ ...current, [questionId]: value }));
  }

  /** 答案确认：由会话控制器判断是否已收齐全部问题并提交。 */
  function confirmUserInput(questionId: string) {
    void interaction.submitUserInput(questionId);
  }


  // 命令审批优先处理；它结束后显示仍待答的结构化问题，不修改任何答案或授权。
  if (!approval && !userInputRequest) return null;
  // 待答面板不锁住其他任务或输入区，客户仍能查看依据和补充说明。
  if (!approval) return <aside className="codex-user-input-dialog" role="dialog" aria-modal={false}
    aria-label={fixedUiText(locale, "conversationConfirmBeforeContinue")}>
    <h2>{fixedUiText(locale, "conversationConfirmBeforeContinue")}</h2>
    {userInputRequest && <CodexUserInputPanel request={userInputRequest}
      answers={userInputAnswers} customAnswerIds={customAnswerIds} confirmedQuestionIds={confirmedQuestionIds}
      locale={locale} submitting={userInputSubmitting} onChoose={chooseUserInputAnswer}
      onChooseCustom={chooseCustomUserInput} onCustomChange={changeCustomUserInput} onConfirm={confirmUserInput} />}
    {userInputError && <p role="alert">{userInputError}</p>}
  </aside>;
  const trustHint = fixedUiText(locale, "conversationTrustHint");
  return <SelUiDialog id="ai-desktop-codex-approval" open={Boolean(approval)} title={approval?.title || "Codex Approval"} kicker="CODEX APPROVAL" dismissible={false} onRequestClose={() => undefined}>
    {approval && <>{approval.reason && <p className="seldialog-copy">{approval.reason}</p>}{approval.command && <pre className="seldialog-code">{approval.command}</pre>}{approval.cwd && <small>{approval.cwd}</small>}{approval.kind === "command" && approval.trustEligible && <p className="seldialog-copy">{trustHint}</p>}{approval.details && <details className="seldialog-detail"><summary>Details</summary><pre className="seldialog-code">{approval.details}</pre></details>}<div className="seldialog-actions"><button onClick={() => void resolveApproval("decline")}>{fixedUiText(locale, "conversationDecline")}</button><button data-sel-action="primary" aria-label={fixedUiText(locale, "conversationAccept")} onClick={() => void resolveApproval("accept")}>{fixedUiText(locale, "conversationAccept")}</button>{approval.kind === "command" && approval.trustEligible && <button onClick={() => void resolveApproval("accept", true)}>{fixedUiText(locale, "conversationAcceptAndTrust")}</button>}</div></>}
  </SelUiDialog>;
}
