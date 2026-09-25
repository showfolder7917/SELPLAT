import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { CollaborationTaskOutDto } from "../../../../../../contracts/services/workflow/index.js";
import type { ReleaseBatchDocumentOutDto } from "../../../../../../contracts/services/support/capabilities/release/index.js";
import { resolveStagedRuntimeActivationExecutable } from "./verified-package.release.js";

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
      candidateBranch: null, candidateSha: null, candidateEvidence: null, runtimeActivation: null, localMergeSha: null, executable: null,
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

  /** 只恢复当前运行目录中已准备、但尚未完成候选运行包重启的批次。 */
  pendingRuntimeActivation(releaseBatchId: string): ReleaseBatchDocumentOutDto | null {
    const documentPath = path.join(this.#runningRoot, releaseBatchId, "发布批次文档.json");
    if (!existsSync(documentPath)) return null;
    const document = JSON.parse(readFileSync(documentPath, "utf8")) as ReleaseBatchDocumentOutDto;
    return document.state === "activating" && document.runtimeActivation?.state === "relaunch-scheduled" ? document : null;
  }

  /**
   * 受控启动器只可恢复一个已归档的暂存清理失败批次。
   * 真实传参示例：release-0.1.1-g461 与候选 SHA 均匹配已提升包时，把原批次移回运行目录并安排候选进程续接。
   * 返回示例：校验成功返回已写入 relaunch-scheduled 的批次；任一身份、来源或失败类型不匹配时返回 null，绝不扫描接管其他包。
   */
  recoverArchivedStagingCleanupFailure(releaseBatchId: string, candidateSha: string): ReleaseBatchDocumentOutDto | null {
    if (!/^[a-zA-Z0-9._-]+$/.test(releaseBatchId) || !/^[0-9a-f]{40,64}$/i.test(candidateSha)) return null;
    const archivedRoot = this.#findArchivedBatchRoot(releaseBatchId);
    if (!archivedRoot || existsSync(path.join(this.#runningRoot, releaseBatchId, "发布批次文档.json"))) return null;
    const documentPath = path.join(archivedRoot, "发布批次文档.json");
    const document = JSON.parse(readFileSync(documentPath, "utf8")) as ReleaseBatchDocumentOutDto;
    const activation = document.runtimeActivation;
    if (document.state !== "failed" || !activation || activation.state !== "preparing"
      || activation.candidateSha !== candidateSha || !hasCompatibleOrMissingFrozenImpactScope(activation) || !isStagingCleanupFailure(document.failureReason)) return null;
    const executable = this.resolveStagedRuntimeActivationExecutable(releaseBatchId, candidateSha);
    if (!executable) return null;
    const originalFailureReason = document.failureReason;
    mkdirSync(this.#runningRoot, { recursive: true });
    renameSync(archivedRoot, path.join(this.#runningRoot, releaseBatchId));
    document.state = "activating";
    document.completedAt = null;
    document.failureReason = null;
    document.runtimeActivation = {
      ...activation,
      state: "relaunch-scheduled",
      executable,
      detail: `旧宿主暂存清理失败后由受控启动器接管：${activation.detail || ""}${activation.detail ? "；" : ""}${originalFailureReason}`,
      updatedAt: new Date().toISOString(),
    };
    this.write(document);
    return document;
  }

  /** 读取仍在运行的精确批次，不扫描或修改其他发布记录。 */
  runningDocument(releaseBatchId: string): ReleaseBatchDocumentOutDto | null {
    if (!/^[a-zA-Z0-9._-]+$/.test(releaseBatchId)) return null;
    const documentPath = path.join(this.#runningRoot, releaseBatchId, "发布批次文档.json");
    return existsSync(documentPath) ? JSON.parse(readFileSync(documentPath, "utf8")) as ReleaseBatchDocumentOutDto : null;
  }

  /** 新进程恢复时只归档被状态仓库明确判为中断的旧批次，保留候选与失败证据。 */
  archiveInterruptedBatch(releaseBatchId: string, generation: number, reason: string): void {
    const document = this.runningDocument(releaseBatchId);
    if (!document || document.generation !== generation || !["candidate-ready", "testing", "verified", "integrated"].includes(document.state)) return;
    document.state = "failed";
    document.failureReason = reason;
    document.completedAt = new Date().toISOString();
    this.write(document);
  }

  /** 开发脚本重启经新进程健康检查后才归档发布成功事实。 */
  confirmDeveloperRestart(releaseBatchId: string): void {
    if (!/^[a-zA-Z0-9._-]+$/.test(releaseBatchId)) return;
    const documentPath = path.join(this.#runningRoot, releaseBatchId, "发布批次文档.json");
    if (!existsSync(documentPath)) return;
    const document = JSON.parse(readFileSync(documentPath, "utf8")) as ReleaseBatchDocumentOutDto;
    if (document.state !== "integrated" || document.executable !== null) return;
    document.state = "published";
    document.completedAt = new Date().toISOString();
    this.write(document);
  }

  /** 固定开发版装载并通过健康检查后，仅回收本批次预激活临时应用；历史发布包与当前运行应用不在范围内。 */
  retireRuntimeActivationPackage(releaseBatchId: string): void {
    if (!this.#stableBuildRoot || !/^[a-zA-Z0-9._-]+$/.test(releaseBatchId)) return;
    const activationRoot = path.join(this.#stableBuildRoot, "package", "activation");
    const target = path.join(activationRoot, `${releaseBatchId}-runtime`);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }

  /** 旧运行时只可接管本批已提升且来源提交一致的候选运行包。 */
  resolveStagedRuntimeActivationExecutable(releaseBatchId: string, candidateSha: string): string | null {
    if (!this.#stableBuildRoot) return null;
    return resolveStagedRuntimeActivationExecutable(this.#stableBuildRoot, releaseBatchId, candidateSha);
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

  #findArchivedBatchRoot(releaseBatchId: string): string | null {
    if (!existsSync(this.#archiveRoot)) return null;
    const matches = readdirSync(this.#archiveRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((month) => path.join(this.#archiveRoot, month.name, releaseBatchId))
      .filter((root) => existsSync(path.join(root, "发布批次文档.json")));
    return matches.length === 1 ? matches[0] : null;
  }

  /** 未归档的稳定应用同样不可复用，防止后续候选在提升阶段才发现覆盖冲突。 */
  #hasStablePublishedApplication(releaseBatchId: string): boolean {
    return Boolean(this.#stableBuildRoot && existsSync(path.join(this.#stableBuildRoot, "package", "published", releaseBatchId, "AI Desktop.app")));
  }
}

/** 旧宿主没有快照字段时允许精确候选启动后从保留分支补写；已存在的快照必须完整匹配。 */
function hasCompatibleOrMissingFrozenImpactScope(activation: NonNullable<ReleaseBatchDocumentOutDto["runtimeActivation"]>): boolean {
  const snapshot = activation.impactScope;
  if (!snapshot) return true;
  return Boolean(snapshot && snapshot.baseSha === activation.candidateBaseSha && snapshot.candidateSha === activation.candidateSha
    && Array.isArray(snapshot.files) && snapshot.files.every((file) => typeof file === "string"));
}

function isStagingCleanupFailure(reason: string | null): boolean {
  return Boolean(reason && /ENOTDIR: not a directory, (?:rmdir|unlink)/.test(reason)
    && reason.includes(`${path.sep}package${path.sep}activation-staging-`));
}
