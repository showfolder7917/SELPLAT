/**
 * 南宫婉会话页面的页面结构。
 *
 * 用户点击 Developer 左侧人物树中的“南宫婉”后，工作区路由会显示本页面。
 * 页面包含后台动作区、问答与内部研讨区、课题草稿区、截图附件区和输入操作区。
 * 本文件只描述可见节点和交互绑定，业务状态与异步操作由控制 Hook 负责。
 */

import {
  // 空会话图标（Code24Regular）用于南宫婉会话为空时的引导区域。
  Code24Regular,
  // 移除图标（Dismiss20Regular）用于待发送截图的删除按钮。
  Dismiss20Regular,
  // 隐藏截图图标（EyeOff24Regular）用于截图前隐藏当前窗口的按钮。
  EyeOff24Regular,
  // 当前屏幕截图图标（Screenshot24Regular）用于保留当前窗口的截图按钮。
  Screenshot24Regular,
  // 发送图标（Send24Filled）用于本轮问答的主发送按钮。
  Send24Filled,
} from "@fluentui/react-icons";

// 消息正文组件（MarkdownMessage）把人物消息渲染成统一格式。
import { MarkdownMessage } from "../../conversation/components/MarkdownMessage";
// 统一会话外壳（SelUiConversation）提供人物会话共用的时间线和输入区结构。
import { SelUiConversation } from "../../conversation/components/SelUiConversation";
// 南宫婉页面参数类型（NangongConversationWorkspaceProps）描述父路由传入的全部数据和操作。
import type { NangongConversationWorkspaceProps } from "./NangongConversationWorkspace.types";
// 后台动作子组件（NangongConversationActivity）展示本页面专属的调查与授权状态。
import { NangongConversationActivity } from "./NangongConversationWorkspace/NangongConversationActivity";
// 南宫婉页面控制方法（useNangongConversationWorkspace）准备页面数据并执行发送与课题操作。
import { useNangongConversationWorkspace } from "./useNangongConversationWorkspace";

// 人物名称表（personaNames）把内部人物编号转换成客户可见名称。
const personaNames: Record<string, string> = {
  // 韩立人物编号（han-li）在内部研讨区显示为“韩立”。
  "han-li": "韩立",
  // 南宫婉人物编号（nangong-wan）在内部研讨区显示为“南宫婉”。
  "nangong-wan": "南宫婉",
  // 令狐人物编号（linghu-ancestor）在内部研讨区显示为“令狐老祖”。
  "linghu-ancestor": "令狐老祖",
};

