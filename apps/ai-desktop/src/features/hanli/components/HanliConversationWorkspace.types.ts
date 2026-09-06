/**
 * 韩立会话页面的数据结构定义。
 *
 * 用户点击 Developer 左侧人物树中的“韩立”后，工作区路由会进入韩立会话页面。
 * 本文件只说明该页面需要哪些数据和操作，不渲染页面，也不执行发送、截图或持久化。
 */

import type {
  // 状态派发类型（Dispatch）描述 React 状态更新函数的调用形式。
  Dispatch,
  // 状态更新类型（SetStateAction）允许直接提供新附件，也允许根据旧附件计算结果。
  SetStateAction,
} from "react";

import type {
  // 界面语言类型（LocaleValue）表示当前页面使用的语言。
  LocaleValue,
  // 人物会话返回类型（PersonaConversationOutDto）表示后端返回的完整韩立会话。
  PersonaConversationOutDto,
  // 工作区状态类型（WorkspaceStateOutDto）表示已经登记并允许韩立读取的工程范围。
  WorkspaceStateOutDto,
} from "../../../../contracts/system/desktop/index";
// 待发送附件类型（ComposerAttachment）表示发送前保存在输入区中的截图。
import type { ComposerAttachment } from "../../conversation/model/chat-message";
// 人物会话控制方法（usePersonaConversation）提供共用状态；本文件只读取它的返回类型。
import type { usePersonaConversation } from "../../conversation/model/usePersonaConversation";

/** 韩立会话 View 由父工作区路由传入的全部数据和操作。 */
export interface HanliConversationWorkspaceProps {
  /** 人物会话控制器，保存发送锁、待发送消息、附件预览和错误恢复状态。 */
  runtime: ReturnType<typeof usePersonaConversation>;
  /** 后端已经保存的完整韩立会话，包含用户、韩立和内部研讨消息。 */
  conversation: PersonaConversationOutDto;
  /** 用户本轮准备发送、但尚未提交的截图附件。 */
  attachments: ComposerAttachment[];
  /** 当前登记的工作区；韩立必须知道讨论的是哪个工程，所以未就绪时为 null。 */
  workspaces: WorkspaceStateOutDto | null;
  /** 当前界面语言，会随发送请求一起交给韩立后端。 */
  locale: LocaleValue;
  /** 点击“重新建立韩立对话”后，由父页面传入的等待状态。 */
  newConversationBusy: boolean;
  /** 父页面保存的可见错误，例如桌面通信失败。 */
  error: string;
  /** 后端返回新会话后，用它替换父页面中的旧会话。 */
  onConversation(value: PersonaConversationOutDto): void;
  /** 更新父页面中的待发送附件；既可直接设置，也可根据当前附件计算。 */
  onAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>;
  /** 请求桌面截图；hidden=true 表示截图前先隐藏 AI Desktop 窗口。 */
  onScreenshot(hidden: boolean): void;
  /** 把从剪贴板提取出的图片文件交给统一截图能力保存。 */
  onPaste(files: File[]): void;
  /** 把当前错误同步回父页面；空字符串表示清除错误。 */
  onError(message: string): void;
}
