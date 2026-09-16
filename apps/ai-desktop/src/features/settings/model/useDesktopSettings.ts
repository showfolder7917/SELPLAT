import { useEffect, useState } from "react";

import type {
  CorpusSemanticBackfillStatusOutDto,
  CorpusIngestionStatusOutDto,
  CodexModelCatalogOutDto,
  DesktopSettingsOutDto,
  LocaleValue,
  ModelServiceTierValue,
  ReasoningEffortValue,
  SandboxModeValue,
} from "../../../../contracts/system/desktop/index";
import { getOptionalSystemDesktopApi } from "../../../foundation/desktop-api";
import { loadOfficialModelCatalog } from "../../../foundation/model-catalog";

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
  const [corpusIngestion, setCorpusIngestion] = useState<CorpusIngestionStatusOutDto | null>(null);
  // 卡片只在本次用户点击补齐后显示该任务回执；重新打开设置时回到持久的自动入库状态。
  const [corpusStatusFocus, setCorpusStatusFocus] = useState<"ingestion" | "semantic-backfill">("ingestion");
  const [modelCatalog, setModelCatalog] = useState<CodexModelCatalogOutDto>({ models: [] });
  const [modelCatalogLoaded, setModelCatalogLoaded] = useState(false);
  const [modelCatalogLoading, setModelCatalogLoading] = useState(false);
  const [modelSettingsError, setModelSettingsError] = useState("");

  useEffect(() => {
    const desktop = getOptionalSystemDesktopApi();
    if (!desktop) return;
    void desktop.getCorpusSemanticBackfillStatus().then(setCorpusSemanticBackfill);
    // 安装包更新中的旧隔离 preload 尚未提供这个纯状态查询时，保持“已停止”即可；不能因此阻断整个 Developer 页面。
    if (typeof desktop.getCorpusIngestionStatus === "function") {
      void desktop.getCorpusIngestionStatus().then(setCorpusIngestion);
    } else {
      setCorpusIngestion({ state: "stopped", message: "自动入库已停止。", lastSucceededAt: null, retryable: false });
    }
    void desktop.getSettings().then(applySettings);
  }, []);

  useEffect(() => {
    // 设置面板打开时持续读取持久任务状态，使停止、失败和重启恢复不依赖某个任务仍处于运行中。
    if (!settingsOpen) return;
    // 新打开的卡片没有待回显的补齐操作，必须先展示 Worker 记录的自动入库状态。
    setCorpusStatusFocus("ingestion");
    const timer = window.setInterval(() => {
      void getOptionalSystemDesktopApi()?.getCorpusSemanticBackfillStatus().then(setCorpusSemanticBackfill);
      const desktop = getOptionalSystemDesktopApi();
      if (typeof desktop?.getCorpusIngestionStatus === "function") {
        void desktop.getCorpusIngestionStatus().then(setCorpusIngestion);
      }
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    setModelCatalogLoading(true);
    setModelCatalogLoaded(false);
    setModelSettingsError("");
    void loadOfficialModelCatalog()
      .then((catalog) => {
        setModelCatalog(catalog);
        setModelCatalogLoaded(true);
      })
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
    void getOptionalSystemDesktopApi()?.updateSettings(patch)
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
    // 用户主动补齐时，补齐任务成为本次卡片操作的即时状态来源。
    setCorpusStatusFocus("semantic-backfill");
    const state = await getOptionalSystemDesktopApi()?.startCorpusSemanticBackfill();
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
    corpusIngestion,
    corpusStatusFocus,
    modelCatalog,
    modelCatalogLoaded,
    modelCatalogLoading,
    modelSettingsError,
    selectedModel,
    configuredModelUnavailable,
    supportedEfforts,
    fastServiceTierSupported,
    configuredSpeedUnavailable,
    updateSettings: (patch: Partial<DesktopSettingsOutDto>) => {
      // 入库开关直接驱动持久任务，用户再次操作开关后立即切回该任务的状态回显。
      if (Object.hasOwn(patch, "codexAppCorpusIngestionEnabled")) setCorpusStatusFocus("ingestion");
      updateSettings(patch);
    },
    selectDefaultModel,
    startCorpusSemanticBackfill,
  };
}
