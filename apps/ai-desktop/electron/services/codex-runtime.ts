import { constants, createReadStream, createWriteStream, existsSync, realpathSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { get } from "node:https";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { extract } from "tar";

export const CODEX_TARGET_VERSION = "0.149.0";

const OPENAI_MAC_TEAM_ID = "2DC432GLL2";
const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;

interface PlatformRuntimeManifest {
  packageName: string;
  packageVersion: string;
  executableRelativePath: string;
  archiveUrl: string;
  archiveIntegrity: string;
}

const PLATFORM_RUNTIME_MANIFESTS: Record<string, PlatformRuntimeManifest> = {
  "darwin-arm64": runtimeManifest("darwin-arm64", "vendor/aarch64-apple-darwin/bin/codex", "GsZJbzBWiD48RETrO8VHGAQNgfSrUVxItXZFeD87wswatPi0+lKuQo8Dx4nMYmOZhZrVtwr3al/feRrZxnDV8Q=="),
  "darwin-x64": runtimeManifest("darwin-x64", "vendor/x86_64-apple-darwin/bin/codex", "H+mMgW3Nhc5QzGWEklCoFqACuOc0cVpgPkPQRw0LShoK7P5664T6BRnyl1yzT6orKPKv49cXry7DIWWZ19SanQ=="),
  "linux-arm64": runtimeManifest("linux-arm64", "vendor/aarch64-unknown-linux-musl/bin/codex", "fAXPpvIob+11RNZJS9CVVTsKb+V4Hw3woGFPj42D7fU2wBJUKI2jfAc4fLJNtrpwRecLeW601mtkMHOSIbWuuA=="),
  "linux-x64": runtimeManifest("linux-x64", "vendor/x86_64-unknown-linux-musl/bin/codex", "uZXaN9JPxu0/jjnqqJeTd4kRYPnjVZK3MiVndfG1mHhEaoDKL7ScWHfPqvAEOjwsSDEmQSlMfUkmvYp/CHciYw=="),
  "win32-arm64": runtimeManifest("win32-arm64", "vendor/aarch64-pc-windows-msvc/bin/codex.exe", "pUd8MzuwtqT5DhM1NUE1gETWIZ9fkDA1XB7tt9YNIi/peUgLuziQgZd7o0bNON4cNzgbil1YUN1qDTgQm0g3pg=="),
  "win32-x64": runtimeManifest("win32-x64", "vendor/x86_64-pc-windows-msvc/bin/codex.exe", "qKbwSOOO/fdhQ5MlXE2fts6taPxRPZ/zqeC+eqHD72hLRymV9rFCUbUxOCquognUPRPvS/2/kRCV0UVhoDd3yQ=="),
};

export interface CodexRuntime {
  source: "bundled" | "downloaded";
  command: string;
  argsPrefix: string[];
  version: string;
  electronRunAsNode: false;
}

/** 只使用应用指定的 Codex 版本：安装包内置副本优先，缺失或损坏时下载同版本私有副本。 */
export async function resolveCodexRuntime(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<CodexRuntime> {
  const manifest = currentPlatformManifest();
  const bundledPath = resolveBundledExecutable(manifest);
  if (bundledPath) {
    try {
      return await validateRuntime("bundled", bundledPath, manifest, environment);
    } catch {
      // 内置文件不完整或被篡改时，只允许进入指定版本修复流程。
    }
  }

  const codexHome = environment.CODEX_HOME?.trim();
  if (!codexHome || !path.isAbsolute(codexHome)) {
    throw new Error(`内置 Codex ${CODEX_TARGET_VERSION} 不可用，且缺少私有修复目录；请重新安装 AI Desktop。`);
  }
  const recoveryRoot = path.join(path.dirname(codexHome), "codex-runtime", CODEX_TARGET_VERSION, `${process.platform}-${process.arch}`);
  const recoveredPath = path.join(recoveryRoot, manifest.executableRelativePath);
  if (await isExecutable(recoveredPath)) {
    try {
      return await validateRuntime("downloaded", recoveredPath, manifest, environment);
    } catch {
      // 无效私有副本由原子修复流程隔离，避免并发进程误删刚安装好的有效副本。
    }
  }

  try {
    await installVerifiedRuntime(recoveryRoot, manifest, environment);
    return await validateRuntime("downloaded", recoveredPath, manifest, environment);
  } catch (error) {
    throw new Error(
      `固定 Codex ${CODEX_TARGET_VERSION} 缺失且无法完成安全修复。请联网重试或重新安装 AI Desktop。${error instanceof Error ? ` 原因：${error.message}` : ""}`,
    );
  }
}

function runtimeManifest(platformSuffix: string, executableRelativePath: string, sha512: string): PlatformRuntimeManifest {
  return {
    packageName: `@openai/codex-${platformSuffix}`,
    packageVersion: `${CODEX_TARGET_VERSION}-${platformSuffix}`,
    executableRelativePath,
    archiveUrl: `https://registry.npmjs.org/@openai/codex/-/codex-${CODEX_TARGET_VERSION}-${platformSuffix}.tgz`,
    archiveIntegrity: `sha512-${sha512}`,
  };
}

function currentPlatformManifest(): PlatformRuntimeManifest {
  const key = `${process.platform}-${process.arch}`;
  const manifest = PLATFORM_RUNTIME_MANIFESTS[key];
  if (!manifest) throw new Error(`AI Desktop 不支持当前平台的固定 Codex 运行时：${key}`);
  return manifest;
}

function resolveBundledExecutable(manifest: PlatformRuntimeManifest): string | null {
  try {
    const require = createRequire(import.meta.url);
    const packageJsonPath = require.resolve(`${manifest.packageName}/package.json`);
    const packageRoot = path.dirname(toAsarUnpackedPath(packageJsonPath));
    return path.join(packageRoot, manifest.executableRelativePath);
  } catch {
    return null;
  }
}

function toAsarUnpackedPath(filePath: string): string {
  return filePath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
}

async function validateRuntime(
  source: CodexRuntime["source"],
  executablePath: string,
  manifest: PlatformRuntimeManifest,
  environment: NodeJS.ProcessEnv,
): Promise<CodexRuntime> {
  if (!await isExecutable(executablePath)) throw new Error("Codex 原生程序不存在或不可执行。");
  await validatePackageMetadata(executablePath, manifest);
  if (process.platform === "darwin") await validateMacSignature(executablePath);
  const version = await readCodexVersion(executablePath, environment);
  if (version !== CODEX_TARGET_VERSION) {
    throw new Error(`Codex 版本不一致：需要 ${CODEX_TARGET_VERSION}，实际 ${version}。`);
  }
  const command = realpathSync(executablePath);
  return { source, command, argsPrefix: [], version, electronRunAsNode: false };
}

async function validatePackageMetadata(executablePath: string, manifest: PlatformRuntimeManifest): Promise<void> {
  const packageRoot = executablePath.slice(0, -manifest.executableRelativePath.length).replace(/[\\/]$/, "");
  const metadata = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")) as {
    version?: unknown;
    os?: unknown;
    cpu?: unknown;
  };
  if (metadata.version !== manifest.packageVersion) throw new Error("Codex 平台包版本校验失败。");
  if (!Array.isArray(metadata.os) || !metadata.os.includes(process.platform)) throw new Error("Codex 平台包操作系统校验失败。");
  if (!Array.isArray(metadata.cpu) || !metadata.cpu.includes(process.arch)) throw new Error("Codex 平台包架构校验失败。");
}

async function validateMacSignature(executablePath: string): Promise<void> {
  await executeFile("/usr/bin/codesign", ["--verify", "--strict", executablePath]);
  const details = await executeFile("/usr/bin/codesign", ["-dv", "--verbose=4", executablePath]);
  if (!details.includes(`TeamIdentifier=${OPENAI_MAC_TEAM_ID}`)) {
    throw new Error("Codex macOS 签名并非 OpenAI 官方团队。");
  }
}

async function installVerifiedRuntime(
  recoveryRoot: string,
  manifest: PlatformRuntimeManifest,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const recoveryParent = path.dirname(recoveryRoot);
  await mkdir(recoveryParent, { recursive: true });
  const workRoot = await mkdtemp(path.join(recoveryParent, ".install-"));
  const archivePath = path.join(workRoot, "runtime.tgz");
  const extractedRoot = path.join(workRoot, "package");
  try {
    await downloadArchive(manifest.archiveUrl, archivePath);
    await verifyArchiveIntegrity(archivePath, manifest.archiveIntegrity);
    await mkdir(extractedRoot, { recursive: true });
    await extract({ file: archivePath, cwd: extractedRoot, strip: 1, strict: true, preservePaths: false });
    await validateRuntime("downloaded", path.join(extractedRoot, manifest.executableRelativePath), manifest, environment);
    await promoteVerifiedRuntime(extractedRoot, recoveryRoot, manifest, environment);
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
}

async function promoteVerifiedRuntime(
  extractedRoot: string,
  recoveryRoot: string,
  manifest: PlatformRuntimeManifest,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  try {
    await rename(extractedRoot, recoveryRoot);
    return;
  } catch (error) {
    if (!isExistingTargetError(error)) throw error;
  }

  const existingExecutable = path.join(recoveryRoot, manifest.executableRelativePath);
  try {
    await validateRuntime("downloaded", existingExecutable, manifest, environment);
    return;
  } catch {
    const quarantinedRoot = `${recoveryRoot}.invalid-${process.pid}-${Date.now()}`;
    await rename(recoveryRoot, quarantinedRoot);
    try {
      await rename(extractedRoot, recoveryRoot);
    } catch (error) {
      if (!isExistingTargetError(error)) throw error;
      await validateRuntime("downloaded", existingExecutable, manifest, environment);
    } finally {
      await rm(quarantinedRoot, { recursive: true, force: true });
    }
  }
}

function isExistingTargetError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === "EEXIST" || code === "ENOTEMPTY";
}

async function downloadArchive(urlText: string, destination: string, redirects = 0): Promise<void> {
  const url = new URL(urlText);
  if (url.protocol !== "https:" || url.hostname !== "registry.npmjs.org") throw new Error("Codex 下载地址不受信任。");
  if (redirects > 3) throw new Error("Codex 下载重定向次数过多。");
  await new Promise<void>((resolve, reject) => {
    const request = get(url, { timeout: DOWNLOAD_TIMEOUT_MS }, async (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        try {
          await downloadArchive(new URL(response.headers.location, url).toString(), destination, redirects + 1);
          resolve();
        } catch (error) {
          reject(error);
        }
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new Error(`Codex 下载失败（HTTP ${status}）。`));
        return;
      }
      const declaredSize = Number(response.headers["content-length"] ?? 0);
      if (declaredSize > MAX_ARCHIVE_BYTES) {
        response.resume();
        reject(new Error("Codex 下载文件超过安全大小限制。"));
        return;
      }
      let received = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          received += chunk.length;
          callback(received <= MAX_ARCHIVE_BYTES ? null : new Error("Codex 下载文件超过安全大小限制。"), chunk);
        },
      });
      try {
        await pipeline(response, limiter, createWriteStream(destination, { mode: 0o600 }));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    request.once("timeout", () => request.destroy(new Error("Codex 下载超时。")));
    request.once("error", reject);
  });
}

async function verifyArchiveIntegrity(archivePath: string, expectedIntegrity: string): Promise<void> {
  const hash = createHash("sha512");
  await pipeline(createReadStream(archivePath), hash);
  const actualIntegrity = `sha512-${hash.digest("base64")}`;
  if (actualIntegrity !== expectedIntegrity) throw new Error("Codex 下载文件完整性校验失败。");
}

async function isExecutable(filePath: string): Promise<boolean> {
  if (!existsSync(filePath)) return false;
  try {
    await access(filePath, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function executeFile(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 5_000 }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(`${stdout}${stderr}`);
    });
  });
}

function readCodexVersion(command: string, environment: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const childEnvironment = { ...environment };
    delete childEnvironment.ELECTRON_RUN_AS_NODE;
    const child = spawn(command, ["--version"], {
      env: childEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });
    let output = "";
    const timeout = setTimeout(() => child.kill(), 4_000);
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      const version = output.match(/codex-cli\s+([^\s]+)/i)?.[1];
      if (code === 0 && version) resolve(version);
      else reject(new Error(`无法读取固定 Codex 版本：${command}`));
    });
  });
}
