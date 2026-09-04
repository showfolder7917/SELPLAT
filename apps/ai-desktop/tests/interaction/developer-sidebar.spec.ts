import path from "node:path";
import { pathToFileURL } from "node:url";

import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

let application: ElectronApplication;
let page: Page;
const productionRendererFile = path.resolve("../../build/ai-desktop/renderer/developer/index.html");
test.beforeAll(async () => {
  // 冷缓存首次转换生产资源时 Electron 建连可能超过单项交互的 15 秒时限；只放宽一次性启动钩子。
  test.setTimeout(45_000);
  // 每组测试只启动一次后台隔离 Electron，多个交互共用窗口以缩短任务托管耗时。
  const isolatedEnvironment = { ...process.env };
  // 当前 AI Desktop 主进程可能以 Node 模式拉起 Codex；隔离 Electron 必须移除该继承值才能按桌面运行时接受 Playwright 调试参数。
  delete isolatedEnvironment.ELECTRON_RUN_AS_NODE;
  // 宿主调试器的暂停和注入配置会阻断 Playwright 自己建立的 --inspect/远程调试握手。
  delete isolatedEnvironment.NODE_OPTIONS;
  delete isolatedEnvironment.NODE_INSPECT_RESUME_ON_START;
  delete isolatedEnvironment.VSCODE_INSPECTOR_OPTIONS;
  application = await electron.launch({
    args: [path.resolve("tests/interaction/isolated-main.cjs")],
    env: { ...isolatedEnvironment, AI_DESKTOP_INTERACTION_FILE: productionRendererFile },
  });
  page = await application.firstWindow();
  await page.locator(".dev-section-title").getByRole("button", { name: "折叠资源管理器" }).waitFor();
});

test.afterAll(async () => {
  await application?.close();
});

