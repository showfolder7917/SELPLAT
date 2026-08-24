import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { NangongEvolutionFacade } from "../../../build/ai-desktop/electron/electron/services/collaboration/nangong-evolution-facade.js";
import { NangongEvolutionStore } from "../../../build/ai-desktop/electron/electron/services/collaboration/nangong-evolution-store.js";
import { controlledTestRoot } from "./test-paths.mjs";

mkdirSync(controlledTestRoot, { recursive: true });
const workspaceState = { primaryId: "root", roots: [{ id: "root", name: "SELPLAT", path: "/workspace", permission: "workspace-write" }] };
function topicRequest(title = "协同审批分层") { return { title, goal: "把演化方向审批从执行审核中独立出来", scope: ["AI Desktop"], exclusions: ["其他应用"], evidence: ["现有审核只覆盖执行方案"], acceptanceCriteria: ["提案审批与执行审核具有独立记录"], workspaceState, locale: "zh-CN" }; }
function proposalRequest() { return { type: "代码修正", content: "建立独立演化审批入口，审批通过后返还南宫婉分发。", risks: ["历史记录迁移"], rollbackPlan: "保留旧记录并关闭三项自动开关。" }; }
const conversation = { async send(_request, context) { return { text: `南宫婉调查结论：${context}`, itemCount: 1 }; }, async newChat() {} };

test("自动演化、两个来源审批和自动分发四项开关独立持久化", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-switches-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    store.setAutomation("evolution", true); store.setAutomation("nangong-approval", true);
    const state = new NangongEvolutionStore(path.join(directory, "state.json")).state();
    assert.equal(state.automaticEvolutionEnabled, true); assert.equal(state.automaticNangongApprovalEnabled, true); assert.equal(state.automaticLinghuApprovalEnabled, false); assert.equal(state.automaticExecutionEnabled, false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("自动审批无人工偏好时退回补充，人工决定形成版本化偏好", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-approval-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation, recordEvent: () => undefined });
    let state = facade.createTopic(topicRequest()); state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposal = state.proposals[0]; state = facade.autoApprove(proposal.proposalId);
    assert.equal(state.proposals[0].status, "supplement-required");
    state = facade.decideProposal(proposal.proposalId, { decision: "approved", advice: "人工确认方向正确" });
    assert.equal(state.preferenceSnapshotVersion, 1);
    state = facade.createTopic(topicRequest("相同类型第二课题")); state = facade.createProposal(state.topics.at(-1).topicId, proposalRequest());
    state = facade.autoApprove(state.proposals.at(-1).proposalId);
    assert.equal(state.proposals.at(-1).status, "approved"); assert.equal(state.proposals.at(-1).approvals.at(-1).referencedApprovalIds.length, 1);
    state = facade.decideProposal(state.proposals.at(-1).proposalId, { decision: "rejected", advice: "用户纠正自动结论" });
    assert.equal(state.proposals.at(-1).status, "rejected"); assert.equal(state.preferenceSnapshotVersion, 2);
    assert.equal(state.proposals.at(-1).approvals.at(-1).source, "manual-user");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("审批通过后才由南宫婉分发并固定 proposalId", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-dispatch-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json")); let submitted;
    const collaboration = { submitTask(request) { submitted = request; return { tasks: [{ taskId: "collab-1", evolutionProposalId: request.evolutionProposalId }] }; } };
    const facade = new NangongEvolutionFacade({ store, collaboration, conversation, recordEvent: () => undefined });
    let state = facade.createTopic(topicRequest()); state = facade.createProposal(state.topics[0].topicId, proposalRequest()); const proposalId = state.proposals[0].proposalId;
    assert.throws(() => facade.dispatch(proposalId), /只有审批通过/);
    facade.decideProposal(proposalId, { decision: "approved", advice: "通过" }); state = facade.dispatch(proposalId);
    assert.equal(submitted.initiatorMemberId, "nangong-wan"); assert.equal(submitted.evolutionProposalId, proposalId); assert.deepEqual(state.proposals[0].distributedTaskIds, ["collab-1"]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("南宫婉提案从人工审批、任务分发推进到完成记录", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-completed-flow-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    let distributedTaskId = null;
    const collaboration = {
      submitTask(request) { distributedTaskId = "collab-evolution-completed"; return { tasks: [{ taskId: distributedTaskId, evolutionProposalId: request.evolutionProposalId, state: "integrated" }] }; },
      state() { return { tasks: distributedTaskId ? [{ taskId: distributedTaskId, state: "integrated" }] : [] }; },
    };
    const facade = new NangongEvolutionFacade({ store, collaboration, conversation, recordEvent: () => undefined });
    let state = facade.createTopic(topicRequest("完整演化闭环"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    state = facade.decideProposal(proposalId, { decision: "supplement-required", advice: "补充完成记录验收依据" });
    assert.equal(state.proposals[0].approvals.at(-1).source, "manual-user");
    state = facade.decideProposal(proposalId, { decision: "approved", advice: "事实完整，批准执行" });
    state = facade.dispatch(proposalId);
    assert.deepEqual(state.proposals[0].distributedTaskIds, [distributedTaskId]);
    facade.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    facade.stop();
    state = facade.state();
    assert.equal(state.proposals[0].status, "completed");
    assert.equal(state.proposals[0].resultSummary, "全部关联任务通过统一测试，原演化目标已完成。");
    assert.equal(state.topics[0].recoveryPoint, "evolution-goal-completed");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("南宫婉对话持久化并冻结为正式课题快照", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-conversation-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation, recordEvent: () => undefined });
    let state = await facade.sendConversationMessage({ message: "调查令狐持续修正 Bug", attachmentIds: ["screenshot-1"], workspaceState, locale: "zh-CN" });
    assert.equal(state.conversation.messages.length, 2);
    assert.deepEqual(state.conversation.messages[0].attachmentIds, ["screenshot-1"]);
    state = facade.convertConversationToTopic({ title: "令狐持续修正演化", goal: "修正 Bug 并维持稳定运行", scope: ["AI Desktop"], acceptanceCriteria: ["修正方案先审批"], workspaceState, locale: "zh-CN" });
    assert.equal(state.topics.at(-1).sourceConversationMessageIds.length, 2);
    assert.match(state.topics.at(-1).evidence[0], /南宫婉调查结论/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("令狐修正与南宫提案使用独立自动审批开关并返还原提交人", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "linghu-approval-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json")); let submitted;
    const collaboration = { submitTask(request) { submitted = request; return { tasks: [{ taskId: "linghu-task", evolutionProposalId: request.evolutionProposalId }] }; }, state() { return { tasks: [] }; } };
    const facade = new NangongEvolutionFacade({ store, collaboration, conversation, recordEvent: () => undefined });
    store.setAutomation("linghu-approval", true);
    let state = facade.createLinghuRepairProposal({ title: "修正持续运行 Bug", content: "依据停点事实修正恢复逻辑", evidence: ["任务停在 test-failed"], impactScope: ["令狐恢复流程"], risks: ["重复恢复"], rollbackPlan: "恢复旧恢复点", acceptanceCriteria: ["任务恢复且不重复"], workspaceState, locale: "zh-CN" });
    const proposal = state.proposals.at(-1);
    assert.equal(proposal.submitterMemberId, "linghu-ancestor");
    state = facade.decideProposal(proposal.proposalId, { decision: "approved", advice: "人工确认令狐方向" });
    state = facade.dispatch(proposal.proposalId);
    assert.equal(submitted.initiatorMemberId, "linghu-ancestor"); assert.equal(submitted.preferredExecutorMemberId, "linghu-ancestor");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
