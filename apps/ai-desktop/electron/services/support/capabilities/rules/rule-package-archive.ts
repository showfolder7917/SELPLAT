/** 无源码模式规则包生成器：只归档当前用户规则、入口和索引，不触碰其他规则层。 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { RuleWorkspaceDescriptor } from "./rule-workspace.facade.js";

export interface RuleRevisionDescriptor { activeUserId: string; ruleRevision: string; }
interface ArchiveState { lastPackagedRevision: string; }
interface ZipEntry { name: string; content: Buffer; }

export class RulePackageArchiveFacade {
  readonly #workspace: RuleWorkspaceDescriptor;
  constructor(workspace: RuleWorkspaceDescriptor) { this.#workspace = workspace; }

  recordRevision(revision: RuleRevisionDescriptor): string | null {
    if (this.#workspace.mode !== "local") return null;
    const statePath = path.join(this.#workspace.workspaceRoot, "state.json");
    const previous = readState(statePath)?.lastPackagedRevision || null;
    if (!previous) { writeState(statePath, revision.ruleRevision); return null; }
    if (previous === revision.ruleRevision) return null;
    const zip = createStoredZip(this.#collectEntries(revision));
    const outbox = path.join(this.#workspace.workspaceRoot, "upload-outbox");
    mkdirSync(outbox, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
    const packagePath = path.join(outbox, `${stamp}-${revision.ruleRevision.slice(0, 12)}.zip`);
    writeFileSync(packagePath, zip);
    writeFileSync(`${packagePath}.json`, `${JSON.stringify({ stableUserId: revision.activeUserId, ruleRevision: revision.ruleRevision, previousRevision: previous, createdAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
    writeState(statePath, revision.ruleRevision);
    return packagePath;
  }

  #collectEntries(revision: RuleRevisionDescriptor): ZipEntry[] {
    const sources: Array<[string, string]> = [
      ["AGENTS.md", this.#workspace.agentsPath],
      ["rules/RULE_INDEX.md", path.join(this.#workspace.ruleRoot, "RULE_INDEX.md")],
    ];
    const userRoot = path.join(this.#workspace.ruleRoot, "local", revision.activeUserId);
    for (const file of walkFiles(userRoot)) {
      const relative = path.relative(userRoot, file).replaceAll(path.sep, "/");
      if (relative.split("/").some((part) => ["会话", "history", "template"].includes(part))) continue;
      sources.push([`rules/local/${revision.activeUserId}/${relative}`, file]);
    }
    const files = sources.map(([name, file]) => ({ name, sha256: sha256(readFileSync(file)), size: statSync(file).size }));
    const manifest = Buffer.from(`${JSON.stringify({ formatVersion: 1, activeUserId: revision.activeUserId, ruleRevision: revision.ruleRevision, createdAt: new Date().toISOString(), files }, null, 2)}\n`, "utf8");
    return [{ name: "rule-package.json", content: manifest }, ...sources.map(([name, file]) => ({ name, content: readFileSync(file) }))];
  }
}

function readState(statePath: string): ArchiveState | null {
  if (!existsSync(statePath)) return null;
  try { return JSON.parse(readFileSync(statePath, "utf8")) as ArchiveState; } catch { return null; }
}
function writeState(statePath: string, revision: string): void { writeFileSync(statePath, `${JSON.stringify({ lastPackagedRevision: revision }, null, 2)}\n`, "utf8"); }
function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) return walkFiles(candidate);
    return entry.isFile() ? [candidate] : [];
  }).sort();
}
function sha256(value: Buffer): string { return createHash("sha256").update(value).digest("hex"); }

/** 仅使用 ZIP STORE，避免运行时引入第三方压缩依赖；生成物可被标准 ZIP 工具读取。 */
function createStoredZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = []; const centrals: Buffer[] = []; let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replaceAll("\\", "/"), "utf8"); const crc = crc32(entry.content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.content.length, 18); local.writeUInt32LE(entry.content.length, 22); local.writeUInt16LE(name.length, 26);
    locals.push(local, name, entry.content);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(entry.content.length, 20); central.writeUInt32LE(entry.content.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); centrals.push(central, name);
    offset += local.length + name.length + entry.content.length;
  }
  const centralSize = centrals.reduce((sum, value) => sum + value.length, 0); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
function crc32(value: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of value) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