test("切换工作区与任务时只展开当前分区并置顶占满", async () => {
  // 永久 CONTEXT 已由人物可调业务右栏替代；侧栏分区测试不得再依赖被删除的静态版本信息。
  await expect(page.locator(".dev-context")).toHaveCount(0);
  await expect(page.locator(".dev-brand").getByText("AI Desktop", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "折叠工作区" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#developer-workspace-list")).toBeVisible();
  const taskToggle = page.getByRole("button", { name: "展开任务" });
  await expect(taskToggle).toBeVisible();
  await expect(taskToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#developer-task-list")).toHaveCount(0);

  await taskToggle.click();
  await expect(page.getByRole("button", { name: "折叠任务" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "展开工作区" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#developer-workspace-list")).toHaveCount(0);
  await expect(page.locator("#developer-task-list")).toBeVisible();
  await expect(page.locator("#developer-task-list").getByText("暂无任务记录", { exact: true })).toBeVisible();

  const sections = page.locator("#developer-explorer-sections");
  const tasksPane = page.locator(".tasks-pane");
  const workspacePane = page.locator(".workspace-pane");
  const [sectionsBounds, tasksBounds, workspaceBounds] = await Promise.all([
    sections.boundingBox(),
    tasksPane.boundingBox(),
    workspacePane.boundingBox(),
  ]);
  if (!sectionsBounds || !tasksBounds || !workspaceBounds) throw new Error("侧栏分区缺少可视边界。");
  expect(tasksBounds.y).toBeLessThan(workspaceBounds.y);
  expect(Math.abs(tasksBounds.height - (sectionsBounds.height - workspaceBounds.height))).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "展开工作区" }).click();
  await expect(page.getByRole("button", { name: "折叠工作区" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#developer-workspace-list")).toBeVisible();
  await expect(page.getByRole("button", { name: "展开任务" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#developer-task-list")).toHaveCount(0);
});

test("AI Memory 恢复状态显示明确提示且不暴露数据库路径", async () => {
  await page.goto(`${pathToFileURL(productionRendererFile).href}?interactionAiMemoryState=recovery-required`);
  const recovery = page.getByRole("alert").filter({ hasText: "AI Memory 数据库已停用" });
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText("数据库丢失");
  await expect(recovery).not.toContainText("/Users/");
  await expect(page.locator(".dev-statusbar")).toContainText("AI Memory 待恢复");

  await page.goto(pathToFileURL(productionRendererFile).href);
  await expect(page.locator(".ai-memory-recovery")).toHaveCount(0);
  await expect(page.locator(".dev-statusbar")).toContainText("AI Memory v1000 · 统一事件中心");
});

test("新建任务入口位于聊天标签且不再占用任务标题", async () => {
  const tab = page.locator(".seltabs-panel:not([hidden]) .developer-page-actions");
  const title = page.getByRole("tab", { name: "Codex Chat", exact: true });
  const newTask = tab.getByRole("button", { name: "重新建立一个 Codex 会话" });
  const closeIcon = page.getByRole("button", { name: "关闭Codex Chat", exact: true });
  await expect(closeIcon).toHaveText("×");
  await expect(newTask).toBeVisible();
  await expect(newTask).toHaveAttribute("data-sel-tooltip", "重新建立一个 Codex 会话");
  await expect(newTask).not.toHaveAttribute("title", /.+/);
  await expect(newTask.locator("svg")).toBeVisible();
  await expect(page.locator(".dev-section-title.tasks").getByRole("button", { name: "重新建立一个 Codex 会话" })).toHaveCount(0);

  const [titleBounds, newTaskBounds, closeBounds] = await Promise.all([
    title.boundingBox(),
    newTask.boundingBox(),
    closeIcon.boundingBox(),
  ]);
  if (!titleBounds || !newTaskBounds || !closeBounds) throw new Error("聊天标签的新建任务入口缺少可视边界。");
  expect(closeBounds.width).toBeGreaterThanOrEqual(20);
  expect(closeBounds.height).toBeGreaterThanOrEqual(20);
  expect(Math.abs(newTaskBounds.y - closeBounds.y)).toBeLessThanOrEqual(8);

  await newTask.hover();
  const hoverTip = page.locator("#seltooltip-shared-portal");
  await expect(hoverTip).toBeVisible();
  await expect(hoverTip).toHaveText("重新建立一个 Codex 会话");

  await page.locator(".dev-main").hover({ position: { x: 12, y: 120 } });
  await newTask.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(newTask).toBeFocused();
  await expect.poll(() => newTask.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
  await expect(hoverTip).toBeVisible();
});

test("未登录时设置面板的登录主操作文字可见并使用主题对比色", async () => {
  await page.evaluate(() => (window as unknown as { desktop: { setInteractionAuthenticated(authenticated: boolean): Promise<void> } }).desktop.setInteractionAuthenticated(false));
  // 生产界面按固定周期读取官方账号状态；测试等待同一刷新链路生效，不通过重载伪造状态。
  const emptyState = page.locator(".dev-empty");
  await expect(emptyState.getByText("请先登录 ChatGPT", { exact: true })).toBeVisible({ timeout: 5_000 });
  const primaryLoginButton = emptyState.getByRole("button", { name: "使用 ChatGPT 登录" });
  await expect(primaryLoginButton).toBeVisible();
  await expect(primaryLoginButton).toBeEnabled();
  await primaryLoginButton.click();
  await expect(emptyState.getByText("请在浏览器中完成登录", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "连接与执行设置" }).click();
  const account = page.locator(".dev-account");
  const loginButton = account.getByRole("button", { name: "使用 ChatGPT 登录" });
  await expect(account.locator("small")).toBeVisible();
  await expect(loginButton).toBeVisible();
  await expect(loginButton.locator("span")).toHaveText("使用 ChatGPT 登录");
  const presentation = await loginButton.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const label = element.querySelector("span");
    const panel = element.closest(".dev-settings");
    const accountElement = element.closest(".dev-account");
    const runtime = accountElement?.querySelector("small");
    const panelBounds = panel?.getBoundingClientRect();
    const accountBounds = accountElement?.getBoundingClientRect();
    const buttonBounds = element.getBoundingClientRect();
    const labelBounds = label?.getBoundingClientRect();
    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
      labelColor: label ? window.getComputedStyle(label).color : "",
      width: buttonBounds.width,
      height: buttonBounds.height,
      panelClientWidth: panel?.clientWidth ?? 0,
      panelScrollWidth: panel?.scrollWidth ?? 0,
      runtimeClientWidth: runtime?.clientWidth ?? 0,
      runtimeScrollWidth: runtime?.scrollWidth ?? 0,
      accountLeft: accountBounds?.left ?? 0,
      accountRight: accountBounds?.right ?? 0,
      buttonLeft: buttonBounds.left,
      buttonRight: buttonBounds.right,
      labelLeft: labelBounds?.left ?? 0,
      labelRight: labelBounds?.right ?? 0,
      panelLeft: panelBounds?.left ?? 0,
      panelRight: panelBounds?.right ?? 0,
    };
  });
  expect(presentation.labelColor).toBe(presentation.color);
  expect(presentation.color).not.toBe(presentation.backgroundColor);
  expect(presentation.width).toBeGreaterThan(120);
  expect(presentation.height).toBeGreaterThanOrEqual(32);
  expect(presentation.panelScrollWidth).toBeLessThanOrEqual(presentation.panelClientWidth + 1);
  expect(presentation.runtimeScrollWidth).toBeLessThanOrEqual(presentation.runtimeClientWidth + 1);
  expect(presentation.accountLeft).toBeGreaterThanOrEqual(presentation.panelLeft - 0.5);
  expect(presentation.accountRight).toBeLessThanOrEqual(presentation.panelRight + 0.5);
  expect(presentation.buttonLeft).toBeGreaterThanOrEqual(presentation.accountLeft - 0.5);
  expect(presentation.buttonRight).toBeLessThanOrEqual(presentation.accountRight + 0.5);
  expect(presentation.labelLeft).toBeGreaterThanOrEqual(presentation.buttonLeft - 0.5);
  expect(presentation.labelRight).toBeLessThanOrEqual(presentation.buttonRight + 0.5);
  await page.evaluate(() => (window as unknown as { desktop: { setInteractionAuthenticated(authenticated: boolean): Promise<void> } }).desktop.setInteractionAuthenticated(true));
  await expect(page.locator(".dev-empty").getByText("Codex harness 已连接", { exact: true })).toBeVisible({ timeout: 5_000 });
  // 每条交互用例必须恢复自己的浮层状态，避免设置面板遮挡后续任务区操作。
  await page.getByRole("button", { name: "关闭连接与执行设置" }).click();
});

test("全局模型设置复用 Harness 模型能力并同时保存强度与速度", async () => {
  await page.getByRole("button", { name: "打开连接与执行设置" }).click();
  const model = page.getByRole("combobox", { name: "默认模型" });
  const effort = page.getByRole("combobox", { name: "推理强度" });
  const speed = page.getByRole("combobox", { name: "推理速度" });
  await expect(model).toHaveValue("gpt-5.6-terra");
  await expect(model.locator("option")).toContainText(["Codex 默认", "5.6 Sol · OpenAI", "5.6 Terra · OpenAI"]);
  await expect(effort.locator("option")).toContainText(["模型默认", "低", "中", "高", "超高", "最大"]);
  await effort.selectOption("high");
  await speed.selectOption("fast");
  await expect(effort).toHaveValue("high");
  await expect(speed).toHaveValue("fast");
  await expect(page.getByText("对所有会话与协同任务生效", { exact: true })).toBeVisible();
  await expect(page.locator(".model-settings-card")).not.toHaveCSS("overflow-x", "scroll");
  await page.getByRole("button", { name: "关闭连接与执行设置" }).click();
});

test("Codex 桌面聊天训练入库由用户显式开启并说明采集边界", async () => {
  await page.getByRole("button", { name: "打开连接与执行设置" }).click();
  const card = page.locator(".corpus-ingestion-card");
  await expect(card).toContainText("只将当前 SELPLAT 工作区中已经完成的每轮可见对话入库");
  const toggle = card.getByRole("button", { name: "开启入库" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(card.getByRole("button", { name: "停止入库" })).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByText("已开启", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "停止入库" }).click();
  await expect(card.getByRole("button", { name: "开启入库" })).toHaveAttribute("aria-pressed", "false");
  const backfill = card.getByRole("button", { name: "一键补齐历史 AI 摘要" });
  await expect(backfill).toBeVisible();
  await backfill.click();
  await expect(card.getByRole("status")).toContainText("补齐完成：新增 2 条 AI 摘要。");
  await page.getByRole("button", { name: "关闭连接与执行设置" }).click();
});

test("一键清空测试数据必须二次确认且明确保留范围", async () => {
  await page.getByRole("button", { name: "打开连接与执行设置" }).click();
  const resetButton = page.getByRole("button", { name: "一键清空测试数据" });
  await expect(resetButton).toBeVisible();
  await expect(page.getByText("数据库中的测试专题、任务、审批、事件和运行状态")).toBeVisible();
  // 打开设置后入口必须直接位于首屏，不能依赖用户猜测面板还可以继续向下滚动。
  await expect(resetButton).toBeInViewport();
  await expect(page.locator(".dev-account").locator("xpath=following-sibling::*[1]")).toHaveClass(/test-data-reset-card/);
  await expect(page.getByText("保留人物对话、训练记忆、登录、设置、工作区、规则和源码；完成后自动重启应用。")).toBeVisible();

  await resetButton.click();
  let dialog = page.getByRole("dialog", { name: "一键清空测试数据" });
  await expect(dialog).toContainText("此操作不可撤销");
  await expect(dialog).toContainText("不会删除人物对话、训练记忆、登录、设置、工作区、可信命令、规则、源码和工程审计文件");
  await dialog.getByRole("button", { name: "取消" }).click();
  await page.getByRole("button", { name: "打开连接与执行设置" }).click();
  const reopenedResetButton = page.getByRole("button", { name: "一键清空测试数据" });
  await expect(reopenedResetButton).toBeEnabled();

  await reopenedResetButton.click();
  dialog = page.getByRole("dialog", { name: "一键清空测试数据" });
  await dialog.getByRole("button", { name: "一键清空测试数据" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.interactionTestDataReset)).toBe("true");
  await expect(page.getByRole("dialog", { name: "一键清空测试数据" })).toHaveCount(0);
});

test("生产构建在正式默认、实际复现和最小窗口中保持设置入口与面板定位", async () => {
  const sizes = [
    { name: "正式默认", width: 1560, height: 980 },
    { name: "标准窗口", width: 1366, height: 768 },
    { name: "正式最小", width: 1000, height: 700 },
  ];
  for (const size of sizes) {
    await application.evaluate(({ BrowserWindow }, nextSize) => BrowserWindow.getAllWindows()[0]?.setSize(nextSize.width, nextSize.height), size);
    await expect.poll(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getSize())).toEqual([size.width, size.height]);
    const contentSize = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getContentSize());
    if (!contentSize) throw new Error(`${size.name}窗口无法读取真实内容尺寸。`);
    await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual(contentSize);
    const trigger = page.getByRole("button", { name: "打开连接与执行设置" });
    await trigger.click();
    const metrics = await page.locator(".dev-settings").evaluate((panel, expectedName) => {
      const triggerElement = document.querySelector<HTMLElement>(".dev-settings-control > .activity-settings");
      const title = panel.querySelector<HTMLElement>(".selfloating-heading-copy strong");
      if (!triggerElement || !title) throw new Error(`${expectedName}窗口缺少设置入口或标题。`);
      const triggerBounds = triggerElement.getBoundingClientRect();
      const panelBounds = panel.getBoundingClientRect();
      const titleBounds = title.getBoundingClientRect();
      const actionButtons = [...panel.querySelectorAll<HTMLElement>(".temp-card button")].map((button) => {
        const bounds = button.getBoundingClientRect();
        return {
          inside: bounds.left >= panelBounds.left - 0.5 && bounds.right <= panelBounds.right + 0.5,
          overflow: button.scrollWidth - button.clientWidth,
        };
      });
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        triggerLeft: triggerBounds.left,
        triggerTop: triggerBounds.top,
        triggerBottom: triggerBounds.bottom,
        panelLeft: panelBounds.left,
        panelRight: panelBounds.right,
        panelBottom: panelBounds.bottom,
        panelClientWidth: panel.clientWidth,
        panelScrollWidth: panel.scrollWidth,
        titleWidth: titleBounds.width,
        titleHeight: titleBounds.height,
        titleWritingMode: window.getComputedStyle(title).writingMode,
        actionButtonsInside: actionButtons.every((button) => button.inside),
        maximumActionButtonOverflow: Math.max(0, ...actionButtons.map((button) => button.overflow)),
      };
    }, size.name);
    expect(metrics.triggerLeft, `${size.name}窗口的设置按钮必须锚定左侧`).toBeLessThanOrEqual(1);
    expect(metrics.triggerTop, `${size.name}窗口的设置按钮不能跑到上半区`).toBeGreaterThan(metrics.viewportHeight / 2);
    expect(Math.abs(metrics.viewportHeight - metrics.triggerBottom - 22), `${size.name}窗口的设置按钮必须锚定左下`).toBeLessThanOrEqual(1);
    expect(metrics.panelLeft, `${size.name}窗口的设置面板必须从活动栏右侧开始`).toBeGreaterThanOrEqual(57);
    expect(metrics.panelRight, `${size.name}窗口的设置面板不能超出桌面`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(Math.abs(metrics.viewportHeight - metrics.panelBottom), `${size.name}窗口的设置面板必须贴合底部`).toBeLessThanOrEqual(1);
    expect(metrics.panelScrollWidth, `${size.name}窗口的设置面板不能横向溢出`).toBeLessThanOrEqual(metrics.panelClientWidth + 1);
    expect(metrics.titleWritingMode).toBe("horizontal-tb");
    expect(metrics.titleWidth, `${size.name}窗口的设置标题不能竖排`).toBeGreaterThan(metrics.titleHeight * 3);
    expect(metrics.actionButtonsInside, `${size.name}窗口的设置操作不能跑出面板`).toBe(true);
    expect(metrics.maximumActionButtonOverflow, `${size.name}窗口的设置操作文字不能溢出`).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "关闭连接与执行设置" }).click();
  }
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1560, 980));
});

test("协同模式列出稳定人物并以人物名打开独立工作页", async () => {
  await page.getByRole("button", { name: "展开任务" }).click();
  const taskList = page.locator("#developer-task-list");
  await taskList.getByRole("button", { name: "协同模式" }).click();
  await expect(taskList.locator(".collaboration-member")).toHaveCount(12);
  await expect(taskList.getByRole("button", { name: /韩立/ })).toBeVisible();
  await expect(taskList.getByRole("button", { name: /李化元/ })).toBeVisible();

  await taskList.getByRole("button", { name: /宋玉/ }).click();
  await expect(page.getByRole("tablist").getByText("宋玉", { exact: true })).toBeVisible();
  const memberPage = page.locator(".collaboration-member-page:visible");
  await expect(memberPage.getByText("当前空闲", { exact: true })).toBeVisible();
  await expect(memberPage.getByText("收到任务时才会创建新的 Codex。", { exact: true })).toBeVisible();
  const overflow = await memberPage.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await taskList.getByRole("button", { name: /韩立/ }).click();
  await expect(page.getByRole("tablist").getByText("韩立", { exact: true })).toBeVisible();
  const hanliConversation = page.locator(".hanli-person-chat");
  await expect(hanliConversation.getByText("和韩立讨论客户真正需要什么", { exact: true })).toBeVisible();
  const hanliComposer = page.locator(".hanli-person-composer");
  await hanliComposer.getByRole("textbox", { name: "给韩立发送消息" }).fill("结合整理后的资料，告诉我现在最关键的目标。");
  await hanliComposer.getByRole("button", { name: "发送给韩立" }).click();
  await taskList.getByRole("button", { name: /南宫婉/ }).click();
  await taskList.getByRole("button", { name: /韩立/ }).click();
  await expect(hanliConversation.getByText("结合整理后的资料，告诉我现在最关键的目标。", { exact: true })).toBeVisible();
  await expect(hanliConversation.getByText("我 · 发送中", { exact: true })).toBeVisible();
  await expect(hanliComposer.getByRole("button", { name: "思考中" })).toBeDisabled();
  await expect(hanliConversation.getByText("我会结合整理后的客户语义资料回答；只有真实决策缺口才继续追问。", { exact: true })).toBeVisible();
  await expect(hanliConversation.getByText("若确认由韩立与南宫婉开始内部研讨并持续自动演化，请回复 1。", { exact: true })).toBeVisible();
  await hanliComposer.getByRole("textbox", { name: "给韩立发送消息" }).fill("1");
  await hanliComposer.getByRole("button", { name: "发送给韩立" }).click();
  await expect(hanliComposer.getByRole("button", { name: "发送给韩立" })).toBeVisible();
  await expect(hanliConversation.getByText("韩立 · 内部研讨", { exact: true })).toHaveCount(0);
  await expect(hanliConversation.getByText("南宫婉 · 内部研讨", { exact: true })).toHaveCount(0);
  await expect(hanliConversation.getByText("当前需求最关键的验收边界是什么？", { exact: true })).toHaveCount(0);
  await expect(hanliConversation.getByText("验收时需确认内部一问一答可见，且不写入用户语义资料。", { exact: true })).toHaveCount(0);
  await expect(hanliConversation.getByText("结合整理后的资料，告诉我现在最关键的目标。", { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("hanli-direct-conversation-only.png"), fullPage: true });
  await taskList.getByRole("button", { name: /南宫婉/ }).click();
  const nangongConversation = page.locator(".nangong-person-chat");
  // 人物直接会话不混入内部研讨正文；研讨历史默认折叠，但可独立查看。
  const internalHistory = nangongConversation.getByRole("button", { name: "内部研讨历史（2）" });
  await expect(internalHistory).toBeVisible();
  await expect(internalHistory).toHaveAttribute("aria-expanded", "false");
  await expect(nangongConversation.getByText("韩立 · 内部研讨", { exact: true })).toBeHidden();
  await expect(nangongConversation.getByText("南宫婉 · 内部研讨", { exact: true })).toBeHidden();
  // 新建的是南宫婉的直接会话；旧研讨不能重新进入正文，但仍能按需展开查阅。
  await page.getByRole("button", { name: "重新建立南宫婉对话" }).click();
  await expect(nangongConversation.getByRole("status")).toHaveText("已建立新的空白对话。");
  await expect(nangongConversation.getByText("和南宫婉讨论演化方向", { exact: true })).toBeVisible();
  await expect(nangongConversation.getByText("韩立 · 内部研讨", { exact: true })).toBeHidden();
  await expect(nangongConversation.getByText("南宫婉 · 内部研讨", { exact: true })).toBeHidden();
  await internalHistory.click();
  await expect(internalHistory).toHaveAttribute("aria-expanded", "true");
  await expect(nangongConversation.getByText("韩立 · 内部研讨", { exact: true })).toBeVisible();
  await expect(nangongConversation.getByText("南宫婉 · 内部研讨", { exact: true })).toBeVisible();
  await expect(nangongConversation.getByText("验收时需确认内部一问一答可见，且不写入用户语义资料。", { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("shared-persona-deliberation.png"), fullPage: true });
  await taskList.getByRole("button", { name: "单会话" }).click();
  await page.getByRole("button", { name: "展开工作区" }).click();
});

test("南宫婉会话保留自动演化入口且演化工作台已不兼容退役", async () => {
  await page.getByRole("button", { name: "展开任务" }).click();
  const taskList = page.locator("#developer-task-list");
  await taskList.getByRole("button", { name: "协同模式" }).click();
  await taskList.getByRole("button", { name: /南宫婉/ }).click();
  const conversation = page.locator(".nangong-person-chat");
  await expect(page.getByRole("button", { name: "打开专题演化工作台" })).toHaveCount(0);
  await expect(page.locator(".evolution-control-workspace, .evolution-window-shell")).toHaveCount(0);
  expect(application.windows()).toHaveLength(1);
  await taskList.getByRole("button", { name: "单会话" }).click();
  await page.getByRole("button", { name: "展开工作区" }).click();
});

test("令狐老祖位于南宫婉下方并可管理持续自动保障启动文案", async () => {
  test.setTimeout(60_000);
  await page.getByRole("button", { name: "展开任务" }).click();
  const taskList = page.locator("#developer-task-list");
  await taskList.getByRole("button", { name: "协同模式" }).click();
  const names = await taskList.locator(".collaboration-member > span").allTextContents();
  expect(names.slice(0, 3).map((name) => name.trim())).toEqual(["韩立", "南宫婉", "令狐老祖"]);

  await taskList.getByRole("button", { name: /令狐老祖/ }).click();
  const panel = page.locator(".linghu-automation");
  await expect(panel.getByText("自动运行最后保障", { exact: true })).toBeVisible();
  const automation = panel.getByRole("switch");
  await expect(automation).toHaveAttribute("aria-checked", "false");
  await automation.click();
  await expect(automation).toHaveAttribute("aria-checked", "true");
  await expect(panel.getByText("开启后每30秒持续检测，永远不会自行停止。", { exact: true })).toBeVisible();
  await expect(panel.getByText("自动流程完成保障", { exact: true })).toBeVisible();
  await expect(panel).toContainText("第二职责是检查测试漏点");
  await expect(panel).toContainText("第三职责是检查日志审计完整性");
  await expect(panel).not.toContainText("页面审核以客户易用为第一目标");

  await panel.getByRole("button", { name: "新增启动文案" }).click();
  await panel.getByLabel("文案名称").fill("测试漏点巡检");
  await panel.getByLabel("启动内容").fill("检查主路径、异常路径和并发路径的测试漏点，并补充审计证据。");
  await panel.getByRole("button", { name: "保存文案" }).click();
  const prompt = panel.locator(".linghu-prompt-list article").filter({ hasText: "测试漏点巡检" });
  await expect(prompt).toContainText("当前使用");
  await prompt.getByRole("button", { name: "停用" }).click();
  await expect(prompt).toContainText("已停用");
  await prompt.getByRole("button", { name: "启用" }).click();
  await prompt.getByRole("button", { name: "修改" }).click();
  await panel.getByLabel("文案名称").fill("测试与审计巡检");
  await panel.getByRole("button", { name: "保存文案" }).click();
  const renamed = panel.locator(".linghu-prompt-list article").filter({ hasText: "测试与审计巡检" });
  await expect(renamed).toBeVisible();

  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1000, 700));
  const overflow = await page.locator(".collaboration-member-page:visible").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await renamed.getByRole("button", { name: "删除" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "删除启动文案" });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "确认", exact: true }).click();
  await expect(renamed).toHaveCount(0);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1560, 980));
  await taskList.getByRole("button", { name: "单会话" }).click();
  await page.getByRole("button", { name: "展开工作区" }).click();
});

