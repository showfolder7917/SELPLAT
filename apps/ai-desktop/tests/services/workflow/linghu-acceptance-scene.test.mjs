import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

async function sourceModule(file) {
  const { code } = await transform(readFileSync(file, "utf8"), { loader: "ts", format: "esm", target: "es2022" });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
const { parseAcceptanceScenePlan } = await sourceModule("electron/services/personas/linghu/internal/linghu-acceptance-scene.ts");
const { prepareAcceptanceSceneWindow } = await sourceModule("electron/system/ipc/acceptance-scene-window.ts");
const goal = { topicId: "t", proposalId: "p", title: "引导", criteria: ["没有任务时，先告诉我怎么开始", "按钮和说明相邻"] };
const plan = { kind: "empty-task-group", reason: "两个条件需要零任务数据", conditions: [
  { criterionId: "criterion-1", prerequisite: "没有专题任务" },
  { criterionId: "criterion-2", prerequisite: "说明和按钮在同一空页面" },
] };

test("令狐显式选择场景不依赖用户语言、页面名和词序", () => {
  assert.deepEqual(parseAcceptanceScenePlan(JSON.stringify(plan), goal), plan);
  assert.deepEqual(parseAcceptanceScenePlan(JSON.stringify(plan), { ...goal, criteria: ["Empty tasks guidance", "Adjacent button"] }), plan);
});
test("场景缺项、重复、未知类型不能默认进入正式窗口", () => {
  for (const invalid of [{ ...plan, kind: "guess" }, { ...plan, conditions: [] }, { ...plan, conditions: [plan.conditions[0], plan.conditions[0]] }, { ...plan, reason: "" }]) {
    assert.throws(() => parseAcceptanceScenePlan(JSON.stringify(invalid), goal));
  }
});
function fixture(failure) {
  const registered = new Set(), events = [], handlers = {};
  let destroyed = false;
  const window = { webContents: { id: 12, executeJavaScript: async () => failure !== "not-mounted" },
    once: (event, action) => { handlers[event] = action; },
    isDestroyed: () => destroyed, show: () => events.push("show"),
    close: () => { destroyed = true; events.push("close"); handlers.closed?.(); },
    loadFile: async () => { if (failure === "load") throw new Error("load failed"); if (failure === "closed") window.close(); },
  };
  const target = { isDestroyed: () => false, getBounds: () => ({ x: 1, y: 1, width: 1200, height: 800 }) };
  const options = { target, preloadPath: "preload.cjs", rendererRoot: "renderer", sessions: {
    register: (id) => registered.add(id), remove: (id) => registered.delete(id), isActive: (id) => registered.has(id),
  }, createWindow: (settings) => { events.push("create"); assert.equal(settings.webPreferences.partition.startsWith("persist:"), false); return window; } };
  return { options, registered, events, window };
}
test("当前场景沿用原窗口，释放时不关闭原应用", async () => {
  const f = fixture();
  const prepared = await prepareAcceptanceSceneWindow({ ...plan, kind: "current-window" }, f.options);
  assert.equal(prepared.window, f.options.target);
  prepared.dispose();
  assert.deepEqual(f.events, []);
});
test("隔离场景成功后只回收自己登记的窗口，重复清理幂等", async () => {
  const f = fixture();
  const prepared = await prepareAcceptanceSceneWindow(plan, f.options);
  assert.equal(f.registered.size, 1);
  assert.deepEqual(f.events, ["create", "show"]);
  prepared.dispose(); prepared.dispose();
  assert.equal(f.registered.size, 0);
  assert.deepEqual(f.events, ["create", "show", "close"]);
});
test("加载失败、页面未挂载和用户中途关闭都释放临时注册", async () => {
  for (const failure of ["load", "not-mounted", "closed"]) {
    const f = fixture(failure);
    await assert.rejects(prepareAcceptanceSceneWindow(plan, f.options));
    assert.equal(f.registered.size, 0);
    assert.equal(f.events.filter((event) => event === "close").length, 1);
  }
});
test("不支持的场景不启动验收窗口", async () => {
  const f = fixture();
  await assert.rejects(prepareAcceptanceSceneWindow({ ...plan, kind: "blocked" }, f.options));
  assert.deepEqual(f.events, []);
});

test("渲染器无响应时准备超时仍关闭临时窗口", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  f.window.webContents.executeJavaScript = () => new Promise(() => {});
  const pending = prepareAcceptanceSceneWindow(plan, f.options);
  const rejected = assert.rejects(pending, /准备超时/);
  await Promise.resolve();
  t.mock.timers.tick(15000);
  await rejected;
  assert.equal(f.registered.size, 0);
  assert.equal(f.events.filter((event) => event === "close").length, 1);
});
