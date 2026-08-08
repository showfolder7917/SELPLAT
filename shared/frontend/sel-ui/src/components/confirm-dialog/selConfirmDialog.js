/*
 * selConfirmDialog.js：紧凑型确认对话框公共组件。
 * 责任边界：只处理确认展示、焦点、取消和布尔结果，不执行删除或读取应用业务数据。
 */
(function selConfirmDialogInitializeRegistry() {
    "use strict";

    const selConfirmDialogInstances = new Map();

    function selConfirmDialogCreateElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = String(text);
        return element;
    }

    /**
     * 创建一个可重复打开的紧凑确认框。
     * @param {Element} host - 对话框所属应用宿主，例如页面 main 根节点。
     * @param {object} options - 稳定 id 与首次显示文案。
     * @returns {object|null} 确认框控制器；宿主或 id 无效时返回 null。
     */
    function selConfirmDialogMount(host, options = {}) {
        if (!(host instanceof Element)) return null;
        const id = String(options.id || "").trim();
        if (!id) return null;
        if (selConfirmDialogInstances.has(id)) return selConfirmDialogInstances.get(id);

        const dialog = selConfirmDialogCreateElement("dialog", "selconfirm-dialog");
        dialog.dataset.selConfirmDialog = id;
        const surface = selConfirmDialogCreateElement("section", "selconfirm-surface");
        const header = selConfirmDialogCreateElement("header", "selconfirm-header");
        const title = selConfirmDialogCreateElement("strong", "selconfirm-title");
        const closeButton = selConfirmDialogCreateElement("button", "selconfirm-close");
        closeButton.type = "button";
        closeButton.appendChild(selConfirmDialogCreateElement("i", "ri-close-line"));
        closeButton.firstChild.setAttribute("aria-hidden", "true");
        header.append(title, closeButton);

        const body = selConfirmDialogCreateElement("div", "selconfirm-body");
        const iconBox = selConfirmDialogCreateElement("span", "selconfirm-icon");
        const icon = selConfirmDialogCreateElement("i", "ri-question-line");
        icon.setAttribute("aria-hidden", "true");
        iconBox.appendChild(icon);
        const copy = selConfirmDialogCreateElement("div", "selconfirm-copy");
        const message = selConfirmDialogCreateElement("p", "selconfirm-message");
        const target = selConfirmDialogCreateElement("strong", "selconfirm-target");
        copy.append(message, target);
        body.append(iconBox, copy);

        const footer = selConfirmDialogCreateElement("footer", "selconfirm-footer");
        const cancelButton = selConfirmDialogCreateElement("button", "selconfirm-action selconfirm-action-cancel");
        cancelButton.type = "button";
        const confirmButton = selConfirmDialogCreateElement("button", "selconfirm-action selconfirm-action-confirm");
        confirmButton.type = "button";
        footer.append(cancelButton, confirmButton);
        surface.append(header, body, footer);
        dialog.appendChild(surface);
        host.appendChild(dialog);

        let currentOptions = { ...options };
        let pendingResolver = null;

        function applyOptions(nextOptions = {}) {
            currentOptions = { ...currentOptions, ...nextOptions };
            const tone = currentOptions.tone === "danger" ? "danger" : "info";
            dialog.dataset.selConfirmTone = tone;
            dialog.setAttribute("aria-labelledby", `${id}-title`);
            dialog.setAttribute("aria-describedby", `${id}-message`);
            title.id = `${id}-title`;
            message.id = `${id}-message`;
            title.textContent = String(currentOptions.title || "请确认");
            message.textContent = String(currentOptions.message || "是否继续此操作？");
            target.textContent = String(currentOptions.target || "");
            target.hidden = !target.textContent;
            icon.className = String(currentOptions.icon || (tone === "danger" ? "ri-error-warning-line" : "ri-question-line"));
            closeButton.setAttribute("aria-label", String(currentOptions.closeLabel || "关闭确认框"));
            cancelButton.textContent = String(currentOptions.cancelLabel || "取消");
            confirmButton.textContent = String(currentOptions.confirmLabel || "确认");
            return true;
        }

        function settle(result) {
            if (dialog.open) dialog.close();
            const resolver = pendingResolver;
            pendingResolver = null;
            if (resolver) resolver(Boolean(result));
            return true;
        }

        /**
         * 打开确认框并等待用户选择。
         * @param {object} nextOptions - 本次操作标题、正文、目标和按钮文案。
         * @returns {Promise<boolean>} 点击确认返回 true，取消、关闭或 Escape 返回 false。
         */
        function open(nextOptions = {}) {
            if (pendingResolver) settle(false);
            applyOptions(nextOptions);
            dialog.showModal();
            // 危险确认默认聚焦取消按钮，按回车不会意外执行删除。
            queueMicrotask(() => cancelButton.focus());
            return new Promise((resolve) => { pendingResolver = resolve; });
        }

        cancelButton.addEventListener("click", () => settle(false));
        closeButton.addEventListener("click", () => settle(false));
        confirmButton.addEventListener("click", () => settle(true));
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            settle(false);
        });
        // 显式承接 Escape，避免部分嵌入式浏览器不派发原生 dialog cancel 事件。
        dialog.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            settle(false);
        });
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) settle(false);
        });

        applyOptions();
        const controller = Object.freeze({
            id,
            root: dialog,
            open,
            close: () => settle(false),
            setLocale: applyOptions,
            getState: () => Object.freeze({ open: dialog.open, tone: dialog.dataset.selConfirmTone || "info" }),
            destroy: () => {
                settle(false);
                dialog.remove();
                selConfirmDialogInstances.delete(id);
                return true;
            }
        });
        selConfirmDialogInstances.set(id, controller);
        return controller;
    }

    window.selConfirmDialog = Object.freeze({
        mount: selConfirmDialogMount,
        get: (id) => selConfirmDialogInstances.get(String(id)) || null,
        has: (id) => selConfirmDialogInstances.has(String(id)),
        list: () => Object.freeze(Array.from(selConfirmDialogInstances.keys()))
    });
})();
