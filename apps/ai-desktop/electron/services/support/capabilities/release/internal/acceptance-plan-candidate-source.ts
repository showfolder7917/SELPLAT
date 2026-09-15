import { readFileSync } from "node:fs";
import path from "node:path";

const ACCEPTANCE_PLAN_SOURCE_PATHS = {
  state: "electron/services/evolution/internal/evolution-state.store.ts",
  runtime: "electron/services/workflow/internal/evolution/persona-evolution.runtime.ts",
  projection: "electron/services/workflow/domain/current-topic-stage.projection.ts",
} as const;

/**
 * 读取验收计划门禁所需的候选源码；
 * 真实传参示例：候选应用根 `/candidate/apps/ai-desktop`；
 * 返回示例：包含 state、runtime 和 projection 三份源码；
 * 异常示例：材料夹具未复制任一必需源码时抛出“最终候选材料不完整”。
 */
export function readAcceptancePlanCandidateSources(candidateDesktopRoot: string): Record<keyof typeof ACCEPTANCE_PLAN_SOURCE_PATHS, string> {
  return Object.fromEntries(
    Object.entries(ACCEPTANCE_PLAN_SOURCE_PATHS).map(([name, relativePath]) => [
      name,
      readAcceptancePlanCandidateSource(candidateDesktopRoot, relativePath),
    ]),
  ) as Record<keyof typeof ACCEPTANCE_PLAN_SOURCE_PATHS, string>;
}

function readAcceptancePlanCandidateSource(candidateDesktopRoot: string, relativePath: string): string {
  try {
    return readFileSync(path.join(candidateDesktopRoot, relativePath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`最终候选材料不完整：缺少 ${relativePath}。`);
    }
    throw error;
  }
}
