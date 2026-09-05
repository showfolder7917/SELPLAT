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
      assert.equal(label({ memberId, state: "working", phase }, "zh-CN"), expected);
    }
  }
});

test("空闲人物不被历史节点占用，工作人物只显示当前节点", () => {
  const member = { memberId: "linghu-ancestor", state: "idle" };
  const timeline = { groups: [{ nodes: [{ actor: member, action: "第 2 次修复中", startedAt: "2026-09-04T01:00:00Z", completedAt: null }] }] };
  assert.equal(label(member, "zh-CN", timeline), "空闲");
  const working = { ...member, state: "working", updatedAt: "2026-09-04T00:59:00Z" };
  const activeTimeline = { groups: [{ nodes: [
    { actor: member, status: "completed", action: "历史卡点已上报", startedAt: "2026-09-04T01:00:00Z", completedAt: "2026-09-04T01:01:00Z" },
    { actor: member, status: "current", action: "正在复查", startedAt: "2026-09-04T01:02:00Z", completedAt: null },
  ] }] };
  assert.equal(label(working, "zh-CN", activeTimeline), "正在复查");
});

test("研讨确认阶段由实时研讨事实显示，暂停不显示仍在讨论", () => {
  const evolution = { automationRuntime: { status: "running" }, deliberations: [{ status: "ready-to-establish", rounds: [{ confirmation: { offer: "只修复图片恢复" } }] }] };
  assert.equal(label({ memberId: "han-li" }, "zh-CN", null, evolution), "确认修复内容中");
  assert.equal(label({ memberId: "nangong-wan" }, "zh-CN", null, evolution), "等待韩立确认");
  evolution.automationRuntime.status = "paused";
  assert.equal(label({ memberId: "han-li" }, "zh-CN", null, evolution), "研讨已暂停");
});

test("人物直接会话覆盖空闲显示但不覆盖真实执行状态", () => {
  const nangong = { memberId: "nangong-wan", state: "idle", phase: null };
  assert.equal(label(nangong, "zh-CN", null, null, "active"), "会话中");
  assert.equal(label(nangong, "zh-CN", null, null, "responding"), "正在回复");
  assert.equal(label(nangong, "zh-CN", null, null, "creating"), "正在建立新会话");
  assert.equal(presence(nangong, "responding"), "conversation");
  const working = { ...nangong, state: "working", phase: "implementing" };
  assert.equal(presence(working, "active"), "working");
  assert.equal(label(working, "zh-CN", null, null, "active"), "执行修改中");
  assert.equal(label(working, "zh-CN", null, null, "responding"), "执行修改中");
});
