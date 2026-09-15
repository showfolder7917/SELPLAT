import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** 已退役的内部消息标识不得重新进入生产 TypeScript 源码。 */
const RETIRED_MARKERS = [
  'startsWith("internal:")',
  'endsWith(":assessment")',
  ":assessment",
];

/**
 * 检查生产源码没有恢复已退役的会话消息标识。
 * 真实传参示例：传入 AI Desktop 根目录，检查 electron 与 src。
 * 真实返回示例：没有命中时返回空数组，命令以退出码 0 完成。
 * 异常或副作用示例：发现命中时抛出错误；只读取源码，不修改文件。
 */
export function findRetiredAssessmentMarkers(applicationRoot) {
  const matches = [];
  for (const sourceDirectory of ["electron", "src"]) {
    collectMatches(path.join(applicationRoot, sourceDirectory), matches);
  }
  return matches;
}

function collectMatches(directory, matches) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectMatches(entryPath, matches);
      continue;
    }
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
    const content = readFileSync(entryPath, "utf8");
    for (const marker of RETIRED_MARKERS) {
      if (content.includes(marker)) {
        matches.push(`${entryPath}:${marker}`);
        break;
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const matches = findRetiredAssessmentMarkers(process.cwd());
  if (matches.length) {
    throw new Error(`发现已退役的会话消息标识：\n${matches.join("\n")}`);
  }
  console.log("已确认 electron 与 src 不含已退役的会话消息标识。");
}
