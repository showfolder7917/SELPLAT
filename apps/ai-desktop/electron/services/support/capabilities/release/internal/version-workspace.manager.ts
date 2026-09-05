import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type { CollaborationTaskOutDto, CollaborationVersionWorkspaceOutDto } from "../../../../../../contracts/services/workflow/index.js";
import { TaskRepairScopeAggregate } from "../../execution/index.js";

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
  workspace: CollaborationVersionWorkspaceOutDto;
  changedFiles: string[];
}

export interface LocalChangeTransferResult {
  taskId: string;
  resultSha: string;
  changedFiles: string[];
  recoveryStashSha: string;
}

export class LocalChangeOwnershipError extends Error {
  readonly conflictFiles: string[];
  readonly workspaceRoot: string;

  constructor(message: string, conflictFiles: string[] = [], workspaceRoot = "") {
    super(message);
    this.name = "LocalChangeOwnershipError";
    this.conflictFiles = [...new Set(conflictFiles.map(normalizeFile).filter(Boolean))].sort();
    this.workspaceRoot = workspaceRoot ? path.resolve(workspaceRoot) : "";
  }
}

export class MergeConflictError extends Error {
  readonly taskId: string;
  readonly conflictFiles: string[];
  readonly baseSha: string;
  readonly resultSha: string;

  constructor(taskId: string, conflictFiles: string[], baseSha: string, resultSha: string, detail: string) {
    const files = conflictFiles.length > 0 ? conflictFiles.join("、") : "Git 未返回冲突文件名";
    super(`任务 ${taskId} 与当前集成候选发生冲突（${files}）：${detail || "Git 未返回详细信息"}`);
    this.name = "MergeConflictError";
    this.taskId = taskId;
    this.conflictFiles = conflictFiles;
    this.baseSha = baseSha;
    this.resultSha = resultSha;
  }
}

export class CandidateBranchConflictError extends Error {
  readonly branchName: string;

  constructor(branchName: string) {
    super(`发布候选分支 ${branchName} 已存在，禁止覆盖同一批次证据。`);
    this.name = "CandidateBranchConflictError";
    this.branchName = branchName;
  }
}

export class CandidateWorkspaceDirtyError extends Error {
  readonly changedFiles: string[];

  constructor(changedFiles: string[]) {
    super(`集成候选工作区不干净，禁止提升。未归属路径：${changedFiles.join("、") || "Git 未返回路径"}`);
    this.name = "CandidateWorkspaceDirtyError";
    this.changedFiles = changedFiles;
  }
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

