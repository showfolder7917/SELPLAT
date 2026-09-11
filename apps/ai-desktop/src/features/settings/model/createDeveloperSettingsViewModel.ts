import type { LocaleValue, ModelServiceTierValue, ReasoningEffortValue, SandboxModeValue } from "../../../../contracts/system/desktop/index";
import type { DeveloperSettingsFeatureProps } from "../components/DeveloperSettingsFeature.types";
import { auditStatusText, formatBytes, reasoningEffortLabel } from "./settings-formatters";
import type { DeveloperSettingsSectionController } from "./useDeveloperSettingsSectionController";

/** 测试数据清理文案必须明确保留范围和重启影响。 */
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

/** 把设置 Controller 数据转换成纯 View 可以直接展示的分区模型。 */
export function createDeveloperSettingsViewModel(
  props: DeveloperSettingsFeatureProps,
  controller: DeveloperSettingsSectionController,
) {
  const { settings, diagnostics, workspace, status, text } = props;
  const locale = settings.locale;
  const resetCopy = testDataResetCopy[locale];
  const workspaces = workspace.workspaces;
  const selectedModelName = settings.selectedModel?.displayName
    || (locale === "ja" ? "Codex の既定値" : "Codex 默认");
  const runtimeDescription = status.runtime
    ? `${status.runtime.source === "downloaded" ? "校验下载" : "安装包内置"} Codex ${status.runtime.version}`
    : status.connected ? "openai/codex app-server" : status.error || "Harness offline";
  const auditSummary = diagnostics.auditInfo?.latestTask
    ? `${auditStatusText(diagnostics.auditInfo.latestTask.status, locale)} · ${diagnostics.auditInfo.latestTask.reasons.length} ${locale === "ja" ? "件の理由" : "项原因"}`
    : text.noAuditTask;

  return {
    panel: { locale, open: props.open, onOpenChange: props.onOpenChange },
    account: {
      label: text.account,
      identity: status.account.email || status.account.planType || text.signedOut,
      runtimeDescription,
      authenticated: status.account.authenticated,
      signInLabel: text.signIn,
      signOutLabel: text.signOut,
      loginHint: props.loginHint,
      onLogin: props.onLogin,
      onLogout: props.onLogout,
    },
    testData: {
      title: resetCopy.title,
      summary: resetCopy.summary,
      detail: resetCopy.detail,
      actionLabel: diagnostics.testDataResetting ? resetCopy.busy : resetCopy.action,
      error: diagnostics.testDataResetError,
      busy: diagnostics.testDataResetting,
      onClear: () => { void controller.clearTestData(resetCopy.action, resetCopy.confirm); },
    },
    model: {
      title: locale === "ja" ? "グローバルモデル設定" : "全局模型配置",
      summary: locale === "ja" ? "すべての会話と協同タスクに適用" : "对所有会话与协同任务生效",
      selectedModelName,
      defaultModelLabel: locale === "ja" ? "既定モデル" : "默认模型",
      defaultModel: settings.defaultModel || "",
      modelCatalogLoading: settings.modelCatalogLoading,
      defaultOptionLabel: settings.modelCatalogLoading
        ? (locale === "ja" ? "モデルを読み込み中…" : "正在读取模型…")
        : (locale === "ja" ? "Codex の既定値" : "Codex 默认"),
      includesConfiguredModel: settings.modelCatalog.models.some((model) => model.id === settings.defaultModel),
      models: settings.modelCatalog.models,
      onDefaultModelChange: settings.selectDefaultModel,
          effortLabel: locale === "ja" ? "推論の強度" : "推理强度",
          effortDefaultLabel: locale === "ja" ? "モデルの既定値" : "模型默认",
      reasoningEffort: settings.reasoningEffort || "",
      supportedEfforts: settings.supportedEfforts.map((effort) => ({ value: effort, label: reasoningEffortLabel(effort, locale) })),
      onReasoningEffortChange: (value: string) => settings.updateSettings({ reasoningEffort: (value || null) as ReasoningEffortValue | null }),
      speedLabel: locale === "ja" ? "推論速度" : "推理速度",
      serviceTier: settings.serviceTier,
      standardSpeedLabel: locale === "ja" ? "標準" : "标准",
      fastSpeedLabel: locale === "ja" ? "高速" : "快速",
      fastServiceTierSupported: settings.fastServiceTierSupported,
      onServiceTierChange: (value: string) => settings.updateSettings({ serviceTier: value as ModelServiceTierValue }),
      modelUnavailableError: settings.configuredModelUnavailable
        ? (locale === "ja" ? "保存済みモデルは現在利用できません。別のモデルを選択してください。" : "已保存的模型当前不可用，请重新选择。")
        : "",
      speedUnavailableError: settings.configuredSpeedUnavailable
        ? (locale === "ja" ? "選択中のモデルは高速処理に対応していません。標準速度へ変更してください。" : "当前模型不支持快速处理，请切换为标准速度。")
        : "",
      description: settings.selectedModel?.description || "",
      settingsError: settings.modelSettingsError,
    },
    corpus: {
      title: locale === "ja" ? "Codex 会話の学習登録" : "Codex 聊天训练入库",
      stateLabel: settings.codexAppCorpusIngestionEnabled ? (locale === "ja" ? "有効" : "已开启") : (locale === "ja" ? "無効" : "未开启"),
      detail: locale === "ja"
        ? "現在の SELPLAT ワークスペースに属する完了済みの各ターンだけを登録し、システム指示・ツール出力・ファイル注入は除外します。"
        : "只将当前 SELPLAT 工作区中已经完成的每轮可见对话入库，排除系统指令、工具输出和文件注入内容。",
      statusMessage: settings.corpusSemanticBackfill?.message || "",
      statusProgress: settings.corpusSemanticBackfill?.state === "running"
        ? `${settings.corpusSemanticBackfill.processedCount}/${settings.corpusSemanticBackfill.targetCount}`
        : "",
      ingestionEnabled: settings.codexAppCorpusIngestionEnabled,
      toggleLabel: settings.codexAppCorpusIngestionEnabled ? (locale === "ja" ? "登録を停止" : "停止入库") : (locale === "ja" ? "登録を開始" : "开启入库"),
      backfillLabel: settings.corpusSemanticBackfill?.state === "running" ? (locale === "ja" ? "補完中…" : "正在补齐…") : (locale === "ja" ? "履歴を一括補完" : "补齐历史摘要"),
      backfillAriaLabel: locale === "ja" ? "履歴の AI 要約を一括補完" : "一键补齐历史 AI 摘要",
      backfillBusy: settings.corpusSemanticBackfill?.state === "running",
      onToggle: () => settings.updateSettings({ codexAppCorpusIngestionEnabled: !settings.codexAppCorpusIngestionEnabled }),
      onBackfill: () => { void settings.startCorpusSemanticBackfill(); },
    },
    preferences: {
      locale,
      sandboxMode: settings.sandboxMode,
      readOnlyLabel: text.readOnly,
      writeLabel: text.write,
      onLocaleChange: (value: string) => settings.updateSettings({ locale: value as LocaleValue }),
      onSandboxModeChange: (value: string) => settings.updateSettings({ sandboxMode: value as SandboxModeValue }),
    },
    workspaces: {
      title: text.workspaces,
      summary: locale === "ja" ? "Codex の作業ディレクトリと書き込み範囲を管理" : "管理 Codex 的工作目录与写入范围",
      addLabel: text.addWorkspace,
      onAdd: () => { void workspace.addWorkspace(); },
      items: (workspaces?.roots || []).map((root) => {
        const primary = root.id === workspaces?.primaryId;
        const readOnly = root.permission === "read-only";
        const onlyWorkspace = workspaces?.roots.length === 1;
        return {
          id: root.id,
          name: root.name,
          path: root.path,
          primary,
          readOnly,
          permissionLabel: readOnly ? text.readOnlyTip : text.writeTip,
          primaryLabel: primary ? text.primary : text.makePrimary,
          removeLabel: onlyWorkspace ? text.minimumWorkspace : text.remove,
          removeDisabled: onlyWorkspace,
          onTogglePermission: () => { void workspace.updateWorkspacePermission(root.id, readOnly ? "workspace-write" : "read-only"); },
          onMakePrimary: () => { void workspace.setPrimaryWorkspace(root.id); },
          onRemove: () => { void workspace.removeWorkspace(root.id, root.name); },
        };
      }),
      error: workspace.workspaceError,
    },
    diagnostics: {
      tempTitle: text.tempFiles,
      tempSummary: diagnostics.tempInfo ? `${diagnostics.tempInfo.fileCount} files · ${formatBytes(diagnostics.tempInfo.totalBytes)}` : "...",
      openTempLabel: text.openTemp,
      clearTempLabel: text.clearTemp,
      onOpenTemp: controller.openTempDirectory,
      onClearTemp: () => { void controller.clearTempFiles(); },
      trustedTitle: text.trustedCommands,
      trustedCount: diagnostics.trustedCommandInfo.count,
      trustedHint: text.trustHint,
      clearTrustedLabel: text.clearTrustedCommands,
      onClearTrusted: () => { void controller.clearTrustedCommands(); },
      auditTitle: text.auditLogs,
      auditSummary,
      auditReasons: diagnostics.auditInfo?.latestTask?.reasons || [],
      openAuditLabel: text.openAuditLogs,
      onOpenAudit: controller.openAuditLogDirectory,
    },
  };
}

/** 设置纯 View 使用该显示模型，不读取任何 Controller。 */
export type DeveloperSettingsViewModel = ReturnType<typeof createDeveloperSettingsViewModel>;
