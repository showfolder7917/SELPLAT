import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type { EvolutionAcceptancePlanOutDto } from "../../../../../contracts/services/evolution/index.js";
import type { HanliAcceptanceRunOutDto } from "../../../../../contracts/services/personas/hanli/index.js";
import type { WorkspaceStateOutDto } from "../../../../../contracts/services/support/platform/workspace/index.js";
import type { CollaborationTaskOutDto } from "../../../../../contracts/services/workflow/index.js";

/** 韩立只接收客户要求、交付摘要、工程门禁状态和变更文件，不接收详细测试流水。 */
export function buildHanliResultReviewContext(
  tasks: CollaborationTaskOutDto[],
  fallbackWorkspaceState: WorkspaceStateOutDto,
  proposalSourceTasks: CollaborationTaskOutDto[] = tasks,
): unknown[] {
  // 同一提案只读取一次已授权源码；大文件的中段也必须可见，否则旧恢复分支会被首尾截取漏掉。
  const sourceEvidence = readChangedSourceEvidence(proposalSourceTasks, fallbackWorkspaceState);
  return tasks.map((task) => {
    return {
      taskId: task.taskId,
      requirement: {
        title: task.snapshot.title,
        problemStatement: task.snapshot.problemStatement,
        confirmedIntent: task.snapshot.confirmedIntent,
        constraints: task.snapshot.constraints,
        acceptanceCriteria: task.snapshot.acceptanceCriteria,
      },
      resultSummary: task.resultSummary,
      finalResult: task.finalResult,
      engineeringGate: task.unifiedTest?.status || null,
      changedFiles: [...new Set(task.executionRecords.flatMap((record) => record.changedFiles))],
      // 只提供同一提案已集成任务声明过的源码及其受限直接依赖；后续修复不能抹掉原交付源码证据。
      sourceEvidence: sourceEvidence.items,
      sourceEvidenceStatus: sourceEvidence.status,
      sourceEvidenceScope: "integrated-proposal-task-files-and-direct-imports",
    };
  });
}

