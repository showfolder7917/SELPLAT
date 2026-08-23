import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type { CollaborationTask, CollaborationVersionWorkspace } from "../../../shared/contracts/collaboration.js";

const execFileAsync = promisify(execFile);

export interface IntegrationCandidate {
  generation: number;
  releaseBatchId: string;
  version: string;
  branchName: string;
  rootPath: string;
  baseSha: string;
  candidateSha: string;
  taskIds: string[];
}

export interface LocalChangeOwnershipCandidate {
  taskId: string;
  memberName: string;
  workspace: CollaborationVersionWorkspace;
  changedFiles: string[];
}

export interface LocalChangeTransferResult {
  taskId: string;
  resultSha: string;
  changedFiles: string[];
  recoveryStashSha: string;
}

export class LocalChangeOwnershipError extends Error {
  constructor(message: string) { super(message); this.name = "LocalChangeOwnershipError"; }
}

/** 只在应用签发的目录中建立 Git worktree，执行人永不直接修改用户当前工作目录。 */
export class VersionWorkspaceManager {
  readonly #repositoryRoot: string;
  readonly #managedRoot: string;

  constructor(repositoryRoot: string, managedRoot: string) {
    this.#repositoryRoot = path.resolve(repositoryRoot);
    this.#managedRoot = path.resolve(managedRoot);
    mkdirSync(this.#managedRoot, { recursive: true });
  }

  async currentBaseSha(): Promise<string> {
    return this.#git(this.#repositoryRoot, ["rev-parse", "HEAD"]);
  }

  async prepareTask(task: CollaborationTask, memberId: string): Promise<CollaborationVersionWorkspace> {
    const baseSha = await this.currentBaseSha();
    const safeTaskId = safeSegment(task.taskId);
    const safeMemberId = safeSegment(memberId);
    const branchName = `codex/collab/${safeTaskId}/${safeMemberId}/r${task.taskRevision}`;
    const rootPath = this.#managedPath("tasks", safeTaskId, `r${task.taskRevision}`);
    if (existsSync(rootPath)) {
      const existingBranch = await this.#git(rootPath, ["branch", "--show-current"]);
      if (existingBranch !== branchName) throw new Error("任务工作区目录已存在，但不属于当前签发分支。");
    } else {
      try {
        await this.#git(this.#repositoryRoot, ["worktree", "add", "-b", branchName, rootPath, baseSha]);
      } catch (error) {
        const existingBranch = await this.#git(this.#repositoryRoot, ["show-ref", "--verify", `refs/heads/${branchName}`]).catch(() => "");
        if (!existingBranch) throw error;
        await this.#git(this.#repositoryRoot, ["worktree", "add", rootPath, branchName]);
      }
    }
    return {
      workspaceId: `worktree:${task.taskId}:r${task.taskRevision}`,
      rootPath,
      branchName,
      baseSha: await this.#git(rootPath, ["rev-parse", "HEAD"]),
      resultSha: null,
      createdAt: new Date().toISOString(),
      retiredAt: null,
    };
  }

  async resumeTask(task: CollaborationTask): Promise<CollaborationVersionWorkspace> {
    const workspace = task.versionWorkspace;
    if (!workspace) throw new Error("任务没有可恢复的版本工作区。");
    const rootPath = this.#validateManagedPath(workspace.rootPath);
    const branchName = await this.#git(rootPath, ["branch", "--show-current"]);
    if (branchName !== workspace.branchName) throw new Error("恢复工作区的分支与持久化恢复点不一致。");
    await this.#git(rootPath, ["rev-parse", "HEAD"]);
    return { ...workspace, rootPath };
  }

  /** 验证测试目标仍是本任务由应用签发的 worktree 与分支，返回可供内部测试器使用的真实根路径。 */
  async validateTaskWorkspace(task: CollaborationTask): Promise<string> {
    const workspace = task.versionWorkspace;
    if (!workspace) throw new Error("任务尚未建立独立版本工作区。");
    const rootPath = this.#validateManagedPath(workspace.rootPath);
    this.#validateManagedBranch(workspace.branchName);
    const branchName = await this.#git(rootPath, ["branch", "--show-current"]);
    if (branchName !== workspace.branchName) throw new Error("任务测试目标分支与应用签发记录不一致。");
    const baseSha = await this.#git(rootPath, ["merge-base", workspace.baseSha, "HEAD"]);
    if (baseSha !== workspace.baseSha) throw new Error("任务测试分支不再继承签发时的固定基线。");
    return rootPath;
  }

  async commitTaskResult(task: CollaborationTask, memberName: string): Promise<string> {
    const workspace = task.versionWorkspace;
    if (!workspace) throw new Error("任务尚未建立独立版本工作区。");
    const rootPath = this.#validateManagedPath(workspace.rootPath);
    const status = await this.#git(rootPath, ["status", "--porcelain"]);
    const beforeSha = await this.#git(rootPath, ["rev-parse", "HEAD"]);
    if (status) {
      await this.#git(rootPath, ["add", "-A"]);
      await this.#git(rootPath, ["commit", "-m", `协同任务 ${task.taskId}：${memberName} 完成 r${task.taskRevision}`]);
    }
    const resultSha = await this.#git(rootPath, ["rev-parse", "HEAD"]);
    if (status) {
      const finalCommitCount = await this.#git(rootPath, ["rev-list", "--count", `${beforeSha}..${resultSha}`]);
      if (finalCommitCount !== "1") throw new Error("任务最终整理必须且只能生成一个本地提交。");
    }
    const remaining = await this.#git(rootPath, ["status", "--porcelain"]);
    if (remaining) throw new Error("任务 worktree 仍有未提交修改，不能进入集成队列。");
    return resultSha;
  }

  /**
   * 目标分支脏时只转移唯一可证明属于一个待集成任务的修改；
   * 原修改先进入 Git stash 作为恢复证据，任务分支提交成功后才删除该恢复引用。
   */
  async transferOwnedLocalChanges(candidates: LocalChangeOwnershipCandidate[]): Promise<LocalChangeTransferResult | null> {
    const changedFiles = await this.#localChangedFiles();
    if (changedFiles.length === 0) return null;
    const owners = new Map<string, LocalChangeOwnershipCandidate>();
    for (const changedFile of changedFiles) {
      const matching = candidates.filter((candidate) => normalizedFiles(candidate.changedFiles).has(changedFile));
      if (matching.length !== 1) {
        throw new LocalChangeOwnershipError(matching.length === 0
          ? `本地修改 ${changedFile} 未登记到任何待集成任务，禁止自动提交或合并。`
          : `本地修改 ${changedFile} 同时属于多个待集成任务，禁止猜测归属。`);
      }
      owners.set(matching[0].taskId, matching[0]);
    }
    if (owners.size !== 1) throw new LocalChangeOwnershipError("本地修改分属多个任务，必须分别回到各自任务分支后再集成。");
    const owner = [...owners.values()][0];
    const taskRoot = this.#validateManagedPath(owner.workspace.rootPath);
    this.#validateManagedBranch(owner.workspace.branchName);
    if (await this.#git(taskRoot, ["branch", "--show-current"]) !== owner.workspace.branchName) throw new LocalChangeOwnershipError("任务工作区分支与签发记录不一致。");
    if (await this.#git(taskRoot, ["status", "--porcelain"])) throw new LocalChangeOwnershipError("任务工作区已有未提交内容，禁止叠加本地修改。");

    const previousStash = await this.#git(this.#repositoryRoot, ["rev-parse", "-q", "--verify", "refs/stash"]).catch(() => "");
    await this.#git(this.#repositoryRoot, ["stash", "push", "--include-untracked", "--message", `AI Desktop 转交 ${owner.taskId}`]);
    const recoveryStashSha = await this.#git(this.#repositoryRoot, ["rev-parse", "-q", "--verify", "refs/stash"]).catch(() => "");
    if (!recoveryStashSha || recoveryStashSha === previousStash) throw new LocalChangeOwnershipError("本地修改恢复快照创建失败，未执行转交。");
    try {
      await this.#git(taskRoot, ["stash", "apply", "--index", recoveryStashSha]);
      await this.#git(taskRoot, ["add", "-A"]);
      const beforeSha = await this.#git(taskRoot, ["rev-parse", "HEAD"]);
      await this.#git(taskRoot, ["commit", "-m", `协同任务 ${owner.taskId}：接收本地归属修改（${owner.memberName}）`]);
      const resultSha = await this.#git(taskRoot, ["rev-parse", "HEAD"]);
      if (await this.#git(taskRoot, ["rev-list", "--count", `${beforeSha}..${resultSha}`]) !== "1") throw new Error("本地归属修改转交必须且只能生成一个提交。");
      if (await this.#git(taskRoot, ["status", "--porcelain"])) throw new Error("任务分支接收本地修改后仍不干净。");
      if (await this.#git(this.#repositoryRoot, ["status", "--porcelain"])) throw new Error("本地修改转交后目标分支仍不干净。");
      const topStash = await this.#git(this.#repositoryRoot, ["rev-parse", "-q", "--verify", "refs/stash"]).catch(() => "");
      if (topStash === recoveryStashSha) await this.#git(this.#repositoryRoot, ["stash", "drop", "stash@{0}"]);
      return { taskId: owner.taskId, resultSha, changedFiles, recoveryStashSha };
    } catch (error) {
      throw new LocalChangeOwnershipError(`本地修改已保存为恢复快照 ${recoveryStashSha}，但转交任务分支失败：${errorMessage(error)}`);
    }
  }

  async createIntegrationCandidate(generation: number, tasks: CollaborationTask[]): Promise<IntegrationCandidate> {
    return this.createReleaseCandidate(`integration-g${generation}`, "0.0.0", generation, tasks, true);
  }

  /** 从固定基线创建可追溯的 release/<version>-rc 候选；只有发布锁持有者可以调用。 */
  async createReleaseCandidate(releaseBatchId: string, version: string, generation: number, tasks: CollaborationTask[], legacyIntegrationBranch = false): Promise<IntegrationCandidate> {
    if (tasks.length === 0) throw new Error("集成批次不能为空。");
    const baseSha = await this.#integrationBaseSha();
    const safeVersion = safeVersionSegment(version);
    const branchName = legacyIntegrationBranch ? `codex/collab/integration-g${generation}` : `release/${safeVersion}-rc`;
    const rootPath = this.#managedPath(legacyIntegrationBranch ? "integration" : "release", legacyIntegrationBranch ? `g${generation}` : safeSegment(releaseBatchId));
    await this.#git(this.#repositoryRoot, ["worktree", "add", "-b", branchName, rootPath, baseSha]);
    try {
      for (const task of tasks) {
        const resultSha = task.versionWorkspace?.resultSha;
        if (!resultSha) throw new Error(`任务 ${task.taskId} 缺少固定 resultSha。`);
        try {
          await this.#git(rootPath, ["merge", "--no-ff", "--no-edit", resultSha]);
        } catch (error) {
          await this.#git(rootPath, ["merge", "--abort"]).catch(() => undefined);
          throw new Error(`任务 ${task.taskId} 与当前集成候选发生冲突：${errorMessage(error)}`);
        }
      }
      return {
        generation,
        releaseBatchId,
        version,
        branchName,
        rootPath,
        baseSha,
        candidateSha: await this.#git(rootPath, ["rev-parse", "HEAD"]),
        taskIds: tasks.map((task) => task.taskId),
      };
    } catch (error) {
      await this.#git(this.#repositoryRoot, ["worktree", "remove", rootPath]).catch(() => undefined);
      await this.#git(this.#repositoryRoot, ["branch", "-D", branchName]).catch(() => undefined);
      throw error;
    }
  }

  async promoteIntegrationCandidate(candidate: IntegrationCandidate): Promise<string> {
    const clean = await this.#git(candidate.rootPath, ["status", "--porcelain"]);
    if (clean) throw new Error("集成候选工作区不干净，禁止提升。");
    await this.#git(this.#repositoryRoot, ["branch", "-f", "codex/collab/integration", candidate.candidateSha]);
    return candidate.candidateSha;
  }

  async mergeIntoLocalBranch(integrationSha: string): Promise<string> {
    const localStatus = await this.#git(this.#repositoryRoot, ["status", "--porcelain"]);
    if (localStatus) throw new Error("用户本地分支存在未提交修改，已停止自动合并。");
    await this.#git(this.#repositoryRoot, ["merge", "--no-ff", "--no-edit", integrationSha]);
    return this.#git(this.#repositoryRoot, ["rev-parse", "HEAD"]);
  }

  async retireWorkspace(workspace: CollaborationVersionWorkspace): Promise<void> {
    const rootPath = this.#validateManagedPath(workspace.rootPath);
    this.#validateManagedBranch(workspace.branchName);
    await this.#git(this.#repositoryRoot, ["worktree", "remove", rootPath]);
    await this.#git(this.#repositoryRoot, ["branch", "-D", workspace.branchName]);
  }

  async retireCandidate(candidate: IntegrationCandidate): Promise<void> {
    this.#validateCandidateBranch(candidate.branchName);
    await this.#git(this.#repositoryRoot, ["worktree", "remove", this.#validateManagedPath(candidate.rootPath)]);
    // 正式 release 候选分支是发布证据，移除 worktree 后继续保留；旧临时候选仍按原规则清理。
    if (candidate.branchName.startsWith("codex/collab/")) await this.#git(this.#repositoryRoot, ["branch", "-D", candidate.branchName]);
  }

  async #integrationBaseSha(): Promise<string> {
    try {
      return await this.#git(this.#repositoryRoot, ["rev-parse", "codex/collab/integration"]);
    } catch {
      return this.currentBaseSha();
    }
  }

  async #localChangedFiles(): Promise<string[]> {
    const tracked = splitZero(await this.#gitRaw(this.#repositoryRoot, ["diff", "--name-only", "-z", "HEAD"]));
    const untracked = splitZero(await this.#gitRaw(this.#repositoryRoot, ["ls-files", "--others", "--exclude-standard", "-z"]));
    return [...new Set([...tracked, ...untracked].map(normalizeFile).filter(Boolean))].sort();
  }

  #managedPath(...segments: string[]): string {
    return this.#validateManagedPath(path.join(this.#managedRoot, ...segments));
  }

  #validateManagedPath(candidate: string): string {
    const resolved = path.resolve(candidate);
    const relative = path.relative(this.#managedRoot, resolved);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("协同 worktree 路径超出应用签发范围。");
    return resolved;
  }

  #validateManagedBranch(branchName: string): void {
    if (!/^codex\/collab\/[a-zA-Z0-9._/-]+$/.test(branchName) || branchName.includes("..")) throw new Error("协同分支名称超出应用签发范围。");
  }

  #validateCandidateBranch(branchName: string): void {
    if (/^release\/[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?-rc$/.test(branchName)) return;
    this.#validateManagedBranch(branchName);
  }

  async #git(cwd: string, args: string[]): Promise<string> {
    const result = await execFileAsync("git", args, {
      cwd,
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return result.stdout.trim();
  }

  async #gitRaw(cwd: string, args: string[]): Promise<string> {
    const result = await execFileAsync("git", args, {
      cwd,
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return result.stdout;
  }
}

function safeSegment(value: string): string {
  const normalized = value.toLowerCase().replaceAll(/[^a-z0-9._-]+/g, "-").replaceAll(/^-+|-+$/g, "").slice(0, 80);
  if (!normalized) throw new Error("无法生成安全的协同版本名称。");
  return normalized;
}

function safeVersionSegment(value: string): string {
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/.test(value)) throw new Error("发布版本号不符合语义化版本格式。");
  return value;
}

function normalizedFiles(files: string[]): Set<string> { return new Set(files.map(normalizeFile).filter(Boolean)); }
function normalizeFile(value: string): string { return value.trim().replaceAll("\\", "/").replace(/^\.\//, ""); }
function splitZero(value: string): string[] { return value.split("\0").filter(Boolean); }

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string") return error.stderr.trim().slice(-2_000);
  return error instanceof Error ? error.message : String(error);
}
