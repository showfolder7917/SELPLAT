/*
 * selDatePicker.js：SEL 水晶单日期选择基础控件。
 * 负责标准日期值、月历绘制、键盘导航、浮层定位和表单事件同步。
 * 责任边界：只识别 data-sel-date-picker 契约，不识别 Window、具体应用 或具体业务字段。
 */
(function selDatePickerInitializeRegistry() {
    "use strict";

    // 每个日期宿主只允许创建一个控制器，重复装配时返回既有实例。
    const selDatePickerControllers = new WeakMap();
    // 活跃控制器集合用于打开新月历时关闭其他实例，并支持 Window 按范围关闭。
    const selDatePickerControllerSet = new Set();
    // 日期浮层与视口之间保留安全距离，避免水晶发光被屏幕边缘裁切。
    const selDatePickerViewportGap = 12;

    /**
     * 创建带稳定类名和安全文本的原生节点。
     * @param {string} selDatePickerTag - 原生标签，例如 button、div 或 span。
     * @param {string} selDatePickerClassName - seldatepicker 命名空间类名。
     * @param {string} selDatePickerText - 可选的可见业务文本。
     * @returns {HTMLElement} 可直接装配的安全节点。
     */
    function selDatePickerCreateElement(selDatePickerTag, selDatePickerClassName, selDatePickerText = "") {
        // 原生节点保留按钮、输入和对话框的浏览器语义。
        const selDatePickerElement = document.createElement(selDatePickerTag);
        // 组件类名由基础控件维护，应用无需理解内部结构。
        if (selDatePickerClassName) selDatePickerElement.className = selDatePickerClassName;
        // 可见文案只通过 textContent 写入，禁止配置插入任意 HTML。
        if (selDatePickerText) selDatePickerElement.textContent = String(selDatePickerText);
        // 返回节点供当前控件实例继续装配。
        return selDatePickerElement;
    }

    /**
     * 创建一个 Remix Icon 节点。
     * @param {string} selDatePickerIconName - 项目已加载的图标类名。
     * @returns {HTMLElement} 不重复播报的装饰图标。
     */
    function selDatePickerCreateIcon(selDatePickerIconName) {
        // 真实图标字体与主页面和 Window 保持同一图标体系。
        const selDatePickerIcon = selDatePickerCreateElement("i", selDatePickerIconName);
        // 相邻按钮名称已经表达业务动作，因此图标对辅助技术隐藏。
        selDatePickerIcon.setAttribute("aria-hidden", "true");
        // 返回图标供触发器和月份导航复用。
        return selDatePickerIcon;
    }

    /**
     * 把数字补为两位日期片段。
     * @param {number} selDatePickerNumber - 月或日，例如 8。
     * @returns {string} 两位片段，例如 08。
     */
    function selDatePickerPad(selDatePickerNumber) {
        // 标准日期值必须使用固定两位月日，避免 FormData 格式漂移。
        return String(selDatePickerNumber).padStart(2, "0");
    }

    /**
     * 把本地日期转换为 YYYY-MM-DD，禁止 UTC 偏移改变业务日期。
     * @param {Date} selDatePickerDate - 当前选择或导航日期。
     * @returns {string} 原生 date input 可接受的标准值。
     */
    function selDatePickerFormatIso(selDatePickerDate) {
        // 年份直接使用本地完整年份。
        const selDatePickerYear = selDatePickerDate.getFullYear();
        // JavaScript 月份从 0 开始，标准值必须加一。
        const selDatePickerMonth = selDatePickerPad(selDatePickerDate.getMonth() + 1);
        // 日期补齐两位以满足 input[type=date] 契约。
        const selDatePickerDay = selDatePickerPad(selDatePickerDate.getDate());
        // 返回稳定的年月日业务值。
        return `${selDatePickerYear}-${selDatePickerMonth}-${selDatePickerDay}`;
    }

    /**
     * 解析 YYYY-MM-DD 为本地日期，非法值返回 null。
     * @param {string} selDatePickerValue - 原生日期输入当前值。
     * @returns {Date|null} 本地零点日期或空结果。
     */
    function selDatePickerParseIso(selDatePickerValue) {
        // 只接受四位年、两位月和两位日，避免浏览器宽松解析错误文本。
        const selDatePickerMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(selDatePickerValue || ""));
        // 空值或格式错误表示尚未选择日期。
        if (!selDatePickerMatch) return null;
        // 三个日期片段转换为本地构造参数。
        const selDatePickerYear = Number(selDatePickerMatch[1]);
        // 标准月份转回 JavaScript 的零基月份。
        const selDatePickerMonth = Number(selDatePickerMatch[2]) - 1;
        // 日期保持原始自然数。
        const selDatePickerDay = Number(selDatePickerMatch[3]);
        // 本地日期避免东京等时区在 UTC 转换时跨日。
        const selDatePickerDate = new Date(selDatePickerYear, selDatePickerMonth, selDatePickerDay);
        // 构造结果必须与输入片段完全一致，2 月 31 日等值不能自动滚入下月。
        if (selDatePickerDate.getFullYear() !== selDatePickerYear || selDatePickerDate.getMonth() !== selDatePickerMonth || selDatePickerDate.getDate() !== selDatePickerDay) return null;
        // 合法日期可进入月历状态。
        return selDatePickerDate;
    }

    /**
     * 复制日期并移动指定天数。
     * @param {Date} selDatePickerDate - 键盘导航当前日期。
     * @param {number} selDatePickerAmount - 正负天数，例如 7 或 -1。
     * @returns {Date} 移动后的新日期对象。
     */
    function selDatePickerAddDays(selDatePickerDate, selDatePickerAmount) {
        // 复制对象避免修改控制器已保存的日期状态。
        const selDatePickerResult = new Date(selDatePickerDate.getFullYear(), selDatePickerDate.getMonth(), selDatePickerDate.getDate());
        // setDate 自动跨月，适合箭头键连续导航。
        selDatePickerResult.setDate(selDatePickerResult.getDate() + selDatePickerAmount);
        // 返回独立日期供状态替换。
        return selDatePickerResult;
    }

    /**
     * 把日期移动到相邻月份并尽量保留日号。
     * @param {Date} selDatePickerDate - 当前活动日期。
     * @param {number} selDatePickerAmount - 正负月份数量。
     * @returns {Date} 月份切换后的合法日期。
     */
    function selDatePickerAddMonths(selDatePickerDate, selDatePickerAmount) {
        // 目标月先固定为一号，避免 31 日直接跳过短月份。
        const selDatePickerTarget = new Date(selDatePickerDate.getFullYear(), selDatePickerDate.getMonth() + selDatePickerAmount, 1);
        // 目标月最后一天决定原日号是否需要收缩。
        const selDatePickerLastDay = new Date(selDatePickerTarget.getFullYear(), selDatePickerTarget.getMonth() + 1, 0).getDate();
        // 合法日号保留用户在月历中的纵向位置。
        selDatePickerTarget.setDate(Math.min(selDatePickerDate.getDate(), selDatePickerLastDay));
        // 返回目标月活动日期。
        return selDatePickerTarget;
    }

    /**
     * 判断候选日期是否落在原生输入的 min/max 范围内。
     * @param {Date} selDatePickerDate - 当前日历格日期。
     * @param {HTMLInputElement} selDatePickerInput - 提供最小和最大日期的真实输入。
     * @returns {boolean} true 表示日期可以选择。
     */
    function selDatePickerIsAllowed(selDatePickerDate, selDatePickerInput) {
        // min 缺失时不限制过去日期。
        const selDatePickerMinimum = selDatePickerParseIso(selDatePickerInput.min);
        // max 缺失时不限制未来日期。
        const selDatePickerMaximum = selDatePickerParseIso(selDatePickerInput.max);
        // 早于最小日期时禁用当前日期格。
        if (selDatePickerMinimum && selDatePickerDate < selDatePickerMinimum) return false;
        // 晚于最大日期时禁用当前日期格。
        if (selDatePickerMaximum && selDatePickerDate > selDatePickerMaximum) return false;
        // 其余日期符合原生字段约束。
        return true;
    }

    /**
     * 挂载一个水晶日期选择器。
     * @param {HTMLElement} selDatePickerHost - 含原生 date input 的标准宿主。
     * @returns {object|null} 日期选择器公开控制器。
     */
    function selDatePickerMount(selDatePickerHost, selDatePickerOptions = {}) {
        // 非元素宿主无法承载日期触发器和控制器。
        if (!(selDatePickerHost instanceof HTMLElement)) return null;
        // 重复装配直接返回既有实例，避免文档事件监听叠加。
        if (selDatePickerControllers.has(selDatePickerHost)) {
            const selDatePickerExisting = selDatePickerControllers.get(selDatePickerHost);
            if (selDatePickerOptions.messages || selDatePickerOptions.locale) selDatePickerExisting.setLocale(selDatePickerOptions);
            return selDatePickerExisting;
        }
        // 原生 date input 是唯一表单值来源。
        const selDatePickerInput = selDatePickerHost.querySelector('input[type="date"].seldatepicker-native');
        // 缺少真实输入时拒绝生成只有视觉没有业务值的控件。
        if (!(selDatePickerInput instanceof HTMLInputElement)) return null;
        // 字段名称只用于可访问文案，不参与日期逻辑。
        let selDatePickerLocale = String(selDatePickerOptions.locale || "zh-CN");
        let selDatePickerMessages = selDatePickerOptions.messages || {};
        let selDatePickerLabel = String(selDatePickerHost.dataset.selDatePickerLabel || "日期");
        // 未选日期时显示应用提供的占位文案。
        let selDatePickerPlaceholder = String(selDatePickerHost.dataset.selDatePickerPlaceholder || `请选择${selDatePickerLabel}`);
        // 触发器 id 与外部 label 的 htmlFor 对应。
        const selDatePickerTriggerId = String(selDatePickerHost.dataset.selDatePickerTriggerId || `${selDatePickerInput.id}-trigger`);
        // 每个浮层拥有稳定唯一 id，供 aria-controls 关联。
        const selDatePickerPopoverId = `${selDatePickerTriggerId}-popover`;

        // 可见触发器替代系统日期输入。
        const selDatePickerTrigger = selDatePickerCreateElement("button", "seldatepicker-trigger");
        // button 类型避免在 Window 表单内误触提交。
        selDatePickerTrigger.type = "button";
        // 外部字段标签点击后聚焦并激活当前日期按钮。
        selDatePickerTrigger.id = selDatePickerTriggerId;
        // dialog 语义说明该按钮打开独立月历浮层。
        selDatePickerTrigger.setAttribute("aria-haspopup", "dialog");
        // 初始关闭状态同步给辅助技术。
        selDatePickerTrigger.setAttribute("aria-expanded", "false");
        // 控制关系指向当前实例浮层。
        selDatePickerTrigger.setAttribute("aria-controls", selDatePickerPopoverId);
        // 必填语义从真实输入同步到可见触发器。
        selDatePickerTrigger.setAttribute("aria-required", String(selDatePickerInput.required));
        // 左侧使用项目既有日历图标。
        const selDatePickerTriggerIcon = selDatePickerCreateElement("span", "seldatepicker-trigger-icon");
        // 图标节点由真实 Remix Icon 提供。
        selDatePickerTriggerIcon.appendChild(selDatePickerCreateIcon("ri-calendar-line"));
        // 中央文本显示格式化日期或占位文案。
        const selDatePickerTriggerValue = selDatePickerCreateElement("span", "seldatepicker-trigger-value");
        // 右侧箭头表达展开与收起状态。
        const selDatePickerTriggerChevron = selDatePickerCreateElement("span", "seldatepicker-trigger-chevron");
        // 箭头使用项目已加载图标库。
        selDatePickerTriggerChevron.appendChild(selDatePickerCreateIcon("ri-arrow-down-s-line"));
        // 三列内容按图标、日期、状态顺序进入触发器。
        selDatePickerTrigger.append(selDatePickerTriggerIcon, selDatePickerTriggerValue, selDatePickerTriggerChevron);
        // 可见触发器与原生输入共同留在标准宿主中。
        selDatePickerHost.appendChild(selDatePickerTrigger);

        // 浮层追加到 body，避免 Window 字段滚动区裁切月历。
        const selDatePickerPopover = selDatePickerCreateElement("section", "seldatepicker-popover");
        // 稳定 id 支持触发器控制关系和自动化定位。
        selDatePickerPopover.id = selDatePickerPopoverId;
        // dialog 说明月份选择属于一个聚焦交互区域。
        selDatePickerPopover.setAttribute("role", "dialog");
        // 可访问名称包含业务字段名称。
        selDatePickerPopover.setAttribute("aria-label", String(selDatePickerMessages.chooseTemplate || "选择{label}").replaceAll("{label}", selDatePickerLabel));
        // 初始不参与布局和命中。
        selDatePickerPopover.hidden = true;

        // 月份头部包含上月、当前年月和下月。
        const selDatePickerHeader = selDatePickerCreateElement("header", "seldatepicker-header");
        // 上月按钮提供明确动作名称。
        const selDatePickerPrevious = selDatePickerCreateElement("button", "seldatepicker-navigation-button");
        // 非提交按钮保持表单安全。
        selDatePickerPrevious.type = "button";
        // 读屏名称不依赖箭头图形。
        selDatePickerPrevious.setAttribute("aria-label", selDatePickerMessages.previousMonth || "上个月");
        // 使用左箭头图标表达向前导航。
        selDatePickerPrevious.appendChild(selDatePickerCreateIcon("ri-arrow-left-s-line"));
        // 年月标题在每次导航后刷新。
        const selDatePickerMonthTitle = selDatePickerCreateElement("div", "seldatepicker-month-title");
        // aria-live 让键盘翻月时播报新月份。
        selDatePickerMonthTitle.setAttribute("aria-live", "polite");
        // 下月按钮与上月按钮采用镜像结构。
        const selDatePickerNext = selDatePickerCreateElement("button", "seldatepicker-navigation-button");
        // 非提交按钮保持表单安全。
        selDatePickerNext.type = "button";
        // 读屏名称说明向后导航。
        selDatePickerNext.setAttribute("aria-label", selDatePickerMessages.nextMonth || "下个月");
        // 使用右箭头图标表达向后导航。
        selDatePickerNext.appendChild(selDatePickerCreateIcon("ri-arrow-right-s-line"));
        // 月份导航按左、标题、右的稳定顺序装配。
        selDatePickerHeader.append(selDatePickerPrevious, selDatePickerMonthTitle, selDatePickerNext);

        // 星期标题与日期网格分别承担列说明和交互按钮。
        const selDatePickerWeekdayRow = selDatePickerCreateElement("div", "seldatepicker-weekdays");
        // 星期标题不重复进入键盘焦点。
        selDatePickerWeekdayRow.setAttribute("aria-hidden", "true");
        function selDatePickerRenderWeekdays() {
            const selDatePickerWeekdays = Array.isArray(selDatePickerMessages.weekdays) ? selDatePickerMessages.weekdays : ["一", "二", "三", "四", "五", "六", "日"];
            selDatePickerWeekdayRow.replaceChildren(...selDatePickerWeekdays.map((selDatePickerWeekday) => selDatePickerCreateElement("span", "seldatepicker-weekday", selDatePickerWeekday)));
        }
        selDatePickerRenderWeekdays();
        // 日期网格由 render 按当前月份重建 42 个日期按钮。
        const selDatePickerDays = selDatePickerCreateElement("div", "seldatepicker-days");
        // grid 语义帮助辅助技术理解二维日期选择。
        selDatePickerDays.setAttribute("role", "grid");
        // 可访问名称随字段含义保持明确。
        selDatePickerDays.setAttribute("aria-label", String(selDatePickerMessages.calendarTemplate || "{label}月历").replaceAll("{label}", selDatePickerLabel));

        // 底部提供清除、今天和确定三类稳定动作。
        const selDatePickerFooter = selDatePickerCreateElement("footer", "seldatepicker-footer");
        // 清除会提交空日期并关闭控件。
        const selDatePickerClear = selDatePickerCreateElement("button", "seldatepicker-action", selDatePickerMessages.clear || "清除");
        // 非提交按钮不触发外层业务表单。
        selDatePickerClear.type = "button";
        // 今天只移动待选日期，用户仍通过确定提交。
        const selDatePickerToday = selDatePickerCreateElement("button", "seldatepicker-action", selDatePickerMessages.today || "今天");
        // 非提交按钮不触发外层业务表单。
        selDatePickerToday.type = "button";
        // 确定是月历唯一主要操作。
        const selDatePickerConfirm = selDatePickerCreateElement("button", "seldatepicker-action seldatepicker-action-primary", selDatePickerMessages.confirm || "确定");
        // 非提交按钮只提交日期到原生 input。
        selDatePickerConfirm.type = "button";
        // 三个动作按清理、快捷选择和确认顺序装配。
        selDatePickerFooter.append(selDatePickerClear, selDatePickerToday, selDatePickerConfirm);
        // 完整浮层按月份头、星期、日期和动作区装配。
        selDatePickerPopover.append(selDatePickerHeader, selDatePickerWeekdayRow, selDatePickerDays, selDatePickerFooter);
        // body 门户确保浮层跨越 Window 内部滚动边界。
        document.body.appendChild(selDatePickerPopover);

        // 当前实例状态区分已经提交的日期与尚未确认的待选日期。
        const selDatePickerInitial = selDatePickerParseIso(selDatePickerInput.value);
        // 没有初始值时使用今天作为首次打开的观察月份。
        const selDatePickerFallbackToday = new Date();
        // 状态保存打开、提交、待选、活动焦点和当前观察月份。
        const selDatePickerState = {
            open: false,
            committed: selDatePickerInitial,
            pending: selDatePickerInitial,
            active: selDatePickerInitial || selDatePickerFallbackToday,
            view: new Date((selDatePickerInitial || selDatePickerFallbackToday).getFullYear(), (selDatePickerInitial || selDatePickerFallbackToday).getMonth(), 1)
        };

        /** 同步触发器日期文案和可访问名称。 */
        function selDatePickerSyncTrigger() {
            // 原生值重新解析，确保外部赋值后显示不漂移。
            const selDatePickerCommitted = selDatePickerParseIso(selDatePickerInput.value);
            // 控制器提交状态与真实输入保持一致。
            selDatePickerState.committed = selDatePickerCommitted;
            // 有值时使用清晰的年/月/日格式。
            const selDatePickerDisplay = selDatePickerCommitted
                ? new Intl.DateTimeFormat(selDatePickerLocale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(selDatePickerCommitted)
                : selDatePickerPlaceholder;
            // 可见文本同步当前值或占位文案。
            selDatePickerTriggerValue.textContent = selDatePickerDisplay;
            // data 状态让占位色与真实值色清晰区分。
            selDatePickerTriggerValue.dataset.placeholder = String(!selDatePickerCommitted);
            // 按钮名称同时播报字段和当前值。
            selDatePickerTrigger.setAttribute("aria-label", String(selDatePickerMessages.valueTemplate || "{label}：{value}").replaceAll("{label}", selDatePickerLabel).replaceAll("{value}", selDatePickerDisplay));
        }

        /** 把当前浮层夹在视口内并自动选择上下方向。 */
        function selDatePickerPositionPopover() {
            // 隐藏浮层没有可用尺寸，无需定位。
            if (!selDatePickerState.open) return;
            // 触发器矩形是浮层定位锚点。
            const selDatePickerTriggerRect = selDatePickerTrigger.getBoundingClientRect();
            // 显示后的真实宽高包含九宫格边框。
            const selDatePickerPopoverRect = selDatePickerPopover.getBoundingClientRect();
            // 默认与触发器左边对齐，再限制在视口安全区内。
            const selDatePickerLeft = Math.min(
                Math.max(selDatePickerViewportGap, selDatePickerTriggerRect.left),
                Math.max(selDatePickerViewportGap, window.innerWidth - selDatePickerPopoverRect.width - selDatePickerViewportGap)
            );
            // 下方剩余空间用于决定是否向上展开。
            const selDatePickerSpaceBelow = window.innerHeight - selDatePickerTriggerRect.bottom - selDatePickerViewportGap;
            // 上方剩余空间用于回退判断。
            const selDatePickerSpaceAbove = selDatePickerTriggerRect.top - selDatePickerViewportGap;
            // 下方不足且上方更充足时把浮层放在触发器上方。
            const selDatePickerUseTop = selDatePickerSpaceBelow < selDatePickerPopoverRect.height + 8 && selDatePickerSpaceAbove > selDatePickerSpaceBelow;
            // 候选顶部根据方向留出 8px 呼吸间距。
            const selDatePickerCandidateTop = selDatePickerUseTop
                ? selDatePickerTriggerRect.top - selDatePickerPopoverRect.height - 8
                : selDatePickerTriggerRect.bottom + 8;
            // 最终顶部限制在上下安全区内。
            const selDatePickerTop = Math.min(
                Math.max(selDatePickerViewportGap, selDatePickerCandidateTop),
                Math.max(selDatePickerViewportGap, window.innerHeight - selDatePickerPopoverRect.height - selDatePickerViewportGap)
            );
            // fixed 左坐标直接使用视口坐标。
            selDatePickerPopover.style.left = `${selDatePickerLeft}px`;
            // fixed 顶坐标直接使用视口坐标。
            selDatePickerPopover.style.top = `${selDatePickerTop}px`;
            // data 方向供自动化和后续箭头装饰读取。
            selDatePickerPopover.dataset.placement = selDatePickerUseTop ? "top" : "bottom";
        }

        /** 把焦点移动到当前活动日期按钮。 */
        function selDatePickerFocusActiveDay() {
            // 活动日期以标准值匹配当前重新绘制的按钮。
            const selDatePickerActiveButton = selDatePickerDays.querySelector(`[data-sel-date-picker-date="${selDatePickerFormatIso(selDatePickerState.active)}"]`);
            // 只有存在且可选的日期才能接收键盘焦点。
            if (selDatePickerActiveButton instanceof HTMLButtonElement && !selDatePickerActiveButton.disabled) selDatePickerActiveButton.focus({ preventScroll: true });
        }

        /** 绘制当前观察月份的 42 个日期格。 */
        function selDatePickerRender() {
            // 标题显示完整年份和自然月份。
            selDatePickerMonthTitle.textContent = new Intl.DateTimeFormat(selDatePickerLocale, { year: "numeric", month: "long" }).format(selDatePickerState.view);
            // 清空旧日期按钮，避免翻月后保留错误状态。
            selDatePickerDays.replaceChildren();
            // 当月一号决定周一制网格前置多少天。
            const selDatePickerMonthStart = new Date(selDatePickerState.view.getFullYear(), selDatePickerState.view.getMonth(), 1);
            // 原生周日为 0，转换为周一 0 到周日 6。
            const selDatePickerLeadingDays = (selDatePickerMonthStart.getDay() + 6) % 7;
            // 首格从当月一号向前补齐到周一。
            const selDatePickerGridStart = selDatePickerAddDays(selDatePickerMonthStart, -selDatePickerLeadingDays);
            // 今天每次绘制时读取，跨午夜后无需重新装配控件。
            const selDatePickerTodayValue = selDatePickerFormatIso(new Date());
            // 固定 42 格保持所有月份高度一致，避免 Window 中浮层上下跳动。
            for (let selDatePickerIndex = 0; selDatePickerIndex < 42; selDatePickerIndex += 1) {
                // 当前格日期由首格连续递增得到。
                const selDatePickerDate = selDatePickerAddDays(selDatePickerGridStart, selDatePickerIndex);
                // 标准值用于比较、提交和自动化定位。
                const selDatePickerDateValue = selDatePickerFormatIso(selDatePickerDate);
                // 是否属于观察月份决定弱化样式。
                const selDatePickerIsCurrentMonth = selDatePickerDate.getMonth() === selDatePickerState.view.getMonth();
                // 待确认日期获得主选中态。
                const selDatePickerIsSelected = Boolean(selDatePickerState.pending && selDatePickerFormatIso(selDatePickerState.pending) === selDatePickerDateValue);
                // 活动日期决定唯一 tabIndex=0 的网格入口。
                const selDatePickerIsActive = selDatePickerFormatIso(selDatePickerState.active) === selDatePickerDateValue;
                // 日期按钮保留标准 button 交互和真实文本。
                const selDatePickerDayButton = selDatePickerCreateElement("button", "seldatepicker-day", String(selDatePickerDate.getDate()));
                // 非提交按钮只影响日期控件状态。
                selDatePickerDayButton.type = "button";
                // 稳定日期值用于点击和键盘焦点恢复。
                selDatePickerDayButton.dataset.selDatePickerDate = selDatePickerDateValue;
                // 完整中文日期让读屏用户不依赖网格上下文猜测。
                selDatePickerDayButton.setAttribute("aria-label", new Intl.DateTimeFormat(selDatePickerLocale, { year: "numeric", month: "long", day: "numeric" }).format(selDatePickerDate));
                // 选中态通过 aria-selected 暴露给网格语义。
                selDatePickerDayButton.setAttribute("aria-selected", String(selDatePickerIsSelected));
                // 网格只保留一个顺序焦点入口，其余用箭头导航。
                selDatePickerDayButton.tabIndex = selDatePickerIsActive ? 0 : -1;
                // min/max 约束直接控制按钮禁用状态。
                selDatePickerDayButton.disabled = !selDatePickerIsAllowed(selDatePickerDate, selDatePickerInput);
                // 相邻月份仍可选择，但使用弱化色帮助识别月份边界。
                selDatePickerDayButton.classList.toggle("seldatepicker-day-other-month", !selDatePickerIsCurrentMonth);
                // 今天使用底部青色光标而不是与选中态竞争整块背景。
                selDatePickerDayButton.classList.toggle("seldatepicker-day-today", selDatePickerDateValue === selDatePickerTodayValue);
                // 待选日期使用蓝紫主状态。
                selDatePickerDayButton.classList.toggle("seldatepicker-day-selected", selDatePickerIsSelected);
                // 点击日期只更新待选状态，必须通过确定写入表单。
                selDatePickerDayButton.addEventListener("click", () => {
                    // 新对象隔离 DOM 闭包和控制器状态。
                    selDatePickerState.pending = new Date(selDatePickerDate.getFullYear(), selDatePickerDate.getMonth(), selDatePickerDate.getDate());
                    // 点击日期同时成为下一次键盘导航起点。
                    selDatePickerState.active = new Date(selDatePickerDate.getFullYear(), selDatePickerDate.getMonth(), selDatePickerDate.getDate());
                    // 点击相邻月份日期时同步切换观察月份。
                    selDatePickerState.view = new Date(selDatePickerDate.getFullYear(), selDatePickerDate.getMonth(), 1);
                    // 重绘选中态和月份标题。
                    selDatePickerRender();
                    // 重绘后恢复到当前活动日期。
                    selDatePickerFocusActiveDay();
                });
                // 当前日期按钮进入固定网格顺序。
                selDatePickerDays.appendChild(selDatePickerDayButton);
            }
        }

        /** 关闭当前月历并放弃未确认的待选变化。 */
        function selDatePickerClose(selDatePickerRestoreFocus = false) {
            // 已关闭时只按需恢复触发器焦点。
            if (!selDatePickerState.open) {
                if (selDatePickerRestoreFocus) selDatePickerTrigger.focus({ preventScroll: true });
                return;
            }
            // 打开状态退出后不再参与视口定位。
            selDatePickerState.open = false;
            // 未确认选择回退到真实输入当前值。
            selDatePickerState.pending = selDatePickerState.committed;
            // 浮层完全退出布局和命中。
            selDatePickerPopover.hidden = true;
            // 宿主状态类同步关闭发光和箭头。
            selDatePickerHost.classList.remove("seldatepicker-root-open");
            // 辅助技术读取关闭状态。
            selDatePickerTrigger.setAttribute("aria-expanded", "false");
            // 键盘关闭时把焦点交还触发器。
            if (selDatePickerRestoreFocus) selDatePickerTrigger.focus({ preventScroll: true });
        }

        /** 打开当前月历并从真实值建立待选状态。 */
        function selDatePickerOpen() {
            // 打开前关闭其他日期浮层，避免多个 body 门户叠加。
            selDatePickerControllerSet.forEach((selDatePickerOtherController) => {
                if (selDatePickerOtherController.host !== selDatePickerHost) selDatePickerOtherController.close();
            });
            // 真实输入值是每次打开的提交起点。
            selDatePickerState.committed = selDatePickerParseIso(selDatePickerInput.value);
            // 待选状态复制提交值，Escape 可以安全放弃修改。
            selDatePickerState.pending = selDatePickerState.committed;
            // 当前值或今天作为键盘活动日期。
            selDatePickerState.active = selDatePickerState.committed || new Date();
            // 观察月份同步活动日期。
            selDatePickerState.view = new Date(selDatePickerState.active.getFullYear(), selDatePickerState.active.getMonth(), 1);
            // 绘制当前月份后再测量浮层尺寸。
            selDatePickerRender();
            // 状态先置为打开，定位函数才能执行。
            selDatePickerState.open = true;
            // 浮层进入布局后可以获得真实几何。
            selDatePickerPopover.hidden = false;
            // 宿主状态驱动触发器发光和箭头旋转。
            selDatePickerHost.classList.add("seldatepicker-root-open");
            // 辅助技术读取打开状态。
            selDatePickerTrigger.setAttribute("aria-expanded", "true");
            // 测量并夹取到可见视口。
            selDatePickerPositionPopover();
            // 下一帧把焦点移动到活动日期，确保键盘可直接选日。
            requestAnimationFrame(selDatePickerFocusActiveDay);
        }

        /** 把待选日期写入原生 input 并通知表单消费者。 */
        function selDatePickerCommitPending() {
            // 没有待选日期时保持原值，只关闭浮层。
            if (!selDatePickerState.pending) {
                selDatePickerClose(true);
                return;
            }
            // 标准值写入真实输入，FormData 和 required 校验立即生效。
            selDatePickerInput.value = selDatePickerFormatIso(selDatePickerState.pending);
            // 提交状态复制待选日期，Escape 不会再回滚已确认结果。
            selDatePickerState.committed = new Date(selDatePickerState.pending.getFullYear(), selDatePickerState.pending.getMonth(), selDatePickerState.pending.getDate());
            // input 事件支持实时业务监听。
            selDatePickerInput.dispatchEvent(new Event("input", { bubbles: true }));
            // change 事件保持与原生日期控件的确认语义一致。
            selDatePickerInput.dispatchEvent(new Event("change", { bubbles: true }));
            // 可见触发器同步确认后的值。
            selDatePickerSyncTrigger();
            // 确认后关闭并把焦点交还字段。
            selDatePickerClose(true);
        }

        /** 根据键盘动作移动活动日期并保持焦点。 */
        function selDatePickerMoveActive(selDatePickerNextDate) {
            // 超出 min/max 的日期不进入活动状态。
            if (!selDatePickerIsAllowed(selDatePickerNextDate, selDatePickerInput)) return;
            // 活动日期使用独立对象，避免共享引用被后续修改。
            selDatePickerState.active = new Date(selDatePickerNextDate.getFullYear(), selDatePickerNextDate.getMonth(), selDatePickerNextDate.getDate());
            // 跨月移动时月标题和网格同步更新。
            selDatePickerState.view = new Date(selDatePickerNextDate.getFullYear(), selDatePickerNextDate.getMonth(), 1);
            // 重绘活动入口和相邻月份状态。
            selDatePickerRender();
            // 重绘后恢复当前活动日期焦点。
            selDatePickerFocusActiveDay();
        }

        // 触发器在点击时切换同一实例的打开与关闭状态。
        selDatePickerTrigger.addEventListener("click", () => {
            // 打开状态再次点击执行收起，并保留已提交值。
            if (selDatePickerState.open) selDatePickerClose();
            // 关闭状态点击进入月历选择。
            else selDatePickerOpen();
        });
        // 上个月按钮从当前活动日期向前移动一个月。
        selDatePickerPrevious.addEventListener("click", () => selDatePickerMoveActive(selDatePickerAddMonths(selDatePickerState.active, -1)));
        // 下个月按钮从当前活动日期向后移动一个月。
        selDatePickerNext.addEventListener("click", () => selDatePickerMoveActive(selDatePickerAddMonths(selDatePickerState.active, 1)));
        // 今天按钮只更新待选状态和观察月份，等待用户确定。
        selDatePickerToday.addEventListener("click", () => {
            // 今天按本地日期创建，避免 UTC 时区跨日。
            const selDatePickerTodayDate = new Date();
            // min/max 不允许今天时保持现有待选状态。
            if (!selDatePickerIsAllowed(selDatePickerTodayDate, selDatePickerInput)) return;
            // 今天成为待确认值。
            selDatePickerState.pending = new Date(selDatePickerTodayDate.getFullYear(), selDatePickerTodayDate.getMonth(), selDatePickerTodayDate.getDate());
            // 今天成为键盘活动日期。
            selDatePickerState.active = new Date(selDatePickerTodayDate.getFullYear(), selDatePickerTodayDate.getMonth(), selDatePickerTodayDate.getDate());
            // 月视图切回今天所在月份。
            selDatePickerState.view = new Date(selDatePickerTodayDate.getFullYear(), selDatePickerTodayDate.getMonth(), 1);
            // 更新月历选中态。
            selDatePickerRender();
            // 保持用户在日期网格中的操作焦点。
            selDatePickerFocusActiveDay();
        });
        // 清除立即提交空值，使必填校验与可见文本同步。
        selDatePickerClear.addEventListener("click", () => {
            // 原生输入清空后 FormData 不再携带日期文本。
            selDatePickerInput.value = "";
            // 控制器提交和待选状态同步为空。
            selDatePickerState.committed = null;
            // 待选状态清空，下一次打开仍从今天观察。
            selDatePickerState.pending = null;
            // input 事件通知实时消费者日期已清除。
            selDatePickerInput.dispatchEvent(new Event("input", { bubbles: true }));
            // change 事件保持原生确认语义。
            selDatePickerInput.dispatchEvent(new Event("change", { bubbles: true }));
            // 触发器恢复占位文案。
            selDatePickerSyncTrigger();
            // 清除完成后关闭浮层并恢复字段焦点。
            selDatePickerClose(true);
        });
        // 确定按钮把待选日期写入真实输入。
        selDatePickerConfirm.addEventListener("click", selDatePickerCommitPending);
        // 日期网格统一处理方向键、翻月和确认键。
        selDatePickerDays.addEventListener("keydown", (selDatePickerEvent) => {
            // 默认不处理的按键保留浏览器行为。
            let selDatePickerNextDate = null;
            // 左右箭头按自然日移动。
            if (selDatePickerEvent.key === "ArrowLeft") selDatePickerNextDate = selDatePickerAddDays(selDatePickerState.active, -1);
            if (selDatePickerEvent.key === "ArrowRight") selDatePickerNextDate = selDatePickerAddDays(selDatePickerState.active, 1);
            // 上下箭头按星期移动。
            if (selDatePickerEvent.key === "ArrowUp") selDatePickerNextDate = selDatePickerAddDays(selDatePickerState.active, -7);
            if (selDatePickerEvent.key === "ArrowDown") selDatePickerNextDate = selDatePickerAddDays(selDatePickerState.active, 7);
            // PageUp 和 PageDown 保留日号切换月份。
            if (selDatePickerEvent.key === "PageUp") selDatePickerNextDate = selDatePickerAddMonths(selDatePickerState.active, -1);
            if (selDatePickerEvent.key === "PageDown") selDatePickerNextDate = selDatePickerAddMonths(selDatePickerState.active, 1);
            // Home 移动到当前周周一。
            if (selDatePickerEvent.key === "Home") selDatePickerNextDate = selDatePickerAddDays(selDatePickerState.active, -((selDatePickerState.active.getDay() + 6) % 7));
            // End 移动到当前周周日。
            if (selDatePickerEvent.key === "End") selDatePickerNextDate = selDatePickerAddDays(selDatePickerState.active, 6 - ((selDatePickerState.active.getDay() + 6) % 7));
            // 已命中导航键时阻止页面滚动并更新活动日期。
            if (selDatePickerNextDate) {
                // 方向键只服务月历，不滚动 Window 字段区。
                selDatePickerEvent.preventDefault();
                // 统一移动入口处理范围和跨月重绘。
                selDatePickerMoveActive(selDatePickerNextDate);
                // 导航完成后不继续处理确认键。
                return;
            }
            // Enter 或 Space 把活动日期设为待选但不立即提交。
            if (selDatePickerEvent.key === "Enter" || selDatePickerEvent.key === " ") {
                // 阻止按钮默认 click 造成重复处理。
                selDatePickerEvent.preventDefault();
                // 活动日期复制为待选日期。
                selDatePickerState.pending = new Date(selDatePickerState.active.getFullYear(), selDatePickerState.active.getMonth(), selDatePickerState.active.getDate());
                // 重绘蓝紫选中态。
                selDatePickerRender();
                // 保持网格焦点供继续调整。
                selDatePickerFocusActiveDay();
            }
        });
        // 浮层 Escape 放弃未确认日期并返回触发器。
        selDatePickerPopover.addEventListener("keydown", (selDatePickerEvent) => {
            // 只有 Escape 执行关闭，Tab 继续自然遍历浮层按钮。
            if (selDatePickerEvent.key !== "Escape") return;
            // 阻止 Window 同一按键继续关闭整个窗体。
            selDatePickerEvent.preventDefault();
            // 阻止事件冒泡到 Window 的 Escape 处理器。
            selDatePickerEvent.stopPropagation();
            // 关闭月历并恢复触发器焦点。
            selDatePickerClose(true);
        });
        // 点击浮层和宿主以外区域时放弃待选并关闭。
        document.addEventListener("pointerdown", (selDatePickerEvent) => {
            // 关闭状态无需检查事件目标。
            if (!selDatePickerState.open) return;
            // 触发器内部点击由自身切换逻辑处理。
            if (selDatePickerHost.contains(selDatePickerEvent.target)) return;
            // 浮层内部点击保留当前操作。
            if (selDatePickerPopover.contains(selDatePickerEvent.target)) return;
            // 外部点击关闭但不抢夺用户的新焦点。
            selDatePickerClose();
        });
        // 视口变化时重新夹取浮层，保持 Window 最大化和浏览器缩放后的可见性。
        window.addEventListener("resize", selDatePickerPositionPopover);
        // 页面滚动可能改变 fixed 锚点位置，捕获阶段同步重算。
        window.addEventListener("scroll", selDatePickerPositionPopover, true);
        // 外部脚本修改原生 input 后刷新可见值。
        selDatePickerInput.addEventListener("change", selDatePickerSyncTrigger);

        // 原位更新日期组件公共文案和格式，已选日期、观察月份与打开状态保持不变。
        function selDatePickerSetLocale(selDatePickerLocaleUpdate = {}) {
            const selDatePickerNextMessages = selDatePickerLocaleUpdate.resource || selDatePickerLocaleUpdate.messages || {};
            const selDatePickerNextLocale = String(selDatePickerLocaleUpdate.locale || selDatePickerNextMessages.locale || selDatePickerLocale);
            if (!selDatePickerNextLocale || typeof selDatePickerNextMessages !== "object") return false;
            selDatePickerLocale = selDatePickerNextLocale;
            selDatePickerMessages = selDatePickerNextMessages;
            selDatePickerLabel = String(selDatePickerLocaleUpdate.label || selDatePickerHost.dataset.selDatePickerLabel || selDatePickerLabel);
            selDatePickerPlaceholder = String(selDatePickerLocaleUpdate.placeholder || selDatePickerHost.dataset.selDatePickerPlaceholder || selDatePickerPlaceholder);
            selDatePickerPopover.setAttribute("aria-label", String(selDatePickerMessages.chooseTemplate || "选择{label}").replaceAll("{label}", selDatePickerLabel));
            selDatePickerPrevious.setAttribute("aria-label", selDatePickerMessages.previousMonth || "上个月");
            selDatePickerNext.setAttribute("aria-label", selDatePickerMessages.nextMonth || "下个月");
            selDatePickerDays.setAttribute("aria-label", String(selDatePickerMessages.calendarTemplate || "{label}月历").replaceAll("{label}", selDatePickerLabel));
            selDatePickerClear.textContent = selDatePickerMessages.clear || "清除";
            selDatePickerToday.textContent = selDatePickerMessages.today || "今天";
            selDatePickerConfirm.textContent = selDatePickerMessages.confirm || "确定";
            selDatePickerRenderWeekdays();
            selDatePickerSyncTrigger();
            // 关闭状态无需提前创建 42 个日期按钮；下次打开会使用新语言完整绘制。
            if (selDatePickerState.open) selDatePickerRender();
            return true;
        }

        // 公开控制器只暴露装配方真正需要的动作和只读状态。
        const selDatePickerController = Object.freeze({
            // host 用于 closeWithin 判断当前控件是否属于目标 Window。
            host: selDatePickerHost,
            // input 保留给表单校验焦点桥接。
            input: selDatePickerInput,
            // open 允许应用或测试显式打开月历。
            open: selDatePickerOpen,
            // close 放弃未确认选择并关闭浮层。
            close: selDatePickerClose,
            setLocale: selDatePickerSetLocale,
            // refresh 在 form.reset 或外部赋值后同步显示。
            refresh: () => {
                // 重新读取原生真实值。
                selDatePickerSyncTrigger();
                // 打开状态下同步待选、活动与月视图。
                if (selDatePickerState.open) selDatePickerOpen();
            },
            // focus 把校验焦点桥接到可见触发器。
            focus: () => selDatePickerTrigger.focus({ preventScroll: true }),
            // getState 返回标准字符串，避免泄漏可变 Date 对象。
            getState: () => Object.freeze({
                open: selDatePickerState.open,
                value: selDatePickerInput.value,
                pending: selDatePickerState.pending ? selDatePickerFormatIso(selDatePickerState.pending) : "",
                view: `${selDatePickerState.view.getFullYear()}-${selDatePickerPad(selDatePickerState.view.getMonth() + 1)}`
            })
        });
        // 宿主映射用于幂等挂载。
        selDatePickerControllers.set(selDatePickerHost, selDatePickerController);
        // 集合用于跨实例关闭和范围生命周期管理。
        selDatePickerControllerSet.add(selDatePickerController);
        // 初次装配立即显示原生值或占位文案。
        selDatePickerSyncTrigger();
        // 返回控制器给 Window 或其他基础组件。
        return selDatePickerController;
    }

    /**
     * 挂载指定范围内所有标准日期宿主。
     * @param {ParentNode} selDatePickerScope - Window 或页面根节点。
     * @returns {Array<object>} 成功挂载的控制器列表。
     */
    function selDatePickerMountAll(selDatePickerScope = document, selDatePickerOptions = {}) {
        // 只扫描显式 data 契约，禁止根据业务字段名猜测日期控件。
        return Array.from(selDatePickerScope.querySelectorAll("[data-sel-date-picker]"))
            // 每个宿主走幂等单实例入口。
            .map((selDatePickerHost) => selDatePickerMount(selDatePickerHost, selDatePickerOptions))
            // 过滤结构不完整的失败结果。
            .filter(Boolean);
    }

    /**
     * 关闭指定容器内的全部日期浮层。
     * @param {ParentNode} selDatePickerScope - 即将关闭或最小化的 Window。
     */
    function selDatePickerCloseWithin(selDatePickerScope) {
        // 遍历活跃控制器并按 DOM 包含关系判断归属。
        selDatePickerControllerSet.forEach((selDatePickerController) => {
            // 只有属于目标范围的宿主才随 Window 生命周期关闭。
            if (selDatePickerScope.contains(selDatePickerController.host)) selDatePickerController.close();
        });
    }

    /**
     * 根据真实日期 input 获取控制器。
     * @param {HTMLInputElement} selDatePickerInput - 校验或外部更新命中的原生输入。
     * @returns {object|null} 对应控制器或空结果。
     */
    function selDatePickerGetForInput(selDatePickerInput) {
        // 原生输入向上查找标准宿主。
        const selDatePickerHost = selDatePickerInput?.closest?.("[data-sel-date-picker]");
        // 宿主存在时从弱映射读取已装配实例。
        return selDatePickerHost ? selDatePickerControllers.get(selDatePickerHost) || null : null;
    }

    // 全局 API 保持挂载、范围关闭和真实输入桥接三个稳定能力。
    window.selDatePicker = Object.freeze({
        // mount 显式装配单个宿主。
        mount: selDatePickerMount,
        // mountAll 装配页面或 Window 范围内全部日期控件。
        mountAll: selDatePickerMountAll,
        // closeWithin 保证 Window 关闭时 body 门户不残留。
        closeWithin: selDatePickerCloseWithin,
        // getForInput 支持重置和校验焦点桥接。
        getForInput: selDatePickerGetForInput
    });
}());
