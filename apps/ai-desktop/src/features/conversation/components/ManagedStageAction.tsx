import { ArrowClockwise24Regular, ArrowReply24Regular, Beaker24Regular, CheckmarkCircle24Regular, Play24Regular } from "@fluentui/react-icons";

import type { LocaleValue, ManagedExecutionModeValue } from "../../../../contracts/system/desktop/index";
import { nextManagedMode, type Message } from "../model/chat-message";

interface ManagedStageActionProps {
  message: Message;
  locale: LocaleValue;
  actionable: boolean;
  activeMode: ManagedExecutionModeValue;
  onReturn(mode: ManagedExecutionModeValue): void;
  onAdvance(mode: ManagedExecutionModeValue, label: string): void;
}
/** 托管流程的返回与推进动作，由会话 feature 统一决定状态文案和目标阶段。 */
export function ManagedStageAction({ message, locale, actionable, activeMode, onReturn, onAdvance }: ManagedStageActionProps) {
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
  const returnLabels: Record<"conversation-managed" | "task-managed", { ja: string; "zh-CN": string }> = {
    "conversation-managed": { ja: "会話管理に戻る", "zh-CN": "回到会话托管" },
    "task-managed": { ja: "タスク管理に戻る", "zh-CN": "回到任务托管" },
  };
  const returnTargets: Array<"conversation-managed" | "task-managed"> = current === "requirement-managed" ? ["conversation-managed"] : current === "task-managed" || current === "test-managed" ? ["conversation-managed", "task-managed"] : [];
  const target = current === "test-managed" ? null : nextManagedMode(current);
  const label = (message.actionTriggered ? repeatLabels : firstLabels)[current][locale];
  const Icon = message.actionTriggered ? ArrowClockwise24Regular : target === "requirement-managed" ? CheckmarkCircle24Regular : target === "task-managed" ? Play24Regular : Beaker24Regular;
  return <div className="managed-stage-action">
    {returnTargets.map((returnTarget) => <button type="button" className="stage-return" aria-pressed={activeMode === returnTarget} disabled={!actionable || message.streaming || activeMode === returnTarget} key={returnTarget} onClick={() => onReturn(returnTarget)}><ArrowReply24Regular /><span>{returnLabels[returnTarget][locale]}</span></button>)}
    {target && <button type="button" className={`stage-advance ${message.actionTriggered ? "triggered" : ""}`} disabled={!actionable || message.streaming} onClick={() => onAdvance(target, label)}><Icon /><span>{label}</span></button>}
  </div>;
}
