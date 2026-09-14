const legacyDistributionParser = /\bfunction\s+parseJsonObject\s*\(/u;

export const packagedDistributionServicePath = "dist-electron/electron/services/personas/nangong/internal/distribution/nangong-task-distribution.service.js";

export function assertPackagedDistributionParser(source) {
  const hasBalancedObjectExtraction = source.includes("extractBalancedJsonObjects");
  // 帮助函数仅被打进包不足以证明分发入口已迁移，必须确认计划解析实际走平衡对象路径。
  const hasBalancedPlanRoute = source.includes("function parseDistributionPlan") && source.includes("parseJsonObjects(text)");
  const hasLegacyParser = legacyDistributionParser.test(source);
  if (hasBalancedObjectExtraction && hasBalancedPlanRoute && !hasLegacyParser) return;
  throw new Error(
    "Packaged Nangong distribution parser is stale: expected parseDistributionPlan to use balanced JSON extraction without the legacy parseJsonObject entry.",
  );
}