test("执行人物完成技术分析后直接实施且不再出现内部审批", async () => {
  await page.evaluate(() => (window as unknown as { desktop: { setInteractionCollaborationExecutionFixture(active: boolean): Promise<void> } }).desktop.setInteractionCollaborationExecutionFixture(true));
  await page.getByRole("button", { name: "展开任务" }).click();
  const taskList = page.locator("#developer-task-list");
  await taskList.getByRole("button", { name: "协同模式" }).click();
  await expect(taskList.getByRole("button", { name: /执行列表/ })).toHaveCount(0);
  await taskList.getByRole("button", { name: /任务协作群/ }).click();
  await page.getByRole("button", { name: "修复协同归档展示", exact: true }).click();
  const detail = page.locator(".collaboration-task-detail:visible");
  const intentStage = detail.locator(".task-progress-stage").filter({ hasText: /^意图分析/ });
  await intentStage.locator("summary").click();
  await expect(intentStage.getByText("增加任务归档入口和结构化摘要。", { exact: true })).toBeVisible();
  await expect(detail.locator(".task-progress-stage").filter({ hasText: /^审批/ })).toHaveCount(0);
  const executionStage = detail.locator(".task-progress-stage").filter({ hasText: /^执行/ });
  await executionStage.locator("summary").click();
  await expect(executionStage.locator(".task-stage-record header strong").filter({ hasText: /^冰魄仙子$/ })).toBeVisible();
  await page.evaluate(() => (window as unknown as { desktop: { setInteractionCollaborationExecutionFixture(active: boolean): Promise<void> } }).desktop.setInteractionCollaborationExecutionFixture(false));
  await taskList.getByRole("button", { name: "单会话" }).click();
  await page.getByRole("button", { name: "展开工作区" }).click();
});

