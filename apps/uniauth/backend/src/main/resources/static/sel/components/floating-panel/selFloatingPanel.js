/*
 * selFloatingPanel.js：可复用的锚定式浮动面板基础控件。
 * 负责入口、标题外壳、开关、外部点击、Escape、焦点归还与滚轮边界隔离。
 * 责任边界：不创建标签页或业务设置项，内容由调用方显式传入。
 */
(function selFloatingPanelInitializeRegistry() {
    "use strict";

    // WeakMap 以宿主元素隔离同页多个浮动面板，宿主释放后不保留全局引用。
    const selFloatingPanelControllers = new WeakMap();

    // 可选业务样式类只接受非空字符串，基础控件类始终保留。
    function selFloatingPanelMergeClass(selFloatingPanelBaseClass, selFloatingPanelConsumerClass) {
        return [selFloatingPanelBaseClass, String(selFloatingPanelConsumerClass || "").trim()].filter(Boolean).join(" ");
    }

    /**
     * 显式挂载一个锚定式浮动面板。
     * @param {Element} selFloatingPanelHost - 调用方提供的独立宿主。
     * @param {object} selFloatingPanelOptions - 标识、标题、图标、内容和业务样式类。
     * @returns {object|null} 浮动面板控制器。
     */
    function selFloatingPanelMount(selFloatingPanelHost, selFloatingPanelOptions = {}) {
        // 非元素宿主不能建立独立的定位与事件边界。
        if (!(selFloatingPanelHost instanceof Element)) return null;
        // 同一宿主重复挂载时复用既有控制器，避免全局关闭事件叠加。
        if (selFloatingPanelControllers.has(selFloatingPanelHost)) return selFloatingPanelControllers.get(selFloatingPanelHost);

        // 稳定 ID 同时生成面板 DOM id 和入口 aria-controls。
        const selFloatingPanelId = String(selFloatingPanelOptions.id || `floating-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "-");
        // 业务可添加兼容类，但不能替换基础结构类。
        const selFloatingPanelClasses = selFloatingPanelOptions.classes || {};
        // 外层控制器建立固定或自定义锚点定位上下文。
        const selFloatingPanelControl = document.createElement("aside");
        selFloatingPanelControl.className = selFloatingPanelMergeClass("selfloating-control", selFloatingPanelClasses.control);
        selFloatingPanelControl.dataset.selFloatingPanelControl = selFloatingPanelId;
        selFloatingPanelControl.setAttribute("aria-label", String(selFloatingPanelOptions.label || selFloatingPanelOptions.title || "浮动面板"));

        // 入口按钮只负责切换当前面板，不承载调用方业务动作。
        const selFloatingPanelTrigger = document.createElement("button");
        selFloatingPanelTrigger.className = selFloatingPanelMergeClass("selfloating-trigger", selFloatingPanelClasses.trigger);
        selFloatingPanelTrigger.type = "button";
        selFloatingPanelTrigger.setAttribute("aria-label", String(selFloatingPanelOptions.openLabel || `打开${selFloatingPanelOptions.title || "浮动面板"}`));
        selFloatingPanelTrigger.setAttribute("aria-controls", `selfloating-panel-${selFloatingPanelId}`);
        selFloatingPanelTrigger.setAttribute("aria-expanded", "false");
        selFloatingPanelTrigger.innerHTML = `<i class="${String(selFloatingPanelOptions.triggerIcon || "ri-layout-right-line")}" aria-hidden="true"></i>`;

        // dialog 外壳提供通用水晶材质和标题结构，默认不作为模态层阻断页面其他区域。
        const selFloatingPanelPanel = document.createElement("section");
        selFloatingPanelPanel.className = selFloatingPanelMergeClass("selfloating-panel", selFloatingPanelClasses.panel);
        selFloatingPanelPanel.id = `selfloating-panel-${selFloatingPanelId}`;
        selFloatingPanelPanel.dataset.selFloatingPanel = selFloatingPanelId;
        selFloatingPanelPanel.setAttribute("role", "dialog");
        selFloatingPanelPanel.setAttribute("aria-label", String(selFloatingPanelOptions.label || selFloatingPanelOptions.title || "浮动面板"));
        selFloatingPanelPanel.hidden = true;

        // 标题栏采用图标、两级文案和关闭按钮三轨结构。
        const selFloatingPanelHeading = document.createElement("header");
        selFloatingPanelHeading.className = selFloatingPanelMergeClass("selfloating-heading", selFloatingPanelClasses.heading);
        const selFloatingPanelHeadingIcon = document.createElement("span");
        selFloatingPanelHeadingIcon.className = selFloatingPanelMergeClass("selfloating-heading-icon", selFloatingPanelClasses.headingIcon);
        selFloatingPanelHeadingIcon.setAttribute("aria-hidden", "true");
        selFloatingPanelHeadingIcon.innerHTML = `<i class="${String(selFloatingPanelOptions.icon || "ri-window-line")}"></i>`;
        const selFloatingPanelHeadingCopy = document.createElement("span");
        selFloatingPanelHeadingCopy.className = selFloatingPanelMergeClass("selfloating-heading-copy", selFloatingPanelClasses.headingCopy);
        const selFloatingPanelTitle = document.createElement("strong");
        selFloatingPanelTitle.textContent = String(selFloatingPanelOptions.title || "浮动面板");
        const selFloatingPanelSubtitle = document.createElement("small");
        selFloatingPanelSubtitle.textContent = String(selFloatingPanelOptions.subtitle || "");
        selFloatingPanelHeadingCopy.append(selFloatingPanelTitle, selFloatingPanelSubtitle);
        const selFloatingPanelClose = document.createElement("button");
        selFloatingPanelClose.className = selFloatingPanelMergeClass("selfloating-close", selFloatingPanelClasses.close);
        selFloatingPanelClose.type = "button";
        selFloatingPanelClose.setAttribute("aria-label", String(selFloatingPanelOptions.closeLabel || `关闭${selFloatingPanelOptions.title || "浮动面板"}`));
        selFloatingPanelClose.innerHTML = '<i class="ri-close-line" aria-hidden="true"></i>';
        selFloatingPanelHeading.append(selFloatingPanelHeadingIcon, selFloatingPanelHeadingCopy, selFloatingPanelClose);

        // 内容插槽只承接调用方显式提供的节点或可信内部模板。
        const selFloatingPanelBody = document.createElement("div");
        selFloatingPanelBody.className = selFloatingPanelMergeClass("selfloating-body", selFloatingPanelClasses.body);
        selFloatingPanelBody.dataset.selFloatingPanelBody = selFloatingPanelId;
        if (selFloatingPanelOptions.content instanceof Node) {
            selFloatingPanelBody.appendChild(selFloatingPanelOptions.content);
        } else if (typeof selFloatingPanelOptions.contentHtml === "string") {
            selFloatingPanelBody.innerHTML = selFloatingPanelOptions.contentHtml;
        }
        selFloatingPanelPanel.append(selFloatingPanelHeading, selFloatingPanelBody);
        selFloatingPanelControl.append(selFloatingPanelTrigger, selFloatingPanelPanel);
        selFloatingPanelHost.replaceChildren(selFloatingPanelControl);

        // 公开状态只以 hidden 为真实来源，避免额外布尔值与 DOM 不一致。
        function selFloatingPanelIsOpen() {
            return !selFloatingPanelPanel.hidden;
        }

        // 关闭后按需把焦点交还入口，保持键盘操作连续。
        function selFloatingPanelClosePanel(selFloatingPanelRestoreFocus = true) {
            if (!selFloatingPanelIsOpen()) return false;
            selFloatingPanelPanel.hidden = true;
            selFloatingPanelTrigger.setAttribute("aria-expanded", "false");
            if (selFloatingPanelRestoreFocus) selFloatingPanelTrigger.focus({ preventScroll: true });
            selFloatingPanelOptions.onOpenChange?.(false);
            return true;
        }

        // 打开只显示面板并同步展开语义，不抢夺内容区当前焦点。
        function selFloatingPanelOpenPanel() {
            if (selFloatingPanelIsOpen()) return false;
            selFloatingPanelPanel.hidden = false;
            selFloatingPanelTrigger.setAttribute("aria-expanded", "true");
            selFloatingPanelOptions.onOpenChange?.(true);
            return true;
        }

        // 入口使用同一开关路径，调用方无需重复维护 aria-expanded。
        function selFloatingPanelTogglePanel() {
            return selFloatingPanelIsOpen() ? selFloatingPanelClosePanel(false) : selFloatingPanelOpenPanel();
        }

        // 面板内滚轮允许真实嵌套滚动区消费，到达边界时阻止页面滚动链。
        function selFloatingPanelHandleWheel(selFloatingPanelEvent) {
            let selFloatingPanelScrollNode = selFloatingPanelEvent.target instanceof Element ? selFloatingPanelEvent.target : selFloatingPanelEvent.target?.parentElement;
            let selFloatingPanelCanConsume = false;
            while (selFloatingPanelScrollNode && selFloatingPanelScrollNode !== selFloatingPanelPanel) {
                const selFloatingPanelStyle = window.getComputedStyle(selFloatingPanelScrollNode);
                const selFloatingPanelCanScrollY = /^(auto|scroll|overlay)$/.test(selFloatingPanelStyle.overflowY)
                    && selFloatingPanelScrollNode.scrollHeight > selFloatingPanelScrollNode.clientHeight + 1
                    && ((selFloatingPanelEvent.deltaY < 0 && selFloatingPanelScrollNode.scrollTop > 0)
                        || (selFloatingPanelEvent.deltaY > 0 && selFloatingPanelScrollNode.scrollTop + selFloatingPanelScrollNode.clientHeight < selFloatingPanelScrollNode.scrollHeight - 1));
                const selFloatingPanelCanScrollX = /^(auto|scroll|overlay)$/.test(selFloatingPanelStyle.overflowX)
                    && selFloatingPanelScrollNode.scrollWidth > selFloatingPanelScrollNode.clientWidth + 1
                    && ((selFloatingPanelEvent.deltaX < 0 && selFloatingPanelScrollNode.scrollLeft > 0)
                        || (selFloatingPanelEvent.deltaX > 0 && selFloatingPanelScrollNode.scrollLeft + selFloatingPanelScrollNode.clientWidth < selFloatingPanelScrollNode.scrollWidth - 1));
                if (selFloatingPanelCanScrollY || selFloatingPanelCanScrollX) {
                    selFloatingPanelCanConsume = true;
                    break;
                }
                selFloatingPanelScrollNode = selFloatingPanelScrollNode.parentElement;
            }
            selFloatingPanelEvent.stopPropagation();
            if (!selFloatingPanelCanConsume) selFloatingPanelEvent.preventDefault();
        }

        // 文档级事件使用稳定函数引用，destroy 时可以完整释放。
        function selFloatingPanelHandleDocumentPointer(selFloatingPanelEvent) {
            if (selFloatingPanelIsOpen() && !selFloatingPanelControl.contains(selFloatingPanelEvent.target)) selFloatingPanelClosePanel(false);
        }
        function selFloatingPanelHandleDocumentKey(selFloatingPanelEvent) {
            if (selFloatingPanelEvent.key === "Escape" && selFloatingPanelIsOpen()) selFloatingPanelClosePanel(true);
        }

        selFloatingPanelTrigger.addEventListener("click", selFloatingPanelTogglePanel);
        selFloatingPanelClose.addEventListener("click", () => selFloatingPanelClosePanel(true));
        selFloatingPanelPanel.addEventListener("wheel", selFloatingPanelHandleWheel, { passive: false });
        document.addEventListener("pointerdown", selFloatingPanelHandleDocumentPointer);
        document.addEventListener("keydown", selFloatingPanelHandleDocumentKey);

        const selFloatingPanelController = Object.freeze({
            id: selFloatingPanelId,
            root: selFloatingPanelControl,
            trigger: selFloatingPanelTrigger,
            panel: selFloatingPanelPanel,
            body: selFloatingPanelBody,
            open: selFloatingPanelOpenPanel,
            close: selFloatingPanelClosePanel,
            toggle: selFloatingPanelTogglePanel,
            isOpen: selFloatingPanelIsOpen,
            destroy() {
                document.removeEventListener("pointerdown", selFloatingPanelHandleDocumentPointer);
                document.removeEventListener("keydown", selFloatingPanelHandleDocumentKey);
                selFloatingPanelControl.remove();
                selFloatingPanelControllers.delete(selFloatingPanelHost);
            }
        });
        selFloatingPanelControllers.set(selFloatingPanelHost, selFloatingPanelController);
        return selFloatingPanelController;
    }

    window.selFloatingPanel = Object.freeze({
        mount: selFloatingPanelMount,
        get: (selFloatingPanelHost) => selFloatingPanelControllers.get(selFloatingPanelHost) || null
    });
})();
