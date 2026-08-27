import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { CollaborationTask } from "../../../contracts/collaboration/collaboration.js";
import type { ReleaseBatchDocument } from "../../../contracts/collaboration/integration-release.js";

/** 发布批次文档由发布协调器单点维护，运行中可追踪，结束后进入长期发布归档。 */
export class ReleaseBatchStore {
  readonly #runningRoot: string;
  readonly #archiveRoot: string;

  constructor(runningRoot: string, archiveLogRoot: string) {
    this.#runningRoot = path.resolve(runningRoot);
    this.#archiveRoot = path.join(path.resolve(archiveLogRoot), "发布归档");
  }

  create(releaseBatchId: string, version: string, generation: number, tasks: CollaborationTask[], initiatorMemberId: string): ReleaseBatchDocument {
    const document: ReleaseBatchDocument = {
      releaseBatchId, version, generation, state: "frozen", initiatorMemberId,
      candidateBranch: null, candidateSha: null, localMergeSha: null, executable: null,
      tasks: tasks.map((task) => ({ taskId: task.taskId, title: task.snapshot.title, branchName: task.versionWorkspace?.branchName || null, resultSha: task.versionWorkspace?.resultSha || null })),
      startedAt: new Date().toISOString(), completedAt: null, failureReason: null,
    };
    this.write(document);
    return document;
  }

  write(document: ReleaseBatchDocument): void {
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
}
