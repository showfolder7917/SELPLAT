import path from "node:path";

import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

let application: ElectronApplication;
let page: Page;
const productionRendererFile = path.resolve("../../build/ai-desktop/renderer/developer/index.html");

test.beforeAll(async () => {
  // 每组测试只启动一次后台隔离 Electron，多个交互共用窗口以缩短任务托管耗时。
  const isolatedEnvironment = { ...process.env };
  // 当前 AI Desktop 主进程可能以 Node 模式拉起 Codex；隔离 Electron 必须移除该继承值才能按桌面运行时接受 Playwright 调试参数。
  delete isolatedEnvironment.ELECTRON_RUN_AS_NODE;
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
  await expect(page.getByText("bundled Codex 0.149.0")).toBeVisible();
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

test("新建任务入口位于聊天标签且不再占用任务标题", async () => {
  const tab = page.locator(".dev-tab");
  const title = tab.getByText("Codex Chat", { exact: true });
  const newTask = tab.getByRole("button", { name: "重新建立一个 Codex 会话" });
  const closeIcon = tab.locator(":scope > svg:last-child");
  await expect(newTask).toBeVisible();
  await expect(newTask).toHaveAttribute("data-tooltip", "重新建立一个 Codex 会话");
  await expect(newTask).not.toHaveAttribute("title", /.+/);
  await expect(newTask.locator("svg")).toBeVisible();
  await expect(page.locator(".dev-section-title.tasks").getByRole("button", { name: "重新建立一个 Codex 会话" })).toHaveCount(0);

  const [titleBounds, newTaskBounds, closeBounds] = await Promise.all([
    title.boundingBox(),
    newTask.boundingBox(),
    closeIcon.boundingBox(),
  ]);
  if (!titleBounds || !newTaskBounds || !closeBounds) throw new Error("聊天标签的新建任务入口缺少可视边界。");
  expect(newTaskBounds.x).toBeGreaterThanOrEqual(titleBounds.x + titleBounds.width);
  expect(newTaskBounds.x + newTaskBounds.width).toBeLessThanOrEqual(closeBounds.x);

  await newTask.hover();
  await expect.poll(() => newTask.evaluate((element) => Number.parseFloat(window.getComputedStyle(element, "::after").opacity))).toBe(1);
  const hoverTip = await newTask.evaluate((element) => {
    const button = element as HTMLElement;
    const main = button.closest<HTMLElement>(".dev-main");
    if (!main) throw new Error("刷新对话按钮不在主内容区域内。");
    const style = window.getComputedStyle(button, "::after");
    const buttonBounds = button.getBoundingClientRect();
    const mainBounds = main.getBoundingClientRect();
    const width = Number.parseFloat(style.width);
    const height = Number.parseFloat(style.height);
    const left = buttonBounds.left + buttonBounds.width / 2 - width / 2;
    const top = buttonBounds.bottom + 6;
    return {
      content: style.content.replace(/^['"]|['"]$/g, ""),
      opacity: Number.parseFloat(style.opacity),
      left,
      top,
      right: left + width,
      bottom: top + height,
      mainLeft: mainBounds.left,
      mainTop: mainBounds.top,
      mainRight: mainBounds.right,
      mainBottom: mainBounds.bottom,
    };
  });
  expect(hoverTip.content).toBe("重新建立一个 Codex 会话");
  expect(hoverTip.opacity).toBe(1);
  expect(hoverTip.left).toBeGreaterThanOrEqual(hoverTip.mainLeft - 0.5);
  expect(hoverTip.top).toBeGreaterThanOrEqual(hoverTip.mainTop - 0.5);
  expect(hoverTip.right).toBeLessThanOrEqual(hoverTip.mainRight + 0.5);
  expect(hoverTip.bottom).toBeLessThanOrEqual(hoverTip.mainBottom + 0.5);

  await page.locator(".dev-chat").hover({ position: { x: 12, y: 120 } });
  await newTask.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(newTask).toBeFocused();
  await expect.poll(() => newTask.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
  await expect.poll(() => newTask.evaluate((element) => Number.parseFloat(window.getComputedStyle(element, "::after").opacity))).toBe(1);
});

test("未登录时设置面板的登录主操作文字可见并使用主题对比色", async () => {
  await page.evaluate(() => (window as unknown as { desktop: { setInteractionAuthenticated(authenticated: boolean): Promise<void> } }).desktop.setInteractionAuthenticated(false));
  // 生产界面按固定周期读取官方账号状态；测试等待同一刷新链路生效，不通过重载伪造状态。
  await expect(page.locator(".dev-empty").getByText("请先登录 ChatGPT", { exact: true })).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "连接与执行设置" }).click();
  const loginButton = page.getByRole("button", { name: "使用 ChatGPT 登录" });
  await expect(loginButton).toBeVisible();
  await expect(loginButton.locator("span")).toHaveText("使用 ChatGPT 登录");
  const presentation = await loginButton.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const label = element.querySelector("span");
    const panel = element.closest(".dev-settings");
    const account = element.closest(".dev-account");
    const runtime = account?.querySelector("small");
    const panelBounds = panel?.getBoundingClientRect();
    const accountBounds = account?.getBoundingClientRect();
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

test("生产构建在正式默认、实际复现和最小窗口中保持设置入口与面板定位", async () => {
  const sizes = [
    { name: "正式默认", width: 1560, height: 980 },
    { name: "实际复现", width: 1224, height: 768 },
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
  await expect(page.locator(".dev-tab").getByText("宋玉", { exact: true })).toBeVisible();
  const memberPage = page.locator(".collaboration-member-page");
  await expect(memberPage.getByText("当前空闲", { exact: true })).toBeVisible();
  await expect(memberPage.getByText("收到任务时才会创建新的 Codex。", { exact: true })).toBeVisible();
  const overflow = await memberPage.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await taskList.getByRole("button", { name: /韩立/ }).click();
  await expect(page.locator(".dev-tab").getByText("韩立", { exact: true })).toBeVisible();
  await expect(page.locator(".dev-composer")).toBeVisible();
  await taskList.getByRole("button", { name: "单会话" }).click();
  await page.getByRole("button", { name: "展开工作区" }).click();
});

test("令狐老祖位于南宫婉下方并可管理持续自动保障启动文案", async () => {
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

  await panel.getByRole("button", { name: "新增启动文案" }).click();
  await panel.getByLabel("文案名称").fill("客户易用性巡检");
  await panel.getByLabel("启动内容").fill("检查页面是否一看就懂，发现问题后拆分并修正。");
  await panel.getByRole("button", { name: "保存文案" }).click();
  const prompt = panel.locator(".linghu-prompt-list article").filter({ hasText: "客户易用性巡检" });
  await expect(prompt).toContainText("当前使用");
  await prompt.getByRole("button", { name: "停用" }).click();
  await expect(prompt).toContainText("已停用");
  await prompt.getByRole("button", { name: "启用" }).click();
  await prompt.getByRole("button", { name: "修改" }).click();
  await panel.getByLabel("文案名称").fill("客户页面易用性巡检");
  await panel.getByRole("button", { name: "保存文案" }).click();
  const renamed = panel.locator(".linghu-prompt-list article").filter({ hasText: "客户页面易用性巡检" });
  await expect(renamed).toBeVisible();

  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1000, 700));
  const overflow = await page.locator(".collaboration-member-page").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  page.once("dialog", (dialog) => dialog.accept());
  await renamed.getByRole("button", { name: "删除" }).click();
  await expect(renamed).toHaveCount(0);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1560, 980));
  await taskList.getByRole("button", { name: "单会话" }).click();
  await page.getByRole("button", { name: "展开工作区" }).click();
});

test("审核正文已生成但结论无法识别时保留正文并显示准确状态", async () => {
  await page.evaluate(() => (window as unknown as { desktop: { setInteractionCollaborationReviewFixture(active: boolean): Promise<void> } }).desktop.setInteractionCollaborationReviewFixture(true));
  await page.getByRole("button", { name: "展开任务" }).click();
  const taskList = page.locator("#developer-task-list");
  await taskList.getByRole("button", { name: "协同模式" }).click();
  await taskList.getByRole("button", { name: /墨大夫/ }).click();
  const memberPage = page.locator(".collaboration-member-page");
  const intentStage = memberPage.locator("details.task-progress-stage").filter({ hasText: /意图分析.*张铁/ });
  await expect(intentStage).toBeVisible();
  await intentStage.locator("summary").click();
  await expect(memberPage.getByText("修正审核解析和状态持久化。", { exact: true })).toBeVisible();
  const approvalStage = memberPage.locator("details.task-progress-stage").filter({ hasText: /审批.*墨大夫/ });
  await expect(approvalStage).toBeVisible();
  await approvalStage.locator("summary").click();
  await expect(memberPage.getByText("审核内容已经完整生成，但旧格式没有首行标记。", { exact: true })).toBeVisible();
  await expect(memberPage.getByText("审核正文已生成，但结论无法识别。", { exact: true })).toBeVisible();
  const executionStage = memberPage.locator("details.task-progress-stage").filter({ hasText: /执行.*张铁/ });
  await expect(executionStage).toBeVisible();
  await executionStage.locator("summary").click();
  await expect(memberPage.getByText("apps/ai-desktop/src/variants/developer/DeveloperApp.tsx", { exact: true })).toBeVisible();
  await expect(memberPage.getByRole("button", { name: "继续执行" })).toBeVisible();
  await page.evaluate(() => (window as unknown as { desktop: { setInteractionCollaborationReviewFixture(active: boolean): Promise<void> } }).desktop.setInteractionCollaborationReviewFixture(false));
  await taskList.getByRole("button", { name: "单会话" }).click();
  await page.getByRole("button", { name: "展开工作区" }).click();
});

test("协同执行列表归档完成任务并优先展示结构化结果摘要", async () => {
  await page.evaluate(() => (window as unknown as { desktop: { setInteractionCollaborationExecutionFixture(active: boolean): Promise<void> } }).desktop.setInteractionCollaborationExecutionFixture(true));
  await page.getByRole("button", { name: "展开任务" }).click();
  const taskList = page.locator("#developer-task-list");
  await taskList.getByRole("button", { name: "协同模式" }).click();
  await taskList.getByRole("button", { name: /执行列表/ }).click();

  const record = page.locator(".execution-record");
  await expect(record.getByText("修复协同归档展示", { exact: true })).toBeVisible();
  await expect(record.getByText("韩立", { exact: true })).toBeVisible();
  await expect(record.getByText("宋玉、冰魄仙子", { exact: true })).toBeVisible();
  await expect(record.getByText("10分钟 0秒", { exact: true })).toBeVisible();

  await record.locator("summary").click();
  await record.getByRole("button", { name: "打开完整记录" }).click();
  const detail = page.locator(".collaboration-task-detail");
  await expect(detail.getByText("任务结果", { exact: true })).toBeVisible();
  await expect(detail.getByText("执行列表与结果摘要已完成。", { exact: true })).toBeVisible();
  await expect(detail.getByLabel("当前进度")).toBeVisible();
  const executionStage = detail.locator("details.task-progress-stage").filter({ hasText: /执行.*冰魄仙子/ });
  await expect(executionStage).toHaveAttribute("open", "");
  await expect(executionStage.getByText("宋玉", { exact: true })).toBeVisible();
  const verifiedRecord = executionStage.locator("article.task-stage-record").filter({ hasText: "归档入口已完成" });
  await expect(verifiedRecord.getByText("冰魄仙子", { exact: true })).toBeVisible();
  await expect(verifiedRecord.getByText("归档入口已完成", { exact: true })).toBeVisible();

  await page.evaluate(() => (window as unknown as { desktop: { setInteractionCollaborationExecutionFixture(active: boolean): Promise<void> } }).desktop.setInteractionCollaborationExecutionFixture(false));
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
  const automaticTest = page.getByRole("switch", { name: "自动测试" });
  const modeBadge = page.locator(".execution-mode-badge");
  const screenshotButton = page.getByRole("button", { name: "截取当前屏幕" });
  await expect(automaticTest).toHaveAttribute("aria-checked", "false");
  const [modeBounds, automaticBounds, screenshotBounds] = await Promise.all([
    modeBadge.boundingBox(),
    automaticTest.boundingBox(),
    screenshotButton.boundingBox(),
  ]);
  if (!modeBounds || !automaticBounds || !screenshotBounds) throw new Error("自动测试工具栏控件缺少可见边界。");
  expect(modeBounds.x).toBeLessThan(automaticBounds.x);
  expect(automaticBounds.x).toBeLessThan(screenshotBounds.x);
  await automaticTest.click();

  const dialog = page.getByRole("dialog", { name: "自动测试" });
  await expect(dialog.getByRole("heading", { name: "自动测试环境已就绪" })).toBeVisible();
  await expect(dialog.locator(".automatic-test-checks li.passed")).toHaveCount(7);
  const dialogBounds = await dialog.locator(".automatic-test-card").boundingBox();
  if (!dialogBounds) throw new Error("自动测试结果弹窗缺少可见边界。");
  expect(dialogBounds.x).toBeGreaterThanOrEqual(0);
  expect(dialogBounds.x + dialogBounds.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  await dialog.getByRole("button", { name: "知道了" }).click();
  await expect(automaticTest).toHaveAttribute("aria-checked", "true");

  await automaticTest.click();
  await expect(automaticTest).toHaveAttribute("aria-checked", "false");
});

test("多个结构化疑问逐题确认后继续原回合并重新展示完整意图", async () => {
  const composer = page.locator(".dev-composer");
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
  const composer = page.locator(".dev-composer");
  await composer.locator("textarea").fill("multi-turn-test");
  await composer.getByRole("button", { name: "发送" }).click();

  const firstRound = page.locator(".dev-message.assistant").filter({ hasText: "第一轮必须保留的文字" });
  const secondRound = page.locator(".dev-message.assistant").filter({ hasText: "第二轮向下新增的文字" });
  await expect(firstRound).toHaveCount(1);
  await expect(secondRound).toHaveCount(1);
  const positions = await page.locator(".dev-message.assistant").evaluateAll((cards) => cards
    .filter((card) => card.textContent?.includes("第一轮必须保留的文字") || card.textContent?.includes("第二轮向下新增的文字"))
    .map((card) => ({ text: card.textContent || "", top: card.getBoundingClientRect().top })));
  expect(positions).toHaveLength(2);
  expect(positions[0].text).toContain("第一轮必须保留的文字");
  expect(positions[1].text).toContain("第二轮向下新增的文字");
  expect(positions[1].top).toBeGreaterThan(positions[0].top);
  // 回复文字可能早于任务清理完成；必须等待回合终态，避免下一用例的阶段操作被误排入等待队列。
  await expect(page.locator(".dev-message.assistant.streaming")).toHaveCount(0);
  await expect(composer.getByRole("button", { name: "发送" })).toBeVisible();
  await expect(composer.locator(".dispatch-queue-item")).toHaveCount(0);
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

  await expect(panel).toHaveCount(0);
  await expect(page.getByText("完整意图已根据两个答案重新整理。").last()).toBeVisible();
  await expect(execute).toBeEnabled();
  await execute.click();

  const latestManagedCard = page.locator(".dev-message.assistant").last();
  const returnConversation = latestManagedCard.getByRole("button", { name: "回到会话托管" });
  const returnTask = latestManagedCard.getByRole("button", { name: "回到任务托管" });
  const testAction = latestManagedCard.getByRole("button", { name: "测试一下" });
  await expect(returnConversation).toBeVisible();
  await expect(returnTask).toBeVisible();
  await expect(testAction).toBeVisible();
  await expect(returnConversation).toBeDisabled();
  await expect(returnTask).toBeDisabled();

  await panel.getByRole("radio", { name: /原对话框/ }).click();
  await panel.getByRole("button", { name: "确认" }).click();
  await expect(panel.getByText("无红色标注时使用什么提示？")).toBeVisible();
  await panel.getByRole("radio", { name: /不追加提示/ }).click();
  await panel.getByRole("button", { name: "确认" }).click();

  await expect(returnConversation).toBeEnabled();
  await expect(returnTask).toBeDisabled();
  await expect(testAction).toBeEnabled();
  await returnConversation.click();
  await expect(page.locator(".execution-mode-badge")).toHaveText("会话托管");
  await expect(returnConversation).toBeDisabled();
  await expect(returnTask).toBeEnabled();
  await returnTask.click();
  await expect(page.locator(".execution-mode-badge")).toHaveText("任务托管");
  await expect(returnTask).toBeDisabled();
});

test("Markdown 回答结构清晰且页面重载后恢复，主动新建才清空", async () => {
  await page.getByRole("button", { name: "重新建立一个 Codex 会话" }).click();
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