/** 南宫婉页面只负责呈现讨论、调查事实和客户确认过的课题草稿。 */
export function NangongConversationWorkspace(props: NangongConversationWorkspaceProps) {
  // 页面控制器（controller）包含控制方法整理好的页面数据和具名操作。
  const controller = useNangongConversationWorkspace(props);
  // 当前演化状态（state）供后台动作子组件展示调查进度。
  const state = props.state;
  // 当前授权请求（approval）可能包含需要南宫婉等待客户处理的信息。
  const approval = props.approval;
  // 待发送截图（attachments）是本轮尚未提交的图片。
  const attachments = props.attachments;
  // 当前工作区（workspaces）表示工程范围是否已经准备好。
  const workspaces = props.workspaces;
  // 新建会话等待状态（newConversationBusy）表示父页面正在重新建立会话。
  const newConversationBusy = props.newConversationBusy;
  // 页面错误（error）是父页面需要显示的业务问题。
  const error = props.error;
  // 截图操作（onScreenshot）把截图按钮请求交给统一截图能力。
  const onScreenshot = props.onScreenshot;

  // 返回南宫婉会话页面的统一会话外壳。
  return <SelUiConversation
    // 页面根身份：供样式、自动化验证和真实页面定位使用。
    id="selConversationNangongWanId"
    // 外壳提交入口：调用与页面表单相同的发送方法。
    onSubmit={() => void controller.sendChat()}
    // 会话区：显示后台动作、持续演化确认、直接问答和内部研讨。
    timeline={<section ref={controller.timelineRef} className="selconversation-timeline nangong-person-chat" aria-label="与南宫婉讨论演化课题">
      {/* 后台动作区：展示南宫婉当前调查、阻塞或等待授权的事实。 */}
      <NangongConversationActivity state={state} approval={approval} />

      {/* 持续演化确认区：具备启动条件后仍等待客户明确回复 1。 */}
      {controller.showOneShotConfirmation && <section className="nangong-one-shot-confirmation" role="status" aria-label="本轮演化等待确认">
        {/* 确认标题：说明本轮已经具备启动条件。 */}
        <strong>本轮已具备启动条件</strong>
        {/* 确认说明：解释回复 1 将产生的持续行为。 */}
        <span>回复 1 将启动持续自动演化：完成当前课题后继续寻找有证据的新问题，直到暂停或停止。</span>
        {/* 确认按钮：以明确文字“1”进入普通会话发送流程。 */}
        <button type="button" className="selform-action" disabled={controller.chatBusy || !workspaces} onClick={() => void controller.sendChat("1")}>回复 1 并启动持续演化</button>
      </section>}

      {/* 新会话反馈区：显示后台重新建立人物会话的结果。 */}
      {controller.newConversationFeedback && <div className="nangong-conversation-refresh-status" role="status">{controller.newConversationFeedback}</div>}

      {/* 会话空状态：还没有任何问答或内部研讨时说明页面用途。 */}
      {controller.visibleMessages.length === 0 && <div className="dev-empty">
        {/* 空状态图标：帮助客户识别当前是人物讨论页面。 */}
        <div className="dev-orb"><Code24Regular /></div>
        {/* 空状态标题：说明当前可以与南宫婉讨论演化方向。 */}
        <h1>和南宫婉讨论演化方向</h1>
        {/* 空状态提示：引导客户提供现状、问题和约束。 */}
        <p>先说现状、问题和不能改变的约束，调查成熟后再形成课题。</p>
      </div>}

      {/* 问答与内部研讨区：按真实时间展示当前会话的全部可见消息。 */}
      {controller.visibleMessages.map((message) => {
        // 是否为内部消息（internal）表示当前内容是否来自人物内部研讨。
        const internal = controller.internalIds.has(message.messageId);
        // 人物显示名称（personaName）把内部人物编号转换成客户可以识别的名字。
        const personaName = personaNames[message.speakerPersonaId || "nangong-wan"] || message.speakerPersonaId;
        // 发送状态文字（deliveryLabel）只为客户消息补充发送中或发送失败状态。
        const deliveryLabel = message.status === "sending" ? " · 发送中" : message.status === "failed" ? " · 发送失败" : "";
        // 内部消息类型文字（internalLabel）区分普通问答、内部研讨和内部交接。
        let internalLabel = "";
        // 内部消息需要在人物名称后显示其真实业务来源。
        if (internal) {
          // 验收消息属于人物之间的内部交接，其他内部消息属于研讨。
          internalLabel = message.messageId.startsWith("internal:acceptance:") ? " · 内部交接" : " · 内部研讨";
        }
        // 消息身份文字（speakerLabel）是消息头最终显示的客户或人物名称。
        const speakerLabel = message.speakerType === "user" ? `我${deliveryLabel}` : `${personaName}${internalLabel}`;

        return <article key={message.messageId} className="selconversation-message" data-role={message.speakerType} data-internal-message-id={internal ? message.messageId : undefined}>
          {/* 消息身份区：显示客户或人物名称以及当前传递状态。 */}
          <header>{speakerLabel}</header>
          {/* 消息正文区：承载截图证据、附件恢复提示和正文。 */}
          <div className="selconversation-message-body">
            {/* 消息截图区：附件预览恢复成功后显示全部关联图片。 */}
            {message.attachments.length
              ? <div className="selconversation-message-attachments">{message.attachments.map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}</div>
              : message.attachmentIds?.length
                ? <small>{controller.attachmentPreviewErrors[message.messageId] || "附件预览正在恢复。"}</small>
                : null}
            {/* 消息文字区：统一渲染客户原文和人物回复。 */}
            <MarkdownMessage text={message.content} />
          </div>
        </article>;
      })}
    </section>}
    // 输入操作区：包含课题草稿、待发送截图、输入框和操作按钮。
    composer={<form className="selconversation-composer nangong-person-composer" onSubmit={(event) => {
      // 阻止浏览器执行原生表单刷新。
      event.preventDefault();
      // 调用控制 Hook 完成本轮人物消息发送。
      void controller.sendChat();
    }}>
      {/* 课题草稿区：把已经讨论的内容整理成客户可编辑、可确认的结构。 */}
      {controller.topicDraftOpen && <section className="selform-root" aria-label="整理演化课题">
        {/* 草稿标题区：显示表单用途并提供取消按钮。 */}
        <header className="selform-header"><strong>整理为演化课题</strong><button type="button" className="selform-action" disabled={controller.topicDraftBusy} onClick={() => controller.setTopicDraftOpen(false)}>取消</button></header>
        {/* 草稿等待状态：说明南宫婉正在根据当前对话生成字段。 */}
        {controller.topicDraftBusy && <p role="status">南宫婉正在根据当前对话整理课题草稿…</p>}
        {/* 草稿成功反馈：说明表单已经自动填充但仍可编辑。 */}
        {!controller.topicDraftBusy && controller.topicDraftFeedback && <p role="status" className="selform-feedback">{controller.topicDraftFeedback}</p>}
        {/* 自动整理按钮：只生成草稿，不直接创建课题。 */}
        <button type="button" className="selform-action" disabled={controller.topicDraftBusy} onClick={() => void controller.generateTopicDraft()}>根据当前对话生成草稿</button>
        {/* 课题标题字段：填写客户可识别的专题名称。 */}
        <label className="selform-field">课题标题<input aria-label="课题标题" value={controller.topicDraft.title} onChange={(event) => controller.updateTopicDraft("title", event.currentTarget.value)} /></label>
        {/* 课题目标字段：填写本次演化需要达到的结果。 */}
        <label className="selform-field">课题目标<textarea aria-label="课题目标" value={controller.topicDraft.goal} onChange={(event) => controller.updateTopicDraft("goal", event.currentTarget.value)} /></label>
        {/* 影响范围字段：填写本次允许改变的业务范围。 */}
        <label className="selform-field">影响范围<input aria-label="课题影响范围" placeholder="多项用逗号分隔" value={controller.topicDraft.scope} onChange={(event) => controller.updateTopicDraft("scope", event.currentTarget.value)} /></label>
        {/* 事实证据字段：记录支持建立课题的已核实事实。 */}
        <label className="selform-field">事实证据<input aria-label="课题事实证据" placeholder="多项用逗号分隔" value={controller.topicDraft.evidence} onChange={(event) => controller.updateTopicDraft("evidence", event.currentTarget.value)} /></label>
        {/* 验收条件字段：明确什么结果表示课题完成。 */}
        <label className="selform-field">验收条件<input aria-label="课题验收条件" placeholder="多项用逗号分隔" value={controller.topicDraft.acceptanceCriteria} onChange={(event) => controller.updateTopicDraft("acceptanceCriteria", event.currentTarget.value)} /></label>
        {/* 保存课题按钮：提交客户检查并确认过的完整草稿。 */}
        <button type="button" className="selform-action" data-tone="primary" disabled={controller.topicDraftBusy} onClick={() => void controller.convertChat()}>确认保存课题</button>
      </section>}

      {/* 待发送截图区：发送前展示并允许移除本轮调查截图。 */}
      {attachments.length > 0 && <div className="selconversation-attachments">{attachments.map((attachment) => <figure key={attachment.id}>
        {/* 调查截图预览：让客户确认本轮实际发送的图片。 */}
        <img src={attachment.dataUrl} alt={attachment.name} />
        {/* 调查截图说明：表明图片会作为本轮事实材料。 */}
        <figcaption>调查截图</figcaption>
        {/* 移除截图按钮：只移除当前选中的一张图片。 */}
        <button type="button" aria-label="移除截图" onClick={() => controller.removeAttachment(attachment.id)}><Dismiss20Regular /></button>
      </figure>)}</div>}

      {/* 新建会话状态区：重新建立南宫婉会话时显示真实等待状态。 */}
      {newConversationBusy && <div className="nangong-conversation-refresh-status" role="status">正在关闭当前南宫婉线程并建立新对话…</div>}
      {/* 页面错误区：展示发送、草稿或桌面通信失败原因。 */}
      {error && <div className="composer-error" role="alert"><span>{error}</span></div>}

      {/* 问答输入区：接收客户文字，也允许粘贴截图。 */}
      <textarea className="selconversation-input" data-sel-conversation-input aria-label="给南宫婉发送消息" placeholder="描述演化问题、现状和不可改变的约束…（可粘贴截图）" value={controller.chatText} onChange={(event) => controller.setChatText(event.currentTarget.value)} onPaste={controller.pasteImages} />

      {/* 底部操作区：左侧放调查工具，右侧放主发送按钮。 */}
      <div className="selconversation-footer">
        {/* 辅助工具区：包含两种截图方式和课题整理入口。 */}
        <div className="selconversation-tools">
          {/* 当前屏幕截图：保留 AI Desktop 窗口进行截图。 */}
          <button type="button" className="screenshot-button" aria-label="截取当前屏幕" data-sel-tooltip="截取当前屏幕" data-sel-tooltip-mode="always" onClick={() => onScreenshot(false)}><Screenshot24Regular /></button>
          {/* 隐藏窗口截图：截图前隐藏 AI Desktop，避免遮挡目标。 */}
          <button type="button" className="screenshot-button" aria-label="隐藏窗口后截图" data-sel-tooltip="隐藏窗口后截图" data-sel-tooltip-mode="always" onClick={() => onScreenshot(true)}><EyeOff24Regular /></button>
          {/* 课题整理入口：已有会话事实后才允许打开草稿。 */}
          <button type="button" className="selconversation-action" data-tone="neutral" disabled={!controller.canOpenTopicDraft} onClick={() => controller.setTopicDraftOpen(true)}>整理为演化课题</button>
        </div>
        {/* 主操作区：只放本轮问答的发送按钮。 */}
        <div className="selconversation-actions">
          {/* 发送按钮：由控制 Hook 统一决定是否具备发送条件。 */}
          <button type="submit" className="selconversation-action" disabled={!controller.canSend} aria-label={controller.chatBusy ? "调查中" : "发送给南宫婉"}><Send24Filled /></button>
        </div>
      </div>
    </form>}
  />;
}
