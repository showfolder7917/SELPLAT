import { readFileSync, writeFileSync } from "node:fs";

import {
  MODEL_SERVICE_TIERS,
  REASONING_EFFORTS,
  type ModelServiceTierValue,
  type ReasoningEffortValue,
} from "../../../../../../contracts/foundation/index.js";
import type { DesktopSettingsOutDto } from "../../../../../../contracts/services/support/platform/settings/index.js";

export const DEFAULT_AI_DESKTOP_MODEL = "gpt-5.6-terra";
const SETTINGS_SCHEMA_VERSION = 2;

const DEFAULT_SETTINGS: DesktopSettingsOutDto = {
  locale: "ja",
  sandboxMode: "read-only",
  defaultModel: DEFAULT_AI_DESKTOP_MODEL,
  reasoningEffort: null,
  serviceTier: "default",
  codexAppCorpusIngestionEnabled: false,
};

interface StoredDesktopSettings extends Partial<DesktopSettingsOutDto> {
  settingsSchemaVersion?: number;
}

export class SettingsStore {
  readonly #filePath: string;
  readonly #listeners = new Set<(settings: DesktopSettingsOutDto) => void>();

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  read(): DesktopSettingsOutDto {
    try {
      const value = JSON.parse(readFileSync(this.#filePath, "utf8")) as StoredDesktopSettings;
      // 旧版本没有模型迁移标记；仅把旧的空默认值升级为 Terra，之后仍允许用户主动选择 Codex 默认。
      const defaultModel = Number(value.settingsSchemaVersion || 0) >= 1
        ? validModel(value.defaultModel)
        : validModel(value.defaultModel) || DEFAULT_AI_DESKTOP_MODEL;
      return {
        locale: value.locale === "zh-CN" ? "zh-CN" : "ja",
        sandboxMode: value.sandboxMode === "workspace-write" ? "workspace-write" : "read-only",
        defaultModel,
        reasoningEffort: validReasoningEffort(value.reasoningEffort),
        serviceTier: validServiceTier(value.serviceTier) || "default",
        codexAppCorpusIngestionEnabled: value.codexAppCorpusIngestionEnabled === true,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  update(patch: Partial<DesktopSettingsOutDto>): DesktopSettingsOutDto {
    const current = this.read();
    const next: DesktopSettingsOutDto = {
      locale: patch.locale === "ja" || patch.locale === "zh-CN" ? patch.locale : current.locale,
      sandboxMode: patch.sandboxMode === "read-only" || patch.sandboxMode === "workspace-write"
        ? patch.sandboxMode
        : current.sandboxMode,
      defaultModel: patch.defaultModel === undefined ? current.defaultModel : validModel(patch.defaultModel),
      reasoningEffort: patch.reasoningEffort === undefined
        ? current.reasoningEffort
        : validReasoningEffort(patch.reasoningEffort),
      serviceTier: validServiceTier(patch.serviceTier) || current.serviceTier,
      codexAppCorpusIngestionEnabled: typeof patch.codexAppCorpusIngestionEnabled === "boolean"
        ? patch.codexAppCorpusIngestionEnabled
        : current.codexAppCorpusIngestionEnabled,
    };
    writeFileSync(this.#filePath, JSON.stringify({ settingsSchemaVersion: SETTINGS_SCHEMA_VERSION, ...next }, null, 2), "utf8");
    for (const listener of this.#listeners) listener(next);
    return next;
  }

  /** 设置保存后通知同一主进程中的运行能力。示例：开启 Codex 入库立即启动补录；监听异常会传播给设置 IPC 并保持旧文件可重读。 */
  subscribe(listener: (settings: DesktopSettingsOutDto) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}

/** 模型标识来自 app-server 当前配置，只持久化经过边界校验的非空值。 */
function validModel(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null;
}

/** 推理强度只接受公共契约声明的值，避免旧配置把非法字段传入 Harness。 */
function validReasoningEffort(value: unknown): ReasoningEffortValue | null {
  return typeof value === "string" && REASONING_EFFORTS.includes(value as ReasoningEffortValue)
    ? value as ReasoningEffortValue
    : null;
}

/** 速度选项保持为产品语义，发送时再映射到官方服务层级字段。 */
function validServiceTier(value: unknown): ModelServiceTierValue | null {
  return typeof value === "string" && MODEL_SERVICE_TIERS.includes(value as ModelServiceTierValue)
    ? value as ModelServiceTierValue
    : null;
}
