/*
 * selDropdownMenu.js：通用水晶选择下拉基础控件。
 * 负责从原生 select 构建可配置下拉、同步选中值、滚动阈值、互斥打开、点击外部关闭和完整键盘交互。
 * 责任边界：本文件只读取调用方已经写入原生 select 的标准选项，不请求接口、不读取 具体应用 数据。
 * 模块级 JavaScript 标识统一使用 selDropdownMenu 前缀，公开控制器为 window.selDropdownMenu。
 */
(function selDropdownMenuInitialize() {
    "use strict";

    // 实例映射允许宿主通过原生 select 或 id 调用公开接口。
    const selDropdownMenuInstancesBySelect = new Map();
    // 动态挂载序号用于生成不重复的 listbox id，不依赖页面业务实例名称。
    let selDropdownMenuMountSequence = 0;
    // 当前打开实例保持全局唯一，避免多个浮层互相覆盖。
    let selDropdownMenuOpenInstance = null;

    // 创建 Remix Icon 节点，所有图标使用项目既有图标系统。
    function selDropdownMenuCreateIcon(className, extraClass) {
        // i 元素仅承担视觉装饰，按钮文本表达完整业务语义。
        const icon = document.createElement("i");
        // 人工配置图标类和组件定位类合并写入。
        icon.className = `${className} ${extraClass}`.trim();
        // 装饰图标不参与辅助技术朗读。
        icon.setAttribute("aria-hidden", "true");
        // 返回可直接插入组件的图标节点。
        return icon;
    }

    // 把原生 option 转换成稳定的业务配置，保留值、显示文字、图标和禁用状态。
    function selDropdownMenuReadOptions(select) {
        // 原生选项顺序就是菜单人工维护顺序。
        return Array.from(select.options).map((option, index) => ({
            // 数组索引用于键盘定位和 DOM 标识。
            index,
            // value 继续作为宿主筛选和分页的真实业务值。
            value: option.value,
            // 关闭状态显示原生文字，保持与现有页面一致。
            label: option.textContent.trim(),
            // 展开菜单允许使用更明确的人工菜单名称。
            menuLabel: option.dataset.menuLabel || option.textContent.trim(),
            // 描述字段提供选择结果之外的辅助说明。
            description: option.dataset.description || "",
            // 图标字段直接映射 Remix Icon 类名。
            icon: option.dataset.icon || "ri-circle-line",
            // 主题字段为状态类选项提供语义色。
            tone: option.dataset.tone || "",
            // 原生禁用状态同步到自定义按钮。
            disabled: option.disabled
        }));
    }

    // 根据实例当前值找到对应选项配置，异常值安全回退到第一项。
    function selDropdownMenuGetSelectedOption(instance) {
        // 精确匹配原生 select 当前值。
        return instance.options.find((option) => option.value === instance.select.value) || instance.options[0];
    }

    // 同步关闭触发器文字、图标及菜单选中状态。
    function selDropdownMenuRefresh(instance) {
        // 当前选项决定触发器和 aria 选中状态。
        const selectedOption = selDropdownMenuGetSelectedOption(instance);
        // 触发器图标切换为当前选项图标。
        instance.triggerIcon.className = `${selectedOption.icon} seldropdown-trigger-icon`;
        // 触发器值保持现有页面的简短名称。
        instance.triggerValue.textContent = selectedOption.label;
        // 可访问名称使用业务 JSON 的完整本地化模板，禁止基础控件混入固定语言。
        instance.trigger.setAttribute("aria-label", instance.currentTemplate
            .replaceAll("{label}", instance.label)
            .replaceAll("{value}", selectedOption.label));
        // 全部选项同步 aria-selected、视觉类和可聚焦顺序。
        instance.optionButtons.forEach((button, index) => {
            // 当前选项通过值而非索引判断，支持宿主动态排序。
            const selected = instance.options[index].value === selectedOption.value;
            // listbox 语义使用 aria-selected 表达当前结果。
            button.setAttribute("aria-selected", String(selected));
            // 只有打开后被键盘导航的项目获得活动状态。
            button.classList.toggle("seldropdown-option-active", index === instance.activeIndex);
        });
    }

    // 关闭指定下拉，并可选择是否把焦点送回触发器。
    function selDropdownMenuClose(instance, restoreFocus) {
        // 已关闭实例不重复写入状态。
        if (!instance || instance.menu.hidden) {
            return;
        }
        // 隐藏水晶菜单浮层。
        instance.menu.hidden = true;
        // 根状态类同步关闭视觉。
        instance.root.classList.remove("seldropdown-root-open");
        // 触发器展开语义恢复 false。
        instance.trigger.setAttribute("aria-expanded", "false");
        // 当前全局打开实例被关闭时清空引用。
        if (selDropdownMenuOpenInstance === instance) {
            selDropdownMenuOpenInstance = null;
        }
        // 键盘 Escape 等动作需要把焦点稳定送回触发器。
        if (restoreFocus) {
            instance.trigger.focus();
        }
    }

    // 按所属面板或窗口的真实可见边界放置菜单，避免固定宽高在贴边控件上越出水晶容器。
    function selDropdownMenuPosition(instance) {
        // 每次测量前清除上一轮横向位移，保证窗口缩放后从触发器原点重新计算。
        instance.menu.style.setProperty("--seldropdown-menu-inline-offset", "0px");
        // 每次测量前恢复向下展开，后续再依据上下实际空间选择方向。
        instance.root.classList.remove("seldropdown-placement-top");
        // 窗口表单优先以窗口为边界，普通筛选控件以所属稳定面板为边界。
        const selDropdownBoundaryHost = instance.root.closest(".selwindow-window-shell, .selpanel-shell");
        // 边界宿主缺失时使用浏览器视口，保证基础控件独立挂载也不会越屏。
        const selDropdownBoundaryBounds = selDropdownBoundaryHost?.getBoundingClientRect();
        // 八像素安全边距让外发光不会被面板或视口硬切断。
        const selDropdownBoundaryLeft = Math.max(8, (selDropdownBoundaryBounds?.left || 0) + 8);
        // 右侧边界同时受宿主和浏览器视口约束，避免横向滚动区域把菜单带出当前窗口。
        const selDropdownBoundaryRight = Math.min(window.innerWidth - 8, (selDropdownBoundaryBounds?.right || window.innerWidth) - 8);
        // 上侧边界同样保留发光安全区。
        const selDropdownBoundaryTop = Math.max(8, (selDropdownBoundaryBounds?.top || 0) + 8);
        // 下侧边界取宿主与浏览器视口更靠上的位置。
        const selDropdownBoundaryBottom = Math.min(window.innerHeight - 8, (selDropdownBoundaryBounds?.bottom || window.innerHeight) - 8);
        // 触发器位置用于计算上下两侧真实剩余空间。
        const selDropdownTriggerBounds = instance.trigger.getBoundingClientRect();
        // 未位移的菜单尺寸用于横向和纵向决策。
        let selDropdownMenuBounds = instance.menu.getBoundingClientRect();
        // 触发器下方空间扣除七像素视觉间隔。
        const selDropdownSpaceBelow = selDropdownBoundaryBottom - selDropdownTriggerBounds.bottom - 7;
        // 触发器上方空间扣除相同视觉间隔。
        const selDropdownSpaceAbove = selDropdownTriggerBounds.top - selDropdownBoundaryTop - 7;
        // 下方放不下完整菜单且上方更宽裕时翻转到触发器上方。
        const selDropdownUseTop = selDropdownSpaceBelow < selDropdownMenuBounds.height && selDropdownSpaceAbove > selDropdownSpaceBelow;
        // 展开方向状态只由当前实测空间决定。
        instance.root.classList.toggle("seldropdown-placement-top", selDropdownUseTop);
        // 可用高度至少保留标题和一个选项，更多选项交给内部滚动区访问。
        instance.menu.style.setProperty("--seldropdown-menu-available-height", `${Math.max(118, selDropdownUseTop ? selDropdownSpaceAbove : selDropdownSpaceBelow)}px`);
        // 高度约束生效后重新读取菜单边界，避免用旧尺寸计算横向偏移。
        selDropdownMenuBounds = instance.menu.getBoundingClientRect();
        // 默认不偏移，只有实际越界时才沿横轴回收。
        let selDropdownInlineOffset = 0;
        // 右侧越界时把菜单向左移动到安全边界内。
        if (selDropdownMenuBounds.right > selDropdownBoundaryRight) selDropdownInlineOffset += selDropdownBoundaryRight - selDropdownMenuBounds.right;
        // 应用右侧修正后仍可能在窄容器越过左侧，因此继续补偿左边界。
        if (selDropdownMenuBounds.left + selDropdownInlineOffset < selDropdownBoundaryLeft) selDropdownInlineOffset += selDropdownBoundaryLeft - (selDropdownMenuBounds.left + selDropdownInlineOffset);
        // 最终偏移通过组件变量写回，不改变触发器自身布局。
        instance.menu.style.setProperty("--seldropdown-menu-inline-offset", `${selDropdownInlineOffset}px`);
    }

    // 聚焦菜单选项时只滚动组件自己的视口，禁止 scrollIntoView 连带滚动外层设置面板。
    function selDropdownMenuFocusOption(instance, optionIndex) {
        // 越界或缺少按钮时不改变当前焦点。
        const button = instance.optionButtons[optionIndex];
        if (!button) return;
        // preventScroll 保证浏览器不会为了焦点自行移动任何祖先滚动容器。
        button.focus({ preventScroll: true });
        // offsetTop 以选项列表为基准，与菜单视口 scrollTop 处于同一纵向坐标系。
        const optionTop = button.offsetTop;
        const optionBottom = optionTop + button.offsetHeight;
        const viewportTop = instance.viewport.scrollTop;
        const viewportBottom = viewportTop + instance.viewport.clientHeight;
        // 只有选项超出菜单自身可视范围时才调整内部 scrollTop。
        if (optionTop < viewportTop) instance.viewport.scrollTop = optionTop;
        if (optionBottom > viewportBottom) instance.viewport.scrollTop = optionBottom - instance.viewport.clientHeight;
    }

    // 打开指定下拉并聚焦当前或指定方向的可用选项。
    function selDropdownMenuOpen(instance, focusMode) {
        // 先关闭其他实例，保证页面只出现一个下拉浮层。
        if (selDropdownMenuOpenInstance && selDropdownMenuOpenInstance !== instance) {
            selDropdownMenuClose(selDropdownMenuOpenInstance, false);
        }
        // 显示当前水晶菜单。
        instance.menu.hidden = false;
        // 根状态类激活触发器和层级。
        instance.root.classList.add("seldropdown-root-open");
        // 触发器展开语义切换为 true。
        instance.trigger.setAttribute("aria-expanded", "true");
        // 保存全局打开实例供点击外部和滚动关闭。
        selDropdownMenuOpenInstance = instance;
        // 菜单可见后按当前面板、窗口和视口边界完成上下翻转与横向回收。
        selDropdownMenuPosition(instance);
        // 找到当前原生值对应的选项索引。
        const selectedIndex = instance.options.findIndex((option) => option.value === instance.select.value);
        // 向下打开从当前选项开始，向上打开从最后一个可用选项开始。
        instance.activeIndex = focusMode === "last" ? instance.options.length - 1 : Math.max(0, selectedIndex);
        // 当前值是禁用占位项时，向下展开改取第一个可用业务选项，向上展开改取最后一个可用业务选项。
        if (instance.options[instance.activeIndex]?.disabled) {
            // 正向查找用于 ArrowDown 和鼠标展开，反向查找用于 ArrowUp 展开。
            const enabledIndexes = instance.options
                // 保留每个可用选项在原始业务数组中的真实索引。
                .map((option, index) => ({ option, index }))
                // 禁用占位项不得成为键盘焦点或确认目标。
                .filter(({ option }) => !option.disabled)
                // 后续只需要索引来同步活动态和焦点。
                .map(({ index }) => index);
            // 没有可用选项时使用 -1 表示菜单只能浏览、不能确认选择。
            instance.activeIndex = enabledIndexes.length === 0
                // 空菜单不把焦点强行送入禁用按钮。
                ? -1
                // ArrowUp 取末项，其余展开方式取首项。
                : (focusMode === "last" ? enabledIndexes[enabledIndexes.length - 1] : enabledIndexes[0]);
        }
        // 同步活动视觉后再移动焦点。
        selDropdownMenuRefresh(instance);
        // 仅在存在可用活动项时把焦点送入列表，避免禁用占位项让键盘停留在触发器。
        if (instance.activeIndex >= 0) {
            // 阻止聚焦动作滚动设置面板等外层容器，否则外部滚动关闭契约会把刚展开的菜单立即关闭。
            selDropdownMenuFocusOption(instance, instance.activeIndex);
        }
    }

    // 选择一个可用选项，同时更新原生 select 并触发现有宿主 change 逻辑。
    function selDropdownMenuSelectOption(instance, optionIndex, emitChange) {
        // 索引越界或选项禁用时不改变业务值。
        if (!instance.options[optionIndex] || instance.options[optionIndex].disabled) {
            return;
        }
        // 保存目标选项用于值和事件详情。
        const option = instance.options[optionIndex];
        // 原生 select 是表格筛选和分页的唯一真实数据源。
        instance.select.value = option.value;
        // 活动索引同步最新选择。
        instance.activeIndex = optionIndex;
        // 立即刷新触发器和菜单选中状态。
        selDropdownMenuRefresh(instance);
        // 用户选择时广播原生 change，现有业务逻辑无需依赖组件内部结构。
        if (emitChange) {
            instance.select.dispatchEvent(new Event("change", { bubbles: true }));
            // 组件事件为未来非 select 宿主提供稳定扩展入口。
            instance.root.dispatchEvent(new CustomEvent("selDropdownMenu:change", {
                // 事件向上冒泡，页面可在 document 统一监听。
                bubbles: true,
                // 事件详情包含组件 id、业务值和显示名称。
                detail: { id: instance.select.id, value: option.value, label: option.label }
            }));
        }
        // 选择完成后关闭浮层并恢复触发器焦点。
        selDropdownMenuClose(instance, true);
    }

    // 在键盘方向上寻找下一个可用选项，并保持循环导航。
    function selDropdownMenuMoveActive(instance, direction) {
        // 从当前活动项开始移动。
        let nextIndex = instance.activeIndex;
        // 最多检查全部项目一次，避免全部禁用时无限循环。
        for (let checked = 0; checked < instance.options.length; checked += 1) {
            // 通过取模实现首尾循环。
            nextIndex = (nextIndex + direction + instance.options.length) % instance.options.length;
            // 命中可用项目后立即停止。
            if (!instance.options[nextIndex].disabled) {
                break;
            }
        }
        // 保存新的键盘活动索引。
        instance.activeIndex = nextIndex;
        // 更新活动光带视觉。
        selDropdownMenuRefresh(instance);
        // 焦点不滚动外层面板，选项可见性只由菜单内部滚动承担。
        selDropdownMenuFocusOption(instance, nextIndex);
    }

    // 为单个根节点创建完整触发器、菜单和交互实例。
    function selDropdownMenuBuild(root, rootIndex) {
        // 每个组件必须包含一个原生 select 作为业务数据源。
        const select = root.querySelector("select");
        // 缺少 select 时跳过错误宿主，避免阻断页面其他组件。
        if (!select) {
            return null;
        }
        // 原生选择器完全隐藏但继续保留业务值和 change 事件契约。
        select.hidden = true;
        // 读取组件业务配置。
        const label = root.dataset.selDropdownMenuLabel || select.getAttribute("aria-label") || "下拉菜单";
        // 当前值句式由业务 JSON 完整提供，默认模板只作为非国际化调用方的安全回退。
        const currentTemplate = root.dataset.selDropdownMenuCurrentTemplate || "{label}：{value}";
        // 展开菜单标题同样使用完整本地化结果，避免基础控件推测语言语序。
        const menuTitle = root.dataset.selDropdownMenuTitle || label;
        // 前缀只用于工具栏“类型：”“状态：”等复合文案。
        const prefix = root.dataset.selDropdownMenuPrefix || "";
        // 滚动阈值至少为一项，非法配置回退到六项。
        const scrollAfter = Math.max(1, Number(root.dataset.selDropdownMenuScrollAfter) || 6);
        // 原生选项转换成组件配置。
        const options = selDropdownMenuReadOptions(select);
        // 菜单 id 通过原生 id 和页面序号保证唯一。
        const menuId = `${select.id || `seldropdown-${rootIndex}`}-menu`;

        // 触发器使用原生按钮保证鼠标和键盘可用。
        const trigger = document.createElement("button");
        // 统一触发器视觉类。
        trigger.className = "seldropdown-trigger";
        // 按钮不提交外部表单。
        trigger.type = "button";
        // combobox 角色表达“当前值 + 可展开列表”。
        trigger.setAttribute("role", "combobox");
        // 触发器控制对应 listbox。
        trigger.setAttribute("aria-controls", menuId);
        // 当前版本使用列表框弹层。
        trigger.setAttribute("aria-haspopup", "listbox");
        // 初始状态为关闭。
        trigger.setAttribute("aria-expanded", "false");
        // 当前图标节点由刷新函数写入实际图标类。
        const triggerIcon = selDropdownMenuCreateIcon("ri-circle-line", "seldropdown-trigger-icon");
        // 文案容器组合固定前缀和动态值。
        const triggerCopy = document.createElement("span");
        // 文案布局类负责截断。
        triggerCopy.className = "seldropdown-trigger-copy";
        // 前缀节点显示字段名称。
        const triggerPrefix = document.createElement("span");
        // 前缀类提供中性色。
        triggerPrefix.className = "seldropdown-trigger-prefix";
        // 前缀来自人工配置。
        triggerPrefix.textContent = prefix;
        // 当前值节点由刷新函数同步。
        const triggerValue = document.createElement("span");
        // 值类提供高亮和省略。
        triggerValue.className = "seldropdown-trigger-value";
        // 前缀和当前值依次加入文案容器。
        triggerCopy.append(triggerPrefix, triggerValue);
        // 右侧箭头使用真实图标库。
        const chevron = selDropdownMenuCreateIcon("ri-arrow-down-s-line", "seldropdown-trigger-chevron");
        // 触发器三列依次加入。
        trigger.append(triggerIcon, triggerCopy, chevron);

        // 水晶菜单浮层承载标题和可滚动选项。
        const menu = document.createElement("div");
        // 菜单类负责图片边框和上下定位。
        menu.className = "seldropdown-menu";
        // 唯一 id 与触发器 aria-controls 对应。
        menu.id = menuId;
        // listbox 语义由浮层承担。
        menu.setAttribute("role", "listbox");
        // 可访问名称使用人工字段名称。
        menu.setAttribute("aria-label", label);
        // 初始隐藏避免页面加载时闪现。
        menu.hidden = true;
        // 人工滚动阈值写入 CSS 变量。
        menu.style.setProperty("--seldropdown-visible-items", String(scrollAfter));
        // 小标题让展开菜单明确当前选择对象。
        const heading = document.createElement("div");
        // 标题栏使用独立视觉类。
        heading.className = "seldropdown-menu-heading";
        // JSON 提供的完整标题和 ESC 提示共同加入标题栏。
        heading.append(document.createTextNode(menuTitle));
        // 键盘提示使用语义 kbd 元素。
        const keyboardHint = document.createElement("kbd");
        // 明确退出快捷键。
        keyboardHint.textContent = "ESC";
        // 提示加入标题右侧。
        heading.appendChild(keyboardHint);
        // 视口根据人工阈值决定是否滚动。
        const viewport = document.createElement("div");
        // 统一滚动容器类。
        viewport.className = "seldropdown-menu-viewport";
        // 选项列表保持人工顺序。
        const list = document.createElement("div");
        // 列表网格类负责纵向排列。
        list.className = "seldropdown-option-list";

        // 每个原生选项转换成真实按钮。
        const optionButtons = options.map((option) => {
            // 原生按钮保证每个选项都有键盘和点击能力。
            const button = document.createElement("button");
            // 统一选项视觉类。
            button.className = "seldropdown-option";
            // 按钮不参与外部表单提交。
            button.type = "button";
            // option 角色与父级 listbox 配套。
            button.setAttribute("role", "option");
            // 初始选中状态由刷新函数统一写入。
            button.setAttribute("aria-selected", "false");
            // 选项索引用于事件委托和键盘选择。
            button.dataset.optionIndex = String(option.index);
            // 主题字段只来自可信人工配置。
            if (option.tone) {
                button.dataset.tone = option.tone;
            }
            // 原生禁用状态同步到按钮。
            button.disabled = option.disabled;
            // 左侧图标使用人工配置的真实图标库类。
            button.appendChild(selDropdownMenuCreateIcon(option.icon, "seldropdown-option-icon"));
            // 双行文案容器保持主次信息层级。
            const copy = document.createElement("span");
            // 文案容器类负责截断。
            copy.className = "seldropdown-option-copy";
            // 主名称节点展示明确菜单文字。
            const optionLabel = document.createElement("span");
            // 主名称视觉类提供稳定字重。
            optionLabel.className = "seldropdown-option-label";
            // textContent 防止人工配置被解释为 HTML。
            optionLabel.textContent = option.menuLabel;
            // 辅助说明节点解释选项业务含义。
            const description = document.createElement("span");
            // 说明类使用弱层级文字。
            description.className = "seldropdown-option-description";
            // 描述内容来自 option data 属性。
            description.textContent = option.description;
            // 两行文字加入文案容器。
            copy.append(optionLabel, description);
            // 文案加入选项中列。
            button.appendChild(copy);
            // 右侧勾选图标只在当前项目显示。
            button.appendChild(selDropdownMenuCreateIcon("ri-check-line", "seldropdown-option-check"));
            // 完成的选项加入列表。
            list.appendChild(button);
            // 返回按钮供实例缓存。
            return button;
        });
        // 列表加入可滚动视口。
        viewport.appendChild(list);
        // 标题和视口加入水晶浮层。
        menu.append(heading, viewport);
        // 触发器和浮层加入组件根，原生 select 继续保留。
        root.append(trigger, menu);
        // 超过阈值时开启内部滚动。
        root.classList.toggle("seldropdown-root-scrollable", options.length > scrollAfter);

        // 实例集中保存 DOM、配置和交互状态。
        const instance = {
            root,
            select,
            label,
            currentTemplate,
            options,
            trigger,
            triggerIcon,
            triggerValue,
            menu,
            viewport,
            optionButtons,
            activeIndex: Math.max(0, select.selectedIndex)
        };

        // 触发器点击在打开和关闭之间切换。
        trigger.addEventListener("click", () => {
            // 已打开时关闭并保留触发器焦点。
            if (!menu.hidden) {
                selDropdownMenuClose(instance, true);
                return;
            }
            // 关闭状态点击后打开当前选项。
            selDropdownMenuOpen(instance, "selected");
        });

        // 触发器键盘支持上下方向直接展开。
        trigger.addEventListener("keydown", (event) => {
            // 向下键打开并聚焦当前选项。
            if (event.key === "ArrowDown") {
                event.preventDefault();
                selDropdownMenuOpen(instance, "selected");
            }
            // 向上键打开并聚焦最后一个可用选项。
            if (event.key === "ArrowUp") {
                event.preventDefault();
                selDropdownMenuOpen(instance, "last");
            }
            // Escape 在意外保持打开时安全关闭。
            if (event.key === "Escape") {
                // 当前控件先消费退出键，避免外层业务窗口同时收到 Escape 后被关闭。
                event.preventDefault();
                event.stopPropagation();
                selDropdownMenuClose(instance, true);
            }
        });

        // 列表点击通过最近选项按钮完成选择。
        list.addEventListener("click", (event) => {
            // 只处理带选项索引的真实按钮。
            const button = event.target.closest("[data-option-index]");
            // 点击列表间隙时不改变选择。
            if (!button) {
                return;
            }
            // 数字索引交给统一选择入口。
            selDropdownMenuSelectOption(instance, Number(button.dataset.optionIndex), true);
        });

        // 列表键盘处理方向、首尾、确认、退出和 Tab 关闭。
        list.addEventListener("keydown", (event) => {
            // 向下移动到下一个可用项目。
            if (event.key === "ArrowDown") {
                event.preventDefault();
                selDropdownMenuMoveActive(instance, 1);
                return;
            }
            // 向上移动到上一个可用项目。
            if (event.key === "ArrowUp") {
                event.preventDefault();
                selDropdownMenuMoveActive(instance, -1);
                return;
            }
            // Home 聚焦第一个可用项目。
            if (event.key === "Home") {
                event.preventDefault();
                instance.activeIndex = -1;
                selDropdownMenuMoveActive(instance, 1);
                return;
            }
            // End 聚焦最后一个可用项目。
            if (event.key === "End") {
                event.preventDefault();
                instance.activeIndex = 0;
                selDropdownMenuMoveActive(instance, -1);
                return;
            }
            // Enter 或空格选择当前活动项目。
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selDropdownMenuSelectOption(instance, instance.activeIndex, true);
                return;
            }
            // Escape 关闭并回到触发器。
            if (event.key === "Escape") {
                event.preventDefault();
                // 下拉浮层关闭后终止冒泡，外层 Window 保持打开并继续承载当前表单。
                event.stopPropagation();
                selDropdownMenuClose(instance, true);
                return;
            }
            // Tab 离开组件时关闭菜单，但保留浏览器默认焦点顺序。
            if (event.key === "Tab") {
                selDropdownMenuClose(instance, false);
            }
        });

        // 鼠标或键盘聚焦某项时同步活动光带索引。
        optionButtons.forEach((button, index) => {
            // focus 事件覆盖鼠标点击前和键盘进入两种路径。
            button.addEventListener("focus", () => {
                // 保存当前活动项目。
                instance.activeIndex = index;
                // 同步活动视觉。
                selDropdownMenuRefresh(instance);
            });
        });

        // 外部直接改变原生 select 时刷新自定义组件。
        select.addEventListener("change", () => {
            // 宿主状态变化后同步当前图标、文字和勾选。
            selDropdownMenuRefresh(instance);
        });

        // 初次渲染当前原生选中状态。
        selDropdownMenuRefresh(instance);
        // 返回完整实例供公开 API 和页面级事件使用。
        return instance;
    }

    // 显式挂载一个选择下拉，应用装配层必须先把标准 option 写入原生 select。
    function selDropdownMenuMount(root) {
        // 非元素宿主无法创建下拉组件。
        if (!(root instanceof Element)) {
            return null;
        }
        // 当前根内的原生 select 是业务值唯一来源。
        const select = root.querySelector("select");
        // 缺少原生 select 时提示调用方基础结构不完整。
        if (!(select instanceof HTMLSelectElement)) {
            console.warn("selDropdownMenu.mount：缺少原生 select，无法挂载选择下拉基础控件。", root);
            return null;
        }
        // 已经挂载的原生 select 直接复用控制器，防止重复创建浮层。
        if (selDropdownMenuInstancesBySelect.has(select)) {
            return selDropdownMenuInstancesBySelect.get(select);
        }
        // 每次新挂载使用递增序号生成独立的可访问关联 id。
        const instance = selDropdownMenuBuild(root, selDropdownMenuMountSequence);
        // 序号只在真实构建后递增。
        selDropdownMenuMountSequence += 1;
        // 有效实例才进入映射。
        if (instance) {
            selDropdownMenuInstancesBySelect.set(instance.select, instance);
        }
        // 返回控制器供应用装配层检查结果。
        return instance;
    }

    // 点击组件外部时关闭当前浮层。
    document.addEventListener("pointerdown", (event) => {
        // 没有打开实例时无需处理。
        if (!selDropdownMenuOpenInstance) {
            return;
        }
        // 点击仍位于当前组件内部时保留菜单。
        if (selDropdownMenuOpenInstance.root.contains(event.target)) {
            return;
        }
        // 外部点击关闭菜单但不抢夺当前焦点。
        selDropdownMenuClose(selDropdownMenuOpenInstance, false);
    });

    // 页面滚动时关闭浮层，避免菜单与触发器产生空间错位。
    window.addEventListener("scroll", (event) => {
        // 没有打开实例时无需处理。
        if (!selDropdownMenuOpenInstance) {
            return;
        }
        // 菜单内部滚动以及承载当前控件的祖先容器滚动都会同步移动根和浮层，不应触发关闭。
        const selDropdownScrollTarget = event.target;
        if (selDropdownMenuOpenInstance.root.contains(selDropdownScrollTarget)
            || (selDropdownScrollTarget instanceof Node && selDropdownScrollTarget.contains(selDropdownMenuOpenInstance.root))) {
            return;
        }
        // 页面或外部容器滚动时关闭浮层，避免空间错位。
        selDropdownMenuClose(selDropdownMenuOpenInstance, false);
    }, true);

    // 浏览器尺寸变化时重新放置仍打开的菜单，避免旧坐标在新视口中形成越界。
    window.addEventListener("resize", () => {
        // 只有打开实例需要即时重算边界。
        if (selDropdownMenuOpenInstance) selDropdownMenuPosition(selDropdownMenuOpenInstance);
    });

    // 根据原生节点或 id 解析组件实例。
    function selDropdownMenuResolveInstance(target) {
        // 直接传入原生 select 时从映射读取。
        if (target instanceof HTMLSelectElement) {
            return selDropdownMenuInstancesBySelect.get(target) || null;
        }
        // 字符串按原生 select id 查找。
        if (typeof target === "string") {
            // 查询结果可能不存在，映射安全返回空值。
            return selDropdownMenuInstancesBySelect.get(document.getElementById(target)) || null;
        }
        // 组件根允许应用在面板原位更新后直接刷新同一实例。
        if (target instanceof Element) {
            const selDropdownSelect = target.matches("select") ? target : target.querySelector("select");
            return selDropdownMenuInstancesBySelect.get(selDropdownSelect) || null;
        }
        // 其他类型不是公开接口支持目标。
        return null;
    }

    // 原生 select 已由面板写入新语言选项后，原位刷新自定义浮层并保留真实业务值。
    function selDropdownMenuSetLocale(target) {
        const instance = selDropdownMenuResolveInstance(target);
        if (!instance) return false;
        const options = selDropdownMenuReadOptions(instance.select);
        const list = instance.menu.querySelector(".seldropdown-option-list");
        const heading = instance.menu.querySelector(".seldropdown-menu-heading");
        if (!list || !heading) return false;
        instance.label = instance.root.dataset.selDropdownMenuLabel || instance.select.getAttribute("aria-label") || "下拉菜单";
        instance.currentTemplate = instance.root.dataset.selDropdownMenuCurrentTemplate || "{label}：{value}";
        instance.options = options;
        instance.trigger.querySelector(".seldropdown-trigger-prefix").textContent = instance.root.dataset.selDropdownMenuPrefix || "";
        instance.menu.setAttribute("aria-label", instance.label);
        heading.firstChild.nodeValue = instance.root.dataset.selDropdownMenuTitle || instance.label;
        const buttons = options.map((option, optionIndex) => {
            const button = document.createElement("button");
            button.className = "seldropdown-option";
            button.type = "button";
            button.setAttribute("role", "option");
            button.setAttribute("aria-selected", "false");
            button.dataset.optionIndex = String(option.index);
            if (option.tone) button.dataset.tone = option.tone;
            button.disabled = option.disabled;
            button.appendChild(selDropdownMenuCreateIcon(option.icon, "seldropdown-option-icon"));
            const copy = document.createElement("span");
            copy.className = "seldropdown-option-copy";
            const label = document.createElement("span");
            label.className = "seldropdown-option-label";
            label.textContent = option.menuLabel;
            const description = document.createElement("span");
            description.className = "seldropdown-option-description";
            description.textContent = option.description;
            copy.append(label, description);
            button.append(copy, selDropdownMenuCreateIcon("ri-check-line", "seldropdown-option-check"));
            button.addEventListener("focus", () => {
                instance.activeIndex = optionIndex;
                selDropdownMenuRefresh(instance);
            });
            return button;
        });
        list.replaceChildren(...buttons);
        instance.optionButtons = buttons;
        instance.activeIndex = Math.max(0, instance.select.selectedIndex);
        instance.root.classList.toggle("seldropdown-root-scrollable", options.length > Math.max(1, Number(instance.root.dataset.selDropdownMenuScrollAfter) || 6));
        selDropdownMenuRefresh(instance);
        return true;
    }

    // 公开最小控制器，宿主可以同步外部状态但不依赖组件内部 DOM。
    window.selDropdownMenu = Object.freeze({
        // mount 显式挂载一个已经拥有原生 select 和业务选项的下拉宿主。
        mount: selDropdownMenuMount,
        // mountAll 只扫描调用方给出的作用域，不跨业务模块初始化其他页面节点。
        mountAll(scope) {
            // 缺少有效作用域时不退回 document，避免基础控件擅自控制整页。
            if (!(scope instanceof Element)) {
                return Object.freeze([]);
            }
            // 当前作用域自身和后代都可以作为下拉根。
            const roots = [
                ...(scope.matches("[data-sel-dropdown-menu]") ? [scope] : []),
                ...scope.querySelectorAll("[data-sel-dropdown-menu]")
            ];
            // 逐个挂载并过滤掉结构不完整的宿主。
            return Object.freeze(roots.map(selDropdownMenuMount).filter(Boolean));
        },
        // 人工设置业务值，可选是否触发现有 change 逻辑。
        setValue(target, value, emitChange = false) {
            // 解析目标组件实例。
            const instance = selDropdownMenuResolveInstance(target);
            // 目标不存在或值不在人工选项中时安全返回 false。
            if (!instance || !instance.options.some((option) => option.value === String(value))) {
                return false;
            }
            // 写入原生 select 真实值。
            instance.select.value = String(value);
            // 刷新触发器和选项状态。
            selDropdownMenuRefresh(instance);
            // 宿主明确要求时广播原生 change。
            if (emitChange) {
                instance.select.dispatchEvent(new Event("change", { bubbles: true }));
            }
            // true 表示值已成功同步。
            return true;
        },
        // setLocale 在面板更新原生选项后刷新同一自定义下拉实例。
        setLocale: selDropdownMenuSetLocale,
        // 打开指定下拉。
        open(target) {
            // 解析目标组件实例。
            const instance = selDropdownMenuResolveInstance(target);
            // 有效实例才执行打开。
            if (instance) {
                selDropdownMenuOpen(instance, "selected");
            }
        },
        // 关闭当前或指定下拉。
        close(target) {
            // 未传目标时关闭当前全局实例。
            const instance = target ? selDropdownMenuResolveInstance(target) : selDropdownMenuOpenInstance;
            // 有效实例才执行关闭。
            if (instance) {
                selDropdownMenuClose(instance, false);
            }
        },
        // 刷新宿主直接修改后的原生选择器状态。
        refresh(target) {
            // 解析目标组件实例。
            const instance = selDropdownMenuResolveInstance(target);
            // 有效实例才执行视觉同步。
            if (instance) {
                selDropdownMenuRefresh(instance);
            }
        }
    });
})();
