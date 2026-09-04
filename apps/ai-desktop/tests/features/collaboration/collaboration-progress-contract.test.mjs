import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
const source = file => readFileSync(new URL("../../../" + file, import.meta.url), "utf8");
test("人物会话使用正式 SELUI，显示真实交接与流式正文", () => {
  const page = source("src/features/collaboration/components/CollaborationMemberPage.tsx");
  assert.match(page, /SelUiConversation/);
  assert.match(page, /selconversation-message-body/);
  assert.match(page, /node.actor.memberId === member/);
  assert.match(page, /node.recipients.some/);
  assert.match(page, /liveTextByNodeId\[node.nodeId\]/);
  assert.match(page, /SelUiDisclosure/);
  assert.doesNotMatch(page, /重命名|完成后删除|CollaborationTaskProgress/);
});
test("旧任务详情页面和入口整链删除，不保留跳转兼容", () => {
  for (const file of ["CollaborationTaskDetail.tsx", "CollaborationTaskProgressView.tsx"]) {
    assert.equal(existsSync(new URL("../../../src/features/collaboration/components/" + file, import.meta.url)), false);
  }
  for (const file of ["src/applications/developer/DeveloperWorkspaceRouter.tsx", "src/features/collaboration/components/TaskCollaborationGroup.tsx", "src/features/collaboration/model/useCollaborationWorkspace.ts"]) {
    assert.doesNotMatch(source(file), /onOpenTask|selectedTaskId|setSelectedTaskId|打开任务完整记录/);
  }
});
test("令狐页面只保留自动开关，后台恢复职责仍存在", () => {
  const panel = source("src/features/linghu/components/LinghuAutomationPanel.tsx");
  assert.match(panel, /role="switch"/);
  assert.match(panel, /setLinghuAutomationEnabled/);
  assert.doesNotMatch(panel, /createPrompt|启动文案|提交修正方案/);
  const facade = source("electron/services/personas/linghu/linghu-automation.facade.ts");
  assert.match(facade, /LINGHU_SAFEGUARD_INSTRUCTIONS/);
  assert.doesNotMatch(facade, /submitRepairProposal|pendingRepairProposalId|reviseReturnedProposal/);
  assert.match(facade, /repairFailedUnifiedTest/);
});
