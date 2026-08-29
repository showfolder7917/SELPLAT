import type { EvolutionOneShotRun } from "../../../../contracts/desktop/desktop";

/**
 * 作用：在南宫婉对话、专题群和工作台树复用同一条一次性运行实时状态。
 * 真实传参示例：actorName="韩立"、phase="approving"，显示“韩立正在审批”。
 * 真实返回示例：运行中展示人物和动作；完成或阻塞时展示对应终态与原因。
 * 异常或副作用示例：run 为空时不渲染；组件只读，不直接推进业务状态。
 */
export function EvolutionLiveActivity({ run, compact = false, onResume, resumeBusy = false }: { run: EvolutionOneShotRun | null | undefined; compact?: boolean; onResume?: () => void; resumeBusy?: boolean }) {
  if (!run) return null;
  return <section className={`evolution-live-activity${compact ? " compact" : ""}`} aria-label="本轮演化实时进度" aria-live="polite" data-status={run.status} data-phase={run.phase}>
    <div className="evolution-live-activity-indicator" aria-hidden="true"><i /></div>
    <div><span>{run.status === "running" ? phaseLabel(run.phase) : run.status === "completed" ? "本轮已完成" : "本轮已暂停"}</span><strong>{run.status === "running" ? `${run.actorName}正在${actionKind(run.phase)}` : run.actorName}</strong><p>{run.action}</p>{run.blockingReason && <small>卡点：{run.blockingReason}</small>}{run.status === "blocked" && onResume && <button type="button" className="selform-action" disabled={resumeBusy} onClick={onResume}>{resumeBusy ? "正在恢复…" : "从当前卡点继续"}</button>}</div>
  </section>;
}

function phaseLabel(phase: EvolutionOneShotRun["phase"]): string {
  return ({ "preparing-topic": "整理课题", "forming-proposal": "形成提案", approving: "方向审批", revising: "修订提案", distributing: "拆分分发", executing: "任务执行", testing: "统一测试", accepting: "真实验收", completed: "流程完成", blocked: "流程卡点" } as Record<EvolutionOneShotRun["phase"], string>)[phase];
}

function actionKind(phase: EvolutionOneShotRun["phase"]): string {
  return ({ "preparing-topic": "思考", "forming-proposal": "整理方案", approving: "审批", revising: "修订", distributing: "分发", executing: "执行", testing: "测试", accepting: "验收", completed: "归档", blocked: "等待处理" } as Record<EvolutionOneShotRun["phase"], string>)[phase];
}
