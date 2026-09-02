/** 无源码规则包上传端口；具体 HTTP 服务可以在不修改业务层的情况下替换。 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface RulePackageUploadRequest {
  packagePath: string;
  packageSha256: string;
  stableUserId: string;
  ruleRevision: string;
  previousRevision: string | null;
  createdAt: string;
}

export interface RulePackageUploadReceipt { uploadId: string; acceptedRevision: string; }
export interface RulePackageUploader { upload(request: RulePackageUploadRequest): Promise<RulePackageUploadReceipt>; }

/** 未配置服务时不发送网络请求，本地 outbox 和规则加载保持可用。 */
export class DisabledRulePackageUploader implements RulePackageUploader {
  async upload(): Promise<RulePackageUploadReceipt> { throw new Error("规则包上传服务尚未配置。"); }
}

export interface RulePackageUploadCoordinatorOptions {
  ruleWorkspaceRoot: string;
  uploader: RulePackageUploader;
  recordEvent(type: string, details: Record<string, unknown>): void;
}

/** 每个应用进程最多尝试一次最新 ZIP；失败留在 outbox 等待下次启动。 */
export class RulePackageUploadCoordinator {
  readonly #options: RulePackageUploadCoordinatorOptions;
  #attempted = false;
  constructor(options: RulePackageUploadCoordinatorOptions) { this.#options = options; }

  async uploadLatestPendingOnce(): Promise<void> {
    if (this.#attempted) return;
    this.#attempted = true;
    const outbox = path.join(this.#options.ruleWorkspaceRoot, "upload-outbox");
    if (!existsSync(outbox)) return;
    const latest = readdirSync(outbox, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".zip"))
      .map((entry) => path.join(outbox, entry.name)).sort().at(-1);
    if (!latest) return;
    const buffer = readFileSync(latest);
    const metadataPath = `${latest}.json`;
    const metadata = existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, "utf8")) as Partial<RulePackageUploadRequest> : {};
    const request: RulePackageUploadRequest = {
      packagePath: latest,
      packageSha256: createHash("sha256").update(buffer).digest("hex"),
      stableUserId: String(metadata.stableUserId || ""),
      ruleRevision: String(metadata.ruleRevision || ""),
      previousRevision: typeof metadata.previousRevision === "string" ? metadata.previousRevision : null,
      createdAt: String(metadata.createdAt || new Date().toISOString()),
    };
    const history = path.join(this.#options.ruleWorkspaceRoot, "upload-history");
    const hashesPath = path.join(history, "uploaded-hashes.json");
    const uploadedHashes = readUploadedHashes(hashesPath);
    if (uploadedHashes.includes(request.packageSha256)) {
      archivePackage(latest, metadataPath, history);
      this.#options.recordEvent("rule_package.duplicate_archived", { packageSha256: request.packageSha256, ruleRevision: request.ruleRevision });
      return;
    }
    try {
      const receipt = await this.#options.uploader.upload(request);
      const archived = archivePackage(latest, metadataPath, history);
      writeFileSync(`${archived}.receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
      writeFileSync(hashesPath, `${JSON.stringify([...uploadedHashes, request.packageSha256], null, 2)}\n`, "utf8");
      this.#options.recordEvent("rule_package.uploaded", { packageSha256: request.packageSha256, ruleRevision: request.ruleRevision, uploadId: receipt.uploadId });
    } catch (error) {
      this.#options.recordEvent("rule_package.upload_deferred", { packageSha256: request.packageSha256, ruleRevision: request.ruleRevision, reason: error instanceof Error ? error.message : String(error) });
    }
  }
}

function readUploadedHashes(file: string): string[] {
  if (!existsSync(file)) return [];
  try {
    const value = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

function archivePackage(packagePath: string, metadataPath: string, history: string): string {
  mkdirSync(history, { recursive: true });
  const archived = path.join(history, path.basename(packagePath));
  renameSync(packagePath, archived);
  if (existsSync(metadataPath)) renameSync(metadataPath, `${archived}.json`);
  return archived;
}
