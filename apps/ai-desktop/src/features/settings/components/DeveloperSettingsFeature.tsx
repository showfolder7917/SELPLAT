import { Delete24Regular, FolderOpen24Regular } from "@fluentui/react-icons";

import type { CodexHarnessStatusOutDto, LocaleValue, ModelServiceTierValue, ReasoningEffortValue, SandboxModeValue } from "../../../../contracts/system/desktop/index";
import { useSelUi } from "../../../theme/SelUiProvider";
import { RuleManagementFeature } from "../../rules/components/RuleManagementFeature";
import { ChatGPTLoginAction } from "../../shell/components/DesktopChrome";
import { SettingsFloatingPanel } from "./SettingsFloatingPanel";
import { auditStatusText, formatBytes, reasoningEffortLabel } from "../model/settings-formatters";
import type { useDesktopSettings } from "../model/useDesktopSettings";
import type { useDesktopDiagnostics } from "../model/useDesktopDiagnostics";

type SettingsController = ReturnType<typeof useDesktopSettings>;
type DiagnosticsController = ReturnType<typeof useDesktopDiagnostics>;

type SettingsText = {
  account: string;
  signedOut: string;
  signOut: string;
  signIn: string;
  tempFiles: string;
  openTemp: string;
  clearTemp: string;
  clearConfirm: string;
  trustedCommands: string;
  trustHint: string;
  clearTrustedCommands: string;
  clearTrustedConfirm: string;
  auditLogs: string;
  openAuditLogs: string;
  noAuditTask: string;
  readOnly: string;
  write: string;
};

const testDataResetCopy = {
  ja: {
    title: "テストデータ",
    summary: "データベース内のテストトピック、タスク、承認、イベント、実行状態",
    detail: "人物の会話、学習メモリ、ログイン、設定、ワークスペース、ルール、ソースコードは保持されます。完了後にアプリを再起動します。",
    action: "テストデータを一括消去",
    busy: "消去中…",
    confirm: "AI Desktop 内部のテスト実行データを消去しますか？この操作は元に戻せません。人物の会話、学習メモリ、ログイン、設定、ワークスペース、信頼済みコマンド、ルール、ソースコード、監査ファイルは削除されません。",
  },
  "zh-CN": {
    title: "测试数据",
    summary: "数据库中的测试专题、任务、审批、事件和运行状态",
    detail: "保留人物对话、训练记忆、登录、设置、工作区、规则和源码；完成后自动重启应用。",
    action: "一键清空测试数据",
    busy: "正在清空…",
    confirm: "确定一键清空 AI Desktop 内部的测试运行数据吗？此操作不可撤销。不会删除人物对话、训练记忆、登录、设置、工作区、可信命令、规则、源码和工程审计文件。",
  },
} as const;

type DeveloperSettingsFeatureProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: CodexHarnessStatusOutDto;
  loginHint: string;
  text: SettingsText;
  settings: SettingsController;
  diagnostics: DiagnosticsController;
  onLogin: () => void;
  onLogout: () => void;
  onTempFilesCleared: () => void;
};

