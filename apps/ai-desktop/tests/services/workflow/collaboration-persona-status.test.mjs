import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../../../src/features/collaboration/model/collaboration-formatters.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { collaborationMemberPresenceState: presence, collaborationMemberStateLabel: label } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("每个人的工作中间阶段显示真实阶段而不是笼统正在执行", () => {
  for (const memberId of ["mo-caihuan", "song-yu", "linghu-ancestor"]) {
    for (const [phase, expected] of Object.entries({ analyzing: "技术分析中", planning: "整理方案中", implementing: "执行修改中", verifying: "自检中", finalizing: "整理结果中", blocked: "已阻塞" })) {
      assert.equal(label({ member: { memberId, state: "working", phase }, locale: "zh-CN" }), expected);
    }
  }
});

test("空闲人物不被历史节点占用，工作人物只显示当前节点", () => {
  const member = { memberId: "linghu-ancestor", state: "idle" };
  const timeline = { groups: [{ nodes: [{ actor: member, action: "第 2 次修复中", startedAt: "2026-09-04T01:00:00Z", completedAt: null }] }] };
  assert.equal(label({ member, locale: "zh-CN", timeline }), "空闲");
  const working = { ...member, state: "working", updatedAt: "2026-09-04T00:59:00Z" };
  const activeTimeline = { groups: [{ nodes: [
    { actor: member, status: "completed", action: "历史卡点已上报", startedAt: "2026-09-04T01:00:00Z", completedAt: "2026-09-04T01:01:00Z" },
    { actor: member, status: "current", action: "正在复查", startedAt: "2026-09-04T01:02:00Z", completedAt: null },
  ] }] };
  assert.equal(label({ member: working, locale: "zh-CN", timeline: activeTimeline }), "正在复查");
});

test("研讨确认阶段由实时研讨事实显示，暂停不显示仍在讨论", () => {
  const evolution = { automationRuntime: { status: "running" }, deliberations: [{ status: "ready-to-establish", rounds: [{ confirmation: { offer: "只修复图片恢复" } }] }] };
  assert.equal(label({ member: { memberId: "han-li" }, locale: "zh-CN", evolution }), "确认修复内容中");
  assert.equal(label({ member: { memberId: "nangong-wan" }, locale: "zh-CN", evolution }), "等待韩立确认");
  evolution.automationRuntime.status = "paused";
  assert.equal(label({ member: { memberId: "han-li" }, locale: "zh-CN", evolution }), "研讨已暂停");
});

test("人物直接会话覆盖空闲显示但不覆盖真实执行状态", () => {
  const nangong = { memberId: "nangong-wan", state: "idle", phase: null };
  assert.equal(label({ member: nangong, locale: "zh-CN", conversationActivity: "active" }), "会话中");
  assert.equal(label({ member: nangong, locale: "zh-CN", conversationActivity: "responding" }), "正在回复");
  assert.equal(label({ member: nangong, locale: "zh-CN", conversationActivity: "creating" }), "正在建立新会话");
  assert.equal(presence(nangong, "responding"), "conversation");
  const working = { ...nangong, state: "working", phase: "implementing" };
  assert.equal(presence(working, "active"), "working");
  assert.equal(label({ member: working, locale: "zh-CN", conversationActivity: "active" }), "执行修改中");
  assert.equal(label({ member: working, locale: "zh-CN", conversationActivity: "responding" }), "执行修改中");
});


test("南宫婉计划生成与任务卡同源，结束或阻塞后不残留忙碌", () => {
  const member = { memberId: "nangong-wan", state: "idle" };
  const node = { nodeId: "distribution-planning:p:1", actor: member, status: "current", completedAt: null, startedAt: "2026-09-12T07:00:00Z", action: "正在生成执行计划并分配执行人" };
  const group = { status: "running", nodes: [node] };
  const timeline = { groups: [group] };
  assert.equal(label({ member, locale: "zh-CN", timeline }), node.action);
  assert.equal(label({ member, locale: "ja", timeline }), "実行計画を作成中");
  group.status = "blocked";
  assert.equal(label({ member, locale: "zh-CN", timeline }), "空闲");
  group.status = "running"; node.status = "completed";
  assert.equal(label({ member, locale: "zh-CN", timeline }), "空闲");
});
