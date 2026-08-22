import path from "node:path";

import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

let application: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // 每组测试只启动一次后台隔离 Electron，多个交互共用窗口以缩短任务托管耗时。
  const isolatedEnvironment = { ...process.env };
  // 当前 AI Desktop 主进程可能以 Node 模式拉起 Codex；隔离 Electron 必须移除该继承值才能按桌面运行时接受 Playwright 调试参数。
  delete isolatedEnvironment.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({
    args: [path.resolve("tests/interaction/isolated-main.cjs")],
    env: { ...isolatedEnvironment, AI_DESKTOP_INTERACTION_URL: "http://127.0.0.1:4197" },
  });
  page = await application.firstWindow();
  await page.locator(".dev-section-title").getByRole("button", { name: "折叠资源管理器" }).waitFor();
});

test.afterAll(async () => {
  await application?.close();
});

test("任务分区可以程序化展开和折叠", async () => {
  await expect(page.getByText("local Codex 0.149.0")).toBeVisible();
  const taskToggle = page.getByRole("button", { name: "展开任务" });
  await expect(taskToggle).toBeVisible();
  await expect(taskToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#developer-task-list")).toHaveCount(0);

  await taskToggle.click();
  await expect(page.getByRole("button", { name: "折叠任务" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#developer-task-list")).toBeVisible();
  await expect(page.getByText("暂无任务记录")).toBeVisible();

  await page.getByRole("button", { name: "折叠任务" }).click();
  await expect(page.getByRole("button", { name: "展开任务" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#developer-task-list")).toHaveCount(0);
});

test("资源管理器整栏与工作区分区均可折叠恢复", async () => {
  const explorerTitleToggle = page.locator(".explorer-title").getByRole("button", { name: "折叠资源管理器" });
  await explorerTitleToggle.click();
  await expect(page.locator(".developer-shell")).toHaveClass(/explorer-collapsed/);
  await expect(page.locator(".dev-explorer")).not.toBeVisible();

  await page.locator(".dev-activitybar").getByRole("button", { name: "展开资源管理器" }).click();
  await expect(page.locator(".dev-explorer")).toBeVisible();

  await page.getByRole("button", { name: "折叠工作区" }).click();
  await expect(page.locator("#developer-workspace-list")).toHaveCount(0);
  await page.getByRole("button", { name: "展开工作区" }).click();
  await expect(page.locator("#developer-workspace-list")).toBeVisible();
});

test("工作区和任务区只有一条细分隔线", async () => {
  const resizer = page.locator(".workspace-pane-resizer");
  await expect(resizer).toHaveCount(1);
  const metrics = await resizer.evaluate((element) => ({
    hitAreaHeight: element.getBoundingClientRect().height,
    lineHeight: getComputedStyle(element, "::after").height,
  }));
  expect(metrics.hitAreaHeight).toBe(5);
  expect(metrics.lineHeight).toBe("1px");
});

test("窄窗口和常规窗口支持键盘调节与重置且没有横向溢出", async () => {
  const explorerResizer = page.getByRole("separator", { name: "调整资源管理器宽度" });
  const workspaceResizer = page.getByRole("separator", { name: "调整工作区与任务区域高度" });

  await explorerResizer.focus();
  await page.keyboard.press("ArrowRight");
  await expect(explorerResizer).toHaveAttribute("aria-valuenow", "276");
  await page.keyboard.press("Home");
  await expect(explorerResizer).toHaveAttribute("aria-valuenow", "260");

  await workspaceResizer.focus();
  await page.keyboard.press("ArrowUp");
  await expect(workspaceResizer).toHaveAttribute("aria-valuenow", /\d+/);
  await page.keyboard.press("Home");
  await expect(workspaceResizer).not.toHaveAttribute("aria-valuenow", /\d+/);

  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(900, 700));
  await expect(page.locator(".developer-shell")).toBeVisible();
  const narrowOverflow = await page.locator(".workspace-list").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(narrowOverflow).toBeLessThanOrEqual(1);

  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1280, 900));
  await expect(page.locator(".developer-shell")).toBeVisible();
});

test("多个结构化疑问逐题确认后继续原回合并重新展示完整意图", async () => {
  const composer = page.locator(".dev-composer");
  await composer.locator("textarea").fill("需要确认的截图交互");
  await composer.getByRole("button", { name: "发送" }).click();

  const panel = page.locator(".codex-user-input");
  await expect(panel).toBeVisible();
  const firstQuestion = panel.locator("fieldset");
  const firstConfirm = firstQuestion.getByRole("button", { name: "确认" });
  await expect(firstConfirm).toBeDisabled();
  await firstQuestion.getByRole("radio", { name: /原对话框/ }).click();
  await expect(firstConfirm).toBeEnabled();
  await firstConfirm.click();

  await expect(panel.getByText("无红色标注时使用什么提示？")).toBeVisible();
  const secondQuestion = panel.locator("fieldset");
  await secondQuestion.getByRole("radio", { name: "其他" }).click();
  await secondQuestion.getByPlaceholder("请输入答案").fill("只保留附件，不追加提示");
  await secondQuestion.getByRole("button", { name: "确认" }).click();

  await expect(panel).toHaveCount(0);
  await expect(page.getByText("完整意图已根据两个答案重新整理。")).toBeVisible();
  await expect(page.getByRole("button", { name: "就是这意思" })).toBeVisible();
});

test("最新阶段按钮在回复运行中保持可见禁用并在完成后启用", async () => {
  await page.getByRole("button", { name: "就是这意思" }).click();
  const execute = page.getByRole("button", { name: "按这个方案执行" });
  await expect(execute).toBeVisible();
  await expect(execute).toBeDisabled();

  const panel = page.locator(".codex-user-input");
  await panel.getByRole("radio", { name: /原对话框/ }).click();
  await panel.getByRole("button", { name: "确认" }).click();
  await expect(panel.getByText("无红色标注时使用什么提示？")).toBeVisible();
  await panel.getByRole("radio", { name: /不追加提示/ }).click();
  await panel.getByRole("button", { name: "确认" }).click();

  await expect(execute).toBeEnabled();
});

test("Markdown 回答结构清晰且页面重载后恢复，主动新建才清空", async () => {
  await page.getByRole("button", { name: "新建任务" }).click();
  const composer = page.locator(".dev-composer");
  await composer.locator("textarea").fill("markdown-test");
  await composer.getByRole("button", { name: "发送" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "清晰结论" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator(".markdown-message code").filter({ hasText: "thread/resume" })).toBeVisible();
  await page.waitForTimeout(350);

  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: "清晰结论" })).toBeVisible();
  await expect(page.getByText("自然回答")).toBeVisible();

  await page.getByRole("button", { name: "新建任务" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "清晰结论" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "今天要构建什么？" })).toBeVisible();
});

test("屏幕录制权限阻断只显示业务提示并提供系统设置入口", async () => {
  await page.getByRole("button", { name: "截取当前屏幕" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("请在系统设置中允许 AI Desktop 使用屏幕录制权限");
  await expect(alert).not.toContainText("Error invoking remote method");
  const openSettings = alert.getByRole("button", { name: "打开系统设置" });
  await expect(openSettings).toBeVisible();
  await openSettings.click();
  await expect(alert).toBeVisible();
});
