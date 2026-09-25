import { execFileSync } from "node:child_process";
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
): unknown {
  // 同一提案只读取一次已授权源码；大文件的中段也必须可见，否则旧恢复分支会被首尾截取漏掉。
  const sourceEvidence = readChangedSourceEvidence(proposalSourceTasks, fallbackWorkspaceState);
  return {
    tasks: tasks.map((task) => ({
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
    })),
    // 同一批源码只传一次；任务越多也不会重复挤掉判定模块的上下文。
    sourceEvidence: sourceEvidence.items,
    sourceEvidenceBatches: sourceEvidence.batches,
    sourceEvidenceStatus: sourceEvidence.status,
    sourceEvidenceScope: "integrated-proposal-task-files-tests-layout-and-two-level-relative-imports",
  };
}

function readChangedSourceEvidence(
  tasks: CollaborationTaskOutDto[],
  fallbackWorkspaceState: WorkspaceStateOutDto,
): { items: Array<{ file: string; content: string }>; batches: Array<{ batch: number; files: string[] }>; status: "available" | "no-declared-changed-files" | "workspace-root-unavailable" | "declared-files-unreadable" } {
  // 本次专题的授权工作区是唯一读取根；任务快照不得把证据读取扩展到其他工作区。
  const root = fallbackWorkspaceState.roots.find((item) => item.id === fallbackWorkspaceState.primaryId)?.path;
  if (!root) return { items: [], batches: [], status: "workspace-root-unavailable" };
  const files = [...new Set(tasks.filter((task) => task.state === "integrated")
    .flatMap((task) => [
      ...task.executionRecords.flatMap((record) => record.changedFiles),
      // 已集成的旧记录可能只保存最后一次流式 diff；签发基线至结果提交可恢复完整清单。
      ...readIntegratedCommitFiles(root, task),
    ]))]
    .filter((file): file is string => typeof file === "string" && /\.(?:[cm]?[jt]sx?|css)$/u.test(file));
  if (!files.length) return { items: [], batches: [], status: "no-declared-changed-files" };
  let canonicalRoot: string;
  try { canonicalRoot = realpathSync(root); } catch { return { items: [], batches: [], status: "workspace-root-unavailable" }; }
  // Renderer 变更的窄窗口验收还需要实际布局样式；该样式不是每次任务的变更文件。
  const layoutFile = "apps/ai-desktop/src/applications/styles/desktop-applications.css";
  if (files.some((file) => file.startsWith("apps/ai-desktop/src/"))) {
    try {
      const layoutPath = realpathSync(path.resolve(canonicalRoot, layoutFile));
      if (layoutPath.startsWith(`${canonicalRoot}${path.sep}`) && !files.includes(layoutFile)) files.push(layoutFile);
    } catch { /* 当前工作区没有该样式时，不伪造布局证据。 */ }
  }
  const evidencePriority = (file: string) => {
    if (/^apps\/ai-desktop\/tests\/interaction\/.+\.scenario\.[cm]?[jt]sx?$/u.test(file)) return 0;
    if (file === layoutFile) return 1;
    // 三语专题的资源、持久化和会话调用方必须在固定名额内；否则韩立只能看到页面，
    // 却看不到中文回退、缺键诊断或重启恢复的实现及对应测试。
    if (/^apps\/ai-desktop\/contracts\/foundation\/(?:i18n\/fixed-ui-text|value\/base\.value|index)\.ts$/u.test(file)
      || /^(?:apps\/ai-desktop\/electron\/services\/support\/platform\/settings\/internal\/settings\.store\.ts|apps\/ai-desktop\/electron\/system\/ipc\/domains\/register-settings-ipc\.ts)$/u.test(file)
      || /^apps\/ai-desktop\/tests\/(?:services\/support\/platform\/settings\/settings-store|applications\/developer\/model-settings-contract)\.test\.mjs$/u.test(file)) return 2;
    if (/^apps\/ai-desktop\/src\/features\/(?:conversation|settings)\//u.test(file)) return 3;
    if (file.startsWith("apps/ai-desktop/src/")) return 4;
    if (file.startsWith("apps/ai-desktop/tests/interaction/")) return 5;
    return 6;
  };
  files.sort((left, right) => evidencePriority(left) - evidencePriority(right));
  // 样式文件常把响应式规则放在中段；在可控大小内提供整文件，避免把省略的布局规则误判为无法验收。
  const evidenceLimit = (file: string) => file.endsWith(".css") ? 120_000 : 48_000;
  // 固定证据边界内优先保留场景、布局和生产源码，历史清单只能占用剩余名额。
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
      return [{ file, content: content.length <= evidenceLimit(file)
        ? content : `${content.slice(0, 20_000)}\n[源码中段省略，当前片段不足以证明整文件行为]\n${content.slice(-20_000)}` }];
    } catch (error) {
      // 已声明的旧文件缺失也是当前源码事实，不能静默略去并让审查者误以为仍有该实现。
      const missing = typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
      return missing ? [{ file, content: "[当前授权工作区不存在该源码文件；不能沿用旧实现作为本版本证据]" }] : [];
    }
  });
  // 阶段入口可能先委托给技术恢复判定器，再由判定器读取恢复记录。
  // 只沿静态相对 import 向下两层；测试仅限已集成任务声明的文件，不沿导入扩大到测试或包依赖。
  const readDirectImports = (sources: Array<{ file: string; content: string }>) => sources.flatMap(({ file, content }) => {
    if (content.startsWith("[当前授权工作区不存在")) return [];
    const imports = [
      ...content.matchAll(/\bimport\s+(?:type\s+)?[^;]*?\sfrom\s+["'](\.[^"']+)["']/gu),
      ...content.matchAll(/\btypeof\s+import\(\s*["'](\.[^"']+)["']\s*\)\s*\.\s*[A-Za-z_$][\w$]*/gu),
    ].map((match) => match[1]);
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
        return [{ file: dependency, content: source.length <= evidenceLimit(dependency)
          ? source : `${source.slice(0, 20_000)}\n[源码中段省略，当前片段不足以证明整文件行为]\n${source.slice(-20_000)}` }];
      } catch { return []; }
    });
  });
  const priorityItems = declaredItems.filter((item) => evidencePriority(item.file) < 5);
  const priorityImports = readDirectImports(priorityItems);
  // 场景引用的生产表面优先进入证据包，但不丢弃既有入口的恢复链。
  const firstLevel = [...new Map([...priorityImports, ...readDirectImports(declaredItems)].map((item) => [item.file, item])).values()];
  const secondLevel = readDirectImports(firstLevel);
  const items = [...new Map([...priorityItems, ...priorityImports, ...firstLevel, ...secondLevel, ...declaredItems].map((item) => [item.file, item])).values()].slice(0, 48);
  const batches = Array.from({ length: Math.ceil(items.length / 16) }, (_, index) => ({
    batch: index + 1,
    files: items.slice(index * 16, (index + 1) * 16).map((item) => item.file),
  }));
  return { items, batches, status: items.length ? "available" : "declared-files-unreadable" };
}

function readIntegratedCommitFiles(root: string, task: CollaborationTaskOutDto): string[] {
  const baseSha = task.versionWorkspace?.baseSha;
  const resultSha = task.versionWorkspace?.resultSha;
  if (!baseSha || !resultSha || !/^[a-f0-9]{40}$/u.test(baseSha) || !/^[a-f0-9]{40}$/u.test(resultSha)) return [];
  try {
    // 只有已进入当前工作区历史的结果提交才允许作为正式页面审查的源码范围。
    execFileSync("git", ["merge-base", "--is-ancestor", resultSha, "HEAD"], {
      cwd: root,
      stdio: "ignore",
    });
    const committed = execFileSync("git", ["diff", "--name-only", "-z", `${baseSha}..${resultSha}`], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 1_048_576,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return committed.split("\0").filter(Boolean);
  } catch {
    return [];
  }
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
