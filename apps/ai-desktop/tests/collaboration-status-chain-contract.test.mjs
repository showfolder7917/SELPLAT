import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const developerSource = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const coordinatorSource = readFileSync(new URL("../electron/services/collaboration/collaboration-coordinator.ts", import.meta.url), "utf8");
const contractSource = readFileSync(new URL("../shared/contracts/collaboration.ts", import.meta.url), "utf8");

test("协作回复卡展示真实状态链并隐藏旧意图终态", () => {
  assert.match(developerSource, /collaborationTaskId/);
  assert.match(developerSource, /CollaborationStatusChain/);
  assert.match(developerSource, /!message\.collaborationTaskId[\s\S]*stream-current/);
  assert.match(developerSource, /任务详细.*initiator\?\.displayName/s);
  assert.match(developerSource, /review-failed[\s\S]*重新审批/);
  assert.match(developerSource, /test-failed[\s\S]*重新测试/);
});

test("审批与执行失败分别经令狐修复并固定回到原负责人", () => {
  assert.match(contractSource, /repairing-review/);
  assert.match(contractSource, /repairing-execution/);
  assert.match(coordinatorSource, /review\.repair_completed[\s\S]*preferredReviewerMemberId/);
  assert.match(coordinatorSource, /execution\.repair_completed[\s\S]*preferredExecutorMemberId/);
});

test("执行成功后由令狐老祖记录统一测试结果", () => {
  assert.match(contractSource, /unified-testing/);
  assert.match(coordinatorSource, /令狐老祖正在统一测试/);
  assert.match(coordinatorSource, /unified_test\.passed/);
  assert.match(coordinatorSource, /unified_test\.failed/);
});
