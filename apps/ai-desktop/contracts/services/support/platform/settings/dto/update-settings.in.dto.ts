import type { LocaleValue, ModelServiceTierValue, ReasoningEffortValue, SandboxModeValue } from "../../../../../foundation/index.js";

export interface UpdateDesktopSettingsInDto {
  locale?: LocaleValue;
  sandboxMode?: SandboxModeValue;
  defaultModel?: string | null;
  reasoningEffort?: ReasoningEffortValue | null;
  serviceTier?: ModelServiceTierValue;
  codexAppCorpusIngestionEnabled?: boolean;
}
