import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { transform } from "esbuild";

// 单测直接转换当前工作树源码，避免测试把未构建的隔离工作树误判为运行时代码缺失。
const acceptanceSource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
const transformedAcceptance = await transform(acceptanceSource + "\nexport { safeNavigationClick };", {
  loader: "ts",
  format: "esm",
  target: "es2022",
});
const acceptanceModule = await import(`data:text/javascript;base64,${Buffer.from(transformedAcceptance.code).toString("base64")}`);
const { HanliComputerAcceptance } = acceptanceModule;
const goal = { topicId: "t", proposalId: "p", title: "检查导航", criteria: ["可以切换页面"] };
function fixture(safe = true, sendResult = { status: "sent", composerLabel: "给韩立发送消息" }, testConsoleVisible = true) {
  let n = 0;
  const inputs = [], progress = [];
  let bounds = { x: 0, y: 0, width: 1200, height: 800 };
  const boundsCalls = [];
  const window = { isDestroyed: () => false, getBounds: () => ({ ...bounds }), setBounds: (next) => { bounds = { ...next }; boundsCalls.push({ ...next }); }, getContentBounds: () => ({ width: bounds.width, height: bounds.height }), getTitle: () => "AI Desktop", show() {}, focus() {}, webContents: { capturePage: async () => ({ toDataURL: () => "data:image/png;base64,test", getSize: () => ({ width: bounds.width, height: bounds.height }) }), executeJavaScript: async (script) => {
    const source = String(script);
    if (/sendAcceptanceMessage|sendAcceptanceScreenshot/.test(source)) return sendResult;
    if (/focusAcceptanceModelControl/.test(source)) {
      return { status: "focused", controlLabel: source.includes("nangong-model") ? "南宫婉对话模型" : "韩立对话模型" };
    }
    if (/scrollTestConsole/.test(source)) return testConsoleVisible ? { status: "scrolled", scrollTop: 320, maxScrollTop: 640 } : { status: "hidden" };
    if (/expandTestConsoleEvidence/.test(source)) return testConsoleVisible ? { status: "expanded" } : { status: "hidden" };
    if (/readTestConsoleState/.test(source)) return testConsoleVisible ? { status: "visible", scrollTop: 0, maxScrollTop: 640 } : { status: "hidden" };
    return safe;
  }, sendInputEvent: (event) => inputs.push(event) } };
  const controller = new HanliComputerAcceptance({ save: async () => ({ id: `image-${++n}` }) });
  return { inputs, boundsCalls, controller, run: (model) => controller.run(goal, window, model, (text) => progress.push(text)), progress };
}
const observe = (tools) => tools.call("hanli_computer", { action: "observe", reason: "观察真实页面" });
const id = (result) => JSON.parse(result.contentItems[0].text).observationId;
const finish = (tools, observationId, status = "passed", evidenceId = observationId, layoutStatus = status === "blocked" ? "blocked" : "passed") => tools.call("hanli_computer", {
  action: "finish",
  reason: "依据截图逐项判断功能和布局",
  observationId,
  findings: [{
    criterionId: "criterion-1",
    status,
    actual: "截图中的功能状态",
    evidenceId,
    layoutStatus,
    layoutActual: "控件位置、遮挡、拥挤、尺寸和整体协调性已检查",
    layoutEvidenceId: evidenceId,
  }],
});

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
    await assert.rejects(tools.call("hanli_computer", { action: "finish", reason: "只判断功能", observationId: next, findings: [{ criterionId: "criterion-1", status: "passed", actual: "功能可用", evidenceId: next }] }), /布局判断/);
    await assert.rejects(tools.call("hanli_computer", { action: "finish", reason: "漏项", observationId: next, findings: [] }), /不能漏项/);
    await finish(tools, next);
  });
});
test("功能通过但布局失败时整体验收仍不通过", async () => {
  const f = fixture();
  const result = await f.run(async (tools) => {
    const first = id(await observe(tools));
    const next = id(await tools.call("hanli_computer", { action: "key", reason: "触发布局检查", observationId: first, key: "Tab" }));
    await finish(tools, next, "passed", next, "failed");
  });
  assert.equal(result.status, "failed");
  assert.equal(result.stepResults.at(-1).layoutStatus, "failed");
  assert.match(result.stepResults.at(-1).layoutActual, /位置、遮挡、拥挤、尺寸/);
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
test("设置浮层触发器是唯一允许的设置导航入口", () => {
  const source = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
  assert.match(source, /node\.classList\.contains\("activity-settings"\) && node\.closest\("\.dev-settings-control"\)/);
  assert.ok(source.indexOf("删除|清空|移除") < source.indexOf('node.classList.contains("activity-settings")'));
});
test("图片预览只放行消息缩略图、预览控件和预览区域拖拽", () => {
  const source = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
  assert.match(source, /selconversation-message-image-trigger.*selconversation-message-attachments/);
  assert.match(source, /selimagepreview-action, \.seldialog-close/);
  assert.match(source, /safeImagePreviewDrag/);
  assert.match(source, /图片预览状态不可读取，证据不足/);
  assert.match(source, /getComputedStyle\(viewport\)\.cursor/);
  assert.match(source, /withinBounds/);
  assert.match(source, /imagePreviewDuringDrag/);
});
test("测试台验收能力只允许固定容器滚动、只读证据展开和尺寸预设", async () => {
  const f = fixture();
  const run = await f.run(async (tools) => {
    const first = id(await observe(tools));
    const scrolled = await tools.call("hanli_computer", { action: "scroll-test-console", reason: "查看测试台执行记录", observationId: first, deltaY: 320 });
    const scrollEvidence = JSON.parse(scrolled.contentItems[0].text).interactionEvidence.testConsole;
    assert.deepEqual(scrollEvidence, { status: "scrolled", scrollTop: 320, maxScrollTop: 640 });
    const expanded = await tools.call("hanli_computer", { action: "expand-test-console-evidence", reason: "展开测试台只读技术证据", observationId: id(scrolled) });
    assert.equal(JSON.parse(expanded.contentItems[0].text).interactionEvidence.testConsole.status, "expanded");
    const narrow = await tools.call("hanli_computer", { action: "resize-acceptance-window", resizePreset: "narrow", reason: "检查固定窄窗口布局", observationId: id(expanded) });
    assert.deepEqual(JSON.parse(narrow.contentItems[0].text).interactionEvidence.acceptanceWindow, { preset: "narrow", bounds: { x: 0, y: 0, width: 1000, height: 700 } });
    await finish(tools, id(narrow));
  });
  assert.equal(run.status, "passed");
  assert.deepEqual(f.boundsCalls, [{ x: 0, y: 0, width: 1000, height: 700 }, { x: 0, y: 0, width: 1200, height: 800 }]);
  assert.deepEqual(run.stepResults.slice(0, 3).map((step) => step.operation.type), ["scroll-test-console", "expand-test-console-evidence", "resize-acceptance-window"]);
});
test("隐藏测试台时固定验收能力全部拒绝", async () => {
  const f = fixture(true, { status: "sent", composerLabel: "给韩立发送消息" }, false);
  const run = await f.run(async (tools) => {
    const first = id(await observe(tools));
    await assert.rejects(tools.call("hanli_computer", { action: "scroll-test-console", reason: "尝试滚动隐藏测试台", observationId: first, deltaY: 320 }), /测试台内容未滚动：hidden/);
    await assert.rejects(tools.call("hanli_computer", { action: "expand-test-console-evidence", reason: "尝试展开隐藏测试台", observationId: first }), /测试台技术证据未展开：hidden/);
    await assert.rejects(tools.call("hanli_computer", { action: "resize-acceptance-window", resizePreset: "narrow", reason: "尝试调整隐藏测试台窗口", observationId: first }), /测试台未显示/);
    await finish(tools, first, "blocked");
  });
  assert.equal(run.status, "blocked");
  assert.deepEqual(f.boundsCalls, []);
});
test("测试台固定能力不放宽通用点击、拖拽或任意窗口尺寸", () => {
  const source = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
  assert.match(source, /scroll-test-console/);
  assert.match(source, /\.dev-test-console-content/);
  assert.match(source, /expand-test-console-evidence/);
  assert.match(source, /\.test-console-disclosure/);
  assert.match(source, /resizePreset/);
  assert.match(source, /width: 1000, height: 700/);
  assert.match(source, /window\.setBounds\(initialBounds\)/);
  const navigationBody = source.slice(source.indexOf("function safeNavigationClick"), source.indexOf("function safeImagePreviewDrag"));
  assert.doesNotMatch(navigationBody, /test-console-disclosure/);
});
test("预览拖拽与受控截图发送都形成受限交互记录", async () => {
  const f = fixture();
  const run = await f.run(async (tools) => {
    const first = id(await observe(tools));
    const dragged = await tools.call("hanli_computer", { action: "drag", reason: "验证溢出图片的受限拖拽", observationId: first, x: 100, y: 100, endX: 180, endY: 120 });
    assert.deepEqual(f.inputs.map((item) => item.type), ["mouseMove", "mouseDown", "mouseMove", "mouseUp"]);
    const sent = await tools.call("hanli_computer", { action: "send-test-screenshot", reason: "验证当前人物截图附件发送", observationId: id(dragged) });
    await finish(tools, id(sent));
  });
  assert.equal(run.status, "passed");
  assert.equal(run.stepResults[0].operation.type, "drag");
  assert.equal(run.stepResults[1].operation.type, "send");
});
test("截图发送只允许当前人物固定截图按钮", () => {
  const source = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
  assert.match(source, /send-test-screenshot/);
  assert.match(source, /button\.screenshot-button\[aria-label="截取当前屏幕"\]/);
  assert.match(source, /截图附件未进入当前人物发送区/);
});
test("截图发送验收条件明确引导受控截图动作，不能退回纯文字发送", () => {
  const toolSource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
  const prompt = readFileSync("prompts/personas/hanli/computer-acceptance.md", "utf8");
  assert.match(toolSource, /截图发送、附件显示或历史关联时必须使用 send-test-screenshot/);
  assert.match(prompt, /截图发送、附件显示或历史关联时，必须改用 `send-test-screenshot`/);
  assert.match(prompt, /不能用 `send-test-message` 替代/);
});
test("模型验收只聚焦韩立、南宫婉或设置模型控件，值仍由真实键盘输入改变", async () => {
  const f = fixture();
  const run = await f.run(async (tools) => {
    const first = id(await observe(tools));
    const focused = await tools.call("hanli_computer", { action: "focus-model-control", control: "hanli-model", reason: "聚焦韩立对话模型", observationId: first });
    const selected = await tools.call("hanli_computer", { action: "key", key: "ArrowDown", reason: "选择目录中的下一模型", observationId: id(focused) });
    assert.deepEqual(f.inputs.map((item) => item.type), ["keyDown", "keyUp"]);
    await finish(tools, id(selected));
  });
  assert.equal(run.status, "passed");
  assert.equal(run.stepResults[0].operation.key, "focus:hanli-model");
  const source = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
  assert.match(source, /"hanli-model", "nangong-model", "default-model", "reasoning-effort", "service-tier"/);
  assert.match(source, /select\[aria-label="韩立对话模型"\]/);
  assert.match(source, /select\[aria-label="南宫婉对话模型"\]/);
  assert.match(source, /select\.focus\(\)/);
  assert.match(source, /不能读取或设置选项值/);
});
test("截图无法定位控件时，观察结果仍提供受限模型聚焦提示和后续聚焦证据", async () => {
  const f = fixture();
  await f.run(async (tools) => {
    const first = await observe(tools);
    const observation = JSON.parse(first.contentItems[0].text);
    assert.deepEqual(observation.modelControlHints.map((item) => item.control), ["hanli-model", "nangong-model", "default-model", "reasoning-effort", "service-tier"]);
    const focused = await tools.call("hanli_computer", { action: "focus-model-control", control: "nangong-model", reason: "聚焦南宫婉对话模型", observationId: id(first) });
    const afterFocus = JSON.parse(focused.contentItems[0].text);
    assert.deepEqual(afterFocus.interactionEvidence.focusedModelControl, { control: "nangong-model", label: "南宫婉对话模型" });
    await finish(tools, id(focused));
  });
});
test("工具契约在首次观察前也声明受限模型聚焦路径", async () => {
  const f = fixture();
  await f.run(async (tools) => {
    const definition = tools.definitions[0];
    assert.match(definition.description, /截图无法辨识模型选择器时，可用 focus-model-control/);
    assert.match(definition.description, /不能读取或设置模型值/);
    assert.match(definition.inputSchema.properties.control.description, /仅供 focus-model-control 使用/);
    assert.match(definition.inputSchema.properties.control.description, /只能由后续真实键盘输入改变/);
    await observe(tools);
    await finish(tools, id(await observe(tools)), "blocked");
  });
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
test("未提交判断但已有真实截图时归档为受阻，模型断线仍回收权限", async () => {
  const f = fixture(); let tools;
  const run = await f.run(async (value, session) => {
    tools = value;
    if (!session.beginFinalization()) await observe(value);
  });
  assert.equal(run.status, "blocked");
  assert.deepEqual(run.evidenceAttachmentIds, ["image-1"]);
  assert.equal(run.stepResults.length, 1);
  assert.equal(run.stepResults[0].checkId, "criterion-1");
  assert.equal(run.stepResults[0].status, "blocked");
  assert.equal(run.stepResults[0].screenshotAttachmentId, "image-1");
  assert.match(run.stepResults[0].actual, /未尝试提交 finish/);
  assert.match(f.progress.at(-1), /未通过交互工具提交完整判断/);
  await assert.rejects(observe(tools), /授权已收回/);
  await assert.rejects(f.run(async () => {}), /未留下可归档的真实截图证据/);
  await assert.rejects(f.run(async () => { throw new Error("断线"); }), /断线/);
});
test("首回合遗漏 finish 后只允许终态提交，不能借重试继续操作页面", async () => {
  const f = fixture(); let turn = 0;
  const run = await f.run(async (tools, session) => {
    turn += 1;
    if (turn === 1) {
      const snapshot = id(await observe(tools));
      assert.equal(session.beginFinalization(), true);
      await assert.rejects(observe(tools), /终态回合只允许提交 finish/);
      await finish(tools, snapshot, "blocked");
      return;
    }
    assert.fail("验收器不得自行创建第二个模型回合；运行时负责复用同一会话发送终态提示。");
  });
  assert.equal(run.status, "blocked");
  assert.equal(turn, 1);
  assert.match(f.progress.at(-2), /仅允许 finish/);
});
test("运行时在首回合遗漏 finish 时复用同一服务发送受限终态提示", () => {
  const runtime = readFileSync("electron/system/bootstrap/application-runtime.ts", "utf8");
  assert.match(runtime, /const sendAcceptanceTurn = \(promptId: "hanli\.computer-acceptance" \| "hanli\.computer-acceptance-finalization"\)/);
  assert.match(runtime, /await sendAcceptanceTurn\("hanli\.computer-acceptance"\);[\s\S]*if \(session\.beginFinalization\(\)\)[\s\S]*await sendAcceptanceTurn\("hanli\.computer-acceptance-finalization"\);/);
  assert.match(runtime, /const service = new CodexService[\s\S]*await sendAcceptanceTurn\("hanli\.computer-acceptance-finalization"\);[\s\S]*service\.dispose\(\)/);
});
test("finish 校验被拒绝时在受阻记录中保留受限诊断", async () => {
  const f = fixture();
  const run = await f.run(async (tools) => {
    const snapshot = id(await observe(tools));
    await assert.rejects(tools.call("hanli_computer", {
      action: "finish", reason: "尝试提交不完整判断", observationId: snapshot, findings: [],
    }), /不能漏项/);
  });
  assert.equal(run.status, "blocked");
  assert.match(run.stepResults[0].actual, /尝试提交 finish，但被现有校验拒绝：每条验收条件都必须返回真实结果，不能漏项/);
});
test("旧计划执行器、补参数提示词和桌面接口不兼容退役", () => {
  assert.equal(existsSync("electron/services/personas/hanli/internal/hanli-real-app-acceptance.runner.ts"), false);
  assert.equal(existsSync("prompts/personas/hanli/acceptance-plan.md"), false);
  const api = readFileSync("contracts/system/desktop/api/desktop.api.ts", "utf8");
  assert.doesNotMatch(api, /generateHanLiAcceptancePlan|executeHanLiAcceptancePlan/);
});


test("测试台导航只放行活动栏内固定按钮且继续拒绝危险操作", () => {
  const previous = globalThis.document;
  const check = (label, insideActivityBar, nodeType = "button") => {
    const node = { getAttribute: (key) => key === "aria-label" ? label : null,
      classList: { contains: (name) => name === "activity-test-console" },
      closest: (selector) => selector === ".dev-activitybar .dev-test-console-control" && insideActivityBar ? {} : null,
      matches: (selector) => selector === "button.activity-test-console" && nodeType === "button" };
    globalThis.document = { elementFromPoint: () => ({ closest: () => node }) };
    return acceptanceModule.safeNavigationClick(12, 30);
  };
  try {
    assert.equal(check("打开测试台", true), true);
    assert.equal(check("打开测试台", false), false);
    assert.equal(check("打开测试台", true, "tab"), false);
    assert.equal(check("清空测试数据", true), false);
    assert.equal(check("开启自动托管", true), false);
  } finally { globalThis.document = previous; }
});


test("finish 缺少最新截图编号时仍记录提交被拒绝", async () => {
  const f = fixture();
  const run = await f.run(async (tools) => {
    await observe(tools);
    await assert.rejects(tools.call("hanli_computer", { action: "finish", reason: "提交本轮判断", findings: [] }), /必须基于最新截图/);
  });
  assert.equal(run.status, "blocked");
  assert.match(run.stepResults[0].actual, /尝试提交 finish.*必须基于最新截图/);
  assert.doesNotMatch(run.stepResults[0].actual, /未尝试提交/);
});
