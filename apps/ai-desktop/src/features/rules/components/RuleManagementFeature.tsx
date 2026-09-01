/** 规则管理 Feature：展示安装包内置规则、客户覆盖结果和拒绝诊断，不提供规则写入入口。 */
import { useEffect, useState } from "react";

import type { LocaleValue, RuleBundleStatusOutDto, RuntimeRuleOutDto } from "../../../../contracts/system/desktop/desktop";
import { getDesktopApi } from "../../../foundation/desktop-api/desktop-api";

export function RuleManagementFeature({ locale }: { locale: LocaleValue }) {
  const [status, setStatus] = useState<RuleBundleStatusOutDto | null>(null);
  const [rules, setRules] = useState<RuntimeRuleOutDto[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    try {
      const desktop = getDesktopApi();
      void Promise.all([
        desktop.getRuleBundleStatus(),
        desktop.listEffectiveRules(),
      ]).then(([nextStatus, nextRules]) => {
        if (!active) return;
        setStatus(nextStatus);
        setRules(nextRules);
      }).catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    } catch (reason) {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    }
    return () => { active = false; };
  }, []);

  const isJapanese = locale === "ja";
  return <section className="temp-card rule-management-card" aria-labelledby="rule-management-title">
    <span id="rule-management-title">{isJapanese ? "有効な製品ルール" : "产品生效规则"}</span>
    <strong>{status ? `${status.state} · ${rules.length}` : "..."}</strong>
    {status && <small>
      {isJapanese
        ? `内蔵 ${status.builtinRuleCount}・顧客上書き ${status.overlayRuleCount}・拒否 ${status.rejectedOverlayCount}`
        : `内置 ${status.builtinRuleCount} · 客户覆盖 ${status.overlayRuleCount} · 拒绝 ${status.rejectedOverlayCount}`}
    </small>}
    {(error || status?.message) && <em role="alert">{error || status?.message}</em>}
    <details>
      <summary>{isJapanese ? "ルールと出所を表示" : "查看规则与来源"}</summary>
      <ul>{rules.map((rule) => <li key={rule.logicalId}><code>{rule.logicalId}</code><span>{rule.source === "customer-overlay" ? (isJapanese ? "顧客上書き" : "客户覆盖") : (isJapanese ? "内蔵" : "内置")}</span></li>)}</ul>
    </details>
  </section>;
}
