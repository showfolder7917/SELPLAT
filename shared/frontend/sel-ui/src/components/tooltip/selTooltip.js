/*
 * selTooltip.js：统一截断文字提示公共控件。
 * 负责真实溢出判断、门户定位、鼠标与键盘生命周期；调用方只提供 data-sel-tooltip 完整文字。
 * 公开 API：window.selTooltip.attach(host, options)。
 */
(function selTooltipInitializeRegistry() {
    "use strict";

    const selTooltipInstances = new Map();
    let selTooltipPortal = null;
    let selTooltipOwner = null;
    let selTooltipTimer = 0;

    // 全页面共用一个 role=tooltip 门户，避免不同公共组件重复创建浮层。
    function selTooltipEnsurePortal() {
        if (selTooltipPortal?.isConnected) return selTooltipPortal;
        selTooltipPortal = document.createElement("div");
        selTooltipPortal.className = "seltooltip-portal";
        selTooltipPortal.id = "seltooltip-shared-portal";
        selTooltipPortal.setAttribute("role", "tooltip");
        selTooltipPortal.hidden = true;
        document.body.appendChild(selTooltipPortal);
        return selTooltipPortal;
    }

    // 目标或其文字后代均可承载提示，支持焦点落在 Tree 按钮而文字位于内部 span。
    function selTooltipResolveTarget(candidate, host, selector) {
        if (!(candidate instanceof Element) || !host.contains(candidate)) return null;
        const closest = candidate.closest(selector);
        if (closest && host.contains(closest)) return closest;
        const descendant = candidate.querySelector(selector);
        return descendant && host.contains(descendant) ? descendant : null;
    }

    // 默认只在文字被裁切时显示；业务说明类提示可声明 always，使 COMMENT 等补充信息不依赖标题宽度。
    function selTooltipShouldShow(target) {
        return target?.dataset.selTooltipMode === "always" || selTooltipIsTruncated(target);
    }

    // 只在可见文字发生真实横向或纵向裁切时显示提示，完整文字不产生冗余浮层。
    function selTooltipIsTruncated(target) {
        if (!(target instanceof HTMLElement) || target.getClientRects().length === 0) return false;
        return target.scrollWidth > target.clientWidth + 1 || target.scrollHeight > target.clientHeight + 1;
    }

    function selTooltipClearTimer() {
        if (!selTooltipTimer) return;
        window.clearTimeout(selTooltipTimer);
        selTooltipTimer = 0;
    }

    // 关闭时同步清理 aria-describedby，避免读屏继续关联已隐藏提示。
    function selTooltipHide() {
        selTooltipClearTimer();
        // 没有活动提示时 owner 与 portal 都可能为空，必须先确认真实关联元素再比较 ID。
        const selTooltipAriaElement = selTooltipOwner?.ariaElement;
        if (selTooltipAriaElement && selTooltipAriaElement.getAttribute("aria-describedby") === selTooltipPortal?.id) {
            selTooltipAriaElement.removeAttribute("aria-describedby");
        }
        selTooltipOwner = null;
        if (!selTooltipPortal) return false;
        selTooltipPortal.hidden = true;
        selTooltipPortal.textContent = "";
        return true;
    }

    // 浮层优先显示在文字下方，空间不足时转到上方，并始终限制在视口内。
    function selTooltipPosition(target) {
        const portal = selTooltipEnsurePortal();
        const gap = 7;
        const viewportGap = 8;
        const targetBounds = target.getBoundingClientRect();
        const portalBounds = portal.getBoundingClientRect();
        const maxLeft = Math.max(viewportGap, document.documentElement.clientWidth - portalBounds.width - viewportGap);
        const left = Math.min(Math.max(viewportGap, targetBounds.left), maxLeft);
        const below = targetBounds.bottom + gap;
        const top = below + portalBounds.height <= document.documentElement.clientHeight - viewportGap
            ? below
            : Math.max(viewportGap, targetBounds.top - portalBounds.height - gap);
        portal.style.left = `${left}px`;
        portal.style.top = `${top}px`;
    }

    function selTooltipShow(target, ariaElement) {
        if (!selTooltipShouldShow(target)) return false;
        const content = String(target.dataset.selTooltip || "").trim();
        if (!content) return false;
        const portal = selTooltipEnsurePortal();
        selTooltipHide();
        portal.textContent = content;
        portal.hidden = false;
        selTooltipOwner = { target, ariaElement };
        ariaElement?.setAttribute("aria-describedby", portal.id);
        selTooltipPosition(target);
        return true;
    }

    /**
     * 把统一提示绑定到一个明确宿主。
     * @param {Element} host - Grid、Tree 或其他公共控件的局部根节点。
     * @param {object} options - 包含稳定 id、enabled、selector 和 delay 的配置。
     * @returns {object|null} 成功返回可启停和销毁的控制器；参数无效返回 null。
     * @example attach(treeRoot,{id:"database-tree:tooltip",enabled:true}) 返回独立控制器。
     */
    function selTooltipAttach(host, options = {}) {
        if (!(host instanceof Element)) return null;
        const id = String(options.id || "").trim();
        if (!id) return null;
        if (selTooltipInstances.has(id)) return selTooltipInstances.get(id);
        const selector = String(options.selector || "[data-sel-tooltip]");
        const delay = Math.max(0, Number(options.delay) || 260);
        let enabled = options.enabled !== false;
        let destroyed = false;

        function schedule(candidate, immediate = false) {
            if (!enabled || destroyed) return;
            const target = selTooltipResolveTarget(candidate, host, selector);
            if (!target || !selTooltipShouldShow(target)) return;
            const ariaElement = candidate.closest?.("button, a, input, select, textarea, [tabindex]") || target;
            selTooltipClearTimer();
            selTooltipTimer = window.setTimeout(() => selTooltipShow(target, ariaElement), immediate ? 0 : delay);
        }

        function handlePointerOver(event) {
            schedule(event.target, false);
        }

        function handlePointerOut(event) {
            const target = selTooltipResolveTarget(event.target, host, selector);
            if (!target || (event.relatedTarget instanceof Node && target.contains(event.relatedTarget))) return;
            selTooltipHide();
        }

        function handleFocusIn(event) {
            schedule(event.target, true);
        }

        function handleFocusOut(event) {
            if (event.relatedTarget instanceof Node && host.contains(event.relatedTarget)) {
                const next = selTooltipResolveTarget(event.relatedTarget, host, selector);
                if (next === selTooltipOwner?.target) return;
            }
            selTooltipHide();
        }

        function handleEscape(event) {
            if (event.key === "Escape") selTooltipHide();
        }

        function handleViewportChange() {
            selTooltipHide();
        }

        host.addEventListener("pointerover", handlePointerOver);
        host.addEventListener("pointerout", handlePointerOut);
        host.addEventListener("focusin", handleFocusIn);
        host.addEventListener("focusout", handleFocusOut);
        host.addEventListener("keydown", handleEscape);
        window.addEventListener("scroll", handleViewportChange, true);
        window.addEventListener("resize", handleViewportChange);

        const controller = Object.freeze({
            id,
            root: host,
            hide: selTooltipHide,
            setEnabled(value) {
                enabled = value !== false;
                if (!enabled) selTooltipHide();
                return enabled;
            },
            isEnabled: () => enabled,
            destroy() {
                if (destroyed) return false;
                destroyed = true;
                selTooltipHide();
                host.removeEventListener("pointerover", handlePointerOver);
                host.removeEventListener("pointerout", handlePointerOut);
                host.removeEventListener("focusin", handleFocusIn);
                host.removeEventListener("focusout", handleFocusOut);
                host.removeEventListener("keydown", handleEscape);
                window.removeEventListener("scroll", handleViewportChange, true);
                window.removeEventListener("resize", handleViewportChange);
                selTooltipInstances.delete(id);
                if (selTooltipInstances.size === 0) {
                    selTooltipPortal?.remove();
                    selTooltipPortal = null;
                }
                return true;
            }
        });
        selTooltipInstances.set(id, controller);
        return controller;
    }

    window.selTooltip = Object.freeze({
        attach: selTooltipAttach,
        get: (id) => selTooltipInstances.get(String(id)) || null,
        destroy: (id) => selTooltipInstances.get(String(id))?.destroy() ?? false
    });
}());