function readChangedSourceEvidence(
  tasks: CollaborationTaskOutDto[],
  fallbackWorkspaceState: WorkspaceStateOutDto,
): { items: Array<{ file: string; content: string }>; status: "available" | "no-declared-changed-files" | "workspace-root-unavailable" | "declared-files-unreadable" } {
  // 本次专题的授权工作区是唯一读取根；任务快照不得把证据读取扩展到其他工作区。
  const root = fallbackWorkspaceState.roots.find((item) => item.id === fallbackWorkspaceState.primaryId)?.path;
  if (!root) return { items: [], status: "workspace-root-unavailable" };
  const files = [...new Set(tasks.filter((task) => task.state === "integrated")
    .flatMap((task) => task.executionRecords.flatMap((record) => record.changedFiles)))]
    .filter((file): file is string => typeof file === "string" && /\.(?:[cm]?[jt]sx?|css)$/u.test(file)
      && !/(?:^|\/)(?:tests?|__tests__)\//u.test(file));
  if (!files.length) return { items: [], status: "no-declared-changed-files" };
  let canonicalRoot: string;
  try { canonicalRoot = realpathSync(root); } catch { return { items: [], status: "workspace-root-unavailable" }; }
  const declaredItems = files.slice(0, 30).flatMap((file) => {
    if (path.isAbsolute(file)) return [];
    const resolved = path.resolve(canonicalRoot, file);
    if (!resolved.startsWith(`${canonicalRoot}${path.sep}`)) return [];
    try {
      const canonicalFile = realpathSync(resolved);
      if (!canonicalFile.startsWith(`${canonicalRoot}${path.sep}`)) return [];
      const content = readFileSync(canonicalFile, "utf8");
      // 保留 48 KiB 内的整文件，避免从首尾剪裁掉与原条件对应的中间实现。
      // 更大的文件仍明确标注省略，不能把片段当作完整源码验收。
      return [{ file, content: content.length <= 48_000
        ? content : `${content.slice(0, 20_000)}\n[源码中段省略，当前片段不足以证明整文件行为]\n${content.slice(-20_000)}` }];
    } catch (error) {
      // 已声明的旧文件缺失也是当前源码事实，不能静默略去并让审查者误以为仍有该实现。
      const missing = typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
      return missing ? [{ file, content: "[当前授权工作区不存在该源码文件；不能沿用旧实现作为本版本证据]" }] : [];
    }
  });
  // 源文件抽成同目录小模块后，静态直连实现也必须随声明文件一起给韩立，
  // 否则审查者只看到调用点，会把真正的恢复判定误判为缺失。只读同一授权工作区的
  // 一层相对 import；不跟随任意路径、测试目录、包依赖或递归导入。
  const importedFiles = declaredItems.flatMap(({ file, content }) => {
    if (content.startsWith("[当前授权工作区不存在")) return [];
    const imports = [...content.matchAll(/\bimport\s+(?:type\s+)?[^;]*?\sfrom\s+["'](\.[^"']+)["']/gu)]
      .map((match) => match[1]);
    return imports.flatMap((specifier) => {
      if (specifier.includes("?")) return [];
      const base = path.resolve(canonicalRoot, path.dirname(file), specifier.endsWith(".js") ? specifier.slice(0, -3) : specifier);
      const candidates = specifier.endsWith(".js") ? [`${base}.ts`, `${base}.tsx`]
        : path.extname(specifier) ? [] : [`${base}.ts`, `${base}.tsx`];
      if (!base.startsWith(`${canonicalRoot}${path.sep}`)
        || /(?:^|\/)(?:tests?|__tests__|node_modules)\//u.test(path.relative(canonicalRoot, base))) return [];
      try {
        const canonicalFile = candidates.map((candidate) => {
          try { return realpathSync(candidate); } catch { return null; }
        }).find((candidate): candidate is string => candidate !== null);
        if (!canonicalFile) return [];
        if (!canonicalFile.startsWith(`${canonicalRoot}${path.sep}`)) return [];
        const dependency = path.relative(canonicalRoot, canonicalFile).split(path.sep).join("/");
        const source = readFileSync(canonicalFile, "utf8");
        return [{ file: dependency, content: source.length <= 48_000
          ? source : `${source.slice(0, 20_000)}\n[源码中段省略，当前片段不足以证明整文件行为]\n${source.slice(-20_000)}` }];
      } catch { return []; }
    });
  });
  const items = [...new Map([...declaredItems, ...importedFiles].map((item) => [item.file, item])).values()].slice(0, 30);
  return { items, status: items.length ? "available" : "declared-files-unreadable" };
}

/** 合并正式页面结果与独立源码审查，保证每条客户条件只有一个最终结论。 */
export function composeHanliResultReview(
  plan: EvolutionAcceptancePlanOutDto,
  sourceRun: HanliAcceptanceRunOutDto,
  pageRun: HanliAcceptanceRunOutDto,
): HanliAcceptanceRunOutDto {
  const pageCriterionIds = plan.conditions.filter((item) => item.evidenceType === "page-experience").map((item) => item.conditionId);
  const expectedIds = new Set(pageCriterionIds);
  if (pageRun.stepResults.length !== pageCriterionIds.length || pageRun.stepResults.some((step) => !expectedIds.has(step.checkId))) {
    throw new Error("正式页面检查结果没有与已登记的原始条件逐项对应。");
  }
  const stepResults = [...sourceRun.stepResults, ...pageRun.stepResults]
    .sort((left, right) => Number(left.checkId.slice("criterion-".length)) - Number(right.checkId.slice("criterion-".length)))
    .map((step, operationIndex) => ({ ...step, operationIndex }));
  const failed = sourceRun.sourceReview?.status === "failed"
    || stepResults.some((step) => step.status === "failed" || step.layoutStatus === "failed");
  const blocked = sourceRun.sourceReview?.status === "blocked"
    || stepResults.some((step) => step.status === "blocked" || step.layoutStatus === "blocked");
  return {
    ...pageRun,
    mode: "mixed",
    planId: plan.planId,
    acceptanceRoundId: plan.currentRoundId,
    criteria: plan.conditions.map((item) => item.criterion),
    pageCriterionIds,
    sourceReview: sourceRun.sourceReview,
    status: failed ? "failed" : blocked ? "blocked" : "passed",
    stepResults,
  };
}
