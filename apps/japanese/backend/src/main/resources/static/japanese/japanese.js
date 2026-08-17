/*
 * Japanese N2 蓝宝书题库：只装配 SEL UI 公共控件、真实接口和 AI/语音业务动作。
 * panel/search/tree/grid 组成题库工作台，windowComponent 编辑题目，confirmDialog 确认删除，
 * pageBackground 与 personalization 管理页面外观；组件只在文件顶部解构一次。
 *
 * 阅读顺序：japaneseState 保存运行状态，japaneseBuildPayload() 组装公共视图，
 * japaneseBuildEditorOptions() 定义表单，mountApp() 只负责编排挂载和事件。
 * 注释约定与 Reference Data 一致：关键语句组解释业务目的，续行括号和标点不堆积机械注释。
 */
(function app() {
    "use strict";

    window.sel.require([
        "core.element", "core.query", "net.ajax", "locale.runtime", "components.panel", "components.search",
        "components.tree", "components.dropdownMenu", "components.grid", "components.window",
        "components.confirmDialog", "components.pageBackground", "components.personalization", "components.tableEditor"
    ]);
    // core 能力先通过 selBase 统一取得，应用后续不再直接访问 window.sel.core。
    const selBase = window.sel.core;
    // element 创建安全节点，query 查找宿主，selFreeze 只冻结完整配置边界。
    const { element, freeze: selFreeze, query } = selBase;
    const { ajax: selAjax } = window.sel.net;
    const { runtime: localeRuntime } = window.sel.locale;
    const {
        panel, search, tree, dropdownMenu: dropdown, grid, window: windowComponent,
        confirmDialog, pageBackground, personalization, tableEditor
    } = window.sel.components;
    // 三个宿主分别承载业务工作区、背景和个性化设置。
    const japaneseAppHost = query("[data-japanese-app]");
    const japaneseBackgroundHost = query("[data-sel-page-background-host]");
    const japanesePersonalizationHost = query("[data-sel-personalization-host]");
    // CRUD 和生成动作都从统一题库接口根地址派生。
    const japaneseQuestionApi = "/api/japanese/n2-blue-book-question/";
    const japaneseLearningApi = "/api/japanese/n2-learning-progress/";
    const japaneseGridId = "selGridJapaneseN2BlueBookQuestionId";
    const japaneseEditorId = "selWindowJapaneseN2BlueBookQuestionId";
    const japaneseTableEditorId = "selWindowJapaneseN2TableEditorId";
    const japaneseTableElementApi = "/api/reference-data/admin/table-elements/";
    const japanesePageKey = "n2-blue-book-question";
    const japaneseSupportedLocales = selFreeze(["zh-CN", "ja-JP", "en-US"]);
    const japaneseLocalePreferenceKey = "selplat.japanese.locale";
    const japaneseRequestedLocale = selBase.param("lang", selBase.preference.get(japaneseLocalePreferenceKey, "zh-CN"));
    let japaneseLocale = japaneseSupportedLocales.includes(japaneseRequestedLocale) ? japaneseRequestedLocale : "zh-CN";
    let japaneseMessages = {};
    let japaneseLocaleController = null;
    const japaneseMessagesUrl = "./i18n/{locale}.json?v=20260816-default-repair-1";
    const japaneseWindowMessagesUrl = "/sel/components/window/i18n/{locale}.json?v=20260816-default-repair-1";
    const japanesePersonalizationMessagesUrl = "/sel/components/personalization/i18n/{locale}.json?v=20260816-default-repair-1";
    // 页面运行状态保持可变，控制器由 mountApp() 写入。
    const japaneseState = {
        records: [],
        treeItems: [],
        editingRecord: null,
        gridController: null,
        editorController: null,
        deleteController: null,
        explanationController: null,
        nextRoundController: null,
        tableEditorController: null,
        tableEditorTrigger: null,
        generationView: null,
        panelRoot: null,
        searchController: null,
        treeController: null,
        personalizationController: null,
        pageCode: "",
        pageVersion: 0,
        pageConfig: null,
        tableRecord: null,
        configuredColumns: [],
        toolbarEditors: new Map(),
        audioBusyIds: new Set(),
        answerSelections: new Map(),
        currentRoundNo: 1,
        typeCounts: { ALL: 0, PRONUNCIATION: 0, KANJI: 0, GRAMMAR: 0 },
        page: { pageNo: 1, pageSize: 20, totalCount: 0 },
        query: { sourceQuestionNo: "", questionText: "", questionType: "" }
    };

    /** 按点分路径读取当前语言资源，并替换业务占位符。 */
    function japaneseText(path, values = {}, fallback = "") {
        const resolved = String(path || "").split(".").reduce((current, key) => current?.[key], japaneseMessages);
        const template = typeof resolved === "string" ? resolved : (fallback || path);
        return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value ?? "")), template);
    }

    /** 返回当前语言的题型标签，数据库值保持稳定英文枚举。 */
    function japaneseTypeLabels() {
        return selFreeze({
            PRONUNCIATION: japaneseText("types.PRONUNCIATION", {}, "语音・读音题"),
            KANJI: japaneseText("types.KANJI", {}, "汉字题"),
            GRAMMAR: japaneseText("types.GRAMMAR", {}, "语法题")
        });
    }

    // Panel 五区布局只描述组件位置，DOM 生命周期属于公共组件。
    const japaneseLayout = selFreeze({
        top: [
            { component: "title", payload: "title" },
            {
                component: "toolbar",
                children: [
                    { component: "selSearch", payload: "search" },
                    { component: "filterReset", payload: "title" },
                    { component: "toolbarAction", command: "nextRound", icon: "ri-restart-line" }
                ]
            }
        ],
        left: [{ component: "selTree", payload: "tree" }],
        center: [{ component: "selGrid", payload: "$aggregate" }],
        right: [],
        bottom: [
            {
                component: "footer",
                children: [
                    {
                        component: "gridSummary",
                        payload: "pagination",
                        children: [
                            { component: "selDropdownMenu", slot: "pageSize", payload: "select.pageSize" }
                        ]
                    },
                    { component: "pagination", payload: "pagination" },
                    { component: "feedback", payload: "title.messages" }
                ]
            }
        ]
    });

    /** 读取 JSON 接口并统一处理 HTTP 与业务失败。 */
    async function japaneseRequest(url, options = {}) {
        // fetch 保留端点原始结构，业务 success 与 HTTP 状态必须同时成功。
        const response = await fetch(url, options);
        const data = await response.json();
        if (!response.ok || data.success === false) throw new Error(data.msg || japaneseText("errors.request", {}, "请求失败。"));
        return data;
    }

    /** 组装题目分页参数，两个输入继续由 BaseDao 使用 AND 组合。 */
    function japaneseBuildQueryParams(query = japaneseState.query) {
        const params = new URLSearchParams({
            pageNo: String(query.pageNo || japaneseState.page.pageNo || 1),
            pageSize: String(query.pageSize || japaneseState.page.pageSize || 20)
        });
        if (String(query.sourceQuestionNo || "").trim()) params.set("sourceQuestionNo", String(query.sourceQuestionNo).trim());
        if (String(query.questionText || "").trim()) params.set("questionTextLike", String(query.questionText).trim());
        if (String(query.questionType || "").trim()) params.set("questionType", String(query.questionType).trim());
        return params;
    }

    /** 一次读取题目分页、当前轮选择和累计正确错误次数。 */
    async function japaneseLoadRecords(query = japaneseState.query) {
        const params = japaneseBuildQueryParams(query);
        const data = await japaneseRequest(`${japaneseLearningApi}getStore.htm?${params.toString()}`);
        return {
            records: Array.isArray(data.records) ? data.records : [],
            pageNo: Number(data.pageNo || params.get("pageNo") || 1),
            pageSize: Number(data.pageSize || params.get("pageSize") || 20),
            totalCount: Number(data.totalCount || 0),
            currentRoundNo: Number(data.records?.[0]?.currentRoundNo || 1)
        };
    }

    /** 题型统计只查询题目表，不重复读取用户作答历史。 */
    async function japaneseLoadQuestionRecords(query = japaneseState.query) {
        const params = japaneseBuildQueryParams(query);
        const data = await japaneseRequest(`${japaneseQuestionApi}getStore.htm?${params.toString()}`);
        return { totalCount: Number(data.totalCount || 0) };
    }

    /** 分别读取全部及三个题型总数，避免为了标题统计把 730 条题目全部加载到浏览器。 */
    async function japaneseLoadTypeCounts() {
        const types = ["ALL", "PRONUNCIATION", "KANJI", "GRAMMAR"];
        const pages = await Promise.all(types.map((type) => japaneseLoadQuestionRecords({
            pageNo: 1, pageSize: 1, questionType: type === "ALL" ? "" : type
        })));
        japaneseState.typeCounts = Object.fromEntries(types.map((type, index) => [type, pages[index].totalCount]));
        return japaneseState.typeCounts;
    }

    /** 应用一次后台分页结果并保存实际已提交条件。 */
    function japaneseApplyPage(page, query = japaneseState.query) {
        japaneseState.records = page.records;
        japaneseState.page = { pageNo: page.pageNo, pageSize: page.pageSize, totalCount: page.totalCount };
        japaneseState.currentRoundNo = Number(page.currentRoundNo || 1);
        japaneseState.query = {
            sourceQuestionNo: String(query.sourceQuestionNo || ""),
            questionText: String(query.questionText || ""),
            questionType: String(query.questionType || "")
        };
    }

    /** 读取当前应用页面在 Reference Data 中的登记；模块缺失时使用空配置静默降级。 */
    async function japaneseLoadPageConfiguration() {
        try {
            const result = await selAjax.request({
                url: `/api/reference-data/projects/japanese/pages/${japanesePageKey}/configuration`
            });
            const page = result.data || {};
            japaneseState.pageConfig = page;
            japaneseState.pageCode = String(page.pageCode || "");
            japaneseState.pageVersion = Number(page.version || 0);
            japaneseState.tableRecord = page.table && Object.keys(page.table).length > 0 ? page.table : null;
            return page;
        } catch (error) {
            console.warn("Reference Data 页面配置不可用，N2 页面使用组件默认值。", error);
            japaneseState.pageConfig = { controls: [], tableElements: [], windows: [], treeNodes: [] };
            return japaneseState.pageConfig;
        }
    }

    /** 通过 Japanese 业务 Controller 的公共 getGridColumn 链读取当前语言表头。 */
    async function japaneseLoadGridColumns() {
        if (!japaneseState.tableRecord?.code) {
            japaneseState.configuredColumns = [];
            return [];
        }
        const result = await japaneseRequest(
            `${japaneseQuestionApi}getGridColumn.htm?tableCode=${encodeURIComponent(japaneseState.tableRecord.code)}&locale=${encodeURIComponent(japaneseLocale)}`
        );
        const columns = Array.isArray(result.data?.columns) ? result.data.columns : [];
        japaneseState.configuredColumns = columns;
        return columns;
    }

    /** 生成题库根节点和三类题型树定义。 */
    function japaneseBuildTreeItems() {
        const configuredNodes = Array.isArray(japaneseState.pageConfig?.treeNodes) ? japaneseState.pageConfig.treeNodes : [];
        if (configuredNodes.length > 0) {
            const byParent = new Map();
            configuredNodes.forEach((node) => {
                const parentKey = node.parentId == null ? "ROOT" : String(node.parentId);
                if (!byParent.has(parentKey)) byParent.set(parentKey, []);
                byParent.get(parentKey).push(node);
            });
            const labelField = japaneseLocale === "ja-JP" ? "labelJa" : japaneseLocale === "en-US" ? "labelEn" : "labelZh";
            const build = (node) => ({
                id: String(node.code),
                label: String(node[labelField] || node.labelZh || node.labelEn || node.code),
                value: String(node.nodeValue),
                children: (byParent.get(String(node.id)) || []).map(build)
            });
            return (byParent.get("ROOT") || []).map(build);
        }
        const typeLabels = japaneseTypeLabels();
        return [{
            id: "n2-blue-book-question-root",
            label: japaneseText("title.title", {}, "N2 蓝宝书1000题"),
            value: "ALL",
            children: Object.entries(typeLabels).map(([value, label]) => ({
                id: `n2-${value.toLowerCase()}`,
                label,
                value
            }))
        }];
    }

    /** 统计某一题型的记录数量。 */
    function japaneseCountByType(type) {
        return Number(japaneseState.typeCounts[type] || 0);
    }

    /** 递归转换公共 Tree 标准节点。 */
    function japaneseNormalizeTreeItems(items) {
        const typeLabels = japaneseTypeLabels();
        return items.map((item) => {
            const value = String(item.value || "ALL");
            const normalized = {
                id: String(item.id || value.toLowerCase()),
                label: String(item.label || typeLabels[value] || japaneseText("types.ALL", {}, "全部题目")),
                icon: value === "ALL" ? "ri-book-open-line" : value === "PRONUNCIATION" ? "ri-volume-up-line" : value === "KANJI" ? "ri-font-size-2" : "ri-braces-line",
                count: value === "ALL" ? japaneseState.typeCounts.ALL : japaneseCountByType(value),
                filter: value === "ALL" ? {} : { questionType: value }
            };
            if (Array.isArray(item.children) && item.children.length > 0) normalized.children = japaneseNormalizeTreeItems(item.children);
            return normalized;
        });
    }

    /** 使用数据库表头；尚未登记或独立启动时回退到页面内同结构默认列。 */
    function japaneseBuildColumns() {
        const defaults = [
            { id: "sourceQuestionNo", field: "sourceQuestionNo", label: japaneseText("grid.columns.sourceQuestionNo"), renderer: "text", nowrap: true, width: "90px" },
            { id: "questionTypeLabel", field: "questionTypeLabel", secondaryField: "questionType", label: japaneseText("grid.columns.questionTypeLabel"), renderer: "text", nowrap: true, width: "150px" },
            { id: "questionText", field: "questionText", label: japaneseText("grid.columns.questionText"), renderer: "text", width: "360px" },
            { id: "optionA", field: "optionA", label: japaneseText("grid.columns.optionA"), renderer: "text", width: "180px" },
            { id: "optionB", field: "optionB", label: japaneseText("grid.columns.optionB"), renderer: "text", width: "180px" },
            { id: "optionC", field: "optionC", label: japaneseText("grid.columns.optionC"), renderer: "text", width: "180px" },
            { id: "optionD", field: "optionD", label: japaneseText("grid.columns.optionD"), renderer: "text", width: "180px" },
            { id: "correctCount", field: "correctCount", label: japaneseText("grid.columns.correctCount"), renderer: "badge", width: "88px" },
            { id: "wrongCount", field: "wrongCount", label: japaneseText("grid.columns.wrongCount"), renderer: "badge", width: "88px" },
            { id: "audioState", field: "id", label: japaneseText("grid.columns.audioState"), renderer: "actions", width: "130px" },
            { id: "updatedAt", field: "updatedAt", label: japaneseText("grid.columns.updatedAt"), renderer: "time", nowrap: true, width: "180px" },
            { id: "actions", field: "id", label: japaneseText("grid.columns.actions"), renderer: "actions", width: "120px" }
        ];
        const source = japaneseState.configuredColumns.length > 0 ? japaneseState.configuredColumns : defaults;
        return source.map((column) => {
            const normalized = { ...column };
            const optionLetter = /^option([A-D])$/.exec(String(normalized.id || normalized.field || ""))?.[1];
            if (optionLetter) {
                normalized.renderer = "choice";
                normalized.optionValue = optionLetter;
                normalized.selectedField = "displaySelectedOption";
                normalized.selectedTone = (record) => record.answerCorrect === false ? "danger" : "success";
                normalized.action = `answer${optionLetter}`;
                // 练习允许同题反复作答，每次点击都由后端新增一条正确或错误记录。
                normalized.lockAfterSelection = false;
            }
            if (normalized.id === "correctCount" || normalized.field === "correctCount") {
                normalized.cellIconVisible = true;
                normalized.cellIcon = (record) => Number(record.correctCount) > Number(record.wrongCount)
                    ? "ri-checkbox-circle-fill" : "";
                normalized.cellIconTone = "success";
            }
            if (normalized.id === "wrongCount" || normalized.field === "wrongCount") {
                normalized.cellIconVisible = true;
                normalized.cellIcon = (record) => Number(record.wrongCount) > 0
                    && Number(record.wrongCount) >= Number(record.correctCount) ? "ri-close-circle-fill" : "";
                normalized.cellIconTone = "danger";
            }
            if (normalized.id === "actions" || normalized.field === "actions") {
                normalized.field = "id";
                normalized.actions = [
                    { id: "explanation", label: japaneseText("grid.explanation"), icon: "ri-lightbulb-line" },
                    { id: "edit", label: japaneseText("grid.edit"), icon: "ri-edit-line" },
                    { id: "delete", label: japaneseText("grid.delete"), icon: "ri-delete-bin-6-line", tone: "danger" }
                ];
            }
            if (normalized.id === "audioState" || normalized.field === "audioState") {
                normalized.field = "id";
                normalized.renderer = "actions";
                normalized.width = "56px";
                normalized.actions = [{
                    id: "playAudio",
                    label: (record) => record.audioBusy === true
                        ? japaneseText("audio.generating", {}, "正在生成语音")
                        : japaneseText("audio.play", {}, "播放语音"),
                    icon: (record) => record.audioBusy === true ? "ri-loader-4-line" : "ri-volume-up-line",
                    showLabel: false
                }];
            }
            return normalized;
        });
    }

    /** 组装 Panel、Grid、Tree、Search 与分页共用视图。 */
    function japaneseBuildPayload() {
        const typeLabels = japaneseTypeLabels();
        // 复制后台记录并补充题型、图片和语音展示字段。
        const displayRecords = japaneseState.records.map((record) => ({
            ...record,
            displaySelectedOption: japaneseState.answerSelections.get(String(record.id)) || "",
            questionTypeLabel: typeLabels[record.questionType] || record.questionType,
            imageState: record.imageUrl ? japaneseText("state.generated", {}, "已生成") : japaneseText("state.empty", {}, "—"),
            audioState: record.audioUrl ? japaneseText("state.generated", {}, "已生成") : japaneseText("state.empty", {}, "—")
        }));
        // Tree 数量依赖最新 records，所以每次组装视图都重新规范化。
        const treeItems = japaneseNormalizeTreeItems(japaneseState.treeItems);
        return selFreeze({
            grid: {
                mode: "records",
                selectionMode: "SINGLE",
                idField: "id",
                searchFields: [],
                statusField: "questionType",
                deferToolbarFiltersUntilSubmit: true,
                horizontalScroll: true
            },
            data: { items: displayRecords, selectedIds: [] },
            column: {
                gridId: japaneseGridId,
                tableTitle: japaneseText("pageEditor.grid", {}, "N2 题目表格"),
                tableCode: japaneseState.tableRecord?.code || "",
                ariaLabel: japaneseText("grid.aria", {}, "N2 蓝宝书题目表格"),
                emptyText: japaneseText("grid.empty", {}, "当前分类还没有题目"),
                resizeLabelTemplate: japaneseText("grid.resizeLabelTemplate", {}, "调整 {label} 列宽"),
                items: japaneseBuildColumns()
            },
            title: {
                title: japaneseText("title.title", {}, "N2 蓝宝书1000题"),
                subtitle: japaneseText("title.subtitle", {}, "JLPT N2 · BLUE BOOK"),
                description: japaneseText("title.description", {}, "语音・读音、汉字、语法题统一管理"),
                ariaLabel: japaneseText("pageAria", {}, "N2 蓝宝书1000题管理"),
                ariaLabels: {
                    statusTabs: japaneseText("panel.statusTabs"), headerActions: japaneseText("panel.headerActions"), toolbar: japaneseText("panel.toolbar"),
                    sidebar: japaneseText("panel.sidebar"), content: japaneseText("panel.content"), board: japaneseText("panel.board"), pagination: japaneseText("panel.pagination")
                },
                statusTabs: [
                    { value: "", label: japaneseText("title.all"), count: japaneseState.typeCounts.ALL },
                    { value: "PRONUNCIATION", label: japaneseText("title.pronunciation"), count: japaneseCountByType("PRONUNCIATION") },
                    { value: "KANJI", label: japaneseText("title.kanji"), count: japaneseCountByType("KANJI") },
                    { value: "GRAMMAR", label: japaneseText("title.grammar"), count: japaneseCountByType("GRAMMAR") }
                ],
                actions: [
                    { id: "filter", label: japaneseText("title.search"), icon: "ri-search-line" },
                    { id: "new", label: japaneseText("title.new"), icon: "ri-add-line", primary: true }
                ],
                resetLabel: japaneseText("title.reset"),
                messages: {
                    selectProject: japaneseText("panel.select"), viewProject: japaneseText("panel.view"), editProject: japaneseText("panel.edit"), moreActions: japaneseText("panel.more"),
                    filtersReset: japaneseText("panel.filtersReset"), treePrefix: japaneseText("panel.sidebar"), expandLeftRegion: japaneseText("panel.expand"),
                    collapseLeftRegion: japaneseText("panel.collapse"), filterActivated: japaneseText("panel.filterActivated"), newOpened: japaneseText("panel.newOpened"),
                    exportPreparing: japaneseText("panel.actionTriggered"), movePrefix: japaneseText("panel.movePrefix")
                }
            },
            search: {
                gridId: japaneseGridId,
                label: japaneseText("search.label"),
                buttonLabel: japaneseText("search.submit"),
                clearLabel: japaneseText("search.clear"),
                icon: "ri-search-line",
                buttonIcon: "ri-search-line",
                clearIcon: "ri-close-line",
                defaultValue: "",
                fields: [
                    { name: "sourceQuestionNo", label: japaneseText("search.questionNo"), placeholder: japaneseText("search.questionNoPlaceholder"), icon: "ri-hashtag" },
                    { name: "questionText", label: japaneseText("search.questionText"), placeholder: japaneseText("search.questionTextPlaceholder"), icon: "ri-text" }
                ],
                clearable: true,
                submitOnEnter: true,
                submitOnClear: true,
                allowEmpty: true,
                trim: true
            },
            tree: {
                gridId: japaneseGridId,
                ariaLabel: japaneseText("tree.aria"),
                heading: japaneseText("tree.heading"),
                summary: japaneseText("tree.summary", { count: japaneseState.typeCounts.ALL }),
                expandLabelTemplate: japaneseText("tree.expand"),
                collapseLabelTemplate: japaneseText("tree.collapse"),
                selectedId: treeItems[0]?.id || "all",
                items: treeItems
            },
            menu: { gridId: japaneseGridId, ariaLabel: japaneseText("grid.actions", {}, "题目行操作") },
            pagination: {
                gridId: japaneseGridId,
                mode: "REMOTE",
                currentPage: japaneseState.page.pageNo,
                pageSize: japaneseState.page.pageSize,
                totalCount: japaneseState.page.totalCount,
                summaryAll: japaneseText("pagination.all"),
                summaryFiltered: japaneseText("pagination.filtered"),
                previousLabel: japaneseText("pagination.previous"),
                nextLabel: japaneseText("pagination.next"),
                pageChangedMessage: japaneseText("pagination.changed"),
                pageSizeChangedMessage: japaneseText("pagination.sizeChanged")
            },
            select: {
                pageSize: {
                    gridId: japaneseGridId,
                    role: "page-size",
                    label: japaneseText("pagination.sizeLabel"),
                    ariaLabel: japaneseText("pagination.sizeLabel"),
                    currentTemplate: "{label}，当前：{value}",
                    menuTitle: japaneseText("pagination.chooseSize"),
                    scrollAfter: 4,
                    options: [
                        { value: "10", label: japaneseText("pagination.perPage", { size: 10 }), icon: "ri-list-check-3" },
                        { value: "20", label: japaneseText("pagination.perPage", { size: 20 }), icon: "ri-list-check-3", selected: true },
                        { value: "50", label: japaneseText("pagination.perPage", { size: 50 }), icon: "ri-list-check-3" }
                    ]
                }
            }
        });
    }

    /** 返回 Panel 当前语言配置；关闭重复的整栏调宽，只保留页面编辑中的逐控件边框。 */
    function japanesePanelLocaleOptions(payload) {
        return {
            view: payload,
            expandLeftLabel: payload.title.messages.expandLeftRegion,
            collapseLeftLabel: payload.title.messages.collapseLeftRegion,
            sidebarResizeLabel: japaneseText("panel.sidebarResize", {}, "调整左侧区域宽度"),
            toolbar: { columnResize: false }
        };
    }

    /** 生成新增或编辑题目的 Window 配置。 */
    function japaneseBuildEditorOptions(editing) {
        const typeOptions = Object.entries(japaneseTypeLabels()).map(([value, label]) => ({ value, label, icon: "ri-book-2-line" }));
        const answerOptions = ["A", "B", "C", "D"].map((value) => ({ value, label: japaneseText("editor.option", { value }), icon: "ri-checkbox-circle-line" }));
        return selFreeze({
            id: japaneseEditorId,
            title: japaneseText(editing ? "editor.editTitle" : "editor.newTitle"),
            subtitle: japaneseText("editor.subtitle"),
            closeLabel: japaneseText("editor.close"),
            cancelLabel: japaneseText("editor.cancel"),
            submitLabel: japaneseText(editing ? "editor.save" : "editor.create"),
            validationMessage: japaneseText("editor.validation"),
            autoSuccess: false,
            rows: [
                [
                    { name: "sourceQuestionNo", label: japaneseText("editor.sourceQuestionNo"), type: "number", icon: "ri-hashtag", placeholder: japaneseText("editor.sourceQuestionNoPlaceholder"), required: true },
                    { name: "questionType", label: japaneseText("editor.questionType"), type: "select", required: true, options: typeOptions }
                ],
                [{ name: "name", label: japaneseText("editor.name"), type: "text", icon: "ri-text", placeholder: japaneseText("editor.namePlaceholder"), maxLength: 200 }],
                [{ name: "questionText", label: japaneseText("editor.questionText"), type: "textarea", icon: "ri-question-line", placeholder: japaneseText("editor.questionTextPlaceholder"), required: true, maxLength: 4000 }],
                [
                    { name: "optionA", label: japaneseText("editor.option", { value: "A" }), type: "text", icon: "ri-checkbox-blank-circle-line", required: true, maxLength: 1000 },
                    { name: "optionB", label: japaneseText("editor.option", { value: "B" }), type: "text", icon: "ri-checkbox-blank-circle-line", required: true, maxLength: 1000 }
                ],
                [
                    { name: "optionC", label: japaneseText("editor.option", { value: "C" }), type: "text", icon: "ri-checkbox-blank-circle-line", required: true, maxLength: 1000 },
                    { name: "optionD", label: japaneseText("editor.option", { value: "D" }), type: "text", icon: "ri-checkbox-blank-circle-line", required: true, maxLength: 1000 }
                ],
                [{ name: "correctOption", label: japaneseText("editor.correctOption"), type: "select", required: true, options: answerOptions }],
                [{ name: "audioText", label: japaneseText("editor.audioText"), type: "textarea", icon: "ri-volume-up-line", placeholder: japaneseText("editor.audioTextPlaceholder"), maxLength: 4000 }],
                [{ name: "explanation", label: japaneseText("editor.explanation"), type: "textarea", icon: "ri-lightbulb-line", placeholder: japaneseText("editor.explanationPlaceholder"), maxLength: 8000 }]
            ]
        });
    }

    /** 向标准题目 Window 追加 AI 与语音生成面板。 */
    function japaneseInstallGenerationControls() {
        const shell = japaneseAppHost.querySelector(`[data-sel-window-id="${japaneseEditorId}"]`);
        const fields = shell?.querySelector(".selwindow-form-fields");
        const feedback = fields?.querySelector(".selwindow-feedback");
        if (!fields || !feedback) throw new Error("题目窗口未提供标准字段区。");

        // 生成面板复用公共节点入口，类名和可访问属性由同一安全边界一次写入。
        const section = element("section", {
            className: "japanese-generation-panel",
            attributes: { "aria-label": japaneseText("generation.aria") }
        });
        section.innerHTML = `
            <header><div><strong>${japaneseText("generation.title")}</strong><span>${japaneseText("generation.hint")}</span></div><small>${japaneseText("generation.storage")}</small></header>
            <div class="japanese-generation-actions">
                <button type="button" data-generate="explanation"><i class="ri-lightbulb-flash-line" aria-hidden="true"></i><span><strong>${japaneseText("generation.explanation")}</strong><small>${japaneseText("generation.translator")}</small></span></button>
                <button type="button" data-generate="image"><i class="ri-image-ai-line" aria-hidden="true"></i><span><strong>${japaneseText("generation.image")}</strong><small>${japaneseText("generation.imageHint")}</small></span></button>
                <button type="button" data-generate="audio"><i class="ri-volume-up-line" aria-hidden="true"></i><span><strong>${japaneseText("generation.audio")}</strong><small>${japaneseText("generation.audioHint")}</small></span></button>
            </div>
            <div class="japanese-generation-previews">
                <figure data-image-preview><figcaption>${japaneseText("generation.imagePreview")}</figcaption><img alt="${japaneseText("generation.image")}" hidden><p>${japaneseText("generation.noImage")}</p></figure>
                <figure data-audio-preview><figcaption>${japaneseText("generation.audioPreview")}</figcaption><audio controls hidden></audio><p>${japaneseText("generation.noAudio")}</p></figure>
            </div>`;
        fields.insertBefore(section, feedback);
        section.querySelectorAll("[data-generate]").forEach((button) => {
            button.addEventListener("click", () => japaneseGenerate(button.dataset.generate, button));
        });
        japaneseState.generationView = section;
    }

    /** 返回新增题目的稳定表单默认值。 */
    function japaneseEditorDefaults() {
        return {
            questionType: "PRONUNCIATION",
            correctOption: "A",
            sourceQuestionNo: "",
            name: "",
            questionText: "",
            optionA: "",
            optionB: "",
            optionC: "",
            optionD: "",
            audioText: "",
            explanation: ""
        };
    }

    /** 打开新增或编辑题目窗口。 */
    function japaneseOpenEditor(record = null) {
        // 复制记录，让媒体生成在正式保存前只修改临时编辑上下文。
        japaneseState.editingRecord = record ? { ...record } : null;
        japaneseState.editorController.setLocale(japaneseBuildEditorOptions(Boolean(record)));
        japaneseState.editorController.reset();
        japaneseState.editorController.setValues({ ...japaneseEditorDefaults(), ...(record || {}) });
        japaneseState.editorController.setFeedback("");
        japaneseRefreshPreviews();
        japaneseState.editorController.open();
    }

    /** 统一构造新增、修改和生成结果持久化使用的题目参数。 */
    function japaneseBuildQuestionSavePayload(values) {
        const editing = Boolean(japaneseState.editingRecord?.id);
        const media = japaneseState.editingRecord || {};
        return {
            ...values,
            ...(editing ? { id: japaneseState.editingRecord.id } : {}),
            name: String(values.name || "").trim() || japaneseText("editor.defaultName", { number: values.sourceQuestionNo }),
            sortnum: media.sortnum || 0,
            status: media.status || 1,
            jlptLevel: "N2",
            sourceBook: "蓝宝书1000题",
            imageStorageProvider: media.imageStorageProvider || "",
            imageStorageKey: media.imageStorageKey || "",
            imageUrl: media.imageUrl || "",
            audioStorageProvider: media.audioStorageProvider || "",
            audioStorageKey: media.audioStorageKey || "",
            audioUrl: media.audioUrl || ""
        };
    }

    /** 提交新增或编辑题目并刷新页面。 */
    async function japaneseSaveQuestion(values) {
        // 保存期间锁定窗口并立即反馈，防止重复提交。
        japaneseState.editorController.setLoading(true);
        japaneseState.editorController.setFeedback(japaneseText("editor.saving"));
        try {
            const editing = Boolean(japaneseState.editingRecord?.id);
            // 前端只提交题目和媒体业务字段，身份审计由 BaseService 维护。
            const payload = japaneseBuildQuestionSavePayload(values);
            await japaneseRequest(japaneseQuestionApi + (editing ? "update.htm" : "create.htm"), {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                body: new URLSearchParams(payload)
            });
            japaneseState.editorController.close();
            await japaneseRefresh();
        } catch (error) {
            japaneseState.editorController.setFeedback(error.message || japaneseText("editor.saveFailed"), true);
        } finally {
            japaneseState.editorController.setLoading(false);
        }
    }

    /** 经公共确认框确认后删除题目。 */
    async function japaneseRemoveQuestion(record) {
        const confirmed = await japaneseState.deleteController.open({
            title: japaneseText("delete.title"),
            message: japaneseText("delete.message"),
            target: japaneseText("delete.target", { number: record.sourceQuestionNo, text: String(record.questionText || "").slice(0, 36) }),
            tone: "danger",
            icon: "ri-delete-bin-6-line",
            cancelLabel: japaneseText("delete.cancel"),
            confirmLabel: japaneseText("delete.confirm")
        });
        if (!confirmed) return;
        await japaneseRequest(`${japaneseQuestionApi}delete.htm`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: new URLSearchParams({ id: record.id })
        });
        await japaneseRefresh();
    }

    /** 提取生成接口需要的题目业务字段。 */
    function japaneseBuildGenerationPayload() {
        const values = japaneseState.editorController.getValues();
        return {
            questionType: values.questionType,
            questionText: values.questionText,
            optionA: values.optionA,
            optionB: values.optionB,
            optionC: values.optionC,
            optionD: values.optionD,
            correctOption: values.correctOption,
            audioText: values.audioText
        };
    }

    /** 把新生成解释追加到已有解释末尾，保留人工修订内容并限制在字段最大长度内。 */
    function japaneseAppendGeneratedExplanation(currentExplanation, generatedExplanation) {
        const current = String(currentExplanation || "").trimEnd();
        const generated = String(generatedExplanation || "").trim();
        const appended = current && generated ? `${current}\n\n${generated}` : current || generated;
        if (appended.length > 8000) {
            throw new Error(japaneseText("generation.explanationTooLong", {}, "追加后题目解释超过 8000 字，请先精简原解释。"));
        }
        return appended;
    }

    /** 已有题目生成解释后立即保存追加结果；新增题目仍由标准新增按钮统一建档。 */
    async function japanesePersistGeneratedExplanation(nextValues) {
        if (!japaneseState.editingRecord?.id) return false;
        const payload = japaneseBuildQuestionSavePayload(nextValues);
        await japaneseRequest(`${japaneseQuestionApi}update.htm`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: new URLSearchParams(payload)
        });
        japaneseState.editingRecord = { ...japaneseState.editingRecord, ...nextValues };
        return true;
    }

    /** 执行解释、图片或语音生成并写回结果。 */
    async function japaneseGenerate(kind, activeButton) {
        // 英文 kind 用于接口路径，中文 labels 只用于用户反馈。
        const labels = {
            explanation: japaneseText("generation.targets.explanation"),
            image: japaneseText("generation.targets.image"),
            audio: japaneseText("generation.targets.audio")
        };
        // 翻译、图片和语音分别显示真实提供方，避免把免费翻译误标成 Codex。
        const providers = {
            explanation: japaneseText("generation.translator"),
            image: japaneseText("generation.codex"),
            audio: "NanamiNeural"
        };
        const runningMessage = japaneseText("generation.running", {
            provider: providers[kind], target: labels[kind]
        });
        japaneseSetGenerating(true, activeButton, japaneseText("generation.runningButton", { target: labels[kind] }, `正在生成${labels[kind]}…`));
        japaneseState.editorController.setFeedback(runningMessage);
        try {
            const result = await japaneseRequest(`${japaneseQuestionApi}generate-${kind}.htm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(japaneseBuildGenerationPayload())
            });
            if (kind === "explanation") {
                const currentValues = japaneseState.editorController.getValues();
                const nextValues = {
                    ...currentValues,
                    explanation: japaneseAppendGeneratedExplanation(currentValues.explanation, result.data.explanation)
                };
                japaneseState.editorController.setValues(nextValues);
                const persisted = await japanesePersistGeneratedExplanation(nextValues);
                japaneseState.editorController.setFeedback(persisted
                    ? japaneseText("generation.explanationAppendedAndSaved", {}, "新解释已追加并保存。")
                    : japaneseText("generation.explanationAppended", {}, "新解释已追加，请点击保存新增。"));
            } else {
                const prefix = kind === "image" ? "image" : "audio";
                japaneseState.editingRecord = {
                    ...(japaneseState.editingRecord || {}),
                    [`${prefix}StorageProvider`]: result.data.storageProvider,
                    [`${prefix}StorageKey`]: result.data.objectKey,
                    [`${prefix}Url`]: result.data.url
                };
                japaneseRefreshPreviews();
            }
            if (kind !== "explanation") {
                japaneseState.editorController.setFeedback(result.msg || japaneseText("generation.complete", { target: labels[kind] }));
            }
        } catch (error) {
            japaneseState.editorController.setFeedback(error.message || japaneseText("generation.failed", { target: labels[kind] }), true);
        } finally {
            japaneseSetGenerating(false, activeButton);
        }
    }

    /** 统一切换生成按钮的忙碌状态。 */
    function japaneseSetGenerating(busy, activeButton, busyLabel = "") {
        const buttons = new Set(japaneseState.generationView?.querySelectorAll("[data-generate]") || []);
        if (activeButton) buttons.add(activeButton);
        buttons.forEach((button) => {
            button.disabled = busy;
            button.classList.toggle("is-running", busy && button === activeButton);
            const label = button.querySelector("strong");
            if (busy && button === activeButton) {
                button.setAttribute("aria-busy", "true");
                if (label && !button.dataset.idleLabel) button.dataset.idleLabel = label.textContent;
                if (label && busyLabel) label.textContent = busyLabel;
            } else if (!busy) {
                button.removeAttribute("aria-busy");
                if (label && button.dataset.idleLabel) label.textContent = button.dataset.idleLabel;
                delete button.dataset.idleLabel;
            }
        });
    }

    /** 同步图片和音频预览。 */
    function japaneseRefreshPreviews() {
        if (!japaneseState.generationView) return;
        const imageHost = japaneseState.generationView.querySelector("[data-image-preview]");
        const image = imageHost.querySelector("img");
        const imageUrl = japaneseState.editingRecord?.imageUrl || "";
        image.hidden = !imageUrl;
        imageHost.querySelector("p").hidden = Boolean(imageUrl);
        if (imageUrl) image.src = `${imageUrl}?v=${Date.now()}`;

        const audioHost = japaneseState.generationView.querySelector("[data-audio-preview]");
        const audio = audioHost.querySelector("audio");
        const audioUrl = japaneseState.editingRecord?.audioUrl || "";
        audio.hidden = !audioUrl;
        audioHost.querySelector("p").hidden = Boolean(audioUrl);
        if (audioUrl) audio.src = `${audioUrl}?v=${Date.now()}`;
    }

    /** 重新读取题目并原位刷新公共组件。 */
    async function japaneseRefresh() {
        const page = await japaneseLoadRecords({ ...japaneseState.query, ...japaneseState.page });
        japaneseApplyPage(page);
        await japaneseLoadTypeCounts();
        japaneseState.treeItems = japaneseBuildTreeItems();
        const payload = japaneseBuildPayload();
        const panelRoot = panel.get(japaneseGridId);
        panel.setLocale(panelRoot, japanesePanelLocaleOptions(payload));
        japaneseState.gridController.setLocale(payload);
        japaneseUpdateRoundToolbar();
    }

    /** 更新工具栏轮次分组，查询动作与做题状态动作保持清晰边界。 */
    function japaneseUpdateRoundToolbar() {
        const host = japaneseState.panelRoot?.querySelector('[data-sel-panel-component="toolbarAction"][data-sel-panel-command="nextRound"]');
        if (!host) return;
        const context = host.querySelector('[data-sel-panel-role="toolbar-action-context"]');
        const button = host.querySelector('[data-sel-panel-role="toolbar-action-button"]');
        const label = host.querySelector('[data-sel-panel-role="toolbar-action-label"]');
        const roundLabel = japaneseText("round.current", { round: japaneseState.currentRoundNo }, `第 ${japaneseState.currentRoundNo} 轮`);
        context.textContent = roundLabel;
        label.textContent = japaneseText("title.nextRound", {}, "新一轮");
        button.setAttribute("aria-label", `${roundLabel} · ${label.textContent}`);
        if (button.dataset.bound !== "true") {
            button.dataset.bound = "true";
            button.addEventListener("click", japaneseStartNextRound);
        }
    }

    /** 重新读取表格定义与可见列，并让业务 Grid 立即按数据库状态重建表头。 */
    async function japaneseRefreshTableConfiguration() {
        await japaneseLoadPageConfiguration();
        await japaneseLoadGridColumns();
        japaneseState.gridController?.setLocale(japaneseBuildPayload());
    }

    /** 返回当前真实表格下全部未删除 COLUMN，隐藏列也必须进入公共编辑窗口。 */
    async function japaneseLoadEditableTableElements() {
        await japaneseLoadPageConfiguration();
        return (japaneseState.pageConfig?.tableElements || [])
            .filter((record) => String(record.viewCode) === "DEFAULT"
                && String(record.elementType || "COLUMN") === "COLUMN"
                && Number(record.status) !== 0);
    }

    /** 新增表头并固定归属当前 ReferenceDataTable。 */
    async function japaneseCreateTableElement(values) {
        const fieldName = String(values.fieldName || "").trim();
        const labelZh = String(values.labelZh || "").trim();
        if (!fieldName || !labelZh) throw new Error(japaneseText("tableEditor.required", {}, "字段 Code 和中文名称不能为空。"));
        const duplicated = (japaneseState.pageConfig?.tableElements || []).some((record) => Number(record.status) !== 0
            && String(record.viewCode) === "DEFAULT" && String(record.fieldName) === fieldName);
        if (duplicated) throw new Error(japaneseText("tableEditor.duplicate", {}, "字段 Code 已存在。"));
        return selAjax.request({
            url: `${japaneseTableElementApi}create.htm`, method: "POST", data: {
                ...values,
                fieldName,
                labelZh,
                projectCode: "japanese",
                tableId: japaneseState.tableRecord.id,
                viewCode: "DEFAULT",
                elementType: "COLUMN",
                visible: true,
                resizable: true,
                status: 1
            }
        });
    }

    /** 修改表头名称、宽度、排序、渲染方式或显示滑块。 */
    async function japaneseUpdateTableElement(values) {
        if (!values?.id) throw new Error(japaneseText("tableEditor.notRegistered", {}, "表头尚未登记。"));
        return selAjax.request({ url: `${japaneseTableElementApi}update.htm`, method: "POST", data: values });
    }

    /**
     * 在页面配置事务中一次保存全部表头的 sortnum，避免逐条更新留下半完成顺序。
     * 真实传参示例：[{code:"tableElement101001",sortnum:10},{code:"tableElement101002",sortnum:20}]。
     * 真实返回示例：保存成功后更新 pageVersion 并返回 true。
     * 异常或副作用示例：版本冲突或归属不符时整体回滚，错误继续交给 TableEditor 恢复原顺序。
     */
    async function japaneseReorderTableElements(records) {
        if (!japaneseState.pageCode || records.some((record) => !record.code)) {
            throw new Error(japaneseText("tableEditor.notRegistered", {}, "表头尚未登记。"));
        }
        const result = await selAjax.request({
            url: `/api/reference-data/pages/${encodeURIComponent(japaneseState.pageCode)}/configuration`,
            method: "POST",
            jsonData: {
                baseVersion: japaneseState.pageVersion,
                tableElements: records.map((record) => ({ code: record.code, sortnum: record.sortnum }))
            }
        });
        japaneseState.pageVersion = Number(result.data?.version || japaneseState.pageVersion + 1);
        return true;
    }

    /** 逻辑删除表头，刷新后业务页面不再获得该列。 */
    async function japaneseDeleteTableElement(record) {
        return selAjax.request({ url: `${japaneseTableElementApi}delete.htm`, method: "POST", data: { id: record.id } });
    }

    /** 挂载公共表格编辑 Window，并把入口放到表格 Code 与保存按钮同一表格头。 */
    function japaneseMountTableEditor(windowMessages) {
        const heading = japaneseState.panelRoot.querySelector('[data-sel-grid-role="table-heading"]');
        if (!heading || !japaneseState.tableRecord?.id) return null;
        japaneseState.tableEditorController = tableEditor.mount(japaneseAppHost, {
            id: japaneseTableEditorId,
            title: japaneseText("tableEditor.title", {}, "编辑表格"),
            subtitle: japaneseText("tableEditor.subtitle", {}, "拖拽排序、新增、修改、隐藏或删除当前表格头"),
            closeLabel: japaneseText("tableEditor.close", {}, "关闭表格编辑窗口"),
            messages: japaneseMessages.tableEditor || {},
            windowMessages,
            load: japaneseLoadEditableTableElements,
            create: japaneseCreateTableElement,
            update: japaneseUpdateTableElement,
            reorder: japaneseReorderTableElements,
            remove: japaneseDeleteTableElement,
            confirmReorder: (records) => japaneseState.deleteController.open({
                title: japaneseText("tableEditor.reorderTitle", {}, "调整表头顺序"),
                message: japaneseText("tableEditor.reorderMessage", {}, "确认后才会保存新顺序并同步业务表格。"),
                target: records.map((record) => record.labelZh || record.fieldName).join(" → "),
                icon: "ri-drag-move-2-line",
                tone: "warning",
                cancelLabel: japaneseText("tableEditor.cancel", {}, "取消"),
                confirmLabel: japaneseText("tableEditor.confirmReorder", {}, "确认调整")
            }),
            confirmRemove: (record) => japaneseState.deleteController.open({
                title: japaneseText("tableEditor.deleteTitle", {}, "删除表头"),
                message: japaneseText("tableEditor.deleteMessage", {}, "删除后该表头不会再出现在业务表格中。"),
                target: record.labelZh || record.fieldName,
                icon: "ri-delete-bin-6-line",
                tone: "danger",
                cancelLabel: japaneseText("tableEditor.cancel", {}, "取消"),
                confirmLabel: japaneseText("tableEditor.confirmDelete", {}, "确认删除")
            }),
            onChange: japaneseRefreshTableConfiguration
        });
        japaneseState.tableEditorTrigger = tableEditor.attachTrigger(heading, japaneseState.tableEditorController, {
            label: japaneseText("tableEditor.open", {}, "编辑表格"), icon: "ri-edit-box-line"
        });
        return japaneseState.tableEditorController;
    }

    /** 完整播放一次音频并等待结束，第二遍必须从头开始而不是并发叠音。 */
    function japanesePlayAudioOnce(player) {
        return new Promise((resolve, reject) => {
            player.onended = resolve;
            player.onerror = () => reject(new Error(japaneseText("audio.playFailed", {}, "语音播放失败。")));
            player.currentTime = 0;
            player.play().catch(reject);
        });
    }

    /** 播放题目语音两遍；中间停顿 0.5 秒，缺失媒体时由后端生成并保存。 */
    async function japanesePlayAudio(record) {
        const recordId = String(record.id);
        if (japaneseState.audioBusyIds.has(recordId)) return;
        japaneseState.audioBusyIds.add(recordId);
        // 播放动作只更新当前行的忙碌图标；禁止为一个按钮重建表头、分页和滚动容器。
        japaneseState.gridController.updateRecord(record.id, { audioBusy: true });
        try {
            const result = await japaneseRequest(`${japaneseQuestionApi}play-audio.htm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: record.id })
            });
            const audioUrl = String(result.data?.url || "");
            if (!audioUrl) throw new Error(japaneseText("audio.missing", {}, "语音生成后未返回播放地址。"));
            japaneseState.records = japaneseState.records.map((item) =>
                String(item.id) === recordId ? { ...item, audioUrl } : item);
            japaneseState.gridController.updateRecord(record.id, { audioUrl });
            const player = new Audio(`${audioUrl}?v=${Date.now()}`);
            await japanesePlayAudioOnce(player);
            await new Promise((resolve) => window.setTimeout(resolve, 500));
            await japanesePlayAudioOnce(player);
        } catch (error) {
            japaneseShowError(error);
        } finally {
            japaneseState.audioBusyIds.delete(recordId);
            japaneseState.gridController.updateRecord(record.id, { audioBusy: false });
        }
    }

    /** 提交当前轮次的一项单选答案，并用短时 Toast 显示正确或错误。 */
    async function japaneseAnswer(record, option) {
        try {
            const result = await japaneseRequest(`${japaneseLearningApi}answer.htm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ questionId: record.id, selectedOption: option })
            });
            selBase.toast(
                result.data?.correct
                    ? japaneseText("answer.correct", {}, "回答正确。")
                    : japaneseText("answer.wrong", {}, "回答错误。"),
                result.data?.correct ? "success" : "error"
            );
            const selectedOption = String(result.data?.selectedOption || option);
            const answerChanges = {
                selectedOption,
                displaySelectedOption: selectedOption,
                answerCorrect: result.data?.correct === true,
                correctCount: Number(result.data?.correctCount || 0),
                wrongCount: Number(result.data?.wrongCount || 0)
            };
            japaneseState.answerSelections.set(String(record.id), selectedOption);
            // 判题只更新当前题目状态与次数，禁止为一行变化重建表头、分页和滚动容器。
            japaneseState.records = japaneseState.records.map((item) =>
                String(item.id) === String(record.id) ? { ...item, ...answerChanges } : item);
            japaneseState.gridController.updateRecord(record.id, answerChanges);
        } catch (error) {
            japaneseShowError(error);
        }
    }

    /** 通过受控接口查看已作答题目的正确选项与解释。 */
    async function japaneseShowExplanation(record) {
        try {
            const result = await japaneseRequest(`${japaneseLearningApi}explanation.htm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ questionId: record.id })
            });
            await japaneseState.explanationController.open({
                title: japaneseText("explanation.title", {}, "查看解释"),
                message: japaneseText("explanation.correctOption", { option: result.data?.correctOption || "—" }, "正确选项：{option}"),
                target: String(result.data?.explanation || japaneseText("explanation.empty", {}, "暂无解释。")),
                icon: "ri-lightbulb-line",
                cancelLabel: japaneseText("explanation.close", {}, "关闭"),
                confirmLabel: japaneseText("explanation.understood", {}, "知道了")
            });
        } catch (error) {
            japaneseShowError(error);
            selBase.toast(error.message || japaneseText("errors.app"), "error");
        }
    }

    /** 用户确认后结束当前轮并创建下一轮，累计次数不清零。 */
    async function japaneseStartNextRound() {
        const confirmed = await japaneseState.nextRoundController.open({
            title: japaneseText("round.title", {}, "开始新一轮"),
            message: japaneseText("round.message", {}, "当前轮会结束，历史正确和错误次数继续保留。"),
            icon: "ri-restart-line",
            cancelLabel: japaneseText("round.cancel", {}, "继续当前轮"),
            confirmLabel: japaneseText("round.confirm", {}, "开始新一轮")
        });
        if (!confirmed) return;
        try {
            const result = await japaneseRequest(`${japaneseLearningApi}next-round.htm`, { method: "POST" });
            japaneseState.answerSelections.clear();
            japaneseState.currentRoundNo = Number(result.data?.roundNo || japaneseState.currentRoundNo + 1);
            selBase.toast(japaneseText("round.started", {}, "新一轮已开始。"), "success");
            await japaneseRefresh();
        } catch (error) {
            japaneseShowError(error);
        }
    }

    /** 为一次语言切换并行加载应用、Window 和个性化三类资源。 */
    async function japaneseLoadLocaleResources(nextLocale) {
        const url = (template) => template.replaceAll("{locale}", nextLocale);
        const [messages, windowMessages, personalizationMessages] = await Promise.all([
            selAjax.json({ url: url(japaneseMessagesUrl) }),
            selAjax.json({ url: url(japaneseWindowMessagesUrl) }),
            selAjax.json({ url: url(japanesePersonalizationMessagesUrl) })
        ]);
        return selFreeze({ messages, windowMessages, personalizationMessages });
    }

    /** 原位应用新语言，保留搜索值、分页、选中行、编辑表单和窗口几何。 */
    async function japaneseApplyLocale(update = {}) {
        const nextLocale = String(update.locale || "");
        const resources = update.resource;
        if (!japaneseSupportedLocales.includes(nextLocale) || !resources?.messages) return false;
        const gridState = japaneseState.gridController?.getState?.() || {};
        const searchValues = japaneseState.searchController?.getValues?.() || {};
        const editorValues = japaneseState.editorController?.getValues?.() || {};
        japaneseLocale = nextLocale;
        japaneseMessages = resources.messages;
        await japaneseLoadGridColumns();
        japaneseState.treeItems = japaneseBuildTreeItems();
        const payload = japaneseBuildPayload();
        panel.setLocale(japaneseState.panelRoot, japanesePanelLocaleOptions(payload));
        japaneseState.searchController?.setLocale?.(payload.search);
        japaneseState.searchController?.setValues?.(searchValues);
        japaneseState.treeController?.setLocale?.(payload.tree);
        japaneseState.gridController?.setLocale?.({
            ...payload,
            data: { ...payload.data, selectedIds: gridState.selectedIds || [] },
            pagination: { ...payload.pagination, currentPage: gridState.currentPage || 1, pageSize: gridState.pageSize || 20 }
        });
        japaneseState.editorController?.setLocale?.({
            locale: japaneseLocale,
            resource: { messages: resources.windowMessages, options: japaneseBuildEditorOptions(Boolean(japaneseState.editingRecord)) }
        });
        japaneseState.editorController?.setValues?.(editorValues);
        japaneseState.deleteController?.setLocale?.({ title: japaneseText("delete.title") });
        japaneseState.explanationController?.setLocale?.({ title: japaneseText("explanation.title") });
        japaneseState.nextRoundController?.setLocale?.({ title: japaneseText("round.title") });
        japaneseUpdateRoundToolbar();
        japaneseState.tableEditorController?.setLocale?.({ messages: japaneseMessages.tableEditor || {} });
        if (japaneseState.tableEditorTrigger) {
            const tableEditorLabel = japaneseText("tableEditor.open", {}, "编辑表格");
            japaneseState.tableEditorTrigger.setAttribute("aria-label", tableEditorLabel);
            japaneseState.tableEditorTrigger.querySelector("span").textContent = tableEditorLabel;
        }
        japaneseState.generationView?.remove();
        japaneseInstallGenerationControls();
        selBase.preference.set(japaneseLocalePreferenceKey, japaneseLocale);
        selBase.replaceParam("lang", japaneseLocale);
        selBase.setDocument({ lang: japaneseLocale, title: japaneseText("documentTitle") });
        japaneseAppHost.setAttribute("aria-label", japaneseText("pageAria"));
        return true;
    }

    /** 捕获工具条真实控件相对工具条的矩形，业务值和业务状态不进入页面布局配置。 */
    function japaneseCaptureToolbarGeometry(editor) {
        const toolbarRect = editor.toolbar.getBoundingClientRect();
        const targetRect = editor.target.getBoundingClientRect();
        return {
            x: Math.round(targetRect.left - toolbarRect.left),
            y: Math.round(targetRect.top - toolbarRect.top),
            width: `${Math.round(targetRect.width)}px`,
            height: `${Math.round(targetRect.height)}px`
        };
    }

    /** 保存一个工具条控件的独立矩形；未登记时保持页面默认值且不伪造成功。 */
    async function japaneseSaveToolbarGeometry(editor) {
        if (!editor.record?.code || !japaneseState.pageCode) throw new Error(japaneseText("pageEditor.notRegistered"));
        const saved = { code: editor.record.code, ...japaneseCaptureToolbarGeometry(editor), breakpoint: editor.record.breakpoint || "DESKTOP" };
        const result = await selAjax.request({
            url: `/api/reference-data/pages/${encodeURIComponent(japaneseState.pageCode)}/configuration`,
            method: "POST",
            jsonData: { baseVersion: japaneseState.pageVersion, controls: [saved] }
        });
        japaneseState.pageVersion = Number(result.data?.version || japaneseState.pageVersion + 1);
        Object.assign(editor.record, saved);
        return true;
    }

    /** 保存 N2 Grid 当前列宽到对应 ReferenceDataTableElement。 */
    async function japaneseSaveGridState(state = {}) {
        const elementByField = new Map((japaneseState.pageConfig?.tableElements || [])
            .filter((record) => String(record.viewCode) === "DEFAULT")
            .map((record) => [String(record.fieldName), record]));
        const changes = Object.entries(state.columnWidths || {})
            .filter(([field]) => elementByField.has(field))
            .map(([field, width]) => ({ code: elementByField.get(field).code, width: `${Math.round(Number(width))}px` }));
        if (!japaneseState.pageCode || changes.length === 0) throw new Error(japaneseText("pageEditor.notRegistered"));
        const result = await selAjax.request({
            url: `/api/reference-data/pages/${encodeURIComponent(japaneseState.pageCode)}/configuration`,
            method: "POST",
            jsonData: { baseVersion: japaneseState.pageVersion, tableElements: changes }
        });
        japaneseState.pageVersion = Number(result.data?.version || japaneseState.pageVersion + 1);
        await japaneseLoadPageConfiguration();
        await japaneseLoadGridColumns();
        japaneseState.gridController.setLocale(japaneseBuildPayload());
        japaneseState.gridController.resetColumnWidths();
        return true;
    }

    /** 保存题目编辑 Window 当前大小与位置，并更新下次打开的默认几何。 */
    async function japaneseSaveWindowState(windowRecord, geometry = {}) {
        const saved = {
            code: windowRecord.code,
            width: `${Math.round(Number(geometry.width))}px`,
            height: `${Math.round(Number(geometry.height))}px`,
            x: Math.round(Number(geometry.left)),
            y: Math.round(Number(geometry.top)),
            positionMode: "CUSTOM",
            breakpoint: windowRecord.breakpoint || "DESKTOP"
        };
        if (Object.values(saved).some((value) => typeof value === "number" && !Number.isFinite(value))) throw new Error("Window geometry invalid.");
        const result = await selAjax.request({
            url: `/api/reference-data/pages/${encodeURIComponent(japaneseState.pageCode)}/configuration`,
            method: "POST",
            jsonData: { baseVersion: japaneseState.pageVersion, windows: [saved] }
        });
        japaneseState.pageVersion = Number(result.data?.version || japaneseState.pageVersion + 1);
        Object.assign(windowRecord, saved);
        japaneseState.editorController.setDefaultGeometry(windowRecord);
        return true;
    }

    /** 把 Grid、查询元素和 Window 登记到同一个页面编辑开关。 */
    function japaneseMountPageEditor(canEditPage, personalizationMessages) {
        japaneseState.personalizationController = personalization.mount(japanesePersonalizationHost, {
            backgroundController,
            messages: personalizationMessages,
            pageEditor: { canEdit: canEditPage },
            locale: {
                current: japaneseLocale,
                onChange: (nextLocale) => japaneseLocaleController?.setLocale(nextLocale) || false
            }
        });
        if (!japaneseState.personalizationController) throw new Error(japaneseText("errors.personalization"));
        if (!canEditPage || !japaneseState.pageCode) return;

        const tableHeading = japaneseState.panelRoot.querySelector('[data-sel-grid-role="table-heading"]');
        const tableCode = japaneseState.tableRecord?.code || japaneseText("pageEditor.notRegistered");
        japaneseState.personalizationController.registerPageControl({
            id: "selGridJapaneseN2BlueBookPageEditorId",
            type: "grid", typeLabel: japaneseText("pageEditor.grid"), title: japaneseText("title.title"), icon: "ri-table-line",
            root: japaneseState.panelRoot, editHost: tableHeading,
            coordinates: [
                { label: japaneseText("pageEditor.uniqueCode"), value: tableCode },
                { label: japaneseText("pageEditor.sourceTable"), value: "ReferenceDataTable" }
            ],
            captureState: () => ({ columnWidths: japaneseState.gridController.captureColumnWidths() }),
            saveState: japaneseSaveGridState
        });

        japaneseState.searchController.setIndependentLayout(true);
        const toolbar = panel.getComponent(japaneseGridId, "toolbar");
        const searchTargets = japaneseState.searchController.getLayoutTargets();
        const resetTarget = panel.getComponent(japaneseGridId, "filterReset");
        const nextRoundTarget = japaneseState.panelRoot.querySelector(
            '[data-sel-panel-component="toolbarAction"][data-sel-panel-command="nextRound"]'
        );
        const records = new Map((japaneseState.pageConfig.controls || []).map((record) => [String(record.fieldName), record]));
        const definitions = [
            { key: "sourceQuestionNo", target: searchTargets.sourceQuestionNo, title: japaneseText("pageEditor.questionNoQuery"), icon: "ri-hashtag", order: 10, min: 150, max: 320 },
            { key: "questionText", target: searchTargets.questionText, title: japaneseText("pageEditor.questionTextQuery"), icon: "ri-text", order: 20, min: 180, max: 480 },
            { key: "submit", target: searchTargets.submit, title: japaneseText("pageEditor.submit"), icon: "ri-search-eye-line", order: 30, min: 72, max: 160 },
            { key: "reset", target: resetTarget, title: japaneseText("pageEditor.reset"), icon: "ri-reset-left-line", order: 40, min: 80, max: 160 },
            { key: "nextRound", target: nextRoundTarget, title: japaneseText("pageEditor.nextRoundAction"), icon: "ri-restart-line", order: 50, min: 180, max: 420 }
        ].filter((definition) => definition.target instanceof Element);
        const sharedHost = element("span", { className: "japanese-toolbar-save-host", attributes: { "aria-label": japaneseText("pageEditor.save") } });
        definitions.at(-1).target.insertAdjacentElement("afterend", sharedHost);
        definitions.forEach((definition) => {
            const record = records.get(definition.key) || null;
            const editor = { ...definition, record, toolbar };
            const targetRect = definition.target.getBoundingClientRect();
            const toolbarRect = toolbar.getBoundingClientRect();
            japaneseState.toolbarEditors.set(definition.key, editor);
            japaneseState.personalizationController.registerPageControl({
                id: `selQuery${definition.key.charAt(0).toUpperCase()}${definition.key.slice(1)}JapanesePageEditorId`,
                type: "query-control", typeLabel: definition.title, title: definition.title, icon: definition.icon,
                root: definition.target,
                sharedEdit: { key: "japaneseToolbarControls", host: sharedHost, label: japaneseText("pageEditor.save"), follow: definition === definitions.at(-1) },
                geometry: {
                    container: toolbar, direct: true,
                    flow: {
                        key: "japaneseToolbarControls",
                        gap: 12,
                        order: definition.order,
                        moveGroup: definition.key === "sourceQuestionNo"
                    },
                    boundsHeight: 88, minWidth: definition.min, maxWidth: definition.max, minHeight: 42, maxHeight: 42,
                    state: {
                        x: record?.x ?? Math.round(targetRect.left - toolbarRect.left),
                        y: record?.y ?? Math.round(targetRect.top - toolbarRect.top),
                        width: record?.width || `${Math.round(targetRect.width)}px`,
                        height: record?.height || `${Math.round(targetRect.height)}px`
                    }
                },
                coordinates: [
                    { label: japaneseText("pageEditor.uniqueCode"), value: record?.code || japaneseText("pageEditor.notRegistered") },
                    { label: japaneseText("pageEditor.sourceTable"), value: "ReferenceDataControlLayout" }
                ],
                captureState: () => japaneseCaptureToolbarGeometry(editor),
                saveState: () => japaneseSaveToolbarGeometry(editor)
            });
        });

        const windowRecord = (japaneseState.pageConfig.windows || []).find((record) => String(record.triggerControlCode) === japaneseEditorId);
        if (!windowRecord) return;
        japaneseState.editorController.setDefaultGeometry(windowRecord);
        japaneseState.editorController.setPageEditMetadata({ title: "Window", code: windowRecord.code });
        const target = japaneseState.editorController.getPageEditTarget();
        japaneseState.personalizationController.registerPageControl({
            id: "selWindowJapaneseN2BlueBookPageEditorId",
            type: "window", typeLabel: japaneseText("pageEditor.window"), title: japaneseText("editor.editTitle"), icon: "ri-window-line",
            root: target.root, editHost: target.editHost,
            coordinates: [
                { label: japaneseText("pageEditor.uniqueCode"), value: windowRecord.code },
                { label: japaneseText("pageEditor.sourceTable"), value: "ReferenceDataWindow" }
            ],
            captureState: () => japaneseState.editorController.getGeometry(),
            saveState: (geometry) => japaneseSaveWindowState(windowRecord, geometry)
        });
    }

    /** 完成日语题库的一次性启动装配。 */
    async function mountApp() {
        // 语言、页面配置、权限和题目并行准备；Reference Data 不可用时页面使用默认配置。
        const [localeResources, , capability, page] = await Promise.all([
            japaneseLoadLocaleResources(japaneseLocale),
            japaneseLoadPageConfiguration(),
            selAjax.request({ url: "/api/reference-data/page-editor-capability" })
                .catch(() => ({ data: { canEditPage: false } })),
            japaneseLoadRecords()
        ]);
        japaneseMessages = localeResources.messages;
        selBase.setDocument({ lang: japaneseLocale, title: japaneseText("documentTitle") });
        japaneseAppHost.setAttribute("aria-label", japaneseText("pageAria"));
        await japaneseLoadGridColumns();
        japaneseApplyPage(page);
        await japaneseLoadTypeCounts();
        japaneseState.treeItems = japaneseBuildTreeItems();
        const payload = japaneseBuildPayload();
        const panelRoot = panel.create(japaneseAppHost, {
            gridId: japaneseGridId,
            sourceId: japaneseGridId,
            entity: "JapaneseN2BlueBookQuestion",
            view: "question-bank",
            layout: "single",
            structure: japaneseLayout,
            ariaLabel: payload.title.ariaLabel
        });
        if (!panelRoot) throw new Error(japaneseText("errors.panelCreate"));
        japaneseState.panelRoot = panelRoot;
        if (!panel.mount(panelRoot, japanesePanelLocaleOptions(payload))) throw new Error(japaneseText("errors.panelMount"));
        japaneseState.searchController = search.mount(panelRoot, payload.search);
        if (!japaneseState.searchController) throw new Error(japaneseText("errors.search"));
        japaneseState.treeController = tree.mount(panelRoot, payload.tree);
        if (!japaneseState.treeController) throw new Error(japaneseText("errors.tree"));
        dropdown.mountAll(panelRoot);
        japaneseState.gridController = grid.mount(panelRoot, payload);
        if (!japaneseState.gridController) throw new Error(japaneseText("errors.grid"));
        japaneseUpdateRoundToolbar();

        // 主工作区完成后再挂载编辑、确认和生成控件。
        japaneseState.editorController = windowComponent.mount(japaneseAppHost, { messages: localeResources.windowMessages, ...japaneseBuildEditorOptions(false) });
        japaneseState.deleteController = confirmDialog.mount(japaneseAppHost, { id: "selConfirmDialogJapaneseN2QuestionDeleteId", title: japaneseText("delete.title") });
        japaneseState.explanationController = confirmDialog.mount(japaneseAppHost, { id: "selConfirmDialogJapaneseN2ExplanationId", title: japaneseText("explanation.title") });
        japaneseState.nextRoundController = confirmDialog.mount(japaneseAppHost, { id: "selConfirmDialogJapaneseN2NextRoundId", title: japaneseText("round.title") });
        if (!japaneseState.editorController || !japaneseState.deleteController
                || !japaneseState.explanationController || !japaneseState.nextRoundController) {
            throw new Error(japaneseText("errors.window"));
        }
        japaneseInstallGenerationControls();
        japaneseMountTableEditor(localeResources.windowMessages);
        japaneseMountPageEditor(capability.data?.canEditPage === true, localeResources.personalizationMessages);

        // 新增、行操作、双击和 Window 提交都在稳定宿主集中绑定一次。
        panelRoot.addEventListener("selGrid:queryChange", async (event) => {
            const detail = event.detail;
            if (!detail || detail.gridId !== japaneseGridId) return;
            const values = detail.values || {};
            japaneseState.searchController?.setLoading(true);
            try {
                const pageResult = await japaneseLoadRecords({
                    pageNo: detail.pageNo,
                    pageSize: detail.pageSize,
                    sourceQuestionNo: values.sourceQuestionNo || "",
                    questionText: values.questionText || "",
                    questionType: detail.treeFilter?.questionType || detail.status || ""
                });
                japaneseApplyPage(pageResult, {
                    sourceQuestionNo: values.sourceQuestionNo || "",
                    questionText: values.questionText || "",
                    questionType: detail.treeFilter?.questionType || detail.status || ""
                });
                japaneseState.gridController.setLocale(japaneseBuildPayload());
            } catch (error) {
                japaneseShowError(error);
            } finally {
                japaneseState.searchController?.setLoading(false);
            }
        });
        panelRoot.addEventListener("selGrid:new", () => japaneseOpenEditor());
        panelRoot.addEventListener("selGrid:action", (event) => {
            const detail = event.detail;
            if (!detail || detail.instanceKey !== japaneseGridId) return;
            if (/^answer[A-D]$/.test(detail.action)) japaneseAnswer(detail.record, detail.action.slice(-1));
            if (detail.action === "playAudio") japanesePlayAudio(detail.record);
            if (detail.action === "explanation") japaneseShowExplanation(detail.record);
            if (detail.action === "edit") japaneseOpenEditor(detail.record);
            if (detail.action === "delete") japaneseRemoveQuestion(detail.record).catch(japaneseShowError);
        });
        panelRoot.addEventListener("dblclick", (event) => {
            const row = event.target.closest("tr[data-sel-grid-record-id]");
            if (!row) return;
            const record = japaneseState.records.find((item) => String(item.id) === row.dataset.selGridRecordId);
            if (record) japaneseOpenEditor(record);
        });
        japaneseAppHost.addEventListener("selWindow:submit", (event) => {
            if (event.detail?.id === japaneseEditorId) japaneseSaveQuestion(event.detail.values);
        });

        japaneseLocaleController = localeRuntime.create({
            initialLocale: japaneseLocale,
            supportedLocales: japaneseSupportedLocales
        });
        japaneseLocaleController.register({
            id: "sel.personalization",
            priority: 10,
            controller: japaneseState.personalizationController,
            load: (nextLocale) => selAjax.json({ url: japanesePersonalizationMessagesUrl.replaceAll("{locale}", nextLocale) })
        });
        japaneseLocaleController.register({
            id: "japanese.project",
            priority: 20,
            load: japaneseLoadLocaleResources,
            apply: japaneseApplyLocale
        });
        return true;
    }

    /** 把操作错误写入控制台和页面反馈区。 */
    function japaneseShowError(error) {
        console.error(japaneseText("errors.app", {}, "日语题库操作失败。"), error);
        const panelRoot = panel.get(japaneseGridId);
        const feedback = panelRoot?.querySelector("[data-sel-grid-role='feedback']");
        if (feedback) feedback.textContent = error.message || japaneseText("errors.app", {}, "日语题库操作失败。");
    }

    const backgroundController = pageBackground.mount(japaneseBackgroundHost, {
        defaults: { theme: "solid-dark", overlay: 0, brightness: 100, blur: 0 }
    });
    if (!backgroundController) throw new Error(japaneseText("errors.background", {}, "日语题库页面背景挂载失败。"));

    const japaneseReady = mountApp().catch((error) => {
        japaneseShowError(error);
        throw error;
    });
    window.japanese = {
        ready: japaneseReady,
        get locale() { return japaneseLocale; },
        setLocale: (nextLocale) => japaneseLocaleController?.setLocale(nextLocale) || Promise.resolve(false)
    };
}());
