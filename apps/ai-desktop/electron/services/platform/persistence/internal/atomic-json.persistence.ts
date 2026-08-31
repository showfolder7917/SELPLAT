import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/** 人物 Store 只依赖这个 JSON 持久化端口，不接触文件路径或 Node 文件系统。 */
export interface AtomicJsonPersistencePort {
  /** 主文件是否真实存在，用于区分首次启动与文件损坏。 */
  primaryExists(): boolean;
  /** 读取主文件；不存在、损坏或不是 JSON 时返回 null。 */
  read(): unknown | null;
  /** 主文件损坏时读取最近备份；无有效备份返回 null。 */
  readBackup(): unknown | null;
  /** 同目录临时写、原子替换并刷新备份；失败时抛出真实文件异常。 */
  write(value: unknown): void;
}

/**
 * 创建受控 JSON 文件适配器。
 * 真实传参示例：应用路径解析器生成的 `/userData/collaboration/linghu-automation.json`。
 * 真实返回示例：人物 Store 可调用 read/write，但看不到文件系统函数。
 * 异常或副作用示例：写入会创建父目录、替换主文件并刷新 `.bak` 备份。
 */
export function createAtomicJsonPersistence(filePath: string): AtomicJsonPersistencePort {
  // 组合根必须传入绝对路径，避免人物模块用相对路径越过应用数据域。
  const resolvedPath = path.resolve(filePath);
  const readJson = (candidate: string): unknown | null => {
    try {
      return JSON.parse(readFileSync(candidate, "utf8")) as unknown;
    } catch {
      return null;
    }
  };
  return {
    primaryExists: () => existsSync(resolvedPath),
    read: () => readJson(resolvedPath),
    readBackup: () => readJson(`${resolvedPath}.bak`),
    write: (value) => {
      mkdirSync(path.dirname(resolvedPath), { recursive: true });
      const temporaryPath = `${resolvedPath}.tmp`;
      writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      renameSync(temporaryPath, resolvedPath);
      copyFileSync(resolvedPath, `${resolvedPath}.bak`);
    },
  };
}
