/**
 * Codex 会话页面的数据结构定义。
 * 这些类型只描述 Developer 应用交给会话页的公开边界和页面文案，不执行业务逻辑。
 */

import type {
  // 界面区域：限制页面只能选择 Desktop 已支持的语言。
  LocaleValue,
  // 沙箱模式：限制页面只能展示 Desktop 已支持的文件权限模式。
  SandboxModeValue,
} from "../../../../contracts/system/desktop/index";
// 协作工作区 Hook 的类型来自协作功能公开入口，本页用它查找消息关联任务。
import type { useCollaborationWorkspace } from "../../collaboration";
// 截图捕获 Hook 的类型来自截图功能公开入口，本页用它触发截图与粘贴。
import type { useScreenshotCapture } from "../../screenshot";
// 主会话工作区 Hook 的类型来自对话 model，它是本页内部的唯一会话状态所有者。
import type { useCodexWorkspace } from "../model/useCodexWorkspace";

/** 开发者应用交给 Codex 会话页的公开参数。 */
export interface CodexConversationWorkspaceProps {
  /** 界面语言：决定页面使用中文还是日文文案。 */
  locale: LocaleValue;
  /** 沙箱模式：在底部工具栏向客户显示当前文件权限。 */
  sandboxMode: SandboxModeValue;
  /** 会话控制器：提供消息、审批、队列和自动测试状态与操作。 */
  controller: ReturnType<typeof useCodexWorkspace>;
  /** 截图控制器：提供截图、粘贴、权限恢复和附件输入。 */
  screenshot: ReturnType<typeof useScreenshotCapture>;
  /** 协作控制器：将 Codex 回复与真实协作任务关联并提供继续执行。 */
  collaboration: ReturnType<typeof useCollaborationWorkspace>;
}

/** 会话页组件共用的可见文案。 */
export interface CodexConversationWorkspaceText {
  /** 连接就绪文案。 */
  ready: string;
  /** 未登录文案。 */
  signedOut: string;
  /** 登录按钮文案。 */
  signIn: string;
  /** 输入提示文案。 */
  placeholder: string;
  /** 附件说明文案。 */
  attachment: string;
  /** 附件移除文案。 */
  remove: string;
  /** 当前窗口截图说明。 */
  screenshot: string;
  /** 隐藏窗口截图说明。 */
  hiddenScreenshot: string;
  /** 系统设置入口文案。 */
  openSettings: string;
  /** 自动测试开关文案。 */
  automaticTest: string;
  /** 测试预检文案。 */
  checking: string;
  /** 测试就绪文案。 */
  readyTest: string;
  /** 测试阻断标题。 */
  blocked: string;
  /** 对话框关闭文案。 */
  close: string;
}

/** 消息时间线参数：只保留渲染消息和推进协作阶段真正需要的边界。 */
export interface CodexConversationTimelineProps {
  /** 界面语言：用于空会话标题和协作状态文案。 */
  locale: LocaleValue;
  /** 会话控制器：提供消息、结构化追问和托管阶段操作。 */
  controller: ReturnType<typeof useCodexWorkspace>;
  /** 协作控制器：查找消息关联任务并继续失败任务。 */
  collaboration: ReturnType<typeof useCollaborationWorkspace>;
  /** 页面文案：由父 View 一次选定，子模块不再分散判断语言。 */
  text: CodexConversationWorkspaceText;
}

/** 会话编辑区参数：只保留发送、截图和显示当前权限真正需要的边界。 */
export interface CodexConversationComposerProps {
  /** 界面语言：用于重启授权按钮和执行模式文案。 */
  locale: LocaleValue;
  /** 沙箱模式：在底部工具栏显示当前文件权限。 */
  sandboxMode: SandboxModeValue;
  /** 会话控制器：提供输入、附件、队列、发送和自动测试操作。 */
  controller: ReturnType<typeof useCodexWorkspace>;
  /** 截图控制器：提供截图、粘贴与系统权限恢复操作。 */
  screenshot: ReturnType<typeof useScreenshotCapture>;
  /** 页面文案：由父 View 一次选定，子模块不再分散判断语言。 */
  text: CodexConversationWorkspaceText;
}
