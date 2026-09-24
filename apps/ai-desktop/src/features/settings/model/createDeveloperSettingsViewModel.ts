import type { LocaleValue, ModelServiceTierValue, ReasoningEffortValue, SandboxModeValue } from "../../../../contracts/system/desktop/index";
import type { DeveloperSettingsFeatureProps } from "../components/DeveloperSettingsFeature.types";
import { auditStatusText, formatBytes, reasoningEffortLabel } from "./settings-formatters";
import { fixedUiText } from "../../../../contracts/foundation/index";
import type { DeveloperSettingsSectionController } from "./useDeveloperSettingsSectionController";

/** 把设置 Controller 数据转换成纯 View 可以直接展示的分区模型。 */
export function createDeveloperSettingsViewModel(
  props: DeveloperSettingsFeatureProps,
  controller: DeveloperSettingsSectionController,
) {
  const { settings, diagnostics, status, text } = props;
  const locale = settings.locale;
  const copy = (key: Parameters<typeof fixedUiText>[1]) => fixedUiText(locale, key);
  const format = (key: Parameters<typeof fixedUiText>[1], values: Record<string, string | number>) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), copy(key));
  const resetCategoryLabels = { collaboration: copy("resetCategoryCollaboration"), evolution: copy("resetCategoryEvolution"), linghu: copy("resetCategoryLinghu"), workflow: copy("resetCategoryWorkflow") };
  const resetResult = diagnostics.testDataResetResult;
  const selectedModelName = settings.selectedModel?.displayName
    || copy("modelDefault");
  const runtimeDescription = status.runtime
    ? `${copy(status.runtime.source === "downloaded" ? "modelRuntimeDownloaded" : "modelRuntimeBundled")} Codex ${status.runtime.version}`
    : status.connected ? "openai/codex app-server" : status.error || "Harness offline";
  const astraAppeared = settings.modelCatalog.models.some((model) => `${model.id} ${model.displayName}`.toLocaleLowerCase().includes("astra"));
  const modelCatalogStatus = settings.modelCatalogLoading
    ? copy("modelCatalogLoading")
    : settings.modelCatalogLoaded
      ? format("modelCatalogLoaded", { count: settings.modelCatalog.models.length, astra: copy(astraAppeared ? "modelCatalogAstraPresent" : "modelCatalogAstraMissing") })
      : "";
  const auditSummary = diagnostics.auditInfo?.latestTask
    ? `${auditStatusText(diagnostics.auditInfo.latestTask.status, locale)} · ${format("auditReasonCount", { count: diagnostics.auditInfo.latestTask.reasons.length })}`
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
      title: copy("testDataTitle"), summary: copy("testDataSummary"), detail: copy("testDataDetail"),
      actionLabel: diagnostics.testDataResetting ? copy("testDataBusy") : copy("testDataAction"),
      error: diagnostics.testDataResetError,
      busy: diagnostics.testDataResetting || Boolean(resetResult),
      result: resetResult && {
        summary: format("testDataResult", { count: resetResult.clearedRecordCount }),
        categories: resetResult.clearedCategories.map((item) => ({ label: resetCategoryLabels[item.category], count: item.clearedRecordCount })),
        candidates: format("testDataCandidates", { branches: resetResult.clearedCandidateBranchCount, worktrees: resetResult.clearedCandidateWorktreeCount }),
        warnings: resetResult.candidateCleanupWarnings,
        retained: copy("testDataDetail"), restartLabel: copy("testDataRestart"),
        onRestart: () => { void controller.confirmTestDataResetRestart(copy("testDataRestart"), copy("testDataRestartConfirm")); },
      },
      onClear: () => { void controller.clearTestData(copy("testDataAction"), copy("testDataConfirm")); },
    },
    model: {
      title: copy("modelSettingsTitle"), summary: copy("modelSettingsSummary"),
      selectedModelName,
      // 标签供辅助技术定位模型选择器；占位项仍使用独立的 Codex 默认资源。
      defaultModelLabel: copy("modelDefaultLabel"),
      defaultModel: settings.defaultModel || "",
      modelCatalogLoading: settings.modelCatalogLoading,
      modelCatalogStatus,
      defaultOptionLabel: settings.modelCatalogLoading
        ? copy("modelLoading") : copy("modelDefault"),
      includesConfiguredModel: settings.modelCatalog.models.some((model) => model.id === settings.defaultModel),
      models: settings.modelCatalog.models,
      onDefaultModelChange: settings.selectDefaultModel,
          effortLabel: copy("modelEffort"), effortDefaultLabel: copy("modelEffortDefault"),
      reasoningEffort: settings.reasoningEffort || "",
      supportedEfforts: settings.supportedEfforts.map((effort) => ({ value: effort, label: reasoningEffortLabel(effort, locale) })),
      onReasoningEffortChange: (value: string) => settings.updateSettings({ reasoningEffort: (value || null) as ReasoningEffortValue | null }),
      speedLabel: copy("modelSpeed"),
      serviceTier: settings.serviceTier,
      standardSpeedLabel: copy("modelStandardSpeed"), fastSpeedLabel: copy("modelFastSpeed"),
      fastServiceTierSupported: settings.fastServiceTierSupported,
      onServiceTierChange: (value: string) => settings.updateSettings({ serviceTier: value as ModelServiceTierValue }),
      modelUnavailableError: settings.configuredModelUnavailable
        ? copy("modelUnavailable")
        : "",
      speedUnavailableError: settings.configuredSpeedUnavailable
        ? copy("modelSpeedUnavailable")
        : "",
      description: settings.selectedModel?.description || "",
      settingsError: settings.modelSettingsError,
    },
    corpus: {
      title: copy("corpusTitle"), stateLabel: copy(settings.codexAppCorpusIngestionEnabled ? "corpusEnabled" : "corpusDisabled"), detail: copy("corpusDetail"),
      // 默认显示 Worker 持久化的自动入库状态；只有当前按钮触发的补齐任务才能临时接管回显。
      statusMessage: settings.corpusStatusFocus === "semantic-backfill"
        ? settings.corpusSemanticBackfill?.message || settings.corpusIngestion?.message || ""
        : settings.corpusIngestion?.message || settings.corpusSemanticBackfill?.message || "",
      statusProgress: settings.corpusStatusFocus === "semantic-backfill" && settings.corpusSemanticBackfill?.state === "running"
        ? `${settings.corpusSemanticBackfill.processedCount}/${settings.corpusSemanticBackfill.targetCount}`
        : "",
      // 自动入库与历史补齐是独立任务；无论当前按钮回显什么，都持续展示 Worker 的已提交状态。
      ingestionStatusMessage: settings.corpusIngestion?.message
        ? `${copy("corpusIngestionPrefix")}：${settings.corpusIngestion.message}`
        : "",
      ingestionEnabled: settings.codexAppCorpusIngestionEnabled,
      toggleLabel: copy(settings.codexAppCorpusIngestionEnabled ? "corpusStop" : "corpusStart"), backfillLabel: copy(settings.corpusSemanticBackfill?.state === "running" ? "corpusBackfillBusy" : "corpusBackfill"), backfillAriaLabel: copy("corpusBackfillAria"),
      backfillBusy: settings.corpusSemanticBackfill?.state === "running",
      onToggle: () => settings.updateSettings({ codexAppCorpusIngestionEnabled: !settings.codexAppCorpusIngestionEnabled }),
      onBackfill: () => { void settings.startCorpusSemanticBackfill(); },
    },
    preferences: {
      locale,
      sandboxMode: settings.sandboxMode,
      languageLabel: fixedUiText(locale, "language"),
      saving: settings.localeSaving,
      savingLabel: fixedUiText(locale, "languageSaving"),
      saveError: settings.localeSaveError,
      retryLabel: fixedUiText(locale, "retry"),
      dismissLabel: fixedUiText(locale, "dismiss"),
      readRecovered: settings.settingsReadRecovered,
      readRecoveredLabel: fixedUiText(locale, "settingsReadRecovered"),
      readOnlyLabel: text.readOnly,
      writeLabel: text.write,
      onLocaleChange: (value: string) => settings.updateLocale(value as LocaleValue),
      onRetryLocale: settings.retryLocale,
      onDismissLocaleError: settings.dismissLocaleSaveError,
      onDismissReadRecovered: settings.dismissSettingsReadRecovered,
      onSandboxModeChange: (value: string) => settings.updateSettings({ sandboxMode: value as SandboxModeValue }),
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
