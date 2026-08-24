import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ScreenshotAttachment,
  ScreenshotSaveRequest,
  TempDirectoryInfo,
} from "../../contracts/desktop.js";

interface ScreenshotIndexRecord extends ScreenshotAttachment {
  relativePath: string;
}

interface ScreenshotIndex {
  version: 1;
  items: Record<string, ScreenshotIndexRecord>;
}

const EMPTY_INDEX: ScreenshotIndex = { version: 1, items: {} };
const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
const MAX_PNG_BYTES = 25 * 1024 * 1024;
const SCREENSHOT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 把截图数据限制在调用方经公共路径能力解析的“临时材料/截图”，渲染层只能使用主进程签发的附件 ID。 */
export class ScreenshotStore {
  readonly #tempRoot: string;
  readonly #indexPath: string;

  constructor(tempEvidenceRoot: string) {
    this.#tempRoot = path.resolve(tempEvidenceRoot);
    this.#indexPath = path.join(this.#tempRoot, "screenshot-index.json");
  }

  get path(): string {
    return this.#tempRoot;
  }

  async ensure(): Promise<string> {
    await mkdir(this.#tempRoot, { recursive: true });
    return this.#tempRoot;
  }

  async save(request: ScreenshotSaveRequest): Promise<ScreenshotAttachment> {
    const original = decodePng(request?.originalDataUrl, "original screenshot");
    const annotated = decodePng(request?.annotatedDataUrl, "annotated screenshot");
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const day = createdAt.slice(0, 10);
    const relativeDirectory = path.join(day, id);
    const directory = this.#resolveInsideTemp(relativeDirectory);
    const originalPath = path.join(directory, "original.png");
    const annotatedPath = path.join(directory, "annotated.png");
    const metadataPath = path.join(directory, "metadata.json");
    const relativePath = path.relative(this.#tempRoot, annotatedPath);
    const attachment: ScreenshotIndexRecord = {
      id,
      name: `screenshot-${createdAt.replaceAll(":", "-")}.png`,
      filePath: annotatedPath,
      sizeBytes: annotated.byteLength,
      createdAt,
      relativePath,
    };

    // 原图和标注图在同一任务目录落盘，便于用户一次性查看或清理。
    await mkdir(directory, { recursive: true });
    await Promise.all([
      writeFile(originalPath, original),
      writeFile(annotatedPath, annotated),
      writeFile(metadataPath, `${JSON.stringify({ ...attachment, originalPath, hasAnnotations: request.hasAnnotations === true }, null, 2)}\n`, "utf8"),
    ]);
    const index = await this.#readIndex();
    index.items[id] = attachment;
    await writeFile(this.#indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
    return publicAttachment(attachment);
  }

  async resolveAttachmentPaths(ids: string[]): Promise<string[]> {
    if (!Array.isArray(ids) || ids.length > 5 || new Set(ids).size !== ids.length) {
      throw new Error("Screenshot attachments must contain at most five unique IDs.");
    }
    const index = await this.#readIndex();
    const paths: string[] = [];
    for (const id of ids) {
      if (!SCREENSHOT_ID_PATTERN.test(id)) throw new Error("Invalid screenshot attachment ID.");
      const record = index.items[id];
      if (!record) throw new Error("Screenshot attachment is no longer available.");
      const filePath = this.#resolveInsideTemp(record.relativePath);
      await access(filePath);
      paths.push(filePath);
    }
    return paths;
  }

  async info(): Promise<TempDirectoryInfo> {
    await this.ensure();
    const totals = await directoryTotals(this.#tempRoot);
    return { path: this.#tempRoot, ...totals };
  }

  async clear(): Promise<TempDirectoryInfo> {
    // 只删除构造器固定生成的应用 temp 根，再立即恢复空目录供后续截图使用。
    await rm(this.#tempRoot, { recursive: true, force: true });
    await mkdir(this.#tempRoot, { recursive: true });
    return { path: this.#tempRoot, fileCount: 0, totalBytes: 0 };
  }

  async #readIndex(): Promise<ScreenshotIndex> {
    await this.ensure();
    try {
      const parsed = JSON.parse(await readFile(this.#indexPath, "utf8")) as Partial<ScreenshotIndex>;
      if (parsed.version !== 1 || !parsed.items || typeof parsed.items !== "object") return structuredClone(EMPTY_INDEX);
      return { version: 1, items: parsed.items };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_INDEX);
      throw error;
    }
  }

  #resolveInsideTemp(relativePath: string): string {
    const resolved = path.resolve(this.#tempRoot, relativePath);
    if (resolved !== this.#tempRoot && !resolved.startsWith(`${this.#tempRoot}${path.sep}`)) {
      throw new Error("Screenshot path escaped the AI Desktop temp directory.");
    }
    return resolved;
  }
}

function decodePng(dataUrl: unknown, label: string): Buffer {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new Error(`Invalid ${label} PNG data.`);
  }
  const encoded = dataUrl.slice(PNG_DATA_URL_PREFIX.length);
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error(`Invalid ${label} PNG data.`);
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_PNG_BYTES) throw new Error(`${label} exceeds the 25 MB limit.`);
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error(`Invalid ${label} PNG signature.`);
  }
  return buffer;
}

function publicAttachment(record: ScreenshotIndexRecord): ScreenshotAttachment {
  const { relativePath: _relativePath, ...attachment } = record;
  return attachment;
}

async function directoryTotals(directory: string): Promise<{ fileCount: number; totalBytes: number }> {
  let fileCount = 0;
  let totalBytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const child = await directoryTotals(entryPath);
      fileCount += child.fileCount;
      totalBytes += child.totalBytes;
    } else if (entry.isFile()) {
      fileCount += 1;
      totalBytes += (await stat(entryPath)).size;
    }
  }
  return { fileCount, totalBytes };
}
