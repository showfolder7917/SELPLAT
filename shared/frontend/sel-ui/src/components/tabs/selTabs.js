/*
 * selTabs.js：可复用动态业务页签基础控件。
 * 负责页签创建、切换隐藏、键盘导航、批量关闭、右键菜单组合和子组件清理回调，不识别应用、实体或接口。
 * 公开 API：window.sel.components.tabs.mount(host, options)、get(id)、has(id)；每个实例使用完整业务键独立注册。
 */
(function selTabsInitializeRegistry() {
    "use strict";

    const selFreeze = window.sel.core.freeze;

    // 页面内每套页签工作区按完整实例键登记，动态关闭只影响所属实例。
    const selTabsInstances = new Map();

    /**
     * 挂载一套动态页签工作区。
     * @param {Element} selTabsHost - 基础面板或应用提供的独立页签宿主。
     * @param {object} selTabsOptions - 包含 id、ariaLabel、emptyTitle 和 emptyDescription 的通用选项。
     * @returns {object|null} 成功返回页签控制器，宿主或实例键无效时返回 null。
     */
    function selTabsMount(selTabsHost, selTabsOptions = {}) {
        // 基础控件只接受明确宿主，不扫描 document 猜测应用位置。
        if (!(selTabsHost instanceof Element)) return null;
        const selTabsId = String(selTabsOptions.id || selTabsHost.dataset.selTabs || "").trim();
        // 没有完整业务键就无法建立安全注册和销毁路径。
        if (!selTabsId) return null;
        // 同一实例重复挂载时复用控制器，避免页签条和事件叠加。
        if (selTabsInstances.has(selTabsId)) return selTabsInstances.get(selTabsId);
        // 右键菜单默认属于 Tab 基础能力；只有调用方明确声明 false 时才允许不挂载。
        let selTabsContextMenuEnabled = selTabsOptions.contextMenu !== false;
        if (selTabsContextMenuEnabled && typeof window.sel.components.contextMenu?.mount !== "function") {
            console.error("selTabs.mount：默认右键菜单缺少 selContextMenu 依赖；请先加载公共控件，或显式设置 contextMenu: false。");
            return null;
        }

        // 根节点只承担页签条、内容区和空状态的稳定布局。
        const selTabsRoot = document.createElement("section");
        selTabsRoot.className = "seltabs-root";
        selTabsRoot.dataset.selTabs = selTabsId;
        selTabsRoot.setAttribute("aria-label", String(selTabsOptions.ariaLabel || "业务页签"));
        const selTabsList = document.createElement("div");
        selTabsList.className = "seltabs-list";
        selTabsList.setAttribute("role", "tablist");
        selTabsList.setAttribute("aria-label", String(selTabsOptions.tabListLabel || selTabsOptions.ariaLabel || "业务页签"));
        const selTabsPanels = document.createElement("div");
        selTabsPanels.className = "seltabs-panels";
        const selTabsEmpty = document.createElement("div");
        selTabsEmpty.className = "seltabs-empty";
        const selTabsEmptyIcon = document.createElement("i");
        selTabsEmptyIcon.className = String(selTabsOptions.emptyIcon || "ri-terminal-window-line");
        selTabsEmptyIcon.setAttribute("aria-hidden", "true");
        const selTabsEmptyCopy = document.createElement("div");
        const selTabsEmptyTitle = document.createElement("strong");
        selTabsEmptyTitle.textContent = String(selTabsOptions.emptyTitle || "尚未打开页签");
        const selTabsEmptyDescription = document.createElement("span");
        selTabsEmptyDescription.textContent = String(selTabsOptions.emptyDescription || "请选择左侧项目开始工作");
        selTabsEmptyCopy.append(selTabsEmptyTitle, selTabsEmptyDescription);
        selTabsEmpty.append(selTabsEmptyIcon, selTabsEmptyCopy);
        selTabsPanels.appendChild(selTabsEmpty);
        selTabsRoot.append(selTabsList, selTabsPanels);
        selTabsHost.appendChild(selTabsRoot);

        // Map 同时保存页签 DOM、调用方定义和子组件清理函数，关闭时一次回收完整生命周期。
        const selTabsItems = new Map();
        let selTabsActiveId = null;
        let selTabsDestroyed = false;
        // Tab 只组装通用右键菜单，菜单门户、定位和键盘交互不在本组件重复实现。
        let selTabsContextMenu = null;
        // 文案允许应用注入本地化值，默认使用当前 SELPLAT 工作台中文。
        const selTabsContextMenuLabels = selFreeze({
            closeRight: "关闭右侧",
            closeOthers: "关闭其他",
            closeAll: "全部关闭",
            ...(selTabsOptions.contextMenuLabels || {})
        });

        // 挂载函数同时服务初始默认启用和运行期重新启用，始终复用稳定实例键。
        function selTabsMountContextMenu() {
            if (!selTabsContextMenuEnabled) return true;
            if (typeof window.sel.components.contextMenu?.mount !== "function") return false;
            selTabsContextMenu = window.sel.components.contextMenu.mount(selTabsRoot, {
                id: `${selTabsId}:tab-actions`,
                ariaLabel: String(selTabsOptions.contextMenuAriaLabel || "页签操作")
            });
            return Boolean(selTabsContextMenu);
        }

        // 初始默认状态在 Tab 对外可用前完成挂载，避免首次右键才临时创建。
        if (!selTabsMountContextMenu()) {
            selTabsRoot.remove();
            console.error("selTabs.mount：selContextMenu 挂载失败，已停止创建 Tab 实例。");
            return null;
        }

        // 显式开关 API 可在运行期关闭或重新启用，关闭时销毁菜单门户与注册。
        function selTabsSetContextMenuEnabled(selTabsEnabled) {
            const selTabsNextEnabled = Boolean(selTabsEnabled);
            if (selTabsNextEnabled === selTabsContextMenuEnabled) return true;
            if (!selTabsNextEnabled) {
                selTabsContextMenu?.destroy();
                selTabsContextMenu = null;
                selTabsContextMenuEnabled = false;
                return true;
            }
            selTabsContextMenuEnabled = true;
            if (selTabsMountContextMenu()) return true;
            selTabsContextMenuEnabled = false;
            return false;
        }

        // 空状态只在没有任何页签时出现，切换页签不会反复创建提示 DOM。
        function selTabsSyncEmptyState() {
            selTabsEmpty.hidden = selTabsItems.size > 0;
            selTabsRoot.classList.toggle("seltabs-root-empty", selTabsItems.size === 0);
        }

        // 当前顺序取自真实页签条，关闭活动页时可稳定选择相邻页签。
        function selTabsOrderedIds() {
            return Array.from(selTabsList.querySelectorAll("[data-sel-tabs-item]")).map((item) => item.dataset.selTabsItem);
        }

        // 激活只隐藏其他内容面板，保留编辑值、查询结果和滚动位置。
        function selTabsActivate(selTabsTabId, selTabsFocus = false) {
            const selTabsTarget = selTabsItems.get(String(selTabsTabId));
            if (!selTabsTarget || selTabsDestroyed) return false;
            selTabsActiveId = selTabsTarget.id;
            selTabsItems.forEach((selTabsItem) => {
                const selTabsSelected = selTabsItem.id === selTabsActiveId;
                selTabsItem.panel.hidden = !selTabsSelected;
                selTabsItem.tab.setAttribute("aria-selected", String(selTabsSelected));
                selTabsItem.tab.tabIndex = selTabsSelected ? 0 : -1;
                selTabsItem.wrapper.classList.toggle("seltabs-item-active", selTabsSelected);
            });
            if (selTabsFocus) selTabsTarget.tab.focus();
            // 业务事件只从当前实例根冒泡，并携带页签实例与页签键。
            selTabsRoot.dispatchEvent(new CustomEvent("selTabs:change", {
                bubbles: true,
                detail: selFreeze({ tabsId: selTabsId, tabId: selTabsActiveId })
            }));
            return true;
        }

        // 子组件清理回调允许应用组合多个公共控件，但关闭顺序仍由 selTabs 统一触发。
        function selTabsDisposeItem(selTabsItem) {
            let selTabsCleanupError = null;
            try {
                if (typeof selTabsItem.cleanup === "function") {
                    selTabsItem.cleanup();
                }
            } catch (selTabsError) {
                // 单个子控件清理失败不能让已关闭页签继续残留；完成 DOM 回收后再记录错误。
                selTabsCleanupError = selTabsError;
            } finally {
                selTabsItem.panel.remove();
                selTabsItem.wrapper.remove();
            }
            if (selTabsCleanupError) console.error("selTabs 子组件清理失败", selTabsCleanupError);
        }

        // 关闭是真销毁：回收内容、事件所属 DOM、调用方子实例和注册记录，不积累隐藏页签。
        function selTabsClose(selTabsTabId, selTabsOptionsOverride = {}) {
            const selTabsNormalizedId = String(selTabsTabId);
            const selTabsItem = selTabsItems.get(selTabsNormalizedId);
            if (!selTabsItem || selTabsDestroyed) return false;
            if (!selTabsItem.closable && !selTabsOptionsOverride.force) return false;
            const selTabsOrder = selTabsOrderedIds();
            const selTabsClosedIndex = selTabsOrder.indexOf(selTabsNormalizedId);
            // 用户关闭允许业务阻止未保存内容离开；实例整体 destroy 使用 force 跳过该询问。
            if (!selTabsOptionsOverride.force) {
                const selTabsBeforeClose = new CustomEvent("selTabs:beforeClose", {
                    bubbles: true,
                    cancelable: true,
                    detail: selFreeze({ tabsId: selTabsId, tabId: selTabsNormalizedId })
                });
                if (!selTabsRoot.dispatchEvent(selTabsBeforeClose)) return false;
            }
            selTabsItems.delete(selTabsNormalizedId);
            selTabsDisposeItem(selTabsItem);
            const selTabsWasActive = selTabsActiveId === selTabsNormalizedId;
            if (selTabsWasActive) {
                selTabsActiveId = null;
                const selTabsRemaining = selTabsOrderedIds();
                const selTabsNextId = selTabsRemaining[Math.min(Math.max(selTabsClosedIndex, 0), selTabsRemaining.length - 1)];
                if (selTabsNextId) selTabsActivate(selTabsNextId);
            }
            selTabsSyncEmptyState();
            selTabsRoot.dispatchEvent(new CustomEvent("selTabs:close", {
                bubbles: true,
                detail: selFreeze({ tabsId: selTabsId, tabId: selTabsNormalizedId, destroyed: true })
            }));
            return true;
        }

        // 批量关闭使用正常 close 路径：保留固定页签，并在任意 beforeClose 取消时停止后续关闭。
        function selTabsCloseMany(selTabsTabIds) {
            const selTabsClosableIds = Array.from(selTabsTabIds || []).filter((selTabsTabId) => selTabsItems.get(String(selTabsTabId))?.closable);
            if (!selTabsClosableIds.length) return false;
            for (const selTabsTabId of selTabsClosableIds) {
                if (!selTabsClose(selTabsTabId)) return false;
            }
            return true;
        }

        // 关闭右侧以当前真实 DOM 顺序为准，永远跳过不可关闭的固定页签。
        function selTabsCloseRight(selTabsTabId) {
            const selTabsOrder = selTabsOrderedIds();
            const selTabsIndex = selTabsOrder.indexOf(String(selTabsTabId));
            if (selTabsIndex < 0) return false;
            return selTabsCloseMany(selTabsOrder.slice(selTabsIndex + 1));
        }

        // 关闭其他保留右键目标本身，其他固定页签也不受影响。
        function selTabsCloseOthers(selTabsTabId) {
            const selTabsNormalizedId = String(selTabsTabId);
            if (!selTabsItems.has(selTabsNormalizedId)) return false;
            return selTabsCloseMany(selTabsOrderedIds().filter((selTabsCandidateId) => selTabsCandidateId !== selTabsNormalizedId));
        }

        // 菜单禁用状态由页签实时顺序和 closable 声明计算，不依赖应用自行判断。
        function selTabsContextActions(selTabsTabId) {
            const selTabsOrder = selTabsOrderedIds();
            const selTabsIndex = selTabsOrder.indexOf(String(selTabsTabId));
            const selTabsRightClosable = selTabsIndex >= 0 && selTabsOrder.slice(selTabsIndex + 1)
                .some((selTabsCandidateId) => selTabsItems.get(selTabsCandidateId)?.closable);
            const selTabsOtherClosable = selTabsOrder
                .some((selTabsCandidateId) => selTabsCandidateId !== String(selTabsTabId) && selTabsItems.get(selTabsCandidateId)?.closable);
            const selTabsAnyClosable = selTabsOrder.some((selTabsCandidateId) => selTabsItems.get(selTabsCandidateId)?.closable);
            return [
                { id: "close-right", label: selTabsContextMenuLabels.closeRight, icon: "ri-skip-right-line", disabled: !selTabsRightClosable },
                { id: "close-others", label: selTabsContextMenuLabels.closeOthers, icon: "ri-close-circle-line", disabled: !selTabsOtherClosable },
                { id: "close-all", label: selTabsContextMenuLabels.closeAll, icon: "ri-delete-bin-line", disabled: !selTabsAnyClosable }
            ];
        }

        // 鼠标右键与 ContextMenu/Shift+F10 键共享同一公共菜单打开路径。
        function selTabsOpenContextMenu(selTabsItemElement, selTabsClientX, selTabsClientY, selTabsFocusFirst = false) {
            if (!selTabsContextMenu || !selTabsItemElement) return false;
            const selTabsTabId = String(selTabsItemElement.dataset.selTabsItem || "");
            if (!selTabsItems.has(selTabsTabId)) return false;
            return selTabsContextMenu.open({
                clientX: selTabsClientX,
                clientY: selTabsClientY,
                focusFirst: selTabsFocusFirst,
                restoreFocusTarget: selTabsItemElement.querySelector("[role='tab']"),
                context: { tabsId: selTabsId, tabId: selTabsTabId },
                items: selTabsContextActions(selTabsTabId)
            });
        }

        /**
         * 创建或激活一条业务页签。
         * @param {object} selTabsDefinition - 包含 id、label、icon、closable 和 mount(panel) 的页签定义。
         * @returns {Element|null} 返回当前页签内容面板；定义无效时返回 null。
         */
        function selTabsOpen(selTabsDefinition = {}) {
            const selTabsTabId = String(selTabsDefinition.id || "").trim();
            if (!selTabsTabId || selTabsDestroyed) return null;
            const selTabsExisting = selTabsItems.get(selTabsTabId);
            if (selTabsExisting) {
                selTabsActivate(selTabsTabId);
                return selTabsExisting.panel;
            }

            // 页签按钮与关闭按钮是同级原生按钮，避免按钮嵌套破坏键盘语义。
            const selTabsWrapper = document.createElement("div");
            selTabsWrapper.className = "seltabs-item";
            selTabsWrapper.dataset.selTabsItem = selTabsTabId;
            const selTabsTab = document.createElement("button");
            selTabsTab.className = "seltabs-tab";
            selTabsTab.type = "button";
            selTabsTab.id = `${selTabsId}-${selTabsTabId}-tab`.replace(/[^A-Za-z0-9_-]/g, "-");
            selTabsTab.setAttribute("role", "tab");
            selTabsTab.setAttribute("aria-selected", "false");
            selTabsTab.tabIndex = -1;
            const selTabsIcon = document.createElement("i");
            selTabsIcon.className = String(selTabsDefinition.icon || "ri-file-list-3-line");
            selTabsIcon.setAttribute("aria-hidden", "true");
            const selTabsLabel = document.createElement("span");
            selTabsLabel.textContent = String(selTabsDefinition.label || selTabsTabId);
            selTabsTab.append(selTabsIcon, selTabsLabel);
            const selTabsPanel = document.createElement("section");
            selTabsPanel.className = "seltabs-panel";
            selTabsPanel.id = `${selTabsId}-${selTabsTabId}-panel`.replace(/[^A-Za-z0-9_-]/g, "-");
            selTabsPanel.dataset.selTabsPanel = selTabsTabId;
            selTabsPanel.setAttribute("role", "tabpanel");
            selTabsPanel.setAttribute("aria-labelledby", selTabsTab.id);
            selTabsPanel.hidden = true;
            selTabsTab.setAttribute("aria-controls", selTabsPanel.id);
            selTabsWrapper.appendChild(selTabsTab);
            const selTabsClosable = selTabsDefinition.closable !== false;
            if (selTabsClosable) {
                const selTabsCloseButton = document.createElement("button");
                selTabsCloseButton.className = "seltabs-close";
                selTabsCloseButton.type = "button";
                selTabsCloseButton.dataset.selTabsClose = selTabsTabId;
                selTabsCloseButton.setAttribute("aria-label", String(selTabsDefinition.closeLabel || `关闭${selTabsDefinition.label || selTabsTabId}`));
                // 关闭是关键入口，使用本地字符，避免宿主未加载图标字体时出现空白按钮。
                selTabsCloseButton.textContent = "×";
                selTabsWrapper.appendChild(selTabsCloseButton);
            }
            selTabsList.appendChild(selTabsWrapper);
            selTabsPanels.appendChild(selTabsPanel);
            const selTabsItem = { id: selTabsTabId, wrapper: selTabsWrapper, tab: selTabsTab, panel: selTabsPanel, closable: selTabsClosable, cleanup: null };
            selTabsItems.set(selTabsTabId, selTabsItem);
            // mount 回调只接收当前页签面板；返回的函数成为关闭时唯一子生命周期清理入口。
            if (typeof selTabsDefinition.mount === "function") {
                const selTabsCleanup = selTabsDefinition.mount(selTabsPanel, selFreeze({ tabsId: selTabsId, tabId: selTabsTabId }));
                if (typeof selTabsCleanup === "function") selTabsItem.cleanup = selTabsCleanup;
            }
            selTabsSyncEmptyState();
            selTabsActivate(selTabsTabId);
            selTabsRoot.dispatchEvent(new CustomEvent("selTabs:open", {
                bubbles: true,
                detail: selFreeze({ tabsId: selTabsId, tabId: selTabsTabId, created: true })
            }));
            return selTabsPanel;
        }

        // 页签条使用事件委托，新增页签无需重复绑定监听器。
        selTabsList.addEventListener("click", (selTabsEvent) => {
            const selTabsCloseButton = selTabsEvent.target.closest("[data-sel-tabs-close]");
            if (selTabsCloseButton) {
                selTabsClose(selTabsCloseButton.dataset.selTabsClose);
                return;
            }
            const selTabsItem = selTabsEvent.target.closest("[data-sel-tabs-item]");
            if (selTabsItem) selTabsActivate(selTabsItem.dataset.selTabsItem);
        });
        // 只有落在当前 Tab 实例页签上的右键事件才被接管，空白页签条保留浏览器默认语义。
        selTabsList.addEventListener("contextmenu", (selTabsEvent) => {
            const selTabsItem = selTabsEvent.target.closest("[data-sel-tabs-item]");
            if (!selTabsItem || !selTabsList.contains(selTabsItem)) return;
            if (selTabsOpenContextMenu(selTabsItem, selTabsEvent.clientX, selTabsEvent.clientY)) selTabsEvent.preventDefault();
        });
        // 左右键、Home、End 遵循标准页签键盘路径；Delete 只关闭可关闭页签。
        selTabsList.addEventListener("keydown", (selTabsEvent) => {
            const selTabsCurrent = selTabsEvent.target.closest("[role='tab']")?.closest("[data-sel-tabs-item]");
            if (!selTabsCurrent) return;
            const selTabsOrder = selTabsOrderedIds();
            const selTabsIndex = selTabsOrder.indexOf(selTabsCurrent.dataset.selTabsItem);
            let selTabsTargetIndex = null;
            if (selTabsEvent.key === "ArrowLeft") selTabsTargetIndex = (selTabsIndex - 1 + selTabsOrder.length) % selTabsOrder.length;
            if (selTabsEvent.key === "ArrowRight") selTabsTargetIndex = (selTabsIndex + 1) % selTabsOrder.length;
            if (selTabsEvent.key === "Home") selTabsTargetIndex = 0;
            if (selTabsEvent.key === "End") selTabsTargetIndex = selTabsOrder.length - 1;
            if (selTabsTargetIndex !== null) {
                selTabsEvent.preventDefault();
                selTabsActivate(selTabsOrder[selTabsTargetIndex], true);
            }
            if (selTabsEvent.key === "Delete") {
                selTabsEvent.preventDefault();
                selTabsClose(selTabsCurrent.dataset.selTabsItem);
            }
            if (selTabsEvent.key === "ContextMenu" || (selTabsEvent.shiftKey && selTabsEvent.key === "F10")) {
                const selTabsBounds = selTabsCurrent.getBoundingClientRect();
                if (selTabsOpenContextMenu(selTabsCurrent, selTabsBounds.left + 18, selTabsBounds.bottom, true)) {
                    selTabsEvent.preventDefault();
                }
            }
        });

        // 公共右键菜单只广播动作 ID，Tab 组件在自己边界内执行具体关闭语义。
        selTabsRoot.addEventListener("selContextMenu:action", (selTabsEvent) => {
            if (selTabsEvent.detail?.menuId !== `${selTabsId}:tab-actions`) return;
            const selTabsTabId = String(selTabsEvent.detail.context?.tabId || "");
            if (selTabsEvent.detail.actionId === "close-right") selTabsCloseRight(selTabsTabId);
            if (selTabsEvent.detail.actionId === "close-others") selTabsCloseOthers(selTabsTabId);
            if (selTabsEvent.detail.actionId === "close-all") selTabsCloseMany(selTabsOrderedIds());
        });

        function selTabsDestroy() {
            if (selTabsDestroyed) return false;
            // 实例销毁强制关闭全部页签，逐一执行子组件清理后再移除根节点。
            selTabsOrderedIds().forEach((selTabsTabId) => selTabsClose(selTabsTabId, { force: true }));
            selTabsContextMenu?.destroy();
            selTabsDestroyed = true;
            selTabsInstances.delete(selTabsId);
            selTabsRoot.remove();
            return true;
        }

        const selTabsController = {
            id: selTabsId,
            root: selTabsRoot,
            open: selTabsOpen,
            activate: selTabsActivate,
            close: selTabsClose,
            closeRight: selTabsCloseRight,
            closeOthers: selTabsCloseOthers,
            closeAll: () => selTabsCloseMany(selTabsOrderedIds()),
            setContextMenuEnabled: selTabsSetContextMenuEnabled,
            getPanel: (selTabsTabId) => selTabsItems.get(String(selTabsTabId))?.panel || null,
            has: (selTabsTabId) => selTabsItems.has(String(selTabsTabId)),
            list: () => selFreeze(selTabsOrderedIds()),
            getState: () => selFreeze({ activeId: selTabsActiveId, count: selTabsItems.size, contextMenuEnabled: selTabsContextMenuEnabled }),
            destroy: selTabsDestroy
        };
        selTabsInstances.set(selTabsId, selTabsController);
        selTabsRoot.dataset.selTabsReady = "true";
        selTabsSyncEmptyState();
        return selTabsController;
    }

    window.sel.register("components.tabs", {
        mount: selTabsMount,
        get: (selTabsId) => selTabsInstances.get(String(selTabsId)) || null,
        has: (selTabsId) => selTabsInstances.has(String(selTabsId)),
        list: () => selFreeze(Array.from(selTabsInstances.keys()))
    });
})();
