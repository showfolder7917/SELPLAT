import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../../../src/features/collaboration/model/collaboration-formatters.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { collaborationMemberStateLabel: label } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("每个人的工作中间阶段显示真实阶段而不是笼统正在执行", () => {
  for (const memberId of ["mo-caihuan", "song-yu", "linghu-ancestor"]) {
    for (const [phase, expected] of Object.entries({ analyzing: "技术分析中", planning: "整理方案中", implementing: "执行修改中", verifying: "自检中", finalizing: "整理结果中", blocked: "已阻塞" })) {
      assert.equal(label({ memberId, state: "working", phase }, "zh-CN"), expected);
    }
  }
});

test("人物使用协作群最新事实和研讨确认阶段，暂停不显示仍在讨论", () => {
  const member = { memberId: "linghu-ancestor", state: "idle" };
  const timeline = { groups: [{ nodes: [{ actor: member, action: "第 2 次修复中", startedAt: "2026-09-04T01:00:00Z", completedAt: null }] }] };
  assert.equal(label(member, "zh-CN", timeline), "第 2 次修复中");
  const evolution = { automationRuntime: { status: "running" }, deliberations: [{ status: "ready-to-establish", rounds: [{ confirmation: { offer: "只修复图片恢复" } }] }] };
  assert.equal(label({ memberId: "han-li" }, "zh-CN", null, evolution), "确认修复内容中");
  assert.equal(label({ memberId: "nangong-wan" }, "zh-CN", null, evolution), "等待韩立确认");
  evolution.automationRuntime.status = "paused";
  assert.equal(label({ memberId: "han-li" }, "zh-CN", null, evolution), "研讨已暂停");
});