test("执行列表退役后从协作群打开归档任务完整结果", async () => {
  await page.evaluate(() => (window as unknown as { desktop: { setInteractionCollaborationExecutionFixture(active: boolean): Promise<void> } }).desktop.setInteractionCollaborationExecutionFixture(true));
  await page.getByRole("button", { name: "展开任务" }).click();
  const taskList = page.locator("#developer-task-list");
  await taskList.getByRole("button", { name: "协同模式" }).click();
  await expect(taskList.getByRole("button", { name: /执行列表/ })).toHaveCount(0);
  await taskList.getByRole("button", { name: /任务协作群/ }).click();

  await page.getByRole("button", { name: "修复协同归档展示", exact: true }).click();
  const detail = page.locator(".collaboration-task-detail:visible");
  await expect(detail.getByText("任务结果", { exact: true })).toBeVisible();
  await expect(detail.getByText("执行列表与结果摘要已完成。", { exact: true })).toBeVisible();
  await expect(detail.locator(".task-fact-strip").getByText("宋玉、冰魄仙子", { exact: true })).toBeVisible();
  const executionStage = detail.locator(".task-progress-stage").filter({ hasText: /^执行/ });
  await executionStage.locator("summary").click();
  await expect(executionStage.locator(".task-stage-record header strong").filter({ hasText: /^宋玉$/ })).toBeVisible();
  await expect(executionStage.locator(".task-stage-record header strong").filter({ hasText: /^冰魄仙子$/ })).toBeVisible();

  await page.evaluate(() => (window as unknown as { desktop: { setInteractionCollaborationExecutionFixture(active: boolean): Promise<void> } }).desktop.setInteractionCollaborationExecutionFixture(false));
  await taskList.getByRole("button", { name: "单会话" }).click();
  await page.getByRole("button", { name: "展开工作区" }).click();
});

