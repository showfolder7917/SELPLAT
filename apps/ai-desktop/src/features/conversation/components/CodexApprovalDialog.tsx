import type { LocaleValue } from "../../../../contracts/system/desktop/index";
import type { useCodexWorkspace } from "../model/useCodexWorkspace";
import { SelUiDialog } from "../../../theme/SelUiProvider";

type CodexController = ReturnType<typeof useCodexWorkspace>;

/** Codex 人工审批始终由 Conversation Feature 展示，禁止 Application 自动选择或静默跳过。 */
export function CodexApprovalDialog({ controller, locale }: { controller: CodexController; locale: LocaleValue }) {
  const { approval, resolveApproval } = controller.interaction;
  const trustHint = locale === "ja" ? "同じプロジェクトとコマンドは次回から自動的に許可されます。" : "相同项目和命令下次将自动允许。";
  return <SelUiDialog id="ai-desktop-codex-approval" open={Boolean(approval)} title={approval?.title || "Codex Approval"} kicker="CODEX APPROVAL" dismissible={false} onRequestClose={() => undefined}>
    {approval && <>{approval.reason && <p className="seldialog-copy">{approval.reason}</p>}{approval.command && <pre className="seldialog-code">{approval.command}</pre>}{approval.cwd && <small>{approval.cwd}</small>}{approval.kind === "command" && approval.trustEligible && <p className="seldialog-copy">{trustHint}</p>}{approval.details && <details className="seldialog-detail"><summary>Details</summary><pre className="seldialog-code">{approval.details}</pre></details>}<div className="seldialog-actions"><button onClick={() => void resolveApproval("decline")}>{locale === "ja" ? "拒否" : "拒绝"}</button><button data-sel-action="primary" onClick={() => void resolveApproval("accept")}>{approval.kind === "command" && approval.trustEligible ? (locale === "ja" ? "許可して信頼" : "允许并信任") : (locale === "ja" ? "許可" : "允许")}</button></div></>}
  </SelUiDialog>;
}
