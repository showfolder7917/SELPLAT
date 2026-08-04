/*
 * uniauth.js：统一认证前端演示应用装配层。
 * 只负责识别 Uniauth 业务实例、声明业务数据源路径、选择语言，并通过 selAjax 把标准数据传给 SEL 基础控件。
 * 责任边界：本文件不创建或克隆通用控件内部 DOM；只定位 uniauth.html 的静态审阅结构并绑定基础控件。
 * 生产替换点：未来只需把数据源表中的模拟 JSON 地址切换为后端聚合接口，基础控件调用顺序保持不变。
 */
(function uniauthInitializeApplication() {
    "use strict";

    // 基础运行时必须先于应用装配层加载，应用不直接使用原生查询、请求和页面元数据 API。
    const uniauthBase = window.selBaseRuntime;
    // 缺少基础运行时时立即停止，禁止在应用文件中补写原生替代实现。
    if (!uniauthBase) {
        throw new Error("缺少基础控件：selBaseRuntime。请先建立或引入基础运行时。");
    }
    // 应用所需能力清单只包含公开基础 API，selAjax 专门承担请求与 JSON 解析。
    const uniauthRequiredComponents = Object.freeze([
        "selAjax",
        "selPanel",
        "selSearch",
        "selTree",
        "selGridMenu",
        "selDropdownMenu",
        "selGrid",
        "selPageBackground",
        "selPersonalization",
        "selWindow"
    ]);
    // 页面装配前一次检查全部依赖，避免加载数据后才出现半成品界面。
    const uniauthMissingComponents = uniauthRequiredComponents.filter((uniauthComponentName) => !window[uniauthComponentName]);
    // 任一基础控件缺失都必须回到 SEL 层补齐。
    if (uniauthMissingComponents.length > 0) {
        throw new Error(`缺少基础控件：${uniauthMissingComponents.join("、")}。禁止在 uniauth.js 中使用原生 DOM 另写替代组件。`);
    }
    // 通用请求入口只负责执行本应用显式声明的地址，不读取任何 Uniauth 配置。
    const uniauthAjax = window.selAjax;

    // multi=1 仅用于演示同页双实例，不参与后端实体识别。
    const uniauthMultiEnabled = uniauthBase.param("multi") === "1";
    // 三种支持语言与未来后端 locale 参数保持一致。
    const uniauthSupportedLocales = Object.freeze(["zh-CN", "ja-JP", "en-US"]);
    // URL lang 参数用于模拟后端按语言返回聚合数据。
    const uniauthRequestedLocale = uniauthBase.param("lang", "zh-CN");
    // 未支持语言安全回退中文，避免请求不存在的语言目录。
    const uniauthLocale = uniauthSupportedLocales.includes(uniauthRequestedLocale) ? uniauthRequestedLocale : "zh-CN";
    // HTML 提供应用挂载点和可审阅的完整面板结构，装配层只在其中定位当前业务实例。
    const uniauthApplicationHost = uniauthBase.query("[data-uniauth-app]");
    // HTML 只提供背景挂载点，独立背景图层由 selPageBackground.mount 生成。
    const uniauthBackgroundHost = uniauthBase.query("[data-sel-page-background-host]");
    // HTML 只提供个性化挂载点，背景/面板两级设置由 selPersonalization.mount 生成。
    const uniauthPersonalizationHost = uniauthBase.query("[data-sel-personalization-host]");
    // 页面排列模式作为标准选项交给 selPanel，不直接修改应用或面板类名。
    const uniauthPanelLayout = uniauthMultiEnabled ? "stack" : "single";
    // 多实例高度通过 selPanel 标准 CSS 变量入口传递，应用 CSS 不覆盖基础内部类。
    const uniauthPanelHeight = uniauthMultiEnabled ? "calc(100vh - 32px)" : "";
    // 页面布局表集中声明“哪个位置放哪个基础控件、该控件接收哪份 JSON”，调整区域时只修改这里。
    const uniauthLayouts = Object.freeze({
        // UniauthGridFiveRegion 是用户表格页面使用的上、左、中、右、下五区模板。
        UniauthGridFiveRegion: Object.freeze({
            // top、left、center、right、bottom 是 selPanel 唯一接受的五个稳定区域名称。
            regions: Object.freeze({
                // 上区先显示标题，再显示包含搜索和筛选控件的工具栏。
                top: Object.freeze([
                    // title 读取 title JSON，显示页面标题、状态标签和标题操作。
                    Object.freeze({ component: "title", payload: "title" }),
                    // toolbar 只负责把内部基础控件保持在同一条搜索工具栏中。
                    Object.freeze({
                        component: "toolbar",
                        // children 的先后顺序就是工具栏从左到右的实际顺序。
                        children: Object.freeze([
                            // selSearch 读取独立 search JSON，提供关键词输入、查询和清空动作。
                            Object.freeze({ component: "selSearch", payload: "search" }),
                            // 项目类型下拉读取自己的 select.projectType JSON。
                            Object.freeze({ component: "selDropdownMenu", slot: "projectType", payload: "select.projectType" }),
                            // 状态下拉读取自己的 select.status JSON。
                            Object.freeze({ component: "selDropdownMenu", slot: "status", payload: "select.status" }),
                            // 日期范围的显示文字来自 title JSON。
                            Object.freeze({ component: "dateRange", payload: "title" }),
                            // 重置按钮的多语言文字来自 title JSON。
                            Object.freeze({ component: "filterReset", payload: "title" })
                        ])
                    })
                ]),
                // 左区放树形导航，读取独立 tree JSON。
                left: Object.freeze([
                    Object.freeze({ component: "selTree", payload: "tree" })
                ]),
                // 中区放主表格，接收当前后端聚合对象中的列和行等完整数据。
                center: Object.freeze([
                    Object.freeze({ component: "selGrid", payload: "$aggregate" })
                ]),
                // 右区放表格行操作菜单，读取独立 menu JSON，并以浮层形式显示。
                right: Object.freeze([
                    Object.freeze({ component: "selGridMenu", payload: "menu" })
                ]),
                // 下区放统计、每页条数、分页和操作反馈。
                bottom: Object.freeze([
                    // footer 是底栏组合结构，不读取业务数据。
                    Object.freeze({
                        component: "footer",
                        // 底栏子控件顺序就是从左到右的实际顺序。
                        children: Object.freeze([
                            // gridSummary 读取 pagination JSON，并把每页条数下拉组合在统计旁。
                            Object.freeze({
                                component: "gridSummary",
                                payload: "pagination",
                                children: Object.freeze([
                                    // 每页条数下拉读取自己的 select.pageSize JSON。
                                    Object.freeze({ component: "selDropdownMenu", slot: "pageSize", payload: "select.pageSize" })
                                ])
                            }),
                            // pagination 读取独立 pagination JSON。
                            Object.freeze({ component: "pagination", payload: "pagination" }),
                            // feedback 使用 title.messages 中的当前语言提示文字。
                            Object.freeze({ component: "feedback", payload: "title.messages" })
                        ])
                    })
                ])
            })
        })
    });
    // 主实例是 UniauthUser 的通用 CRUD 表格。
    const uniauthPrimaryDefinition = Object.freeze({
        gridId: "UniauthUserGrid",
        sourceId: "UniauthUserGrid",
        entity: "UniauthUser",
        view: "crud",
        layoutId: "UniauthGridFiveRegion"
    });
    // 类型列表实例复用相同数据源，但拥有独立控件状态和视图标题。
    const uniauthSecondaryDefinition = Object.freeze({
        gridId: "UniauthUserTypeGrid",
        sourceId: "UniauthUserGrid",
        entity: "UniauthUser",
        view: "type-list",
        layoutId: "UniauthGridFiveRegion"
    });
    // 当前页面实例清单只由 URL 演示参数决定。
    const uniauthDefinitions = Object.freeze(
        uniauthMultiEnabled
            ? [uniauthPrimaryDefinition, uniauthSecondaryDefinition]
            : [uniauthPrimaryDefinition]
    );
    // 聚合结果映射使用实际实例名，例如 UniauthUserGrid 和 UniauthUserTypeGrid。
    const uniauthInstances = new Map();
    // 同一数据源只加载一次，双实例共享只读业务响应。
    const uniauthSources = new Map();
    // 新建窗口控制器按表格实例保存，双实例不会共用打开状态。
    const uniauthWindowControllers = new Map();
    // “新建”入口只声明项目表单业务字段，通用 selWindow 不识别项目实体或接口地址。
    const uniauthProjectWindowView = Object.freeze({
        // 标题与说明严格采用用户指定的新建项目参考图。
        title: "新建项目",
        subtitle: "创建一个全新的项目并设置基本信息",
        // 标题栏关闭和底部动作使用清晰业务文案。
        closeLabel: "关闭新建项目窗口",
        cancelLabel: "取消",
        submitLabel: "立即创建",
        // 复选项和结果文案完成可操作的新建主路径。
        checkboxLabel: "创建后立即添加任务",
        validationMessage: "请填写项目名称并完成必填选择",
        successMessage: "项目已创建，可以继续添加任务",
        // rows 的顺序和单列/双列关系直接对应参考图的表单布局。
        rows: Object.freeze([
            // 项目名称限制 50 字并显示实时计数。
            Object.freeze([Object.freeze({ name: "projectName", label: "项目名称", type: "text", icon: "ri-file-text-line", placeholder: "请输入项目名称", required: true, maxLength: 50 })]),
            // 项目类型使用统一选择下拉，并保留原生 select 真实值。
            Object.freeze([Object.freeze({ name: "projectType", label: "项目类型", type: "select", required: true, options: Object.freeze([
                Object.freeze({ value: "", label: "请选择项目类型", icon: "ri-apps-2-line", disabled: true, selected: true }),
                Object.freeze({ value: "platform", label: "平台架构", icon: "ri-stack-line" }),
                Object.freeze({ value: "visualization", label: "数据可视化", icon: "ri-pie-chart-line" }),
                Object.freeze({ value: "research", label: "科研项目", icon: "ri-flask-line" }),
                Object.freeze({ value: "ai", label: "人工智能", icon: "ri-brain-line" })
            ]) })]),
            // 负责人下拉使用当前演示数据中的真实人员名称。
            Object.freeze([Object.freeze({ name: "owner", label: "负责人", type: "select", required: true, options: Object.freeze([
                Object.freeze({ value: "", label: "请选择负责人", icon: "ri-user-3-line", disabled: true, selected: true }),
                Object.freeze({ value: "lin-shen", label: "林深", icon: "ri-user-star-line" }),
                Object.freeze({ value: "su-wan", label: "苏晚", icon: "ri-user-line" }),
                Object.freeze({ value: "lu-chuan", label: "陆川", icon: "ri-user-line" }),
                Object.freeze({ value: "zhou-xu", label: "周叙", icon: "ri-user-line" })
            ]) })]),
            // 开始日期与优先级共享一行，保持参考图的四轨布局。
            Object.freeze([
                Object.freeze({ name: "startDate", label: "开始日期", type: "date", icon: "ri-calendar-line", placeholder: "请选择开始日期", required: true }),
                Object.freeze({ name: "priority", label: "优先级", type: "select", required: true, options: Object.freeze([
                    Object.freeze({ value: "medium", label: "中优先级", icon: "ri-flag-fill", tone: "active", selected: true }),
                    Object.freeze({ value: "high", label: "高优先级", icon: "ri-flag-fill", tone: "review" }),
                    Object.freeze({ value: "low", label: "低优先级", icon: "ri-flag-line", tone: "muted" })
                ]) })
            ]),
            // 项目描述为可选多行字段并显示 300 字计数。
            Object.freeze([Object.freeze({ name: "description", label: "项目描述", type: "textarea", icon: "ri-edit-2-line", placeholder: "请输入项目描述（选填）", required: false, maxLength: 300 })])
        ])
    });
    // Uniauth 业务数据源表明确登记实际请求地址；基础 selAjax 不允许根据实体或实例名推测路径。
    const uniauthDataSources = Object.freeze({
        // UniauthUserGrid 是用户管理主表及当前类型列表示例共同使用的数据源。
        UniauthUserGrid: Object.freeze({
            // backendUrl 保留生产聚合接口契约；演示阶段不调用该地址。
            backendUrl: "/api/uniauth/user/grid",
            // dataUrl 指向不随语言变化的稳定业务行数据。
            dataUrl: "./mock/UniauthUserGrid/UniauthUserGrid.data.json",
            // localizedUrls 明确列出每一份可国际化 JSON，{locale} 由应用选择的语言替换。
            localizedUrls: Object.freeze({
                column: "./mock/UniauthUserGrid/{locale}/UniauthUserGrid.column.json",
                tree: "./mock/UniauthUserGrid/{locale}/UniauthUserGrid.tree.json",
                title: "./mock/UniauthUserGrid/{locale}/UniauthUserGrid.title.json",
                search: "./mock/UniauthUserGrid/{locale}/UniauthUserGrid.search.json",
                menu: "./mock/UniauthUserGrid/{locale}/UniauthUserGrid.menu.json",
                pagination: "./mock/UniauthUserGrid/{locale}/UniauthUserGrid.pagination.json",
                projectTypeSelect: "./mock/UniauthUserGrid/{locale}/UniauthUserGrid.select.projectType.json",
                statusSelect: "./mock/UniauthUserGrid/{locale}/UniauthUserGrid.select.status.json",
                pageSizeSelect: "./mock/UniauthUserGrid/{locale}/UniauthUserGrid.select.pageSize.json"
            })
        })
    });
    // 演示数据版本用于浏览器缓存失效；生产环境应由后端响应版本或构建摘要替代。
    const uniauthDataVersion = "20260801-pagination-2";

    /**
     * 把一个区域中的嵌套布局声明展开，供装配层判断本实例实际需要挂载哪些基础控件。
     * @param {Array<object>} uniauthComponents - 某个五区位置中的基础控件声明数组。
     * @returns {Array<object>} 包含父组件和全部 children 的扁平声明数组。
     */
    function uniauthFlattenComponents(uniauthComponents) {
        // 非数组区域视为已删除区域，不影响其他区域继续装配。
        if (!Array.isArray(uniauthComponents)) {
            return [];
        }
        // 每个父组件和它的子组件都加入结果，保证嵌套工具栏及底栏也能被识别。
        return uniauthComponents.flatMap((uniauthComponent) => [
            // 当前声明本身用于识别 title、toolbar、footer 等结构角色。
            uniauthComponent,
            // children 递归展开后用于识别 selSearch、selDropdownMenu 和分页等真实控件。
            ...uniauthFlattenComponents(uniauthComponent.children)
        ]);
    }

    /**
     * 取得一个布局中的全部基础控件声明。
     * @param {object} uniauthLayout - uniauthLayouts 中登记的五区布局。
     * @returns {Array<object>} 按上、左、中、右、下顺序展开的全部组件声明。
     */
    function uniauthGetLayoutComponents(uniauthLayout) {
        // 缺少五区声明时返回空清单，由实例装配入口给出明确错误。
        if (!uniauthLayout?.regions) {
            return [];
        }
        // 固定区域顺序让代码阅读顺序与页面视觉位置保持一致。
        return ["top", "left", "center", "right", "bottom"].flatMap((uniauthRegionName) =>
            // 每个区域内部继续展开 toolbar、footer 等组合控件。
            uniauthFlattenComponents(uniauthLayout.regions[uniauthRegionName])
        );
    }

    /**
     * 为静态演示 JSON 增加缓存版本。
     * @param {string} uniauthUrl - 数据源表中明确登记的业务 JSON 地址。
     * @returns {string} 保留原地址并附加当前演示版本的请求地址。
     */
    function uniauthVersionedUrl(uniauthUrl) {
        // 已含查询参数的地址使用 &，普通文件地址使用 ?。
        const uniauthSeparator = uniauthUrl.includes("?") ? "&" : "?";
        // 版本参数只负责缓存失效，不改变数据源归属。
        return `${uniauthUrl}${uniauthSeparator}v=${uniauthDataVersion}`;
    }

    /**
     * 加载一个业务表格数据源的全部片段，并模拟后端聚合响应。
     * @param {string} uniauthSourceId - 数据源名称，例如 UniauthUserGrid。
     * @returns {Promise<object>} 包含 data、column、tree、title、search、menu、pagination 和 select 的聚合对象。
     */
    async function uniauthLoadSource(uniauthSourceId) {
        // 同一数据源已经开始加载时复用 Promise，避免双实例重复请求。
        if (uniauthSources.has(uniauthSourceId)) {
            return uniauthSources.get(uniauthSourceId);
        }
        // 数据源必须在 Uniauth 应用表中明确登记，禁止根据 sourceId 自动猜测目录。
        const uniauthSource = uniauthDataSources[uniauthSourceId];
        // 未登记的数据源立即停止当前实例装配并报告完整业务键。
        if (!uniauthSource) {
            throw new Error(`Uniauth 数据源未登记：${uniauthSourceId}。请在 uniauthDataSources 中声明请求路径。`);
        }
        // 行数据地址由应用声明，selAjax 只发送请求并返回解析结果。
        const uniauthDataPromise = uniauthAjax.json({
            url: uniauthVersionedUrl(uniauthSource.dataUrl)
        });
        // 每个本地化片段使用显式地址分别加载，静态页借此验证未来后端字段边界。
        const uniauthPartEntriesPromise = Promise.all(
            Object.entries(uniauthSource.localizedUrls).map(async ([uniauthKey, uniauthPathTemplate]) => {
                // 应用只替换当前语言占位符，不改变已登记的业务文件位置。
                const uniauthLocalizedUrl = uniauthPathTemplate.replaceAll("{locale}", uniauthLocale);
                // selAjax 接收完整实际地址并返回解析后的 JSON。
                const uniauthPartData = await uniauthAjax.json({
                    url: uniauthVersionedUrl(uniauthLocalizedUrl)
                });
                // 返回键值对，供应用装配层聚合成标准 payload。
                return [uniauthKey, uniauthPartData];
            })
        );
        // 聚合任务模拟未来后端一次返回完整表格对象。
        const uniauthSourcePromise = Promise.all([uniauthDataPromise, uniauthPartEntriesPromise]).then(([uniauthData, uniauthPartEntries]) => {
            // 下拉框按业务角色归入 select 对象，基础控件不依赖文件名。
            const uniauthParts = Object.fromEntries(uniauthPartEntries);
            // 返回结构与后端聚合接口约定保持一致。
            return Object.freeze({
                gridId: uniauthSourceId,
                entity: uniauthData.entity,
                locale: uniauthLocale,
                data: Object.freeze(uniauthData),
                column: Object.freeze(uniauthParts.column),
                tree: Object.freeze(uniauthParts.tree),
                title: Object.freeze(uniauthParts.title),
                search: Object.freeze(uniauthParts.search),
                menu: Object.freeze(uniauthParts.menu),
                pagination: Object.freeze(uniauthParts.pagination),
                select: Object.freeze({
                    projectType: Object.freeze(uniauthParts.projectTypeSelect),
                    status: Object.freeze(uniauthParts.statusSelect),
                    pageSize: Object.freeze(uniauthParts.pageSizeSelect)
                })
            });
        });
        // 保存正在执行的 Promise，使并发实例复用相同请求。
        uniauthSources.set(uniauthSourceId, uniauthSourcePromise);
        // 调用方等待标准聚合结果完成。
        return uniauthSourcePromise;
    }

    /**
     * 创建并装配一个业务实例。
     * @param {object} uniauthDefinition - 明确声明 gridId、sourceId、entity 和 view 的业务实例定义。
     * @returns {Promise<object>} 返回 selGrid 创建的当前实例控制器。
     */
    async function uniauthMountInstance(uniauthDefinition) {
        // 当前实例只读取定义中显式声明的数据源。
        const uniauthPayload = await uniauthLoadSource(uniauthDefinition.sourceId);
        // layoutId 明确选择当前实例使用的页面模板，不根据实体名称猜测布局。
        const uniauthLayout = uniauthLayouts[uniauthDefinition.layoutId];
        // 未登记布局时立即停止，避免基础面板退回一个与业务定义不一致的默认结构。
        if (!uniauthLayout) {
            throw new Error(`Uniauth 布局未登记：${uniauthDefinition.layoutId}。请先在 uniauthLayouts 中声明五区结构。`);
        }
        // 展开后的组件清单决定本实例随后需要调用哪些基础控件。
        const uniauthLayoutComponents = uniauthGetLayoutComponents(uniauthLayout);
        // 组件名称集合用于按声明装配，删除某个区域后不会继续挂载该区域控件。
        const uniauthLayoutComponentNames = new Set(uniauthLayoutComponents.map((uniauthComponent) => uniauthComponent.component));
        // 中央 selGrid 是当前表格页面的主控件，缺失时提示先修正布局声明。
        if (!uniauthLayoutComponentNames.has("selGrid")) {
            throw new Error(`Uniauth 布局缺少中央表格：${uniauthDefinition.layoutId}。请在 center 区声明 selGrid。`);
        }
        // 静态结构用完整业务实例键定位，确保 HTML 可直接审阅且双实例不会串用节点。
        const uniauthRoot = uniauthApplicationHost.querySelector(`[data-uniauth-instance="${uniauthDefinition.gridId}"]`);
        // 当前页面布局模式仍由应用装配层写入公开面板选项，基础组件不会识别 URL 参数。
        uniauthApplicationHost.dataset.selPanelLayout = uniauthPanelLayout;
        // 多实例启用时移除类型列表的静态隐藏标记，单实例页面继续保留该完整结构供源码审阅。
        uniauthRoot?.toggleAttribute("hidden", !uniauthMultiEnabled && uniauthDefinition.gridId === "UniauthUserTypeGrid");
        // 静态骨架缺失时阻止后续控件挂载到不完整的页面结构。
        if (!uniauthRoot) {
            throw new Error(`静态面板结构缺失：${uniauthDefinition.gridId}。请检查 uniauth.html 的 data-uniauth-instance。`);
        }
        // selPanel.mount 负责把标准标题、动作、下拉数据和布局选项写入基础结构。
        const uniauthPanel = window.selPanel.mount(uniauthRoot, {
            view: uniauthPayload,
            height: uniauthPanelHeight,
            expandLeftLabel: uniauthPayload.title.messages.expandLeftRegion,
            collapseLeftLabel: uniauthPayload.title.messages.collapseLeftRegion
        });
        // 面板视图失败时阻止其他控件挂载到不完整结构。
        if (!uniauthPanel) {
            throw new Error(`基础面板挂载失败：${uniauthDefinition.gridId}。请检查标准 panel payload。`);
        }
        // 只有布局声明 selSearch 时才把当前实例的独立 search JSON 交给搜索基础控件。
        if (uniauthLayoutComponentNames.has("selSearch")) {
            // 搜索基础控件只接收当前实例宿主和独立 search JSON。
            const uniauthSearchController = window.selSearch.mount(uniauthRoot, uniauthPayload.search);
            // 搜索配置或宿主缺失时阻止表格退回即时输入等旧实现。
            if (!uniauthSearchController) {
                throw new Error(`基础搜索控件挂载失败：${uniauthDefinition.gridId}。请检查 search payload 和 search-host。`);
            }
        }
        // 只有左区声明 selTree 时才把 tree JSON 交给树基础控件。
        if (uniauthLayoutComponentNames.has("selTree")) {
            // 树基础控件只接收当前实例宿主和标准 tree 数据。
            window.selTree.mount(uniauthRoot, uniauthPayload.tree);
        }
        // 只有右区声明 selGridMenu 时才把 menu JSON 交给表格菜单基础控件。
        if (uniauthLayoutComponentNames.has("selGridMenu")) {
            // 表格行菜单只接收当前实例宿主和标准 menu 数据。
            window.selGridMenu.mount(uniauthRoot, uniauthPayload.menu);
        }
        // 只要布局含任一 selDropdownMenu，就挂载面板内已声明并填充的全部下拉宿主。
        if (uniauthLayoutComponentNames.has("selDropdownMenu")) {
            // 下拉基础控件仍严格限制在当前实例根内，不会控制另一套面板。
            window.selDropdownMenu.mountAll(uniauthRoot);
        }
        // 表格最后挂载，以获得同实例已经创建的树、菜单和下拉控制器。
        const uniauthGridController = window.selGrid.mount(uniauthRoot, uniauthPayload);
        // 表格挂载失败表示基础结构或标准聚合数据不完整。
        if (!uniauthGridController) {
            throw new Error(`基础表格挂载失败：${uniauthDefinition.gridId}。请检查标准 grid payload。`);
        }
        // 每个表格实例创建独立新建项目窗口，业务字段来自应用视图配置。
        const uniauthWindowController = window.selWindow.mount(uniauthApplicationHost, {
            // 稳定键确保双实例的新建窗口互不共享位置、尺寸和激活栏目。
            id: `${uniauthDefinition.gridId}CreateWindow`,
            // 展开只读表单配置，把应用业务内容交给基础窗体的标准数据入口。
            ...uniauthProjectWindowView
        });
        // 当前实例窗口挂载失败时不允许新建动作回退到应用层原生 DOM。
        if (!uniauthWindowController) {
            throw new Error(`基础窗口挂载失败：${uniauthDefinition.gridId}。`);
        }
        // 应用挂载点接收当前实例的受控新建事件，避免表格重绘替换内部节点时遗失监听。
        uniauthApplicationHost.addEventListener("selGrid:new", (event) => {
            // 只有事件详情中的实例键匹配时才打开本窗口，保证同页实例彼此隔离。
            if (event.detail?.instanceKey === uniauthDefinition.gridId) uniauthWindowController.open();
        });
        // 注册表保留窗口控制器，供后续项目新建流程显式调用。
        uniauthWindowControllers.set(uniauthDefinition.gridId, uniauthWindowController);
        // 应用注册表只保存业务实例与聚合响应的关系，不保存组件内部 DOM。
        uniauthInstances.set(uniauthDefinition.gridId, uniauthPayload);
        // 返回基础表格控制器供装配流程确认成功。
        return uniauthGridController;
    }

    /**
     * 装配背景和全部业务实例。
     * @returns {Promise<boolean>} 全部基础控件成功挂载时返回 true。
     */
    async function uniauthLoadAll() {
        // 页面语言通过基础运行时同步，不直接操作 document。
        uniauthBase.setDocument({ lang: uniauthLocale });
        // 背景基础控件只创建图层和内存状态，刷新页面自动使用默认值。
        const uniauthBackgroundController = window.selPageBackground.mount(uniauthBackgroundHost, {
            // 首次打开采用深色皮肤的完整配套背景参数，个性化入口仍可在当前页面切换和调节。
            defaults: Object.freeze({ theme: "void", overlay: 52, brightness: 86, blur: 0 })
        });
        // 背景区域存在但基础控件挂载失败时明确阻止半成品页面。
        if (!uniauthBackgroundController) {
            throw new Error("基础背景控件挂载失败：请检查 data-sel-page-background-host。");
        }
        // 个性化基础控件组合背景控制器，并用页面级令牌统一管理全部水晶面板。
        const uniauthPersonalizationController = window.selPersonalization.mount(uniauthPersonalizationHost, {
            // 背景状态继续由独立 selPageBackground 控制器拥有，个性化模块只调用公开 API。
            backgroundController: uniauthBackgroundController
        });
        // 个性化宿主或控制器缺失时阻止交付半成品设置入口。
        if (!uniauthPersonalizationController) {
            throw new Error("基础个性化控件挂载失败：请检查 data-sel-personalization-host。");
        }
        // 每个业务定义只通过基础 API 创建和挂载独立实例。
        await Promise.all(uniauthDefinitions.map((uniauthDefinition) => uniauthMountInstance(uniauthDefinition)));
        // 浏览器标题使用主实例当前语言数据。
        const uniauthPrimaryPayload = uniauthInstances.get("UniauthUserGrid");
        // 主实例存在时通过基础运行时更新标题。
        if (uniauthPrimaryPayload) {
            uniauthBase.setDocument({ title: uniauthPrimaryPayload.title.pageTitle });
        }
        // true 表示应用装配全部完成。
        return true;
    }

    // 立即启动应用装配，并把完成状态暴露给浏览器验收和未来业务调用。
    const uniauthReady = uniauthLoadAll().catch((uniauthError) => {
        // 控制台保留真实异常，基础层不会用默认业务数据掩盖失败。
        console.error(uniauthError);
        // 继续抛出异常阻止调用方误判页面就绪。
        throw uniauthError;
    });

    // 公开只读应用入口；基础控件不得反向读取该对象。
    window.uniauth = Object.freeze({
        // ready 表示全部业务实例和背景基础控件的装配结果。
        ready: uniauthReady,
        // locale 表达当前聚合响应语言。
        locale: uniauthLocale,
        // getPayload 返回指定实例聚合对象，不存在时返回 null。
        getPayload: (uniauthGridId) => uniauthInstances.get(uniauthGridId) || null,
        // hasPayload 便于调用方判断实例是否完成装配。
        hasPayload: (uniauthGridId) => uniauthInstances.has(uniauthGridId),
        // list 返回已装配的完整业务实例键。
        list: () => Object.freeze(Array.from(uniauthInstances.keys())),
        // getLayout 按模板名称返回只读五区布局，方便开发者查看和调整页面位置。
        getLayout: (uniauthLayoutId) => uniauthLayouts[uniauthLayoutId] || null,
        // getInstanceLayout 按业务实例键返回实际使用的五区布局。
        getInstanceLayout(uniauthGridId) {
            // 实例定义决定布局归属，不从已生成 DOM 反向推测。
            const uniauthDefinition = uniauthDefinitions.find((uniauthItem) => uniauthItem.gridId === uniauthGridId);
            // 未登记实例时返回 null，便于调用方安全判断。
            return uniauthDefinition ? uniauthLayouts[uniauthDefinition.layoutId] || null : null;
        }
    });
})();
