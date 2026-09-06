import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { controlledTestRoot } from "#test-paths";
import { ActiveUserRuleFacade, RulePackageArchiveFacade, RulePackageUploadCoordinator, RuleWorkspaceFacade } from "../../../../../../../build/ai-desktop/electron/electron/services/support/capabilities/rules/index.js";

const roleIds = {
  hanli: "AI_DESKTOP_HANLI_USER_QUESTIONING_RULES",
  nangong: "AI_DESKTOP_NANGONG_ANALYSIS_PLANNING_RULES",
  executor: "AI_DESKTOP_EXECUTOR_SOURCE_IMPLEMENTATION_RULES",
  linghu: "AI_DESKTOP_LINGHU_FAILURE_TEST_RULES",
};
const sharedRuleId = "AI_DESKTOP_COLLABORATION_AUTOMATION_RULES";

function fixture(root, user = "XUNAN") {
  const engine = path.join(root, "apps", "ai-desktop", "ruleengine");
  const rules = path.join(engine, "rules");
  const userRoot = path.join(rules, "local", user);
  mkdirSync(userRoot, { recursive: true });
  writeFileSync(path.join(engine, "AGENTS.md"), `- 当前稳定用户 ID：\`${user}\`\n`, "utf8");
  writeFileSync(path.join(rules, "RULE_INDEX.md"), `USER_RULE_INDEX_PATTERN = local/<stable-user-id>/RULE_INDEX.md\n`, "utf8");
  const assignments = [
    `${sharedRuleId} = local/${user}/shared.md`,
    ...Object.entries(roleIds).map(([role, id]) => `${id} = local/${user}/${role}.md`),
  ].join("\n");
  writeFileSync(path.join(userRoot, "RULE_INDEX.md"), `${assignments}\n`, "utf8");
  writeFileSync(path.join(userRoot, "shared.md"), "# shared\nall-person-clear-communication\n", "utf8");
  for (const [role] of Object.entries(roleIds)) writeFileSync(path.join(userRoot, `${role}.md`), `# ${role}\nversion-one\n`, "utf8");
  const core = path.join(rules, "local", "core"); mkdirSync(core, { recursive: true });
  writeFileSync(path.join(core, "RULE_INDEX.md"), "FORBIDDEN_CORE = local/core/core.md\n", "utf8");
  writeFileSync(path.join(core, "core.md"), "must-not-load\n", "utf8");
  return { engine, rules, userRoot };
}

test("活动用户加载器只递归当前用户，并冻结任务规则正文", () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "ai-desktop-active-rules-"));
  const { engine, rules, userRoot } = fixture(root);
  const service = new ActiveUserRuleFacade({ mode: "source", workspaceRoot: engine, agentsPath: path.join(engine, "AGENTS.md"), ruleRoot: rules });
  assert.equal(service.resolve("FORBIDDEN_CORE").rule, null);
  const frozen = service.createTaskRuleSnapshot("executor");
  assert.deepEqual(frozen.mandatoryRoleRuleIds, [sharedRuleId, roleIds.executor]);
  assert.match(service.renderTaskRuleSnapshot(frozen), /all-person-clear-communication/);
  writeFileSync(path.join(userRoot, "executor.md"), "# executor\nversion-two\n", "utf8");
  assert.match(service.renderTaskRuleSnapshot(frozen), /version-one/);
  assert.doesNotMatch(service.renderTaskRuleSnapshot(frozen), /version-two/);
  assert.match(service.renderRoleInstructions("executor"), /version-two/);
  for (const role of Object.keys(roleIds)) {
    const snapshot = service.createTaskRuleSnapshot(role);
    assert.equal(snapshot.mandatoryRoleRuleIds[0], sharedRuleId);
    assert.equal(snapshot.mandatoryRoleRuleIds[1], roleIds[role]);
    assert.match(service.renderTaskRuleSnapshot(snapshot), /all-person-clear-communication/);
  }
});

test("无源码工作区在规则版本变化后生成 ZIP outbox，并在启动上传成功后归档", async () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "ai-desktop-local-rules-"));
  const bundledProject = path.join(root, "bundled-project");
  const { engine: bundled } = fixture(bundledProject);
  const projectWithoutSource = path.join(root, "customer-project"); mkdirSync(projectWithoutSource);
  const userData = path.join(root, "user-data");
  const workspace = new RuleWorkspaceFacade({ projectRoot: projectWithoutSource, userDataRoot: userData, bundledRuleRoot: bundled });
  assert.equal(workspace.descriptor.mode, "local");
  const archive = new RulePackageArchiveFacade(workspace.descriptor);
  const service = new ActiveUserRuleFacade(workspace.descriptor, (revision) => archive.recordRevision(revision));
  const before = service.createTaskRuleSnapshot("hanli");
  const hanliPath = path.join(workspace.descriptor.ruleRoot, "local", "XUNAN", "hanli.md");
  writeFileSync(hanliPath, `${readFileSync(hanliPath, "utf8")}changed\n`, "utf8");
  const after = service.createTaskRuleSnapshot("hanli");
  assert.notEqual(after.ruleRevision, before.ruleRevision);
  const uploaded = [];
  const coordinator = new RulePackageUploadCoordinator({
    ruleWorkspaceRoot: workspace.descriptor.workspaceRoot,
    uploader: { async upload(request) { uploaded.push(request); return { uploadId: "upload-1", acceptedRevision: request.ruleRevision }; } },
    recordEvent() {},
  });
  await coordinator.uploadLatestPendingOnce();
  await coordinator.uploadLatestPendingOnce();
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].stableUserId, "XUNAN");
});
