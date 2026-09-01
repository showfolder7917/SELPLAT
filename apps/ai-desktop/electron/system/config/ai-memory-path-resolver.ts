import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

const AI_MEMORY_CONFIG_RELATIVE_PATH = path.join("apps", "ai-desktop", "db", "ai-memory-paths.json");
const SUPPORTED_SCHEMA_VERSION = 2;
const SUPPORTED_CONFIGURATION_KEYS = new Set(["schemaVersion", "databaseFile"]);

type AiMemoryPathConfiguration = {
  schemaVersion?: unknown;
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
 * 真实传参示例：Windows 为 `C:/opt/workspace/SELPLAT`，macOS 为当前机器实际识别的 SELPLAT 根。
 * 真实返回示例：Windows 返回 `databasePath=C:/opt/workspace/SELPLAT/apps/ai-desktop/db/events.sqlite3`。
 * 异常或副作用示例：配置缺失、损坏、包含机器路径或文件名路径逃逸时抛错；不会创建目录、数据库或备用配置。
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
  const unsupportedKeys = Object.keys(configuration).filter((key) => !SUPPORTED_CONFIGURATION_KEYS.has(key));
  if (unsupportedKeys.length) {
    throw new Error(`AI Memory 路径配置包含不支持字段：${unsupportedKeys.join(", ")}`);
  }
  // 数据库始终跟随本次已验证的工程根，禁止配置文件固化开发者用户名、盘符或其他机器路径。
  const databaseRoot = requireContainedDirectory(
    stableProjectRoot,
    path.dirname(configPath),
    "AI Memory databaseRoot",
  );
  const databaseFile = requireSafeDatabaseFile(configuration.databaseFile);
  const databasePath = path.resolve(databaseRoot, databaseFile);
  const relativeDatabasePath = path.relative(databaseRoot, databasePath);
  if (!relativeDatabasePath || relativeDatabasePath.startsWith("..") || path.isAbsolute(relativeDatabasePath)) {
    throw new Error("AI Memory 数据库文件必须位于已配置的 databaseRoot 内。");
  }
  return { configPath, databaseRoot, databaseFile, databasePath };
}

function requireContainedDirectory(parentRoot: string, candidate: string, label: string): string {
  const resolved = requireExistingAbsoluteDirectory(candidate, label);
  const relative = path.relative(parentRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label}必须位于当前 SELPLAT 工程根内：${resolved}`);
  }
  return resolved;
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
