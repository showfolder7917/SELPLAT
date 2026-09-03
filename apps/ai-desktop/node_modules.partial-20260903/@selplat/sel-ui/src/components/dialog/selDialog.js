/*
 * selDialog.js：承载调用方内容的通用模态对话框。
 * 负责模态层、标题、关闭、焦点和生命周期；业务内容通过 body 插槽提供。
 */
(function selDialogInitializeRegistry() {
    "use strict";

    const selFreeze = window.sel.core.freeze;
    const selDialogInstances = new Map();

    function selDialogElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = String(text);
        return element;
    }

    /**
     * 挂载通用模态对话框。
     * @param {Element} host 对话框所属应用宿主。
     * @param {object} options 稳定 id、标题、关闭文案和是否允许用户关闭。
     * @returns {object|null} 包含 body 插槽、open、close、setLocale 和 destroy 的控制器。
     */
    function selDialogMount(host, options = {}) {
        if (!(host instanceof Element)) return null;
        const id = String(options.id || "").trim();
        if (!id) return null;
        if (selDialogInstances.has(id)) return selDialogInstances.get(id);

        const dialog = selDialogElement("dialog", "seldialog-root");
        dialog.dataset.selDialog = id;
        const surface = selDialogElement("section", "seldialog-surface");
        const heading = selDialogElement("header", "seldialog-heading");
        const headingCopy = selDialogElement("span", "seldialog-heading-copy");
        const kicker = selDialogElement("small", "seldialog-heading-kicker");
        const title = selDialogElement("strong", "seldialog-title");
        headingCopy.append(kicker, title);
        const closeButton = selDialogElement("button", "seldialog-close");
        closeButton.type = "button";
        const closeIcon = selDialogElement("i", "ri-close-line");
        closeIcon.setAttribute("aria-hidden", "true");
        closeButton.appendChild(closeIcon);
        heading.append(headingCopy, closeButton);
        const body = selDialogElement("div", "seldialog-body");
        surface.append(heading, body);
        dialog.appendChild(surface);
        host.appendChild(dialog);

        let currentOptions = { ...options };
        let destroyed = false;

        function applyOptions(nextOptions = {}) {
            currentOptions = { ...currentOptions, ...nextOptions };
            title.id = `${id}-title`;
            title.textContent = String(currentOptions.title || "对话框");
            kicker.textContent = String(currentOptions.kicker || "");
            kicker.hidden = !kicker.textContent;
            dialog.setAttribute("aria-labelledby", title.id);
            dialog.dataset.selDialogSize = currentOptions.size === "compact" ? "compact" : "standard";
            const dismissible = currentOptions.dismissible !== false;
            closeButton.hidden = !dismissible;
            closeButton.setAttribute("aria-label", String(currentOptions.closeLabel || "关闭"));
            return true;
        }

        function dispatchClose(reason) {
            host.dispatchEvent(new CustomEvent("selDialog:close", { detail: { id, reason }, bubbles: true }));
        }

        function close(reason = "programmatic") {
            if (!dialog.open) return false;
            dialog.close();
            if (reason !== "programmatic") dispatchClose(reason);
            return true;
        }

        function open(nextOptions = {}) {
            if (destroyed) return false;
            applyOptions(nextOptions);
            if (!dialog.open) dialog.showModal();
            queueMicrotask(() => body.querySelector("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")?.focus());
            return true;
        }

        closeButton.addEventListener("click", () => close("close-button"));
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            if (currentOptions.dismissible !== false) close("escape");
        });
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog && currentOptions.dismissible !== false) close("backdrop");
        });

        applyOptions();
        const controller = selFreeze({
            id,
            root: dialog,
            body,
            open,
            close,
            setLocale: applyOptions,
            getState: () => ({ open: dialog.open, dismissible: currentOptions.dismissible !== false }),
            destroy() {
                if (destroyed) return false;
                destroyed = true;
                close();
                dialog.remove();
                selDialogInstances.delete(id);
                return true;
            }
        });
        selDialogInstances.set(id, controller);
        return controller;
    }

    window.sel.register("components.dialog", {
        mount: selDialogMount,
        get: (id) => selDialogInstances.get(String(id)) || null,
        destroy: (id) => selDialogInstances.get(String(id))?.destroy() ?? false
    });
}());
