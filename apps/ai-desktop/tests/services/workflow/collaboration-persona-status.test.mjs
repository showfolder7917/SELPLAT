import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../../../src/features/collaboration/model/collaboration-formatters.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { collaborationMemberDisplayModel: display } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("每个人的工作中间阶段显示真实阶段而不是笼统正在执行", () => {
  for (const memberId of ["mo-caihuan", "song-yu", "linghu-ancestor"]) {
    for (const [phase, expected] of Object.entries({ analyzing: "技术分析中", planning: "整理方案中", implementing: "执行修改中", verifying: "自检中", finalizing: "整理结果中", blocked: "已阻塞" })) {
      assert.equal(display({ member: { memberId, state: "working", currentTaskId: "task-1", phase }, locale: "zh-CN" }).label, expected);
    }
  }
});

test("无当前任务时只显示空闲，不由会话或历史状态重新投影", () => {
  const member = { memberId: "linghu-ancestor", state: "recovering", currentTaskId: null, phase: "blocked" };
  assert.deepEqual(display({ member, locale: "zh-CN" }), { presence: "idle", label: "空闲" });
  assert.deepEqual(display({ member, locale: "ja" }), { presence: "idle", label: "待機" });
});

test("状态尚未取得或更新失败时明确显示同步结果，不读取历史状态", () => {
  assert.deepEqual(display({ member: null, locale: "zh-CN", status: "syncing" }), { presence: "offline", label: "正在同步" });
  assert.deepEqual(display({ member: null, locale: "zh-CN", status: "unavailable" }), { presence: "offline", label: "状态暂未更新" });
});

test("当前任务存在时显示存储中的真实阶段，不由时间线文案覆盖", () => {
  const member = { memberId: "linghu-ancestor", state: "working", currentTaskId: "task-current", phase: "verifying" };
  assert.deepEqual(display({ member, locale: "zh-CN" }), { presence: "working", label: "自检中" });
});
