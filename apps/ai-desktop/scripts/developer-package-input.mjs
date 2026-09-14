import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, statfsSync } from "node:fs";
import path from "node:path";

// 只有当前进程实际创建的目录才有清理资格，调用者不能提供任意删除路径。
const ownedInputs = new Set();
const skippedDependencyEntries = new Set([".bin", ".package-lock.json"]);
const packageInputHeadroomBytes = 64 * 1024 * 1024;

/** 逐层拒绝输出父目录链接，防止构建缓存中的链接把复制或清理引到工程外。 */
function prepareInputParent(projectRoot) {
  let directory = realpathSync(projectRoot);
  for (const segment of ["build", "ai-desktop", "package-input"]) {
    directory = path.join(directory, segment);
    if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) {
      throw new Error(`Developer package input parent is a symbolic link: ${directory}`);
    }
    mkdirSync(directory, { recursive: true });
  }
  return directory;
}

/**
 * 将开发包实际需要的应用元数据和依赖实体化到候选工作树内。
 * 共享依赖缓存仍由租约管理；此输入目录只供一次 electron-builder 调用消费。
 */
export function prepareDeveloperPackageInput({ applicationRoot, projectRoot }) {
  const resolvedApplicationRoot = path.resolve(applicationRoot);
  const resolvedProjectRoot = path.resolve(projectRoot);
  const sourceModules = path.join(resolvedApplicationRoot, "node_modules");
  const packageManifest = path.join(resolvedApplicationRoot, "package.json");

  if (realpathSync(resolvedApplicationRoot) !== path.join(realpathSync(resolvedProjectRoot), "apps", "ai-desktop")) {
    throw new Error("Developer package application must belong to the candidate project.");
  }
  if (!existsSync(packageManifest) || !existsSync(sourceModules)) {
    throw new Error("Developer package input requires the application package.json and managed node_modules.");
  }

  const resolvedPackageInputRoot = mkdtempSync(path.join(prepareInputParent(resolvedProjectRoot), "developer-"));
  ownedInputs.add(resolvedPackageInputRoot);
  try {
    cpSync(packageManifest, path.join(resolvedPackageInputRoot, "package.json"));
    // ASAR 会解析符号链接的真实路径；打包输入必须在候选工作树内包含实体文件。
    const packageModules = path.join(resolvedPackageInputRoot, "node_modules");
    materializeDependencyTree(sourceModules, packageModules);
    assertPackageInputLinksStayInside(resolvedPackageInputRoot);
    return resolvedPackageInputRoot;
  } catch (error) {
    cleanupDeveloperPackageInput({ projectRoot: resolvedProjectRoot, packageInputRoot: resolvedPackageInputRoot });
    throw error;
  }
}

/**
 * 依据与实体化相同的链接解析和跳过规则，预估本轮临时依赖输入实际占用的空间。
 * 此检查不创建输出目录，确保容量不足时不会留下半成品供后续打包误用。
 */
export function estimateDeveloperPackageInputCapacity({ applicationRoot, storageBlockSize = 4096 }) {
  const resolvedApplicationRoot = path.resolve(applicationRoot);
  const sourceModules = path.join(resolvedApplicationRoot, "node_modules");
  const packageManifest = path.join(resolvedApplicationRoot, "package.json");
  if (!existsSync(packageManifest) || !existsSync(sourceModules)) {
    throw new Error("Developer package capacity estimate requires the application package.json and managed node_modules.");
  }
  if (!Number.isSafeInteger(storageBlockSize) || storageBlockSize <= 0) {
    throw new Error("Developer package capacity estimate requires a positive filesystem block size.");
  }

  let fileBytes = reserveFileBlocks(lstatSync(packageManifest).size, storageBlockSize);
  let directoryCount = 0;
  measureDependencyTree(sourceModules, storageBlockSize, (entry) => {
    if (entry.kind === "file") fileBytes += reserveFileBlocks(entry.size, storageBlockSize);
    else directoryCount += 1;
  });
  const directoryBytes = directoryCount * storageBlockSize;
  return {
    fileBytes,
    directoryBytes,
    headroomBytes: packageInputHeadroomBytes,
    requiredBytes: fileBytes + directoryBytes + packageInputHeadroomBytes,
  };
}

/**
 * 在复制前由候选卷的可用块数拒绝无法完成的打包输入，避免底层 cpSync 产生不完整输入。
 */
