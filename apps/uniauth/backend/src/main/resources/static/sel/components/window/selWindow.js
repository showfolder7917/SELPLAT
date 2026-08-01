/*
 * selWindow.js：可复用水晶业务表单窗口基础控件。
 * 责任边界：基础控件根据标准 rows 配置创建表单、校验、打开与关闭；应用只声明字段和消费提交事件。
 * 命名前缀：模块级标识使用 selWindow，样式使用 selwindow-*；控件不识别 Uniauth 实体或接口地址。
 */
(function selWindowInitializeRegistry() {
    "use strict";

    // 控制器注册表用稳定窗口键隔离多实例状态。
    const selWindowInstances = new Map();

    // 窗口层级计数器让最近操作的实例始终位于其他窗口上方。
    let selWindowTopLayer = 1200;
    // 全局最小化停靠区由基础组件统一维护，业务应用无需创建窗口任务栏 DOM。
    let selWindowMinimizedRail = null;

    // 视口安全间距保证拖动、缩放和最大化后仍能触达完整水晶边框。
    const selWindowViewportGap = 12;
    // 最小宽度允许表单进入紧凑布局，同时保留标签和控件的可用空间。
    const selWindowMinimumWidth = 720;
    // 最小高度让标题栏和固定操作区始终可见，字段区不足时改为内部滚动。
    const selWindowMinimumHeight = 560;
    // 默认宽度比旧版更紧凑，并与首页主面板的信息密度保持一致。
    const selWindowDefaultWidth = 1040;
    // 默认高度在常见桌面视口内完整展示表单而不制造大面积空洞。
    const selWindowDefaultHeight = 740;

    /**
     * 获取或创建窗口最小化停靠区。
     * @returns {HTMLElement} 页面级窗口停靠区。
     */
    function selWindowGetMinimizedRail() {
        // 已创建时直接复用同一停靠区，避免多实例各自生成重复任务栏。
        if (selWindowMinimizedRail) return selWindowMinimizedRail;
        // 原生 aside 说明这里是辅助性的窗口恢复区域。
        selWindowMinimizedRail = document.createElement("aside");
        // 稳定类名让基础样式独立控制停靠区，不泄漏应用业务名称。
        selWindowMinimizedRail.className = "selwindow-minimized-rail";
        // 可访问名称帮助键盘和读屏用户理解按钮用途。
        selWindowMinimizedRail.setAttribute("aria-label", "已最小化窗口");
        // 没有最小化窗口时停靠区完全退出布局。
        selWindowMinimizedRail.hidden = true;
        // 停靠区属于窗口基础能力，因此直接进入页面 body。
        document.body.appendChild(selWindowMinimizedRail);
        // 返回唯一停靠区供当前和后续实例使用。
        return selWindowMinimizedRail;
    }

    /**
     * 根据可见恢复按钮同步停靠区显示状态。
     */
    function selWindowSyncMinimizedRail() {
        // 未创建停靠区时无需执行 DOM 查询。
        if (!selWindowMinimizedRail) return;
        // 任一实例按钮可见时保留停靠区，否则隐藏整个恢复区域。
        selWindowMinimizedRail.hidden = !selWindowMinimizedRail.querySelector(".selwindow-minimized-button:not([hidden])");
    }

    /**
     * 创建带组件命名空间的安全原生节点。
     * @param {string} selWindowTag - 原生标签，例如 button、label 或 input。
     * @param {string} selWindowClassName - selwindow 命名空间类名。
     * @param {string} selWindowText - 可选显示文本，例如“新建项目”。
     * @returns {HTMLElement} 已设置类名和安全文本的节点。
     */
    function selWindowCreateElement(selWindowTag, selWindowClassName, selWindowText = "") {
        // 原生节点保留表单和按钮的浏览器语义。
        const selWindowElement = document.createElement(selWindowTag);
        // 样式名始终来自 selwindow 组件命名空间。
        if (selWindowClassName) selWindowElement.className = selWindowClassName;
        // 业务文本通过 textContent 写入，禁止配置注入任意 HTML。
        if (selWindowText) selWindowElement.textContent = String(selWindowText);
        // 返回节点给当前窗口装配流程。
        return selWindowElement;
    }

    /**
     * 创建一个 Remix Icon 节点。
     * @param {string} selWindowIconName - 图标库类名，例如 ri-file-text-line。
     * @returns {HTMLElement} 对辅助技术隐藏的装饰图标。
     */
    function selWindowCreateIcon(selWindowIconName) {
        // 图标库提供真实矢量图标，不使用文本字符或 CSS 图形冒充。
        const selWindowIcon = selWindowCreateElement("i", String(selWindowIconName || "ri-shapes-line"));
        // 相邻标签已经表达业务含义，因此图标不重复播报。
        selWindowIcon.setAttribute("aria-hidden", "true");
        // 返回图标供标题和字段复用。
        return selWindowIcon;
    }

    /**
     * 创建字段标签。
     * @param {object} selWindowField - 应用声明的字段名称、标签和必填状态。
     * @returns {HTMLLabelElement} 与真实输入关联的可访问标签。
     */
    function selWindowCreateLabel(selWindowField) {
        // label 让点击业务名称时焦点进入对应输入控件。
        const selWindowLabel = selWindowCreateElement("label", `selwindow-field-label${selWindowField.required ? "" : " selwindow-field-label-optional"}`, selWindowField.label);
        // htmlFor 使用窗口内唯一输入键建立稳定关联。
        selWindowLabel.htmlFor = selWindowField.inputId;
        // 返回完整字段标签。
        return selWindowLabel;
    }

    /**
     * 把标准 options 配置写入原生 select。
     * @param {HTMLSelectElement} selWindowSelect - 当前字段的真实值来源。
     * @param {Array<object>} selWindowOptions - value、label、icon、tone 等标准选项。
     */
    function selWindowFillSelect(selWindowSelect, selWindowOptions) {
        // 每个 option 同时承载业务值和自定义下拉所需的视觉元数据。
        (selWindowOptions || []).forEach((selWindowOptionData) => {
            // 原生 option 是选择值的唯一来源。
            const selWindowOption = selWindowCreateElement("option", "", selWindowOptionData.label);
            // 稳定 value 提交给应用业务事件。
            selWindowOption.value = String(selWindowOptionData.value || "");
            // 图标数据由通用下拉公开契约读取。
            selWindowOption.dataset.icon = String(selWindowOptionData.icon || "ri-circle-line");
            // 菜单标签保持与业务字段显示一致。
            selWindowOption.dataset.menuLabel = String(selWindowOptionData.menuLabel || selWindowOptionData.label || "");
            // 可选色调让优先级和状态保持设计语义。
            if (selWindowOptionData.tone) selWindowOption.dataset.tone = String(selWindowOptionData.tone);
            // 禁用状态仍由原生 select 契约负责。
            selWindowOption.disabled = Boolean(selWindowOptionData.disabled);
            // 默认项决定首次打开时的真实值。
            selWindowOption.selected = Boolean(selWindowOptionData.selected);
            // 把选项加入真实选择器。
            selWindowSelect.appendChild(selWindowOption);
        });
    }

    /**
     * 创建字段控件并保留真实表单值。
     * @param {object} selWindowField - 标准字段配置。
     * @returns {HTMLElement} 文本、日期、文本域或自定义选择下拉宿主。
     */
    function selWindowCreateControl(selWindowField) {
        // 选择字段组合原生 select 与公开 seldropdown 基础控件。
        if (selWindowField.type === "select") {
            // Window 与首页工具栏声明同一个通用下拉宿主，禁止维护窗口专属皮肤或内部 DOM。
            const selWindowDropdown = selWindowCreateElement("div", "seldropdown-root seldropdown-surface-toolbar");
            // 字段标签、标题和滚动阈值通过组件公开 data 契约传入。
            selWindowDropdown.dataset.selDropdownMenu = "";
            selWindowDropdown.dataset.selDropdownMenuLabel = String(selWindowField.label);
            selWindowDropdown.dataset.selDropdownMenuTitle = String(selWindowField.label);
            selWindowDropdown.dataset.selDropdownMenuPrefix = "";
            selWindowDropdown.dataset.selDropdownMenuScrollAfter = "6";
            // 原生 select 继续作为唯一真实业务值。
            const selWindowSelect = selWindowCreateElement("select", "seldropdown-native");
            // 稳定 id、name 和必填状态进入表单契约。
            selWindowSelect.id = selWindowField.inputId;
            selWindowSelect.name = selWindowField.name;
            selWindowSelect.required = Boolean(selWindowField.required);
            // 应用提供的选项只写入原生 option 配置。
            selWindowFillSelect(selWindowSelect, selWindowField.options);
            // 下拉根只包含真实 select，视觉结构由基础组件创建。
            selWindowDropdown.appendChild(selWindowSelect);
            // 返回标准下拉宿主。
            return selWindowDropdown;
        }

        // 日期字段组合原生 date input 与公开 selDatePicker 基础控件，禁止调用系统灰色日历。
        if (selWindowField.type === "date") {
            // 标准宿主只声明日期控件契约，内部月历结构由 selDatePicker 创建。
            const selWindowDatePicker = selWindowCreateElement("div", "seldatepicker-root");
            // data 标识允许基础日期组件按范围幂等挂载。
            selWindowDatePicker.dataset.selDatePicker = "";
            // 字段名称用于日期触发器和月历的可访问文案。
            selWindowDatePicker.dataset.selDatePickerLabel = String(selWindowField.label || "日期");
            // 占位文案来自字段配置，缺失时使用清晰的业务回退。
            selWindowDatePicker.dataset.selDatePickerPlaceholder = String(selWindowField.placeholder || `请选择${selWindowField.label || "日期"}`);
            // 可见触发器沿用字段 inputId，使外部 label 点击后进入日期控件。
            selWindowDatePicker.dataset.selDatePickerTriggerId = selWindowField.inputId;
            // 原生 date input 是 FormData、required、min 和 max 的唯一真实来源。
            const selWindowDateInput = selWindowCreateElement("input", "seldatepicker-native");
            // date 类型保留浏览器标准日期值校验，但视觉交互完全由基础组件接管。
            selWindowDateInput.type = "date";
            // 原生输入使用内部 id，避免与可见触发器重复。
            selWindowDateInput.id = `${selWindowField.inputId}-native`;
            // 原生输入退出键盘顺序，可见触发器承担全部焦点交互。
            selWindowDateInput.tabIndex = -1;
            // 可访问树只暴露有完整名称和状态的自定义触发器，避免出现重复无名输入。
            selWindowDateInput.setAttribute("aria-hidden", "true");
            // hidden 属性让真实输入完全退出视觉和可访问树，但仍保留 name/value 与组件自定义校验读取。
            selWindowDateInput.hidden = true;
            // name 继续进入 Window 标准表单提交结果。
            selWindowDateInput.name = selWindowField.name;
            // 必填状态继续由真实字段参与 :invalid 检查。
            selWindowDateInput.required = Boolean(selWindowField.required);
            // 可选初始值必须使用 YYYY-MM-DD 标准格式。
            if (selWindowField.value) selWindowDateInput.value = String(selWindowField.value);
            // 可选最小日期限制进入原生校验和月历禁用态。
            if (selWindowField.min) selWindowDateInput.min = String(selWindowField.min);
            // 可选最大日期限制进入原生校验和月历禁用态。
            if (selWindowField.max) selWindowDateInput.max = String(selWindowField.max);
            // 宿主初始只包含真实输入，触发器和浮层由 selDatePicker 统一装配。
            selWindowDatePicker.appendChild(selWindowDateInput);
            // 返回日期基础控件宿主进入字段栅格。
            return selWindowDatePicker;
        }

        // 其他字段共享图标、输入和尾部状态三列玻璃容器。
        const selWindowControl = selWindowCreateElement("div", `selwindow-control-shell${selWindowField.type === "textarea" ? " selwindow-control-shell-textarea" : ""}`);
        // 字段图标说明项目名称、日期或描述等业务角色。
        const selWindowIcon = selWindowCreateElement("span", "selwindow-control-icon");
        // 使用配置中最贴近语义的图标库图标。
        selWindowIcon.appendChild(selWindowCreateIcon(selWindowField.icon));
        // 多行描述使用 textarea，其余字段使用对应原生 input 类型。
        const selWindowInput = selWindowField.type === "textarea"
            ? selWindowCreateElement("textarea", "selwindow-control-textarea")
            : selWindowCreateElement("input", "selwindow-control-input");
        // 非文本域输入类型来自受控字段配置，例如 text 或 date。
        if (selWindowInput instanceof HTMLInputElement) selWindowInput.type = selWindowField.type || "text";
        // id 与 label 的 htmlFor 保持一一对应。
        selWindowInput.id = selWindowField.inputId;
        // name 用于提交时组装标准业务结果。
        selWindowInput.name = selWindowField.name;
        // 占位文案直接来自应用字段配置。
        selWindowInput.placeholder = String(selWindowField.placeholder || "");
        // 必填约束交给浏览器与本组件共同校验。
        selWindowInput.required = Boolean(selWindowField.required);
        // 最大长度同时约束用户输入和右侧计数。
        if (selWindowField.maxLength) selWindowInput.maxLength = Number(selWindowField.maxLength);
        // 尾部默认显示最大长度或日期图标，保持参考图右侧轨道。
        const selWindowSuffix = selWindowCreateElement("span", "selwindow-control-suffix", selWindowField.maxLength ? `0/${selWindowField.maxLength}` : "");
        // 有最大长度时实时更新当前输入计数。
        if (selWindowField.maxLength) selWindowInput.addEventListener("input", () => { selWindowSuffix.textContent = `${selWindowInput.value.length}/${selWindowField.maxLength}`; });
        // 字段结构按图标、真实输入、尾部状态顺序装配。
        selWindowControl.append(selWindowIcon, selWindowInput, selWindowSuffix);
        // 返回完整玻璃控件。
        return selWindowControl;
    }

    /**
     * 创建一个独立水晶表单窗口实例。
     * @param {HTMLElement} selWindowHost - 应用提供的挂载宿主。
     * @param {object} selWindowOptions - 标题、字段行、按钮和提交反馈配置。
     * @returns {object|null} open、close、reset 与 getState 控制器。
     */
    function selWindowCreateInstance(selWindowHost, selWindowOptions) {
        // 稳定窗口键决定多实例隔离边界。
        const selWindowId = String(selWindowOptions?.id || "");
        // 缺少宿主、键或字段行时拒绝创建半成品窗口。
        if (!selWindowHost || !selWindowId || !Array.isArray(selWindowOptions.rows)) return null;
        // 重复挂载返回既有控制器，避免遮罩和事件叠加。
        if (selWindowInstances.has(selWindowId)) return selWindowInstances.get(selWindowId);

        // 挂载顺序用于首次打开时的级联错位，确保同页窗口不会完全重叠。
        const selWindowCascadeIndex = selWindowInstances.size;

        // 当前实例状态统一保存可见性、提交值、几何、最大化还原点和指针交互。
        const selWindowState = { open: false, minimized: false, submitted: null, geometry: null, restoreGeometry: null, maximized: false, interaction: null };
        // 遮罩初始隐藏，只有应用调用 open 后参与布局。
        const selWindowOverlay = selWindowCreateElement("div", "selwindow-overlay");
        // hidden 是关闭窗口的唯一布局状态。
        selWindowOverlay.hidden = true;
        // 窗口根承载完整九宫格材质和 dialog 语义。
        const selWindowShell = selWindowCreateElement("section", "selwindow-window-shell");
        // 根节点可在打开后获得焦点并接收 Escape。
        selWindowShell.tabIndex = -1;
        // dialog 与模态属性向辅助技术说明当前上下文。
        selWindowShell.setAttribute("role", "dialog");
        selWindowShell.setAttribute("aria-modal", "true");
        selWindowShell.setAttribute("aria-label", String(selWindowOptions.title || "业务窗口"));
        // 稳定实例键同时供多窗口测试和层级诊断定位当前窗体。
        selWindowShell.dataset.selWindowId = selWindowId;

        // 标题栏装配真实徽标、两行标题和关闭动作。
        const selWindowHeader = selWindowCreateElement("header", "selwindow-header-shell");
        const selWindowBrand = selWindowCreateElement("div", "selwindow-brand-group");
        const selWindowBrandImage = selWindowCreateElement("img", "selwindow-brand-image");
        // 生成后的统一晶体徽标由组件素材目录提供。
        selWindowBrandImage.src = "../sel/assets/components/window/selWindowCrystalCube.webp";
        // 徽标为装饰图，不重复播报标题。
        selWindowBrandImage.alt = "";
        const selWindowBrandCopy = selWindowCreateElement("div", "selwindow-brand-copy");
        const selWindowTitle = selWindowCreateElement("h2", "selwindow-brand-title", selWindowOptions.title || "新建项目");
        const selWindowSubtitle = selWindowCreateElement("span", "selwindow-brand-subtitle", selWindowOptions.subtitle || "");
        // 主副标题合并为同一标题文案组。
        selWindowBrandCopy.append(selWindowTitle, selWindowSubtitle);
        // 徽标和标题按参考图顺序进入品牌组。
        selWindowBrand.append(selWindowBrandImage, selWindowBrandCopy);
        // 标题栏动作组把最小化、最大化与关闭作为统一窗口级控制呈现。
        const selWindowHeaderActions = selWindowCreateElement("div", "selwindow-header-actions");
        // 最小化按钮把窗口收起到页面底部停靠区，但保留表单和几何状态。
        const selWindowMinimize = selWindowCreateElement("button", "selwindow-frame-button selwindow-minimize-button");
        // 原生 button 避免误触发表单提交。
        selWindowMinimize.type = "button";
        // 可访问名称明确按钮执行的是窗口级最小化。
        selWindowMinimize.setAttribute("aria-label", "最小化窗口");
        // 使用图标库中的减号图标表达桌面窗口习惯。
        selWindowMinimize.appendChild(selWindowCreateIcon("ri-subtract-line"));
        // 最大化按钮在最大化后切换为还原动作和图标。
        const selWindowMaximize = selWindowCreateElement("button", "selwindow-frame-button selwindow-maximize-button");
        // 原生 button 避免触发表单提交。
        selWindowMaximize.type = "button";
        // 可访问名称明确当前动作而不是只播报图标。
        selWindowMaximize.setAttribute("aria-label", "最大化窗口");
        // aria-pressed 暴露最大化开关状态。
        selWindowMaximize.setAttribute("aria-pressed", "false");
        // 图标节点在最大化和还原之间原位切换。
        const selWindowMaximizeIcon = selWindowCreateIcon("ri-fullscreen-line");
        // 最大化按钮装配标准 Remix Icon。
        selWindowMaximize.appendChild(selWindowMaximizeIcon);
        // 关闭按钮与最大化按钮共享窗口控制几何和状态语言。
        const selWindowClose = selWindowCreateElement("button", "selwindow-frame-button selwindow-close-button");
        selWindowClose.type = "button";
        selWindowClose.setAttribute("aria-label", String(selWindowOptions.closeLabel || "关闭新建项目窗口"));
        selWindowClose.appendChild(selWindowCreateIcon("ri-close-line"));
        // 三个窗口动作按最小化、最大化、关闭顺序进入标题栏右端。
        selWindowHeaderActions.append(selWindowMinimize, selWindowMaximize, selWindowClose);
        // 标题栏左右两端完成装配，并作为整块可拖动区域。
        selWindowHeader.append(selWindowBrand, selWindowHeaderActions);

        // 原生 form 负责字段值、必填校验和提交语义。
        const selWindowForm = selWindowCreateElement("form", "selwindow-form-shell");
        // novalidate 关闭浏览器气泡，由同风格反馈区表达错误。
        selWindowForm.noValidate = true;
        // 字段滚动区在窗口缩小时独立滚动，标题栏和底部操作始终留在视口内。
        const selWindowFields = selWindowCreateElement("div", "selwindow-form-fields");
        // 按应用声明顺序建立单列或双列字段行。
        selWindowOptions.rows.forEach((selWindowRow, selWindowRowIndex) => {
            // 两字段行采用 paired 四轨布局，其他行采用标准两轨布局。
            const selWindowRowShell = selWindowCreateElement("div", `selwindow-field-row${selWindowRow.length > 1 ? " selwindow-field-row-paired" : ""}`);
            // 每个字段先补充当前窗口内唯一 inputId，再创建标签和控件。
            selWindowRow.forEach((selWindowRawField, selWindowFieldIndex) => {
                // 输入 id 包含实例键、行号和字段号，双实例不会冲突。
                const selWindowField = { ...selWindowRawField, inputId: `${selWindowId}-${selWindowRowIndex}-${selWindowFieldIndex}-${selWindowRawField.name}` };
                // 真实标签紧邻对应控件，保持视觉和辅助技术顺序一致。
                selWindowRowShell.append(selWindowCreateLabel(selWindowField), selWindowCreateControl(selWindowField));
            });
            // 当前字段行加入表单主流程。
            selWindowFields.appendChild(selWindowRowShell);
        });

        // 创建后任务复选项是独立业务字段，不与通用输入行混排。
        const selWindowCheckboxLabel = selWindowCreateElement("label", "selwindow-checkbox-row");
        const selWindowCheckbox = selWindowCreateElement("input", "selwindow-checkbox-input");
        selWindowCheckbox.type = "checkbox";
        selWindowCheckbox.name = "createTaskImmediately";
        // 标签文字来自应用配置，基础窗口不猜测业务动作。
        selWindowCheckboxLabel.append(selWindowCheckbox, document.createTextNode(String(selWindowOptions.checkboxLabel || "")), selWindowCreateIcon("ri-information-line"));
        // 信息图标获得独立样式类但仍作为装饰节点。
        selWindowCheckboxLabel.lastElementChild.className = "ri-information-line selwindow-checkbox-info";
        selWindowFields.appendChild(selWindowCheckboxLabel);

        // 固定高度反馈区在提交或校验失败时显示结果。
        const selWindowFeedback = selWindowCreateElement("div", "selwindow-feedback");
        selWindowFeedback.setAttribute("role", "status");
        selWindowFeedback.setAttribute("aria-live", "polite");
        selWindowFields.appendChild(selWindowFeedback);
        // 操作区包含取消与主提交按钮。
        const selWindowActions = selWindowCreateElement("div", "selwindow-actions-shell");
        const selWindowCancel = selWindowCreateElement("button", "selwindow-action-button", selWindowOptions.cancelLabel || "取消");
        selWindowCancel.type = "button";
        const selWindowSubmit = selWindowCreateElement("button", "selwindow-action-button selwindow-action-primary", selWindowOptions.submitLabel || "立即创建");
        selWindowSubmit.type = "submit";
        selWindowActions.append(selWindowCancel, selWindowSubmit);
        selWindowForm.append(selWindowFields, selWindowActions);

        // 八方向透明手柄只扩大指针命中区，不绘制额外边框或破坏九宫格素材。
        const selWindowResizeDirections = ["north", "east", "south", "west", "north-east", "south-east", "south-west", "north-west"];
        // 每个方向建立独立命中节点，业务方向通过 data 属性交给同一缩放算法。
        selWindowResizeDirections.forEach((selWindowDirection) => {
            // 手柄使用组件命名空间和稳定方向类供 CSS 设置正确光标。
            const selWindowResizeHandle = selWindowCreateElement("span", `selwindow-resize-handle selwindow-resize-${selWindowDirection}`);
            // data 方向作为指针开始时的唯一几何分支来源。
            selWindowResizeHandle.dataset.selWindowResizeDirection = selWindowDirection;
            // 透明手柄不参与辅助技术阅读顺序。
            selWindowResizeHandle.setAttribute("aria-hidden", "true");
            // 每个手柄加入窗口根，随窗口边缘同步移动。
            selWindowShell.appendChild(selWindowResizeHandle);
        });

        // 完整窗口由标题栏和表单主体组成，手柄保持为绝对定位叠层。
        selWindowShell.append(selWindowHeader, selWindowForm);
        selWindowOverlay.appendChild(selWindowShell);
        selWindowHost.appendChild(selWindowOverlay);

        // 每个实例在全局停靠区拥有一个只在最小化时显示的恢复按钮。
        const selWindowMinimizedButton = selWindowCreateElement("button", "selwindow-minimized-button");
        // 原生按钮确保键盘可聚焦并支持 Enter/Space 恢复窗口。
        selWindowMinimizedButton.type = "button";
        // 实例键让自动化与多窗口状态检查能够稳定定位恢复入口。
        selWindowMinimizedButton.dataset.selWindowRestoreId = selWindowId;
        // 按钮名称同时说明窗口标题和恢复动作。
        selWindowMinimizedButton.setAttribute("aria-label", `恢复${String(selWindowOptions.title || "业务")}窗口`);
        // 真实 Remix Icon 表达窗口恢复入口，不使用字符或 CSS 图形代替。
        selWindowMinimizedButton.append(selWindowCreateIcon("ri-window-line"), document.createTextNode(String(selWindowOptions.title || "业务窗口")));
        // 普通打开状态不显示停靠按钮。
        selWindowMinimizedButton.hidden = true;
        // 把实例恢复入口加入基础组件维护的全局停靠区。
        selWindowGetMinimizedRail().appendChild(selWindowMinimizedButton);
        // 窗口内所有标准下拉通过公开基础控件一次挂载。
        window.selDropdownMenu?.mountAll(selWindowShell);
        // 窗口内所有标准日期字段通过公开基础控件一次挂载，原生 date input 不再直接显示系统日历。
        window.selDatePicker?.mountAll(selWindowShell);

        /**
         * 读取当前可用视口尺寸。
         * @returns {{width:number,height:number}} 浏览器内容视口的实际像素尺寸。
         */
        function selWindowGetViewport() {
            // clientWidth 排除浏览器滚动条占位，避免最大化后右边缘被遮挡。
            const selWindowViewportWidth = document.documentElement.clientWidth;
            // clientHeight 代表遮罩真正可用的垂直空间。
            const selWindowViewportHeight = document.documentElement.clientHeight;
            // 返回不可变计算输入供几何约束复用。
            return { width: selWindowViewportWidth, height: selWindowViewportHeight };
        }

        /**
         * 把候选几何限制在视口安全区与当前最小尺寸之间。
         * @param {{left:number,top:number,width:number,height:number}} selWindowGeometry - 拖动、缩放或恢复产生的候选矩形。
         * @returns {{left:number,top:number,width:number,height:number}} 可完整操作的窗口矩形。
         */
        function selWindowNormalizeGeometry(selWindowGeometry) {
            // 当前视口决定本次可用的最大宽高。
            const selWindowViewport = selWindowGetViewport();
            // 极窄视口下最小宽度自动退让到安全区内。
            const selWindowMinWidth = Math.min(selWindowMinimumWidth, Math.max(320, selWindowViewport.width - selWindowViewportGap * 2));
            // 极低视口下最小高度自动退让，字段区改为滚动而不是越界。
            const selWindowMinHeight = Math.min(selWindowMinimumHeight, Math.max(360, selWindowViewport.height - selWindowViewportGap * 2));
            // 宽度同时受最小可用值与视口安全区上限约束。
            const selWindowWidth = Math.min(Math.max(selWindowGeometry.width, selWindowMinWidth), selWindowViewport.width - selWindowViewportGap * 2);
            // 高度同时受最小可用值与视口安全区上限约束。
            const selWindowHeight = Math.min(Math.max(selWindowGeometry.height, selWindowMinHeight), selWindowViewport.height - selWindowViewportGap * 2);
            // 左侧位置保证标题栏和左右缩放边始终留在视口内。
            const selWindowLeft = Math.min(Math.max(selWindowGeometry.left, selWindowViewportGap), selWindowViewport.width - selWindowWidth - selWindowViewportGap);
            // 顶部位置保证标题栏和上下缩放边始终可触达。
            const selWindowTop = Math.min(Math.max(selWindowGeometry.top, selWindowViewportGap), selWindowViewport.height - selWindowHeight - selWindowViewportGap);
            // 返回归一化矩形供 DOM 与状态同步。
            return { left: selWindowLeft, top: selWindowTop, width: selWindowWidth, height: selWindowHeight };
        }

        /**
         * 把窗口矩形同时写入状态和实时样式。
         * @param {{left:number,top:number,width:number,height:number}} selWindowGeometry - 已计算或待约束的窗口矩形。
         */
        function selWindowApplyGeometry(selWindowGeometry) {
            // 所有几何入口统一经过边界归一化，禁止拖动与 API 行为分叉。
            const selWindowNormalized = selWindowNormalizeGeometry(selWindowGeometry);
            // 状态保存独立副本供后续拖动、缩放和还原读取。
            selWindowState.geometry = { ...selWindowNormalized };
            // 显式 left 取消旧版居中 transform，指针移动与视觉位置保持一一对应。
            selWindowShell.style.left = `${selWindowNormalized.left}px`;
            // 显式 top 让窗口可在安全区内任意移动。
            selWindowShell.style.top = `${selWindowNormalized.top}px`;
            // 显式宽度驱动容器查询和表单自适应。
            selWindowShell.style.width = `${selWindowNormalized.width}px`;
            // 显式高度决定字段滚动区的剩余空间。
            selWindowShell.style.height = `${selWindowNormalized.height}px`;
        }

        /**
         * 计算首次打开时的紧凑居中矩形。
         * @returns {{left:number,top:number,width:number,height:number}} 默认窗口矩形。
         */
        function selWindowCreateDefaultGeometry() {
            // 当前视口决定默认尺寸是否需要缩小。
            const selWindowViewport = selWindowGetViewport();
            // 默认宽度不超过视口安全区。
            const selWindowWidth = Math.min(selWindowDefaultWidth, selWindowViewport.width - selWindowViewportGap * 4);
            // 默认高度不超过视口安全区。
            const selWindowHeight = Math.min(selWindowDefaultHeight, selWindowViewport.height - selWindowViewportGap * 4);
            // 多实例按注册顺序轻微错位，首次同时打开时仍能看出每个窗口的独立边界。
            const selWindowCascadeOffset = (selWindowCascadeIndex % 4) * 28;
            // 左侧位置以水平居中为基准，再加入受视口约束的级联偏移。
            const selWindowLeft = (selWindowViewport.width - selWindowWidth) / 2 + selWindowCascadeOffset;
            // 顶部位置以垂直居中为基准，再加入同等的级联偏移。
            const selWindowTop = (selWindowViewport.height - selWindowHeight) / 2 + selWindowCascadeOffset;
            // 返回统一几何结构供打开与还原回退使用。
            return { left: selWindowLeft, top: selWindowTop, width: selWindowWidth, height: selWindowHeight };
        }

        /**
         * 把当前窗口提升为活动实例。
         */
        function selWindowBringToFront() {
            // 单调递增层级避免两个打开窗口争用相同的显示顺序。
            selWindowTopLayer += 1;
            // overlay 只承载当前实例，因此其层级就是整个窗口的层级。
            selWindowOverlay.style.zIndex = String(selWindowTopLayer);
            // 清除其他窗口的活动态，避免多个边框同时显示高亮。
            document.querySelectorAll(".selwindow-window-shell.selwindow-window-active").forEach((selWindowActiveShell) => selWindowActiveShell.classList.remove("selwindow-window-active"));
            // 当前实例获得活动边框和控制按钮强调。
            selWindowShell.classList.add("selwindow-window-active");
        }

        /**
         * 同步最大化按钮、图标和窗口状态类。
         */
        function selWindowSyncMaximizePresentation() {
            // 最大化状态类只表达交互状态，不复制另一套窗口结构。
            selWindowShell.classList.toggle("selwindow-window-maximized", selWindowState.maximized);
            // 按钮名称始终说明下一次点击将执行的动作。
            selWindowMaximize.setAttribute("aria-label", selWindowState.maximized ? "还原窗口" : "最大化窗口");
            // pressed 状态让辅助技术读取当前是否最大化。
            selWindowMaximize.setAttribute("aria-pressed", String(selWindowState.maximized));
            // 图标在进入最大化后切换为退出全屏语义。
            selWindowMaximizeIcon.className = selWindowState.maximized ? "ri-fullscreen-exit-line" : "ri-fullscreen-line";
        }

        /**
         * 切换最大化或还原，并保留进入最大化前的真实矩形。
         * @param {boolean} selWindowNextMaximized - true 最大化，false 还原。
         */
        function selWindowSetMaximized(selWindowNextMaximized) {
            // 重复请求不改变还原点，避免连续事件覆盖原始几何。
            if (selWindowState.maximized === selWindowNextMaximized) return;
            // 进入最大化前保存当前拖动或缩放后的真实位置与尺寸。
            if (selWindowNextMaximized) selWindowState.restoreGeometry = { ...(selWindowState.geometry || selWindowCreateDefaultGeometry()) };
            // 状态先更新，视觉类和按钮语义随后同步。
            selWindowState.maximized = selWindowNextMaximized;
            // 最大化使用视口安全区，保留完整发光边缘和缩放素材角部。
            if (selWindowNextMaximized) {
                // 当前视口作为最大化矩形来源。
                const selWindowViewport = selWindowGetViewport();
                // 最大化矩形由统一几何入口写入。
                selWindowApplyGeometry({ left: selWindowViewportGap, top: selWindowViewportGap, width: selWindowViewport.width - selWindowViewportGap * 2, height: selWindowViewport.height - selWindowViewportGap * 2 });
            } else {
                // 还原优先使用进入最大化前的矩形，否则回退到默认居中尺寸。
                selWindowApplyGeometry(selWindowState.restoreGeometry || selWindowCreateDefaultGeometry());
            }
            // 最后同步按钮、图标和状态类，避免中间帧显示错误动作。
            selWindowSyncMaximizePresentation();
        }

        /**
         * 最小化当前窗口并保留输入、几何和最大化状态。
         */
        function selWindowMinimizeWindow() {
            // 未打开或已经最小化时不重复改变停靠区状态。
            if (!selWindowState.open || selWindowState.minimized) return;
            // 最小化前关闭 body 门户中的日期浮层，避免窗口隐藏后月历悬空。
            window.selDatePicker?.closeWithin(selWindowShell);
            // 指针交互必须先结束，避免隐藏后仍响应移动事件。
            selWindowEndPointerInteraction();
            // 最小化属于打开窗口的展示状态，不等同于关闭。
            selWindowState.minimized = true;
            // 隐藏当前实例画布，让底层页面和其他窗口继续可操作。
            selWindowOverlay.hidden = true;
            // 显示对应恢复入口并同步全局停靠区。
            selWindowMinimizedButton.hidden = false;
            // 停靠区在首次最小化后进入页面布局。
            selWindowSyncMinimizedRail();
        }

        /**
         * 根据当前指针移动更新拖动或八方向缩放矩形。
         * @param {PointerEvent} selWindowEvent - 浏览器指针移动事件。
         */
        function selWindowHandlePointerMove(selWindowEvent) {
            // 没有活动交互时忽略全局移动事件。
            if (!selWindowState.interaction) return;
            // 起始交互快照提供稳定的基准矩形。
            const selWindowInteraction = selWindowState.interaction;
            // 水平位移只相对按下时的指针位置计算。
            const selWindowDeltaX = selWindowEvent.clientX - selWindowInteraction.pointerX;
            // 垂直位移只相对按下时的指针位置计算。
            const selWindowDeltaY = selWindowEvent.clientY - selWindowInteraction.pointerY;
            // 复制起始矩形，避免连续移动产生累计漂移。
            const selWindowNextGeometry = { ...selWindowInteraction.geometry };
            // 标题栏拖动只改变位置，不改变用户设置的宽高。
            if (selWindowInteraction.mode === "move") {
                // 左侧位置跟随水平位移。
                selWindowNextGeometry.left += selWindowDeltaX;
                // 顶部位置跟随垂直位移。
                selWindowNextGeometry.top += selWindowDeltaY;
            } else {
                // 当前方向字符串决定需要移动的边和角。
                const selWindowDirection = selWindowInteraction.direction;
                // 东侧缩放增加宽度。
                if (selWindowDirection.includes("east")) selWindowNextGeometry.width += selWindowDeltaX;
                // 南侧缩放增加高度。
                if (selWindowDirection.includes("south")) selWindowNextGeometry.height += selWindowDeltaY;
                // 西侧缩放同时移动左边并反向改变宽度。
                if (selWindowDirection.includes("west")) {
                    // 左边跟随指针移动。
                    selWindowNextGeometry.left += selWindowDeltaX;
                    // 宽度按相反方向变化。
                    selWindowNextGeometry.width -= selWindowDeltaX;
                }
                // 北侧缩放同时移动顶边并反向改变高度。
                if (selWindowDirection.includes("north")) {
                    // 顶边跟随指针移动。
                    selWindowNextGeometry.top += selWindowDeltaY;
                    // 高度按相反方向变化。
                    selWindowNextGeometry.height -= selWindowDeltaY;
                }
            }
            // 统一边界入口把实时矩形限制在安全视口内。
            selWindowApplyGeometry(selWindowNextGeometry);
        }

        /**
         * 结束当前指针交互并恢复页面选择行为。
         */
        function selWindowEndPointerInteraction() {
            // 清空交互快照使后续 pointermove 不再修改窗口。
            selWindowState.interaction = null;
            // 移除拖动状态类，恢复正常光标与文字选择。
            selWindowShell.classList.remove("selwindow-window-interacting");
        }

        /**
         * 启动标题栏拖动或指定方向缩放。
         * @param {PointerEvent} selWindowEvent - 指针按下事件。
         * @param {"move"|"resize"} selWindowMode - 当前交互模式。
         * @param {string} selWindowDirection - resize 模式使用的方向。
         */
        function selWindowStartPointerInteraction(selWindowEvent, selWindowMode, selWindowDirection = "") {
            // 只接受主指针按钮，右键和中键保留浏览器默认行为。
            if (selWindowEvent.button !== 0) return;
            // 最大化时禁止移动和缩放，必须先显式还原。
            if (selWindowState.maximized) return;
            // 阻止标题文字选择和浏览器原生拖图行为。
            selWindowEvent.preventDefault();
            // 保存起点和矩形，后续移动始终从同一快照计算。
            selWindowState.interaction = { mode: selWindowMode, direction: selWindowDirection, pointerX: selWindowEvent.clientX, pointerY: selWindowEvent.clientY, geometry: { ...(selWindowState.geometry || selWindowCreateDefaultGeometry()) } };
            // 交互状态类暂停文字选择并加强窗口活动反馈。
            selWindowShell.classList.add("selwindow-window-interacting");
        }

        // 打开时重置反馈、恢复可用几何并把焦点交给第一个业务输入。
        function selWindowOpen() {
            // 打开当前实例但不关闭其他窗口，使 multi=1 页面可以真正并行操作多个业务窗体。
            selWindowState.open = true;
            // open 同时承担从最小化状态恢复窗口的语义。
            selWindowState.minimized = false;
            selWindowOverlay.hidden = false;
            // 恢复后移除停靠按钮，避免同一实例出现两个入口。
            selWindowMinimizedButton.hidden = true;
            // 全局停靠区按剩余最小化实例决定是否继续显示。
            selWindowSyncMinimizedRail();
            selWindowFeedback.textContent = "";
            selWindowFeedback.classList.remove("selwindow-feedback-error");
            // 首次打开使用新的紧凑居中矩形，后续打开保留用户拖动和缩放结果。
            selWindowApplyGeometry(selWindowState.geometry || selWindowCreateDefaultGeometry());
            // 最大化状态在视口变化后重新贴合当前安全区。
            if (selWindowState.maximized) {
                // 当前视口决定新的最大化尺寸。
                const selWindowViewport = selWindowGetViewport();
                // 重新应用最大化矩形而不覆盖还原点。
                selWindowApplyGeometry({ left: selWindowViewportGap, top: selWindowViewportGap, width: selWindowViewport.width - selWindowViewportGap * 2, height: selWindowViewport.height - selWindowViewportGap * 2 });
            }
            // 新打开或恢复的窗口成为当前活动实例。
            selWindowBringToFront();
            requestAnimationFrame(() => selWindowForm.querySelector("input, select, textarea, button")?.focus({ preventScroll: true }));
        }

        // 关闭时隐藏遮罩并保留用户输入，便于误关后继续编辑。
        function selWindowCloseWindow() {
            // 关闭前回收当前 Window 的日期门户，避免浮层独立残留在页面上。
            window.selDatePicker?.closeWithin(selWindowShell);
            // 关闭时同时终止未完成的拖动或缩放，避免重新打开后继续响应旧指针。
            selWindowEndPointerInteraction();
            selWindowState.open = false;
            // 关闭会退出最小化生命周期，不在停靠区保留幽灵入口。
            selWindowState.minimized = false;
            selWindowOverlay.hidden = true;
            // 关闭窗口同步隐藏对应恢复按钮。
            selWindowMinimizedButton.hidden = true;
            // 若没有其他最小化实例则回收全局停靠区。
            selWindowSyncMinimizedRail();
        }

        // 重置清空表单、反馈和所有自定义下拉显示值。
        function selWindowReset() {
            // 原生 form.reset 同步恢复所有真实输入的 defaultValue。
            selWindowForm.reset();
            // 重置日期后刷新可见触发器，避免仍显示旧日期。
            selWindowShell.querySelectorAll("input.seldatepicker-native").forEach((selWindowDateInput) => window.selDatePicker?.getForInput(selWindowDateInput)?.refresh());
            // 重置反馈使窗口回到首次打开状态。
            selWindowFeedback.textContent = "";
            // 清除旧校验危险色。
            selWindowFeedback.classList.remove("selwindow-feedback-error");
            // 原生 select 重置后同步自定义下拉可见值。
            selWindowShell.querySelectorAll("select.seldropdown-native").forEach((selWindowSelect) => window.selDropdownMenu?.refresh(selWindowSelect));
        }

        // 标题关闭和底部取消都结束当前窗口但不提交数据。
        selWindowClose.addEventListener("click", selWindowCloseWindow);
        selWindowCancel.addEventListener("click", selWindowCloseWindow);
        // 最小化按钮保留业务输入并把恢复入口放入页面底部停靠区。
        selWindowMinimize.addEventListener("click", selWindowMinimizeWindow);
        // 停靠按钮重新显示当前实例并恢复最近几何。
        selWindowMinimizedButton.addEventListener("click", selWindowOpen);
        // 最大化按钮在当前几何与还原几何之间切换。
        selWindowMaximize.addEventListener("click", () => selWindowSetMaximized(!selWindowState.maximized));
        // 双击标题栏提供桌面窗口习惯中的最大化与还原路径。
        selWindowHeader.addEventListener("dblclick", (selWindowEvent) => { if (!selWindowEvent.target.closest("button")) selWindowSetMaximized(!selWindowState.maximized); });
        // 标题栏空白区域启动窗口移动，按钮区域不拦截正常点击。
        selWindowHeader.addEventListener("pointerdown", (selWindowEvent) => { if (!selWindowEvent.target.closest("button")) selWindowStartPointerInteraction(selWindowEvent, "move"); });
        // 点击窗口任意区域都会提升层级，符合桌面多窗口的激活习惯。
        selWindowShell.addEventListener("pointerdown", selWindowBringToFront);
        // 八方向手柄通过稳定 data 方向启动同一缩放算法。
        selWindowShell.querySelectorAll("[data-sel-window-resize-direction]").forEach((selWindowResizeHandle) => selWindowResizeHandle.addEventListener("pointerdown", (selWindowEvent) => selWindowStartPointerInteraction(selWindowEvent, "resize", selWindowResizeHandle.dataset.selWindowResizeDirection)));
        // 全局移动保证指针离开窄手柄后仍能连续缩放。
        window.addEventListener("pointermove", selWindowHandlePointerMove);
        // pointerup 结束鼠标、触控笔和触摸拖动。
        window.addEventListener("pointerup", selWindowEndPointerInteraction);
        // pointercancel 处理系统手势或浏览器取消事件。
        window.addEventListener("pointercancel", selWindowEndPointerInteraction);
        // 浏览器视口变化时最大化窗口重新铺满，普通窗口保持在安全区内。
        window.addEventListener("resize", () => {
            // 隐藏窗口无需重复写入几何。
            if (!selWindowState.open) return;
            // 最大化窗口按新视口刷新尺寸。
            if (selWindowState.maximized) {
                // 读取变化后的真实视口。
                const selWindowViewport = selWindowGetViewport();
                // 保留安全间距并填满剩余区域。
                selWindowApplyGeometry({ left: selWindowViewportGap, top: selWindowViewportGap, width: selWindowViewport.width - selWindowViewportGap * 2, height: selWindowViewport.height - selWindowViewportGap * 2 });
                // 最大化处理完成后不执行普通夹取。
                return;
            }
            // 普通窗口只夹取现有矩形，不擅自改变用户设置的相对尺寸。
            selWindowApplyGeometry(selWindowState.geometry || selWindowCreateDefaultGeometry());
        });
        // Escape 提供模态窗口的标准键盘退出路径。
        selWindowShell.addEventListener("keydown", (selWindowEvent) => { if (selWindowEvent.key === "Escape") selWindowCloseWindow(); });

        // 提交时执行真实必填校验并向应用派发标准数据。
        selWindowForm.addEventListener("submit", (selWindowEvent) => {
            // 阻止演示页面导航，由应用业务事件消费结果。
            selWindowEvent.preventDefault();
            // 第一个无效字段决定错误提示和键盘焦点。
            const selWindowInvalid = selWindowForm.querySelector(":invalid");
            if (selWindowInvalid) {
                // 错误反馈使用统一危险色，不调用浏览器默认气泡。
                selWindowFeedback.textContent = String(selWindowOptions.validationMessage || "请填写所有必填信息");
                selWindowFeedback.classList.add("selwindow-feedback-error");
                // 隐藏的原生日期输入通过公开控制器把校验焦点桥接到可见日期触发器。
                const selWindowInvalidDatePicker = selWindowInvalid.matches?.("input.seldatepicker-native") ? window.selDatePicker?.getForInput(selWindowInvalid) : null;
                // 日期字段聚焦可见触发器，其他字段保持原生聚焦行为。
                if (selWindowInvalidDatePicker) selWindowInvalidDatePicker.focus();
                else selWindowInvalid.focus();
                return;
            }
            // FormData 把标准 name/value 转换为应用可消费的对象。
            const selWindowResult = Object.fromEntries(new FormData(selWindowForm).entries());
            // 未勾选复选框时 FormData 不含键，这里补齐明确布尔值。
            selWindowResult.createTaskImmediately = selWindowCheckbox.checked;
            // 保存只读提交快照供控制器和测试读取。
            selWindowState.submitted = Object.freeze({ ...selWindowResult });
            // 成功反馈保持窗口可见，让用户确认主路径已完成。
            selWindowFeedback.textContent = String(selWindowOptions.successMessage || "项目信息已创建");
            selWindowFeedback.classList.remove("selwindow-feedback-error");
            // 受控事件只携带当前窗口键和标准字段值。
            selWindowShell.dispatchEvent(new CustomEvent("selWindow:submit", { bubbles: true, detail: { id: selWindowId, values: selWindowState.submitted } }));
        });

        // 控制器只暴露应用所需动作和不可变状态快照。
        const selWindowController = Object.freeze({
            // open 由表格新建事件调用。
            open: selWindowOpen,
            // close 供应用或测试结束窗口。
            close: selWindowCloseWindow,
            // reset 明确清空当前表单值。
            reset: selWindowReset,
            // maximize 供应用或自动化显式进入最大化状态。
            maximize: () => selWindowSetMaximized(true),
            // restore 供应用或自动化显式恢复最大化前矩形。
            restore: () => selWindowSetMaximized(false),
            // minimize 供应用或自动化显式把窗口收起到停靠区。
            minimize: selWindowMinimizeWindow,
            // getState 返回可见性、最小化、提交数据、几何和最大化状态的独立快照。
            getState: () => Object.freeze({ open: selWindowState.open, minimized: selWindowState.minimized, submitted: selWindowState.submitted, geometry: selWindowState.geometry ? Object.freeze({ ...selWindowState.geometry }) : null, maximized: selWindowState.maximized })
        });
        // 注册当前控制器供稳定实例键查询。
        selWindowInstances.set(selWindowId, selWindowController);
        // 返回控制器给应用装配层。
        return selWindowController;
    }

    // 公开 API 只允许挂载和按稳定键查询窗口。
    window.selWindow = Object.freeze({
        // mount 创建或复用标准表单窗口实例。
        mount: selWindowCreateInstance,
        // get 在不存在时返回 null，避免应用读取内部注册表。
        get: (selWindowId) => selWindowInstances.get(selWindowId) || null
    });
}());
