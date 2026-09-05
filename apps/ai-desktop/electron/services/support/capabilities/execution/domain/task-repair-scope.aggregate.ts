/** 自修范围核对结果，供执行器和 Git 提交门禁共享同一组事实。 */
export interface TaskRepairScopeCheck {
  /** 首次实施结束时已经存在的文件变更，也是自动自修唯一允许继续修改的范围。 */
  authorizedFiles: string[];
  /** 当前任务工作树中由 Git 实际观察到的全部变更文件。 */
  observedFiles: string[];
  /** 当前变更中不属于首次实施范围、必须阻断提交的文件。 */
  unexpectedFiles: string[];
  /** true 表示当前实际变更没有越过首次实施范围。 */
  accepted: boolean;
}

/** 自修范围越界错误保留具体文件，页面和恢复流程无需从自由文本猜测。 */
export class TaskRepairScopeViolationError extends Error {
  /** 本次自修新增或改动的范围外文件。 */
  readonly unexpectedFiles: string[];

  constructor(unexpectedFiles: string[]) {
    const normalizedFiles = normalizeFiles(unexpectedFiles);
    super(`自动自修越过首次实施范围，已阻止复测和合并：${normalizedFiles.join("、")}`);
    this.name = "TaskRepairScopeViolationError";
    this.unexpectedFiles = normalizedFiles;
  }
}

/** 冻结首次实施文件范围，并对后续自修和最终提交执行同一判断。 */
export class TaskRepairScopeAggregate {
  /** 首次实施完成后冻结的工程相对文件集合。 */
  readonly #authorizedFiles: Set<string>;

  private constructor(authorizedFiles: string[]) {
    this.#authorizedFiles = new Set(normalizeFiles(authorizedFiles));
  }

  /** 首次进入桌面验证前创建范围快照，后续轮次不得扩大。 */
  static freeze(authorizedFiles: Iterable<string>): TaskRepairScopeAggregate {
    return new TaskRepairScopeAggregate([...authorizedFiles]);
  }

  /** 返回稳定排序的只读副本，避免调用方修改聚合内部状态。 */
  authorizedFiles(): string[] {
    return [...this.#authorizedFiles].sort();
  }

  /** 比较真实 Git 变更与冻结范围，形成可展示、可测试的结构化结论。 */
  check(observedFiles: Iterable<string>): TaskRepairScopeCheck {
    const normalizedObservedFiles = normalizeFiles([...observedFiles]);
    const unexpectedFiles = normalizedObservedFiles.filter((file) => !this.#authorizedFiles.has(file));
    return {
      authorizedFiles: this.authorizedFiles(),
      observedFiles: normalizedObservedFiles,
      unexpectedFiles,
      accepted: unexpectedFiles.length === 0,
    };
  }

  /** 在复测和提交前执行硬门禁；范围外文件存在时立即终止当前流程。 */
  assertContainsOnlyAuthorizedFiles(observedFiles: Iterable<string>): void {
    const check = this.check(observedFiles);
    if (!check.accepted) {
      throw new TaskRepairScopeViolationError(check.unexpectedFiles);
    }
  }
}

/** 文件边界统一使用工程相对斜杠形式，阻止空路径、父目录和绝对路径混入授权集合。 */
function normalizeFiles(files: string[]): string[] {
  const normalizedFiles: string[] = [];
  for (const file of files) {
    const normalizedFile = file.trim().replaceAll("\\", "/").replace(/^\.\//u, "");
    if (!normalizedFile || normalizedFile.startsWith("/") || normalizedFile.split("/").includes("..")) {
      continue;
    }
    normalizedFiles.push(normalizedFile);
  }
  return [...new Set(normalizedFiles)].sort();
}
