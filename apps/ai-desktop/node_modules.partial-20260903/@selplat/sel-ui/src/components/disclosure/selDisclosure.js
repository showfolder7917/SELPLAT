/*
 * selDisclosure.js：统一管理可展开详情的按钮语义、键盘行为、状态与生命周期。
 * 业务应用只提供标题和内容，不复制 details/summary 或私有展开控件。
 */
(function selDisclosureInitialize() {
    "use strict";

    const selFreeze = window.sel.core.freeze;
    const selDisclosureControllers = new WeakMap();

    /** 在既有宿主上挂载 Disclosure；返回可更新、查询和销毁的稳定控制器。 */
    function selDisclosureMount(root, options = {}) {
        if (!(root instanceof Element)) return null;
        if (selDisclosureControllers.has(root)) return selDisclosureControllers.get(root);
        const trigger = root.querySelector("[data-sel-disclosure-trigger]");
        const content = root.querySelector("[data-sel-disclosure-content]");
        if (!(trigger instanceof HTMLButtonElement) || !(content instanceof HTMLElement)) return null;
        const id = String(options.id || root.dataset.selDisclosure || "").trim();
        if (!id) return null;
        let open = options.open === true;
        let destroyed = false;

        function apply(nextOpen, announce = false) {
            if (destroyed) return false;
            open = nextOpen === true;
            root.dataset.selDisclosure = id;
            root.dataset.selDisclosureOpen = String(open);
            trigger.setAttribute("aria-expanded", String(open));
            trigger.setAttribute("aria-controls", `${id}-content`);
            content.id = `${id}-content`;
            content.hidden = !open;
            const icon = trigger.querySelector("[data-sel-disclosure-icon]");
            if (icon) icon.className = open ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line";
            if (announce) root.dispatchEvent(new CustomEvent("selDisclosure:change", { bubbles: true, detail: { id, open } }));
            return true;
        }

        const toggle = () => apply(!open, true);
        trigger.addEventListener("click", toggle);
        apply(open);
        const controller = selFreeze({
            id,
            root,
            setOpen: (nextOpen) => apply(nextOpen === true),
            getState: () => ({ open }),
            destroy() {
                if (destroyed) return false;
                destroyed = true;
                trigger.removeEventListener("click", toggle);
                selDisclosureControllers.delete(root);
                return true;
            }
        });
        selDisclosureControllers.set(root, controller);
        return controller;
    }

    window.sel.register("components.disclosure", { mount: selDisclosureMount });
})();
