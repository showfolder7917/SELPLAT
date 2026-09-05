import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { HanliComputerAcceptance } from "../../../../../build/ai-desktop/electron/electron/services/personas/hanli/internal/hanli-computer-acceptance.js";
const goal = { topicId: "t", proposalId: "p", title: "检查导航", criteria: ["可以切换页面"] };
function fixture(safe = true, sendResult = { status: "sent", composerLabel: "给韩立发送消息" }) {
  let n = 0;
  const inputs = [], progress = [];
  const window = { isDestroyed: () => false, getBounds: () => ({ x: 0, y: 0, width: 1000, height: 800 }), getContentBounds: () => ({ width: 1000, height: 800 }), getTitle: () => "AI Desktop", show() {}, focus() {}, webContents: { capturePage: async () => ({ toDataURL: () => "data:image/png;base64,test", getSize: () => ({ width: 1000, height: 800 }) }), executeJavaScript: async (script) => String(script).includes("sendAcceptanceMessage") ? sendResult : safe, sendInputEvent: (event) => inputs.push(event) } };
  const controller = new HanliComputerAcceptance({ save: async () => ({ id: `image-${++n}` }) });
  return { inputs, controller, run: (model) => controller.run(goal, window, model, (text) => progress.push(text)), progress };
}
const observe = (tools) => tools.call("hanli_computer", { action: "observe", reason: "观察真实页面" });
const id = (result) => JSON.parse(result.contentItems[0].text).observationId;
const finish = (tools, observationId, status = "passed", evidenceId = observationId) => tools.call("hanli_computer", { action: "finish", reason: "依据截图逐项判断", observationId, findings: [{ criterionId: "criterion-1", status, actual: "截图中的页面状态", evidenceId }] });

test("观察后逐步输入，再看真实返回截图才能形成验收记录", async () => {
  const f = fixture(); let saved;
  const run = await f.run(async (tools) => {
    saved = tools; const first = await observe(tools);
    assert.equal(first.contentItems[1].type, "inputImage");
    const next = await tools.call("hanli_computer", { action: "click", reason: "切换页面", observationId: id(first), x: 100, y: 100 });
    assert.deepEqual(f.inputs.map((item) => item.type), ["mouseDown", "mouseUp"]);
    assert.notEqual(id(first), id(next));
    await finish(tools, id(next));
  });
  assert.equal(run.version, 2); assert.equal(run.status, "passed");
  assert.equal(run.stepResults[0].operation.type, "click");
  assert.equal("planId" in run, false);
  await assert.rejects(observe(saved), /授权已收回/);
});
test("无实际操作、旧截图、伪造证据、漏验条件都不能通过", async () => {
  const f = fixture();
  await f.run(async (tools) => {
    const first = id(await observe(tools));
    await assert.rejects(finish(tools, first), /尚未执行真实交互/);
    const next = id(await tools.call("hanli_computer", { action: "key", reason: "检查键盘焦点", observationId: first, key: "Tab" }));
    await assert.rejects(tools.call("hanli_computer", { action: "key", reason: "旧画面", observationId: first, key: "Tab" }), /最新截图/);
    await assert.rejects(finish(tools, next, "passed", "fabricated"), /截图依据/);
    await assert.rejects(finish(tools, next, "passed", first), /截图依据/);
    await assert.rejects(tools.call("hanli_computer", { action: "finish", reason: "漏项", observationId: next, findings: [] }), /不能漏项/);
    await finish(tools, next);
  });
});
test("不安全点击被拒绝且可以真实报告受阻", async () => {
  const f = fixture(false);
  const result = await f.run(async (tools) => {
    const snapshot = id(await observe(tools));
    await assert.rejects(tools.call("hanli_computer", { action: "click", reason: "操作", observationId: snapshot, x: 40, y: 40 }), /未执行点击/);
    assert.equal(f.inputs.length, 0);
    await finish(tools, snapshot, "blocked");
  });
  assert.equal(result.status, "blocked");
});
test("受控验收消息发送后可作为真实截图证据，悬停也形成独立输入记录", async () => {
  const f = fixture();
  const run = await f.run(async (tools) => {
    const first = id(await observe(tools));
    const sent = await tools.call("hanli_computer", { action: "send-test-message", reason: "验证发送后的滚动行为", observationId: first });
    const hovered = await tools.call("hanli_computer", { action: "hover", reason: "验证截图按钮悬停反馈", observationId: id(sent), x: 100, y: 100 });
    assert.deepEqual(f.inputs.map((item) => item.type), ["mouseMove"]);
    await finish(tools, id(hovered));
  });
  assert.equal(run.status, "passed");
  assert.equal(run.stepResults[0].operation.type, "send");
  assert.equal(run.stepResults[0].operation.target, "persona-composer");
  assert.equal(run.stepResults[1].operation.type, "hover");
});
test("受控发送在输入框或发送按钮不可用时明确拒绝", async () => {
  const f = fixture(true, { status: "发送按钮仍禁用", composerLabel: null });
  const result = await f.run(async (tools) => {
    const snapshot = id(await observe(tools));
    await assert.rejects(tools.call("hanli_computer", { action: "send-test-message", reason: "验证禁用保护", observationId: snapshot }), /发送按钮仍禁用/);
    await finish(tools, snapshot, "blocked");
  });
  assert.equal(result.status, "blocked");
});
test("普通文字回复不算验收完成，模型断线回收权限", async () => {
  const f = fixture(); let tools;
  await assert.rejects(f.run(async (value) => { tools = value; await observe(value); }), /尚未.*提交/);
  await assert.rejects(observe(tools), /授权已收回/);
  await assert.rejects(f.run(async () => { throw new Error("断线"); }), /断线/);
});
test("旧计划执行器、补参数提示词和桌面接口不兼容退役", () => {
  assert.equal(existsSync("electron/services/personas/hanli/internal/hanli-real-app-acceptance.runner.ts"), false);
  assert.equal(existsSync("prompts/personas/hanli/acceptance-plan.md"), false);
  const api = readFileSync("contracts/system/desktop/api/desktop.api.ts", "utf8");
  assert.doesNotMatch(api, /generateHanLiAcceptancePlan|executeHanLiAcceptancePlan/);
});
