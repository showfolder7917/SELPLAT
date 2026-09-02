import { ArrowClockwise24Regular, Beaker24Regular, CheckmarkCircle24Regular, Play24Regular } from "@fluentui/react-icons";

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
  const firstLabels: Record<ManagedExecutionModeValue, { ja: string; "zh-CN": string }> = {
    "conversation-managed": { ja: "この意図で合っています", "zh-CN": "就是这意思" },
    "requirement-managed": { ja: "この案で実行", "zh-CN": "按这个方案执行" },
    "task-managed": { ja: "テストする", "zh-CN": "测试一下" },
    "test-managed": { ja: "再テスト", "zh-CN": "重新测试" },
  };
  const repeatLabels: typeof firstLabels = {
    "conversation-managed": { ja: "要件を再分析", "zh-CN": "重新分析需求" },
    "requirement-managed": { ja: "再実行", "zh-CN": "重新执行" },
    "task-managed": { ja: "再テスト", "zh-CN": "重新测试" },
    "test-managed": { ja: "再テスト", "zh-CN": "重新测试" },
  };
  const target = current === "test-managed" ? null : nextManagedMode(current);
  const label = (message.actionTriggered ? repeatLabels : firstLabels)[current][locale];
  const Icon = message.actionTriggered ? ArrowClockwise24Regular : target === "requirement-managed" ? CheckmarkCircle24Regular : target === "task-managed" ? Play24Regular : Beaker24Regular;
  return <div className="managed-stage-action">
    {target && <button type="button" className={`stage-advance ${message.actionTriggered ? "triggered" : ""}`} disabled={!actionable || message.streaming} onClick={() => onAdvance(target, label)}><Icon /><span>{label}</span></button>}
  </div>;
}
