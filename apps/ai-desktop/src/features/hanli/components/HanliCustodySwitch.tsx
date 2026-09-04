import { useState } from "react";
import { useEvolutionRuntime } from "../../evolution/model/useEvolutionRuntime";

/** 托管开关只控制后续代确认；不停止执行任务，也不修改令狐巡检设置。 */
export function HanliCustodySwitch({ onError }: { onError(message: string): void }) {
  const { state, setState } = useEvolutionRuntime();
  const [busy, setBusy] = useState(false);
  const enabled = state?.automationSettings.automaticCustodyEnabled === true;
  return <button type="button" className="selswitch" role="switch" aria-label="自动托管" aria-checked={enabled} disabled={!state || busy} title="关闭：调查后请你确认；开启：在授权范围内依据事实代确认" onClick={async () => {
    if (!state || busy) return;
    setBusy(true);
    try {
      const next = await window.desktop?.configureEvolutionAutomation({ ...state.automationSettings, automaticCustodyEnabled: !enabled });
      if (!next) throw new Error("自动托管设置未保存");
      setState(next);
    } catch (error) { onError(error instanceof Error ? error.message : "自动托管设置失败"); }
    finally { setBusy(false); }
  }}><span>自动托管</span><i className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></i></button>;
}
