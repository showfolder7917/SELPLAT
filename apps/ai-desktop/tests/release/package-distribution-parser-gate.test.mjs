import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertPackagedDistributionParser } from "../../scripts/package-distribution-parser-gate.mjs";

const distributionService = readFileSync(new URL("../../electron/services/personas/nangong/internal/distribution/nangong-task-distribution.service.ts", import.meta.url), "utf8");
const packageContentVerifier = readFileSync(new URL("../../scripts/verify-package-content.mjs", import.meta.url), "utf8");

test("当前分发解析器可作为发布包内容", () => {
  assert.doesNotThrow(() => assertPackagedDistributionParser(distributionService));
});

test("旧整段 JSON 解析器不能进入发布包", () => {
  assert.throws(
    () => assertPackagedDistributionParser("function parseJsonObject(value) { return JSON.parse(value); }"),
    /Packaged Nangong distribution parser is stale/,
  );
});

test("发布内容校验提取并检查南宫婉分发解析器", () => {
  assert.match(packageContentVerifier, /extractFile\(asarPath, packagedDistributionServicePath\)/);
  assert.match(packageContentVerifier, /assertPackagedDistributionParser\(packagedDistributionService\.toString\("utf8"\)\)/);
});