  async prepareTask(task: CollaborationTaskOutDto, memberId: string): Promise<CollaborationVersionWorkspaceOutDto> {
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

  async resumeTask(task: CollaborationTaskOutDto): Promise<CollaborationVersionWorkspaceOutDto> {
    const workspace = task.versionWorkspace;
    if (!workspace) throw new Error("任务没有可恢复的版本工作区。");
    const rootPath = this.#validateManagedPath(workspace.rootPath);
    const branchName = await this.#git(rootPath, ["branch", "--show-current"]);
    if (branchName !== workspace.branchName) throw new Error("恢复工作区的分支与持久化恢复点不一致。");
    await this.#git(rootPath, ["rev-parse", "HEAD"]);
    return { ...workspace, rootPath };
  }

  /** 验证测试目标仍是本任务由应用签发的 worktree 与分支，返回可供内部测试器使用的真实根路径。 */
  async validateTaskWorkspace(task: CollaborationTaskOutDto): Promise<string> {
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

  /** 使用 Git 真实状态核对自修范围，不能只相信执行人物流式上报的文件列表。 */
  async validateTaskChangeScope(task: CollaborationTaskOutDto, authorizedFiles: readonly string[]): Promise<string[]> {
    const workspace = task.versionWorkspace;
    if (!workspace) {
      throw new Error("任务尚未建立独立版本工作区。");
    }
    const rootPath = this.#validateManagedPath(workspace.rootPath);
    const status = await this.#gitRaw(rootPath, ["status", "--porcelain", "-z"]);
    const observedFiles = splitStatusPorcelain(status);
    const repairScope = TaskRepairScopeAggregate.freeze(authorizedFiles);
    repairScope.assertContainsOnlyAuthorizedFiles(observedFiles);
    return observedFiles;
  }

  async commitTaskResult(task: CollaborationTaskOutDto, memberName: string, authorizedFiles: readonly string[]): Promise<string> {
    const workspace = task.versionWorkspace;
    if (!workspace) throw new Error("任务尚未建立独立版本工作区。");
    const rootPath = this.#validateManagedPath(workspace.rootPath);
    // 最终提交与复测前检查使用同一聚合；任何晚到的越界修改都不能进入结果提交。
    await this.validateTaskChangeScope(task, authorizedFiles);
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
          : `本地修改 ${changedFile} 同时属于多个待集成任务，禁止猜测归属。`, [changedFile], this.#repositoryRoot);
      }
      owners.set(matching[0].taskId, matching[0]);
    }
    if (owners.size !== 1) throw new LocalChangeOwnershipError("本地修改分属多个任务，必须分别回到各自任务分支后再集成。", changedFiles, this.#repositoryRoot);
    const owner = [...owners.values()][0];
    const taskRoot = this.#validateManagedPath(owner.workspace.rootPath);
    this.#validateManagedBranch(owner.workspace.branchName);
    if (await this.#git(taskRoot, ["branch", "--show-current"]) !== owner.workspace.branchName) throw new LocalChangeOwnershipError("任务工作区分支与签发记录不一致。", [], taskRoot);
    const taskChangedFiles = splitStatusPorcelain(await this.#gitRaw(taskRoot, ["status", "--porcelain", "-z"]));
    if (taskChangedFiles.length) throw new LocalChangeOwnershipError("任务工作区已有未提交内容，禁止叠加本地修改。", taskChangedFiles, taskRoot);

    const previousStash = await this.#git(this.#repositoryRoot, ["rev-parse", "-q", "--verify", "refs/stash"]).catch(() => "");
    await this.#git(this.#repositoryRoot, ["stash", "push", "--include-untracked", "--message", `AI Desktop 转交 ${owner.taskId}`]);
    const recoveryStashSha = await this.#git(this.#repositoryRoot, ["rev-parse", "-q", "--verify", "refs/stash"]).catch(() => "");
    if (!recoveryStashSha || recoveryStashSha === previousStash) throw new LocalChangeOwnershipError("本地修改恢复快照创建失败，未执行转交。", changedFiles, this.#repositoryRoot);
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
      throw new LocalChangeOwnershipError(`本地修改已保存为恢复快照 ${recoveryStashSha}，但转交任务分支失败：${errorMessage(error)}`, changedFiles, this.#repositoryRoot);
    }
  }

  async createIntegrationCandidate(generation: number, tasks: CollaborationTaskOutDto[]): Promise<IntegrationCandidate> {
    return this.createReleaseCandidate(`integration-g${generation}`, "0.0.0", generation, tasks, true);
  }

  /** 从固定基线创建可追溯的 release/<version>-rc 候选；只有发布锁持有者可以调用。 */
  async createReleaseCandidate(releaseBatchId: string, version: string, generation: number, tasks: CollaborationTaskOutDto[], legacyIntegrationBranch = false): Promise<IntegrationCandidate> {
    if (tasks.length === 0) throw new Error("集成批次不能为空。");
    const baseSha = await this.#integrationBaseSha();
    const safeVersion = safeVersionSegment(version);
    const branchName = legacyIntegrationBranch ? `codex/collab/integration-g${generation}` : await this.#availableReleaseBranch(safeVersion, generation);
    const rootPath = this.#managedPath(legacyIntegrationBranch ? "integration" : "release", legacyIntegrationBranch ? `g${generation}` : safeSegment(releaseBatchId));
    await this.#git(this.#repositoryRoot, ["worktree", "add", "-b", branchName, rootPath, baseSha]);
    try {
      for (const task of tasks) {
        const resultSha = task.versionWorkspace?.resultSha;
        if (!resultSha) throw new Error(`任务 ${task.taskId} 缺少固定 resultSha。`);
        try {
          await this.#git(rootPath, ["merge", "--no-ff", "--no-edit", resultSha]);
        } catch (error) {
          const conflictFiles = splitLines(await this.#git(rootPath, ["diff", "--name-only", "--diff-filter=U"]).catch(() => ""));
          const status = await this.#git(rootPath, ["status", "--porcelain"]).catch(() => "");
          const detail = [errorMessage(error), status].filter(Boolean).join("；").slice(-2_000);
          await this.#git(rootPath, ["merge", "--abort"]).catch(() => undefined);
          throw new MergeConflictError(task.taskId, conflictFiles, baseSha, resultSha, detail);
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
    const changedFiles = splitStatusPorcelain(await this.#gitRaw(candidate.rootPath, ["status", "--porcelain", "-z"]));
    if (changedFiles.length) throw new CandidateWorkspaceDirtyError(changedFiles);
    await this.#git(this.#repositoryRoot, ["branch", "-f", "codex/collab/integration", candidate.candidateSha]);
    return candidate.candidateSha;
  }

  async mergeIntoLocalBranch(integrationSha: string): Promise<string> {
    const localStatus = await this.#git(this.#repositoryRoot, ["status", "--porcelain"]);
    if (localStatus) throw new Error("用户本地分支存在未提交修改，已停止自动合并。");
    await this.#git(this.#repositoryRoot, ["merge", "--no-ff", "--no-edit", integrationSha]);
    return this.#git(this.#repositoryRoot, ["rev-parse", "HEAD"]);
  }

  async retireWorkspace(workspace: CollaborationVersionWorkspaceOutDto): Promise<void> {
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

  /**
   * 只回收发布归档明确标记失败的候选；成功证据、稳定集成指针、任务分支和用户分支均保留。
   *
   * 真实传参示例：传入 `["release/0.1.1-rc-g9"]` 且分支存在，返回 `{ branchCount: 1, worktreeCount: 0, failures: [] }`。
   * 真实返回示例：失败候选仍在签发的 release worktree 中时先强制移除该测试工作树，再删除候选分支。
   * 异常或副作用示例：候选位于签发目录之外时写入 failures 并跳过该目标，调用方仍可独立清理数据库运行态。
   */
  async clearFailedTestReleaseCandidates(failedBranches: string[]): Promise<{ branchCount: number; worktreeCount: number; failures: string[] }> {
    const targets = new Set(failedBranches);
    for (const branchName of targets) this.#validateCandidateBranch(branchName);
    const releaseRoot = path.join(this.#managedRoot, "release");
    let worktreeCount = 0;
    const failures: string[] = [];
    for (const worktree of parseGitWorktrees(await this.#gitRaw(this.#repositoryRoot, ["worktree", "list", "--porcelain"]))) {
      if (!worktree.branchName || !targets.has(worktree.branchName)) continue;
      const rootPath = path.resolve(worktree.rootPath);
      const relative = path.relative(releaseRoot, rootPath);
      if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        failures.push(`失败候选分支 ${worktree.branchName} 位于应用签发目录之外，未自动回收。`);
        continue;
      }
      try {
        // 测试失败可能留下构建产物或诊断文件；目标已由发布归档和受控目录双重确认，可强制回收该测试工作树。
        await this.#git(this.#repositoryRoot, ["worktree", "remove", "--force", rootPath]);
        worktreeCount += 1;
      } catch (error) {
        failures.push(`失败候选工作树 ${worktree.branchName} 回收失败：${errorMessage(error)}`);
      }
    }
    let branchCount = 0;
    for (const branchName of [...targets].sort()) {
      const exists = await this.#git(this.#repositoryRoot, ["show-ref", "--verify", `refs/heads/${branchName}`]).then(() => true, () => false);
      if (!exists) continue;
      try {
        await this.#git(this.#repositoryRoot, ["branch", "-D", branchName]);
        branchCount += 1;
      } catch (error) {
        failures.push(`失败候选分支 ${branchName} 删除失败：${errorMessage(error)}`);
      }
    }
    return { branchCount, worktreeCount, failures };
  }

  async #integrationBaseSha(): Promise<string> {
    // 发布锁与本地干净门禁已经在调用前完成；候选必须包含当前本地最新提交，旧集成指针只保留为历史证据。
    return this.currentBaseSha();
  }

  /** 首批保留 release/<version>-rc；同一版本的后续批次追加代次，既不覆盖历史发布证据也不会永久阻塞。 */
  async #availableReleaseBranch(version: string, generation: number): Promise<string> {
    const primary = `release/${version}-rc`;
    const primaryExists = await this.#git(this.#repositoryRoot, ["show-ref", "--verify", `refs/heads/${primary}`]).then(() => true, () => false);
    if (!primaryExists) return primary;
    const generated = `${primary}-g${generation}`;
    for (let retry = 1; retry <= 1_000; retry += 1) {
      const candidate = retry === 1 ? generated : `${generated}-r${retry}`;
      const exists = await this.#git(this.#repositoryRoot, ["show-ref", "--verify", `refs/heads/${candidate}`]).then(() => true, () => false);
      if (!exists) return candidate;
    }
    throw new CandidateBranchConflictError(`${generated}-r1000`);
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
    if (/^release\/[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?-rc(?:-g[1-9][0-9]*(?:-r[2-9][0-9]*)?)?$/.test(branchName)) return;
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
function splitStatusPorcelain(value: string): string[] {
  const entries = value.split("\0").filter(Boolean);
  const files: string[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const status = entry.slice(0, 2);
    files.push(normalizeFile(entry.slice(3)));
    // porcelain -z 的重命名/复制记录紧随第二个原始路径；两端都作为未归属证据返回。
    if ((status.includes("R") || status.includes("C")) && entries[index + 1]) files.push(normalizeFile(entries[++index]));
  }
  return [...new Set(files.filter(Boolean))].sort();
}
function splitZero(value: string): string[] { return value.split("\0").filter(Boolean); }
function splitLines(value: string): string[] { return [...new Set(value.split(/\r?\n/).map(normalizeFile).filter(Boolean))].sort(); }

function parseGitWorktrees(value: string): Array<{ rootPath: string; branchName: string | null }> {
  return value.trim().split(/\r?\n\r?\n/).filter(Boolean).map((block) => {
    const lines = block.split(/\r?\n/);
    return {
      rootPath: lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length) || "",
      branchName: lines.find((line) => line.startsWith("branch refs/heads/"))?.slice("branch refs/heads/".length) || null,
    };
  }).filter((worktree) => Boolean(worktree.rootPath));
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    if ("stderr" in error && typeof error.stderr === "string" && error.stderr.trim()) return error.stderr.trim().slice(-2_000);
    if ("stdout" in error && typeof error.stdout === "string" && error.stdout.trim()) return error.stdout.trim().slice(-2_000);
  }
  return error instanceof Error ? error.message : String(error);
}
