/*
 * selSearch.js：通用搜索与查询多实例基础控件。
 * 负责根据标准搜索数据创建图标、关键词输入框、清空按钮和查询按钮，并向所属业务实例发送提交事件。
 * 责任边界：本文件不读取 Uniauth 数据、不请求接口、不直接筛选表格；实际查询行为由所属业务控件响应。
 * 模块级 JavaScript 标识统一使用 selSearch 前缀，公开只读注册表为 window.selSearch。
 */
(function selSearchCreateRegistry(global) {
    "use strict";

    // 注册表按完整业务实例名保存控制器，保证同页多个搜索框互不共享关键词和加载状态。
    const selSearchInstances = new Map();

    // 创建装饰图标节点，所有交互语义继续由按钮文字和 aria-label 表达。
    function selSearchCreateIcon(selSearchClassName) {
        // i 元素使用项目统一 Remix Icon 类。
        const selSearchIcon = document.createElement("i");
        // 图标类由标准搜索数据提供，缺失时由调用处传入通用回退。
        selSearchIcon.className = selSearchClassName;
        // 装饰图标不进入辅助技术朗读顺序。
        selSearchIcon.setAttribute("aria-hidden", "true");
        // 返回可直接插入搜索结构的图标节点。
        return selSearchIcon;
    }

    /**
     * 创建一个业务实例的搜索控件。
     * @param {Element} selSearchGridRoot - 包含 data-sel-grid 的当前业务实例根。
     * @param {object} selSearchData - 应用装配层传入的本地化搜索 JSON。
     * @returns {object|null} 成功时返回当前实例控制器，宿主或数据缺失时返回 null。
     */
    function selSearchCreateInstance(selSearchGridRoot, selSearchData) {
        // 完整实例键决定事件归属和公开查询入口。
        const selSearchGridId = selSearchGridRoot.dataset.selGrid;
        // 搜索宿主只能在当前实例范围内取得。
        const selSearchHost = selSearchGridRoot.querySelector('[data-sel-grid-role="search-host"]');
        // 缺少实例键、宿主或标准搜索数据时不创建半成品控件。
        if (!selSearchGridId || !selSearchHost || !selSearchData) {
            return null;
        }
        // 当前语言配置可由统一语言管理器原位替换，输入值和加载状态不随文案切换重建。
        let selSearchLocaleData = selSearchData;

        // 原生 form 提供 Enter 提交、键盘导航和搜索语义。
        const selSearchForm = document.createElement("form");
        // 根类负责水晶边框和内部按钮布局。
        selSearchForm.className = "selsearch-form";
        // search 角色让辅助技术快速识别查询区域。
        selSearchForm.setAttribute("role", "search");
        // 可访问名称由当前语言 JSON 提供。
        selSearchForm.setAttribute("aria-label", selSearchLocaleData.label || "搜索");
        // 浏览器不对演示页面执行真实页面跳转。
        selSearchForm.action = "";

        // 输入区域组合搜索图标、隐藏标签、输入框和清空按钮。
        const selSearchField = document.createElement("label");
        // 字段类负责输入内容自适应占满剩余宽度。
        selSearchField.className = "selsearch-field";
        // 搜索图标来自人工配置，未提供时回退通用搜索图标。
        selSearchField.appendChild(selSearchCreateIcon(selSearchData.icon || "ri-search-line"));

        // 隐藏标签为输入框提供独立业务名称。
        const selSearchLabel = document.createElement("span");
        // 搜索组件使用自己的隐藏文字类，不依赖表格内部样式。
        selSearchLabel.className = "selsearch-accessibility-label";
        // 标签文字来自当前语言搜索 JSON。
        selSearchLabel.textContent = selSearchLocaleData.label || "搜索";

        // 原生 search 输入保留移动端键盘、清除语义和浏览器自动填充控制。
        const selSearchInput = document.createElement("input");
        // 输入框使用组件分组前缀，避免样式泄漏到其他表单。
        selSearchInput.className = "selsearch-field-input";
        // 搜索类型表达关键词用途。
        selSearchInput.type = "search";
        // 禁用浏览器历史补全，演示数据不会混入旧关键词。
        selSearchInput.autocomplete = "off";
        // 当前语言可访问名称与隐藏标签一致。
        selSearchInput.setAttribute("aria-label", selSearchLocaleData.label || "搜索");
        // 占位文字解释可搜索字段。
        selSearchInput.placeholder = selSearchLocaleData.placeholder || "";
        // 默认关键词由数据显式提供。
        selSearchInput.value = String(selSearchData.defaultValue || "");

        // 清空按钮只在配置允许且输入非空时显示。
        const selSearchClearButton = document.createElement("button");
        // 独立清空按钮使用紧凑圆形视觉。
        selSearchClearButton.className = "selsearch-field-clear";
        // 清空操作不得触发表单默认提交。
        selSearchClearButton.type = "button";
        // 当前语言完整说明用于鼠标悬停和屏幕阅读器。
        selSearchClearButton.setAttribute("aria-label", selSearchLocaleData.clearLabel || "清空");
        // 清空图标允许应用选择视觉，但不改变动作语义。
        selSearchClearButton.appendChild(selSearchCreateIcon(selSearchData.clearIcon || "ri-close-line"));

        // 查询按钮是搜索控件唯一显式提交入口。
        const selSearchSubmitButton = document.createElement("button");
        // 主按钮使用水晶高亮，和重置等次级动作形成层级。
        selSearchSubmitButton.className = "selsearch-submit-button";
        // submit 类型让鼠标点击和 Enter 共用同一提交路径。
        selSearchSubmitButton.type = "submit";
        // 按钮图标来自搜索 JSON。
        selSearchSubmitButton.appendChild(selSearchCreateIcon(selSearchData.buttonIcon || "ri-search-line"));
        // 可见文字明确表达“查询”或其他应用自定义动作。
        const selSearchSubmitLabel = document.createElement("span");
        // 文案类用于紧凑屏幕隐藏策略。
        selSearchSubmitLabel.className = "selsearch-submit-label";
        // 按钮名称完全由当前语言 JSON 控制。
        selSearchSubmitLabel.textContent = selSearchLocaleData.buttonLabel || "查询";
        // 图标与文字共同加入主按钮。
        selSearchSubmitButton.appendChild(selSearchSubmitLabel);

        // 输入区域按图标、标签、输入框和清空按钮顺序组装。
        selSearchField.append(selSearchLabel, selSearchInput, selSearchClearButton);
        // 字段和查询按钮加入原生搜索表单。
        selSearchForm.append(selSearchField, selSearchSubmitButton);
        // 当前宿主只保存本组件生成的结构。
        selSearchHost.replaceChildren(selSearchForm);

        // 控件状态只保存当前实例值和加载标记。
        const selSearchState = {
            // value 是最后一次提交或外部设置后的搜索关键词。
            value: selSearchInput.value,
            // loading 防止查询进行中重复提交。
            loading: false
        };

        // 根据输入内容同步清空按钮，空值时避免显示无效动作。
        function selSearchSyncClearButton() {
            // 配置关闭清空能力时按钮始终隐藏。
            const selSearchCanClear = selSearchLocaleData.clearable !== false && Boolean(selSearchInput.value);
            // hidden 属性同时控制视觉和辅助技术。
            selSearchClearButton.hidden = !selSearchCanClear;
        }

        // 向当前业务实例广播查询，不直接接触表格内部状态或接口路径。
        function selSearchSubmit() {
            // 加载状态下拒绝重复提交。
            if (selSearchState.loading) {
                return false;
            }
            // 当前输入转为字符串并按配置决定是否去除首尾空格。
            const selSearchKeyword = selSearchLocaleData.trim === false ? selSearchInput.value : selSearchInput.value.trim();
            // 不允许空查询时保持焦点并停止事件。
            if (selSearchLocaleData.allowEmpty === false && !selSearchKeyword) {
                selSearchInput.focus();
                return false;
            }
            // 保存最后提交值，供公开控制器读取。
            selSearchState.value = selSearchKeyword;
            // 输入框同步规范化后的关键词。
            selSearchInput.value = selSearchKeyword;
            // 当前实例根广播稳定查询事件。
            selSearchGridRoot.dispatchEvent(new CustomEvent("selSearch:submit", {
                // 事件允许页面更高层监听，但 detail 保留完整实例键。
                bubbles: true,
                // 事件详情只包含通用实例标识和关键词。
                detail: {
                    gridId: selSearchGridId,
                    keyword: selSearchKeyword
                }
            }));
            // 同步清空按钮可见性。
            selSearchSyncClearButton();
            // true 表示查询事件已经成功发出。
            return true;
        }

        // 设置输入值但不擅自提交，调用方可明确决定刷新时机。
        function selSearchSetValue(selSearchValue) {
            // 可空值统一转换为空字符串。
            selSearchInput.value = String(selSearchValue ?? "");
            // 控制器状态同步外部设置值。
            selSearchState.value = selSearchInput.value;
            // 清空按钮跟随最新输入状态。
            selSearchSyncClearButton();
            // true 表示当前实例输入已更新。
            return true;
        }

        // 清空当前实例关键词，并按调用选项决定是否立即查询全部结果。
        function selSearchClear(selSearchOptions = {}) {
            // 输入框与控制器状态同时恢复空值。
            selSearchSetValue("");
            // 默认遵循 JSON 的 submitOnClear；调用方可用 submit 明确覆盖。
            const selSearchShouldSubmit = selSearchOptions.submit ?? (selSearchLocaleData.submitOnClear !== false);
            // 需要刷新时复用统一提交入口。
            if (selSearchShouldSubmit) {
                selSearchSubmit();
            }
            // 清空后把键盘焦点送回输入框，便于继续输入。
            selSearchInput.focus();
            // true 表示清空动作完成。
            return true;
        }

        // 设置查询加载状态，避免重复点击并向辅助技术表达忙碌。
        function selSearchSetLoading(selSearchLoading) {
            // 任意输入转换为明确布尔状态。
            selSearchState.loading = Boolean(selSearchLoading);
            // 查询按钮在加载期间不可操作。
            selSearchSubmitButton.disabled = selSearchState.loading;
            // 搜索表单通过 aria-busy 表达异步状态。
            selSearchForm.setAttribute("aria-busy", String(selSearchState.loading));
            // true 表示状态已经应用。
            return true;
        }

        // 输入变化只更新清空按钮，不再直接筛选表格。
        selSearchInput.addEventListener("input", selSearchSyncClearButton);
        // 表单提交统一承接按钮点击和 Enter。
        selSearchForm.addEventListener("submit", (selSearchEvent) => {
            // 阻止浏览器跳转或刷新页面。
            selSearchEvent.preventDefault();
            // 配置关闭 Enter 时，键盘提交由 keydown 分支阻止；按钮仍可查询。
            selSearchSubmit();
        });
        // 输入框显式处理 Enter，避免不同浏览器对 search 表单原生提交行为不一致。
        selSearchInput.addEventListener("keydown", (selSearchEvent) => {
            // 非 Enter 键保留输入框默认行为。
            if (selSearchEvent.key !== "Enter") {
                return;
            }
            // Enter 始终阻止页面跳转，查询是否执行由配置决定。
            selSearchEvent.preventDefault();
            // 配置允许时复用统一提交入口。
            if (selSearchLocaleData.submitOnEnter !== false) {
                selSearchSubmit();
            }
        });
        // 清空按钮只控制当前实例。
        selSearchClearButton.addEventListener("click", () => selSearchClear());
        // 首次同步清空按钮，默认空关键词时不显示。
        selSearchSyncClearButton();

        // 运行时切换只替换可见文案与行为配置，不重建输入框，因此关键词、焦点和加载状态保持不变。
        function selSearchSetLocale(selSearchNext = {}) {
            const selSearchNextData = selSearchNext.resource || selSearchNext.messages || selSearchNext;
            if (!selSearchNextData || typeof selSearchNextData !== "object") return false;
            selSearchLocaleData = selSearchNextData;
            selSearchForm.setAttribute("aria-label", selSearchLocaleData.label || "搜索");
            selSearchLabel.textContent = selSearchLocaleData.label || "搜索";
            selSearchInput.setAttribute("aria-label", selSearchLocaleData.label || "搜索");
            selSearchInput.placeholder = selSearchLocaleData.placeholder || "";
            selSearchClearButton.setAttribute("aria-label", selSearchLocaleData.clearLabel || "清空");
            selSearchSubmitLabel.textContent = selSearchLocaleData.buttonLabel || "查询";
            selSearchSyncClearButton();
            return true;
        }

        // 返回冻结控制器，应用和其他基础控件只能通过稳定方法协作。
        return Object.freeze({
            // id 是完整业务实例键。
            id: selSearchGridId,
            // root 是当前搜索宿主，便于布局调试。
            root: selSearchHost,
            // input 暴露原生输入供表单集成，但业务逻辑不得修改内部类。
            input: selSearchInput,
            // submit 触发当前关键词查询。
            submit: selSearchSubmit,
            // clear 清空当前关键词并可选提交。
            clear: selSearchClear,
            // focus 把键盘焦点移到当前输入框。
            focus: () => selSearchInput.focus(),
            // setValue 更新当前实例输入。
            setValue: selSearchSetValue,
            // getValue 返回当前输入框的实时值。
            getValue: () => selSearchInput.value,
            // setLoading 控制重复提交和忙碌语义。
            setLoading: selSearchSetLoading,
            // isLoading 返回当前实例查询状态。
            isLoading: () => selSearchState.loading,
            // setLocale 供统一语言管理器原位替换公共文案。
            setLocale: selSearchSetLocale
        });
    }

    // 公开注册表由应用装配层显式挂载，基础脚本加载后不扫描业务页面。
    global.selSearch = Object.freeze({
        /**
         * 挂载一个搜索实例。
         * @param {Element} selSearchGridRoot - 当前业务实例根。
         * @param {object} selSearchData - 当前语言搜索 JSON。
         * @returns {object|null} 当前实例控制器。
         */
        mount(selSearchGridRoot, selSearchData) {
            // 非元素宿主无法形成独立组件作用域。
            if (!(selSearchGridRoot instanceof Element)) {
                return null;
            }
            // 完整业务实例名是注册表唯一键。
            const selSearchGridId = selSearchGridRoot.dataset.selGrid;
            // 重复挂载直接返回现有控制器，避免重复绑定提交事件。
            if (selSearchGridId && selSearchInstances.has(selSearchGridId)) {
                return selSearchInstances.get(selSearchGridId);
            }
            // 当前调用只使用显式传入的数据创建实例。
            const selSearchInstance = selSearchCreateInstance(selSearchGridRoot, selSearchData);
            // 有效实例才进入公开注册表。
            if (selSearchInstance) {
                selSearchInstances.set(selSearchInstance.id, selSearchInstance);
            }
            // 调用方通过返回值判断挂载是否成功。
            return selSearchInstance;
        },
        // get 按完整业务实例名读取控制器。
        get: (selSearchGridId) => selSearchInstances.get(selSearchGridId) || null,
        // has 判断目标实例是否已经挂载。
        has: (selSearchGridId) => selSearchInstances.has(selSearchGridId)
    });
})(window);
