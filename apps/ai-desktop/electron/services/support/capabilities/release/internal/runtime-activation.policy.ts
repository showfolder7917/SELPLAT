/** 候选修改这些预检职责时，必须由候选运行包重新承载统一测试。 */
const RUNTIME_ACTIVATION_PATHS = new Set([
  "apps/ai-desktop/electron/services/support/capabilities/testing/internal/fixed-unified-test.runner.ts",
  "apps/ai-desktop/electron/services/support/capabilities/release/internal/integration.verifier.ts",
  "apps/ai-desktop/electron/services/support/capabilities/release/internal/acceptance-plan-candidate-source.ts",
  "apps/ai-desktop/electron/services/support/capabilities/release/internal/version-integration.pipeline.ts",
]);

/** 只有候选修改预检职责且当前运行包不是该候选时，才要求受控激活。 */
export function requiresRuntimeActivation(
  changedFiles: readonly string[],
  loadedRuntimeSha: string | null,
  candidateSha: string,
): boolean {
  return loadedRuntimeSha !== candidateSha && changedFiles.some((file) => RUNTIME_ACTIVATION_PATHS.has(file));
}
