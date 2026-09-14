/** 页面验收期间只限制当前正式窗口的持久化写入，不创建窗口、状态投影或测试夹具。 */
export class HanliPageAcceptanceAuthorization {
  #activeWebContentsId: number | null = null;

  begin(webContentsId: number): void {
    if (this.#activeWebContentsId !== null) throw new Error("已有页面验收正在进行。");
    this.#activeWebContentsId = webContentsId;
  }

  end(webContentsId: number): void {
    if (this.#activeWebContentsId === webContentsId) this.#activeWebContentsId = null;
  }

  /** 验收模型只可读取状态和切换页面；所有业务写入仍由正式用户流程触发。 */
  assertIpcAllowed(webContentsId: number, channel: string): void {
    if (this.#activeWebContentsId !== webContentsId) return;
    const readOnly = /^(desktop:(get|list)-|desktop:resolve-effective-rule$|desktop:read-attachment-previews$)/u.test(channel);
    const navigation = channel === "desktop:set-operating-mode" || channel === "desktop:select-collaboration-member";
    if (readOnly || navigation) return;
    throw new Error("韩立页面验收只允许读取和安全导航，不能修改正式业务数据。");
  }
}
