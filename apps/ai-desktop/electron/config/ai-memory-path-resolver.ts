import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

const AI_MEMORY_CONFIG_RELATIVE_PATH = path.join("apps", "ai-desktop", "db", "ai-memory-paths.json");
const SUPPORTED_SCHEMA_VERSION = 1;

type AiMemoryPathConfiguration = {
  schemaVersion?: unknown;
  databaseRoot?: unknown;
  databaseFile?: unknown;
};

export type ResolvedAiMemoryPaths = {
  configPath: string;
  databaseRoot: string;
  databaseFile: string;
  databasePath: string;
};

/**
 * 从稳定 SELPLAT 工程根读取唯一 AI Memory 数据库位置。
 *
 * 真实传参示例：`/Users/showfolder/Documents/workSpace/SELF/SELPLAT`。
 * 真实返回示例：`databasePath=/Users/showfolder/Documents/workSpace/SELF/SELPLAT/apps/ai-desktop/db/events.sqlite3`。
 * 异常或副作用示例：配置缺失、损坏、相对根目录或文件名路径逃逸时抛错；不会创建目录、数据库或备用配置。
 */
export function resolveAiMemoryPaths(projectRoot: string): ResolvedAiMemoryPaths {
  const stableProjectRoot = requireExistingAbsoluteDirectory(projectRoot, "SELPLAT 工程根");
  const configPath = path.join(stableProjectRoot, AI_MEMORY_CONFIG_RELATIVE_PATH);
  if (!existsSync(configPath)) throw new Error(`AI Memory 路径配置不存在：${configPath}`);

  let configuration: AiMemoryPathConfiguration;
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("配置根必须是 JSON 对象");
    configuration = parsed as AiMemoryPathConfiguration;
  } catch (error) {
    throw new Error(`AI Memory 路径配置无法读取：${configPath}；${errorMessage(error)}`);
  }
  if (configuration.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(`AI Memory 路径配置版本不受支持：${String(configuration.schemaVersion)}`);
  }
  if (typeof configuration.databaseRoot !== "string" || !path.isAbsolute(configuration.databaseRoot)) {
    throw new Error("AI Memory databaseRoot 必须是已存在的绝对目录。");
  }
  const databaseRoot = requireExistingAbsoluteDirectory(configuration.databaseRoot, "AI Memory databaseRoot");
  const databaseFile = requireSafeDatabaseFile(configuration.databaseFile);
  const databasePath = path.resolve(databaseRoot, databaseFile);
  const relativeDatabasePath = path.relative(databaseRoot, databasePath);
  if (!relativeDatabasePath || relativeDatabasePath.startsWith("..") || path.isAbsolute(relativeDatabasePath)) {
    throw new Error("AI Memory 数据库文件必须位于已配置的 databaseRoot 内。");
  }
  return { configPath, databaseRoot, databaseFile, databasePath };
}

function requireExistingAbsoluteDirectory(value: string, label: string): string {
  if (!path.isAbsolute(value)) throw new Error(`${label}必须是绝对路径：${value}`);
  try {
    const resolved = realpathSync.native(value);
    if (!statSync(resolved).isDirectory()) throw new Error("目标不是目录");
    return resolved;
  } catch (error) {
    throw new Error(`${label}不存在或不可访问：${value}；${errorMessage(error)}`);
  }
}

function requireSafeDatabaseFile(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("AI Memory databaseFile 不能为空。");
  const databaseFile = value.trim();
  if (databaseFile !== path.basename(databaseFile) || !/^[A-Za-z0-9._-]+\.sqlite3$/.test(databaseFile)) {
    throw new Error(`AI Memory databaseFile 不是安全的 SQLite 文件名：${databaseFile}`);
  }
  return databaseFile;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
