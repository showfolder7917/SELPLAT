import { useEffect, useState } from "react";

/** 计时生命周期只有一个实现，使用它的组件只更新自己的短文本。 */
export function useTimelineNow(running: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [running]);
  return nowMs;
}