/** 设置浮层的完整视图边界；设置数据和桌面 API 副作用由 settings controller 统一拥有。 */
export function DeveloperSettingsFeature({ open, onOpenChange, status, loginHint, text, settings, diagnostics, onLogin, onLogout, onTempFilesCleared }: DeveloperSettingsFeatureProps) {
  const selUi = useSelUi();
  const {
    locale, sandboxMode, defaultModel, reasoningEffort, serviceTier, codexAppCorpusIngestionEnabled,
    corpusSemanticBackfill, modelCatalog, modelCatalogLoading, modelSettingsError, selectedModel, configuredModelUnavailable,
    supportedEfforts, fastServiceTierSupported, configuredSpeedUnavailable, updateSettings, selectDefaultModel,
    startCorpusSemanticBackfill,
  } = settings;
  const { tempInfo, auditInfo, trustedCommandInfo, testDataResetting, testDataResetError, clearTempFiles, clearTrustedCommands, clearTestData } = diagnostics;
  const resetCopy = testDataResetCopy[locale];

  const confirmAndClearTempFiles = async () => {
    if (!await selUi.confirm({ title: text.clearTemp, message: text.clearConfirm, tone: "danger" })) return;
    await clearTempFiles();
    onTempFilesCleared();
  };

  const confirmAndClearTrustedCommands = async () => {
    if (!await selUi.confirm({ title: text.clearTrustedCommands, message: text.clearTrustedConfirm, tone: "danger" })) return;
    await clearTrustedCommands();
  };

  const confirmAndClearTestData = async () => {
    if (!await selUi.confirm({ title: resetCopy.action, message: resetCopy.confirm, tone: "danger", confirmLabel: resetCopy.action })) return;
    await clearTestData();
  };

  return <SettingsFloatingPanel locale={locale} open={open} onOpenChange={onOpenChange}>
    <div className="dev-account"><span>{text.account}</span><strong>{status.account.email || status.account.planType || text.signedOut}</strong><small>{status.runtime ? `${status.runtime.source === "downloaded" ? "校验下载" : "安装包内置"} Codex ${status.runtime.version}` : status.connected ? "openai/codex app-server" : status.error || "Harness offline"}</small>{status.account.authenticated ? <button type="button" onClick={onLogout}><span>{text.signOut}</span></button> : <ChatGPTLoginAction label={text.signIn} onLogin={onLogin} />}{loginHint && <em>{loginHint}</em>}</div>
    {/* 测试数据清空是重启级危险操作，固定放在账号卡片后，避免被常规设置与长列表挤出首屏。 */}
    <div className="temp-card test-data-reset-card"><span>{resetCopy.title}</span><strong>{resetCopy.summary}</strong><small>{resetCopy.detail}</small>{testDataResetError && <em role="alert">{testDataResetError}</em>}<div><button className="danger" disabled={testDataResetting} onClick={() => void confirmAndClearTestData()}><Delete24Regular />{testDataResetting ? resetCopy.busy : resetCopy.action}</button></div></div>
    <section className="model-settings-card" aria-labelledby="global-model-settings-title">
      <header><div><span id="global-model-settings-title">{locale === "ja" ? "グローバルモデル設定" : "全局模型配置"}</span><small>{locale === "ja" ? "すべての会話と協同タスクに適用" : "对所有会话与协同任务生效"}</small></div><strong>{selectedModel?.displayName || (locale === "ja" ? "Codex の既定値" : "Codex 默认")}</strong></header>
      <label><span>{locale === "ja" ? "既定モデル" : "默认模型"}</span><select aria-label={locale === "ja" ? "既定モデル" : "默认模型"} value={defaultModel || ""} disabled={modelCatalogLoading} onChange={(event) => selectDefaultModel(event.target.value)}><option value="">{modelCatalogLoading ? (locale === "ja" ? "モデルを読み込み中…" : "正在读取模型…") : (locale === "ja" ? "Codex の既定値" : "Codex 默认")}</option>{defaultModel && !modelCatalog.models.some((model) => model.id === defaultModel) && <option value={defaultModel}>{defaultModel}</option>}{modelCatalog.models.map((model) => <option key={model.id} value={model.id}>{model.displayName}{model.provider ? ` · ${model.provider}` : ""}</option>)}</select></label>
      <label><span>{locale === "ja" ? "推論の強度" : "推理强度"}</span><select aria-label={locale === "ja" ? "推論の強度" : "推理强度"} value={reasoningEffort || ""} disabled={modelCatalogLoading || supportedEfforts.length === 0} onChange={(event) => updateSettings({ reasoningEffort: (event.target.value || null) as ReasoningEffortValue | null })}><option value="">{locale === "ja" ? "モデルの既定値" : "模型默认"}</option>{supportedEfforts.map((effort) => <option key={effort} value={effort}>{reasoningEffortLabel(effort, locale)}</option>)}</select></label>
      <label><span>{locale === "ja" ? "推論速度" : "推理速度"}</span><select aria-label={locale === "ja" ? "推論速度" : "推理速度"} value={serviceTier} onChange={(event) => updateSettings({ serviceTier: event.target.value as ModelServiceTierValue })}><option value="default">{locale === "ja" ? "標準" : "标准"}</option><option value="fast" disabled={!fastServiceTierSupported}>{locale === "ja" ? "高速" : "快速"}</option></select></label>
      {configuredModelUnavailable && <em role="alert">{locale === "ja" ? "保存済みモデルは現在利用できません。別のモデルを選択してください。" : "已保存的模型当前不可用，请重新选择。"}</em>}
      {configuredSpeedUnavailable && <em role="alert">{locale === "ja" ? "選択中のモデルは高速処理に対応していません。標準速度へ変更してください。" : "当前模型不支持快速处理，请切换为标准速度。"}</em>}
      {selectedModel?.description && <small>{selectedModel.description}</small>}
      {modelSettingsError && <em role="alert">{modelSettingsError}</em>}
    </section>
    <div className="temp-card corpus-ingestion-card"><span>{locale === "ja" ? "Codex 会話の学習登録" : "Codex 聊天训练入库"}</span><strong>{codexAppCorpusIngestionEnabled ? (locale === "ja" ? "有効" : "已开启") : (locale === "ja" ? "無効" : "未开启")}</strong><small>{locale === "ja" ? "現在の SELPLAT ワークスペースに属する完了済みの各ターンだけを登録し、システム指示・ツール出力・ファイル注入は除外します。" : "只将当前 SELPLAT 工作区中已经完成的每轮可见对话入库，排除系统指令、工具输出和文件注入内容。"}</small>{corpusSemanticBackfill?.message && <em role="status">{corpusSemanticBackfill.message}{corpusSemanticBackfill.state === "running" ? ` · ${corpusSemanticBackfill.processedCount}/${corpusSemanticBackfill.targetCount}` : ""}</em>}<div><button type="button" aria-pressed={codexAppCorpusIngestionEnabled} onClick={() => updateSettings({ codexAppCorpusIngestionEnabled: !codexAppCorpusIngestionEnabled })}>{codexAppCorpusIngestionEnabled ? (locale === "ja" ? "登録を停止" : "停止入库") : (locale === "ja" ? "登録を開始" : "开启入库")}</button><button type="button" aria-label={locale === "ja" ? "履歴の AI 要約を一括補完" : "一键补齐历史 AI 摘要"} disabled={corpusSemanticBackfill?.state === "running"} onClick={() => void startCorpusSemanticBackfill()}>{corpusSemanticBackfill?.state === "running" ? (locale === "ja" ? "補完中…" : "正在补齐…") : (locale === "ja" ? "履歴を一括補完" : "补齐历史摘要")}</button></div></div>
    <label>Language<select value={locale} onChange={(event) => updateSettings({ locale: event.target.value as LocaleValue })}><option value="zh-CN">简体中文</option><option value="ja">日本語</option></select></label>
    <label>Sandbox<select value={sandboxMode} onChange={(event) => updateSettings({ sandboxMode: event.target.value as SandboxModeValue })}><option value="read-only">{text.readOnly}</option><option value="workspace-write">{text.write}</option></select></label>
    <div className="temp-card"><span>{text.tempFiles}</span><strong>{tempInfo ? `${tempInfo.fileCount} files · ${formatBytes(tempInfo.totalBytes)}` : "..."}</strong><div><button onClick={() => void window.desktop?.openTempDirectory()}><FolderOpen24Regular />{text.openTemp}</button><button className="danger" onClick={() => void confirmAndClearTempFiles()}><Delete24Regular />{text.clearTemp}</button></div></div>
    <div className="temp-card trust-card"><span>{text.trustedCommands}</span><strong>{trustedCommandInfo.count}</strong><small>{text.trustHint}</small><div><button className="danger" disabled={trustedCommandInfo.count === 0} onClick={() => void confirmAndClearTrustedCommands()}><Delete24Regular />{text.clearTrustedCommands}</button></div></div>
    <div className="temp-card audit-card"><span>{text.auditLogs}</span><strong>{auditInfo?.latestTask ? `${auditStatusText(auditInfo.latestTask.status, locale)} · ${auditInfo.latestTask.reasons.length} ${locale === "ja" ? "件の理由" : "项原因"}` : text.noAuditTask}</strong>{auditInfo?.latestTask?.reasons.map((reason) => <em key={reason.code}>{reason.message}</em>)}<div><button onClick={() => void window.desktop?.openAuditLogDirectory()}><FolderOpen24Regular />{text.openAuditLogs}</button></div></div>
    <RuleManagementFeature locale={locale} />
  </SettingsFloatingPanel>;
}
