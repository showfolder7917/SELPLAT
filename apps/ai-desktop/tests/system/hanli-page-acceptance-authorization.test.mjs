import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../../electron/system/ipc/hanli-page-acceptance-authorization.ts", import.meta.url))],
  bundle: true, format: "cjs", platform: "node", packages: "external", write: false,
});
const compiled = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { HanliPageAcceptanceAuthorization } = compiled.exports;

test("空材料快照明确拒绝目录浏览，不扩大工作区授权", () => {
  const authorization = new HanliPageAcceptanceAuthorization();
  authorization.begin(1, { topicId: "topic-a", proposalId: "proposal-a", materials: [] });
  assert.throws(
    () => authorization.assertWorkspaceDirectoryAllowed(1, "workspace-a", ""),
    /未冻结此工作区的验收材料，无法浏览目录/,
  );
});

test("冻结材料只开放其祖先目录，其他工作区仍被拒绝", () => {
  const authorization = new HanliPageAcceptanceAuthorization();
  authorization.begin(1, {
    topicId: "topic-a",
    proposalId: "proposal-a",
    materials: [{ workspaceId: "workspace-a", relativePath: "approved/readme.txt", allowedActions: ["preview", "copy"] }],
  });
  assert.doesNotThrow(() => authorization.assertWorkspaceDirectoryAllowed(1, "workspace-a", ""));
  assert.doesNotThrow(() => authorization.assertWorkspaceDirectoryAllowed(1, "workspace-a", "approved"));
  assert.throws(() => authorization.assertWorkspaceDirectoryAllowed(1, "workspace-a", "other"), /未授权浏览此工作区目录/);
  assert.throws(() => authorization.assertWorkspaceDirectoryAllowed(1, "workspace-b", ""), /未冻结此工作区的验收材料/);
});
