import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relativePath) => readFileSync(path.join(appRoot, relativePath), "utf8");

test("发布批次在统一测试前归档候选来源、运行器身份和门禁结果", () => {
  const contract = read("contracts/services/support/capabilities/release/dto/release-batch.out.dto.ts");
  const releaseContractIndex = read("contracts/services/support/capabilities/release/index.ts");
  const verifier = read("electron/services/support/capabilities/release/internal/integration.verifier.ts");
  const pipeline = read("electron/services/support/capabilities/release/internal/version-integration.pipeline.ts");
  const store = read("electron/services/support/capabilities/release/internal/release-batch.store.ts");
  assert.match(contract, /candidateEvidence: ReleaseBatchCandidateEvidenceOutDto \| null/);
  assert.match(contract, /loadedRuntimeSha: string \| null/);
  assert.match(contract, /sourceBlobs:/);
  assert.match(contract, /acceptancePlanChecks:/);
  assert.match(releaseContractIndex, /ReleaseBatchCandidateEvidenceOutDto/);
  assert.match(verifier, /inspectAcceptancePlanCandidateEvidence/);
  assert.match(verifier, /createHash\("sha256"\)/);
  assert.match(verifier, /readError:/);
  assert.match(pipeline, /candidateEvidence = inspectAcceptancePlanCandidateEvidence\(candidate\.rootPath, candidate\.candidateSha, this\.#loadedRuntimeSha\)/);
  assert.match(store, /candidateEvidence: null/);
});
