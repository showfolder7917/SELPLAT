import type { CodexUserInputRequestOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";
import { fixedUiText } from "../../../../contracts/foundation";

interface CodexUserInputPanelProps {
  request: CodexUserInputRequestOutDto;
  answers: Record<string, string>;
  customAnswerIds: Set<string>;
  confirmedQuestionIds: Set<string>;
  locale: LocaleValue;
  submitting: boolean;
  onChoose(questionId: string, value: string): void;
  onChooseCustom(questionId: string): void;
  onCustomChange(questionId: string, value: string): void;
  onConfirm(questionId: string): void;
}
/** Codex 请求用户确认时的独立业务控件。 */
export function CodexUserInputPanel({ request, answers, customAnswerIds, confirmedQuestionIds, locale, submitting, onChoose, onChooseCustom, onCustomChange, onConfirm }: CodexUserInputPanelProps) {
  const otherLabel = fixedUiText(locale, "conversationOther");
  return <section className="codex-user-input" aria-label={fixedUiText(locale, "conversationConfirmationQuestions")}>
    {request.questions.map((question) => {
      const confirmed = confirmedQuestionIds.has(question.id);
      const hasAnswer = Boolean(answers[question.id]?.trim());
      return <fieldset key={question.id} className={confirmed ? "confirmed" : ""}>
        <legend><strong>{question.header}</strong><span>{question.question}</span></legend>
        {question.options.length > 0 && <div className="codex-user-input-options">{question.options.map((option) => <button type="button" role="radio" disabled={confirmed} aria-checked={!customAnswerIds.has(question.id) && answers[question.id] === option.label} className={!customAnswerIds.has(question.id) && answers[question.id] === option.label ? "selected" : ""} key={option.label} onClick={() => onChoose(question.id, option.label)}><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</button>)}<button type="button" role="radio" disabled={confirmed} aria-checked={customAnswerIds.has(question.id)} className={customAnswerIds.has(question.id) ? "selected" : ""} onClick={() => onChooseCustom(question.id)}><strong>{otherLabel}</strong></button></div>}
        {customAnswerIds.has(question.id) && <input value={answers[question.id] || ""} disabled={confirmed} maxLength={2_000} autoFocus={request.questions.length === 1} placeholder={fixedUiText(locale, "conversationInputPlaceholder")} onChange={(event) => onCustomChange(question.id, event.target.value)} />}
        <div className="codex-user-input-actions"><button type="button" className="primary" disabled={!hasAnswer || confirmed || submitting} onClick={() => onConfirm(question.id)}>{confirmed ? fixedUiText(locale, "conversationConfirmed") : submitting ? fixedUiText(locale, "conversationConfirming") : fixedUiText(locale, "conversationConfirm")}</button></div>
      </fieldset>;
    })}
  </section>;
}
