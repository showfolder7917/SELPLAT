const legacyDistributionParser = /\bfunction\s+parseJsonObject\s*\(/u;

export const packagedDistributionServicePath = "dist-electron/electron/services/personas/nangong/internal/distribution/nangong-task-distribution.service.js";

export function assertPackagedDistributionParser(source) {
  const hasBalancedObjectExtraction = source.includes("extractBalancedJsonObjects");
  const hasLegacyParser = legacyDistributionParser.test(source);
  if (hasBalancedObjectExtraction && !hasLegacyParser) return;
  throw new Error(
    "Packaged Nangong distribution parser is stale: expected balanced JSON extraction without the legacy parseJsonObject entry.",
  );
}
