/*
 * selPanel.js：通用稳定面板布局基础控件。
 * 负责创建标题、工具栏、左侧导航、中央内容、底栏和反馈区的稳定宿主，并管理左侧区域收起状态。
 * 责任边界：本文件只识别标准 panel/grid payload 和通用区域角色，不识别 具体应用、业务接口或后端实体名称。
 * 模块级 JavaScript 标识统一使用 selPanel 前缀，公开控制器为 window.selPanel。
 */
(function selPanelInitialize() {
    "use strict";

    // 已创建面板按完整业务实例键登记，保证同页多实例可以明确寻址。
    const selPanelInstances = new Map();
    // 已挂载面板集合防止同一业务根重复绑定布局事件。
    const selPanelRoots = new Set();
    // 每个面板独立保存当前语言的左侧区域操作名称。
    const selPanelOptions = new WeakMap();
    // 每个面板保存应用声明的五区布局，公开查询时不需要反向分析 DOM。
    const selPanelLayouts = new WeakMap();
    // 每个面板的左侧分隔控制器独立登记，防止重复挂载指针与键盘事件。
    const selPanelSidebarResizers = new WeakMap();
    // 每个面板的工具栏栏目分隔控制器独立登记，语言刷新时复用现有宽度和事件。
    const selPanelToolbarResizers = new WeakMap();

    // 左侧区域宽度只在当前页面内存生效；刷新后回到 CSS 默认值。
    const selPanelSidebarWidthDefault = 246;
    const selPanelSidebarWidthMinimum = 190;
    const selPanelSidebarWidthMaximum = 520;
    const selPanelSidebarKeyboardStep = 12;
    // 工具栏栏目默认使用适合搜索、筛选和动作控件的安全宽度范围。
    const selPanelToolbarColumnWidthMinimum = 120;
    const selPanelToolbarColumnWidthMaximum = 720;
    const selPanelToolbarColumnKeyboardStep = 12;

    // 默认五区结构仅作为未传布局时的通用回退，应用可显式调整组件所在区域。
    const selPanelDefaultStructure = Object.freeze({
        // 顶部包含标题栏和筛选工具栏。
        top: Object.freeze([
            Object.freeze({ component: "title", payload: "title" }),
            Object.freeze({
                component: "toolbar",
                children: Object.freeze([
                    Object.freeze({ component: "selSearch", payload: "search" }),
                    Object.freeze({ component: "selDropdownMenu", slot: "projectType", payload: "select.projectType" }),
                    Object.freeze({ component: "selDropdownMenu", slot: "status", payload: "select.status" }),
                    Object.freeze({ component: "dateRange", payload: "title" }),
                    Object.freeze({ component: "filterReset", payload: "title" })
                ])
            })
        ]),
        // 左侧默认承载树形导航。
        left: Object.freeze([Object.freeze({ component: "selTree", payload: "tree" })]),
        // 中央默认承载主表格。
        center: Object.freeze([Object.freeze({ component: "selGrid", payload: "$aggregate" })]),
        // 右侧默认承载行操作菜单。
        right: Object.freeze([Object.freeze({ component: "selGridMenu", payload: "menu" })]),
        // 底部默认承载统计、每页条数、分页和反馈。
        bottom: Object.freeze([
            Object.freeze({
                component: "footer",
                children: Object.freeze([
                    Object.freeze({
                        component: "gridSummary",
                        payload: "pagination",
                        children: Object.freeze([
                            Object.freeze({ component: "selDropdownMenu", slot: "pageSize", payload: "select.pageSize" })
                        ])
                    }),
                    Object.freeze({ component: "pagination", payload: "pagination" }),
                    Object.freeze({ component: "feedback", payload: "title.messages" })
                ])
            })
        ])
    });

    // 只接受五个稳定区域，额外应用字段不会进入基础 DOM。
    const selPanelRegionNames = Object.freeze(["top", "left", "center", "right", "bottom"]);

    // 取得组件的子项数组，非法 children 安全回退为空数组。
    function selPanelGetChildren(selPanelComponentDefinition) {
        // 组件没有子项时返回空数组，渲染函数无需重复类型判断。
        return Array.isArray(selPanelComponentDefinition?.children) ? selPanelComponentDefinition.children : [];
    }

    // 把受支持的结构组件转换为基础 DOM 字符串；未知组件不会被插入页面。
    function selPanelRenderComponent(selPanelComponentDefinition) {
        // 缺少稳定组件名时不创建匿名结构。
        const selPanelComponentName = String(selPanelComponentDefinition?.component || "");
        // 标题组件负责品牌、状态标签和快捷动作宿主。
        if (selPanelComponentName === "title") {
            return `
                <header class="selpanel-crystal-surface selpanel-header-shell" data-sel-panel-component="title">
                    <div class="selpanel-brand-group">
                        <span class="selpanel-brand-icon" aria-hidden="true"><i class="ri-gem-line"></i></span>
                        <div class="selpanel-brand-copy">
                            <div class="selpanel-title-line">
                                <h1 data-sel-grid-role="panel-title"></h1>
                                <span data-sel-grid-role="panel-subtitle"><i class="ri-sparkling-2-fill" aria-hidden="true"></i></span>
                            </div>
                            <p data-sel-grid-role="panel-description"></p>
                        </div>
                    </div>
                    <nav class="selpanel-status-tabs" data-sel-grid-role="status-tabs" aria-label="状态筛选"></nav>
                    <div class="selpanel-header-actions" data-sel-grid-role="header-actions" aria-label="快捷操作"></div>
                </header>
            `;
        }
        // 工具栏组件提供横向容器，实际子控件顺序完全来自布局声明。
        if (selPanelComponentName === "toolbar") {
            const selPanelToolbarChildren = selPanelGetChildren(selPanelComponentDefinition);
            return `
                <section class="selpanel-crystal-surface selpanel-toolbar-shell" data-sel-panel-component="toolbar" data-sel-panel-child-count="${selPanelToolbarChildren.length}" aria-label="筛选工具栏">
                    ${selPanelToolbarChildren.map(selPanelRenderComponent).join("")}
                </section>
            `;
        }
        // 搜索组件只创建独立基础控件宿主。
        if (selPanelComponentName === "selSearch") {
            return '<div class="selsearch-root selsearch-surface-toolbar" data-sel-panel-component="selSearch" data-sel-grid-role="search-host"></div>';
        }
        // 下拉组件根据受控 slot 选择稳定原生 select 角色。
        if (selPanelComponentName === "selDropdownMenu") {
            // 每页条数使用底栏紧凑和向上弹出皮肤。
            if (selPanelComponentDefinition.slot === "pageSize") {
                return `
                    <div class="selgrid-pagination-size" data-sel-panel-component="selDropdownMenu" data-sel-panel-slot="pageSize">
                        <span class="selgrid-accessibility-sr-only" data-sel-grid-role="page-size-label"></span>
                        <div class="seldropdown-root seldropdown-surface-compact seldropdown-placement-top" data-sel-dropdown-menu>
                            <select class="seldropdown-native" data-sel-grid-role="page-size"></select>
                        </div>
                    </div>
                `;
            }
            // 顶部项目类型和状态只允许两个稳定 slot。
            const selPanelDropdownRoles = Object.freeze({
                projectType: "type-filter",
                status: "status-filter"
            });
            // 未知 slot 不创建不可寻址下拉框。
            const selPanelDropdownRole = selPanelDropdownRoles[selPanelComponentDefinition.slot];
            if (!selPanelDropdownRole) {
                return "";
            }
            return `
                <div class="seldropdown-root seldropdown-surface-toolbar" data-sel-panel-component="selDropdownMenu" data-sel-panel-slot="${selPanelComponentDefinition.slot}" data-sel-dropdown-menu>
                    <select class="seldropdown-native" data-sel-grid-role="${selPanelDropdownRole}"></select>
                </div>
            `;
        }
        // 日期范围组件创建当前标题 JSON 对应的通用动作宿主。
        if (selPanelComponentName === "dateRange") {
            return `
                <button class="selpanel-date-field" data-sel-panel-component="dateRange" type="button" data-sel-grid-role="date-command" data-panel-command="date">
                    <span data-sel-grid-role="date-start"></span>
                    <i class="ri-arrow-right-line" aria-hidden="true"></i>
                    <span data-sel-grid-role="date-end"></span>
                    <i class="ri-calendar-line" aria-hidden="true"></i>
                </button>
            `;
        }
        // 重置组件创建工具栏统一恢复入口。
        if (selPanelComponentName === "filterReset") {
            return '<button class="selpanel-reset-button" data-sel-panel-component="filterReset" data-sel-grid-role="filter-reset" type="button"></button>';
        }
        // 树组件创建标题、树宿主、折叠按钮和统计。
        if (selPanelComponentName === "selTree") {
            return `
                <div class="selpanel-region-heading" data-sel-panel-component="selTree">
                    <span data-sel-grid-role="tree-heading"><i class="ri-node-tree" aria-hidden="true"></i></span>
                    <button type="button" data-sel-panel-action="toggle-left" aria-label="收起左侧区域" aria-expanded="true">
                        <i class="ri-side-bar-line" aria-hidden="true"></i>
                    </button>
                </div>
                <nav class="seltree-root" data-sel-grid-role="tree" aria-label="分类树"></nav>
                <div class="selpanel-sidebar-summary">
                    <i class="ri-database-2-line" aria-hidden="true"></i>
                    <span data-sel-grid-role="tree-summary"></span>
                </div>
            `;
        }
        // 主表格组件创建列、表头、行和空状态宿主。
        if (selPanelComponentName === "selGrid") {
            return `
                <div class="selgrid-board-shell" data-sel-panel-component="selGrid" aria-label="数据表格">
                    <div class="selgrid-board-highlight" aria-hidden="true"></div>
                    <div class="selgrid-table-scroller">
                        <table class="selgrid-table" data-sel-grid-role="table">
                            <colgroup data-sel-grid-role="column-group"></colgroup>
                            <thead data-sel-grid-role="table-head"></thead>
                            <tbody data-sel-grid-role="table-body"></tbody>
                        </table>
                        <div class="selgrid-empty-state" data-sel-grid-role="empty-state" hidden>
                            <i class="ri-search-eye-line" aria-hidden="true"></i>
                            <span data-sel-grid-role="empty-text"></span>
                        </div>
                    </div>
                </div>
            `;
        }
        // 页签组件只预留独立生命周期宿主，页签条、内容面板和关闭销毁均由 selTabs 自身创建。
        if (selPanelComponentName === "selTabs") {
            return '<div class="seltabs-host" data-sel-panel-component="selTabs"></div>';
        }
        // 表格菜单组件只创建可由 selGridMenu 挂载的右侧浮层宿主。
        if (selPanelComponentName === "selGridMenu") {
            return '<aside class="selgrid-menu" data-sel-panel-component="selGridMenu" data-sel-grid-role="menu" aria-label="行操作菜单" aria-hidden="true"></aside>';
        }
        // footer 是底部组合容器，外层稳定底栏由区域渲染器负责。
        if (selPanelComponentName === "footer") {
            return selPanelGetChildren(selPanelComponentDefinition).map(selPanelRenderComponent).join("");
        }
        // 统计组件显示总量并作为每页条数的左侧组合宿主。
        if (selPanelComponentName === "gridSummary") {
            return `
                <div class="selgrid-footer-summary" data-sel-panel-component="gridSummary">
                    <i class="ri-briefcase-4-line" aria-hidden="true"></i>
                    <span data-sel-grid-role="total-count"></span>
                    ${selPanelGetChildren(selPanelComponentDefinition).map(selPanelRenderComponent).join("")}
                </div>
            `;
        }
        // 分页组件提供底部导航宿主。
        if (selPanelComponentName === "pagination") {
            return '<nav class="selgrid-pagination" data-sel-panel-component="pagination" data-sel-grid-role="pagination" aria-label="分页"></nav>';
        }
        // 反馈组件提供当前实例短时状态区域。
        if (selPanelComponentName === "feedback") {
            return '<div class="selgrid-feedback-toast" data-sel-panel-component="feedback" data-sel-grid-role="feedback" role="status" aria-live="polite"></div>';
        }
        // 未知组件返回空字符串，禁止把应用配置解释为任意 HTML。
        return "";
    }

    // 根据区域名称使用稳定语义外壳并渲染其组件清单。
    function selPanelRenderRegion(selPanelRegionName, selPanelComponents) {
        // 删除空数组区域时完全省略节点，其他区域仍可独立布局。
        if (!Array.isArray(selPanelComponents) || selPanelComponents.length === 0) {
            return "";
        }
        // 当前区域全部受支持组件按声明顺序渲染。
        const selPanelRegionContent = selPanelComponents.map(selPanelRenderComponent).join("");
        // 没有任何受支持组件时不保留空水晶区域。
        if (!selPanelRegionContent.trim()) {
            return "";
        }
        // 顶部允许标题和工具栏各自保持独立水晶表面。
        if (selPanelRegionName === "top") {
            return `<div class="selpanel-region-top" data-sel-panel-region="top">${selPanelRegionContent}</div>`;
        }
        // 左侧使用可折叠水晶侧栏。
        if (selPanelRegionName === "left") {
            return `<aside class="selpanel-crystal-surface selpanel-sidebar-shell" data-sel-panel-region="left" aria-label="左侧区域">${selPanelRegionContent}</aside>`;
        }
        // 中央区域填满主体剩余空间。
        if (selPanelRegionName === "center") {
            return `<section class="selpanel-crystal-surface selpanel-content-shell" data-sel-panel-region="center" aria-label="中央内容区">${selPanelRegionContent}</section>`;
        }
        // 右侧区域作为附加选项或浮层锚点，不强制占用固定宽度。
        if (selPanelRegionName === "right") {
            return `<aside class="selpanel-right-shell" data-sel-panel-region="right" aria-label="右侧附加区域">${selPanelRegionContent}</aside>`;
        }
        // 底部使用稳定水晶底栏。
        if (selPanelRegionName === "bottom") {
            return `<footer class="selpanel-crystal-surface selpanel-footer-shell" data-sel-panel-region="bottom">${selPanelRegionContent}</footer>`;
        }
        // 五区以外名称不会进入页面。
        return "";
    }

    // 把五区声明组合成面板根结构，左右中统一进入主体横向容器。
    function selPanelRenderStructure(selPanelStructure) {
        // 顶部组件按声明顺序渲染。
        const selPanelTop = selPanelRenderRegion("top", selPanelStructure.top);
        // 左、中、右分别生成可选区域。
        const selPanelLeft = selPanelRenderRegion("left", selPanelStructure.left);
        const selPanelCenter = selPanelRenderRegion("center", selPanelStructure.center);
        const selPanelRight = selPanelRenderRegion("right", selPanelStructure.right);
        // 主体只有至少一个区域存在时才创建横向容器。
        const selPanelBody = `${selPanelLeft}${selPanelCenter}${selPanelRight}`.trim()
            ? `<div class="selpanel-body-shell" data-sel-panel-region="body">${selPanelLeft}${selPanelCenter}${selPanelRight}</div>`
            : "";
        // 底部组件按声明顺序渲染。
        const selPanelBottom = selPanelRenderRegion("bottom", selPanelStructure.bottom);
        // 返回完整基础面板结构。
        return `${selPanelTop}${selPanelBody}${selPanelBottom}`;
    }

    // 规范化应用布局，只保留五个稳定区域和数组清单。
    function selPanelNormalizeStructure(selPanelStructure) {
        // 应用未传结构时使用通用五区默认值。
        const selPanelInputStructure = selPanelStructure && typeof selPanelStructure === "object"
            ? selPanelStructure
            : selPanelDefaultStructure;
        // 结果只复制稳定区域，禁止基础层保留应用附加对象。
        return Object.freeze(Object.fromEntries(selPanelRegionNames.map((selPanelRegionName) => [
            selPanelRegionName,
            Object.freeze(Array.isArray(selPanelInputStructure[selPanelRegionName]) ? [...selPanelInputStructure[selPanelRegionName]] : [])
        ])));
    }

    /**
     * 为一个空业务宿主创建稳定的面板区域结构。
     * @param {Element} selPanelHost - 应用提供的页面挂载点，例如带 data-sel-app-host 的 main。
     * @param {object} selPanelDefinition - 标准实例定义，包含 gridId、sourceId、entity、view、layout 和 structure。
     * @returns {Element|null} 创建成功时返回带 data-sel-grid 的面板根；定义无效时返回 null。
     */
    function selPanelCreate(selPanelHost, selPanelDefinition = {}) {
        // 应用挂载点必须是页面中的真实元素，基础控件不会猜测默认容器。
        if (!(selPanelHost instanceof Element)) {
            return null;
        }
        // 完整业务实例键是多实例注册与后续 selGrid.get 的唯一标识。
        const selPanelGridId = String(selPanelDefinition.gridId || "").trim();
        // 缺少实例键时无法创建可寻址面板。
        if (!selPanelGridId) {
            return null;
        }
        // 同一实例重复创建时复用既有宿主，禁止生成重复 DOM。
        if (selPanelInstances.has(selPanelGridId)) {
            return selPanelInstances.get(selPanelGridId);
        }
        // 页面排列模式由应用作为标准选项传入，基础控件只把结果标记在应用挂载点。
        selPanelHost.dataset.selPanelLayout = selPanelDefinition.layout === "stack" ? "stack" : "single";
        // 面板根承载基础布局类和业务实例元数据。
        const selPanelRoot = document.createElement("section");
        // 基础类只表达稳定面板结构，不包含应用名称。
        selPanelRoot.className = "selpanel-shell";
        // data-sel-panel 表示该节点可以挂载通用面板控制器。
        selPanelRoot.dataset.selPanel = "";
        // 实例键直接来自应用显式定义。
        selPanelRoot.dataset.selGrid = selPanelGridId;
        // 数据源键允许多个视图复用同一后端聚合响应。
        selPanelRoot.dataset.selGridSource = String(selPanelDefinition.sourceId || selPanelGridId);
        // 后端实体通过独立字段声明，基础控件不从实例名推断。
        selPanelRoot.dataset.selEntity = String(selPanelDefinition.entity || "");
        // 业务视图代码只用于选择 payload 中的标题变体。
        selPanelRoot.dataset.selGridView = String(selPanelDefinition.view || "default");
        // 初始可访问名称在业务 payload 应用前提供通用回退。
        selPanelRoot.setAttribute("aria-label", String(selPanelDefinition.ariaLabel || "数据面板"));
        // 应用声明经白名单规范化后决定五区和组件顺序。
        const selPanelStructure = selPanelNormalizeStructure(selPanelDefinition.structure);
        // 基础层只按受支持组件创建原生语义宿主，不读取 payload 内容。
        selPanelRoot.innerHTML = selPanelRenderStructure(selPanelStructure);
        // 保存规范化结构供公开接口和调试读取。
        selPanelLayouts.set(selPanelRoot, selPanelStructure);
        // 面板加入应用挂载点后，其他基础控件才能按当前实例根完成作用域查询。
        selPanelHost.appendChild(selPanelRoot);
        // 注册表保存真实根节点，后续重复创建和调试都按完整实例键访问。
        selPanelInstances.set(selPanelGridId, selPanelRoot);
        // 返回新建面板供应用装配层继续显式挂载基础控件。
        return selPanelRoot;
    }

    /**
     * 把一套标准下拉数据写入面板预留的原生 select。
     * @param {Element} selPanelRoot - 当前业务实例面板根。
     * @param {object} selPanelSelectData - 标准下拉数据，包含 role、选项和本地化名称。
     */
    function selPanelApplySelect(selPanelRoot, selPanelSelectData) {
        // 缺少标准角色的数据不能定位当前实例下拉宿主。
        if (!selPanelSelectData?.role) {
            return;
        }
        // 通过稳定 role 定位当前实例下拉，不依赖固定 HTML id。
        const selPanelSelect = selPanelRoot.querySelector(`[data-sel-grid-role="${selPanelSelectData.role}"]`);
        // 页面删除某个下拉区域时允许安全跳过。
        if (!selPanelSelect) {
            return;
        }
        // 下拉根节点承载显示名称和滚动阈值，供 selDropdownMenu 读取。
        const selPanelSelectRoot = selPanelSelect.closest("[data-sel-dropdown-menu]");
        // 原生 select 的可访问名称来自标准数据。
        selPanelSelect.setAttribute("aria-label", selPanelSelectData.ariaLabel || selPanelSelectData.label || "选择项目");
        // 新 payload 应完整替换旧选项，避免语言切换后残留旧文字。
        selPanelSelect.replaceChildren();
        // 每条稳定业务选项转换为原生 option，保持键盘与表单语义。
        (selPanelSelectData.options || []).forEach((selPanelOptionData) => {
            // option 由基础控件创建，应用装配层无需接触内部 DOM。
            const selPanelOption = document.createElement("option");
            // value 保存稳定业务代码，不随显示语言变化。
            selPanelOption.value = String(selPanelOptionData.value);
            // 可见文字只使用标准数据中的安全文本。
            selPanelOption.textContent = selPanelOptionData.label;
            // 展开菜单可以使用比紧凑触发器更完整的名称。
            selPanelOption.dataset.menuLabel = selPanelOptionData.menuLabel || selPanelOptionData.label;
            // 第二行说明交给通用下拉组件渲染。
            selPanelOption.dataset.description = selPanelOptionData.description || "";
            // 图标类由调用方标准数据提供。
            selPanelOption.dataset.icon = selPanelOptionData.icon || "ri-circle-line";
            // 可选色调只影响基础下拉状态皮肤。
            if (selPanelOptionData.tone) {
                selPanelOption.dataset.tone = selPanelOptionData.tone;
            }
            // 标准 selected 字段同步原生选择状态。
            selPanelOption.selected = Boolean(selPanelOptionData.selected);
            // 完整选项加入当前实例下拉。
            selPanelSelect.appendChild(selPanelOption);
        });
        // 删除自定义下拉宿主时原生 select 仍保留完整数据与功能。
        if (!selPanelSelectRoot) {
            return;
        }
        // 当前语言字段名称供通用菜单标题和辅助技术使用。
        selPanelSelectRoot.dataset.selDropdownMenuLabel = selPanelSelectData.label || "";
        // 当前值的完整可访问句式由业务语言 JSON 提供，基础控件不拼接固定中文。
        selPanelSelectRoot.dataset.selDropdownMenuCurrentTemplate = selPanelSelectData.currentTemplate || "{label}：{value}";
        // 展开菜单标题由单个下拉 JSON 提供完整本地化句式，兼容不同语言语序。
        selPanelSelectRoot.dataset.selDropdownMenuTitle = selPanelSelectData.menuTitle || selPanelSelectData.label || "";
        // 工具栏触发器前缀由标准数据提供。
        selPanelSelectRoot.dataset.selDropdownMenuPrefix = selPanelSelectData.prefix || "";
        // 滚动阈值集中写入宿主，不散落到通用脚本和 CSS。
        selPanelSelectRoot.dataset.selDropdownMenuScrollAfter = String(selPanelSelectData.scrollAfter || 6);
    }

    /**
     * 把标准聚合 payload 的标题、工具栏和辅助文字应用到当前面板。
     * @param {Element} selPanelRoot - 当前业务实例面板根。
     * @param {object} selPanelView - 应用显式传入的标准聚合 payload。
     */
    function selPanelApplyView(selPanelRoot, selPanelView) {
        // 缺少标题、树或下拉数据时不能形成完整通用视图。
        if (!selPanelView?.title || !selPanelView?.tree || !selPanelView?.select) {
            return false;
        }
        // 业务视图代码只负责从标准 payload 选择标题变体。
        const selPanelTitleVariant = selPanelView.title.variants?.[selPanelRoot.dataset.selGridView] || {};
        // 面板可访问名称优先使用视图变体。
        selPanelRoot.setAttribute("aria-label", selPanelTitleVariant.ariaLabel || selPanelView.title.ariaLabel || "数据面板");
        // 标题、副标题和说明都限制在当前实例根内。
        const selPanelTitle = selPanelRoot.querySelector("[data-sel-grid-role='panel-title']");
        const selPanelSubtitle = selPanelRoot.querySelector("[data-sel-grid-role='panel-subtitle']");
        const selPanelDescription = selPanelRoot.querySelector("[data-sel-grid-role='panel-description']");
        // 标题存在时写入当前语言文字。
        if (selPanelTitle) {
            selPanelTitle.textContent = selPanelTitleVariant.title || selPanelView.title.title;
        }
        // 副标题保留基础图标并替换当前语言文字。
        if (selPanelSubtitle) {
            const selPanelSubtitleIcon = selPanelSubtitle.querySelector("i");
            selPanelSubtitle.replaceChildren();
            if (selPanelSubtitleIcon) {
                selPanelSubtitle.appendChild(selPanelSubtitleIcon);
            }
            selPanelSubtitle.appendChild(document.createTextNode(` ${selPanelTitleVariant.subtitle || selPanelView.title.subtitle}`));
        }
        // 描述节点存在时写入当前语言说明。
        if (selPanelDescription) {
            selPanelDescription.textContent = selPanelView.title.description;
        }
        // 标准 ariaLabels 字段集中映射稳定区域，删除任一区域不会阻断其他区域。
        const selPanelAriaTargets = Object.freeze({
            statusTabs: "[data-sel-grid-role='status-tabs']",
            headerActions: "[data-sel-grid-role='header-actions']",
            toolbar: "[data-sel-panel-component='toolbar']",
            sidebar: "[data-sel-panel-region='left']",
            content: "[data-sel-panel-region='center']",
            board: ".selgrid-board-shell",
            pagination: "[data-sel-grid-role='pagination']"
        });
        // 每个可访问名称只写入当前面板内对应区域。
        Object.entries(selPanelAriaTargets).forEach(([selPanelAriaKey, selPanelAriaSelector]) => {
            const selPanelAriaTarget = selPanelRoot.querySelector(selPanelAriaSelector);
            if (selPanelAriaTarget && selPanelView.title.ariaLabels?.[selPanelAriaKey]) {
                selPanelAriaTarget.setAttribute("aria-label", selPanelView.title.ariaLabels[selPanelAriaKey]);
            }
        });
        // 状态标签由标准数据重建为原生按钮。
        const selPanelStatusTabs = selPanelRoot.querySelector("[data-sel-grid-role='status-tabs']");
        if (selPanelStatusTabs) {
            const selPanelStatusFragment = document.createDocumentFragment();
            (selPanelView.title.statusTabs || []).forEach((selPanelStatusTab, selPanelStatusIndex) => {
                const selPanelStatusButton = document.createElement("button");
                selPanelStatusButton.className = `selpanel-status-tab${selPanelStatusIndex === 0 ? " selpanel-status-tab-active" : ""}`;
                selPanelStatusButton.type = "button";
                selPanelStatusButton.dataset.statusFilter = selPanelStatusTab.value;
                const selPanelStatusLabel = document.createElement("span");
                selPanelStatusLabel.textContent = selPanelStatusTab.label;
                const selPanelStatusCount = document.createElement("strong");
                selPanelStatusCount.textContent = String(selPanelStatusTab.count);
                selPanelStatusButton.append(selPanelStatusLabel, selPanelStatusCount);
                selPanelStatusFragment.appendChild(selPanelStatusButton);
            });
            selPanelStatusTabs.replaceChildren(selPanelStatusFragment);
        }
        // 标题快捷动作由标准数据转换成原生按钮。
        const selPanelHeaderActions = selPanelRoot.querySelector("[data-sel-grid-role='header-actions']");
        if (selPanelHeaderActions) {
            const selPanelActionButtons = (selPanelView.title.actions || []).map((selPanelAction) => {
                const selPanelActionButton = document.createElement("button");
                selPanelActionButton.className = `selpanel-action-button${selPanelAction.primary ? " selpanel-action-primary" : ""}`;
                selPanelActionButton.type = "button";
                selPanelActionButton.dataset.panelCommand = selPanelAction.id;
                selPanelActionButton.setAttribute("aria-label", selPanelAction.label);
                selPanelActionButton.title = selPanelAction.label;
                const selPanelActionIcon = document.createElement("i");
                selPanelActionIcon.className = selPanelAction.icon;
                selPanelActionIcon.setAttribute("aria-hidden", "true");
                const selPanelActionLabel = document.createElement("span");
                selPanelActionLabel.textContent = selPanelAction.label;
                selPanelActionButton.append(selPanelActionIcon, selPanelActionLabel);
                return selPanelActionButton;
            });
            selPanelHeaderActions.replaceChildren(...selPanelActionButtons);
        }
        // 重置和日期区域读取标准标题数据；搜索内容由独立 selSearch 数据和控件负责。
        const selPanelReset = selPanelRoot.querySelector("[data-sel-grid-role='filter-reset']");
        const selPanelDateStart = selPanelRoot.querySelector("[data-sel-grid-role='date-start']");
        const selPanelDateEnd = selPanelRoot.querySelector("[data-sel-grid-role='date-end']");
        if (selPanelReset) {
            selPanelReset.textContent = selPanelView.title.resetLabel;
        }
        if (selPanelDateStart) {
            selPanelDateStart.textContent = selPanelView.title.dateStart;
        }
        if (selPanelDateEnd) {
            selPanelDateEnd.textContent = selPanelView.title.dateEnd;
        }
        // 树标题、统计和菜单名称使用各自标准片段。
        const selPanelTree = selPanelRoot.querySelector("[data-sel-grid-role='tree']");
        const selPanelTreeHeading = selPanelRoot.querySelector("[data-sel-grid-role='tree-heading']");
        const selPanelTreeSummary = selPanelRoot.querySelector("[data-sel-grid-role='tree-summary']");
        const selPanelMenu = selPanelRoot.querySelector("[data-sel-grid-role='menu']");
        if (selPanelTree) {
            selPanelTree.setAttribute("aria-label", selPanelView.tree.ariaLabel);
        }
        if (selPanelTreeHeading) {
            const selPanelTreeHeadingIcon = selPanelTreeHeading.querySelector("i");
            selPanelTreeHeading.replaceChildren();
            if (selPanelTreeHeadingIcon) {
                selPanelTreeHeading.appendChild(selPanelTreeHeadingIcon);
            }
            selPanelTreeHeading.appendChild(document.createTextNode(` ${selPanelView.tree.heading}`));
        }
        if (selPanelTreeSummary) {
            selPanelTreeSummary.textContent = selPanelView.tree.summary;
        }
        if (selPanelMenu) {
            selPanelMenu.setAttribute("aria-label", selPanelView.menu?.ariaLabel || "行操作菜单");
        }
        // 三个下拉框分别接收独立标准数据。
        selPanelApplySelect(selPanelRoot, selPanelView.select.projectType);
        selPanelApplySelect(selPanelRoot, selPanelView.select.status);
        selPanelApplySelect(selPanelRoot, selPanelView.select.pageSize);
        // 每页条数隐藏标签与对应下拉使用相同本地化名称。
        const selPanelPageSizeLabel = selPanelRoot.querySelector("[data-sel-grid-role='page-size-label']");
        if (selPanelPageSizeLabel) {
            selPanelPageSizeLabel.textContent = selPanelView.select.pageSize?.label || "";
        }
        // true 表示标准视图数据已经成功应用。
        return true;
    }

    // 根据目标状态更新面板类名、按钮语义和布局变化事件。
    function selPanelSetLeftCollapsed(selPanelRoot, selPanelCollapsed) {
        // 当前面板名称来自应用装配层，缺失时使用不带业务含义的通用名称。
        const selPanelLabels = selPanelOptions.get(selPanelRoot) || { expand: "展开左侧区域", collapse: "收起左侧区域" };
        // 布局状态类控制左侧区域宽度和内容显隐。
        selPanelRoot.classList.toggle("selpanel-layout-left-collapsed", selPanelCollapsed);
        // 当前面板内所有左侧开关保持相同可访问状态。
        selPanelRoot.querySelectorAll('[data-sel-panel-action="toggle-left"]').forEach((selPanelButton) => {
            // 展开语义与收起状态互为相反值。
            selPanelButton.setAttribute("aria-expanded", String(!selPanelCollapsed));
            // 按钮名称明确告知下一次操作结果。
            selPanelButton.setAttribute("aria-label", selPanelCollapsed ? selPanelLabels.expand : selPanelLabels.collapse);
        });
        // 宿主页面可监听事件，在布局变化后重新定位浮层或图表。
        selPanelRoot.dispatchEvent(new CustomEvent("selPanel:leftChange", {
            // 事件允许祖先页面统一监听多个面板。
            bubbles: true,
            // 事件详情只暴露稳定的布尔布局状态。
            detail: { collapsed: selPanelCollapsed }
        }));
    }

    // 把任意宽度限制在基础控件允许的安全范围内，保证左树和中央表格都保留可用空间。
    function selPanelClampSidebarWidth(selPanelWidth) {
        return Math.min(selPanelSidebarWidthMaximum, Math.max(selPanelSidebarWidthMinimum, Math.round(selPanelWidth)));
    }

    /**
     * 为同时拥有左区和中央区的面板建立左右拖拽分隔条。
     * @param {Element} selPanelRoot - 当前标准面板根。
     * @returns {Element|null} 已创建或复用的分隔条。
     */
    function selPanelEnsureSidebarResizer(selPanelRoot) {
        // 同一面板重复挂载时直接复用现有分隔条和事件。
        if (selPanelSidebarResizers.has(selPanelRoot)) {
            return selPanelSidebarResizers.get(selPanelRoot);
        }
        const selPanelBody = selPanelRoot.querySelector('[data-sel-panel-region="body"]');
        const selPanelSidebar = selPanelRoot.querySelector('[data-sel-panel-region="left"]');
        const selPanelContent = selPanelRoot.querySelector('[data-sel-panel-region="center"]');
        // 缺少任一区域时不生成悬空或无效的拖拽控件。
        if (!selPanelBody || !selPanelSidebar || !selPanelContent) {
            return null;
        }

        const selPanelResizer = document.createElement("div");
        selPanelResizer.className = "selpanel-sidebar-resizer";
        selPanelResizer.dataset.selPanelAction = "resize-left";
        selPanelResizer.setAttribute("role", "separator");
        selPanelResizer.setAttribute("aria-label", "调整左侧区域宽度");
        selPanelResizer.setAttribute("aria-orientation", "vertical");
        selPanelResizer.setAttribute("aria-valuemin", String(selPanelSidebarWidthMinimum));
        selPanelResizer.setAttribute("aria-valuemax", String(selPanelSidebarWidthMaximum));
        selPanelResizer.setAttribute("aria-valuenow", String(selPanelSidebarWidthDefault));
        selPanelResizer.setAttribute("aria-pressed", "false");
        selPanelResizer.tabIndex = 0;
        selPanelBody.appendChild(selPanelResizer);

        let selPanelPointerId = null;
        let selPanelPointerStartX = 0;
        let selPanelPointerStartWidth = selPanelSidebarWidthDefault;
        let selPanelPendingWidth = null;
        let selPanelResizeFrame = 0;

        // 宽度写入面板实例变量，Flex 会在同一帧把剩余空间实时交给中央表格。
        function selPanelApplySidebarWidth(selPanelWidth) {
            const selPanelSafeWidth = selPanelClampSidebarWidth(selPanelWidth);
            selPanelRoot.style.setProperty("--selpanel-layout-sidebar-width", `${selPanelSafeWidth}px`);
            selPanelResizer.setAttribute("aria-valuenow", String(selPanelSafeWidth));
            return selPanelSafeWidth;
        }

        // 高频指针事件合并到浏览器绘制帧，避免大表格连续重排造成拖拽延迟。
        function selPanelScheduleSidebarWidth(selPanelWidth) {
            selPanelPendingWidth = selPanelWidth;
            if (selPanelResizeFrame) return;
            selPanelResizeFrame = window.requestAnimationFrame(() => {
                selPanelResizeFrame = 0;
                selPanelApplySidebarWidth(selPanelPendingWidth);
            });
        }

        function selPanelFinishSidebarResize(selPanelEvent) {
            if (selPanelPointerId === null || (selPanelEvent?.pointerId !== undefined && selPanelEvent.pointerId !== selPanelPointerId)) return;
            if (selPanelResizeFrame) {
                window.cancelAnimationFrame(selPanelResizeFrame);
                selPanelResizeFrame = 0;
            }
            const selPanelFinalWidth = selPanelApplySidebarWidth(selPanelPendingWidth ?? selPanelPointerStartWidth);
            const selPanelFinishedPointerId = selPanelPointerId;
            selPanelPointerId = null;
            selPanelPendingWidth = null;
            // 先清空活动指针再释放捕获，避免同步 lostpointercapture 重复派发完成事件。
            if (selPanelResizer.hasPointerCapture?.(selPanelFinishedPointerId)) selPanelResizer.releasePointerCapture(selPanelFinishedPointerId);
            selPanelResizer.setAttribute("aria-pressed", "false");
            document.body.classList.remove("selpanel-sidebar-resizing");
            // 拖拽完成事件供图表等需要显式重算的内容监听；普通 Flex 表格无需额外处理。
            selPanelRoot.dispatchEvent(new CustomEvent("selPanel:leftResize", {
                bubbles: true,
                detail: { width: selPanelFinalWidth }
            }));
        }

        selPanelResizer.addEventListener("pointerdown", (selPanelEvent) => {
            // 左侧收起时按钮不可见；此保护同时避免脚本触发无意义拖拽。
            if (selPanelRoot.classList.contains("selpanel-layout-left-collapsed") || selPanelEvent.button !== 0) return;
            selPanelEvent.preventDefault();
            selPanelPointerId = selPanelEvent.pointerId;
            selPanelPointerStartX = selPanelEvent.clientX;
            selPanelPointerStartWidth = selPanelSidebar.getBoundingClientRect().width;
            selPanelPendingWidth = selPanelPointerStartWidth;
            selPanelResizer.setPointerCapture?.(selPanelPointerId);
            selPanelResizer.setAttribute("aria-pressed", "true");
            document.body.classList.add("selpanel-sidebar-resizing");
        });
        function selPanelHandleSidebarPointerMove(selPanelEvent) {
            if (selPanelPointerId === null || selPanelEvent.pointerId !== selPanelPointerId) return;
            selPanelScheduleSidebarWidth(selPanelPointerStartWidth + selPanelEvent.clientX - selPanelPointerStartX);
        }
        selPanelResizer.addEventListener("pointermove", selPanelHandleSidebarPointerMove);
        selPanelResizer.addEventListener("pointerup", selPanelFinishSidebarResize);
        selPanelResizer.addEventListener("pointercancel", selPanelFinishSidebarResize);
        selPanelResizer.addEventListener("lostpointercapture", selPanelFinishSidebarResize);
        // 浏览器或自动化环境若把结束事件投递到捕获元素之外，窗口级兜底仍会清理拖拽状态。
        window.addEventListener("pointerup", selPanelFinishSidebarResize);
        window.addEventListener("pointercancel", selPanelFinishSidebarResize);
        // 捕获异常时指针移动仍由窗口接收，保证快速拖出窄热区后宽度继续实时变化。
        window.addEventListener("pointermove", selPanelHandleSidebarPointerMove);
        window.addEventListener("blur", selPanelFinishSidebarResize);
        // 键盘左右键提供与鼠标相同的连续宽度控制，Home 和 End 直达安全边界。
        selPanelResizer.addEventListener("keydown", (selPanelEvent) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(selPanelEvent.key)) return;
            selPanelEvent.preventDefault();
            const selPanelCurrentWidth = Number(selPanelResizer.getAttribute("aria-valuenow")) || selPanelSidebar.getBoundingClientRect().width;
            const selPanelTargetWidth = selPanelEvent.key === "Home"
                ? selPanelSidebarWidthMinimum
                : selPanelEvent.key === "End"
                    ? selPanelSidebarWidthMaximum
                    : selPanelCurrentWidth + (selPanelEvent.key === "ArrowRight" ? selPanelSidebarKeyboardStep : -selPanelSidebarKeyboardStep);
            const selPanelAppliedWidth = selPanelApplySidebarWidth(selPanelTargetWidth);
            selPanelRoot.dispatchEvent(new CustomEvent("selPanel:leftResize", { bubbles: true, detail: { width: selPanelAppliedWidth } }));
        });
        // 双击恢复默认宽度，仍不写入任何缓存。
        selPanelResizer.addEventListener("dblclick", () => {
            const selPanelAppliedWidth = selPanelApplySidebarWidth(selPanelSidebarWidthDefault);
            selPanelRoot.dispatchEvent(new CustomEvent("selPanel:leftResize", { bubbles: true, detail: { width: selPanelAppliedWidth } }));
        });

        selPanelSidebarResizers.set(selPanelRoot, selPanelResizer);
        return selPanelResizer;
    }

    // 工具栏栏目标识优先使用稳定 slot；无 slot 的搜索、日期和动作控件使用组件名与序号。
    function selPanelResolveToolbarColumnKey(selPanelColumnContent, selPanelColumnIndex) {
        const selPanelSlot = String(selPanelColumnContent.dataset.selPanelSlot || "").trim();
        const selPanelComponent = String(selPanelColumnContent.dataset.selPanelComponent || "column").trim();
        return selPanelSlot || `${selPanelComponent}-${selPanelColumnIndex + 1}`;
    }

    // 非数字配置回落到公共安全值，调用方不能通过 NaN 或负数破坏工具栏布局。
    function selPanelResolveToolbarColumnNumber(selPanelValue, selPanelFallback) {
        const selPanelNumber = Number(selPanelValue);
        return Number.isFinite(selPanelNumber) ? Math.round(selPanelNumber) : selPanelFallback;
    }

    /**
     * 为工具栏直接子栏目建立与 Grid 列宽相同语义的横向拖拽分隔线。
     * @param {Element} selPanelRoot - 当前标准面板根。
     * @param {object} selPanelResizeOptions - columnResize 总开关与 columns 单栏宽度配置。
     * @returns {object|null} 当前工具栏栏目缩放控制器。
     */
    function selPanelEnsureToolbarColumnResizers(selPanelRoot, selPanelResizeOptions = {}) {
        const selPanelToolbar = selPanelRoot.querySelector('[data-sel-panel-component="toolbar"]');
        // 页面没有工具栏时不创建空分隔线，也不影响其他五区挂载。
        if (!selPanelToolbar) return null;

        const selPanelSafeOptions = selPanelResizeOptions && typeof selPanelResizeOptions === "object"
            ? selPanelResizeOptions
            : {};
        const selPanelColumnResizeEnabled = selPanelSafeOptions.columnResize !== false;
        const selPanelColumnOptions = selPanelSafeOptions.columns && typeof selPanelSafeOptions.columns === "object"
            ? selPanelSafeOptions.columns
            : {};
        let selPanelToolbarController = selPanelToolbarResizers.get(selPanelRoot);

        // 首次挂载把直接子控件包进纯布局栏目；控件内部 DOM 和业务状态保持原样。
        if (!selPanelToolbarController) {
            const selPanelToolbarContents = Array.from(selPanelToolbar.children)
                .filter((selPanelChild) => selPanelChild.matches("[data-sel-panel-component]"));
            const selPanelColumns = selPanelToolbarContents.map((selPanelColumnContent, selPanelColumnIndex) => {
                const selPanelColumn = document.createElement("div");
                selPanelColumn.className = "selpanel-toolbar-column";
                selPanelColumn.dataset.selPanelToolbarColumn = String(selPanelColumnIndex);
                const selPanelColumnKey = selPanelResolveToolbarColumnKey(selPanelColumnContent, selPanelColumnIndex);
                selPanelColumn.dataset.selPanelToolbarColumnKey = selPanelColumnKey;
                selPanelColumnContent.before(selPanelColumn);
                selPanelColumn.appendChild(selPanelColumnContent);

                const selPanelColumnResizer = document.createElement("div");
                selPanelColumnResizer.className = "selpanel-toolbar-column-resizer";
                selPanelColumnResizer.dataset.selPanelToolbarColumnResize = selPanelColumnKey;
                selPanelColumnResizer.setAttribute("role", "separator");
                selPanelColumnResizer.setAttribute("aria-orientation", "vertical");
                selPanelColumnResizer.setAttribute("aria-pressed", "false");
                selPanelColumnResizer.tabIndex = 0;
                selPanelColumn.appendChild(selPanelColumnResizer);

                const selPanelColumnState = {
                    content: selPanelColumnContent,
                    column: selPanelColumn,
                    resizer: selPanelColumnResizer,
                    index: selPanelColumnIndex,
                    key: selPanelColumnKey,
                    config: {},
                    initialized: false,
                    pointerId: null,
                    pointerStartX: 0,
                    pointerStartWidth: 0,
                    pendingWidth: null,
                    resizeFrame: 0
                };

                function selPanelGetToolbarColumnBounds() {
                    const selPanelMinimum = Math.max(48, selPanelResolveToolbarColumnNumber(
                        selPanelColumnState.config.minWidth,
                        selPanelToolbarColumnWidthMinimum
                    ));
                    const selPanelMaximum = Math.max(selPanelMinimum, selPanelResolveToolbarColumnNumber(
                        selPanelColumnState.config.maxWidth,
                        selPanelToolbarColumnWidthMaximum
                    ));
                    return Object.freeze({ minimum: selPanelMinimum, maximum: selPanelMaximum });
                }

                function selPanelApplyToolbarColumnWidth(selPanelWidth) {
                    const selPanelBounds = selPanelGetToolbarColumnBounds();
                    const selPanelSafeWidth = Math.min(selPanelBounds.maximum, Math.max(selPanelBounds.minimum, Math.round(selPanelWidth)));
                    selPanelToolbar.style.setProperty(`--selpanel-toolbar-column-${selPanelColumnIndex + 1}-width`, `${selPanelSafeWidth}px`);
                    selPanelColumnResizer.setAttribute("aria-valuemin", String(selPanelBounds.minimum));
                    selPanelColumnResizer.setAttribute("aria-valuemax", String(selPanelBounds.maximum));
                    selPanelColumnResizer.setAttribute("aria-valuenow", String(selPanelSafeWidth));
                    return selPanelSafeWidth;
                }

                function selPanelScheduleToolbarColumnWidth(selPanelWidth) {
                    selPanelColumnState.pendingWidth = selPanelWidth;
                    if (selPanelColumnState.resizeFrame) return;
                    selPanelColumnState.resizeFrame = window.requestAnimationFrame(() => {
                        selPanelColumnState.resizeFrame = 0;
                        selPanelApplyToolbarColumnWidth(selPanelColumnState.pendingWidth);
                    });
                }

                function selPanelHandleToolbarColumnPointerMove(selPanelEvent) {
                    if (selPanelColumnState.pointerId === null || selPanelEvent.pointerId !== selPanelColumnState.pointerId) return;
                    selPanelScheduleToolbarColumnWidth(
                        selPanelColumnState.pointerStartWidth + selPanelEvent.clientX - selPanelColumnState.pointerStartX
                    );
                }

                function selPanelRemoveToolbarWindowListeners() {
                    window.removeEventListener("pointermove", selPanelHandleToolbarColumnPointerMove);
                    window.removeEventListener("pointerup", selPanelFinishToolbarColumnResize);
                    window.removeEventListener("pointercancel", selPanelFinishToolbarColumnResize);
                    window.removeEventListener("blur", selPanelFinishToolbarColumnResize);
                }

                function selPanelDispatchToolbarColumnResize(selPanelWidth) {
                    selPanelRoot.dispatchEvent(new CustomEvent("selPanel:toolbarColumnResize", {
                        bubbles: true,
                        detail: { key: selPanelColumnKey, index: selPanelColumnIndex, width: selPanelWidth }
                    }));
                }

                function selPanelFinishToolbarColumnResize(selPanelEvent) {
                    if (selPanelColumnState.pointerId === null
                            || (selPanelEvent?.pointerId !== undefined && selPanelEvent.pointerId !== selPanelColumnState.pointerId)) return;
                    if (selPanelColumnState.resizeFrame) {
                        window.cancelAnimationFrame(selPanelColumnState.resizeFrame);
                        selPanelColumnState.resizeFrame = 0;
                    }
                    const selPanelFinalWidth = selPanelApplyToolbarColumnWidth(
                        selPanelColumnState.pendingWidth ?? selPanelColumnState.pointerStartWidth
                    );
                    const selPanelFinishedPointerId = selPanelColumnState.pointerId;
                    selPanelColumnState.pointerId = null;
                    selPanelColumnState.pendingWidth = null;
                    if (selPanelColumnResizer.hasPointerCapture?.(selPanelFinishedPointerId)) {
                        selPanelColumnResizer.releasePointerCapture(selPanelFinishedPointerId);
                    }
                    selPanelColumnResizer.setAttribute("aria-pressed", "false");
                    selPanelColumnResizer.classList.remove("selpanel-toolbar-column-resizer-active");
                    document.body.classList.remove("selpanel-toolbar-column-resizing");
                    selPanelRemoveToolbarWindowListeners();
                    selPanelDispatchToolbarColumnResize(selPanelFinalWidth);
                }

                selPanelColumnResizer.addEventListener("pointerdown", (selPanelEvent) => {
                    if (selPanelEvent.button !== 0 || selPanelColumnResizer.hidden) return;
                    selPanelEvent.preventDefault();
                    selPanelColumnState.pointerId = selPanelEvent.pointerId;
                    selPanelColumnState.pointerStartX = selPanelEvent.clientX;
                    selPanelColumnState.pointerStartWidth = selPanelColumn.getBoundingClientRect().width;
                    selPanelColumnState.pendingWidth = selPanelColumnState.pointerStartWidth;
                    selPanelColumnResizer.setPointerCapture?.(selPanelColumnState.pointerId);
                    selPanelColumnResizer.setAttribute("aria-pressed", "true");
                    selPanelColumnResizer.classList.add("selpanel-toolbar-column-resizer-active");
                    document.body.classList.add("selpanel-toolbar-column-resizing");
                    window.addEventListener("pointermove", selPanelHandleToolbarColumnPointerMove);
                    window.addEventListener("pointerup", selPanelFinishToolbarColumnResize);
                    window.addEventListener("pointercancel", selPanelFinishToolbarColumnResize);
                    window.addEventListener("blur", selPanelFinishToolbarColumnResize);
                });
                selPanelColumnResizer.addEventListener("pointermove", selPanelHandleToolbarColumnPointerMove);
                selPanelColumnResizer.addEventListener("pointerup", selPanelFinishToolbarColumnResize);
                selPanelColumnResizer.addEventListener("pointercancel", selPanelFinishToolbarColumnResize);
                selPanelColumnResizer.addEventListener("lostpointercapture", selPanelFinishToolbarColumnResize);
                selPanelColumnResizer.addEventListener("click", (selPanelEvent) => selPanelEvent.preventDefault());
                // 键盘左右键逐步调整，Home/End 直达当前栏目的安全边界。
                selPanelColumnResizer.addEventListener("keydown", (selPanelEvent) => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(selPanelEvent.key) || selPanelColumnResizer.hidden) return;
                    selPanelEvent.preventDefault();
                    const selPanelBounds = selPanelGetToolbarColumnBounds();
                    const selPanelCurrentWidth = Number(selPanelColumnResizer.getAttribute("aria-valuenow"))
                        || selPanelColumn.getBoundingClientRect().width;
                    const selPanelTargetWidth = selPanelEvent.key === "Home"
                        ? selPanelBounds.minimum
                        : selPanelEvent.key === "End"
                            ? selPanelBounds.maximum
                            : selPanelCurrentWidth + (selPanelEvent.key === "ArrowRight"
                                ? selPanelToolbarColumnKeyboardStep
                                : -selPanelToolbarColumnKeyboardStep);
                    selPanelDispatchToolbarColumnResize(selPanelApplyToolbarColumnWidth(selPanelTargetWidth));
                });
                // 双击恢复调用方声明的默认宽度；未声明时恢复公共响应式轨道。
                selPanelColumnResizer.addEventListener("dblclick", () => {
                    const selPanelConfiguredWidth = Number(selPanelColumnState.config.width);
                    if (Number.isFinite(selPanelConfiguredWidth)) {
                        selPanelDispatchToolbarColumnResize(selPanelApplyToolbarColumnWidth(selPanelConfiguredWidth));
                        return;
                    }
                    selPanelToolbar.style.removeProperty(`--selpanel-toolbar-column-${selPanelColumnIndex + 1}-width`);
                    window.requestAnimationFrame(() => {
                        const selPanelRestoredWidth = Math.round(selPanelColumn.getBoundingClientRect().width);
                        selPanelColumnResizer.setAttribute("aria-valuenow", String(selPanelRestoredWidth));
                        selPanelDispatchToolbarColumnResize(selPanelRestoredWidth);
                    });
                });
                return selPanelColumnState;
            });
            selPanelToolbar.dataset.selPanelChildCount = String(selPanelColumns.length);
            selPanelToolbarController = { toolbar: selPanelToolbar, columns: selPanelColumns };
            selPanelToolbarResizers.set(selPanelRoot, selPanelToolbarController);
        }

        // 每次 mount 只更新配置和可访问状态，用户已经拖出的宽度不会被语言刷新覆盖。
        selPanelToolbarController.columns.forEach((selPanelColumnState) => {
            const selPanelColumnConfig = selPanelColumnOptions[selPanelColumnState.key] || {};
            selPanelColumnState.config = selPanelColumnConfig && typeof selPanelColumnConfig === "object"
                ? selPanelColumnConfig
                : {};
            const selPanelColumnEnabled = selPanelColumnResizeEnabled && selPanelColumnState.config.columnResize !== false;
            const selPanelBoundsMinimum = Math.max(48, selPanelResolveToolbarColumnNumber(
                selPanelColumnState.config.minWidth,
                selPanelToolbarColumnWidthMinimum
            ));
            const selPanelBoundsMaximum = Math.max(selPanelBoundsMinimum, selPanelResolveToolbarColumnNumber(
                selPanelColumnState.config.maxWidth,
                selPanelToolbarColumnWidthMaximum
            ));
            selPanelColumnState.resizer.hidden = !selPanelColumnEnabled;
            selPanelColumnState.resizer.tabIndex = selPanelColumnEnabled ? 0 : -1;
            selPanelColumnState.resizer.setAttribute("aria-label", String(
                selPanelColumnState.config.label || `调整${selPanelColumnState.key}栏目宽度`
            ));
            selPanelColumnState.resizer.setAttribute("aria-valuemin", String(selPanelBoundsMinimum));
            selPanelColumnState.resizer.setAttribute("aria-valuemax", String(selPanelBoundsMaximum));
            if (!selPanelColumnState.initialized) {
                const selPanelConfiguredWidth = Number(selPanelColumnState.config.width);
                const selPanelInitialWidth = Number.isFinite(selPanelConfiguredWidth)
                    ? Math.min(selPanelBoundsMaximum, Math.max(selPanelBoundsMinimum, Math.round(selPanelConfiguredWidth)))
                    : Math.round(selPanelColumnState.column.getBoundingClientRect().width);
                if (Number.isFinite(selPanelConfiguredWidth)) {
                    selPanelToolbar.style.setProperty(
                        `--selpanel-toolbar-column-${selPanelColumnState.index + 1}-width`,
                        `${selPanelInitialWidth}px`
                    );
                }
                selPanelColumnState.resizer.setAttribute("aria-valuenow", String(selPanelInitialWidth));
                selPanelColumnState.initialized = true;
            }
        });
        selPanelToolbar.dataset.selPanelColumnResize = String(selPanelColumnResizeEnabled);
        return selPanelToolbarController;
    }

    /**
     * 显式挂载一个面板并应用标准视图数据。
     * @param {Element} selPanelRoot - 由 create 创建或符合标准结构的面板根。
     * @param {object} selPanelMountOptions - 包含 view、左右区域名称和可选高度。
     * @returns {Element|null} 挂载成功时返回当前面板根。
     */
    function selPanelMount(selPanelRoot, selPanelMountOptions = {}) {
        // 非元素宿主无法形成稳定面板。
        if (!(selPanelRoot instanceof Element)) {
            return null;
        }
        // 标准视图存在时先写入标题、动作和下拉数据。
        if (selPanelMountOptions.view && !selPanelApplyView(selPanelRoot, selPanelMountOptions.view)) {
            return null;
        }
        // 应用通过公开变量传入实例高度，不直接覆盖基础控件内部类。
        if (selPanelMountOptions.height) {
            selPanelRoot.style.setProperty("--selpanel-instance-height", String(selPanelMountOptions.height));
        }
        // 语言刷新未重复传 toolbar 时保留首次栏目缩放配置和用户已经调整的宽度。
        const selPanelPreviousOptions = selPanelOptions.get(selPanelRoot) || {};
        const selPanelToolbarResizeOptions = selPanelMountOptions.toolbar ?? selPanelPreviousOptions.toolbar ?? {};
        // 应用可传入本地化名称；缺失时保持现有名称或基础控件通用语义。
        selPanelOptions.set(selPanelRoot, {
            expand: selPanelMountOptions.expandLeftLabel || selPanelPreviousOptions.expand || "展开左侧区域",
            collapse: selPanelMountOptions.collapseLeftLabel || selPanelPreviousOptions.collapse || "收起左侧区域",
            toolbar: selPanelToolbarResizeOptions
        });
        // 分隔条属于通用布局能力，静态骨架与 create 生成结构都在 mount 时统一补齐。
        selPanelEnsureSidebarResizer(selPanelRoot);
        // 工具栏栏目默认可调整；调用方可通过 toolbar.columnResize=false 或单栏配置显式关闭。
        selPanelEnsureToolbarColumnResizers(selPanelRoot, selPanelToolbarResizeOptions);
        // 已挂载面板只刷新视图和选项，不重复绑定事件。
        if (selPanelRoots.has(selPanelRoot)) {
            return selPanelRoot;
        }
        // 点击面板动作按钮时只处理通用布局动作。
        selPanelRoot.addEventListener("click", (selPanelEvent) => {
            // 最近的动作按钮决定本次面板行为。
            const selPanelButton = selPanelEvent.target.closest("[data-sel-panel-action]");
            // 点击普通内容时不改变面板布局。
            if (!selPanelButton) {
                return;
            }
            // 当前版本只公开左侧区域切换动作。
            if (selPanelButton.dataset.selPanelAction === "toggle-left") {
                // 读取现有状态后切换为相反状态。
                const selPanelCollapsed = !selPanelRoot.classList.contains("selpanel-layout-left-collapsed");
                // 统一入口完成视觉和可访问状态同步。
                selPanelSetLeftCollapsed(selPanelRoot, selPanelCollapsed);
            }
        });
        // 紧凑桌面自动收起，常规桌面明确展开。
        const selPanelShouldCollapseForViewport = window.matchMedia("(max-width: 1180px)").matches;
        // 首次挂载明确写入布局状态。
        selPanelSetLeftCollapsed(selPanelRoot, selPanelShouldCollapseForViewport);
        // 挂载完成后加入集合。
        selPanelRoots.add(selPanelRoot);
        // 返回面板根供装配层确认成功。
        return selPanelRoot;
    }

    // 公开稳定控制接口，应用只传挂载点、标准数据和实例定义。
    window.selPanel = Object.freeze({
        // create 负责生成完整通用面板 DOM。
        create: selPanelCreate,
        // mount 负责应用标准视图数据并建立布局交互。
        mount: selPanelMount,
        // setLocale 原位应用新语言视图，面板收起状态、尺寸和节点实例保持不变。
        setLocale: (selPanelRoot, selPanelLocaleOptions = {}) => selPanelMount(selPanelRoot, selPanelLocaleOptions),
        // get 按完整业务实例键返回面板根。
        get: (selPanelGridId) => selPanelInstances.get(selPanelGridId) || null,
        // getLayout 返回指定业务实例经过白名单规范化后的五区声明。
        getLayout(selPanelGridId) {
            // 先按完整业务实例键取得真实面板根。
            const selPanelRoot = selPanelInstances.get(selPanelGridId);
            // 未创建实例时返回 null，调用方无需捕获查询异常。
            return selPanelRoot ? selPanelLayouts.get(selPanelRoot) || null : null;
        },
        // getRegion 返回指定实例中的上、左、中、右或下区域宿主。
        getRegion(selPanelGridId, selPanelRegionName) {
            // 区域名称必须属于基础层公开的五区集合。
            if (!selPanelRegionNames.includes(selPanelRegionName)) {
                return null;
            }
            // 按完整实例键取得面板，保证同页多实例不串联。
            const selPanelRoot = selPanelInstances.get(selPanelGridId);
            // 区域被布局声明删除时安全返回 null。
            return selPanelRoot?.querySelector(`[data-sel-panel-region="${selPanelRegionName}"]`) || null;
        },
        // getComponent 返回指定实例中的首个基础组件宿主，可用 slot 精确区分多个下拉框。
        getComponent(selPanelGridId, selPanelComponentName, selPanelSlot = "") {
            // 按完整实例键取得面板，禁止跨实例全局查询。
            const selPanelRoot = selPanelInstances.get(selPanelGridId);
            // 缺少实例或组件名时无法形成稳定选择器。
            if (!selPanelRoot || !selPanelComponentName) {
                return null;
            }
            // 组件名称先经过 CSS.escape，避免调用值破坏选择器边界。
            const selPanelComponentSelector = `[data-sel-panel-component="${CSS.escape(String(selPanelComponentName))}"]`;
            // slot 存在时追加受控子角色，精确定位项目类型、状态或每页条数。
            const selPanelSlotSelector = selPanelSlot
                ? `[data-sel-panel-slot="${CSS.escape(String(selPanelSlot))}"]`
                : "";
            // 返回当前实例内匹配宿主；不存在时保持可选区域语义。
            return selPanelRoot.querySelector(`${selPanelComponentSelector}${selPanelSlotSelector}`);
        },
        // 外部调用必须指定已挂载面板。
        setLeftCollapsed(selPanelCollapsed, selPanelRoot) {
            // 仅接受当前页面中真实挂载的面板。
            if (selPanelRoot && selPanelRoots.has(selPanelRoot)) {
                // 布尔转换保证调用参数稳定。
                selPanelSetLeftCollapsed(selPanelRoot, Boolean(selPanelCollapsed));
                // true 表示状态已经写入。
                return true;
            }
            // false 表示目标尚未挂载。
            return false;
        },
        // 查询指定面板当前是否收起左侧区域。
        isLeftCollapsed(selPanelRoot) {
            // 缺少有效面板时返回 false。
            return Boolean(selPanelRoot && selPanelRoots.has(selPanelRoot) && selPanelRoot.classList.contains("selpanel-layout-left-collapsed"));
        }
    });
})();
