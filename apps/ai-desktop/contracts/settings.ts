import type { Locale, ModelServiceTier, ReasoningEffort, SandboxMode } from "./base.js";

export interface DesktopSettings {
  locale: Locale;
  sandboxMode: SandboxMode;
  defaultModel: string | null;
  reasoningEffort: ReasoningEffort | null;
  serviceTier: ModelServiceTier;
}
