/*
 * selContextMenu.js：通用右键操作菜单基础控件。
 * 负责菜单门户、视口定位、禁用状态、键盘导航和局部动作事件，不识别任何应用业务。
 * 公开 API：window.sel.components.contextMenu.mount(host, options)，每个实例由完整业务键独立登记。
 */
(function selContextMenuInitializeRegistry() {
    "use strict";

    const selFreeze = window.sel.core.freeze;

    // 多实例注册表只保存明确挂载的菜单，页面加载时不主动扫描宿主。
    const selContextMenuInstances = new Map();
    // 同一页面任意时刻只允许一个右键菜单打开，避免门户浮层叠加。
    let selContextMenuOpenController = null;

    // 菜单图标统一使用页面已登记的 Remix Icon 类名。
    function selContextMenuCreateIcon(selContextMenuClassName) {
        const selContextMenuIcon = document.createElement("i");
        selContextMenuIcon.className = String(selContextMenuClassName || "ri-circle-line");
        selContextMenuIcon.setAttribute("aria-hidden", "true");
        return selContextMenuIcon;
    }

    /**
     * 挂载一个通用右键菜单实例。
     * @param {Element} selContextMenuHost - 接收局部动作事件的业务宿主。
     * @param {object} selContextMenuOptions - 包含稳定 id 和 ariaLabel 的通用选项。
     * @returns {object|null} 成功返回菜单控制器，宿主或实例键无效时返回 null。
     */
    function selContextMenuMount(selContextMenuHost, selContextMenuOptions = {}) {
        if (!(selContextMenuHost instanceof Element)) return null;
        const selContextMenuId = String(selContextMenuOptions.id || "").trim();
        if (!selContextMenuId) return null;
        if (selContextMenuInstances.has(selContextMenuId)) return selContextMenuInstances.get(selContextMenuId);

        // 菜单使用 body 门户，避免 Tab、Grid 或面板的 overflow 裁切掉浮层。
        const selContextMenuRoot = document.createElement("div");
        selContextMenuRoot.className = "selcontext-menu";
        selContextMenuRoot.dataset.selContextMenu = selContextMenuId;
        selContextMenuRoot.setAttribute("role", "menu");
        const selContextMenuDefaultAriaLabel = String(selContextMenuOptions.ariaLabel || "操作菜单");
        selContextMenuRoot.setAttribute("aria-label", selContextMenuDefaultAriaLabel);
        selContextMenuRoot.setAttribute("aria-hidden", "true");
        selContextMenuRoot.hidden = true;
        document.body.appendChild(selContextMenuRoot);

        let selContextMenuContext = null;
        let selContextMenuRestoreFocusTarget = null;
        let selContextMenuDestroyed = false;

        // 焦点导航跳过禁用动作，避免键盘用户停在无法执行的项上。
        function selContextMenuEnabledButtons() {
            return Array.from(selContextMenuRoot.querySelectorAll("[data-sel-context-menu-action]:not(:disabled)"));
        }

        // 关闭时清空当前上下文，只在键盘打开路径明确要求时恢复焦点。
        function selContextMenuClose(selContextMenuRestoreFocus = false) {
            if (selContextMenuRoot.hidden) return false;
            selContextMenuRoot.hidden = true;
            selContextMenuRoot.setAttribute("aria-hidden", "true");
            selContextMenuRoot.replaceChildren();
            selContextMenuContext = null;
            if (selContextMenuOpenController === selContextMenuController) selContextMenuOpenController = null;
            if (selContextMenuRestoreFocus && selContextMenuRestoreFocusTarget?.isConnected) {
                selContextMenuRestoreFocusTarget.focus();
            }
            selContextMenuRestoreFocusTarget = null;
            return true;
        }

        // 菜单按 clientX/clientY 贴近右键落点，超出可见区时向左或向上收拢。
        function selContextMenuPosition(selContextMenuClientX, selContextMenuClientY) {
            const selContextMenuGap = 8;
            selContextMenuRoot.style.left = `${Math.max(selContextMenuGap, selContextMenuClientX)}px`;
            selContextMenuRoot.style.top = `${Math.max(selContextMenuGap, selContextMenuClientY)}px`;
            const selContextMenuBounds = selContextMenuRoot.getBoundingClientRect();
            const selContextMenuLeft = Math.min(
                Math.max(selContextMenuGap, selContextMenuClientX),
                Math.max(selContextMenuGap, document.documentElement.clientWidth - selContextMenuBounds.width - selContextMenuGap)
            );
            const selContextMenuTop = Math.min(
                Math.max(selContextMenuGap, selContextMenuClientY),
                Math.max(selContextMenuGap, document.documentElement.clientHeight - selContextMenuBounds.height - selContextMenuGap)
            );
            selContextMenuRoot.style.left = `${selContextMenuLeft}px`;
            selContextMenuRoot.style.top = `${selContextMenuTop}px`;
        }

        // 菜单数据只接受有 id 和 label 的动作，所有文本使用 textContent 写入。
        function selContextMenuOpen(selContextMenuDefinition = {}) {
            if (selContextMenuDestroyed) return false;
            const selContextMenuItems = Array.isArray(selContextMenuDefinition.items)
                ? selContextMenuDefinition.items.filter((selContextMenuItem) => selContextMenuItem?.id && selContextMenuItem?.label)
                : [];
            if (!selContextMenuItems.length) return false;
            if (selContextMenuOpenController && selContextMenuOpenController !== selContextMenuController) {
                selContextMenuOpenController.close(false);
            }
            selContextMenuClose(false);
            selContextMenuContext = selContextMenuDefinition.context || null;
            selContextMenuRoot.setAttribute(
                "aria-label",
                String(selContextMenuDefinition.ariaLabel || selContextMenuDefaultAriaLabel)
            );
            selContextMenuRestoreFocusTarget = selContextMenuDefinition.restoreFocusTarget instanceof Element
                ? selContextMenuDefinition.restoreFocusTarget
                : null;
            const selContextMenuFragment = document.createDocumentFragment();
            selContextMenuItems.forEach((selContextMenuItem) => {
                const selContextMenuButton = document.createElement("button");
                selContextMenuButton.className = `selcontext-menu-item${selContextMenuItem.danger ? " selcontext-menu-item-danger" : ""}${selContextMenuItem.sectionStart ? " selcontext-menu-item-section-start" : ""}`;
                selContextMenuButton.type = "button";
                selContextMenuButton.dataset.selContextMenuAction = String(selContextMenuItem.id);
                selContextMenuButton.setAttribute("role", "menuitem");
                selContextMenuButton.disabled = Boolean(selContextMenuItem.disabled);
                selContextMenuButton.appendChild(selContextMenuCreateIcon(selContextMenuItem.icon));
                const selContextMenuLabel = document.createElement("span");
                selContextMenuLabel.textContent = String(selContextMenuItem.label);
                selContextMenuButton.appendChild(selContextMenuLabel);
                selContextMenuFragment.appendChild(selContextMenuButton);
            });
            selContextMenuRoot.replaceChildren(selContextMenuFragment);
            selContextMenuRoot.hidden = false;
            selContextMenuRoot.setAttribute("aria-hidden", "false");
            selContextMenuOpenController = selContextMenuController;
            selContextMenuPosition(
                Number.isFinite(selContextMenuDefinition.clientX) ? selContextMenuDefinition.clientX : 8,
                Number.isFinite(selContextMenuDefinition.clientY) ? selContextMenuDefinition.clientY : 8
            );
            if (selContextMenuDefinition.focusFirst) selContextMenuEnabledButtons()[0]?.focus();
            return true;
        }

        // 点击动作后先保存必要数据再关闭菜单，事件只从当前宿主广播。
        selContextMenuRoot.addEventListener("click", (selContextMenuEvent) => {
            const selContextMenuButton = selContextMenuEvent.target.closest("[data-sel-context-menu-action]");
            if (!selContextMenuButton || selContextMenuButton.disabled) return;
            const selContextMenuDetail = selFreeze({
                menuId: selContextMenuId,
                actionId: selContextMenuButton.dataset.selContextMenuAction,
                context: selContextMenuContext
            });
            selContextMenuClose(false);
            selContextMenuHost.dispatchEvent(new CustomEvent("selContextMenu:action", {
                bubbles: true,
                detail: selContextMenuDetail
            }));
        });

        // 上下方向键、Home、End、Enter、Space 和 Escape 形成完整的键盘菜单路径。
        selContextMenuRoot.addEventListener("keydown", (selContextMenuEvent) => {
            const selContextMenuButtons = selContextMenuEnabledButtons();
            if (!selContextMenuButtons.length) return;
            const selContextMenuIndex = selContextMenuButtons.indexOf(document.activeElement);
            let selContextMenuTargetIndex = null;
            if (selContextMenuEvent.key === "ArrowDown") selContextMenuTargetIndex = (selContextMenuIndex + 1) % selContextMenuButtons.length;
            if (selContextMenuEvent.key === "ArrowUp") selContextMenuTargetIndex = (selContextMenuIndex - 1 + selContextMenuButtons.length) % selContextMenuButtons.length;
            if (selContextMenuEvent.key === "Home") selContextMenuTargetIndex = 0;
            if (selContextMenuEvent.key === "End") selContextMenuTargetIndex = selContextMenuButtons.length - 1;
            if (selContextMenuTargetIndex !== null) {
                selContextMenuEvent.preventDefault();
                selContextMenuButtons[selContextMenuTargetIndex]?.focus();
            }
            if ((selContextMenuEvent.key === "Enter" || selContextMenuEvent.key === " ") && document.activeElement?.matches("[data-sel-context-menu-action]")) {
                selContextMenuEvent.preventDefault();
                document.activeElement.click();
            }
            if (selContextMenuEvent.key === "Escape" || selContextMenuEvent.key === "Tab") {
                if (selContextMenuEvent.key === "Escape") selContextMenuEvent.preventDefault();
                selContextMenuClose(selContextMenuEvent.key === "Escape");
            }
        });

        function selContextMenuDestroy() {
            if (selContextMenuDestroyed) return false;
            selContextMenuClose(false);
            selContextMenuDestroyed = true;
            selContextMenuInstances.delete(selContextMenuId);
            selContextMenuRoot.remove();
            return true;
        }

        const selContextMenuController = selFreeze({
            id: selContextMenuId,
            root: selContextMenuRoot,
            open: selContextMenuOpen,
            close: selContextMenuClose,
            destroy: selContextMenuDestroy
        });
        selContextMenuInstances.set(selContextMenuId, selContextMenuController);
        return selContextMenuController;
    }

    // 全局指针、滚动和窗口变化统一关闭当前浮层，每个实例无需重复绑定。
    document.addEventListener("pointerdown", (selContextMenuEvent) => {
        if (selContextMenuOpenController && !selContextMenuOpenController.root.contains(selContextMenuEvent.target)) {
            selContextMenuOpenController.close(false);
        }
    });
    window.addEventListener("blur", () => selContextMenuOpenController?.close(false));
    window.addEventListener("resize", () => selContextMenuOpenController?.close(false));
    window.addEventListener("scroll", () => selContextMenuOpenController?.close(false), true);

    window.sel.register("components.contextMenu", {
        mount: selContextMenuMount,
        get: (selContextMenuId) => selContextMenuInstances.get(String(selContextMenuId)) || null,
        has: (selContextMenuId) => selContextMenuInstances.has(String(selContextMenuId)),
        list: () => selFreeze(Array.from(selContextMenuInstances.keys())),
        close: () => selContextMenuOpenController?.close(false) || false
    });
})();
