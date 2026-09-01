import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const developerSource = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const coordinatorSource = readFileSync(new URL("../electron/services/workflow/collaboration-workflow.facade.ts", import.meta.url), "utf8");
const integrationSource = readFileSync(new URL("../electron/services/support/capabilities/release/internal/version-integration.pipeline.ts", import.meta.url), "utf8");
const contractSource = readFileSync(new URL("../contracts/services/workflow/index.ts", import.meta.url), "utf8");
const contractDefinitionSource = readFileSync(new URL("../contracts/services/workflow/dto/collaboration-task.out.dto.ts", import.meta.url), "utf8");
const contractValueSource = readFileSync(new URL("../contracts/services/workflow/value/collaboration-task.value.ts", import.meta.url), "utf8");

test("协作回复卡展示真实状态链并隐藏旧意图终态", () => {
  assert.match(developerSource, /collaborationTaskId/);
  assert.match(developerSource, /CollaborationStatusChain/);
  assert.match(developerSource, /message\.collaborationTaskId[\s\S]*messageTask[\s\S]*CollaborationStatusChain/);
  assert.doesNotMatch(developerSource, /activeConversationTask && <CollaborationStatusChain/);
  assert.match(developerSource, /!message\.collaborationTaskId[\s\S]*stream-current/);
  assert.match(developerSource, /collaboration-status-task-details[\s\S]*任务详细.*initiator\?\.displayName/s);
  assert.doesNotMatch(developerSource, /review-failed[\s\S]*重新审批/);
  assert.match(developerSource, /test-failed[\s\S]*重新测试/);
});

test("执行失败经令狐修复并固定回到原负责人", () => {
  // 业务入口只负责公开协议，具体状态由入口导出的定义文件承载。
  assert.match(contractSource, /CollaborationTaskStateValue[\s\S]*from "\.\/value\/collaboration-task\.value\.js"/);
  assert.doesNotMatch(contractValueSource, /repairing-review|queued-reviewer/);
  assert.match(contractValueSource, /repairing-execution/);
  assert.doesNotMatch(coordinatorSource, /review\.repair_completed|preferredReviewerMemberId/);
  assert.match(coordinatorSource, /execution\.repair_completed[\s\S]*preferredExecutorMemberId/);
});

test("执行成功后由令狐老祖记录统一测试结果", () => {
  assert.match(contractSource, /CollaborationTaskStateValue[\s\S]*from "\.\/value\/collaboration-task\.value\.js"/);
  assert.match(contractValueSource, /unified-testing/);
  assert.match(integrationSource, /task\.state = "unified-testing"/);
  assert.match(integrationSource, /unified_test\.passed/);
  assert.match(integrationSource, /unified_test\.failed/);
});
