import { expect, test, type ElectronApplication, type Locator, type Page } from "@playwright/test";

/** 仅为源码审查声明本场景实际核对的生产表面，不产生运行时依赖。 */
export type LanguageSettingsAcceptanceProductionSurfaces = [
  typeof import("../../src/features/settings/components/DeveloperSettingsView").DeveloperSettingsView,
  typeof import("../../src/features/conversation/components/CodexConversationWorkspace/CodexConversationComposer").CodexConversationComposer,
  typeof import("../../src/features/conversation/components/CodexConversationWorkspace/CodexConversationTimeline").CodexConversationTimeline,
  typeof import("../../src/features/conversation/components/ConversationMessageImage").ConversationMessageImage,
  typeof import("../../src/features/conversation/components/CollaborationStatusChain").CollaborationStatusChain,
  typeof import("../../src/features/hanli/components/HanliConversationWorkspace").HanliConversationWorkspace,
  typeof import("../../src/features/nangong/components/NangongConversationWorkspace").NangongConversationWorkspace,
  typeof import("../../src/features/nangong/components/NangongConversationWorkspace/NangongConversationActivity").NangongConversationActivity,
];

type InteractionHarness = {
  application: ElectronApplication;
  page: Page;
};

/** 在正式最小窗口下核对设置反馈、时间线、输入区和主操作均保留可见的布局空间。 */
async function expectNarrowLanguageLayout(page: Page, feedback?: Locator) {
  if (feedback) {
    await expect(feedback).toBeVisible();
    await expect(feedback).toBeInViewport();
  }
  const feedbackBox = feedback ? await feedback.boundingBox() : null;
  const geometry = await page.evaluate(() => {
    const required = {
      panel: document.querySelector<HTMLElement>(".dev-settings"),
      settingsContent: document.querySelector<HTMLElement>(".dev-settings-content"),
      timeline: document.querySelector<HTMLElement>(".selconversation-timeline"),
      input: document.querySelector<HTMLElement>(".selconversation-input"),
      action: document.querySelector<HTMLElement>(".selconversation-action"),
    };
    if (Object.values(required).some((element) => !element)) throw new Error("语言设置窄窗口缺少设置、滚动区、输入区或主操作。");
    const box = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const root = document.documentElement.getBoundingClientRect();
    const viewport = window.visualViewport;
    return {
      // DOM 矩形使用 CSS 分数像素；采样同坐标系的可视视口，不能用 clientHeight 的整数舍入值。
      viewportWidth: viewport?.width ?? root.width,
      viewportHeight: viewport?.height ?? root.height,
      scrollWidth: document.documentElement.scrollWidth,
      panel: box(required.panel!),
      settingsContent: box(required.settingsContent!),
      timeline: box(required.timeline!),
      input: box(required.input!),
      action: box(required.action!),
    };
  });
  const boxes = [geometry.panel, geometry.timeline, geometry.input, geometry.action];
  for (const box of boxes) {
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  }
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.panel.right).toBeLessThanOrEqual(geometry.timeline.left + 1);
  expect(geometry.timeline.bottom).toBeLessThanOrEqual(geometry.input.top + 1);
  expect(geometry.input.bottom).toBeLessThanOrEqual(geometry.action.top + 1);
  if (feedbackBox) {
    expect(feedbackBox.width).toBeGreaterThan(0);
    expect(feedbackBox.height).toBeGreaterThan(0);
    expect(feedbackBox.x).toBeGreaterThanOrEqual(0);
    expect(feedbackBox.x + feedbackBox.width).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    // 设置反馈由面板内部滚动区裁切；必须完整位于该滚动区，而不是用顶层窗口坐标误判内部滚动位置。
    expect(feedbackBox.y).toBeGreaterThanOrEqual(geometry.settingsContent.top - 1);
    expect(feedbackBox.y + feedbackBox.height).toBeLessThanOrEqual(geometry.settingsContent.bottom + 1);
  }
}

/**
 * 窄窗口打开设置时会腾出 Explorer 的列宽，任务导航暂时不可见。
 * 以同一个触发器切换面板，随后检查导航的即时语言投影，不依赖各语言的按钮文案。
 */
async function setSettingsPanelOpen(page: Page, open: boolean) {
  const trigger = page.locator(".dev-settings-control > .activity-settings");
  const expected = String(open);
  if (await trigger.getAttribute("aria-expanded") !== expected) await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", expected);
}