test("任务协作群按真实顺序追加节点并覆盖人工审批、十人并行和独立展开", async ({}, testInfo) => {
  await page.evaluate(() => (window as unknown as { desktop: { setInteractionTaskTimelineFixture(active: boolean): Promise<void> } }).desktop.setInteractionTaskTimelineFixture(true));
  await page.getByRole("button", { name: "展开任务" }).click();
  const taskList = page.locator("#developer-task-list");
  await taskList.getByRole("button", { name: "协同模式" }).click();
  await expect(taskList.getByRole("button", { name: /执行列表/ })).toHaveCount(0);
  const taskGroupEntry = taskList.getByRole("button", { name: /任务协作群/ });
  await expect(taskGroupEntry).toBeVisible();
  const [taskGroupBounds, hanLiBounds] = await Promise.all([
    taskGroupEntry.boundingBox(), taskList.getByRole("button", { name: /韩立/ }).boundingBox(),
  ]);
  if (!taskGroupBounds || !hanLiBounds) throw new Error("任务协作群侧栏顺序缺少可视边界。");
  expect(taskGroupBounds.y).toBeLessThan(hanLiBounds.y);
  await taskGroupEntry.click();

  const pageRoot = page.getByRole("region", { name: "任务协作群" });
  const group = pageRoot.locator(".task-collaboration-group");
  await expect(group.getByText("专题任务 01 · 修订截图按钮可用态", { exact: true })).toBeVisible();
  const groupTrigger = group.locator(":scope > .selui-disclosure-heading > .seldisclosure-trigger");
  await groupTrigger.click();
  await expect(group.locator(":scope > .seldisclosure-content")).toBeHidden();
  await pageRoot.getByRole("button", { name: "定位当前步骤" }).click();
  await expect(group.locator(":scope > .seldisclosure-content")).toBeVisible();
  await expect(group.locator(".task-timeline-node")).toHaveCount(1);
  const applicationNode = group.locator(".task-timeline-node").first();
  await expect(applicationNode).toContainText("南宫婉");
  await expect(applicationNode).toContainText("→ 韩立");
  await expect(applicationNode).toContainText("审批申请");
  await expect(group.getByText("韩立审批 · 等待中", { exact: true })).toBeVisible();
  await expect(group.getByText("韩立", { exact: true })).toHaveCount(0);
  await expect(applicationNode.locator(":scope > .seldisclosure-content")).toBeVisible();
  await applicationNode.locator(":scope > .selui-disclosure-heading > .seldisclosure-trigger").click();
  await expect(applicationNode.locator(":scope > .seldisclosure-content")).toBeHidden();
  await applicationNode.locator(":scope > .selui-disclosure-heading > .seldisclosure-trigger").click();

  const manualApproval = applicationNode.getByRole("button", { name: "手动审批" });
  await manualApproval.click();
  let approvalWindow = page.getByRole("dialog", { name: "审批任务 · 专题任务 01 · 修订截图按钮可用态" });
  await expect(approvalWindow).toBeVisible();
  await expect(approvalWindow.getByLabel("审批内容")).toHaveValue(/统一修正主会话/);
  await expect(approvalWindow.getByLabel("审批内容")).toHaveAttribute("readonly", "");
  const approvalContentBounds = await approvalWindow.getByLabel("审批内容").boundingBox();
  if (!approvalContentBounds) throw new Error("审批内容缺少可视边界。");
  expect(approvalContentBounds.height).toBeGreaterThanOrEqual(150);
  const resizeHandle = approvalWindow.locator(".selwindow-resize-south-east");
  await expect(resizeHandle).toHaveCount(1);
  const [beforeResize, resizeBounds] = await Promise.all([approvalWindow.boundingBox(), resizeHandle.boundingBox()]);
  if (!beforeResize || !resizeBounds) throw new Error("审批窗口缺少缩放边界。");
  await page.mouse.move(resizeBounds.x + resizeBounds.width / 2, resizeBounds.y + resizeBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBounds.x + resizeBounds.width / 2 + 35, resizeBounds.y + resizeBounds.height / 2 + 45, { steps: 6 });
  await page.mouse.up();
  const afterResize = await approvalWindow.boundingBox();
  if (!afterResize) throw new Error("审批窗口缩放后缺少可视边界。");
  expect(afterResize.height).toBeGreaterThan(beforeResize.height + 25);
  await approvalWindow.getByRole("button", { name: "最大化窗口" }).click();
  await expect(approvalWindow.getByRole("button", { name: "还原窗口" })).toHaveAttribute("aria-pressed", "true");
  await approvalWindow.getByRole("button", { name: "还原窗口" }).click();
  await approvalWindow.getByRole("button", { name: "最小化窗口" }).click();
  await page.getByRole("button", { name: /恢复审批任务/ }).click();
  await approvalWindow.getByRole("button", { name: "取消", exact: true }).click();
  await expect(approvalWindow).toBeHidden();
  await expect(manualApproval).toBeVisible();

  await manualApproval.click();
  approvalWindow = page.getByRole("dialog", { name: "审批任务 · 专题任务 01 · 修订截图按钮可用态" });
  await approvalWindow.locator(".selwindow-close-button").click();
  await expect(approvalWindow).toBeHidden();
  await manualApproval.click();
  approvalWindow = page.getByRole("dialog", { name: "审批任务 · 专题任务 01 · 修订截图按钮可用态" });
  // 公共窗口在下一帧完成首次焦点交接；等窗口真正可输入后再操作，避免自动化早于浏览器焦点生命周期。
  await expect(approvalWindow.getByLabel("审批内容")).toBeFocused();
  await approvalWindow.getByLabel("审批结论").selectOption("approved");
  await approvalWindow.getByLabel("审批原因").fill("范围与验收标准明确，可以进入多人并行执行。");
  await expect(approvalWindow.getByLabel("审批原因")).toHaveValue("范围与验收标准明确，可以进入多人并行执行。");
  await approvalWindow.getByRole("button", { name: "提交审批" }).click();
  await expect(approvalWindow).toBeHidden();
  await expect(group.getByRole("button", { name: "手动审批" })).toHaveCount(0);
  await expect(group.locator(".task-timeline-node")).toHaveCount(13);
  await expect(group.locator(".task-timeline-node").nth(1)).toContainText("韩立");
  await expect(group.locator(".task-timeline-node").nth(1)).toContainText("→ 南宫婉");
  await expect(group.locator(".task-timeline-node").nth(1)).toContainText("审批通过");
  await expect(group.locator(".distribution")).toContainText("→ 令狐老祖、紫灵、元瑶 等 10 人");
  await expect(group).toContainText("专题总历时");
  await expect(group.locator(".task-timeline-position.current")).toHaveCount(2);
  await expect(group.locator(".task-timeline-position.waiting")).toHaveCount(2);
  await expect(group.getByText("当前正在验证", { exact: true })).toBeVisible();
  await expect(group.getByText(/处理耗时|已处理|已验证/).first()).toBeVisible();

  const nodeDisclosures = group.locator(".task-timeline-node");
  for (let index = 0; index < await nodeDisclosures.count(); index += 1) {
    const node = nodeDisclosures.nth(index);
    const trigger = node.locator(":scope > .selui-disclosure-heading > .seldisclosure-trigger");
    if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
    await expect(node.locator(":scope > .seldisclosure-content")).toBeVisible();
    const detailTrigger = node.locator(".task-node-detail > .selui-disclosure-heading > .seldisclosure-trigger");
    if (await detailTrigger.count()) {
      await detailTrigger.click();
      await expect(node.locator(".task-node-detail > .seldisclosure-content")).toBeVisible();
      await detailTrigger.click();
      await expect(node.locator(".task-node-detail > .seldisclosure-content")).toBeHidden();
    }
    await trigger.click();
    await expect(node.locator(":scope > .seldisclosure-content")).toBeHidden();
  }

  await testInfo.attach("task-collaboration-group-1560x980", { body: await page.screenshot(), contentType: "image/png" });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1366, 768));
  const standardHorizontalOverflow = await pageRoot.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(standardHorizontalOverflow).toBeLessThanOrEqual(1);
  await testInfo.attach("task-collaboration-group-1366x768", { body: await page.screenshot(), contentType: "image/png" });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1000, 700));
  const horizontalOverflow = await pageRoot.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  await testInfo.attach("task-collaboration-group-1000x700", { body: await page.screenshot(), contentType: "image/png" });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1560, 980));

  await page.evaluate(() => (window as unknown as { desktop: { setInteractionTaskTimelineFixture(active: boolean): Promise<void> } }).desktop.setInteractionTaskTimelineFixture(false));
  await page.evaluate(() => (window as unknown as { desktop: { setInteractionTaskTimelineFixture(active: boolean): Promise<void> } }).desktop.setInteractionTaskTimelineFixture(true));
  await expect(group.locator(".task-timeline-node")).toHaveCount(1);
  await group.getByRole("button", { name: "手动审批" }).click();
  approvalWindow = page.getByRole("dialog", { name: "审批任务 · 专题任务 01 · 修订截图按钮可用态" });
  await expect(approvalWindow.getByLabel("审批内容")).toBeFocused();
  await approvalWindow.getByLabel("审批结论").selectOption("supplement-required");
  await approvalWindow.getByLabel("审批原因").fill("请补充忙碌禁用态的触发条件和解除条件。");
  await expect(approvalWindow.getByLabel("审批原因")).toHaveValue("请补充忙碌禁用态的触发条件和解除条件。");
  await approvalWindow.getByRole("button", { name: "提交审批" }).click();
  await expect(group.locator(".task-timeline-node")).toHaveCount(3);
  await expect(group).toContainText("审批退回补充");
  await expect(group).toContainText("请补充忙碌禁用态的触发条件和解除条件。");
  await expect(group).toContainText("南宫婉 · 正在补充审批材料");
  await expect(group.locator(".distribution")).toHaveCount(0);

  await page.evaluate(() => (window as unknown as { desktop: { setInteractionTaskTimelineFixture(active: boolean): Promise<void> } }).desktop.setInteractionTaskTimelineFixture(false));
  await page.evaluate(() => (window as unknown as { desktop: { setInteractionTaskTimelineFixture(active: boolean): Promise<void> } }).desktop.setInteractionTaskTimelineFixture(true));
  await expect(group.locator(".task-timeline-node")).toHaveCount(1);
  await group.getByRole("button", { name: "手动审批" }).click();
  approvalWindow = page.getByRole("dialog", { name: "审批任务 · 专题任务 01 · 修订截图按钮可用态" });
  await expect(approvalWindow.getByLabel("审批内容")).toBeFocused();
  await approvalWindow.getByLabel("审批结论").selectOption("rejected");
  await approvalWindow.getByLabel("审批原因").fill("当前方案越过专题范围，审批驳回。");
  await expect(approvalWindow.getByLabel("审批原因")).toHaveValue("当前方案越过专题范围，审批驳回。");
  await approvalWindow.getByRole("button", { name: "提交审批" }).click();
  await expect(group.locator(".task-timeline-node")).toHaveCount(3);
  await expect(group).toContainText("审批驳回");
  await expect(group).toContainText("当前方案越过专题范围，审批驳回。");
  await expect(group.locator(".distribution")).toHaveCount(0);

  await page.evaluate(() => (window as unknown as { desktop: { setInteractionTaskTimelineFixture(active: boolean): Promise<void> } }).desktop.setInteractionTaskTimelineFixture(false));
  await taskList.getByRole("button", { name: "单会话" }).click();
  await page.getByRole("button", { name: "展开工作区" }).click();
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

