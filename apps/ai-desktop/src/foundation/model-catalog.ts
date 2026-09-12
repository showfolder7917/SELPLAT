import type { CodexModelCatalogOutDto } from "../../contracts/system/desktop/index";
import { getOptionalCodexDesktopApi } from "./desktop-api";

let currentCatalog: CodexModelCatalogOutDto | null = null;
let currentRequest: Promise<CodexModelCatalogOutDto> | null = null;
let catalogGeneration = 0;

/**
 * 读取当前官方模型目录，并让设置页与人物会话复用同一份成功结果。
 *
 * 失败不会进入缓存；首次失败会短暂等待后重试一次，处理应用刚启动时 Harness 尚未就绪的窗口。
 */
export async function loadOfficialModelCatalog(force = false): Promise<CodexModelCatalogOutDto> {
  if (force) {
    catalogGeneration += 1;
    currentCatalog = null;
    currentRequest = null;
  }
  if (currentCatalog) return currentCatalog;
  if (currentRequest) return currentRequest;
  const desktop = getOptionalCodexDesktopApi();
  if (!desktop) throw new Error("Codex 模型目录服务尚未连接。");
  const requestGeneration = catalogGeneration;
  const request = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const catalog = await desktop.getCodexModels();
        if (!catalog.models.length) throw new Error("Codex 模型目录为空。");
        if (catalogGeneration === requestGeneration) currentCatalog = catalog;
        return catalog;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => globalThis.setTimeout(resolve, 350));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("无法读取官方模型目录。");
  })().finally(() => {
    if (currentRequest === request) currentRequest = null;
  });
  currentRequest = request;
  return currentRequest;
}
