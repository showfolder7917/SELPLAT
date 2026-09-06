import { useEffect, useRef, useState } from "react";

import type { AutomaticTestPreflightResultOutDto, CodexApprovalOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";
import type { Message } from "../../conversation";

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

type AutomaticTestingOptions = {
  locale: LocaleValue;
  loading: boolean;
  approval: CodexApprovalOutDto | null;
  messages: Message[];
  discardQueued: () => Promise<void>;
  enqueueTest: (sourceMessageId?: number) => Promise<void>;
};

/** 自动测试预检、开关状态和意外审批熔断。 */
export function useAutomaticTesting({ locale, loading, approval, messages, discardQueued, enqueueTest }: AutomaticTestingOptions) {
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dialog, setDialog] = useState<AutomaticTestPreflightResultOutDto | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const reset = () => {
    enabledRef.current = false;
    setEnabled(false);
    setDialog(null);
  };

  useEffect(() => {
    if (!approval || !enabledRef.current) return;
    reset();
    void discardQueued();
    setDialog({
      status: "blocked",
      checkedAt: new Date().toISOString(),
      checks: [{
        id: "command",
        status: "failed",
        label: locale === "ja" ? "予期しない承認" : "出现额外授权",
        detail: locale === "ja" ? "未確認の承認要求を検出したため、自動テストを停止しました。" : "检测到预检之外的授权请求，自动测试已关闭，请人工确认。",
      }],
    });
  }, [approval, locale]);

  const toggle = async () => {
    if (enabledRef.current) {
      reset();
      void discardQueued();
      return;
    }
    if (checking || loading) return;
    setChecking(true);
    setDialog(null);
    try {
      const result = await window.desktop?.prepareAutomaticTesting();
      if (!result) throw new Error("Automatic test preflight is unavailable.");
      if (result.status !== "ready") {
        setDialog(result);
        return;
      }
      enabledRef.current = true;
      setEnabled(true);
      const latestCompletedTask = [...messages].reverse().find((message) =>
        message.role === "assistant"
        && message.managedMode === "task-managed"
        && message.streamTerminal
        && message.streamStatus !== "failed"
        && message.managedExecution?.stage === "completed"
        && message.managedExecution.status === "completed",
      );
      if (latestCompletedTask) void enqueueTest(latestCompletedTask.id);
    } catch (error) {
      setDialog({
        status: "blocked",
        checkedAt: new Date().toISOString(),
        checks: [{
          id: "runner",
          status: "failed",
          label: locale === "ja" ? "事前確認" : "环境预检",
          detail: readableDesktopError(error, locale === "ja" ? "自動テスト環境を確認できません。" : "无法检查自动测试环境。"),
        }],
      });
    } finally {
      setChecking(false);
    }
  };

  return { enabled, checking, dialog, setDialog, isEnabled: () => enabledRef.current, reset, toggle };
}
