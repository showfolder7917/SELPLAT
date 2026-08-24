import { ipcMain } from "electron";

import type { DesktopSettings } from "../../../contracts/settings.js";
import type { BusinessAuditLog } from "../../services/business-audit-log.js";
import type { SettingsStore } from "../../services/settings-store.js";

/** 设置领域独立登记读写通道，并把每次全局执行策略变更写入业务审计。 */
export function registerSettingsIpc(settings: SettingsStore, audit: BusinessAuditLog): void {
  ipcMain.handle("desktop:get-settings", () => settings.read());
  ipcMain.handle("desktop:update-settings", (_event, patch: Partial<DesktopSettings>) => {
    const result = settings.update(patch);
    audit.recordEvent("settings.updated", {
      locale: result.locale,
      sandboxMode: result.sandboxMode,
      defaultModel: result.defaultModel,
      reasoningEffort: result.reasoningEffort,
      serviceTier: result.serviceTier,
    });
    return result;
  });
}
