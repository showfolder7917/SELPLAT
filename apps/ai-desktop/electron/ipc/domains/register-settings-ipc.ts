import type { DesktopSettings } from "../../../contracts/desktop/settings.js";
import type { EventCenterFacade } from "../../services/event-center/event-center-facade.js";
import type { SettingsStore } from "../../services/settings-store.js";
import { registerEventCenterIpcHandler } from "../event-center-ipc.js";

/** 设置领域独立登记读写通道，并把每次全局执行策略变更写入业务审计。 */
export function registerSettingsIpc(settings: SettingsStore, eventCenter: EventCenterFacade): void {
  registerEventCenterIpcHandler(eventCenter, "desktop:get-settings", () => settings.read(), "business");
  registerEventCenterIpcHandler(eventCenter, "desktop:update-settings", (_event, patch: Partial<DesktopSettings>) => {
    const result = settings.update(patch);
    eventCenter.recordEvent("settings.updated", {
      locale: result.locale,
      sandboxMode: result.sandboxMode,
      defaultModel: result.defaultModel,
      reasoningEffort: result.reasoningEffort,
      serviceTier: result.serviceTier,
      codexAppCorpusIngestionEnabled: result.codexAppCorpusIngestionEnabled,
    });
    return result;
  }, "business");
}
