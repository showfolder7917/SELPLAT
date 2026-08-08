/*
 * selTree.js：通用树形导航多实例基础控件。
 * 负责接收调用方传入的树数据、创建独立树控制器，并把选择事件限制在所属宿主实例内部。
 * 责任边界：本文件不请求接口、不读取 具体应用 数据，也不自行扫描并初始化业务模块。
 * 模块级标识统一使用 selTree 前缀，公开注册表为 window.selTree。
 */
(function selTreeInitializeRegistry() {
    "use strict";

    // 注册表以业务表格实例名保存树控制器，禁止不同表格共享选择状态。
    const selTreeInstances = new Map();

    // 深层查找节点，使公开选择接口不依赖人工配置层级。
    function selTreeFindItem(items, targetId) {
        // 当前层逐项匹配，并在存在子节点时递归查找。
        for (const item of items) {
            if (item.id === targetId) {
                return item;
            }
            if (Array.isArray(item.children)) {
                const child = selTreeFindItem(item.children, targetId);
                if (child) {
                    return child;
                }
            }
        }
        // 未找到真实节点时返回空值。
        return null;
    }

    // 创建单个业务实例的树控制器。
    function selTreeCreateInstance(gridRoot, selTreeNavigationData) {
        // 业务实例名来自表格根节点，不通过字符串拆分推测实体。
        const gridId = gridRoot.dataset.selGrid;
        // 当前实例树数据只能由应用装配层显式传入，基础控件不读取任何页面全局业务数据。
        let selTreeInputData = selTreeNavigationData || null;
        // 树节点只允许从当前表格根节点内部查找。
        const treeRoot = gridRoot.querySelector('[data-sel-grid-role="tree"]');
        // 当前实例没有名称、树区域或后端树片段时不创建空控制器。
        if (!gridId || !treeRoot || !selTreeInputData || !Array.isArray(selTreeInputData.items)) {
            return null;
        }

        // 每个树实例独立保存当前选择和展开集合。
        const state = {
            selectedId: selTreeInputData.selectedId,
            expandedIds: new Set()
        };
        // 展开与收起使用业务 JSON 的完整句式模板，基础树控件不推测当前语言语序。
        const messages = {
            expandTemplate: selTreeInputData.expandLabelTemplate || "展开{label}",
            collapseTemplate: selTreeInputData.collapseLabelTemplate || "收起{label}",
            contextMenuLabelTemplate: selTreeInputData.contextMenuLabelTemplate || "{label}操作"
        };
        // 右键菜单挂到 body，避免树滚动容器裁切；菜单动作仍只向当前 gridRoot 广播。
        const contextMenu = document.createElement("div");
        contextMenu.className = "seltree-context-menu";
        contextMenu.setAttribute("role", "menu");
        contextMenu.setAttribute("aria-hidden", "true");
        contextMenu.hidden = true;
        document.body.appendChild(contextMenu);
        let contextItem = null;
        let contextTrigger = null;

        // 收集配置中默认展开的全部父节点。
        function collectExpanded(items) {
            items.forEach((item) => {
                if (item.expanded && Array.isArray(item.children)) {
                    state.expandedIds.add(item.id);
                }
                if (Array.isArray(item.children)) {
                    collectExpanded(item.children);
                }
            });
        }

        // 图标节点统一使用 Remix Icon，并隐藏重复辅助语义。
        function createIcon(className) {
            const icon = document.createElement("i");
            icon.className = className;
            icon.setAttribute("aria-hidden", "true");
            return icon;
        }

        // 按当前实例状态递归创建树形列表。
        function createList(items) {
            const list = document.createElement("ul");
            list.className = "seltree-list";
            items.forEach((item) => {
                const listItem = document.createElement("li");
                listItem.dataset.treeId = item.id;
                const row = document.createElement("div");
                row.className = `seltree-node-row${state.selectedId === item.id ? " seltree-node-selected" : ""}`;
                const hasChildren = Array.isArray(item.children) && item.children.length > 0;

                // 展开按钮为叶子节点保留对齐占位，为父节点同步真实展开状态。
                const toggle = document.createElement("button");
                toggle.className = `seltree-node-toggle${hasChildren ? "" : " seltree-node-toggle-empty"}`;
                toggle.type = "button";
                toggle.dataset.treeAction = "toggle";
                toggle.dataset.treeId = item.id;
                toggle.tabIndex = hasChildren ? 0 : -1;
                if (hasChildren) {
                    const expanded = state.expandedIds.has(item.id);
                    toggle.setAttribute("aria-expanded", String(expanded));
                    // 节点名称注入本地化模板，日文和英文可采用与中文不同的语序。
                    toggle.setAttribute("aria-label", (expanded ? messages.collapseTemplate : messages.expandTemplate)
                        .replaceAll("{label}", item.label));
                }
                toggle.appendChild(createIcon("ri-arrow-right-s-line"));

                // 选择按钮保存业务节点标识并展示图标、文字和数量。
                const button = document.createElement("button");
                button.className = "seltree-node-button";
                button.type = "button";
                button.dataset.treeAction = "select";
                button.dataset.treeId = item.id;
                if (state.selectedId === item.id) {
                    button.setAttribute("aria-current", "page");
                }
                button.appendChild(createIcon(item.icon));
                const label = document.createElement("span");
                label.className = "seltree-node-label";
                label.textContent = item.label;
                button.appendChild(label);
                const count = document.createElement("span");
                count.className = "seltree-node-count";
                count.textContent = String(item.count ?? 0);
                row.append(toggle, button, count);
                listItem.appendChild(row);

                // 子列表只受当前实例展开集合控制。
                if (hasChildren) {
                    const childList = createList(item.children);
                    childList.classList.toggle("seltree-children-hidden", !state.expandedIds.has(item.id));
                    listItem.appendChild(childList);
                }
                list.appendChild(listItem);
            });
            return list;
        }

        // 重绘只替换当前表格实例的树根内容。
        function render() {
            treeRoot.replaceChildren(createList(selTreeInputData.items));
        }

        // 关闭当前实例菜单；键盘打开的菜单可把焦点还给对应树节点。
        function closeContextMenu(restoreFocus = false) {
            contextMenu.hidden = true;
            contextMenu.setAttribute("aria-hidden", "true");
            contextMenu.replaceChildren();
            if (restoreFocus && contextTrigger?.isConnected) contextTrigger.focus();
            contextItem = null;
            contextTrigger = null;
            return true;
        }

        // 菜单位置使用视口坐标，并在右侧或底部空间不足时向内收拢。
        function positionContextMenu(clientX, clientY) {
            const viewportGap = 8;
            contextMenu.style.left = `${Math.max(viewportGap, clientX)}px`;
            contextMenu.style.top = `${Math.max(viewportGap, clientY)}px`;
            const bounds = contextMenu.getBoundingClientRect();
            const left = Math.min(Math.max(viewportGap, clientX), Math.max(viewportGap, document.documentElement.clientWidth - bounds.width - viewportGap));
            const top = Math.min(Math.max(viewportGap, clientY), Math.max(viewportGap, document.documentElement.clientHeight - bounds.height - viewportGap));
            contextMenu.style.left = `${left}px`;
            contextMenu.style.top = `${top}px`;
        }

        // 只为节点显式声明的动作创建安全文本按钮，基础树不推测编辑或删除的业务含义。
        function openContextMenu(item, trigger, clientX, clientY, focusFirst = false) {
            const actions = Array.isArray(item.contextActions) ? item.contextActions.filter((action) => action?.id && action?.label) : [];
            if (!actions.length) return false;
            closeContextMenu(false);
            state.selectedId = item.id;
            render();
            contextItem = item;
            contextTrigger = treeRoot.querySelector(`[data-tree-action="select"][data-tree-id="${CSS.escape(String(item.id))}"]`);
            contextMenu.setAttribute("aria-label", messages.contextMenuLabelTemplate.replaceAll("{label}", item.label));
            actions.forEach((action) => {
                const button = document.createElement("button");
                button.className = `seltree-context-menu-item${action.danger ? " seltree-context-menu-item-danger" : ""}`;
                button.type = "button";
                button.dataset.treeContextAction = String(action.id);
                button.setAttribute("role", "menuitem");
                button.appendChild(createIcon(String(action.icon || "ri-circle-line")));
                const label = document.createElement("span");
                label.textContent = String(action.label);
                button.appendChild(label);
                contextMenu.appendChild(button);
            });
            contextMenu.hidden = false;
            contextMenu.setAttribute("aria-hidden", "false");
            positionContextMenu(clientX, clientY);
            if (focusFirst) contextMenu.querySelector("button")?.focus();
            return true;
        }

        // 选择节点并向所属 data-sel-grid 根节点广播局部事件。
        function select(nodeId) {
            const item = selTreeFindItem(selTreeInputData.items, nodeId);
            if (!item) {
                return false;
            }
            state.selectedId = item.id;
            render();
            gridRoot.dispatchEvent(new CustomEvent("selTree:select", {
                bubbles: true,
                detail: {
                    gridId,
                    entity: gridRoot.dataset.selEntity || "",
                    id: item.id,
                    label: item.label,
                    filter: item.filter || {}
                }
            }));
            return true;
        }

        // 当前树根使用事件委托处理展开和选择，不监听其他实例节点。
        treeRoot.addEventListener("click", (event) => {
            const button = event.target.closest("[data-tree-action]");
            if (!button || !treeRoot.contains(button)) {
                return;
            }
            const item = selTreeFindItem(selTreeInputData.items, button.dataset.treeId);
            if (!item) {
                return;
            }
            if (button.dataset.treeAction === "toggle") {
                if (state.expandedIds.has(item.id)) {
                    state.expandedIds.delete(item.id);
                } else {
                    state.expandedIds.add(item.id);
                }
                render();
                return;
            }
            select(item.id);
        });

        // 鼠标右键只选中节点并打开业务菜单，不触发普通选择动作造成查询页签提前打开。
        treeRoot.addEventListener("contextmenu", (event) => {
            const button = event.target.closest('[data-tree-action="select"]');
            if (!button || !treeRoot.contains(button)) return;
            const item = selTreeFindItem(selTreeInputData.items, button.dataset.treeId);
            if (!item || !openContextMenu(item, button, event.clientX, event.clientY)) return;
            event.preventDefault();
        });

        // ContextMenu 键和 Shift+F10 为键盘用户提供与鼠标右键一致的入口。
        treeRoot.addEventListener("keydown", (event) => {
            if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
            const button = event.target.closest('[data-tree-action="select"]');
            if (!button || !treeRoot.contains(button)) return;
            const item = selTreeFindItem(selTreeInputData.items, button.dataset.treeId);
            const bounds = button.getBoundingClientRect();
            if (!item || !openContextMenu(item, button, bounds.left + 24, bounds.bottom, true)) return;
            event.preventDefault();
        });

        // 菜单动作只提交稳定动作 ID 和节点快照，具体数据库副作用由应用装配层决定。
        contextMenu.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-tree-context-action]");
            if (!button || !contextItem) return;
            const item = contextItem;
            const action = button.dataset.treeContextAction;
            closeContextMenu(false);
            gridRoot.dispatchEvent(new CustomEvent("selTree:contextAction", {
                bubbles: true,
                detail: Object.freeze({
                    gridId,
                    entity: gridRoot.dataset.selEntity || "",
                    id: item.id,
                    label: item.label,
                    filter: Object.freeze({ ...(item.filter || {}) }),
                    action
                })
            }));
        });

        // 菜单内上下键循环移动焦点，Escape 关闭并返回原节点。
        contextMenu.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeContextMenu(true);
                return;
            }
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            const buttons = Array.from(contextMenu.querySelectorAll("button:not(:disabled)"));
            const currentIndex = buttons.indexOf(document.activeElement);
            const offset = event.key === "ArrowDown" ? 1 : -1;
            buttons[(currentIndex + offset + buttons.length) % buttons.length]?.focus();
            event.preventDefault();
        });

        function handleOutsidePointer(event) {
            if (!contextMenu.hidden && !contextMenu.contains(event.target)) closeContextMenu(false);
        }

        function handleViewportChange() {
            if (!contextMenu.hidden) closeContextMenu(false);
        }

        document.addEventListener("pointerdown", handleOutsidePointer, true);
        window.addEventListener("resize", handleViewportChange);
        window.addEventListener("scroll", handleViewportChange, true);

        // 默认展开状态和首次树结构只影响当前实例。
        collectExpanded(selTreeInputData.items);
        render();

        // 语言配置原位替换后保留当前节点与展开集合，只重绘显示文字和可访问名称。
        function selTreeSetLocale(selTreeNext = {}) {
            const selTreeNextData = selTreeNext.resource || selTreeNext.messages || selTreeNext;
            if (!selTreeNextData || !Array.isArray(selTreeNextData.items)) return false;
            selTreeInputData = selTreeNextData;
            messages.expandTemplate = selTreeInputData.expandLabelTemplate || "展开{label}";
            messages.collapseTemplate = selTreeInputData.collapseLabelTemplate || "收起{label}";
            messages.contextMenuLabelTemplate = selTreeInputData.contextMenuLabelTemplate || "{label}操作";
            if (!selTreeFindItem(selTreeInputData.items, state.selectedId)) state.selectedId = selTreeInputData.selectedId;
            closeContextMenu(false);
            render();
            return true;
        }

        // 销毁时回收 body 门户和全局监听，避免动态工作区反复挂载后残留菜单实例。
        function destroy() {
            closeContextMenu(false);
            document.removeEventListener("pointerdown", handleOutsidePointer, true);
            window.removeEventListener("resize", handleViewportChange);
            window.removeEventListener("scroll", handleViewportChange, true);
            contextMenu.remove();
            selTreeInstances.delete(gridId);
            return true;
        }

        // 冻结公开控制器，外部只能通过稳定方法操作当前树实例。
        return Object.freeze({
            id: gridId,
            root: treeRoot,
            select,
            refresh: render,
            setLocale: selTreeSetLocale,
            getSelectedId: () => state.selectedId,
            closeContextMenu,
            destroy
        });
    }

    // 公开注册表由应用装配层显式挂载实例，基础组件不擅自初始化业务页面。
    window.selTree = Object.freeze({
        // mount 接收宿主根和标准树数据；缺失基础控件宿主或重复实例时返回 null。
        mount(gridRoot, treeData) {
            // 非元素宿主无法形成独立组件作用域。
            if (!(gridRoot instanceof Element)) {
                return null;
            }
            // 完整业务实例名是注册表唯一键。
            const gridId = gridRoot.dataset.selGrid;
            // 重复调用直接返回现有控制器，避免重复绑定事件。
            if (gridId && selTreeInstances.has(gridId)) {
                return selTreeInstances.get(gridId);
            }
            // 创建过程只使用本次显式传入的数据。
            const instance = selTreeCreateInstance(gridRoot, treeData);
            // 有效实例才进入公开注册表。
            if (instance) {
                selTreeInstances.set(instance.id, instance);
            }
            // 调用方通过返回值判断挂载是否成功。
            return instance;
        },
        // get 按完整业务实例名读取控制器。
        get: (gridId) => selTreeInstances.get(gridId) || null,
        // has 判断目标实例是否已经由应用装配层挂载。
        has: (gridId) => selTreeInstances.has(gridId)
    });
})();