export function registerLanguageSettingsAcceptanceScenarios(getHarness: () => InteractionHarness) {
  test("语言保存显示忙碌、成功后投影且失败时保留原语言", async () => {
    const { application, page } = getHarness();
    const [minimumWidth, minimumHeight] = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getMinimumSize() || [0, 0]);
    expect([minimumWidth, minimumHeight]).toEqual([680, 700]);
    await application.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0]?.setSize(size.width, size.height), { width: minimumWidth, height: minimumHeight });
    await expect.poll(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getSize())).toEqual([minimumWidth, minimumHeight]);

    try {
      await page.getByRole("button", { name: "打开连接与执行设置" }).click();
      const language = page.locator(".dev-settings-content select").filter({ has: page.locator('option[value="zh-CN"]') });
      const languageField = language.locator("xpath=..");
      await expect(language).toHaveValue("zh-CN");
      await expectNarrowLanguageLayout(page);

      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateDelay(120));
      await language.selectOption("ja");
      await expect(language).toHaveAttribute("aria-busy", "true");
      await expect(languageField.getByRole("status")).toContainText("正在保存语言设置");
      await expectNarrowLanguageLayout(page, languageField.getByRole("status"));
      await expect(page.locator(".developer-shell")).toHaveAttribute("lang", "ja");
      await expect(language).toHaveValue("ja");
      // 设置浮层打开时，窄窗口会隐藏 Explorer 以避免与会话区重叠；关闭后在同一 Renderer 验证导航已即时刷新。
      await setSettingsPanelOpen(page, false);
      await expect(page.getByRole("group", { name: "実行モード" })).toBeVisible();
      await setSettingsPanelOpen(page, true);
      await expect(language).toHaveValue("ja");

      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateDelay(0));
      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateFailure("隔离设置保存失败"));
      await language.selectOption("en");
      await expect(languageField.getByRole("alert")).toContainText("言語設定を保存できません");
      await expectNarrowLanguageLayout(page, languageField.getByRole("alert"));
      await expect(language).toHaveValue("ja");
      await expect(page.locator(".developer-shell")).toHaveAttribute("lang", "ja");

      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateFailure(null));
      await language.selectOption("en");
      await expect(page.locator(".developer-shell")).toHaveAttribute("lang", "en");
      await expect(language).toHaveValue("en");
      await expectNarrowLanguageLayout(page);
      await setSettingsPanelOpen(page, false);
      await expect(page.getByRole("group", { name: "Execution mode" })).toBeVisible();
      // 只重挂载 Renderer；设置 DTO 留在隔离主进程，不能代表正式应用重启。
      await page.reload();
      await expect(page.locator(".developer-shell")).toHaveAttribute("lang", "en");
      await page.getByRole("button", { name: "Open connection and execution settings" }).click();
      await page.getByRole("button", { name: "Close connection and execution settings" }).click();

      await page.evaluate(() => (window as any).desktop.setInteractionSettingsReadSource("recovered"));
      await page.reload();
      await expect(page.locator(".developer-shell")).toHaveAttribute("lang", "zh-CN");
      await page.getByRole("button", { name: "打开连接与执行设置" }).click();
      const recoveredLanguage = page.locator(".dev-settings-content select").filter({ has: page.locator('option[value="zh-CN"]') });
      await expect(recoveredLanguage.locator("xpath=..").getByRole("status")).toContainText("无法读取已保存的设置");
      await expectNarrowLanguageLayout(page, recoveredLanguage.locator("xpath=..").getByRole("status"));

      await page.evaluate(() => (window as any).desktop.setInteractionSettingsReadSource("stored"));
      // recovered 只改变读取 DTO，不能覆盖隔离主进程此前成功写入的英文设置。
      // 先切到另一种语言再写回中文，确保下一用例打开的截图窗口读取的是已存中文。
      await recoveredLanguage.selectOption("ja");
      await expect(page.locator(".developer-shell")).toHaveAttribute("lang", "ja");
      await recoveredLanguage.selectOption("zh-CN");
      await expect(page.locator(".developer-shell")).toHaveAttribute("lang", "zh-CN");
      await page.getByRole("button", { name: "关闭连接与执行设置" }).click();
    } finally {
      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateDelay(0)).catch(() => undefined);
      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateFailure(null)).catch(() => undefined);
      await page.evaluate(() => (window as any).desktop.setInteractionSettingsReadSource("stored")).catch(() => undefined);
      await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1560, 980)).catch(() => undefined);
    }
  });

  test("语言保存立即投影到已打开的生产截图窗口，失败不改变截图语言", async () => {
    const { application, page } = getHarness();
    const screenshotWindowOpened = application.waitForEvent("window");
    await page.evaluate(() => (window as any).desktop.openInteractionScreenshotWindow());
    const screenshotPage = await screenshotWindowOpened;
    await screenshotPage.waitForLoadState("domcontentloaded");
    const loading = screenshotPage.locator(".screenshot-window-loading");

    try {
      await expect(loading).toHaveAttribute("aria-label", "正在载入截图…");
      await page.getByRole("button", { name: "打开连接与执行设置" }).click();
      const language = page.locator(".dev-settings-content select").filter({ has: page.locator('option[value="zh-CN"]') });
      await language.selectOption("ja");
      await expect(loading).toHaveAttribute("aria-label", "スクリーンショットを読み込んでいます…");

      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateFailure("隔离设置保存失败"));
      await language.selectOption("en");
      await expect(language).toHaveValue("ja");
      await expect(loading).toHaveAttribute("aria-label", "スクリーンショットを読み込んでいます…");

      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateFailure(null));
      await language.selectOption("en");
      await expect(loading).toHaveAttribute("aria-label", "Loading screenshot…");

      await page.getByRole("button", { name: "Close connection and execution settings" }).click();
      await page.getByRole("button", { name: "Open connection and execution settings" }).click();
      const restoredLanguage = page.locator(".dev-settings-content select").filter({ has: page.locator('option[value="zh-CN"]') });
      await restoredLanguage.selectOption("zh-CN");
      await expect(loading).toHaveAttribute("aria-label", "正在载入截图…");
      await page.getByRole("button", { name: "关闭连接与执行设置" }).click();
    } finally {
      const screenshotClosed = screenshotPage.waitForEvent("close");
      await page.evaluate(() => (window as any).desktop.closeInteractionScreenshotWindow()).catch(() => undefined);
      await screenshotClosed.catch(() => undefined);
      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateFailure(null)).catch(() => undefined);
    }
  });

  test("人物会话与自动托管在三语切换后使用统一固定文本", async () => {
    const { page } = getHarness();
    const taskList = page.locator("#developer-task-list");

    try {
      await setSettingsPanelOpen(page, true);
      const language = page.locator(".dev-settings-content select").filter({ has: page.locator('option[value="zh-CN"]') });
      await language.selectOption("ja");
      await expect(page.locator(".developer-shell")).toHaveAttribute("lang", "ja");
      await setSettingsPanelOpen(page, false);

      // 人物会话仅在协同模式提供；先按当前语言切换，再确认入口真实出现。
      await taskList.getByRole("button", { name: "協同", exact: true }).click();
      await expect(taskList.getByRole("button", { name: /韩立/ })).toBeVisible();
      await taskList.getByRole("button", { name: /韩立/ }).click();
      const hanliComposer = page.locator(".hanli-person-composer");
      await expect(hanliComposer.getByRole("textbox", { name: "韓立にメッセージを送る" })).toBeVisible();
      await expect(hanliComposer.getByRole("switch", { name: "自動管理" })).toBeVisible();

      await setSettingsPanelOpen(page, true);
      await language.selectOption("en");
      await expect(page.locator(".developer-shell")).toHaveAttribute("lang", "en");
      await setSettingsPanelOpen(page, false);

      await expect(hanliComposer.getByRole("textbox", { name: "Send a message to Han Li" })).toBeVisible();
      await expect(hanliComposer.getByRole("switch", { name: "Automatic custody" })).toBeVisible();

      await taskList.getByRole("button", { name: /南宫婉/ }).click();
      const nangongComposer = page.locator(".nangong-person-composer");
      await expect(nangongComposer.getByRole("textbox", { name: "Send a message to Nangong Wan" })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath("persona-language-empty-states.png"), fullPage: true });
    } finally {
      await setSettingsPanelOpen(page, true).catch(() => undefined);
      const language = page.locator(".dev-settings-content select").filter({ has: page.locator('option[value="zh-CN"]') });
      await language.selectOption("zh-CN").catch(() => undefined);
      await setSettingsPanelOpen(page, false).catch(() => undefined);
      const singleConversation = taskList.getByRole("button", { name: "单会话", exact: true });
      if (await singleConversation.getAttribute("aria-pressed").catch(() => null) !== "true") {
        await singleConversation.click().catch(() => undefined);
      }
    }
  });

  test("截图窗口在设置读取恢复时保留原始技术详情", async () => {
    const { application, page } = getHarness();
    const recoveryError = "isolated settings.json: unexpected end of JSON input";
    await page.evaluate(async () => {
      await (window as any).desktop.setInteractionSettingsReadFailure("isolated settings.json: unexpected end of JSON input");
      await (window as any).desktop.setInteractionSettingsReadSource("recovered");
    });

    const screenshotWindowOpened = application.waitForEvent("window");
    await page.evaluate(() => (window as any).desktop.openInteractionScreenshotWindow());
    const screenshotPage = await screenshotWindowOpened;
    await screenshotPage.waitForLoadState("domcontentloaded");
    const error = screenshotPage.getByRole("alert");
    await expect(error.getByRole("heading")).toHaveText("无法读取语言设置");
    await expect(error.getByRole("button", { name: "关闭" })).toBeVisible();
    await expect(error.locator("details pre")).toHaveText(recoveryError);

    const screenshotClosed = screenshotPage.waitForEvent("close");
    await page.evaluate(() => (window as any).desktop.closeInteractionScreenshotWindow());
    await screenshotClosed;
    await page.evaluate(async () => {
      await (window as any).desktop.setInteractionSettingsReadSource("stored");
      await (window as any).desktop.setInteractionSettingsReadFailure(null);
    });
  });
}
