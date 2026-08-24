import { readFileSync, writeFileSync } from "node:fs";

import {
  MODEL_SERVICE_TIERS,
  REASONING_EFFORTS,
  type DesktopSettings,
  type ModelServiceTier,
  type ReasoningEffort,
} from "../../contracts/desktop.js";

export const DEFAULT_AI_DESKTOP_MODEL = "gpt-5.6-terra";
const SETTINGS_SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS: DesktopSettings = {
  locale: "ja",
  sandboxMode: "read-only",
  defaultModel: DEFAULT_AI_DESKTOP_MODEL,
  reasoningEffort: null,
  serviceTier: "default",
};

interface StoredDesktopSettings extends Partial<DesktopSettings> {
  settingsSchemaVersion?: number;
}

export class SettingsStore {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  read(): DesktopSettings {
    try {
      const value = JSON.parse(readFileSync(this.#filePath, "utf8")) as StoredDesktopSettings;
      // 旧版本没有模型迁移标记；仅把旧的空默认值升级为 Terra，之后仍允许用户主动选择 Codex 默认。
      const defaultModel = value.settingsSchemaVersion === SETTINGS_SCHEMA_VERSION
        ? validModel(value.defaultModel)
        : validModel(value.defaultModel) || DEFAULT_AI_DESKTOP_MODEL;
      return {
        locale: value.locale === "zh-CN" ? "zh-CN" : "ja",
        sandboxMode: value.sandboxMode === "workspace-write" ? "workspace-write" : "read-only",
        defaultModel,
        reasoningEffort: validReasoningEffort(value.reasoningEffort),
        serviceTier: validServiceTier(value.serviceTier) || "default",
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  update(patch: Partial<DesktopSettings>): DesktopSettings {
    const current = this.read();
    const next: DesktopSettings = {
      locale: patch.locale === "ja" || patch.locale === "zh-CN" ? patch.locale : current.locale,
      sandboxMode: patch.sandboxMode === "read-only" || patch.sandboxMode === "workspace-write"
        ? patch.sandboxMode
        : current.sandboxMode,
      defaultModel: patch.defaultModel === undefined ? current.defaultModel : validModel(patch.defaultModel),
      reasoningEffort: patch.reasoningEffort === undefined
        ? current.reasoningEffort
        : validReasoningEffort(patch.reasoningEffort),
      serviceTier: validServiceTier(patch.serviceTier) || current.serviceTier,
    };
    writeFileSync(this.#filePath, JSON.stringify({ settingsSchemaVersion: SETTINGS_SCHEMA_VERSION, ...next }, null, 2), "utf8");
    return next;
  }
}

/** 模型标识来自 app-server 当前配置，只持久化经过边界校验的非空值。 */
function validModel(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null;
}

/** 推理强度只接受公共契约声明的值，避免旧配置把非法字段传入 Harness。 */
function validReasoningEffort(value: unknown): ReasoningEffort | null {
  return typeof value === "string" && REASONING_EFFORTS.includes(value as ReasoningEffort)
    ? value as ReasoningEffort
    : null;
}

/** 速度选项保持为产品语义，发送时再映射到官方服务层级字段。 */
function validServiceTier(value: unknown): ModelServiceTier | null {
  return typeof value === "string" && MODEL_SERVICE_TIERS.includes(value as ModelServiceTier)
    ? value as ModelServiceTier
    : null;
}