export function assertDeveloperPackageInputCapacity({ applicationRoot, projectRoot, getStorageStats = statfsSync }) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const storage = getStorageStats(resolvedProjectRoot);
  const storageBlockSize = Number(storage.bsize);
  const availableBlocks = Number(storage.bavail);
  if (!Number.isSafeInteger(storageBlockSize) || storageBlockSize <= 0 || !Number.isSafeInteger(availableBlocks) || availableBlocks < 0) {
    throw new Error("Developer package capacity check requires filesystem block size and available block count.");
  }

  const estimate = estimateDeveloperPackageInputCapacity({ applicationRoot, storageBlockSize });
  const availableBytes = storageBlockSize * availableBlocks;
  if (availableBytes >= estimate.requiredBytes) return { ...estimate, availableBytes };

  const error = new Error(
    `Developer package input requires ${estimate.requiredBytes} bytes but only ${availableBytes} bytes are available on the candidate volume.`,
  );
  error.code = "ENOSPC";
  error.capacity = { ...estimate, availableBytes };
  throw error;
}

/** 将依赖覆盖层中的目录或文件链接递归写为当前候选输入内的实体，循环链接必须显式失败。 */
function materializeDependencyTree(sourcePath, destinationPath, ancestorDirectories = new Set()) {
  const sourceStats = lstatSync(sourcePath);
  const resolvedSourcePath = sourceStats.isSymbolicLink() ? realpathSync(sourcePath) : sourcePath;
  const resolvedStats = lstatSync(resolvedSourcePath);
  if (!resolvedStats.isDirectory()) {
    cpSync(resolvedSourcePath, destinationPath, { dereference: true });
    return;
  }

  const resolvedDirectory = realpathSync(resolvedSourcePath);
  if (ancestorDirectories.has(resolvedDirectory)) {
    throw new Error(`Developer package input contains a cyclic dependency link: ${sourcePath}`);
  }
  const nextAncestors = new Set(ancestorDirectories);
  nextAncestors.add(resolvedDirectory);
  mkdirSync(destinationPath, { recursive: true });
  for (const entry of readdirSync(resolvedSourcePath)) {
    // 安装期命令链接和锁文件不进入运行包，复制前跳过，避免无用或损坏链接导致失败。
    if (skippedDependencyEntries.has(entry)) continue;
    materializeDependencyTree(path.join(resolvedSourcePath, entry), path.join(destinationPath, entry), nextAncestors);
  }
}

/** 仅测量实体化时会写入候选目录的依赖项，循环链接与实际复制保持相同的失败语义。 */
function measureDependencyTree(sourcePath, storageBlockSize, recordEntry, ancestorDirectories = new Set()) {
  const sourceStats = lstatSync(sourcePath);
  const resolvedSourcePath = sourceStats.isSymbolicLink() ? realpathSync(sourcePath) : sourcePath;
  const resolvedStats = lstatSync(resolvedSourcePath);
  if (!resolvedStats.isDirectory()) {
    recordEntry({ kind: "file", size: resolvedStats.size });
    return;
  }

  const resolvedDirectory = realpathSync(resolvedSourcePath);
  if (ancestorDirectories.has(resolvedDirectory)) {
    throw new Error(`Developer package input contains a cyclic dependency link: ${sourcePath}`);
  }
  recordEntry({ kind: "directory" });
  const nextAncestors = new Set(ancestorDirectories);
  nextAncestors.add(resolvedDirectory);
  for (const entry of readdirSync(resolvedSourcePath)) {
    if (skippedDependencyEntries.has(entry)) continue;
    measureDependencyTree(path.join(resolvedSourcePath, entry), storageBlockSize, recordEntry, nextAncestors);
  }
}

function reserveFileBlocks(size, storageBlockSize) {
  return Math.ceil(size / storageBlockSize) * storageBlockSize;
}

/**
 * 实体化后只允许真实目标仍在输入内的链接，阻止 ASAR 跟随共享缓存或其他工作树。
 */
export function assertPackageInputLinksStayInside(directory, packageInputRoot = directory) {
  const resolvedPackageInputRoot = path.resolve(packageInputRoot);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    const stats = lstatSync(entryPath);
    if (stats.isSymbolicLink()) {
      const linkTarget = realpathSync(entryPath);
      const relativeTarget = path.relative(resolvedPackageInputRoot, linkTarget);
      if (relativeTarget === ".." || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
        throw new Error(`Developer package input link escaped its root: ${entryPath}`);
      }
      continue;
    }
    if (stats.isDirectory()) assertPackageInputLinksStayInside(entryPath, resolvedPackageInputRoot);
  }
}

/** 仅清理由本次打包准备步骤创建、且仍位于候选工作树内的输入目录。 */
export function cleanupDeveloperPackageInput({ projectRoot, packageInputRoot }) {
  if (!ownedInputs.has(packageInputRoot)) throw new Error("Developer package input is not owned by this packaging run.");
  const parent = prepareInputParent(projectRoot);
  if (path.dirname(packageInputRoot) !== parent || lstatSync(packageInputRoot).isSymbolicLink()) {
    throw new Error("Developer package input ownership changed before cleanup.");
  }
  rmSync(packageInputRoot, { recursive: true, force: true });
  ownedInputs.delete(packageInputRoot);
}
