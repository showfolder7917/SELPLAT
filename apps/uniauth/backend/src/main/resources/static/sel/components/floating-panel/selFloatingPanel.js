/*
 * selFloatingPanel.js：可复用的锚定式浮动面板基础控件。
 * 负责入口、标题外壳、开关、可选缩放、外部点击、Escape、焦点归还与滚轮边界隔离。
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

        // 缩放能力默认关闭；调用方必须显式传入 true 或配置对象，避免改变现有浮层交互。
        const selFloatingPanelResizeOption = selFloatingPanelOptions.resizable;
        const selFloatingPanelResizeEnabled = selFloatingPanelResizeOption === true
            || (selFloatingPanelResizeOption && typeof selFloatingPanelResizeOption === "object");
        const selFloatingPanelResizeConfig = selFloatingPanelResizeOption && typeof selFloatingPanelResizeOption === "object"
            ? selFloatingPanelResizeOption
            : {};
        const selFloatingPanelResizeNumber = (selFloatingPanelValue, selFloatingPanelFallback) => {
            const selFloatingPanelNumber = Number(selFloatingPanelValue);
            return Number.isFinite(selFloatingPanelNumber) && selFloatingPanelNumber > 0 ? selFloatingPanelNumber : selFloatingPanelFallback;
        };
        const selFloatingPanelResizeMinimumWidth = selFloatingPanelResizeNumber(selFloatingPanelResizeConfig.minWidth, 320);
        const selFloatingPanelResizeMinimumHeight = selFloatingPanelResizeNumber(selFloatingPanelResizeConfig.minHeight, 360);
        const selFloatingPanelResizeMaximumWidth = selFloatingPanelResizeNumber(selFloatingPanelResizeConfig.maxWidth, Number.POSITIVE_INFINITY);
        const selFloatingPanelResizeMaximumHeight = selFloatingPanelResizeNumber(selFloatingPanelResizeConfig.maxHeight, Number.POSITIVE_INFINITY);
        const selFloatingPanelResizeLabels = selFloatingPanelResizeConfig.labels || {};

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
        // 左边、底边与左下角分别承担单轴和双轴缩放；按钮语义同时支持键盘微调。
        const selFloatingPanelResizeHandles = [];
        if (selFloatingPanelResizeEnabled) {
            selFloatingPanelPanel.dataset.selFloatingResizable = "true";
            [
                ["left", selFloatingPanelResizeLabels.left || "调整面板宽度"],
                ["bottom", selFloatingPanelResizeLabels.bottom || "调整面板高度"],
                ["corner", selFloatingPanelResizeLabels.corner || "同时调整面板宽度和高度"]
            ].forEach(([selFloatingPanelResizeDirection, selFloatingPanelResizeLabel]) => {
                const selFloatingPanelResizeHandle = document.createElement("button");
                selFloatingPanelResizeHandle.className = `selfloating-resize-handle selfloating-resize-${selFloatingPanelResizeDirection}`;
                selFloatingPanelResizeHandle.type = "button";
                selFloatingPanelResizeHandle.dataset.selFloatingResize = selFloatingPanelResizeDirection;
                selFloatingPanelResizeHandle.setAttribute("aria-label", String(selFloatingPanelResizeLabel));
                selFloatingPanelResizeHandle.title = String(selFloatingPanelResizeConfig.resetLabel || "双击恢复面板默认大小");
                selFloatingPanelPanel.appendChild(selFloatingPanelResizeHandle);
                selFloatingPanelResizeHandles.push(selFloatingPanelResizeHandle);
            });
        }
        selFloatingPanelControl.append(selFloatingPanelTrigger, selFloatingPanelPanel);
        selFloatingPanelHost.replaceChildren(selFloatingPanelControl);

        // 当前拖拽只在按下手柄后存在；切换主题和标签不会重建面板或丢失尺寸。
        let selFloatingPanelResizeInteraction = null;

        // 面板右上锚点保持不变，最大尺寸始终限制在当前浏览器可视区域内。
        function selFloatingPanelResizeBounds() {
            const selFloatingPanelRect = selFloatingPanelPanel.getBoundingClientRect();
            const selFloatingPanelViewportGap = 12;
            // 语言切换后的内存快照会在浮层重新打开前恢复；hidden 元素没有可用 rect，
            // 此时改用视口右边界，避免合法的自定义宽度被错误夹回最小宽度。
            const selFloatingPanelAvailableRight = selFloatingPanelRect.right > 0
                ? selFloatingPanelRect.right
                : window.innerWidth - selFloatingPanelViewportGap;
            return {
                maxWidth: Math.max(selFloatingPanelResizeMinimumWidth, Math.min(selFloatingPanelResizeMaximumWidth, selFloatingPanelAvailableRight - selFloatingPanelViewportGap)),
                maxHeight: Math.max(selFloatingPanelResizeMinimumHeight, Math.min(selFloatingPanelResizeMaximumHeight, window.innerHeight - selFloatingPanelRect.top - selFloatingPanelViewportGap))
            };
        }

        // 单一入口应用宽高并做双重边界校验，指针、键盘和窗口变化共享同一规则。
        function selFloatingPanelApplySize(selFloatingPanelWidth, selFloatingPanelHeight) {
            if (!selFloatingPanelResizeEnabled) return false;
            const selFloatingPanelBounds = selFloatingPanelResizeBounds();
            if (Number.isFinite(selFloatingPanelWidth)) {
                const selFloatingPanelNextWidth = Math.min(selFloatingPanelBounds.maxWidth, Math.max(selFloatingPanelResizeMinimumWidth, selFloatingPanelWidth));
                selFloatingPanelPanel.style.width = `${Math.round(selFloatingPanelNextWidth)}px`;
            }
            if (Number.isFinite(selFloatingPanelHeight)) {
                const selFloatingPanelNextHeight = Math.min(selFloatingPanelBounds.maxHeight, Math.max(selFloatingPanelResizeMinimumHeight, selFloatingPanelHeight));
                selFloatingPanelPanel.style.height = `${Math.round(selFloatingPanelNextHeight)}px`;
            }
            return true;
        }

        // 恢复只移除交互尺寸，让 CSS 重新决定默认宽度与内容高度。
        function selFloatingPanelResetSize() {
            if (!selFloatingPanelResizeEnabled) return false;
            selFloatingPanelPanel.style.removeProperty("width");
            selFloatingPanelPanel.style.removeProperty("height");
            return true;
        }

        function selFloatingPanelHandleResizePointerDown(selFloatingPanelEvent) {
            if (selFloatingPanelEvent.button !== 0 || window.matchMedia("(max-width: 640px)").matches) return;
            const selFloatingPanelResizeHandle = selFloatingPanelEvent.currentTarget;
            const selFloatingPanelRect = selFloatingPanelPanel.getBoundingClientRect();
            selFloatingPanelResizeInteraction = {
                direction: selFloatingPanelResizeHandle.dataset.selFloatingResize,
                pointerId: selFloatingPanelEvent.pointerId,
                startX: selFloatingPanelEvent.clientX,
                startY: selFloatingPanelEvent.clientY,
                startWidth: selFloatingPanelRect.width,
                startHeight: selFloatingPanelRect.height
            };
            selFloatingPanelPanel.dataset.selFloatingResizing = selFloatingPanelResizeInteraction.direction;
            // 指针捕获仅作浏览器优化；文档级移动监听仍保证快速拖出窄手柄时不中断。
            try {
                selFloatingPanelResizeHandle.setPointerCapture?.(selFloatingPanelEvent.pointerId);
            } catch (selFloatingPanelCaptureError) {
                // 不支持捕获的浏览器继续使用下方文档级事件路径。
            }
            selFloatingPanelEvent.preventDefault();
        }

        function selFloatingPanelHandleResizePointerMove(selFloatingPanelEvent) {
            if (!selFloatingPanelResizeInteraction || selFloatingPanelResizeInteraction.pointerId !== selFloatingPanelEvent.pointerId) return;
            const selFloatingPanelResizeHorizontal = ["left", "corner"].includes(selFloatingPanelResizeInteraction.direction);
            const selFloatingPanelResizeVertical = ["bottom", "corner"].includes(selFloatingPanelResizeInteraction.direction);
            selFloatingPanelApplySize(
                selFloatingPanelResizeHorizontal
                    ? selFloatingPanelResizeInteraction.startWidth - (selFloatingPanelEvent.clientX - selFloatingPanelResizeInteraction.startX)
                    : Number.NaN,
                selFloatingPanelResizeVertical
                    ? selFloatingPanelResizeInteraction.startHeight + (selFloatingPanelEvent.clientY - selFloatingPanelResizeInteraction.startY)
                    : Number.NaN
            );
            selFloatingPanelEvent.preventDefault();
        }

        function selFloatingPanelFinishResize(selFloatingPanelEvent) {
            if (!selFloatingPanelResizeInteraction || selFloatingPanelResizeInteraction.pointerId !== selFloatingPanelEvent.pointerId) return;
            selFloatingPanelResizeInteraction = null;
            delete selFloatingPanelPanel.dataset.selFloatingResizing;
        }

        function selFloatingPanelHandleResizeKey(selFloatingPanelEvent) {
            if (!selFloatingPanelResizeEnabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(selFloatingPanelEvent.key)) return;
            const selFloatingPanelDirection = selFloatingPanelEvent.currentTarget.dataset.selFloatingResize;
            const selFloatingPanelRect = selFloatingPanelPanel.getBoundingClientRect();
            const selFloatingPanelStep = selFloatingPanelEvent.shiftKey ? 32 : 12;
            const selFloatingPanelWidthDelta = selFloatingPanelEvent.key === "ArrowLeft" ? selFloatingPanelStep : selFloatingPanelEvent.key === "ArrowRight" ? -selFloatingPanelStep : 0;
            const selFloatingPanelHeightDelta = selFloatingPanelEvent.key === "ArrowDown" ? selFloatingPanelStep : selFloatingPanelEvent.key === "ArrowUp" ? -selFloatingPanelStep : 0;
            selFloatingPanelApplySize(
                ["left", "corner"].includes(selFloatingPanelDirection) ? selFloatingPanelRect.width + selFloatingPanelWidthDelta : Number.NaN,
                ["bottom", "corner"].includes(selFloatingPanelDirection) ? selFloatingPanelRect.height + selFloatingPanelHeightDelta : Number.NaN
            );
            selFloatingPanelEvent.preventDefault();
        }

        // 调整浏览器大小时把已有自定义尺寸重新夹在新视口内；未调整过的面板继续完全由 CSS 控制。
        function selFloatingPanelHandleViewportResize() {
            const selFloatingPanelInlineWidth = Number.parseFloat(selFloatingPanelPanel.style.width);
            const selFloatingPanelInlineHeight = Number.parseFloat(selFloatingPanelPanel.style.height);
            if (Number.isFinite(selFloatingPanelInlineWidth) || Number.isFinite(selFloatingPanelInlineHeight)) {
                selFloatingPanelApplySize(selFloatingPanelInlineWidth, selFloatingPanelInlineHeight);
            }
        }

        selFloatingPanelResizeHandles.forEach((selFloatingPanelResizeHandle) => {
            selFloatingPanelResizeHandle.addEventListener("pointerdown", selFloatingPanelHandleResizePointerDown);
            selFloatingPanelResizeHandle.addEventListener("keydown", selFloatingPanelHandleResizeKey);
            selFloatingPanelResizeHandle.addEventListener("dblclick", selFloatingPanelResetSize);
        });
        if (selFloatingPanelResizeEnabled) {
            document.addEventListener("pointermove", selFloatingPanelHandleResizePointerMove, { passive: false });
            document.addEventListener("pointerup", selFloatingPanelFinishResize);
            document.addEventListener("pointercancel", selFloatingPanelFinishResize);
            window.addEventListener("resize", selFloatingPanelHandleViewportResize);
        }

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
            resetSize: selFloatingPanelResetSize,
            setSize: (selFloatingPanelSize = {}) => selFloatingPanelApplySize(Number(selFloatingPanelSize.width), Number(selFloatingPanelSize.height)),
            getSize: () => Object.freeze({
                width: selFloatingPanelPanel.getBoundingClientRect().width,
                height: selFloatingPanelPanel.getBoundingClientRect().height,
                customized: Boolean(selFloatingPanelPanel.style.width || selFloatingPanelPanel.style.height)
            }),
            open: selFloatingPanelOpenPanel,
            close: selFloatingPanelClosePanel,
            toggle: selFloatingPanelTogglePanel,
            isOpen: selFloatingPanelIsOpen,
            destroy() {
                document.removeEventListener("pointerdown", selFloatingPanelHandleDocumentPointer);
                document.removeEventListener("keydown", selFloatingPanelHandleDocumentKey);
                if (selFloatingPanelResizeEnabled) {
                    document.removeEventListener("pointermove", selFloatingPanelHandleResizePointerMove);
                    document.removeEventListener("pointerup", selFloatingPanelFinishResize);
                    document.removeEventListener("pointercancel", selFloatingPanelFinishResize);
                    window.removeEventListener("resize", selFloatingPanelHandleViewportResize);
                }
                selFloatingPanelResizeInteraction = null;
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
