(function initializeGridMenuModule() {
    "use strict";

    // 菜单配置集中在文件头部，维护人员可直接增加、删除、排序项目或调整滚动阈值。
    window.GRID_MENU_CONFIG = {
        // 超过十个一级项目时固定菜单可视高度并启用纵向滚动。
        scrollAfter: 10,
        // 一级菜单数组决定项目顺序、图标、状态、徽标和可选二级菜单。
        items: [
            // 查看动作使用搜索图标，与设计稿默认项目保持一致。
            { id: "view", label: "查看详情", icon: "ri-search-line" },
            // 编辑动作使用线性编辑图标。
            { id: "edit", label: "编辑项目", icon: "ri-edit-line" },
            // 复制动作使用标签轮廓图标。
            { id: "copy", label: "复制项目", icon: "ri-price-tag-3-line" },
            // 移动动作携带 children 数组，悬停、聚焦或点击时展开二级菜单。
            {
                id: "move",
                label: "移动到",
                icon: "ri-file-copy-2-line",
                children: [
                    // 常用个人空间位于二级菜单首行。
                    { id: "move-personal", label: "我的空间", icon: "ri-folder-line" },
                    // 项目空间提供项目级归属目标。
                    { id: "move-project", label: "项目空间", icon: "ri-folder-line" },
                    // 团队空间提供协作归属目标。
                    { id: "move-team", label: "团队空间", icon: "ri-team-line" },
                    // 客户空间提供外部协作归属目标。
                    { id: "move-customer", label: "客户空间", icon: "ri-user-shared-line" },
                    // 最近位置通过分组起始标记呈现设计稿中的分隔关系。
                    { id: "move-recent", label: "最近位置", icon: "ri-history-line", sectionStart: true },
                    // 选择位置提供继续打开位置选择器的业务入口。
                    { id: "move-choose", label: "选择位置…", icon: "ri-folder-open-line" }
                ]
            },
            // 归档动作保持中性视觉。
            { id: "archive", label: "归档项目", icon: "ri-archive-drawer-line" },
            // 新功能徽标通过 badge 字段人工配置。
            { id: "add-tag", label: "添加标签", icon: "ri-price-tag-3-line", badge: "NEW" },
            // 禁用字段用于演示不可操作状态，移除 disabled 即可恢复交互。
            { id: "copy-link", label: "复制链接", icon: "ri-link", disabled: true },
            // 导出动作对应设计稿中的上传托盘图标。
            { id: "export", label: "导出", icon: "ri-upload-2-line" },
            // 新建文件夹动作提供资源整理入口。
            { id: "new-folder", label: "新建文件夹", icon: "ri-folder-add-line" },
            // 以下三个扩展项目让默认配置超过滚动阈值，直接展示长列表能力。
            { id: "share", label: "分享项目", icon: "ri-share-line" },
            // 权限设置使用安全设置图标。
            { id: "permissions", label: "权限设置", icon: "ri-shield-keyhole-line" },
            // 版本历史使用历史记录图标。
            { id: "history", label: "版本历史", icon: "ri-history-line" },
            // 危险字段把删除项目映射为红色危险操作。
            { id: "delete", label: "删除项目", icon: "ri-delete-bin-6-line", danger: true }
        ]
    };

    // 菜单根节点由表格页面提供，模块只负责填充内容和维护浮层状态。
    const root = document.querySelector("#project-menu");
    // 页面缺少菜单容器时安全退出，避免影响表格其他功能。
    if (!root) {
        return;
    }

    // 模块状态记录当前项目、当前二级菜单和可编辑配置。
    const state = {
        // 初始没有绑定任何表格项目。
        project: null,
        // 初始不显示二级菜单。
        activeSubmenuId: null,
        // 复制配置数组，运行时 setItems 不会修改文件头原始对象。
        items: [...window.GRID_MENU_CONFIG.items],
        // 滚动阈值转换为至少一项的有效整数。
        scrollAfter: Math.max(1, Number(window.GRID_MENU_CONFIG.scrollAfter) || 10)
    };

    // 缓存当前一级列表滚动容器，二级菜单定位时需要读取滚动偏移。
    let viewport = null;
    // 缓存二级菜单节点，关闭和重新定位时避免重复查询。
    let submenu = null;

    // 创建 Remix Icon 节点，菜单所有图标保持同一线性图标系统。
    function createIcon(className) {
        // i 元素只承担视觉装饰，业务语义由按钮名称表达。
        const icon = document.createElement("i");
        // 图标类名来自人工维护的可信菜单配置。
        icon.className = className;
        // 隐藏装饰图标，避免屏幕阅读器重复朗读。
        icon.setAttribute("aria-hidden", "true");
        // 返回可插入按钮的图标节点。
        return icon;
    }

    // 根据配置创建一级或二级真实按钮，保证鼠标、键盘和辅助技术都能使用。
    function createItemButton(item, level) {
        // 每个菜单项目使用原生按钮承接完整交互。
        const button = document.createElement("button");
        // 基础类统一尺寸，危险状态按配置追加红色皮肤。
        button.className = `grid-menu__item${item.danger ? " is-danger" : ""}${item.sectionStart ? " is-section-start" : ""}`;
        // 按钮不参与页面表单提交。
        button.type = "button";
        // 项目标识用于事件委托找到原始配置。
        button.dataset.menuId = item.id;
        // 层级用于区分一级菜单和二级菜单动作。
        button.dataset.menuLevel = level;
        // 禁用配置直接映射原生 disabled 属性。
        button.disabled = Boolean(item.disabled);
        // 有子项目的一级按钮声明弹出菜单语义。
        if (Array.isArray(item.children) && item.children.length > 0) {
            // aria-haspopup 告知辅助技术该按钮可以展开菜单。
            button.setAttribute("aria-haspopup", "menu");
            // 初始展开状态根据当前二级菜单标识计算。
            button.setAttribute("aria-expanded", String(state.activeSubmenuId === item.id));
        }
        // 左侧图标使用配置指定的 Remix Icon。
        button.appendChild(createIcon(item.icon));
        // 文字节点承载项目业务名称。
        const label = document.createElement("span");
        // 独立文字类提供截断和稳定字重。
        label.className = "grid-menu__label";
        // textContent 防止人工配置被解释为 HTML。
        label.textContent = item.label;
        // 文字放入按钮第二列。
        button.appendChild(label);
        // badge 字段存在时显示短徽标，例如 NEW。
        if (item.badge) {
            // 徽标节点只承担附加状态信息。
            const badge = document.createElement("span");
            // 徽标类提供蓝色小胶囊视觉。
            badge.className = "grid-menu__badge";
            // 徽标文案来自人工配置。
            badge.textContent = item.badge;
            // 徽标加入文字右侧。
            button.appendChild(badge);
        }
        // 没有徽标时补一个空列，保持所有箭头和文字对齐。
        if (!item.badge) {
            // 空节点不向辅助技术暴露内容。
            const spacer = document.createElement("span");
            // 隐藏空列的可访问语义。
            spacer.setAttribute("aria-hidden", "true");
            // 空列加入第三网格轨道。
            button.appendChild(spacer);
        }
        // 有子项目时显示右向箭头，普通动作保持第四列为空。
        if (Array.isArray(item.children) && item.children.length > 0) {
            // 箭头图标与参考设计一致。
            const chevron = createIcon("ri-arrow-right-s-line");
            // 专用类控制箭头尺寸。
            chevron.classList.add("grid-menu__chevron");
            // 箭头加入最右侧轨道。
            button.appendChild(chevron);
        }
        // 返回完整按钮供列表渲染。
        return button;
    }

    // 关闭二级菜单并同步所有父项目的展开状态。
    function closeSubmenu() {
        // 清空活动标识代表当前没有二级菜单。
        state.activeSubmenuId = null;
        // 已创建的二级菜单移除显示类。
        if (submenu) {
            submenu.classList.remove("is-open");
        }
        // 所有一级父按钮恢复未展开语义和视觉。
        root.querySelectorAll('.grid-menu__item[aria-haspopup="menu"]').forEach((button) => {
            // aria-expanded 与关闭状态同步。
            button.setAttribute("aria-expanded", "false");
        });
    }

    // 展开指定父项目的二级菜单，并保持子菜单与父行水平对齐。
    function openSubmenu(item, trigger) {
        // 缺少 children 时不创建空二级菜单。
        if (!Array.isArray(item.children) || item.children.length === 0) {
            closeSubmenu();
            return;
        }
        // 当前活动标识保存父项目主键。
        state.activeSubmenuId = item.id;
        // 所有父按钮只保留当前项目的展开状态。
        root.querySelectorAll('.grid-menu__item[aria-haspopup="menu"]').forEach((button) => {
            // 当前触发按钮标记为展开。
            button.setAttribute("aria-expanded", String(button === trigger));
        });
        // 文档片段一次承载全部二级动作。
        const fragment = document.createDocumentFragment();
        // 每条二级配置生成一个真实按钮。
        item.children.forEach((child) => fragment.appendChild(createItemButton(child, "secondary")));
        // 二级菜单替换为当前父项目的子项目。
        submenu.replaceChildren(fragment);
        // 子菜单顶边随父按钮和当前滚动位置调整。
        const submenuTop = trigger.offsetTop - (viewport ? viewport.scrollTop : 0) - 5;
        // CSS 变量让定位逻辑与视觉样式解耦。
        submenu.style.setProperty("--grid-submenu-top", `${submenuTop}px`);
        // 显示完成后的二级菜单。
        submenu.classList.add("is-open");
    }

    // 重新渲染一级菜单，使人工配置的项目数和滚动阈值立即生效。
    function render() {
        // 根节点通过 CSS 变量接收当前人工滚动阈值。
        root.style.setProperty("--grid-menu-visible-items", String(state.scrollAfter));
        // 超过阈值时添加滚动状态类。
        root.classList.toggle("is-scrollable", state.items.length > state.scrollAfter);
        // 新建一级菜单滚动区域。
        viewport = document.createElement("div");
        // 视口类负责最大高度和滚动条。
        viewport.className = "grid-menu__viewport";
        // 菜单语义放在实际滚动区域。
        viewport.setAttribute("role", "menu");
        // 新建一级按钮列表。
        const list = document.createElement("div");
        // 列表类提供固定行高栅格。
        list.className = "grid-menu__list";
        // 配置数组逐项生成一级按钮。
        state.items.forEach((item) => list.appendChild(createItemButton(item, "primary")));
        // 一级列表加入滚动区域。
        viewport.appendChild(list);
        // 新建可复用二级菜单容器。
        submenu = document.createElement("div");
        // 二级菜单类负责独立水晶边框和位置。
        submenu.className = "grid-menu__submenu";
        // 二级容器暴露菜单语义。
        submenu.setAttribute("role", "menu");
        // 根节点一次替换为最新一级视口和二级菜单。
        root.replaceChildren(viewport, submenu);
        // 滚动时关闭二级菜单，避免父行移动后子菜单悬空。
        viewport.addEventListener("scroll", closeSubmenu, { passive: true });
    }

    // 根据层级和项目标识从当前人工配置中查找动作。
    function findItem(menuId, level) {
        // 一级动作直接在顶层数组查找。
        if (level === "primary") {
            return state.items.find((item) => item.id === menuId) || null;
        }
        // 二级动作只在当前活动父项目中查找。
        const parent = state.items.find((item) => item.id === state.activeSubmenuId);
        // 当前没有有效父项目时返回空。
        if (!parent || !Array.isArray(parent.children)) {
            return null;
        }
        // 返回匹配的二级项目或空。
        return parent.children.find((item) => item.id === menuId) || null;
    }

    // 对外广播菜单动作，表格页面负责展示具体项目反馈。
    function dispatchAction(item, level) {
        // 自定义事件把菜单动作与当前项目一起交给表格。
        document.dispatchEvent(new CustomEvent("gridmenu:action", {
            // detail 保留稳定字段，方便业务方监听。
            detail: {
                // 动作标识来自人工配置。
                actionId: item.id,
                // 动作名称用于提示或日志。
                label: item.label,
                // 层级区分一级动作与二级目标。
                level,
                // 当前项目对象由 open 或 toggle 传入。
                project: state.project
            }
        }));
    }

    // 广播打开状态变化，使表格更多按钮同步 aria-expanded 和高亮。
    function dispatchOpenChange() {
        // 自定义事件不依赖 grid.js 的内部状态。
        document.dispatchEvent(new CustomEvent("gridmenu:openchange", {
            // 当前项目为空即代表菜单已经关闭。
            detail: {
                // open 提供直接布尔判断。
                open: root.classList.contains("is-open"),
                // project 让表格找到对应行按钮。
                project: state.project
            }
        }));
    }

    // 打开菜单并绑定当前表格项目。
    function open(project) {
        // 保存项目标识和名称供动作回调使用。
        state.project = project;
        // 打开前关闭可能残留的二级菜单。
        closeSubmenu();
        // 显示一级水晶菜单。
        root.classList.add("is-open");
        // 辅助技术读取到菜单已经可见。
        root.setAttribute("aria-hidden", "false");
        // 通知表格同步更多按钮。
        dispatchOpenChange();
    }

    // 关闭一级菜单并清理二级状态。
    function close() {
        // 关闭所有二级菜单。
        closeSubmenu();
        // 隐藏一级水晶菜单。
        root.classList.remove("is-open");
        // 辅助技术读取到菜单已经隐藏。
        root.setAttribute("aria-hidden", "true");
        // 清空项目绑定，防止关闭后误触发动作。
        state.project = null;
        // 通知表格同步更多按钮。
        dispatchOpenChange();
    }

    // 同一项目再次触发时关闭，不同项目触发时切换菜单归属。
    function toggle(project) {
        // 当前打开项目与目标一致时执行关闭。
        if (root.classList.contains("is-open") && state.project && state.project.projectId === project.projectId) {
            close();
            return;
        }
        // 其他情况打开并绑定新项目。
        open(project);
    }

    // 一级菜单使用事件委托响应真实按钮点击。
    root.addEventListener("click", (event) => {
        // 只处理菜单项目按钮。
        const button = event.target.closest("button[data-menu-id]");
        // 留白点击不触发业务动作。
        if (!button || button.disabled) {
            return;
        }
        // 根据按钮层级和标识找到人工配置。
        const item = findItem(button.dataset.menuId, button.dataset.menuLevel);
        // 配置缺失时安全终止。
        if (!item) {
            return;
        }
        // 有子项目的一级动作只负责打开二级菜单。
        if (button.dataset.menuLevel === "primary" && Array.isArray(item.children) && item.children.length > 0) {
            openSubmenu(item, button);
            return;
        }
        // 普通一级动作或二级目标向表格广播。
        dispatchAction(item, button.dataset.menuLevel);
    });

    // 鼠标移入带 children 的一级项目时展示二级菜单。
    root.addEventListener("pointerover", (event) => {
        // 只查找一级菜单按钮。
        const button = event.target.closest('button[data-menu-level="primary"]');
        // 非一级按钮不改变二级菜单。
        if (!button || button.disabled) {
            return;
        }
        // 读取对应一级配置。
        const item = findItem(button.dataset.menuId, "primary");
        // 有子项目时才展开。
        if (item && Array.isArray(item.children) && item.children.length > 0) {
            openSubmenu(item, button);
        }
    });

    // 键盘焦点进入带 children 的项目时同样展开二级菜单。
    root.addEventListener("focusin", (event) => {
        // 聚焦目标必须是一级按钮。
        const button = event.target.closest('button[data-menu-level="primary"]');
        // 非一级按钮不处理。
        if (!button || button.disabled) {
            return;
        }
        // 查找聚焦项目配置。
        const item = findItem(button.dataset.menuId, "primary");
        // 二级数据存在时展开。
        if (item && Array.isArray(item.children) && item.children.length > 0) {
            openSubmenu(item, button);
        }
    });

    // 指针按下时增加设计稿中的压下状态。
    root.addEventListener("pointerdown", (event) => {
        // 只高亮可用菜单按钮。
        const button = event.target.closest("button[data-menu-id]:not(:disabled)");
        // 找到按钮后添加短时按下类。
        if (button) {
            button.classList.add("is-pressed");
        }
    });

    // 指针释放后清理全部按下状态，避免拖出按钮后残留高亮。
    window.addEventListener("pointerup", () => {
        // 根菜单内所有按下项目恢复正常。
        root.querySelectorAll(".grid-menu__item.is-pressed").forEach((button) => button.classList.remove("is-pressed"));
    });

    // 点击菜单与表格更多按钮之外的区域时关闭浮层。
    document.addEventListener("click", (event) => {
        // 菜单未打开时无需处理。
        if (!root.classList.contains("is-open")) {
            return;
        }
        // 菜单内部点击保持打开。
        if (event.target.closest("#project-menu")) {
            return;
        }
        // 更多按钮自身由表格调用 toggle，不在此处重复关闭。
        if (event.target.closest('button[data-action="menu"]')) {
            return;
        }
        // 其他页面位置点击关闭完整菜单系统。
        close();
    });

    // Escape 优先关闭二级菜单，再次按下时关闭一级菜单。
    document.addEventListener("keydown", (event) => {
        // 非 Escape 或一级菜单未打开时不处理。
        if (event.key !== "Escape" || !root.classList.contains("is-open")) {
            return;
        }
        // 二级菜单打开时先收起二级层。
        if (state.activeSubmenuId) {
            closeSubmenu();
            return;
        }
        // 没有二级层时关闭一级菜单。
        close();
    });

    // 首次加载按文件头配置生成完整菜单结构。
    render();

    // 公开控制器供表格打开菜单和维护人员在运行时调整配置。
    window.gridMenu = Object.freeze({
        // open 用于表格主动打开指定项目菜单。
        open,
        // close 用于页面主动关闭菜单。
        close,
        // toggle 用于更多按钮在打开和关闭之间切换。
        toggle,
        // isOpen 返回当前一级菜单可见状态。
        isOpen: () => root.classList.contains("is-open"),
        // getProjectId 返回当前菜单绑定的项目主键。
        getProjectId: () => (state.project ? state.project.projectId : null),
        // setItems 接收人工菜单数组并立即重绘。
        setItems: (items) => {
            // 复制外部数组防止后续原地修改影响渲染中的状态。
            state.items = Array.isArray(items) ? [...items] : [];
            // 新配置应用后重绘一级菜单。
            render();
        },
        // setScrollAfter 接收人工阈值并立即更新滚动高度。
        setScrollAfter: (count) => {
            // 阈值始终收敛为至少一项的整数。
            state.scrollAfter = Math.max(1, Math.floor(Number(count) || 1));
            // 新阈值应用后重绘菜单。
            render();
        }
    });
})();
