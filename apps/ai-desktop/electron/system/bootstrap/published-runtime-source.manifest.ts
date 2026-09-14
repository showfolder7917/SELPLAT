import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MANIFEST_FILE = "ai-desktop-runtime-source.json";
const SOURCE_SHA = /^[0-9a-f]{40,64}$/;

interface PublishedRuntimeSourceManifest {
  readonly sourceSha: string;
}

/** 已发布批次目录与已签名 .app 并列保存来源提交，避免发布后改写应用签名边界。 */
export function writePublishedRuntimeSourceManifest(publishedBatchRoot: string, sourceSha: string): void {
  if (!SOURCE_SHA.test(sourceSha)) throw new Error("发布候选源码提交格式无效。");
  writeFileSync(path.join(publishedBatchRoot, MANIFEST_FILE), `${JSON.stringify({ sourceSha })}\n`, "utf8");
}

/** 只接受稳定发布批次在 .app 同级留下的来源清单。 */
export function readPublishedRuntimeSourceManifest(resourcesPath: string): string | null {
  const manifestPath = path.resolve(resourcesPath, "../../..", MANIFEST_FILE);
  if (!existsSync(manifestPath)) return null;
  let parsed: PublishedRuntimeSourceManifest;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as PublishedRuntimeSourceManifest;
  } catch {
    throw new Error("已发布运行包源码清单不是有效 JSON。");
  }
  if (!SOURCE_SHA.test(parsed.sourceSha || "")) throw new Error("已发布运行包源码清单缺少有效候选提交。");
  return parsed.sourceSha;
}

/** 受控发布重启必须加载与候选提交一致的稳定应用，禁止旧包冒充新候选完成健康验收。 */
export function resolvePublishedRuntimeSourceSha(resourcesPath: string, runtimeSourceShaArgument: string | null): string | null {
  if (!runtimeSourceShaArgument) return null;
  if (!SOURCE_SHA.test(runtimeSourceShaArgument)) throw new Error("发布重启的候选源码提交格式无效。");
  const packagedSourceSha = readPublishedRuntimeSourceManifest(resourcesPath);
  if (!packagedSourceSha) throw new Error("发布重启缺少运行包候选提交清单。");
  if (packagedSourceSha !== runtimeSourceShaArgument) {
    throw new Error(`运行包候选提交不一致：包内 ${packagedSourceSha}，启动参数 ${runtimeSourceShaArgument}。`);
  }
  return runtimeSourceShaArgument;
}
