import type { DeveloperApplicationController } from "./useDeveloperApplicationController";
import type { DeveloperWorkspaceRouterProps } from "./developerWorkspaceRouterTypes";

/** 应用控制器类型只作为 ViewModel 字段来源，不直接传给任何 Section。 */
type Controller = DeveloperApplicationController;

/** 整个窗口外壳需要的网格状态。 */
export type DeveloperShellViewModel = {
  /** 外壳节点用于挂载窗口级工具提示。 */
  shellRef: Controller["shell"]["ref"];
  /** 当前语言同时写入根节点的 lang 属性。 */
  locale: Controller["settings"]["locale"];
  /** 侧栏收起状态决定主网格是否释放第二列。 */
  collapsed: Controller["shell"]["sidebar"]["collapsed"];
  /** 当前侧栏宽度通过 CSS 自定义属性进入网格。 */
  style: Controller["shell"]["sidebar"]["shellStyle"];
};

/** 侧栏开关和宽度分隔线使用的纯显示数据与事件。 */
export type DeveloperSidebarViewModel = {
  /** 收起时隐藏导航和宽度分隔线。 */
  collapsed: Controller["shell"]["sidebar"]["collapsed"];
  /** 当前宽度提供给无障碍分隔线。 */
  width: Controller["shell"]["sidebar"]["width"];
  /** 用户允许调整到的最小宽度。 */
  minimumWidth: Controller["shell"]["sidebar"]["minimumWidth"];
  /** 用户允许调整到的最大宽度。 */
  maximumWidth: Controller["shell"]["sidebar"]["maximumWidth"];
  /** 开关按钮根据语言说明下一次点击的动作。 */
  toggleLabel: Controller["shell"]["sidebar"]["toggleLabel"];
  /** 宽度分隔线使用当前语言说明调整用途。 */
  resizeLabel: string;
  /** 点击侧栏图标时切换展开状态。 */
  onToggle: Controller["shell"]["sidebar"]["toggle"];
  /** 鼠标或触控拖动分隔线时调整宽度。 */
  onPointerResize: Controller["shell"]["sidebar"]["resizeWithPointer"];
  /** 键盘方向键和 Home 键调整宽度。 */
  onKeyboardResize: Controller["shell"]["sidebar"]["resizeWithKeyboard"];
  /** 双击分隔线恢复默认宽度。 */
  onResetWidth: Controller["shell"]["sidebar"]["resetWidth"];
};

/** 顶部标题栏只需要工程路径和窗口标题。 */
export type DeveloperTitleBarViewModel = {
  /** 当前主工作区路径显示在命令栏位置。 */
  projectRoot: Controller["workspace"]["projectRoot"];
  /** 当前语言对应的 Developer 窗口标题。 */
  title: Controller["text"]["title"];
};

/** 最左侧活动栏中的设置区域输入。 */
export type DeveloperActivityViewModel = {
  /** 测试台浮动窗口当前是否打开。 */
  testConsoleOpen: boolean;
  /** 测试台开关会与设置窗口互斥，避免两个侧窗相互遮挡。 */
  onTestConsoleOpenChange: (open: boolean) => void;
  /** 设置浮层当前是否打开。 */
  open: Controller["settingsPanel"]["open"];
  /** 设置浮层开关事件写回应用状态。 */
  onOpenChange: Controller["settingsPanel"]["setOpen"];
  /** 主会话状态显示在设置区域。 */
  status: Controller["codex"]["interaction"]["status"];
  /** 登录提示解释当前账号动作。 */
  loginHint: Controller["codex"]["interaction"]["loginHint"];
  /** 当前语言的全部设置文案。 */
  text: Controller["text"];
  /** 设置 Feature 自己持有的设置控制器。 */
  settings: Controller["settings"];
  /** 设置 Feature 自己持有的诊断控制器。 */
  diagnostics: Controller["diagnostics"];
  /** 当前协作任务为测试台提供真实执行、统一测试和重启记录。 */
  collaborationState: Controller["collaboration"]["data"]["state"];
  /** 当前演化状态为测试台提供专题、提案和韩立验收记录。 */
  evolutionState: Controller["evolution"]["state"];
  /** 设置 Feature 自己持有的工作区控制器。 */
  workspace: Controller["workspace"];
  /** 登录按钮触发主会话登录流程。 */
  onLogin: () => void;
  /** 退出按钮触发主会话退出流程。 */
  onLogout: () => void;
  /** 临时文件清理后同步清空主会话附件。 */
  onTempFilesCleared: () => void;
};

/** 左侧 Explorer 任务区域输入。 */
export type DeveloperExplorerViewModel = {
  /** 人物共同研讨状态用于显示协作人物信息。 */
  evolution: Controller["evolution"]["state"];
  /** 任务区域是否展开。 */
  expanded: Controller["tasks"]["expanded"];
  /** 当前界面语言。 */
  locale: Controller["settings"]["locale"];
  /** 最近一次任务摘要用于单会话模式。 */
  auditTask: NonNullable<Controller["diagnostics"]["auditInfo"]>["latestTask"] | null;
  /** 每个人物当前会话活动用于状态圆点。 */
  personaConversationActivities: Controller["personaConversationActivities"];
  /** 协作 Feature 控制器只交给它自己的任务导航组件。 */
  collaboration: Controller["collaboration"];
  /** 点击标题时切换任务区域展开状态。 */
  onToggle: Controller["tasks"]["toggle"];
};

/** AI Memory 异常时显示的纯提示数据。 */
export type AiMemoryRecoveryViewModel = {
  /** 状态名称同时决定提示条颜色。 */
  state: string;
  /** 当前语言对应的异常标题。 */
  title: string;
  /** 当前语言对应的恢复说明。 */
  message: string;
};

/** 右侧页面路由需要的应用级输入。 */
export type DeveloperWorkspaceRouterInputViewModel = DeveloperWorkspaceRouterProps;

/** 右侧工作区由可选恢复提示和真实页面路由组成。 */
export type DeveloperWorkspaceViewModel = {
  /** 数据库正常时为 null，异常时提供恢复提示。 */
  memoryRecovery: AiMemoryRecoveryViewModel | null;
  /** 路由只接收自己需要的应用状态。 */
  router: DeveloperWorkspaceRouterInputViewModel;
};

/** 底部状态栏显示当前运行权限和数据库状态。 */
export type DeveloperStatusBarViewModel = {
  /** 当前沙箱权限模式。 */
  sandboxMode: Controller["settings"]["sandboxMode"];
  /** AI Memory 当前真实状态。 */
  memoryStatus: Controller["diagnostics"]["aiMemoryDatabaseStatus"];
  /** 当前界面语言。 */
  locale: Controller["settings"]["locale"];
};

/** 全窗口审批弹窗只接收主会话控制器和语言。 */
export type DeveloperApprovalDialogViewModel = {
  /** 主会话控制器提供当前审批内容和提交动作。 */
  controller: Controller["codex"];
  /** 当前界面语言。 */
  locale: Controller["settings"]["locale"];
};

/** Developer 窗口的显示模型按真实可见区域切分。 */
export type DeveloperViewModel = {
  shell: DeveloperShellViewModel;
  sidebar: DeveloperSidebarViewModel;
  titleBar: DeveloperTitleBarViewModel;
  activity: DeveloperActivityViewModel;
  explorer: DeveloperExplorerViewModel;
  workspace: DeveloperWorkspaceViewModel;
  statusBar: DeveloperStatusBarViewModel;
  approvalDialog: DeveloperApprovalDialogViewModel;
};
