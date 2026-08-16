/*
 * reference-data.js：引用数据六表管理工作台装配层。
 * ReferenceDataType 按 optionSetCode 维护可复用类型值和分级菜单，ReferenceDataTreeNode 只维护真实树节点。
 *
 * SEL UI 组件用法：panel 负责工作台布局，search/tree/dropdown/grid 负责查询与展示，
 * windowComponent 负责编辑表单，confirmDialog 负责危险确认，personalization 负责页面配置。
 *
 * 阅读顺序：
 * 1. window.sel.require() 声明本页必须具备的公共能力；
 * 2. referenceDataModules 描述六张业务表，referenceDataState 保存页面运行状态；
 * 3. referenceDataBuildPayload() 把业务数据转换成公共 Panel/Grid/Tree 能识别的标准输入；
 * 4. referenceDataMount*() 挂载公共组件，referenceDataBind*() 连接业务事件；
 * 5. mountApp() 只编排启动顺序，其余函数负责加载数据、生成表单、执行 CRUD 或同步页面编辑状态。
 *
 * 责任边界：本文件可以认识引用数据实体和后台地址，但不复制 Grid、Tree、Window 等公共组件内部 DOM。
 * 公共组件只接收标准配置；业务接口、缓存、模块切换和错误提示仍由本装配层负责。
 *
 * 注释约定：
 * - 每个有效语句或连续语句组前都说明业务目的，阅读时先看注释再看实现；
 * - 对象中的同一行属性属于一个完整配置单元，由紧邻注释统一解释；
 * - 纯括号、逗号和链式调用的续行不重复写注释，避免注释反而切断代码结构；
 * - “公共组件做什么”和“本页业务做什么”分别说明，便于刚接触 SEL API 时判断职责边界。
 */
