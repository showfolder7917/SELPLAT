import assert from "node:assert/strict";
import test from "node:test";

import { CollaborationCodexRegistry } from "../../../../../../../build/ai-desktop/electron/electron/services/support/capabilities/conversation/internal/collaboration-codex-sessions.js";

/** 构造只实现授权路由所需方法的 Codex 测试替身。 */
function codexConnection(title) {
  const resolved = [];
  return {
    resolved,
    pendingApprovals() {
      return [{
        requestId: 7,
        kind: "command",
        title,
        reason: "需要读取当前进程",
        command: "ps -p 100",
        cwd: "/workspace",
        details: null,
        trustEligible: false,
      }];
    },
    resolveApproval(requestId, decision, trust) {
      resolved.push({ requestId, decision, trust });
      return { trusted: false, projectRoot: null };
    },
    pendingUserInputs() {
      return [];
    },
  };
}

test("人物长期 Codex 请求进入统一授权路由且相同局部 ID 不串线", () => {
  const durations = {
    startWait() {
      throw new Error("人物长期会话没有协作 taskId，不应创建任务耗时段。");
    },
    finish() {
      throw new Error("没有人物任务耗时段可结束。");
    },
  };
  const registry = new CollaborationCodexRegistry(durations);
  const nangongConversation = codexConnection("执行调查命令");
  const nangongInquiry = codexConnection("核实调查事实");

  registry.registerPersona({
    connectionId: "persona-conversation:nangong-wan",
    memberId: "nangong-wan",
    memberName: "南宫婉",
    role: "persona-conversation",
    service: nangongConversation,
  });
  registry.registerPersona({
    connectionId: "persona-inquiry:nangong-wan",
    memberId: "nangong-wan",
    memberName: "南宫婉",
    role: "persona-inquiry",
    service: nangongInquiry,
  });

  const approvals = registry.pendingApprovals();
  assert.equal(approvals.length, 2);
  assert.notEqual(approvals[0].requestId, approvals[1].requestId);
  assert.equal(approvals[0].ownerMemberId, "nangong-wan");
  assert.equal(approvals[0].ownerMemberName, "南宫婉");
  assert.match(approvals[0].title, /^南宫婉 · /);
  assert.match(approvals[0].details, /角色：persona-conversation/);
  assert.match(approvals[1].details, /角色：persona-inquiry/);

  registry.resolveApproval(approvals[1].requestId, "accept");
  assert.deepEqual(nangongConversation.resolved, []);
  assert.deepEqual(nangongInquiry.resolved, [{ requestId: 7, decision: "accept", trust: false }]);
});
