/** 页面验收期间只限制当前正式窗口的持久化写入，不创建窗口、状态投影或测试夹具。 */
export class HanliPageAcceptanceAuthorization {
  #activeWebContentsId: number | null = null;
  #activeTopicId: string | null = null;
  #activeProposalId: string | null = null;
  #materials: { workspaceId: string; relativePath: string; allowedActions: string[] }[] = [];

  begin(webContentsId: number, identity: { topicId: string; proposalId: string; materials?: { workspaceId: string; relativePath: string; allowedActions: string[] }[] }): void {
    if (this.#activeWebContentsId !== null) throw new Error("已有页面验收正在进行。");
    this.#activeWebContentsId = webContentsId;
    this.#activeTopicId = identity.topicId;
    this.#activeProposalId = identity.proposalId;
    this.#materials = structuredClone(identity.materials || []);
  }

  end(webContentsId: number): void {
    if (this.#activeWebContentsId !== webContentsId) return;
    this.#activeWebContentsId = null;
    this.#activeTopicId = null;
    this.#activeProposalId = null;
    this.#materials = [];
  }

  /** 验收模型只可读取状态和切换页面；所有业务写入仍由正式用户流程触发。 */
  assertIpcAllowed(webContentsId: number, channel: string): void {
    if (this.#activeWebContentsId !== webContentsId) return;
    // 文件请求的路径和动作由工作区 IPC 在参数可见时继续核对。
    if (channel === "desktop:open-workspace-file") return;
    const readOnly = /^(desktop:(get|list)-|desktop:resolve-effective-rule$|desktop:read-attachment-previews$)/u.test(channel);
    const navigation = channel === "desktop:set-operating-mode" || channel === "desktop:select-collaboration-member";
    if (readOnly || navigation) return;
    throw new Error("韩立页面验收只允许读取和安全导航，不能修改正式业务数据。");
  }

  /** 只允许当前验收会话打开计划冻结的精确文件，文本和演示文稿使用不同动作。 */
  assertWorkspaceFileAllowed(webContentsId: number, workspaceId: string, relativePath: string): void {
    if (this.#activeWebContentsId !== webContentsId) return;
    const action = /\.pptx?$/iu.test(relativePath) ? "system-open" : "preview";
    const material = this.#materials.find((item) => item.workspaceId === workspaceId && item.relativePath === relativePath);
    if (material?.allowedActions.includes(action)) return;
    throw new Error(`专题 ${this.#activeTopicId} 的提案 ${this.#activeProposalId} 未授权此工作区材料操作。`);
  }

  /** 目录只可沿已授权文件的祖先路径展开，防止验收窗口浏览无关工作区内容。 */
  assertWorkspaceDirectoryAllowed(webContentsId: number, workspaceId: string, relativePath: string): void {
    if (this.#activeWebContentsId !== webContentsId) return;
    if (!this.#materials.some((material) => material.workspaceId === workspaceId)) {
      throw new Error(`专题 ${this.#activeTopicId} 的提案 ${this.#activeProposalId} 未冻结此工作区的验收材料，无法浏览目录。`);
    }
    const normalizedDirectory = relativePath.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
    const allowed = this.#materials.some((material) => material.workspaceId === workspaceId
      && (normalizedDirectory === "" || material.relativePath.replaceAll("\\", "/").startsWith(`${normalizedDirectory}/`)));
    if (allowed) return;
    throw new Error(`专题 ${this.#activeTopicId} 的提案 ${this.#activeProposalId} 未授权浏览此工作区目录。`);
  }
}