(function app() {
    // 严格模式会把隐式全局变量等低级错误直接暴露出来，防止应用污染其他页面。
    "use strict";

    // require() 只校验依赖是否已经按 HTML 顺序加载，不会创建组件；缺少任一能力时立即抛出可读错误。
    window.sel.require([
        "core.element", "core.freeze", "core.query", "net.ajax", "components.panel", "components.search",
        "components.tree", "components.dropdownMenu", "components.grid",
        "components.window", "components.confirmDialog",
        "components.pageBackground", "components.personalization"
    ]);
    // core 提供无业务含义的基础函数；element 统一创建安全节点，freeze 生成只读配置快照。
    const selBase = window.sel.core;
    // element 统一处理类名、文本和属性；selFreeze 只包裹完整配置、聚合 payload 或返回快照。
    const { element, freeze: selFreeze } = selBase;
    // net.ajax 是统一请求入口：request 读取标准业务响应，json 读取原始 JSON 或分页响应。
    const { ajax: selAjax } = window.sel.net;
    // 这里把命名空间 API 解构为页内短名称；它们仍来自 window.sel.components，不是新的全局变量。
    const {
        panel, search, tree, dropdownMenu: dropdown, grid, window: windowComponent,
        confirmDialog, pageBackground, personalization
    } = window.sel.components;
    /*
     * 本页使用的 SEL UI API 速查：
     * - element(tag, options) -> 安全文本节点；应用层不得绕过它直接调用 document.createElement；
     * - panel.create(host, options) -> Panel 根节点；panel.mount(root, options) -> 是否挂载成功；
     * - search/tree/grid.mount(root, payload) -> 控制器，后续用 setLocale() 原位更新；
     * - dropdown.mountAll(root) -> 当前作用域内的下拉实例数组；dropdown.setValue() -> 同步业务值；
     * - windowComponent.mount(host, options) -> 编辑窗口控制器，常用 open/reset/setValues/setLoading；
     * - confirmDialog.mount(host, options) -> 确认控制器，其 open(options) 返回 Promise<boolean>；
     * - pageBackground.mount() -> 背景控制器；personalization.mount() -> 个性化及页面编辑控制器。
     *
     * create/mount 只在 mountApp() 启动时调用一次；业务切换统一使用控制器更新，
     * 因此阅读其他函数时看到 setLocale/reset/open，可以回到这里判断它操作的是哪个公共组件。
     */
    // 应用宿主承载 Panel 和各编辑 Window；背景与个性化拥有各自独立宿主，避免互相接管 DOM。
    const appHost = selBase.query("[data-reference-data-app]");
    // 背景宿主只交给 pageBackground，业务 Panel 不向这里写入内容。
    const backgroundHost = selBase.query("[data-sel-page-background-host]");
    // 个性化宿主承载右侧设置面板和页面编辑入口，与业务工作区保持分离。
    const personalizationHost = selBase.query("[data-sel-personalization-host]");
    // 同一物理 Grid 在六个业务模块之间复用，因此事件过滤、搜索和分页都使用这个稳定实例 ID。
    const referenceDataGridId = "selGridReferenceDataManagementId";
    // 当前工作台固定使用中文表头；后续切换语言时应由页面语言会话传入，而不是让组件猜测。
    const referenceDataLocale = "zh-CN";
    // 导航接口决定当前用户可以看见的一级业务模块和默认模块。
    const referenceDataNavigationUrl = "/api/reference-data/workbench/navigation.htm";
    // Window 文案是公共组件资源，应用只指定当前语言资源地址。
    const referenceDataWindowMessagesUrl = "/sel/components/window/i18n/zh-CN.json?v=20260811-reference-workbench-1";

    /*
     * 六表业务注册表（表格元素只从表格定义详情进入，不占一级导航）。
     * key 是前端稳定模块键；tableName/gridId 是内部组件与表头解析坐标；api 是该表 Controller 根地址；
     * searchFields 告诉 Grid 哪些字段参与前端搜索；previewField 是树选择后写入搜索框的代表字段；
     * relation 表示记录具有 parentId 层级；hasBoolean 表示该实体存在布尔业务字段。
     */
    const referenceDataModules = selFreeze({
        // types 对应共享选项值目录，通过 optionSetCode 和 parentTypeCode 表达选项组与菜单层级。
        types: {
            // 第一组属性定义前端键、数据库表、Grid 坐标、接口、图标和编辑窗口实例。
            key: "types", tableName: "ReferenceDataType", viewCode: "TYPE", gridId: "selGridTypeManagementId",
            entity: "ReferenceDataType", api: "/api/reference-data/admin/types/", icon: "ri-database-2-line", windowId: "selWindowTypeManagementId",
            // 第二组属性定义界面名称、单条记录名称以及模块用途说明。
            name: "数据类型", itemName: "类型", description: "维护页面控件的类型值、菜单层级和多语言名称",
            // 类型只按自身 code 和上级类型 code 定位，不把名称或类型值混入结构搜索。
            searchFields: ["code", "parentTypeCode"], searchPlaceholder: "按 Code 和上级类型 Code 查询",
            queryFields: [
                { name: "code", label: "Code", placeholder: "Code", icon: "ri-key-2-line" },
                { name: "parentTypeCode", label: "上级类型 Code", placeholder: "上级类型 Code", icon: "ri-node-tree" }
            ],
            // previewField 是树节点选中后回填到搜索框的代表字段。
            previewField: "valueCode"
        },
        // tree 对应带 parentId 的层级节点表，所以 relation 明确开启递归树构造。
        tree: {
            // 模块坐标与接口全部集中登记，后续通用函数只接收 module，不再写六套分支地址。
            key: "tree", tableName: "ReferenceDataTreeNode", viewCode: "TREE", gridId: "selGridTreeNodeManagementId",
            entity: "ReferenceDataTreeNode", api: "/api/reference-data/admin/tree-nodes/", icon: "ri-node-tree", windowId: "selWindowTreeNodeManagementId",
            // 用户可见名称同时用于标题、按钮、空状态和反馈文案。
            name: "树节点", itemName: "树节点", description: "通过 code 与 parentId 维护独立父子树",
            // code 与 parentId 分别提交，禁止合并成一个会产生 OR 的关键词。
            searchFields: ["code", "parentId"], searchPlaceholder: "按 Code 和父节点 ID 查询",
            queryFields: [
                { name: "code", label: "Code", placeholder: "Code", icon: "ri-key-2-line" },
                { name: "parentId", label: "父节点 ID", placeholder: "父节点 ID", icon: "ri-node-tree" }
            ],
            // relation=true 告诉左树使用 parentId 递归，而不是平铺记录。
            previewField: "code", relation: true
        },
        // controls 是页面中全部可编辑控件与响应式布局的事实来源。
        controls: {
            key: "controls", tableName: "ReferenceDataControlLayout", viewCode: "CONTROL", gridId: "selGridControlLayoutManagementId",
            entity: "ReferenceDataControlLayout", api: "/api/reference-data/admin/control-layouts/", icon: "ri-layout-grid-line", windowId: "selWindowControlLayoutManagementId",
            name: "页面控件", itemName: "控件", description: "通过唯一 code 维护页面控件和响应式布局",
            // 页面控件使用独立字段后台分页查询；字段之间由 BaseDao 按 AND 组合。
            searchFields: [], searchPlaceholder: "按独立字段查询页面控件",
            queryFields: [
                { name: "code", label: "控件 Code", placeholder: "控件 Code", icon: "ri-key-2-line" },
                { name: "parentCode", label: "父控件 Code", placeholder: "父控件 Code", icon: "ri-node-tree" },
                { name: "optionSetCode", label: "选项组 Code", placeholder: "选项组 Code", icon: "ri-list-settings-line" }
            ],
            previewField: "code"
        },
        // windows 单独维护 SEL Window 的默认几何状态和行为边界。
        windows: {
            key: "windows", tableName: "ReferenceDataWindow", viewCode: "WINDOW", gridId: "selGridWindowManagementId",
            entity: "ReferenceDataWindow", api: "/api/reference-data/admin/windows/", icon: "ri-window-line", windowId: "selWindowWindowManagementId",
            name: "Window", itemName: "Window", description: "保存 Window 宽高、位置和调整边界",
            searchFields: ["code"], searchPlaceholder: "搜索 Code…",
            queryFields: [
                { name: "code", label: "Code", placeholder: "Code", icon: "ri-key-2-line" }
            ],
            previewField: "code"
        },
        // tables 登记“哪个页面上的哪个 Grid”存在，是进入表格元素详情的父记录。
        tables: {
            key: "tables", tableName: "ReferenceDataTable", viewCode: "TABLE", gridId: "selGridTableManagementId",
            entity: "ReferenceDataTable", api: "/api/reference-data/admin/tables/", icon: "ri-table-line", windowId: "selWindowTableManagementId",
            // 该模块的预览动作不是眼睛浮层，而是进入当前表格的列配置详情。
            name: "表格定义", itemName: "表格", description: "登记项目页面表格并进入对应表格头明细",
            // code 是公开定位坐标，项目、页面和真实业务表名用于管理员检索。
            searchFields: ["code"], searchPlaceholder: "搜索 Code…",
            queryFields: [
                { name: "code", label: "Code", placeholder: "Code", icon: "ri-key-2-line" }
            ],
            previewField: "code"
        },
        // columns 保存每个 Grid 的真实表头、绑定字段、渲染方式、宽度和显示状态。
        columns: {
            // columns 不显示为一级导航，只能在选中 tables 记录后进入，避免失去父表上下文。
            key: "columns", tableName: "ReferenceDataTableElement", viewCode: "TABLE_ELEMENT", gridId: "selGridTableElementManagementId",
            entity: "ReferenceDataTableElement", api: "/api/reference-data/admin/table-elements/", icon: "ri-layout-column-line", windowId: "selWindowTableElementManagementId",
            // 这里的“表格头”是配置管理名称，单条记录文案使用“表格列”。
            name: "表格头", itemName: "表格列", description: "配置每个页面表格的名称、宽度、多语言和显示状态",
            // 列配置既能按父表坐标检索，也能按列 ID、字段名和多语言表头检索。
            searchFields: ["code", "tableId"], searchPlaceholder: "按 Code 和所属表 ID 查询",
            queryFields: [
                { name: "code", label: "Code", placeholder: "Code", icon: "ri-key-2-line" },
                { name: "tableId", label: "所属表 ID", placeholder: "所属表 ID", icon: "ri-table-line" }
            ],
            // code 是表格元素的唯一公开坐标，tableId 只负责表内关联。
            previewField: "code", hasBoolean: true
        }
    });
    // 数组形式用于需要稳定遍历顺序的窗口挂载和下拉选项生成；对象形式用于按 key 快速定位模块。
    const referenceDataModuleList = selFreeze(Object.values(referenceDataModules));
    /*
     * 页面运行状态（故意不冻结）。
     * records/columns 是按模块隔离的缓存；各 *Controller 是公共组件 mount() 返回的控制器；
     * selectedTable/tableDetailTab 只在“表格定义 → 表格列详情”流程中使用。
     */
    const referenceDataState = {
        // 当前正在显示的模块键，初始化后可能被导航接口覆盖。
        activeKey: "types",
        // 后台允许展示的导航模块顺序，不包含只能从表格详情进入的 columns。
        navigationKeys: [],
        // 已取回业务记录的模块集合，用来区分“正在加载”和“确实为空”。
        loadedKeys: new Set(),
        // Map<moduleKey, record[]>：六张业务表的页面缓存。
        records: new Map(),
        // Map<moduleKey, column[]>：每个模块从 getGridColumn 得到的表头配置。
        columns: new Map(),
        // 当前编辑记录主键；null 表示新增。
        editingId: null,
        // Panel 根节点以及各公共组件控制器均在 mount 成功后写入。
        panelRoot: null,
        searchController: null,
        gridController: null,
        treeController: null,
        // 每个业务模块拥有独立 Window 控制器，防止切换模块后表单契约串用。
        editWindowControllers: new Map(),
        // 删除与取消页面编辑分别使用专用公共控制器。
        deleteConfirmController: null,
        personalizationController: null,
        // 页面配置 code 与版本来自后台，保存时用于页面归属校验和并发冲突保护。
        pageCode: null,
        pageVersion: 0,
        // 七个查询控件分别保存数据库记录、真实节点和当前拖拽矩形，禁止合并成一个搜索栏草稿。
        queryControlEditors: new Map(),
        // remotePages 保存后台当前页、总数和已提交条件；目前页面控件启用真实后台分页。
        remotePages: new Map(),
        // 当前选中表格是列配置的逻辑父级；详情页签只允许 info/columns/preview。
        selectedTable: null,
        tableDetailTab: null
    };

    /*
     * Panel 五区布局声明。component 使用稳定组件 ID（如 selGrid），payload 指向 buildPayload() 返回对象中的字段。
     * 这里只描述“控件放在哪里”，真实结构和事件生命周期仍由 panel/grid/tree 等公共组件创建。
     */
    const referenceDataLayout = selFreeze({
        // top 放标题与筛选工具栏，先建立页面上下文再允许用户筛选数据。
        top: [
            { component: "title", payload: "title" },
            {
                component: "toolbar",
                children: [
                    // 搜索、数据范围、状态和重置分别读取 Payload 中对应的配置段。
                    { component: "selSearch", payload: "search" },
                    { component: "selDropdownMenu", slot: "projectType", payload: "select.projectType" },
                    { component: "selDropdownMenu", slot: "status", payload: "select.status" },
                    { component: "filterReset", payload: "title" }
                ]
            }
        ],
        // left 是业务模块导航树；用户通过它切换六表中的当前业务上下文。
        left: [{ component: "selTree", payload: "tree" }],
        // center 复用一个 selGrid；$aggregate 表示 Grid 可以读取整个聚合 Payload。
        center: [{ component: "selGrid", payload: "$aggregate" }],
        // 当前页面不使用右侧业务栏，保留空数组让 Panel 维持统一五区协议。
        right: [],
        // bottom 汇总当前记录数、分页大小、翻页按钮和非阻断反馈。
        bottom: [
            {
                component: "footer",
                children: [
                    {
                        // gridSummary 内嵌 pageSize 下拉，使数量与分页设置保持在同一区域。
                        component: "gridSummary", payload: "pagination",
                        children: [{ component: "selDropdownMenu", slot: "pageSize", payload: "select.pageSize" }]
                    },
                    { component: "pagination", payload: "pagination" },
                    { component: "feedback", payload: "title.messages" }
                ]
            }
        ]
    });
    // 普通模块只有一个搜索字段，外层栏目只容纳 280px 输入、8px 间距和 86px 查询按钮。
    const referenceDataCompactToolbar = selFreeze({
        // 查询栏改由页面编辑器按五个真实控件分别调宽，关闭外层栏目分隔线避免再次把输入和按钮联动。
        columnResize: false,
        // columns 的键必须与 Panel 生成的 slot/组件稳定 ID 对应。
        columns: {
            // 单字段栏目保持紧凑，避免输入缩短后外层旧宽度继续制造整段空白。
            "selSearch-1": { width: 374, minWidth: 274, maxWidth: 460, label: "查询栏目宽度" },
            // 数据范围下拉展示业务标签和描述，默认宽度大于普通状态下拉。
            projectType: { width: 200, minWidth: 160, maxWidth: 300, label: "调整数据范围栏目宽度" },
            // 状态下拉只有固定三项，使用较窄宽度并保留完整可访问名称。
            status: { width: 180, minWidth: 150, maxWidth: 260, label: "调整状态栏目宽度" },
            // 重置按钮只需要容纳短文案，限制最大宽度避免挤压筛选控件。
            "filterReset-4": { width: 90, minWidth: 80, maxWidth: 136, label: "调整重置栏目宽度" }
        }
    });
    // 三字段模块继续保留足够的外层宽度供数据库几何配置覆盖。
    const referenceDataControlToolbar = selFreeze({
        columnResize: false,
        columns: {
            "selSearch-1": { width: 798, minWidth: 620, maxWidth: 960, label: "查询栏目宽度" },
            projectType: { width: 200, minWidth: 160, maxWidth: 300, label: "调整数据范围栏目宽度" },
            status: { width: 180, minWidth: 150, maxWidth: 260, label: "调整状态栏目宽度" },
            "filterReset-4": { width: 90, minWidth: 80, maxWidth: 136, label: "调整重置栏目宽度" }
        }
    });

    // 两字段模块使用中等宽度，避免压缩输入，也不制造三字段工具栏的多余空白。
    const referenceDataDoubleFieldToolbar = selFreeze({
        columnResize: false,
        columns: {
            "selSearch-1": { width: 586, minWidth: 472, maxWidth: 720, label: "查询栏目宽度" },
            projectType: { width: 200, minWidth: 160, maxWidth: 300, label: "调整数据范围栏目宽度" },
            status: { width: 180, minWidth: 150, maxWidth: 260, label: "调整状态栏目宽度" },
            "filterReset-4": { width: 90, minWidth: 80, maxWidth: 136, label: "调整重置栏目宽度" }
        }
    });

    /** 根据当前模块返回匹配字段数量的工具栏栏目配置。 */
    function referenceDataActiveToolbar() {
        const fieldCount = referenceDataActiveModule().queryFields?.length || 1;
        if (fieldCount >= 3) return referenceDataControlToolbar;
        if (fieldCount === 2) return referenceDataDoubleFieldToolbar;
        return referenceDataCompactToolbar;
    }
    // 查询工具栏每个真实字段独立登记；查询按钮只有一条共享记录并跟随当前字段流自动排列。
    const referenceDataQueryControlDefinitions = selFreeze([
        { orderNo: 10, key: "code", targetKey: "code", title: "Code 查询", typeLabel: "查询输入控件", icon: "ri-key-2-line", minWidth: 150, maxWidth: 360 },
        { orderNo: 15, key: "parentTypeCode", targetKey: "parentTypeCode", title: "上级类型 Code 查询", typeLabel: "查询输入控件", icon: "ri-node-tree", minWidth: 150, maxWidth: 360 },
        { orderNo: 15, key: "parentId", targetKey: "parentId", title: "父节点 ID 查询", typeLabel: "查询输入控件", icon: "ri-node-tree", minWidth: 150, maxWidth: 360 },
        { orderNo: 15, key: "parentCode", targetKey: "parentCode", title: "父控件 Code 查询", typeLabel: "查询输入控件", icon: "ri-node-tree", minWidth: 150, maxWidth: 360 },
        { orderNo: 15, key: "tableId", targetKey: "tableId", title: "所属表 ID 查询", typeLabel: "查询输入控件", icon: "ri-table-line", minWidth: 150, maxWidth: 360 },
        { orderNo: 17, key: "optionSetCode", targetKey: "optionSetCode", title: "选项组 Code 查询", typeLabel: "查询输入控件", icon: "ri-list-settings-line", minWidth: 150, maxWidth: 360 },
        { orderNo: 20, key: "submit", targetKey: "submit", title: "查询按钮", typeLabel: "查询按钮控件", icon: "ri-search-eye-line", minWidth: 72, maxWidth: 160 },
        { orderNo: 30, key: "projectType", title: "类型筛选", typeLabel: "类型筛选控件", icon: "ri-apps-2-line", minWidth: 160, maxWidth: 420 },
        { orderNo: 40, key: "status", title: "状态筛选", typeLabel: "状态筛选控件", icon: "ri-checkbox-circle-line", minWidth: 160, maxWidth: 420 },
        { orderNo: 50, key: "reset", title: "重置按钮", typeLabel: "重置按钮控件", icon: "ri-reset-left-line", minWidth: 80, maxWidth: 160 }
    ]);

    /** 返回当前字段结构实际可见的查询元素定义，未显示的结构记录不参与页面编辑。 */
    function referenceDataActiveQueryControlDefinitions() {
        const fieldNames = new Set((referenceDataActiveModule().queryFields || []).map((field) => field.name));
        return referenceDataQueryControlDefinitions.filter((definition) =>
            !definition.targetKey || definition.key === "submit" || fieldNames.has(definition.targetKey));
    }

    /**
     * 返回当前模块的只读注册信息。
     *
     * @returns {object} 例如 activeKey 为 tree 时返回 ReferenceDataTreeNode 模块配置。
     * @sideEffect 无；只读取 referenceDataState.activeKey。
     */
    function referenceDataActiveModule() {
        // activeKey 是页面唯一模块游标，所有读取、表头和表单都从同一注册项取得契约。
        return referenceDataModules[referenceDataState.activeKey];
    }

    /**
     * 返回当前页面唯一真实 Grid 的数据库定义。
     *
     * @returns {object|null} 优先返回启用记录；没有启用记录时返回首条，完全未登记时返回 null。
     * @sideEffect 无；全部模块视图始终复用同一个 tableId 与 table code。
     */
    function referenceDataGridTable() {
        const tables = referenceDataState.records.get("tables") || [];
        return tables.find((record) => Number(record.status) === 1) || tables[0] || null;
    }

    /**
     * 返回页面编辑器展示的当前表格两段数据库定位坐标。
     *
     * @param {object} module 当前模块注册信息，默认使用正在显示的模块。
     * @returns {ReadonlyArray<object>} personalization 可直接展示的“唯一 code + 来源表”数据库坐标。
     * @sideEffect 无；返回值是只读快照。
     */
    function referenceDataPageEditorCoordinates(module = referenceDataActiveModule()) {
        // 当前物理 Grid 对应的 ReferenceDataTable 记录是页面列宽配置的父级事实来源。
        const tableRecord = referenceDataGridTable();
        // 冻结坐标避免个性化控件意外修改业务缓存中的 code 或来源表信息。
        return selFreeze([
            // code 是所有配置查询和保存的唯一公开坐标；未登记时直接提示，不回退旧 Grid ID。
            { label: "唯一 Code", value: tableRecord?.code || "尚未登记" },
            // 来源表明确告诉管理员应在数据库哪张表查询这条控件登记。
            { label: "来源表", value: "ReferenceDataTable" }
        ]);
    }

    /**
     * 捕获公共 Grid 当前列宽，页面编辑会话据此建立进入编辑模式时的基线。
     *
     * @returns {object} 形如 { columnWidths: { labelZh: 180 } } 的只读页面状态。
     * @sideEffect 无；Grid 未挂载时返回空列宽，保证页面编辑器仍能安全初始化。
     */
    function referenceDataCapturePageGridState() {
        // 可选链允许页面编辑器在 Grid 尚未挂载时读取到一个合法空快照。
        return selFreeze({
            // 公共 Grid 只返回“列 ID → 数字像素”，业务层不读取其内部 DOM 宽度。
            columnWidths: referenceDataState.gridController?.captureColumnWidths?.() || {}
        });
    }

    /**
     * 把当前表格草稿按页面原子保存到 ReferenceDataTableElement，并重新读取后台确认值。
     *
     * @param {object} pageGridState Grid 捕获的列宽草稿。
     * @returns {Promise<boolean>} 后台保存、重新读取并刷新 Grid 全部成功时返回 true。
     * @throws {Error} 当前 Grid 没有与数据库表头配置匹配的列时阻止空保存。
     * @sideEffect 调用页面配置保存接口，刷新表格元素缓存并重置 Grid 列宽基线。
     */
    async function referenceDataSavePageGridState(pageGridState = {}) {
        // 先取得当前模块，保证保存坐标与用户正在编辑的业务表一致。
        const module = referenceDataActiveModule();
        // 六种业务视图共用唯一 Grid 定义，模块差异只由元素 viewCode 表达。
        const tableRecord = referenceDataGridTable();
        if (!tableRecord) throw new Error(`未找到 ${module.tableName} 对应的表格定义。`);
        // 表格元素通过 tableId 归属父表，fieldName 与公共 Grid 返回的稳定列 ID 对应。
        const elementByField = new Map((referenceDataState.records.get("columns") || [])
            .filter((record) => Number(record.tableId) === Number(tableRecord.id)
                && String(record.viewCode) === String(module.viewCode))
            .map((record) => [String(record.fieldName || ""), record]));
        // 公共 Grid 返回数字像素；页面配置协议在边界处转换为受校验的 px 字符串。
        const widths = Object.entries(pageGridState.columnWidths || {})
            .filter(([columnId]) => elementByField.has(columnId))
            .map(([columnId, width]) => ({
                code: elementByField.get(columnId).code,
                width: `${Math.round(Number(width))}px`
            }));
        // 没有任何已登记列时禁止发空更新，避免用户误以为页面配置已经保存。
        if (widths.length === 0) throw new Error("当前表格没有可保存的数据库列配置。");
        // 一次 JSON 请求提交页面版本和有效表格元素，后台在同一事务内校验归属并更新。
        const result = await selAjax.request({
            url: `/api/reference-data/pages/${encodeURIComponent(referenceDataState.pageCode)}/configuration`,
            method: "POST",
            jsonData: { baseVersion: referenceDataState.pageVersion, tableElements: widths }
        });
        // 后台返回的新版本成为下一次保存基线，防止两个管理员互相覆盖。
        referenceDataState.pageVersion = Number(result.data?.version || referenceDataState.pageVersion + 1);
        // 保存后重新读取表格元素和当前业务表头，使本页与下次打开使用同一数据库来源。
        await Promise.all([
            referenceDataEnsureModuleLoaded(referenceDataModules.columns, true),
            referenceDataLoadResolvedColumns(module, true)
        ]);
        // 用后台重新读取的列配置刷新 Grid，避免界面继续保留数据库未接受的草稿值。
        referenceDataState.gridController.setLocale(referenceDataBuildPayload());
        // 新数据库值成为下一次拖拽和取消操作的基线。
        referenceDataState.gridController.resetColumnWidths();
        // true 告诉 personalization 本次显式保存已经完整完成。
        return true;
    }

    /**
     * 保存一个实际 Window 实例的当前矩形，并把保存结果设为该实例下次打开的默认位置。
     *
     * @param {object} windowRecord 与控制器一一对应的 ReferenceDataWindow 记录。
     * @param {object} geometry 公共 Window 返回的 left、top、width、height 像素矩形。
     * @param {object} controller 当前 Window 控制器。
     * @returns {Promise<boolean>} 后台原子保存并更新实例默认矩形后返回 true。
     * @throws {Error} 矩形缺失、版本冲突或后台拒绝保存时抛出。
     * @sideEffect 更新 ReferenceDataWindow 的宽高与 x/y，并推进页面版本。
     */
    async function referenceDataSaveWindowGeometry(windowRecord, geometry = {}, controller) {
        const width = Math.round(Number(geometry.width));
        const height = Math.round(Number(geometry.height));
        const x = Math.round(Number(geometry.left));
        const y = Math.round(Number(geometry.top));
        if (![width, height, x, y].every(Number.isFinite)) throw new Error("当前 Window 几何状态无效，无法保存。");
        const savedGeometry = {
            code: windowRecord.code,
            width: `${width}px`, height: `${height}px`, x, y, positionMode: "CUSTOM",
            breakpoint: windowRecord.breakpoint || "DESKTOP"
        };
        const result = await selAjax.request({
            url: `/api/reference-data/pages/${encodeURIComponent(referenceDataState.pageCode)}/configuration`,
            method: "POST",
            jsonData: { baseVersion: referenceDataState.pageVersion, windows: [savedGeometry] }
        });
        referenceDataState.pageVersion = Number(result.data?.version || referenceDataState.pageVersion + 1);
        Object.assign(windowRecord, savedGeometry);
        controller.setDefaultGeometry(windowRecord);
        return true;
    }

    /** 返回当前字段结构每个可见查询元素的数据库记录；缺失记录时调用方使用组件默认布局。 */
    function referenceDataQueryControlRecords() {
        const controls = referenceDataState.records.get("controls") || [];
        const toolbar = controls.find((record) => String(record.pageCode) === String(referenceDataState.pageCode)
            && String(record.parentKind) === "PAGE" && String(record.controlKind) === "TOOLBAR"
            && Number(record.status) === 1);
        if (!toolbar) throw new Error("查询工具栏尚未登记页面控件父记录。");
        const children = controls.filter((record) => String(record.parentKind) === "TOOLBAR"
            && String(record.parentCode) === String(toolbar.code) && Number(record.status) === 1);
        return referenceDataActiveQueryControlDefinitions().map((definition) => ({
            definition,
            record: children.find((candidate) => String(candidate.fieldName) === String(definition.fieldName || definition.key)) || null
        }));
    }

    /** 取得当前搜索字段、查询按钮、范围、状态和重置的真实节点。 */
    function referenceDataResolveQueryControlTargets() {
        referenceDataState.searchController?.setIndependentLayout(true);
        const searchTargets = referenceDataState.searchController?.getLayoutTargets?.() || {};
        const targets = new Map([
            ...referenceDataActiveQueryControlDefinitions()
                .filter((definition) => definition.targetKey)
                .map((definition) => [definition.key, searchTargets[definition.targetKey]]),
            ["projectType", panel.getComponent(referenceDataGridId, "selDropdownMenu", "projectType")],
            ["status", panel.getComponent(referenceDataGridId, "selDropdownMenu", "status")],
            ["reset", panel.getComponent(referenceDataGridId, "filterReset")]
        ]);
        if (Array.from(targets.values()).some((target) => !(target instanceof Element))) {
            throw new Error("当前查询工具栏元素尚未完整挂载。");
        }
        return targets;
    }

    /** 捕获一个查询控件相对于工具栏的矩形；搜索关键字、筛选值等业务状态不会进入布局保存。 */
    function referenceDataCaptureQueryControlState(editor) {
        const toolbarRect = editor.toolbar.getBoundingClientRect();
        const targetRect = editor.target.getBoundingClientRect();
        return {
            x: Math.round(targetRect.left - toolbarRect.left),
            y: Math.round(targetRect.top - toolbarRect.top),
            width: `${Math.round(targetRect.width)}px`,
            height: `${Math.round(targetRect.height)}px`
        };
    }

    /** 按当前子控件的唯一 code 单独保存矩形，并保留同级其他控件的未保存状态。 */
    async function referenceDataSaveQueryControlState(editor) {
        if (!editor.record?.code) throw new Error(`${editor.definition.title}尚未登记布局记录，请先完成页面控件初始化。`);
        const savedLayout = {
            code: editor.record.code,
            ...referenceDataCaptureQueryControlState(editor),
            breakpoint: editor.record.breakpoint || "DESKTOP"
        };
        const result = await selAjax.request({
            url: `/api/reference-data/pages/${encodeURIComponent(referenceDataState.pageCode)}/configuration`,
            method: "POST",
            jsonData: { baseVersion: referenceDataState.pageVersion, controls: [savedLayout] }
        });
        referenceDataState.pageVersion = Number(result.data?.version || referenceDataState.pageVersion + 1);
        Object.assign(editor.record, savedLayout);
        return true;
    }

    /** 同步当前字段结构的逐元素编辑器；字段重挂载后更新真实根，不丢失拖拽和调宽能力。 */
    function referenceDataMountQueryControlEditors() {
        const toolbar = panel.getComponent(referenceDataGridId, "toolbar");
        if (!(toolbar instanceof Element)) throw new Error("查询工具栏宿主不存在。");
        const targets = referenceDataResolveQueryControlTargets();
        const entries = referenceDataQueryControlRecords();
        const resetTarget = targets.get("reset");
        const resetColumn = resetTarget.closest(".selpanel-toolbar-column") || resetTarget.parentElement;
        if (!(resetColumn instanceof Element)) throw new Error("重置按钮列不存在，无法挂载查询控件保存入口。");
        const sharedEditHost = toolbar.querySelector(".reference-data-query-save-host") || element("span", {
            className: "reference-data-query-save-host", attributes: { "aria-label": "当前查询控件保存入口" }
        });
        resetColumn.classList.add("reference-data-query-actions-column");
        if (!sharedEditHost.isConnected) resetTarget.insertAdjacentElement("afterend", sharedEditHost);
        toolbar.dataset.referenceDataQueryEditorMounted = "true";
        const activeKeys = new Set(entries.map(({ definition }) => definition.key));
        referenceDataState.queryControlEditors.forEach((editor, key) => {
            if (!activeKeys.has(key)) {
                referenceDataState.personalizationController.updatePageControl(editor.id, { enabled: false });
            }
        });
        entries.forEach(({ definition, record }) => {
                const target = targets.get(definition.key);
                const editorId = `selQuery${definition.key.charAt(0).toUpperCase()}${definition.key.slice(1)}ReferenceDataPageEditorId`;
                const editor = referenceDataState.queryControlEditors.get(definition.key)
                    || { id: editorId, definition, record, target, toolbar };
                Object.assign(editor, { definition, record, target, toolbar });
                const targetRect = target.getBoundingClientRect();
                const toolbarRect = toolbar.getBoundingClientRect();
                const geometry = {
                    container: toolbar,
                    direct: true,
                    flow: { key: "referenceDataQueryToolbar", gap: 12, order: definition.orderNo },
                    boundsHeight: 88,
                    minWidth: definition.minWidth,
                    maxWidth: definition.maxWidth,
                    minHeight: 42,
                    maxHeight: 42,
                    state: {
                        x: record?.x ?? Math.round(targetRect.left - toolbarRect.left),
                        y: record?.y ?? Math.round(targetRect.top - toolbarRect.top),
                        width: record?.width || `${Math.round(targetRect.width)}px`,
                        height: record?.height || `${Math.round(targetRect.height)}px`
                    }
                };
                const coordinates = [
                    { label: "唯一 Code", value: record?.code || "尚未登记" },
                    { label: "来源表", value: "ReferenceDataControlLayout" }
                ];
                if (referenceDataState.queryControlEditors.has(definition.key)) {
                    referenceDataState.personalizationController.updatePageControl(editorId, {
                        enabled: true, root: target, title: definition.title, typeLabel: definition.typeLabel,
                        icon: definition.icon, coordinates, geometry,
                        captureState: () => referenceDataCaptureQueryControlState(editor),
                        saveState: () => referenceDataSaveQueryControlState(editor)
                    });
                    return;
                }
                referenceDataState.queryControlEditors.set(definition.key, editor);
                if (!referenceDataState.personalizationController.registerPageControl({
                    id: editorId,
                    type: "query-control", typeLabel: definition.typeLabel, title: definition.title, icon: definition.icon,
                    root: target,
                    sharedEdit: {
                        key: "referenceDataQueryToolbar",
                        host: sharedEditHost,
                        label: "保存",
                        follow: definition.key === "reset"
                    },
                    geometry,
                    coordinates,
                    captureState: () => referenceDataCaptureQueryControlState(editor),
                    saveState: () => referenceDataSaveQueryControlState(editor)
                })) throw new Error(`${definition.title}页面编辑登记失败。`);
        });
    }

    /**
     * 把同一物理 Grid 当前切换到的业务模块坐标同步给公共页面编辑器。
     *
     * @returns {void}
     * @sideEffect 更新 personalization 中已登记控件的标题、坐标和状态适配器，不重新挂载组件。
     */
    function referenceDataSyncPageEditorControl() {
        // 模块切换后重新取得业务坐标，而不是沿用首次挂载时的类型表坐标。
        const module = referenceDataActiveModule();
        // updatePageControl 只更新登记信息和适配器，不会重新创建个性化面板。
        referenceDataState.personalizationController?.updatePageControl("selGridReferenceDataPageEditorId", {
            // 标题和坐标用于管理员直观看到当前实际编辑的是哪张表。
            title: `${module.name}表格`,
            typeLabel: "表格控件",
            icon: "ri-table-line",
            coordinates: referenceDataPageEditorCoordinates(module),
            // 当前状态与显式保存适配器随模块切换，页面总开关不维护草稿。
            captureState: referenceDataCapturePageGridState,
            saveState: referenceDataSavePageGridState
        });
        // 每次模块切换都同步当前真实元素；公共编辑器会更新重挂载后的根并停用不可见结构。
        referenceDataMountQueryControlEditors();
    }

    /**
     * 按后台导航顺序取得当前用户可访问的模块配置。
     *
     * @returns {object[]} 已过滤无效 key 的模块配置数组。
     * @sideEffect 无。
     */
    function referenceDataNavigationModules() {
        // 后台返回的是稳定 key；先映射注册表，再过滤已经下线或拼写错误的项。
        return referenceDataState.navigationKeys
            .map((key) => referenceDataModules[key])
            .filter(Boolean);
    }

    /**
     * 从工作台导航接口读取可见模块和默认模块。
     *
     * @returns {Promise<void>} 导航数据写入状态后完成。
     * @throws {Error} 后台未返回任何合法模块时停止初始化，避免显示一个权限不明的空页面。
     * @sideEffect 写入 navigationKeys 和 activeKey；columns 始终只能从表格详情进入，故从一级导航排除。
     */
    async function referenceDataLoadNavigation() {
        // request() 识别平台标准响应，并从 result.data 中读取业务字段。
        const result = await selAjax.request({ url: referenceDataNavigationUrl });
        // 缺少 modules 时按空数组处理，由下方明确错误负责阻断启动。
        const items = Array.isArray(result.data?.modules) ? result.data.modules : [];
        // columns 必须依附具体表格定义，因此即使后台返回也不能成为一级入口。
        referenceDataState.navigationKeys = items
            .map((item) => String(item.key || ""))
            .filter((key) => key !== "columns" && Boolean(referenceDataModules[key]));
        // 没有可访问模块时不能猜测权限或展示硬编码默认模块。
        if (referenceDataState.navigationKeys.length === 0) throw new Error("引用数据工作台导航为空。");
        // initialKey 是后台建议首屏；缺失时使用权限列表的第一项。
        const initialKey = String(result.data?.initialKey || referenceDataState.navigationKeys[0]);
        // 后台建议值仍须存在于权限列表，否则回退到第一个合法模块。
        referenceDataState.activeKey = referenceDataState.navigationKeys.includes(initialKey)
            ? initialKey : referenceDataState.navigationKeys[0];
    }

    /**
     * 读取当前工作台页面配置基线，为页面编辑保存准备 pageCode、版本和六表关联缓存。
     *
     * @returns {Promise<void>} 页面配置和表格父子数据全部进入运行状态后完成。
     * @throws {Error} 未登记 PAGE 控件或页面配置读取失败时阻止开放页面编辑。
     * @sideEffect 加载 controls/tables/columns，写入 pageCode、pageVersion 并同步后台页面配置记录。
     */
    async function referenceDataLoadPageConfiguration() {
        // 页面、表格和表格元素是页面保存的最小完整关系，启动时并行读取避免首次点击保存才发现缺数据。
        await Promise.all([
            referenceDataEnsureModuleLoaded(referenceDataModules.controls),
            referenceDataEnsureModuleLoaded(referenceDataModules.tables),
            referenceDataEnsureModuleLoaded(referenceDataModules.columns)
        ]);
        // PAGE 控件是页面 code 的唯一事实来源，禁止在前端硬编码数据库主键或路径。
        const pageControl = (referenceDataState.records.get("controls") || [])
            .find((record) => String(record.controlKind) === "PAGE" && Number(record.status) === 1);
        if (!pageControl?.pageCode) throw new Error("引用数据工作台尚未登记 PAGE 控件，无法加载页面配置。");
        referenceDataState.pageCode = String(pageControl.pageCode);
        // 页面配置接口返回一致性版本；保存成功前任何草稿都必须携带该版本。
        const result = await selAjax.request({
            url: `/api/reference-data/pages/${encodeURIComponent(referenceDataState.pageCode)}/configuration`
        });
        referenceDataState.pageVersion = Number(result.data?.version || 0);
        // 页面编辑的控件父子关系使用配置接口同一事务视图，避免全表分页在启动迁移更新期间产生跨页重复或遗漏。
        if (Array.isArray(result.data?.controls)) {
            referenceDataState.records.set("controls", result.data.controls);
            referenceDataState.loadedKeys.add("controls");
        }
        // 使用页面接口返回的表格元素覆盖普通分页缓存，确保页面编辑看到完整且同一事务视图的数据。
        if (Array.isArray(result.data?.tableElements)) {
            referenceDataState.records.set("columns", result.data.tableElements);
            referenceDataState.loadedKeys.add("columns");
        }
        // 页面配置中的 Window 列表是标题编辑入口的数据库事实来源，同时避免随后重复请求同一页面的 Window 记录。
        if (Array.isArray(result.data?.windows)) {
            referenceDataState.records.set("windows", result.data.windows);
            referenceDataState.loadedKeys.add("windows");
        }
    }

    /**
     * 分页读取某一业务表的全部有效记录，供树、下拉、预览和 Grid 共用。
     *
     * @param {object} module 包含 api 根地址的模块配置。
     * @returns {Promise<object[]>} 合并所有分页并排除 status=0 逻辑删除记录后的数组。
     * @sideEffect 只发起读取请求；缓存由 referenceDataEnsureModuleLoaded() 统一写入。
     */
    async function referenceDataLoadAllRecords(module) {
        // 每次最多取 100 条：先读第一页获得 totalCount，再并行读取其余页，避免逐页串行等待。
        const pageSize = 100;
        // json() 用于这里的分页原始结构；它不会要求响应一定包在平台 data 字段中。
        const firstPage = await selAjax.json({
            url: `${module.api}getStore.htm?pageNo=1&pageSize=${pageSize}`
        });
        // totalCount 只用于计算还需请求多少页，至少保留一页以统一空表逻辑。
        const totalPages = Math.max(1, Math.ceil(Number(firstPage.totalCount || 0) / pageSize));
        // 单页直接返回可以省去 Promise.all，同时在边界处排除 status=0 逻辑删除数据。
        if (totalPages === 1) {
            return (Array.isArray(firstPage.records) ? firstPage.records : [])
                .filter((record) => Number(record.status) !== 0);
        }
        // Promise.all 保留页码顺序；任何一页失败都会让本次模块加载整体失败，不缓存残缺数据。
        const otherPages = await Promise.all(
            // 下标从 0 开始，所以实际页码需要加 2；第一页已经在上方读取。
            Array.from({ length: totalPages - 1 }, (_, index) => selAjax.json({
                url: `${module.api}getStore.htm?pageNo=${index + 2}&pageSize=${pageSize}`
            }))
        );
        // 把所有分页 records 合并成一个页面缓存，供 Tree、Grid 和表单下拉复用。
        return [firstPage, ...otherPages]
            .flatMap((page) => page.records || [])
            .filter((record) => Number(record.status) !== 0);
    }

    /**
     * 按独立字段读取页面控件后台分页结果。
     *
     * @param {object} module 页面控件模块注册信息。
     * @param {object} query 已提交的页码、容量和独立字段条件。
     * @returns {Promise<object>} 当前页 records、totalCount 与规范查询状态。
     * @sideEffect 只调用 BaseController 分页入口；不在前端加载或过滤其他页。
     */
    async function referenceDataLoadRemotePage(module, query = {}) {
        const current = referenceDataState.remotePages.get(module.key) || {};
        const normalized = {
            pageNo: Math.max(1, Number(query.pageNo ?? current.pageNo) || 1),
            pageSize: Math.max(1, Number(query.pageSize ?? current.pageSize) || 20),
            code: String(query.code ?? current.code ?? "").trim(),
            parentCode: String(query.parentCode ?? current.parentCode ?? "").trim(),
            optionSetCode: String(query.optionSetCode ?? current.optionSetCode ?? "").trim(),
            controlKind: String(query.controlKind ?? current.controlKind ?? "").trim(),
            status: String(query.status ?? current.status ?? "").trim()
        };
        // 每个查询字段独立映射 BaseDao 后缀条件；参数同时存在时由公共查询构造器使用 AND。
        const parameters = new URLSearchParams({
            pageNo: String(normalized.pageNo), pageSize: String(normalized.pageSize)
        });
        if (normalized.code) parameters.set("codeLike", normalized.code);
        if (normalized.parentCode) parameters.set("parentCodeLike", normalized.parentCode);
        if (normalized.optionSetCode) parameters.set("optionSetCodeLike", normalized.optionSetCode);
        if (normalized.controlKind) parameters.set("controlKind", normalized.controlKind);
        if (normalized.status) parameters.set("status", normalized.status);
        const page = await selAjax.json({ url: `${module.api}getStore.htm?${parameters}` });
        const result = {
            ...normalized,
            records: (Array.isArray(page.records) ? page.records : []).filter((record) => Number(record.status) !== 0),
            totalCount: Math.max(0, Number(page.totalCount) || 0),
            pageNo: Math.max(1, Number(page.pageNo) || normalized.pageNo),
            pageSize: Math.max(1, Number(page.pageSize) || normalized.pageSize)
        };
        referenceDataState.remotePages.set(module.key, result);
        return result;
    }

    /**
     * 查询当前模块对应 Grid 的数据库表头配置。
     *
     * @param {object} module 提供 api 和 gridId 的模块配置。
     * @returns {Promise<object[]>} 公共 Grid 标准列定义；后台无配置时返回空数组。
     * @sideEffect 只发起读取请求，真正写入 columns Map 由调用方负责。
     */
    async function referenceDataResolveColumns(module) {
        // 唯一公共 Grid 通过 ReferenceDataTable.code 定位，业务表名由后台映射为元素 viewCode。
        const tableRecord = referenceDataGridTable();
        // URLSearchParams 负责正确编码表格 code 和语言值，避免手工拼接特殊字符。
        const queryParams = new URLSearchParams({
            // tableCode 明确定位唯一 Grid；元素自己的 viewCode 只表达 TYPE、TREE 等业务视图。
            tableCode: tableRecord?.code || "notConfigured",
            locale: referenceDataLocale
        });
        // 所有业务表格统一调用继承自 BaseController 的 getGridColumn；后台负责配置优先和字段名静默降级。
        const result = await selAjax.request({
            url: `${module.api}getGridColumn.htm?${queryParams}`
        });
        // 后台没有登记 columns 时返回空数组，让 Grid 使用明确空列状态而不是抛类型错误。
        return Array.isArray(result.data?.columns) ? result.data.columns : [];
    }

    /**
     * 生成当前模块操作列的动作定义。
     *
     * @param {object} module 当前模块配置。
     * @returns {object[]} 编辑、可选预览、启停和删除动作。
     * @sideEffect 无；动作随最终列数组一起在外层冻结。
     */
    function referenceDataBuildColumnActions(module) {
        // 所有模块第一项固定为编辑，label 带业务实体名用于鼠标 Tip 和辅助技术朗读。
        const actions = [{ id: "edit", label: `编辑${module.itemName}`, icon: "ri-edit-line" }];
        // 只有具备独立展示形态的模块才提供预览，普通数据类型不显示无意义的眼睛图标。
        if (["tables", "tree"].includes(module.key)) {
            actions.push({
                id: "preview",
                label: module.key === "tables" ? "打开表格配置" : `预览${module.itemName}`,
                icon: "ri-eye-line"
            });
        }
        // 启停与删除对六表模块都成立，因此统一追加在可选预览动作之后。
        actions.push({
            id: "toggle",
            // 已启用记录提供停用动作，已停用记录提供启用动作，图标和 Tip 都描述点击后的结果。
            label: (record) => Number(record.status) === 1 ? "停用" : "启用",
            icon: (record) => Number(record.status) === 1 ? "ri-forbid-2-line" : "ri-checkbox-circle-line"
        }, {
            // danger 告诉公共 Grid 使用危险色，但真正删除仍必须经过 ConfirmDialog。
            id: "delete", label: `删除${module.itemName}`, icon: "ri-delete-bin-6-line", tone: "danger"
        });
        // 返回普通数组，外层 enrichColumns 会连同全部列配置一起深度冻结。
        return actions;
    }

    /**
     * 把一列后台配置转换成公共 Grid 的最终列定义。
     *
     * @param {object} module 当前业务模块。
     * @param {object} column 一条 getGridColumn 返回值。
     * @returns {object} 已补充渲染语义的列配置。
     * @sideEffect 无；不修改传入的后台对象。
     */
    function referenceDataEnrichColumn(module, column) {
        // 复制后台列，避免增加 nowrap 等显示属性时污染原始响应缓存。
        const baseColumn = { ...column, nowrap: column.renderer === "time" };
        // 状态数字在应用边界转换为 Grid 认识的颜色语义。
        if (column.renderer === "badge") {
            // toneMap 把数据库状态值映射为公共 badge 的视觉语义，不在应用中生成徽标 DOM。
            return { ...baseColumn, labelSource: "status", toneMap: { "1": "enabled", "2": "disabled", "0": "disabled" } };
        }
        // 布尔字段只提供业务文案，具体图形仍由公共 Grid 渲染。
        if (column.renderer === "boolean") return { ...baseColumn, trueLabel: "是", falseLabel: "否" };
        // 操作列需要根据模块能力注入动作数组，普通数据列保持后台配置不变。
        if (column.renderer === "actions") {
            return { ...baseColumn, actions: referenceDataBuildColumnActions(module) };
        }
        // 文本、堆叠和时间列无需额外业务语义，返回已复制的基础列即可。
        return baseColumn;
    }

    /**
     * 把后台通用表头补充为管理工作台需要的最终 Grid 列定义。
     *
     * @param {object} module 当前模块，用来生成记录级动作名称和预览能力。
     * @param {object[]} columns getGridColumn 返回的原始列数组。
     * @returns {ReadonlyArray<object>} 带操作列、状态色、布尔文案和时间不换行规则的只读列数组。
     * @sideEffect 无；先复制数组，不修改后台响应对象。
     */
    function referenceDataEnrichColumns(module, columns) {
        // 先复制数组，后续补充操作列不会改变 columns Map 中保存的后台原始结果。
        const source = [...columns];
        // 配置缺少操作列时补充管理入口，字段名降级状态下仍可完成 CRUD。
        if (!source.some((column) => column.renderer === "actions")) {
            source.push({ id: "__actions", field: "id", label: "操作", renderer: "actions", width: "132px" });
        }
        // 每列分别补充渲染语义，再冻结整个数组防止 Grid 或调用方反向修改配置。
        return selFreeze(source.map((column) => referenceDataEnrichColumn(module, column)));
    }

    /**
     * 生成人能够识别的记录名称，供树节点、确认框目标和父级下拉共同复用。
     *
     * @param {object} module 记录所属模块。
     * @param {object} record 一条后台业务记录。
     * @returns {string} 优先使用稳定业务坐标，最后才回退到数据库 id。
     * @sideEffect 无。
     */
    function referenceDataRecordLabel(module, record) {
        // 数据类型先显示实际值，再显示多语言名称和所属控件，避免多个菜单的同名选项混淆。
        if (module.key === "types") return `${record.valueCode} · ${record.nameZh || record.code} · ${record.optionSetCode}`;
        // 表格定义用“项目 · 表名”组合，删除确认时可以直接识别目标。
        if (module.key === "tables") return `${record.projectCode} · ${record.gridId || record.nameZh}`;
        // 页面控件直接展示唯一 code 和控件种类，方便管理员复制后定位数据库记录。
        if (module.key === "controls") return `${record.code} · ${record.controlKind}`;
        // Window 直接展示唯一 code 和中文名称。
        if (module.key === "windows") return `${record.code} · ${record.nameZh}`;
        // 表格列先展示父表，再展示中文表头；中文为空时回退到稳定列 ID。
        if (module.key === "columns") return `${record.viewCode} · ${record.labelZh || record.fieldName || record.code}`;
        // 其他模块优先中文标签，再使用模块代表字段，最后才显示数据库主键。
        return String(record.labelZh || record[module.previewField] || record.id);
    }

    /**
     * 在 Grid 底部反馈区展示非阻断操作进度或结果。
     *
     * @param {*} message 将被安全转换成文字的提示内容。
     * @returns {void}
     * @sideEffect 只写 textContent，不创建弹窗，也不会把后台文字解释为 HTML。
     */
    function referenceDataSetFeedback(message) {
        // 反馈宿主由公共 Grid 创建；可选链允许启动早期或详情切换期间安全调用。
        const feedback = referenceDataState.panelRoot?.querySelector('[data-sel-grid-role="feedback"]');
        // textContent 确保后台异常信息只按纯文本显示，不会被解释成页面标签。
        if (feedback) feedback.textContent = String(message || "");
    }

    /**
     * 递归把 parentId 业务记录转换为公共 Tree 的标准 children 结构。
     *
     * @param {object} module 树节点或菜单模块配置。
     * @param {object[]} records 当前模块全部有效记录。
     * @param {number|null} parentId 当前递归层的父记录 id，null 表示根层。
     * @returns {object[]} 带节点 id、名称、数量、右键动作和 children 的 Tree 输入。
     * @sideEffect 无；递归结果只用于构建本次 Payload。
     */
    function referenceDataBuildHierarchy(module, records, parentId = null) {
        // 每一层只选择 parentId 等于当前父节点的记录，然后递归生成其 children。
        return records
            .filter((record) => String(record.parentId || "") === String(parentId || ""))
            .map((record) => ({
                // record-模块-id 既防止六张表主键冲突，也能被事件解析函数稳定还原。
                id: `record-${module.key}-${record.id}`,
                // label 与 icon 都来自业务注册表和统一记录名称函数。
                label: referenceDataRecordLabel(module, record),
                icon: module.icon,
                // count 只统计直接子项，用于树节点右侧数量提示。
                count: records.filter((child) => String(child.parentId || "") === String(record.id)).length,
                // filter 保留公共 Tree 的标准字段，本页当前不追加额外筛选条件。
                filter: {},
                // 右键动作只声明语义；事件最终仍进入统一编辑或删除处理器。
                contextActions: [
                    { id: "edit", label: "编辑", icon: "ri-edit-line" },
                    { id: "delete", label: "删除", icon: "ri-delete-bin-6-line", danger: true }
                ],
                // 以当前记录 id 作为下一层 parentId，直到没有子记录时自然返回空数组。
                children: referenceDataBuildHierarchy(module, records, record.id)
            }));
    }

    /**
     * 为一个一级业务模块生成 Tree 子节点。
     *
     * @param {object} module 要展示的模块配置。
     * @returns {ReadonlyArray<object>} 树节点模块返回层级树；其他一级模块不生成记录子节点。
     * @sideEffect 无；只读取 records 缓存。
     */
    function referenceDataBuildTreeChildren(module) {
        // 左树只从已加载缓存读取，不在渲染过程中隐式触发网络请求。
        const records = referenceDataState.records.get(module.key) || [];
        // 数据类型、表格定义、页面控件和 Window 只作为一级入口；真实记录统一在右侧 Grid 或管理窗口查看。
        if (["types", "tables", "controls", "windows"].includes(module.key)) return [];
        // relation 模块使用递归结构；普通模块把每条记录作为一级叶子。
        if (module.relation) return referenceDataBuildHierarchy(module, records);
        // 平铺叶子仍使用与层级节点相同的稳定 ID 和右键动作协议。
        return records.map((record) => ({
            id: `record-${module.key}-${record.id}`,
            label: referenceDataRecordLabel(module, record),
            icon: module.icon,
            count: 0,
            filter: {},
            contextActions: [
                { id: "edit", label: "编辑", icon: "ri-edit-line" },
                { id: "delete", label: "删除", icon: "ri-delete-bin-6-line", danger: true }
            ]
        }));
    }

    /**
     * 为工具栏“数据范围”下拉生成与当前模块相匹配的业务选项。
     *
     * @param {object} module 当前模块配置。
     * @param {object[]} records 当前 Grid 实际显示范围内的记录。
     * @returns {object[]} 公共 Dropdown 标准 option 数组，每项至少包含 value、label 和 icon。
     * @sideEffect 无；不同模块使用不同稳定字段作为筛选 value。
     */
    function referenceDataBuildTypeOptions(module, records) {
        // 树节点已经与类型目录解耦，范围筛选直接列出当前表中的根节点。
        if (module.key === "tree") {
            return records.filter((record) => record.parentId == null).map((record) => ({
                value: String(record.code),
                label: String(record.labelZh || record.code),
                icon: "ri-node-tree",
                description: String(record.code)
            }));
        }
        // 表格元素模块按已登记父表筛选，value 必须与元素记录 tableId 一致。
        if (module.key === "columns") {
            return (referenceDataState.records.get("tables") || []).map((tableRecord) => ({
                value: String(tableRecord.id),
                label: String(tableRecord.nameZh || tableRecord.gridId),
                icon: "ri-table-line",
                description: String(tableRecord.code)
            }));
        }
        // 表格定义模块使用唯一 code 作为筛选值，同时显示真实业务表名。
        if (module.key === "tables") {
            return records.map((record) => ({
                value: String(record.code),
                label: String(record.nameZh || record.gridId),
                icon: module.icon,
                description: String(record.projectCode || "")
            }));
        }
        // 数据类型模块按当前控件的业务值筛选，描述补充所属控件 code。
        if (module.key === "types") {
            return records.map((record) => ({
                value: String(record.valueCode),
                label: String(record.nameZh || record.valueCode),
                icon: "ri-database-2-line",
                description: String(record.optionSetCode || "")
            }));
        }
        // 页面控件按自身 controlKind 过滤，不再依赖已删除的 typeId 反向关系。
        if (module.key === "controls") {
            // 远程分页不能从当前页推断完整选项，使用保存表单同一稳定白名单。
            return ["PAGE", "TOOLBAR", "SEARCH", "FILTER", "BUTTON", "TEXT", "SELECT", "NUMBER", "TEXTAREA"]
                .map((controlKind) => ({
                value: controlKind, label: controlKind, icon: module.icon, description: "控件类型"
            }));
        }
        // Window 按自身定位模式过滤；其他模块没有额外类型关系。
        if (module.key === "windows") {
            return [...new Set(records.map((record) => String(record.positionMode)))].map((positionMode) => ({
                value: positionMode, label: positionMode, icon: module.icon, description: "定位模式"
            }));
        }
        return [];
    }

    /**
     * 返回 Grid type-filter 应读取的记录字段名。
     *
     * @param {object} module 当前模块。
     * @returns {string} 与 referenceDataBuildTypeOptions() 中 option.value 对应的字段。
     * @sideEffect 无。
     */
    function referenceDataTypeField(module) {
        // 每个 return 都必须与上方 BuildTypeOptions 生成的 value 字段完全一致。
        if (module.key === "types") return "valueCode";
        if (module.key === "tree") return "treeRootCode";
        if (module.key === "tables") return "code";
        if (module.key === "columns") return "tableId";
        if (module.key === "controls") return "controlKind";
        if (module.key === "windows") return "positionMode";
        return "code";
    }

    /**
     * 为一条树节点记录解析所属根节点 code，仅生成前端筛选辅助值。
     *
     * @param {object[]} records 当前树表全部记录。
     * @param {object} record 要解析的节点记录。
     * @returns {string} 根节点 code；关系损坏时返回当前节点 code。
     * @sideEffect 无；不修改数据库记录或输入数组。
     */
    function referenceDataTreeRootCode(records, record) {
        // parentById 只在本次解析中建立，code 与 parentId 仍是唯一树关系事实。
        const byId = new Map(records.map((candidate) => [Number(candidate.id), candidate]));
        const visited = new Set();
        let current = record;
        // 沿 parentId 向上查到根；循环或断链时安全停止，避免页面卡死。
        while (current?.parentId != null && !visited.has(Number(current.id))) {
            visited.add(Number(current.id));
            current = byId.get(Number(current.parentId)) || current;
            if (Number(current.id) === Number(record.id) && visited.size > 1) break;
        }
        return String(current?.code || record.code || "");
    }

    /** 计算一次 Payload 组装需要的业务上下文，避免各配置段重复读取状态。 */
    function referenceDataBuildPayloadContext() {
        // 当前模块是本次 Payload 中所有标题、字段和动作的共同来源。
        const module = referenceDataActiveModule();
        // allRecords 保留配置与编辑所需完整缓存；远程模块的 Grid records 只取后台当前页。
        const allRecords = referenceDataState.records.get(module.key) || [];
        const remotePage = referenceDataState.remotePages.get(module.key) || null;
        // 列详情只展示选中表格的配置，其他模块使用完整缓存。
        let records = module.key === "controls" && remotePage
            ? remotePage.records
            : module.key === "columns" && referenceDataState.selectedTable
            ? allRecords.filter((record) => Number(record.tableId) === Number(referenceDataState.selectedTable.id))
            : allRecords;
        // 树范围筛选使用临时根 code，不把派生字段复制回数据库缓存。
        if (module.key === "tree") {
            records = allRecords.map((record) => ({
                ...record,
                treeRootCode: referenceDataTreeRootCode(allRecords, record)
            }));
        }
        // 导航只采用后台授权并已映射成功的模块顺序。
        const navigationModules = referenceDataNavigationModules();
        // 表格定义记录提供当前模块唯一 code，编辑态表格头和页面编辑数据库坐标共用这一事实来源。
        const tableRecord = referenceDataGridTable();
        // 每个一级模块都显示当前缓存数量；只有树节点模块按需生成业务子节点。
        const treeItems = navigationModules.map((navigationModule) => ({
            id: `module-${navigationModule.key}`,
            label: navigationModule.name,
            icon: navigationModule.icon,
            // 导航徽标始终表示模块全量，不随当前分页查询条件变化。
            count: (referenceDataState.records.get(navigationModule.key) || []).length,
            filter: {},
            children: referenceDataBuildTreeChildren(navigationModule)
        }));
        // 把一次组装反复使用的派生值集中返回，后续函数不再重复扫描缓存。
        return {
            module, records, allRecords, remotePage, navigationModules, treeItems, tableRecord,
            // columns 是可直接交给 Grid 的最终只读列；typeOptions 是工具栏下拉输入。
            columns: referenceDataEnrichColumns(module, referenceDataState.columns.get(module.key) || []),
            typeOptions: referenceDataBuildTypeOptions(module, records),
            // 状态数量只计算 1/2，逻辑删除的 0 已在加载边界排除。
            enabledCount: allRecords.filter((record) => Number(record.status) === 1).length,
            disabledCount: allRecords.filter((record) => Number(record.status) === 2).length
        };
    }

    /** 为 Panel 标题区生成当前模块名称、状态数量和操作文案。 */
    function referenceDataBuildTitlePayload(context) {
        // 解构只取标题区需要的数据，避免函数内部反复写 context 前缀。
        const { module, records, allRecords, remotePage, enabledCount, disabledCount } = context;
        // selectedTable 存在表示用户已经进入某张表的列配置详情。
        const selectedTable = referenceDataState.selectedTable;
        // 返回普通对象，由最外层 BuildPayload 统一深度冻结。
        return {
            // 主标题保持稳定，副标题和描述随模块或选中表格切换。
            title: "引用数据管理工作台",
            subtitle: selectedTable ? `表格定义 · ${selectedTable.description || selectedTable.nameZh || selectedTable.gridId}` : `${module.name} · ${module.tableName}`,
            description: selectedTable ? `${selectedTable.projectCode} / ${selectedTable.code}` : module.description,
            // ariaLabel/ariaLabels 为 Panel 各区域提供可访问名称，不参与视觉文案布局。
            ariaLabel: "引用数据六模块按需加载管理面板",
            ariaLabels: {
                statusTabs: `${module.name}状态筛选`, headerActions: `${module.name}快捷操作`,
                toolbar: `${module.name}筛选工具栏`, sidebar: "业务模块导航",
                content: `${module.name}内容区`, board: `${module.name}表格`, pagination: `${module.name}分页`
            },
            // 状态标签数量来自当前 records，点击后由公共 Grid 根据 statusField 过滤。
            statusTabs: [
                { value: "", label: "全部", count: module.key === "controls" && remotePage ? remotePage.totalCount : allRecords.length },
                { value: "1", label: "已启用", count: enabledCount },
                { value: "2", label: "已停用", count: disabledCount }
            ],
            // 顶部只保留当前模块新增入口，行级编辑和删除由操作列负责。
            actions: [{ id: "new", label: `新增${module.itemName}`, icon: "ri-add-line", primary: true }],
            // resetLabel 交给公共 Panel 生成筛选重置按钮。
            resetLabel: "重置",
            // messages 是 Panel 通用行为文案；包含占位符的文本由公共组件在运行时替换。
            messages: {
                selectProject: "选择数据", viewProject: "查看数据", editProject: "编辑数据", moreActions: "更多操作",
                filtersReset: "筛选条件已重置", treePrefix: "业务模块", expandLeftRegion: "展开业务模块",
                collapseLeftRegion: "收起业务模块", filterActivated: "筛选工具栏已激活",
                newOpened: `已打开新增${module.itemName}窗口`, exportPreparing: "正在准备导出",
                dateRange: "日期范围：{start} 至 {end}", movePrefix: "移动到"
            }
        };
    }

    /** 为工具栏三个下拉控件生成与当前模块匹配的筛选选项。 */
    function referenceDataBuildSelectPayload(context) {
        // 当前模块决定数据范围下拉的语义，typeOptions 已在上下文中预先计算。
        const { module, typeOptions } = context;
        // 三个键必须与 referenceDataLayout 中的 payload 路径一致。
        return {
            // projectType 名称沿用公共 Grid 协议；树按根节点、控件按所属数据类型过滤。
            projectType: {
                gridId: referenceDataGridId, role: "type-filter", label: module.key === "tree" ? "根节点" : module.key === "controls" ? "数据类型" : "数据范围",
                ariaLabel: module.key === "tree" ? "按根节点筛选树" : module.key === "controls" ? "按所属数据类型筛选记录" : "按数据范围筛选",
                currentTemplate: "{label}，当前：{value}", menuTitle: module.key === "tree" ? "选择树根节点" : module.key === "controls" ? "选择引用数据类型" : "选择数据范围",
                prefix: module.key === "tree" ? "根：" : module.key === "controls" ? "类型：" : "范围：", scrollAfter: 8,
                // 空 value 表示取消类型过滤，后续业务选项保持 BuildTypeOptions 的稳定值。
                options: [{ value: "", label: module.key === "tree" ? "全部树" : module.key === "controls" ? "全部类型" : "全部数据", icon: "ri-apps-2-line", description: "显示当前模块全部记录" }, ...typeOptions]
            },
            // status 始终使用数据库 status 字段，六表模块共享同一取值契约。
            status: {
                gridId: referenceDataGridId, role: "status-filter", label: "数据状态", ariaLabel: "按状态筛选",
                currentTemplate: "{label}，当前：{value}", menuTitle: "选择数据状态", prefix: "状态：", scrollAfter: 6,
                // 空值展示全部；1/2 分别与启用和停用状态对应。
                options: [
                    { value: "", label: "全部状态", icon: "ri-apps-2-line", description: "显示全部记录" },
                    { value: "1", label: "已启用", icon: "ri-checkbox-circle-line", tone: "done", description: "当前可以使用" },
                    { value: "2", label: "已停用", icon: "ri-forbid-2-line", tone: "muted", description: "当前暂停使用" }
                ]
            },
            // pageSize 在 REMOTE 模式下请求后台当前页，其他模块继续使用浏览器端分页。
            pageSize: {
                gridId: referenceDataGridId, role: "page-size", label: "每页显示条数", ariaLabel: "每页显示条数",
                currentTemplate: "{label}，当前：{value}", menuTitle: "选择每页显示条数", scrollAfter: 4,
                // 20 条是页面默认值，必须与 BuildPayload.pagination.pageSize 保持一致。
                options: [
                    { value: "10", label: "10 条/页", icon: "ri-list-check-3" },
                    { value: "20", label: "20 条/页", icon: "ri-list-check-3", selected: true },
                    { value: "50", label: "50 条/页", icon: "ri-list-check-3" }
                ]
            }
        };
    }

    /** 把业务缓存组装成 Panel、Grid、Tree、Search、Dropdown 和 Pagination 共用的只读 Payload。 */
    function referenceDataBuildPayload() {
        // 先计算共享上下文，再分别委托标题和下拉构建函数，避免一个巨型函数承担全部细节。
        const context = referenceDataBuildPayloadContext();
        // 这里只解构 Grid、Tree 和分页直接使用的字段。
        const { module, records, remotePage, navigationModules, treeItems, columns, tableRecord } = context;
        // selFreeze 让各公共组件只能读取视图，不能改写业务缓存。
        return selFreeze({
            // grid 段定义字段坐标和通用交互能力，不包含任何具体记录。
            grid: {
                mode: "records", idField: "id", typeField: referenceDataTypeField(module), statusField: "status",
                searchFields: module.searchFields, wide: true, defaultColumnWidth: 150, columnResize: true,
                deferToolbarFiltersUntilSubmit: true
            },
            // data.items 复制当前记录数组；selectedIds 为空表示模块切换后不保留旧选择。
            data: { items: [...records], selectedIds: [] },
            // column 段定义表格实例、空状态和数据库驱动表头。
            column: {
                gridId: referenceDataGridId, ariaLabel: `${module.name}数据表格`,
                tableTitle: `${module.name}表格`, tableCode: tableRecord?.code || "尚未登记",
                emptyText: referenceDataState.loadedKeys.has(module.key) ? `没有符合当前条件的${module.name}记录` : `正在加载${module.name}…`,
                items: columns
            },
            // title 与 select 使用独立构建函数，使主聚合结构保持可扫描。
            title: referenceDataBuildTitlePayload(context),
            // search 只声明交互契约；输入监听、清空和回车提交由公共 Search/Grid 完成。
            search: {
                gridId: referenceDataGridId, label: `${module.name}搜索`,
                placeholder: module.searchPlaceholder, buttonLabel: "查询", clearLabel: "清空搜索条件",
                icon: "ri-search-line", buttonIcon: "ri-search-line", clearIcon: "ri-close-line",
                defaultValue: "", fields: module.queryFields || undefined,
                clearable: true, submitOnEnter: true, submitOnClear: true, allowEmpty: true, trim: true
            },
            // tree 既承担一级模块导航，也可展示模块业务记录子节点。
            tree: {
                gridId: referenceDataGridId, ariaLabel: "业务模块导航", heading: "业务模块",
                summary: `${navigationModules.length} 个一级模块`, expandLabelTemplate: "展开{label}", collapseLabelTemplate: "收起{label}",
                contextMenuLabelTemplate: "{label}操作", selectedId: `module-${module.key === "columns" ? "tables" : module.key}`,
                items: treeItems
            },
            // menu 是 Grid 操作列的可访问上下文，不等同于菜单项目业务模块。
            menu: { gridId: referenceDataGridId, ariaLabel: `${module.name}行操作` },
            // REMOTE 使用后台 totalCount，LOCAL 使用当前详情 records 数量。
            pagination: {
                gridId: referenceDataGridId,
                mode: module.key === "controls" ? "REMOTE" : "LOCAL",
                currentPage: remotePage?.pageNo || 1,
                pageSize: remotePage?.pageSize || 20,
                totalCount: remotePage?.totalCount ?? records.length,
                summaryAll: "共 {total} 条", summaryFiltered: "当前 {visible} 条 · 共 {total} 条",
                previousLabel: "上一页", nextLabel: "下一页", pageChangedMessage: "已切换到第 {page} 页",
                pageSizeChangedMessage: `每页显示 {size} 条${module.itemName}`
            },
            // select 放在最后，供 Panel 内三个 Dropdown 按路径分别读取。
            select: referenceDataBuildSelectPayload(context)
        });
    }

    /**
     * 生成所有编辑 Window 共用的启停状态字段。
     *
     * @returns {object} selWindow select 字段定义，新增时默认选中 status=1。
     * @sideEffect 无。
     */
    function referenceDataStatusField() {
        // Window 会把 select value 按字符串提交，后台边界再转换为整数状态。
        return { name: "status", label: "状态", type: "select", required: true, options: [
            { value: "1", label: "启用", icon: "ri-checkbox-circle-line", tone: "done", selected: true },
            { value: "2", label: "停用", icon: "ri-forbid-2-line", tone: "muted" }
        ] };
    }

    /**
     * 生成把数据库布尔值编辑为“是/否”的通用 Window 字段。
     *
     * @param {string} name 提交给后台的字段名。
     * @param {string} label 用户看到的字段名称。
     * @param {boolean} defaultTrue 新增记录是否默认选择“是”。
     * @returns {object} selWindow select 字段定义，value 使用字符串供表单序列化。
     * @sideEffect 无。
     */
    function referenceDataBooleanField(name, label, defaultTrue = false) {
        // name/label 由调用方决定，统一的两项 options 保证所有布尔字段交互一致。
        return { name: name, label: label, type: "select", required: true, options: [
            { value: "false", label: "否", icon: "ri-checkbox-blank-circle-line", selected: !defaultTrue },
            { value: "true", label: "是", icon: "ri-checkbox-circle-line", tone: "done", selected: defaultTrue }
        ] };
    }

    /**
     * 生成树节点的父级选择字段，并排除正在编辑的记录自身。
     *
     * @param {object} module tree 模块配置。
     * @param {object|null} record 正在编辑的记录；新增时为 null。
     * @returns {object} 以空值表示顶级的 selWindow select 字段。
     * @sideEffect 无；当前实现只阻止直接选择自身，后台仍负责最终层级合法性校验。
     */
    function referenceDataParentSelectField(module, record) {
        // 编辑时排除自身，防止最直接的 parentId 自引用；更深层环仍由后台校验。
        const records = (referenceDataState.records.get(module.key) || [])
            .filter((candidate) => Number(candidate.id) !== Number(record?.id));
        // 空字符串代表顶级，Window 提交时后台会规范化为 null。
        return {
            name: "parentId", label: module.key === "tree" ? "父节点" : "父菜单", type: "select",
            options: [
                { value: "", label: "无（顶级）", icon: "ri-subtract-line", selected: true },
                ...records.map((candidate) => ({
                    value: String(candidate.id),
                    label: referenceDataRecordLabel(module, candidate),
                    icon: module.icon
                }))
            ]
        };
    }

    /** 创建普通文本字段，统一图标、长度和必填契约。 */
    function referenceDataTextField(name, label, required = false, placeholder = "", maxLength = 200) {
        // 使用属性简写把调用参数原样变成 selWindow 的 text 字段定义。
        return { name, label, type: "text", required, placeholder, maxLength, icon: "ri-edit-box-line" };
    }

    /** 创建多行文本字段，数据库说明和 JSON 扩展字段共用同一形状。 */
    function referenceDataTextareaField(name, label, placeholder = "") {
        // 多行字段统一限制 1000 字符，避免说明或 JSON 在浏览器端无限增长。
        return { name, label, type: "textarea", placeholder, maxLength: 1000, icon: "ri-file-text-line" };
    }

    /** 创建所有引用数据实体共用的业务排序字段。 */
    function referenceDataSortField() {
        // 新记录默认排序为 0；后台仍负责最终数值校验和持久化。
        return { name: "sortnum", label: "排序值", type: "number", value: "0", icon: "ri-sort-number-asc" };
    }

    /** 生成数据类型编辑字段；留空时创建新选项组，填写已有 code 时复用同一组选项。 */
    function referenceDataBuildTypeWindowRows(record = null) {
        const types = (referenceDataState.records.get("types") || [])
            .filter((type) => String(type.code) !== String(record?.code));
        return [
            [referenceDataTextField("optionSetCode", "选项组 Code", false, "新增时留空自动发号；复用时填写已有 optionSetCode", 100),
                referenceDataTextField("valueCode", "类型值 Code", true, "例如 ENABLED", 100)],
            [{ name: "parentTypeCode", label: "上级类型", type: "select", required: false,
                options: [
                    { value: "", label: "无（顶级）", icon: "ri-subtract-line", selected: true },
                    ...types.map((type) => ({
                        value: String(type.code),
                        label: `${type.valueCode} · ${type.nameZh || type.code} · ${type.optionSetCode}`,
                        icon: "ri-node-tree"
                    }))
                ] }, referenceDataTextField("nameZh", "中文名称", true)],
            // 多语言名称使用稳定顺序，便于不同类型快速连续录入。
            [referenceDataTextField("nameJa", "日文名称"), referenceDataTextField("nameEn", "英文名称")],
            // 类型值只保存选项组、父级、多语言名称和公共管理状态。
            [referenceDataStatusField(), referenceDataSortField()]
        ];
    }

    /** 生成树节点编辑字段，并排除当前记录自身作为父级。 */
    function referenceDataBuildTreeWindowRows(module, record) {
        return [
            // 工程和页面只说明节点归属，树关系仍只由 code 与 parentId 决定。
            [referenceDataTextField("projectCode", "所属项目", true, "例如 reference-data", 64),
                referenceDataTextField("pageCode", "页面 Code", true, "例如 page101017", 100)],
            // parentId 是树表唯一层级关系；根节点保持为空。
            [referenceDataParentSelectField(module, record), referenceDataTextField("nodeValue", "节点值", true, "例如 READING")],
            // 三种语言标签按中文必填、日英可选的顺序排列。
            [referenceDataTextField("labelZh", "中文名称", true), referenceDataTextField("labelJa", "日文名称")],
            [referenceDataTextField("labelEn", "英文名称"), referenceDataStatusField()],
            // sortnum 只决定同级节点顺序，不承载额外业务扩展。
            [referenceDataSortField()]
        ];
    }


    /** 生成页面控件布局编辑字段；code 只由后台生成，不进入表单。 */
    function referenceDataBuildControlWindowRows() {
        return [
            [referenceDataTextField("projectCode", "所属项目", true, "例如 reference-data", 64), referenceDataTextField("pageCode", "页面 Code", true, "例如 page101090", 100)],
            [{
                name: "parentKind", label: "父容器类型", type: "select", required: false,
                options: ["PAGE", "PANEL", "TOOLBAR", "CONTROL"]
                    .map((value, index) => ({ value, label: value, icon: "ri-node-tree", selected: index === 0 }))
            }, referenceDataTextField("parentCode", "父容器 Code", false, "页面直属控件可留空", 100)],
            [{
                name: "controlKind", label: "控件类型", type: "select", required: true,
                options: ["PAGE", "TOOLBAR", "GRID", "SEARCH", "FILTER", "BUTTON", "PANEL", "SPLIT_PANE", "TREE", "DROPDOWN", "WINDOW_TRIGGER", "TEXT", "SELECT", "NUMBER", "TEXTAREA"]
                    .map((value, index) => ({ value, label: value, icon: "ri-layout-grid-line", selected: index === 0 }))
            }, { name: "layoutMode", label: "布局模式", type: "select", required: true, options: ["FLOW", "GRID", "ABSOLUTE"].map((value, index) => ({ value, label: value, icon: "ri-layout-line", selected: index === 0 })) }],
            [referenceDataTextField("fieldName", "字段 / 动作名", false, "页面控件填写稳定字段名", 100),
                referenceDataTextField("optionSetCode", "选项组 Code", false, "不需要选项时留空", 100)],
            [referenceDataTextField("breakpoint", "布局档位", true, "DESKTOP", 16)],
            [referenceDataTextField("width", "宽度", false, "例如 320px", 32), referenceDataTextField("height", "高度", false, "例如 48px", 32)],
            [{ name: "x", label: "横向位置", type: "number", required: false }, { name: "y", label: "纵向位置", type: "number", required: false }],
            [referenceDataBooleanField("wrap", "允许换行", true), referenceDataStatusField()],
            [referenceDataSortField()]
        ];
    }

    /** 生成 SEL Window 配置编辑字段。 */
    function referenceDataBuildWindowConfigRows() {
        return [
            [referenceDataTextField("projectCode", "所属项目", true, "例如 reference-data", 64), referenceDataTextField("pageCode", "页面 Code", true, "例如 page101090", 100)],
            [referenceDataTextField("nameZh", "中文名称", true), referenceDataTextField("triggerControlCode", "触发控件 Code", false, "可为空", 100)],
            [referenceDataTextField("width", "默认宽度", true, "例如 960px", 32), referenceDataTextField("height", "默认高度", true, "例如 680px", 32)],
            [referenceDataTextField("minWidth", "最小宽度", false, "例如 480px", 32), referenceDataTextField("minHeight", "最小高度", false, "例如 320px", 32)],
            [{ name: "positionMode", label: "定位模式", type: "select", required: true, options: [
                { value: "CENTER", label: "居中", icon: "ri-focus-3-line", selected: true },
                { value: "CUSTOM", label: "自定义", icon: "ri-drag-move-line" }
            ] }, referenceDataTextField("breakpoint", "布局档位", true, "DESKTOP", 16)],
            [referenceDataBooleanField("resizable", "允许缩放", true), referenceDataBooleanField("draggable", "允许拖动", true)],
            [referenceDataStatusField(), referenceDataSortField()]
        ];
    }

    /** 生成表格定义编辑字段；租户和操作员审计字段不进入前端表单。 */
    function referenceDataBuildTableWindowRows() {
        return [
            [referenceDataTextField("projectCode", "所属项目", true, "例如 reference-data", 64), referenceDataTextField("pageCode", "页面 Code", true, "例如 page101090", 100)],
            [referenceDataTextField("gridId", "Grid 实例 ID", true, "selGridReferenceDataManagementId", 100), referenceDataTextField("nameZh", "中文名称", true, "例如 引用数据管理表格", 200)],
            // 描述说明表格用途，status 控制整张表格定义是否参与配置查询。
            [referenceDataTextareaField("description", "表格描述"), referenceDataStatusField()],
            // 排序值决定“表格定义”模块中的展示顺序。
            [referenceDataSortField()]
        ];
    }

    /** 生成表格元素配置字段；列、工具栏动作和行操作统一归属 tableId。 */
    function referenceDataBuildColumnWindowRows() {
        return [
            // 父表只提交数据库主键；对外定位和诊断仍展示父表唯一 code。
            [{
                name: "tableId", label: "所属表格", type: "select", required: true,
                options: (referenceDataState.records.get("tables") || []).map((tableRecord) => ({
                    value: String(tableRecord.id), label: tableRecord.nameZh || tableRecord.gridId,
                    icon: "ri-table-line", description: tableRecord.code
                }))
            }, {
                name: "viewCode", label: "业务视图", type: "select", required: true, options: [
                    { value: "TYPE", label: "数据类型", icon: "ri-database-2-line" },
                    { value: "TREE", label: "树节点", icon: "ri-node-tree" },
                    { value: "CONTROL", label: "页面控件", icon: "ri-layout-grid-line" },
                    { value: "WINDOW", label: "Window", icon: "ri-window-line" },
                    { value: "TABLE", label: "表格定义", icon: "ri-table-line" },
                    { value: "TABLE_ELEMENT", label: "表格元素", icon: "ri-layout-column-line" }
                ]
            }],
            [{
                name: "elementType", label: "元素类型", type: "select", required: true, options: [
                    { value: "COLUMN", label: "表格列", icon: "ri-layout-column-line", selected: true },
                    { value: "TOOLBAR_ACTION", label: "工具栏操作", icon: "ri-layout-top-line" },
                    { value: "ROW_ACTION", label: "行操作", icon: "ri-more-2-fill" }
                ]
            }, referenceDataTextField("fieldName", "绑定字段", false, "例如 labelZh", 100)],
            // fieldName 是 Grid 的稳定字段 ID，第二字段只供 stack 等组合渲染使用。
            [referenceDataTextField("secondaryFieldName", "第二绑定字段", false, "仅组合渲染使用", 100)],
            [{
                name: "cellRenderer", label: "单元格渲染方式", type: "select", required: true, options: [
                    "text", "stack", "badge", "time", "boolean", "actions"
                ].map((renderer) => ({ value: renderer, label: renderer, icon: "ri-layout-column-line" }))
            }, referenceDataTextField("icon", "图标类名", false, "例如 ri-database-line", 100)],
            // 三种语言表头按中文必填、日英可选维护。
            [referenceDataTextField("labelZh", "中文表头", true), referenceDataTextField("labelJa", "日文表头")],
            // width 接受 px 或百分比；可缩放与显示状态分开控制。
            [referenceDataTextField("labelEn", "英文表头"), referenceDataTextField("width", "列宽", true, "例如 160px 或 18%", 32)],
            [referenceDataTextField("minWidth", "最小宽度", false, "例如 96px", 32), referenceDataTextField("maxWidth", "最大宽度", false, "例如 480px", 32)],
            [referenceDataBooleanField("visible", "页面显示", true), referenceDataBooleanField("resizable", "允许拖动", true)],
            [referenceDataTextareaField("attributesJson", "扩展属性 JSON"), referenceDataStatusField()],
            [referenceDataSortField()]
        ];
    }

    /**
     * 按业务模块选择对应的编辑表单字段集合。
     *
     * @param {object} module 决定字段契约的模块配置。
     * @param {object|null} record 编辑记录，用于排除自身父级；新增时为 null。
     * @returns {ReadonlyArray<ReadonlyArray<object>>} selWindow 二维 rows 输入。
     * @sideEffect 无；字段值由 Window reset()/setValues() 写入。
     */
    function referenceDataBuildWindowRows(module, record = null) {
        // code 和来源表始终占第一行：新增时说明自动生成，编辑时可直接复制定位数据库。
        const coordinateRow = [
            { name: "code", label: "唯一 Code", type: "text", readOnly: true, placeholder: "保存后由 Sequence 自动生成", icon: "ri-key-2-line" },
            { name: "sourceTable", label: "所在表", type: "text", readOnly: true, icon: "ri-table-line" }
        ];
        // 每个分支只选择业务字段契约，窗口标题和提交逻辑仍然复用统一实现。
        let businessRows;
        if (module.key === "types") businessRows = referenceDataBuildTypeWindowRows(record);
        else if (module.key === "tree") businessRows = referenceDataBuildTreeWindowRows(module, record);
        else if (module.key === "controls") businessRows = referenceDataBuildControlWindowRows();
        else if (module.key === "windows") businessRows = referenceDataBuildWindowConfigRows();
        else if (module.key === "tables") businessRows = referenceDataBuildTableWindowRows();
        else businessRows = referenceDataBuildColumnWindowRows();
        return [coordinateRow, ...businessRows];
    }

    /**
     * 组合某模块编辑 Window 的标题、按钮、校验提示和 rows 字段。
     *
     * @param {object} module 当前模块配置。
     * @param {boolean} editing true 表示编辑，false 表示新增。
     * @param {object|null} record 编辑时的原记录。
     * @returns {object} 可传给 windowComponent.mount() 或 controller.setLocale() 的完整配置。
     * @sideEffect 无。
     */
    function referenceDataBuildEditWindow(module, editing, record = null) {
        // freeze 防止 Window 控制器在渲染过程中改写下一次复用的字段配置。
        return selFreeze({
            // editing 同时决定标题、关闭辅助文案和提交按钮名称。
            title: `${editing ? "编辑" : "新增"}${module.itemName}`,
            subtitle: module.description,
            closeLabel: `关闭${editing ? "编辑" : "新增"}${module.itemName}窗口`,
            cancelLabel: "取消", submitLabel: editing ? "保存修改" : `保存${module.itemName}`,
            // autoSuccess=false 表示成功提示由真实后台结果决定，不能只因前端校验通过就显示成功。
            validationMessage: "请完成全部必填字段", autoSuccess: false,
            // rows 是当前模块专属字段二维布局。
            rows: referenceDataBuildWindowRows(module, record)
        });
    }

    /**
     * 确保某模块业务记录已经进入 records 缓存。
     *
     * @param {object} module 要加载的模块。
     * @param {boolean} force true 时忽略 loadedKeys 并强制刷新。
     * @returns {Promise<void>}
     * @sideEffect 成功后覆盖 records[moduleKey] 并把 key 加入 loadedKeys；失败时不标记已加载。
     */
    async function referenceDataEnsureModuleLoaded(module, force = false) {
        // 已加载且未要求强制刷新时直接复用缓存，模块切换不会重复请求。
        if (!force && referenceDataState.loadedKeys.has(module.key)) return;
        // 只有完整分页读取成功才覆盖旧 records，失败时不会留下半份数据。
        referenceDataState.records.set(module.key, await referenceDataLoadAllRecords(module));
        // 缓存成功后再登记 loadedKeys，避免失败请求被误认成“已加载空表”。
        referenceDataState.loadedKeys.add(module.key);
    }

    /**
     * 确保某模块的数据库表头已经进入 columns 缓存。
     *
     * @param {object} module 要解析表头的模块。
     * @param {boolean} force true 时重新调用 getGridColumn。
     * @returns {Promise<void>}
     * @sideEffect 成功后覆盖 columns[moduleKey]。
     */
    async function referenceDataLoadResolvedColumns(module, force = false) {
        // 表头缓存与记录缓存分离，因为列宽保存只需强制刷新表头。
        if (!force && referenceDataState.columns.has(module.key)) return;
        // 解析成功后以模块 key 保存后台原始列配置。
        referenceDataState.columns.set(module.key, await referenceDataResolveColumns(module));
    }

    /**
     * 并行准备一个模块完成显示所需的业务记录和表头。
     *
     * @param {object} module 目标模块。
     * @param {boolean} reloadRecords 是否强制刷新业务记录。
     * @param {boolean} reloadColumns 是否强制刷新表头配置。
     * @returns {Promise<void>} 两类数据都成功进入缓存后完成。
     * @sideEffect 更新 records、loadedKeys 和 columns 缓存，但不主动重绘页面。
     */
    async function referenceDataLoadModuleView(module, reloadRecords = false, reloadColumns = false) {
        // 数据记录与表头配置彼此独立，必须并行请求，避免每次切换模块串行等待两次接口。
        const dependencies = [
            referenceDataEnsureModuleLoaded(module, reloadRecords),
            referenceDataLoadResolvedColumns(module, reloadColumns)
        ];
        // 页面控件 Grid 额外读取后台当前页；完整 records 只服务页面配置和编辑坐标，不参与列表分页。
        if (module.key === "controls" && (reloadRecords || !referenceDataState.remotePages.has(module.key))) {
            dependencies.push(referenceDataLoadRemotePage(module, reloadRecords ? { pageNo: 1 } : {}));
        }
        // 等待业务数据、表头和必要关联数据同时就绪后再允许页面组装。
        await Promise.all(dependencies);
    }

    /** 创建带图标和文字的表格详情按钮，统一安全属性写入。 */
    function referenceDataCreateDetailButton(className, action, icon, label) {
        // element 创建应用拥有的按钮，并统一设置样式类和事件识别属性。
        const button = element("button", {
            className,
            attributes: { type: "button", "data-reference-data-detail-action": action }
        });
        // 图标对辅助技术隐藏，真正可访问名称来自旁边的文字 span。
        button.append(
            element("i", { className: icon, attributes: { "aria-hidden": "true" } }),
            element("span", { text: label })
        );
        // 返回完整按钮节点，由标题栏或空状态决定插入位置与点击行为。
        return button;
    }

    /** 创建详情标题栏，并把返回和编辑动作直接绑定到稳定按钮。 */
    function referenceDataCreateTableDetailHeader() {
        // header 是详情标题、数据库坐标和常用动作的共同容器。
        const header = element("header", { className: "reference-data-table-detail-header" });
        // 返回按钮始终回到表格定义列表。
        const backButton = referenceDataCreateDetailButton("reference-data-detail-back", "back", "ri-arrow-left-line", "返回表格定义");
        // copy 内的 strong/span 会在每次切换表格时写入最新文字。
        const copy = element("div", { className: "reference-data-table-detail-copy" });
        copy.append(
            element("strong", { attributes: { "data-reference-data-detail-title": "" } }),
            element("span", { attributes: { "data-reference-data-detail-coordinate": "" } })
        );
        // 编辑按钮复用 tables 模块 Window，而不是在详情页复制第二套表单。
        const editButton = referenceDataCreateDetailButton("reference-data-detail-edit", "edit-table", "ri-edit-line", "编辑基本信息");
        // 返回和编辑直接绑定固定业务动作，不依赖事件目标推断。
        backButton.addEventListener("click", referenceDataReturnToTableList);
        editButton.addEventListener("click", () => {
            if (referenceDataState.selectedTable) {
                referenceDataOpenEditor(referenceDataModules.tables, referenceDataState.selectedTable);
            }
        });
        // 固定顺序保证返回在左、标题在中、主操作在右。
        header.append(backButton, copy, editButton);
        // 返回已经绑定事件的完整标题栏。
        return header;
    }

    /** 创建表格详情三个页签，并把页签坐标交给统一切换函数。 */
    function referenceDataCreateTableDetailTabs() {
        // nav 使用 tablist 语义，三个按钮会在渲染时同步 selected 和 tabindex。
        const tabs = element("nav", {
            className: "reference-data-detail-tabs",
            attributes: { role: "tablist", "aria-label": "表格配置详情" }
        });
        // 数组第一项是内部坐标，第二项是用户看到的中文页签名。
        [["info", "基本信息"], ["columns", "表格列配置"], ["preview", "效果预览"]]
            .forEach(([tab, label]) => {
                // 每个 tab 都由公共 element 写安全文本、角色和 data 属性。
                const button = element("button", {
                    text: label,
                    attributes: { type: "button", role: "tab", "data-reference-data-detail-tab": tab }
                });
                // 点击只更新页签状态，内容统一交给 RenderTableDetail 重绘。
                button.addEventListener("click", () => referenceDataSetTableDetailTab(tab));
                // 按定义顺序追加，保证键盘顺序与视觉顺序一致。
                tabs.append(button);
            });
        // 返回已绑定切换事件的完整页签栏。
        return tabs;
    }

    /**
     * 创建或复用“表格定义详情”的应用专属外壳。
     *
     * @returns {HTMLElement|null} 详情 section；Panel 尚未创建或缺少 center 区域时返回 null。
     * @sideEffect 首次调用时创建固定详情 DOM、绑定返回/编辑/页签事件，并插入 Grid 前方。
     */
    function referenceDataEnsureTableDetailShell() {
        // 详情必须插入 Panel center；Panel 尚未挂载时不能提前创建孤立节点。
        const center = referenceDataState.panelRoot?.querySelector('[data-sel-panel-region="center"]');
        if (!center) return null;
        // 同一页面只允许一个详情外壳，重复渲染直接复用现有节点。
        const existing = center.querySelector("[data-reference-data-table-detail]");
        if (existing) return existing;
        // 详情只创建页面拥有的业务结构；节点创建、安全文本和属性写入统一交给 sel.core.element。
        const detail = element("section", {
            className: "reference-data-table-detail",
            attributes: { "data-reference-data-table-detail": "" }
        });
        // 标题栏、页签栏和两个需要应用自绘的内容面板一次性组成详情外壳。
        detail.append(
            referenceDataCreateTableDetailHeader(),
            referenceDataCreateTableDetailTabs(),
            // 基本信息面板由 RenderTableInfo 根据当前表格记录重建。
            element("section", {
                className: "reference-data-detail-content",
                attributes: { "data-reference-data-detail-content": "info" }
            }),
            // 效果预览面板只展示表头与绑定字段，不读取真实业务数据。
            element("section", {
                className: "reference-data-detail-content",
                attributes: { "data-reference-data-detail-content": "preview" }
            })
        );
        // Grid 画板是“表格列配置”页签本身；详情外壳应插在它前方。
        const gridBoard = center.querySelector(".selgrid-board-shell");
        // Grid 尚不存在时追加到 center 尾部，保持函数在初始化边界安全。
        center.insertBefore(detail, gridBoard || null);
        // 返回新建外壳，调用方随后写入当前表格数据和页签状态。
        return detail;
    }

    /**
     * 在详情“基本信息”页签渲染当前 ReferenceDataTable 的只读字段。
     *
     * @param {HTMLElement} host 基本信息内容宿主。
     * @param {object} tableRecord 当前选中的表格定义记录。
     * @returns {void}
     * @sideEffect 清空并重建宿主内容；全部数据库值通过 textContent 写入以阻止 HTML 注入。
     */
    function referenceDataRenderTableInfo(host, tableRecord) {
        // 每次重绘先清空上一张表内容，防止切换表格后残留旧字段。
        host.replaceChildren();
        // 展示字段与编辑表单分离：审计字段可以只读显示，但不会随保存请求回传。
        // fields 只描述显示顺序和值，下面统一生成 dt/dd，避免八段重复结构代码。
        const fields = [
            ["唯一 Code", tableRecord.code],
            ["所属项目", tableRecord.projectCode],
            ["Grid 实例 ID", tableRecord.gridId],
            ["页面 Code", tableRecord.pageCode],
            ["启停状态", Number(tableRecord.status) === 1 ? "已启用" : "已停用"],
            ["排序值", tableRecord.sortnum ?? 0],
            ["租户 ID", tableRecord.tenantId ?? 1],
            ["操作员 ID", tableRecord.lastOperateUserId ?? 1]
        ];
        // 表格用途说明单独放在字段网格之前，空值显示明确占位文字。
        const description = element("p", {
            className: "reference-data-detail-description",
            text: tableRecord.description || "暂无表格描述"
        });
        // dl/dt/dd 语义适合“字段名 → 字段值”的只读详情。
        const infoGrid = element("dl", { className: "reference-data-detail-info-grid" });
        fields.forEach(([label, value]) => {
            // 每个字段生成一个分组 div，便于 CSS 使用网格卡片排版。
            const item = element("div");
            // term 保存字段名，definition 保存纯文本数据库值。
            const term = element("dt", { text: label });
            const definition = element("dd", { text: value ?? "—" });
            // 先组装单项，再把单项加入整个说明列表。
            item.append(term, definition);
            infoGrid.append(item);
        });
        // 描述和字段列表一次性插入，减少中间页面重排。
        host.append(description, infoGrid);
    }

    /** 创建没有可见列时的业务空状态，并提供新增第一列入口。 */
    function referenceDataCreateTablePreviewEmptyState() {
        // 空状态根节点使用专用 class，由页面 CSS 提供居中和留白。
        const emptyState = element("div", { className: "reference-data-detail-empty" });
        // 图标只作视觉提示，strong 才是空状态的可读结论。
        emptyState.append(
            element("i", { className: "ri-layout-column-line", attributes: { "aria-hidden": "true" } }),
            element("strong", { text: "该表格尚未配置显示列" })
        );
        // 空状态直接提供新增第一列入口，避免用户不知道下一步去哪里操作。
        const addButton = element("button", {
            text: "新增第一列",
            attributes: { type: "button", "data-reference-data-detail-action": "add-column" }
        });
        // 先切到列配置页签，再打开 columns 新增窗口，保持背景上下文一致。
        addButton.addEventListener("click", () => {
            referenceDataSetTableDetailTab("columns");
            referenceDataOpenEditor(referenceDataModules.columns);
        });
        // 把动作按钮加入空状态，并返回完整节点。
        emptyState.append(addButton);
        return emptyState;
    }

    /** 按列配置生成只含表头名和绑定字段名的轻量预览表。 */
    function referenceDataCreateTablePreview(columns) {
        // 预览使用原生语义 table，但全部节点仍由 sel.core.element 创建。
        const tableElement = element("table", { className: "reference-data-detail-preview-table" });
        // thead 展示中文表头，tbody 唯一一行展示绑定字段名。
        const tableHead = element("thead");
        const headerRow = element("tr");
        const tableBody = element("tbody");
        const fieldRow = element("tr");
        columns.forEach((column) => {
            // 中文表头为空时回退稳定列 ID，预览永远不会出现无名列。
            const heading = element("th", { text: column.labelZh || column.fieldName || column.code });
            // width 使用数据库配置值，让预览与真实 Grid 宽度尽量一致。
            heading.style.width = String(column.width || "auto");
            // 第二行显示业务记录实际读取的字段，缺失时同样回退列 ID。
            const fieldCell = element("td", { text: column.fieldName || column.code });
            // 表头和字段单元格按同一 columns 顺序分别加入两行。
            headerRow.append(heading);
            fieldRow.append(fieldCell);
        });
        // 完成两行后再组装 table，避免循环中反复写入根节点。
        tableHead.append(headerRow);
        tableBody.append(fieldRow);
        tableElement.append(tableHead, tableBody);
        // 返回轻量预览表，不挂载 Grid 控制器也不加载真实数据。
        return tableElement;
    }

    /**
     * 用已加载的列配置绘制轻量表头预览，不加载真实业务数据。
     *
     * @param {HTMLElement} host 预览内容宿主。
     * @param {object} tableRecord 当前表格定义，提供唯一 id 与 code 坐标。
     * @returns {void}
     * @sideEffect 重建预览 DOM；无有效列时提供进入新增列表单的业务按钮。
     */
    function referenceDataRenderTablePreview(host, tableRecord) {
        // 清除上一张表预览，确保当前 host 只有一种状态：空状态或预览表。
        host.replaceChildren();
        // 预览只接受当前表格、启用且 visible=true 的列，并按数据库 sortnum 排列。
        const columns = (referenceDataState.records.get("columns") || [])
            .filter((column) => Number(column.tableId) === Number(tableRecord.id)
                && String(column.viewCode) === "TABLE"
                && Number(column.status) === 1 && Boolean(column.visible))
            .sort((left, right) => Number(left.sortnum) - Number(right.sortnum));
        // 没有可见列时显示引导；有列时绘制轻量 table。
        host.append(columns.length === 0
            ? referenceDataCreateTablePreviewEmptyState()
            : referenceDataCreateTablePreview(columns));
    }

    /**
     * 根据 selectedTable 和 tableDetailTab 同步详情外壳、公共 Grid 与三个页签的可见状态。
     *
     * @returns {void}
     * @sideEffect 选择为空时移除详情并恢复 Grid；选择存在时更新标题、坐标、ARIA 和当前页签内容。
     */
    function referenceDataRenderTableDetail() {
        // 公共 Grid 画板承担 columns 页签内容，因此先保存节点引用供后续显隐。
        const gridBoard = referenceDataState.panelRoot?.querySelector(".selgrid-board-shell");
        // 没有 selectedTable 表示当前应展示普通模块列表而不是详情。
        if (!referenceDataState.selectedTable) {
            // 同时清除根状态、移除应用详情外壳并恢复 Grid。
            referenceDataState.panelRoot?.removeAttribute("data-reference-data-detail-tab");
            referenceDataState.panelRoot?.querySelector("[data-reference-data-table-detail]")?.remove();
            if (gridBoard) gridBoard.hidden = false;
            return;
        }
        // 有表格上下文时创建或取得唯一详情外壳。
        const detail = referenceDataEnsureTableDetailShell();
        if (!detail) return;
        // 打开表格配置时默认落到 columns，让用户立即看到最常维护的表头数据。
        const tab = referenceDataState.tableDetailTab || "columns";
        // 根 data 属性供 CSS 判断当前是信息、列配置还是预览布局。
        referenceDataState.panelRoot.dataset.referenceDataDetailTab = tab;
        // 标题优先使用业务描述，没有描述时显示真实表名。
        detail.querySelector("[data-reference-data-detail-title]").textContent =
            String(referenceDataState.selectedTable.description || referenceDataState.selectedTable.nameZh || referenceDataState.selectedTable.gridId);
        // 坐标明确显示“所属项目 · 唯一 Code”，便于管理员定位数据库记录。
        detail.querySelector("[data-reference-data-detail-coordinate]").textContent =
            `${referenceDataState.selectedTable.projectCode} · ${referenceDataState.selectedTable.code}`;
        // 同步每个 tab 的可访问选中状态和键盘焦点顺序。
        detail.querySelectorAll("[data-reference-data-detail-tab]").forEach((button) => {
            const selected = button.dataset.referenceDataDetailTab === tab;
            button.setAttribute("aria-selected", String(selected));
            button.tabIndex = selected ? 0 : -1;
        });
        // 应用只需自行维护 info 和 preview；columns 直接复用公共 Grid 画板。
        const info = detail.querySelector('[data-reference-data-detail-content="info"]');
        const preview = detail.querySelector('[data-reference-data-detail-content="preview"]');
        // 三个内容区域中始终只有当前 tab 对应区域可见。
        info.hidden = tab !== "info";
        preview.hidden = tab !== "preview";
        if (gridBoard) gridBoard.hidden = tab !== "columns";
        // 只渲染当前可见的应用内容，避免每次列配置变化都重建隐藏面板。
        if (tab === "info") referenceDataRenderTableInfo(info, referenceDataState.selectedTable);
        if (tab === "preview") referenceDataRenderTablePreview(preview, referenceDataState.selectedTable);
    }

    /**
     * 切换表格详情页签并立即重绘当前详情。
     *
     * @param {string} tab 只允许 info、columns 或 preview。
     * @returns {void}
     * @sideEffect 更新 tableDetailTab；没有 selectedTable 或传入非法值时保持现状。
     */
    function referenceDataSetTableDetailTab(tab) {
        // 必须已选中表格且 tab 属于白名单；外部任意字符串不能改变页面结构状态。
        if (!referenceDataState.selectedTable || !["info", "columns", "preview"].includes(tab)) return;
        // 先写状态，再由统一渲染函数同步 DOM 和 ARIA。
        referenceDataState.tableDetailTab = tab;
        referenceDataRenderTableDetail();
    }

    /**
     * 把新 Payload 原位应用到已经挂载的所有公共组件。
     *
     * @param {object} payload referenceDataBuildPayload() 生成的聚合视图。
     * @returns {void}
     * @sideEffect 更新 Panel 文案、Search/Tree/Grid 配置，重建 Dropdown 选项，重绘详情并同步页面编辑坐标。
     * @remarks setLocale 表示“使用新配置原位刷新”，不是只修改语言；控制器和事件监听不会重复创建。
     */
    function referenceDataApplyPayload(payload, resetGrid = true) {
        // Panel 负责标题、状态、工具栏和五区静态文字。
        if (referenceDataState.panelRoot) panel.setLocale(referenceDataState.panelRoot, {
            view: payload,
            toolbar: referenceDataActiveToolbar()
        });
        // 字段名集合变化时重挂载 Search；只换文案时保留当前输入和焦点。
        const desiredSearchNames = (payload.search.fields || []).map((field) => String(field.name));
        const currentSearchNames = referenceDataState.searchController?.getFieldNames?.() || [];
        if (desiredSearchNames.join("|") !== currentSearchNames.join("|")) {
            referenceDataState.searchController = search.remount(referenceDataState.panelRoot, payload.search);
            if (!referenceDataState.searchController) throw new Error("引用数据搜索控件重挂载失败。");
        } else {
            referenceDataState.searchController?.setLocale(payload.search);
        }
        // Tree 和 Grid 分别读取自己负责的标准配置段。
        referenceDataState.treeController?.setLocale(payload.tree);
        referenceDataState.gridController?.setLocale(payload);
        // 模块切换后清除上一模块的搜索、状态、类型和分页状态，防止不同字段契约串用。
        if (resetGrid) referenceDataState.gridController?.reset();
        // Panel 已替换原生 select 选项后，先保证实例存在，再按每个根节点公开契约刷新浮层和当前文案。
        dropdown.mountAll(referenceDataState.panelRoot);
        referenceDataState.panelRoot.querySelectorAll("[data-sel-dropdown-menu]")
            .forEach((dropdownRoot) => dropdown.setLocale(dropdownRoot));
        // 表格详情依赖最新 records/columns，必须在公共组件刷新后同步。
        referenceDataRenderTableDetail();
        // 最后更新页面编辑器坐标，让管理员看到当前模块而不是旧模块。
        referenceDataSyncPageEditorControl();
    }

    /**
     * 重新加载当前模块并用最新缓存刷新整个页面。
     *
     * @param {boolean} reloadActive 是否强制刷新业务记录。
     * @param {boolean} reloadColumns 是否同时强制刷新表头配置。
     * @returns {Promise<void>}
     * @sideEffect 更新缓存并调用 referenceDataApplyPayload() 重绘。
     */
    async function referenceDataRefresh(reloadActive = true, reloadColumns = false) {
        // 先完成当前模块所需数据刷新，避免 Grid 接收到一半新、一半旧的 Payload。
        await referenceDataLoadModuleView(referenceDataActiveModule(), reloadActive, reloadColumns);
        // 数据全部就绪后重新组装一次只读视图并原位应用。
        referenceDataApplyPayload(referenceDataBuildPayload());
    }

    /**
     * 切换工作台业务模块，并处理页面编辑保护、详情上下文和异步竞态。
     *
     * @param {string} key referenceDataModules 中的稳定 key。
     * @returns {Promise<void>}
     * @sideEffect 可能更新 activeKey、selectedTable、editingId，显示加载态并在数据返回后再次刷新页面。
     */
    async function referenceDataSwitchModule(key) {
        // 只接受注册表中的稳定 key，忽略 Tree 或外部事件传入的未知值。
        if (!referenceDataModules[key]) return;
        // 当前模块数据已经加载时重复点击无需重绘，也不会丢失当前筛选。
        if (referenceDataState.activeKey === key && referenceDataState.loadedKeys.has(key)) return;
        // 离开表格列详情时释放当前表格上下文，返回表格定义列表或其他业务模块。
        if (key !== "columns") {
            referenceDataState.selectedTable = null;
            referenceDataState.tableDetailTab = null;
        }
        // 写入新模块游标，并清除上一模块正在编辑的记录主键。
        referenceDataState.activeKey = key;
        referenceDataState.editingId = null;
        // 已加载模块立即显示；首次进入时记录和表头并行加载，减少一半串行等待。
        if (referenceDataState.loadedKeys.has(key) && referenceDataState.columns.has(key)) {
            referenceDataApplyPayload(referenceDataBuildPayload());
            return;
        }
        // 首次进入也先切换页面并展示加载态，避免后端响应期间按钮看起来没有生效。
        const targetModule = referenceDataActiveModule();
        referenceDataApplyPayload(referenceDataBuildPayload());
        await referenceDataLoadModuleView(targetModule);
        // 用户在请求期间可能继续切换模块；旧请求完成后不得覆盖新的页面状态。
        if (referenceDataState.activeKey === key) {
            referenceDataApplyPayload(referenceDataBuildPayload());
        }
    }

    /**
     * 从表格详情返回已经缓存的 ReferenceDataTable 列表。
     *
     * @returns {void}
     * @sideEffect 清除 selectedTable/tableDetailTab，切换 activeKey=tables 并立即重绘，不发网络请求。
     */
    function referenceDataReturnToTableList() {
        // 返回动作先使用已加载的表格定义和表头立即重绘，避免等待接口时表现为按钮失效。
        // 清空详情父记录和页签，后续 Payload 将恢复 tables 模块普通列表。
        referenceDataState.selectedTable = null;
        referenceDataState.tableDetailTab = null;
        // 显式回到 tables，不能依赖 columns 的上一个模块历史。
        referenceDataState.activeKey = "tables";
        // 返回列表同时放弃任何未提交的记录编辑坐标。
        referenceDataState.editingId = null;
        // 所有数据都在缓存中，直接重绘即可。
        referenceDataApplyPayload(referenceDataBuildPayload());
    }

    /**
     * 从指定模块缓存中按数据库主键查找一条记录。
     *
     * @param {object} module 记录所属模块。
     * @param {number|string} id 要查找的主键。
     * @returns {object|null} 命中的原缓存记录；不存在时返回 null。
     * @sideEffect 无。
     */
    function referenceDataFindRecord(module, id) {
        // Number 统一来自 DOM 字符串和数据库数字两种主键表示。
        return (referenceDataState.records.get(module.key) || [])
            .find((record) => Number(record.id) === Number(id)) || null;
    }

    /**
     * 打开指定模块的新增或编辑 Window，并写入正确的字段契约和初始值。
     *
     * @param {object} module 决定使用哪个 Window 控制器和表单结构。
     * @param {object|null} record 非空时进入编辑，null 时进入新增。
     * @param {object} initialValues 新增窗口需要预填的业务值，例如当前表格的 tableId。
     * @returns {Promise<void>} 关联数据准备完成并打开窗口后完成。
     * @sideEffect 类型窗口按需加载页面控件；随后更新 editingId、重置 Window 并写入初始值。
     */
    async function referenceDataOpenEditor(module, record = null, initialValues = {}) {
        // 类型编辑只有打开窗口时才读取控件列表，首屏仍只加载当前模块和表头。
        if (module.key === "types") {
            await referenceDataEnsureModuleLoaded(referenceDataModules.controls);
        }
        // editingId 是保存时选择 create.htm 或 update.htm 的唯一依据，关闭成功后必须清空。
        referenceDataState.editingId = record ? Number(record.id) : null;
        // 每个模块使用预先挂载的独立控制器；setLocale 原位切换标题和 rows，不重复创建 dialog。
        // 按模块 key 取得启动阶段预先挂载的独立 Window 控制器。
        const controller = referenceDataState.editWindowControllers.get(module.key);
        // 先切换窗口文案和字段契约，再清空上一次打开残留的值与错误。
        controller.setLocale(referenceDataBuildEditWindow(module, Boolean(record), record));
        controller.reset();
        // 所在表由当前模块注册表提供，新增和编辑都能立即看到真实数据库位置。
        controller.setValues({ sourceTable: module.tableName });
        // 编辑把原记录写入表单；新增通常保持字段默认值。
        if (record) {
            controller.setValues({ ...record, sourceTable: module.tableName });
        } else if (module.key === "columns" && referenceDataState.selectedTable) {
            // 从表格详情新增元素时自动绑定父表，用户只需维护元素本身。
            controller.setValues({
                tableId: referenceDataState.selectedTable.id,
                projectCode: referenceDataState.selectedTable.projectCode
            });
        } else if (initialValues && Object.keys(initialValues).length > 0) {
            // 页面内关联入口可以预填所属类型等坐标，但仍由标准 Window 完成必填校验和提交。
            controller.setValues(initialValues);
        }
        // 所有初始值准备完成后再显示窗口，避免用户看到字段闪动。
        controller.open();
    }

    /**
     * 根据真实删除语义和当前关联数据生成确认文案。
     *
     * @param {object} module 目标记录所属模块。
     * @param {object} record 待删除记录。
     * @returns {Promise<string>} 可直接交给 confirmDialog 的真实风险说明。
     * @sideEffect 删除表格定义前可能按需加载 columns，以计算当前真实关联数量；不执行删除。
     */
    async function referenceDataBuildDeleteMessage(module, record) {
        // 普通记录没有跨表删除动作，直接说明后台只做逻辑删除。
        if (module.key !== "tables") {
            return `删除仅将此${module.itemName}标记为已删除，不会物理移除数据库记录。`;
        }
        // 表格定义与元素通过 tableId 形成真实外键关联；确认文案必须展示当前真实数量。
        // 表格定义需要先确保列缓存存在，确认框才能展示真实关联数量。
        await referenceDataEnsureModuleLoaded(referenceDataModules.columns);
        // 关联条件只使用数据库外键 tableId，不再依赖易变的文本组合坐标。
        const associatedColumnCount = (referenceDataState.records.get("columns") || [])
            .filter((column) => Number(column.status) !== 0
                && Number(column.tableId) === Number(record.id))
            .length;
        // 明确说明关联列不会被级联删除，避免管理员误判操作影响。
        return `当前关联 ${associatedColumnCount} 个表格列配置。删除仅停用表格定义，不会删除列配置。`;
    }

    /**
     * 使用公共 ConfirmDialog 取得明确确认后再执行逻辑删除。
     *
     * @param {object} module 目标模块。
     * @param {object} record 待删除记录。
     * @returns {Promise<boolean>} 用户取消或删除失败返回 false，删除成功返回 true。
     * @sideEffect 打开模态确认框；只有 open() 解析为 true 才调用删除接口。
     */
    async function referenceDataConfirmAndDelete(module, record) {
        // 文案可能需要异步加载列配置，所以必须在打开确认框前完成。
        const deleteMessage = await referenceDataBuildDeleteMessage(module, record);
        // ConfirmDialog 返回明确布尔值；默认焦点与危险样式由公共组件处理。
        const confirmed = await referenceDataState.deleteConfirmController.open({
            title: `删除${module.itemName}`,
            message: deleteMessage,
            target: referenceDataRecordLabel(module, record),
            icon: "ri-delete-bin-6-line",
            tone: "danger",
            closeLabel: `关闭删除${module.itemName}确认框`,
            cancelLabel: "取消",
            confirmLabel: "确认删除"
        });
        // 用户取消时立即结束，绝不调用后台删除接口。
        if (!confirmed) return false;
        // 确认后把数据库主键规范化为数字并进入统一删除函数。
        return referenceDataDelete(module, Number(record.id));
    }

    /**
     * 提交新增或编辑表单，并在成功后刷新缓存、页面和详情上下文。
     *
     * @param {object} module 当前表单所属模块。
     * @param {object} values selWindow:submit 提供的已校验字段值。
     * @returns {Promise<void>} 成功或失败都在对应 Window 内给出反馈。
     * @sideEffect 切换 Window loading 状态，调用 create/update 接口，成功后关闭窗口并清空 editingId。
     */
    async function referenceDataSave(module, values) {
        // 当前模块的独立 Window 负责 loading 和反馈，避免状态显示到其他编辑窗口。
        const controller = referenceDataState.editWindowControllers.get(module.key);
        // 提交期间锁定按钮并先显示明确进度。
        controller.setLoading(true);
        controller.setFeedback(`正在保存${module.itemName}…`);
        try {
            // code 与来源表只用于管理员诊断，后端新增链负责生成 code，任何保存请求都不得修改这两个只读值。
            const writeValues = { ...values };
            delete writeValues.code;
            delete writeValues.sourceTable;
            // editingId 存在时只在装配边界追加主键；新增请求绝不伪造 id、tenantId 或操作员字段。
            const result = await selAjax.request({
                url: `${module.api}${referenceDataState.editingId ? "update.htm" : "create.htm"}`,
                method: "POST",
                data: referenceDataState.editingId ? { ...writeValues, id: referenceDataState.editingId } : writeValues
            });
            // 优先展示后台真实业务消息，缺失时才使用本地成功文案。
            controller.setFeedback(result.msg || `${module.itemName}保存完成。`);
            // 从详情页编辑主表时先刷新主表缓存，再恢复当前选中记录；列写入只刷新列模块。
            await Promise.all([
                referenceDataEnsureModuleLoaded(module, true),
                module.key === "columns"
                    ? referenceDataLoadResolvedColumns(referenceDataModules.columns, true)
                    : Promise.resolve()
            ]);
            // 在详情中编辑父表后，用刷新缓存中的新记录替换 selectedTable 快照。
            if (module.key === "tables" && referenceDataState.selectedTable) {
                referenceDataState.selectedTable = referenceDataFindRecord(
                    referenceDataModules.tables, referenceDataState.selectedTable.id
                ) || referenceDataState.selectedTable;
            }
            // 数据和详情上下文都更新后再重绘、关闭窗口并清除编辑主键。
            referenceDataApplyPayload(referenceDataBuildPayload());
            controller.close();
            referenceDataState.editingId = null;
        } catch (error) {
            // 保存错误留在当前 Window，用户可修正字段后再次提交，不丢失表单内容。
            controller.setFeedback(error.message || `${module.itemName}保存失败。`, true);
        } finally {
            // 无论成功或失败都解除 loading，允许用户关闭或再次提交。
            controller.setLoading(false);
        }
    }

    /**
     * 调用模块 delete.htm 执行后台定义的逻辑删除，并刷新当前视图。
     *
     * @param {object} module 目标模块。
     * @param {number} id 待删除记录主键。
     * @returns {Promise<boolean>} 后台删除和页面刷新成功时返回 true。
     * @sideEffect 更新 Grid 反馈、调用删除接口并刷新记录；列模块还会重新读取表头配置。
     */
    async function referenceDataDelete(module, id) {
        // 删除开始先在表格底部回显进度，确认框此时已经关闭。
        referenceDataSetFeedback(`正在删除${module.itemName}…`);
        try {
            // delete.htm 只接收主键；后台 BaseService 负责租户和操作员身份。
            const result = await selAjax.request({
                url: `${module.api}delete.htm`, method: "POST", data: { id: id }
            });
            // 删除列配置时同时刷新表头，否则普通模块只需刷新业务记录。
            await referenceDataRefresh(true, module.key === "columns");
            // 后台消息优先显示，函数返回 true 供确认动作链判断完成。
            referenceDataSetFeedback(result.msg || `${module.itemName}删除完成。`);
            return true;
        } catch (error) {
            // 删除失败保留当前页面数据，并同时向用户和开发控制台报告原因。
            referenceDataSetFeedback(error.message || `${module.itemName}删除失败。`);
            console.error("引用数据删除失败。", error);
            return false;
        }
    }

    /**
     * 在启用 status=1 与停用 status=2 之间切换一条记录。
     *
     * @param {object} module 目标模块。
     * @param {object} record 当前记录及原状态。
     * @returns {Promise<void>}
     * @sideEffect 只提交 id 和目标 status，随后刷新当前模块；异常交给动作调度层统一回显。
     */
    async function referenceDataToggle(module, record) {
        // 当前为启用时目标变为停用，其他非 1 状态统一尝试恢复启用。
        const nextStatus = Number(record.status) === 1 ? 2 : 1;
        // 在请求开始前立即反馈，避免快速接口看起来像按钮没有响应。
        referenceDataSetFeedback(`正在切换${module.itemName}状态…`);
        await selAjax.request({
            url: `${module.api}update.htm`, method: "POST",
            // 状态操作只提交主键和目标状态，禁止把时间、审计等只读字段重新写回更新接口。
            data: { id: record.id, status: nextStatus }
        });
        // 状态变更后重新读取记录；列状态还会影响真实 Grid 表头，需要同步刷新列配置。
        await referenceDataRefresh(true, module.key === "columns");
        // 最终反馈只在后台更新和页面刷新都成功后显示。
        referenceDataSetFeedback(`${module.itemName}状态已更新。`);
    }

    /**
     * 从一条 ReferenceDataTable 进入其表格列配置详情。
     *
     * @param {object} record 当前表格定义。
     * @returns {Promise<void>}
     * @sideEffect 保存 selectedTable 快照、切换到 columns 模块并只显示 tableId 匹配的元素。
     */
    async function referenceDataOpenTableColumns(record) {
        // 主表记录成为详情上下文；元素模块仍按需加载且只展示 tableId 对应记录。
        referenceDataState.selectedTable = selFreeze({ ...record });
        referenceDataState.tableDetailTab = "columns";
        await referenceDataSwitchModule("columns");
        // 已经位于列模块时 switch 会复用缓存，因此仍需按新主表上下文重建当前表格数据。
        referenceDataApplyPayload(referenceDataBuildPayload());
    }

    /**
     * 执行不同业务模块的非破坏性预览动作。
     *
     * @param {object} module 目标模块。
     * @param {object} record 被预览记录。
     * @returns {Promise<void>}
     * @sideEffect tables 打开元素详情；tree 选中树节点；其余模块保持当前管理视图。
     */
    async function referenceDataPreview(module, record) {
        // 表格定义的“预览”实际进入完整列配置详情。
        if (module.key === "tables") {
            await referenceDataOpenTableColumns(record);
            return;
        }
        // 树节点预览直接让公共 Tree 选中对应稳定节点。
        if (module.key === "tree") {
            referenceDataState.treeController?.select(`record-tree-${record.id}`);
            return;
        }
    }

    /**
     * 把 Grid 行动作或 Tree 右键动作统一分派到业务处理函数。
     *
     * @param {object} module 动作所属模块。
     * @param {string} action edit/delete/preview/toggle 之一。
     * @param {object|null} record 动作目标记录。
     * @returns {Promise<void>}
     * @sideEffect 根据动作打开组件或调用后台；toggle 异常在此转换为页面反馈。
     */
    async function referenceDataHandleAction(module, action, record) {
        // 找不到记录时忽略陈旧事件，避免对 null 执行后台动作。
        if (!record) return;
        // 四个动作分别进入唯一业务函数，Grid 和 Tree 不复制处理逻辑。
        if (action === "edit") referenceDataOpenEditor(module, record);
        if (action === "delete") await referenceDataConfirmAndDelete(module, record);
        if (action === "preview") await referenceDataPreview(module, record);
        if (action === "toggle") {
            try {
                await referenceDataToggle(module, record);
            } catch (error) {
                referenceDataSetFeedback(error.message || `${module.itemName}状态切换失败。`);
                console.error("引用数据状态切换失败。", error);
            }
        }
    }

    /**
     * 把 Tree 的稳定 record-<module>-<id> 节点 ID 还原为业务坐标。
     *
     * @param {*} treeId Tree 选择或右键事件中的 id。
     * @returns {{moduleKey: string, id: number}|null} 格式合法时返回只读坐标，否则返回 null。
     * @sideEffect 无；module-* 一级导航 ID 不由本函数处理。
     */
    function referenceDataParseTreeRecordId(treeId) {
        // 正则同时限制允许的模块 key 和纯数字主键，拒绝任意 data 属性内容。
        const match = String(treeId || "").match(/^record-(types|tree|tables|columns|controls|windows)-([0-9]+)$/);
        // 命中后把主键转为数字；不合法节点统一返回 null 供事件处理器短路。
        return match ? { moduleKey: match[1], id: Number(match[2]) } : null;
    }

    /**
     * 挂载页面主工作区，把同一份业务视图交给 Panel、Search、Tree 和 Grid。
     *
     * @param {object} payload referenceDataBuildPayload() 生成的首屏视图。
     * @returns {void}
     * @throws {Error} 任一核心控件无法挂载时终止启动。
     * @sideEffect 创建工作区 DOM，并把各控制器写入 referenceDataState。
     */
    function referenceDataMountWorkspace(payload) {
        // Panel 先建立五区骨架，后续控件只在它分配的宿主内挂载。
        const root = panel.create(appHost, {
            gridId: referenceDataGridId, sourceId: referenceDataGridId, entity: "ReferenceDataWorkbench",
            view: "five-module-lazy-management", layout: "single", structure: referenceDataLayout, ariaLabel: payload.title.ariaLabel
        });
        // create 失败时立即阻断，后续控件不能在不存在的宿主上继续挂载。
        if (!root) throw new Error("引用数据公共面板创建失败。");
        // 保存 Panel 根节点，所有事件和子组件都以它作为稳定作用域。
        referenceDataState.panelRoot = root;
        // mount 根据 layout 和首屏 Payload 填充五区结构。
        if (!panel.mount(root, {
            view: payload,
            expandLeftLabel: payload.title.messages.expandLeftRegion,
            collapseLeftLabel: payload.title.messages.collapseLeftRegion,
            toolbar: referenceDataActiveToolbar()
        })) throw new Error("引用数据公共面板挂载失败。");

        // 四个控制器都复用 Panel 内已生成的节点，模块切换时只更新数据而不重建 DOM。
        // Search、Tree 和 Grid 返回可原位更新的控制器，Dropdown 由宿主批量挂载。
        referenceDataState.searchController = search.mount(root, payload.search);
        referenceDataState.treeController = tree.mount(root, payload.tree);
        dropdown.mountAll(root);
        referenceDataState.gridController = grid.mount(root, payload);
        // 任一核心控制器缺失都意味着页面无法完整工作，禁止带病进入事件绑定阶段。
        if (!referenceDataState.searchController || !referenceDataState.treeController || !referenceDataState.gridController) {
            throw new Error("引用数据搜索、树或表格控件挂载失败。");
        }
    }

    /**
     * 挂载编辑窗口和危险确认等管理控件。
     *
     * @param {object} windowMessages selWindow 当前语言的文案资源。
     * @returns {void}
     * @throws {Error} 某个业务模块编辑窗口或确认控件挂载失败时抛出。
     * @sideEffect 为六表模块建立独立窗口控制器，并写入页面运行状态。
     */
    function referenceDataMountManagementControls(windowMessages) {
        // 窗口按 module.key 隔离，切换模块时不会混用表单字段和提交事件 ID。
        referenceDataModuleList.forEach((module) => {
            // 每个模块用自身 windowId 和字段契约创建独立窗口实例。
            const controller = windowComponent.mount(appHost, {
                id: module.windowId,
                messages: windowMessages,
                ...referenceDataBuildEditWindow(module, false)
            });
            // 挂载失败立刻指出具体模块，便于定位是哪套字段契约不合法。
            if (!controller) throw new Error(`${module.name}编辑窗口挂载失败。`);
            // 控制器按模块 key 存入 Map，打开和保存时可直接取回。
            referenceDataState.editWindowControllers.set(module.key, controller);
        });

        // 删除确认使用危险色，任何模块删除都复用这一实例并在 open 时传入动态文案。
        referenceDataState.deleteConfirmController = confirmDialog.mount(appHost, {
            id: "selConfirmDialogReferenceDataDeleteId", title: "删除引用数据", tone: "danger"
        });
        if (!referenceDataState.deleteConfirmController) {
            throw new Error("引用数据确认组件挂载失败。");
        }
    }

    /**
     * 把当前业务 Grid 登记到统一页面编辑器。
     *
     * @param {boolean} canEditPage 后台权限接口返回的管理员页面编辑能力。
     * @returns {void}
     * @throws {Error} 个性化面板或 Grid 编辑适配器挂载失败时抛出。
     * @sideEffect 创建个性化控制器，登记列宽捕获、取消恢复和显式保存回调。
     */
    function referenceDataMountPageEditor(canEditPage) {
        // personalization 统一管理外观设置和页面编辑，本页只注入背景控制器与权限结果。
        referenceDataState.personalizationController = personalization.mount(personalizationHost, {
            // 背景控制器允许个性化面板实时预览主题、遮罩、亮度和模糊度。
            backgroundController,
            pageEditor: { canEdit: canEditPage }
        });
        // 个性化控制器缺失会导致页面编辑入口状态不可信，因此阻断启动。
        if (!referenceDataState.personalizationController) throw new Error("引用数据个性化设置挂载失败。");
        // 非管理员不登记任何页面控件；普通数据管理保持可用，页面编辑入口由公共组件隐藏。
        if (!canEditPage) return;

        // 编辑入口停靠在只于整页编辑态显示的表格配置头，不再遮挡第一列表头或业务数据。
        const editHost = referenceDataState.panelRoot.querySelector('[data-sel-grid-role="table-heading"]');
        // registerPageControl 把当前 Grid 的业务坐标和状态适配器登记给通用页面编辑器。
        if (!referenceDataState.personalizationController.registerPageControl({
            // id 是页面编辑器内部稳定控件坐标，与业务 Grid instanceKey 分开管理。
            id: "selGridReferenceDataPageEditorId",
            type: "grid",
            typeLabel: "表格控件",
            title: `${referenceDataActiveModule().name}表格`,
            icon: "ri-table-line",
            // root 决定选中轮廓范围，editHost 决定编辑角标实际停靠位置。
            root: referenceDataState.panelRoot,
            editHost,
            // coordinates 让管理员实时看到当前配置的唯一 code 和数据库来源表。
            coordinates: referenceDataPageEditorCoordinates(),
            captureState: referenceDataCapturePageGridState,
            saveState: referenceDataSavePageGridState
        })) throw new Error("引用数据表格页面编辑登记失败。");

        // 查询条件组、类型、状态和重置是工具栏四个可独立保存的逻辑控件。
        referenceDataMountQueryControlEditors();

        // 每个业务 Window 绑定独立数据库记录，拖拽或缩放后只保存当前实例。
        referenceDataModuleList.forEach((module) => {
            const controller = referenceDataState.editWindowControllers.get(module.key);
            const windowRecord = (referenceDataState.records.get("windows") || []).find((record) =>
                String(record.pageCode) === String(referenceDataState.pageCode)
                && String(record.triggerControlCode) === String(module.windowId));
            if (!controller || !windowRecord) throw new Error(`${module.name}尚未登记独立 Window 配置。`);
            controller.setDefaultGeometry(windowRecord);
            controller.setPageEditMetadata({ title: "Window", code: windowRecord.code });
            const editTarget = controller.getPageEditTarget();
            const editorId = `selWindow${module.key.charAt(0).toUpperCase()}${module.key.slice(1)}ReferenceDataPageEditorId`;
            if (!referenceDataState.personalizationController.registerPageControl({
                id: editorId, type: "window", typeLabel: "Window控件", title: `${module.name}Window`, icon: "ri-window-line",
                root: editTarget.root, editHost: editTarget.editHost,
                coordinates: [
                    { label: "唯一 Code", value: windowRecord.code },
                    { label: "来源表", value: "ReferenceDataWindow" }
                ],
                captureState: () => controller.getGeometry(),
                saveState: (geometry) => referenceDataSaveWindowGeometry(windowRecord, geometry, controller)
            })) throw new Error(`${module.name} Window 页面编辑登记失败。`);
        });

    }

    /**
     * 绑定 Grid 与 Tree 的模块导航和记录操作。
     *
     * @returns {void}
     * @sideEffect 给 Panel 注册一次性事件监听；记录动作继续由 referenceDataHandleAction() 统一调度。
     */
    function referenceDataBindGridAndTreeEvents() {
        // 所有语义事件都从 Panel 根节点冒泡，在这里集中监听一次。
        const root = referenceDataState.panelRoot;
        // 远程分页事件只在页面控件模块生效；每个输入直接映射一个 BaseDao AND 条件。
        root.addEventListener("selGrid:queryChange", async (event) => {
            const detail = event.detail;
            if (!detail || detail.gridId !== referenceDataGridId || referenceDataState.activeKey !== "controls") return;
            const values = detail.values || {};
            referenceDataState.searchController?.setLoading(true);
            try {
                await referenceDataLoadRemotePage(referenceDataModules.controls, {
                    pageNo: detail.pageNo, pageSize: detail.pageSize,
                    code: values.code ?? "", parentCode: values.parentCode ?? "", optionSetCode: values.optionSetCode ?? "",
                    controlKind: detail.type, status: detail.status
                });
                // 查询响应只替换当前页和分页信息，不能 reset 后再次发出远程查询。
                referenceDataApplyPayload(referenceDataBuildPayload(), false);
            } finally {
                referenceDataState.searchController?.setLoading(false);
            }
        });
        // Panel 头部“新增”最终以 Grid 语义事件通知，应用只决定打开哪个业务窗口。
        root.addEventListener("selGrid:new", () => referenceDataOpenEditor(referenceDataActiveModule()));
        root.addEventListener("selGrid:action", async (event) => {
            // detail 保存 Grid 实例、动作名和当前行记录。
            const detail = event.detail;
            // 只处理本页稳定 Grid ID，忽略同一宿主中可能存在的其他 Grid 事件。
            if (!detail || detail.instanceKey !== referenceDataGridId) return;
            // 当前模块决定动作业务含义，记录直接来自公共 Grid 当前行。
            await referenceDataHandleAction(referenceDataActiveModule(), detail.action, detail.record);
        });

        // 一级 module-* 节点切换模块；record-* 节点进入所属模块并回显记录搜索值。
        root.addEventListener("selTree:select", async (event) => {
            // Tree id 有 module-* 和 record-* 两类稳定格式。
            const treeId = String(event.detail?.id || "");
            // module-* 只切换一级业务模块。
            if (treeId.startsWith("module-")) {
                try {
                    await referenceDataSwitchModule(treeId.slice(7));
                } catch (error) {
                    // 模块异步请求或公共控件刷新失败时给出可见错误，避免表现为点击无响应。
                    referenceDataSetFeedback(error.message || "业务模块切换失败。");
                    console.error("引用数据业务模块切换失败。", error);
                }
                return;
            }
            // record-* 先解析成模块 key 和数据库主键。
            const target = referenceDataParseTreeRecordId(treeId);
            if (!target) return;
            // 表格定义记录不是搜索条件，选中后直接进入列配置详情。
            if (target.moduleKey === "tables") {
                const tableRecord = referenceDataFindRecord(referenceDataModules.tables, target.id);
                if (tableRecord) await referenceDataOpenTableColumns(tableRecord);
                return;
            }
            // 先切换模块契约，再把记录代表字段写入搜索，避免旧字段被 Grid 忽略。
            if (referenceDataState.activeKey !== target.moduleKey) await referenceDataSwitchModule(target.moduleKey);
            // 使用解析后的模块契约查缓存记录，并把代表字段回填到 Grid 搜索。
            const module = referenceDataModules[target.moduleKey];
            const record = referenceDataFindRecord(module, target.id);
            if (record) referenceDataState.gridController.filters.setSearch(record[module.previewField] || "");
        });

        // Tree 右键和 Grid 行操作共用同一调度函数，编辑、预览、启停和删除不产生两套分支。
        root.addEventListener("selTree:contextAction", async (event) => {
            // 右键动作同样先还原稳定记录坐标。
            const target = referenceDataParseTreeRecordId(event.detail?.id);
            if (!target) return;
            if (referenceDataState.activeKey !== target.moduleKey) await referenceDataSwitchModule(target.moduleKey);
            // 切换到正确模块后再分派动作，确保 Window 和接口契约一致。
            const module = referenceDataModules[target.moduleKey];
            await referenceDataHandleAction(module, event.detail.action, referenceDataFindRecord(module, target.id));
        });
    }

    /**
     * 绑定编辑窗口提交事件。
     *
     * @returns {void}
     * @sideEffect 把登记窗口的表单值交给统一保存函数。
     */
    function referenceDataBindFormAndPreviewEvents() {
        // 六表 Window 都冒泡到同一应用宿主，通过 windowId 回找模块可避免重复注册提交监听。
        appHost.addEventListener("selWindow:submit", (event) => {
            // 根据事件 windowId 反查模块，而不是相信表单自行携带接口地址。
            const module = referenceDataModuleList.find((candidate) => event.detail?.id === candidate.windowId);
            // 只有登记窗口才允许进入保存函数，未知窗口事件被忽略。
            if (module) referenceDataSave(module, event.detail.values);
        });
    }

    /**
     * 完成引用数据工作台的一次性启动装配。
     *
     * @returns {Promise<void>} 导航、首屏数据、公共控件、页面编辑与事件全部就绪后完成。
     * @throws {Error} 任一必要资源、数据或控件加载失败时终止启动。
     * @sideEffect 发起首屏请求，创建所有控制器并绑定页面事件。
     */
    async function mountApp() {
        // 窗口文案和页面编辑权限与导航并行请求，权限失败只隐藏编辑入口，不阻断基本管理功能。
        // Window 语言资源立即开始读取，与导航请求并行节省首屏等待。
        const windowMessagesPromise = selAjax.json({ url: referenceDataWindowMessagesUrl });
        // 页面编辑权限由后台 isAdmin 判断；读取失败按无权限降级而不是默认开放。
        const pageEditorCapabilityPromise = selAjax.request({
            url: "/api/reference-data/page-editor-capability"
        }).catch((error) => {
            // 记录真实错误供开发排查，同时返回结构兼容的安全默认值。
            console.warn("页面编辑权限读取失败，本次按无权限处理。", error);
            return { data: { canEditPage: false } };
        });

        // 导航结果决定首个模块，所以先确定 activeKey，再读取该模块记录与表头。
        await referenceDataLoadNavigation();
        // 页面配置先提供表格 code，再加载首屏表头，确保公共 getGridColumn 全程只按 code 命中。
        await referenceDataLoadPageConfiguration();
        await referenceDataLoadModuleView(referenceDataActiveModule());
        // 首屏业务数据就绪后等待之前并行启动的资源和权限结果。
        const [windowMessages, pageEditorCapability] = await Promise.all([
            windowMessagesPromise,
            pageEditorCapabilityPromise
        ]);
        // 所有首屏来源准备完成后只组装一次 Payload。
        const payload = referenceDataBuildPayload();

        // 启动顺序固定为“主工作区 → 管理控件 → 页面编辑 → 事件”，后一阶段只使用前一阶段已建立的控制器。
        // 先创建主工作区，后续控制器都依赖它提供稳定宿主。
        referenceDataMountWorkspace(payload);
        // 再挂载编辑、确认和预览组件。
        referenceDataMountManagementControls(windowMessages);
        // 使用后台权限决定是否开放页面编辑，同时登记 Grid 状态适配器。
        referenceDataMountPageEditor(pageEditorCapability.data?.canEditPage === true);
        // DOM 和控制器都存在后，最后绑定业务事件，避免启动中途收到事件。
        referenceDataBindGridAndTreeEvents();
        referenceDataBindFormAndPreviewEvents();
    }

    // 背景组件先于 personalization 挂载，因为个性化面板需要调用该控制器实时预览背景参数。
    const backgroundController = pageBackground.mount(backgroundHost, {
        // 默认采用纯深色背景，不增加遮罩、模糊或亮度偏移。
        defaults: { theme: "solid-dark", overlay: 0, brightness: 100, blur: 0 }
    });
    // 背景是页面完整视觉和个性化的必要依赖，挂载失败时终止启动。
    if (!backgroundController) throw new Error("引用数据页面背景挂载失败。");

    // 启动失败必须保留原始异常和堆栈，禁止用一个空页面静默吞掉公共组件或后台契约错误。
    mountApp().catch((error) => {
        // 控制台保留带上下文的中文错误和原 Error 对象。
        console.error("引用数据管理初始化失败。", error);
        // 继续抛出让浏览器错误监控和测试门禁都能捕获启动失败。
        throw error;
    });
}());