test("工作区目录末行完整显示且不被内层固定高度裁切", async () => {
  const lastEntry = page.locator(".workspace-tree .dev-file").filter({ hasText: "shared" });
  await expect(lastEntry).toBeVisible();
  const metrics = await lastEntry.evaluate((element) => {
    const rowBounds = element.getBoundingClientRect();
    const tree = element.closest(".workspace-tree");
    if (!tree) throw new Error("工作区目录树不存在。");
    const treeBounds = tree.getBoundingClientRect();
    const treeStyle = getComputedStyle(tree);
    return {
      rowHeight: rowBounds.height,
      rowBottom: rowBounds.bottom,
      treeBottom: treeBounds.bottom,
      treeMaxHeight: treeStyle.maxHeight,
      treeOverflow: treeStyle.overflow,
    };
  });
  expect(metrics.rowHeight).toBeGreaterThanOrEqual(31);
  expect(metrics.rowBottom).toBeLessThanOrEqual(metrics.treeBottom + 1);
  expect(metrics.treeMaxHeight).toBe("none");
  expect(metrics.treeOverflow).toBe("visible");
});

test("正式最小窗口和默认窗口支持资源管理器键盘调节且没有横向溢出", async () => {
  const explorerResizer = page.getByRole("separator", { name: "调整资源管理器宽度" });

  await explorerResizer.focus();
  await page.keyboard.press("ArrowRight");
  await expect(explorerResizer).toHaveAttribute("aria-valuenow", "276");
  await page.keyboard.press("Home");
  await expect(explorerResizer).toHaveAttribute("aria-valuenow", "260");
  await expect(page.getByRole("separator", { name: "调整工作区与任务区域高度" })).toHaveCount(0);

  const minimumSize = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getMinimumSize());
  expect(minimumSize).toEqual([1000, 700]);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1000, 700));
  await expect(page.locator(".developer-shell")).toBeVisible();
  const narrowOverflow = await page.locator(".workspace-list").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(narrowOverflow).toBeLessThanOrEqual(1);

  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1560, 980));
  await expect(page.locator(".developer-shell")).toBeVisible();
});

