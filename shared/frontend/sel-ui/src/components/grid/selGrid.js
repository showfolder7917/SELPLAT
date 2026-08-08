/*
 * selGrid.js：通用数据表格多实例基础控件。
 * 负责接收调用方传入的标准聚合 payload，创建独立表格状态，并协调已挂载的树、菜单、筛选和分页子控制器。
 * 责任边界：本文件不请求接口、不读取 具体应用 数据，也不自行扫描并初始化业务模块。
 * 模块级 JavaScript 标识统一使用 selGrid 前缀，公开注册表为 window.selGrid。
 */
(function selGridInitializeRegistry() {
    "use strict";

    // 注册表以调用方提供的完整业务实例名保存控制器。
    const selGridInstances = new Map();
    // create 生成但尚未 mount 的独立表格根也按实例键登记，防止动态页签重复创建 DOM。
    const selGridRoots = new Map();

    /**
     * 在空宿主中创建一套可独立挂载和销毁的表格结构。
     * @param {Element} selGridHost - 页签分隔面板提供的结果区宿主。
     * @param {object} selGridDefinition - 包含 gridId、entity 和 ariaLabel 的通用实例定义。
     * @returns {Element|null} 成功返回独立表格根；参数无效时返回 null。
     */
    function selGridCreate(selGridHost, selGridDefinition = {}) {
        if (!(selGridHost instanceof Element)) return null;
        const selGridId = String(selGridDefinition.gridId || "").trim();
        if (!selGridId) return null;
        if (selGridInstances.has(selGridId)) return selGridInstances.get(selGridId).root;
        if (selGridRoots.has(selGridId)) return selGridRoots.get(selGridId);
        // 独立结构只包含 selGrid 自身的表格、统计、容量、分页和反馈，不复制面板或应用布局。
        const selGridRoot = document.createElement("section");
        selGridRoot.className = "selgrid-standalone-shell";
        selGridRoot.dataset.selGrid = selGridId;
        selGridRoot.dataset.selEntity = String(selGridDefinition.entity || "");
        selGridRoot.setAttribute("aria-label", String(selGridDefinition.ariaLabel || "数据表格"));
        selGridRoot.innerHTML = `
            <div class="selgrid-board-shell" aria-label="数据表格">
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
            <footer class="selgrid-standalone-footer">
                <div class="selgrid-footer-summary">
                    <i class="ri-table-2" aria-hidden="true"></i>
                    <span data-sel-grid-role="total-count"></span>
                    <label class="selgrid-standalone-page-size">
                        <span class="selgrid-accessibility-sr-only">每页显示行数</span>
                        <select data-sel-grid-role="page-size" aria-label="每页显示行数"></select>
                    </label>
                </div>
                <nav class="selgrid-pagination" data-sel-grid-role="pagination" aria-label="分页"></nav>
                <div class="selgrid-feedback-toast" data-sel-grid-role="feedback" role="status" aria-live="polite"></div>
            </footer>`;
        selGridHost.appendChild(selGridRoot);
        selGridRoots.set(selGridId, selGridRoot);
        return selGridRoot;
    }

    // 独立表格的原生容量选择器消费标准 payload；面板表格继续由 selPanel 应用完整下拉契约。
    function selGridApplyStandalonePayload(selGridRoot, selGridPayload) {
        if (!selGridRoot.classList.contains("selgrid-standalone-shell")) return;
        const selGridPageSize = selGridRoot.querySelector('[data-sel-grid-role="page-size"]');
        if (!selGridPageSize) return;
        const selGridPageSizeOptions = selGridPayload.select?.pageSize?.options || [10, 20, 50, 100].map((selGridSize) => ({ value: String(selGridSize), label: `${selGridSize} 行/页` }));
        const selGridSelectedSize = String(selGridPayload.pagination?.pageSize || "20");
        selGridPageSize.replaceChildren(...selGridPageSizeOptions.map((selGridOptionData) => {
            const selGridOption = document.createElement("option");
            selGridOption.value = String(selGridOptionData.value);
            selGridOption.textContent = String(selGridOptionData.label);
            selGridOption.selected = selGridOption.value === selGridSelectedSize;
            return selGridOption;
        }));
        selGridPageSize.setAttribute("aria-label", String(selGridPayload.select?.pageSize?.ariaLabel || selGridPayload.select?.pageSize?.label || "每页显示行数"));
    }

    // 创建单个业务表格实例，所有节点查询和事件监听都限制在当前根节点内。
    function selGridCreateInstance(selGridRoot, selGridPayload) {
        // 实例名明确来自 HTML，不通过拆分字符串推测后端实体。
        const selGridId = selGridRoot.dataset.selGrid;
        // 后端实体使用独立元数据保存，基础控件不会从实例名猜测实体。
        const selGridEntity = selGridRoot.dataset.selEntity || "";
        // 缺少业务实例名时不登记无法寻址的控制器。
        if (!selGridId) {
            return null;
        }

        // 当前实例全部业务数据由应用装配层显式传入，不读取页面全局业务对象。
        let selGridInputPayload = selGridPayload || null;
        // 缺少完整 payload 时不创建半成品表格实例。
        if (!selGridInputPayload || !Array.isArray(selGridInputPayload.data?.items) || !Array.isArray(selGridInputPayload.column?.items)) {
            return null;
        }

        // records 模式按列契约渲染任意后台记录；未声明时继续保持已有项目表格兼容模式。
        const selGridRecordMode = selGridInputPayload.grid?.mode === "records";
        // 通用记录配置只保存字段名、搜索字段和状态映射，不包含任何具体应用语义。
        const selGridRecordOptions = selGridInputPayload.grid || {};
        // 行数据保持后端顺序并冻结外层数组，运行状态不能改写业务响应。
        let selGridProjects = Object.freeze(selGridInputPayload.data.items);
        // 类型显示映射使用稳定代码查找当前语言文字。
        let selGridTypeLabels = new Map((selGridInputPayload.select?.projectType?.options || []).map((selGridTypeOption) => [String(selGridTypeOption.value), selGridTypeOption.label]));
        // 状态显示映射使用稳定代码查找当前语言文字。
        let selGridStatusLabels = new Map((selGridInputPayload.select?.status?.options || []).map((selGridStatusOption) => [String(selGridStatusOption.value), selGridStatusOption.label]));
        // 当前语言业务提示集中来自 title JSON。
        let selGridMessages = selGridInputPayload.title.messages;
        // 当前语言分页模板集中来自 pagination JSON。
        let selGridPaginationData = selGridInputPayload.pagination;

        // 把后端本地化模板中的 {name} 占位符替换成当前业务值。
        function selGridFormatMessage(selGridTemplate, selGridValues) {
            // 每个值只替换同名占位符，不执行任何模板代码。
            return Object.entries(selGridValues).reduce(
                // split/join 支持同一占位符在模板中重复出现。
                (selGridResult, [selGridKey, selGridValue]) => selGridResult.split(`{${selGridKey}}`).join(String(selGridValue)),
                // 非字符串模板安全转换为空字符串。
                String(selGridTemplate || "")
            );
        }

        /**
         * 解析宽表模式的列像素宽度。
         * @param {object} selGridColumnData - column.items 中的单列定义。
         * @returns {number} 用于 col 宽度和表格最小宽度计算的正整数像素值。
         * @example grid.defaultColumnWidth 为 150 且列未声明 width 时返回 150。
         */
        function selGridResolveWideColumnWidth(selGridColumnData) {
            // 数字和 px 字符串是宽表模式可精确累计的稳定列宽格式。
            const selGridDeclaredWidth = typeof selGridColumnData.width === "number"
                ? selGridColumnData.width
                : Number.parseFloat(String(selGridColumnData.width || "").match(/^([0-9]+(?:\.[0-9]+)?)px$/i)?.[1]);
            // 未声明精确列宽时使用实例配置；无效配置回退到适合数据表的 150px。
            const selGridDefaultWidth = Number(selGridRecordOptions.defaultColumnWidth) || 150;
            // 公共组件限制极端输入，避免单列过窄不可读或异常撑大页面。
            return Math.round(Math.min(480, Math.max(96, selGridDeclaredWidth || selGridDefaultWidth)));
        }

        // 横向溢出状态在动画帧内合并测量，避免列、数据和面板尺寸连续变化时重复触发布局计算。
        let selGridHorizontalOverflowFrame = 0;

        /**
         * 根据滚动视口的真实尺寸同步横向滚动条增强状态。
         * @returns {boolean} 当前 selGrid 是否存在需要用户横向浏览的内容。
         * @example scrollWidth 为 1080 且 clientWidth 为 900 时返回 true 并显示完整横向轨道。
         */
        function selGridSyncHorizontalOverflowState() {
            // 每个实例只测量自身中央表格视口，不读取页面或其他表格的尺寸。
            const selGridTableScroller = selGridRoot.querySelector(".selgrid-table-scroller");
            // 页面骨架缺少滚动视口时安全退出，不创建悬空状态。
            if (!selGridTableScroller) {
                return false;
            }
            // 容许一像素布局舍入误差，只有真实超宽时才展示可发现的完整轨道。
            const selGridHasHorizontalOverflow = selGridTableScroller.scrollWidth > selGridTableScroller.clientWidth + 1;
            // 增强状态由公共组件自动管理，业务应用无需再声明滚动条配置。
            selGridTableScroller.classList.toggle("selgrid-table-scroller-horizontal-scroll", selGridHasHorizontalOverflow);
            // 返回测量结果便于回归检查和后续内部复用。
            return selGridHasHorizontalOverflow;
        }

        // 把本轮多次变化收敛到浏览器完成布局后的单次真实溢出判断。
        function selGridScheduleHorizontalOverflowSync() {
            // 新变化到来时取消尚未执行的旧测量，只保留最新布局状态。
            if (selGridHorizontalOverflowFrame) {
                window.cancelAnimationFrame(selGridHorizontalOverflowFrame);
            }
            // 下一动画帧已经包含本轮 DOM、列宽与容器尺寸更新。
            selGridHorizontalOverflowFrame = window.requestAnimationFrame(() => {
                // 帧开始后清空句柄，允许后续变化继续安排新测量。
                selGridHorizontalOverflowFrame = 0;
                // 使用最终布局尺寸切换默认横向滚动反馈。
                selGridSyncHorizontalOverflowState();
            });
        }

        // 根据 column JSON 生成表头，使列名和排序说明不再写死在 HTML。
        function selGridRenderColumnHeader() {
            // 当前实例表格节点用于同步可访问名称。
            const selGridTable = selGridRoot.querySelector('[data-sel-grid-role="table"]');
            // 列宽组节点承接 column JSON 的 className。
            const selGridColumnGroup = selGridRoot.querySelector('[data-sel-grid-role="column-group"]');
            // 表头节点承接当前语言列名称。
            const selGridTableHead = selGridRoot.querySelector('[data-sel-grid-role="table-head"]');
            // 任一关键表格节点被删除时允许当前区域安全降级。
            if (!selGridTable || !selGridColumnGroup || !selGridTableHead) {
                return;
            }
            // 表格可访问名称来自当前语言 column JSON。
            selGridTable.setAttribute("aria-label", selGridInputPayload.column.ariaLabel);
            // 宽表能力必须由应用 payload 显式开启，已有表格继续保持原布局。
            const selGridHorizontalScroll = selGridRecordMode && selGridRecordOptions.horizontalScroll === true;
            // 状态类让 CSS 只约束宽表记录的截断方式，不改变项目型表格样式。
            selGridTable.classList.toggle("selgrid-table-horizontal-scroll", selGridHorizontalScroll);
            // 宽表按所有列宽总和产生内部溢出；关闭时恢复基础样式的默认最小宽度。
            const selGridWideTableWidth = selGridHorizontalScroll
                ? selGridInputPayload.column.items.reduce((selGridWidth, selGridColumnData) => selGridWidth + selGridResolveWideColumnWidth(selGridColumnData), 0)
                : 0;
            selGridTable.style.minWidth = selGridHorizontalScroll ? `${Math.max(930, selGridWideTableWidth)}px` : "";
            // 列宽节点严格按后端列顺序生成。
            const selGridColumns = selGridInputPayload.column.items.map((selGridColumnData) => {
                // col 只承载稳定样式类，不包含业务文字。
                const selGridColumn = document.createElement("col");
                // className 由基础控件公开列样式白名单提供。
                selGridColumn.className = selGridColumnData.className;
                // 宽表统一使用可累计像素宽度；普通记录表继续兼容已有百分比或像素宽度配置。
                if (selGridHorizontalScroll) {
                    selGridColumn.style.width = `${selGridResolveWideColumnWidth(selGridColumnData)}px`;
                } else if (selGridRecordMode && selGridColumnData.width) {
                    selGridColumn.style.width = String(selGridColumnData.width);
                }
                // 返回列节点供一次替换。
                return selGridColumn;
            });
            // 一次替换完整列宽定义。
            selGridColumnGroup.replaceChildren(...selGridColumns);
            // 单行表头承载全部列标题。
            const selGridHeaderRow = document.createElement("tr");
            // 每个 column 片段生成对应 th。
            selGridInputPayload.column.items.forEach((selGridColumnData) => {
                // th 保持原生表格语义。
                const selGridHeaderCell = document.createElement("th");
                // 选择列需要创建表头复选按钮。
                if (selGridColumnData.renderer === "selection") {
                    // 选择列沿用固定对齐视觉类。
                    selGridHeaderCell.className = "selgrid-selection-cell";
                    // 原生按钮模拟可访问全选复选框。
                    const selGridSelectAll = document.createElement("button");
                    // 基础表格复选框皮肤保持不变。
                    selGridSelectAll.className = "selgrid-selection-checkbox";
                    // 按钮不提交外部表单。
                    selGridSelectAll.type = "button";
                    // 稳定 role 让当前实例控制器可查找。
                    selGridSelectAll.dataset.selGridRole = "select-all";
                    // checkbox 角色表达真实选择语义。
                    selGridSelectAll.setAttribute("role", "checkbox");
                    // 初始没有选择全部可见项目。
                    selGridSelectAll.setAttribute("aria-checked", "false");
                    // 可访问名称使用当前语言选择项目提示。
                    selGridSelectAll.setAttribute("aria-label", selGridMessages.selectProject);
                    // 全选按钮加入选择列表头。
                    selGridHeaderCell.appendChild(selGridSelectAll);
                } else if (selGridColumnData.sortable) {
                    // 可排序列使用原生按钮表达排序动作。
                    const selGridSortButton = document.createElement("button");
                    // 排序按钮沿用表格标题视觉。
                    selGridSortButton.className = "selgrid-sort-button";
                    // 按钮不提交外部表单。
                    selGridSortButton.type = "button";
                    // 当前语言排序说明进入可访问名称。
                    selGridSortButton.setAttribute("aria-label", selGridColumnData.sortAriaLabel);
                    // 当前语言列名作为可见文字。
                    selGridSortButton.appendChild(document.createTextNode(selGridColumnData.label));
                    // 排序方向图标由后端 direction 映射到基础图标。
                    const selGridSortIcon = document.createElement("i");
                    // descending 使用向下箭头，其余方向使用向上箭头。
                    selGridSortIcon.className = selGridColumnData.sortDirection === "descending" ? "ri-arrow-down-line" : "ri-arrow-up-line";
                    // 图标只提供装饰视觉。
                    selGridSortIcon.setAttribute("aria-hidden", "true");
                    // 图标加入排序按钮。
                    selGridSortButton.appendChild(selGridSortIcon);
                    // 排序按钮加入当前表头。
                    selGridHeaderCell.appendChild(selGridSortButton);
                } else {
                    // 普通列直接显示当前语言 label。
                    selGridHeaderCell.textContent = selGridColumnData.label;
                }
                // 完整表头加入当前行。
                selGridHeaderRow.appendChild(selGridHeaderCell);
            });
            // 当前表格只保留后端 column JSON 生成的表头。
            selGridTableHead.replaceChildren(selGridHeaderRow);
            // 空结果文字与列语言保持一致。
            const selGridEmptyText = selGridRoot.querySelector('[data-sel-grid-role="empty-text"]');
            // 空状态区域存在时写入当前语言说明。
            if (selGridEmptyText) {
                selGridEmptyText.textContent = selGridInputPayload.column.emptyText;
            }
            // 表头和列宽完成替换后重新测量，滚动条增强状态不依赖业务宽表开关。
            selGridScheduleHorizontalOverflowSync();
        }

        // 根据当前总页数和页码生成紧凑的可见页码，数据量及每页条数变化时无需依赖静态页码数组。
        function selGridResolveVisiblePages(selGridTotalPages) {
            // 首页、末页和当前页前后各一页组成候选集合，确保翻页后当前页始终有直接入口。
            const selGridCandidatePages = [1, selGridState.currentPage - 1, selGridState.currentPage, selGridState.currentPage + 1, selGridTotalPages];
            // 过滤越界页码、去重并升序排列，供渲染层在空隙中插入省略号。
            return Array.from(new Set(selGridCandidatePages.filter((selGridPageNumber) => selGridPageNumber >= 1 && selGridPageNumber <= selGridTotalPages))).sort((selGridLeftPage, selGridRightPage) => selGridLeftPage - selGridRightPage);
        }

        // 根据当前筛选结果和页面容量重建分页按钮，页数不再由静态演示配置写死。
        function selGridRenderPaginationStructure(selGridTotalPages) {
            // 当前实例分页根允许独立删除。
            const selGridPaginationRoot = selGridRoot.querySelector('[data-sel-grid-role="pagination"]');
            // 没有分页区域时直接返回。
            if (!selGridPaginationRoot) {
                return;
            }
            // 文档片段承载完整分页顺序。
            const selGridPaginationFragment = document.createDocumentFragment();
            // 上一页按钮使用当前语言可访问名称。
            const selGridPreviousButton = document.createElement("button");
            // 分页箭头共享基础视觉类。
            selGridPreviousButton.className = "selgrid-pagination-button selgrid-pagination-arrow";
            // 按钮不提交外部表单。
            selGridPreviousButton.type = "button";
            // 动作代码供实例事件委托处理。
            selGridPreviousButton.dataset.pageAction = "previous";
            // 当前语言名称供辅助技术播报。
            selGridPreviousButton.setAttribute("aria-label", selGridPaginationData.previousLabel);
            // 向左图标是装饰信息。
            selGridPreviousButton.innerHTML = '<i class="ri-arrow-left-s-line" aria-hidden="true"></i>';
            // 上一页按钮放在页码之前。
            selGridPaginationFragment.appendChild(selGridPreviousButton);
            // 记录前一个页码，用于在不连续页码之间插入省略号。
            let selGridPreviousPage = 0;
            // 当前总页数和页码共同决定需要展示哪些数字页。
            selGridResolveVisiblePages(selGridTotalPages).forEach((selGridPageNumber) => {
                // 页码跳跃超过一页时插入视觉省略号。
                if (selGridPreviousPage > 0 && selGridPageNumber - selGridPreviousPage > 1) {
                    // 省略号不参与辅助技术朗读。
                    const selGridPaginationEllipsis = document.createElement("span");
                    // 视觉类保持与现有分页一致。
                    selGridPaginationEllipsis.className = "selgrid-pagination-ellipsis";
                    // 隐藏重复语义。
                    selGridPaginationEllipsis.setAttribute("aria-hidden", "true");
                    // 使用标准省略号字符。
                    selGridPaginationEllipsis.textContent = "…";
                    // 省略号加入页码序列。
                    selGridPaginationFragment.appendChild(selGridPaginationEllipsis);
                }
                // 每个数字页使用真实按钮。
                const selGridPageButton = document.createElement("button");
                // 当前页获得激活视觉，筛选和容量变化后仍与真实数据页一致。
                selGridPageButton.className = `selgrid-pagination-button${selGridPageNumber === selGridState.currentPage ? " selgrid-pagination-current" : ""}`;
                // 按钮不提交外部表单。
                selGridPageButton.type = "button";
                // 页码值供事件委托读取。
                selGridPageButton.dataset.page = String(selGridPageNumber);
                // 可见文字就是页码。
                selGridPageButton.textContent = String(selGridPageNumber);
                // 当前页同步 aria-current，辅助技术可读取真实分页位置。
                if (selGridPageNumber === selGridState.currentPage) {
                    selGridPageButton.setAttribute("aria-current", "page");
                }
                // 页码按钮加入片段。
                selGridPaginationFragment.appendChild(selGridPageButton);
                // 保存本轮页码供下一项判断间距。
                selGridPreviousPage = selGridPageNumber;
            });
            // 下一页按钮使用当前语言可访问名称。
            const selGridNextButton = document.createElement("button");
            // 分页箭头共享基础视觉类。
            selGridNextButton.className = "selgrid-pagination-button selgrid-pagination-arrow";
            // 按钮不提交外部表单。
            selGridNextButton.type = "button";
            // 动作代码供实例事件委托处理。
            selGridNextButton.dataset.pageAction = "next";
            // 当前语言名称供辅助技术播报。
            selGridNextButton.setAttribute("aria-label", selGridPaginationData.nextLabel);
            // 向右图标是装饰信息。
            selGridNextButton.innerHTML = '<i class="ri-arrow-right-s-line" aria-hidden="true"></i>';
            // 下一页按钮放在页码之后。
            selGridPaginationFragment.appendChild(selGridNextButton);
            // 第一页时禁用上一页，避免用户触发无效边界动作。
            selGridPreviousButton.disabled = selGridState.currentPage <= 1;
            // 末页时禁用下一页，末页不足一页也保持正确边界。
            selGridNextButton.disabled = selGridState.currentPage >= selGridTotalPages;
            // 一次替换完整分页结构。
            selGridPaginationRoot.replaceChildren(selGridPaginationFragment);
        }

        // 表头必须先生成，后续视图缓存才能找到动态全选按钮。
        selGridRenderColumnHeader();

    // 页面状态集中保存当前选择、菜单归属和分页位置，保证交互之间不会互相覆盖。
    const selGridState = {
        // 初始选择集合来自 data JSON。
        selectedIds: new Set(selGridInputPayload.data.selectedIds),
        // 记录通过数据栏选中的焦点行，重绘后仍把键盘焦点还给该业务记录。
        focusedProjectId: null,
        // 初始页码来自 pagination JSON。
        currentPage: selGridPaginationData.currentPage,
        // 初始每页条数来自 pagination JSON。
        pageSize: selGridPaginationData.pageSize,
        // 搜索关键字同时匹配项目名称、负责人和项目类型。
        search: "",
        // 工具栏类型筛选初始展示全部类型。
        type: "",
        // 标题标签和工具栏共享当前状态筛选值。
        status: "",
        // 左侧树筛选独立保存，允许与工具栏条件组合。
        treeFilter: {}
    };

    // 缓存表格和浮层固定节点，交互更新时避免重复查找页面结构。
    const selGridView = {
        // 表格滚动视口负责截断顶部、底部及横向边界的滚轮穿透。
        tableScroller: selGridRoot.querySelector('.selgrid-table-scroller'),
        // 表格主体承接项目行的动态渲染。
        tableBody: selGridRoot.querySelector('[data-sel-grid-role="table-body"]'),
        // 全选按钮同步全部项目的选择状态。
        selectAll: selGridRoot.querySelector('[data-sel-grid-role="select-all"]'),
        // 每页条数选择器提供可见反馈。
        pageSize: selGridRoot.querySelector('[data-sel-grid-role="page-size"]'),
        // Toast 区域展示菜单与分页动作结果。
        feedbackToast: selGridRoot.querySelector('[data-sel-grid-role="feedback"]'),
        // 空结果区域在组合筛选无匹配时提供明确反馈。
        emptyState: selGridRoot.querySelector('[data-sel-grid-role="empty-state"]'),
        // 类型选择器提供精确类型筛选。
        typeFilter: selGridRoot.querySelector('[data-sel-grid-role="type-filter"]'),
        // 状态选择器与顶部状态标签保持同步。
        statusFilter: selGridRoot.querySelector('[data-sel-grid-role="status-filter"]'),
        // 重置按钮一次清空全部工具栏和树形条件。
        filterReset: selGridRoot.querySelector('[data-sel-grid-role="filter-reset"]'),
        // 统计文字显示当前匹配数量和设计稿总项目数。
        totalCount: selGridRoot.querySelector('[data-sel-grid-role="total-count"]'),
        // 分页导航可能随底栏整体删除，存在时才绑定翻页交互。
        pagination: selGridRoot.querySelector('[data-sel-grid-role="pagination"]'),
        // 顶部状态标签可能随标题区删除，存在时才绑定快捷筛选。
        statusTabs: selGridRoot.querySelector('[data-sel-grid-role="status-tabs"]'),
        // 标题快捷操作可能随标题区删除，存在时才绑定页面级命令。
        headerActions: selGridRoot.querySelector('[data-sel-grid-role="header-actions"]'),
        // 日期入口属于工具栏独立控件，存在时才提供范围反馈。
        dateCommand: selGridRoot.querySelector('[data-sel-grid-role="date-command"]')
    };

    // 当前实例的搜索、树和菜单控制器按相同业务实例名获取。
    const selGridSearchController = window.selSearch ? window.selSearch.get(selGridId) : null;
    const selGridTreeController = window.selTree ? window.selTree.get(selGridId) : null;
    const selGridMenuController = window.selGridMenu ? window.selGridMenu.get(selGridId) : null;

    // 中央表格内容区被删除时当前实例不登记，其他业务实例继续初始化。
    if (!selGridView.tableBody) {
        return null;
    }

    // 面板缩放、侧栏折叠和浏览器尺寸变化都可能改变中央视口的真实溢出状态。
    const selGridHorizontalOverflowObserver = typeof window.ResizeObserver === "function" && selGridView.tableScroller
        ? new window.ResizeObserver(() => selGridScheduleHorizontalOverflowSync())
        : null;
    // 观察滚动视口可覆盖应用布局变化，无需每个调用方另行绑定折叠事件。
    selGridHorizontalOverflowObserver?.observe(selGridView.tableScroller);
    // 观察表格本体可覆盖运行时语言或列定义改变造成的内容宽度变化。
    const selGridObservedTable = selGridRoot.querySelector('[data-sel-grid-role="table"]');
    if (selGridHorizontalOverflowObserver && selGridObservedTable) {
        selGridHorizontalOverflowObserver.observe(selGridObservedTable);
    }

    // 记录 Toast 关闭计时器，连续操作时始终以最新提示为准。
    let selGridToastTimer = 0;

    // 根据项目状态返回与参考图一致的 Remix 图标名称。
    function selGridResolveStatusIcon(statusType) {
        // 进行中状态使用菱形进度标记。
        if (statusType === "active") {
            return "ri-checkbox-blank-circle-line";
        }
        // 评审中状态使用带圆心的流程标记。
        if (statusType === "review") {
            return "ri-record-circle-line";
        }
        // 已完成状态使用确认标记。
        if (statusType === "done") {
            return "ri-checkbox-circle-line";
        }
        // 已归档状态使用中性圆点标记。
        return "ri-circle-line";
    }

    // 创建图标节点时只接收图标库类名，避免用文字字符替代真实图标。
    function selGridCreateIcon(className) {
        // 使用语义中性的 i 元素承载 Remix Icon 字体。
        const icon = document.createElement("i");
        // 写入已经由静态项目数据限定的图标库类名。
        icon.className = className;
        // 图标属于装饰信息，业务含义由相邻文字或按钮标签表达。
        icon.setAttribute("aria-hidden", "true");
        // 返回可直接插入组件的图标节点。
        return icon;
    }

    // 创建一个图标操作按钮，并把项目主键和动作写入可访问属性。
    function selGridCreateActionButton(project, action, iconClass, label) {
        // 真实 button 保证键盘和辅助技术都能触发项目动作。
        const button = document.createElement("button");
        // 所有圆形操作按钮共享视觉类。
        button.className = "selgrid-action-button";
        // 按钮不参与任何外部表单提交。
        button.type = "button";
        // 项目主键用于事件委托确定动作目标。
        button.dataset.projectId = String(project.id);
        // 动作名称区分查看、编辑与更多菜单。
        button.dataset.action = action;
        // 可访问名称补足纯图标按钮的业务语义。
        button.setAttribute("aria-label", `${label}：${project.name}`);
        // 更多按钮同步菜单展开状态。
        if (action === "menu") {
            // 独立菜单控制器提供当前绑定项目，表格不再保存菜单内部状态。
            const activeMenuProjectId = selGridMenuController ? selGridMenuController.getProjectId() : null;
            // 展开属性只对当前菜单归属项目为真。
            button.setAttribute("aria-expanded", String(activeMenuProjectId === project.id));
            // 当前菜单锚点使用高亮圆形底板。
            button.classList.toggle("selgrid-action-active", activeMenuProjectId === project.id);
        }
        // 图标库节点放入按钮作为可见内容。
        button.appendChild(selGridCreateIcon(iconClass));
        // 返回完整操作按钮。
        return button;
    }

    /**
     * 读取通用记录中的稳定字段值。
     * @param {object} selGridRecord - 后端聚合结果中的一条业务记录。
     * @param {string} selGridField - column 或 grid 契约声明的字段名。
     * @returns {unknown} 字段不存在时返回空字符串。
     */
    function selGridReadRecordValue(selGridRecord, selGridField) {
        if (!selGridField) return "";
        return String(selGridField).split(".").reduce(
            (selGridValue, selGridPart) => selGridValue && typeof selGridValue === "object" ? selGridValue[selGridPart] : "",
            selGridRecord
        );
    }

    /**
     * 创建通用记录模式的单元格内容。
     * @param {object} selGridRecord - 当前业务记录。
     * @param {object} selGridColumn - 标准列定义。
     * @returns {HTMLTableCellElement} 仅使用受控 text、stack、badge、time、actions 渲染器的单元格。
     */
    function selGridCreateRecordCell(selGridRecord, selGridColumn) {
        const selGridCell = document.createElement("td");
        const selGridRenderer = String(selGridColumn.renderer || "text");
        const selGridRawValue = selGridReadRecordValue(selGridRecord, selGridColumn.field);
        if (selGridRenderer === "stack") {
            const selGridStack = document.createElement("span");
            selGridStack.className = "selgrid-record-stack";
            const selGridPrimary = document.createElement("strong");
            selGridPrimary.textContent = String(selGridRawValue ?? "—") || "—";
            const selGridSecondary = document.createElement("span");
            selGridSecondary.textContent = String(selGridReadRecordValue(selGridRecord, selGridColumn.secondaryField) ?? "—") || "—";
            selGridStack.append(selGridPrimary, selGridSecondary);
            selGridCell.appendChild(selGridStack);
            return selGridCell;
        }
        if (selGridRenderer === "badge") {
            const selGridBadge = document.createElement("span");
            const selGridMappedTone = selGridColumn.toneMap?.[String(selGridRawValue)];
            const selGridTone = String(selGridMappedTone || selGridReadRecordValue(selGridRecord, selGridColumn.toneField) || selGridColumn.tone || "neutral");
            selGridBadge.className = `selgrid-record-badge selgrid-record-badge-${selGridTone.replace(/[^a-z0-9_-]/gi, "")}`;
            const selGridLabelMap = selGridColumn.labelSource === "status" ? selGridStatusLabels : selGridTypeLabels;
            selGridBadge.textContent = selGridLabelMap.get(String(selGridRawValue)) || String(selGridRawValue ?? "—") || "—";
            selGridCell.appendChild(selGridBadge);
            return selGridCell;
        }
        if (selGridRenderer === "actions") {
            const selGridActions = document.createElement("div");
            selGridActions.className = "selgrid-action-group";
            (selGridColumn.actions || []).forEach((selGridAction) => {
                const selGridButton = document.createElement("button");
                selGridButton.className = `selgrid-action-button${selGridAction.tone ? ` selgrid-action-${selGridAction.tone}` : ""}`;
                selGridButton.type = "button";
                selGridButton.dataset.action = String(selGridAction.id || "");
                selGridButton.setAttribute("aria-label", String(selGridAction.label || selGridAction.id || "操作"));
                selGridButton.appendChild(selGridCreateIcon(selGridAction.icon || "ri-more-line"));
                selGridActions.appendChild(selGridButton);
            });
            selGridCell.appendChild(selGridActions);
            return selGridCell;
        }
        const selGridDisplayValue = selGridRenderer === "time" && selGridRawValue
            ? String(selGridRawValue).replace("T", " ").slice(0, 16)
            : String(selGridRawValue ?? "—") || "—";
        selGridCell.textContent = selGridDisplayValue;
        // 宽表截断后仍可通过原生悬浮提示查看完整字段值。
        if (selGridRecordOptions.horizontalScroll === true && selGridDisplayValue !== "—") selGridCell.title = selGridDisplayValue;
        if (selGridColumn.nowrap || selGridRenderer === "time") selGridCell.classList.add("selgrid-record-nowrap");
        return selGridCell;
    }

    /**
     * 按 column.items 创建一条通用后台记录行。
     * @param {object} selGridRecord - 后端返回的任意实体记录。
     * @returns {HTMLTableRowElement} 可通过 selGrid:action 事件操作的完整表格行。
     */
    function selGridCreateRecordRow(selGridRecord) {
        const selGridRow = document.createElement("tr");
        const selGridRecordId = selGridReadRecordValue(selGridRecord, selGridRecordOptions.idField || "id");
        selGridRow.dataset.selGridRecordId = String(selGridRecordId);
        selGridRow.tabIndex = -1;
        selGridInputPayload.column.items.forEach((selGridColumn) => selGridRow.appendChild(selGridCreateRecordCell(selGridRecord, selGridColumn)));
        return selGridRow;
    }

    // 创建项目行并按参考图的八列结构填充真实可交互内容。
    function selGridCreateProjectRow(project) {
        // 每条项目数据对应一个可选择的表格行。
        const row = document.createElement("tr");
        // 主键用于选择交互和操作菜单定位。
        row.dataset.projectId = String(project.id);
        // 数据行可接收程序化焦点，使栏目点击后的焦点落在实际被选业务记录上。
        row.tabIndex = -1;
        // 辅助技术通过行选择语义读取当前记录是否已被勾选。
        row.setAttribute("aria-selected", String(selGridState.selectedIds.has(project.id)));
        // 当前被选中的项目行获得蓝紫色发光背景。
        row.classList.toggle("selgrid-row-selected", selGridState.selectedIds.has(project.id));
        // 栏目点击后的焦点行额外获得聚焦边框，避免多选时无法辨认最后操作的记录。
        row.classList.toggle("selgrid-row-focused", selGridState.focusedProjectId === project.id);

        // 第一列承载单行选择按钮。
        const checkCell = document.createElement("td");
        // 复用表头相同的左侧对齐规则。
        checkCell.className = "selgrid-selection-cell";
        // 真实按钮模拟参考图方形复选框并支持键盘操作。
        const checkbox = document.createElement("button");
        // 复选框视觉由统一类控制。
        checkbox.className = "selgrid-selection-checkbox";
        // 防止按钮触发表单提交。
        checkbox.type = "button";
        // 角色明确告诉辅助技术这是复选控件。
        checkbox.setAttribute("role", "checkbox");
        // 当前选择状态与页面状态集合保持一致。
        checkbox.setAttribute("aria-checked", String(selGridState.selectedIds.has(project.id)));
        // 可访问名称携带项目名称。
        checkbox.setAttribute("aria-label", `${selGridMessages.selectProject}：${project.name}`);
        // 动作和主键交给表格事件委托处理。
        checkbox.dataset.action = "select";
        checkbox.dataset.projectId = String(project.id);
        // 复选控件加入首列。
        checkCell.appendChild(checkbox);

        // 第二列组合项目彩色符号、名称和星标。
        const projectCell = document.createElement("td");
        // 内部弹性布局保持符号和名称垂直居中。
        const projectLayout = document.createElement("div");
        // 项目主列共享参考图水平间距。
        projectLayout.className = "selgrid-project-cell";
        // 彩色符号使用项目状态色生成独立视觉识别。
        const symbol = document.createElement("span");
        // 符号容器负责参考图中的霓虹方形底座。
        symbol.className = "selgrid-project-symbol";
        // 两个项目色写成 CSS 变量供皮肤层生成一致渐变。
        symbol.style.setProperty("--selgrid-project-symbol-start", project.colors[0]);
        symbol.style.setProperty("--selgrid-project-symbol-end", project.colors[1]);
        // 每个项目使用真实图标库中的对应业务图标。
        symbol.appendChild(selGridCreateIcon(project.symbol));
        // 名称区域保持长项目名可截断。
        const nameLayout = document.createElement("span");
        // 名称与星标共享水平排列。
        nameLayout.className = "selgrid-project-name";
        // 项目名称是该行主要文本。
        const projectName = document.createElement("strong");
        // 使用 textContent 防止数据内容被解释成 HTML。
        projectName.textContent = project.name;
        // 名称加入文字区域。
        nameLayout.appendChild(projectName);
        // 参考图仅在部分项目名称后展示收藏或关注标记。
        if (project.starred || project.favorite) {
            // 星标使用图标库资产，不使用 Unicode 字符替代。
            const star = selGridCreateIcon(project.favorite ? "ri-star-fill" : "ri-star-line");
            // 收藏项目使用黄色强调，关注项目使用蓝色强调。
            star.classList.toggle("selgrid-project-favorite", project.favorite);
            // 星标加入名称尾部。
            nameLayout.appendChild(star);
        }
        // 项目符号和名称按参考图顺序加入布局。
        projectLayout.append(symbol, nameLayout);
        // 完整项目布局加入第二列。
        projectCell.appendChild(projectLayout);

        // 第三列根据稳定类型代码展示当前语言名称。
        const typeCell = document.createElement("td");
        // 显示文字来自项目类型下拉 JSON，找不到代码时保留原始代码便于排错。
        typeCell.textContent = selGridTypeLabels.get(project.type) || project.type;

        // 第四列组合真实头像图片、负责人姓名和首行认证标记。
        const ownerCell = document.createElement("td");
        // 负责人列使用紧凑弹性布局。
        const ownerLayout = document.createElement("div");
        // 头像与姓名保持参考图中的九像素间距。
        ownerLayout.className = "selgrid-owner-cell";
        // 头像使用远程头像服务提供真实人物照片，避免占位字母或 CSS 人像。
        const avatar = document.createElement("img");
        // 头像视觉类负责圆形裁切与边框。
        avatar.className = "selgrid-owner-avatar";
        // 固定编号保证每次打开都得到同一负责人照片。
        avatar.src = `https://i.pravatar.cc/80?img=${project.avatar}`;
        // 图片替代文本直接使用负责人姓名，避免前端写死某一种语言后缀。
        avatar.alt = project.owner;
        // 明确尺寸降低图片加载时的布局抖动。
        avatar.width = 39;
        // 明确高度保持头像为正圆。
        avatar.height = 39;
        // 姓名文本单独承载便于窄屏处理。
        const ownerName = document.createElement("span");
        // 负责人姓名使用稳定视觉类。
        ownerName.className = "selgrid-owner-name";
        // 负责人姓名来自项目数据。
        ownerName.textContent = project.owner;
        // 头像和姓名依次加入负责人布局。
        ownerLayout.append(avatar, ownerName);
        // 后端 verifiedOwner 字段明确决定是否展示认证徽标。
        if (project.verifiedOwner) {
            // 徽标是状态装饰，不替代负责人姓名。
            const badge = document.createElement("span");
            // 小型蓝色圆形徽标与头像保持同一基线。
            badge.className = "selgrid-owner-badge";
            // 图标库的认证图标提供真实视觉资产。
            badge.appendChild(selGridCreateIcon("ri-verified-badge-fill"));
            // 徽标加入负责人姓名之后。
            ownerLayout.appendChild(badge);
        }
        // 完整负责人布局加入第四列。
        ownerCell.appendChild(ownerLayout);

        // 第五列展示带状态色和发光边框的胶囊标签。
        const statusCell = document.createElement("td");
        // 状态胶囊使用类型类控制蓝、紫、绿和中性色。
        const statusPill = document.createElement("span");
        // 状态色类型只来自后端稳定枚举，安全映射到 CSS 类。
        statusPill.className = `selgrid-status-pill selgrid-status-${project.statusTone}`;
        // 状态前置图标与当前语言文字共同表达业务阶段。
        statusPill.append(selGridCreateIcon(selGridResolveStatusIcon(project.statusTone)), document.createTextNode(selGridStatusLabels.get(project.status) || project.status));
        // 完整状态组件加入第五列。
        statusCell.appendChild(statusPill);

        // 第六列展示百分比与霓虹进度轨道。
        const progressCellElement = document.createElement("td");
        // 进度为 null 时只显示破折号。
        if (project.progress === null) {
            // 破折号与参考图归档行一致。
            progressCellElement.textContent = "—";
        } else {
            // 进度布局垂直排列数字和轨道。
            const progressLayout = document.createElement("div");
            // 满进度项目切换绿色皮肤。
            progressLayout.className = `selgrid-progress-cell${project.progress === 100 ? " selgrid-progress-complete" : ""}`;
            // 百分比文本放在轨道上方。
            const progressValue = document.createElement("span");
            // 百分比视觉类保持与正文区分。
            progressValue.className = "selgrid-progress-value";
            // 百分比数据转换成参考图显示格式。
            progressValue.textContent = `${project.progress}%`;
            // 轨道承载实际宽度变化。
            const progressTrack = document.createElement("span");
            // 统一深色背景轨道。
            progressTrack.className = "selgrid-progress-track";
            // 进度条以业务百分比控制宽度。
            const progressBar = document.createElement("span");
            // 发光填充条共享皮肤。
            progressBar.className = "selgrid-progress-bar";
            // CSS 变量直接接收已验证的 0 到 100 数值。
            progressBar.style.setProperty("--selgrid-progress-value", `${project.progress}%`);
            // 辅助技术读取真实进度语义。
            progressTrack.setAttribute("role", "progressbar");
            // 当前进度值用于屏幕阅读器播报。
            progressTrack.setAttribute("aria-valuenow", String(project.progress));
            // 进度最小值固定为零。
            progressTrack.setAttribute("aria-valuemin", "0");
            // 进度最大值固定为一百。
            progressTrack.setAttribute("aria-valuemax", "100");
            // 填充条加入轨道。
            progressTrack.appendChild(progressBar);
            // 百分比和轨道加入进度布局。
            progressLayout.append(progressValue, progressTrack);
            // 完整进度布局加入第六列。
            progressCellElement.appendChild(progressLayout);
        }

        // 第七列展示参考图中的固定更新时间。
        const timeCell = document.createElement("td");
        // 时间文本保持年月日和分钟精度。
        timeCell.textContent = project.updatedAt;

        // 第八列提供查看、编辑和更多操作三个可交互按钮。
        const actionsCell = document.createElement("td");
        // 操作按钮使用水平圆形布局。
        const actions = document.createElement("div");
        // 操作组统一间距和点击区域。
        actions.className = "selgrid-action-group";
        // 三个按钮对应参考图的眼睛、编辑和省略号动作。
        actions.append(
            selGridCreateActionButton(project, "view", "ri-eye-line", selGridMessages.viewProject),
            selGridCreateActionButton(project, "edit", "ri-edit-line", selGridMessages.editProject),
            selGridCreateActionButton(project, "menu", "ri-more-fill", selGridMessages.moreActions)
        );
        // 完整操作组加入最后一列。
        actionsCell.appendChild(actions);

        // 八列按参考图顺序一次加入项目行。
        row.append(checkCell, projectCell, typeCell, ownerCell, statusCell, progressCellElement, timeCell, actionsCell);
        // 返回已经完成的项目行供表格一次渲染。
        return row;
    }

    // 根据搜索、工具栏和树形条件返回当前可见项目。
    function selGridGetVisibleProjects() {
        // 搜索关键字统一转为小写，英文内容匹配时不区分大小写。
        const keyword = selGridState.search.trim().toLocaleLowerCase();
        // 通用记录模式由 grid.searchFields、typeField 和 statusField 明确声明筛选字段。
        if (selGridRecordMode) {
            const selGridSearchFields = Array.isArray(selGridRecordOptions.searchFields) ? selGridRecordOptions.searchFields : [];
            return selGridProjects.filter((selGridRecord) => {
                const selGridSearchableText = selGridSearchFields.map((selGridField) => selGridReadRecordValue(selGridRecord, selGridField)).join(" ").toLocaleLowerCase();
                const selGridMatchesSearch = !keyword || selGridSearchableText.includes(keyword);
                const selGridTypeValue = String(selGridReadRecordValue(selGridRecord, selGridRecordOptions.typeField));
                const selGridStatusValue = String(selGridReadRecordValue(selGridRecord, selGridRecordOptions.statusField));
                const selGridMatchesType = !selGridState.type || selGridTypeValue === String(selGridState.type);
                const selGridMatchesStatus = !selGridState.status || selGridStatusValue === String(selGridState.status);
                const selGridMatchesTreeType = !selGridState.treeFilter.type || selGridTypeValue === String(selGridState.treeFilter.type);
                const selGridMatchesTreeStatus = !selGridState.treeFilter.status || selGridStatusValue === String(selGridState.treeFilter.status);
                return selGridMatchesSearch && selGridMatchesType && selGridMatchesStatus && selGridMatchesTreeType && selGridMatchesTreeStatus;
            });
        }
        // 后端项目数据逐项检查全部组合条件。
        return selGridProjects.filter((project) => {
            // 名称、负责人、本地化类型和状态组成当前记录的可搜索文本。
            const searchableText = `${project.name} ${project.owner} ${selGridTypeLabels.get(project.type) || project.type} ${selGridStatusLabels.get(project.status) || project.status}`.toLocaleLowerCase();
            // 搜索为空时全部通过，否则必须包含关键字。
            const matchesSearch = !keyword || searchableText.includes(keyword);
            // 工具栏类型为空时全部通过，否则必须精确匹配。
            const matchesType = !selGridState.type || project.type === selGridState.type;
            // 状态为空时全部通过，否则必须精确匹配。
            const matchesStatus = !selGridState.status || project.status === selGridState.status;
            // 左树单类型条件为空时全部通过。
            const matchesTreeType = !selGridState.treeFilter.type || project.type === selGridState.treeFilter.type;
            // 左树类型组为空时全部通过，否则必须属于人工配置数组。
            const matchesTreeTypeGroup = !Array.isArray(selGridState.treeFilter.typeGroup) || selGridState.treeFilter.typeGroup.includes(project.type);
            // 左树状态条件为空时全部通过。
            const matchesTreeStatus = !selGridState.treeFilter.status || project.status === selGridState.treeFilter.status;
            // 只有全部条件同时满足时项目才进入当前视图。
            return matchesSearch && matchesType && matchesStatus && matchesTreeType && matchesTreeTypeGroup && matchesTreeStatus;
        });
    }

    // 根据当前状态重新渲染可见项目记录，并同步全选、统计和空结果视觉。
    function selGridRenderTable() {
        // 先计算本轮组合筛选后的完整项目集合，分页只作用于筛选结果而不丢失匹配记录。
        const filteredProjects = selGridGetVisibleProjects();
        // 每页条数始终至少为一，避免异常输入造成除零或无限页数。
        const normalizedPageSize = Math.max(1, Math.floor(Number(selGridState.pageSize) || selGridPaginationData.pageSize));
        // 当前真实总页数由匹配数量和页面容量计算，空结果仍保留第一页导航语义。
        const totalPages = Math.max(1, Math.ceil(filteredProjects.length / normalizedPageSize));
        // 筛选缩短结果或外部传入越界页码时，把当前页收敛到真实页数范围。
        selGridState.currentPage = Math.min(totalPages, Math.max(1, Math.floor(Number(selGridState.currentPage) || 1)));
        // 当前页起始位置按零基下标计算。
        const pageStartIndex = (selGridState.currentPage - 1) * normalizedPageSize;
        // 当前页只截取页面容量范围内的记录，末页自然保留不足一页的数据。
        const visibleProjects = filteredProjects.slice(pageStartIndex, pageStartIndex + normalizedPageSize);
        // 文档片段减少逐行插入引起的重复布局计算。
        const fragment = document.createDocumentFragment();
        // 每条可见项目记录生成完整交互行。
        visibleProjects.forEach((project) => fragment.appendChild(selGridRecordMode ? selGridCreateRecordRow(project) : selGridCreateProjectRow(project)));
        // 一次替换旧表格内容，确保状态与视觉完全同步。
        selGridView.tableBody.replaceChildren(fragment);
        // 当前视图存在记录且全部被选中时才标记表头全选。
        const allVisibleSelected = !selGridRecordMode && visibleProjects.length > 0 && visibleProjects.every((project) => selGridState.selectedIds.has(project.id));
        // 表头复选框只表达当前筛选视图的选择状态。
        if (selGridView.selectAll) {
            // 表头仍存在时同步当前筛选视图的全选语义。
            selGridView.selectAll.setAttribute("aria-checked", String(allVisibleSelected));
        }
        // 空结果区域只在完整筛选结果没有匹配项目时显示。
        if (selGridView.emptyState) {
            // 空结果区域被保留时才切换可见状态。
            selGridView.emptyState.hidden = filteredProjects.length !== 0;
        }
        // 表格统计同时说明当前匹配数量和本次数据响应的真实总记录数。
        if (selGridView.totalCount) {
            // 全部可见时使用 summaryAll，筛选后使用 summaryFiltered。
            const selGridSummaryTemplate = filteredProjects.length === selGridProjects.length ? selGridPaginationData.summaryAll : selGridPaginationData.summaryFiltered;
            // 当前数量和总数只替换模板值，不写死任何语言单位。
            selGridView.totalCount.textContent = selGridFormatMessage(selGridSummaryTemplate, {
                visible: filteredProjects.length,
                total: selGridProjects.length
            });
        }
        // 页码结构与真实筛选数量同步更新，容量和条件变化后按钮数量立即正确。
        selGridRenderPaginationStructure(totalPages);
        // 当前菜单项目离开当前数据页时关闭浮层，避免菜单失去可见锚点。
        if (!selGridRecordMode && selGridMenuController && selGridMenuController.getProjectId() && !visibleProjects.some((project) => project.id === selGridMenuController.getProjectId())) {
            // 独立菜单控制器负责清理自身状态。
            selGridMenuController.close();
        }
        // 栏目点击触发重绘后，只在目标记录仍可见时把浏览器焦点移动回该行。
        if (selGridState.focusedProjectId !== null) {
            // 当前实例范围内按稳定业务主键定位刚刚渲染出的目标行。
            const focusedRow = selGridView.tableBody.querySelector(`tr[data-project-id="${selGridState.focusedProjectId}"]`);
            // 筛选或分页隐藏目标行时不强行移动焦点，避免焦点落入不可见内容。
            focusedRow?.focus({ preventScroll: true });
        }
        // 数据刷新完成后按最终表格尺寸重算，所有 selGrid 默认获得一致的横向滚动反馈。
        selGridScheduleHorizontalOverflowSync();
    }

    // 选择状态只原位同步当前页已存在的行，避免点击后重建所有单元格、头像和操作按钮。
    function selGridSyncSelectionVisuals() {
        // 一次读取当前页全部业务行，让行高亮和复选框在同一个点击任务中完成。
        const selGridVisibleRows = Array.from(selGridView.tableBody.querySelectorAll("tr[data-project-id]"));
        // 逐行把内部选择集合映射到无障碍语义、可视类和复选框。
        selGridVisibleRows.forEach((selGridVisibleRow) => {
            // DOM 主键转为与 selectedIds 一致的数字类型。
            const selGridVisibleProjectId = Number(selGridVisibleRow.dataset.projectId);
            // 当前行是否选中只以统一状态集合为准。
            const selGridVisibleSelected = selGridState.selectedIds.has(selGridVisibleProjectId);
            // 行选择语义与视觉类在同一轮同步，读屏和画面不产生时差。
            selGridVisibleRow.setAttribute("aria-selected", String(selGridVisibleSelected));
            selGridVisibleRow.classList.toggle("selgrid-row-selected", selGridVisibleSelected);
            // 最后通过栏目点击的行继续显示键盘焦点边框。
            selGridVisibleRow.classList.toggle("selgrid-row-focused", selGridState.focusedProjectId === selGridVisibleProjectId);
            // 行内复选框在原节点上直接改写 aria-checked，对勾不再等待新行重建。
            const selGridVisibleCheckbox = selGridVisibleRow.querySelector('.selgrid-selection-checkbox[data-action="select"]');
            selGridVisibleCheckbox?.setAttribute("aria-checked", String(selGridVisibleSelected));
        });
        // 当前页有数据且每行都已选中时，表头复选框才显示全选。
        const selGridAllVisibleSelected = selGridVisibleRows.length > 0 && selGridVisibleRows.every((selGridVisibleRow) => selGridState.selectedIds.has(Number(selGridVisibleRow.dataset.projectId)));
        // 表头控件可选存在，不存在时不影响行内即时同步。
        selGridView.selectAll?.setAttribute("aria-checked", String(selGridAllVisibleSelected));
        // 栏目点击记录了聚焦主键时，仅把焦点放到已存在的对应行。
        if (selGridState.focusedProjectId !== null) {
            // 使用当前页已收集的行查找焦点目标，避免再次扫描整个表格。
            const selGridFocusedVisibleRow = selGridVisibleRows.find((selGridVisibleRow) => Number(selGridVisibleRow.dataset.projectId) === selGridState.focusedProjectId);
            // preventScroll 保证即时选中不改变用户当前的表格滚动位置。
            selGridFocusedVisibleRow?.focus({ preventScroll: true });
        }
    }

    // 独立菜单状态变化后只同步更多按钮，不重绘整个表格。
    function selGridSyncMenuButtonStates() {
        // 读取菜单当前绑定项目，关闭时得到 null。
        const activeMenuProjectId = selGridMenuController ? selGridMenuController.getProjectId() : null;
        // 当前页面所有更多按钮逐个同步展开语义和高亮。
        selGridView.tableBody.querySelectorAll('button[data-action="menu"]').forEach((button) => {
            // 按钮项目主键转换为数字后与菜单归属比较。
            const isActive = Number(button.dataset.projectId) === activeMenuProjectId;
            // aria-expanded 为键盘和辅助技术表达真实状态。
            button.setAttribute("aria-expanded", String(isActive));
            // selgrid-action-active 控制当前行更多按钮的视觉高亮。
            button.classList.toggle("selgrid-action-active", isActive);
        });
    }

    // 显示短时业务反馈，让视觉演示中的按钮不是静态摆设。
    function selGridShowToast(message) {
        // 全局反馈区允许独立删除；缺失时业务动作静默完成。
        if (!selGridView.feedbackToast) {
            return;
        }
        // 取消上一条提示的关闭计时，避免新提示被旧计时器提前隐藏。
        window.clearTimeout(selGridToastTimer);
        // 写入当前动作说明。
        selGridView.feedbackToast.textContent = message;
        // 显示带霓虹边框的提示浮层。
        selGridView.feedbackToast.classList.add("selgrid-feedback-visible");
        // 两秒后自动收起提示，保持表格视野整洁。
        selGridToastTimer = window.setTimeout(() => selGridView.feedbackToast.classList.remove("selgrid-feedback-visible"), 2000);
    }

    /**
     * 表格滚轮只在自身滚动视口内消费，到达四向边界后不再驱动浏览器页面。
     * @param {WheelEvent} selGridEvent - 表格滚动视口收到的滚轮事件。
     */
    function selGridHandleWheel(selGridEvent) {
        // 缺少滚动视口时不改变页面原生行为。
        if (!selGridView.tableScroller) return;
        // 纵向仍有滚动余量时保留浏览器的原生表格滚动。
        const selGridCanScrollY = selGridView.tableScroller.scrollHeight > selGridView.tableScroller.clientHeight + 1
            && ((selGridEvent.deltaY < 0 && selGridView.tableScroller.scrollTop > 0)
                || (selGridEvent.deltaY > 0 && selGridView.tableScroller.scrollTop + selGridView.tableScroller.clientHeight < selGridView.tableScroller.scrollHeight - 1));
        // 横向滚动采用同一边界规则，兼容窄视口和 Shift 滚轮。
        const selGridCanScrollX = selGridView.tableScroller.scrollWidth > selGridView.tableScroller.clientWidth + 1
            && ((selGridEvent.deltaX < 0 && selGridView.tableScroller.scrollLeft > 0)
                || (selGridEvent.deltaX > 0 && selGridView.tableScroller.scrollLeft + selGridView.tableScroller.clientWidth < selGridView.tableScroller.scrollWidth - 1));
        // 事件始终停留在表格组件内；到达边界时同时取消页面默认滚动。
        selGridEvent.stopPropagation();
        if (!selGridCanScrollY && !selGridCanScrollX) selGridEvent.preventDefault();
    }

    // 非被动监听允许表格在滚动边界取消默认行为，避免浏览器页面跟随移动。
    selGridView.tableScroller?.addEventListener("wheel", selGridHandleWheel, { passive: false });

    // 表格事件委托统一处理选择、查看、编辑和更多菜单。
    selGridView.tableBody.addEventListener("click", (event) => {
        // 通用记录模式只派发稳定动作事件，应用通过公开事件消费业务主键和原始记录。
        if (selGridRecordMode) {
            const selGridRecordRow = event.target.closest("tr[data-sel-grid-record-id]");
            const selGridRecordAction = event.target.closest("button[data-action]");
            if (!selGridRecordRow || !selGridRecordAction || !selGridView.tableBody.contains(selGridRecordRow)) return;
            const selGridRecordId = selGridRecordRow.dataset.selGridRecordId;
            const selGridRecord = selGridProjects.find((selGridItem) => String(selGridReadRecordValue(selGridItem, selGridRecordOptions.idField || "id")) === selGridRecordId);
            if (!selGridRecord) return;
            selGridRoot.dispatchEvent(new CustomEvent("selGrid:action", {
                bubbles: true,
                detail: Object.freeze({
                    instanceKey: selGridId,
                    entity: selGridEntity,
                    action: String(selGridRecordAction.dataset.action || ""),
                    record: selGridRecord
                })
            }));
            return;
        }
        // 从点击源向上定位当前实例的数据行，表格外部事件不会参与行选择。
        const row = event.target.closest("tr[data-project-id]");
        // 事件不属于当前表格主体时立即终止，保证同页其他实例不会串行选择。
        if (!row || !selGridView.tableBody.contains(row)) {
            return;
        }
        // 只接受带业务动作的按钮点击。
        const button = event.target.closest("button[data-action]");
        // 非动作控件点击表示用户选中了当前数据栏。
        if (!button) {
            const projectId = Number(row.dataset.projectId);
            // 静态数据中找不到该主键时说明 DOM 已失配，停止当前选择操作。
            const project = selGridProjects.find((item) => item.id === projectId);
            // 无效行不改写选择和焦点状态。
            if (!project) {
                return;
            }
            // 普通单元格点击采用单选语义，先清空当前实例内其他项目的勾选状态。
            selGridState.selectedIds.clear();
            // 当前项目在清空后重新加入选择集合，成为唯一勾选且高亮的业务记录。
            // 栏目点击自动勾选当前业务记录；已勾选记录保持勾选而不是反向取消。
            selGridState.selectedIds.add(projectId);
            // 保存最后栏目点击的业务主键，供重绘后的高亮焦点回填。
            selGridState.focusedProjectId = projectId;
            // 选择和焦点变化后原位同步行、复选框和高亮，点击当帧即可见。
            selGridSyncSelectionVisuals();
            return;
        }
        // 把按钮上的项目主键转换成固定数据中的数字标识。
        const projectId = Number(button.dataset.projectId);
        // 找到对应项目用于提示真实名称。
        const project = selGridProjects.find((item) => item.id === projectId);
        // 找不到项目说明页面结构已失配，安全终止当前动作。
        if (!project) {
            return;
        }
        // 单行选择动作切换集合中的项目主键。
        if (button.dataset.action === "select") {
            // 已选项目再次点击时取消选择。
            if (selGridState.selectedIds.has(projectId)) {
                selGridState.selectedIds.delete(projectId);
            } else {
                // 未选项目点击后加入选择集合。
                selGridState.selectedIds.add(projectId);
            }
            // 选择变化后原位同步行背景和复选框，不重建其他业务单元格。
            selGridSyncSelectionVisuals();
            // 选择动作结束后不继续触发其他按钮逻辑。
            return;
        }
        // 更多动作在同一按钮上再次点击时关闭菜单。
        if (button.dataset.action === "menu") {
            // 行操作菜单区域被删除时不调用不存在的控制器。
            if (!selGridMenuController) {
                return;
            }
            // 按钮触发使用自身完整矩形作为锚点，菜单翻转后不会覆盖按钮而阻断再次点击关闭。
            const selGridMenuButtonBounds = button.getBoundingClientRect();
            // 视口中心坐标兼容控制器的通用锚点校验，四边坐标负责决定实际展开侧。
            const selGridMenuButtonAnchor = {
                clientX: selGridMenuButtonBounds.left + (selGridMenuButtonBounds.width / 2),
                clientY: selGridMenuButtonBounds.top + (selGridMenuButtonBounds.height / 2),
                left: selGridMenuButtonBounds.left,
                right: selGridMenuButtonBounds.right,
                top: selGridMenuButtonBounds.top,
                bottom: selGridMenuButtonBounds.bottom
            };
            // 独立菜单控制器接收业务记录与触发锚点，内部统一处理打开、关闭、翻转和视口回收。
            selGridMenuController.toggle({ projectId, projectName: project.name }, selGridMenuButtonAnchor);
            // 同步全部更多按钮的展开状态。
            selGridSyncMenuButtonStates();
            // 更多动作结束后不显示通用操作提示。
            return;
        }
        // 查看和编辑按钮使用当前语言动作名称展示项目反馈。
        selGridShowToast(`${button.dataset.action === "view" ? selGridMessages.viewProject : selGridMessages.editProject}：${project.name}`);
    });

    // 表格行原生右键事件在鼠标落点打开同一套操作菜单。
    selGridView.tableBody.addEventListener("contextmenu", (event) => {
        // 通用记录模式不推测应用菜单语义，调用方可通过标准 actions 列声明实际动作。
        if (selGridRecordMode) return;
        // 只接受当前表格主体内带业务主键的数据行，空白区和其他实例继续使用浏览器默认行为。
        const selGridContextRow = event.target.closest("tr[data-project-id]");
        // 无效或越出当前 tbody 的事件不阻止浏览器原生菜单。
        if (!selGridContextRow || !selGridView.tableBody.contains(selGridContextRow) || !selGridMenuController) return;
        // 当前行主键用于查找真实业务记录，禁止从可见文案反推对象。
        const selGridContextProjectId = Number(selGridContextRow.dataset.projectId);
        // 只有当前数据集中存在的项目才能打开业务上下文菜单。
        const selGridContextProject = selGridProjects.find((selGridProject) => selGridProject.id === selGridContextProjectId);
        // 数据失配时保留原生菜单，方便用户仍能使用浏览器功能。
        if (!selGridContextProject) return;
        // 业务菜单能够正常处理后才屏蔽浏览器原生右键菜单。
        event.preventDefault();
        // 右键是明确的重新定位动作，同一行连续右键也必须移动菜单而不是执行 toggle 关闭。
        selGridMenuController.open(
            { projectId: selGridContextProjectId, projectName: selGridContextProject.name },
            { clientX: event.clientX, clientY: event.clientY }
        );
        // 菜单归属变化后立即同步当前行的更多按钮展开语义。
        selGridSyncMenuButtonStates();
    });

    // 表头全选按钮在全部选中和全部取消之间切换。
    if (selGridView.selectAll) {
        // 表头选择控件存在时才绑定全选逻辑。
        selGridView.selectAll.addEventListener("click", () => {
        // 读取当前筛选视图，避免全选影响被隐藏的项目。
        const visibleProjects = selGridGetVisibleProjects();
        // 当前可见项目全部已选择时只取消这些项目。
        if (visibleProjects.length > 0 && visibleProjects.every((project) => selGridState.selectedIds.has(project.id))) {
            // 逐项移除当前可见项目主键。
            visibleProjects.forEach((project) => selGridState.selectedIds.delete(project.id));
        } else {
            // 否则把当前可见项目全部加入选择集合。
            visibleProjects.forEach((project) => selGridState.selectedIds.add(project.id));
        }
        // 全选状态变化后原位同步所有可见行和表头控件。
            selGridSyncSelectionVisuals();
        });
    }

    // 页码区域通过事件委托处理数字页和前后翻页。
    if (selGridView.pagination) {
        // 底栏分页存在时才绑定数字页与前后翻页。
        selGridView.pagination.addEventListener("click", (event) => {
        // 仅响应分页按钮点击。
        const button = event.target.closest("button");
        // 非按钮区域不改变分页状态。
        if (!button) {
            return;
        }
        // 数字页按钮直接读取目标页码。
        if (button.dataset.page) {
            selGridState.currentPage = Number(button.dataset.page);
        }
        // 上一页动作保证页码不低于第一页。
        if (button.dataset.pageAction === "previous") {
            selGridState.currentPage = Math.max(1, selGridState.currentPage - 1);
        }
        // 下一页动作先向后推进一页，统一渲染入口会依据当前筛选数量收敛到真实末页。
        if (button.dataset.pageAction === "next") {
            selGridState.currentPage += 1;
        }
        // 翻页后同时重绘当前页数据、页码结构、边界禁用状态和统计。
        selGridRenderTable();
        // 用户得到当前分页位置反馈。
            selGridShowToast(selGridFormatMessage(selGridPaginationData.pageChangedMessage, { page: selGridState.currentPage }));
        });
    }

    // 每页条数改变后保存展示偏好并给出明确反馈。
    if (selGridView.pageSize) {
        // 底栏容量选择器存在时才绑定变更逻辑。
        selGridView.pageSize.addEventListener("change", () => {
        // 将选择器字符串值转换成业务数值。
        selGridState.pageSize = Number(selGridView.pageSize.value);
        // 页面容量变化后回到第一页，避免旧页码在新总页数中越界。
        selGridState.currentPage = 1;
        // 立即按新容量重新截取数据并重建页码。
        selGridRenderTable();
        // 提示当前页面容量设置。
            selGridShowToast(selGridFormatMessage(selGridPaginationData.pageSizeChangedMessage, { size: selGridState.pageSize }));
        });
    }

    // 独立搜索控件提交事件只更新当前实例，输入过程不再即时过滤。
    selGridRoot.addEventListener("selSearch:submit", (event) => {
        // 事件详情必须属于当前完整实例键，避免冒泡后被其他表格处理。
        if (!event.detail || event.detail.gridId !== selGridId) {
            return;
        }
        // 查询关键词写入当前表格组合筛选状态。
        selGridState.search = String(event.detail.keyword ?? "");
        // 每次新查询回到第一页，符合后端分页查询习惯。
        selGridState.currentPage = 1;
        // 查询提交后重绘当前实例数据。
        selGridRenderTable();
    });

    // 类型选择变化时只展示精确匹配的项目。
    if (selGridView.typeFilter) {
        // 类型下拉存在时才绑定精确筛选。
        selGridView.typeFilter.addEventListener("change", () => {
        // 保存空值或当前选择的项目类型。
        selGridState.type = selGridView.typeFilter.value;
        // 新类型条件从第一页开始展示，避免沿用旧条件的后续页。
        selGridState.currentPage = 1;
        // 类型条件变化后重绘项目表。
            selGridRenderTable();
        });
    }

    // 状态选择变化时同步顶部状态标签并重绘项目表。
    if (selGridView.statusFilter) {
        // 状态下拉存在时才绑定状态同步。
        selGridView.statusFilter.addEventListener("change", () => {
        // 保存空值或当前选择的项目状态。
        selGridState.status = selGridView.statusFilter.value;
        // 新状态条件从第一页开始展示，避免筛选后出现空白旧页。
        selGridState.currentPage = 1;
        // 顶部标签根据真实状态条件切换高亮。
        selGridRoot.querySelectorAll("[data-status-filter]").forEach((button) => button.classList.toggle("selpanel-status-tab-active", button.dataset.statusFilter === selGridState.status));
        // 状态条件变化后重绘项目表。
            selGridRenderTable();
        });
    }

    // 顶部状态标签提供更直接的状态切换入口。
    if (selGridView.statusTabs) {
        // 标题状态标签存在时才绑定快捷筛选。
        selGridView.statusTabs.addEventListener("click", (event) => {
        // 只接受带状态筛选值的按钮点击。
        const button = event.target.closest("[data-status-filter]");
        // 点击导航空白区域时不改变筛选条件。
        if (!button) {
            return;
        }
        // 标签值写入共享状态。
        selGridState.status = button.dataset.statusFilter;
        // 快捷状态筛选回到第一页，与工具栏筛选行为保持一致。
        selGridState.currentPage = 1;
        // 工具栏状态选择器同步同一业务值。
        if (selGridView.statusFilter && window.selDropdownMenu) {
            // 工具栏状态下拉仍存在时同步同一业务值。
            window.selDropdownMenu.setValue(selGridView.statusFilter, selGridState.status);
        }
        // 所有标签只保留当前状态高亮。
        selGridRoot.querySelectorAll("[data-status-filter]").forEach((statusButton) => statusButton.classList.toggle("selpanel-status-tab-active", statusButton === button));
        // 状态切换后重绘表格。
            selGridRenderTable();
        });
    }

    // 重置入口恢复搜索、工具栏和左树的初始全部项目状态。
    if (selGridView.filterReset) {
        // 重置按钮存在时才绑定跨区域恢复逻辑。
        selGridView.filterReset.addEventListener("click", () => {
        // 清空内部搜索状态。
        selGridState.search = "";
        // 清空内部类型状态。
        selGridState.type = "";
        // 清空内部项目状态。
        selGridState.status = "";
        // 清空左树附加筛选。
        selGridState.treeFilter = {};
        // 重置筛选同时回到第一页，恢复完整数据集的起始位置。
        selGridState.currentPage = 1;
        // 独立搜索控件恢复空值但不重复提交，当前重置逻辑统一负责重绘。
        if (selGridSearchController) {
            // 搜索控制器只清空所属实例。
            selGridSearchController.clear({ submit: false });
        }
        // 类型选择器恢复全部。
        if (selGridView.typeFilter && window.selDropdownMenu) {
            // 类型下拉仍存在时恢复全部。
            window.selDropdownMenu.setValue(selGridView.typeFilter, "");
        }
        // 状态选择器恢复全部。
        if (selGridView.statusFilter && window.selDropdownMenu) {
            // 状态下拉仍存在时恢复全部。
            window.selDropdownMenu.setValue(selGridView.statusFilter, "");
        }
        // 左树通过公开控制器恢复全部项目节点。
        if (selGridTreeController) {
            // 左树仍存在时恢复全部项目节点。
            selGridTreeController.select("all");
        }
        // 顶部全部标签恢复高亮。
        selGridRoot.querySelectorAll("[data-status-filter]").forEach((button) => button.classList.toggle("selpanel-status-tab-active", button.dataset.statusFilter === ""));
        // 重绘完整项目表。
        selGridRenderTable();
        // 给出明确重置反馈。
            selGridShowToast(selGridMessages.filtersReset);
        });
    }

    // 左侧树选择事件把节点配置的条件叠加到表格筛选。
    selGridRoot.addEventListener("selTree:select", (event) => {
        // 缺少事件详情时使用空筛选保证页面稳定。
        const detail = event.detail || {};
        // 复制筛选对象，避免业务页面修改树组件人工配置。
        selGridState.treeFilter = { ...(detail.filter || {}) };
        // 树节点切换后回到第一页，保证新分类首批记录立即可见。
        selGridState.currentPage = 1;
        // 树节点变化后重绘组合筛选结果。
        selGridRenderTable();
        // 显示当前分类名称，证明树形导航已真正生效。
        selGridShowToast(`${selGridMessages.treePrefix}：${detail.label || ""}`);
    });

    // 标题区快捷按钮提供演示所需的真实反馈和筛选聚焦。
    if (selGridView.headerActions) {
        // 标题快捷操作区存在时才绑定页面级命令。
        selGridView.headerActions.addEventListener("click", (event) => {
        // 只处理带面板命令的快捷按钮。
        const button = event.target.closest("[data-panel-command]");
        // 点击动作组间隙时不触发反馈。
        if (!button) {
            return;
        }
        // 筛选命令把键盘焦点移动到搜索输入框。
        if (button.dataset.panelCommand === "filter") {
            // 聚焦独立搜索控件让用户可立即输入条件。
            if (selGridSearchController) {
                // 搜索控制器只移动当前实例焦点。
                selGridSearchController.focus();
            }
            // 反馈提示当前筛选入口已激活。
            selGridShowToast(selGridMessages.filterActivated);
            // 筛选命令完成后不执行通用提示。
            return;
        }
        // 新建命令向当前实例根派发受控事件，应用层决定打开哪一个业务窗口。
        if (button.dataset.panelCommand === "new") {
            selGridRoot.dispatchEvent(new CustomEvent("selGrid:new", { bubbles: true, detail: { instanceKey: selGridId, backendEntity: selGridEntity } }));
            selGridShowToast(selGridMessages.newOpened);
            return;
        }
        // 导出动作继续使用现有反馈，不改变其业务边界。
        selGridShowToast(selGridMessages.exportPreparing);
        });
    }

    // 日期按钮在演示页提供明确交互反馈。
    if (selGridView.dateCommand) {
        // 日期入口存在时才绑定范围反馈。
        selGridView.dateCommand.addEventListener("click", () => {
        // 当前静态演示保留设计稿日期范围并说明状态。
            selGridShowToast(selGridFormatMessage(selGridMessages.dateRange, {
                start: selGridInputPayload.title.dateStart,
                end: selGridInputPayload.title.dateEnd
            }));
        });
    }

    // 独立菜单广播动作后展示当前项目和所选动作，证明一级与二级项目都可用。
    selGridRoot.addEventListener("selGridMenu:action", (event) => {
        // 事件携带菜单配置和当前项目。
        const detail = event.detail;
        // 缺少项目时不显示无归属反馈。
        if (!detail || !detail.project) {
            return;
        }
        // 二级动作使用父动作语义前缀，一级动作直接展示名称。
        const actionLabel = detail.level === "secondary" ? `${selGridMessages.movePrefix} · ${detail.label}` : detail.label;
        // Toast 展示真实动作和当前项目名称。
        selGridShowToast(`${actionLabel}：${detail.project.projectName}`);
    });

    // 独立菜单打开或关闭时同步表格更多按钮的可访问状态。
    selGridRoot.addEventListener("selGridMenu:openChange", () => {
        // 不重绘表格，仅更新三个更多按钮属性。
        selGridSyncMenuButtonStates();
    });

    // 页面首次加载立即渲染参考图默认状态。
    selGridRenderTable();
    // 初始页面不展示行操作菜单，避免未由用户触发的菜单遮挡表格右侧内容。
    if (selGridMenuController) {
        // 显式关闭菜单并清空绑定记录，使默认选中行不会自动触发行操作浮层。
        selGridMenuController.close();
        // 关闭后的更多按钮同步回未展开状态，保持可访问语义和视觉状态一致。
        selGridSyncMenuButtonStates();
    }

    // 公开重置方法优先复用当前实例按钮逻辑，没有工具栏时直接恢复内部状态。
    function selGridResetInstance() {
        if (selGridView.filterReset) {
            selGridView.filterReset.click();
            return true;
        }
        selGridState.search = "";
        selGridState.type = "";
        selGridState.status = "";
        selGridState.treeFilter = {};
        // 无工具栏的降级重置同样回到第一页，保持公开 reset 语义完整。
        selGridState.currentPage = 1;
        if (selGridSearchController) {
            selGridSearchController.clear({ submit: false });
        }
        selGridRenderTable();
        return true;
    }

    // 公开分页方法只修改当前实例页码和分页按钮，不触碰其他表格根。
    function selGridSetPage(page) {
        // 外部页码先规范为正整数，真实末页边界由统一渲染入口结合筛选结果计算。
        const normalizedPage = Math.max(1, Math.floor(Number(page) || 1));
        // 只改写当前实例状态，不访问页面级固定节点。
        selGridState.currentPage = normalizedPage;
        // 重绘后当前实例显示目标页数据并同步页码可访问状态。
        selGridRenderTable();
        return true;
    }

    // 当前实例的筛选门面提供业务调用所需的最小稳定接口。
    const selGridFiltersController = Object.freeze({
        reset: selGridResetInstance,
        setSearch(value) {
            // 外部搜索值只写入当前实例状态，避免同页其他表格被同步筛选。
            selGridState.search = String(value ?? "");
            // 新搜索条件始终从第一页展示，避免旧页码落到新结果范围之外。
            selGridState.currentPage = 1;
            if (selGridSearchController) {
                // 搜索基础控件同步当前实例输入框文字，但不重复提交事件。
                selGridSearchController.setValue(selGridState.search);
            }
            // 当前实例按新条件重新筛选、分页并渲染。
            selGridRenderTable();
            return true;
        },
        getState: () => Object.freeze({
            search: selGridState.search,
            type: selGridState.type,
            status: selGridState.status,
            treeFilter: { ...selGridState.treeFilter }
        })
    });

    // 当前实例的分页门面保证外部调用仍明确归属业务表格。
    const selGridPaginationController = Object.freeze({
        setPage: selGridSetPage,
        getPage: () => selGridState.currentPage,
        setPageSize(value) {
            // 外部容量输入规范为正整数，无效值回退当前本地化分页默认值。
            selGridState.pageSize = Math.max(1, Math.floor(Number(value) || selGridPaginationData.pageSize));
            // 容量变化后回到第一页，避免当前页超出新的真实总页数。
            selGridState.currentPage = 1;
            if (selGridView.pageSize) {
                // 原生选择器同步公开 API 设置的业务值。
                selGridView.pageSize.value = String(selGridState.pageSize);
                // 自定义下拉外观刷新当前可见标签。
                window.selDropdownMenu?.refresh(selGridView.pageSize);
            }
            // 当前实例立即按新容量截取和渲染数据。
            selGridRenderTable();
            return true;
        },
        getPageSize: () => selGridState.pageSize
    });

    // 运行时语言切换只替换标准聚合数据并重绘文字，筛选、页码、选择和滚动容器均保留。
    function selGridSetLocale(selGridNext = {}) {
        const selGridNextPayload = selGridNext.resource || selGridNext.messages || selGridNext;
        if (!selGridNextPayload || !Array.isArray(selGridNextPayload.data?.items) || !Array.isArray(selGridNextPayload.column?.items)) return false;
        selGridInputPayload = selGridNextPayload;
        selGridProjects = Object.freeze(selGridInputPayload.data.items);
        selGridTypeLabels = new Map((selGridInputPayload.select?.projectType?.options || []).map((item) => [String(item.value), item.label]));
        selGridStatusLabels = new Map((selGridInputPayload.select?.status?.options || []).map((item) => [String(item.value), item.label]));
        selGridMessages = selGridInputPayload.title.messages;
        selGridPaginationData = selGridInputPayload.pagination;
        selGridApplyStandalonePayload(selGridRoot, selGridInputPayload);
        if (selGridView.pageSize) selGridView.pageSize.value = String(selGridState.pageSize);
        selGridRenderColumnHeader();
        selGridView.selectAll = selGridRoot.querySelector('[data-sel-grid-role="select-all"]');
        selGridRenderTable();
        return true;
    }

    let selGridDestroyed = false;
    // 动态页签关闭时断开尺寸观察、动画帧和提示计时器，再从公开注册表与 DOM 中删除实例。
    function selGridDestroy() {
        if (selGridDestroyed) return false;
        selGridDestroyed = true;
        selGridHorizontalOverflowObserver?.disconnect();
        if (selGridHorizontalOverflowFrame) window.cancelAnimationFrame(selGridHorizontalOverflowFrame);
        if (selGridToastTimer) window.clearTimeout(selGridToastTimer);
        selGridInstances.delete(selGridId);
        selGridRoots.delete(selGridId);
        selGridRoot.remove();
        return true;
    }

    // 返回业务实例控制器，子控件通过属性归属于当前表格。
    return Object.freeze({
        id: selGridId,
        entity: selGridEntity,
        root: selGridRoot,
        tree: selGridTreeController,
        menu: selGridMenuController,
        filters: selGridFiltersController,
        pagination: selGridPaginationController,
        refresh: selGridRenderTable,
        reset: selGridResetInstance,
        setPage: selGridSetPage,
        setLocale: selGridSetLocale,
        destroy: selGridDestroy,
        getState: () => Object.freeze({
            currentPage: selGridState.currentPage,
            pageSize: selGridState.pageSize,
            search: selGridState.search,
            type: selGridState.type,
            status: selGridState.status,
            selectedIds: Object.freeze(Array.from(selGridState.selectedIds))
        })
    });
    }

    // 公开注册表由应用装配层显式传入宿主和标准聚合 payload。
    window.selGrid = Object.freeze({
        // create 为动态工作区建立独立表格结构；业务数据仍由随后的 mount 显式传入。
        create: selGridCreate,
        // mount 创建一个表格实例；缺失标准 payload 时返回 null 并提示应用补齐基础输入。
        mount(root, payload) {
            // 非元素宿主不能作为组件作用域。
            if (!(root instanceof Element)) {
                return null;
            }
            // 完整业务实例名作为注册表唯一键。
            const gridId = root.dataset.selGrid;
            // 重复挂载直接复用现有实例，避免重复事件绑定。
            if (gridId && selGridInstances.has(gridId)) {
                return selGridInstances.get(gridId);
            }
            // 基础控件缺少标准输入时明确提示，不在内部创建业务默认数据。
            if (!payload) {
                console.warn("selGrid.mount：缺少标准聚合 payload，应用装配层必须先提供数据。", root);
                return null;
            }
            selGridApplyStandalonePayload(root, payload);
            // 当前实例只使用本次显式传入的 payload。
            const instance = selGridCreateInstance(root, payload);
            // 有效实例才进入公开注册表。
            if (instance) {
                selGridInstances.set(instance.id, instance);
                selGridRoots.set(instance.id, root);
                // DOM 就绪标记供调试和浏览器验收确认挂载完成。
                root.dataset.selGridReady = "true";
            } else {
                // false 明确表达宿主结构或输入不完整。
                root.dataset.selGridReady = "false";
            }
            // 返回控制器供应用装配层保存或继续调用。
            return instance;
        },
        // get 按完整业务实例名获取控制器。
        get: (gridId) => selGridInstances.get(gridId) || null,
        // has 判断实例是否已经挂载。
        has: (gridId) => selGridInstances.has(gridId),
        // list 返回已挂载实例名的只读快照。
        list: () => Object.freeze(Array.from(selGridInstances.keys())),
        // refresh 只刷新指定实例。
        refresh: (gridId) => selGridInstances.get(gridId)?.refresh() ?? false,
        // reset 只重置指定实例。
        reset: (gridId) => selGridInstances.get(gridId)?.reset() ?? false,
        // setPage 只设置指定实例页码。
        setPage: (gridId, page) => selGridInstances.get(gridId)?.setPage(page) ?? false,
        // destroy 彻底回收动态实例；与切换页签的隐藏语义明确分离。
        destroy: (gridId) => selGridInstances.get(gridId)?.destroy() ?? false
    });
})();
