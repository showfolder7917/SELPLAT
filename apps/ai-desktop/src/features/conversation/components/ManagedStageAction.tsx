import { ArrowClockwise24Regular, Beaker24Regular, CheckmarkCircle24Regular, Play24Regular } from "@fluentui/react-icons";

import { fixedUiText, type FixedUiTextKey } from "../../../../contracts/foundation/index";
import type { LocaleValue, ManagedExecutionModeValue } from "../../../../contracts/system/desktop/index";
import { nextManagedMode, type Message } from "../model/chat-message";

interface ManagedStageActionProps {
  message: Message;
  locale: LocaleValue;
  actionable: boolean;
  /** @deprecated 兼容旧渲染调用；自动策略不再允许用户手动返回某个托管模式。 */
  activeMode?: ManagedExecutionModeValue;
  /** @deprecated 兼容旧渲染调用；组件不会调用。 */
  onReturn?(mode: ManagedExecutionModeValue): void;
  onAdvance(mode: ManagedExecutionModeValue, label: string): void;
}
/** 自动策略只展示当前结论的确认动作；四个旧托管模式不再作为用户可切换的产品概念。 */
export function ManagedStageAction({ message, locale, actionable, onAdvance }: ManagedStageActionProps) {
  if (message.collaborationTaskId) return null;
  const current = message.managedMode;
  if (!current) return null;
  const firstLabelKeys: Record<ManagedExecutionModeValue, FixedUiTextKey> = {
    "conversation-managed": "managedStageConfirmIntent",
    "requirement-managed": "managedStageExecutePlan",
    "task-managed": "managedStageTest",
    "test-managed": "managedStageRetest",
  };
  const repeatLabelKeys: typeof firstLabelKeys = {
    "conversation-managed": "managedStageReanalyze",
    "requirement-managed": "managedStageRerun",
    "task-managed": "managedStageRetest",
    "test-managed": "managedStageRetest",
  };
  const target = current === "test-managed" ? null : nextManagedMode(current);
  const label = fixedUiText(locale, (message.actionTriggered ? repeatLabelKeys : firstLabelKeys)[current]);
  const Icon = message.actionTriggered ? ArrowClockwise24Regular : target === "requirement-managed" ? CheckmarkCircle24Regular : target === "task-managed" ? Play24Regular : Beaker24Regular;
  return <div className="managed-stage-action">
    {target && <button type="button" className={`stage-advance ${message.actionTriggered ? "triggered" : ""}`} disabled={!actionable || message.streaming} onClick={() => onAdvance(target, label)}><Icon /><span>{label}</span></button>}
  </div>;
}
