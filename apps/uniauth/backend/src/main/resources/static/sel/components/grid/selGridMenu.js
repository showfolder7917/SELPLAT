/*
 * selGridMenu.js：通用表格行操作菜单多实例基础控件。
 * 负责接收调用方传入的菜单数据，为每个宿主创建独立状态、滚动阈值、二级菜单和局部动作事件。
 * 责任边界：本文件不请求接口、不读取 Uniauth 数据，也不自行扫描并初始化业务模块。
 * 模块级标识统一使用 selGridMenu 前缀，公开注册表为 window.selGridMenu。
 */
(function selGridMenuInitializeRegistry() {
    "use strict";

    // 注册表使用业务表格实例名隔离菜单控制器。
    const selGridMenuInstances = new Map();

    // 创建属于单个表格根节点的菜单实例。
    function selGridMenuCreateInstance(gridRoot, selGridMenuData) {
        // 实例名直接读取 data-sel-grid，不从实体类名字符串推断。
        const gridId = gridRoot.dataset.selGrid;
        // 菜单数据只能由应用装配层显式传入，基础控件不读取页面全局业务对象。
        const selGridMenuInputData = selGridMenuData || null;
        // 菜单只从当前表格根节点内部查找。
        const menuRoot = gridRoot.querySelector('[data-sel-grid-role="menu"]');
        // 当前表格没有实例名、菜单区域或后端菜单片段时允许安全降级。
        if (!gridId || !menuRoot || !selGridMenuInputData || !Array.isArray(selGridMenuInputData.items)) {
            return null;
        }

        // 每个菜单实例独立保存项目、二级菜单和人工配置副本。
        const state = {
            project: null,
            activeSubmenuId: null,
            items: selGridMenuInputData.items.map((item) => ({ ...item, children: Array.isArray(item.children) ? item.children.map((child) => ({ ...child })) : undefined })),
            scrollAfter: selGridMenuInputData.scrollAfter
        };
        // 当前实例缓存自己的一级滚动区和二级菜单。
        let viewport = null;
        let submenu = null;

        // 图标节点统一使用 Remix Icon。
        function createIcon(className) {
            const icon = document.createElement("i");
            icon.className = className;
            icon.setAttribute("aria-hidden", "true");
            return icon;
        }

        // 根据一级或二级配置创建真实菜单按钮。
        function createItemButton(item, level) {
            const button = document.createElement("button");
            button.className = `selgrid-menu-item${item.danger ? " selgrid-menu-danger" : ""}${item.sectionStart ? " selgrid-menu-section-start" : ""}`;
            button.type = "button";
            button.dataset.menuId = item.id;
            button.dataset.menuLevel = level;
            button.disabled = Boolean(item.disabled);
            if (Array.isArray(item.children) && item.children.length > 0) {
                button.setAttribute("aria-haspopup", "menu");
                button.setAttribute("aria-expanded", String(state.activeSubmenuId === item.id));
            }
            button.appendChild(createIcon(item.icon));
            const label = document.createElement("span");
            label.className = "selgrid-menu-label";
            label.textContent = item.label;
            button.appendChild(label);
            const trailing = document.createElement("span");
            trailing.setAttribute("aria-hidden", "true");
            if (item.badge) {
                trailing.className = "selgrid-menu-badge";
                trailing.removeAttribute("aria-hidden");
                trailing.textContent = item.badge;
            }
            button.appendChild(trailing);
            if (Array.isArray(item.children) && item.children.length > 0) {
                const chevron = createIcon("ri-arrow-right-s-line");
                chevron.classList.add("selgrid-menu-chevron");
                button.appendChild(chevron);
            }
            return button;
        }

        // 关闭当前实例二级菜单并同步父项目展开状态。
        function closeSubmenu() {
            state.activeSubmenuId = null;
            if (submenu) {
                submenu.classList.remove("selgrid-menu-open");
                // 关闭时清除动态翻转状态，确保下次展开重新按当前面板空间计算方向。
                submenu.classList.remove("selgrid-menu-submenu-flip");
            }
            menuRoot.querySelectorAll('.selgrid-menu-item[aria-haspopup="menu"]').forEach((button) => button.setAttribute("aria-expanded", "false"));
        }

        // 打开指定父动作的二级菜单。
        function openSubmenu(item, trigger) {
            if (!Array.isArray(item.children) || item.children.length === 0 || !submenu) {
                closeSubmenu();
                return;
            }
            state.activeSubmenuId = item.id;
            menuRoot.querySelectorAll('.selgrid-menu-item[aria-haspopup="menu"]').forEach((button) => button.setAttribute("aria-expanded", String(button === trigger)));
            const fragment = document.createDocumentFragment();
            item.children.forEach((child) => fragment.appendChild(createItemButton(child, "secondary")));
            submenu.replaceChildren(fragment);
            const top = trigger.offsetTop - (viewport ? viewport.scrollTop : 0) - 5;
            submenu.style.setProperty("--selgrid-menu-submenu-top", `${top}px`);
            submenu.classList.add("selgrid-menu-open");
            // 二级菜单优先向右展开；所属水晶面板右侧空间不足且左侧更宽时翻向左侧，避免越出边框。
            const selGridPanelBounds = gridRoot.closest(".selpanel-shell")?.getBoundingClientRect();
            // 当前一级菜单边界用于计算两侧实际剩余空间。
            const selGridMenuBounds = menuRoot.getBoundingClientRect();
            // 二级菜单已显示后读取真实宽度，避免依赖重复的样式常量。
            const selGridSubmenuWidth = submenu.getBoundingClientRect().width;
            // 没有面板宿主时回退到浏览器可视区域，保证基础控件可独立使用。
            const selGridBoundaryLeft = selGridPanelBounds ? selGridPanelBounds.left : 0;
            // 面板右边界或当前视口宽度是二级菜单不得越过的实际边界。
            const selGridBoundaryRight = selGridPanelBounds ? selGridPanelBounds.right : window.innerWidth;
            // 右侧空间包含一级菜单与二级菜单预留的 8px 搭接宽度。
            const selGridRightSpace = selGridBoundaryRight - selGridMenuBounds.right + 8;
            // 左侧空间同样保留搭接宽度，确保翻转后的视觉连接不发生断层。
            const selGridLeftSpace = selGridMenuBounds.left - selGridBoundaryLeft + 8;
            // 右侧放不下且左侧更适合承载完整二级菜单时才翻转，避免无必要的方向跳变。
            submenu.classList.toggle("selgrid-menu-submenu-flip", selGridRightSpace < selGridSubmenuWidth && selGridLeftSpace > selGridRightSpace);
        }

        // 按当前实例配置重绘一级和二级菜单容器。
        function render() {
            menuRoot.style.setProperty("--selgrid-menu-visible-items", String(state.scrollAfter));
            menuRoot.classList.toggle("selgrid-menu-scrollable", state.items.length > state.scrollAfter);
            viewport = document.createElement("div");
            viewport.className = "selgrid-menu-viewport";
            viewport.setAttribute("role", "menu");
            const list = document.createElement("div");
            list.className = "selgrid-menu-list";
            state.items.forEach((item) => list.appendChild(createItemButton(item, "primary")));
            viewport.appendChild(list);
            submenu = document.createElement("div");
            submenu.className = "selgrid-menu-submenu";
            submenu.setAttribute("role", "menu");
            menuRoot.replaceChildren(viewport, submenu);
            viewport.addEventListener("scroll", closeSubmenu, { passive: true });
        }

        // 按层级从当前实例配置中查找菜单动作。
        function findItem(menuId, level) {
            if (level === "primary") {
                return state.items.find((item) => item.id === menuId) || null;
            }
            const parent = state.items.find((item) => item.id === state.activeSubmenuId);
            return parent && Array.isArray(parent.children) ? parent.children.find((item) => item.id === menuId) || null : null;
        }

        // 菜单动作只在所属表格根节点广播，并携带实例和实体信息。
        function dispatchAction(item, level) {
            gridRoot.dispatchEvent(new CustomEvent("selGridMenu:action", {
                bubbles: true,
                detail: {
                    gridId,
                    entity: gridRoot.dataset.selEntity || "",
                    actionId: item.id,
                    label: item.label,
                    level,
                    project: state.project
                }
            }));
        }

        // 打开状态变化只通知当前表格实例。
        function dispatchOpenChange() {
            gridRoot.dispatchEvent(new CustomEvent("selGridMenu:openChange", {
                bubbles: true,
                detail: {
                    gridId,
                    open: menuRoot.classList.contains("selgrid-menu-open"),
                    project: state.project
                }
            }));
        }

        // 打开菜单并绑定当前实例中的业务记录。
        function open(project) {
            state.project = project;
            closeSubmenu();
            menuRoot.classList.add("selgrid-menu-open");
            menuRoot.setAttribute("aria-hidden", "false");
            dispatchOpenChange();
        }

        // 关闭菜单并清理当前实例记录归属。
        function close() {
            closeSubmenu();
            menuRoot.classList.remove("selgrid-menu-open");
            menuRoot.setAttribute("aria-hidden", "true");
            state.project = null;
            dispatchOpenChange();
        }

        // 同一记录重复触发时关闭，不同记录触发时切换归属。
        function toggle(project) {
            if (menuRoot.classList.contains("selgrid-menu-open") && state.project && state.project.projectId === project.projectId) {
                close();
                return;
            }
            open(project);
        }

        // 当前菜单根使用事件委托处理一级与二级动作。
        menuRoot.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-menu-id]");
            if (!button || button.disabled || !menuRoot.contains(button)) {
                return;
            }
            const item = findItem(button.dataset.menuId, button.dataset.menuLevel);
            if (!item) {
                return;
            }
            if (button.dataset.menuLevel === "primary" && Array.isArray(item.children) && item.children.length > 0) {
                openSubmenu(item, button);
                return;
            }
            dispatchAction(item, button.dataset.menuLevel);
        });

        // 悬停或键盘焦点进入父动作时展开当前实例二级菜单。
        ["pointerover", "focusin"].forEach((eventName) => {
            menuRoot.addEventListener(eventName, (event) => {
                const button = event.target.closest('button[data-menu-level="primary"]');
                if (!button || button.disabled || !menuRoot.contains(button)) {
                    return;
                }
                const item = findItem(button.dataset.menuId, "primary");
                if (item && Array.isArray(item.children) && item.children.length > 0) {
                    openSubmenu(item, button);
                }
            });
        });

        // 指针按下和释放只维护当前实例菜单按钮的压下状态。
        menuRoot.addEventListener("pointerdown", (event) => {
            const button = event.target.closest("button[data-menu-id]:not(:disabled)");
            if (button && menuRoot.contains(button)) {
                button.classList.add("selgrid-menu-pressed");
            }
        });
        window.addEventListener("pointerup", () => {
            menuRoot.querySelectorAll(".selgrid-menu-item.selgrid-menu-pressed").forEach((button) => button.classList.remove("selgrid-menu-pressed"));
        });

        // 页面其他位置点击时只关闭当前打开的菜单实例。
        document.addEventListener("click", (event) => {
            if (!menuRoot.classList.contains("selgrid-menu-open")) {
                return;
            }
            // 点击另一套 data-sel-grid 属于其他业务实例，不关闭当前实例菜单。
            const ownerGrid = event.target.closest("[data-sel-grid]");
            if (ownerGrid && ownerGrid !== gridRoot) {
                return;
            }
            if (menuRoot.contains(event.target)) {
                return;
            }
            const menuButton = event.target.closest('button[data-action="menu"]');
            if (menuButton && gridRoot.contains(menuButton)) {
                return;
            }
            close();
        });

        // Escape 优先关闭当前实例二级菜单，再关闭一级菜单。
        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || !menuRoot.classList.contains("selgrid-menu-open")) {
                return;
            }
            if (state.activeSubmenuId) {
                closeSubmenu();
                return;
            }
            close();
        });

        // 首次加载为当前表格实例生成菜单。
        render();

        // 冻结实例控制器，外部只能通过稳定方法操作所属菜单。
        return Object.freeze({
            id: gridId,
            root: menuRoot,
            open,
            close,
            toggle,
            refresh: render,
            isOpen: () => menuRoot.classList.contains("selgrid-menu-open"),
            getProjectId: () => (state.project ? state.project.projectId : null),
            setItems: (items) => {
                state.items = Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
                render();
            },
            setScrollAfter: (count) => {
                state.scrollAfter = Math.max(1, Math.floor(Number(count) || 1));
                render();
            }
        });
    }

    // 公开注册表要求应用装配层显式传入宿主和菜单数据。
    window.selGridMenu = Object.freeze({
        // mount 创建或返回当前完整业务实例名对应的菜单控制器。
        mount(gridRoot, menuData) {
            // 非元素宿主无法提供组件作用域。
            if (!(gridRoot instanceof Element)) {
                return null;
            }
            // 完整实例名作为注册表唯一键。
            const gridId = gridRoot.dataset.selGrid;
            // 重复挂载复用现有实例，防止事件重复注册。
            if (gridId && selGridMenuInstances.has(gridId)) {
                return selGridMenuInstances.get(gridId);
            }
            // 创建过程只使用显式传入的菜单数据。
            const instance = selGridMenuCreateInstance(gridRoot, menuData);
            // 有效实例才写入注册表。
            if (instance) {
                selGridMenuInstances.set(instance.id, instance);
            }
            // 返回控制器供表格基础控件组合。
            return instance;
        },
        // get 按完整实例名读取菜单控制器。
        get: (gridId) => selGridMenuInstances.get(gridId) || null,
        // has 判断实例是否已经挂载。
        has: (gridId) => selGridMenuInstances.has(gridId)
    });
})();
