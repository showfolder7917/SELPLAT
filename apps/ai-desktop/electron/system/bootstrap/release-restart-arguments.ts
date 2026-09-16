/** 发布重启只替换版本与工程定位，保留当前实例隔离身份；不继承一次性健康检查。 */
export function releaseRestartArguments(projectRoot: string, runtimeSourceSha: string, currentArguments: readonly string[], resumeReleaseBatchId: string | null = null): string[] {
  const preservedPrefixes = [
    "--ai-desktop-user-data-dir=",
  ];
  const preserved = currentArguments.filter((argument) => preservedPrefixes.some((prefix) => argument.startsWith(prefix)));
  return [`--selplat-root=${projectRoot}`, "--ai-desktop-variant=developer", `--ai-desktop-runtime-sha=${runtimeSourceSha}`, ...(resumeReleaseBatchId ? [`--ai-desktop-resume-release=${resumeReleaseBatchId}`] : []), ...preserved];
}
