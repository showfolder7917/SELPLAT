/**
 * 南宫婉会话页面的数据结构定义。
 *
 * 用户点击 Developer 左侧人物树中的“南宫婉”后，路由会进入南宫婉会话页面。
 * 本文件只声明页面需要的数据，不渲染界面，也不执行发送或课题保存操作。
 */

import type {
  // 状态派发类型（Dispatch）描述 React 状态更新函数的调用形式。
  Dispatch,
  // 状态更新类型（SetStateAction）允许直接设置附件，也允许根据旧附件计算结果。
  SetStateAction,
} from "react";

import type {
  // 授权请求类型（CodexApprovalOutDto）表示当前等待客户处理的授权信息。
  CodexApprovalOutDto,
  // 演化状态类型（EvolutionStateOutDto）表示南宫婉正在推动的课题状态。
  EvolutionStateOutDto,
  // 界面语言类型（LocaleValue）表示当前页面使用的语言。
  LocaleValue,
  // 人物会话返回类型（PersonaConversationOutDto）表示后端保存的完整会话。
  PersonaConversationOutDto,
  // 工作区状态类型（WorkspaceStateOutDto）表示当前允许人物读取的工程范围。
  WorkspaceStateOutDto,
} from "../../../../contracts/system/desktop/index";

// 待发送附件类型（ComposerAttachment）表示输入区中尚未发送的截图。
import type { ComposerAttachment } from "../../conversation/model/chat-message";
// 人物会话控制方法（usePersonaConversation）提供公共运行状态；本文件只读取它的返回类型。
import type { usePersonaConversation } from "../../conversation/model/usePersonaConversation";

/** “整理为演化课题”表单中尚未保存的数据。 */
export interface NangongTopicDraft {
  /** 课题标题（title）是客户确认前可以修改的专题名称。 */
  title: string;
  /** 课题目标（goal）是本次演化最终需要达到的真实结果。 */
  goal: string;
  /** 影响范围（scope）是使用逗号分隔的范围输入。 */
  scope: string;
  /** 事实证据（evidence）是使用逗号分隔的证据输入。 */
  evidence: string;
  /** 验收条件（acceptanceCriteria）是使用逗号分隔的完成标准。 */
  acceptanceCriteria: string;
}

/** 南宫婉会话页面由父级路由传入的全部数据和操作。 */
export interface NangongConversationWorkspaceProps {
  /** 人物会话运行状态（runtime）保存发送锁、临时消息、附件预览和内部研讨消息。 */
  runtime: ReturnType<typeof usePersonaConversation>;
  /** 当前演化状态（state）是已经保存的演化专题与执行状态。 */
  state: EvolutionStateOutDto;
  /** 当前授权请求（approval）不属于南宫婉时，页面不会展示。 */
  approval: CodexApprovalOutDto | null;
  /** 当前南宫婉会话（conversation）是后端保存的完整会话。 */
  conversation: PersonaConversationOutDto;
  /** 待发送截图（attachments）是客户本轮准备发送的图片。 */
  attachments: ComposerAttachment[];
  /** 当前工作区（workspaces）限定本轮允许读取的工程范围，未就绪时为空。 */
  workspaces: WorkspaceStateOutDto | null;
  /** 当前界面语言（locale）会随人物请求一起发送给后端。 */
  locale: LocaleValue;
  /** 新建会话等待状态（newConversationBusy）表示父页面正在重新建立南宫婉会话。 */
  newConversationBusy: boolean;
  /** 页面错误（error）是父页面当前需要展示的问题。 */
  error: string;
  /** 演化状态更新操作（onState）使用后端权威结果刷新页面状态。 */
  onState(state: EvolutionStateOutDto): void;
  /** 会话更新操作（onConversation）使用后端权威结果刷新南宫婉会话。 */
  onConversation(conversation: PersonaConversationOutDto): void;
  /** 附件更新操作（onAttachments）更新客户本轮尚未发送的截图。 */
  onAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>;
  /** 截图操作（onScreenshot）请求桌面截图；hidden=true 表示截图前隐藏当前窗口。 */
  onScreenshot(hidden: boolean): void;
  /** 图片粘贴操作（onPaste）把剪贴板图片交给统一截图能力保存。 */
  onPaste(files: File[]): void;
  /** 错误更新操作（onError）把业务问题同步到父页面；空字符串表示清除错误。 */
  onError(message: string): void;
}
