import type { CurrentTopicStageOutDto } from "../../../../../contracts/services/evolution/index";
import type { LocaleValue } from "../../../../../contracts/system/desktop/index";
import { SelUiDisclosure } from "../../../../theme/SelUiDisclosure";
import { formatTimelineDuration } from "./timeline-display";

const phaseLabels = { investigation: "调查", implementation: "实现", testing: "测试", release: "发布", restart: "重启", "hanli-acceptance": "韩立验收" } as const;

/** 卡片固定区域直接给出故障归属、六段耗时和最终结论，避免关键验收事实埋在滚动详情中。 */
export function TaskGroupAcceptanceSummary({ stage, locale }: { stage: CurrentTopicStageOutDto; locale: LocaleValue }) {
  const classification = stage.failureEvidence?.classification === "product-defect" ? "产品缺陷"
    : stage.failureEvidence?.classification === "acceptance-capability-blocked" ? "验收能力受阻"
      : stage.failureEvidence?.classification === "infrastructure-blocked" ? "基础设施问题" : "当前无失败分类";
  const phases = stage.durationEvidence?.phases || [];
  return <section className="task-acceptance-summary" aria-label={locale === "ja" ? "受入要約" : "验收摘要"}>
    <span><strong>故障分类</strong><b>{classification}</b><small>{stage.failureEvidence?.relatedFailures === "merged-single-repair-chain" ? "连带失败已归并为同一缺陷的一条修复链" : "未发现需要归并的连带失败"}</small></span>
    <span><strong>六段真实耗时</strong><small>{(["investigation", "implementation", "testing", "release", "restart", "hanli-acceptance"] as const).map((key) => {
      const phase = phases.find((item) => item.phase === key);
      return `${phaseLabels[key]} ${phase?.status === "recorded" && phase.durationMs !== null ? formatTimelineDuration(phase.durationMs, locale) : "待完成"}`;
    }).join(" · ")}</small></span>
    <span><strong>最终结论</strong><b>{stage.finalConclusion ? "韩立验收通过" : stage.latestAcceptance?.status === "failed" ? "韩立验收未通过，正在修复" : stage.latestAcceptance?.status === "blocked" ? "韩立验收受阻，等待恢复" : stage.latestAcceptance?.status === "running" ? "韩立验收进行中" : "尚未形成"}</b></span>
  </section>;
}

