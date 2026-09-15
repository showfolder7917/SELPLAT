/** 韩立检查正式页面期间的写入保护；只控制权限，不提供另一套页面或材料系统。 */
export class HanliPageReviewGuard {
  #activeWebContentsId: number | null = null;

  begin(webContentsId: number): void {
    if (this.#activeWebContentsId !== null) throw new Error("韩立已在检查正式页面。");
    this.#activeWebContentsId = webContentsId;
  }

  end(webContentsId: number): void {
    if (this.#activeWebContentsId === webContentsId) this.#activeWebContentsId = null;
  }

  /** 页面检查只允许读取产品状态与安全导航，工作区源码由独立只读代码审查通道读取。 */
  assertIpcAllowed(webContentsId: number, channel: string): void {
    if (this.#activeWebContentsId !== webContentsId) return;
    if (channel === "desktop:list-workspace-directory" || channel === "desktop:open-workspace-file") {
      throw new Error("韩立检查页面时不能浏览工作区文件；源码由独立只读代码审查通道检查。");
    }
    const readOnly = /^(desktop:(get|list)-|desktop:resolve-effective-rule$|desktop:read-attachment-previews$)/u.test(channel);
    const navigation = channel === "desktop:set-operating-mode" || channel === "desktop:select-collaboration-member";
    if (readOnly || navigation) return;
    throw new Error("韩立检查页面时只允许读取和安全导航，不能修改正式业务数据。");
  }

  assertWorkspaceFileAllowed(webContentsId: number): void {
    if (this.#activeWebContentsId === webContentsId) {
      throw new Error("韩立检查页面时不能打开工作区文件；源码由独立只读代码审查通道检查。");
    }
  }

  assertWorkspaceDirectoryAllowed(webContentsId: number): void {
    if (this.#activeWebContentsId === webContentsId) {
      throw new Error("韩立检查页面时不能浏览工作区目录；源码由独立只读代码审查通道检查。");
    }
  }
}
