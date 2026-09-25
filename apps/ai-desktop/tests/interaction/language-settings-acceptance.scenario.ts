import { expect, test, type ElectronApplication, type Page } from "@playwright/test";

type InteractionHarness = {
  application: ElectronApplication;
  page: Page;
};

export function registerLanguageSettingsAcceptanceScenarios(getHarness: () => InteractionHarness) {
  test("语言保存显示忙碌、成功后投影且失败时保留原语言", async () => {
    const { application, page } = getHarness();
    const [minimumWidth, minimumHeight] = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getMinimumSize() || [0, 0]);
    expect([minimumWidth, minimumHeight]).toEqual([680, 700]);
    await application.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0]?.setSize(size.width, size.height), { width: minimumWidth, height: minimumHeight });
    await expect.poll(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getSize())).toEqual([minimumWidth, minimumHeight]);
    const [contentWidth, contentHeight] = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getContentSize() || [0, 0]);

    try {
      await page.getByRole("button", { name: "打开连接与执行设置" }).click();
      const language = page.locator(".dev-settings-content select").filter({ has: page.locator('option[value="zh-CN"]') });
      const languageField = language.locator("xpath=..");
      await expect(language).toHaveValue("zh-CN");

      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateDelay(120));
      await language.selectOption("ja");
      await expect(language).toHaveAttribute("aria-busy", "true");
      await expect(languageField.getByRole("status")).toContainText("正在保存语言设置");
      await expect(page.locator(".developer-shell")).toHaveAttribute("lang", "ja");
      await expect(page.getByRole("group", { name: "実行モード" })).toBeVisible();
      await expect(language).toHaveValue("ja");

      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateDelay(0));
      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateFailure("隔离设置保存失败"));
      await language.selectOption("en");
      await expect(languageField.getByRole("alert")).toContainText("言語設定を保存できません");
      await expect(language).toHaveValue("ja");
      await expect(page.locator(".developer-shell")).toHaveAttribute("lang", "ja");

      await page.evaluate(() => (window as any).desktop.setInteractionSettingsUpdateFailure(null));
      await language.selectOption("en");
      await expect(page.locator(".developer-shell")).toHaveAttribute("lang", "en");
      await expect(page.getByRole("group", { name: "Execution mode" })).toBeVisible();
      await expect(language).toHaveValue("en");

      const geometry = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>(".dev-settings");
        const input = document.querySelector<HTMLElement>(".selconversation-input");
        if (!panel || !input) throw new Error("语言设置窄窗口缺少面板或输入区。");
        const panelBox = panel.getBoundingClientRect();
        const inputBox = input.getBoundingClientRect();
        return {
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          panelBox,
          inputBox,
        };
      });
      expect(geometry.viewportWidth).toBe(contentWidth);
      expect(geometry.viewportHeight).toBe(contentHeight);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(geometry.panelBox.left).toBeGreaterThanOrEqual(0);
      expect(geometry.panelBox.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
      expect(geometry.inputBox.left).toBeGreaterThanOrEqual(0);
      expect(geometry.inputBox.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);

      await page.getByRole("button", { name: "Close connection and execution settings" }).click();
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
