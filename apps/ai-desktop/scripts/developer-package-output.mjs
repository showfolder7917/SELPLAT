import path from "node:path";

/** 只允许开发版包写入所选工作区的 package 子目录。 */
export function resolveDeveloperPackageOutputRoot(buildRoot) {
  const packageArea = path.join(path.resolve(buildRoot), "package");
  const defaultRoot = path.join(packageArea, "developer");
  const selectedRoot = process.env.AI_DESKTOP_PACKAGE_OUTPUT_ROOT
    ? path.resolve(process.env.AI_DESKTOP_PACKAGE_OUTPUT_ROOT)
    : defaultRoot;
  if (selectedRoot !== defaultRoot && !selectedRoot.startsWith(`${packageArea}${path.sep}`)) {
    throw new Error(`Developer package output escaped the selected build root: ${selectedRoot}`);
  }
  return selectedRoot;
}
