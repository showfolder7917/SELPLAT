const { app, BrowserWindow, ipcMain } = require("electron");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const root = mkdtempSync(path.join(os.tmpdir(), "selplat-real-sending-"));
app.setPath("userData", path.join(root, "user-data"));
process.env.AI_DESKTOP_INTERACTION_PROJECT_ROOT = path.resolve("../..");
process.env.AI_DESKTOP_INTERACTION_ACCEPTANCE_SESSION = "1";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const base = path.resolve("../../build/ai-desktop/electron/electron");
  const { AcceptanceEmptyTaskGroupSession } = await import(pathToFileURL(path.join(base, "system/ipc/acceptance-empty-task-group-session.js")));
  const { HanliComputerAcceptance } = await import(pathToFileURL(path.join(base, "services/personas/hanli/internal/acceptance/hanli-computer-acceptance.js")));
  const session = new AcceptanceEmptyTaskGroupSession();
  const window = new BrowserWindow({ width: 1200, height: 850, show: true,
    webPreferences: { preload: path.join(__dirname, "isolated-preload.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false } });
  window.webContents.on("console-message", (_event, _level, message) => console.error("Renderer:", message));
  const wid = window.webContents.id;
  session.register(wid, "persona-conversation-lifecycle");
  ipcMain.handle("interaction:acceptance-conversation", (event, persona) => {
    assert.equal(event.sender.id, wid);
    return session.conversationWindow(wid, persona);
  });
  ipcMain.handle("interaction:acceptance-send", (event, persona, request) => {
    assert.equal(event.sender.id, wid);
    return session.sendPersonaConversationMessage(wid, persona, request);
  });
  window.on("closed", () => session.remove(wid));
  await window.loadFile(path.resolve("../../build/ai-desktop/renderer/developer/index.html"));
  async function waitFor(script) {
    for (let i = 0; i < 100; i++) {
      if (await window.webContents.executeJavaScript(script)) return;
      await pause(100);
    }
    throw new Error("真实页面条件未出现: " + script + "\n" + await window.webContents.executeJavaScript("document.body.innerText"));
  }
  await waitFor('Boolean([...document.querySelectorAll("button")].find(b => b.textContent === "协同模式"))');
  await window.webContents.executeJavaScript('[...document.querySelectorAll("button")].find(b => b.textContent === "协同模式").click()');
  await waitFor('Boolean([...document.querySelectorAll("button")].find(b => b.textContent.includes("韩立")))');
  await window.webContents.executeJavaScript('[...document.querySelectorAll("button")].find(b => b.textContent.includes("韩立")).click()');
  await waitFor('Boolean(document.querySelector(\'textarea[aria-label="给韩立发送消息"]\'))');
  let n = 0;
  const snapshots = [];
  const controller = new HanliComputerAcceptance({ save: async ({ originalDataUrl }) => {
    const text = await window.webContents.executeJavaScript("document.body.innerText");
    const id = "real-" + (++n);
    snapshots.push({ id, sending: text.includes("发送中"), received: text.includes("验收场景已收到当前人物消息。") });
    writeFileSync(path.join(root, id + ".png"), Buffer.from(originalDataUrl.split(",")[1], "base64"));
    return { id };
  }});
  try {
    await controller.run({ topicId: "isolated", proposalId: "isolated", title: "真实发送观察", criteria: ["发送状态实际可见"] }, window, async tools => {
      const first = await tools.call("hanli_computer", { action: "observe", reason: "观察正式Renderer" });
      const observationId = JSON.parse(first.contentItems[0].text).observationId;
      const sent = await tools.call("hanli_computer", { action: "send-test-message", observationId, reason: "验证真实发送忙碌截图" });
      assert.equal(snapshots[1]?.sending, true, JSON.stringify({ snapshots, sent }));
      assert.equal(snapshots[1]?.received, false);
      await waitFor('document.body.innerText.includes("验收场景已收到当前人物消息。")');
      const after = await tools.call("hanli_computer", { action: "observe", reason: "观察发送完成" });
      assert.equal(snapshots[2].sending, false);
      assert.equal(snapshots[2].received, true);
      await tools.call("hanli_computer", { action: "finish", observationId: JSON.parse(after.contentItems[0].text).observationId,
        reason: "独立发送回归完成", findings: [{ criterionId: "criterion-1", status: "passed", actual: "真实Renderer先发送中后完成", evidenceId: snapshots[1].id, layoutStatus: "passed", layoutActual: "发送反馈位于会话中", layoutEvidenceId: snapshots[1].id }] });
    }, () => {}, { allows: action => session.allowsComputerAction(wid, action),
      captureObservationReceipt: () => session.capturePersonaSendingObservation(wid) });
    console.log(JSON.stringify({ status: "passed", root, snapshots, formalDataTouched: false }));
  } finally { window.destroy(); }
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
