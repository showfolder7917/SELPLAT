/**
 * 韩立会话页面的 View。
 *
 * 用户点击 Developer 左侧人物树中的“韩立”后，工作区路由会渲染本页面。
 * 页面对应实际界面中的韩立会话区，包含客户问答区、截图附件区、文字输入区和操作区。
 * 本文件只描述可见结构和交互绑定；发送、附件与消息投影由控制 Hook 负责。
 */

import { Code24Regular, Dismiss20Regular, EyeOff24Regular, Screenshot24Regular, Send24Filled } from "@fluentui/react-icons";

import { MarkdownMessage, SelUiConversation } from "../../conversation";
import type { HanliConversationWorkspaceProps } from "./HanliConversationWorkspace.types";
import { HanliCustodySwitch } from "./HanliConversationWorkspace/HanliCustodySwitch";
import { useHanliConversationWorkspace } from "./useHanliConversationWorkspace";

/** 韩立自由讨论页面只负责展示客户与韩立的直接问答，不暴露工程写入入口。 */
export function HanliConversationWorkspace(props: HanliConversationWorkspaceProps) {
  // 页面控制器（controller）提供已经整理好的数据和操作，页面结构不自行编排发送流程。
  const controller = useHanliConversationWorkspace(props);

  // 当前会话（conversation）是后端已经保存的韩立会话，用于显示读取统计。
  const conversation = props.conversation;
  // 待发送截图（attachments）是客户本轮准备发送的图片，用于显示发送前预览。
  const attachments = props.attachments;
  // 新建会话等待状态（newConversationBusy）表示父页面正在重新建立韩立会话。
  const newConversationBusy = props.newConversationBusy;
  // 页面错误（error）是父页面需要在输入区上方展示的当前问题。
  const error = props.error;
  // 截图操作（onScreenshot）把截图按钮请求交给父页面的统一截图能力。
  const onScreenshot = props.onScreenshot;
  // 错误更新操作（onError）让托管开关可以把失败原因显示在当前页面。
  const onError = props.onError;

  return <SelUiConversation
    // 页面根节点：固定 ID 供样式、自动化测试和真实页面定位使用。
    id="selConversationHanLiPersonaId"
    // 页面提交入口：统一会话外壳提交时调用控制 Hook 的发送操作。
    onSubmit={() => void controller.send()}
    // 会话区：页面上半部分，包含空状态、读取统计和客户问答历史。
    timeline={<section ref={controller.timelineRef} className="selconversation-timeline hanli-person-chat" aria-label="与韩立自由讨论">
      {/* 会话空状态：尚无问答时说明韩立页面的用途。 */}
      {controller.messages.length === 0 && <div className="dev-empty">
        {/* 空状态图标：帮助客户识别当前是人物对话页面。 */}
        <div className="dev-orb"><Code24Regular /></div>
        {/* 空状态标题：说明当前页面用于和韩立讨论真实需求。 */}
        <h1>和韩立讨论客户真正需要什么</h1>
        {/* 空状态说明：介绍韩立可以使用的方法资料和回答边界。 */}
        <p>可以直接描述问题。韩立会学习已整理的提问、调查和问题扩展方法，但不会按相似历史结论模仿回答。</p>
      </div>}

      {/* 上下文统计区：显示上一轮真正发送给韩立的各类上下文规模。 */}
      {!controller.busy && conversation.contextReadStats && <p className="hanli-context-read-stats" role="status" aria-live="polite">
        本轮读取：方法资料 {conversation.contextReadStats.methodCharacters.toLocaleString()} 字
        · 当前会话 {conversation.contextReadStats.recentConversationCharacters.toLocaleString()} 字
        · 本轮问题 {conversation.contextReadStats.latestUserMessageCharacters.toLocaleString()} 字
        · 发送上下文 {conversation.contextReadStats.promptCharacters.toLocaleString()} 字
      </p>}

      {/* 客户问答区：按发生顺序展示客户提问和韩立回答。 */}
      {controller.messages.map((message) => {
        // 消息截图预览（previews）是当前问答消息已经可以直接展示的图片。
        const previews = controller.previewsForMessage(message.messageId);

        return <article key={message.messageId} className="selconversation-message" data-role={message.speakerType}>
          {/* 问答身份区：显示“我”或“韩立”，并标记客户消息的发送状态。 */}
          <header>{message.speakerType === "user"
            ? `我${message.deliveryStatus === "sending" ? " · 发送中" : message.deliveryStatus === "failed" ? " · 发送失败" : ""}`
            : "韩立"}</header>

          {/* 问答内容区：承载本条消息的截图证据和文字正文。 */}
          <div className="selconversation-message-body">
            {/* 消息截图区：附件预览恢复成功时显示与本条问答绑定的图片。 */}
            {previews.length
              ? <div className="selconversation-message-attachments">
                {/* 单张消息截图：使用稳定附件 ID 关联预览和替代文字。 */}
                {previews.map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}
              </div>
              : message.attachmentIds?.length
                // 附件恢复状态：存在附件身份但暂时无法显示图片时给出原因。
                ? <small>{controller.attachmentPreviewErrors[message.messageId] || "附件预览正在恢复。"}</small>
                : null}
            {/* 消息正文区：使用统一 Markdown 组件展示客户原文或韩立回复。 */}
            <MarkdownMessage text={message.content} />
          </div>
        </article>;
      })}
    </section>}
    // 输入操作区：页面下半部分，包含待发送截图、状态提示、输入框和操作按钮。
    composer={<form
      className="selconversation-composer hanli-person-composer"
      onSubmit={(event) => {
        // 表单提交只阻止浏览器刷新，完整发送过程交给控制 Hook。
        event.preventDefault();
        // 调用控制 Hook 完成消息整理、桌面通信和状态更新。
        void controller.send();
      }}
    >
      {/* 待发送附件区：显示客户本轮已经选择、尚未提交的截图。 */}
      {attachments.length > 0 && <div className="selconversation-attachments">
        {/* 单张待发送附件：展示预览，并提供只移除当前图片的入口。 */}
        {attachments.map((attachment) => <figure key={attachment.id}>
          {/* 待发送截图预览：让客户在发送前确认选择的图片。 */}
          <img src={attachment.dataUrl} alt={attachment.name} />
          {/* 待发送截图说明：明确该图片会作为本轮讨论证据。 */}
          <figcaption>讨论截图</figcaption>
          {/* 移除截图按钮：只从本轮待发送附件中移除当前图片。 */}
          <button type="button" aria-label="移除截图" onClick={() => controller.removeAttachment(attachment.id)}>
            <Dismiss20Regular />
          </button>
        </figure>)}
      </div>}

      {/* 新建会话状态区：重新建立韩立会话期间显示真实等待状态。 */}
      {newConversationBusy && <div role="status">正在关闭当前韩立线程并建立新对话…</div>}
      {/* 页面错误区：桌面通信或业务处理失败时立即向客户显示原因。 */}
      {error && <div className="composer-error" role="alert"><span>{error}</span></div>}

      {/* 文字输入区：接收客户问题，也允许从剪贴板粘贴截图。 */}
      <textarea
        className="selconversation-input"
        data-sel-conversation-input
        aria-label="给韩立发送消息"
        placeholder="描述问题、真实目标或你不确定该怎么问的地方…（可粘贴截图）"
        value={controller.text}
        // 输入事件：把客户尚未发送的文字交给控制 Hook 保存。
        onChange={(event) => controller.setText(event.currentTarget.value)}
        // 粘贴事件：由控制 Hook 区分普通文字和图片文件。
        onPaste={controller.pasteImages}
      />

      {/* 底部操作区：左侧放辅助工具，右侧放主发送按钮。 */}
      <div className="selconversation-footer">
        {/* 辅助工具区：包含自动托管、当前窗口截图和隐藏窗口截图。 */}
        <div className="selconversation-tools">
          {/* 自动托管开关：调整韩立后续研讨是否允许持续自动推进。 */}
          <HanliCustodySwitch onError={onError} />
          {/* 当前窗口截图按钮：保留 AI Desktop 窗口并截取当前屏幕。 */}
          <button type="button" className="screenshot-button" aria-label="截取当前屏幕" onClick={() => onScreenshot(false)}>
            <Screenshot24Regular />
          </button>
          {/* 隐藏窗口截图按钮：截图前隐藏 AI Desktop，避免遮挡目标应用。 */}
          <button type="button" className="screenshot-button" aria-label="隐藏窗口后截图" onClick={() => onScreenshot(true)}>
            <EyeOff24Regular />
          </button>
        </div>

        {/* 主操作区：只放本轮对话的发送按钮。 */}
        <div className="selconversation-actions">
          {/* 发送按钮：满足工作区、文字或附件及空闲状态后才允许提交。 */}
          <button type="submit" className="selconversation-action" disabled={!controller.canSend} aria-label={controller.busy ? "思考中" : "发送给韩立"}>
            <Send24Filled />
          </button>
        </div>
      </div>
    </form>}
  />;
}
