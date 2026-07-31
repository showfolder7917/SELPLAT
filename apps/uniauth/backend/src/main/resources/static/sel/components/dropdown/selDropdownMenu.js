/*
 * selDropdownMenu.js：通用水晶选择下拉基础控件。
 * 负责从原生 select 构建可配置下拉、同步选中值、滚动阈值、互斥打开、点击外部关闭和完整键盘交互。
 * 责任边界：本文件只读取调用方已经写入原生 select 的标准选项，不请求接口、不读取 Uniauth 数据。
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
        // 找到当前原生值对应的选项索引。
        const selectedIndex = instance.options.findIndex((option) => option.value === instance.select.value);
        // 向下打开从当前选项开始，向上打开从最后一个可用选项开始。
        instance.activeIndex = focusMode === "last" ? instance.options.length - 1 : Math.max(0, selectedIndex);
        // 跳过禁用选项，确保键盘焦点始终落在可操作项目。
        while (instance.options[instance.activeIndex]?.disabled && instance.activeIndex > 0) {
            instance.activeIndex -= 1;
        }
        // 同步活动视觉后再移动焦点。
        selDropdownMenuRefresh(instance);
        // 当前活动按钮进入视口并接收键盘焦点。
        instance.optionButtons[instance.activeIndex]?.focus();
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
        // 新项目接收焦点并自动滚动到可见区域。
        instance.optionButtons[nextIndex].focus();
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
        // 菜单内部滚动用于访问超出阈值的项目，不应触发关闭。
        if (selDropdownMenuOpenInstance.root.contains(event.target)) {
            return;
        }
        // 页面或外部容器滚动时关闭浮层，避免空间错位。
        selDropdownMenuClose(selDropdownMenuOpenInstance, false);
    }, true);

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
        // 其他类型不是公开接口支持目标。
        return null;
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
