import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../../../src/features/collaboration/model/collaboration-formatters.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  write: false,
});
const { collaborationMemberDisplayModel: display, formatCollaborationDuration } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

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

test("内部调查尚未生成执行任务时，只有权威运行态指定的人物显示处理中", () => {
  const run = { actor: "nangong-wan", phase: "preparing-topic", status: "running" };
  const nangong = { memberId: "nangong-wan", state: "idle", currentTaskId: null, phase: null };
  const hanli = { memberId: "han-li", state: "idle", currentTaskId: null, phase: null };
  assert.deepEqual(display({ member: nangong, locale: "zh-CN", oneShotRun: run }), { presence: "working", label: "梳理调查问题中" });
  assert.deepEqual(display({ member: hanli, locale: "zh-CN", oneShotRun: run }), { presence: "idle", label: "空闲" });
});

test("仍需客户确认的范围说明由韩立显示等待确认，南宫婉不再显示调查中", () => {
  const run = { actor: "nangong-wan", phase: "preparing-topic", status: "running" };
  const nangong = { memberId: "nangong-wan", state: "idle", currentTaskId: null, phase: null };
  const hanli = { memberId: "han-li", state: "idle", currentTaskId: null, phase: null };
  assert.deepEqual(display({ member: hanli, locale: "zh-CN", oneShotRun: run, awaitingDeliberationConfirmation: true }), { presence: "conversation", label: "等待你确认" });
  assert.deepEqual(display({ member: nangong, locale: "zh-CN", oneShotRun: run, deliberating: true, awaitingDeliberationConfirmation: true }), { presence: "idle", label: "空闲" });
});

test("已持久化的联合研讨同时显示南宫婉活动，不改写韩立运行角色", () => {
  const run = { actor: "han-li", phase: "preparing-topic", status: "running" };
  const nangong = { memberId: "nangong-wan", state: "idle", currentTaskId: null, phase: null };
  const hanli = { memberId: "han-li", state: "idle", currentTaskId: null, phase: null };
  assert.deepEqual(display({ member: nangong, locale: "zh-CN", oneShotRun: run, deliberating: true }), { presence: "working", label: "内部研讨中" });
  assert.deepEqual(display({ member: hanli, locale: "zh-CN", oneShotRun: run, deliberating: true }), { presence: "working", label: "梳理调查问题中" });
});

test("联合研讨投影不依赖一次性运行仍处于 running，且不覆盖已有任务", () => {
  const nangong = { memberId: "nangong-wan", state: "idle", currentTaskId: null, phase: null };
  const executingNangong = { memberId: "nangong-wan", state: "working", currentTaskId: "task-current", phase: "verifying" };

  assert.deepEqual(display({ member: nangong, locale: "zh-CN", deliberating: true }), { presence: "working", label: "内部研讨中" });
  assert.deepEqual(display({ member: executingNangong, locale: "zh-CN", deliberating: true }), { presence: "working", label: "自检中" });
});

test("韩立人物会话排查在专题建立前同时投影负责人和受托核实人物", () => {
  const activity = { phase: "investigating", status: "running" };
  const hanli = { memberId: "han-li", state: "idle", currentTaskId: null, phase: null };
  const nangong = { memberId: "nangong-wan", state: "idle", currentTaskId: null, phase: null };
  assert.deepEqual(display({ member: hanli, locale: "zh-CN", inquiryActivity: activity, inquiryRole: "owner" }), { presence: "working", label: "等待核实中" });
  assert.deepEqual(display({ member: nangong, locale: "zh-CN", inquiryActivity: activity, inquiryRole: "delegate" }), { presence: "working", label: "只读核实中" });
  assert.deepEqual(display({ member: hanli, locale: "zh-CN", inquiryActivity: { phase: "assessing", status: "running" }, inquiryRole: "owner" }), { presence: "working", label: "研判结果中" });
  assert.deepEqual(display({ member: nangong, locale: "zh-CN", inquiryActivity: { phase: "assessing", status: "running" }, inquiryRole: "delegate" }), { presence: "idle", label: "空闲" });
});

test("可恢复排查不能因没有任务编号而投影为空闲", () => {
  const hanli = { memberId: "han-li", state: "idle", currentTaskId: null, phase: null };
  assert.deepEqual(display({ member: hanli, locale: "zh-CN", inquiryActivity: { phase: "explaining", status: "retryable" }, inquiryRole: "owner" }), { presence: "recovering", label: "等待恢复排查" });
});

test("状态尚未取得或更新失败时明确显示同步结果，不读取历史状态", () => {
  assert.deepEqual(display({ member: null, locale: "zh-CN", status: "syncing" }), { presence: "offline", label: "正在同步" });
  assert.deepEqual(display({ member: null, locale: "zh-CN", status: "unavailable" }), { presence: "offline", label: "状态暂未更新" });
});

test("当前任务存在时显示存储中的真实阶段，不由时间线文案覆盖", () => {
  const member = { memberId: "linghu-ancestor", state: "working", currentTaskId: "task-current", phase: "verifying" };
  assert.deepEqual(display({ member, locale: "zh-CN", inquiryActivity: { phase: "investigating", status: "running" }, inquiryRole: "owner" }), { presence: "working", label: "自检中" });
});


test("协作耗时单位由统一资源按三语解析，英文不再回退中文单位", () => {
  const startedAt = "2026-09-25T00:00:00.000Z";
  const completedAt = "2026-09-26T01:01:01.000Z";
  assert.equal(formatCollaborationDuration(startedAt, completedAt, "zh-CN"), "1 天 1 小时 1 分钟 1 秒");
  assert.equal(formatCollaborationDuration(startedAt, completedAt, "ja"), "1 日 1 時間 1 分 1 秒");
  assert.equal(formatCollaborationDuration(startedAt, completedAt, "en"), "1 day 1 hour 1 minute 1 second");
  assert.equal(formatCollaborationDuration(startedAt, null, "en"), "In progress");
});
