/*
 * selWindow.js：可复用水晶业务表单窗口基础控件。
 * 责任边界：基础控件根据标准 rows 配置创建表单、校验、打开与关闭；应用只声明字段和消费提交事件。
 * 命名前缀：模块级标识使用 selWindow，样式使用 selwindow-*；控件不识别 Uniauth 实体或接口地址。
 */
(function selWindowInitializeRegistry() {
    "use strict";

    // 控制器注册表用稳定窗口键隔离多实例状态。
    const selWindowInstances = new Map();

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
            // 下拉根只声明标准组件宿主，不复制下拉内部 DOM。
            const selWindowDropdown = selWindowCreateElement("div", "seldropdown-root seldropdown-surface-window");
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

        // 当前实例状态只记录可见性和最后一次提交值。
        const selWindowState = { open: false, submitted: null };
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
        // 关闭按钮是标题栏唯一窗口级动作。
        const selWindowClose = selWindowCreateElement("button", "selwindow-close-button");
        selWindowClose.type = "button";
        selWindowClose.setAttribute("aria-label", String(selWindowOptions.closeLabel || "关闭新建项目窗口"));
        selWindowClose.appendChild(selWindowCreateIcon("ri-close-line"));
        // 标题栏左右两端完成装配。
        selWindowHeader.append(selWindowBrand, selWindowClose);

        // 原生 form 负责字段值、必填校验和提交语义。
        const selWindowForm = selWindowCreateElement("form", "selwindow-form-shell");
        // novalidate 关闭浏览器气泡，由同风格反馈区表达错误。
        selWindowForm.noValidate = true;
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
            selWindowForm.appendChild(selWindowRowShell);
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
        selWindowForm.appendChild(selWindowCheckboxLabel);

        // 固定高度反馈区在提交或校验失败时显示结果。
        const selWindowFeedback = selWindowCreateElement("div", "selwindow-feedback");
        selWindowFeedback.setAttribute("role", "status");
        selWindowFeedback.setAttribute("aria-live", "polite");
        selWindowForm.appendChild(selWindowFeedback);
        // 操作区包含取消与主提交按钮。
        const selWindowActions = selWindowCreateElement("div", "selwindow-actions-shell");
        const selWindowCancel = selWindowCreateElement("button", "selwindow-action-button", selWindowOptions.cancelLabel || "取消");
        selWindowCancel.type = "button";
        const selWindowSubmit = selWindowCreateElement("button", "selwindow-action-button selwindow-action-primary", selWindowOptions.submitLabel || "立即创建");
        selWindowSubmit.type = "submit";
        selWindowActions.append(selWindowCancel, selWindowSubmit);
        selWindowForm.appendChild(selWindowActions);

        // 完整窗口由标题栏和表单主体组成。
        selWindowShell.append(selWindowHeader, selWindowForm);
        selWindowOverlay.appendChild(selWindowShell);
        selWindowHost.appendChild(selWindowOverlay);
        // 窗口内所有标准下拉通过公开基础控件一次挂载。
        window.selDropdownMenu?.mountAll(selWindowShell);

        // 打开时重置反馈并把焦点交给第一个业务输入。
        function selWindowOpen() {
            selWindowState.open = true;
            selWindowOverlay.hidden = false;
            selWindowFeedback.textContent = "";
            selWindowFeedback.classList.remove("selwindow-feedback-error");
            requestAnimationFrame(() => selWindowForm.querySelector("input, select, textarea, button")?.focus({ preventScroll: true }));
        }

        // 关闭时隐藏遮罩并保留用户输入，便于误关后继续编辑。
        function selWindowCloseWindow() {
            selWindowState.open = false;
            selWindowOverlay.hidden = true;
        }

        // 重置清空表单、反馈和所有自定义下拉显示值。
        function selWindowReset() {
            selWindowForm.reset();
            selWindowFeedback.textContent = "";
            selWindowFeedback.classList.remove("selwindow-feedback-error");
            selWindowShell.querySelectorAll("select.seldropdown-native").forEach((selWindowSelect) => window.selDropdownMenu?.refresh(selWindowSelect));
        }

        // 标题关闭和底部取消都结束当前窗口但不提交数据。
        selWindowClose.addEventListener("click", selWindowCloseWindow);
        selWindowCancel.addEventListener("click", selWindowCloseWindow);
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
                selWindowInvalid.focus();
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
            // getState 返回可见性和最后提交数据快照。
            getState: () => Object.freeze({ open: selWindowState.open, submitted: selWindowState.submitted })
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
