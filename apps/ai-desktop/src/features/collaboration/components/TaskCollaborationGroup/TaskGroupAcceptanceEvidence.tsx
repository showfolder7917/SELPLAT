import type { CurrentTopicStageOutDto } from "../../../../../contracts/services/evolution/index";
import type { LocaleValue } from "../../../../../contracts/system/desktop/index";
import { SelUiDisclosure } from "../../../../theme/SelUiDisclosure";

/** Host 重启和最终验收是两份独立的只读证据，不参与恢复按钮判定。 */
export function TaskGroupAcceptanceEvidence({ stage, host, locale }: {
  stage: CurrentTopicStageOutDto;
  host: CurrentTopicStageOutDto["hostStartupAcceptance"];
  locale: LocaleValue;
}) {
  return <>
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
