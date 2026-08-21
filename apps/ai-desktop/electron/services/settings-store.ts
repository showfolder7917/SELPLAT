import { readFileSync, writeFileSync } from "node:fs";

import type { DesktopSettings } from "../../shared/contracts/desktop.js";

const DEFAULT_SETTINGS: DesktopSettings = { locale: "ja", sandboxMode: "read-only" };

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
    };
    writeFileSync(this.#filePath, JSON.stringify(next, null, 2), "utf8");
    return next;
  }
}
