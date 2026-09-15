/** 页面验收期间只限制当前正式窗口的持久化写入，不创建窗口、状态投影或测试夹具。 */
export class HanliPageAcceptanceAuthorization {
  #activeWebContentsId: number | null = null;
  #activeTopicId: string | null = null;
  #activeProposalId: string | null = null;

  begin(webContentsId: number, identity: { topicId: string; proposalId: string }): void {
    if (this.#activeWebContentsId !== null) throw new Error("已有页面验收正在进行。");
    this.#activeWebContentsId = webContentsId;
    this.#activeTopicId = identity.topicId;
    this.#activeProposalId = identity.proposalId;
  }

  end(webContentsId: number): void {
    if (this.#activeWebContentsId !== webContentsId) return;
    this.#activeWebContentsId = null;
    this.#activeTopicId = null;
    this.#activeProposalId = null;
  }

  /** 验收模型只可读取状态和切换页面；所有业务写入仍由正式用户流程触发。 */
  assertIpcAllowed(webContentsId: number, channel: string): void {
    if (this.#activeWebContentsId !== webContentsId) return;
    if (channel === "desktop:open-workspace-file") {
      throw new Error(`专题 ${this.#activeTopicId} 的提案 ${this.#activeProposalId} 尚未绑定工作区材料授权。`);
    }
    const readOnly = /^(desktop:(get|list)-|desktop:resolve-effective-rule$|desktop:read-attachment-previews$)/u.test(channel);
    const navigation = channel === "desktop:set-operating-mode" || channel === "desktop:select-collaboration-member";
    if (readOnly || navigation) return;
    throw new Error("韩立页面验收只允许读取和安全导航，不能修改正式业务数据。");
  }
}
