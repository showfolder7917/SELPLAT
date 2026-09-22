// 独立Electron窗口验证原生输入与截图；模型端口为测试驱动，不连接在线模型。
const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const artifactRoot = mkdtempSync(path.join(os.tmpdir(), "selplat-computer-smoke-"));
app.setPath("userData", artifactRoot);
app.whenReady().then(async () => {
  const { HanliComputerAcceptance } = await import(pathToFileURL(path.resolve("../../build/ai-desktop/electron/electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.facade.js")));
  const window = new BrowserWindow({ width: 1000, height: 800, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent('<html><body style="background:#102030;color:white"><button role="tab" style="position:absolute;left:30px;top:30px;width:160px;height:60px" onclick="document.querySelector(\'h1\').textContent=\'实际点击成功\'">韩立</button><h1 style="margin-top:130px">等待点击</h1></body></html>'));
  let n = 0;
  const controller = new HanliComputerAcceptance({ save: async ({ originalDataUrl }) => { const id = `native-shot-${++n}`; writeFileSync(path.join(artifactRoot, id + ".png"), Buffer.from(originalDataUrl.split(",")[1], "base64")); return { id }; } });
  try {
    const result = await controller.run({ topicId: "smoke", proposalId: "smoke", title: "原生点击", criteria: ["按钮实际响应", "按钮布局可见"] }, window, async (tools) => {
      const first = await tools.call("hanli_computer", { action: "observe", reason: "观察冒烟页面" });
      const observationId = JSON.parse(first.contentItems[0].text).observationId;
      const after = await tools.call("hanli_computer", { action: "click", x: 80, y: 60, observationId, criterionIds: ["criterion-1"], reason: "验证真实鼠标输入" });
      assert.equal(await window.webContents.executeJavaScript('document.querySelector("h1").textContent'), "实际点击成功");
      const latest = JSON.parse(after.contentItems[0].text).observationId;
      await assert.rejects(() => tools.call("hanli_computer", { action: "finish", observationId: latest, reason: "不能用首项截图冒充整轮证据", findings: [
        { criterionId: "criterion-1", status: "passed", actual: "原生输入触发页面按钮", evidenceId: latest, layoutStatus: "passed", layoutActual: "按钮响应后仍完整可见", layoutEvidenceId: latest },
        { criterionId: "criterion-2", status: "passed", actual: "错误复用未核对的截图", evidenceId: latest, layoutStatus: "passed", layoutActual: "错误复用未核对的布局截图", layoutEvidenceId: latest },
      ] }), /criterion-2缺少.*该条件自己核对后的真实截图依据/);
      const afterLayout = await tools.call("hanli_computer", { action: "hover", x: 80, y: 60, observationId: latest, criterionIds: ["criterion-2"], reason: "首项通过后继续核对第二项布局" });
      const layoutEvidenceId = JSON.parse(afterLayout.contentItems[0].text).observationId;
      await tools.call("hanli_computer", { action: "finish", observationId: layoutEvidenceId, reason: "一次归档全部条件的独立证据", findings: [
        { criterionId: "criterion-1", status: "passed", actual: "原生输入触发页面按钮", evidenceId: latest, layoutStatus: "passed", layoutActual: "按钮响应后仍完整可见", layoutEvidenceId: latest },
        { criterionId: "criterion-2", status: "passed", actual: "继续核对后按钮保持可见", evidenceId: layoutEvidenceId, layoutStatus: "passed", layoutActual: "按钮完整可见且无遮挡", layoutEvidenceId },
      ] });
    }, () => {}, { allows: (capability) => capability === "persona-navigation" });
    assert.equal(result.status, "passed");
    assert.equal(result.stepResults.length, 2);
    console.log(JSON.stringify({ status: "passed", artifactRoot, screenshots: n, onlineModelTested: false }));
    app.exit(0);
  } finally { if (!window.isDestroyed()) window.destroy(); }
}).catch((error) => { console.error(error); app.exit(1); });
