/*
 * selSearch.js：通用搜索与查询多实例基础控件。
 * 负责根据标准搜索数据创建图标、关键词输入框、清空按钮和查询按钮，并向所属业务实例发送提交事件。
 * 责任边界：本文件不读取 具体应用 数据、不请求接口、不直接筛选表格；实际查询行为由所属业务控件响应。
 * 模块级 JavaScript 标识统一使用 selSearch 前缀，公开只读注册表为 window.sel.components.search。
 */
(function selSearchCreateRegistry(global) {
    "use strict";

    const selFreeze = window.sel.core.freeze;

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

        // fields 存在时每个字段都是独立后台查询条件；旧调用方继续得到 keyword 单字段。
        const selSearchFieldDefinitions = Array.isArray(selSearchData.fields) && selSearchData.fields.length > 0
            ? selSearchData.fields
            : [{
                name: "keyword", label: selSearchData.label || "搜索", placeholder: selSearchData.placeholder || "",
                icon: selSearchData.icon || "ri-search-line", defaultValue: selSearchData.defaultValue || ""
            }];
        // Map 让提交、清空、语言刷新和公开控制器都按稳定字段名读取，不依赖 DOM 顺序。
        const selSearchFields = new Map();
        selSearchFieldDefinitions.forEach((selSearchDefinition) => {
            // 每个字段独立拥有 label、输入和清空按钮，但共享同一个 form 与查询按钮。
            const selSearchField = document.createElement("label");
            selSearchField.className = "selsearch-field";
            selSearchField.dataset.selSearchField = String(selSearchDefinition.name);
            selSearchField.appendChild(selSearchCreateIcon(selSearchDefinition.icon || selSearchData.icon || "ri-search-line"));

            const selSearchLabel = document.createElement("span");
            selSearchLabel.className = "selsearch-accessibility-label";
            selSearchLabel.textContent = selSearchDefinition.label || selSearchLocaleData.label || "搜索";

            const selSearchInput = document.createElement("input");
            selSearchInput.className = "selsearch-field-input";
            selSearchInput.type = "search";
            selSearchInput.autocomplete = "off";
            selSearchInput.name = String(selSearchDefinition.name);
            selSearchInput.setAttribute("aria-label", selSearchLabel.textContent);
            selSearchInput.placeholder = selSearchDefinition.placeholder || "";
            selSearchInput.value = String(selSearchDefinition.defaultValue || "");

            const selSearchClearButton = document.createElement("button");
            selSearchClearButton.className = "selsearch-field-clear";
            selSearchClearButton.type = "button";
            selSearchClearButton.setAttribute("aria-label", selSearchDefinition.clearLabel || selSearchLocaleData.clearLabel || "清空");
            selSearchClearButton.appendChild(selSearchCreateIcon(selSearchDefinition.clearIcon || selSearchData.clearIcon || "ri-close-line"));

            selSearchField.append(selSearchLabel, selSearchInput, selSearchClearButton);
            selSearchFields.set(String(selSearchDefinition.name), {
                definition: selSearchDefinition, field: selSearchField, label: selSearchLabel,
                input: selSearchInput, clearButton: selSearchClearButton
            });
        });
        // 旧单值控制器继续把第一个字段作为 primary，避免破坏现有 setValue/getValue/focus 调用。
        const selSearchPrimaryField = selSearchFields.values().next().value;

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

        // 所有独立查询字段按声明顺序排列，最后只有一个查询按钮。
        selSearchForm.append(...Array.from(selSearchFields.values()).map((selSearchEntry) => selSearchEntry.field), selSearchSubmitButton);
        selSearchForm.classList.toggle("selsearch-form-multiple", selSearchFields.size > 1);
        selSearchForm.style.setProperty("--selsearch-field-count", String(selSearchFields.size));
        // 当前宿主只保存本组件生成的结构。
        selSearchHost.replaceChildren(selSearchForm);

        // 控件状态只保存当前实例值和加载标记。
        const selSearchState = {
            // values 保存最后一次提交的字段快照，后台分页调用不会读取尚未提交的输入草稿。
            values: Object.fromEntries(Array.from(selSearchFields, ([name, entry]) => [name, entry.input.value])),
            // loading 防止查询进行中重复提交。
            loading: false
        };

        // 根据输入内容同步清空按钮，空值时避免显示无效动作。
        function selSearchSyncClearButtons() {
            selSearchFields.forEach((selSearchEntry) => {
                // 每个字段只根据自身内容显示清空动作，避免清空一个条件时影响其他查询值。
                const selSearchCanClear = selSearchLocaleData.clearable !== false && Boolean(selSearchEntry.input.value);
                selSearchEntry.clearButton.hidden = !selSearchCanClear;
            });
        }

        // 向当前业务实例广播查询，不直接接触表格内部状态或接口路径。
        function selSearchSubmit() {
            // 加载状态下拒绝重复提交。
            if (selSearchState.loading) {
                return false;
            }
            // 每个输入独立规范化，字段之间由业务后台按 AND 组合而不是拼成跨列 OR 关键字。
            const selSearchValues = Object.fromEntries(Array.from(selSearchFields, ([name, entry]) => {
                const value = selSearchLocaleData.trim === false ? entry.input.value : entry.input.value.trim();
                entry.input.value = value;
                return [name, value];
            }));
            const selSearchKeyword = selSearchValues.keyword ?? String(Object.values(selSearchValues)[0] || "");
            // 不允许空查询时保持焦点并停止事件。
            if (selSearchLocaleData.allowEmpty === false && !Object.values(selSearchValues).some(Boolean)) {
                selSearchPrimaryField.input.focus();
                return false;
            }
            // 保存最后提交值，供公开控制器读取。
            selSearchState.values = { ...selSearchValues };
            // 当前实例根广播稳定查询事件。
            selSearchGridRoot.dispatchEvent(new CustomEvent("selSearch:submit", {
                // 事件允许页面更高层监听，但 detail 保留完整实例键。
                bubbles: true,
                // 事件详情只包含通用实例标识和关键词。
                detail: {
                    gridId: selSearchGridId,
                    keyword: selSearchKeyword,
                    values: { ...selSearchValues }
                }
            }));
            // 同步清空按钮可见性。
            selSearchSyncClearButtons();
            // true 表示查询事件已经成功发出。
            return true;
        }

        // 设置输入值但不擅自提交，调用方可明确决定刷新时机。
        function selSearchSetValue(selSearchValue) {
            // 可空值统一转换为空字符串。
            selSearchPrimaryField.input.value = String(selSearchValue ?? "");
            // 控制器状态同步外部设置值，其他字段保持当前已提交条件。
            selSearchState.values = { ...selSearchState.values, [selSearchPrimaryField.definition.name]: selSearchPrimaryField.input.value };
            // 清空按钮跟随最新输入状态。
            selSearchSyncClearButtons();
            // true 表示当前实例输入已更新。
            return true;
        }

        // 清空当前实例关键词，并按调用选项决定是否立即查询全部结果。
        function selSearchClear(selSearchOptions = {}) {
            // 输入框与控制器状态同时恢复空值。
            selSearchFields.forEach((selSearchEntry) => { selSearchEntry.input.value = ""; });
            selSearchState.values = Object.fromEntries(Array.from(selSearchFields.keys(), (name) => [name, ""]));
            selSearchSyncClearButtons();
            // 默认遵循 JSON 的 submitOnClear；调用方可用 submit 明确覆盖。
            const selSearchShouldSubmit = selSearchOptions.submit ?? (selSearchLocaleData.submitOnClear !== false);
            // 需要刷新时复用统一提交入口。
            if (selSearchShouldSubmit) {
                selSearchSubmit();
            }
            // 清空后把键盘焦点送回输入框，便于继续输入。
            selSearchPrimaryField.input.focus();
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

        /** 切换查询元素独立布局；只影响页面编辑几何，不改变统一提交行为。 */
        function selSearchSetIndependentLayout(selSearchIndependent) {
            selSearchForm.classList.toggle("selsearch-form-independent-layout", Boolean(selSearchIndependent));
            return true;
        }

        // 动态页签关闭时必须同时删除 DOM 和注册表，避免同名 Grid 重建后拿到旧输入框控制器。
        function selSearchDestroy() {
            selSearchHost.replaceChildren();
            selSearchInstances.delete(selSearchGridId);
            return true;
        }

        /** 返回当前查询组件内每个可编辑元素；提交按钮仍由同一 form 统一提交全部条件。 */
        function selSearchGetLayoutTargets() {
            return selFreeze({
                ...Object.fromEntries(Array.from(selSearchFields, ([name, entry]) => [name, entry.field])),
                submit: selSearchSubmitButton
            });
        }

        /** 返回当前查询条件字段名；结构判断不把提交按钮误认为查询字段。 */
        function selSearchGetFieldNames() {
            return selFreeze(Array.from(selSearchFields.keys()));
        }

        // 输入变化只更新清空按钮，不再直接筛选表格。
        selSearchFields.forEach((selSearchEntry) => {
            selSearchEntry.input.addEventListener("input", selSearchSyncClearButtons);
            selSearchEntry.input.addEventListener("keydown", (selSearchEvent) => {
                if (selSearchEvent.key !== "Enter") return;
                selSearchEvent.preventDefault();
                if (selSearchLocaleData.submitOnEnter !== false) selSearchSubmit();
            });
            selSearchEntry.clearButton.addEventListener("click", () => {
                selSearchEntry.input.value = "";
                selSearchSyncClearButtons();
                if (selSearchLocaleData.submitOnClear !== false) selSearchSubmit();
                selSearchEntry.input.focus();
            });
        });
        // 表单提交统一承接按钮点击和 Enter。
        selSearchForm.addEventListener("submit", (selSearchEvent) => {
            // 阻止浏览器跳转或刷新页面。
            selSearchEvent.preventDefault();
            // 配置关闭 Enter 时，键盘提交由 keydown 分支阻止；按钮仍可查询。
            selSearchSubmit();
        });
        // 首次同步清空按钮，默认空关键词时不显示。
        selSearchSyncClearButtons();

        // 运行时切换只替换可见文案与行为配置，不重建输入框，因此关键词、焦点和加载状态保持不变。
        function selSearchSetLocale(selSearchNext = {}) {
            const selSearchNextData = selSearchNext.resource || selSearchNext.messages || selSearchNext;
            if (!selSearchNextData || typeof selSearchNextData !== "object") return false;
            selSearchLocaleData = selSearchNextData;
            selSearchForm.setAttribute("aria-label", selSearchLocaleData.label || "搜索");
            // 单字段调用与首次 mount 使用同一份兼容规则；否则切换语言时只有按钮更新，
            // 由顶层 placeholder/label 创建的 keyword 输入框会继续显示上一种语言。
            const selSearchNextFieldDefinitions = Array.isArray(selSearchLocaleData.fields) && selSearchLocaleData.fields.length > 0
                ? selSearchLocaleData.fields
                : [{
                    name: "keyword",
                    label: selSearchLocaleData.label || "搜索",
                    placeholder: selSearchLocaleData.placeholder || "",
                    clearLabel: selSearchLocaleData.clearLabel || "清空"
                }];
            const selSearchNextFields = new Map(selSearchNextFieldDefinitions.map((field) => [String(field.name), field]));
            selSearchFields.forEach((selSearchEntry, name) => {
                const nextField = selSearchNextFields.get(name) || selSearchEntry.definition;
                selSearchEntry.label.textContent = nextField.label || selSearchLocaleData.label || "搜索";
                selSearchEntry.input.setAttribute("aria-label", selSearchEntry.label.textContent);
                selSearchEntry.input.placeholder = nextField.placeholder || "";
                selSearchEntry.clearButton.setAttribute("aria-label", nextField.clearLabel || selSearchLocaleData.clearLabel || "清空");
            });
            selSearchSubmitLabel.textContent = selSearchLocaleData.buttonLabel || "查询";
            selSearchSyncClearButtons();
            return true;
        }

        // 返回冻结控制器，应用和其他基础控件只能通过稳定方法协作。
        return selFreeze({
            // id 是完整业务实例键。
            id: selSearchGridId,
            // root 是当前搜索宿主，便于布局调试。
            root: selSearchHost,
            // input 暴露原生输入供表单集成，但业务逻辑不得修改内部类。
            input: selSearchPrimaryField.input,
            // 页面编辑开启后允许每个查询元素独立拖动调宽，业务提交仍保持整组一次执行。
            setIndependentLayout: selSearchSetIndependentLayout,
            // 公开真实布局目标，应用无需查询组件私有类名。
            getLayoutTargets: selSearchGetLayoutTargets,
            // getFieldNames 只用于识别查询条件结构变化；内部字段和查询按钮不属于页面布局登记坐标。
            getFieldNames: selSearchGetFieldNames,
            // submit 触发当前关键词查询。
            submit: selSearchSubmit,
            // clear 清空当前关键词并可选提交。
            clear: selSearchClear,
            // focus 把键盘焦点移到当前输入框。
            focus: () => selSearchPrimaryField.input.focus(),
            // setValue 更新当前实例输入。
            setValue: selSearchSetValue,
            // getValue 返回当前输入框的实时值。
            getValue: () => selSearchPrimaryField.input.value,
            // setValues/getValues 是多字段后台查询的稳定公开入口，字段名来自应用显式配置。
            setValues(values = {}) {
                selSearchFields.forEach((entry, name) => { entry.input.value = String(values[name] ?? ""); });
                selSearchState.values = Object.fromEntries(Array.from(selSearchFields, ([name, entry]) => [name, entry.input.value]));
                selSearchSyncClearButtons();
                return true;
            },
            getValues: () => Object.fromEntries(Array.from(selSearchFields, ([name, entry]) => [name, entry.input.value])),
            // setLoading 控制重复提交和忙碌语义。
            setLoading: selSearchSetLoading,
            // isLoading 返回当前实例查询状态。
            isLoading: () => selSearchState.loading,
            // setLocale 供统一语言管理器原位替换公共文案。
            setLocale: selSearchSetLocale,
            // destroy 与 Grid 生命周期绑定，关闭页面后不保留旧实例。
            destroy: selSearchDestroy
        });
    }

    // 公开注册表由应用装配层显式挂载，基础脚本加载后不扫描业务页面。
    window.sel.register("components.search", {
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
        // remount 只用于字段结构变化；旧 DOM 由实例创建边界替换，同名注册表原子指向新控制器。
        remount(selSearchGridRoot, selSearchData) {
            if (!(selSearchGridRoot instanceof Element)) return null;
            const selSearchGridId = selSearchGridRoot.dataset.selGrid;
            if (selSearchGridId) selSearchInstances.delete(selSearchGridId);
            const selSearchInstance = selSearchCreateInstance(selSearchGridRoot, selSearchData);
            if (selSearchInstance) selSearchInstances.set(selSearchInstance.id, selSearchInstance);
            return selSearchInstance;
        },
        // get 按完整业务实例名读取控制器。
        get: (selSearchGridId) => selSearchInstances.get(selSearchGridId) || null,
        // has 判断目标实例是否已经挂载。
        has: (selSearchGridId) => selSearchInstances.has(selSearchGridId)
    });
})(window);
