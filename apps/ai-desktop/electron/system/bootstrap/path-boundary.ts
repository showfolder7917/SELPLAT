import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

/**
 * 路径边界判断统一使用真实父目录。
 * macOS 的 /tmp 指向 /private/tmp；候选文件尚未创建时，从最近的已存在父目录解析符号链接。
 */
export function resolveBoundaryPath(candidate: string): string {
  const absolute = path.resolve(candidate);
  let existing = absolute;
  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return absolute;
    existing = parent;
  }
  const realExisting = realpathSync.native(existing);
  return path.resolve(realExisting, path.relative(existing, absolute));
}

export function isDescendantOrSame(root: string, candidate: string): boolean {
  const canonicalRoot = resolveBoundaryPath(root);
  const canonicalCandidate = resolveBoundaryPath(candidate);
  const relative = path.relative(canonicalRoot, canonicalCandidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
