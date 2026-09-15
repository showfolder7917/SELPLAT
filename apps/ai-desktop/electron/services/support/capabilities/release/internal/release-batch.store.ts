import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { CollaborationTaskOutDto } from "../../../../../../contracts/services/workflow/index.js";
import type { ReleaseBatchDocumentOutDto } from "../../../../../../contracts/services/support/capabilities/release/index.js";

/** 发布批次文档由发布协调器单点维护，运行中可追踪，结束后进入长期发布归档。 */
export class ReleaseBatchStore {
  readonly #runningRoot: string;
  readonly #archiveRoot: string;
  readonly #stableBuildRoot: string | null;

  constructor(runningRoot: string, archiveLogRoot: string, stableBuildRoot?: string) {
    this.#runningRoot = path.resolve(runningRoot);
    this.#archiveRoot = path.join(path.resolve(archiveLogRoot), "发布归档");
    this.#stableBuildRoot = stableBuildRoot ? path.resolve(stableBuildRoot) : null;
  }

  create(releaseBatchId: string, version: string, generation: number, tasks: CollaborationTaskOutDto[], initiatorMemberId: string): ReleaseBatchDocumentOutDto {
    const document: ReleaseBatchDocumentOutDto = {
      releaseBatchId, version, generation, state: "frozen", initiatorMemberId,
      candidateBranch: null, candidateSha: null, candidateEvidence: null, localMergeSha: null, executable: null,
      tasks: tasks.map((task) => ({ taskId: task.taskId, title: task.snapshot.title, branchName: task.versionWorkspace?.branchName || null, resultSha: task.versionWorkspace?.resultSha || null })),
      startedAt: new Date().toISOString(), completedAt: null, failureReason: null,
    };
    this.write(document);
    return document;
  }

  write(document: ReleaseBatchDocumentOutDto): void {
    const runningRoot = path.join(this.#runningRoot, document.releaseBatchId);
    const root = document.completedAt
      ? path.join(this.#archiveRoot, document.startedAt.slice(0, 7), document.releaseBatchId)
      : runningRoot;
    mkdirSync(root, { recursive: true });
    const target = path.join(root, "发布批次文档.json");
    const temporary = `${target}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    renameSync(temporary, target);
    if (document.completedAt) rmSync(runningRoot, { recursive: true, force: true });
  }

  /**
   * 从当前运行文档与长期归档中避让已经使用的发布批次代次。
   * 真实传参示例：版本 0.1.1、请求代次 2，历史已有 release-0.1.1-g2 时返回 3。
   * 稳定应用即使缺少历史归档也已占用批次标识；返回值只分配新标识，绝不改写稳定应用。
   */
  nextAvailableGeneration(version: string, requestedGeneration: number): number {
    let generation = Math.max(1, requestedGeneration);
    while (this.#hasReleaseBatch(`release-${version}-g${generation}`) || this.#hasStablePublishedApplication(`release-${version}-g${generation}`)) generation += 1;
    return generation;
  }

  /** 返回归档中明确失败且实际建立过的候选分支；已验证、已发布和无候选分支的准备失败均不进入清理范围。 */
  failedCandidateBranches(): string[] {
    if (!existsSync(this.#archiveRoot)) return [];
    const branches = new Set<string>();
    for (const month of readdirSync(this.#archiveRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      const monthRoot = path.join(this.#archiveRoot, month.name);
      for (const batch of readdirSync(monthRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
        const documentPath = path.join(monthRoot, batch.name, "发布批次文档.json");
        if (!existsSync(documentPath)) continue;
        const document = JSON.parse(readFileSync(documentPath, "utf8")) as ReleaseBatchDocumentOutDto;
        if (document.state === "failed" && document.candidateBranch) branches.add(document.candidateBranch);
      }
    }
    return [...branches].sort();
  }

  /** 检查运行态或归档中是否已存在同名批次，防止清空运行态后复用历史发布标识。 */
  #hasReleaseBatch(releaseBatchId: string): boolean {
    if (existsSync(path.join(this.#runningRoot, releaseBatchId, "发布批次文档.json"))) return true;
    if (!existsSync(this.#archiveRoot)) return false;
    return readdirSync(this.#archiveRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .some((month) => existsSync(path.join(this.#archiveRoot, month.name, releaseBatchId, "发布批次文档.json")));
  }

  /** 未归档的稳定应用同样不可复用，防止后续候选在提升阶段才发现覆盖冲突。 */
  #hasStablePublishedApplication(releaseBatchId: string): boolean {
    return Boolean(this.#stableBuildRoot && existsSync(path.join(this.#stableBuildRoot, "package", "published", releaseBatchId, "AI Desktop.app")));
  }
}