/** Host 重启和最终验收是两份独立的只读证据，不参与恢复按钮判定。 */
export function TaskGroupAcceptanceEvidence({ stage, host, locale }: {
  stage: CurrentTopicStageOutDto;
  host: CurrentTopicStageOutDto["hostStartupAcceptance"];
  locale: LocaleValue;
}) {
  const preflight = stage.deliveryEvidence.preflight;
  const delivery = stage.deliveryEvidence;
  const durationEvidence = stage.durationEvidence || null;
  const phaseLabel: Record<NonNullable<typeof durationEvidence>["phases"][number]["phase"], string> = phaseLabels;
  return <>
    <section className="task-node-detail task-preflight-evidence">
      <strong>{locale === "ja" ? "高速事前確認と再利用根拠" : "快速预检与复用依据"}</strong>
      <p>{preflight.status === "not-recorded" ? "未记录：历史任务不能推断为预检通过或已复用。"
        : preflight.status === "running" ? "预检进行中，尚未产生可复用结论。"
          : preflight.status === "issues-found" ? "预检发现问题，完整统一测试尚未启动。"
            : preflight.status === "reused" ? `可复用阶段：${preflight.reusableStages.join("、") || "未记录"}。`
              : "未满足复用条件，将重新执行。"}</p>
      <pre>{[
        `预检轮次：${preflight.round || "未记录"}`,
        `候选版本：${preflight.candidateSha || "未形成或未记录"}`,
        `影响范围：${preflight.impactScope.join("、") || "未记录"}`,
        `测试输入：${preflight.testInputs.join("、") || "未记录"}`,
        `证据有效：${preflight.evidenceValid === null ? "未记录" : preflight.evidenceValid ? "是" : "否"}`,
        `证据引用：${preflight.evidenceReferences.join("；") || "未记录"}`,
        `问题集合：${preflight.issues.map((issue) => `${issue.category}：${issue.summary}（影响 ${issue.affectedStage}）`).join("；") || "无"}`,
      ].join("\n")}</pre>
    </section>
    <section className="task-node-detail task-delivery-evidence">
      <strong>{locale === "ja" ? "現在の候補の提供根拠" : "当前候选交付依据"}</strong>
      <p>{delivery.acceptance === "running"
        ? "当前候选的交付结果已独立记录，正在等待韩立记录本轮真实验收结果。"
        : delivery.acceptance === "passed"
          ? "当前候选已记录真实验收通过结果。"
          : delivery.acceptance === "failed"
            ? "当前候选的真实验收未通过；请依据下列独立交付事实查看范围。"
            : delivery.acceptance === "blocked"
              ? "当前候选的真实验收受阻；下列交付事实不替代最终验收结论。"
              : "当前候选尚未形成真实验收结果；下列交付事实不替代最终验收结论。"}</p>
      <pre>{[
        `候选批次：${delivery.candidate?.generation ?? "未形成"}`,
        `候选版本：${delivery.candidate?.integrationSha || "未形成"}`,
        `统一测试：${delivery.unifiedTest}`,
        `发布：${delivery.release}`,
        `重启健康：${delivery.restartHealth}`,
        `真实验收：${delivery.acceptance}`,
      ].join("\n")}</pre>
    </section>
    <section className="task-node-detail task-duration-evidence">
      <strong>{locale === "ja" ? "実績フェーズ時間" : "实际阶段耗时"}</strong>
      <p>{durationEvidence?.bindingStatus === "available"
        ? "仅显示当前任务、结果提交、候选和执行尝试绑定的已完成时段。"
        : "阶段时段尚未完整绑定；缺失项不会以总处理时长或零时长补造。"}</p>
      <pre>{(durationEvidence?.phases || [
        "investigation", "implementation", "testing", "release", "restart", "hanli-acceptance",
      ].map((phase) => ({ phase, durationMs: null, status: "missing" as const }))).map((phase) =>
        `${phaseLabel[phase.phase as keyof typeof phaseLabel]}：${phase.status === "recorded" && phase.durationMs !== null
          ? formatTimelineDuration(phase.durationMs, locale) : "未记录或尚未完成"}`).join("\n")}</pre>
    </section>
    <section className="task-node-detail">
      <strong>{locale === "ja" ? "Host 起動受入" : "Host 启动验收"}</strong>
      <p>{host.status === "passed"
        ? "Host 启动验收通过：同一启动标识的进程状态与 8080 health 已核验。"
        : `尚未核验：${host.reason}`}</p>
      <SelUiDisclosure
        idPrefix="task-host-startup-evidence"
        className="task-host-startup-evidence"
        open={false}
        trigger={<span>{locale === "ja" ? "起動根拠を表示" : "展开查看本次启动依据"}</span>}
      >
        <pre>{[
          `启动标识：${host.launchId || "未记录"}`,
          `处理人：${host.handler || "未记录"}`,
          `启动时间：${host.startedAt || "未记录"}`,
          `启动进程：${host.commandStatus === "running" ? "运行中" : host.commandStatus === "exited" ? "已退出" : "未记录"}`,
          `退出结果：${host.exitCode ?? "运行中，尚无退出结果"}`,
          `8080 health：${host.healthStatus}`,
          `响应摘要：${host.healthSummary || "未记录"}`,
          `依据快照：${host.evidenceReadable ? "可读取" : "缺失或不可读取"}`,
          `证据引用：${host.evidenceReferences.join("；") || "未记录"}`,
          `启动脚本归档：${host.launcherSource || "未记录"}`,
          `health 响应归档：${host.healthResponse || "未记录"}`,
        ].join("\n")}</pre>
      </SelUiDisclosure>
    </section>
    <section className="task-node-detail">
      <strong>{locale === "ja" ? "最終受入根拠" : "最终验收依据"}</strong>
      {stage.finalConclusion ? <pre>{[
        `处理人：${stage.finalConclusion.handler}`,
        `发生时间：${stage.finalConclusion.occurredAt}`,
        `验收运行：${stage.finalConclusion.acceptanceRunId}`,
        `条件结果：${stage.finalConclusion.conditionResults.map((item) => `${item.checkId}=${item.status}`).join("；")}`,
        `证据引用：${stage.finalConclusion.evidenceReferences.join("；")}`,
      ].join("\n")}</pre> : <p>尚未核验：当前不能确认最终验收通过。</p>}
    </section>
  </>;
}
