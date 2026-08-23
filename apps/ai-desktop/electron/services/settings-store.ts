import { readFileSync, writeFileSync } from "node:fs";

import {
  MODEL_SERVICE_TIERS,
  REASONING_EFFORTS,
  type DesktopSettings,
  type ModelServiceTier,
  type ReasoningEffort,
} from "../../shared/contracts/desktop.js";

const DEFAULT_SETTINGS: DesktopSettings = {
  locale: "ja",
  sandboxMode: "read-only",
  defaultModel: null,
  reasoningEffort: null,
  serviceTier: "default",
};

export class SettingsStore {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  read(): DesktopSettings {
    try {
      const value = JSON.parse(readFileSync(this.#filePath, "utf8")) as Partial<DesktopSettings>;
      return {
        locale: value.locale === "zh-CN" ? "zh-CN" : "ja",
        sandboxMode: value.sandboxMode === "workspace-write" ? "workspace-write" : "read-only",
        defaultModel: validModel(value.defaultModel),
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
    writeFileSync(this.#filePath, JSON.stringify(next, null, 2), "utf8");
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
