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
  const workspaceManager = read("electron/services/support/capabilities/release/internal/version-workspace.manager.ts");
  const runtimeActivationPolicy = read("electron/services/support/capabilities/release/internal/runtime-activation.policy.ts");
  const store = read("electron/services/support/capabilities/release/internal/release-batch.store.ts");
  assert.match(contract, /candidateEvidence: ReleaseBatchCandidateEvidenceOutDto \| null/);
  assert.match(contract, /loadedRuntimeSha: string \| null/);
  assert.match(contract, /sourceBlobs:/);
  assert.match(contract, /acceptancePlanChecks:/);
  assert.match(releaseContractIndex, /ReleaseBatchCandidateEvidenceOutDto/);
  assert.match(verifier, /inspectAcceptancePlanCandidateEvidence/);
  assert.match(verifier, /hasMixedEvidenceAggregation/);
  assert.match(verifier, /review\\\.mode/);
  assert.match(verifier, /page-experience/);
  assert.match(verifier, /composeHanliResultReview/);
  assert.doesNotMatch(verifier, /includes\("mode: \\"mixed\\"\)/);
  assert.match(verifier, /createHash\("sha256"\)/);
  assert.match(verifier, /readError:/);
  assert.match(pipeline, /candidateEvidence = inspectAcceptancePlanCandidateEvidence\(candidate\.rootPath, candidate\.candidateSha, this\.#loadedRuntimeSha\)/);
  assert.match(pipeline, /requiresRuntimeActivation/);
  assert.match(pipeline, /releaseDocument\.state = "activating"/);
  assert.match(pipeline, /await this\.#prepareRuntimeActivation\(candidate, releaseBatchId\)/);
  assert.match(pipeline, /this\.#activateRuntime\(executable, releaseBatchId, candidate\.candidateSha\)/);
  assert.match(pipeline, /resumeRuntimeActivation\(releaseBatchId: string\)/);
  assert.doesNotMatch(pipeline, /throw new Error\(`候选修改统一测试运行器，必须先受控激活候选运行包/);
  assert.match(runtimeActivationPolicy, /RUNTIME_ACTIVATION_PATHS/);
  assert.match(runtimeActivationPolicy, /loadedRuntimeSha !== candidateSha/);
  assert.match(store, /candidateEvidence: null/);
  assert.match(workspaceManager, /class CandidateCompletenessError/);
  assert.match(workspaceManager, /assertCandidateContainsTaskResults/);
  assert.match(workspaceManager, /merge-base", "--is-ancestor", resultSha, candidate\.candidateSha/);
  assert.match(pipeline, /await this\.\#workspaces\.assertCandidateContainsTaskResults\(candidate, tasks\)/);
  assert.match(pipeline, /candidateIncomplete \? "candidate-branch-conflict"/);
  assert.match(pipeline, /缺少冻结任务结果，统一测试尚未启动/);
  assert.match(pipeline, /appendFlow\(task, "integration\.candidate_ready"/);
});

test("本地修改转交只在一次性工作树应用恢复快照，冲突不会污染任务工作树", () => {
  const manager = read("electron/services/support/capabilities/release/internal/version-workspace.manager.ts");
  const transfer = manager.slice(manager.indexOf("async transferOwnedLocalChanges"), manager.indexOf("async createIntegrationCandidate"));
  assert.match(transfer, /worktree", "add", "-b", transferBranch, transferRoot, beforeSha/);
  assert.match(transfer, /this\.\#git\(transferRoot, \["stash", "apply", "--index", recoveryStashSha\]\)/);
  assert.doesNotMatch(transfer, /this\.\#git\(taskRoot, \["stash", "apply", "--index", recoveryStashSha\]\)/);
  assert.match(transfer, /worktree", "remove", "--force", transferRoot/);
  assert.match(transfer, /if \(!transferred\) await this\.\#git\(taskRoot, \["reset", "--hard", beforeSha\]\)/);
});