test("自动测试默认关闭，预检成功后才进入开启态", async () => {
  const composer = page.locator(".selconversation-composer:visible");
  const automaticTest = page.getByRole("switch", { name: "自动测试" });
  const contextTools = composer.locator(".composer-context-tools");
  const automationTools = composer.locator(".composer-automation-tools");
  const attachmentTools = composer.locator(".composer-attachment-tools");
  const screenshotButton = page.getByRole("button", { name: "截取当前屏幕" });
  await expect(automaticTest).toHaveAttribute("aria-checked", "false");
  const [contextBounds, automationBounds, attachmentBounds, automaticBounds, screenshotBounds] = await Promise.all([
    contextTools.boundingBox(),
    automationTools.boundingBox(),
    attachmentTools.boundingBox(),
    automaticTest.boundingBox(),
    screenshotButton.boundingBox(),
  ]);
  if (!contextBounds || !automationBounds || !attachmentBounds || !automaticBounds || !screenshotBounds) throw new Error("自动测试工具栏控件缺少可见边界。");
  expect(contextBounds.x).toBeLessThan(automationBounds.x);
  expect(automationBounds.x).toBeLessThan(attachmentBounds.x);
  expect(automaticBounds.x).toBeLessThan(screenshotBounds.x);
  await automaticTest.click();

  await expect(automaticTest).toHaveAttribute("aria-checked", "true");
  await expect(automationTools.getByText("自动测试环境已就绪", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "自动测试环境已就绪" })).toHaveCount(0);
  await composer.locator("textarea").focus();
  await expect(composer.locator("textarea")).toBeFocused();

  await automaticTest.click();
  await expect(automaticTest).toHaveAttribute("aria-checked", "false");
});

test("多个结构化疑问逐题确认后继续原回合并重新展示完整意图", async () => {
  const composer = page.locator(".selconversation-composer:visible");
  await composer.locator("textarea").fill("需要确认的截图交互");
  await composer.getByRole("button", { name: "发送" }).click();

  const panel = page.locator(".codex-user-input");
  await expect(panel).toBeVisible();
  await composer.locator("textarea").fill("这是执行中的补充说明");
  await composer.getByRole("button", { name: "排队发送" }).click();
  const queued = composer.locator(".dispatch-queue-item").filter({ hasText: "这是执行中的补充说明" });
  await expect(queued).toBeVisible();
  await queued.getByRole("button", { name: "补充到当前任务" }).click();
  await expect(queued).toHaveCount(0);
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

test("托管内部新回合向下新增回复卡且不覆盖上一轮文字", async () => {
  await page.getByRole("button", { name: "重新建立一个 Codex 会话" }).click();
  const composer = page.locator(".selconversation-composer:visible");
  await composer.locator("textarea").fill("multi-turn-test");
  await composer.getByRole("button", { name: "发送" }).click();

  const firstRound = page.locator('.selconversation-message[data-role="assistant"]').filter({ hasText: "第一轮必须保留的文字" });
  const secondRound = page.locator('.selconversation-message[data-role="assistant"]').filter({ hasText: "第二轮向下新增的文字" });
  await expect(firstRound).toHaveCount(1);
  await expect(secondRound).toHaveCount(1);
  const positions = await page.locator('.selconversation-message[data-role="assistant"]').evaluateAll((cards) => cards
    .filter((card) => card.textContent?.includes("第一轮必须保留的文字") || card.textContent?.includes("第二轮向下新增的文字"))
    .map((card) => ({ text: card.textContent || "", top: card.getBoundingClientRect().top })));
  expect(positions).toHaveLength(2);
  expect(positions[0].text).toContain("第一轮必须保留的文字");
  expect(positions[1].text).toContain("第二轮向下新增的文字");
  expect(positions[1].top).toBeGreaterThan(positions[0].top);
  // 回复文字可能早于任务清理完成；必须等待回合终态，避免下一用例的阶段操作被误排入等待队列。
  await expect(page.locator('.selconversation-message[data-role="assistant"][data-streaming="true"]')).toHaveCount(0);
  await expect(composer.getByRole("button", { name: "发送" })).toBeVisible();
  await expect(composer.locator(".dispatch-queue-item")).toHaveCount(0);
});

test("最新自动策略动作在运行中禁用并且不再显示旧模式返回入口", async () => {
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

  await expect(panel).toHaveCount(0);
  await expect(page.getByText("完整意图已根据两个答案重新整理。").last()).toBeVisible();
  await expect(execute).toBeEnabled();
  await execute.click();

  const latestManagedCard = page.locator('.selconversation-message[data-role="assistant"]').last();
  const testAction = latestManagedCard.getByRole("button", { name: "测试一下" });
  await expect(testAction).toBeVisible();
  await expect(latestManagedCard.getByRole("button", { name: "回到会话托管" })).toHaveCount(0);
  await expect(latestManagedCard.getByRole("button", { name: "回到任务托管" })).toHaveCount(0);

  await panel.getByRole("radio", { name: /原对话框/ }).click();
  await panel.getByRole("button", { name: "确认" }).click();
  await expect(panel.getByText("无红色标注时使用什么提示？")).toBeVisible();
  await panel.getByRole("radio", { name: /不追加提示/ }).click();
  await panel.getByRole("button", { name: "确认" }).click();

  await expect(testAction).toBeEnabled();
  await expect(page.locator(".execution-mode-badge")).toHaveText("执行修改");
});

test("Markdown 回答结构清晰且页面重载后恢复，主动新建才清空", async () => {
  await page.getByRole("button", { name: "重新建立一个 Codex 会话" }).click();
  const composer = page.locator(".selconversation-composer:visible");
  await composer.locator("textarea").fill("markdown-test");
  await composer.getByRole("button", { name: "发送" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "清晰结论" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator(".markdown-message code").filter({ hasText: "thread/resume" })).toBeVisible();
  await page.waitForTimeout(350);

  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: "清晰结论" })).toBeVisible();
  await expect(page.getByText("自然回答")).toBeVisible();

  await page.getByRole("button", { name: "重新建立一个 Codex 会话" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "清晰结论" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "今天要构建什么？" })).toBeVisible();
});

