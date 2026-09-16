import { readFileSync } from "node:fs";
import path from "node:path";

export const ACCEPTANCE_PLAN_SOURCE_PATHS = {
  state: "electron/services/evolution/internal/evolution-state.store.ts",
  runtime: "electron/services/workflow/internal/evolution/persona-evolution.runtime.ts",
  projection: "electron/services/workflow/domain/current-topic-stage.projection.ts",
} as const;

export type AcceptancePlanCandidateSourceName = keyof typeof ACCEPTANCE_PLAN_SOURCE_PATHS;

export interface AcceptancePlanCandidateSourceRecord {
  source: AcceptancePlanCandidateSourceName;
  relativePath: string;
  content: string;
}

/**
 * 读取验收计划门禁所需的候选源码；
 * 真实传参示例：候选应用根 `/candidate/apps/ai-desktop`；
 * 返回示例：包含 state、runtime 和 projection 三份源码；
 * 异常示例：材料夹具未复制任一必需源码时抛出“最终候选材料不完整”。
 */
export function readAcceptancePlanCandidateSources(candidateDesktopRoot: string): Record<keyof typeof ACCEPTANCE_PLAN_SOURCE_PATHS, string> {
  return Object.fromEntries(readAcceptancePlanCandidateSourceRecords(candidateDesktopRoot)
    .map(({ source, content }) => [source, content]),
  ) as Record<keyof typeof ACCEPTANCE_PLAN_SOURCE_PATHS, string>;
}

/** 返回候选源码正文和相对路径，使发布归档可以记录实际读取材料的文件身份。 */
export function readAcceptancePlanCandidateSourceRecords(candidateDesktopRoot: string): AcceptancePlanCandidateSourceRecord[] {
  return (Object.entries(ACCEPTANCE_PLAN_SOURCE_PATHS) as Array<[AcceptancePlanCandidateSourceName, string]>)
    .map(([source, relativePath]) => ({ source, relativePath, content: readAcceptancePlanCandidateSource(candidateDesktopRoot, relativePath) }));
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
