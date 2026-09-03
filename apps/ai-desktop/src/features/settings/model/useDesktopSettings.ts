import { useEffect, useState } from "react";

import type {
  CorpusSemanticBackfillStatusOutDto,
  CodexModelCatalogOutDto,
  DesktopSettingsOutDto,
  LocaleValue,
  ModelServiceTierValue,
  ReasoningEffortValue,
  SandboxModeValue,
} from "../../../../contracts/system/desktop/index";

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 拥有全局模型、语言、沙箱与语料设置，不混入诊断和清理状态。 */
export function useDesktopSettings(settingsOpen: boolean) {
  const [locale, setLocale] = useState<LocaleValue>("zh-CN");
  const [sandboxMode, setSandboxMode] = useState<SandboxModeValue>("workspace-write");
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortValue | null>(null);
  const [serviceTier, setServiceTier] = useState<ModelServiceTierValue>("default");
  const [codexAppCorpusIngestionEnabled, setCodexAppCorpusIngestionEnabled] = useState(false);
  const [corpusSemanticBackfill, setCorpusSemanticBackfill] = useState<CorpusSemanticBackfillStatusOutDto | null>(null);
  const [modelCatalog, setModelCatalog] = useState<CodexModelCatalogOutDto>({ models: [] });
  const [modelCatalogLoading, setModelCatalogLoading] = useState(false);
  const [modelSettingsError, setModelSettingsError] = useState("");

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    void desktop.getCorpusSemanticBackfillStatus().then(setCorpusSemanticBackfill);
    void desktop.getSettings().then(applySettings);
  }, []);

  useEffect(() => {
    if (corpusSemanticBackfill?.state !== "running") return;
    const timer = window.setInterval(() => {
      void window.desktop?.getCorpusSemanticBackfillStatus().then(setCorpusSemanticBackfill);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [corpusSemanticBackfill?.state]);

  useEffect(() => {
    if (!settingsOpen) return;
    const desktop = window.desktop;
    if (!desktop) return;
    setModelCatalogLoading(true);
    setModelSettingsError("");
    void desktop.getCodexModels()
      .then(setModelCatalog)
      .catch((error) => setModelSettingsError(readableDesktopError(error, locale === "ja" ? "モデル一覧を取得できません。" : "无法读取模型列表。")))
      .finally(() => setModelCatalogLoading(false));
  }, [locale, settingsOpen]);

  const applySettings = (settings: DesktopSettingsOutDto) => {
    setLocale(settings.locale);
    setSandboxMode(settings.sandboxMode);
    setDefaultModel(settings.defaultModel);
    setReasoningEffort(settings.reasoningEffort);
    setServiceTier(settings.serviceTier);
    setCodexAppCorpusIngestionEnabled(settings.codexAppCorpusIngestionEnabled);
  };

  /** 所有模型选择都写入同一主进程设置，渲染层不建立会话级覆盖。 */
  const updateSettings = (patch: Partial<DesktopSettingsOutDto>) => {
    setModelSettingsError("");
    void window.desktop?.updateSettings(patch)
      .then(applySettings)
      .catch((error) => setModelSettingsError(readableDesktopError(error, locale === "ja" ? "設定を保存できません。" : "无法保存全局设置。")));
  };

  const selectDefaultModel = (modelId: string) => {
    const model = modelCatalog.models.find((item) => item.id === modelId);
    const nextEffort = model && reasoningEffort && model.supportedReasoningEfforts.includes(reasoningEffort)
      ? reasoningEffort
      : model?.defaultReasoningEffort || model?.supportedReasoningEfforts[0] || null;
    const nextServiceTier = model?.supportedServiceTiers?.includes(serviceTier) ? serviceTier : "default";
    updateSettings({ defaultModel: modelId || null, reasoningEffort: nextEffort, serviceTier: nextServiceTier });
  };

  const startCorpusSemanticBackfill = async () => {
    const state = await window.desktop?.startCorpusSemanticBackfill();
    if (state) setCorpusSemanticBackfill(state);
  };

  const configuredModel = modelCatalog.models.find((model) => model.id === defaultModel) || null;
  const selectedModel = defaultModel ? configuredModel : modelCatalog.models.find((model) => model.isDefault) || null;
  const configuredModelUnavailable = Boolean(defaultModel && !modelCatalogLoading && modelCatalog.models.length > 0 && !configuredModel);
  const supportedEfforts = selectedModel?.supportedReasoningEfforts || [];
  const fastServiceTierSupported = selectedModel?.supportedServiceTiers?.includes("fast") === true;
  const configuredSpeedUnavailable = serviceTier === "fast" && !modelCatalogLoading && !fastServiceTierSupported;

  return {
    locale,
    sandboxMode,
    defaultModel,
    reasoningEffort,
    serviceTier,
    codexAppCorpusIngestionEnabled,
    corpusSemanticBackfill,
    modelCatalog,
    modelCatalogLoading,
    modelSettingsError,
    selectedModel,
    configuredModelUnavailable,
    supportedEfforts,
    fastServiceTierSupported,
    configuredSpeedUnavailable,
    updateSettings,
    selectDefaultModel,
    startCorpusSemanticBackfill,
  };
}
