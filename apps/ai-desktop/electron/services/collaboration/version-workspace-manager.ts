import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type { CollaborationTask, CollaborationVersionWorkspace } from "../../../shared/contracts/collaboration.js";

const execFileAsync = promisify(execFile);

export interface IntegrationCandidate {
  generation: number;
  branchName: string;
  rootPath: string;
  baseSha: string;
  candidateSha: string;
  taskIds: string[];
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
    if (status) {
      await this.#git(rootPath, ["add", "-A"]);
      await this.#git(rootPath, ["commit", "-m", `协同任务 ${task.taskId}：${memberName} 完成 r${task.taskRevision}`]);
    }
    const resultSha = await this.#git(rootPath, ["rev-parse", "HEAD"]);
    const remaining = await this.#git(rootPath, ["status", "--porcelain"]);
    if (remaining) throw new Error("任务 worktree 仍有未提交修改，不能进入集成队列。");
    return resultSha;
  }

  async createIntegrationCandidate(generation: number, tasks: CollaborationTask[]): Promise<IntegrationCandidate> {
    if (tasks.length === 0) throw new Error("集成批次不能为空。");
    const baseSha = await this.#integrationBaseSha();
    // 临时候选与稳定分支必须是同级名称；Git 不允许 integration 与 integration/gN 两种引用同时存在。
    const branchName = `codex/collab/integration-g${generation}`;
    const rootPath = this.#managedPath("integration", `g${generation}`);
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
    this.#validateManagedBranch(candidate.branchName);
    await this.#git(this.#repositoryRoot, ["worktree", "remove", this.#validateManagedPath(candidate.rootPath)]);
    await this.#git(this.#repositoryRoot, ["branch", "-D", candidate.branchName]);
  }

  async #integrationBaseSha(): Promise<string> {
    try {
      return await this.#git(this.#repositoryRoot, ["rev-parse", "codex/collab/integration"]);
    } catch {
      return this.currentBaseSha();
    }
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

  async #git(cwd: string, args: string[]): Promise<string> {
    const result = await execFileAsync("git", args, {
      cwd,
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return result.stdout.trim();
  }
}

function safeSegment(value: string): string {
  const normalized = value.toLowerCase().replaceAll(/[^a-z0-9._-]+/g, "-").replaceAll(/^-+|-+$/g, "").slice(0, 80);
  if (!normalized) throw new Error("无法生成安全的协同版本名称。");
  return normalized;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string") return error.stderr.trim().slice(-2_000);
  return error instanceof Error ? error.message : String(error);
}
