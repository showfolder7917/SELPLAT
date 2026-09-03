/**
 * selConversation：统一对话时间线与输入区的键盘生命周期。
 * 业务页面只提供消息、附件、工具和发送动作；输入法合成期间的回车永远不提交。
 */
(function registerSelConversation(globalScope) {
  "use strict";

  const sel = globalScope.sel;
  if (!sel?.register) throw new Error("selConversation requires selKernel before registration.");

  const controllers = new Map();

  /** 同时检查浏览器标准字段和 229 兼容标记，避免候选词确认被误判为发送。 */
  function isComposing(event, compositionActive) {
    return compositionActive || event.isComposing === true || event.keyCode === 229;
  }

  /** 普通 Enter 提交，Shift+Enter 换行，输入法候选确认不提交。 */
  function shouldSubmit(event, compositionActive) {
    return event.key === "Enter" && event.shiftKey !== true && !isComposing(event, compositionActive);
  }

  /**
   * 挂载对话输入生命周期。
   * @param {HTMLElement} host 对话控件根节点。
   * @param {{id:string,input?:HTMLTextAreaElement}} options 实例 ID 与输入节点。
   */
  function mount(host, options) {
    if (!(host instanceof HTMLElement)) throw new TypeError("selConversation.mount requires an HTMLElement host.");
    const id = String(options?.id || "").trim();
    if (!/^selConversation[A-Z][A-Za-z0-9]*Id$/.test(id)) throw new Error("selConversation id must match selConversation<BusinessMeaning>Id.");
    if (controllers.has(id)) throw new Error(`selConversation instance already exists: ${id}`);
    const input = options?.input || host.querySelector("[data-sel-conversation-input]");
    if (!(input instanceof HTMLTextAreaElement)) throw new Error("selConversation requires a textarea input.");

    let compositionActive = false;
    const onCompositionStart = () => { compositionActive = true; };
    const onCompositionEnd = () => { compositionActive = false; };
    const onKeyDown = (event) => {
      if (!shouldSubmit(event, compositionActive)) return;
      event.preventDefault();
      host.dispatchEvent(new CustomEvent("selConversation:submit", { bubbles: true, detail: { id } }));
    };
    input.addEventListener("compositionstart", onCompositionStart);
    input.addEventListener("compositionend", onCompositionEnd);
    input.addEventListener("keydown", onKeyDown);

    const controller = {
      destroy() {
        input.removeEventListener("compositionstart", onCompositionStart);
        input.removeEventListener("compositionend", onCompositionEnd);
        input.removeEventListener("keydown", onKeyDown);
        controllers.delete(id);
        return true;
      },
    };
    controllers.set(id, controller);
    return controller;
  }

  window.sel.register("components.conversation", { mount, shouldSubmit });
})(window);
