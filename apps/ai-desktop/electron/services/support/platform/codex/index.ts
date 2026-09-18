// Codex 门面把 app-server、审批、流事件和线程生命周期转换为稳定应用能力。
export type { CodexDynamicToolsPort } from "./internal/dynamic-tools.port.js";
export {
  CodexService as CodexFacade,
  createCodexChildEnvironment,
  createSandboxPolicy,
  type CodexServiceOptions as CodexFacadeOptions,
} from "./codex.facade.js";
// 组合根通过工厂创建会话仓库；公开 API 不把具体 Store 或 SQLite Repository 类型交给业务模块。
import {
  CodexSessionStore,
  type CodexSessionPersistence,
} from "./internal/codex-session.repository.js";

// 文件仓库保存主会话恢复点；传入的是 AI Desktop 用户数据域内的绝对路径。
export function createFileCodexSessionRepository(filePath: string): CodexSessionPersistence {
  return new CodexSessionStore(filePath);
}

// 公开 Port 只描述 Codex 门面需要的读写行为，调用方不能判断底层存储技术。
export type { CodexSessionPersistence } from "./internal/codex-session.repository.js";
export type { StoredCodexSession, ReadableCodexSession } from "./internal/codex-session.repository.js";