test("屏幕录制权限已开启但当前进程仍拒绝时提供受控重启入口", async () => {
  await page.getByRole("button", { name: "截取当前屏幕" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("请在系统设置中允许 AI Desktop 使用屏幕录制权限");
  await expect(alert).not.toContainText("Error invoking remote method");
  const openSettings = alert.getByRole("button", { name: "打开系统设置" });
  await expect(openSettings).toBeVisible();
  await openSettings.click();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(alert).toContainText("当前进程仍未识别更改后的权限");
  const restart = alert.getByRole("button", { name: "重启 AI Desktop" });
  await expect(restart).toBeVisible();
  await restart.click();
  await expect(alert).toContainText("正在重启 AI Desktop");
});

test("SELUI 多页签保留草稿、重复定位、关闭相邻页且不删除后台任务", async () => {
  await page.goto(pathToFileURL(productionRendererFile).href);
  await page.getByRole("button", { name: "展开任务" }).click();
  const taskList = page.locator("#developer-task-list");
  await taskList.getByRole("button", { name: "协同模式" }).click();
  await taskList.getByRole("button", { name: /韩立/ }).click();
  const input = page.locator(".seltabs-panel:not([hidden]) textarea").first();
  await input.fill("切换后这段用户草稿必须保留");
  await taskList.getByRole("button", { name: /南宫婉/ }).click();
  await expect(page.getByRole("tab", { name: "韩立", exact: true })).toHaveCount(1);
  await expect(page.getByRole("tab", { name: "南宫婉", exact: true })).toHaveAttribute("aria-selected", "true");
  await taskList.getByRole("button", { name: /韩立/ }).click();
  await expect(input).toHaveValue("切换后这段用户草稿必须保留");
  await taskList.getByRole("button", { name: /韩立/ }).click();
  await expect(page.getByRole("tab", { name: "韩立", exact: true })).toHaveCount(1);
  const taskCount = () => page.evaluate(async () => (await (window as unknown as { desktop: { getCollaborationState(): Promise<{ tasks: unknown[] }> } }).desktop.getCollaborationState()).tasks.length);
  const before = await taskCount();
  await page.getByRole("button", { name: "关闭韩立", exact: true }).click();
  await expect(page.getByRole("tab", { name: "韩立", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "南宫婉", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(await taskCount()).toBe(before);
  await taskList.getByRole("button", { name: /韩立/ }).click();
  await expect(page.getByRole("tab", { name: "韩立", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: test.info().outputPath("selui-workspace-tabs.png"), fullPage: true });
  await page.goto(pathToFileURL(productionRendererFile).href);
});

test("红框选中后可以移动缩放且操作按钮随焦点显示", async () => {
  await page.goto("http://127.0.0.1:4197/?mode=screenshot-interaction");
  const source = page.locator(".screenshot-source");
  await expect(source).toBeVisible();
  const sourceBounds = await source.boundingBox();
  if (!sourceBounds) throw new Error("截图选择区域没有可交互边界。");
  await page.mouse.move(sourceBounds.x + 70, sourceBounds.y + 55);
  await page.mouse.down();
  await page.mouse.move(sourceBounds.x + 650, sourceBounds.y + 405, { steps: 8 });
  await page.mouse.up();

  const canvas = page.locator('canvas[aria-label="红色标注"]');
  await expect(canvas).toBeVisible();
  const canvasBounds = await canvas.boundingBox();
  if (!canvasBounds) throw new Error("截图标注画布没有可交互边界。");
  await page.mouse.move(canvasBounds.x + 90, canvasBounds.y + 75);
  await page.mouse.down();
  await page.mouse.move(canvasBounds.x + 280, canvasBounds.y + 190, { steps: 8 });
  await page.mouse.up();

  const selection = page.locator(".screenshot-rectangle-selection");
  const floatingActions = page.locator(".screenshot-annotation-actions");
  await expect(selection).toBeVisible();
  await expect(floatingActions.getByRole("button", { name: "完成" })).toBeVisible();
  await expect(floatingActions.getByRole("button", { name: "取消" })).toBeVisible();
  const footerActions = page.locator(".screenshot-toolbar .screenshot-actions");
  await expect(footerActions.getByRole("button")).toHaveCount(1);
  await expect(footerActions.getByRole("button", { name: "返回" })).toBeVisible();

  await page.getByRole("button", { name: "方框" }).click();
  await expect(selection).toHaveCount(0);
  await expect(floatingActions).toHaveCount(0);

  await page.mouse.click(canvasBounds.x + 92, canvasBounds.y + 76);
  await expect(selection).toBeVisible();
  const beforeMove = await selection.boundingBox();
  if (!beforeMove) throw new Error("选中红框没有移动前边界。");
  await page.mouse.move(beforeMove.x + beforeMove.width * .25, beforeMove.y + 1);
  await page.mouse.down();
  await page.mouse.move(beforeMove.x + beforeMove.width * .25 + 48, beforeMove.y + 36, { steps: 6 });
  await page.mouse.up();
  const afterMove = await selection.boundingBox();
  if (!afterMove) throw new Error("选中红框没有移动后边界。");
  expect(afterMove.x).toBeGreaterThan(beforeMove.x + 35);
  expect(afterMove.y).toBeGreaterThan(beforeMove.y + 25);

  const southeastHandle = page.getByRole("button", { name: "调整红框-se" });
  const handleBounds = await southeastHandle.boundingBox();
  if (!handleBounds) throw new Error("红框缩放控制点没有可交互边界。");
  await page.mouse.move(handleBounds.x + handleBounds.width / 2, handleBounds.y + handleBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBounds.x + handleBounds.width / 2 + 55, handleBounds.y + handleBounds.height / 2 + 35, { steps: 6 });
  await page.mouse.up();
  const afterResize = await selection.boundingBox();
  if (!afterResize) throw new Error("选中红框没有缩放后边界。");
  expect(afterResize.width).toBeGreaterThan(afterMove.width + 40);
  expect(afterResize.height).toBeGreaterThan(afterMove.height + 25);

  await floatingActions.getByRole("button", { name: "取消" }).click();
  await expect(selection).toHaveCount(0);
  await expect(floatingActions).toHaveCount(0);

  await page.mouse.move(canvasBounds.x + 110, canvasBounds.y + 90);
  await page.mouse.down();
  await page.mouse.move(canvasBounds.x + 260, canvasBounds.y + 180, { steps: 6 });
  await page.mouse.up();
  await floatingActions.getByRole("button", { name: "完成" }).click();
  const result = page.locator(".screenshot-interaction-result");
  await expect(result).toHaveAttribute("data-completed", "true");
  await expect(result).toHaveAttribute("data-has-annotations", "true");
});
