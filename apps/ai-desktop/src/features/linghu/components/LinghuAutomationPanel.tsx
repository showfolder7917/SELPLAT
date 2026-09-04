import { useEffect, useState } from "react";
import type { LinghuAutomationStateOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";

/** 倒计时读取后台下一次检查时间，不由页面启动后台工作。 */
export function LinghuAutomationPanel({ state, locale, onState }: {
  state: LinghuAutomationStateOutDto;
  locale: LocaleValue;
  onState(state: LinghuAutomationStateOutDto): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!state.enabled || state.checking || !state.nextCheckAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [state.enabled, state.checking, state.nextCheckAt]);
  const seconds = state.nextCheckAt ? Math.max(0, Math.ceil((Date.parse(state.nextCheckAt) - now) / 1_000)) : 0;
  return <div>
    <button type="button" className="selswitch" role="switch" aria-label={locale === "ja" ? "自動巡回" : "自动巡检"} aria-checked={state.enabled} disabled={busy}
      onClick={() => {
        if (!window.desktop) { setError("请在桌面应用中操作"); return; }
        setBusy(true); setError("");
        void window.desktop.setLinghuAutomationEnabled(!state.enabled).then(onState)
          .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "无法修改自动巡检状态"))
          .finally(() => setBusy(false));
      }}><span>{locale === "ja" ? "自動巡回" : "自动巡检"}</span><i className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></i></button>
    {state.enabled && <span role="status">{state.checking ? "巡检中" : state.nextCheckAt ? `距离下次巡检还有 ${seconds} 秒` : "等待巡检开始"}</span>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
